/**
 * Workstream B · "My Vacations" — PHOTO pipeline (sharp).
 *
 * Originals live locally in   assets/{montenegro,italien,bayern,österreich}
 * (gitignored, NEVER deployed). For every curated photo we emit committed,
 * budgeted derivatives into  public/assets/vacations/ :
 *
 *   id_480.avif / id_480.webp … id_1920.avif / id_1920.webp   responsive tiers
 *   id_poster.webp                                            its 960w webp
 *   (LQIP blur-up lives inline in the manifest as a base64 data URI)
 *
 * The gallery world consumes ONLY public/assets/vacations/manifest.json.
 * This script owns  type:"photo"  items; it merges with the video script's
 * items by reading + upserting the shared manifest (never wiping videos).
 *
 * Mirrors the proven idiom of scripts/make-painting-derivatives.mjs:
 * ESM, `sharp` import, a small derive() helper, per-file console logging,
 * a final  MEDIA_OK  sentinel, and process.exit(1) on hard failure.
 *
 * Usage:  node scripts/make-vacation-media.mjs
 *         (no args; walks the four input folders. Edit INCLUDE below to curate.)
 */
import sharp from 'sharp';
import {
  mkdirSync, statSync, existsSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { resolve, join, parse } from 'node:path';

// ── layout ──────────────────────────────────────────────────────────────────
const ROOT     = resolve(process.cwd());
const SRC_ROOT = resolve(ROOT, 'assets');
const OUT_DIR  = resolve(ROOT, 'public', 'assets', 'vacations');
const PUB_BASE = '/assets/vacations';                 // browser-facing URL base
const MANIFEST = resolve(OUT_DIR, 'manifest.json');

// folder slug → display "place". Note the umlaut input folder name.
const PLACES = {
  montenegro: 'Montenegro',
  italien:    'Italien',
  bayern:     'Bayern',
  'österreich': 'Österreich',
};
const FOLDERS = Object.keys(PLACES);

const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp']);

const TIERS   = [480, 960, 1440, 1920];
const QUALITY = 78;
const POSTER_TIER = 960;          // which webp tier doubles as the manifest poster
const LQIP_WIDTH  = 20;           // tiny blur-up

/**
 * CURATION (quality over quantity). Leave a folder OUT of this map (or set its
 * value to null) to take ALL photos in it. Provide an array of *basename
 * fragments* (case-insensitive substring match, extension-free) to take only
 * the strongest stills. Montenegro is the richest set — curate it by default;
 * Mattis can edit these lists freely.
 *
 *   INCLUDE.montenegro = ['IMG_1234', 'sunset'] → only files whose name
 *   contains one of those fragments are processed.
 */
const INCLUDE = {
  // montenegro: ['IMG_XXXX', ...],   // ← Mattis: fill with your ~best stills
  // others: undefined → take all photos found
};

// ── helpers ──────────────────────────────────────────────────────────────────
const isPhoto = (f) => PHOTO_EXT.has(parse(f).ext.toLowerCase());

/** stable, filesystem-safe slug for an item id (handles German umlauts) */
function slugify(s) {
  return s
    .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip remaining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function curatedFiles(folder, files) {
  const inc = INCLUDE[folder];
  if (!inc || inc.length === 0) return files;
  const frags = inc.map((x) => x.toLowerCase());
  return files.filter((f) => {
    const base = parse(f).name.toLowerCase();
    return frags.some((fr) => base.includes(fr));
  });
}

/** read existing manifest, tolerating absence / corruption */
function readManifest() {
  if (!existsSync(MANIFEST)) return { generated: '', items: [] };
  try {
    const j = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    if (j && Array.isArray(j.items)) return j;
  } catch (e) {
    console.warn(`! manifest unreadable, starting fresh: ${e.message}`);
  }
  return { generated: '', items: [] };
}

/** merge our freshly-built photo items into the shared manifest and write */
function writeManifest(photoItems) {
  const prev = readManifest();
  // keep everything that is NOT a photo (i.e. the video script's items),
  // then add our regenerated photo items.
  const kept = prev.items.filter((it) => it.type !== 'photo');
  const items = [...kept, ...photoItems];
  // stable order: place, then id
  items.sort((a, b) =>
    (a.place || '').localeCompare(b.place || '') || a.id.localeCompare(b.id));
  const out = { generated: new Date().toISOString(), items };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(out, null, 2));
  console.log(`manifest: ${items.length} items (${photoItems.length} photos, ${kept.length} other) → ${MANIFEST}`);
}

/** one responsive derivative; returns written size in MB */
async function derive(input, id, width, fmt) {
  const out = resolve(OUT_DIR, `${id}_${width}.${fmt}`);
  const pipe = sharp(input, { failOn: 'none' })
    .rotate()                                       // honour EXIF orientation
    .resize({ width, withoutEnlargement: true });
  if (fmt === 'avif') pipe.avif({ quality: QUALITY, effort: 4 });
  else                pipe.webp({ quality: QUALITY, effort: 6, smartSubsample: true });
  await pipe.toFile(out);
  const mb = statSync(out).size / 1e6;
  console.log(`    ${id}_${width}.${fmt}  ${width}w  q${QUALITY}  ${mb.toFixed(2)} MB`);
  return mb;
}

/** tiny inline LQIP as a webp base64 data URI */
async function makeLqip(input) {
  const buf = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: LQIP_WIDTH })
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

/** build the AVIF/WebP srcset strings for the tiers we actually wrote */
function srcsetFor(id, tiers) {
  const list = (fmt) => tiers.map((w) => `${PUB_BASE}/${id}_${w}.${fmt} ${w}w`).join(', ');
  return { avif: list('avif'), webp: list('webp') };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(SRC_ROOT)) {
    console.error(`! input root not found: ${SRC_ROOT}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const items = [];
  let processed = 0, failed = 0;

  for (const folder of FOLDERS) {
    const dir = join(SRC_ROOT, folder);
    if (!existsSync(dir)) { console.log(`· ${folder}: folder absent — skip`); continue; }

    let entries;
    try { entries = readdirSync(dir); }
    catch (e) { console.warn(`· ${folder}: unreadable (${e.message}) — skip`); continue; }

    const photos = curatedFiles(folder, entries.filter(isPhoto)).sort();
    if (photos.length === 0) { console.log(`· ${folder}: no (curated) photos — skip`); continue; }

    const place = PLACES[folder];
    console.log(`\n=== ${place} — ${photos.length} photo(s) ===`);

    let n = 0;
    for (const file of photos) {
      n += 1;
      const id = `${slugify(folder)}-${String(n).padStart(2, '0')}`;
      const input = join(dir, file);
      try {
        const meta = await sharp(input, { failOn: 'none' }).metadata();
        // sharp reports pre-rotation dims; account for EXIF 90/270 swaps.
        const swap = meta.orientation && meta.orientation >= 5;
        const w = swap ? meta.height : meta.width;
        const h = swap ? meta.width  : meta.height;
        console.log(`  ${id}  ${file}  ${w}x${h}`);

        // only emit tiers that don't upscale past the source
        const tiers = TIERS.filter((t) => t <= (w || Infinity));
        if (tiers.length === 0) tiers.push(Math.min(TIERS[0], w || TIERS[0]));

        for (const t of tiers) {
          await derive(input, id, t, 'avif');
          await derive(input, id, t, 'webp');
        }
        const lqip = await makeLqip(input);

        const posterTier = tiers.includes(POSTER_TIER)
          ? POSTER_TIER
          : tiers[tiers.length - 1];

        items.push({
          id,
          type: 'photo',
          place,
          date: '',                                   // TODO(Mattis): fill later
          w: w || 0,
          h: h || 0,
          lqip,
          poster: `${PUB_BASE}/${id}_${posterTier}.webp`,
          srcset: srcsetFor(id, tiers),
          // preview/full are video-only — omitted for photos per schema
        });
        processed += 1;
      } catch (e) {
        failed += 1;
        console.error(`  ! ${id} (${file}) failed: ${e.message}`);
      }
    }
  }

  writeManifest(items);
  console.log(`\nphotos processed: ${processed}, failed: ${failed}`);

  if (processed === 0 && failed > 0) {
    console.error('MEDIA_FAIL — no photo produced any output');
    process.exit(1);
  }
  console.log('MEDIA_OK');
}

main().catch((e) => {
  console.error(`fatal: ${e.stack || e.message}`);
  process.exit(1);
});
