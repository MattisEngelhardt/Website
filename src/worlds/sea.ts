/**
 * World controller — Act I, The Sea.
 *
 * Owns the voyage: the WebGPU marine, the scroll timeline that sails
 * the ship and deepens the dusk, the log captions surfacing over the
 * painting, and the two-breath gold-out (sun bloom → the page of the
 * book). Returns one cleanup for die Passage.
 */
import type { Cleanup, WorldContext } from '../lib/passage';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

  let setVoyage: (t: number) => void = () => {};
  let scene: { dispose(): void } | null = null;

  const canvas = document.getElementById('sea-canvas');
  if (canvas instanceof HTMLCanvasElement) {
    const { mountSea } = await import('../scenes/sea');
    const handle = await mountSea(canvas);
    if (handle) {
      scene = handle;
      setVoyage = (t) => handle.setVoyage(t);
    }
  }

  const stage = gsap.context(() => {
    const track = document.getElementById('voyage-track');
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

      tl.to(progress, {
        t: 1,
        ease: 'none',
        duration: 1,
        onUpdate: () => setVoyage(progress.t),
      }, 0)
        .to('.frontispiece', { yPercent: -42, autoAlpha: 0, ease: 'power1.in', duration: 0.16 }, 0)
        .to('.descend', { autoAlpha: 0, duration: 0.08 }, 0);

      /* the log surfaces, line by line, as the ship crosses */
      const captions: Array<[string, number, number]> = [
        ['.c1', 0.16, 0.36],
        ['.c2', 0.42, 0.62],
        ['.c3', 0.66, 0.84],
      ];
      for (const [sel, on, off] of captions) {
        tl.fromTo(
          sel,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.07 },
          on,
        ).to(sel, { autoAlpha: 0, y: -18, ease: 'power1.in', duration: 0.06 }, off);
      }

      /* the gold-out: sun bloom, then the page of the book */
      tl.to('.gold-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.14 }, 0.82)
        .to('.page-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.08 }, 0.92);
    }

    /* the written log settles in as the reader reaches it */
    for (const el of document.querySelectorAll('#log .act > *, footer.act > *')) {
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
