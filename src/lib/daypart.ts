/**
 * The visitor's clock paints the sky — one daypart attribute on <html>
 * drives every CSS fallback palette and the painted scene tints.
 *
 * `?hour=19.5` is the dev override for the whole system.
 * Keep in sync with the first-paint inline script in pages/index.astro.
 */
export function applyDaypart(): void {
  const q = parseFloat(new URLSearchParams(location.search).get('hour') ?? '');
  const h = Number.isFinite(q) ? ((q % 24) + 24) % 24 : new Date().getHours();
  document.documentElement.dataset.daypart =
    h < 5 ? 'night' : h < 9 ? 'dawn' : h < 17 ? 'day' : h < 19 ? 'golden' : h < 22 ? 'dusk' : 'night';
}
