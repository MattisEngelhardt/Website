/**
 * Unified painterly colour-grade for the Main-Lobby gallery plates (Workstream
 * A, blueprint P1.6). The four worlds are rendered in wildly different palettes
 * — the Sea is warm pink/gold, the Horizon a golden cloud-sea, but the City is
 * a cool navy/neon night and the Camino a loud green satellite terrain. Hung
 * side by side in one Friedrich fog they read as a "collage of screenshots."
 *
 * This grade pulls all four into ONE golden-hour painted world: desaturate the
 * loud chroma, warm everything toward a sepia-gold via a sepia↔identity recomb
 * blend, lift the blacks to an atmospheric floor (no crushed darks — Friedrich's
 * shadows glow), gentle contrast, then a vignette + warm centre-glow so each
 * plate reads as a lit painted object. The in-world Kuwahara pass then repaints
 * them as brushwork → genuinely "a painting inside a painting."
 *
 * Shared by `grade-plates.mjs` (re-grade from captured source PNGs, no dev
 * server) and `capture-plates.mjs` (grade fresh captures the same way).
 */
import sharp from 'sharp';

// sepia primary — full sepia is monochrome; we blend it with identity per plate
// so local colour survives but the hue family unifies toward warm gold.
const SEPIA = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
];
const IDENT = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** recomb matrix = mix(identity, sepia, k) */
function sepiaBlend(k) {
  return SEPIA.map((row, i) => row.map((v, j) => IDENT[i][j] * (1 - k) + v * k));
}

/**
 * Per-plate grade settings. `sepia` = how hard to pull toward sepia-gold (kills
 * off-palette hues — Camino's green needs the most). `sat` pre-desaturation,
 * `bright` exposure, `lift` atmospheric black-floor (0..255 added to shadows),
 * `contrast` final slope. Sea/Horizon are already on-palette → a light touch;
 * City/Camino get pulled in hard.
 */
export const PLATE_GRADE = {
  sea:     { sepia: 0.30, sat: 0.94, bright: 1.02, lift: 8,  contrast: 1.05, wash: 0.06 },
  horizon: { sepia: 0.28, sat: 0.95, bright: 1.02, lift: 6,  contrast: 1.04, wash: 0.05 },
  city:    { sepia: 0.50, sat: 0.86, bright: 1.14, lift: 22, contrast: 1.08, wash: 0.10 },
  camino:  { sepia: 0.62, sat: 0.70, bright: 1.16, lift: 14, contrast: 1.07, wash: 0.16 },
};

/** the warm vignette + centre-glow overlay (one per output size) */
function vignetteSvg(w, h) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <radialGradient id="v" cx="50%" cy="44%" r="72%">
           <stop offset="0%"  stop-color="rgb(255,226,176)" stop-opacity="0.12"/>
           <stop offset="52%" stop-color="rgb(255,226,176)" stop-opacity="0"/>
           <stop offset="100%" stop-color="rgb(24,15,9)" stop-opacity="0.46"/>
         </radialGradient>
       </defs>
       <rect width="${w}" height="${h}" fill="url(#v)"/>
     </svg>`,
  );
}

/**
 * Grade one plate. `input` is a path or Buffer (the captured source render).
 * Returns a webp Buffer at w×h, cover-cropped, in the unified painted palette.
 */
export async function gradePlate(input, id, { w = 1200, h = 800 } = {}) {
  const g = PLATE_GRADE[id] ?? PLATE_GRADE.sea;
  const base = await sharp(input, { limitInputPixels: false })
    .resize({ width: w, height: h, fit: 'cover', position: 'centre' })
    .modulate({ saturation: g.sat, brightness: g.bright })
    .recomb(sepiaBlend(g.sepia))
    // contrast about mid-grey, then lift the floor so blacks become atmospheric
    .linear(g.contrast, -(g.contrast - 1) * 128 + g.lift)
    .toColourspace('srgb')
    .toBuffer();

  // a faint shared golden wash locks all four plates to ONE light source —
  // soft-light keeps it subtle (warms midtones, leaves highlights/darks intact),
  // pulling the cooler/greyer plates (Camino) into the same gold as Sea/Horizon.
  const warmWash = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${w}" height="${h}" fill="rgb(255,221,168)" fill-opacity="${g.wash ?? 0.1}"/>
     </svg>`,
  );

  return sharp(base)
    .composite([
      { input: warmWash, blend: 'soft-light' },
      { input: vignetteSvg(w, h), blend: 'over' },
    ])
    .webp({ quality: 86, effort: 6 })
    .toBuffer();
}
