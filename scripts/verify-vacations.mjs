/**
 * Runtime check for My Vacations (/vacations, Workstream B). Drives system
 * Chrome: the curved drag-wall builds tiles from the manifest, dragging wisps
 * the wall, a tile click opens the lightbox, Escape closes it. Screenshots for
 * the side-by-side look review (read them with the Read tool). Also confirms the
 * static SEO gallery is present for the catalogue/reduced-motion fallback.
 *
 * Usage: node scripts/verify-vacations.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4321';
const outDir = 'verify-out';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});

let failed = false;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failed = true;
};

const W = 1600, H = 900;

try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  // never arm the once-per-session signature loader during capture
  await page.addInitScript(() => { try { sessionStorage.setItem('seen-signature', '1'); } catch {} });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  const url = `${base}/vacations`;
  console.log(`\n=== My Vacations: ${url} ===`);
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

  // manifest present + static SEO gallery rendered
  const figs = await page.locator('#vacations-catalog .vac-fig').count();
  check('static SEO gallery rendered', figs > 0, `figures=${figs}`);

  // the live wall builds tiles
  await page.waitForTimeout(2200);
  const tiles = await page.locator('.vac-tile').count();
  check('live curved wall built tiles', tiles > 0, `tiles=${tiles}`);
  await page.screenshot({ path: `${outDir}/vac-wall.png` });

  // click a tile → lightbox opens. The wall is 3-D transformed (rotateY/translateZ)
  // so a tile's 2-D bbox centre is unreliable — scan for a screen point that
  // actually hit-tests onto a tile (its picture/video/element inside .vac-tile).
  const center = await page.evaluate(() => {
    for (let y = 70; y < 840; y += 16) {
      for (let x = 60; x < 1540; x += 16) {
        const el = document.elementFromPoint(x, y);
        if (el && el.closest && el.closest('.vac-tile')) return { x, y };
      }
    }
    return null;
  });
  check('a tile is hit-testable (clickable)', !!center, center ? `at ${center.x},${center.y}` : 'none');
  if (center) await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(800);
  const lbOpen = await page.evaluate(() =>
    document.querySelector('.vac-lightbox')?.getAttribute('aria-hidden') === 'false');
  check('tile click opens lightbox', lbOpen);
  await page.screenshot({ path: `${outDir}/vac-lightbox.png` });

  // Escape closes it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const lbClosed = await page.evaluate(() =>
    document.querySelector('.vac-lightbox')?.getAttribute('aria-hidden') !== 'false');
  check('Escape closes lightbox', lbClosed);

  // drag wisps the wall — capture the layer transform before/after
  const stage = page.locator('#vacations-stage');
  const before = await page.evaluate(() => {
    const l = document.querySelector('.vac-layer');
    return l ? getComputedStyle(l).transform : '';
  });
  await stage.hover();
  await page.mouse.down();
  await page.mouse.move(W * 0.3, H * 0.5, { steps: 18 });
  await page.mouse.move(W * 0.7, H * 0.42, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const l = document.querySelector('.vac-layer');
    return l ? getComputedStyle(l).transform : '';
  });
  check('drag wisps the wall (layer moved)', before !== after, 'transform changed');
  await page.screenshot({ path: `${outDir}/vac-dragged.png` });

  if (logs.length) {
    console.log('console errors:');
    for (const l of logs) console.log('  ' + l);
    failed = true;
  } else {
    console.log('  ok  0 console errors');
  }
  await page.close();
} catch (err) {
  failed = true;
  console.log(`\n=== vacations FAILED: ${err.message}`);
}

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
