/**
 * The Main-Lobby — Workstream A (the heart).
 *
 * You have stepped THROUGH the painting and now stand inside the living sea
 * of fog. The wanderer is a quiet repoussoir at the edge; the fog drifts past
 * you; the mouse is wind AND your gaze — it pans the view left↔right within a
 * bounded arc. Hanging in the depth, framed and gallery-grade, are the worlds:
 * each a painting in a gold frame, gently breathing on the wind.
 *
 * Hover a plate and the reality lens wipes the brushwork clear right there
 * (the shared Kuwahara pass clears around the pointer); a museum placard lifts.
 * Click and the camera dollies through the frame — handed off to real Astro
 * navigation by the controller.
 *
 * Built on the proven Act-0 recipes (sky/fog/palette/figure are reused from
 * summit.ts; the Kuwahara+lens pipeline from painting.ts). This scene adds the
 * gallery: plates, pan, hover, dolly.
 */
import * as THREE from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  clamp,
  exp,
  float,
  length,
  mix,
  mx_noise_float,
  positionWorld,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createPainting } from './painting';
import { lerpPalette, fbm, drawWanderer } from './summit';

/* ── the worlds that hang in the fog ──────────────────────────────────────
   pos is the plate centre in world space; the camera sits near origin looking
   down −Z and pans across the arc, so the plates are spread in azimuth and
   depth. Honest 1-liners (Workstream E; final copy is TODO(Mattis)).        */
export interface HubPlate {
  id: string;
  name: string;
  line: string;
  href: string;
  numeral: string;
}

interface PlateDef extends HubPlate {
  tex: string;
  pos: [number, number, number];
  /** plate width in world units (height derives from 3:2) */
  w: number;
}

const PLATE_DEFS: PlateDef[] = [
  { id: 'sea', name: 'The Sea', line: 'Who he is.', href: '/sea', numeral: 'I',
    tex: '/assets/plates/sea.webp', pos: [-9.6, 0.7, -17], w: 9.6 },
  { id: 'city', name: 'The City', line: 'What he builds.', href: '/city', numeral: 'II',
    tex: '/assets/plates/city.webp', pos: [-3.4, 2.1, -24], w: 9.2 },
  { id: 'camino', name: 'The Way', line: 'Where he walked.', href: '/camino', numeral: 'III',
    tex: '/assets/plates/camino.webp', pos: [4.2, 1.2, -22], w: 9.2 },
  { id: 'horizon', name: 'The Horizon', line: "What's next.", href: '/horizon', numeral: 'IV',
    tex: '/assets/plates/horizon.webp', pos: [11.2, 2.7, -29], w: 10.0 },
];

/** projected screen position of a plate's placard anchor, for DOM overlay */
export interface PlateScreen {
  id: string;
  /** placard anchor in CSS px (below the frame) */
  x: number;
  y: number;
  /** apparent scale 0..~1.4 (nearer = bigger) for sizing the placard */
  scale: number;
  hovered: boolean;
  /** false when behind the camera / off the pannable arc */
  visible: boolean;
}

export interface HubOptions {
  /** plate aspect height/width (default 2/3 → 3:2 landscape) */
  fov?: number;
  /** called once per rendered frame (the spike counts FPS here) */
  onFrame?: () => void;
  /** max pan yaw in radians (default 0.46 ≈ 26°) */
  maxYaw?: number;
}

export interface HubHandle {
  plates: HubPlate[];
  /** register a per-frame callback with the projected placard positions */
  setOnUpdate(cb: (s: PlateScreen[]) => void): void;
  /** the plate under the pointer right now, or null */
  hoveredId(): string | null;
  /** dolly the camera through a plate's frame; resolves when it fills the view */
  focus(id: string): Promise<void>;
  /** ease back out of a focused plate (e.g. on Escape) */
  unfocus(): void;
  dispose(): void;
}

const SKY_DIST = 70;
const FOG_LAYERS = 7;
const KUWAHARA_RADIUS = 4;
const PLATE_RATIO = 2 / 3; // height / width (3:2 landscape)

/* foreground outcrop (only the Outcrop mesh of summit.glb — the peaks/crags
   would clutter the gallery), placed lower-right so the wanderer perches on it
   as a repoussoir and the rest is open fog. */
/* same figure↔outcrop geometry as the approved Act 0, translated to the right
   edge so the wanderer is a repoussoir you have stepped past. */
const TERRAIN_SCALE = 0.62;
const TERRAIN_POS: [number, number, number] = [5.45, -7.96, -1.21];

export async function mountHub(
  canvas: HTMLCanvasElement,
  opts: HubOptions = {},
): Promise<HubHandle | null> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  try {
    await renderer.init();
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const CAM_FOV = opts.fov ?? 55;
  const MAX_YAW = opts.maxYaw ?? 0.46;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CAM_FOV,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    160,
  );
  const EYE = new THREE.Vector3(0, 1.0, 10);
  camera.position.copy(EYE);

  /* ── palette uniforms (written on the CPU, synced to the clock) ── */
  const uZenith = uniform(new THREE.Color());
  const uMid = uniform(new THREE.Color());
  const uHorizon = uniform(new THREE.Color());
  const uSunCore = uniform(new THREE.Color());
  const uSunHalo = uniform(new THREE.Color());
  const uSunPos = uniform(new THREE.Vector2(0.62, 0.2));
  const uSunIntensity = uniform(0.9);
  const uSkyAspect = uniform(1.8);
  const uWind = uniform(new THREE.Vector2(0, 0));
  const uHaze = uniform(new THREE.Color(0x9aa7c4));

  /* ── the sky (same gradient + tight sun as Act 0) ── */
  const skyMat = new THREE.MeshBasicNodeMaterial();
  {
    const u = uv();
    const lower = mix(uHorizon, uMid, smoothstep(0.0, 0.5, u.y));
    const sky = mix(lower, uZenith, smoothstep(0.42, 1.0, u.y));
    const d = length(u.sub(uSunPos).mul(vec2(uSkyAspect, 1)));
    const core = exp(d.mul(-26.0)).mul(uSunIntensity);
    const halo = exp(d.mul(-5.5)).mul(uSunIntensity).mul(0.55);
    const grain = mx_noise_float(vec3(u.mul(3.0), time.mul(0.02))).mul(0.015);
    skyMat.colorNode = sky.add(uSunCore.mul(core)).add(uSunHalo.mul(halo)).add(grain);
  }
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyMat);
  skyMesh.position.z = -SKY_DIST;
  skyMesh.renderOrder = -10;
  scene.add(skyMesh);

  /* ── the sea of fog ── */
  interface FogLayer {
    mesh: THREE.Mesh;
    color: ReturnType<typeof uniform>;
    depth: number;
    baseY: number;
  }
  const fogLayers: FogLayer[] = [];

  function addFogLayer(depth: number, z: number, baseOpacity: number, order: number) {
    const seed = 17.31 * (depth * 7 + 1);
    const speed = 0.004 + depth * 0.012;
    const drift = 0.35 + depth * 0.85;

    const uLayerColor = uniform(new THREE.Color());
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    {
      const u = uv();
      const p = u.mul(vec2(2.4, 1.3)).add(uWind.mul(drift)).add(vec2(time.mul(speed), 0));
      // billowing bank — tight noise window → defined, puffy billows (not a
      // smooth wash); you are DOWN IN the sea of fog. A modest smooth floor
      // grounds the bank, the billows carry the form above it.
      const body = smoothstep(0.40, 0.62, fbm(vec3(p, seed)));
      const topFade = smoothstep(1.0, 0.40, u.y);
      const floor = smoothstep(0.5, 0.0, u.y); // grounded base
      const edge = smoothstep(0.0, 0.06, u.x).mul(smoothstep(1.0, 0.94, u.x));
      mat.colorNode = uLayerColor;
      mat.opacityNode = clamp(body.mul(topFade).mul(1.25).add(floor.mul(0.5)).mul(edge).mul(baseOpacity), 0, 1);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.z = z;
    mesh.renderOrder = order;
    scene.add(mesh);
    fogLayers.push({ mesh, color: uLayerColor, depth, baseY: 0 });
  }
  for (let i = 0; i < FOG_LAYERS; i++) {
    const depth = i / (FOG_LAYERS - 1);
    addFogLayer(depth, -48 + depth * 42, 0.85 + depth * 0.7, i);
  }

  /* ── the wanderer (figure only — at the right edge, you stepped past him) ── */
  const figTexture = new THREE.CanvasTexture(drawWanderer(false));
  const uFigure = uniform(new THREE.Color(0x181522));
  const figMat = new THREE.MeshBasicNodeMaterial();
  figMat.transparent = true;
  figMat.depthWrite = false;
  figMat.colorNode = uFigure;
  figMat.opacityNode = texture(figTexture).a;
  const figure = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), figMat);
  figure.scale.set(6.5, 8.65, 1);
  figure.position.set(6.8, 0.0, -4);
  figure.renderOrder = 40;
  scene.add(figure);

  /* ── foreground outcrop under the wanderer (Outcrop mesh only) ── */
  const terrainMats: THREE.Material[] = [];
  const terrainGeos: THREE.BufferGeometry[] = [];
  let terrainGroup: THREE.Group | null = null;
  try {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync('/assets/summit/summit.glb');
    terrainGroup = gltf.scene;
    terrainGroup.scale.setScalar(TERRAIN_SCALE);
    terrainGroup.position.set(...TERRAIN_POS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hazed = (col: any, near: number, far: number, amt: number): any =>
      mix(col, uHaze, smoothstep(near, far, length(positionWorld.sub(cameraPosition))).mul(amt));
    terrainGroup.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // only the foreground rock; the far peaks/crags would crowd the gallery
      if (mesh.name !== 'Outcrop') {
        mesh.visible = false;
        return;
      }
      terrainGeos.push(mesh.geometry);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a: any = attribute('color');
      const mat = new THREE.MeshBasicNodeMaterial();
      mat.colorNode = hazed(a.rgb.mul(0.72), 12, 60, 0.32); // solid foreground rock
      mesh.material = mat;
      mesh.renderOrder = -1;
      terrainMats.push(mat);
    });
    scene.add(terrainGroup);
  } catch {
    /* no terrain — the fog gallery still stands */
  }

  // near wisps drift across the whole view — the fog passes by you, close
  addFogLayer(1.15, -2, 0.16, 45);
  addFogLayer(1.45, 4.5, 0.12, 46);

  /* ── the gallery plates: framed paintings hanging in the fog ──────────────
     Each plate is a Group: a gold frame (a box with real depth + a beveled TSL
     molding) and the artwork plane. The frame and art are repainted by the
     Kuwahara pass → a painting inside a painting. Hover clears the lens here. */
  const texLoader = new THREE.TextureLoader();
  interface Plate {
    def: PlateDef;
    group: THREE.Group;
    art: THREE.Mesh;
    h: number;
    bobPhase: number;
    geos: THREE.BufferGeometry[];
    mats: THREE.Material[];
    tex: THREE.Texture;
  }
  const plates: Plate[] = [];

  for (const def of PLATE_DEFS) {
    const h = def.w * PLATE_RATIO;
    const group = new THREE.Group();
    group.position.set(...def.pos);

    // ── soft drop shadow: the plate has weight, it hangs in the fog ──
    const shGeo = new THREE.PlaneGeometry((def.w) * 1.32, (h) * 1.4);
    const shMat = new THREE.MeshBasicNodeMaterial();
    shMat.transparent = true;
    shMat.depthWrite = false;
    {
      const su = uv();
      const sd = length(su.sub(vec2(0.5)));
      shMat.colorNode = vec3(0.03, 0.03, 0.06);
      shMat.opacityNode = smoothstep(0.5, 0.12, sd).mul(0.3);
    }
    const shadow = new THREE.Mesh(shGeo, shMat);
    shadow.position.set(0.3, -0.45, -0.25);
    shadow.renderOrder = 3;
    group.add(shadow);

    // ── frame: a wide molding box with real depth, beveled + lit in TSL ──
    const FRAME = 0.85; // molding width — reads as a frame, not a hairline
    const DEPTH = 0.42;
    const frameGeo = new THREE.BoxGeometry(def.w + FRAME * 2, h + FRAME * 2, DEPTH);
    const frameMat = new THREE.MeshBasicNodeMaterial();
    {
      const u = uv();
      // directional light: the low sun rakes the molding from the upper-left,
      // so the top-left lifts to bright gold, the lower-right falls to shadow.
      const lit = clamp(u.y.mul(0.5).add(u.x.oneMinus().mul(0.32)).add(0.46), 0.4, 1.22);
      // a darker outer rim for a beveled edge (the molding's chamfer)
      const rim = smoothstep(0.0, 0.035, u.x)
        .mul(smoothstep(1.0, 0.965, u.x))
        .mul(smoothstep(0.0, 0.05, u.y))
        .mul(smoothstep(1.0, 0.95, u.y));
      const gold = vec3(0.80, 0.60, 0.28);
      frameMat.colorNode = gold.mul(lit).mul(mix(float(0.58), float(1.0), rim));
    }
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.renderOrder = 4;
    group.add(frame);

    // ── the artwork ──
    const tex = texLoader.load(def.tex);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const artGeo = new THREE.PlaneGeometry(def.w, h);
    const artMat = new THREE.MeshBasicNodeMaterial();
    artMat.colorNode = texture(tex);
    const art = new THREE.Mesh(artGeo, artMat);
    art.position.z = DEPTH / 2 + 0.01; // sit on the front face of the frame
    art.renderOrder = 5;
    art.userData.plateId = def.id;
    group.add(art);

    scene.add(group);
    plates.push({
      def, group, art, h,
      bobPhase: Math.random() * Math.PI * 2,
      geos: [frameGeo, artGeo],
      mats: [frameMat, artMat],
      tex,
    });
  }

  /* ── palette → uniforms ── */
  function applyPalette() {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('hour');
    const now = new Date();
    const hour = override ? parseFloat(override) : now.getHours() + now.getMinutes() / 60;
    const p = lerpPalette(((hour % 24) + 24) % 24);
    (uZenith.value as THREE.Color).setHex(p.zenith);
    (uMid.value as THREE.Color).setHex(p.mid);
    (uHorizon.value as THREE.Color).setHex(p.horizon);
    (uSunCore.value as THREE.Color).setHex(p.sunCore);
    (uSunHalo.value as THREE.Color).setHex(p.sunHalo);
    (uSunPos.value as THREE.Vector2).set(0.62, p.sunY);
    uSunIntensity.value = p.sunIntensity;
    renderer.setClearColor(p.zenith, 1);
    const far = new THREE.Color(p.fogFar);
    const near = new THREE.Color(p.fogNear);
    // Friedrich's fog is luminous blue-grey, not warm tan — pull the bank
    // toward a cool pale grey (more on the far/upper layers), keeping the near
    // fog a touch warmer where the low sun rakes it. This is the warm-low /
    // cool-up tension both Friedrich and Aivazovsky share.
    const cool = new THREE.Color(0xc7cfdd);
    for (const layer of fogLayers) {
      const d = Math.min(layer.depth, 1);
      const base = far.clone().lerp(near, d);
      const coolAmt = 0.46 - d * 0.3; // far layers coolest, near warmest
      (layer.color.value as THREE.Color).copy(base.lerp(cool, Math.max(coolAmt, 0)));
    }
    (uHaze.value as THREE.Color).copy(far.clone().lerp(cool, 0.3));
  }
  applyPalette();
  const paletteTimer = window.setInterval(applyPalette, 60_000);

  /* ── the painting (shared Kuwahara + reality lens) ── */
  const painting = createPainting(renderer, scene, camera, {
    radius: KUWAHARA_RADIUS,
    lens: true,
  });
  const { uPointerUv, uReality } = painting;

  /* ── fit ── */
  function fit() {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const frustumHeightAt = (dist: number) => 2 * dist * Math.tan(THREE.MathUtils.degToRad(CAM_FOV / 2));
    const skyH = frustumHeightAt(SKY_DIST + 10) * 1.25;
    const skyW = skyH * camera.aspect * 1.25;
    skyMesh.scale.set(skyW, skyH, 1);
    uSkyAspect.value = skyW / skyH;
    for (const layer of fogLayers) {
      const dist = EYE.z - layer.mesh.position.z;
      const fh = frustumHeightAt(dist);
      const fw = fh * camera.aspect;
      // taller banks, lifted so the fog fills up toward mid-frame and wraps
      // the lower edges of the plates — you stand inside the sea of fog.
      layer.mesh.scale.set(fw * 2.2, fh * 1.4, 1);
      layer.baseY = -fh * (0.12 + Math.min(layer.depth, 1) * 0.12);
      layer.mesh.position.y = layer.baseY;
    }
  }
  fit();
  window.addEventListener('resize', fit);

  /* ── pointer: wind + gaze pan + plate raycast ── */
  const pointer = new THREE.Vector2(0, 0);
  const windVel = new THREE.Vector2(0.006, 0);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: string | null = null;
  let activity = 0;
  let lastPx = 0.5;
  let lastPy = 0.5;

  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    pointer.set(px * 2 - 1, py * 2 - 1);
    (uPointerUv.value as THREE.Vector2).set(px, py);
    activity = Math.min(1, activity + (Math.abs(px - lastPx) + Math.abs(py - lastPy)) * 5);
    lastPx = px;
    lastPy = py;
    // raycast against the art planes for hover
    ndc.set(pointer.x, -pointer.y);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(plates.map((p) => p.art), false);
    hovered = hits.length ? (hits[0]!.object.userData.plateId as string) : null;
    canvas.style.cursor = hovered ? 'pointer' : '';
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* ── focus / dolly through the frame ── */
  interface Focus {
    plate: Plate;
    mode: 'in' | 'out';
    t: number;
    fromPos: THREE.Vector3;
    fromYaw: number;
    fromPitch: number;
    resolve?: () => void;
  }
  let focusState: Focus | null = null;
  let yaw = 0;
  let pitch = 0;

  function focus(id: string): Promise<void> {
    const plate = plates.find((p) => p.def.id === id);
    if (!plate) return Promise.resolve();
    return new Promise<void>((resolve) => {
      focusState = {
        plate, mode: 'in', t: 0,
        fromPos: camera.position.clone(),
        fromYaw: yaw, fromPitch: pitch,
        resolve,
      };
    });
  }
  function unfocus() {
    if (focusState) {
      focusState.mode = 'out';
      focusState.t = 0;
      focusState.fromPos = camera.position.clone();
    }
  }

  /* ── update callback for the DOM placards ── */
  let onUpdate: ((s: PlateScreen[]) => void) | null = null;
  const projV = new THREE.Vector3();
  function reportPlates() {
    if (!onUpdate) return;
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    const out: PlateScreen[] = plates.map((p) => {
      // placard anchor: just below the frame
      projV.set(p.group.position.x, p.group.position.y - p.h / 2 - 0.55, p.group.position.z);
      projV.project(camera);
      const visible = projV.z < 1 && Math.abs(projV.x) < 1.25 && Math.abs(projV.y) < 1.4;
      // apparent scale from distance (nearer = bigger placard)
      const dist = camera.position.distanceTo(p.group.position);
      const scale = clampNum(22 / dist, 0.66, 1.15);
      return {
        id: p.def.id,
        x: (projV.x * 0.5 + 0.5) * w,
        y: (-projV.y * 0.5 + 0.5) * h,
        scale,
        hovered: hovered === p.def.id,
        visible,
      };
    });
    onUpdate(out);
  }

  /* ── loop ── */
  const tmpTarget = new THREE.Vector3();
  let last = performance.now();
  let firstFrame = true;
  const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // wind chases the pointer; fog accumulates drift
    windVel.x += (0.006 + pointer.x * 0.04 - windVel.x) * 0.02;
    windVel.y += (pointer.y * -0.01 - windVel.y) * 0.02;
    const wind = uWind.value as THREE.Vector2;
    wind.x += windVel.x * dt;
    wind.y += windVel.y * dt;

    // reality lens: hovering a plate lifts it even when the hand is still,
    // so the brushwork wipes clear over the painting under the cursor.
    activity *= Math.exp(-dt / 0.9);
    const target = hovered ? 1 : activity;
    const cur = uReality.value as number;
    uReality.value = cur + (target - cur) * (target > cur ? 0.16 : 0.06);

    if (focusState) {
      // dolly through the frame (or back out)
      const f = focusState;
      f.t = Math.min(1, f.t + dt / 0.85);
      const e = easeInOut(f.t);
      if (f.mode === 'in') {
        // a point just in front of the plate, framed to fill the view
        const fillDist = (f.plate.h / 2) / Math.tan(THREE.MathUtils.degToRad(CAM_FOV / 2)) * 1.04;
        tmpTarget.set(
          f.plate.group.position.x,
          f.plate.group.position.y,
          f.plate.group.position.z + fillDist,
        );
        camera.position.lerpVectors(f.fromPos, tmpTarget, e);
        camera.lookAt(f.plate.group.position);
        if (f.t >= 1) {
          f.resolve?.();
          f.resolve = undefined; // resolve once; hold until nav or unfocus
        }
      } else {
        // ease back to the panned eye position
        tmpTarget.copy(EYE);
        camera.position.lerpVectors(f.fromPos, tmpTarget, e);
        const ly = yaw * (1 - e);
        const lp = pitch * (1 - e);
        camera.lookAt(
          camera.position.x + Math.sin(ly),
          camera.position.y + Math.sin(lp),
          camera.position.z - Math.cos(ly),
        );
        if (f.t >= 1) focusState = null;
      }
    } else {
      // pan: the mouse is the gaze, swinging within a bounded arc + parallax
      const tyaw = pointer.x * MAX_YAW;
      const tpitch = pointer.y * -0.12;
      yaw += (tyaw - yaw) * 0.05;
      pitch += (tpitch - pitch) * 0.05;
      camera.position.x += (pointer.x * 1.1 - camera.position.x) * 0.03;
      camera.position.y += (1.0 + pointer.y * -0.3 - camera.position.y) * 0.03;
      camera.lookAt(
        camera.position.x + Math.sin(yaw),
        camera.position.y + Math.sin(pitch),
        camera.position.z - Math.cos(yaw),
      );
    }

    // plates: gentle bob + wind sway, yaw-billboard so they stay readable
    for (const p of plates) {
      const bob = Math.sin(now * 0.0006 + p.bobPhase) * 0.12;
      p.group.position.y = p.def.pos[1] + bob;
      const camAz = Math.atan2(
        camera.position.x - p.group.position.x,
        camera.position.z - p.group.position.z,
      );
      // mostly face the camera, with a breath of wind sway
      p.group.rotation.y = camAz + windVel.x * 0.5 + Math.sin(now * 0.0004 + p.bobPhase) * 0.012;
    }

    // the wanderer breathes
    figure.rotation.z = Math.sin(now * 0.0004) * 0.004 + windVel.x * 0.18;

    painting.render();
    reportPlates();
    opts.onFrame?.();

    if (firstFrame) {
      firstFrame = false;
      canvas.closest('[data-scene]')?.classList.add('is-live');
    }
  }
  renderer.setAnimationLoop(loop);

  const io = new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry?.isIntersecting ? loop : null);
    if (entry?.isIntersecting) last = performance.now();
  });
  io.observe(canvas);

  return {
    plates: PLATE_DEFS.map(({ id, name, line, href, numeral }) => ({ id, name, line, href, numeral })),
    setOnUpdate(cb) { onUpdate = cb; },
    hoveredId: () => hovered,
    focus,
    unfocus,
    dispose() {
      io.disconnect();
      window.clearInterval(paletteTimer);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      figTexture.dispose();
      for (const p of plates) {
        for (const g of p.geos) g.dispose();
        for (const m of p.mats) m.dispose();
        p.tex.dispose();
      }
      for (const m of terrainMats) m.dispose();
      for (const g of terrainGeos) g.dispose();
      painting.dispose();
      renderer.dispose();
    },
  };
}

function clampNum(x: number, lo: number, hi: number) {
  return Math.min(Math.max(x, lo), hi);
}
