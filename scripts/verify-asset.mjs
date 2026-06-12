/**
 * Pipeline proof verification: Blender → GLB → gltf-transform → chassis.
 * Loads /dev/asset (WebGPURenderer + GLTFLoader + meshopt + WebP) in the
 * system Chrome and checks the asset arrives with real geometry.
 *
 * Usage: node scripts/verify-asset.mjs [baseUrl]
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

  console.log('\n=== pipeline proof: /dev/asset ===');
  await page.goto(`${base}/dev/asset`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('body.is-live', { timeout: 25_000 });
  await page.waitForTimeout(1200); // a few turntable frames

  const state = await page.evaluate(() => window.__assetState);
  check('GLB loaded', state.ready && !state.error, state.error ?? '');
  check('real geometry (>1000 tris)', state.tris > 1000, `${state.tris} tris`);
  check('no console/page/http errors', logs.length === 0, logs.join(' | '));

  await page.screenshot({ path: `${outDir}/asset-proof.png` });
  console.log(`  screenshot: ${outDir}/asset-proof.png`);
} catch (e) {
  failed = true;
  console.error(`FAIL ${e.message}`);
}

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
