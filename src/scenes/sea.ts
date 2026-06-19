/**
 * Act I — The Sea (rebuilt under the doctrine).
 *
 * A living Aivazovsky marine: a low sun glowing gold over open water, the
 * golden road of its reflection breaking on a real, physically synthesised
 * ocean, and a Blender-built brig crossing it — the carrier of the
 * biography — with a small skiff of figures in the lower-right of the frame.
 *
 * The sea is a Tessendorf IFFT ocean on WebGPU compute (`createOcean`): two
 * cascades (a long swell + a fine chop) summed into a height/slope/foam
 * field. The water shades physically — Fresnel against the very sky it sits
 * under, depth absorption, sub-surface glow on the back-lit crests, foam on
 * the breaking ones. The brig and skiff are real GLB geometry that FLOAT on
 * the surface via the ocean's CPU height/slope mirror (honest buoyancy, no
 * readback). The Kuwahara painterly pass finishes the whole frame as paint.
 *
 * Scroll drives `setVoyage(t)`: the palette deepens from golden hour into
 * dusk, the brig CROSSES the frame laterally in front of the low sun — a tall
 * backlit silhouette riding the swell on multi-point buoyancy (it heaves,
 * pitches and rolls), trailing a luminous wake with a hint of bow spray — the
 * camera sinks low to the water to frame it, and the sun blooms into the
 * gold-out that resolves onto the next page of the book.
 */
import * as THREE from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  clamp,
  float,
  Fn,
  length,
  max,
  mix,
  modelWorldMatrix,
  mx_noise_float,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  reflect,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createPainting } from './painting';
import { createOcean } from './ocean';

/* ── voyage palette: golden hour → dusk ──────────────────────────────── */
interface SeaPalette {
  sunCore: [number, number, number];
  gold: [number, number, number];
  orange: [number, number, number];
  salmon: [number, number, number];
  turq: [number, number, number];
  zenith: [number, number, number];
  cloudLit: [number, number, number];
  cloudShade: [number, number, number];
  deep: [number, number, number];
  sss: [number, number, number];
  /** sun height above the horizon (world-dir y) */
  sunY: number;
}

// linear-space palettes read off Aivazovsky's "Cap Martin"
const GOLDEN: SeaPalette = {
  sunCore: [1.35, 1.10, 0.70], gold: [1.15, 0.66, 0.18], orange: [0.95, 0.40, 0.14],
  salmon: [0.78, 0.34, 0.30], turq: [0.30, 0.45, 0.34], zenith: [0.12, 0.18, 0.34],
  cloudLit: [1.10, 0.54, 0.46], cloudShade: [0.30, 0.24, 0.40],
  deep: [0.012, 0.045, 0.060], sss: [0.06, 0.26, 0.30], sunY: 0.075,
};
const DUSK: SeaPalette = {
  sunCore: [1.15, 0.80, 0.46], gold: [0.95, 0.46, 0.16], orange: [0.74, 0.28, 0.14],
  salmon: [0.56, 0.26, 0.34], turq: [0.20, 0.30, 0.34], zenith: [0.08, 0.11, 0.26],
  cloudLit: [0.86, 0.40, 0.42], cloudShade: [0.20, 0.16, 0.32],
  deep: [0.008, 0.030, 0.046], sss: [0.05, 0.20, 0.26], sunY: 0.022,
};

const CAM_FOV = 52;
const KUWAHARA_RADIUS = 4;
const OCEAN_N = 128;

/* the cursor's trail of light lives in this water window (world units) */
const TRAIL_X = 90;
const TRAIL_Z0 = -220;
const TRAIL_Z1 = 20;
const TRAIL_RES = 256;

/* ─────────────────────────────────────────────────────────────────────────
 * THE BRIG — money-shot tuning (Workstream D, "Das Boot").
 *
 * The brig is real Blender geometry whose bow points along +X in the loaded
 * GLB (Blender +X bow → glTF +X; see scripts/blender/sea_set.py header). We
 * yaw it about Y so it crosses LATERALLY (left → right) in front of the low
 * sun (uSunDir ≈ (-0.34, sunY, -1)), big and near enough to read as the hero
 * silhouette — not a distant speck. It rides the swell via multi-point
 * buoyancy sampled from the ocean's CPU height/slope mirror.
 * ──────────────────────────────────────────────────────────────────────── */
const SHIP = {
  scale: 1.5,         // hero size; the rig laces a good third of the frame at the pass
  draft: -0.9,        // metres the modelled waterline (z=0) sinks below the sea
                      //   (hull sits IN the water, the waterline cuts the hull)
  // the lateral crossing in world units (the camera looks toward -Z):
  pathZ: -60,         // distance from camera of the crossing — near & big
  pathXFrom: 56,      // start X (screen right of frame, off-sun side)
  pathXTo: -34,       // end X (sweeps left, across and past the sun)
  pathBow: 1,         // +1 = bow leads toward -X (L); set with the path sign
  speed: 0.14,        // base lateral speed (world-units / sec) of the drift
  // multi-point buoyancy footprint (local ship metres BEFORE scale): the
  // four corners + the bow & stern of the waterline the hull floats on.
  halfLen: 6.2,       // bow/stern sample reach along keel (+X bow)
  halfBeam: 0.95,     // port/stbd sample reach across the hull
  heaveDamp: 0.10,    // 0..1 — how fast vertical follows the swell (weighty)
  tiltDamp: 0.08,     // 0..1 — how fast pitch/roll follow (heavier = slower)
  pitchGain: 0.85,    // exaggeration of bow/stern heave → pitch angle
  rollGain: 1.05,     // exaggeration of port/stbd heave → roll angle
  trimZ: 0.0,         // static bow-up trim (radians) — galleon rides bow-high
} as const;
const SKIFF = {
  scale: 0.95,
  draft: -0.12,
  heaveDamp: 0.14,
  tiltDamp: 0.12,
  pitchGain: 1.1,
  rollGain: 1.2,
} as const;

export interface SeaHandle {
  setVoyage(t: number): void;
  dispose(): void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number): [number, number, number] =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function smoothstepJs(e0: number, e1: number, x: number): number {
  const u = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return u * u * (3 - 2 * u);
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
    3000,
  );
  camera.position.set(0, 3.6, 12);
  camera.lookAt(0, 1.6, -120);

  /* ── the ocean: two cascades ── */
  const swell = createOcean(renderer, {
    size: OCEAN_N, patch: 210, wind: 14,
    heading: Math.PI * 0.5, amplitude: 6.0, choppy: 1.7,
  });
  const detail = createOcean(renderer, {
    size: 64, patch: 23, wind: 7,
    heading: Math.PI * 0.5 + 0.6, amplitude: 1.1, choppy: 1.35,
  });
  for (const o of [swell, detail]) {
    o.displacementTex.wrapS = o.displacementTex.wrapT = THREE.RepeatWrapping;
    o.derivativeTex.wrapS = o.derivativeTex.wrapT = THREE.RepeatWrapping;
  }

  /* ── palette uniforms (written per voyage step on the CPU) ── */
  const uSunDir = uniform(new THREE.Vector3(-0.34, 0.075, -1).normalize());
  const uSunCore = uniform(new THREE.Vector3(...GOLDEN.sunCore));
  const uGold = uniform(new THREE.Vector3(...GOLDEN.gold));
  const uOrange = uniform(new THREE.Vector3(...GOLDEN.orange));
  const uSalmon = uniform(new THREE.Vector3(...GOLDEN.salmon));
  const uTurq = uniform(new THREE.Vector3(...GOLDEN.turq));
  const uZenith = uniform(new THREE.Vector3(...GOLDEN.zenith));
  const uCloudLit = uniform(new THREE.Vector3(...GOLDEN.cloudLit));
  const uCloudShade = uniform(new THREE.Vector3(...GOLDEN.cloudShade));
  const uDeep = uniform(new THREE.Vector3(...GOLDEN.deep));
  const uSSS = uniform(new THREE.Vector3(...GOLDEN.sss));
  const uSunGain = uniform(1);

  /* ── the sky as a colour FUNCTION of a view direction (water reflects it) ── */
  const skyColor: any = Fn(([d]: any) => {
    const up = clamp(d.y, -1, 1);
    const sunAz = clamp(
      normalize(vec3(d.x, 0, d.z)).dot(normalize(vec3(uSunDir.x, 0, uSunDir.z))),
      -1, 1,
    );
    const nearSun = smoothstep(-0.1, 0.9, sunAz);
    const awaySun = smoothstep(0.4, -0.6, sunAz);

    const horizonWarm = mix(uOrange, uGold, nearSun);
    let sky: any = horizonWarm;
    sky = mix(sky, uSalmon, smoothstep(0.015, 0.10, up));
    sky = mix(sky, uTurq, smoothstep(0.07, 0.17, up).mul(awaySun.mul(0.55).add(0.18)));
    sky = mix(sky, uZenith, smoothstep(0.20, 0.92, up));

    // broken pink-coral cloud band drifting across the mid sky
    const cloudShape = smoothstep(0.12, 0.22, up).mul(smoothstep(0.48, 0.28, up));
    const cn = mx_noise_float(vec3(d.x.mul(3.0), up.mul(6.0), d.z.mul(3.0))).mul(0.5).add(0.5);
    const cn2 = mx_noise_float(vec3(d.x.mul(7.0), up.mul(11.0), d.z.mul(7.0))).mul(0.5).add(0.5);
    const clumps = clamp(cn.mul(0.7).add(cn2.mul(0.4)).sub(0.25), 0.0, 1.0);
    const cloudCol = mix(uCloudShade, uCloudLit, nearSun);
    sky = mix(sky, cloudCol, cloudShape.mul(clumps).mul(0.85));

    // the sun: tight glowing disc + compact glow (never washes the sky)
    const cosA = clamp(d.dot(uSunDir), -1, 1);
    const disc = pow(max(cosA, 0), 1500).mul(1.8);
    const glow = pow(max(cosA, 0), 90).mul(0.55);
    const haze = pow(max(cosA, 0), 14).mul(0.16);
    const sun = uSunCore.mul(disc.add(glow).add(haze).mul(uSunGain));
    return sky.add(sun);
  });

  // soft-knee highlight roll-off: keeps the palette saturated, only the
  // blazing sun core rolls off so it glows rather than clipping to white.
  const softKnee: any = Fn(([c]: any) => {
    const knee = float(0.9);
    const over = c.sub(knee).max(0);
    return c.min(knee).add(over.div(over.add(0.6)).mul(0.6));
  });

  const skyMat = new THREE.MeshBasicNodeMaterial();
  skyMat.side = THREE.BackSide;
  {
    const dir = normalize(positionWorld.sub(cameraPosition));
    skyMat.colorNode = vec4(softKnee(skyColor(dir)), 1);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16), skyMat);
  scene.add(sky);

  /* ── the cursor's trail of light (canvas → world-space texture) ── */
  const trailCnv = document.createElement('canvas');
  trailCnv.width = TRAIL_RES;
  trailCnv.height = TRAIL_RES;
  const trailCtx = trailCnv.getContext('2d')!;
  trailCtx.fillStyle = '#000';
  trailCtx.fillRect(0, 0, TRAIL_RES, TRAIL_RES);
  const trailTex = new THREE.CanvasTexture(trailCnv);
  trailTex.flipY = false;

  /* ── the water material: IFFT displacement + physical shading ── */
  const C_FOAM = vec3(0.82, 0.90, 0.92);
  const waterMat = new THREE.MeshBasicNodeMaterial();
  {
    const flatWorld = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
    const uvBig = vec2(flatWorld.x, flatWorld.z).div(swell.patch);
    const uvSm = vec2(flatWorld.x, flatWorld.z).div(detail.patch);
    const dispBig = texture(swell.displacementTex, uvBig);
    const dispSm = texture(detail.displacementTex, uvSm);
    const disp = dispBig.add(dispSm);
    waterMat.positionNode = positionLocal.add(vec3(disp.x, disp.z, disp.y));

    const dist = length(positionWorld.sub(cameraPosition));
    const detailFade = float(1.0).sub(smoothstep(30.0, 240.0, dist));

    const derBig = texture(swell.derivativeTex, uvBig);
    const derSm = texture(detail.derivativeTex, uvSm);
    const slopeX = derBig.x.add(derSm.x.mul(detailFade));
    const slopeZ = derBig.y.add(derSm.y.mul(detailFade));
    const foam = derBig.z.max(derSm.z.mul(detailFade));
    const nWorld = normalize(vec3(slopeX.negate(), float(1.0), slopeZ.negate()));

    const V = normalize(cameraPosition.sub(positionWorld));
    const NdotV = max(nWorld.dot(V), 0.0);

    // Fresnel (Schlick, F0 ≈ 0.02) → sky reflection vs. water body
    const F0 = float(0.02);
    const fres = F0.add(float(1.0).sub(F0).mul(pow(float(1.0).sub(NdotV), 5.0)));
    const Rdir = reflect(V.negate(), nWorld);
    const refl = skyColor(normalize(Rdir));

    // body: deep colour + sub-surface upwelling, brighter on back-lit crests
    const sun = uSunDir;
    const back = max(V.negate().dot(sun), 0.0);
    const heightN = clamp(disp.y.mul(0.18).add(0.5), 0.0, 1.0);
    const sss = uSSS.mul(pow(heightN, 2.0).mul(0.8).add(0.15)).mul(back.mul(1.6).add(0.5));
    const body = uDeep.add(sss);

    // sun glitter + the broad golden road
    const H = normalize(V.add(sun));
    const spec = pow(max(nWorld.dot(H), 0.0), 120.0).mul(detailFade.mul(2.0).add(0.4));
    const road = pow(max(Rdir.dot(sun), 0.0), 30.0).mul(0.8);

    let col: any = mix(body, refl, fres);
    col = col.add(uSunCore.mul(spec));
    col = col.add(uGold.mul(road));
    col = mix(col, C_FOAM, clamp(foam, 0.0, 1.0).mul(0.85));
    // hand of the visitor: lingering light where the cursor passed
    const tUv = vec2(
      positionWorld.x.add(TRAIL_X).div(TRAIL_X * 2),
      positionWorld.z.sub(TRAIL_Z0).div(TRAIL_Z1 - TRAIL_Z0),
    );
    const handLight = texture(trailTex, tUv).r;
    col = col.add(uGold.mul(handLight).mul(0.5));
    // aerial perspective into the warm horizon
    const air = smoothstep(260.0, 1400.0, dist).mul(0.8);
    col = mix(col, uGold, air);
    col = softKnee(col);
    waterMat.colorNode = vec4(col, 1);
  }

  // tiled grid of water around the camera for horizon depth
  const PATCH = swell.patch;
  const TILES = 5;
  const tileGeo = new THREE.PlaneGeometry(PATCH, PATCH, OCEAN_N, OCEAN_N);
  const water = new THREE.Group();
  const half = Math.floor(TILES / 2);
  for (let tz = -half; tz <= half; tz++) {
    for (let tx = -half; tx <= half; tx++) {
      const m = new THREE.Mesh(tileGeo, waterMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(tx * PATCH, 0, tz * PATCH - PATCH);
      water.add(m);
    }
  }
  scene.add(water);

  /* ── the brig + skiff (real Blender GLBs, floated on the surface) ── */
  let brig: THREE.Object3D | null = null;
  let skiff: THREE.Object3D | null = null;
  const brigFloat = makeFloatState();
  const skiffFloat = makeFloatState();

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await new Promise<void>((resolve) => {
    loader.load(
      '/assets/sea/sea_assets.glb',
      (gltf) => {
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          // unlit material reading the baked vertex colour (warm back-lit
          // ink), hazed toward the warm horizon with distance so the
          // silhouette sits IN the air rather than being cut out of it.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a: any = attribute('color');
          const mat = new THREE.MeshBasicNodeMaterial();
          const dist = length(positionWorld.sub(cameraPosition));
          const haze = smoothstep(40.0, 220.0, dist).mul(0.4);
          // a STRONG backlit silhouette: darken the baked ink hard so the ship
          // reads as a near-black Aivazovsky cut-out against the bright sun
          // (the relative warm up-sun rim survives), then a touch of warm haze.
          mat.colorNode = vec4(mix(a.rgb.mul(0.32), uGold, haze), 1);
          mesh.material = mat;
          mesh.renderOrder = 5;
        });
        brig = gltf.scene.getObjectByName('Brig') ?? null;
        skiff = gltf.scene.getObjectByName('Skiff') ?? null;
        scene.add(gltf.scene);
        resolve();
      },
      undefined,
      () => resolve(), // the sea still stands without the ship
    );
  });

  /* ── voyage state ── */
  let voyage = 0;
  function applyVoyage(t: number) {
    const set = (u: ReturnType<typeof uniform>, a: number[], b: number[]) =>
      (u.value as THREE.Vector3).set(...lerp3(a, b, t));
    set(uSunCore, GOLDEN.sunCore, DUSK.sunCore);
    set(uGold, GOLDEN.gold, DUSK.gold);
    set(uOrange, GOLDEN.orange, DUSK.orange);
    set(uSalmon, GOLDEN.salmon, DUSK.salmon);
    set(uTurq, GOLDEN.turq, DUSK.turq);
    set(uZenith, GOLDEN.zenith, DUSK.zenith);
    set(uCloudLit, GOLDEN.cloudLit, DUSK.cloudLit);
    set(uCloudShade, GOLDEN.cloudShade, DUSK.cloudShade);
    set(uDeep, GOLDEN.deep, DUSK.deep);
    set(uSSS, GOLDEN.sss, DUSK.sss);

    const sunY = lerp(GOLDEN.sunY, DUSK.sunY, t);
    (uSunDir.value as THREE.Vector3).set(-0.34, Math.max(sunY, 0.012), -1).normalize();

    // the gold-out: the sun blooms as the voyage ends
    const bloom = smoothstepJs(0.72, 1, t);
    uSunGain.value = 1 + bloom * 2.4;

    renderer.setClearColor(0x10101a, 1);
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
  }
  fit();
  window.addEventListener('resize', fit);

  /* ── pointer: parallax + the brush of light ── */
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

  /* the ship's WAKE + bow SPRAY live in the SAME trail canvas (cheap): the
     water material lifts this channel as warm lingering light, so a foam
     ribbon stamped behind the hull reads as a luminous, lit wake. The loop
     writes the stern/bow world positions + a spray strength here each frame. */
  const wake = {
    sternX: 0, sternZ: 0, hasWake: false,
    bowX: 0, bowZ: 0, spray: 0,
  };
  function worldToTrail(x: number, z: number): [number, number] | null {
    const u = (x + TRAIL_X) / (TRAIL_X * 2);
    const v = (z - TRAIL_Z0) / (TRAIL_Z1 - TRAIL_Z0);
    if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return null;
    return [u * TRAIL_RES, v * TRAIL_RES];
  }
  function stamp(cx: number, cy: number, r: number, a: number) {
    const g = trailCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    trailCtx.globalCompositeOperation = 'lighten';
    trailCtx.fillStyle = g;
    trailCtx.beginPath();
    trailCtx.arc(cx, cy, r, 0, Math.PI * 2);
    trailCtx.fill();
  }
  function paintTrail() {
    // a slow fade leaves a TAIL behind the moving hull (the wake streams aft)
    trailCtx.globalCompositeOperation = 'source-over';
    trailCtx.fillStyle = 'rgba(0,0,0,0.035)';
    trailCtx.fillRect(0, 0, TRAIL_RES, TRAIL_RES);

    // the cursor's brush of light
    if (pointerOnWater) {
      const p = worldToTrail(pointerOnWater.x, pointerOnWater.z);
      if (p) stamp(p[0], p[1], 6 + (1 - p[1] / TRAIL_RES) * 16, 0.5);
    }

    // the ship's wake: a bright dab at the stern (fades to a streaming ribbon)
    if (wake.hasWake) {
      const s = worldToTrail(wake.sternX, wake.sternZ);
      if (s) {
        const depth = 1 - s[1] / TRAIL_RES; // nearer = bigger
        stamp(s[0], s[1], 9 + depth * 22, 0.42);
      }
      // bow spray: a sharper, brighter burst where the bow meets a crest
      if (wake.spray > 0.001) {
        const b = worldToTrail(wake.bowX, wake.bowZ);
        if (b) stamp(b[0], b[1], 6 + wake.spray * 16, Math.min(0.7, 0.3 + wake.spray));
      }
    }
    trailTex.needsUpdate = true;
  }

  /* ── honest buoyancy: float an object on the summed cascades ── */
  const ht = { x: 0, z: 0 };
  function seaHeight(x: number, z: number, t: number): number {
    return swell.heightAt(x, z, t) + detail.heightAt(x, z, t);
  }
  function seaSlope(x: number, z: number, t: number, out: { x: number; z: number }) {
    const a = { x: 0, z: 0 };
    swell.slopeAt(x, z, t, a);
    const b = { x: 0, z: 0 };
    detail.slopeAt(x, z, t, b);
    out.x = a.x + b.x;
    out.z = a.z + b.z;
  }

  /* MULTI-POINT BUOYANCY — sample the swell at the bow, stern, port and
     starboard waterline points of the hull, then fit the object's vertical
     position + pitch + roll to those heights so it heaves, pitches and rolls
     with the sea. Damped so it reads weighty, not jittery. Each floated
     object keeps its own smoothed state. The footprint is yawed by headingY
     so the bow/stern axis always lies along the ship's heading. */
  interface FloatState {
    h: number; pitch: number; roll: number; init: boolean;
  }
  function makeFloatState(): FloatState {
    return { h: 0, pitch: 0, roll: 0, init: false };
  }
  // orientation scratch (avoid per-frame allocation)
  const _qYaw = new THREE.Quaternion();
  const _qPitch = new THREE.Quaternion();
  const _qRoll = new THREE.Quaternion();
  const _q = new THREE.Quaternion();
  const _axisY = new THREE.Vector3(0, 1, 0);
  const _axisPitch = new THREE.Vector3();
  const _axisRoll = new THREE.Vector3();
  function floatObject(
    obj: THREE.Object3D, st: FloatState, x: number, z: number, t: number,
    draft: number, headingY: number,
    halfLen: number, halfBeam: number, scale: number,
    heaveDamp: number, tiltDamp: number,
    pitchGain: number, rollGain: number, trimZ: number,
  ) {
    const ch = Math.cos(headingY);
    const sh = Math.sin(headingY);
    // a local offset (along-keel l, across-beam b) rotated into world XZ by
    // the heading. With rotation.y = headingY, local +X maps to
    // (cos h, 0, -sin h) in world; local +Z (starboard side) maps to
    // (sin h, 0, cos h).
    const sample = (l: number, b: number) => {
      const wx = x + l * ch + b * sh;
      const wz = z - l * sh + b * ch;
      return seaHeight(wx, wz, t);
    };
    const L = halfLen * scale;
    const B = halfBeam * scale;
    const hBow = sample(L, 0);
    const hStern = sample(-L, 0);
    const hPort = sample(0, -B);
    const hStbd = sample(0, B);
    const hMid = seaHeight(x, z, t);

    // target heave = mean of the footprint (centre-of-buoyancy height)
    const hTarget = (hBow + hStern + hPort + hStbd + hMid * 2) / 6;
    // pitch (about the heading-local X / world via headingY): bow rising
    // relative to stern → bow-up. atan over the keel length.
    const pitchTarget = Math.atan2(hBow - hStern, 2 * L) * pitchGain + trimZ;
    // roll: starboard rising relative to port → roll. atan over the beam.
    const rollTarget = Math.atan2(hStbd - hPort, 2 * B) * rollGain;

    if (!st.init) {
      st.h = hTarget; st.pitch = pitchTarget; st.roll = rollTarget;
      st.init = true;
    } else {
      st.h += (hTarget - st.h) * heaveDamp;
      st.pitch += (pitchTarget - st.pitch) * tiltDamp;
      st.roll += (rollTarget - st.roll) * tiltDamp;
    }

    obj.position.set(x, st.h + draft, z);
    // Build orientation with quaternions so the axes never cross-couple:
    //   1) yaw about world +Y by headingY (turns the bow onto the heading),
    //   2) pitch about the ship's local lateral axis (beam, world after yaw),
    //   3) roll  about the ship's local longitudinal axis (the keel/bow line).
    // bow (local +X) after yaw → (cos h, 0, -sin h); beam (local +Z, stbd)
    // after yaw → (sin h, 0, cos h).
    _qYaw.setFromAxisAngle(_axisY, headingY);
    _axisPitch.set(sh, 0, ch);                 // lateral/beam axis in world
    _qPitch.setFromAxisAngle(_axisPitch, st.pitch);
    _axisRoll.set(ch, 0, -sh);                 // longitudinal/keel axis in world
    _qRoll.setFromAxisAngle(_axisRoll, st.roll);
    _q.copy(_qRoll).multiply(_qPitch).multiply(_qYaw);
    obj.quaternion.copy(_q);
  }

  /* ── loop ── */
  let firstFrame = true;
  let computing = false;
  const TIME_SCALE = 0.9;

  function loop(now: number) {
    const t = (now / 1000) * TIME_SCALE;

    if (!computing) {
      computing = true;
      Promise.all([swell.update(t), detail.update(t)]).then(() => {
        computing = false;
      });
    }
    const sail = smoothstepJs(0, 1, voyage);

    /* ── THE MONEY-SHOT: the brig crosses laterally across the frame in front
       of the low sun (sun azimuth ≈ -X, into the screen). The path X sweeps
       continuously with time so it is always sailing — screen-right → -X
       (toward and across the sun); the voyage `sail` pulls the crossing nearer
       and a touch bigger as dusk falls. Heading is tied to the path so the bow
       leads. Flip SHIP.pathBow / swap pathXFrom↔pathXTo to reverse it. ── */
    wake.hasWake = false;
    if (brig) {
      // one hero crossing mapped to the whole voyage scroll: the brig sweeps the
      // full span from pathXFrom (R) to pathXTo (L) as t goes 0→1, passing the
      // sun near mid-scroll. (The old `(t*speed*10)%span` advanced only ~1.4 of a
      // 150-unit span over the ENTIRE voyage, so the ship stuck far off-frame and
      // read as a distant speck — it never actually crossed.)
      const span = SHIP.pathXFrom - SHIP.pathXTo;            // > 0
      const cross = Math.min(Math.max((t - 0.1) / 0.8, 0), 1); // ease the crossing into the scroll window
      const bx = SHIP.pathXFrom - cross * span;             // sweeps R→L across the sun
      const bz = lerp(SHIP.pathZ + 10, SHIP.pathZ, sail);   // nearer at dusk
      // heading: the hull's bow is local +X; floatObject maps local along-keel
      // l to world delta (l·cos h, -l·sin h). To make the bow point toward
      // world -X (the travel direction of the R→L sweep) we need cos h = -1,
      // sin h = 0 → yaw = PI. The keel then lies along X → a pure lateral
      // crossing across the sun.
      const headY = Math.PI;
      floatObject(
        brig, brigFloat, bx, bz, t, SHIP.draft, headY,
        SHIP.halfLen, SHIP.halfBeam, SHIP.scale,
        SHIP.heaveDamp, SHIP.tiltDamp, SHIP.pitchGain, SHIP.rollGain, SHIP.trimZ,
      );
      brig.scale.setScalar(SHIP.scale * lerp(1.0, 1.08, sail));

      // feed the wake: bow leads at +keel, stern trails at -keel (same mapping
      // as floatObject: along-keel l → world (l·ch, -l·sh)).
      const ch = Math.cos(headY), sh = Math.sin(headY);
      const bowL = SHIP.halfLen * SHIP.scale;
      wake.bowX = bx + bowL * ch;    wake.bowZ = bz - bowL * sh;
      wake.sternX = bx - bowL * ch;  wake.sternZ = bz + bowL * sh;
      seaSlope(wake.bowX, wake.bowZ, t, ht);
      // spray ∝ how much the bow buries: crest height + along-track steepness
      const bowH = seaHeight(wake.bowX, wake.bowZ, t);
      const steep = Math.abs(ht.x * ch - ht.z * sh);
      wake.spray = Math.max(0, smoothstepJs(0.6, 2.2, bowH) * 0.7 + steep * 0.25);
      wake.hasWake = true;
    }
    if (skiff) {
      // the skiff rides the lower-right foreground throughout, bobbing harder
      floatObject(
        skiff, skiffFloat, 20 - sail * 3, -30 - sail * 2, t, SKIFF.draft, -0.5,
        1.6, 0.5, SKIFF.scale,
        SKIFF.heaveDamp, SKIFF.tiltDamp, SKIFF.pitchGain, SKIFF.rollGain, 0,
      );
      skiff.scale.setScalar(SKIFF.scale);
    }

    paintTrail();

    // camera leans with the pointer; at the climax it sinks LOW to the water
    // and frames the lateral crossing in front of the sun.
    const camY = 3.6 - sail * 1.6;            // lower at dusk → backlit profile
    const camX = -sail * 1.0;
    camera.position.x += (camX + pointer.x * 0.8 - camera.position.x) * 0.04;
    camera.position.y += (camY + pointer.y * -0.3 - camera.position.y) * 0.04;
    // look toward the crossing plane (and the sun beyond it)
    camera.lookAt(camera.position.x * 0.5, 1.2 - sail * 0.5, SHIP.pathZ - 40);
    sky.position.copy(camera.position);

    painting.render();

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
    setVoyage(t: number) {
      voyage = Math.min(Math.max(t, 0), 1);
      applyVoyage(voyage);
    },
    dispose() {
      io.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      trailTex.dispose();
      tileGeo.dispose();
      swell.dispose();
      detail.dispose();
      painting.dispose();
      renderer.dispose();
    },
  };
}
