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
  river: 'M9 2c-3.5 4.5 9.5 5.5 6 10.5S5.5 17 9 22M4 6.5c1.2.6 2.3.6 3.4 0M16.8 18c1.2.6 2.3.6 3.4 0',
  grid: 'M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16',
  ledger: 'M12 6.5C10 5 7 4.5 4 5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v14',
  speaker: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  note: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  repeat: 'M17 2L21 6L17 10M3 11V10A4 4 0 0 1 7 6H21M7 22L3 18L7 14M21 13V14A4 4 0 0 1 17 18H3',
  fish: 'M2 12C5 7 11 6 16 9L21 5V19L16 15C11 18 5 17 2 12ZM7 10.6V11.6M11 9.5C12.2 11 12.2 13 11 14.5',
  anchor: 'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 8v13M8 11h8M4 14c0 4 3.5 7 8 7s8-3 8-7M4 14l-1.5 2M20 14l1.5 2',
  person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5',

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
  pearl: 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM8.6 9.6a3.6 3.6 0 0 1 3.1-2.3',
  store: 'M3 10l2-6h14l2 6M4 10v10h16V10M3 10h18M9 20v-5h6v5M7 10a2.5 2.5 0 0 1-5 0M12 10a2.5 2.5 0 0 1-5 0M17 10a2.5 2.5 0 0 1-5 0M22 10a2.5 2.5 0 0 1-5 0',
  paw: 'M12 13c-3 0-5.5 3-5.5 5.2 0 1.6 1.4 2.3 2.8 2.3 1.2 0 1.8-.7 2.7-.7s1.5.7 2.7.7c1.4 0 2.8-.7 2.8-2.3C17.5 16 15 13 12 13zM6 11.5a2 2.5 0 1 0 0-5 2 2.5 0 0 0 0 5zM18 11.5a2 2.5 0 1 0 0-5 2 2.5 0 0 0 0 5zM9.5 8a2 2.5 0 1 0 0-5 2 2.5 0 0 0 0 5zM14.5 8a2 2.5 0 1 0 0-5 2 2.5 0 0 0 0 5z',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.9M12 16.8v.4',
  notes: 'M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 15h7M9 19h4',

  /* --- the hours a reach is run in, in the pilot house --------------- */
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1.5V4M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8',
  dusk: 'M5 15a7 7 0 0 1 14 0M2 15h20M5 19h14M8 22h8M12 4v3M5.6 7.6l1.8 1.8M18.4 7.6l-1.8 1.8',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',

  /* --- what each boss leaves behind when you take their table ----- */
  'k-lantern': 'M10 5V3h4v2M8 8l1-3h6l1 3zM8 8h8l-1 11H9zM12 11v5M7 19h10',
  'k-teapot': 'M6 11h10v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4zM16 12h2a2 2 0 0 1 0 4h-2M6 12L3 9.5M9 11V9h4v2M11 9V7',
  'k-bell': 'M12 3v2M7 17v-6a5 5 0 0 1 10 0v6l2 2H5zM10 21h4',
  'k-ledger': 'M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6zM9 3v18M12 8h4M12 11h4',
  'k-cap': 'M4 14c0-4 3.6-7 8-7s8 3 8 7zM3 14h18v2.5H3zM10 10h4',
  'k-watch': 'M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 3v4M10 3h4M12 11v3.5l2.5 1.5',
  'k-coin': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12 9.5v5',
  'k-pennant': 'M5 21V3M5 4l14 4-14 4',
  'k-spyglass': 'M3 15l13-7 2 4-13 7zM16 8l3-1.5 2 4-3 1.5M7 17l1 4M10 15.5l1 5.5',
  'k-lens': 'M12 3l7 4v10l-7 4-7-4V7zM12 7l3.5 2v6L12 17l-3.5-2V9zM12 3v4M12 17v4',
  'k-pearl': 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9.5 10a2 2 0 0 1 2-1.5M4 20c3-2 13-2 16 0',
  'k-cutlass': 'M5 19l3-3M6 14l4 4M8 16c4-4 7-9 11-13-1 5-4 10-9 15',
  'k-medal': 'M8 3l4 6 4-6M12 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z',
  // The backwaters' trophies: a gold nugget, a gator's tooth on a string, a hymnal.
  'k-nugget': 'M5 14l3-6 5-2 5 3 1 6-4 4H9zM9 10l2 2M14 9l1 3M11 15l3 1',
  'k-tooth': 'M4 5c4 4 12 4 16 0M10 8c0 6 1 10 2 12 1-2 2-6 2-12M11 11h2',
  'k-hymnal': 'M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11M11 7v6M9 9h4',

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
  star: 'M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z',
  'm-value': 'M12 3l3 6 6 1-4.5 4 1 6.5L12 17l-5.5 3.5 1-6.5L3 10l6-1zM9 12h6',
  'm-streets': 'M3 20h18M5 20V14M10 20V10M15 20V6M20 20V3',
  'm-threebet': 'M4 18l4-6 4 3 4-8 4 4M16 7h4v4',
  'm-multiway': 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 21c0-3 2.5-5 5-5M21 21c0-3-2.5-5-5-5M7 21c0-3 2-5 5-5s5 2 5 5',
  'm-pushfold': 'M4 12h11M11 7l5 5-5 5M19 4v16',
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
