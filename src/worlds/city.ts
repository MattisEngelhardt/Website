/**
 * World controller — Act II, The City of Agents.
 *
 * Owns the approach: the WebGPU pixel night, the scroll timeline that
 * dives the camera from the rooftops to street level, the terminal
 * captions, and the two-breath signal collapse (glitch-out → the page
 * of the book). The record pages (/city/<project>) carry no scene —
 * they fall through to the shared reveal controller.
 */
import type { Cleanup, WorldContext } from '../lib/passage';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const canvas = document.getElementById('city-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    // a city record (case study) — the shared reveals carry it
    const common = await import('./common');
    return common.mount(ctx);
  }

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

  let setApproach: (t: number) => void = () => {};
  let scene: { dispose(): void } | null = null;

  const { mountCity } = await import('../scenes/city');
  const handle = await mountCity(canvas);
  if (handle) {
    scene = handle;
    setApproach = (t) => handle.setApproach(t);
  }

  const stage = gsap.context(() => {
    const track = document.getElementById('approach-track');
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
        onUpdate: () => setApproach(progress.t),
      }, 0)
        .to('.frontispiece', { yPercent: -40, autoAlpha: 0, ease: 'power1.in', duration: 0.14 }, 0)
        .to('.descend', { autoAlpha: 0, duration: 0.08 }, 0);

      /* terminal lines surface as the camera dives */
      const captions: Array<[string, number, number]> = [
        ['.c1', 0.16, 0.34],
        ['.c2', 0.4, 0.58],
        ['.c3', 0.62, 0.78],
      ];
      for (const [sel, on, off] of captions) {
        tl.fromTo(
          sel,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.07 },
          on,
        ).to(sel, { autoAlpha: 0, y: -18, ease: 'power1.in', duration: 0.06 }, off);
      }

      /* the signal collapse: glitch-out, then the page of the book */
      tl.to('.glitch-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.1 }, 0.86)
        .to('.page-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.07 }, 0.93);
    }

    /* the records settle in as the reader reaches them */
    for (const el of document.querySelectorAll('#records .act > *, section.act > *, footer.act > *')) {
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
