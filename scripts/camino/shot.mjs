/**
 * Camino flyover tuning shots. Drives system Chrome with WebGPU and captures
 * /dev/camino at a list of t values (+ optional query tail), so the camera and
 * look can be judged via the Read tool. Usage:
 *   node scripts/camino/shot.mjs [baseUrl] [extraQuery] [t1,t2,...]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4321';
const extra = process.argv[3] ?? '';
const ts = (process.argv[4] ?? '0,0.25,0.5,0.75,1').split(',').map(Number);
mkdirSync('verify-out', { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));

for (const t of ts) {
  const tail = [`t=${t}`, extra.replace(/^\?/, '')].filter(Boolean).join('&');
  const url = `${base}/dev/camino?${tail}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => typeof window.__caminoFps === 'number', { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const tag = `${t}`.replace('.', 'p') + (extra ? '_' + extra.replace(/\W/g, '') : '');
  await page.screenshot({ path: `verify-out/camino-${tag}.png` });
  const fps = await page.evaluate(() => window.__caminoFps);
  console.log(`t=${t}  fps=${fps}  -> verify-out/camino-${tag}.png`);
}
console.log(errs.length ? `\nCONSOLE ERRORS:\n${[...new Set(errs)].join('\n')}` : '\n0 console errors');
await browser.close();
