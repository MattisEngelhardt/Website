/**
 * Act IV — The Horizon (built under the 12.06 doctrine).
 *
 * The finale, and the close of the Friedrich loop: Act 0 stood the wanderer
 * ABOVE the Sea of Fog; here, at the end of the journey, the fog has become a
 * luminous sea of cloud at golden hour, and the horizon is open — "the next
 * world is unwritten". Having followed the wanderer from behind through every
 * world, the visitor is now first-person above the clouds: they ARE the figure.
 *
 * The hero is not painted geometry but a physically-lit volumetric: a raymarched
 * cloud layer with Beer–Lambert extinction, a Henyey–Greenstein phase function
 * for the forward-scatter glow toward the low sun, and a powder term for the
 * dark cloud edges. This is the legitimate production technique for skies (the
 * same family as Horizon Zero Dawn / Red Dead 2), and the honest sky counterpart
 * to Act I's IFFT ocean — doctrine point 3 (physically plausible simulation),
 * not flat code-painting. (Gamechanger check: no free top-notch TSL cloud node
 * exists, so — like the ocean — it is hand-built; full style control stays ours.)
 *
 * Scroll drives setHorizon(t): the camera drifts forward over the cloud sea
 * toward the setting sun; near the end the clouds thin and the horizon opens
 * into a warm gold-out that resolves onto the contact page of the book.
 *
 * Realism act → NO Kuwahara; the same light cinematic finish as Act III
 * (bloom + warm grade + vignette + grain).
 */
import * as THREE from 'three/webgpu';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  Break,
  cameraPosition,
  clamp,
  exp,
  float,
  Fn,
  If,
  length,
  Loop,
  max,
  min,
  mix,
  mx_noise_float,
  normalize,
  pass,
  positionWorld,
  pow,
  screenSize,
  screenUV,
  smoothstep,
  step,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

export interface HorizonHandle {
  /** 0 = leaving the journey behind … 1 = arrival, the clouds part, gold-out */
  setHorizon(t: number): void;
  dispose(): void;
}

const q = (k: string, d: number): number => {
  if (typeof window === 'undefined') return d;
  const v = new URLSearchParams(window.location.search).get(k);
  const n = v === null ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
function smoothstepJs(e0: number, e1: number, x: number): number {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

export async function mountHorizon(
  canvas: HTMLCanvasElement,
): Promise<HorizonHandle | null> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  try {
    await renderer.init();
  } catch {
    return null; // the painted CSS fallback stays
  }
  // the raymarch is fragment-heavy; 1.0 keeps the soft cloud sea cheap (the
  // clouds hide the lower resolution). overridable via ?pr= on the spike.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q('pr', 1)));
  renderer.setClearColor(0x1a2236, 1);

  const scene = new THREE.Scene();

  const FOV = q('fov', 58);
  const camera = new THREE.PerspectiveCamera(
    FOV,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.05,
    4000,
  );

  /* ── the golden-hour sun, low over the cloud sea (we fly toward -Z) ───── */
  const uSunDir = uniform(
    new THREE.Vector3(q('sx', 0.04), q('sy', 0.085), q('sz', -1)).normalize(),
  );
  const uSunCol = uniform(new THREE.Vector3(1.45, 1.02, 0.6));
  const uAmbient = uniform(new THREE.Vector3(0.34, 0.4, 0.56).multiplyScalar(0.42));

  /* cloud-layer geometry (world units; camera rides just above the top) */
  const CLOUD_TOP = q('top', -2.4);
  const CLOUD_BOT = q('bot', -16);
  const MAXDIST = q('far', 260);
  const STEPS = Math.max(8, Math.round(q('steps', 38)));
  const LSTEPS = Math.max(2, Math.round(q('lsteps', 4)));
  const LSTEP = q('lstep', 1.3); // light-march step length toward the sun

  /* cloud look knobs (tunable via the /dev/horizon spike) */
  const uCloudScale = uniform(q('cs', 0.155));
  const uDensity = uniform(q('den', 1.5));
  const uCloudCut = uniform(q('cut', 0.5)); // coverage threshold; ↑ = fewer clouds
  const uSigma = uniform(q('sig', 1.1)); // view-ray extinction
  const uSigmaL = uniform(q('sigl', 1.15)); // sun-ward extinction
  const uG = uniform(q('g', 0.55)); // forward-scatter anisotropy
  const uPowder = uniform(q('pow', 0.7));
  const uWind = uniform(new THREE.Vector3(0, 0, 0));
  const uReveal = uniform(0); // end-of-act: the clouds thin, the horizon opens
  const uGoldOut = uniform(0); // end-of-act bloom toward gold

  const DEBUG =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  /* ── noise → fbm (three unrolled octaves of MaterialX value noise) ────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fbm: any = Fn(([p]: any) => {
    const n1 = mx_noise_float(p);
    const n2 = mx_noise_float(p.mul(2.03).add(vec3(11.5, 4.2, 7.8)));
    const n3 = mx_noise_float(p.mul(4.07).add(vec3(31.2, 19.7, 5.1)));
    const f = n1.mul(0.5).add(n2.mul(0.25)).add(n3.mul(0.125));
    return f.mul(0.5).add(0.5); // ≈ [0,1]
  });

  /* a one-octave noise — cheap occlusion for the sun-ward light march */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fbmLite: any = Fn(([p]: any) => mx_noise_float(p).mul(0.5).add(0.5));

  // shared height gradient: round bottoms, eroded tops
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heightGrad: any = Fn(([y]: any) => {
    const h = y.sub(CLOUD_BOT).div(CLOUD_TOP - CLOUD_BOT);
    return smoothstep(0.0, 0.18, h).mul(smoothstep(1.0, 0.5, h));
  });

  /* full density of the cloud volume at a world point (view march) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const densityAt: any = Fn(([p]: any) => {
    const wp = p.mul(uCloudScale).add(uWind);
    const d = max(fbm(wp).sub(uCloudCut), 0).mul(heightGrad(p.y));
    return d.mul(uDensity);
  });

  /* cheaper density for the light march toward the sun (coarse occlusion) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const densityLite: any = Fn(([p]: any) => {
    const wp = p.mul(uCloudScale).add(uWind);
    const d = max(fbmLite(wp).sub(uCloudCut), 0).mul(heightGrad(p.y));
    return d.mul(uDensity);
  });

  /* Henyey–Greenstein phase: the forward-scatter glow toward the sun */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phaseHG: any = Fn(([cosT, g]: any) => {
    const g2 = g.mul(g);
    const denom = max(float(1).add(g2).sub(g.mul(2).mul(cosT)), 0.0001);
    return float(1).sub(g2).div(pow(denom, 1.5)).mul(0.0795775); // 1/4π
  });

  /* ── the sky the clouds sit in: golden horizon, turquoise zenith ─────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skyColor: any = Fn(([d]: any) => {
    const up = clamp(d.y, -1, 1);
    const horizon = vec3(0.98, 0.64, 0.4); // warm gold band
    const zenith = vec3(0.16, 0.31, 0.56); // turquoise-blue
    const below = vec3(0.5, 0.36, 0.4); // muted, just under the cloud sea
    let sky: any = mix(horizon, zenith, smoothstep(0.0, 0.55, up));
    sky = mix(below, sky, smoothstep(-0.16, 0.02, up));
    // the low sun: a soft disc + a wide warm glow toward -Z
    const cosS = clamp(d.dot(uSunDir), -1, 1);
    const disc = pow(max(cosS, 0), 1600).mul(2.1);
    const glow = pow(max(cosS, 0), 52).mul(0.6); // tighter halo so cloud detail survives
    sky = sky.add(vec3(1.5, 1.05, 0.62).mul(disc.add(glow)));
    return sky;
  });

  /* ── the volumetric: raymarch the slab, composite over the sky ───────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloudColor: any = Fn(([ro, rd]: any) => {
    // analytic slab intersection (denom clamped ≤ -0.002 so it never blows up)
    const denom = min(rd.y, -0.002);
    const invy = float(1).div(denom);
    const tEnter = clamp(float(CLOUD_TOP).sub(ro.y).mul(invy), 0, MAXDIST);
    const tExit = clamp(float(CLOUD_BOT).sub(ro.y).mul(invy), 0, MAXDIST);
    // only rays angled below the horizon traverse the sea below us
    const goingDown = float(1).sub(step(float(-0.002), rd.y));
    const stepLen = tExit.sub(tEnter).mul(goingDown).div(STEPS);

    const trans = float(1).toVar();
    const scatter = vec3(0).toVar();
    const t = tEnter.add(stepLen.mul(0.5)).toVar();

    Loop(STEPS, () => {
      If(trans.lessThan(0.02), () => {
        Break();
      });
      const p = ro.add(rd.mul(t));
      const dens = densityAt(p);
      If(dens.greaterThan(0.001), () => {
        // march toward the sun to gather how lit this sample is
        const lt = float(0).toVar();
        const lp = p.toVar();
        Loop(LSTEPS, () => {
          lp.addAssign(uSunDir.mul(LSTEP));
          lt.addAssign(densityLite(lp));
        });
        const lightT = exp(lt.mul(-LSTEP).mul(uSigmaL));
        const powder = float(1).sub(exp(dens.mul(-2.0)));
        const phase = phaseHG(rd.dot(uSunDir), uG);
        const lum = uSunCol
          .mul(lightT)
          .mul(phase)
          .mul(mix(float(1), powder, uPowder))
          .add(uAmbient);
        const sampleTrans = exp(dens.mul(stepLen).mul(-1).mul(uSigma));
        scatter.addAssign(trans.mul(float(1).sub(sampleTrans)).mul(lum));
        trans.mulAssign(sampleTrans);
      });
      t.addAssign(stepLen);
    });

    const sky = skyColor(rd);
    return sky.mul(trans).add(scatter);
  });

  /* ── the environment dome carries the whole scene ────────────────────── */
  const skyMat = new THREE.MeshBasicNodeMaterial();
  skyMat.side = THREE.BackSide;
  {
    const ro = cameraPosition;
    const rd = normalize(positionWorld.sub(cameraPosition));
    if (DEBUG.has('sky')) {
      skyMat.colorNode = vec4(skyColor(rd), 1);
    } else {
      skyMat.colorNode = vec4(cloudColor(ro, rd), 1);
    }
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 36, 18), skyMat);
  scene.add(sky);

  /* ── the flight state ────────────────────────────────────────────────── */
  const baseCam = new THREE.Vector3();
  const baseLook = new THREE.Vector3();
  const CUT0 = uCloudCut.value;

  function applyHorizon(t: number) {
    const ft = clamp01(t);
    // drift forward over the sea, sinking gently toward it
    const z = -ft * 64;
    const y = 0.8 - ft * 1.5;
    baseCam.set(0, y, z);
    baseLook.set(0, y - 2.4, z - 44);
    // arrival: the clouds thin and the horizon opens, then the gold-out blooms
    uReveal.value = smoothstepJs(0.7, 1, ft);
    uCloudCut.value = CUT0 + uReveal.value * 0.24;
    uGoldOut.value = smoothstepJs(0.82, 1, ft);
  }
  applyHorizon(0);

  /* ── post: the same light cinematic finish as Act III (no Kuwahara) ──── */
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const sceneTex = scenePass.getTextureNode();
  {
    const glow = bloom(sceneTex, q('bloom', 0.32), 0.7, 0.82); // sun + lit cloud tops
    const vignette = float(1).sub(length(screenUV.sub(vec2(0.5))).pow(2).mul(0.4));
    const grain = mx_noise_float(
      vec3(screenUV.mul(screenSize).mul(0.5), time.mul(0.3)),
    ).mul(0.018);
    let outc: any = sceneTex.rgb.add(glow.rgb.mul(0.95));
    outc = outc.mul(vec3(1.04, 1.0, 0.96)).add(grain); // warm grade
    // the closing gold wash that hands off to the page
    outc = mix(outc, vec3(1.18, 0.9, 0.54), uGoldOut.mul(uGoldOut).mul(0.72));
    pipeline.outputNode = vec4(outc.mul(vignette), 1);
  }

  /* ── fit ─────────────────────────────────────────────────────────────── */
  function fit() {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fit();
  window.addEventListener('resize', fit);

  /* ── pointer: a gentle lean over the cloud sea ───────────────────────── */
  const pointer = new THREE.Vector2(0, 0);
  function onPointerMove(e: PointerEvent) {
    pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1,
    );
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* ── loop ────────────────────────────────────────────────────────────── */
  const t0 = performance.now();
  const right = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const upV = new THREE.Vector3(0, 1, 0);
  const eased = new THREE.Vector2(0, 0);
  let firstFrame = true;

  function loop() {
    // slow high-altitude drift so the sea breathes (parallax comes from travel)
    const e = (performance.now() - t0) * 0.001;
    uWind.value.set(e * 0.013, e * 0.004, e * 0.009);

    eased.lerp(pointer, 0.05);
    fwd.subVectors(baseLook, baseCam).normalize();
    right.crossVectors(fwd, upV).normalize();
    camera.position.copy(baseCam).addScaledVector(right, eased.x * 2.0);
    camera.position.y += eased.y * -0.8;
    camera.lookAt(baseLook.x, baseLook.y + eased.y * -1.2, baseLook.z);
    sky.position.copy(camera.position);

    pipeline.render();

    if (firstFrame) {
      firstFrame = false;
      canvas.closest('[data-scene]')?.classList.add('is-live');
    }
  }
  renderer.setAnimationLoop(loop);

  const io = new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry?.isIntersecting ? loop : null);
  });
  io.observe(canvas);

  return {
    setHorizon(t: number) {
      applyHorizon(t);
    },
    dispose() {
      io.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      sky.geometry.dispose();
      pipeline.dispose();
      renderer.dispose();
    },
  };
}
