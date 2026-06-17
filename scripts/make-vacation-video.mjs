/**
 * Workstream B · "My Vacations" — VIDEO pipeline (ffmpeg wrapper).
 *
 * Originals live locally in   assets/{montenegro,italien,bayern,österreich}
 * (gitignored, NEVER deployed). For every CURATED video we emit committed,
 * budgeted derivatives into  public/assets/vacations/ , in three tiers
 * (the §5-B3 "4K-without-lag" strategy — never ship the 4K source):
 *
 *   (a) WALL PREVIEW-LOOP   id_preview.webm (AV1) + id_preview.mp4 (H.264)
 *                           ~640px, ~5s, MUTED, low bitrate, target < 1 MB
 *   (b) LIGHTBOX            id_1080.mp4 (H.264 + AAC, WITH audio), ~3–8 MB
 *   (c) POSTER FRAME        id_poster.webp  (grabbed at ~1s) + inline LQIP
 *
 * All H.264/mp4 get  -movflags +faststart . HDR sources are tonemapped to
 * SDR (zscale → tonemap) so they aren't washed out.
 *
 * The gallery world consumes ONLY public/assets/vacations/manifest.json.
 * This script owns  type:"video"  items; it merges with the photo script's
 * items by reading + upserting the shared manifest (never wiping photos).
 *
 * Mirrors scripts/make-painting-derivatives.mjs in spirit (ESM, helper +
 * logging, a final  VIDEO_OK  sentinel, exit codes). ffmpeg/ffprobe are
 * detected gracefully; FFMPEG_PATH / FFPROBE_PATH env overrides are honoured.
 *
 * Usage:  node scripts/make-vacation-video.mjs
 *         (no args; walks the four input folders. Edit INCLUDE below to curate.)
 */
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import {
  mkdirSync, statSync, existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync,
} from 'node:fs';
import { resolve, join, parse } from 'node:path';

// ── layout ──────────────────────────────────────────────────────────────────
const ROOT     = resolve(process.cwd());
const SRC_ROOT = resolve(ROOT, 'assets');
const OUT_DIR  = resolve(ROOT, 'public', 'assets', 'vacations');
const PUB_BASE = '/assets/vacations';
const MANIFEST = resolve(OUT_DIR, 'manifest.json');

const PLACES = {
  montenegro: 'Montenegro',
  italien:    'Italien',
  bayern:     'Bayern',
  'österreich': 'Österreich',
};
const FOLDERS = Object.keys(PLACES);

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm']);

// ── tier params ──────────────────────────────────────────────────────────────
const PREVIEW_W   = 640;     // wall loop width
const PREVIEW_SEC = 5;       // wall loop length (seconds, trimmed from 0)
const LIGHTBOX_H  = 1080;    // lightbox vertical resolution
const POSTER_AT   = 1;       // grab poster ~1s in
const LQIP_WIDTH  = 20;

// AV1 quality (libsvtav1 CRF: lower = better; ~50 is tiny + fine for a muted
// 640px loop). H.264 CRF for the preview is high (smaller) since it's a fallback.
const AV1_CRF        = 50;
const PREVIEW_H264_CRF = 32;
const LIGHTBOX_CRF   = 25;   // H.264 visually-clean lightbox
const LIGHTBOX_ABR   = '128k';
const LIGHTBOX_MAXSEC = 30;  // cap lightbox length — bounds file size (a gallery
                             // clip needs ~30s, not minutes; keeps us < CF 25MB)
const LIGHTBOX_MAXRATE = '3.5M'; // hard bitrate ceiling → 30s × 3.5M ≈ 13MB max
const LIGHTBOX_BUFSIZE = '7M';
// libsvtav1 isn't built into the portable ffmpeg-static binary → skip the AV1
// webm preview (the H.264 mp4 preview is the universal fallback and is tiny).
const HAS_AV1 = false;

/**
 * CURATION — Montenegro is the richest set (~21 files); take the strongest
 * ~8–10, not all. Two ways, both editable by Mattis:
 *
 *   1) INCLUDE[folder] = ['IMG_1234', 'drone'] — explicit basename fragments
 *      (case-insensitive substring, extension-free). If present, ONLY those.
 *   2) MAX_PER_FOLDER  — if no explicit include for a folder, auto-curate by a
 *      simple heuristic: prefer the LARGEST files (bigger ≈ more detail/longer)
 *      and cap at this many. Set to Infinity to take all.
 */
const INCLUDE = {
  // montenegro: ['IMG_XXXX', 'IMG_YYYY', ...],  // ← Mattis: your ~8–10 best clips
};
const MAX_PER_FOLDER = { montenegro: 10 }; // default cap for the rich set
const DEFAULT_MAX    = Infinity;           // other folders: take all by default

// ── ffmpeg / ffprobe discovery ───────────────────────────────────────────────
function probeBin(envVar, fallback) {
  const cand = process.env[envVar] || fallback;
  const r = spawnSync(cand, ['-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return cand;
}
// derive a sibling ffprobe path from an explicit FFMPEG_PATH if given
function siblingFfprobe() {
  const fm = process.env.FFMPEG_PATH;
  if (!fm) return 'ffprobe';
  const p = parse(fm);
  return join(p.dir, `ffprobe${p.ext || ''}`);
}
const FFMPEG  = probeBin('FFMPEG_PATH', 'ffmpeg');
const FFPROBE = probeBin('FFPROBE_PATH', siblingFfprobe());

// ── small helpers ────────────────────────────────────────────────────────────
const isVideo = (f) => VIDEO_EXT.has(parse(f).ext.toLowerCase());

function slugify(s) {
  return s
    .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** run ffmpeg with an args array; returns true on success, logs on failure */
function ff(args, label) {
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  if (r.error) { console.error(`    ! ${label}: ${r.error.message}`); return false; }
  if (r.status !== 0) {
    const tail = (r.stderr || '').trim().split('\n').slice(-4).join('\n      ');
    console.error(`    ! ${label} (ffmpeg exit ${r.status}):\n      ${tail}`);
    return false;
  }
  return true;
}

/** detect: returns { width, height, isHDR, durationSec } or null */
function probe(input) {
  if (!FFPROBE) return null;
  const r = spawnSync(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries',
    'stream=width,height,color_transfer,color_primaries:format=duration',
    '-of', 'json', input,
  ], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stdout);
    const s = (j.streams && j.streams[0]) || {};
    const ct = (s.color_transfer || '').toLowerCase();
    const cp = (s.color_primaries || '').toLowerCase();
    const isHDR = /smpte2084|arib-std-b67|hlg/.test(ct) || /bt2020/.test(cp);
    return {
      width: s.width || 0,
      height: s.height || 0,
      isHDR,
      durationSec: parseFloat((j.format && j.format.duration) || '0') || 0,
    };
  } catch { return null; }
}

/** the HDR→SDR tonemap chain (prepended to a scale filter when needed) */
function tonemapPrefix(isHDR) {
  return isHDR
    ? 'zscale=transfer=linear:npl=100,tonemap=tonemap=hable:desat=0,'
      + 'zscale=transfer=bt709:matrix=bt709:primaries=bt709,format=yuv420p,'
    : '';
}

function curatedVideos(folder, dir, files) {
  const inc = INCLUDE[folder];
  if (inc && inc.length) {
    const frags = inc.map((x) => x.toLowerCase());
    return files.filter((f) => {
      const base = parse(f).name.toLowerCase();
      return frags.some((fr) => base.includes(fr));
    }).sort();
  }
  const cap = MAX_PER_FOLDER[folder] ?? DEFAULT_MAX;
  if (cap === Infinity) return files.slice().sort();
  // heuristic: largest files first, take top `cap`, then restore name order
  const sized = files.map((f) => {
    let size = 0;
    try { size = statSync(join(dir, f)).size; } catch {}
    return { f, size };
  });
  sized.sort((a, b) => b.size - a.size);
  return sized.slice(0, cap).map((x) => x.f).sort();
}

// ── manifest merge (shared with the photo script) ────────────────────────────
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
function writeManifest(videoItems) {
  const prev = readManifest();
  const kept = prev.items.filter((it) => it.type !== 'video'); // keep photos etc.
  const items = [...kept, ...videoItems];
  items.sort((a, b) =>
    (a.place || '').localeCompare(b.place || '') || a.id.localeCompare(b.id));
  const out = { generated: new Date().toISOString(), items };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(out, null, 2));
  console.log(`manifest: ${items.length} items (${videoItems.length} videos, ${kept.length} other) → ${MANIFEST}`);
}

// ── per-tier encoders ────────────────────────────────────────────────────────
/** (a1) preview loop — AV1/WebM, muted, ~640px, ~5s */
function encPreviewWebm(input, id, isHDR) {
  const out = resolve(OUT_DIR, `${id}_preview.webm`);
  const vf = `${tonemapPrefix(isHDR)}scale=${PREVIEW_W}:-2:flags=lanczos`;
  const ok = ff([
    '-y', '-ss', '0', '-t', String(PREVIEW_SEC), '-i', input,
    '-an',                                   // MUTED
    '-vf', vf,
    '-c:v', 'libsvtav1', '-crf', String(AV1_CRF),
    '-preset', '6', '-pix_fmt', 'yuv420p',
    '-svtav1-params', 'tune=0',
    out,
  ], `${id} preview.webm (AV1)`);
  return ok ? out : null;
}
/** (a2) preview loop — H.264/mp4 fallback, muted, faststart */
function encPreviewMp4(input, id, isHDR) {
  const out = resolve(OUT_DIR, `${id}_preview.mp4`);
  const vf = `${tonemapPrefix(isHDR)}scale=${PREVIEW_W}:-2:flags=lanczos`;
  const ok = ff([
    '-y', '-ss', '0', '-t', String(PREVIEW_SEC), '-i', input,
    '-an',
    '-vf', vf,
    '-c:v', 'libx264', '-crf', String(PREVIEW_H264_CRF),
    '-preset', 'slow', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    out,
  ], `${id} preview.mp4 (H.264)`);
  return ok ? out : null;
}
/** (b) lightbox — 1080p H.264 + AAC, WITH audio, faststart */
function encLightbox(input, id, isHDR) {
  const out = resolve(OUT_DIR, `${id}_1080.mp4`);
  // never upscale past source height; keep even dims
  const vf = `${tonemapPrefix(isHDR)}scale=-2:'min(${LIGHTBOX_H},ih)':flags=lanczos`;
  const ok = ff([
    '-y', '-i', input,
    '-t', String(LIGHTBOX_MAXSEC),
    '-vf', vf,
    '-c:v', 'libx264', '-crf', String(LIGHTBOX_CRF),
    '-maxrate', LIGHTBOX_MAXRATE, '-bufsize', LIGHTBOX_BUFSIZE,
    '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', LIGHTBOX_ABR,
    '-movflags', '+faststart',
    out,
  ], `${id} 1080.mp4 (H.264+AAC)`);
  return ok ? out : null;
}
/** (c) poster frame → webp, plus tiny inline LQIP */
async function encPoster(input, id, isHDR, durationSec) {
  const png = resolve(OUT_DIR, `${id}_poster_tmp.png`);
  const at = Math.min(POSTER_AT, Math.max(0, (durationSec || POSTER_AT) - 0.1));
  const vf = `${tonemapPrefix(isHDR)}scale=-1:-1`;
  const ok = ff([
    '-y', '-ss', String(at), '-i', input,
    '-frames:v', '1', '-vf', vf,
    png,
  ], `${id} poster frame`);
  if (!ok) return null;

  const posterWebp = resolve(OUT_DIR, `${id}_poster.webp`);
  let lqip = '';
  try {
    await sharp(png).webp({ quality: 80, effort: 6 }).toFile(posterWebp);
    const buf = await sharp(png)
      .resize({ width: LQIP_WIDTH })
      .webp({ quality: 40 })
      .toBuffer();
    lqip = `data:image/webp;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error(`    ! ${id} poster encode: ${e.message}`);
    return null;
  } finally {
    try { if (existsSync(png)) unlinkSync(png); } catch {}
  }
  return { poster: `${PUB_BASE}/${id}_poster.webp`, lqip };
}

const mb = (p) => { try { return statSync(p).size / 1e6; } catch { return 0; } };

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!FFMPEG) {
    console.error('ffmpeg not found — install it or set FFMPEG_PATH (e.g. FFMPEG_PATH=C:\\ffmpeg\\bin\\ffmpeg.exe).');
    process.exit(1);
  }
  console.log(`ffmpeg: ${FFMPEG}${FFPROBE ? `   ffprobe: ${FFPROBE}` : '   (ffprobe missing — HDR/dim detection limited)'}`);
  if (!FFPROBE) console.warn('! ffprobe not found — set FFPROBE_PATH for HDR tonemap + correct w/h. Proceeding with defaults.');

  if (!existsSync(SRC_ROOT)) { console.error(`! input root not found: ${SRC_ROOT}`); process.exit(1); }
  mkdirSync(OUT_DIR, { recursive: true });

  const items = [];
  let processed = 0, failed = 0;

  for (const folder of FOLDERS) {
    const dir = join(SRC_ROOT, folder);
    if (!existsSync(dir)) { console.log(`· ${folder}: folder absent — skip`); continue; }

    let entries;
    try { entries = readdirSync(dir); }
    catch (e) { console.warn(`· ${folder}: unreadable (${e.message}) — skip`); continue; }

    const all = entries.filter(isVideo);
    const vids = curatedVideos(folder, dir, all);
    if (vids.length === 0) { console.log(`· ${folder}: no (curated) videos — skip`); continue; }

    const place = PLACES[folder];
    console.log(`\n=== ${place} — ${vids.length}/${all.length} video(s) (curated) ===`);

    let n = 0;
    for (const file of vids) {
      n += 1;
      const id = `${slugify(folder)}-v${String(n).padStart(2, '0')}`;
      const input = join(dir, file);
      const info = probe(input) || { width: 0, height: 0, isHDR: false, durationSec: 0 };
      const w = info.width, h = info.height;
      console.log(`  ${id}  ${file}  ${w}x${h}${info.isHDR ? '  [HDR→SDR]' : ''}  ${info.durationSec.toFixed(1)}s`);

      try {
        const webm = HAS_AV1 ? encPreviewWebm(input, id, info.isHDR) : null;
        const pmp4 = encPreviewMp4(input, id, info.isHDR);
        const full = encLightbox(input, id, info.isHDR);
        const poster = await encPoster(input, id, info.isHDR, info.durationSec);

        if (!poster || (!webm && !pmp4) || !full) {
          failed += 1;
          console.error(`  ! ${id}: incomplete tiers — skipping from manifest`);
          continue;
        }

        const preview = [];
        if (webm) preview.push({ src: `${PUB_BASE}/${id}_preview.webm`, type: 'video/webm', mb: +mb(webm).toFixed(2) });
        if (pmp4) preview.push({ src: `${PUB_BASE}/${id}_preview.mp4`,  type: 'video/mp4',  mb: +mb(pmp4).toFixed(2) });
        // strip the internal mb field, keep best-first ordering (webm then mp4)
        const previewClean = preview.map(({ src, type }) => ({ src, type }));

        for (const p of preview) {
          if (p.mb >= 1) console.warn(`    · note: ${p.src.split('/').pop()} = ${p.mb} MB (preview budget < 1 MB)`);
        }
        const fullMb = mb(full);
        if (fullMb > 8) console.warn(`    · note: ${id}_1080.mp4 = ${fullMb.toFixed(2)} MB (lightbox target 3–8 MB)`);
        console.log(`    tiers ok: preview[${previewClean.map((p) => p.type.split('/')[1]).join('+')}] ${fullMb.toFixed(2)}MB lightbox + poster`);

        items.push({
          id,
          type: 'video',
          place,
          date: '',                              // TODO(Mattis): fill later
          w, h,
          lqip: poster.lqip,
          poster: poster.poster,                 // video → poster frame
          // srcset omitted for video per schema
          preview: previewClean,                 // muted loop, best-first
          full: [{ src: `${PUB_BASE}/${id}_1080.mp4`, type: 'video/mp4' }],
        });
        processed += 1;
      } catch (e) {
        failed += 1;
        console.error(`  ! ${id} (${file}) failed: ${e.message}`);
      }
    }
  }

  writeManifest(items);
  console.log(`\nvideos processed: ${processed}, failed: ${failed}`);

  if (processed === 0 && failed > 0) {
    console.error('VIDEO_FAIL — no video produced a complete set of tiers');
    process.exit(1);
  }
  console.log('VIDEO_OK');
}

main().catch((e) => {
  console.error(`fatal: ${e.stack || e.message}`);
  process.exit(1);
});
