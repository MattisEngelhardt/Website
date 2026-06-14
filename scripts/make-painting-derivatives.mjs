/**
 * Progressive raster derivatives for the threshold "through the frame"
 * opening (Act 0). The deep-zoom is driven by CSS transform on a single
 * decoded <img> — crisp because the source truly is gigapixel, and
 * GPU-composited (no per-frame canvas redraw). We ship two sizes:
 *
 *   <name>_overview.webp — small, instant museum view + LCP backdrop
 *   <name>_full.webp     — the deep texture; lazy-decoded behind the
 *                          signature loader, swapped in before the push
 *
 * Usage: node scripts/make-painting-derivatives.mjs <input> <outDir> <name>
 */
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, outDir, name] = process.argv.slice(2);
if (!input || !outDir || !name) {
  console.error('usage: node scripts/make-painting-derivatives.mjs <input> <outDir> <name>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const src = sharp(input, { limitInputPixels: false });
const meta = await src.metadata();
console.log(`source: ${meta.width}x${meta.height} (${input})`);

/** one derivative; returns the written size in MB */
async function derive(suffix, targetWidth, quality) {
  const out = resolve(outDir, `${name}_${suffix}.webp`);
  await sharp(input, { limitInputPixels: false })
    .resize({ width: Math.min(targetWidth, meta.width), withoutEnlargement: true })
    // a museum scan wants faithful colour, not aggressive smoothing
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(out);
  const mb = statSync(out).size / 1e6;
  console.log(`  ${name}_${suffix}.webp  ${targetWidth}w  q${quality}  ${mb.toFixed(2)} MB`);
  return mb;
}

await derive('overview', 1600, 82);
// 4400w keeps brushwork crisp at the deepest push (~6x) while staying
// well inside the per-world asset budget; the .dzi pyramid remains for
// a future OSD-grade viewer if we ever want true 1:1 bristle detail.
await derive('full', 4400, 82);

console.log('DERIVATIVES_OK');
