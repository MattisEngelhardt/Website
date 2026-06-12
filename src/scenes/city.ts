/**
 * Act II — The City of Agents. REBUILT under the 12.06 doctrine:
 *
 * The city is a real Blender set (scripts/blender/city_set.py →
 * city_bake_export.py → gltf-transform meshopt): ~100k polygons of
 * actual street-canyon geometry — recessed window reveals, AC boxes,
 * parapets, water tanks, extruded neon lettering, catenary power
 * lines, curbs and crosswalks — with ambient occlusion baked into
 * vertex colors by Cycles/OPTIX. The camera flight THROUGH the canyon
 * is choreographed in Blender (10 s clip on the GLB camera) and
 * scrubbed by scroll.
 *
 * The web side is the finish, not the content: TSL re-skins the
 * materials by name (unlit night shading, window breathe, neon pulse,
 * billboard flicker), mirrors the set beneath a puddle-masked street
 * for honest wet reflections, adds rain, pixel agents and the
 * pixelwork post (mosaic + CRT + phosphor bloom).
 */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  attribute,
  abs,
  cameraPosition,
  exp,
  float,
  hash,
  instanceIndex,
  length,
  mix,
  mod,
  mx_noise_float,
  positionLocal,
  positionWorld,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { createPixelwork } from './pixelwork';

const SKY_DIST = 270;
// violet rain haze, als LINEARE Werte (Hex wuerde durchs sRGB-Encoding
// zu Milch-Lila aufschwimmen) — the night stays night
const HAZE = new THREE.Color(0.014, 0.008, 0.026);

// the neon trio (shifted quintet) — must match city_set.py
const NEON: Record<string, [number, number, number]> = {
  neon_sun: [1.0, 0.78, 0.22],
  neon_cyan: [0.1, 0.88, 0.8],
  neon_magenta: [1.0, 0.16, 0.42],
  neon_porter: [1.0, 0.78, 0.22],
  neon_amadeus: [0.1, 0.88, 0.8],
  neon_papers: [1.0, 0.16, 0.42],
};

const RAIN_COUNT = 700;
const RAIN_W = 46;
const RAIN_H = 26;
const RAIN_D = 70;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── his agents: hand-set pixel sprites, two-frame walk ──────────── */

// 12×18 maps; '#' body, 'u' umbrella. Authored pixel art, not noise.
const WALK_A = [
  '....####....',
  '....####....',
  '.....##.....',
  '...######...',
  '..########..',
  '..########..',
  '.#.######.#.',
  '.#.######.#.',
  '...######...',
  '...######...',
  '....####....',
  '....#..#....',
  '...##..##...',
  '...#....#...',
  '..##....##..',
  '..#......#..',
  '..#......##.',
  '.##.........',
];
const WALK_B = [
  '....####....',
  '....####....',
  '.....##.....',
  '...######...',
  '..########..',
  '..########..',
  '..#######...',
  '..#######...',
  '...######...',
  '...######...',
  '....####....',
  '....####....',
  '....#..#....',
  '....#..#....',
  '....#..#....',
  '....#..#....',
  '....##.##...',
  '....##.##...',
];
const UMBRELLA = [
  '..uuuuuuuu..',
  '.uuuuuuuuuu.',
  '.....u......',
];

function agentTexture(color: string, umbrella: boolean): THREE.CanvasTexture {
  const cnv = document.createElement('canvas');
  cnv.width = 24; // two frames side by side
  cnv.height = 21;
  const ctx = cnv.getContext('2d')!;
  const draw = (map: string[], ox: number) => {
    const oy = umbrella ? 3 : 0;
    if (umbrella) {
      ctx.fillStyle = color;
      UMBRELLA.forEach((row, y) =>
        row.split('').forEach((c, x) => {
          if (c === 'u') ctx.fillRect(ox + x, y, 1, 1);
        }),
      );
    }
    map.forEach((row, y) =>
      row.split('').forEach((c, x) => {
        if (c === '#') {
          // coat darkens toward the hem — one tint, two values
          ctx.fillStyle = color;
          ctx.globalAlpha = y > 9 ? 0.78 : 1;
          ctx.fillRect(ox + x, oy + y, 1, 1);
          ctx.globalAlpha = 1;
        }
      }),
    );
  };
  draw(WALK_A, 0);
  draw(WALK_B, 12);
  const tex = new THREE.CanvasTexture(cnv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  return tex;
}

/* ── scene ───────────────────────────────────────────────────────── */

export interface CityHandle {
  /** 0 = above the rooftops … 1 = the broadcast collapses */
  setApproach(t: number): void;
  dispose(): void;
}

export async function mountCity(
  canvas: HTMLCanvasElement,
): Promise<CityHandle | null> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });

  try {
    await renderer.init();
  } catch {
    return null; // the painted CSS night stays
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x0d0b16, 1);

  const scene = new THREE.Scene();

  const geos: THREE.BufferGeometry[] = [];
  const texs: THREE.Texture[] = [];
  const mats: THREE.Material[] = [];

  /* ── the Blender set ── */
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync('/assets/city/city.glb');
  } catch {
    renderer.dispose();
    return null;
  }

  /* the haze swallows the far districts — never fully, or depth dies */
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const hazed = (col: any): any => {
    const dist = length(positionWorld.sub(cameraPosition));
    return mix(col, vec3(HAZE.r, HAZE.g, HAZE.b), smoothstep(70.0, 260.0, dist).mul(0.72));
  };
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const mirrored = (col: any): any =>
    col.mul(exp(positionWorld.y.mul(0.045))).mul(0.42);

  /* billboard flicker uniforms, keyed by material name */
  interface Board {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    uFlick: any;
    phase: number;
    drop: number;
  }
  const boards = new Map<string, Board>();
  for (const name of ['neon_porter', 'neon_amadeus', 'neon_papers']) {
    boards.set(name, { uFlick: uniform(1), phase: Math.random() * 9, drop: 0 });
  }

  /** rebuild a GLB material in TSL — the look lives here, on real geometry */
  function makeMat(name: string, mirror: boolean): THREE.MeshBasicNodeMaterial {
    const mat = new THREE.MeshBasicNodeMaterial();
    // AttributeNode erases the vec4 generic — swizzles need any (s. brain.md)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const a: any = attribute('color');
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let col: any;

    if (name === 'win_lit') {
      // every room breathes; AO already lives in the vertex color
      const n = mx_noise_float(
        vec3(positionWorld.x.mul(1.7), abs(positionWorld.y).mul(1.7), time.mul(0.25)),
      )
        .mul(0.18)
        .add(0.92);
      col = a.rgb.mul(1.9).mul(n);
    } else if (name === 'win_dark') {
      col = vec3(0.012, 0.015, 0.028);
    } else if (name === 'wire') {
      col = vec3(0.004, 0.004, 0.006);
    } else if (name === 'beacon') {
      const pulse = time
        .mul(1.4)
        .add(positionWorld.x)
        .sin()
        .mul(0.5)
        .add(0.5)
        .pow(3.0)
        .mul(2.2)
        .add(0.05);
      col = vec3(1.0, 0.32, 0.2).mul(pulse);
    } else if (name in NEON) {
      const [r, g, b] = NEON[name];
      const board = boards.get(name);
      const travel = time.mul(2.3).add(positionWorld.y.mul(0.7)).sin().mul(0.1).add(0.9);
      col = vec3(r, g, b).mul(travel).mul(1.8);
      if (board) col = col.mul(board.uFlick);
    } else {
      // facade / metal: baked tint × AO, gedimmt (sRGB hebt Dunkles an —
      // Cycles hatte AgX, das Web nicht), Neon-Spill an den Fuessen
      const glow = exp(abs(positionWorld.y).mul(-0.1)).mul(vec3(0.03, 0.012, 0.04));
      col = a.rgb.mul(0.42).add(glow);
    }

    if (mirror) {
      col = mirrored(col);
      mat.side = THREE.DoubleSide;
    }
    mat.colorNode = hazed(col);
    mats.push(mat);
    return mat;
  }

  /* the wet street: baked asphalt, puddles open onto the mirror city */
  function makeStreetMat(): THREE.MeshBasicNodeMaterial {
    const mat = new THREE.MeshBasicNodeMaterial();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const a: any = attribute('color');
    const pw = positionWorld;
    const wet = mx_noise_float(vec3(pw.x.mul(0.33), pw.z.mul(0.21), 2.71));
    const puddle = smoothstep(0.05, 0.75, wet);
    // lane paint stays dry-bright (vertex color is the mask)
    const bright = a.r.add(a.g).add(a.b);
    const dash = smoothstep(0.25, 0.5, bright);
    mat.colorNode = hazed(a.rgb.mul(0.5));
    mat.opacityNode = float(1).sub(puddle.mul(0.8).mul(float(1).sub(dash)));
    mat.transparent = true;
    mats.push(mat);
    return mat;
  }

  /* ── assemble: set + mirror, camera + flight ── */
  const setGroup = gltf.scene;
  const mirrorGroup = new THREE.Group();
  mirrorGroup.scale.y = -1;

  let camera: THREE.PerspectiveCamera | null = null;
  const sourceMeshes: THREE.Mesh[] = [];
  setGroup.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh) sourceMeshes.push(o as THREE.Mesh);
    if ((o as THREE.PerspectiveCamera).isPerspectiveCamera)
      camera = o as THREE.PerspectiveCamera;
  });
  if (!camera) {
    renderer.dispose();
    return null;
  }
  const cam: THREE.PerspectiveCamera = camera;

  for (const mesh of sourceMeshes) {
    geos.push(mesh.geometry);
    const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const names = src.map((m) => m.name);
    for (const m of src) m.dispose();

    if (names[0] === 'street') {
      mesh.material = makeStreetMat();
      mesh.renderOrder = 10; // after the mirrored city and its walkers
      continue;
    }
    const rebuilt = names.map((n) => makeMat(n, false));
    mesh.material = rebuilt.length === 1 ? rebuilt[0] : rebuilt;

    // mirror only what the puddles can see: city mass + low neon
    if (mesh.name === 'City' || mesh.name === 'Neon') {
      const ghost = new THREE.Mesh(
        mesh.geometry,
        names.length === 1
          ? makeMat(names[0], true)
          : names.map((n) => makeMat(n, true)),
      );
      ghost.frustumCulled = false;
      mirrorGroup.add(ghost);
    }
  }
  scene.add(setGroup, mirrorGroup);

  /* the flight: Blender's 10 s camera clip, scrubbed by scroll */
  const mixer = new THREE.AnimationMixer(setGroup);
  const clip = gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.play();
  action.paused = true;
  let approach = 0;

  /* ── the sky: rain clouds lit from below by the city ── */
  const skyMat = new THREE.MeshBasicNodeMaterial();
  {
    const su = uv();
    const base = mix(
      vec3(0.025, 0.016, 0.05),
      vec3(0.004, 0.004, 0.012),
      smoothstep(0.42, 0.92, su.y),
    );
    const glow = exp(su.y.sub(0.4).abs().mul(-9.0));
    const cloud = mx_noise_float(
      vec3(su.x.mul(5.0).add(time.mul(0.012)), su.y.mul(7.0), 3.1),
    );
    const cloudLit = smoothstep(0.1, 0.8, cloud)
      .mul(smoothstep(0.85, 0.45, su.y))
      .mul(0.3);
    skyMat.colorNode = base
      .add(vec3(0.13, 0.06, 0.18).mul(glow))
      .add(vec3(0.08, 0.045, 0.11).mul(cloudLit));
  }
  mats.push(skyMat);
  const skyGeo = new THREE.PlaneGeometry(1, 1);
  geos.push(skyGeo);
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.position.set(0, 40, -SKY_DIST);
  scene.add(skyMesh);

  /* ── rain: instanced streaks, hashed on the GPU ── */
  const uRainCenter = uniform(new THREE.Vector3(0, 0, 0));
  {
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    const fi = float(instanceIndex);
    const h1 = hash(fi.add(1.0));
    const h2 = hash(fi.add(91.31));
    const h3 = hash(fi.add(313.7));
    const fall = mod(h2.mul(RAIN_H).sub(time.mul(mix(16.0, 26.0, h3))), RAIN_H);
    const off = vec3(
      h1.mul(RAIN_W).sub(RAIN_W / 2),
      fall,
      h3.mul(RAIN_D).sub(RAIN_D / 2),
    );
    mat.positionNode = positionLocal.add(uRainCenter).add(off);
    mat.colorNode = vec3(0.55, 0.7, 0.78);
    mat.opacityNode = float(0.16).mul(smoothstep(0.0, 3.0, fall));
    mats.push(mat);
    const rainGeo = new THREE.PlaneGeometry(0.025, 0.5);
    geos.push(rainGeo);
    const rain = new THREE.InstancedMesh(rainGeo, mat, RAIN_COUNT);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < RAIN_COUNT; i++) rain.setMatrixAt(i, m4);
    rain.instanceMatrix.needsUpdate = true;
    rain.frustumCulled = false;
    rain.renderOrder = 20;
    scene.add(rain);
  }

  /* ── his agents, walking the night shift ── */
  interface Agent {
    mesh: THREE.Mesh;
    mirror: THREE.Mesh;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    uFrame: any;
    x: number;
    z: number;
    speed: number;
    phase: number;
  }
  const agents: Agent[] = [];
  {
    const variants = [
      { color: '#2ee6d6', umbrella: true },
      { color: '#ff3d7e', umbrella: false },
      { color: '#ffe066', umbrella: true },
      { color: '#cfe8ea', umbrella: false },
    ];
    const textures = variants.map((v) => {
      const t = agentTexture(v.color, v.umbrella);
      texs.push(t);
      return t;
    });
    const agentGeo = new THREE.PlaneGeometry(1.0, 1.75);
    geos.push(agentGeo);
    const rng = mulberry32(77);
    for (let i = 0; i < 14; i++) {
      const tex = textures[i % variants.length];
      const uFrame = uniform(0);
      const frameUv = uv()
        .mul(vec2(0.5, 1))
        .add(vec2(uFrame.mul(0.5), 0));
      const make = (mirror: boolean) => {
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        const px = texture(tex, frameUv);
        mat.colorNode = mirror ? px.rgb.mul(0.4) : px.rgb;
        mat.opacityNode = px.a;
        if (mirror) mat.side = THREE.DoubleSide;
        mats.push(mat);
        return mat;
      };
      const mesh = new THREE.Mesh(agentGeo, make(false));
      const mirror = new THREE.Mesh(agentGeo, make(true));
      mirror.scale.y = -1;
      mesh.renderOrder = 15;
      mirror.renderOrder = 5; // beneath the street pass — puddles reveal it
      scene.add(mesh, mirror);
      agents.push({
        mesh,
        mirror,
        uFrame,
        x: (rng() > 0.5 ? 1 : -1) * (8.2 + rng() * 1.0),
        z: 38 - rng() * 180,
        speed: (rng() > 0.5 ? 1 : -1) * (1.1 + rng() * 1.4),
        phase: rng() * Math.PI * 2,
      });
    }
  }

  /* ── the pixelwork (mosaic + CRT + phosphor bloom) ── */
  const pixelwork = createPixelwork(renderer, scene, cam, { cell: 5 });

  function smoothstepJs(e0: number, e1: number, x: number): number {
    const u = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return u * u * (3 - 2 * u);
  }

  function applyApproach(t: number) {
    approach = Math.min(Math.max(t, 0), 1);
    action.time = approach * Math.max(clip.duration - 0.001, 0);
    mixer.update(0);
    pixelwork.uCollapse.value = smoothstepJs(0.86, 1, approach);
  }
  applyApproach(0);

  /* ── fit ── */
  function fit() {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const skyH =
      2 * (SKY_DIST + 80) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.25;
    skyMesh.scale.set(skyH * cam.aspect * 1.35, skyH, 1);
  }
  fit();
  window.addEventListener('resize', fit);

  /* ── pointer: head-turn parallax + the signal that sharpens the post ── */
  const pointer = new THREE.Vector2(0, 0);
  const pointerEased = new THREE.Vector2(0, 0);
  let lastMove = 0;

  function onPointerMove(e: PointerEvent) {
    const px = e.clientX / window.innerWidth;
    const py = e.clientY / window.innerHeight;
    pointer.set(px * 2 - 1, py * 2 - 1);
    // screenUV origin is TOP-left — no y flip
    (pixelwork.uPointerUv.value as THREE.Vector2).set(px, py);
    lastMove = performance.now();
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* ── loop ── */
  let last = performance.now();
  let firstFrame = true;
  const camWorld = new THREE.Vector3();

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    /* the signal: present while the hand moves, settling in stillness */
    const signalTarget = now - lastMove < 1400 ? 1 : 0;
    const s = pixelwork.uSignal.value as number;
    pixelwork.uSignal.value = s + (signalTarget - s) * (signalTarget > s ? 0.085 : 0.03);

    /* billboards flicker like real gas-discharge signs */
    for (const b of boards.values()) {
      if (b.drop > 0) {
        b.drop--;
        b.uFlick.value = 0.22 + Math.random() * 0.12;
      } else {
        if (Math.random() < 0.006) b.drop = 2 + Math.floor(Math.random() * 6);
        b.uFlick.value =
          0.92 +
          0.08 * Math.sin(now * 0.011 + b.phase) * Math.sin(now * 0.0043 + b.phase * 2.7);
      }
    }

    /* agents walk, stride, and wrap around the avenue */
    for (const a of agents) {
      a.z += a.speed * dt;
      if (a.z > 40) a.z = -150;
      if (a.z < -150) a.z = 40;
      a.uFrame.value = Math.floor(now * 0.004 + a.phase) % 2;
      const bob = Math.abs(Math.sin(now * 0.006 + a.phase)) * 0.04;
      a.mesh.position.set(a.x, 1.02 + bob, a.z);
      a.mesh.rotation.z = Math.sin(now * 0.0035 + a.phase) * 0.03;
      // the sidewalk (y 0.16) is the mirror plane
      a.mirror.position.set(a.x, 0.32 - (1.02 + bob), a.z);
    }

    /* the camera rides Blender's flight; the pointer leans it */
    pointerEased.lerp(pointer, 0.05);
    mixer.update(0); // reapply the clip pose, then lean off it
    cam.position.x += pointerEased.x * 0.45;
    cam.position.y += pointerEased.y * -0.18;
    cam.rotation.y -= pointerEased.x * 0.02;
    cam.rotation.x -= pointerEased.y * 0.012;

    /* rain volume follows the camera down the avenue */
    cam.getWorldPosition(camWorld);
    (uRainCenter.value as THREE.Vector3).set(
      camWorld.x,
      Math.min(Math.max(camWorld.y - 13, 0), 36),
      camWorld.z - 22,
    );

    pixelwork.render();

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
    setApproach(t: number) {
      applyApproach(t);
    },
    dispose() {
      io.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      mixer.stopAllAction();
      for (const t of texs) t.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      pixelwork.dispose();
      renderer.dispose();
    },
  };
}
