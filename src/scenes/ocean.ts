/**
 * The ocean — a Tessendorf IFFT sea on WebGPU compute.
 *
 * The doctrine for Act I: not the patient hand-Gerstner swell of the
 * first pass, but a physically synthesised sea. A JONSWAP spectrum seeds
 * a field of wave amplitudes h0(k); each frame the field is advanced in
 * time and inverse-FFT'd back to the spatial domain, yielding a height
 * field, a choppy horizontal displacement (sharp crests), surface slopes
 * (for normals) and a foam factor (where the surface folds — breaking
 * crests). Everything runs in TSL compute, in the same WebGPU idiom the
 * rest of the project uses — no workers, no raw WGSL, no SharedArrayBuffers.
 *
 * The transform is a Stockham radix-2 FFT (GPU-Gems form): it auto-sorts
 * as it goes, so there is no separate bit-reversal pass and no butterfly
 * index texture to get wrong. Each pass reads two texels and writes two
 * contiguous texels, doubling the sub-transform size; we run all passes
 * along the columns, then all passes along the rows, ping-ponging between
 * two textures, for a full 2-D inverse transform.
 *
 * Five real spatial fields are produced — Dy (height), Dx, Dz (choppy
 * displacement), Sx, Sz (slopes) — carried as complex spectra. They pack
 * into the RGBA channels of three textures (two complex pairs each), so
 * one FFT schedule transforms all five at once.
 *
 * The CPU keeps a small mirror — the K strongest spectral components —
 * so the ship and the skiff float on an honest height+slope sampled at
 * their own position, in sync with the GPU surface, without a readback.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  instanceIndex,
  int,
  ivec2,
  textureLoad,
  textureStore,
  uint,
  uniform,
  uvec2,
  vec4,
} from 'three/tsl';

const G = 9.81;
const TAU = Math.PI * 2;

export interface OceanOptions {
  size?: number;     // FFT resolution (power of two). 256 detailed, 128 light.
  patch?: number;    // spatial tile size, world units
  wind?: number;     // wind speed m/s
  heading?: number;  // wave travel heading, radians
  amplitude?: number;
  choppy?: number;
}

export interface Ocean {
  size: number;
  patch: number;
  displacementTex: THREE.StorageTexture; // Dx, Dy, Dz in rgb
  derivativeTex: THREE.StorageTexture;   // slope.x, slope.z, foam in rgb
  update(t: number): Promise<void>;
  heightAt(x: number, z: number, t: number): number;
  slopeAt(x: number, z: number, t: number, out: { x: number; z: number }): void;
  dispose(): void;
}

/* ── deterministic standard-normal (Box–Muller on a seeded LCG) ──────── */
function makeRng(seed: number) {
  let s = seed >>> 0;
  const u = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  return () => {
    const a = Math.max(u(), 1e-7);
    const b = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(TAU * b);
  };
}

/* ── JONSWAP spectrum S(ω) for a developing open sea ─────────────────── */
function jonswap(omega: number, wind: number): number {
  if (omega <= 1e-4) return 0;
  const fetch = 120_000; // m
  const wp = 22 * Math.pow((G * G) / (wind * fetch), 1 / 3);
  const gamma = 3.3;
  const sigma = omega <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((omega - wp) ** 2) / (2 * sigma * sigma * wp * wp));
  const alpha = 0.076 * Math.pow((wind * wind) / (fetch * G), 0.22);
  const base = ((alpha * G * G) / omega ** 5) * Math.exp((-5 / 4) * (wp / omega) ** 4);
  return base * Math.pow(gamma, r);
}

interface TopWave {
  kx: number; kz: number; omega: number;
  /** combined real/imag of h0(k) + conj(h0(-k)) so the mirror is one cosine sum */
  ar: number; ai: number;
  energy: number;
}

export function createOcean(
  renderer: THREE.WebGPURenderer,
  opts: OceanOptions = {},
): Ocean {
  const N = opts.size ?? 256;
  const L = opts.patch ?? 220;
  const wind = opts.wind ?? 11;
  const heading = opts.heading ?? Math.PI * 0.5;
  const amp = opts.amplitude ?? 1.0;
  const choppy = opts.choppy ?? 1.0;

  const passes = Math.round(Math.log2(N));
  if (1 << passes !== N) throw new Error(`ocean size must be power of two, got ${N}`);

  /* ── 1. seed the spectrum on the CPU → two float textures ───────────
     h0Tex  = h0(k)            (rg = re, im)
     h0cTex = conj(h0(-k))     (rg = re, im)
     and harvest the K strongest waves for the CPU float mirror.        */
  const h0Data = new Float32Array(N * N * 4);
  const h0cData = new Float32Array(N * N * 4);
  const rng = makeRng(0x5eed1234);
  const wx = Math.sin(heading);
  const wz = Math.cos(heading);
  const dk = TAU / L;

  // light Nyquist guard only — damp the very smallest ripples (a couple of
  // cells) so they don't alias, but keep the chop alive. The big-swell vs.
  // tiling problem is solved by running a second cascade, not by damping.
  const smallCut = (L / N) * 0.6;

  const sampleH0 = (kx: number, kz: number): [number, number] => {
    const kmag = Math.hypot(kx, kz);
    if (kmag < 1e-4) return [0, 0];
    const omega = Math.sqrt(G * kmag);
    const dwdk = G / (2 * omega);
    const s = jonswap(omega, wind);
    // broad directional spreading (cos^4 about the wind, with a small
    // back-lobe) — wide enough that no single wavelength forms parallel
    // bands, so the surface reads as a real, broken sea.
    const ang = Math.acos(Math.max(-1, Math.min(1, (kx * wx + kz * wz) / kmag)));
    const dir = Math.cos(ang / 2) ** 4 + 0.06;
    // high-k roll-off (Tessendorf): damp the smallest ripples so the swell
    // dominates and the surface doesn't fizz.
    const damp = Math.exp(-((kmag * smallCut) ** 2));
    const energy = ((s * dwdk) / kmag) * dir * dk * dk * 0.5 * damp;
    const a = Math.sqrt(Math.max(energy, 0)) * amp;
    return [(rng() * a) / Math.SQRT2, (rng() * a) / Math.SQRT2];
  };

  const cand: TopWave[] = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const ni = i - N / 2;
      const nj = j - N / 2;
      const kx = dk * ni;
      const kz = dk * nj;
      const [hr, hi] = sampleH0(kx, kz);
      const [mr, mi] = sampleH0(-kx, -kz);
      const idx = (j * N + i) * 4;
      h0Data[idx] = hr; h0Data[idx + 1] = hi;
      h0cData[idx] = mr; h0cData[idx + 1] = -mi; // conj
      const kmag = Math.hypot(kx, kz);
      if (kmag > 1e-4) {
        // h(k,t)=h0 e^{iωt}+conj(h0(-k)) e^{-iωt}; Re at phase θ=k·x is
        // (hr+mr)cosθ − (hi−mi)sinθ → store as one wave for the mirror
        const ar = hr + mr;
        const ai = hi - mi;
        cand.push({ kx, kz, omega: Math.sqrt(G * kmag), ar, ai, energy: ar * ar + ai * ai });
      }
    }
  }

  const h0Tex = new THREE.DataTexture(h0Data, N, N, THREE.RGBAFormat, THREE.FloatType);
  h0Tex.needsUpdate = true;
  const h0cTex = new THREE.DataTexture(h0cData, N, N, THREE.RGBAFormat, THREE.FloatType);
  h0cTex.needsUpdate = true;

  const K = 28;
  cand.sort((a, b) => b.energy - a.energy);
  const top = cand.slice(0, K);

  /* ── storage textures ──────────────────────────────────────────────
     specA/B/C hold the time-evolved complex spectra (two complex pairs
     each). ping/pong A/B/C are the FFT scratch. Two output textures feed
     the water material.                                                 */
  const mk = () => {
    const t = new THREE.StorageTexture(N, N);
    t.format = THREE.RGBAFormat;
    t.type = THREE.FloatType;
    return t;
  };
  const specA = mk(), specB = mk(), specC = mk();
  const pingA = mk(), pongA = mk();
  const pingB = mk(), pongB = mk();
  const pingC = mk(), pongC = mk();
  const displacementTex = mk();
  const derivativeTex = mk();

  const uTime = uniform(0);

  /* ── dispersion: build h(k,t) and the derived spectra ──────────────
     channels: specA = (Dy.re, Dy.im, Dx.re, Dx.im)
               specB = (Dz.re, Dz.im, Sx.re, Sx.im)
               specC = (Sz.re, Sz.im, 0, 0)                              */
  const dispersion = Fn(() => {
    const li = int(instanceIndex);
    const x = li.mod(N);
    const y = li.div(N);
    const id = ivec2(x, y);

    const kx = float(x).sub(N / 2).mul(dk);
    const kz = float(y).sub(N / 2).mul(dk);
    const kmag = kx.mul(kx).add(kz.mul(kz)).sqrt().max(1e-4);
    const omega = kmag.mul(G).sqrt();

    const phase = omega.mul(uTime);
    const cp = phase.cos();
    const sp = phase.sin();

    const h0 = textureLoad(h0Tex, id);
    const h0c = textureLoad(h0cTex, id);
    const a = h0.x, b = h0.y, c = h0c.x, d = h0c.y;

    // h = h0(cp+i sp) + h0c(cp−i sp)
    const hr = a.mul(cp).sub(b.mul(sp)).add(c.mul(cp)).add(d.mul(sp));
    const hi = a.mul(sp).add(b.mul(cp)).sub(c.mul(sp)).add(d.mul(cp));

    const nkx = kx.div(kmag), nkz = kz.div(kmag);
    // Dx = −i (kx/|k|) h  → (hi·nkx, −hr·nkx)
    const Dxr = hi.mul(nkx), Dxi = hr.mul(nkx).negate();
    const Dzr = hi.mul(nkz), Dzi = hr.mul(nkz).negate();
    // Sx = i kx h  → (−hi·kx, hr·kx)
    const Sxr = hi.mul(kx).negate(), Sxi = hr.mul(kx);
    const Szr = hi.mul(kz).negate(), Szi = hr.mul(kz);

    const uid = uvec2(uint(x), uint(y));
    textureStore(specA, uid, vec4(hr, hi, Dxr, Dxi)).toWriteOnly();
    textureStore(specB, uid, vec4(Dzr, Dzi, Sxr, Sxi)).toWriteOnly();
    textureStore(specC, uid, vec4(Szr, Szi, float(0), float(0))).toWriteOnly();
  });

  /* ── one Stockham radix-2 inverse-FFT pass (baked stride + axis) ────
     GPU-Gems Stockham form. For output thread index t along the axis:
       Ns      = 1 << p           (sub-FFT size BEFORE this pass)
       j       = t mod Ns         (position within the sub-FFT)
       base    = (t div Ns) * Ns  (sub-FFT block base, in *output* space)
     read indices (in the source's natural order):
       i0 = base + j
       i1 = i0 + N/2
     twiddle (inverse → +sign): W = exp(+i·π·j/Ns)
     write contiguous: out[2*base + j] = i0 + W·i1
                       out[2*base + j + Ns] = i0 − W·i1
     Operates on both complex pairs (.xy and .zw) at once.              */
  const buildPass = (
    src: THREE.StorageTexture, dst: THREE.StorageTexture, p: number, horiz: 0 | 1,
  ) => {
    const Ns = 1 << p;
    return Fn(() => {
      const li = int(instanceIndex);
      const x = li.mod(N);
      const y = li.div(N);
      const t = horiz === 1 ? x : y;     // index along transform axis (int)
      const line = horiz === 1 ? y : x;  // fixed cross index (int)

      const j = t.mod(Ns);
      const base = t.div(Ns).mul(Ns);
      const i0 = base.add(j);
      const i1 = i0.add(N / 2);

      const ang = float(j).div(Ns).mul(Math.PI); // +π j / Ns  (inverse)
      const wr = ang.cos();
      const wi = ang.sin();

      // read with int coords, write with uint coords
      const rd = (idx: typeof i0) =>
        horiz === 1 ? ivec2(idx, line) : ivec2(line, idx);
      const wc = (idx: typeof i0) =>
        horiz === 1
          ? uvec2(uint(idx), uint(line))
          : uvec2(uint(line), uint(idx));

      const A = textureLoad(src, rd(i0));
      const B = textureLoad(src, rd(i1));

      // W·B for both complex pairs
      const bx = wr.mul(B.x).sub(wi.mul(B.y));
      const by = wr.mul(B.y).add(wi.mul(B.x));
      const bz = wr.mul(B.z).sub(wi.mul(B.w));
      const bw = wr.mul(B.w).add(wi.mul(B.z));

      const sum = vec4(A.x.add(bx), A.y.add(by), A.z.add(bz), A.w.add(bw));
      const dif = vec4(A.x.sub(bx), A.y.sub(by), A.z.sub(bz), A.w.sub(bw));

      const o0 = base.mul(2).add(j);
      const o1 = o0.add(Ns);
      textureStore(dst, wc(o0), sum).toWriteOnly();
      textureStore(dst, wc(o1), dif).toWriteOnly();
    });
  };

  /* schedule: for each spectrum texture, all column passes then all row
     passes, ping-ponging. With log2(N) passes per axis the parity of the
     pass count decides whether the result lands in ping or pong; we record
     the actual final texture per spectrum so assemble() reads the right one. */
  const triples = [
    { spec: specA, ping: pingA, pong: pongA },
    { spec: specB, ping: pingB, pong: pongB },
    { spec: specC, ping: pingC, pong: pongC },
  ];
  // compute nodes are dispatched via renderer.computeAsync; the node type is
  // the return of Fn(...)().compute(...).
  type ComputeNode = ReturnType<ReturnType<ReturnType<typeof buildPass>>['compute']>;
  const schedule: ComputeNode[] = [];
  const finals: THREE.StorageTexture[] = [];

  for (const tr of triples) {
    let src: THREE.StorageTexture = tr.spec;
    let dst: THREE.StorageTexture = tr.ping;
    let other: THREE.StorageTexture = tr.pong;
    const step = (horiz: 0 | 1, p: number) => {
      const node = buildPass(src, dst, p, horiz)().compute(N * N);
      schedule.push(node);
      // advance ping-pong: next src is what we just wrote
      const nextSrc = dst;
      const nextDst = src === tr.spec ? other : src; // never write back into spec
      src = nextSrc; dst = nextDst; other = src === tr.ping ? tr.pong : tr.ping;
    };
    for (let p = 0; p < passes; p++) step(0, p); // columns
    for (let p = 0; p < passes; p++) step(1, p); // rows
    finals.push(src); // src now points at the last texture written
  }

  /* ── assemble the spatial outputs ─────────────────────────────────── */
  const [fA, fB, fC] = finals;
  const assemble = Fn(() => {
    const li = int(instanceIndex);
    const x = li.mod(N);
    const y = li.div(N);
    const id = ivec2(x, y);
    const uid = uvec2(uint(x), uint(y));

    const A = textureLoad(fA, id); // Dy.re, Dy.im, Dx.re, Dx.im
    const B = textureLoad(fB, id); // Dz.re, Dz.im, Sx.re, Sx.im
    const C = textureLoad(fC, id); // Sz.re, Sz.im

    const Dy = A.x;
    const Dx = A.z.mul(choppy);
    const Dz = B.x.mul(choppy);
    const Sx = B.z;
    const Sz = C.x;

    // folding of the horizontal map → foam on breaking crests
    const fold = float(1).sub(Sx.abs().add(Sz.abs()).mul(choppy * 0.5));
    const foam = fold.mul(-1).max(0).clamp(0, 1);

    textureStore(displacementTex, uid, vec4(Dx, Dy, Dz, float(1))).toWriteOnly();
    textureStore(derivativeTex, uid, vec4(Sx, Sz, foam, float(1))).toWriteOnly();
  });

  const dispersionNode = dispersion().compute(N * N);
  const assembleNode = assemble().compute(N * N);

  // the full ordered pipeline for one frame: dispersion → all FFT passes →
  // assemble. Dependency order is preserved by the storage read/write chain,
  // so we can issue them as ONE synchronous batch (one queue submit) instead
  // of awaiting each pass — far less CPU/GPU sync overhead.
  const pipeline = [dispersionNode, ...schedule, assembleNode];

  async function update(t: number) {
    uTime.value = t;
    await renderer.computeAsync(pipeline);
  }

  /* ── CPU mirror: honest height + slope from the top-K components ───── */
  function heightAt(x: number, z: number, t: number): number {
    let h = 0;
    for (const w of top) {
      const th = w.kx * x + w.kz * z - w.omega * t;
      h += w.ar * Math.cos(th) - w.ai * Math.sin(th);
    }
    return h;
  }
  function slopeAt(x: number, z: number, t: number, out: { x: number; z: number }) {
    let sx = 0, sz = 0;
    for (const w of top) {
      const th = w.kx * x + w.kz * z - w.omega * t;
      // d/dx [ar cosθ − ai sinθ] = −kx(ar sinθ + ai cosθ)
      const dh = -(w.ar * Math.sin(th) + w.ai * Math.cos(th));
      sx += w.kx * dh;
      sz += w.kz * dh;
    }
    out.x = sx; out.z = sz;
  }

  function dispose() {
    h0Tex.dispose(); h0cTex.dispose();
    for (const tx of [
      specA, specB, specC, pingA, pongA, pingB, pongB, pingC, pongC,
      displacementTex, derivativeTex,
    ]) tx.dispose();
  }

  return {
    size: N, patch: L,
    displacementTex, derivativeTex,
    update, heightAt, slopeAt, dispose,
  };
}
