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
  abs,
  attribute,
  cameraPosition,
  clamp,
  float,
  Fn,
  length,
  max,
  mix,
  mx_noise_float,
  normalize,
  positionWorld,
  pow,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createPainting } from './painting';
import { lerpPalette, fbm } from './summit';

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

// Staged at four distinct depths/heights across the pan arc so the gaze
// DISCOVERS them — not a row. Nearer = larger and lower; the deepest hangs
// small and high, softened by aerial perspective. They float in the clear air
// above the billowing sea, like Friedrich's distant ridges.
const PLATE_DEFS: PlateDef[] = [
  { id: 'sea', name: 'The Sea', line: 'Who he is.', href: '/sea', numeral: 'I',
    tex: '/assets/plates/sea.webp', pos: [-11.5, 3.4, -15], w: 11.0 },
  { id: 'city', name: 'The City', line: 'What he builds.', href: '/city', numeral: 'II',
    tex: '/assets/plates/city.webp', pos: [-2.0, 6.2, -27], w: 8.6 },
  { id: 'camino', name: 'The Way', line: 'Where he walked.', href: '/camino', numeral: 'III',
    tex: '/assets/plates/camino.webp', pos: [6.6, 3.9, -21], w: 9.4 },
  { id: 'horizon', name: 'The Horizon', line: "What's next.", href: '/horizon', numeral: 'IV',
    tex: '/assets/plates/horizon.webp', pos: [13.5, 6.6, -33], w: 8.2 },
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

const SKY_DIST = 300; // dome radius — encloses the whole fog sea
const KUWAHARA_RADIUS = 4; // real geometry is cheap → the painterly pass gets its budget back
const PLATE_RATIO = 2 / 3; // height / width (3:2 landscape)

/* foreground outcrop (only the Outcrop mesh of summit.glb — the peaks/crags
   would clutter the gallery), placed lower-right so the wanderer perches on it
   as a repoussoir and the rest is open fog. */
/* same figure↔outcrop geometry as the approved Act 0, translated to the right
   edge so the wanderer is a repoussoir you have stepped past. */
// the rock you stand on — first-person: enlarged, centred-low, running off the
// bottom of the frame as a repoussoir (you stepped THROUGH the painting; the
// figure is gone — you ARE the wanderer).
// plinths.glb is modelled at world scale, top of the ForeRock around y≈0, origin
// near world origin. The eye sits at y≈4.6 looking slightly down, so lift the
// rock so its hewn lip rises into the lower frame just below you, pulled forward
// toward the camera. Tunable live via ?pgs/?pgx/?pgy/?pgz/?pgry on the spike.
const TERRAIN_SCALE = 1.0;
const TERRAIN_POS: [number, number, number] = [0, -2.2, 2.0];

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

  const CAM_FOV = opts.fov ?? 55;
  const MAX_YAW = opts.maxYaw ?? 0.46;

  // tuning knobs for the volumetric sea of fog (read from the spike URL)
  const q = (k: string, d: number): number => {
    const v = new URLSearchParams(window.location.search).get(k);
    const n = v === null ? NaN : parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };
  // the raymarch is fragment-heavy and runs under Kuwahara → keep pixelRatio at
  // 1.0 (the painterly pass hides it). Overridable via ?pr= on the spike.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q('pr', 1.0)));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CAM_FOV,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    400, // the sea of fog recedes far before aerial-fading to the sky
  );
  const EYE = new THREE.Vector3(0, q('ey', 4.6), q('ez', 10));
  camera.position.copy(EYE);
  // you stand above the sea of fog and look down-and-across it: the billowing
  // tops spread below, the canvases float in the clear air above toward the sun.
  const BASE_PITCH = q('tilt', -0.15);

  /* ── palette uniforms (written on the CPU, synced to the clock) ── */
  const uZenith = uniform(new THREE.Color());
  const uMid = uniform(new THREE.Color());
  const uHorizon = uniform(new THREE.Color());
  const uSunCore = uniform(new THREE.Color());
  const uSunHalo = uniform(new THREE.Color());
  const uSunIntensity = uniform(0.9);
  const uWind = uniform(new THREE.Vector2(0, 0));
  const uHaze = uniform(new THREE.Color(0x9aa7c4));
  // world-space sun direction (low, to the right, into −Z): the warm light comes
  // from the right; the gallery hangs to the left in the cooler air.
  const uSunDir = uniform(
    new THREE.Vector3(q('sdx', 0.36), q('sdy', 0.12), q('sdz', -1)).normalize(),
  );
  // the sea of fog is now REAL Blender geometry (assets/lobby/fog.glb) with a
  // baked luminance gradient in vertex colour — the web only re-tints it per
  // time of day and aerial-fades it to the sky. (The old fragment-heavy TSL
  // raymarch read as thin haze at ~17fps and is gone.)
  const uFogTint = uniform(new THREE.Color()); // day-cycle multiply over the baked colour
  const uFogHaze = uniform(new THREE.Color()); // the sky colour the far fog dissolves into
  const uFogNear = uniform(q('fnear', 85)); // aerial perspective onset (world units)
  const uFogFar = uniform(q('ffar', 300)); // fully dissolved to sky by here
  const uFogContrast = uniform(q('fcon', 1.4)); // crest/valley tonal spread (billow relief — kept gentle so valleys stay luminous, not navy)
  const uFrameTint = uniform(new THREE.Color()); // day-cycle warmth over the baked gilt

  /* the sky the fog sits in — hemispherical gradient + the low sun disc/glow,
     all from the day-cycle palette. A cheap dome (no raymarch). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skyColor: any = Fn(([rd]: any) => {
    const up = clamp(rd.y, -1, 1);
    // vertical gradient: warm horizon → mid → cool zenith (warm-low / cool-up)
    const lower = mix(uHorizon, uMid, smoothstep(-0.05, 0.45, up));
    let sky: any = mix(lower, uZenith, smoothstep(0.30, 0.95, up));
    // Aivazovsky luminous horizon band — the brightest strip sits ON the horizon
    // and falls off with height, lifting the whole skyline into warm light so
    // the sky is not a flat wash. (~18° band; the fog rises into this glow.)
    const band = pow(max(float(1).sub(abs(up).mul(3.2)), 0), 2.2).mul(0.5);
    sky = mix(sky, uSunHalo, band);
    // the low sun: a hard disc, a tight warm halo, and a broad atmospheric
    // scatter that bleeds the warmth across the lower sky (the Aivazovsky move).
    const cosS = clamp(rd.dot(uSunDir), -1, 1);
    const disc = pow(max(cosS, 0), 1500).mul(uSunIntensity);
    const halo = pow(max(cosS, 0), 42).mul(uSunIntensity).mul(0.4);
    const scatter = pow(max(cosS, 0), 6).mul(uSunIntensity).mul(0.22);
    sky = sky.add(uSunCore.mul(disc)).add(uSunHalo.mul(halo)).add(uSunHalo.mul(scatter));
    return sky;
  });

  /* the environment dome carries the sky; it follows the camera each frame */
  const skyMat = new THREE.MeshBasicNodeMaterial();
  skyMat.side = THREE.BackSide;
  {
    const rd = normalize(positionWorld.sub(cameraPosition));
    const grain = mx_noise_float(vec3(rd.xy.mul(3.0), time.mul(0.02))).mul(0.012);
    skyMat.colorNode = vec4(skyColor(rd).add(grain), 1);
  }
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_DIST, 36, 18), skyMat);
  skyMesh.renderOrder = -10;
  scene.add(skyMesh);

  /* ── the SEA OF FOG — real billowing Blender geometry (fog.glb) ───────────
     Unlit vertex-colour (baked luminance: warm sun-lit crests, cool shadowed
     valleys) × the day-cycle tint, then aerial-faded to the sky so the bank
     recedes to a luminous infinity. Finished by the Kuwahara pass → a painted,
     billowing Friedrich sea. Loaded below with the outcrop. */
  const fogMats: THREE.Material[] = [];
  const fogGeos: THREE.BufferGeometry[] = [];
  function makeFogMaterial(): THREE.MeshBasicNodeMaterial {
    const m = new THREE.MeshBasicNodeMaterial();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baked: any = attribute('color');
    // boost the baked crest/valley contrast so the billows read as relief, then
    // re-tint for the time of day.
    const contrasted = baked.rgb.sub(0.5).mul(uFogContrast).add(0.5).max(vec3(0));
    const tinted = contrasted.mul(uFogTint);
    const dist = length(positionWorld.sub(cameraPosition));
    const aer = smoothstep(uFogNear, uFogFar, dist);
    m.colorNode = mix(tinted, uFogHaze, aer);
    fogMats.push(m);
    return m;
  }

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
  /* ── load the sea of fog (real billowing Blender geometry) ── */
  let fogGroup: THREE.Group | null = null;
  try {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync('/assets/lobby/fog.glb');
    fogGroup = gltf.scene;
    fogGroup.scale.set(q('fgsx', 1), q('fgsy', 1), q('fgsz', 1));
    fogGroup.position.set(q('fgx', 0), q('fgy', 0), q('fgz', 0));
    fogGroup.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      fogGeos.push(mesh.geometry);
      mesh.material = makeFogMaterial();
      mesh.renderOrder = -5; // over the sky dome, under the rock + plates
    });
    scene.add(fogGroup);
  } catch {
    /* no fog geometry — the sky + plates still stand */
  }

  /* ── foreground 3-D environment: the rock you stand on + plinth ledges ─────
     Real Blender geometry (assets/lobby/plinths.glb): a large first-person
     ForeRock whose hewn lip fills the lower frame and runs off the bottom (you
     stepped THROUGH the painting and now stand on it — the figure is gone), plus
     small hewn ledges that ground the near canvases (anti-float). Unlit baked-AO
     vertex colour, darkened to a near-silhouette Friedrich anchor, barely hazed
     (it's close). Built up=+Z → loads upright, no rotation. */
  const terrainMats: THREE.Material[] = [];
  const terrainGeos: THREE.BufferGeometry[] = [];
  let terrainGroup: THREE.Group | null = null;
  try {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync('/assets/lobby/plinths.glb');
    terrainGroup = gltf.scene;
    terrainGroup.scale.setScalar(q('pgs', TERRAIN_SCALE));
    terrainGroup.position.set(q('pgx', TERRAIN_POS[0]), q('pgy', TERRAIN_POS[1]), q('pgz', TERRAIN_POS[2]));
    terrainGroup.rotation.y = q('pgry', 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hazed = (col: any, near: number, far: number, amt: number): any =>
      mix(col, uHaze, smoothstep(near, far, length(positionWorld.sub(cameraPosition))).mul(amt));
    terrainGroup.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // show only the large ForeRock as the solid foreground repoussoir. The
      // small plinth ledges sit at un-tuned positions and read as floating dark
      // debris (the cheap look Mattis rejects) until grounded under each near
      // canvas — hidden for now (TODO: tune plinth pos to PLATE_DEFS, then show).
      const isForeRock = !/plinth/i.test(mesh.name)
        && mesh.geometry.getAttribute('position').count > 1000;
      if (!isForeRock) { mesh.visible = false; return; }
      terrainGeos.push(mesh.geometry);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a: any = attribute('color');
      const mat = new THREE.MeshBasicNodeMaterial();
      // a near-silhouette dark hewn stone — Friedrich's foreground rock is almost
      // black against the luminous fog, the dark anchor the eye stands on (not a
      // mid-grey crumble). A cool deep stone tone, barely hazed (it's close).
      mat.colorNode = hazed(a.rgb.mul(0.42).mul(vec3(0.92, 0.95, 1.05)), 12, 70, 0.22);
      mesh.material = mat;
      mesh.renderOrder = -1;
      terrainMats.push(mat);
    });
    scene.add(terrainGroup);
  } catch {
    /* no foreground — the fog gallery still stands */
  }

  // near wisps drift across the whole view — the fog passes by you, close
  addFogLayer(1.15, -2, 0.16, 45);
  addFogLayer(1.45, 4.5, 0.12, 46);

  /* ── the gallery: real carved gold-frame canvases hung in the fog ─────────
     Each is a Blender-modeled museum frame (carved ogee/cove/bead molding with
     baked gilt light, assets/lobby/frame.glb), instanced and scaled per world,
     with a curated still in the rabbet. Frame + art are repainted by the
     Kuwahara pass → a painting inside a painting. Staged at distinct depths so
     the gaze DISCOVERS them, not a row. */
  const texLoader = new THREE.TextureLoader();

  // load the carved frame geometry once; all four instances share it.
  // gltf-transform quantizes POSITION (KHR_mesh_quantization) and keeps the real
  // scale in the node matrix → bake the world matrix into the geometry, else the
  // frame loads at normalized (tiny) size.
  let frameGeoSrc: THREE.BufferGeometry | null = null;
  try {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync('/assets/lobby/frame.glb');
    gltf.scene.updateWorldMatrix(true, true);
    let found: THREE.Mesh | null = null;
    gltf.scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !found) found = m;
    });
    if (found) {
      const fm = found as THREE.Mesh;
      const g = fm.geometry.clone();
      g.applyMatrix4(fm.matrixWorld); // dequantize to real-world units
      g.computeBoundingBox();
      frameGeoSrc = g;
    }
  } catch {
    /* no carved frame — the art + shadow still stand */
  }
  // frame_set.py local geometry: outer width = OPEN_W(3.0) + 2·BORDER(0.52) =
  // 4.04, opening width = 3.0. The loaded geometry lies flat (faces +Y) and the
  // meshopt dequant scales it, so derive the real scale from the baked bbox:
  // we want the OPENING (not the outer molding) to equal def.w.
  const FRAME_OUTER_LOCAL = 3.0 + 2 * 0.52;
  const FRAME_OPEN_LOCAL = 3.0;
  let frameOuterW = FRAME_OUTER_LOCAL;
  let frameDepth = 0.3;
  if (frameGeoSrc?.boundingBox) {
    const bb = frameGeoSrc.boundingBox;
    frameOuterW = bb.max.x - bb.min.x; // width survives the upright rotation (about X)
    frameDepth = bb.max.y - bb.min.y; // becomes web depth after the upright rotation
  }

  function makeFrameMaterial(): THREE.MeshBasicNodeMaterial {
    const m = new THREE.MeshBasicNodeMaterial();
    m.side = THREE.DoubleSide; // carved molding reads from any grazing angle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baked: any = attribute('color');
    const tinted = baked.rgb.mul(uFrameTint);
    const dist = length(positionWorld.sub(cameraPosition));
    const aer = smoothstep(uFogNear.add(40), uFogFar, dist).mul(0.55);
    m.colorNode = mix(tinted, uFogHaze, aer); // deep frames soften into the air
    return m;
  }

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
    // scale so the OPENING equals def.w (robust to the meshopt dequant scale)
    const s = (def.w / frameOuterW) * (FRAME_OUTER_LOCAL / FRAME_OPEN_LOCAL);
    const group = new THREE.Group();
    group.position.set(...def.pos);
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];

    // ── soft drop shadow cast on the fog beneath: the canvas has weight ──
    const shGeo = new THREE.PlaneGeometry(def.w * 1.4, h * 1.5);
    const shMat = new THREE.MeshBasicNodeMaterial();
    shMat.transparent = true;
    shMat.depthWrite = false;
    {
      const su = uv();
      const sd = length(su.sub(vec2(0.5)));
      shMat.colorNode = vec3(0.04, 0.05, 0.09);
      shMat.opacityNode = smoothstep(0.5, 0.1, sd).mul(0.34);
    }
    const shadow = new THREE.Mesh(shGeo, shMat);
    shadow.position.set(0.35, -0.5, -0.3);
    shadow.renderOrder = 3;
    group.add(shadow);
    geos.push(shGeo);
    mats.push(shMat);

    // ── the carved gold frame (shared geometry, instanced + scaled) ──
    const frameMat = makeFrameMaterial();
    mats.push(frameMat);
    if (frameGeoSrc) {
      const frame = new THREE.Mesh(frameGeoSrc, frameMat);
      // the GLB was modelled facing Blender +Z → glTF maps that to +Y (up), so
      // the frame loads lying flat. Stand it upright facing the camera (+Z).
      frame.rotation.x = Math.PI / 2;
      frame.scale.setScalar(s);
      frame.renderOrder = 4;
      group.add(frame);
    }

    // ── the artwork, seated in the rabbet just behind the front lip ──
    const tex = texLoader.load(def.tex);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const artGeo = new THREE.PlaneGeometry(def.w, h);
    const artMat = new THREE.MeshBasicNodeMaterial();
    artMat.colorNode = texture(tex);
    const art = new THREE.Mesh(artGeo, artMat);
    art.position.z = frameDepth * 0.5 * s; // inside the rabbet, behind the front lip
    art.renderOrder = 5;
    art.userData.plateId = def.id;
    group.add(art);
    geos.push(artGeo);
    mats.push(artMat);

    scene.add(group);
    plates.push({
      def, group, art, h,
      bobPhase: Math.random() * Math.PI * 2,
      geos, mats, tex,
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
    uSunIntensity.value = p.sunIntensity;
    renderer.setClearColor(p.zenith, 1);
    const far = new THREE.Color(p.fogFar);
    const near = new THREE.Color(p.fogNear);
    // Friedrich's fog is luminous blue-grey, not warm tan — pull the ambient
    // toward a cool pale grey, and let the warm sun-core light scatter through
    // it from the right. This is the warm-low / cool-up tension both Friedrich
    // and Aivazovsky share.
    const cool = new THREE.Color(0xc7cfdd);
    // re-tint the baked fog luminance for the time of day. Friedrich's fog is the
    // BRIGHTEST mass in the frame — so pull the body hard toward a luminous warm
    // white and over-expose it a touch, with only a whisper of the cool fogFar
    // hue left in the valleys, so the bank glows rather than sitting as a dark
    // navy mass under a brighter sky. A hint of the warm sun-halo lets it catch
    // the low light.
    const lumWhite = new THREE.Color(0xf3f1ec);
    (uFogTint.value as THREE.Color)
      .copy(far.clone().lerp(lumWhite, 0.78))
      .lerp(new THREE.Color(p.sunHalo), 0.12)
      .multiplyScalar(1.26 + p.sunIntensity * 0.14);
    // the far fog dissolves into the warm horizon band of the sky (aerial perspective)
    (uFogHaze.value as THREE.Color).setHex(p.horizon).lerp(lumWhite, 0.35);
    // the gilt frames warm with the low sun; kept a touch deep so the gold reads
    // as gilt, not ivory.
    (uFrameTint.value as THREE.Color)
      .setRGB(1, 1, 1)
      .lerp(new THREE.Color(p.sunHalo), 0.3)
      .multiplyScalar(0.82 + p.sunIntensity * 0.1);
    // wisps in the near air pick up the warm low light
    for (const layer of fogLayers) {
      const base = near.clone().lerp(far, 0.3);
      (layer.color.value as THREE.Color).copy(base.lerp(cool, 0.25));
    }
    (uHaze.value as THREE.Color).copy(far.clone().lerp(cool, 0.4));
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
    // the dome rides with the camera so the sky is always around you
    skyMesh.position.copy(camera.position);

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
      const tpitch = BASE_PITCH + pointer.y * -0.12;
      yaw += (tyaw - yaw) * 0.05;
      pitch += (tpitch - pitch) * 0.05;
      camera.position.x += (pointer.x * 1.1 - camera.position.x) * 0.03;
      camera.position.y += (EYE.y + pointer.y * -0.3 - camera.position.y) * 0.03;
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
      for (const p of plates) {
        for (const g of p.geos) g.dispose();
        for (const m of p.mats) m.dispose();
        p.tex.dispose();
      }
      for (const m of terrainMats) m.dispose();
      for (const g of terrainGeos) g.dispose();
      for (const m of fogMats) m.dispose();
      for (const g of fogGeos) g.dispose();
      frameGeoSrc?.dispose();
      skyMesh.geometry.dispose();
      skyMat.dispose();
      painting.dispose();
      renderer.dispose();
    },
  };
}

function clampNum(x: number, lo: number, hi: number) {
  return Math.min(Math.max(x, lo), hi);
}
