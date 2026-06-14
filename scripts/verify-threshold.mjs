/**
 * Runtime verification for the Act-0 opening sequence:
 *   1. the signature loader ("Mattis E." writing itself)
 *   2. the museum threshold (his painting, framed)
 *   3. the push through the canvas → dissolve → the living summit
 *   4. the descent into the white-out
 *
 * Captures frames at each beat for a side-by-side look review, and a
 * contact sheet of the whole sequence. Usage: node scripts/verify-threshold.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://localhost:4321';
const outDir = 'verify-out';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11'],
});

let failed = false;
const logs = [];
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
});

await page.goto(`${base}/?hour=19.5`, { waitUntil: 'load', timeout: 30_000 });

/* ── 1. the signature loader, mid-write ── */
const loaderShots = [];
for (const ms of [500, 1300, 2200]) {
  await page.waitForTimeout(ms - (loaderShots.length ? [500, 1300, 2200][loaderShots.length - 1] : 0));
  const armed = await page.evaluate(() => document.documentElement.hasAttribute('data-loading'));
  const p = `${outDir}/open-loader-${ms}.png`;
  await page.screenshot({ path: p });
  loaderShots.push(p);
  console.log(`loader @${ms}ms — armed=${armed}`);
}

/* ── 2. wait for the sheet to lift, scene to go live ── */
try {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-loading'), { timeout: 8000 });
} catch {
  failed = true;
  console.log('FAIL: loader never lifted');
}
await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
await page.waitForTimeout(800);

const runway = await page.evaluate(() => {
  const t = document.getElementById('descent-track');
  return t ? t.offsetHeight - window.innerHeight : 0;
});
console.log(`runway: ${runway}px  (expect > 2000 in full mode)`);
if (runway < 1500) failed = true;

/* ── 3. the opening sequence, beat by beat ── */
const beats = [
  ['museum', 0.0],
  ['approach', 0.16],
  ['into-canvas', 0.34],
  ['dissolve', 0.46],
  ['arrive', 0.54],
  ['summit', 0.6],
  ['descent', 0.82],
  ['whiteout', 1.0],
];
const seqShots = [];
for (const [name, p] of beats) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(runway * p));
  await page.waitForTimeout(1300); // scrub + lenis settle
  const path = `${outDir}/open-${name}.png`;
  await page.screenshot({ path });
  seqShots.push(path);
}

/* ── contact sheet of the whole sequence ── */
async function sheet(file, shots, cols) {
  const cell = { w: 400, h: 225 };
  const rows = Math.ceil(shots.length / cols);
  const tiles = await Promise.all(
    shots.map(async (s, i) => ({
      input: await sharp(s).resize(cell.w, cell.h, { fit: 'cover' }).toBuffer(),
      left: (i % cols) * cell.w,
      top: Math.floor(i / cols) * cell.h,
    })),
  );
  await sharp({
    create: { width: cols * cell.w, height: rows * cell.h, channels: 3, background: '#0b0c10' },
  })
    .composite(tiles)
    .png()
    .toFile(`${outDir}/${file}`);
  console.log(`contact sheet → ${outDir}/${file}`);
}
await sheet('open-sequence.png', [...loaderShots, ...seqShots], 4);

const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]') || l.startsWith('[http'));
console.log(`\nconsole (${logs.length} msgs, ${errors.length} errors):`);
for (const l of logs) console.log('  ' + l);
if (errors.length > 0) failed = true;

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
