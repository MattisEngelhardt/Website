/**
 * Default world controller — the narrative reveals every text-first
 * world shares until its own scene lands. Keeps the journey spine
 * (Lenis) alive so all worlds scroll with the same walking gait.
 */
import type { Cleanup, WorldContext } from '../lib/passage';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

  const stage = gsap.context(() => {
    for (const el of document.querySelectorAll('main .act > *')) {
      gsap.from(el, {
        y: 28,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    }
  });

  return () => stage.revert();
}
