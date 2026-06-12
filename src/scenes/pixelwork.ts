/**
 * The pixelwork — the city's own post pipeline. Where every other
 * world is brushwork (Kuwahara), Act II is broadcast: the frame is
 * rebuilt from coarse signal cells with a faint LED-matrix grid, CRT
 * row breathing and a whisper of chromatic fringe. The style break IS
 * the statement — the wanderer has crossed from the painting into
 * the machine.
 *
 * Signature interaction (the lens of reality, re-spoken in pixels):
 * where the pointer moves, the simulation renders finer — uSignal
 * opens a high-resolution window around uPointerUv; stillness lets
 * the mosaic settle back.
 *
 * uCollapse drives the exit set-piece: the cells grow huge, rows tear
 * sideways, the signal flares — and the act resolves onto paper.
 *
 * Phosphor bloom: the neon halos are sampled from the SHARP scene and
 * laid over the mosaic — exactly how a CRT bleeds light past its own
 * pixel grid.
 */
import * as THREE from 'three/webgpu';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  clamp,
  float,
  floor,
  fract,
  hash,
  length,
  mix,
  mod,
  pass,
  screenSize,
  screenUV,
  smoothstep,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

export interface PixelworkOptions {
  /** base cell size in device pixels */
  cell?: number;
}

export interface Pixelwork {
  /** pointer in screen UV — origin TOP-left (WebGPU convention, no y-flip) */
  uPointerUv: ReturnType<typeof uniform>;
  /** 0 = settled mosaic … 1 = sharp signal around the pointer */
  uSignal: ReturnType<typeof uniform>;
  /** 0 = broadcast … 1 = the signal collapses (exit set-piece) */
  uCollapse: ReturnType<typeof uniform>;
  render(): void;
  dispose(): void;
}

export function createPixelwork(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  { cell = 5 }: PixelworkOptions = {},
): Pixelwork {
  const uPointerUv = uniform(new THREE.Vector2(0.5, 0.5));
  const uSignal = uniform(0);
  const uCollapse = uniform(0);

  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const sceneTex = scenePass.getTextureNode();

  /* the hand sharpens the simulation around itself */
  const aspect = screenSize.x.div(screenSize.y);
  const d = length(screenUV.sub(uPointerUv).mul(vec2(aspect, 1)));
  const lens = smoothstep(0.4, 0.05, d).mul(uSignal);

  /* cell size: base mosaic, finer under the hand, huge at the collapse */
  const cellPx = clamp(
    float(cell).mul(mix(1.0, 0.24, lens)).add(uCollapse.mul(90.0)),
    1.0,
    128.0,
  );

  const grid = screenSize.div(cellPx);
  const cellId = floor(screenUV.mul(grid));

  /* rows tear sideways as the signal dies */
  const tear = hash(cellId.y.add(floor(time.mul(9.0)).mul(57.0)))
    .sub(0.5)
    .mul(uCollapse)
    .mul(0.22);
  const quv = cellId.add(0.5).div(grid).add(vec2(tear, 0));

  /* chromatic fringe — barely there until the collapse pulls it apart */
  const fringe = screenUV.x
    .sub(0.5)
    .mul(0.0015)
    .mul(float(1.0).add(uCollapse.mul(18.0)));
  const col = vec3(
    sceneTex.sample(quv.add(vec2(fringe, 0))).r,
    sceneTex.sample(quv).g,
    sceneTex.sample(quv.sub(vec2(fringe, 0))).b,
  );

  /* LED matrix: each cell dims at its borders (only while coarse —
     the sharpened window under the pointer must stay clean) */
  const local = fract(screenUV.mul(grid));
  const cellVig = smoothstep(0.0, 0.16, local.x)
    .mul(smoothstep(1.0, 0.84, local.x))
    .mul(smoothstep(0.0, 0.16, local.y))
    .mul(smoothstep(1.0, 0.84, local.y));
  const ledStrength = smoothstep(2.0, 5.0, cellPx).mul(0.3);
  const led = mix(float(1.0), cellVig, ledStrength);

  /* CRT breathing: alternate cell rows + a slow scan drifting down */
  const row = mix(float(1.0), float(0.94), mod(cellId.y, 2.0));
  const scan = float(1.0).sub(
    smoothstep(0.86, 1.0, fract(screenUV.y.mul(1.4).sub(time.mul(0.045)))).mul(
      0.05,
    ),
  );

  const vignette = float(1).sub(
    length(screenUV.sub(vec2(0.5))).pow(2.0).mul(0.34),
  );
  /* the signal flares once before it goes */
  const flare = float(1.0).add(uCollapse.mul(0.55));

  /* phosphor bleed: bloom of the sharp scene over the pixel grid */
  const glow = bloom(sceneTex, 0.75, 0.5, 0.55);

  pipeline.outputNode = vec4(
    col
      .mul(led)
      .mul(row)
      .mul(scan)
      .mul(vignette)
      .mul(flare)
      .add(glow.rgb.mul(0.85)),
    1,
  );

  return {
    uPointerUv,
    uSignal,
    uCollapse,
    render: () => pipeline.render(),
    dispose: () => pipeline.dispose(),
  };
}
