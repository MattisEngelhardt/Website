/**
 * World controller — Act 0, The Threshold → the Main-Lobby (the hub).
 *
 * Owns the whole opening as one act:
 *   1. the Threshold — a push through his favourite painting (the museum
 *      frame recedes, the brushwork fills the frame, landing in the LEFT
 *      half: the luminous sea of fog and the blue ridges), which dissolves
 *      seamlessly into …
 *   2. the living Main-Lobby — you have stepped THROUGH the canvas and now
 *      stand inside the sea of fog: the foreground rock low, the luminous
 *      billowing bank, the distant Friedrich peaks, the gallery canvases
 *      hanging in the clear air. The composition CONTINUES the painting.
 *
 * The hub is a navigable gallery: pan with the mouse, hover a canvas to wipe
 * the brushwork clear + lift its placard, click to dolly through the frame
 * and hand off to real Astro navigation (die Passage takes the painted veil).
 *
 * (A5/A6 integration: replaces the old frontispiece + figure + descent summit
 * beat. The old src/scenes/summit.ts module is no longer mounted here.)
 *
 * Returns one cleanup so die Passage can strike the whole set.
 */
import type { Cleanup, WorldContext } from '../lib/passage';
import type { HubHandle, PlateScreen } from '../scenes/hub';

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  if (ctx.mode !== 'full') return () => {};

  const { initJourney, gsap } = await import('../lib/journey');
  initJourney();

  /* ── the living Main-Lobby behind the canvas ── */
  let hub: HubHandle | null = null;
  const canvas = document.getElementById('hub-canvas');
  const placards = document.getElementById('hub-placards');
  if (canvas instanceof HTMLCanvasElement) {
    const { mountHub } = await import('../scenes/hub');
    hub = await mountHub(canvas);
  }

  /* ── the gallery placards (mirror dev/hub.astro's wiring) ──
     one museum placard per plate, positioned per frame from the projected
     plate anchor; quiet at rest, lifting on hover. */
  const placardEls = new Map<string, HTMLElement>();
  if (hub && placards instanceof HTMLElement) {
    for (const p of hub.plates) {
      const el = document.createElement('a');
      el.className = 'placard';
      el.dataset.id = p.id;
      el.href = p.href; // real nav target → SEO + keyboard + middle-click
      el.setAttribute('aria-label', `${p.name} — ${p.line}`);
      el.innerHTML =
        `<span class="num">${p.numeral}</span>` +
        `<span class="name">${p.name}</span>` +
        `<span class="rule"></span>` +
        `<span class="line">${p.line}</span>`;
      placards.appendChild(el);
      placardEls.set(p.id, el);
    }
    hub.setOnUpdate((list: PlateScreen[]) => {
      for (const s of list) {
        const el = placardEls.get(s.id);
        if (!el) continue;
        if (!s.visible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        const sc = s.hovered ? Math.max(s.scale, 1.0) : s.scale;
        el.style.transform =
          `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) translate(-50%, 0) scale(${sc.toFixed(3)})`;
        el.classList.toggle('is-hovered', s.hovered);
        el.style.pointerEvents = 'auto';
        if (!s.hovered) {
          el.style.opacity = String(Math.min(0.55, 0.3 + s.scale * 0.22).toFixed(2));
        } else {
          el.style.opacity = '1';
        }
      }
    });
  }

  /* ── click a canvas → dolly through the frame → hand to die Passage ──
     The dolly fills the viewport, then a programmatic click on the placard's
     real <a href> lets passage.ts take the painted veil into the target world. */
  let entering = false;
  async function enter(id: string): Promise<void> {
    if (!hub || entering) return;
    entering = true;
    await hub.focus(id);
    const href = hub.plates.find((p) => p.id === id)?.href;
    const el = href ? placardEls.get(id) : null;
    if (el) {
      el.click(); // real navigation → die Passage closes the veil in the target palette
    } else if (href) {
      location.href = href;
    }
  }
  function onCanvasClick(): void {
    const id = hub?.hoveredId();
    if (id) void enter(id);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      hub?.unfocus();
      entering = false;
    }
  }
  // clicking a placard directly should also dolly through first (preventDefault
  // the bare link, run the cinematic, then navigate) — unless reduced data wants
  // the plain link. We keep the link as the fallback / SEO anchor.
  function onPlacardClick(e: MouseEvent): void {
    const a = (e.target as HTMLElement)?.closest('.placard') as HTMLElement | null;
    if (!a || !hub) return;
    const id = a.dataset.id;
    if (!id || entering) return;
    e.preventDefault();
    void enter(id);
  }
  if (canvas instanceof HTMLCanvasElement) {
    canvas.addEventListener('click', onCanvasClick);
  }
  if (placards instanceof HTMLElement) {
    placards.addEventListener('click', onPlacardClick);
  }
  window.addEventListener('keydown', onKeydown);

  /* ── the threshold overlay (his painting, framed) → dissolves into the hub ── */
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
    const track = document.getElementById('threshold-track');
    if (track) {
      // the lobby chrome (the quiet "drag the gaze" affordance) arrives only
      // once we have stepped through the canvas.
      gsap.set('.hub-cue', { autoAlpha: 0 });

      const push = { p: 0 };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
        },
      });

      // through the frame: the push + dissolve, packed into the scroll runway.
      // At p=1 the painting has fully dissolved into the live hub underneath.
      tl.to(push, {
        p: 1,
        ease: 'none',
        duration: 1,
        onUpdate: () => setThreshold(push.p),
      }, 0);

      // the lobby affordance fades in as the canvas dissolves away
      tl.fromTo('.hub-cue',
        { autoAlpha: 0, yPercent: 8 },
        { autoAlpha: 1, yPercent: 0, ease: 'power2.out', duration: 0.18 }, 0.7);
    }

    /* the bio paper below settles into place as the page is read */
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
    if (canvas instanceof HTMLCanvasElement) canvas.removeEventListener('click', onCanvasClick);
    if (placards instanceof HTMLElement) placards.removeEventListener('click', onPlacardClick);
    window.removeEventListener('keydown', onKeydown);
    for (const el of placardEls.values()) el.remove();
    placardEls.clear();
    threshold?.dispose();
    hub?.dispose();
  };
}
