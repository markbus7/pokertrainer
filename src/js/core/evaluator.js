/**
 * Poker hand evaluator.
 *
 * evaluate() returns a single integer; bigger is better, equal means a true tie.
 * Layout (base 16, ranks 2..14 fit in a nibble):
 *
 *   score = cat<<20 | k1<<16 | k2<<12 | k3<<8 | k4<<4 | k5
 *
 * Kickers are written most-significant first, so integer comparison is
 * exactly poker comparison — no tie-break special cases anywhere else.
 */

import { rankOf, suitOf, RANK_NAMES, RANK_PLURALS } from './cards.js';

export const CAT = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
};

export const CAT_NAMES = [
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
];

const pack = (cat, k1 = 0, k2 = 0, k3 = 0, k4 = 0, k5 = 0) =>
  (cat << 20) | (k1 << 16) | (k2 << 12) | (k3 << 8) | (k4 << 4) | k5;

export const categoryOf = (score) => score >> 20;
export const kickersOf = (score) => [
  (score >> 16) & 15, (score >> 12) & 15, (score >> 8) & 15, (score >> 4) & 15, score & 15,
];

/**
 * Short Deck (6+) swaps flush and full house. Everything else is standard.
 * Applied as a category remap so kickers stay meaningful within a category.
 */
const SHORT_DECK_REMAP = { [CAT.FLUSH]: CAT.FULL_HOUSE, [CAT.FULL_HOUSE]: CAT.FLUSH };
const applyVariant = (score, shortDeck) => {
  if (!shortDeck) return score;
  const cat = score >> 20;
  const remapped = SHORT_DECK_REMAP[cat];
  return remapped === undefined ? score : (remapped << 20) | (score & 0xfffff);
};

/**
 * Highest card of the best straight in a rank bitmask, or 0.
 * Bit i is set when rank i is present; the ace is additionally mirrored to
 * bit 5 so A-2-3-4-5 (and A-6-7-8-9 in Short Deck) fall out of the same scan.
 */
function straightHigh(mask, shortDeck) {
  if (mask & (1 << 14)) mask |= 1 << (shortDeck ? 5 : 1);
  const lowest = shortDeck ? 9 : 5;
  for (let high = 14; high >= lowest; high--) {
    if (shortDeck && high === lowest) {
      // Wheel only: A-6-7-8-9, where the ace stands in at bit 5.
      const wheel = (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9);
      if ((mask & wheel) === wheel) return 9;
      continue;
    }
    let run = true;
    for (let k = 0; k < 5; k++) {
      const r = high - k;
      const bit = r === 1 ? 1 : r; // ace-low sits at bit 1 for the normal wheel
      if (!(mask & (1 << bit))) { run = false; break; }
    }
    if (run) return high;
  }
  return 0;
}

/**
 * Best 5-card score from 5, 6 or 7 cards. Single pass over rank/suit counts —
 * no combination enumeration, so this is cheap enough for Monte Carlo.
 */
export function evaluate(cards, shortDeck = false) {
  const rankCount = new Uint8Array(15);
  const suitCount = new Uint8Array(4);
  const suitRankMask = new Uint16Array(4);
  let rankMask = 0;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const r = rankOf(c);
    const s = suitOf(c);
    rankCount[r]++;
    suitCount[s]++;
    suitRankMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  // --- Flush family -------------------------------------------------
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) { flushSuit = s; break; }

  if (flushSuit >= 0) {
    const sfHigh = straightHigh(suitRankMask[flushSuit], shortDeck);
    if (sfHigh) return applyVariant(pack(CAT.STRAIGHT_FLUSH, sfHigh), shortDeck);
  }

  // --- Rank-count families -----------------------------------------
  const quads = [];
  const trips = [];
  const pairs = [];
  const singles = [];
  for (let r = 14; r >= 2; r--) {
    const n = rankCount[r];
    if (n === 4) quads.push(r);
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
    else if (n === 1) singles.push(r);
  }

  if (quads.length) {
    const q = quads[0];
    let kicker = 0;
    for (let r = 14; r >= 2; r--) if (r !== q && rankCount[r] > 0) { kicker = r; break; }
    return applyVariant(pack(CAT.QUADS, q, kicker), shortDeck);
  }

  if (trips.length >= 2) {
    // Two sets: the lower one plays as the pair.
    return applyVariant(pack(CAT.FULL_HOUSE, trips[0], trips[1]), shortDeck);
  }
  if (trips.length === 1 && pairs.length >= 1) {
    return applyVariant(pack(CAT.FULL_HOUSE, trips[0], pairs[0]), shortDeck);
  }

  if (flushSuit >= 0) {
    const ranks = [];
    for (let r = 14; r >= 2 && ranks.length < 5; r--) {
      if (suitRankMask[flushSuit] & (1 << r)) ranks.push(r);
    }
    return applyVariant(pack(CAT.FLUSH, ...ranks), shortDeck);
  }

  const sHigh = straightHigh(rankMask, shortDeck);
  if (sHigh) return applyVariant(pack(CAT.STRAIGHT, sHigh), shortDeck);

  if (trips.length === 1) {
    return applyVariant(pack(CAT.TRIPS, trips[0], singles[0] || 0, singles[1] || 0), shortDeck);
  }
  if (pairs.length >= 2) {
    const kicker = Math.max(singles[0] || 0, pairs[2] || 0);
    return applyVariant(pack(CAT.TWO_PAIR, pairs[0], pairs[1], kicker), shortDeck);
  }
  if (pairs.length === 1) {
    return applyVariant(pack(CAT.PAIR, pairs[0], singles[0] || 0, singles[1] || 0, singles[2] || 0), shortDeck);
  }
  return applyVariant(pack(CAT.HIGH_CARD, ...singles.slice(0, 5)), shortDeck);
}

/**
 * Omaha: exactly two hole cards plus exactly three board cards.
 * 6 x 10 = 60 combinations, evaluated with the same scorer.
 */
export function evaluateOmaha(hole, board, shortDeck = false) {
  if (board.length < 3) return 0;
  let best = 0;
  const five = new Array(5);
  for (let a = 0; a < hole.length; a++) {
    for (let b = a + 1; b < hole.length; b++) {
      five[0] = hole[a];
      five[1] = hole[b];
      for (let i = 0; i < board.length; i++) {
        for (let j = i + 1; j < board.length; j++) {
          for (let k = j + 1; k < board.length; k++) {
            five[2] = board[i];
            five[3] = board[j];
            five[4] = board[k];
            const s = evaluate(five, shortDeck);
            if (s > best) best = s;
          }
        }
      }
    }
  }
  return best;
}

/** Variant-aware entry point used by the table engine. */
export function evaluateHand(hole, board, variant) {
  const shortDeck = !!(variant && variant.shortDeck);
  if (variant && variant.omaha) return evaluateOmaha(hole, board, shortDeck);
  return evaluate(hole.concat(board), shortDeck);
}

/** Human-readable name: "Flush, Ace high", "Full House, Kings full of Twos". */
export function describeScore(score, shortDeck = false) {
  let cat = score >> 20;
  if (shortDeck) {
    const back = { [CAT.FLUSH]: CAT.FULL_HOUSE, [CAT.FULL_HOUSE]: CAT.FLUSH };
    if (back[cat] !== undefined) cat = back[cat];
  }
  const k = kickersOf(score);
  switch (cat) {
    case CAT.STRAIGHT_FLUSH:
      return k[0] === 14 ? 'Royal Flush' : `Straight Flush, ${RANK_NAMES[k[0]]} high`;
    case CAT.QUADS: return `Four of a Kind, ${RANK_PLURALS[k[0]]}`;
    case CAT.FULL_HOUSE: return `Full House, ${RANK_PLURALS[k[0]]} full of ${RANK_PLURALS[k[1]]}`;
    case CAT.FLUSH: return `Flush, ${RANK_NAMES[k[0]]} high`;
    case CAT.STRAIGHT: return `Straight, ${RANK_NAMES[k[0]]} high`;
    case CAT.TRIPS: return `Three of a Kind, ${RANK_PLURALS[k[0]]}`;
    case CAT.TWO_PAIR: return `Two Pair, ${RANK_PLURALS[k[0]]} and ${RANK_PLURALS[k[1]]}`;
    case CAT.PAIR: return `Pair of ${RANK_PLURALS[k[0]]}`;
    default: return `${RANK_NAMES[k[0]]} high`;
  }
}

/** Short label for compact UI: "Flush", "Two Pair". */
export function shortCategoryName(score, shortDeck = false) {
  let cat = score >> 20;
  if (shortDeck) {
    const back = { [CAT.FLUSH]: CAT.FULL_HOUSE, [CAT.FULL_HOUSE]: CAT.FLUSH };
    if (back[cat] !== undefined) cat = back[cat];
  }
  return CAT_NAMES[cat];
}
