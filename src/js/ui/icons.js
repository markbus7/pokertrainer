/**
 * The interface's iconography.
 *
 * It used to be emoji — 305 of them, and the ones doing interface work were
 * the problem: 📋 for a clipboard, 🔍 for review, 📊 for a chart, 🧭 for the
 * coach. Emoji are somebody else's drawings at somebody else's weight, they
 * change shape on every platform, they cannot take the interface's colour,
 * and a screen full of them reads as a prototype however careful the rest is.
 *
 * These are drawn on one 24-unit grid at one stroke weight, they inherit
 * `currentColor`, and there are no dependencies to fetch. Emoji still do the
 * jobs emoji are good at: rank emblems and achievements are characters with
 * names, not controls.
 */

export const ICON_PATHS = {
  /* --- navigation ------------------------------------------------ */
  train: 'M12 3v18M3 12h18',
  play: 'M6 4l14 8-14 8V4z',
  lab: 'M9 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L15 9V3M8 3h8M7.5 14h9',
  gauntlet: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z',
  bankroll: 'M3 7h18v12H3zM3 7l3-4h12l3 4M8 13h8',
  review: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21',
  charts: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  glossary: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4zM8 8h7M8 12h7',
  progress: 'M4 20h16M6 20V9M12 20V4M18 20v-8',

  /* --- states and objects ---------------------------------------- */
  coach: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z',
  check: 'M4 12.5l5.5 5.5L20 7',
  cross: 'M6 6l12 12M18 6L6 18',
  lock: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4',
  cold: 'M12 2v20M12 6l4-3M12 6L8 3M12 18l4 3M12 18l-4 3M3.5 7l17 10M3.5 7l.7 4.8M3.5 7l4.8-.7M20.5 17l-.7-4.8M20.5 17l-4.8.7',
  clipboard: 'M9 4h6v3H9zM9 5.5H6v15h12v-15h-3',
  cards: 'M8 6h9v14H8zM5.5 8.5L4 9v10l4 1',
  chip: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v5M12 16v5M3 12h5M16 12h5',
  spark: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM19 19H6',
  warn: 'M12 4l9 16H3l9-16zM12 10v4M12 17v.5',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  arrowRight: 'M4 12h15M13 6l6 6-6 6',
  arrowLeft: 'M20 12H5M11 18l-6-6 6-6',
  ladder: 'M7 2v20M17 2v20M7 7h10M7 12h10M7 17h10',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.5 2',

  /* --- one per training module, drawn for the thing it teaches ---- */
  'm-hand-rankings': 'M7 4h10v16H7zM10 8h4M10 12h4M10 16h4',
  'm-pot-odds': 'M12 3v18M7 8h7a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 0 0 5h8',
  'm-outs': 'M12 21s-8-4.5-8-10a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 5.5-8 10-8 10zM12 9v5M9.5 11.5h5',
  'm-preflop': 'M4 5h16M4 10h16M4 15h9M4 20h5',
  'm-position': 'M4 18a8 8 0 0 1 16 0M12 18l5-6M12 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  'm-cbet': 'M4 18V7M4 18h16M8 14l4-5 3 3 5-6',
  'm-mdf': 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4zM9 12l2 2 4-4',
  'm-bluffing': 'M5 8a3 3 0 0 1 6 0c0 2-3 2.5-3 4M8 16v.5M13 8a3 3 0 0 1 6 0c0 2-3 2.5-3 4M16 16v.5',
  'm-spr': 'M5 20V10M11 20V4M17 20v-7M3 20h18M5 7l3-3 3 3',
  'm-exploit': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21M8.5 11h5M11 8.5v5',
  'm-icm': 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-2.5L7 19l1-6-4-4 5.5-.5z',
  'm-bankroll': 'M3 8h18v11H3zM3 8l2.5-4h13L21 8M7 13h4M16 12.5v3',
};

export const ICON_NAMES = Object.keys(ICON_PATHS);

/**
 * @param {string} name  one of ICON_NAMES
 * @param {object} [opts] size in px, and extra classes
 * @returns {SVGElement|null} null for an unknown name, so a typo shows as
 *   nothing rather than as a broken glyph in the middle of a sentence.
 */
export function icon(name, { size = 18, className = '' } = {}) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon ${className}`.trim());
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  return svg;
}
