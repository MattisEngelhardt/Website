/**
 * World controller — Act III, The Way.
 *
 * Owns the flyover: the WebGPU satellite flight over the Camino Portugués
 * (real Copernicus terrain + Sentinel-2 drape), the scroll timeline that
 * travels Porto → Santiago, the live waymark that names the town currently
 * underneath, and the gold-out that resolves onto the page of the book.
 * Returns one cleanup for die Passage.
 */
import type { Cleanup, WorldContext } from '../lib/passage';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const canvas = document.getElementById('camino-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    const common = await import('./common');
    return common.mount(ctx);
  }

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

  let setFlyover: (t: number) => void = () => {};
  let scene: { dispose(): void } | null = null;
  let stations: { name: string }[] = [];

  const { mountCamino } = await import('../scenes/camino');
  const handle = await mountCamino(canvas);
  if (handle) {
    scene = handle;
    stations = handle.stations;
    setFlyover = (t) => handle.setFlyover(t);
  }

  const waymark = document.querySelector<HTMLElement>('.waymark');
  let lastIdx = -1;
  function updateWaymark(t: number) {
    if (!waymark || !stations.length) return;
    // visible across the flight, fading at the very start and the gold-out
    const vis = t > 0.04 && t < 0.84 ? 1 : 0;
    waymark.style.opacity = String(vis);
    const idx = Math.min(stations.length - 1, Math.max(0, Math.round(t * (stations.length - 1))));
    if (idx !== lastIdx) {
      lastIdx = idx;
      waymark.textContent = stations[idx]?.name ?? '';
    }
  }

  const stage = gsap.context(() => {
    const track = document.getElementById('flyover-track');
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
        onUpdate: () => {
          setFlyover(progress.t);
          updateWaymark(progress.t);
        },
      }, 0)
        .to('.frontispiece', { yPercent: -42, autoAlpha: 0, ease: 'power1.in', duration: 0.16 }, 0)
        .to('.descend', { autoAlpha: 0, duration: 0.08 }, 0);

      /* waymark captions — the meaning of the way, surfacing as he walks it */
      const captions: Array<[string, number, number]> = [
        ['.c1', 0.14, 0.32],
        ['.c2', 0.4, 0.58],
        ['.c3', 0.64, 0.8],
      ];
      for (const [sel, on, off] of captions) {
        tl.fromTo(
          sel,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.07 },
          on,
        ).to(sel, { autoAlpha: 0, y: -18, ease: 'power1.in', duration: 0.06 }, off);
      }

      /* arrival: the warm gold-out, then the page of the book */
      tl.to('.gold-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.14 }, 0.84)
        .to('.page-veil', { opacity: 1, ease: 'power1.inOut', duration: 0.08 }, 0.93);
    }

    /* the written chapter settles in as the reader reaches it */
    for (const el of document.querySelectorAll('#way .act > *, section.act > *, footer.act > *')) {
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
