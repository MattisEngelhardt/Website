/**
 * World controller — Act 0, The Summit.
 *
 * Owns the whole opening as one scroll-bound act:
 *   1. the Threshold — a push through his favourite painting (the
 *      museum frame recedes, the brushwork fills the frame), which
 *      dissolves into …
 *   2. the living summit — name and tagline arrive on the WebGPU sea
 *      of fog, an establishing beat, then …
 *   3. the descent — the white-out sinks the page onto the paper of
 *      the book (#descent), the threshold into Act I.
 *
 * Returns one cleanup so die Passage can strike the whole set.
 */
import type { Cleanup, WorldContext } from '../lib/passage';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

  /* ── the living summit behind the canvas ── */
  let setDescent: (t: number) => void = () => {};
  let scene: { dispose(): void } | null = null;
  const canvas = document.getElementById('summit-canvas');
  if (canvas instanceof HTMLCanvasElement) {
    const { mountSummit } = await import('../scenes/summit');
    const handle = await mountSummit(canvas);
    if (handle) {
      scene = handle;
      setDescent = (t) => handle.setDescent(t);
    }
  }

  /* ── the threshold overlay (his painting, framed) ── */
  let setThreshold: (p: number) => void = () => {};
  let threshold: { dispose(): void } | null = null;
  const frame = document.getElementById('threshold');
  if (frame instanceof HTMLElement) {
    const { mountThreshold } = await import('../scenes/threshold');
    const handle = mountThreshold(frame);
    threshold = handle;
    setThreshold = (p) => handle.setProgress(p);
  }

  const stage = gsap.context(() => {
    const track = document.getElementById('descent-track');
    if (track) {
      // the name and the descend-cue arrive only once we step through
      gsap.set(['.frontispiece', '.descend'], { autoAlpha: 0 });

      const push = { p: 0 };
      const sink = { t: 0 };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
        },
      });

      // 1 — through the frame (push + dissolve packed into the first half)
      tl.to(push, {
        p: 1,
        ease: 'none',
        duration: 0.5,
        onUpdate: () => setThreshold(push.p),
      }, 0);

      // 2 — the world arrives as the canvas dissolves away
      tl.fromTo('.frontispiece',
        { autoAlpha: 0, yPercent: 8 },
        { autoAlpha: 1, yPercent: 0, ease: 'power2.out', duration: 0.12 }, 0.40);
      tl.fromTo('.descend',
        { autoAlpha: 0 },
        { autoAlpha: 1, ease: 'power1.out', duration: 0.1 }, 0.44);

      // 3 — the descent: the sea rises into the white-out → paper
      tl.to(sink, {
        t: 1,
        ease: 'none',
        duration: 0.4,
        onUpdate: () => setDescent(sink.t),
      }, 0.6);
      tl.to('.frontispiece', { yPercent: -46, autoAlpha: 0, ease: 'power1.in', duration: 0.18 }, 0.6);
      tl.to('.descend', { autoAlpha: 0, duration: 0.06 }, 0.6);
      tl.to('.fog-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.22 }, 0.78);
    }

    /* narrative beats settle into place as the walk reaches them */
    for (const el of document.querySelectorAll('#descent .act > *, .worlds > *')) {
      gsap.from(el, {
        y: 28,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    }
  });

  return () => {
    stage.revert();
    threshold?.dispose();
    scene?.dispose();
  };
}
