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

  /* ---- the Gulf ---- */
  // The harbourmaster: a peaked harbour cap with a brass badge, grey side-whiskers, a navy coat.
  quint: {
    skin: SKIN.olive,
    ground: '#3e5560',
    body: shoulders('#22324a')
      + '<path d="M42 69L50 79L58 69" fill="#f1ece0"/>'
      + '<path d="M47 75l3 7 3-7z" fill="#22324a"/>'
      + '<circle cx="40" cy="84" r="1.6" fill="#d4ae4f"/><circle cx="40" cy="92" r="1.6" fill="#d4ae4f"/>'
      + '<circle cx="60" cy="84" r="1.6" fill="#d4ae4f"/><circle cx="60" cy="92" r="1.6" fill="#d4ae4f"/>',
    face: { mouth: 'flat', brow: '#b9b5ad' },
    front: '<path d="M33 40C32 52 35 58 38 60L41 50C38 48 36 45 35 40Z" fill="#b9b5ad"/>'
      + '<path d="M67 40C68 52 65 58 62 60L59 50C62 48 64 45 65 40Z" fill="#b9b5ad"/>'
      + '<path d="M32 33C32 23 68 23 68 33L67 36H33Z" fill="#1d2a3f"/>'
      + '<path d="M33 34h34v3.4H33z" fill="#f1ece0"/>'
      + '<path d="M33 37.4Q50 41 67 37.4L68 40Q50 45 32 40Z" fill="#111827"/>'
      + '<path d="M46 27.5h8v4h-8z" fill="#d4ae4f"/><path d="M48 29.5h4" stroke="#8a6a1e" stroke-width=".9"/>',
  },
  // The lighthouse keeper: a yellow oilskin sou'wester and coat, a red braid over the shoulder.
  moll: {
    skin: SKIN.fair,
    ground: '#4a5a66',
    back: '<path d="M64 48C72 56 72 70 66 80" stroke="#a5452a" stroke-width="5.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M66 60l3 2M67 66l3 2M67 72l3 2" stroke="#7d3220" stroke-width="1.2"/>',
    body: shoulders('#d9a53a')
      + '<path d="M42 69L50 76L58 69" fill="#e7ddc6"/>'
      + '<path d="M50 76v24" stroke="#a87b22" stroke-width="1.6"/>'
      + '<circle cx="47" cy="84" r="1.3" fill="#3b2a1c"/><circle cx="47" cy="92" r="1.3" fill="#3b2a1c"/>',
    hair: '<path d="M34 42C34 32 42 28 50 28C58 28 66 32 66 42C62 36 56 35 50 35C44 35 38 36 34 42Z" fill="#a5452a"/>',
    face: { mouth: 'smile', brow: '#8a3a22' },
    front: '<path d="M30 33C30 21 70 21 70 33Z" fill="#e2b24a"/>'
      + '<path d="M24 35C30 31 70 31 76 35C78 39 74 44 70 44C62 40 38 40 30 44C26 44 22 39 24 35Z" fill="#d9a53a"/>'
      + '<path d="M32 33Q50 29 68 33" stroke="#a87b22" stroke-width="1.3" fill="none"/>',
  },
  // The pearl buyer: black hair up under a tall comb, pearls at her throat and ears.
  valdes: {
    skin: SKIN.tan,
    ground: '#5b4a6a',
    back: '<path d="M38 22C40 10 60 10 62 22Z" fill="#c9a24a"/><path d="M42 20v-6M46 19v-7M50 19v-8M54 19v-7M58 20v-6" stroke="#8a6a1e" stroke-width="1.2"/>'
      + '<ellipse cx="50" cy="25" rx="11" ry="6" fill="#1a1414"/>',
    body: shoulders('#3b2a4a')
      + '<path d="M38 70Q50 82 62 70" stroke="#f3eee6" stroke-width="2.6" fill="none" stroke-dasharray="0.1 3.2" stroke-linecap="round"/>'
      + '<circle cx="50" cy="78.6" r="2.4" fill="#f6f1e8"/>',
    hair: '<path d="M33 46C31 30 40 25 50 25C60 25 69 30 67 46C64 36 58 32 50 32C42 32 36 36 33 46Z" fill="#1a1414"/>',
    face: { mouth: 'smirk', brow: '#1a1414' },
    front: '<circle cx="33.5" cy="53" r="1.8" fill="#f6f1e8"/><circle cx="66.5" cy="53" r="1.8" fill="#f6f1e8"/>',
  },
  // The privateer: a battered tricorn, an eyepatch, a black beard, a red coat.
  teague: {
    skin: SKIN.brown,
    ground: '#5e3a2e',
    body: shoulders('#7a2a22')
      + '<path d="M42 69L50 78L58 69" fill="#e9e2d0"/>'
      + '<path d="M36 72L40 100M64 72L60 100" stroke="#d4ae4f" stroke-width="1.6"/>',
    face: { mouth: 'grin', brow: '#1a1210' },
    front: '<path d="M34 50C34 64 42 70 50 70C58 70 66 64 66 50C62 56 58 58 50 58C42 58 38 56 34 50Z" fill="#1a1210"/>'
      + '<path d="M45 57q5 3 10 0" stroke="#6e2a24" stroke-width="1.6" fill="none"/>'
      + '<path d="M38 42L64 37" stroke="#111" stroke-width="1.3"/>'
      + '<ellipse cx="43.5" cy="46" rx="4" ry="3.6" fill="#111"/>'
      + '<path d="M28 32C34 20 66 20 72 32C66 30 60 34 50 34C40 34 34 30 28 32Z" fill="#22180f"/>'
      + '<path d="M28 32C40 39 60 39 72 32L74 36C60 44 40 44 26 36Z" fill="#2f2216"/>'
      + '<path d="M30 33.5C42 39.5 58 39.5 70 33.5" stroke="#d4ae4f" stroke-width="1" fill="none"/>',
  },
  // The Admiral: a bicorne worn athwart, white mutton-chops, gold epaulettes.
  admiral: {
    skin: SKIN.light,
    ground: '#24324a',
    body: shoulders('#16203a')
      + '<path d="M42 69L50 80L58 69" fill="#f1ece0"/>'
      + '<path d="M12 86C16 76 26 71 34 70L36 79C27 80 19 83 12 86Z" fill="#d4ae4f"/>'
      + '<path d="M88 86C84 76 74 71 66 70L64 79C73 80 81 83 88 86Z" fill="#d4ae4f"/>'
      + '<path d="M13 86v5M17 84v5M21 82v5M25 81v5M75 81v5M79 82v5M83 84v5M87 86v5" stroke="#b8923a" stroke-width="1.3"/>'
      + '<path d="M44 86l6 4 6-4v6l-6 4-6-4z" fill="#c0392b"/><circle cx="50" cy="89" r="1.8" fill="#d4ae4f"/>',
    face: { mouth: 'stern', eyes: 'narrow', brow: '#f2f0ea' },
    front: '<path d="M33 40C31 54 34 60 39 62L42 50C38 48 35 45 34 40Z" fill="#f2f0ea"/>'
      + '<path d="M67 40C69 54 66 60 61 62L58 50C62 48 65 45 66 40Z" fill="#f2f0ea"/>'
      + '<path d="M14 33C26 33 34 20 50 18C66 20 74 33 86 33C76 38 62 37 50 37C38 37 24 38 14 33Z" fill="#111"/>'
      + '<path d="M16 33.5C28 36 40 35.5 50 35.5C60 35.5 72 36 84 33.5" stroke="#d4ae4f" stroke-width="1.4" fill="none"/>'
      + '<path d="M50 20v14" stroke="#d4ae4f" stroke-width="1.2"/><circle cx="50" cy="27" r="2.6" fill="#c0392b"/>',
  },

  /* ---- the teacher ---- */
  silas: {
    skin: SKIN.light,
    ground: '#556250',
    body: shoulders('#35333c')
      + '<path d="M42 69L50 84L58 69Z" fill="#efe9dc"/>'
      + '<path d="M40 70L50 79L60 70L57 67L50 72L43 67Z" fill="#b0302a"/>'
      + '<path d="M47 76l3 9 3-9z" fill="#962723"/><circle cx="50" cy="76.5" r="2.6" fill="#b0302a"/>'
      + '<circle cx="38" cy="88" r="1.3" fill="#c9a24a"/><circle cx="38" cy="95" r="1.3" fill="#c9a24a"/>'
      + '<path d="M38 88q7 3 12 1" stroke="#c9a24a" stroke-width=".8" fill="none"/>',
    hair: '<path d="M33 50C31 42 33 37 36 36L38 48Z" fill="#e2ddd4"/><path d="M67 50C69 42 67 37 64 36L62 48Z" fill="#e2ddd4"/>',
    face: { mouth: 'smile', brow: '#e8e4dc' },
    front: '<path d="M40 53.5C44 50 48 51 50 52.6C52 51 56 50 60 53.5C61 59 56.5 59.5 54 57.6C52.4 56.4 51 56 50 56C49 56 47.6 56.4 46 57.6C43.5 59.5 39 59 40 53.5Z" fill="#e4dfd6"/>'
      + '<circle cx="43.5" cy="46" r="4.3" fill="#fff" fill-opacity=".14" stroke="#b9a15a" stroke-width="1.1"/>'
      + '<circle cx="56.5" cy="46" r="4.3" fill="#fff" fill-opacity=".14" stroke="#b9a15a" stroke-width="1.1"/>'
      + '<path d="M47.8 46h4.4M39.2 45.4l-4.6-1M60.8 45.4l4.6-1" stroke="#b9a15a" stroke-width="1"/>'
      + '<path d="M34.5 34C34.5 18 65.5 18 65.5 34Z" fill="#2c2825"/>'
      + '<path d="M34.6 30.4h30.8v3.6H34.6z" fill="#181513"/>'
      + '<path d="M27 35C33 31.2 67 31.2 73 35C67 38.4 33 38.4 27 35Z" fill="#231f1c"/>'
      + '<path d="M40 24q6-4 13-3" stroke="#46403a" stroke-width="1.2" fill="none"/>',
  },

  /* ---- the assayer: a pencil through her bun and a loupe in her eye ---- */
  hattie: {
    skin: SKIN.tan,
    ground: '#6a5836',
    back: '<path d="M35.5 16.5L64.5 24" stroke="#e0b93f" stroke-width="2.3" stroke-linecap="round"/>'
      + '<path d="M64.5 24l3.2 .9" stroke="#3a2a1a" stroke-width="1.6" stroke-linecap="round"/>'
      + '<path d="M35.5 16.5l-2.2-.6" stroke="#d98a8a" stroke-width="2.3" stroke-linecap="round"/>'
      + '<circle cx="50" cy="21" r="7.4" fill="#2a1f1a"/>'
      + '<path d="M45 19q5-4 10 0M46 23q4 2.5 8 0" stroke="#43342b" stroke-width="1" fill="none"/>',
    body: shoulders('#2f4a3a')
      + '<path d="M42 64V74Q50 78 58 74V64Z" fill="#f1ece0"/>'
      + '<path d="M42 67.5h16" stroke="#d9d2c2" stroke-width=".8"/>'
      + '<path d="M45.5 73.5l4.5 3.2 4.5-3.2-1 5.5-3.5-2-3.5 2z" fill="#1b1a1f"/>'
      + '<path d="M40 71L45 100M60 71L55 100" stroke="#243a2d" stroke-width="1.6"/>'
      + '<circle cx="50" cy="86" r="1.4" fill="#d9b44a"/><circle cx="50" cy="93" r="1.4" fill="#d9b44a"/>',
    hair: '<path d="M33.5 46C31 27 69 27 66.5 46C64 35 57 30.5 50 30.5S36 35 33.5 46Z" fill="#2a1f1a"/>'
      + '<path d="M50 30.5v4.5" stroke="#1a130f" stroke-width="1.1"/>'
      + '<path d="M38 38q5-5 11-6M62 38q-5-5-11-6" stroke="#43342b" stroke-width="1" fill="none"/>',
    face: { mouth: 'flat', brow: '#2a1f1a' },
    front: '<circle cx="56.5" cy="46" r="5" fill="#1d1a18"/>'
      + '<circle cx="56.5" cy="46" r="3.4" fill="#8fb3c9" fill-opacity=".6" stroke="#b9a15a" stroke-width="1"/>'
      + '<circle cx="55.3" cy="44.8" r="1" fill="#fff" opacity=".75"/>'
      + '<path d="M61.3 47.5q5 6 3 17" stroke="#b9a15a" stroke-width=".8" fill="none"/>',
  },

  /* ---- the rival: a patched coat, a red scarf, a newsboy cap pulled low ---- */
  nell: {
    skin: SKIN.olive,
    ground: '#4a4f66',
    back: '<path d="M31 54C26 33 36 24 50 24C64 24 74 33 69 54C66 45 63 41 50 41C37 41 34 45 31 54Z" fill="#7a3a22"/>',
    body: shoulders('#6a5a44')
      + '<rect x="19" y="82" width="10" height="9" rx="1" fill="#9a4b3c" transform="rotate(-8 24 86)"/>'
      + '<path d="M20 86h8M24 83v6" stroke="#d9c9a8" stroke-width=".7" stroke-dasharray="1.2 1.2" transform="rotate(-8 24 86)"/>'
      + '<rect x="66" y="78" width="9" height="9" rx="1" fill="#3f6a7a" transform="rotate(10 70 82)"/>'
      + '<path d="M40 68Q50 78 60 68L58 78Q50 86 42 78Z" fill="#b8423a"/>'
      + '<path d="M42 72q8 5 16 0" stroke="#8f2f2a" stroke-width="1.2" fill="none"/>',
    hair: '<path d="M33.5 44C33 30 67 30 66.5 44C63 38 56 35 50 35S37 38 33.5 44Z" fill="#7a3a22"/>',
    face: { mouth: 'smirk', brow: '#4a2412' },
    front: '<path d="M32 37C31 21 69 21 68 37C58 33 42 33 32 37Z" fill="#3f6a7a"/>'
      + '<path d="M32 37q-9 1-11 6q12-1 22-3z" fill="#2f5260"/>'
      + '<path d="M36 30q14-6 28 0" stroke="#5a8a9a" stroke-width="1" fill="none"/>'
      + '<circle cx="50" cy="24" r="1.7" fill="#2f5260"/>',
  },

  /* ---- wanderers: a cattle buyer, a riverboat gambler, a travelling preacher ---- */
  hale: {
    skin: SKIN.fair,
    ground: '#6a5a3f',
    body: shoulders('#7a5a3a')
      + '<path d="M42 69L50 82L58 69" fill="#e9e2d0"/><path d="M50 74v22" stroke="#4a3322" stroke-width="1.4"/>'
      + '<path d="M44 70l6 8 6-8" stroke="#b8423a" stroke-width="1.6" fill="none"/>',
    face: { mouth: 'grin', brow: '#7a5a3a' },
    front: '<path d="M37 53C36 62 64 62 63 53C60 58 40 58 37 53Z" fill="#8a6a44" opacity=".55"/>'
      + '<ellipse cx="50" cy="32" rx="30" ry="6.5" fill="#6a4a2a"/>'
      + '<path d="M36 32C36 14 64 14 64 32Z" fill="#7d5a34"/>'
      + '<path d="M36 28h28v3.6H36z" fill="#3a2a1a"/>',
  },
  dixie: {
    skin: SKIN.light,
    ground: '#3f5a4a',
    back: '<path d="M30 56C25 30 40 20 52 22C66 22 75 34 70 56C67 46 64 40 50 40C36 40 33 46 30 56Z" fill="#a23a2a"/>',
    body: shoulders('#244a38')
      + '<path d="M40 70C44 80 56 80 60 70L58 100H42Z" fill="#c9a24a"/>'
      + '<path d="M44 74h12M44 80h12M44 86h12" stroke="#8a6a1e" stroke-width=".9"/>'
      + '<path d="M46 69l4 5 4-5z" fill="#1b1a1f"/>',
    hair: '<path d="M33.5 44C32 28 68 28 66.5 44C62 36 56 33 50 33S38 36 33.5 44Z" fill="#a23a2a"/>',
    face: { mouth: 'open', brow: '#6a2418', eyes: 'wide' },
    front: '<path d="M32 36q18-13 36 0q-6 4-18 4q-12 0-18-4z" fill="#1b1a1f"/>'
      + '<path d="M34 34q16-9 32 0" stroke="#c9a24a" stroke-width="2" fill="none"/>'
      + '<circle cx="66.5" cy="31" r="2.2" fill="#c9a24a"/>',
  },
  josiah: {
    skin: SKIN.fair,
    ground: '#3d3f4a',
    body: shoulders('#1d1d22')
      + '<path d="M44 69L50 78L56 69" fill="#f1ece0"/>'
      + '<path d="M50 78v22" stroke="#3a3a42" stroke-width="1.4"/>',
    face: { mouth: 'stern', brow: '#cfcbc4', eyes: 'narrow' },
    front: '<path d="M33.5 40C32 26 68 26 66.5 40C60 33 40 33 33.5 40Z" fill="#cfcbc4"/>'
      + '<path d="M36 55q14 14 28 0q-3 10-14 11q-11-1-14-11z" fill="#cfcbc4" opacity=".85"/>'
      + '<path d="M60 76l8 2" stroke="#c9a24a" stroke-width="2" stroke-linecap="round"/>',
  },

  /* ---- the trader: a madras tignon, gold hoops, and a shawl ---- */
  delphine: {
    skin: SKIN.brown,
    ground: '#6a3f3a',
    body: shoulders('#2f4a44')
      + '<path d="M12 100C16 84 28 74 41 71L50 86L59 71C72 74 84 84 88 100Z" fill="#b8862e"/>'
      + '<path d="M41 71L50 86L59 71" stroke="#8a6220" stroke-width="1.2" fill="none"/>'
      + '<path d="M20 92l2 4M26 88l2 4M32 85l2 4M68 85l-2 4M74 88l-2 4M80 92l-2 4" stroke="#8a6220" stroke-width="1.3"/>'
      + '<circle cx="50" cy="84" r="2.6" fill="#e0b64a"/>',
    hair: '<path d="M31 43C27 21 73 19 69 43C66 31 58 27 50 27S34 31 31 43Z" fill="#b8322b"/>'
      + '<path d="M33 35q17-9 34 0M32 40q18-8 36 0" stroke="#f2c14e" stroke-width="1.5" fill="none"/>'
      + '<path d="M41 28v10M50 26v12M59 28v10" stroke="#2f5a8a" stroke-width="1.3"/>'
      + '<path d="M44 24c3-11 19-11 21-1-6 5-15 5-21 1z" fill="#e0a13a"/>'
      + '<path d="M48 22q7-4 13 0" stroke="#b8322b" stroke-width="1.2" fill="none"/>',
    face: { mouth: 'smile', brow: '#2a1c14' },
    front: '<circle cx="34" cy="56" r="3.2" fill="none" stroke="#e0b64a" stroke-width="1.7"/>'
      + '<circle cx="66" cy="56" r="3.2" fill="none" stroke="#e0b64a" stroke-width="1.7"/>',
  },

  /* ---- the shipwright: a flat cap, grey whiskers, a pencil behind his ear
     and a leather apron over his shirt ---- */
  amos: {
    skin: SKIN.light,
    ground: '#4a5d6e',
    body: shoulders('#3f5f7f')
      + '<path d="M40 70L50 80L60 70" stroke="#2f4a66" stroke-width="1.4" fill="none"/>'
      + '<path d="M37 76h26l3 24H34z" fill="#8a5a33"/>'
      + '<path d="M37 76L41 66M63 76L59 66" stroke="#6e4526" stroke-width="2.4" stroke-linecap="round"/>'
      + '<circle cx="39.5" cy="78.5" r="1.3" fill="#d9b44a"/><circle cx="60.5" cy="78.5" r="1.3" fill="#d9b44a"/>'
      + '<path d="M43 88h14v8H43z" fill="#76492a"/><path d="M47 88v-4" stroke="#b9a15a" stroke-width="1.2"/>',
    hair: '<path d="M33 50C31 42 33 37 36 36L38 52Z" fill="#b8b2a6"/><path d="M67 50C69 42 67 37 64 36L62 52Z" fill="#b8b2a6"/>',
    face: { mouth: 'smile', brow: '#9a948a' },
    front: '<path d="M34 47C33 60 39 65 44 61L42 50Z" fill="#c4beb2"/>'
      + '<path d="M66 47C67 60 61 65 56 61L58 50Z" fill="#c4beb2"/>'
      + '<path d="M43.5 56.5q6.5 3.4 13 0" stroke="#aaa498" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      + '<path d="M33 39C32 25 68 24 68 36C60 33 42 33 33 39Z" fill="#5d5a50"/>'
      + '<path d="M33 39C45 33.5 63 33.5 75 38.5C67 42 45 42.5 33 39Z" fill="#48463e"/>'
      + '<path d="M40 30q10-4 20-1" stroke="#6f6c60" stroke-width="1.1" fill="none"/>'
      + '<path d="M63.5 44.5l6.5-9.5" stroke="#e0b93f" stroke-width="2.2" stroke-linecap="round"/>'
      + '<path d="M70 35l1.3-1.9" stroke="#3a2a1a" stroke-width="1.6" stroke-linecap="round"/>',
  },

  /* ---- the angler: a wide oilskin hat with a fly hooked in the band, a
     long grey braid, and a checked shirt under her wader straps ---- */
  maggie: {
    skin: SKIN.olive,
    ground: '#3f5a4c',
    body: shoulders('#8a3b32')
      + '<path d="M26 82h48M22 90h56M30 74v26M42 70v30M58 70v30M70 74v26" stroke="#6e2d26" stroke-width="1.6"/>'
      + '<path d="M38 71v29M62 71v29" stroke="#4d5a3a" stroke-width="5"/>'
      + '<circle cx="38" cy="80" r="1.6" fill="#c9b48a"/><circle cx="62" cy="80" r="1.6" fill="#c9b48a"/>',
    back: '<path d="M64 46C72 58 70 74 66 90" stroke="#a9a59c" stroke-width="5.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M66 60l3 2M65 68l3 2M66 76l3 2M66 84l3 2" stroke="#8d897f" stroke-width="1.2"/>',
    hair: '<path d="M33.5 48C32 38 38 31 50 31C62 31 68 38 66.5 48C63 40 57 37 50 37C43 37 37 40 33.5 48Z" fill="#b5b0a6"/>',
    face: { mouth: 'smile', brow: '#8d897f' },
    front: '<path d="M18 37C30 30 70 30 82 37C76 41 24 41 18 37Z" fill="#7a6a3c"/>'
      + '<path d="M32 35C32 20 68 20 68 35C58 31 42 31 32 35Z" fill="#8c7b48"/>'
      + '<path d="M33 33.5C44 30.5 56 30.5 67 33.5" stroke="#5d5130" stroke-width="2.4" fill="none"/>'
      + '<path d="M59 30.5l4-3.5 1.5 4.5z" fill="#d8573a"/><path d="M63 27l2-2" stroke="#e8c84a" stroke-width="1.2"/>'
      + '<path d="M44 52q-1.5 1 0 2M56 52q1.5 1 0 2" stroke="#a97a52" stroke-width=".9" fill="none"/>',
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

/* ---- the companions ------------------------------------------------ */

/**
 * The animals are drawn whole rather than assembled from the parts a person
 * is built from — nobody's owl has ears in the same place as a riverboat
 * captain — but they sit in the same cameo, so a companion beside your seat
 * reads as one more face at the table.
 */
const ANIMALS = {
  owl: {
    ground: '#3d4a5c',
    art: '<ellipse cx="50" cy="90" rx="31" ry="26" fill="#7a5a3a"/>'
      + '<ellipse cx="50" cy="92" rx="17" ry="18" fill="#c9a77a"/>'
      + '<path d="M43 83q3.5 2.4 7 0q3.5 2.4 7 0M41 91q4.5 2.8 9 0q4.5 2.8 9 0M43 99q3.5 2.4 7 0q3.5 2.4 7 0" stroke="#8a6a44" stroke-width="1.4" fill="none"/>'
      + '<path d="M22 30l-4-18 15 10zM78 30l4-18-15 10z" fill="#6e5134"/>'
      + '<ellipse cx="50" cy="46" rx="29" ry="26" fill="#8a6642"/>'
      + '<ellipse cx="39" cy="47" rx="12.5" ry="13" fill="#d9c09a"/><ellipse cx="61" cy="47" rx="12.5" ry="13" fill="#d9c09a"/>'
      + '<circle cx="39" cy="47" r="7.6" fill="#f2c14e"/><circle cx="61" cy="47" r="7.6" fill="#f2c14e"/>'
      + '<circle cx="39.6" cy="47.6" r="3.8" fill="#1b1410"/><circle cx="61.6" cy="47.6" r="3.8" fill="#1b1410"/>'
      + '<circle cx="38" cy="45.6" r="1.4" fill="#fff"/><circle cx="60" cy="45.6" r="1.4" fill="#fff"/>'
      + '<circle cx="39" cy="47" r="10" fill="none" stroke="#c9a24a" stroke-width="1.5"/><circle cx="61" cy="47" r="10" fill="none" stroke="#c9a24a" stroke-width="1.5"/>'
      + '<path d="M49 46.5h2M29 45l-5-2M71 45l5-2" stroke="#c9a24a" stroke-width="1.4"/>'
      + '<path d="M26 35q12-8 22 1M74 35q-12-8-22 1" stroke="#5a4028" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M46.5 56l3.5 8 3.5-8z" fill="#e0a13a"/>',
  },
  cat: {
    ground: '#4f5d4a',
    art: '<path d="M14 100C16 80 31 72 50 72s34 8 36 28z" fill="#d98b3a"/>'
      + '<path d="M40 73q10 8 20 0l-2 13h-16z" fill="#f6e6d2"/>'
      + '<path d="M27 42l-5-24 19 13zM73 42l5-24-19 13z" fill="#e39a48"/>'
      + '<path d="M28 37l-2.5-13 10.5 7.5zM72 37l2.5-13-10.5 7.5z" fill="#f2b8a8"/>'
      + '<ellipse cx="50" cy="52" rx="26" ry="22" fill="#e39a48"/>'
      + '<path d="M50 31v8M43.5 32.5l2 7M56.5 32.5l-2 7M26 50l6 1M26 55l6 0M74 50l-6 1M74 55l-6 0" stroke="#b86a24" stroke-width="2.2" stroke-linecap="round"/>'
      + '<ellipse cx="44.5" cy="61.5" rx="7" ry="5.5" fill="#f6e6d2"/><ellipse cx="55.5" cy="61.5" rx="7" ry="5.5" fill="#f6e6d2"/>'
      + '<ellipse cx="40" cy="48" rx="4.8" ry="5.4" fill="#8fc45a"/><ellipse cx="60" cy="48" rx="4.8" ry="5.4" fill="#8fc45a"/>'
      + '<ellipse cx="40" cy="48" rx="1.4" ry="4.4" fill="#1b1410"/><ellipse cx="60" cy="48" rx="1.4" ry="4.4" fill="#1b1410"/>'
      + '<circle cx="41.4" cy="46.2" r="1" fill="#fff"/><circle cx="61.4" cy="46.2" r="1" fill="#fff"/>'
      + '<path d="M46.8 56h6.4l-3.2 3.6z" fill="#d36a6a"/>'
      + '<path d="M50 59.6v2.4M50 62q-3 3-6 1M50 62q3 3 6 1" stroke="#6a3a2a" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M37 61l-17-3.5M37 63.5l-17 1M63 61l17-3.5M63 63.5l17 1" stroke="#fffaf0" stroke-width=".9" opacity=".85"/>',
  },
  raccoon: {
    ground: '#51604a',
    art: '<path d="M80 100q16-12 6-30" stroke="#6f6b66" stroke-width="10" fill="none" stroke-linecap="round"/>'
      + '<path d="M84 90l6-3M87 81l6-1M88 73l5 1" stroke="#2a2522" stroke-width="3.2"/>'
      + '<path d="M14 100C16 82 31 74 50 74s34 8 36 26z" fill="#7b7771"/>'
      + '<path d="M40 76q10 7 20 0l-3 10h-14z" fill="#d9d4cc"/>'
      + '<circle cx="28" cy="34" r="8.5" fill="#6f6b66"/><circle cx="72" cy="34" r="8.5" fill="#6f6b66"/>'
      + '<circle cx="28" cy="34" r="4.4" fill="#d9d4cc"/><circle cx="72" cy="34" r="4.4" fill="#d9d4cc"/>'
      + '<ellipse cx="50" cy="52" rx="27" ry="22" fill="#8e8a84"/>'
      + '<path d="M29 42q9-6 17 0M54 42q9-6 17 0" stroke="#f1eee8" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
      + '<path d="M23 50q13-8 23 1q4 2.4 8 0q10-9 23-1q-2 10-13 10q-8 0-12-4.4q-4 4.4-12 4.4q-11 0-17-10z" fill="#2a2522"/>'
      + '<circle cx="38.5" cy="51.5" r="3.4" fill="#f4efe6"/><circle cx="61.5" cy="51.5" r="3.4" fill="#f4efe6"/>'
      + '<circle cx="38.8" cy="51.8" r="2.1" fill="#1b1410"/><circle cx="61.8" cy="51.8" r="2.1" fill="#1b1410"/>'
      + '<ellipse cx="50" cy="64" rx="10" ry="7" fill="#efebe4"/>'
      + '<ellipse cx="50" cy="60" rx="3.6" ry="2.5" fill="#1b1410"/>'
      + '<path d="M50 62.5v2.4M50 65q-2.6 2.4-5 .8M50 65q2.6 2.4 5 .8" stroke="#3a322c" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
  },
  turtle: {
    ground: '#3f5a5a',
    art: '<path d="M48 66q-4 8 0 14" stroke="#8fae5e" stroke-width="15" fill="none" stroke-linecap="round"/>'
      + '<path d="M8 100C10 76 28 66 50 66s40 10 42 34z" fill="#5e7a3a"/>'
      + '<path d="M8 100C10 76 28 66 50 66s40 10 42 34" stroke="#3f5a26" stroke-width="2.2" fill="none"/>'
      + '<path d="M38 80l12-6 12 6-2 12H40zM38 80l-14 6M62 80l14 6M40 92l-8 8M60 92l8 8" stroke="#3f5a26" stroke-width="2" fill="none" stroke-linejoin="round"/>'
      + '<ellipse cx="50" cy="46" rx="19" ry="17" fill="#9bb86a"/>'
      + '<path d="M36 40q4-3 8 0M56 40q4-3 8 0" stroke="#6f8a44" stroke-width="1.4" fill="none"/>'
      + '<circle cx="42" cy="45" r="3.6" fill="#1b1410"/><circle cx="58" cy="45" r="3.6" fill="#1b1410"/>'
      + '<circle cx="43.1" cy="43.9" r="1.2" fill="#fff"/><circle cx="59.1" cy="43.9" r="1.2" fill="#fff"/>'
      + '<path d="M43 54q7 5 14 0" stroke="#4a5f2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<circle cx="47" cy="50" r=".9" fill="#4a5f2a"/><circle cx="53" cy="50" r=".9" fill="#4a5f2a"/>'
      + '<path d="M33 31c2-10 32-10 34 0l-2 3H35z" fill="#1f2e4a"/><path d="M31 33h38v3H31z" fill="#152036"/><circle cx="50" cy="29" r="2.2" fill="#d9b44a"/>',
  },
  hound: {
    ground: '#4a4f5e',
    art: '<path d="M14 100C16 84 30 78 50 78s34 6 36 22z" fill="#9a6838"/>'
      + '<path d="M33 79h34l-1 6H34z" fill="#8f1f1f"/><circle cx="50" cy="90" r="3.6" fill="#d9b44a"/>'
      + '<path d="M29 36c-11 4-14 24-9 39 3 7 11 5 12-2l2-31z" fill="#7a4e28"/>'
      + '<path d="M71 36c11 4 14 24 9 39-3 7-11 5-12-2l-2-31z" fill="#7a4e28"/>'
      + '<path d="M31 36c0-13 38-13 38 0v21c0 12-8 20-19 20s-19-8-19-20z" fill="#b07a44"/>'
      + '<path d="M40 35q10-4 20 0M42 39.5q8-3 16 0" stroke="#8a5a30" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="42" cy="48" rx="3.6" ry="3" fill="#2a1c14"/><ellipse cx="58" cy="48" rx="3.6" ry="3" fill="#2a1c14"/>'
      + '<path d="M37.6 50.6q4.4 3 8.8 0M53.6 50.6q4.4 3 8.8 0" stroke="#b5504a" stroke-width="1.4" fill="none"/>'
      + '<path d="M37 45.4q5-3 10 0M53 45.4q5-3 10 0" stroke="#7a4e28" stroke-width="2" fill="none"/>'
      + '<ellipse cx="50" cy="65" rx="12" ry="9.5" fill="#c99058"/>'
      + '<ellipse cx="50" cy="59" rx="5.4" ry="3.8" fill="#2a1c14"/>'
      + '<path d="M50 62.6v3.4M39 67q11 11 22 0" stroke="#7a4e28" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  },
  parrot: {
    ground: '#2f5a4a',
    art: '<path d="M28 100c-2-22 7-38 22-42 15 4 24 20 22 42z" fill="#c9302c"/>'
      + '<path d="M57 63c11 7 15 21 13 37H56z" fill="#2e6fb5"/>'
      + '<path d="M59 66c8 5 11 14 11 23" stroke="#f2c14e" stroke-width="4.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M60 72c6 4 8 11 8 18" stroke="#3aa04a" stroke-width="2.6" fill="none"/>'
      + '<circle cx="48" cy="42" r="19" fill="#d8352f"/>'
      + '<path d="M36 28q3-10 12-12M42 26q2-8 10-9" stroke="#e8554a" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="44" cy="45" rx="9" ry="10" fill="#f4efe6"/>'
      + '<path d="M38 44h4M38 48h4M39 52h4" stroke="#c9302c" stroke-width=".9" opacity=".6"/>'
      + '<circle cx="45" cy="42" r="3.6" fill="#f2e6a0"/><circle cx="45.4" cy="42.2" r="1.9" fill="#1b1410"/>'
      + '<path d="M56 37c11 0 15 9 11 17-2 4-6 5-8 3 2-3 2-7-2-10z" fill="#e8e0d0"/>'
      + '<path d="M56 50c2 4 4 6 7 6-3 2-7 1-9-2z" fill="#2a2522"/>',
  },
};

/** Everyone who can be drawn. */
export const PORTRAIT_KEYS = [...Object.keys(PEOPLE), ...Object.keys(ANIMALS)];
export const ANIMAL_KEYS = Object.keys(ANIMALS);

let uid = 0;

/**
 * An SVG string for somebody's cameo. Unknown keys get a plain silhouette
 * rather than nothing, so a new character never leaves a hole in a seat.
 */
export function portraitSvg(key, { size = 64, className = '' } = {}) {
  const p = PEOPLE[key];
  const id = `pt${++uid}`;
  const animal = ANIMALS[key];
  if (animal) {
    return `<svg class="portrait ${className}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`
      + '<defs>'
      + `<clipPath id="${id}c"><circle cx="50" cy="50" r="47"/></clipPath>`
      + `<radialGradient id="${id}v" cx="50%" cy="38%" r="62%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".45"/></radialGradient>`
      + `<radialGradient id="${id}l" cx="42%" cy="30%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity=".22"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>`
      + '</defs>'
      + `<g clip-path="url(#${id}c)">`
      + `<rect width="100" height="100" fill="${animal.ground}"/>`
      + `<rect width="100" height="100" fill="url(#${id}l)"/>`
      + animal.art
      + `<rect width="100" height="100" fill="url(#${id}v)"/>`
      + '</g>'
      + '<circle class="portrait-rim" cx="50" cy="50" r="47.5"/>'
      + '</svg>';
  }
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
