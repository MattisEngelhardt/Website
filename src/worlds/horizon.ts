/**
 * World controller — Act IV, The Horizon.
 *
 * Owns the finale: the WebGPU flight above the volumetric cloud sea at golden
 * hour, the scroll timeline that drifts the camera toward the setting sun, the
 * three closing captions, and the gold-out that opens the clouds and resolves
 * onto the contact page of the book. Returns one cleanup for die Passage.
 */
import type { Cleanup, WorldContext } from '../lib/passage';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const canvas = document.getElementById('horizon-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    const common = await import('./common');
    return common.mount(ctx);
  }

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

  let setHorizon: (t: number) => void = () => {};
  let scene: { dispose(): void } | null = null;

  const { mountHorizon } = await import('../scenes/horizon');
  const handle = await mountHorizon(canvas);
  if (handle) {
    scene = handle;
    setHorizon = (t) => handle.setHorizon(t);
  }

  const stage = gsap.context(() => {
    const track = document.getElementById('horizon-track');
    if (track) {
      const progress = { t: 0 };
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
        },
      });

      tl.to(
        progress,
        {
          t: 1,
          ease: 'none',
          duration: 1,
          onUpdate: () => setHorizon(progress.t),
        },
        0,
      )
        .to('.frontispiece', { yPercent: -40, autoAlpha: 0, ease: 'power1.in', duration: 0.16 }, 0)
        .to('.descend', { autoAlpha: 0, duration: 0.08 }, 0);

      /* closing captions — the last words of the wander, surfacing over the sea */
      const captions: Array<[string, number, number]> = [
        ['.c1', 0.16, 0.36],
        ['.c2', 0.42, 0.62],
        ['.c3', 0.66, 0.82],
      ];
      for (const [sel, on, off] of captions) {
        tl.fromTo(
          sel,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.07 },
          on,
        ).to(sel, { autoAlpha: 0, y: -18, ease: 'power1.in', duration: 0.06 }, off);
      }

      /* arrival: the clouds open into the warm gold-out, then the page */
      tl.to('.gold-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.14 }, 0.84)
        .to('.page-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.08 }, 0.93);
    }

    /* the contact chapter settles in as the reader reaches it */
    for (const el of document.querySelectorAll('#contact .act > *, section.act > *, footer.act > *')) {
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
    scene?.dispose();
  };
}
