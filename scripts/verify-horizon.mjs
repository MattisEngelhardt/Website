/**
 * Runtime verification for Act IV — The Horizon (TSL/volumetric fails at runtime).
 * Drives the dev server with the system Chrome, captures console output,
 * waits for the cloud-sea flight to go live and screenshots:
 *   - the flight at several scroll progress points (cloud sea, captions, gold-out)
 *   - caption visibility inside / outside its scroll window
 *   - the contact chapter (paper section) after the track + the GitHub link
 *   - the catalogue gate on /horizon
 *
 * Usage: node scripts/verify-horizon.mjs [baseUrl]
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

/* ---- the cloud-sea flight ---- */
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });

  console.log('\n=== full mode: the flight ===');
  await page.goto(`${base}/horizon`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    world: document.documentElement.dataset.world,
    webgpu: 'gpu' in navigator,
    runway:
      (document.getElementById('horizon-track')?.offsetHeight ?? 0) >
      window.innerHeight * 2,
  }));
  check('full mode + webgpu live', state.mode === 'full' && state.webgpu);
  check('horizon runway present', state.runway);
  check('world = horizon', state.world === 'horizon');
  await page.screenshot({ path: `${outDir}/horizon-00.png` });

  const trackHeight = await page.evaluate(() => {
    const track = document.getElementById('horizon-track');
    return track ? track.offsetHeight - window.innerHeight : 0;
  });

  // caption 1 window (0.16–0.36) — scrub to its centre, allow settle
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.28));
  await page.waitForTimeout(1800);
  const early = await page.evaluate(() => ({
    c1: parseFloat(getComputedStyle(document.querySelector('.c1')).opacity),
  }));
  check('caption 1 visible early', early.c1 > 0.4, `opacity ${early.c1}`);
  await page.screenshot({ path: `${outDir}/horizon-28.png` });

  // mid flight: caption 2 window (0.42–0.62)
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.5));
  await page.waitForTimeout(1800);
  const mid = await page.evaluate(() => ({
    c2: parseFloat(getComputedStyle(document.querySelector('.c2')).opacity),
  }));
  check('caption 2 visible mid', mid.c2 > 0.4, JSON.stringify(mid));
  await page.screenshot({ path: `${outDir}/horizon-50.png` });

  // late: caption 3 (0.66–0.82)
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.74));
  await page.waitForTimeout(1800);
  const late = await page.evaluate(() => ({
    c3: parseFloat(getComputedStyle(document.querySelector('.c3')).opacity),
  }));
  check('caption 3 visible late', late.c3 > 0.4, `opacity ${late.c3}`);
  await page.screenshot({ path: `${outDir}/horizon-74.png` });

  // arrival: the gold-out
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.98));
  await page.waitForTimeout(1500);
  const gold = await page.evaluate(() => ({
    gold: parseFloat(getComputedStyle(document.querySelector('.gold-veil')).opacity),
    pageV: parseFloat(getComputedStyle(document.querySelector('.page-veil')).opacity),
  }));
  check('gold-out engaged', gold.gold > 0.6, JSON.stringify(gold));
  await page.screenshot({ path: `${outDir}/horizon-98.png` });

  // the contact chapter on paper
  await page.evaluate(() => document.getElementById('contact')?.scrollIntoView());
  await page.waitForTimeout(1500);
  const contact = await page.evaluate(() => {
    const gh = document.querySelector('.reach a[href*="github.com/MattisEngelhardt"]');
    return {
      h2: Array.from(document.querySelectorAll('#contact h2')).map((h) => h.textContent).join(' | '),
      github: !!gh,
      reachCount: document.querySelectorAll('.reach li').length,
    };
  });
  check('chapter readable', contact.h2.includes('The next world is unwritten'));
  check('GitHub link live', contact.github);
  check('reach list present', contact.reachCount >= 4, `count ${contact.reachCount}`);
  await page.screenshot({ path: `${outDir}/horizon-contact.png` });

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
  console.log(`\n=== flight FAILED: ${err.message}`);
}

/* ---- the catalogue ---- */
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  console.log('\n=== catalogue mode on /horizon ===');
  await page.goto(`${base}/horizon`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(1200);
  const cat = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    sceneLive: !!document.querySelector('.hero.is-live'),
    runway:
      (document.getElementById('horizon-track')?.offsetHeight ?? 0) >
      window.innerHeight * 1.5,
    captionHidden: getComputedStyle(document.querySelector('.c1')).display === 'none',
    h2: Array.from(document.querySelectorAll('#contact h2')).map((h) => h.textContent).join(' | '),
  }));
  check('catalogue gate held', cat.mode === 'catalog' && !cat.sceneLive && !cat.runway);
  check('captions hidden in catalogue', cat.captionHidden);
  check('full text present', cat.h2.includes('The next world is unwritten'));
  await page.screenshot({ path: `${outDir}/horizon-catalog.png` });
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
