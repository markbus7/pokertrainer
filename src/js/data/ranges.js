/**
 * Preflop ranges.
 *
 * Charts are written in the notation players actually use ("22+, A2s+, KQo")
 * and expanded into hand keys at load time. These are solid, widely-taught
 * baseline ranges for 100bb 6-max cash — close to solver output at the edges
 * but deliberately simplified so they can be memorised and used.
 */

import { RANK_CHARS, ALL_HAND_KEYS, comboCount } from '../core/cards.js';

const rankVal = (ch) => RANK_CHARS.indexOf(ch.toUpperCase()) + 2;

/** 'AKs' -> {hi, lo, suited, pair}. Case-insensitive: callers upper-case ranks. */
function decompose(key) {
  const hi = rankVal(key[0]);
  const lo = rankVal(key[1]);
  const suffix = (key[2] || '').toLowerCase();
  return { hi, lo, suited: suffix === 's', pair: hi === lo };
}

const keyFor = (hi, lo, suffix) => {
  const a = RANK_CHARS[Math.max(hi, lo) - 2];
  const b = RANK_CHARS[Math.min(hi, lo) - 2];
  return hi === lo ? a + b : a + b + suffix;
};

/**
 * Expand one token of range notation.
 *   'TT+'      pairs from TT up
 *   'A2s+'     suited aces from A2s up to AKs
 *   'KTs-K7s'  an explicit run
 *   'QJo'      a single hand
 */
function expandToken(token) {
  const t = token.trim();
  if (!t) return [];

  // Range with an explicit endpoint: 'A5s-A2s' or 'AA-JJ'
  const dash = t.match(/^([2-9TJQKA]{2}[so]?)-([2-9TJQKA]{2}[so]?)$/i);
  if (dash) {
    const a = decompose(dash[1].toUpperCase());
    const b = decompose(dash[2].toUpperCase());
    const out = [];
    if (a.pair && b.pair) {
      const from = Math.min(a.hi, b.hi);
      const to = Math.max(a.hi, b.hi);
      for (let r = from; r <= to; r++) out.push(keyFor(r, r));
      return out;
    }
    if (a.hi !== b.hi) throw new Error(`Bad range token: ${t}`);
    const suffix = a.suited ? 's' : 'o';
    const from = Math.min(a.lo, b.lo);
    const to = Math.max(a.lo, b.lo);
    for (let r = from; r <= to; r++) out.push(keyFor(a.hi, r, suffix));
    return out;
  }

  // Open-ended: 'TT+', 'A2s+', 'KJo+'
  if (t.endsWith('+')) {
    const base = decompose(t.slice(0, -1).toUpperCase());
    const out = [];
    if (base.pair) {
      for (let r = base.hi; r <= 14; r++) out.push(keyFor(r, r));
      return out;
    }
    const suffix = base.suited ? 's' : 'o';
    for (let r = base.lo; r < base.hi; r++) out.push(keyFor(base.hi, r, suffix));
    return out;
  }

  return [t.toUpperCase().slice(0, 2) + (t.length > 2 ? t[2].toLowerCase() : '')];
}

/** '22+, A2s+, KQo' -> Set of hand keys. */
export function parseRange(notation) {
  const set = new Set();
  for (const token of String(notation).split(',')) {
    for (const key of expandToken(token)) if (key) set.add(key);
  }
  return set;
}

/** What share of all 1326 starting combos a range represents. */
export function rangePercent(range) {
  let combos = 0;
  for (const key of range) combos += comboCount(key);
  return combos / 1326;
}

export function rangeCombos(range) {
  let combos = 0;
  for (const key of range) combos += comboCount(key);
  return combos;
}

/* ------------------------------------------------------------------ *
 * 6-max positions, in order of action.
 * ------------------------------------------------------------------ */
export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export const POSITION_INFO = {
  UTG: { name: 'Under the Gun', blurb: 'First to act, five players behind. Open tight — you will be out of position on almost every hand you play.' },
  HJ: { name: 'Hijack', blurb: 'Two seats off the button. You can add suited broadways and more suited connectors.' },
  CO: { name: 'Cutoff', blurb: 'Only the button and blinds behind. Steal wide and isolate limpers.' },
  BTN: { name: 'Button', blurb: 'The most profitable seat in poker. You act last on every postflop street — open close to half your hands.' },
  SB: { name: 'Small Blind', blurb: 'Already invested, but out of position for the rest of the hand. Raise or fold; limping invites punishment.' },
  BB: { name: 'Big Blind', blurb: 'You get a discount to continue, so you defend very wide — but you play every pot out of position.' },
};

/* ---- Raise first in (nobody has entered the pot) ------------------ */
export const RFI = {
  UTG: '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, AJo+, KQo',
  HJ: '22+, A2s+, K7s+, Q8s+, J8s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, ATo+, KJo+, QJo',
  CO: '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A9o+, KTo+, QTo+, JTo',
  BTN: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 84s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o',
  SB: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K9o+, Q9o+, J9o+, T9o',
};

/* ---- Facing a single raise: 3-bet for value, and as a bluff ------- */
export const THREE_BET = {
  UTG: { value: 'QQ+, AKs, AKo, AQs', bluff: 'A5s-A3s, KJs, QJs' },
  HJ: { value: 'JJ+, AQs+, AKo', bluff: 'A5s-A2s, KTs, QTs, JTs' },
  CO: { value: 'TT+, AQs+, AKo, AQo', bluff: 'A5s-A2s, K9s, QTs, JTs, T9s, 87s' },
  BTN: { value: '99+, ATs+, AJo+, KQs', bluff: 'A5s-A2s, K8s-K5s, Q9s, J9s, T8s, 97s, 76s, 65s' },
  SB: { value: '99+, ATs+, AJo+, KQs', bluff: 'A5s-A2s, K9s-K6s, Q9s, J9s, T9s, 98s' },
  BB: { value: 'TT+, AJs+, AQo+, KQs', bluff: 'A5s-A2s, K9s-K7s, QTs, J9s, T8s, 87s, 76s' },
};

/* ---- Big blind defence: call wide, but only against wide openers -- */
export const BB_DEFEND = {
  UTG: '22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o+, KTo+, QTo+, JTo',
  HJ: '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A7o+, K9o+, QTo+, JTo, T9o',
  CO: '22+, A2s+, K3s+, Q5s+, J6s+, T6s+, 95s+, 84s+, 74s+, 63s+, 53s+, A4o+, K8o+, Q9o+, J9o+, T8o+, 98o',
  BTN: '22+, A2s+, K2s+, Q2s+, J4s+, T5s+, 94s+, 84s+, 73s+, 63s+, 52s+, 42s+, 32s, A2o+, K5o+, Q7o+, J7o+, T7o+, 97o+, 86o+, 76o, 65o',
  SB: '22+, A2s+, K2s+, Q2s+, J3s+, T5s+, 95s+, 84s+, 74s+, 63s+, 53s+, 43s, A2o+, K4o+, Q6o+, J7o+, T7o+, 97o+, 87o, 76o',
};

/** Everything pre-expanded once, so lookups in drills are just Set.has(). */
function build() {
  const rfi = {};
  for (const [pos, notation] of Object.entries(RFI)) rfi[pos] = parseRange(notation);

  const threeBet = {};
  for (const [pos, spec] of Object.entries(THREE_BET)) {
    const value = parseRange(spec.value);
    const bluff = parseRange(spec.bluff);
    threeBet[pos] = { value, bluff, all: new Set([...value, ...bluff]) };
  }

  const bbDefend = {};
  for (const [pos, notation] of Object.entries(BB_DEFEND)) bbDefend[pos] = parseRange(notation);

  return { rfi, threeBet, bbDefend };
}

export const CHARTS = build();

/**
 * The correct preflop action for a spot, with the reason a coach would give.
 * @param {string} hand      hand key, e.g. 'AJs'
 * @param {string} position  hero's seat
 * @param {object} spot      { action: 'rfi' | 'vs_raise', raiser?: position }
 */
export function preflopAdvice(hand, position, spot = { action: 'rfi' }) {
  if (spot.action === 'rfi') {
    const range = CHARTS.rfi[position];
    if (!range) throw new Error(`No RFI chart for ${position}`);
    const open = range.has(hand);
    return {
      action: open ? 'raise' : 'fold',
      range,
      percent: rangePercent(range),
      reason: open
        ? `${hand} is inside the ${(rangePercent(range) * 100).toFixed(0)}% opening range from ${position}.`
        : `${hand} is outside the ${(rangePercent(range) * 100).toFixed(0)}% opening range from ${position}. Folding here is a profit, not a missed opportunity.`,
    };
  }

  const raiser = spot.raiser;
  const chart = CHARTS.threeBet[position];
  if (chart && chart.value.has(hand)) {
    return { action: 'raise', kind: 'value', range: chart.all, reason: `${hand} is strong enough to 3-bet for value against a ${raiser} open.` };
  }
  if (chart && chart.bluff.has(hand)) {
    return { action: 'raise', kind: 'bluff', range: chart.all, reason: `${hand} is a 3-bet bluff: it blocks their strong hands and plays well when called.` };
  }
  if (position === 'BB') {
    const defend = CHARTS.bbDefend[raiser];
    if (defend && defend.has(hand)) {
      return { action: 'call', range: defend, reason: `You are getting a discount in the big blind, and ${hand} is inside the defending range against a ${raiser} open.` };
    }
    return { action: 'fold', range: defend, reason: `Even at big-blind prices, ${hand} is too weak to defend out of position against a ${raiser} open.` };
  }
  const flat = CHARTS.bbDefend[raiser];
  if (flat && flat.has(hand) && ['BTN', 'CO'].includes(position)) {
    return { action: 'call', range: flat, reason: `${hand} plays well in position against a ${raiser} open — call and use your position postflop.` };
  }
  return { action: 'fold', reason: `${hand} is not strong enough to continue against a ${raiser} open from ${position}.` };
}

/**
 * Hand strength 0..1 for the 169 grid, measured as all-in equity against a
 * single random hand. Generated by tools/generate-strength.js.
 */
export { HAND_STRENGTH } from './handStrength.js';

/** Every hand key sorted strongest first. */
export function sortedByStrength(strength) {
  return [...ALL_HAND_KEYS].sort((a, b) => strength[b] - strength[a]);
}
