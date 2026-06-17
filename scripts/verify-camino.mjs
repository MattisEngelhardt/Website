/**
 * Runtime verification for Act III — The Way (TSL only fails at runtime).
 * Drives the dev server with the system Chrome, captures console output,
 * waits for the flyover to go live and screenshots:
 *   - the flight at several scroll progress points (terrain, route, gold-out)
 *   - caption visibility inside / outside its scroll window
 *   - the live waymark naming a town mid-flight
 *   - the written chapter (paper section) after the track
 *   - the catalogue gate on /camino
 *
 * Usage: node scripts/verify-camino.mjs [baseUrl]
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
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failed = true;
}

/* ---- the flyover ---- */
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });

  console.log('\n=== full mode: the flyover ===');
  await page.goto(`${base}/camino`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    world: document.documentElement.dataset.world,
    webgpu: 'gpu' in navigator,
    runway:
      (document.getElementById('flyover-track')?.offsetHeight ?? 0) >
      window.innerHeight * 2,
  }));
  check('full mode + webgpu live', state.mode === 'full' && state.webgpu);
  check('flyover runway present', state.runway);
  check('world = camino', state.world === 'camino');
  await page.screenshot({ path: `${outDir}/camino-00.png` });

  const trackHeight = await page.evaluate(() => {
    const track = document.getElementById('flyover-track');
    return track ? track.offsetHeight - window.innerHeight : 0;
  });

  // mid-flight: waymark naming a town (the kitschy .c1/.c2/.c3 flavor captions
  // were purged in the Workstream C rebuild — only the live waymark remains)
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.48));
  await page.waitForTimeout(1700);
  const mid = await page.evaluate(() => ({
    wm: document.querySelector('.waymark')?.textContent ?? '',
    wmOpacity: parseFloat(getComputedStyle(document.querySelector('.waymark')).opacity),
  }));
  check('waymark naming a town', mid.wm.length > 1 && mid.wmOpacity > 0.5, `"${mid.wm}" @ ${mid.wmOpacity}`);
  await page.screenshot({ path: `${outDir}/camino-48.png` });

  // late flight: still cinematic, no floating markers
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.72));
  await page.waitForTimeout(1700);
  await page.screenshot({ path: `${outDir}/camino-72.png` });

  // arrival: the gold-out
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.98));
  await page.waitForTimeout(1700);
  const gold = await page.evaluate(() => ({
    gold: parseFloat(getComputedStyle(document.querySelector('.gold-veil')).opacity),
    pageV: parseFloat(getComputedStyle(document.querySelector('.page-veil')).opacity),
  }));
  check('gold-out engaged', gold.gold > 0.6, JSON.stringify(gold));
  await page.screenshot({ path: `${outDir}/camino-98.png` });

  // the written chapter on paper
  await page.evaluate(() => document.getElementById('way')?.scrollIntoView());
  await page.waitForTimeout(1500);
  const way = await page.evaluate(() => ({
    h2: document.querySelector('#way h2')?.textContent ?? '',
    routeCount: document.querySelectorAll('#way .route li').length,
    credits: (document.querySelector('.credits')?.textContent ?? '').includes('Sentinel-2'),
  }));
  check('chapter readable', way.h2.includes('What the way teaches'));
  check('route stations listed', way.routeCount >= 12, `count ${way.routeCount}`);
  check('attribution present', way.credits);
  await page.screenshot({ path: `${outDir}/camino-way.png` });

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
  console.log(`\n=== flyover FAILED: ${err.message}`);
}

/* ---- the catalogue ---- */
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  console.log('\n=== catalogue mode on /camino ===');
  await page.goto(`${base}/camino`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(1200);
  const cat = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    sceneLive: !!document.querySelector('.hero.is-live'),
    runway:
      (document.getElementById('flyover-track')?.offsetHeight ?? 0) >
      window.innerHeight * 1.5,
    captionHidden: !document.querySelector('.c1'), // flavor captions removed entirely
    h2: document.querySelector('#way h2')?.textContent ?? '',
  }));
  check('catalogue gate held', cat.mode === 'catalog' && !cat.sceneLive && !cat.runway);
  check('captions hidden in catalogue', cat.captionHidden);
  check('full text present', cat.h2.includes('What the way teaches'));
  await page.screenshot({ path: `${outDir}/camino-catalog.png` });
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
