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

      /* no flavor captions over the flight — the only overlay is the live
         waymark naming the town underneath (updateWaymark, honest route data).
         The kitschy inscriptions were purged (Krise #2, §8): this is a clean
         cinematic bird's-eye pass, not a HUD. */

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
