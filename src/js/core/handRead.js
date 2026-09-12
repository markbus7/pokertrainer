/**
 * What their line says about their hand.
 *
 * The app could compute a price better than most players and still never
 * taught the skill that decides the money: working out what you are up
 * against. Every postflop verdict fell back to equity against the villain's
 * actual cards — grading with the answer key face up — because the villain's
 * cards were always known to the grader. At a real table they never are.
 *
 * So this builds the range instead. Every hand the opponent could hold is run
 * through the same rule the bot itself uses, and the ones that would have
 * taken the line they took are what remains, each weighted by how often they
 * would. Nothing here models the bots; it calls their rule.
 */

import { makeDeck, removeCards } from './cards.js';
import { evaluate } from './evaluator.js';
import { makeRng, shuffle } from './rng.js';

import { CUTS, getProfile } from '../engine/bots.js';

/** Every two-card holding still available once these cards are visible. */
export function candidateHands(dead) {
  const rest = removeCards(makeDeck(), dead);
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) out.push([rest[i], rest[j]]);
  }
  return out;
}

/**
 * Equity for every candidate at once.
 *
 * On a finished board this is exact and costs nothing: score each holding
 * once, sort, and every hand's equity is its place in that order. Sampling
 * was tried and could not be made to hold still — the buckets have hard
 * edges, so hands sitting near one flipped between runs and the answer moved
 * 8 points at 800 samples per hand, barely better than 14 at 120. A drill
 * cannot mark you wrong with a number that wanders, so the read is built on
 * the river, where no card is unknown and nothing has to be guessed.
 */
export function riverEquities(board, candidates) {
  const scores = candidates.map((h) => evaluate([h[0], h[1], ...board]));
  const sorted = scores.slice().sort((a, b) => a - b);
  const n = sorted.length;

  // How many scores sit strictly below a value, and how many equal it.
  const below = (value) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < value) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  const notAbove = (value) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] <= value) lo = mid + 1; else hi = mid;
    }
    return lo;
  };

  return scores.map((score) => {
    const lower = below(score);
    const ties = notAbove(score) - lower - 1;      // minus the hand itself
    return n > 1 ? (lower + ties / 2) / (n - 1) : 0.5;
  });
}

/**
 * Equity for every candidate on a street with cards to come.
 *
 * One independent run-out sample per hand, which is the whole trick. The
 * first attempt drew one set of run-outs and scored every hand against it —
 * cheaper per sample, and wrong: the errors are then correlated across hands,
 * so they do not cancel in a total and the share wandered 6 points at 200
 * samples. Sampling each hand separately costs less in the end: 40 run-outs
 * per hand lands within 0.41 points of a 600-run-out reference on average,
 * worst case 1.03, in about 70ms for a whole board.
 *
 * The seed comes from the board, so a spot always reads the same. A drill
 * that answers differently on a second look is not teaching a read, it is
 * teaching that the app cannot be trusted.
 */
export function sampledEquities(board, candidates, samples = 40, seed = null) {
  // The seed is an argument only so a test can take two independent draws of
  // the same spot and check they agree. Under one shared set of run-outs they
  // would not: that is the whole difference this rests on.
  const rng = makeRng(seed == null
    ? board.reduce((acc, card) => (acc * 53 + card + 1) % 2147483647, 7)
    : seed);
  const need = 5 - board.length;
  return candidates.map((hand) => {
    const rest = removeCards(makeDeck(), [...board, ...hand]);
    let won = 0;
    for (let s = 0; s < samples; s++) {
      const pool = shuffle(rng, rest.slice());
      const full = board.concat(pool.slice(0, need));
      const mine = evaluate([hand[0], hand[1], ...full]);
      const theirs = evaluate([...pool.slice(need, need + 2), ...full]);
      won += mine > theirs ? 1 : mine === theirs ? 0.5 : 0;
    }
    return won / samples;
  });
}

/** Exact where the board is finished, sampled where it is not. */
export const equitiesFor = (board, candidates) => (board.length >= 5
  ? riverEquities(board, candidates)
  : sampledEquities(board, candidates));

/**
 * How often this profile takes each action at this equity.
 *
 * Composed in the same order the bot rolls its dice, because the order is the
 * rule: a hand that fails the value-bet roll goes on to be offered as a
 * bluff, and one that passes never reaches the later branches at all.
 */
export function actionChances(profile, equity, situation) {
  const { toCall = 0, needed = 0, street = 'flop', heroIsAggressor = false } = situation;
  // getProfile hands an object straight back, so an adapted profile keeps its
  // adjustments here. Looking the key up again would read the archetype while
  // the bot plays an adjusted version of it — a read of somebody else.
  const p = getProfile(profile);

  if (toCall > 0) {
    const valueRaise = equity > CUTS.valueRaise(p) ? CUTS.valueRaiseChance(p) : 0;
    const bluffRaise = equity < CUTS.bluffRaiseCeiling && street !== 'river'
      ? CUTS.bluffRaiseChance(p) : 0;
    // The two raise branches are separated by equity, so at most one applies.
    const raise = Math.min(1, valueRaise + bluffRaise);
    const calls = equity > CUTS.callThreshold(p, needed) ? 1 : 0;
    return { raise, call: (1 - raise) * calls, fold: (1 - raise) * (1 - calls), bet: 0, check: 0 };
  }

  const value = equity > CUTS.valueBet(p) ? CUTS.valueBetChance(p) : 0;
  const bluff = equity < CUTS.bluffCeiling ? CUTS.bluffChance(p, { heroIsAggressor, street }) : 0;
  const thin = equity > CUTS.thinValue ? CUTS.thinValueChance(p) : 0;
  const bet = Math.min(1, value + (1 - value) * (bluff + (1 - bluff) * thin));
  return { bet, check: 1 - bet, raise: 0, call: 0, fold: 0 };
}

/**
 * Buckets by what a hand is worth here, not by its name.
 *
 * Naming the seven-card category was tried first and it flattened every
 * profile into the same read: on a random board most holdings make a pair out
 * of the board itself, so "one pair" swallowed 56-70% of every range and the
 * nit looked like the maniac. What a reader needs to know is whether a hand
 * wants a call, and equity against a random holding says that directly.
 */
export const BUCKETS = [
  { key: 'strong', label: 'hands that want a call', floor: 0.75 },
  { key: 'medium', label: 'bluff-catchers', floor: 0.45 },
  { key: 'air', label: 'hands that need you to fold', floor: 0 },
];

export const bucketOf = (equity) => (equity >= 0.75 ? 'strong' : equity >= 0.45 ? 'medium' : 'air');

/**
 * The range that takes this action, with each hand weighted by how often.
 *
 * Weights rather than a yes/no list, because a profile that bluffs a third of
 * the time has a third of its air in the betting range — flattening that to
 * "in" or "out" would describe a player nobody is sitting across from.
 */
export function readRange(profileKey, board, action, situation) {
  const profile = getProfile(profileKey);
  const dead = board.concat(situation.dead || []);
  const candidates = candidateHands(dead);
  const equities = equitiesFor(board, candidates);

  let total = 0;
  const share = { strong: 0, medium: 0, air: 0 };
  const hands = [];
  for (let i = 0; i < candidates.length; i++) {
    const weight = actionChances(profile, equities[i], situation)[action] || 0;
    if (weight <= 0) continue;
    const bucket = bucketOf(equities[i]);
    share[bucket] += weight;
    total += weight;
    hands.push({ hand: candidates[i], weight, equity: equities[i], bucket });
  }
  if (!total) return null;

  return {
    profile,
    action,
    total,
    hands,
    share: { strong: share.strong / total, medium: share.medium / total, air: share.air / total },
  };
}

/**
 * The names a reader can actually pick between.
 *
 * Ordered so the first match wins: polarised is checked before value-heavy
 * because a range can be both strong-topped and full of air, and "strong and
 * air, little between" is the more useful thing to have noticed.
 */
export const SHAPES = [
  {
    key: 'polarised',
    label: 'Polarised — strong hands and air, little in between',
    fits: (s) => s.strong >= 0.28 && s.air >= 0.28,
  },
  {
    key: 'value',
    label: 'Value-heavy — mostly hands that beat a bluff',
    fits: (s) => s.strong >= 0.4,
  },
  {
    key: 'air',
    label: 'Mostly air — very little of it wants a call',
    fits: (s) => s.air >= 0.5,
  },
  {
    key: 'merged',
    label: 'Merged — a lot of one pair, thin value',
    fits: (s) => s.pair >= 0.35,
  },
  {
    key: 'wide',
    label: 'Wide and weak — a bit of everything, nothing concentrated',
    fits: () => true,
  },
];

export function shapeOf(share) {
  return SHAPES.find((s) => s.fits(share));
}

/**
 * Your hand against that range, exactly — the number the read is worth.
 *
 * Weighted, because the range is weighted: a profile that bluffs a fifth of
 * the time puts a fifth of its air in here, and counting those hands as whole
 * would price a call against a player nobody is sitting across from.
 */
export function equityAgainst(range, hero, board) {
  const mine = evaluate([...hero, ...board]);
  let won = 0;
  let total = 0;
  for (const entry of range.hands) {
    // A hand holding one of your cards is not a hand they can have.
    if (entry.hand[0] === hero[0] || entry.hand[0] === hero[1]
      || entry.hand[1] === hero[0] || entry.hand[1] === hero[1]) continue;
    const theirs = evaluate([...entry.hand, ...board]);
    won += entry.weight * (mine > theirs ? 1 : mine === theirs ? 0.5 : 0);
    total += entry.weight;
  }
  return total ? won / total : 0.5;
}

/**
 * The ladder a reader picks their answer from.
 *
 * Measured, not chosen: across 240 profile-by-board combinations the share of
 * air in a river betting range runs from 1.7% to 26.5%, median 14.2%. An even
 * 5/15/25/35 put a fourth option on screen that was never once the answer,
 * which is a dead choice and a pattern worth learning for the wrong reason.
 */
export const READ_BANDS = [3, 10, 18, 26];

/**
 * How far from a band boundary the answer has to sit before it is fair to
 * ask. Wider where the share is sampled: the estimate carries about a point
 * of error, so a truth sitting right on a boundary could be handed the wrong
 * band by the sampling alone.
 */
export const marginFor = (board) => (board.length >= 5 ? 2 : 3);

/**
 * The band the truth belongs to, and null when two of them are defensible.
 *
 * A share sitting halfway between two rungs has two honest answers, and
 * marking one of them wrong teaches the reader to distrust the scoring rather
 * than to read the hand.
 */
export function nearestBand(airPercent, margin = 2) {
  const sorted = READ_BANDS.slice().sort((a, b) => Math.abs(a - airPercent) - Math.abs(b - airPercent));
  if (Math.abs(sorted[1] - airPercent) - Math.abs(sorted[0] - airPercent) < margin) return null;
  return sorted[0];
}
