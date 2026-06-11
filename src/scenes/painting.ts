/**
 * The painting — the shared post pipeline that turns every world into
 * brushwork. A Kuwahara filter rebuilds the frame from stroke sectors,
 * paper grain gives it tooth, a soft vignette frames the plate.
 *
 * Optionally carries the reality lens (Act 0's signature interaction):
 * uReality opens a sharp window around uPointerUv; stillness lets the
 * paint settle back over the world. Worlds without the lens get the
 * pure painting — their interaction is their own.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  float,
  length,
  mix,
  mx_noise_float,
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

export interface PaintingOptions {
  /** brush size in texels — taps grow quadratically, keep ≤ 4 */
  radius?: number;
  /** enable the reality lens (summit only) */
  lens?: boolean;
}

export interface Painting {
  /** pointer in screen UV — origin TOP-left (WebGPU convention, no y-flip) */
  uPointerUv: ReturnType<typeof uniform>;
  /** 0 = pure painting … 1 = sharp reality around the pointer */
  uReality: ReturnType<typeof uniform>;
  render(): void;
  dispose(): void;
}

export function createPainting(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  { radius = 4, lens = false }: PaintingOptions = {},
): Painting {
  const uPointerUv = uniform(new THREE.Vector2(0.5, 0.5));
  const uReality = uniform(0);

  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const sceneTex = scenePass.getTextureNode();

  const painted = Fn(() => {
    const texel = vec2(1).div(screenSize);
    const n = float((radius + 1) * (radius + 1));

    const m0 = vec3(0).toVar();
    const m1 = vec3(0).toVar();
    const m2 = vec3(0).toVar();
    const m3 = vec3(0).toVar();
    const s0 = vec3(0).toVar();
    const s1 = vec3(0).toVar();
    const s2 = vec3(0).toVar();
    const s3 = vec3(0).toVar();

    Loop({ start: 0, end: radius, condition: '<=', type: 'float' }, ({ i }) => {
      Loop({ start: 0, end: radius, condition: '<=', type: 'float' }, ({ i: j }) => {
        const off = vec2(i, j).mul(texel);
        const cA = sceneTex.sample(screenUV.add(off.mul(vec2(-1, -1)))).rgb.toVar();
        const cB = sceneTex.sample(screenUV.add(off.mul(vec2(1, -1)))).rgb.toVar();
        const cC = sceneTex.sample(screenUV.add(off.mul(vec2(-1, 1)))).rgb.toVar();
        const cD = sceneTex.sample(screenUV.add(off.mul(vec2(1, 1)))).rgb.toVar();
        m0.addAssign(cA);
        s0.addAssign(cA.mul(cA));
        m1.addAssign(cB);
        s1.addAssign(cB.mul(cB));
        m2.addAssign(cC);
        s2.addAssign(cC.mul(cC));
        m3.addAssign(cD);
        s3.addAssign(cD.mul(cD));
      });
    });

    const result = vec3(0).toVar();
    const minVar = float(100).toVar();
    const pick = (m: typeof m0, s: typeof s0) => {
      const mean = m.div(n);
      const variance = s.div(n).sub(mean.mul(mean));
      const metric = variance.x.add(variance.y).add(variance.z);
      If(metric.lessThan(minVar), () => {
        minVar.assign(metric);
        result.assign(mean);
      });
    };
    pick(m0, s0);
    pick(m1, s1);
    pick(m2, s2);
    pick(m3, s3);
    return result;
  })();

  // the lens of reality follows the pointer; without it the paint never lifts
  const aspect = screenSize.x.div(screenSize.y);
  const lensDist = length(screenUV.sub(uPointerUv).mul(vec2(aspect, 1)));
  const lensMask = smoothstep(0.45, 0.05, lensDist);
  const reality = lens ? uReality.mul(lensMask.mul(0.88).add(0.12)) : float(0);

  // paper tooth lives only in the painting, never in reality
  const grain = mx_noise_float(
    vec3(screenUV.mul(screenSize).mul(0.5), time.mul(0.35)),
  )
    .mul(0.045)
    .mul(reality.oneMinus());

  const paintedWarm = painted.mul(vec3(1.015, 1.0, 0.975)).add(grain);
  const blended = lens ? mix(paintedWarm, sceneTex.rgb, reality) : paintedWarm;
  const vignette = float(1).sub(
    length(screenUV.sub(vec2(0.5))).pow(2).mul(0.32),
  );

  const debugLens =
    lens && new URLSearchParams(window.location.search).has('lens');
  pipeline.outputNode = debugLens
    ? vec4(vec3(lensMask), 1)
    : vec4(blended.mul(vignette), 1);

  return {
    uPointerUv,
    uReality,
    render: () => pipeline.render(),
    dispose: () => pipeline.dispose(),
  };
}
