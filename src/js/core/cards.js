/**
 * Card model. A card is a plain integer 0..51 so decks, boards and
 * Monte-Carlo loops stay allocation-free.
 *
 *   card = rankIndex * 4 + suit      rankIndex 0..12 -> rank 2..14
 */

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'cdhs';
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠']; // c d h s
export const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'];

export const RANK_NAMES = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};
export const RANK_PLURALS = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
};

export const rankOf = (card) => (card >> 2) + 2;      // 2..14
export const suitOf = (card) => card & 3;             // 0..3
export const rankIndexOf = (card) => card >> 2;       // 0..12
export const makeCard = (rank, suit) => (rank - 2) * 4 + suit;

/** 'As' -> integer. Throws on malformed input so bad data fails loudly. */
export function parseCard(str) {
  if (typeof str !== 'string' || str.length !== 2) {
    throw new Error(`Bad card: ${JSON.stringify(str)}`);
  }
  const r = RANK_CHARS.indexOf(str[0].toUpperCase());
  const s = SUIT_CHARS.indexOf(str[1].toLowerCase());
  if (r < 0 || s < 0) throw new Error(`Bad card: ${str}`);
  return r * 4 + s;
}

/** 'AsKd 7h' or ['As','Kd'] -> integer array. */
export function parseCards(input) {
  if (Array.isArray(input)) return input.map((c) => (typeof c === 'number' ? c : parseCard(c)));
  const cleaned = String(input).replace(/[\s,]/g, '');
  const out = [];
  for (let i = 0; i < cleaned.length; i += 2) out.push(parseCard(cleaned.slice(i, i + 2)));
  return out;
}

export const cardToString = (card) => RANK_CHARS[card >> 2] + SUIT_CHARS[card & 3];
export const cardsToString = (cards) => cards.map(cardToString).join(' ');

/** Full 52-card deck, or the 36-card 6+ deck for Short Deck. */
export function makeDeck(shortDeck = false) {
  const deck = [];
  const lowRankIndex = shortDeck ? RANK_CHARS.indexOf('6') : 0;
  for (let r = lowRankIndex; r < 13; r++) for (let s = 0; s < 4; s++) deck.push(r * 4 + s);
  return deck;
}

/* ------------------------------------------------------------------ *
 * The 169-hand grid: how humans actually talk about starting hands.
 * ------------------------------------------------------------------ */

/** [As, Kd] -> 'AKo'.  [7h, 7s] -> '77'. */
export function handKey(cards) {
  const [a, b] = cards;
  const ra = rankOf(a);
  const rb = rankOf(b);
  const hi = Math.max(ra, rb);
  const lo = Math.min(ra, rb);
  const hiChar = RANK_CHARS[hi - 2];
  const loChar = RANK_CHARS[lo - 2];
  if (hi === lo) return hiChar + loChar;
  return hiChar + loChar + (suitOf(a) === suitOf(b) ? 's' : 'o');
}

/** 'AKs' -> every specific two-card combo it contains. */
export function expandHandKey(key) {
  const hi = RANK_CHARS.indexOf(key[0]) + 2;
  const lo = RANK_CHARS.indexOf(key[1]) + 2;
  const kind = key[2];
  const combos = [];
  if (hi === lo) {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) combos.push([makeCard(hi, s1), makeCard(lo, s2)]);
    }
  } else if (kind === 's') {
    for (let s = 0; s < 4; s++) combos.push([makeCard(hi, s), makeCard(lo, s)]);
  } else {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) if (s1 !== s2) combos.push([makeCard(hi, s1), makeCard(lo, s2)]);
    }
  }
  return combos;
}

/** How many of the 1326 combos a hand key represents. */
export function comboCount(key) {
  if (key.length === 2) return 6;
  return key[2] === 's' ? 4 : 12;
}

/** All 169 keys, laid out row-major exactly like a printed range chart. */
export function handGrid() {
  const rows = [];
  for (let i = 12; i >= 0; i--) {
    const row = [];
    for (let j = 12; j >= 0; j--) {
      const hi = RANK_CHARS[Math.max(i, j)];
      const lo = RANK_CHARS[Math.min(i, j)];
      if (i === j) row.push(hi + lo);
      else if (i > j) row.push(hi + lo + 's');   // above the diagonal -> suited
      else row.push(hi + lo + 'o');              // below -> offsuit
    }
    rows.push(row);
  }
  return rows;
}

export const ALL_HAND_KEYS = handGrid().flat();

/** Remove specific cards from a deck array (used for dead-card handling). */
export function removeCards(deck, dead) {
  const blocked = new Set(dead);
  return deck.filter((c) => !blocked.has(c));
}
