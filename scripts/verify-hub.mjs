/**
 * Runtime check for the Main-Lobby spike (/dev/hub, Workstream A).
 * Drives system Chrome with WebGPU: confirms the scene runs, the gallery
 * plates project to screen, panning swings the gaze, hovering a plate clears
 * the lens + lifts its placard, and the click-dolly fills the view. Captures
 * screenshots for the side-by-side look review (read them with the Read tool).
 * Headless FPS is NOT honest (brain.md) — real FPS is Mattis on his RTX-4060.
 *
 * Usage: node scripts/verify-hub.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4325';
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

const W = 1600, H = 900;

try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  // golden hour so the look matches the reference palette
  const url = `${base}/dev/hub?hour=18.6`;
  console.log(`\n=== main-lobby spike: ${url} ===`);
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

  await page.waitForFunction(() => typeof window.__hubFps === 'number', { timeout: 25_000 });
  await page.waitForTimeout(1800); // let fog drift + plates settle

  const fps = await page.evaluate(() => window.__hubFps);
  check('lobby running (fps reported)', typeof fps === 'number' && fps > 0, `fps=${fps}`);

  // plates project to screen
  const plates = await page.evaluate(() => window.__hubPlates ?? []);
  check('4 gallery plates present', plates.length === 4, `count=${plates.length}`);
  check('at least one plate visible on screen', plates.some((p) => p.visible));

  await page.mouse.move(W / 2, H / 2);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/hub-center.png` });

  // ── pan left: swing the gaze, the left plates should come forward ──
  await page.mouse.move(W * 0.08, H * 0.5, { steps: 24 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/hub-pan-left.png` });

  // ── pan right ──
  await page.mouse.move(W * 0.92, H * 0.5, { steps: 24 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/hub-pan-right.png` });
  await page.mouse.move(W / 2, H / 2, { steps: 16 });
  await page.waitForTimeout(700);

  // ── hover a plate: move the cursor onto a visible plate's projected box ──
  // the placard anchor sits just below the plate centre; aim a bit above it.
  const target = await page.evaluate(() => {
    const list = window.__hubPlates ?? [];
    const vis = list.filter((p) => p.visible).sort((a, b) => b.scale - a.scale)[0];
    return vis ? { id: vis.id, x: vis.x, y: vis.y } : null;
  });
  let hoveredOk = false;
  if (target) {
    // the anchor is below the frame; nudge up into the artwork
    for (const dy of [-120, -90, -150, -60, -180]) {
      await page.mouse.move(target.x, target.y + dy, { steps: 8 });
      await page.waitForTimeout(250);
      const h = await page.evaluate(() => window.__hub?.hoveredId?.() ?? null);
      if (h) { hoveredOk = true; break; }
    }
  }
  check('hovering a plate registers (raycast)', hoveredOk, target ? `plate=${target.id}` : 'no visible plate');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/hub-hover.png` });

  // ── click-dolly: focus the hovered plate, it should fill the view ──
  const focusedId = await page.evaluate(() => window.__hub?.hoveredId?.() ?? null);
  if (focusedId) {
    await page.evaluate((id) => window.__hub.focus(id), focusedId);
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${outDir}/hub-dolly.png` });
    check('click-dolly through the frame ran', true, `plate=${focusedId}`);
    await page.evaluate(() => window.__hub.unfocus());
    await page.waitForTimeout(900);
  } else {
    check('click-dolly through the frame ran', false, 'no plate to focus');
  }

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
  console.log(`\n=== lobby spike FAILED: ${err.message}`);
}

await browser.close();
console.log(failed ? '\nVERDICT: FAIL' : '\nVERDICT: PASS');
process.exit(failed ? 1 : 0);
