/**
 * Runtime verification for Act I — The Sea (TSL only fails at runtime).
 * Drives the dev server with the system Chrome, captures console
 * output, waits for the marine to go live and screenshots:
 *   - the voyage at several scroll progress points (ship, palette, gold-out)
 *   - caption visibility inside / outside its scroll window
 *   - the ship's log (paper section) after the track
 *   - the catalogue gate on /sea
 *
 * Usage: node scripts/verify-sea.mjs [baseUrl]
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

/* ---- the voyage ---- */
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') logs.push(`[error] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
  });

  console.log('\n=== full mode: the voyage ===');
  await page.goto(`${base}/sea`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  await page.waitForTimeout(2200); // let the swell settle into the painting

  const state = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    world: document.documentElement.dataset.world,
    webgpu: 'gpu' in navigator,
    runway:
      (document.getElementById('voyage-track')?.offsetHeight ?? 0) >
      window.innerHeight * 2,
  }));
  check('full mode + webgpu live', state.mode === 'full' && state.webgpu);
  check('voyage runway present', state.runway);
  await page.screenshot({ path: `${outDir}/sea-00.png` });

  const trackHeight = await page.evaluate(() => {
    const track = document.getElementById('voyage-track');
    return track ? track.offsetHeight - window.innerHeight : 0;
  });

  // mid-voyage: caption 2 window (0.42–0.62), ship mid-crossing
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.5));
  await page.waitForTimeout(1700);
  const midCaption = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.c2')).opacity),
  );
  check('caption 2 visible mid-voyage', midCaption > 0.5, `opacity ${midCaption}`);
  await page.screenshot({ path: `${outDir}/sea-50.png` });

  // late voyage: dusk palette, caption 3
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.75));
  await page.waitForTimeout(1700);
  const lateCaption = await page.evaluate(() => ({
    c3: parseFloat(getComputedStyle(document.querySelector('.c3')).opacity),
    c2: parseFloat(getComputedStyle(document.querySelector('.c2')).opacity),
  }));
  check('caption 3 visible late', lateCaption.c3 > 0.5, JSON.stringify(lateCaption));
  check('caption 2 gone again', lateCaption.c2 < 0.3);
  await page.screenshot({ path: `${outDir}/sea-75.png` });

  // the gold-out
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.97));
  await page.waitForTimeout(1700);
  const gold = await page.evaluate(() => ({
    gold: parseFloat(getComputedStyle(document.querySelector('.gold-veil')).opacity),
    pageV: parseFloat(getComputedStyle(document.querySelector('.page-veil')).opacity),
  }));
  check('gold-out engaged', gold.gold > 0.6, JSON.stringify(gold));
  await page.screenshot({ path: `${outDir}/sea-97.png` });

  // the ship's log on paper
  await page.evaluate(() => document.getElementById('log')?.scrollIntoView());
  await page.waitForTimeout(1700);
  const log = await page.evaluate(() => ({
    h2: document.querySelector('#log h2')?.textContent ?? '',
  }));
  check('ship log readable', log.h2.includes('Who he is'));
  await page.screenshot({ path: `${outDir}/sea-log.png` });

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
  console.log(`\n=== voyage FAILED: ${err.message}`);
}

/* ---- the catalogue ---- */
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  console.log('\n=== catalogue mode on /sea ===');
  await page.goto(`${base}/sea`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(1200);
  const cat = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    sceneLive: !!document.querySelector('.hero.is-live'),
    runway:
      (document.getElementById('voyage-track')?.offsetHeight ?? 0) >
      window.innerHeight * 1.5,
    captionHidden:
      getComputedStyle(document.querySelector('.c1')).display === 'none',
    h2: document.querySelector('#log h2')?.textContent ?? '',
  }));
  check('catalogue gate held', cat.mode === 'catalog' && !cat.sceneLive && !cat.runway);
  check('captions hidden in catalogue', cat.captionHidden);
  check('full text present', cat.h2.includes('Who he is'));
  await page.screenshot({ path: `${outDir}/sea-catalog.png` });
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
