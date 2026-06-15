/**
 * Camino flyover — satellite drape.
 *
 * Pulls Sentinel-2 cloudless 2024 (EOX, CC-BY-4.0) over the route bbox via
 * WMS GetMap, in vertical bands (servers cap a single tile's height), stitches
 * them with sharp, and writes the draped texture:
 *   public/assets/camino/camino_sat.webp
 *
 * Attribution (required, rendered on /camino):
 *   Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH
 *   (Contains modified Copernicus Sentinel data 2024)
 *
 * Run:  NODE_OPTIONS=--use-system-ca node scripts/camino/fetch_satellite.mjs
 */
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GEO = JSON.parse(await readFile(join(ROOT, 'scripts', 'camino', 'geo.json'), 'utf8'));
const { lonMin, latMin, lonMax, latMax } = GEO.bbox;

const FULL_W = 2048;
const lonSpan = lonMax - lonMin;
const latSpan = latMax - latMin;
const FULL_H = Math.round(FULL_W * (latSpan / lonSpan)); // plate-carrée, undistorted
const BAND_MAX = 2000;
const nBands = Math.ceil(FULL_H / BAND_MAX);
const bandH = Math.ceil(FULL_H / nBands);

console.log(`satellite: ${FULL_W}×${FULL_H} in ${nBands} bands of ~${bandH}px`);

function wmsUrl(bbox, w, h) {
  const p = new URLSearchParams({
    service: 'WMS', version: '1.1.1', request: 'GetMap',
    layers: 's2cloudless-2024', srs: 'EPSG:4326',
    bbox: bbox.join(','), width: String(w), height: String(h),
    format: 'image/jpeg',
  });
  return `https://tiles.maps.eox.at/wms?${p}`;
}

const composites = [];
for (let i = 0; i < nBands; i++) {
  const y0 = i * bandH;
  const y1 = Math.min(FULL_H, y0 + bandH);
  const h = y1 - y0;
  // row 0 = north (latMax); rows increase southward
  const latTop = latMax - (y0 / FULL_H) * latSpan;
  const latBot = latMax - (y1 / FULL_H) * latSpan;
  const url = wmsUrl([lonMin, latBot, lonMax, latTop], FULL_W, h);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`band ${i}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error(`band ${i}: suspiciously small (${buf.length}b) — likely a WMS ServiceException`);
  composites.push({ input: buf, top: y0, left: 0 });
  console.log(`  band ${i}: rows ${y0}–${y1}  (${h}px, ${(buf.length / 1024).toFixed(0)} KB)`);
}

const stitched = await sharp({
  create: { width: FULL_W, height: FULL_H, channels: 3, background: { r: 6, g: 12, b: 24 } },
})
  .composite(composites)
  .png()
  .toBuffer();

await mkdir(join(ROOT, 'assets-src', 'camino'), { recursive: true });
await writeFile(join(ROOT, 'assets-src', 'camino', 'sat_full.png'), stitched);

await mkdir(join(ROOT, 'public', 'assets', 'camino'), { recursive: true });
const webp = await sharp(stitched).webp({ quality: 82 }).toBuffer();
await writeFile(join(ROOT, 'public', 'assets', 'camino', 'camino_sat.webp'), webp);

console.log(`wrote camino_sat.webp (${(webp.length / 1024 / 1024).toFixed(2)} MB) + sat_full.png`);
