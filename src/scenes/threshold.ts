/**
 * The Threshold — Act 0 opens "through the frame".
 *
 * Crisis doctrine, decision #1: the journey begins at a museum wall
 * holding his favourite painting. Scroll pushes the camera *through*
 * the canvas — a gigapixel push into the brushwork of the sea of fog —
 * and dissolves into the living summit beyond. Not a slideshow: the
 * destination is the real WebGPU world behind this overlay.
 *
 * The deep-zoom is a CSS transform on a single decoded <img>. The
 * source truly is gigapixel (the 35 MP Kunsthalle-grade scan, shipped
 * as a 4400px webp), so the push stays crisp into the bristles, and the
 * browser composites it on the GPU — no per-frame canvas redraw.
 *
 * The DOM lives in index.astro (semantic figure + caption = SEO + the
 * catalogue's static plate); this module only measures it and drives
 * the push. One param, setProgress(p):
 *   p 0 .. PUSH_END  — walk up to the wall, then enter the canvas
 *   p PUSH_END .. 1  — the canvas dissolves, unveiling the live world
 */

/** the point in the painting we push through. Not the wanderer himself
 *  (pushing into his coat read as "into the bristles") but the luminous
 *  sea of fog to his left — the mist and the rock peaks emerging from
 *  it, which is the world the journey actually opens into. Normalised
 *  within the <img>. */
const FOCAL_X = 0.32;
const FOCAL_Y = 0.5;

/** scale, relative to the museum layout size, at the deepest push.
 *  Kept gentle — a soft drift into the mist, not a hard ram into the
 *  paint surface (Mattis, Krise #2: "sanfter, nicht in die Borsten"). */
const SMAX = 4.3;
/** scale the paint keeps drifting to THROUGH the dissolve, so the push
 *  never stalls — the brushwork keeps coming toward you as it gives way to
 *  the real 3-D depth underneath (the seamless "you stepped through"). */
const SMAX_THROUGH = 6.4;
/** progress at which the zoom is done and the dissolve begins. Pulled a
 *  touch earlier so the dissolve has a longer runway to cross-blend the
 *  brushwork into the hub's painterly fog (a soft handoff, not a cut). */
const PUSH_END = 0.74;

const smootherstep = (e: number): number => {
  const t = Math.min(1, Math.max(0, e));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface ThresholdHandle {
  /** 0 = museum view · PUSH_END = inside the canvas · 1 = unveiled */
  setProgress(p: number): void;
  /** resolves once the full-resolution texture has decoded */
  ready: Promise<void>;
  dispose(): void;
}

export function mountThreshold(section: HTMLElement): ThresholdHandle {
  const frame = section.querySelector<HTMLElement>('.artframe');
  const art = section.querySelector<HTMLImageElement>('.art');
  const mat = section.querySelector<HTMLElement>('.art-mat');
  const plate = section.querySelector<HTMLElement>('.plate');
  const cue = section.querySelector<HTMLElement>('.threshold-cue');

  // geometry, measured with the transform cleared (the museum layout)
  let foX = 0;
  let foY = 0;
  let dx = 0;
  let dy = 0;

  function measure(): void {
    if (!frame || !art) return;
    const prev = frame.style.transform;
    frame.style.transform = '';
    const af = frame.getBoundingClientRect();
    const ar = art.getBoundingClientRect();
    // the focal point, in viewport coordinates, at layout scale
    const fx = ar.left + FOCAL_X * ar.width;
    const fy = ar.top + FOCAL_Y * ar.height;
    // transform-origin (relative to the scaled .artframe box) = focal
    foX = fx - af.left;
    foY = fy - af.top;
    // translate that carries the focal point to the viewport centre
    dx = window.innerWidth / 2 - fx;
    dy = window.innerHeight / 2 - fy;
    frame.style.transformOrigin = `${foX}px ${foY}px`;
    frame.style.transform = prev;
  }

  // subtle museum parallax — the canvas breathes toward the cursor
  // while we stand before it; it decays to nothing as the push begins
  let px = 0;
  let py = 0;
  let parallax = 1;
  function onPointer(e: PointerEvent): void {
    px = (e.clientX / window.innerWidth - 0.5) * 2;
    py = (e.clientY / window.innerHeight - 0.5) * 2;
    if (mat) mat.style.transform = `translate3d(${px * 10 * parallax}px, ${py * 8 * parallax}px, 0) rotateX(${-py * 1.2 * parallax}deg) rotateY(${px * 1.6 * parallax}deg)`;
  }

  function setProgress(p: number): void {
    if (!frame) return;
    p = Math.min(1, Math.max(0, p));

    // ── the dissolve progress (PUSH_END .. 1): step through the canvas ──
    const through = smootherstep((p - PUSH_END) / (1 - PUSH_END));

    // ── the zoom (0 .. PUSH_END), continuing THROUGH the dissolve ──
    // the scale keeps climbing past SMAX during the dissolve (toward
    // SMAX_THROUGH) so the brushwork is still drifting toward the eye as it
    // melts into the hub's fog — the push never stalls, the worlds are one.
    const zoom = smootherstep(p / PUSH_END);
    const s = lerp(1, SMAX, zoom) + (SMAX_THROUGH - SMAX) * through;
    // ramp the focal-centring in over the first third so the museum
    // hang stays composed and centred at rest, then we lock onto the
    // sea-of-fog focal (left half) as we approach
    const k = smootherstep(Math.min(1, p / (PUSH_END * 0.42)));
    frame.style.transform = `translate3d(${dx * k}px, ${dy * k}px, 0) scale(${s})`;

    parallax = 1 - smootherstep(p / 0.12);

    // the museum chrome leaves first — we stop reading the label and
    // start seeing the paint
    if (plate) plate.style.opacity = String(1 - smootherstep(p / 0.16));
    if (cue) cue.style.opacity = String(1 - smootherstep(p / 0.1));
    // the gilt mat + warm gallery glow fade out before the paint dissolves,
    // so only the brushwork (not the museum frame) hands into the 3-D world
    if (mat) mat.style.opacity = String(1 - smootherstep(Math.max(0, (p - PUSH_END * 0.5)) / (PUSH_END * 0.5)));

    // ── the dissolve: the paint gives way to the real depth underneath ──
    section.style.opacity = String(1 - through);
    // a breath of defocus as the paint surface gives way to real depth — the
    // hub's own Kuwahara brushwork meets it on the other side, so the seam is
    // paint-into-paint, never a sharp photo edge.
    section.style.filter = through > 0 ? `blur(${through * 9}px)` : '';
    // once fully unveiled, drop out of the way (and out of hit-testing)
    section.style.visibility = through >= 1 ? 'hidden' : '';
  }

  // ── progressive texture: overview paints instantly, the deep scan
  //    decodes behind the loader and swaps in before the push ──
  const ready = (async () => {
    if (!art) return;
    const full = '/assets/paintings/wanderer_full.webp';
    try {
      const hi = new Image();
      hi.decoding = 'async';
      hi.src = full;
      await hi.decode();
      // same picture, just sharper — no crossfade needed
      art.src = full;
    } catch {
      /* keep the overview; still crisp enough for the museum view */
    }
  })();

  const onResize = () => measure();
  measure();
  setProgress(0);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });

  return {
    setProgress,
    ready,
    dispose() {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      if (frame) frame.style.transform = '';
      if (mat) {
        mat.style.transform = '';
        mat.style.opacity = '';
      }
      if (plate) plate.style.opacity = '';
      if (cue) cue.style.opacity = '';
      section.style.opacity = '';
      section.style.filter = '';
      section.style.visibility = '';
    },
  };
}
