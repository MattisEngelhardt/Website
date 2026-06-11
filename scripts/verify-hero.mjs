/**
 * Runtime verification for the Act-0 hero (TSL only fails at runtime).
 * Drives the dev server with the system Chrome, captures console output,
 * waits for the scene to go live (`.hero.is-live`) and screenshots:
 *   - several time-of-day overrides (?hour=…)
 *   - the reality-lens debug mask (?lens) at a known cursor position
 *   - the scroll-driven white-out descent at several progress points
 *
 * Usage: node scripts/verify-hero.mjs [baseUrl]
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

async function newScenePage(query) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
  });
  await page.goto(`${base}/${query}`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
  return { page, logs };
}

function reportLogs(name, logs) {
  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]') || l.startsWith('[http'));
  console.log(`console (${logs.length} msgs, ${errors.length} errors):`);
  for (const l of logs) console.log('  ' + l);
  if (errors.length > 0) failed = true;
}

/* ── 1. palettes (and the wanderer figure, visible in every shot) ── */
for (const c of [
  { name: 'now', query: '' },
  { name: 'golden-19.5', query: '?hour=19.5' },
  { name: 'day-13', query: '?hour=13' },
  { name: 'night-2', query: '?hour=2' },
]) {
  try {
    const { page, logs } = await newScenePage(c.query);
    // stillness: let the paint settle before the portrait
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => ({
      mode: document.documentElement.dataset.mode,
      daypart: document.documentElement.dataset.daypart,
      webgpu: 'gpu' in navigator,
    }));
    await page.screenshot({ path: `${outDir}/hero-${c.name}.png` });
    console.log(`\n=== ${c.name} (${c.query || 'real local time'}) ===`);
    console.log('state:', JSON.stringify(state));
    reportLogs(c.name, logs);
    await page.close();
  } catch (err) {
    failed = true;
    console.log(`\n=== ${c.name} FAILED: ${err.message}`);
  }
}

/* ── 2. the reality lens follows the cursor (?lens debug mask) ── */
try {
  const { page, logs } = await newScenePage('?hour=19.5&lens');
  // park the cursor top-left quadrant and keep it moving slightly
  for (let k = 0; k < 12; k++) await page.mouse.move(400 + k * 2, 250 + k, { steps: 2 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/lens-top-left.png` });
  console.log('\n=== lens debug (cursor at ~400,250 — white blob must sit top-left) ===');
  reportLogs('lens', logs);
  await page.close();
} catch (err) {
  failed = true;
  console.log(`\n=== lens FAILED: ${err.message}`);
}

/* ── 3. the descent: scroll → fog thickens → white-out → paper page ── */
try {
  const { page, logs } = await newScenePage('?hour=19.5');
  const trackHeight = await page.evaluate(() => {
    const track = document.getElementById('descent-track');
    return track ? track.offsetHeight - window.innerHeight : 0;
  });
  if (trackHeight < 500) {
    failed = true;
    console.log(`\n=== descent FAILED: track runway missing (${trackHeight}px)`);
  } else {
    for (const p of [0.35, 0.7, 1.0]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * p));
      await page.waitForTimeout(1600); // let scrub + lenis settle
      await page.screenshot({ path: `${outDir}/descent-${Math.round(p * 100)}.png` });
    }
    // past the track: the paper section must be on screen
    await page.evaluate(() => {
      document.getElementById('descent')?.scrollIntoView();
    });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${outDir}/descent-paper.png` });
    console.log(`\n=== descent (runway ${trackHeight}px) ===`);
  }
  reportLogs('descent', logs);
  await page.close();
} catch (err) {
  failed = true;
  console.log(`\n=== descent FAILED: ${err.message}`);
}

/* ── 4. the catalogue: reduced motion must get the full text, no scene ── */
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    sceneLive: !!document.querySelector('.hero.is-live'),
    runway: (document.getElementById('descent-track')?.offsetHeight ?? 0) > window.innerHeight * 1.5,
    heading: document.querySelector('#descent h2')?.textContent?.slice(0, 30),
  }));
  console.log('\n=== catalogue (prefers-reduced-motion) ===');
  console.log('state:', JSON.stringify(state));
  if (state.mode !== 'catalog' || state.sceneLive || state.runway) {
    failed = true;
    console.log('FAILED: catalogue gate did not hold');
  }
  await page.screenshot({ path: `${outDir}/catalog.png` });
  reportLogs('catalog', logs);
  await page.close();
} catch (err) {
  failed = true;
  console.log(`\n=== catalog FAILED: ${err.message}`);
}

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
