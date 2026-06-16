/**
 * Capture REAL renders of each world as the gallery plates (Workstream A,
 * P0-1 from the jury review: a plate must be the world itself, never a foreign
 * reference image or clipart). Drives the running dev server with WebGPU,
 * screenshots each world's live canvas with the DOM overlays hidden, and bakes
 * a 3:2 plate webp. The in-world Kuwahara pass then repaints them painterly.
 *
 * Needs the dev server running (pass its base URL). Re-run after look changes.
 * Usage: node scripts/capture-plates.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4321';
const OUT = 'public/assets/plates';
const TMP = 'verify-out';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const VW = 1500, VH = 1000; // 3:2 capture, no crop needed
const W = 1200, H = 800;

// hour=18.6 → golden hour, so every plate shares the lobby's warm palette
const HOUR = 18.6;
const WORLDS = [
  { id: 'sea', url: `/dev/ocean`, settle: 3000 },
  { id: 'camino', url: `/dev/camino?t=0.42`, settle: 2500 },
  { id: 'horizon', url: `/dev/horizon?t=0.5`, settle: 2500 },
  { id: 'city', url: `/city?hour=${HOUR}`, settle: 2800, scene: true, scroll: 0.42 },
];

const HIDE = `
  .frontispiece, .descend, .threshold, .c1, .c2, .c3, .waymark,
  .gold-veil, .page-veil, .fog-veil, #placards, #hud, #hint,
  #signature-loader, .signature-loader,
  .path, nav.path, [data-pathnav], header .mono-label, .attribution,
  footer { display: none !important; visibility: hidden !important; }
  html, body { background: #11141f !important; }
`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});

let failed = false;
try {
  for (const w of WORLDS) {
    const page = await browser.newPage({ viewport: { width: VW, height: VH } });
    // never arm the once-per-session signature loader during capture
    await page.addInitScript(() => { try { sessionStorage.setItem('seen-signature', '1'); } catch {} });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const url = base + w.url;
    console.log(`\n→ ${w.id}: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

    // scroll-driven worlds: wait for the scene to go live, then scrub
    if (w.scene) {
      await page.waitForSelector('[data-scene].is-live, .is-live', { timeout: 20_000 }).catch(() => {});
      if (w.scroll) {
        await page.evaluate((frac) => {
          const h = document.body.scrollHeight - window.innerHeight;
          window.scrollTo(0, h * frac);
        }, w.scroll);
      }
    }
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(w.settle);

    const shot = resolve(TMP, `plate-src-${w.id}.png`);
    await page.screenshot({ path: shot });
    await page.close();

    await sharp(readFileSync(shot))
      .resize({ width: W, height: H, fit: 'cover', position: 'centre' })
      .modulate({ saturation: 1.04 })
      .webp({ quality: 86, effort: 6 })
      .toFile(resolve(OUT, `${w.id}.webp`));
    console.log(`  baked ${w.id}.webp` + (errs.length ? `  (pageerrors: ${errs.length})` : ''));
    if (errs.length) for (const e of errs) console.log('    ! ' + e);
  }
} catch (e) {
  failed = true;
  console.log('FAILED: ' + e.message);
}
await browser.close();
console.log(failed ? '\nPLATES_FAIL' : '\nPLATES_OK');
process.exit(failed ? 1 : 0);
