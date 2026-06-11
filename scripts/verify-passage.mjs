/**
 * Runtime verification for die Passage (ClientRouter + veil + world
 * lifecycle). The risky part of view transitions is the script
 * lifecycle: scenes must unmount on swap and REMOUNT when the visitor
 * returns. This script drives real navigations with the system Chrome:
 *   - summit -> sea via the path nav (veil close/open, attrs restored)
 *   - sea -> summit (WebGPU scene must come back alive, runway intact)
 *   - two more round trips (listener/trigger leak smoke test)
 *   - descent scrub still works after a remount
 *   - history back/forward
 *   - the in-page #descent anchor still rides Lenis (no router fight)
 *   - catalogue mode: instant swaps, no veil, no scene
 *
 * Usage: node scripts/verify-passage.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4321';
const outDir = 'verify-out';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11'],
});

let failed = false;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failed = true;
}

function watch(page) {
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') logs.push(`[error] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
  });
  return logs;
}

const atPath = (p) => (url) => new URL(url).pathname === p;
// the veil is visibility:hidden when idle — wait for attachment, not visibility
const veilIdle = (page) =>
  page.waitForSelector('#passage[data-state="idle"]', { state: 'attached', timeout: 10_000 });

/* ---- full experience: the journey between worlds ---- */
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = watch(page);

  console.log('\n=== full mode: summit -> sea -> summit (+2 round trips) ===');
  await page.goto(`${base}/?hour=19.5`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });

  // forward: the veil should sweep while we travel to the sea
  await page.click('.path a[href="/sea"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/passage-closing.png` });
  await page.waitForURL(atPath('/sea'), { timeout: 10_000 });
  await veilIdle(page);
  const sea = await page.evaluate(() => ({
    world: document.documentElement.dataset.world,
    mode: document.documentElement.dataset.mode,
    daypart: document.documentElement.dataset.daypart ?? null,
    h1: document.querySelector('h1')?.textContent ?? '',
    veil: document.getElementById('passage')?.dataset.state,
  }));
  check('arrived in sea world', sea.world === 'sea', JSON.stringify(sea));
  check('data-mode survived the swap', sea.mode === 'full');
  check('data-daypart survived the swap', !!sea.daypart);
  check('sea content is real', sea.h1.includes('water remembers'));
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  check('sea scene mounted after swap (is-live)', true);
  await page.screenshot({ path: `${outDir}/passage-sea.png` });

  // back: the summit scene must REMOUNT (the lifecycle acid test)
  await page.click('.path a[href="/"]');
  await page.waitForURL(atPath('/'), { timeout: 10_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  await veilIdle(page);
  const back = await page.evaluate(() => ({
    world: document.documentElement.dataset.world,
    runway:
      (document.getElementById('descent-track')?.offsetHeight ?? 0) >
      window.innerHeight * 1.5,
  }));
  check('summit scene remounted (is-live)', back.world === 'summit');
  check('descent runway rebuilt', back.runway);

  // descent scrub still works after a remount
  const trackHeight = await page.evaluate(() => {
    const track = document.getElementById('descent-track');
    return track ? track.offsetHeight - window.innerHeight : 0;
  });
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.7));
  await page.waitForTimeout(1600);
  const fogOpacity = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.fog-veil')).opacity),
  );
  check('descent scrub drives the white-out after remount', fogOpacity > 0.05, `fog-veil opacity ${fogOpacity}`);
  await page.screenshot({ path: `${outDir}/passage-remount-descent.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);

  // leak smoke test: two more round trips, scene must return each time
  for (let i = 0; i < 2; i++) {
    await page.click('.path a[href="/sea"]');
    await page.waitForURL(atPath('/sea'), { timeout: 10_000 });
    await veilIdle(page);
    await page.click('.path a[href="/"]');
    await page.waitForURL(atPath('/'), { timeout: 10_000 });
    await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
    await veilIdle(page);
  }
  check('two extra round trips survived', true);

  // history traversal
  await page.goBack();
  await page.waitForURL(atPath('/sea'), { timeout: 10_000 });
  await veilIdle(page);
  const histWorld = await page.evaluate(() => document.documentElement.dataset.world);
  check('history back lands in sea', histWorld === 'sea');
  await page.goForward();
  await page.waitForURL(atPath('/'), { timeout: 10_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  check('history forward remounts summit', true);

  // the in-page anchor still rides Lenis (router must not fight it)
  await veilIdle(page);
  await page.click('.descend');
  await page.waitForTimeout(2500);
  const anchor = await page.evaluate(() => ({
    path: location.pathname,
    y: window.scrollY,
  }));
  check('descend anchor scrolled in place', anchor.path === '/' && anchor.y > 800, JSON.stringify(anchor));

  if (logs.length) {
    console.log('console errors:');
    for (const l of logs) console.log('  ' + l);
    failed = true;
  } else {
    console.log('  ok  0 console errors across all navigations');
  }
  await page.close();
} catch (err) {
  failed = true;
  console.log(`\n=== full mode FAILED: ${err.message}`);
}

/* ---- catalogue: navigation must stay instant and theatre-free ---- */
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  });
  const logs = watch(page);

  console.log('\n=== catalogue mode: summit -> sea ===');
  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.click('.path a[href="/sea"]');
  await page.waitForURL(atPath('/sea'), { timeout: 10_000 });
  await page.waitForTimeout(400);
  const cat = await page.evaluate(() => ({
    world: document.documentElement.dataset.world,
    mode: document.documentElement.dataset.mode,
    veil: document.getElementById('passage')?.dataset.state,
    sceneLive: !!document.querySelector('.hero.is-live'),
    h1: document.querySelector('h1')?.textContent ?? '',
  }));
  check('catalogue navigated to sea', cat.world === 'sea' && cat.h1.includes('water remembers'));
  check('mode stayed catalog', cat.mode === 'catalog');
  check('veil never engaged', cat.veil === 'idle');
  check('no scene mounted', !cat.sceneLive);
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
  console.log(`\n=== catalogue FAILED: ${err.message}`);
}

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
