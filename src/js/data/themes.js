/**
 * The hours of the river — the four looks the app can wear.
 *
 * Each one is a time of day on the Long River, so the map changes with it:
 * the same banks by moonlight, in the bayou green, at dusk and by day. The
 * keys are the ones the app shipped with, so a reader's choice carries over.
 *
 * "Kots groen" was the verdict on the single palette this replaces, and the
 * fix is not a nicer green. One person picking one colour for another
 * person's screen is the mistake; the app should ask.
 *
 * Four, not twelve. A list long enough to be a preference and short enough
 * to be read in one look — past about five, choosing stops being a pleasure
 * and becomes a settings chore, and every extra entry is another palette to
 * keep contrast-safe.
 *
 * `swatch` is what the picker paints: ground, accent and cloth, which is the
 * three-colour summary that actually predicts what a room will look like.
 * It is deliberately duplicated from themes.css rather than read back out of
 * the stylesheet — a test compares the two and fails if they drift, which
 * catches the copy going stale without making the picker depend on the
 * browser having finished loading the CSS.
 */

export const THEMES = [
  {
    key: 'midnight',
    name: 'Night',
    blurb: 'Black water, a moon on it, and one lamp lit in the salon.',
    swatch: { bg: '#0a0e15', accent: '#f2b23c', felt: '#1e5c82' },
  },
  {
    key: 'felt',
    name: 'Bayou',
    blurb: 'Green banks, still water and brass fittings. The original cloth.',
    swatch: { bg: '#080d0a', accent: '#d9b44a', felt: '#24714f' },
  },
  {
    key: 'mahogany',
    name: 'Dusk',
    blurb: 'Oxblood, mahogany and copper — the hour the tables fill.',
    swatch: { bg: '#120b0b', accent: '#e08b4c', felt: '#82303c' },
  },
  {
    key: 'daylight',
    name: 'Daylight',
    blurb: 'The river by day, drawn like a pilot\'s chart. For a lit room.',
    swatch: { bg: '#efebe1', accent: '#1c6b45', felt: '#23724e' },
  },
];

/** Midnight, because the reader's first note about the old one was its colour. */
export const DEFAULT_THEME = 'midnight';

export const themeFor = (key) => THEMES.find((th) => th.key === key) || THEMES[0];

/** Unknown keys fall back rather than leaving the page unstyled. */
export const isTheme = (key) => THEMES.some((th) => th.key === key);

/**
 * Paint the choice. One attribute on <html>: every colour in the app is a
 * token defined per `[data-theme]`, so this is the whole mechanism.
 */
export function applyTheme(key, doc = typeof document === 'undefined' ? null : document) {
  const theme = themeFor(key);
  if (!doc || !doc.documentElement) return theme;
  doc.documentElement.setAttribute('data-theme', theme.key);
  // The browser chrome around the page should not stay the old colour.
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.swatch.bg);
  return theme;
}
