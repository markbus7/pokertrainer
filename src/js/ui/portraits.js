/**
 * Faces for the people on the river.
 *
 * Each portrait is a bust in a cameo, built from the same few shapes — head,
 * neck, shoulders, features — with what makes the person themselves laid on
 * top: a hat, a beard, a pair of spectacles, a pipe. Silhouette first: at the
 * size of a seat plate you recognise the flat cap, the top hat and the grey
 * bun before you see a face, so those carry the character.
 *
 * Unlike the rest of the interface these are painted in fixed colours. A
 * portrait is a picture of somebody, the same picture in every room, the
 * way a playing card is the same card; only the frame around it follows the
 * room. Nothing here is copied from anywhere — every shape is drawn below.
 */

const SKIN = {
  fair: ['#f1cdb0', '#d9a888'],
  light: ['#e9bb97', '#cf9a76'],
  tan: ['#d9a37c', '#bd835c'],
  olive: ['#c99a70', '#a97a52'],
  brown: ['#a8704c', '#8a5638'],
  deep: ['#7a4c32', '#5f3822'],
};

const INK = '#2a1d16';

/* ---- the parts every face shares ------------------------------------ */

const shoulders = (fill) => `<path d="M10 100C11 81 27 71 42 69Q50 74 58 69C73 71 89 81 90 100Z" fill="${fill}"/>`;
const neck = (skin) => `<path d="M43 56V70Q50 75 57 70V56Z" fill="${skin[1]}"/>`;
const ears = (skin) => `<ellipse cx="34" cy="47" rx="3.2" ry="5.2" fill="${skin[1]}"/><ellipse cx="66" cy="47" rx="3.2" ry="5.2" fill="${skin[1]}"/>`;
const head = (skin) => `<ellipse cx="50" cy="45" rx="16.5" ry="19.5" fill="${skin[0]}"/>`
  // One side a shade darker, so the head reads as round rather than flat.
  + `<path d="M50 25.5A16.5 19.5 0 0 1 50 64.5A12 19.5 0 0 0 50 25.5Z" fill="${skin[1]}" opacity=".45"/>`;

function features({ skin, brow = INK, mouth = 'smile', eyes = 'open', nose = true }) {
  const eyeShapes = {
    open: `<ellipse cx="43.5" cy="46" rx="1.9" ry="2.2" fill="${INK}"/><ellipse cx="56.5" cy="46" rx="1.9" ry="2.2" fill="${INK}"/>`
      + '<circle cx="44.1" cy="45.3" r=".6" fill="#fff" opacity=".8"/><circle cx="57.1" cy="45.3" r=".6" fill="#fff" opacity=".8"/>',
    narrow: `<path d="M41 46.3q2.5-1.6 5 0M54 46.3q2.5-1.6 5 0" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
    wide: `<circle cx="43.5" cy="46" r="2.5" fill="#fbf6ee"/><circle cx="56.5" cy="46" r="2.5" fill="#fbf6ee"/>`
      + `<circle cx="43.8" cy="46.3" r="1.5" fill="${INK}"/><circle cx="56.8" cy="46.3" r="1.5" fill="${INK}"/>`,
    closed: `<path d="M41 46.5q2.5 1.8 5 0M54 46.5q2.5 1.8 5 0" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  };
  const mouths = {
    smile: 'M45 56.5q5 3 10 0',
    grin: 'M44 55.5q6 5.5 12 0z',
    flat: 'M45.5 57h9',
    smirk: 'M45.5 57q5 1.2 9.5-1.6',
    stern: 'M45.5 57.6q4.5-1.4 9 0',
    open: 'M46 56q4 5 8 0z',
  };
  const m = mouths[mouth] || mouths.smile;
  const filled = /z$/.test(m);
  return `<path d="M40 41.4q3.5-2.2 7-.2M53 41.2q3.5-2 7 .2" stroke="${brow}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`
    + (eyeShapes[eyes] || eyeShapes.open)
    + (nose ? `<path d="M50.2 46.5q-2.4 5.6.6 6.4" stroke="${skin[1]}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` : '')
    + (filled
      ? `<path d="${m}" fill="#6e2a24" stroke="#5a211c" stroke-width="1"/><path d="M46 56.2h8" stroke="#fbf6ee" stroke-width="1.3"/>`
      : `<path d="${m}" stroke="#7a3b30" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
}

/* ---- the people ---------------------------------------------------- */

/**
 * Each entry: skin, the ground behind them, and layers drawn in order —
 * `back` (behind the head), `body` (over the shoulders), `hair`, `face`
 * options, then `front` (hats, beards, spectacles, pipes).
 */
const PEOPLE = {
  /* ---- the bosses ---- */
  wade: {
    skin: SKIN.light,
    ground: '#4d5e6e',
    body: shoulders('#5a7896')
      + '<path d="M36 72L39 100M64 72L61 100" stroke="#4a3322" stroke-width="3.2"/>'
      + '<path d="M43 69l7 7 7-7" stroke="#e9e2d0" stroke-width="2" fill="none"/>',
    face: { mouth: 'grin', brow: '#5a3f2a' },
    front: '<path d="M36 55q14 13 28 0q-2 9-14 10q-12-1-14-10z" fill="#5a3f2a" opacity=".28"/>'
      + '<path d="M33 40C32 25 68 23 68 37C60 34 42 34 33 40Z" fill="#6b5237"/>'
      + '<path d="M40 38C50 35 64 35 73 40C66 43 52 42 40 38Z" fill="#574229"/>'
      + '<path d="M36 33q12-6 28-2" stroke="#806546" stroke-width="1.2" fill="none"/>'
      + '<circle cx="50" cy="26.8" r="1.6" fill="#806546"/>',
  },
  tilly: {
    skin: SKIN.deep,
    ground: '#6a4a52',
    back: '<circle cx="50" cy="22" r="8" fill="#c9c4bc"/><path d="M44 21q6-4 12 0" stroke="#aaa59c" stroke-width="1.2" fill="none"/>',
    body: shoulders('#5c3a4a')
      + '<path d="M12 100C14 84 26 74 40 70L50 88L60 70C74 74 86 84 88 100Z" fill="#8e3b46"/>'
      + '<path d="M40 70L50 88L60 70" stroke="#6e2a35" stroke-width="1.4" fill="none"/>'
      + '<circle cx="50" cy="86" r="2.4" fill="#d9b44a"/>',
    hair: '<path d="M33.5 44C32 27 68 27 66.5 44C63 34 55 31 50 31S37 34 33.5 44Z" fill="#c9c4bc"/>'
      + '<path d="M38 35q12-7 24 0" stroke="#aaa59c" stroke-width="1" fill="none"/>',
    face: { mouth: 'smile', brow: '#b9b3aa' },
    front: '<circle cx="43.5" cy="46" r="4.6" fill="#fff" fill-opacity=".12" stroke="#d9c07a" stroke-width="1.3"/>'
      + '<circle cx="56.5" cy="46" r="4.6" fill="#fff" fill-opacity=".12" stroke="#d9c07a" stroke-width="1.3"/>'
      + '<path d="M48.1 46h3.8M38.9 45.5l-4.4-1M61.1 45.5l4.4-1" stroke="#d9c07a" stroke-width="1.1"/>',
  },
  hollis: {
    skin: SKIN.tan,
    ground: '#44584a',
    body: shoulders('#4b5a4a')
      + '<path d="M42 69L36 100M58 69L64 100" stroke="#3a4739" stroke-width="2"/>',
    face: { mouth: 'flat', eyes: 'narrow', brow: '#e9e5dc' },
    front: '<path d="M34 49C34 66 42 76 50 77C58 76 66 66 66 49C62 58 57 60 50 60C43 60 38 58 34 49Z" fill="#ece8df"/>'
      + '<path d="M42 56.5q8-4.5 16 0q-8 3-16 0z" fill="#f6f3ec"/>'
      + '<path d="M56 60l12 5" stroke="#5a3a24" stroke-width="2.2" stroke-linecap="round"/>'
      + '<path d="M66 62h6v5q-3 3-6 0z" fill="#6b4630"/>'
      + '<path d="M69 60q-3-4 1-7t0-7" stroke="#cfd3d6" stroke-width="1.3" fill="none" opacity=".75"/>'
      + '<ellipse cx="50" cy="33" rx="31" ry="6.5" fill="#2f271d"/>'
      + '<path d="M35 33C35 16 65 16 65 33Z" fill="#3b3226"/>'
      + '<path d="M35.4 29.5h29.2v3.5H35.4z" fill="#5a4a37"/>',
  },
  evangeline: {
    skin: SKIN.fair,
    ground: '#3f5a66',
    back: '<path d="M31 49C28 30 44 20 54 22C66 23 73 34 69 49Z" fill="#7a3f22"/>',
    body: shoulders('#2c4a5a')
      + '<path d="M42 56V72Q50 76 58 72V56Z" fill="#f1ece0"/>'
      + '<path d="M42 60h16M42 64h16M42 68h16" stroke="#d9d2c2" stroke-width=".9"/>'
      + '<ellipse cx="50" cy="80" rx="4.4" ry="5.4" fill="#e9d9b8" stroke="#c9a24a" stroke-width="1.6"/>'
      + '<path d="M50.5 76.6q-2.4 1.2-1.4 3.4t-.4 3.8" stroke="#b58f73" stroke-width="1.2" fill="none"/>',
    hair: '<path d="M33.5 45C31 26 69 24 66.5 45C64 34 58 30 50 30C44 30 37 34 33.5 45Z" fill="#8a4a2b"/>'
      + '<ellipse cx="54" cy="22.5" rx="10" ry="6.5" fill="#8a4a2b"/>'
      + '<path d="M46 23q8-5 16 1" stroke="#6a3520" stroke-width="1.1" fill="none"/>'
      + '<path d="M36 40q7-8 18-8" stroke="#a45c37" stroke-width="1.1" fill="none"/>',
    face: { mouth: 'smirk', brow: '#6a3520' },
    front: '<circle cx="34" cy="53" r="1.7" fill="#f4efe6"/><circle cx="66" cy="53" r="1.7" fill="#f4efe6"/>',
  },
  rourke: {
    skin: SKIN.light,
    ground: '#34445e',
    body: shoulders('#1f2e4a')
      + '<path d="M42 69L50 82L58 69" fill="#f1ece0"/>'
      + '<path d="M42 69L46 100M58 69L54 100" stroke="#172238" stroke-width="1.6"/>'
      + '<circle cx="41" cy="84" r="1.9" fill="#d9b44a"/><circle cx="59" cy="84" r="1.9" fill="#d9b44a"/>'
      + '<circle cx="42" cy="94" r="1.9" fill="#d9b44a"/><circle cx="58" cy="94" r="1.9" fill="#d9b44a"/>',
    face: { mouth: 'grin', brow: '#a8472a' },
    front: '<path d="M34 48C34 67 42 73 50 73C58 73 66 67 66 48C62 55 57 58 50 58C43 58 38 55 34 48Z" fill="#b5532e"/>'
      + '<path d="M44 55.5q6-4 12 0" stroke="#9c4526" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M44.5 58.5q5.5 4.5 11 0z" fill="#6e2a24"/>'
      + '<path d="M33 32C33 21 67 21 67 32L66 37H34Z" fill="#1f2e4a"/>'
      + '<path d="M30 25.5C38 20 62 20 70 25.5C66 28.5 34 28.5 30 25.5Z" fill="#26375a"/>'
      + '<path d="M34 36.5Q50 42 66 36.5L64 39.5Q50 45 36 39.5Z" fill="#111"/>'
      + '<path d="M34 35h32" stroke="#d9b44a" stroke-width="1.4"/>'
      + '<circle cx="50" cy="30" r="3.2" fill="#d9b44a"/><path d="M48 30h4M50 28v4" stroke="#8a6a24" stroke-width=".9"/>',
  },
  ashby: {
    skin: SKIN.brown,
    ground: '#5a5344',
    body: shoulders('#6d6250')
      + '<path d="M17 100C19 88 26 80 34 76M83 100C81 88 74 80 66 76" stroke="#5c5242" stroke-width="1" fill="none" opacity=".6"/>'
      + '<path d="M42 69L50 84L58 69Z" fill="#f1ece0"/>'
      + '<path d="M42 69L37 100M58 69L63 100" stroke="#574d3d" stroke-width="1.8"/>'
      + '<path d="M44 73l6 3-6 3zM56 73l-6 3 6 3z" fill="#7a2331"/><circle cx="50" cy="76" r="1.6" fill="#5e1a26"/>',
    hair: '<path d="M33 49C31 39 34 33 38 32L39 47Z" fill="#c9c4bc"/><path d="M67 49C69 39 66 33 62 32L61 47Z" fill="#c9c4bc"/>',
    face: { mouth: 'smile', brow: '#cfcac1' },
    front: '<path d="M43 55q7-4.5 14 0q-3.5 2.8-7 1.1q-3.5 1.7-7-1.1z" fill="#c9c4bc"/>'
      + '<circle cx="44" cy="46" r="3.4" fill="#fff" fill-opacity=".15" stroke="#d9c07a" stroke-width="1.1"/>'
      + '<circle cx="56" cy="46" r="3.4" fill="#fff" fill-opacity=".15" stroke="#d9c07a" stroke-width="1.1"/>'
      + '<path d="M47.4 46h5.2" stroke="#d9c07a" stroke-width="1"/>'
      + '<path d="M59.4 46.5q6 12 1 26" stroke="#d9c07a" stroke-width=".8" fill="none"/>',
  },
  delacroix: {
    skin: SKIN.olive,
    ground: '#5e3434',
    body: shoulders('#1b1a22')
      + '<path d="M40 70L50 96L60 70C56 73 44 73 40 70Z" fill="#9c2a2a"/>'
      + '<path d="M44 70L50 80L56 70Z" fill="#f1ece0"/>'
      + '<circle cx="50" cy="86" r="1.3" fill="#d9b44a"/><circle cx="50" cy="92" r="1.3" fill="#d9b44a"/>',
    face: { mouth: 'smirk', eyes: 'narrow', brow: '#2a1c14' },
    front: '<path d="M43.5 54.6q3.2-1.6 6.3.2q3.1-1.8 6.3-.2" stroke="#2a1c14" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<circle cx="33.4" cy="53" r="2.1" fill="none" stroke="#e0b64a" stroke-width="1.3"/>'
      + '<path d="M38 31L39.5 5H60.5L62 31Z" fill="#1d1b1f"/>'
      + '<path d="M38.4 25h23.2v4.5H38.4z" fill="#8c2424"/>'
      + '<ellipse cx="50" cy="31.5" rx="22" ry="4.2" fill="#141217"/>'
      + '<path d="M41 8l1 18" stroke="#3a363e" stroke-width="1" opacity=".7"/>',
  },
  commodore: {
    skin: SKIN.light,
    ground: '#2e3d56',
    body: shoulders('#1c2842')
      + '<path d="M42 69L50 80L58 69" fill="#f1ece0"/>'
      + '<path d="M14 84C18 76 26 72 34 71L36 78C28 79 20 82 14 84Z" fill="#d4ae4f"/>'
      + '<path d="M86 84C82 76 74 72 66 71L64 78C72 79 80 82 86 84Z" fill="#d4ae4f"/>'
      + '<path d="M15 84v5M19 82v5M23 81v5M27 80v5M73 80v5M77 81v5M81 82v5M85 84v5" stroke="#b8923a" stroke-width="1.3"/>'
      + '<circle cx="42" cy="90" r="2.6" fill="#c0392b"/><path d="M41 86h2v2h-2z" fill="#d4ae4f"/>',
    face: { mouth: 'stern', eyes: 'narrow', brow: '#efece6' },
    front: '<path d="M33 44C32 58 36 62 42 62Q46 56 50 56.5Q54 56 58 62C64 62 68 58 67 44C65 52 62 55 60 55Q55 53 50 54Q45 53 40 55C38 55 35 52 33 44Z" fill="#efece6"/>'
      + '<path d="M33 32C33 22 67 22 67 32L66 37H34Z" fill="#f2f0ea"/>'
      + '<path d="M31 27C39 21 61 21 69 27C65 30 35 30 31 27Z" fill="#fbfaf6"/>'
      + '<path d="M34 34h32v3H34z" fill="#111"/>'
      + '<path d="M34 36.5Q50 42 66 36.5L64 39.5Q50 45 36 39.5Z" fill="#111"/>'
      + '<path d="M36 38.6Q50 43 64 38.6" stroke="#d4ae4f" stroke-width="1.3" fill="none"/>'
      + '<path d="M44 29l6-3 6 3-6 3z" fill="#d4ae4f"/>',
  },

  /* ---- the regulars, keyed by the style they play ---- */
  rock: {
    skin: SKIN.tan,
    ground: '#4c4f55',
    body: shoulders('#5b5f66') + '<path d="M42 69Q50 76 58 69" stroke="#474a50" stroke-width="3" fill="none"/>',
    face: { mouth: 'flat', eyes: 'narrow', brow: '#3a2a20' },
    front: '<path d="M39 40.6q4.5-3 8.5 0M52.5 40.6q4-3 8.5 0" stroke="#3a2a20" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M36 34q14-10 28 0" stroke="#fff" stroke-width="2" opacity=".2" fill="none"/>',
  },
  tag: {
    skin: SKIN.fair,
    ground: '#3c5a52',
    back: '<path d="M31 58C27 26 73 26 69 58Z" fill="#1c1a1f"/>',
    body: shoulders('#2f5d4e') + '<path d="M44 69L50 78L56 69Z" fill="#f1ece0"/>',
    hair: '<path d="M33.5 46C33 29 67 29 66.5 46C60 40 58 33 49 33.5C44 36 38 39 33.5 46Z" fill="#1c1a1f"/>',
    face: { mouth: 'smirk', brow: '#1c1a1f' },
    front: '',
  },
  lag: {
    skin: SKIN.brown,
    ground: '#5e4032',
    body: shoulders('#3a3f4a')
      + '<path d="M40 70C44 78 56 78 60 70L62 74C56 84 44 84 38 74Z" fill="#b23a3a"/>'
      + '<path d="M56 80l4 14-6-2z" fill="#9c2f2f"/>',
    hair: '<g fill="#3b2519"><circle cx="37" cy="36" r="6"/><circle cx="44" cy="30" r="6.5"/><circle cx="52" cy="28" r="6.5"/><circle cx="60" cy="31" r="6"/><circle cx="64.5" cy="38" r="5"/><circle cx="35" cy="42" r="4"/></g>',
    face: { mouth: 'grin', brow: '#3b2519' },
    front: '',
  },
  station: {
    skin: SKIN.fair,
    ground: '#5c6a48',
    body: shoulders('#6b8fb0')
      + '<path d="M22 84h56M18 92h64M36 72v28M50 76v24M64 72v28" stroke="#58799a" stroke-width="1.4"/>',
    face: { mouth: 'smile', eyes: 'wide', brow: '#8a6a45' },
    front: '<ellipse cx="42" cy="53" rx="3" ry="2" fill="#e08a7a" opacity=".45"/><ellipse cx="58" cy="53" rx="3" ry="2" fill="#e08a7a" opacity=".45"/>'
      + '<ellipse cx="50" cy="33" rx="27" ry="5.5" fill="#caa35a"/>'
      + '<path d="M36.5 33V23.5Q50 20.5 63.5 23.5V33Z" fill="#d8b56a"/>'
      + '<path d="M36.5 28.5h27v3.5h-27z" fill="#7a2f2f"/>'
      + '<path d="M28 33.5q22 3 44 0" stroke="#b08a45" stroke-width="1" fill="none"/>',
  },
  maniac: {
    skin: SKIN.light,
    ground: '#6a3a2e',
    body: shoulders('#c0392b')
      + '<path d="M26 76v24M36 71v29M64 71v29M74 76v24" stroke="#f2d16b" stroke-width="3"/>'
      + '<path d="M44 69L50 77L56 69Z" fill="#f1ece0"/>',
    hair: '<path d="M32 44L28 30L37 34L37 21L45 29L50 16L55 29L63 20L63 34L72 29L68 44C64 34 56 31 50 31S36 34 32 44Z" fill="#d9822b"/>',
    face: { mouth: 'grin', eyes: 'wide', brow: '#b8651f' },
    front: '',
  },
  pro: {
    skin: SKIN.brown,
    ground: '#2f4a44',
    back: '<ellipse cx="66" cy="44" rx="5" ry="9" fill="#1e1a1c"/>',
    body: shoulders('#23262e') + '<path d="M44 69L50 76L56 69Z" fill="#d9d4c8"/>',
    hair: '<path d="M33.5 44C32 27 68 27 66.5 44C63 36 57 33 50 33S37 36 33.5 44Z" fill="#1e1a1c"/>',
    face: { mouth: 'flat', brow: '#1e1a1c' },
    front: '<path d="M31 40C38 33 62 33 69 40L66 43C58 39 42 39 34 43Z" fill="#2e8a5f" opacity=".82"/>'
      + '<path d="M33 37q17-7 34 0" stroke="#1d5e40" stroke-width="1.6" fill="none"/>',
  },
};

/** Everyone who can be drawn. */
export const PORTRAIT_KEYS = Object.keys(PEOPLE);

let uid = 0;

/**
 * An SVG string for somebody's cameo. Unknown keys get a plain silhouette
 * rather than nothing, so a new character never leaves a hole in a seat.
 */
export function portraitSvg(key, { size = 64, className = '' } = {}) {
  const p = PEOPLE[key];
  const id = `pt${++uid}`;
  if (!p) {
    return `<svg class="portrait ${className}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`
      + `<defs><clipPath id="${id}"><circle cx="50" cy="50" r="47"/></clipPath></defs>`
      + '<circle cx="50" cy="50" r="47" fill="#3a3a40"/>'
      + `<g clip-path="url(#${id})" fill="#6a6a72"><circle cx="50" cy="44" r="17"/>${shoulders('#6a6a72')}</g></svg>`;
  }
  return `<svg class="portrait ${className}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`
    + '<defs>'
    + `<clipPath id="${id}c"><circle cx="50" cy="50" r="47"/></clipPath>`
    + `<radialGradient id="${id}v" cx="50%" cy="38%" r="62%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".45"/></radialGradient>`
    + `<radialGradient id="${id}l" cx="42%" cy="30%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity=".22"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + '</defs>'
    + `<g clip-path="url(#${id}c)">`
    + `<rect width="100" height="100" fill="${p.ground}"/>`
    + `<rect width="100" height="100" fill="url(#${id}l)"/>`
    // Cropped a little tighter than drawn, so the face carries at the size
    // of a seat plate; a tall hat may lose its crown to the frame, the way
    // it would in a photograph.
    + '<g transform="translate(50 60) scale(1.12) translate(-50 -60)">'
    + (p.back || '')
    + neck(p.skin)
    + p.body
    + ears(p.skin)
    + head(p.skin)
    + (p.hair || '')
    + features({ skin: p.skin, ...(p.face || {}) })
    + (p.front || '')
    + '</g>'
    + `<rect width="100" height="100" fill="url(#${id}v)"/>`
    + '</g>'
    + '<circle class="portrait-rim" cx="50" cy="50" r="47.5"/>'
    + '</svg>';
}
