/**
 * Builds a DeepZoom tile pyramid from a painting scan, for the
 * IIIF-style canvas zoom in the threshold opening (Act 0).
 *
 * Usage: node scripts/make-tiles.mjs <input image> <output dir> <name>
 *   e.g. node scripts/make-tiles.mjs assets-src/paintings/wanderer_commons_2327.jpg public/assets/paintings wanderer
 *
 * Output: <output dir>/<name>.dzi + <output dir>/<name>_files/<level>/<col>_<row>.jpeg
 * The WebGL tile loader streams these by quadtree level (512px tiles,
 * 2px overlap against sampling seams).
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, outDir, name] = process.argv.slice(2);
if (!input || !outDir || !name) {
  console.error('usage: node scripts/make-tiles.mjs <input> <outDir> <name>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const img = sharp(input, { limitInputPixels: false });
const meta = await img.metadata();
console.log(`source: ${meta.width}x${meta.height} (${input})`);

await img
  .jpeg({ quality: 88, mozjpeg: true })
  // ".dz" => sharp writes <name>.dzi + <name>_files/ (".dzi" would double up)
  .tile({ size: 512, overlap: 2, layout: 'dz' })
  .toFile(resolve(outDir, `${name}.dz`));

console.log(`TILES_OK ${outDir}/${name}.dzi`);
