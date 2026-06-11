/**
 * Runtime verification for the Act-0 hero (TSL only fails at runtime).
 * Drives the dev server with the system Chrome, captures console output,
 * waits for the scene to go live (`.hero.is-live`) and screenshots
 * several time-of-day overrides.
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

const cases = [
  { name: 'now', query: '' },
  { name: 'golden-19.5', query: '?hour=19.5' },
  { name: 'day-13', query: '?hour=13' },
  { name: 'night-2', query: '?hour=2' },
];

let failed = false;

for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
  });

  try {
    await page.goto(`${base}/${c.query}`, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
    // mouse = wind: stir the fog, then let it settle into motion
    await page.mouse.move(400, 300);
    await page.mouse.move(1300, 650, { steps: 25 });
    await page.waitForTimeout(2500);

    const state = await page.evaluate(() => ({
      mode: document.documentElement.dataset.mode,
      daypart: document.documentElement.dataset.daypart,
      webgpu: 'gpu' in navigator,
      canvasSize: (() => {
        const c = document.getElementById('summit-canvas');
        return c ? `${c.width}x${c.height}` : 'missing';
      })(),
    }));

    await page.screenshot({ path: `${outDir}/hero-${c.name}.png` });
    console.log(`\n=== ${c.name} (${c.query || 'real local time'}) ===`);
    console.log('state:', JSON.stringify(state));
  } catch (err) {
    failed = true;
    console.log(`\n=== ${c.name} FAILED: ${err.message}`);
    await page.screenshot({ path: `${outDir}/hero-${c.name}-FAILED.png` }).catch(() => {});
  }

  const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  console.log(`console (${logs.length} msgs, ${errors.length} errors):`);
  for (const l of logs) console.log('  ' + l);
  if (errors.length > 0) failed = true;
  await page.close();
}

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
