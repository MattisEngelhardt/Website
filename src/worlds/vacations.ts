/**
 * World controller — My Vacations.
 *
 * The phantom.land canvas, in Mattis' warm Friedrich idiom: a slightly
 * CURVED wall of media tiles, built as a GPU-composited DOM layer (no
 * WebGL texture upload — native browser decode scales far better for
 * many videos). Drag to wisp through the wall with momentum; only the
 * tiles near the viewport ever mount their media; videos autoplay muted
 * in-view and release their source out-of-view (cap ~5 at once); click a
 * tile for an immersive lightbox with sound, prev/next, ESC + a11y focus
 * trap. Returns one cleanup for die Passage.
 *
 * ─────────────────────────────────────────────────────────────────────
 * TODO(integration, passage.ts): register "vacations" — add ALL of:
 *
 *   1. WorldName union (line ~36):
 *        type WorldName = 'summit' | 'sea' | 'city' | 'camino' | 'horizon' | 'vacations';
 *
 *   2. WORLDS map (the chapter-plate metadata, ~line 38). It sits between
 *      camino (Act III) and horizon. Renumber horizon to Act V, or give
 *      vacations its own act label — your call on the canon. Suggested:
 *        vacations: { act: 'Act IV', name: 'My Vacations', index: 4 },
 *        horizon:   { act: 'Act V',  name: 'The Horizon',  index: 5 },
 *      (and bump horizon's index 4→5 so the veil direction stays correct)
 *
 *   3. CONTROLLERS map (~line 47):
 *        vacations: () => import('../worlds/vacations'),
 *
 *   4. worldFromPath() (~line 56):
 *        if (pathname.startsWith('/vacations')) return 'vacations';
 *
 *   5. Veil palette in src/styles/global.css (~line 446, the
 *      `.passage[data-to='…']` block). Add a warm parchment/gold set, e.g.:
 *        .passage[data-to='vacations'] .s1 { background: var(--c-orange); }
 *        .passage[data-to='vacations'] .s2 { background: var(--c-sun); }
 *        .passage[data-to='vacations'] .s3 {
 *          background: linear-gradient(125deg, var(--c-canvas) 38%, var(--c-haze));
 *        }
 *        .passage[data-to='vacations'] .passage-plate { color: var(--c-ink); }
 *
 *   6. World.astro `Props.world` union (~line 21) AND PathNav.astro
 *      `Props`/stations — widen the literal type to include 'vacations'
 *      and add a station { slug:'vacations', href:'/vacations',
 *      label:'My Vacations', numeral:'IV' } (renumber horizon→V).
 *      vacations.astro passes world="vacations", so the type must accept it.
 *
 * MANIFEST: this controller RUNTIME-fetches /assets/vacations/manifest.json.
 * The .astro page does the BUILD-TIME import for the static SEO gallery;
 * the live wall fetches fresh so a manifest regenerated after build still
 * shows up without a rebuild. If the fetch fails / is empty, mount() is a
 * no-op and the static SEO gallery in the page stands on its own.
 * ─────────────────────────────────────────────────────────────────────
 */
import type { Cleanup, WorldContext } from '../lib/passage';

/* ── manifest shape (code to this exactly; a sibling agent generates it) ── */
interface Source {
  src: string;
  type: string;
}
interface Item {
  id: string;
  type: 'photo' | 'video';
  place: string;
  date: string;
  w: number;
  h: number;
  lqip: string; // data URI
  poster: string; // /assets/vacations/..._poster.webp
  srcset?: { avif: string; webp: string }; // photo
  preview?: Source[]; // video — small muted loop
  full?: Source[]; // video — lightbox quality, click-to-load
}
interface Manifest {
  generated?: string;
  items: Item[];
}

/* ── wall geometry ──────────────────────────────────────────────────── */
const COLS = 4; // tiles per column-band before wrapping to the next row
const TILE_W = 320; // base tile footprint (px) — media is object-fit:cover
const TILE_H = 220;
const GAP_X = 40;
const GAP_Y = 40;
const COL_W = TILE_W + GAP_X;
const ROW_H = TILE_H + GAP_Y;
const CURVE_DEG = 7; // per-column rotateY swing → the canvas curve
const MAX_PLAYING = 5; // cap simultaneous wall videos (decode budget)
const MOUNT_MARGIN = 700; // px around viewport that counts as "near"
const FRICTION = 0.92; // momentum decay per frame
const DRAG_SCALE = 1; // 1 wall-px per pointer-px

export async function mount(ctx: WorldContext): Promise<Cleanup> {
  const rootMaybe = document.getElementById('vacations-stage');
  if (!(rootMaybe instanceof HTMLElement)) return () => {};
  // an explicitly-typed alias: the manifest `await` below resets control-flow
  // narrowing, so closures (drag/lightbox) would otherwise see `root` as nullable.
  const root: HTMLElement = rootMaybe;

  const reduced =
    ctx.mode !== 'full' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    Boolean(
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData,
    );

  /* ── data: fetch the manifest; degrade silently to the static SEO gallery ── */
  let items: Item[] = [];
  try {
    const res = await fetch('/assets/vacations/manifest.json', { cache: 'force-cache' });
    if (res.ok) {
      const data = (await res.json()) as Manifest;
      if (Array.isArray(data.items)) items = data.items;
    }
  } catch {
    /* offline / missing manifest — the page's static gallery stands alone */
  }
  if (!items.length) return () => {};

  // the live wall takes over; hide the static SEO/catalog gallery underneath
  const catalog = document.getElementById('vacations-catalog');
  if (catalog) catalog.setAttribute('hidden', '');
  root.removeAttribute('hidden');

  /* ── layout: a curved wall, one DOM layer translated by the drag ── */
  const layer = document.createElement('div');
  layer.className = 'vac-layer';

  const rows = Math.ceil(items.length / COLS);
  const wallW = COLS * COL_W;
  const wallH = rows * ROW_H;

  interface Tile {
    item: Item;
    el: HTMLElement;
    x: number; // wall-space center
    y: number;
    col: number;
    media: HTMLElement | null; // mounted <picture>/<video> (null until near)
    video: HTMLVideoElement | null;
    near: boolean;
  }
  const tiles: Tile[] = items.map((item, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * COL_W + TILE_W / 2 - wallW / 2;
    const y = row * ROW_H + TILE_H / 2 - wallH / 2;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'vac-tile';
    el.style.width = `${TILE_W}px`;
    el.style.height = `${TILE_H}px`;
    // curve: per-column rotateY, plus a touch of depth on the outer columns
    const rotY = (col - (COLS - 1) / 2) * CURVE_DEG;
    const depth = -Math.abs(col - (COLS - 1) / 2) * 26;
    el.style.transform = `translate3d(${x - TILE_W / 2}px, ${y - TILE_H / 2}px, ${depth}px) rotateY(${rotY}deg)`;
    el.style.backgroundImage = `url("${item.lqip}")`;
    el.setAttribute(
      'aria-label',
      `${item.type === 'video' ? 'Video' : 'Photo'} — ${item.place}, ${item.date}`,
    );
    el.dataset.idx = String(i);
    layer.appendChild(el);

    return { item, el, x, y, col, media: null, video: null, near: false };
  });
  root.appendChild(layer);

  /* ── drag layer transform (the wisp) ── */
  let tx = 0;
  let ty = 0;
  const PAD_X = COL_W; // a little slack past the edges
  const PAD_Y = ROW_H;
  const minX = -(wallW / 2) - PAD_X;
  const maxX = wallW / 2 + PAD_X;
  const minY = -(wallH / 2) - PAD_Y;
  const maxY = wallH / 2 + PAD_Y;

  function applyLayer() {
    layer.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }
  applyLayer();

  /* ── media mount / unmount (virtualization + lazy + source release) ── */
  let playing = 0;

  function mountMedia(t: Tile) {
    if (t.media) return;
    const it = t.item;
    if (it.type === 'photo' && it.srcset) {
      const pic = document.createElement('picture');
      const a = document.createElement('source');
      a.type = 'image/avif';
      a.srcset = it.srcset.avif;
      a.sizes = `${TILE_W}px`;
      const w = document.createElement('source');
      w.type = 'image/webp';
      w.srcset = it.srcset.webp;
      w.sizes = `${TILE_W}px`;
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = `${it.place}, ${it.date}`;
      img.src = it.poster;
      img.className = 'vac-media';
      pic.append(a, w, img);
      t.el.appendChild(pic);
      t.media = pic;
    } else if (it.type === 'video') {
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'none';
      v.poster = it.poster;
      v.className = 'vac-media';
      // reduced-data: poster only, never attach the loop sources on the wall
      if (!reduced) {
        for (const s of it.preview ?? []) {
          const src = document.createElement('source');
          src.src = s.src;
          src.type = s.type;
          v.appendChild(src);
        }
      }
      t.el.appendChild(v);
      t.media = v;
      t.video = v;
    } else {
      // photo without srcset → just the poster
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = `${it.place}, ${it.date}`;
      img.src = it.poster;
      img.className = 'vac-media';
      t.el.appendChild(img);
      t.media = img;
    }
  }

  function pauseVideo(t: Tile) {
    if (!t.video) return;
    if (!t.video.paused) {
      t.video.pause();
      playing = Math.max(0, playing - 1);
    }
  }

  function unmountMedia(t: Tile) {
    if (!t.media) return;
    if (t.video) {
      pauseVideo(t);
      t.video.removeAttribute('src');
      while (t.video.firstChild) t.video.removeChild(t.video.firstChild);
      t.video.load(); // release the decoder / network
      t.video = null;
    }
    t.media.remove();
    t.media = null;
  }

  function tryPlay(t: Tile) {
    if (reduced || !t.video || !t.near) return;
    if (playing >= MAX_PLAYING) return;
    if (t.video.paused) {
      playing += 1;
      t.video.play().catch(() => {
        playing = Math.max(0, playing - 1);
      });
    }
  }

  // IntersectionObserver against the real viewport: only near tiles get media,
  // only in-view videos play. rootMargin pre-mounts so there's never a blank.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const idx = Number((e.target as HTMLElement).dataset.idx);
        const t = tiles[idx];
        if (!t) continue;
        t.near = e.isIntersecting;
        if (e.isIntersecting) {
          mountMedia(t);
          tryPlay(t);
        } else {
          pauseVideo(t);
          // fully gone (not just past the play line) → release the source
          if (e.intersectionRatio === 0) unmountMedia(t);
        }
      }
    },
    { root: null, rootMargin: `${MOUNT_MARGIN}px`, threshold: [0, 0.01] },
  );
  for (const t of tiles) io.observe(t.el);

  /* ── hover (desktop): preview-loop plays / photo lifts ── */
  function onTileEnter(t: Tile) {
    t.el.classList.add('is-hover');
    tryPlay(t);
  }
  function onTileLeave(t: Tile) {
    t.el.classList.remove('is-hover');
    // on the wall we keep in-view videos running; just drop the lift
  }

  /* ── pointer drag with momentum ── */
  let dragging = false;
  let moved = false;
  let pointerId = -1;
  let lastX = 0;
  let lastY = 0;
  let vx = 0;
  let vy = 0;
  let raf = 0;

  function clamp() {
    if (tx < minX) {
      tx = minX;
      vx = 0;
    }
    if (tx > maxX) {
      tx = maxX;
      vx = 0;
    }
    if (ty < minY) {
      ty = minY;
      vy = 0;
    }
    if (ty > maxY) {
      ty = maxY;
      vy = 0;
    }
  }

  function momentum() {
    if (dragging) return;
    vx *= FRICTION;
    vy *= FRICTION;
    tx += vx;
    ty += vy;
    clamp();
    applyLayer();
    if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
      raf = requestAnimationFrame(momentum);
    } else {
      raf = 0;
    }
  }

  let captured = false;
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    moved = false;
    captured = false;
    pointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    vx = 0;
    vy = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    // NB: do NOT capture the pointer here — capturing on pointerdown redirects
    // the subsequent `click` to the stage, so tile clicks would never reach the
    // tile (the lightbox would never open). Capture only once a real drag begins.
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = (e.clientX - lastX) * DRAG_SCALE;
    const dy = (e.clientY - lastY) * DRAG_SCALE;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 3) {
      moved = true;
      captured = true;
      root.setPointerCapture?.(e.pointerId); // own the gesture only now (a drag)
      root.classList.add('is-dragging');
    }
    lastX = e.clientX;
    lastY = e.clientY;
    tx += dx;
    ty += dy;
    vx = dx;
    vy = dy;
    clamp();
    applyLayer();
  }

  function endDrag(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    dragging = false;
    root.classList.remove('is-dragging');
    if (captured) {
      root.releasePointerCapture?.(e.pointerId);
      captured = false;
    }
    if (!reduced && (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5)) {
      raf = requestAnimationFrame(momentum);
    }
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);

  // per-tile hover + click (click only fires when the drag didn't move)
  const tileEnter = (ev: Event) => {
    const idx = Number((ev.currentTarget as HTMLElement).dataset.idx);
    const t = tiles[idx];
    if (t) onTileEnter(t);
  };
  const tileLeave = (ev: Event) => {
    const idx = Number((ev.currentTarget as HTMLElement).dataset.idx);
    const t = tiles[idx];
    if (t) onTileLeave(t);
  };
  const tileClick = (ev: Event) => {
    if (moved) {
      ev.preventDefault();
      return;
    }
    const idx = Number((ev.currentTarget as HTMLElement).dataset.idx);
    openLightbox(idx);
  };
  for (const t of tiles) {
    t.el.addEventListener('pointerenter', tileEnter);
    t.el.addEventListener('pointerleave', tileLeave);
    t.el.addEventListener('click', tileClick);
  }

  /* ── lightbox: immersive view, sound toggle, prev/next, ESC, focus trap ── */
  const lb = document.createElement('div');
  lb.className = 'vac-lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-hidden', 'true');
  lb.innerHTML = `
    <div class="vac-lb-backdrop" data-close></div>
    <figure class="vac-lb-figure">
      <div class="vac-lb-stage"></div>
      <figcaption class="vac-lb-cap mono-label"></figcaption>
    </figure>
    <button class="vac-lb-btn vac-lb-prev" type="button" aria-label="Previous">&#8592;</button>
    <button class="vac-lb-btn vac-lb-next" type="button" aria-label="Next">&#8594;</button>
    <button class="vac-lb-btn vac-lb-close" type="button" aria-label="Close" data-close>&#215;</button>
    <button class="vac-lb-btn vac-lb-sound" type="button" aria-label="Toggle sound" hidden>&#128263;</button>
  `;
  // append to <body>, NOT the stage: the stage establishes a stacking context
  // (perspective) at a low z-index, which would trap this fixed overlay beneath
  // the frontispiece. At body level the lightbox covers everything. dispose()
  // removes it wherever it lives.
  document.body.appendChild(lb);

  const lbStage = lb.querySelector('.vac-lb-stage') as HTMLElement;
  const lbCap = lb.querySelector('.vac-lb-cap') as HTMLElement;
  const lbSound = lb.querySelector('.vac-lb-sound') as HTMLButtonElement;
  const lbPrev = lb.querySelector('.vac-lb-prev') as HTMLButtonElement;
  const lbNext = lb.querySelector('.vac-lb-next') as HTMLButtonElement;
  const lbClose = lb.querySelector('.vac-lb-close') as HTMLButtonElement;

  let lbIndex = -1;
  let lbVideo: HTMLVideoElement | null = null;
  let lastFocus: HTMLElement | null = null;

  function clearStage() {
    if (lbVideo) {
      lbVideo.pause();
      lbVideo.removeAttribute('src');
      lbVideo = null;
    }
    lbStage.replaceChildren();
  }

  function renderLightbox(i: number) {
    clearStage();
    const it = items[i];
    if (!it) return;
    lbIndex = i;
    lbCap.textContent = `${it.place} · ${it.date}`;

    if (it.type === 'video') {
      const v = document.createElement('video');
      v.controls = false;
      v.autoplay = true;
      v.loop = true;
      v.playsInline = true;
      v.muted = true; // start muted; user toggles sound (autoplay policy)
      v.poster = it.poster;
      v.className = 'vac-lb-media';
      for (const s of it.full ?? it.preview ?? []) {
        const src = document.createElement('source');
        src.src = s.src;
        src.type = s.type;
        v.appendChild(src);
      }
      lbStage.appendChild(v);
      lbVideo = v;
      v.play().catch(() => {});
      lbSound.hidden = false;
      lbSound.setAttribute('aria-pressed', 'false');
      lbSound.innerHTML = '&#128263;';
    } else {
      const pic = document.createElement('picture');
      if (it.srcset) {
        const a = document.createElement('source');
        a.type = 'image/avif';
        a.srcset = it.srcset.avif;
        const w = document.createElement('source');
        w.type = 'image/webp';
        w.srcset = it.srcset.webp;
        pic.append(a, w);
      }
      const img = document.createElement('img');
      img.alt = `${it.place}, ${it.date}`;
      img.src = it.poster;
      img.decoding = 'async';
      img.className = 'vac-lb-media';
      pic.appendChild(img);
      lbStage.appendChild(pic);
      lbSound.hidden = true;
    }
  }

  const FOCUSABLE = '.vac-lb-prev, .vac-lb-next, .vac-lb-close, .vac-lb-sound:not([hidden])';
  function onKeydown(e: KeyboardEvent) {
    if (lb.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      step(-1);
    } else if (e.key === 'ArrowRight') {
      step(1);
    } else if (e.key === 'Tab') {
      // trap focus within the dialog's controls
      const focusables = Array.from(lb.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('hidden'),
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!lb.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function step(dir: number) {
    const n = items.length;
    renderLightbox((lbIndex + dir + n) % n);
  }

  function openLightbox(i: number) {
    lastFocus = document.activeElement as HTMLElement;
    renderLightbox(i);
    lb.setAttribute('aria-hidden', 'false');
    root.classList.add('vac-lb-open');
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
    lbClose.focus();
  }

  function closeLightbox() {
    clearStage();
    lb.setAttribute('aria-hidden', 'true');
    root.classList.remove('vac-lb-open');
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    lbIndex = -1;
    lastFocus?.focus?.();
  }

  function toggleSound() {
    if (!lbVideo) return;
    lbVideo.muted = !lbVideo.muted;
    const on = !lbVideo.muted;
    lbSound.setAttribute('aria-pressed', String(on));
    lbSound.innerHTML = on ? '&#128266;' : '&#128263;';
    if (on) lbVideo.play().catch(() => {});
  }

  lbPrev.addEventListener('click', () => step(-1));
  lbNext.addEventListener('click', () => step(1));
  lbClose.addEventListener('click', closeLightbox);
  lbSound.addEventListener('click', toggleSound);
  const onBackdrop = (e: Event) => {
    if ((e.target as HTMLElement).hasAttribute('data-close')) closeLightbox();
  };
  lb.addEventListener('click', onBackdrop);

  /* ── cleanup for die Passage (SPA unmount) ── */
  return () => {
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener('keydown', onKeydown);
    document.documentElement.style.overflow = '';
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', endDrag);
    root.removeEventListener('pointercancel', endDrag);
    for (const t of tiles) {
      t.el.removeEventListener('pointerenter', tileEnter);
      t.el.removeEventListener('pointerleave', tileLeave);
      t.el.removeEventListener('click', tileClick);
      unmountMedia(t);
    }
    clearStage();
    lb.remove();
    layer.remove();
    playing = 0;
  };
}
