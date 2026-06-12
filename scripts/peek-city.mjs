/** One-off composition peek: late approach frame + the signal lens. */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`${base}/city`, { waitUntil: 'load' });
await page.waitForSelector('.hero.is-live', { timeout: 25_000 });
await page.waitForTimeout(1500);

const trackHeight = await page.evaluate(() => {
  const track = document.getElementById('approach-track');
  return track ? track.offsetHeight - window.innerHeight : 0;
});

// late approach — the gaze swings up the Porter tower
await page.evaluate((y) => window.scrollTo(0, y), Math.round(trackHeight * 0.83));
await page.waitForTimeout(1800);
await page.screenshot({ path: 'verify-out/city-83.png' });

// the signal lens: wiggle the pointer around mid-frame, then shoot
for (let i = 0; i < 14; i++) {
  await page.mouse.move(700 + i * 12, 420 + Math.sin(i) * 40);
  await page.waitForTimeout(60);
}
await page.waitForTimeout(250);
await page.screenshot({ path: 'verify-out/city-lens.png' });

await browser.close();
console.log('done');
