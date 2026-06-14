/**
 * The Signature loader — "Mattis E.", written by hand.
 *
 * The first breath of the site (juliencalot's signature-as-loader, in
 * Mattis' own hand): the name draws itself in an elegant script, then
 * the terminal of the E sweeps back to the left and underlines the
 * whole word — the way a real signature closes. The written mark stays;
 * the dark sheet lifts to reveal the museum.
 *
 * Armed only on the first visit of a session (a head script sets
 * <html data-loading>, gated on reduced-motion / save-data), so repeat
 * navigations and no-JS reads never wait behind it. The drawing itself
 * is pure CSS keyed off `.writing`; this module only waits for the
 * font, starts it, and lifts the sheet.
 */

const WRITE_MS = 2900; // word reveal + flourish + a held beat
const LIFT_MS = 900; // the sheet rising away
const FONT_TIMEOUT = 1500;

export async function playSignature(): Promise<void> {
  const root = document.documentElement;
  if (root.dataset.loading !== '1') return; // not armed for this load

  const loader = document.getElementById('signature-loader');
  if (!loader) {
    root.removeAttribute('data-loading');
    return;
  }

  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  try {
    await Promise.race([
      fonts ? fonts.ready : Promise.resolve(),
      new Promise((r) => setTimeout(r, FONT_TIMEOUT)),
    ]);
  } catch {
    /* draw with whatever is available */
  }

  // a frame so the font swap settles before the reveal edge moves
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  loader.classList.add('writing');

  await new Promise((r) => setTimeout(r, WRITE_MS));
  loader.classList.add('done');

  await new Promise((r) => setTimeout(r, LIFT_MS));
  loader.style.display = 'none';
  root.removeAttribute('data-loading');
  try {
    sessionStorage.setItem('seen-signature', '1');
  } catch {
    /* private mode — fine, it just plays again next load */
  }
}
