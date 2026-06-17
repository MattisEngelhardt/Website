/**
 * Re-grade the gallery plates from the already-captured source renders
 * (verify-out/plate-src-*.png) into the unified Friedrich/Aivazovsky palette —
 * NO dev server needed, fast iteration on the look (blueprint P1.6). Use
 * capture-plates.mjs when the worlds themselves changed and need re-rendering;
 * use this to iterate the grade on the existing captures.
 *
 * Usage: node scripts/grade-plates.mjs
 */
import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gradePlate } from './lib/plate-grade.mjs';

const SRC = 'verify-out';
const OUT = 'public/assets/plates';
mkdirSync(OUT, { recursive: true });

const IDS = ['sea', 'city', 'camino', 'horizon'];
let missing = 0;
for (const id of IDS) {
  const src = resolve(SRC, `plate-src-${id}.png`);
  if (!existsSync(src)) {
    console.log(`  ! no source for ${id} (${src}) — run capture-plates.mjs first`);
    missing++;
    continue;
  }
  const buf = await gradePlate(src, id);
  const out = resolve(OUT, `${id}.webp`);
  writeFileSync(out, buf);
  console.log(`  graded ${id}.webp  ${(statSync(out).size / 1e3).toFixed(0)} KB`);
}
console.log(missing ? '\nGRADE_PARTIAL' : '\nGRADE_OK');
process.exit(missing === IDS.length ? 1 : 0);
