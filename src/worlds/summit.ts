/**
 * World controller — Act 0, The Summit.
 *
 * Owns everything the route needs at runtime: the WebGPU fog scene,
 * the white-out descent timeline and the narrative reveals. Returns
 * one cleanup so die Passage can strike the set when the wanderer
 * moves on to another world.
 */
import type { Cleanup, WorldContext } from '../lib/passage';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

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

  const stage = gsap.context(() => {
    /* the descent: one long scroll sinks the summit into the white-out.
       The veil ends on canvas-paper, exactly the colour of #descent —
       the journey resolves onto the page of a book. */
    const track = document.getElementById('descent-track');
    if (track) {
      const progress = { t: 0 };
      gsap
        .timeline({
          scrollTrigger: {
            trigger: track,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.7,
          },
        })
        .to(progress, {
          t: 1,
          ease: 'none',
          duration: 1,
          onUpdate: () => setDescent(progress.t),
        }, 0)
        .to('.frontispiece', { yPercent: -46, autoAlpha: 0, ease: 'power1.in', duration: 0.55 }, 0)
        .to('.descend', { autoAlpha: 0, duration: 0.2 }, 0)
        .to('.fog-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.62 }, 0.38);
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
    scene?.dispose();
  };
}
