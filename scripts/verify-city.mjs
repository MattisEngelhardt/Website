/**
 * Runtime verification for Act II — The City of Agents.
 * Drives the dev server with the system Chrome (real WebGPU), captures
 * console output, waits for the city to go live and checks:
 *   - the approach at several scroll points (skyline, street, collapse)
 *   - caption visibility inside / outside its scroll window
 *   - the city records (paper section) + all three record routes
 *   - the same-world veil (city → record keeps the plate quiet)
 *   - the catalogue gate on /city
 *
 * Usage: node scripts/verify-city.mjs [baseUrl]
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

/* ---- the approach ---- */
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

  console.log('\n=== full mode: the approach ===');
  await page.goto(`${base}/city`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  await page.waitForTimeout(2200); // let the rain settle into the broadcast

  const state = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    world: document.documentElement.dataset.world,
    webgpu: 'gpu' in navigator,
    runway:
      (document.getElementById('approach-track')?.offsetHeight ?? 0) >
      window.innerHeight * 2,
  }));
  check('full mode + webgpu live', state.mode === 'full' && state.webgpu);
  check('approach runway present', state.runway);
  await page.screenshot({ path: `${outDir}/city-00.png` });

  const trackHeight = await page.evaluate(() => {
    const track = document.getElementById('approach-track');
    return track ? track.offsetHeight - window.innerHeight : 0;
  });

  // mid-approach: street level, caption 2 window (0.40–0.58)
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.5));
  await page.waitForTimeout(1700);
  const midCaption = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.c2')).opacity),
  );
  check('caption 2 visible mid-approach', midCaption > 0.5, `opacity ${midCaption}`);
  await page.screenshot({ path: `${outDir}/city-50.png` });

  // late approach: Porter tower close, caption 3
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.72));
  await page.waitForTimeout(1700);
  const lateCaption = await page.evaluate(() => ({
    c3: parseFloat(getComputedStyle(document.querySelector('.c3')).opacity),
    c2: parseFloat(getComputedStyle(document.querySelector('.c2')).opacity),
  }));
  check('caption 3 visible late', lateCaption.c3 > 0.5, JSON.stringify(lateCaption));
  check('caption 2 gone again', lateCaption.c2 < 0.3);
  await page.screenshot({ path: `${outDir}/city-72.png` });

  // the signal collapse
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.97));
  await page.waitForTimeout(1700);
  const collapse = await page.evaluate(() => ({
    glitch: parseFloat(getComputedStyle(document.querySelector('.glitch-veil')).opacity),
    pageV: parseFloat(getComputedStyle(document.querySelector('.page-veil')).opacity),
  }));
  check('signal collapse engaged', collapse.glitch > 0.6, JSON.stringify(collapse));
  await page.screenshot({ path: `${outDir}/city-97.png` });

  // the city records on paper
  await page.evaluate(() => document.getElementById('records')?.scrollIntoView());
  await page.waitForTimeout(1700);
  const records = await page.evaluate(() => ({
    h2: document.querySelector('#records h2')?.textContent ?? '',
    towers: document.querySelectorAll('.records a').length,
  }));
  check('records readable', records.h2.includes('What he builds'));
  check('three towers filed', records.towers === 3, `${records.towers}`);
  await page.screenshot({ path: `${outDir}/city-records.png` });

  // into a record: same-world veil keeps the chapter plate quiet
  await page.click('.records a[href="/city/porter"]');
  await page.waitForURL('**/city/porter', { timeout: 15_000 });
  await page.waitForTimeout(1800);
  const record = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent ?? '',
    same: document.getElementById('passage')?.dataset.same,
    stack: document.querySelector('.stack')?.textContent ?? '',
  }));
  check('porter record loaded', record.h1.includes('Porter'));
  check('same-world veil flagged', record.same === 'true');
  check('record content real', record.stack.includes('SearXNG'));
  await page.screenshot({ path: `${outDir}/city-record-porter.png` });

  // remaining records respond with real content
  for (const [slug, marker] of [
    ['amadeus', 'voice-to-context'],
    ['papers', '1.0'],
  ]) {
    await page.goto(`${base}/city/${slug}`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    // textContent, not innerText: below-fold copy sits in visibility:hidden
    // reveal states until scrolled to
    const body = await page.evaluate(() => document.body.textContent ?? '');
    check(`${slug} record real`, body.includes(marker));
  }

  // back to the city: the scene must remount
  await page.goto(`${base}/city`, { waitUntil: 'load' });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  check('city scene remounts after record visit', true);

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
  console.log(`\n=== approach FAILED: ${err.message}`);
}

/* ---- the catalogue ---- */
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  console.log('\n=== catalogue mode on /city ===');
  await page.goto(`${base}/city`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(1200);
  const cat = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    sceneLive: !!document.querySelector('.hero.is-live'),
    runway:
      (document.getElementById('approach-track')?.offsetHeight ?? 0) >
      window.innerHeight * 1.5,
    captionHidden:
      getComputedStyle(document.querySelector('.c1')).display === 'none',
    h2: document.querySelector('#records h2')?.textContent ?? '',
  }));
  check('catalogue gate held', cat.mode === 'catalog' && !cat.sceneLive && !cat.runway);
  check('captions hidden in catalogue', cat.captionHidden);
  check('full text present', cat.h2.includes('What he builds'));
  await page.screenshot({ path: `${outDir}/city-catalog.png` });
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
