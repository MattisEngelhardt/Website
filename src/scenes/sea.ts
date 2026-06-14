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
 * dusk, the brig sails out of the far light toward the viewer, the camera
 * leans down to the water, and the sun blooms into the gold-out that
 * resolves onto the next page of the book.
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
          const haze = smoothstep(40.0, 220.0, dist).mul(0.55);
          mat.colorNode = vec4(mix(a.rgb, uGold, haze), 1);
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

  function paintTrail() {
    trailCtx.globalCompositeOperation = 'source-over';
    trailCtx.fillStyle = 'rgba(0,0,0,0.04)';
    trailCtx.fillRect(0, 0, TRAIL_RES, TRAIL_RES);
    if (pointerOnWater) {
      const u = (pointerOnWater.x + TRAIL_X) / (TRAIL_X * 2);
      const v = (pointerOnWater.z - TRAIL_Z0) / (TRAIL_Z1 - TRAIL_Z0);
      if (u > 0 && u < 1 && v > 0 && v < 1) {
        const cx = u * TRAIL_RES;
        const cy = v * TRAIL_RES;
        const r = 6 + (1 - v) * 16;
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

  function floatObject(
    obj: THREE.Object3D, x: number, z: number, t: number,
    draft: number, headingY: number,
  ) {
    const h = seaHeight(x, z, t);
    obj.position.set(x, h + draft, z);
    seaSlope(x, z, t, ht);
    // pitch about x from along-track slope, roll about z from cross slope
    obj.rotation.set(
      Math.atan(ht.z) * 0.5,        // pitch with z-slope
      headingY,
      Math.atan(ht.x) * -0.5 + Math.sin(t * 0.3) * 0.01, // roll
    );
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
    paintTrail();

    // the voyage: the brig sails out of the far light toward us
    const sail = smoothstepJs(0, 1, voyage);
    if (brig) {
      const bx = lerp(26, -10, sail);
      const bz = lerp(-150, -34, sail);
      floatObject(brig, bx, bz, t, 0.2, Math.PI * 0.5 - sail * 0.3);
      const s = lerp(1.0, 1.25, sail);
      brig.scale.setScalar(s);
    }
    if (skiff) {
      // the skiff rides the lower-right foreground throughout
      floatObject(skiff, 18 - sail * 4, -26 - sail * 2, t, 0.05, -0.5);
      skiff.scale.setScalar(0.9);
    }

    // camera leans with the pointer, sinks toward the water as dusk falls
    const camY = 3.6 - sail * 0.9;
    const camX = -sail * 2.2;
    camera.position.x += (camX + pointer.x * 0.8 - camera.position.x) * 0.04;
    camera.position.y += (camY + pointer.y * -0.3 - camera.position.y) * 0.04;
    camera.lookAt(camera.position.x * 0.5, 1.6, -160);
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
