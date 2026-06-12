/**
 * Die Passage — the world-transition framework.
 *
 * One module owns the whole client lifecycle of the journey:
 *
 *  - runs the experience gate once and keeps <html data-mode> and
 *    <html data-daypart> alive across swaps (the router rebuilds the
 *    root element's attributes from each incoming document)
 *  - mounts/unmounts the world controller for the current route —
 *    scenes, scroll timelines, reveals all return one cleanup
 *  - choreographs the painted veil between worlds: brush strokes in
 *    the destination's palette close over the old act, the swap
 *    happens behind cover (the chapter plate names the next act),
 *    then the strokes sweep on and unveil the new world. The covered
 *    moment doubles as honest loading time for scene init.
 *
 * Script lifecycle note: with ClientRouter, module scripts run ONCE
 * per session — everything per-page must hang off `astro:` events.
 * The veil element itself survives swaps via transition:persist.
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { experienceMode, applyModeClass, type ExperienceMode } from './quality';
import { applyDaypart } from './daypart';

export type Cleanup = () => void;

export interface WorldContext {
  mode: ExperienceMode;
}

export interface WorldModule {
  /** set the stage for this world; returns the strike-the-set cleanup */
  mount(ctx: WorldContext): Promise<Cleanup> | Cleanup;
}

type WorldName = 'summit' | 'sea' | 'city' | 'camino' | 'horizon';

const WORLDS: Record<WorldName, { act: string; name: string; index: number }> = {
  summit: { act: 'Act 0', name: 'The Summit', index: 0 },
  sea: { act: 'Act I', name: 'The Sea', index: 1 },
  city: { act: 'Act II', name: 'The City of Agents', index: 2 },
  camino: { act: 'Act III', name: 'The Way', index: 3 },
  horizon: { act: 'Act IV', name: 'The Horizon', index: 4 },
};

/** worlds with their own controller; everything else gets the shared one */
const CONTROLLERS: Partial<Record<WorldName, () => Promise<WorldModule>>> = {
  summit: () => import('../worlds/summit'),
  sea: () => import('../worlds/sea'),
  city: () => import('../worlds/city'),
};
const defaultController = (): Promise<WorldModule> => import('../worlds/common');

function worldFromPath(pathname: string): WorldName {
  if (pathname.startsWith('/sea')) return 'sea';
  if (pathname.startsWith('/city')) return 'city';
  if (pathname.startsWith('/camino')) return 'camino';
  if (pathname.startsWith('/horizon')) return 'horizon';
  return 'summit';
}

/* ── world mounting ─────────────────────────────────────────────── */

let mode: ExperienceMode = 'catalog';
let current: Promise<Cleanup | null> | null = null;

function mountCurrent(): Promise<Cleanup | null> {
  if (!current) {
    current = (async () => {
      const load = CONTROLLERS[worldFromPath(location.pathname)] ?? defaultController;
      try {
        const mod = await load();
        return await mod.mount({ mode });
      } catch (err) {
        console.error('[passage] world mount failed:', err);
        return null;
      }
    })();
  }
  return current;
}

function unmountCurrent(): void {
  const pending = current;
  current = null;
  // a fast double-navigation may still be mounting — let it finish, then strike
  void pending?.then((cleanup) => cleanup?.());
}

/* ── the veil ───────────────────────────────────────────────────── */

const veil = () => document.getElementById('passage');

/** resolves when the named stroke's transform transition settles (or times out) */
function strokeSettled(el: HTMLElement, stroke: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, timeoutMs);
    function done() {
      window.clearTimeout(timer);
      el.removeEventListener('transitionend', onEnd);
      resolve();
    }
    function onEnd(e: TransitionEvent) {
      if (
        e.propertyName === 'transform' &&
        e.target instanceof HTMLElement &&
        e.target.classList.contains(stroke)
      ) {
        done();
      }
    }
    el.addEventListener('transitionend', onEnd);
  });
}

let covered: Promise<void> | null = null;

function closeVeil(to: WorldName, from: WorldName): Promise<void> {
  const el = veil();
  if (!el) return Promise.resolve();
  if (covered) return covered; // already closing for a previous click — stay covered

  el.dataset.to = to;
  el.dataset.dir = WORLDS[to].index < WORLDS[from].index ? 'back' : 'forward';
  // moving within one world (city → record page): quick wipe, no chapter plate
  el.dataset.same = String(to === from);
  const act = el.querySelector('.passage-act');
  const name = el.querySelector('.passage-name');
  if (act) act.textContent = WORLDS[to].act;
  if (name) name.textContent = WORLDS[to].name;

  // restart from a clean slate, then let the strokes sweep in
  el.dataset.state = 'idle';
  void el.offsetWidth;
  el.dataset.state = 'closing';

  covered = strokeSettled(el, 's3', 1100).then(async () => {
    if (el.dataset.state === 'closing') el.dataset.state = 'covered';
    // let the chapter plate breathe for a beat
    await new Promise((r) => setTimeout(r, 240));
  });
  return covered;
}

async function openVeil(): Promise<void> {
  const el = veil();
  if (!el || !covered) return;
  await covered;
  covered = null;
  el.dataset.state = 'opening';
  await strokeSettled(el, 's1', 1400);
  if (el.dataset.state === 'opening') el.dataset.state = 'idle';
}

/* ── lifecycle ──────────────────────────────────────────────────── */

async function onPageLoad(): Promise<void> {
  if (mode === 'full') {
    // the router has already jumped the native scroll — bring Lenis along
    const { getLenis } = await import('./journey');
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(window.scrollY, { immediate: true, force: true });
      lenis.resize();
      lenis.start();
    }
  }
  const mounted = mountCurrent();
  // never strand the visitor behind the veil — a slow GPU init forfeits the reveal
  await Promise.race([mounted, new Promise((r) => setTimeout(r, 2500))]);
  void openVeil();
}

let initialized = false;

export function initPassage(): void {
  if (initialized) return;
  initialized = true;

  mode = experienceMode();
  applyModeClass(mode);
  applyDaypart();

  // initial mount; astro:page-load also fires on first load — mountCurrent dedupes
  void mountCurrent();

  document.addEventListener('astro:before-preparation', (e) => {
    const ev = e as TransitionBeforePreparationEvent;
    if (mode !== 'full') return; // the catalogue swaps instantly, no theatre
    const from = worldFromPath(ev.from.pathname);
    const to = worldFromPath(ev.to.pathname);
    if (ev.to.pathname === ev.from.pathname) return; // same-page (hash) — no veil

    void import('./journey').then(({ getLenis }) => getLenis()?.stop());

    const originalLoader = ev.loader;
    ev.loader = async function (this: unknown, ...args: unknown[]) {
      await Promise.all([
        (originalLoader as (...a: unknown[]) => Promise<void>).apply(this, args),
        closeVeil(to, from),
      ]);
    };
  });

  document.addEventListener('astro:before-swap', () => {
    unmountCurrent();
  });

  document.addEventListener('astro:after-swap', () => {
    // the router rebuilt <html>'s attributes from the incoming document —
    // restore what only the client knows, before paint
    applyModeClass(mode);
    applyDaypart();
  });

  document.addEventListener('astro:page-load', () => {
    void onPageLoad();
  });
}
