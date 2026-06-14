/**
 * Runtime check for the IFFT ocean spike (/dev/ocean).
 * Drives the system Chrome with WebGPU, captures console output, waits for
 * the compute sea to run, reads the on-page FPS counter and screenshots the
 * surface. Headless FPS is NOT honest (brain.md) — this confirms the FFT
 * runs without errors and the surface displaces; the real FPS judgment is
 * Mattis on his RTX-4060 laptop.
 *
 * Usage: node scripts/verify-ocean.mjs [baseUrl] [?n=128]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4323';
const nq = process.argv[3] ?? '';
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

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  const url = `${base}/dev/ocean${nq ? `?${nq.replace(/^\?/, '')}` : ''}`;
  console.log(`\n=== IFFT ocean spike: ${url} ===`);
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

  // wait for the FPS counter to populate (the loop + compute are running)
  await page.waitForFunction(() => typeof window.__oceanFps === 'number', { timeout: 25_000 });
  await page.waitForTimeout(2500); // let the sea build up amplitude

  const fps = await page.evaluate(() => window.__oceanFps);
  const hud = await page.evaluate(() => document.getElementById('hud')?.textContent ?? '');
  check('webgpu sea running (fps reported)', typeof fps === 'number' && fps > 0, `fps=${fps}`);
  console.log('  hud:\n' + hud.split('\n').map((l) => '    ' + l).join('\n'));

  await page.screenshot({ path: `${outDir}/ocean-spike${nq ? '-' + nq.replace(/\W/g, '') : ''}.png` });

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
  console.log(`\n=== ocean spike FAILED: ${err.message}`);
}

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
