/**
 * Act 0 — The Summit.
 *
 * A living sea of fog under an Aivazovsky sky, synchronised with the
 * visitor's local time. The mouse is wind: it steers the drift of the
 * fog and leans the camera like a head turning into the breeze.
 *
 * Built on WebGPURenderer + TSL — one shader codebase, runs on WebGPU
 * and falls back to WebGL2 automatically.
 *
 * First pass (Day 1). Still to come in Days 2–3: the painterly↔real
 * Kuwahara morph, the wanderer figure, the white-out descent.
 */
import * as THREE from 'three/webgpu';
import {
  clamp,
  exp,
  length,
  mix,
  mx_noise_float,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';

/* ── Time-of-day palettes (the quintet, bent through the hours) ──── */

interface SkyPalette {
  zenith: number;
  mid: number;
  horizon: number;
  sunCore: number;
  sunHalo: number;
  fogFar: number;
  fogNear: number;
  sunY: number;
  sunIntensity: number;
}

const NIGHT: SkyPalette = {
  zenith: 0x0b0e1d, mid: 0x141a30, horizon: 0x2a3552,
  sunCore: 0xcfd8ea, sunHalo: 0x5a6c96,
  fogFar: 0x232c44, fogNear: 0x11141f,
  sunY: 0.74, sunIntensity: 0.35,
};
const DAWN: SkyPalette = {
  zenith: 0x353c5e, mid: 0x8a6d85, horizon: 0xe89a5d,
  sunCore: 0xffd98a, sunHalo: 0xe8833a,
  fogFar: 0x9aa7c4, fogNear: 0x4a4a63,
  sunY: 0.16, sunIntensity: 0.85,
};
const DAY: SkyPalette = {
  zenith: 0x7fa8d4, mid: 0xa9c7e4, horizon: 0xe9ddc6,
  sunCore: 0xfff3cf, sunHalo: 0xffe9a8,
  fogFar: 0xc9d4e4, fogNear: 0xece5d4,
  sunY: 0.72, sunIntensity: 0.5,
};
const GOLDEN: SkyPalette = {
  zenith: 0x4a5a86, mid: 0xc97f4e, horizon: 0xffb45e,
  sunCore: 0xffe9b0, sunHalo: 0xff9e4a,
  fogFar: 0xd9a87c, fogNear: 0x8a7488,
  sunY: 0.2, sunIntensity: 1.0,
};
const DUSK: SkyPalette = {
  zenith: 0x232a4a, mid: 0x5d4a6e, horizon: 0xb85a3e,
  sunCore: 0xffc95c, sunHalo: 0xc9452a,
  fogFar: 0x6e6286, fogNear: 0x2e2c44,
  sunY: 0.09, sunIntensity: 0.9,
};

/** keyframes over a 24h day; linearly blended between neighbours */
const DAY_CYCLE: Array<[hour: number, palette: SkyPalette]> = [
  [0, NIGHT],
  [4.5, NIGHT],
  [6.5, DAWN],
  [9.5, DAY],
  [16.5, DAY],
  [18.5, GOLDEN],
  [20.5, DUSK],
  [22.5, NIGHT],
  [24, NIGHT],
];

function lerpPalette(hour: number): SkyPalette {
  let a = DAY_CYCLE[0]!;
  let b = DAY_CYCLE[DAY_CYCLE.length - 1]!;
  for (let i = 0; i < DAY_CYCLE.length - 1; i++) {
    if (hour >= DAY_CYCLE[i]![0] && hour <= DAY_CYCLE[i + 1]![0]) {
      a = DAY_CYCLE[i]!;
      b = DAY_CYCLE[i + 1]!;
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const t = (hour - a[0]) / span;
  const mixHex = (x: number, y: number) =>
    new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    zenith: mixHex(a[1].zenith, b[1].zenith).getHex(),
    mid: mixHex(a[1].mid, b[1].mid).getHex(),
    horizon: mixHex(a[1].horizon, b[1].horizon).getHex(),
    sunCore: mixHex(a[1].sunCore, b[1].sunCore).getHex(),
    sunHalo: mixHex(a[1].sunHalo, b[1].sunHalo).getHex(),
    fogFar: mixHex(a[1].fogFar, b[1].fogFar).getHex(),
    fogNear: mixHex(a[1].fogNear, b[1].fogNear).getHex(),
    sunY: a[1].sunY + (b[1].sunY - a[1].sunY) * t,
    sunIntensity:
      a[1].sunIntensity + (b[1].sunIntensity - a[1].sunIntensity) * t,
  };
}

/* ── TSL helpers ─────────────────────────────────────────────────── */

/** 4-octave fbm over mx_noise, remapped to ~0..1 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fbm(p: any): any {
  return mx_noise_float(p)
    .add(mx_noise_float(p.mul(2.06)).mul(0.5))
    .add(mx_noise_float(p.mul(4.17)).mul(0.25))
    .add(mx_noise_float(p.mul(8.39)).mul(0.125))
    .mul(0.2667)
    .add(0.5);
}

/* ── Scene ───────────────────────────────────────────────────────── */

const FOG_LAYERS = 7;
const SKY_DIST = 70;
const CAM_FOV = 55;

export interface SummitHandle {
  dispose(): void;
}

export async function mountSummit(
  canvas: HTMLCanvasElement,
): Promise<SummitHandle | null> {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
  });

  try {
    await renderer.init();
  } catch {
    // no usable GPU after all — the painted CSS sky stays
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CAM_FOV,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    120,
  );
  camera.position.set(0, 0, 10);

  /* shared uniforms (palette is written into these on the CPU) */
  const uZenith = uniform(new THREE.Color());
  const uMid = uniform(new THREE.Color());
  const uHorizon = uniform(new THREE.Color());
  const uSunCore = uniform(new THREE.Color());
  const uSunHalo = uniform(new THREE.Color());
  const uSunPos = uniform(new THREE.Vector2(0.62, 0.2));
  const uSunIntensity = uniform(0.9);
  const uSkyAspect = uniform(1.8);
  const uWind = uniform(new THREE.Vector2(0, 0));

  /* ── the sky ── */
  const skyMat = new THREE.MeshBasicNodeMaterial();
  {
    const u = uv();
    const lower = mix(uHorizon, uMid, smoothstep(0.0, 0.5, u.y));
    const sky = mix(lower, uZenith, smoothstep(0.42, 1.0, u.y));
    const d = length(u.sub(uSunPos).mul(vec2(uSkyAspect, 1)));
    const core = exp(d.mul(-26.0)).mul(uSunIntensity);
    const halo = exp(d.mul(-5.5)).mul(uSunIntensity).mul(0.55);
    // slow painterly drift; also breaks gradient banding
    const grain = mx_noise_float(vec3(u.mul(3.0), time.mul(0.02))).mul(0.015);
    skyMat.colorNode = sky
      .add(uSunCore.mul(core))
      .add(uSunHalo.mul(halo))
      .add(grain);
  }
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyMat);
  skyMesh.position.z = -SKY_DIST;
  scene.add(skyMesh);

  /* ── the sea of fog ── */
  interface FogLayer {
    mesh: THREE.Mesh;
    color: ReturnType<typeof uniform>;
    depth: number; // 0 far … 1 near
  }
  const fogLayers: FogLayer[] = [];

  for (let i = 0; i < FOG_LAYERS; i++) {
    const depth = i / (FOG_LAYERS - 1); // 0 = farthest
    const z = -48 + depth * 42; // -48 … -6
    const seed = 17.31 * (i + 1);
    const speed = 0.004 + depth * 0.012; // near fog drifts faster
    const drift = 0.35 + depth * 0.85; // wind grip per layer
    const baseOpacity = 0.42 + depth * 0.4;

    const uLayerColor = uniform(new THREE.Color());
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;

    {
      const u = uv();
      const p = u
        .mul(vec2(2.6, 1.35))
        .add(uWind.mul(drift))
        .add(vec2(time.mul(speed), 0));
      const body = smoothstep(0.34, 0.78, fbm(vec3(p, seed)));
      const topFade = smoothstep(0.95, 0.5, u.y);
      const floor = smoothstep(0.42, 0.04, u.y); // dense fog floor
      const edge = smoothstep(0.0, 0.05, u.x).mul(
        smoothstep(1.0, 0.95, u.x),
      );
      mat.colorNode = uLayerColor;
      mat.opacityNode = clamp(
        body.mul(topFade).add(floor.mul(0.85)).mul(edge).mul(baseOpacity),
        0,
        1,
      );
    }

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.z = z;
    mesh.renderOrder = i;
    scene.add(mesh);
    fogLayers.push({ mesh, color: uLayerColor, depth });
  }

  /* ── palette → uniforms, synced with the visitor's clock ── */
  function applyPalette() {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('hour');
    const now = new Date();
    const hour = override
      ? parseFloat(override)
      : now.getHours() + now.getMinutes() / 60;

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
    for (const layer of fogLayers) {
      (layer.color.value as THREE.Color).copy(
        far.clone().lerp(near, layer.depth),
      );
    }
  }
  applyPalette();
  const paletteTimer = window.setInterval(applyPalette, 60_000);

  /* ── fit planes to the camera frustum ── */
  function fit() {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const frustumHeightAt = (dist: number) =>
      2 * dist * Math.tan(THREE.MathUtils.degToRad(CAM_FOV / 2));

    const skyH = frustumHeightAt(SKY_DIST + 10) * 1.25;
    const skyW = skyH * camera.aspect * 1.25;
    skyMesh.scale.set(skyW, skyH, 1);
    uSkyAspect.value = skyW / skyH;

    for (const layer of fogLayers) {
      const dist = camera.position.z - layer.mesh.position.z;
      const fh = frustumHeightAt(dist);
      const fw = fh * camera.aspect;
      layer.mesh.scale.set(fw * 1.8, fh * 0.85, 1);
      // far layers sit higher (the sea recedes), near layers swallow the base
      layer.mesh.position.y = -fh * (0.22 + layer.depth * 0.16);
    }
  }
  fit();
  window.addEventListener('resize', fit);

  /* ── mouse is wind ── */
  const pointer = new THREE.Vector2(0, 0);
  const windVel = new THREE.Vector2(0.006, 0); // a baseline breeze
  function onPointerMove(e: PointerEvent) {
    pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1,
    );
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* ── loop ── */
  let last = performance.now();
  let firstFrame = true;

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // wind chases the pointer, fog accumulates the drift
    windVel.x += (0.006 + pointer.x * 0.045 - windVel.x) * 0.02;
    windVel.y += (pointer.y * -0.012 - windVel.y) * 0.02;
    const wind = uWind.value as THREE.Vector2;
    wind.x += windVel.x * dt;
    wind.y += windVel.y * dt;

    // the head turns into the breeze
    camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.03;
    camera.position.y += (pointer.y * -0.35 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, -SKY_DIST);

    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      canvas.closest('[data-scene]')?.classList.add('is-live');
    }
  }
  renderer.setAnimationLoop(loop);

  /* pause rendering while the hero is off-screen */
  const io = new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry?.isIntersecting ? loop : null);
    if (entry?.isIntersecting) last = performance.now();
  });
  io.observe(canvas);

  return {
    dispose() {
      io.disconnect();
      window.clearInterval(paletteTimer);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
  };
}
