/**
 * How you look: the five outfits a career wears, and the choices that are
 * yours to make about the rest.
 *
 * The outfit is earned, never bought. It follows the rank — a deckhand's
 * borrowed shirt at the start, a legend's velvet at the end — so the figure on
 * the Character screen is a picture of how far you have come. What is in the
 * hands follows how you play, and the face follows how the last sittings went.
 * Skin, hair, a beard and the colour of the waistcoat are the reader's own
 * choice, and free: the river does not sell anything that does nothing.
 *
 * Kept apart from the drawing (ui/characterArt.js) so the save can check a
 * look without the DOM.
 */

export const TIERS = [
  { tier: 0, name: 'Deckhand', from: 1, blurb: 'Just off the boat: a borrowed shirt, braces and a cap.' },
  { tier: 1, name: 'Card-room grinder', from: 3, blurb: 'A green visor and sleeve garters. You put the hours in.' },
  { tier: 2, name: 'Riverboat regular', from: 5, blurb: 'A bowler and a tailored waistcoat. The tables know your face.' },
  { tier: 3, name: 'Riverboat shark', from: 7, blurb: 'A long coat and a flat-brimmed hat. People think twice before they sit with you.' },
  { tier: 4, name: 'Legend of the river', from: 9, blurb: 'Velvet, gold and smoked glasses. They tell stories about you downriver.' },
];

/** The outfit a rank wears: a new one every two ranks. */
export const tierFor = (level) => (level >= 9 ? 4 : level >= 7 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0);

/** Skin tones: [base, shade]. The same six the portraits use. */
export const SKINS = {
  fair: ['#f1cdb0', '#d9a888'],
  light: ['#e9bb97', '#cf9a76'],
  tan: ['#d9a37c', '#bd835c'],
  olive: ['#c99a70', '#a97a52'],
  brown: ['#a8704c', '#8a5638'],
  deep: ['#7a4c32', '#5f3822'],
};
export const HAIRS = ['short', 'long', 'bun', 'curly', 'bald'];
export const HAIR_COLOURS = {
  black: '#1f1a17',
  brown: '#5a3a22',
  auburn: '#8a3f22',
  blond: '#c9a25a',
  grey: '#a7a39c',
  white: '#e6e1d6',
};
export const BEARDS = ['none', 'stubble', 'moustache', 'beard'];
/** The colour you wear: the waistcoat, the hatband, the tie. */
export const COLOURS = {
  crimson: '#8e2b2b',
  navy: '#22406b',
  emerald: '#1f6a4a',
  plum: '#5d2f5c',
  mustard: '#a8781f',
};

/** What the choices are called, for the editor. */
export const LOOK_LABELS = {
  skin: { fair: 'Fair', light: 'Light', tan: 'Tan', olive: 'Olive', brown: 'Brown', deep: 'Deep' },
  hair: { short: 'Short', long: 'Long', bun: 'Bun', curly: 'Curly', bald: 'Bald' },
  hairColour: { black: 'Black', brown: 'Brown', auburn: 'Auburn', blond: 'Blond', grey: 'Grey', white: 'White' },
  beard: { none: 'Clean-shaven', stubble: 'Stubble', moustache: 'Moustache', beard: 'Beard' },
  colour: { crimson: 'Crimson', navy: 'Navy', emerald: 'Emerald', plum: 'Plum', mustard: 'Mustard' },
};

export const DEFAULT_LOOK = { skin: 'olive', hair: 'short', hairColour: 'brown', beard: 'none', colour: 'crimson', name: '' };

/** What the river calls you, if you have told it: a short name, nothing else. */
export const NAME_MAX = 18;

/** A look read back from a save: only choices that exist. */
export function sanitizeLook(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
  return {
    skin: has(SKINS, r.skin) ? r.skin : DEFAULT_LOOK.skin,
    hair: HAIRS.includes(r.hair) ? r.hair : DEFAULT_LOOK.hair,
    hairColour: has(HAIR_COLOURS, r.hairColour) ? r.hairColour : DEFAULT_LOOK.hairColour,
    beard: BEARDS.includes(r.beard) ? r.beard : DEFAULT_LOOK.beard,
    colour: has(COLOURS, r.colour) ? r.colour : DEFAULT_LOOK.colour,
    // Control characters out (a line break is a space), spaces collapsed, and
    // short enough for a name plate.
    name: typeof r.name === 'string'
      ? r.name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim()
      : '',
  };
}

/** What the hands hold, by the kind of player you are. */
export function propsFor(typeKey) {
  if (typeKey === 'nit' || typeKey === 'rock') return 'tea';
  if (typeKey === 'lag' || typeKey === 'maniac') return 'chips';
  if (typeKey === 'station') return 'showcards';
  if (typeKey === 'tag' || typeKey === 'reg') return 'cards';
  return 'none';
}

/** The props, said in words, for the picture's description. */
export const PROPS_TEXT = {
  tea: 'nursing a cup of tea',
  chips: 'flipping a chip',
  showcards: 'showing a seven-deuce',
  cards: 'holding two cards close',
  none: '',
};

/**
 * How the last sittings went: a grin, a straight face, or a scowl. Twenty big
 * blinds either way over the last three sittings is a run worth wearing.
 */
export function formFor(sessions) {
  const recent = (Array.isArray(sessions) ? sessions : []).slice(-3);
  if (!recent.length) return 'steady';
  const net = recent.reduce((s, x) => s + (x && Number.isFinite(x.profitBb) ? x.profitBb : 0), 0);
  if (net >= 20) return 'hot';
  if (net <= -20) return 'cold';
  return 'steady';
}

export const FORM_TEXT = {
  hot: { name: 'Running hot', blurb: 'Up {bb} over your last sittings. Enjoy it, and do not change a thing.' },
  steady: { name: 'Steady', blurb: 'Nothing dramatic either way over your last sittings.' },
  cold: { name: 'Running cold', blurb: 'Down {bb} over your last sittings. It happens to everybody: check the decisions, not the results.' },
};
