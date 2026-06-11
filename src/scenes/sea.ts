/**
 * Act I — The Sea.
 *
 * An Aivazovsky marine: a low sun over open water, a golden road of
 * light on the swell, and a ship crossing it — the carrier of the
 * biography. Gerstner waves displace the water in the vertex stage;
 * light is painted by hand in the fragment (sun road via reflection,
 * glass-green crests, aerial fade into the horizon).
 *
 * The cursor is a brush of light: it leaves a fading trail of sun on
 * the water where it passes (drawn into a canvas, sampled in world
 * space by the water shader).
 *
 * Scroll drives `setVoyage(t)`: the palette deepens from golden hour
 * into dusk, the ship sails out of the far light toward the viewer,
 * the camera leans down to the water — and the sun blooms into the
 * gold-out that resolves onto the next page of the book.
 *
 * Same painting pipeline as the summit (Kuwahara), without the lens —
 * the sea's interaction is the light, not the window.
 */
import * as THREE from 'three/webgpu';
import {
  cameraPosition,
  exp,
  float,
  length,
  max,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  reflect,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import { createPainting } from './painting';

/* ── Palettes: golden hour → dusk over one voyage ────────────────── */

interface SeaPalette {
  zenith: number;
  mid: number;
  horizon: number;
  sunCore: number;
  sunHalo: number;
  waterDeep: number;
  waterLift: number;
  crest: number;
  /** sun height above the horizon line, in sky-uv units */
  sunY: number;
  sunIntensity: number;
}

const GOLDEN_SEA: SeaPalette = {
  zenith: 0x35466e, mid: 0xc97f4e, horizon: 0xffb45e,
  sunCore: 0xfff1c0, sunHalo: 0xff9e4a,
  waterDeep: 0x16243c, waterLift: 0x2e7a76, crest: 0x8fd0bd,
  sunY: 0.075, sunIntensity: 1.0,
};
const DUSK_SEA: SeaPalette = {
  zenith: 0x232a4a, mid: 0x5d4a6e, horizon: 0xc06a44,
  sunCore: 0xffc95c, sunHalo: 0xc9452a,
  waterDeep: 0x11182b, waterLift: 0x275f68, crest: 0xc98a6a,
  sunY: 0.02, sunIntensity: 1.05,
};

/* ── The waves (shared by GPU displacement and CPU ship float) ──── */

interface WaveTrain {
  dir: [number, number]; // in plane-local xy; negative y travels toward camera
  len: number; // wavelength, world units
  amp: number;
  steep: number;
}

// a long swell with cross-chop on top; total amplitude ≈ 0.85
// (a patient sea — the camera rides above it, not inside it)
const WAVES: WaveTrain[] = [
  { dir: [0.1, -1.0], len: 34, amp: 0.34, steep: 0.5 },
  { dir: [0.28, -0.96], len: 21, amp: 0.22, steep: 0.55 },
  { dir: [-0.38, -0.93], len: 12.5, amp: 0.14, steep: 0.6 },
  { dir: [0.86, -0.51], len: 7.5, amp: 0.07, steep: 0.7 },
  { dir: [-0.65, -0.76], len: 4.6, amp: 0.04, steep: 0.8 },
  { dir: [0.16, -0.99], len: 2.7, amp: 0.022, steep: 0.9 },
];

const G = 9.81;
const TIME_SCALE = 0.42; // a patient, painterly sea

interface WaveConst {
  dx: number;
  dy: number;
  k: number;
  amp: number;
  q: number; // per-wave steepness factor Q/(k·A·N)
  speed: number; // phase speed × k  (rad/s)
}

const WAVE_CONSTS: WaveConst[] = WAVES.map((w) => {
  const len = Math.hypot(w.dir[0], w.dir[1]);
  const k = (2 * Math.PI) / w.len;
  return {
    dx: w.dir[0] / len,
    dy: w.dir[1] / len,
    k,
    amp: w.amp,
    q: w.steep / (k * w.amp * WAVES.length),
    speed: Math.sqrt(G * k),
  };
});

/** CPU mirror of the Gerstner sum (vertical only) — floats the ship */
function waveHeightAt(x: number, yLocal: number, t: number): number {
  let h = 0;
  for (const w of WAVE_CONSTS) {
    const f = w.k * (w.dx * x + w.dy * yLocal) - w.speed * t;
    h += w.amp * Math.sin(f);
  }
  return h;
}

/* ── The ship, drawn in code (a brig with the wind aft) ──────────── */

const SHIP_W = 768;
const SHIP_H = 512;

function drawShip(): HTMLCanvasElement {
  const cnv = document.createElement('canvas');
  cnv.width = SHIP_W;
  cnv.height = SHIP_H;
  const ctx = cnv.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

  /* hull — bow left, gentle sheer, transom stern */
  ctx.beginPath();
  ctx.moveTo(105, 298); // bow at the waterline shoulder
  ctx.quadraticCurveTo(360, 282, 640, 286); // deck line
  ctx.lineTo(648, 302); // transom
  ctx.quadraticCurveTo(620, 348, 590, 346); // stern underside
  ctx.quadraticCurveTo(370, 366, 150, 350); // keel run
  ctx.quadraticCurveTo(118, 340, 105, 298); // bow stem
  ctx.closePath();
  ctx.fill();

  /* bowsprit */
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(110, 296);
  ctx.lineTo(20, 256);
  ctx.stroke();

  /* masts, raked slightly aft */
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(252, 296);
  ctx.lineTo(268, 82);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(452, 292);
  ctx.lineTo(472, 50);
  ctx.stroke();

  /* sails at mid-alpha — the shader reads the alpha channel as cloth
     vs. hull: sails render as sun-lit canvas, the hull stays ink */
  ctx.globalAlpha = 0.55;

  // fore course, billowing toward the bow
  ctx.beginPath();
  ctx.moveTo(196, 252);
  ctx.quadraticCurveTo(150, 205, 184, 162);
  ctx.lineTo(330, 156);
  ctx.quadraticCurveTo(352, 205, 338, 248);
  ctx.closePath();
  ctx.fill();

  // fore topsail
  ctx.beginPath();
  ctx.moveTo(190, 156);
  ctx.quadraticCurveTo(165, 128, 202, 104);
  ctx.lineTo(312, 100);
  ctx.quadraticCurveTo(330, 128, 324, 152);
  ctx.closePath();
  ctx.fill();

  // main gaff sail with its boom
  ctx.beginPath();
  ctx.moveTo(462, 285);
  ctx.lineTo(458, 92);
  ctx.lineTo(640, 128);
  ctx.quadraticCurveTo(668, 210, 652, 276);
  ctx.closePath();
  ctx.fill();

  // jibs running to the bowsprit
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(28, 258);
  ctx.lineTo(252, 96);
  ctx.lineTo(132, 296);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(82, 272);
  ctx.lineTo(258, 140);
  ctx.lineTo(168, 298);
  ctx.closePath();
  ctx.fill();

  /* rigging — dark lines, full alpha so the shader keeps them ink */
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 256);
  ctx.lineTo(268, 84);
  ctx.lineTo(472, 52);
  ctx.lineTo(644, 288);
  ctx.stroke();

  /* pennant at the main top */
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(472, 52);
  ctx.lineTo(420, 60);
  ctx.lineTo(472, 70);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  return cnv;
}

/* ── Scene ───────────────────────────────────────────────────────── */

const CAM_FOV = 55;
const SKY_DIST = 160;
const KUWAHARA_RADIUS = 4;

// the water window the cursor's light trail lives in (world units)
const TRAIL_X = 70; // x ∈ [-70, 70]
const TRAIL_Z0 = -150; // z ∈ [-150, 10]
const TRAIL_Z1 = 10;
const TRAIL_RES = 256;

export interface SeaHandle {
  /** 0 = golden departure … 1 = dusk, ship close, gold-out */
  setVoyage(t: number): void;
  dispose(): void;
}

export async function mountSea(
  canvas: HTMLCanvasElement,
): Promise<SeaHandle | null> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });

  try {
    await renderer.init();
  } catch {
    return null; // the painted CSS sea stays
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CAM_FOV,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    400,
  );
  camera.position.set(0, 5.2, 14); // above the swell, like a deck rail

  /* shared uniforms (palette written on the CPU per voyage step) */
  const uZenith = uniform(new THREE.Color());
  const uMid = uniform(new THREE.Color());
  const uHorizon = uniform(new THREE.Color());
  const uSunCore = uniform(new THREE.Color());
  const uSunHalo = uniform(new THREE.Color());
  const uWaterDeep = uniform(new THREE.Color());
  const uWaterLift = uniform(new THREE.Color());
  const uCrest = uniform(new THREE.Color());
  const uSunPos = uniform(new THREE.Vector2(0.56, 0.575));
  const uSunDir = uniform(new THREE.Vector3(0.1, 0.08, -1).normalize());
  const uSunIntensity = uniform(1);
  const uSkyAspect = uniform(1.8);
  // one clock for GPU waves AND the CPU mirror that floats the ship
  const uTime = uniform(0);

  /* ── the sky: horizon line at uv 0.5, sun low above it ── */
  const skyMat = new THREE.MeshBasicNodeMaterial();
  {
    const u = uv();
    const lower = mix(uHorizon, uMid, smoothstep(0.5, 0.8, u.y));
    const sky = mix(lower, uZenith, smoothstep(0.66, 0.96, u.y));
    const d = length(u.sub(uSunPos).mul(vec2(uSkyAspect, 1)));
    // a crisp low sun disc inside a restrained halo — never a wash
    const core = exp(d.mul(-55.0)).mul(uSunIntensity).mul(1.25);
    const halo = exp(d.mul(-6.5)).mul(uSunIntensity).mul(0.45);
    // the dusk glow hugs the waterline
    const band = exp(u.y.sub(0.5).abs().mul(-9.0))
      .mul(exp(u.x.sub(uSunPos.x).abs().mul(-2.6)))
      .mul(uSunIntensity)
      .mul(0.1);
    const grain = mx_noise_float(vec3(u.mul(3.0), time.mul(0.02))).mul(0.015);
    skyMat.colorNode = sky
      .add(uSunCore.mul(core))
      .add(uSunHalo.mul(halo))
      .add(uSunHalo.mul(band))
      .add(grain);
  }
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyMat);
  skyMesh.position.set(0, camera.position.y, -SKY_DIST);
  scene.add(skyMesh);

  /* ── the cursor's trail of light (canvas → world-space texture) ── */
  const trailCnv = document.createElement('canvas');
  trailCnv.width = TRAIL_RES;
  trailCnv.height = TRAIL_RES;
  const trailCtx = trailCnv.getContext('2d')!;
  trailCtx.fillStyle = '#000';
  trailCtx.fillRect(0, 0, TRAIL_RES, TRAIL_RES);
  const trailTex = new THREE.CanvasTexture(trailCnv);
  trailTex.flipY = false; // identity mapping: shader v == canvas y

  /* ── the water: Gerstner displacement + hand-painted light ── */
  const waterMat = new THREE.MeshBasicNodeMaterial();
  {
    const p = positionLocal.xy;

    // sum the wave trains (unrolled — params are JS constants).
    // Loosely typed: reassignment narrows VarNode → Node and trips ts(2322).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let dx: any = float(0);
    let dy: any = float(0);
    let dz: any = float(0);
    let nx: any = float(0);
    let ny: any = float(0);
    let nz: any = float(0);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    for (const w of WAVE_CONSTS) {
      const f = p
        .dot(vec2(w.dx, w.dy))
        .mul(w.k)
        .sub(uTime.mul(w.speed));
      const c = f.cos();
      const s = f.sin();
      const qa = w.q * w.amp;
      const ka = w.k * w.amp;
      dx = dx.add(c.mul(qa * w.dx));
      dy = dy.add(c.mul(qa * w.dy));
      dz = dz.add(s.mul(w.amp));
      nx = nx.add(c.mul(ka * w.dx));
      ny = ny.add(c.mul(ka * w.dy));
      nz = nz.add(s.mul(w.q * ka));
    }

    waterMat.positionNode = positionLocal.add(vec3(dx, dy, dz));

    // analytic Gerstner normal (local), interpolated to the fragment
    const vNormal = varying(vec3(nx.negate(), ny.negate(), float(1).sub(nz)));
    const vHeight = varying(float(dz)); // float() restores typing over the `any` sum

    // local→world for the -90° X rotation: (x, y, z) → (x, z, -y)
    const NW = vec3(vNormal.x, vNormal.z, vNormal.y.negate()).normalize();
    const V = cameraPosition.sub(positionWorld).normalize();
    const R = reflect(V.negate(), NW);
    const ralign = max(R.dot(uSunDir), 0.0);

    const hN = vHeight.div(0.85).mul(0.5).add(0.5); // ≈ 0..1
    const facing = max(NW.dot(V), 0.0);
    const fresnel = float(1).sub(facing).pow(3.0);

    // body of the sea: deep ink lifted to turquoise on rising water —
    // the lift stays modest so the sea keeps its saturated depth
    const base = mix(
      uWaterDeep,
      uWaterLift,
      hN.mul(0.55).add(fresnel.mul(0.22)),
    );

    // glass crests catching the low sun
    const sunward = max(NW.dot(uSunDir), 0.0);
    const crest = smoothstep(0.62, 0.97, hN)
      .mul(sunward.mul(0.4).add(0.2))
      .mul(0.35);

    // painterly value drift so no two strokes match
    const drift = mx_noise_float(
      vec3(positionWorld.xz.mul(0.16), time.mul(0.12)),
    ).mul(0.04);

    // aerial perspective: the far sea dissolves toward the horizon —
    // never fully, or the water turns to milk
    const dist = length(positionWorld.sub(cameraPosition));
    const air = smoothstep(70.0, 160.0, dist).mul(0.88);

    const body = mix(base.add(uCrest.mul(crest)).add(drift), uHorizon, air);

    // the golden road: a narrow blade of reflection under the sun
    const road = ralign.pow(18.0).mul(uSunIntensity).mul(0.5);
    const sparkle = ralign.pow(140.0).mul(uSunIntensity).mul(1.1);

    // the hand of the visitor: lingering light where the cursor passed
    const tUv = vec2(
      positionWorld.x.add(TRAIL_X).div(TRAIL_X * 2),
      positionWorld.z.sub(TRAIL_Z0).div(TRAIL_Z1 - TRAIL_Z0),
    );
    const handLight = texture(trailTex, tUv).r.mul(float(1).sub(air));

    waterMat.colorNode = body
      .add(uSunHalo.mul(road))
      .add(uSunCore.mul(sparkle))
      .add(uSunCore.mul(handLight).mul(0.6));
  }

  const waterGeo = new THREE.PlaneGeometry(360, 240, 220, 150);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -60); // runs from z=+60 behind the camera to −180
  scene.add(water);

  /* ── the ship on its voyage ── */
  const shipTex = new THREE.CanvasTexture(drawShip());
  const uShip = uniform(new THREE.Color(0x231a26)); // warm ink silhouette
  const uSail = uniform(new THREE.Color(0xf2c98e)); // sun through the cloth
  const shipMat = new THREE.MeshBasicNodeMaterial();
  shipMat.transparent = true;
  shipMat.depthWrite = false;
  {
    // alpha encodes material: ~0.5 = sailcloth, 1 = hull/mast/rigging
    const a = texture(shipTex).a;
    shipMat.colorNode = mix(uSail, uShip, smoothstep(0.62, 0.92, a));
    shipMat.opacityNode = smoothstep(0.12, 0.45, a);
  }
  const SHIP_LEN = 15;
  const ship = new THREE.Mesh(
    new THREE.PlaneGeometry(SHIP_LEN, SHIP_LEN * (SHIP_H / SHIP_W)),
    shipMat,
  );
  ship.renderOrder = 10;
  scene.add(ship);

  /* ── palette / voyage state ── */
  const lerpHex = (a: number, b: number, t: number) =>
    new THREE.Color(a).lerp(new THREE.Color(b), t);

  let voyage = 0;

  function applyVoyage(t: number) {
    const a = GOLDEN_SEA;
    const b = DUSK_SEA;
    (uZenith.value as THREE.Color).copy(lerpHex(a.zenith, b.zenith, t));
    (uMid.value as THREE.Color).copy(lerpHex(a.mid, b.mid, t));
    (uHorizon.value as THREE.Color).copy(lerpHex(a.horizon, b.horizon, t));
    (uSunCore.value as THREE.Color).copy(lerpHex(a.sunCore, b.sunCore, t));
    (uSunHalo.value as THREE.Color).copy(lerpHex(a.sunHalo, b.sunHalo, t));
    (uWaterDeep.value as THREE.Color).copy(lerpHex(a.waterDeep, b.waterDeep, t));
    (uWaterLift.value as THREE.Color).copy(lerpHex(a.waterLift, b.waterLift, t));
    (uCrest.value as THREE.Color).copy(lerpHex(a.crest, b.crest, t));
    (uSail.value as THREE.Color).copy(lerpHex(0xf2c98e, 0xd9885e, t));

    const sunY = a.sunY + (b.sunY - a.sunY) * t;
    (uSunPos.value as THREE.Vector2).set(0.56, 0.5 + sunY);
    // azimuth matches the painted sun disc (uv 0.56 on the sky plane)
    (uSunDir.value as THREE.Vector3)
      .set(0.185, Math.max(sunY, 0.012) * 1.1 + 0.03, -1)
      .normalize();

    // the gold-out: the sun blooms as the voyage ends
    const bloom = smoothstepJs(0.72, 1, t);
    uSunIntensity.value =
      (a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t) *
      (1 + bloom * 1.1);

    renderer.setClearColor((uZenith.value as THREE.Color).getHex(), 1);
  }

  function smoothstepJs(e0: number, e1: number, x: number): number {
    const u = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return u * u * (3 - 2 * u);
  }

  applyVoyage(0);

  /* ── the painting (no lens — the sea's hand is the light) ── */
  const painting = createPainting(renderer, scene, camera, {
    radius: KUWAHARA_RADIUS,
    lens: false,
  });

  /* ── fit ── */
  function fit() {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const skyH = 2 * (SKY_DIST + 14) * Math.tan(THREE.MathUtils.degToRad(CAM_FOV / 2)) * 1.3;
    const skyW = skyH * camera.aspect * 1.3;
    skyMesh.scale.set(skyW, skyH, 1);
    uSkyAspect.value = skyW / skyH;
  }
  fit();
  window.addEventListener('resize', fit);

  /* ── pointer: parallax + the brush of light on the water ── */
  const pointer = new THREE.Vector2(0, 0);
  let pointerOnWater: THREE.Vector3 | null = null;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  function onPointerMove(e: PointerEvent) {
    const px = e.clientX / window.innerWidth;
    const py = e.clientY / window.innerHeight;
    pointer.set(px * 2 - 1, py * 2 - 1);
    ndc.set(pointer.x, -pointer.y);
    ray.setFromCamera(ndc, camera);
    pointerOnWater = ray.ray.intersectPlane(plane, hit) ? hit : null;
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  function paintTrail() {
    // the old light sinks back into the sea
    trailCtx.globalCompositeOperation = 'source-over';
    trailCtx.fillStyle = 'rgba(0,0,0,0.045)';
    trailCtx.fillRect(0, 0, TRAIL_RES, TRAIL_RES);

    if (pointerOnWater) {
      const u = (pointerOnWater.x + TRAIL_X) / (TRAIL_X * 2);
      const v = (pointerOnWater.z - TRAIL_Z0) / (TRAIL_Z1 - TRAIL_Z0);
      if (u > 0 && u < 1 && v > 0 && v < 1) {
        const cx = u * TRAIL_RES;
        const cy = v * TRAIL_RES;
        // brush size grows with distance so the light reads constant
        const r = 5 + (1 - v) * 13;
        const g = trailCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.5)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        trailCtx.globalCompositeOperation = 'lighten';
        trailCtx.fillStyle = g;
        trailCtx.beginPath();
        trailCtx.arc(cx, cy, r, 0, Math.PI * 2);
        trailCtx.fill();
      }
    }
    trailTex.needsUpdate = true;
  }

  /* ── loop ── */
  let last = performance.now();
  let firstFrame = true;

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    void dt;

    const t = (now / 1000) * TIME_SCALE;
    uTime.value = t;

    paintTrail();

    /* the voyage: the ship sails out of the far light toward us */
    const sail = smoothstepJs(0, 1, voyage);
    const sx = 30 + (-14 - 30) * sail;
    const sz = -120 + (-30 - -120) * sail;
    const draft = 1.9 + sail * 0.5; // keeps the hull seated as it nears
    const bob = waveHeightAt(sx, -sz, t);
    ship.position.set(sx, bob * 0.55 + draft, sz);
    // pitch with the local slope, roll with a slow breath
    const ahead = waveHeightAt(sx - 4, -sz, t);
    const astern = waveHeightAt(sx + 4, -sz, t);
    ship.rotation.z =
      Math.atan2(astern - ahead, 8) * 0.55 + Math.sin(now * 0.00037) * 0.012;

    /* camera: leans with the pointer, sinks toward the water as dusk falls */
    const camY = 5.2 - sail * 1.1;
    const camX = -sail * 2.6;
    camera.position.x += (camX + pointer.x * 0.8 - camera.position.x) * 0.04;
    camera.position.y += (camY + pointer.y * -0.3 - camera.position.y) * 0.04;
    camera.lookAt(camera.position.x * 0.55, 2.4, -SKY_DIST);

    painting.render();

    if (firstFrame) {
      firstFrame = false;
      canvas.closest('[data-scene]')?.classList.add('is-live');
    }
  }
  renderer.setAnimationLoop(loop);

  /* pause while off-screen */
  const io = new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry?.isIntersecting ? loop : null);
    if (entry?.isIntersecting) last = performance.now();
  });
  io.observe(canvas);

  return {
    setVoyage(t: number) {
      voyage = Math.min(Math.max(t, 0), 1);
      applyVoyage(voyage);
    },
    dispose() {
      io.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      shipTex.dispose();
      trailTex.dispose();
      waterGeo.dispose();
      painting.dispose();
      renderer.dispose();
    },
  };
}
