/**
 * Act III — The Way (rebuilt under the 12.06 doctrine; Camino re-cut 17.06).
 *
 * The human chapter: a CINEMATIC bird's-eye flight over the Camino Portugués,
 * Porto → Santiago de Compostela — the pilgrimage he walked with his mother.
 * This is the realism act, the deliberate style break from the painted worlds:
 * REAL terrain, no brushwork, no game markers.
 *
 * The set is real-world data, not procedural geometry:
 *   - elevation: Copernicus GLO-30 DEM (ESA, free) → a displaced terrain mesh
 *     baked in Blender (scripts/camino/prep_dem.py → blender/camino_set.py),
 *     relief exaggerated for the flight.
 *   - the drape: Sentinel-2 cloudless 2024 (EOX, CC-BY-4.0) — a cloud-free
 *     10 m satellite mosaic of the exact corridor (scripts/camino/fetch_satellite).
 *
 * THE FLIGHT IS PRE-CHOREOGRAPHED IN BLENDER. camino_set.py bakes a single
 * high, slightly-tilted aerial camera ("CamPath") that follows the real route
 * as a smooth Catmull-Rom sweep across the whole corridor in ~7 s, and exports
 * it into camino.glb as the "CaminoFlight" clip. The web side just SCRUBS that
 * baked camera by scroll (mirrors city.ts: action.time = clip.duration * t) —
 * no analytic chase-cam, no floating beacons, no tube route-head. "Google Maps
 * but crazy better."
 *
 * The web side is finish, not content: aerial-perspective haze into a golden
 * horizon, low relief shading that makes the river valleys read, a sun glint on
 * the Atlantic, and the warm gold-out that resolves onto the next page of the
 * book.
 */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  cameraPosition,
  clamp,
  float,
  Fn,
  length,
  max,
  mix,
  mx_noise_float,
  normalize,
  normalWorld,
  pass,
  positionWorld,
  pow,
  reflect,
  screenSize,
  screenUV,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

interface Station {
  name: string;
  lon: number;
  lat: number;
}
interface CaminoMeta {
  bbox: { lonMin: number; latMin: number; lonMax: number; latMax: number };
  widthKm: number;
  depthKm: number;
  exaggeration: number;
  elevMin: number;
  elevMax: number;
  stations: Station[];
}

export interface CaminoHandle {
  /** 0 = leaving Porto … 1 = arrival at Santiago, gold-out */
  setFlyover(t: number): void;
  /** the waymark towns, in route order (for the live DOM waymark caption) */
  stations: Station[];
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

export async function mountCamino(
  canvas: HTMLCanvasElement,
): Promise<CaminoHandle | null> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  try {
    await renderer.init();
  } catch {
    return null; // the painted CSS fallback stays
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x121826, 1);

  const scene = new THREE.Scene();

  /* ── meta + assets ─────────────────────────────────────────────────── */
  let meta: CaminoMeta;
  try {
    meta = await (await fetch('/assets/camino/camino_meta.json')).json();
  } catch {
    renderer.dispose();
    return null;
  }

  /* golden-hour sun, low over the Atlantic (west = -X) */
  const uSunDir = uniform(
    new THREE.Vector3(q('sx', -0.62), q('sy', 0.42), q('sz', 0.18)).normalize(),
  );
  const uHazeNear = uniform(q('hn', 60));
  const uHazeFar = uniform(q('hf', 430));
  const uHaze = uniform(new THREE.Vector3(0.78, 0.62, 0.46)); // warm horizon
  const uGoldOut = uniform(0); // end-of-act bloom toward gold

  /* ── the sky: warm realistic dome the haze fades into ──────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skyColor: any = Fn(([d]: any) => {
    const up = clamp(d.y, -1, 1);
    const horizon = vec3(0.86, 0.6, 0.4); // warm band
    const zenith = vec3(0.15, 0.3, 0.52); // soft blue
    let sky: any = mix(horizon, zenith, smoothstep(0.0, 0.7, up));
    // the low sun, a soft disc + glow toward the west
    const cosA = clamp(d.dot(uSunDir), -1, 1);
    const disc = pow(max(cosA, 0), 900).mul(1.4);
    const glow = pow(max(cosA, 0), 40).mul(0.5);
    sky = sky.add(vec3(1.25, 0.95, 0.62).mul(disc.add(glow)));
    return sky;
  });

  const skyMat = new THREE.MeshBasicNodeMaterial();
  skyMat.side = THREE.BackSide;
  {
    const dir = normalize(positionWorld.sub(cameraPosition));
    skyMat.colorNode = vec4(skyColor(dir), 1);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), skyMat);
  scene.add(sky);

  /* ── the terrain: Blender mesh + Sentinel-2 drape ──────────────────── */
  const texLoader = new THREE.TextureLoader();
  const satTex = texLoader.load('/assets/camino/camino_sat.webp');
  satTex.colorSpace = THREE.SRGBColorSpace;
  satTex.anisotropy = 8; // oblique terrain stays sharp toward the horizon
  satTex.flipY = false;

  const DEBUG =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const terrainMat = new THREE.MeshBasicNodeMaterial();
  {
    const base = texture(satTex, uv()).rgb;
    if (DEBUG.has('tex')) {
      terrainMat.colorNode = vec4(base, 1);
    } else if (DEBUG.has('norm')) {
      terrainMat.colorNode = vec4(normalize(normalWorld).mul(0.5).add(0.5), 1);
    } else {
      // relief shading from the real (exaggerated) geometry normals — makes the
      // river valleys and ridgelines read from altitude, on top of the drape
      const N = normalize(normalWorld);
      const ndl = max(N.dot(uSunDir), 0.0);
      const shade = float(0.86).add(ndl.mul(0.34));
      // lift the dense Galician forest out of the murk into golden hour
      let col: any = base.mul(q('exp', 1.55)).mul(shade);
      col = col.mul(vec3(1.06, 1.0, 0.9)); // warm the land toward the low sun

      // the Atlantic (elevation ≈ 0): a slow specular glint of the low sun
      const water = smoothstep(0.06, 0.0, positionWorld.y);
      const V = normalize(cameraPosition.sub(positionWorld));
      const R = reflect(uSunDir.negate(), N);
      const glint = pow(max(V.dot(R), 0.0), 80.0).mul(water).mul(1.6);
      col = col.add(vec3(1.2, 0.92, 0.6).mul(glint));
      // a touch of deep teal in the open sea so it doesn't read as flat slate
      col = mix(col, col.mul(vec3(0.55, 0.85, 1.0)), water.mul(0.35));

      // aerial perspective into the warm horizon — the depth of a real flyover
      const dist = length(positionWorld.sub(cameraPosition));
      const air = smoothstep(uHazeNear, uHazeFar, dist).mul(0.6);
      col = mix(col, uHaze, air.add(uGoldOut.mul(0.55)));
      terrainMat.colorNode = vec4(col, 1);
    }
  }

  /* ── load the set: terrain + the baked cinematic camera + its flight ── */
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync('/assets/camino/camino.glb');
  } catch {
    renderer.dispose();
    return null;
  }

  let terrain: THREE.Mesh | null = null;
  let bakedCam: THREE.PerspectiveCamera | null = null;
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = terrainMat;
      m.frustumCulled = false; // the whole corridor stays drawn at any altitude
      terrain = m;
    }
    if ((o as THREE.PerspectiveCamera).isPerspectiveCamera) {
      bakedCam = o as THREE.PerspectiveCamera;
    }
  });
  if (!terrain) {
    renderer.dispose();
    return null;
  }
  scene.add(gltf.scene);

  /* the camera: prefer the Blender-baked CamPath; fall back to a fresh one so
     the act never goes black if the export ever ships without a camera */
  const camera: THREE.PerspectiveCamera =
    bakedCam ??
    new THREE.PerspectiveCamera(
      q('fov', 47),
      canvas.clientWidth / Math.max(canvas.clientHeight, 1),
      0.05,
      4000,
    );
  camera.near = 0.05;
  camera.far = 4000;

  /* ── the flight: Blender's ~7 s camera clip, scrubbed by scroll ─────── */
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations[0] ?? null;
  const action = clip ? mixer.clipAction(clip) : null;
  if (action) {
    action.play();
    action.paused = true;
  }
  const clipDuration = clip ? clip.duration : 0;

  /* ── the flyover state ─────────────────────────────────────────────── */
  let flyT = 0;

  function applyFlyover(t: number) {
    flyT = clamp01(t);
    if (action) {
      action.time = flyT * Math.max(clipDuration - 0.0001, 0);
      mixer.update(0); // pose the baked camera at this scroll fraction
    }
    // the gold-out blooms as the pilgrim reaches Santiago
    uGoldOut.value = smoothstepJs(0.82, 1, flyT);
  }
  applyFlyover(0);

  /* ── post: a light cinematic finish (NOT the painterly Kuwahara) ────── */
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const sceneTex = scenePass.getTextureNode();
  {
    const glow = bloom(sceneTex, 0.28, 0.6, 0.85); // sun, glint, horizon halo
    const vignette = float(1).sub(length(screenUV.sub(vec2(0.5))).pow(2).mul(0.42));
    const grain = mx_noise_float(
      vec3(screenUV.mul(screenSize).mul(0.5), time.mul(0.3)),
    ).mul(0.022);
    let outc: any = sceneTex.rgb.add(glow.rgb.mul(0.9));
    outc = outc.mul(vec3(1.03, 1.0, 0.97)).add(grain); // warm grade
    // the closing gold wash that hands off to the page
    outc = mix(outc, vec3(1.15, 0.86, 0.5), uGoldOut.mul(uGoldOut).mul(0.7));
    pipeline.outputNode = vec4(outc.mul(vignette), 1);
  }

  /* ── fit ───────────────────────────────────────────────────────────── */
  function fit() {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fit();
  window.addEventListener('resize', fit);

  /* ── pointer: a gentle lean on the baked flight (parallax, not control) ── */
  const pointer = new THREE.Vector2(0, 0);
  function onPointerMove(e: PointerEvent) {
    pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1,
    );
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* ── loop ──────────────────────────────────────────────────────────── */
  let firstFrame = true;
  const eased = new THREE.Vector2(0, 0);

  function loop() {
    eased.lerp(pointer, 0.05);

    // re-apply the baked pose, then lean off it a touch with the pointer so the
    // still-scrubbed frames still feel alive (mirrors city.ts)
    if (action) mixer.update(0);
    camera.position.x += eased.x * 0.6;
    camera.position.y += eased.y * -0.3;
    camera.rotation.y -= eased.x * 0.01;
    camera.rotation.x -= eased.y * 0.006;

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
    stations: meta.stations,
    setFlyover(t: number) {
      applyFlyover(t);
    },
    dispose() {
      io.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      mixer.stopAllAction();
      satTex.dispose();
      pipeline.dispose();
      renderer.dispose();
    },
  };
}
