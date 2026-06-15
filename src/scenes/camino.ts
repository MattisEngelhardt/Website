/**
 * Act III — The Way (built under the 12.06 doctrine).
 *
 * The human chapter: a cinematic satellite flyover of the Camino Portugués,
 * Porto → Santiago de Compostela — the pilgrimage he walked with his mother.
 * This is the realism act, the deliberate style break from the painted worlds:
 * REAL terrain, no brushwork.
 *
 * The set is real-world data, not procedural geometry:
 *   - elevation: Copernicus GLO-30 DEM (ESA, free) → a displaced terrain mesh
 *     baked in Blender (scripts/camino/prep_dem.py → blender/camino_set.py),
 *     relief exaggerated for the flight.
 *   - the drape: Sentinel-2 cloudless 2024 (EOX, CC-BY-4.0) — a cloud-free
 *     10 m satellite mosaic of the exact corridor (scripts/camino/fetch_satellite).
 *
 * The web side is atmosphere + story: aerial-perspective haze into a golden
 * horizon, low relief shading that makes the river valleys read, sun glint on
 * the Atlantic, and the glowing pilgrim route that draws itself along the
 * ground as you fly. The camera is a chase-cam choreographed analytically from
 * the real lon/lat of the fifteen waymark towns — exact, not hand-tuned.
 *
 * Scroll drives setFlyover(t): the flight travels the whole route south→north
 * and the path draws to Santiago; near the end the haze blooms into the warm
 * gold-out that resolves onto the next page of the book.
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
  /** the fraction of the route currently drawn (for DOM station captions) */
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

  const FOV = q('fov', 47);
  const ALT = q('alt', 9.5); // camera clearance above the route point (km)
  const BEHIND = q('behind', 6); // chase distance, opposite travel (km)
  const FWD = q('fwd', 9); // look-target distance ahead along travel (km)

  const camera = new THREE.PerspectiveCamera(
    FOV,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.05,
    2000,
  );
  camera.position.set(0, 14, 120);
  camera.lookAt(0, 0, 0);

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
    const horizon = vec3(0.86, 0.60, 0.40); // warm band
    const zenith = vec3(0.15, 0.30, 0.52); // soft blue
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
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
  scene.add(sky);

  /* ── the terrain: Blender mesh + Sentinel-2 drape ──────────────────── */
  const texLoader = new THREE.TextureLoader();
  const satTex = texLoader.load('/assets/camino/camino_sat.webp');
  satTex.colorSpace = THREE.SRGBColorSpace;
  satTex.anisotropy = 8; // oblique terrain stays sharp toward the horizon
  satTex.flipY = false;

  const DEBUG = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
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

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let terrain: THREE.Mesh | null = null;
  try {
    const gltf = await loader.loadAsync('/assets/camino/camino.glb');
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = terrainMat;
        terrain = m;
      }
    });
    scene.add(gltf.scene);
  } catch {
    renderer.dispose();
    return null;
  }
  if (!terrain) {
    renderer.dispose();
    return null;
  }
  const terrainMesh: THREE.Mesh = terrain;

  /* ── geo → mesh mapping (must match camino_set.py exactly) ──────────── */
  const { lonMin, latMin, lonMax, latMax } = meta.bbox;
  function toMeshXZ(lon: number, lat: number): [number, number] {
    const u = (lon - lonMin) / (lonMax - lonMin);
    const vn = (latMax - lat) / (latMax - latMin);
    return [(u - 0.5) * meta.widthKm, (vn - 0.5) * meta.depthKm];
  }

  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  function groundY(x: number, z: number): number {
    from.set(x, 60, z);
    ray.set(from, down);
    const hit = ray.intersectObject(terrainMesh, false);
    return hit.length ? hit[0].point.y : 0;
  }

  /* ── the camera path: a chase-cam over the station spline ──────────── */
  const groundPts = meta.stations.map((s) => {
    const [x, z] = toMeshXZ(s.lon, s.lat);
    return new THREE.Vector3(x, groundY(x, z), z);
  });
  const groundCurve = new THREE.CatmullRomCurve3(groundPts, false, 'centripetal', 0.5);

  /* ── the glowing pilgrim route: a tube that HUGS the terrain ───────── */
  const uDraw = uniform(0);
  {
    const SAMPLES = 460;
    const routePts: THREE.Vector3[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const p = groundCurve.getPointAt(i / SAMPLES);
      routePts.push(new THREE.Vector3(p.x, groundY(p.x, p.z) + 0.12, p.z));
    }
    const routeCurve = new THREE.CatmullRomCurve3(routePts, false, 'catmullrom', 0.5);
    const tube = new THREE.TubeGeometry(routeCurve, SAMPLES, 0.16, 6, false);
    const routeMat = new THREE.MeshBasicNodeMaterial();
    routeMat.transparent = true;
    {
      const along = uv().x; // 0 at Porto … 1 at Santiago (length of the tube)
      const drawn = float(1).sub(smoothstep(uDraw, uDraw.add(0.004), along));
      const head = smoothstep(uDraw.sub(0.02), uDraw, along).mul(drawn);
      const flow = along.mul(360).sub(time.mul(3.5)).sin().mul(0.5).add(0.5);
      const gold = vec3(1.2, 0.78, 0.3);
      routeMat.colorNode = vec4(
        gold.mul(float(0.72).add(flow.mul(0.28))).add(vec3(1.3, 1.0, 0.6).mul(head.mul(0.5))),
        1,
      );
      routeMat.opacityNode = drawn.mul(0.85);
    }
    const route = new THREE.Mesh(tube, routeMat);
    route.renderOrder = 4;
    scene.add(route);
  }

  /* ── station markers: slim warm beacons, the one in reach flares ───── */
  const markerGroup = new THREE.Group();
  const uActive = uniform(-1);
  const markerGeo = new THREE.ConeGeometry(0.1, 0.7, 5);
  groundPts.forEach((p, i) => {
    const fi = float(i);
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    const near = float(1).sub(clamp(uActive.sub(fi).abs().div(1.2), 0, 1));
    const puls = time.mul(2.2).add(fi).sin().mul(0.5).add(0.5);
    mat.colorNode = vec4(vec3(1.25, 0.92, 0.55), 1);
    mat.opacityNode = float(0.09).add(near.mul(0.42)).mul(puls.mul(0.3).add(0.7));
    const cone = new THREE.Mesh(markerGeo, mat);
    cone.position.set(p.x, p.y + 0.38, p.z);
    markerGroup.add(cone);
  });
  scene.add(markerGroup);

  /* ── the flyover state ─────────────────────────────────────────────── */
  const baseCam = new THREE.Vector3();
  const baseLook = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const tanH = new THREE.Vector3();
  let flyT = 0;

  function applyFlyover(t: number) {
    flyT = clamp01(t);
    const g = groundCurve.getPointAt(flyT);
    groundCurve.getTangentAt(flyT, tan);
    tanH.set(tan.x, 0, tan.z).normalize();

    // establishing lift at the very start, settling onto Santiago at the end
    const lift = (1 - smoothstepJs(0.0, 0.07, flyT)) * 4 + smoothstepJs(0.9, 1, flyT) * 1.5;
    baseCam.set(
      g.x - tanH.x * BEHIND,
      g.y + ALT + lift,
      g.z - tanH.z * BEHIND,
    );
    // look at a point ahead along the route, near the ground (forward + down)
    baseLook.set(g.x + tanH.x * FWD, g.y, g.z + tanH.z * FWD);

    uDraw.value = clamp01(flyT + 0.02);
    uActive.value = flyT * (meta.stations.length - 1);
    // the gold-out blooms as the pilgrim reaches Santiago
    uGoldOut.value = smoothstepJs(0.82, 1, flyT);
  }
  applyFlyover(0);

  /* ── post: a light cinematic finish (NOT the painterly Kuwahara) ───── */
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const sceneTex = scenePass.getTextureNode();
  {
    const glow = bloom(sceneTex, 0.28, 0.6, 0.85); // sun, glint, route halo
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

  /* ── pointer: a gentle lean on the chase-cam ───────────────────────── */
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
  const right = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const upV = new THREE.Vector3(0, 1, 0);
  const eased = new THREE.Vector2(0, 0);

  function loop() {
    eased.lerp(pointer, 0.05);
    // lean: strafe a little with the pointer, nudge the look-height
    fwd.subVectors(baseLook, baseCam).normalize();
    right.crossVectors(fwd, upV).normalize();
    camera.position.copy(baseCam).addScaledVector(right, eased.x * 2.2);
    camera.position.y += eased.y * -1.0;
    camera.lookAt(baseLook.x, baseLook.y + 0.4, baseLook.z);
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
      satTex.dispose();
      markerGeo.dispose();
      pipeline.dispose();
      renderer.dispose();
    },
  };
}
