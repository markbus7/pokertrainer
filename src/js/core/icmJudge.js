/**
 * Grading a short-stack decision in a tournament, with the prizes counted.
 *
 * The coach grades a cash-game decision on chips: a call is right when the
 * equity beats the price. In a tournament that is the wrong question. Chips
 * stop being money the moment there is a prize list — the chips you lose cost
 * more than the chips you win are worth — so the same call that is right in a
 * cash game can be a mistake on the bubble. What matters is the *prize equity*
 * of the stacks that would result (ICM, the Malmuth-Harville model in
 * core/odds.js), not the chips.
 *
 * So this grades the one decision a short stack has, shove or fold, call or
 * fold, by working out what each is worth in prize money: the stacks after
 * each ending, weighted by how often it happens, run through ICM. The better
 * is the right answer, and the gap is what the mistake cost.
 *
 *   - Facing a shove: the equity against what the shover would shove with,
 *     for the call; the pot goes to them for the fold.
 *   - First in: the shove wins the blinds when everybody folds (how often is
 *     read off each player behind: the share they would call with, from
 *     engine/pushfold) and is a flip against the first who calls.
 *
 * It is a model, and says so: the opponents' ranges are the ones the bots play
 * (so it is exact against them), and a real table is a little different. The
 * verdict leans on the gap, not on its sign alone — a spot within a hair is
 * "close" and graded as fine either way.
 *
 * Free of the DOM, so it can be tested.
 */

import { icmEquity } from './odds.js';
import { equityVsRange } from './equity.js';
import { expandHandKey, handKey } from './cards.js';
import { STRENGTH_ORDER } from '../data/handStrength.js';
import { makeRng } from './rng.js';
import { pushShare, callShare, pushMult, callMult } from '../engine/pushfold.js';

/** Where a spot is within a hair: under this share of the prize pool, either action is fine. */
export const CLOSE = 0.004;
/** Under this share of the prize pool, a mistake is a small one. */
export const SMALL = 0.02;

/** The top `share` of the 169 hands, as combos for equityVsRange. */
export function rangeOf(share) {
  const cut = Math.max(1, Math.round(169 * Math.min(1, Math.max(0, share))));
  return STRENGTH_ORDER.slice(0, cut).flatMap((key) => expandHandKey(key));
}

const sum = (xs) => xs.reduce((s, x) => s + x, 0);

/**
 * The tournament as the coach is handed it.
 *
 * @typedef {object} Tournament
 * @property {number[]} stacks     chips behind, by seat, for every seat still in
 * @property {number[]} committed  chips each has put in this hand (the blinds)
 * @property {number} hero         the reader's seat
 * @property {number|null} villain the seat that raised, when there is a raise to answer
 * @property {number[]} payouts    prize money by place
 * @property {object[]} profiles   how each seat plays (null for the reader)
 * @property {number[]} behind     seats still to act after the reader, in order, when first in
 */

/** The prize equity of the reader, for stacks given as chips at the start of the hand. */
function value(stacks, payouts, hero) {
  return icmEquity(stacks, payouts)[hero];
}

/**
 * Stacks after the hand ends one of the ways it can. `totals` are chips each
 * seat had at the start of the hand; `committed` is what each had posted.
 * Seats that are not in the hand lose what they posted to whoever takes the
 * pot (the dead money).
 */
function settle({ totals, committed, hero, villain, heroWins, eff }) {
  const stacks = totals.map((total, i) => (i === hero || i === villain ? total : total - committed[i]));
  const dead = sum(totals.map((_, i) => (i === hero || i === villain ? 0 : committed[i])));
  if (villain === null) {
    // Everybody folded to the reader: the blinds are theirs.
    stacks[hero] += dead;
    return stacks;
  }
  if (heroWins) {
    stacks[hero] = totals[hero] + eff + dead;
    stacks[villain] = totals[villain] - eff;
  } else {
    stacks[hero] = totals[hero] - eff;
    stacks[villain] = totals[villain] + eff + dead;
  }
  return stacks;
}

/** The reader's prize equity for each ending of a call, given their equity. */
function callValue({ totals, committed, hero, villain, payouts, equity }) {
  const eff = Math.min(totals[hero], totals[villain]);
  const win = value(settle({ totals, committed, hero, villain, heroWins: true, eff }), payouts, hero);
  const lose = value(settle({ totals, committed, hero, villain, heroWins: false, eff }), payouts, hero);
  return { win, lose, ev: equity * win + (1 - equity) * lose };
}

/** What folding is worth: the posted chips go to whoever takes the pot. */
function foldValue({ totals, committed, hero, payouts, takers }) {
  const stacks = totals.map((total, i) => (i === hero ? total - committed[hero] : total));
  // The posted chips are not the reader's any more. Give them to whoever they are posted to,
  // which for a fold means they stay with the others; ICM is proportional, so that is enough.
  return value(stacks, payouts, hero);
}

/**
 * The share a seat would shove with, as the bots decide it.
 */
function shoveShare(profile, stackBb) {
  return Math.min(1, pushShare(stackBb) * (profile ? pushMult(profile) : 1));
}

/**
 * Grade a decision.
 *
 * @param {object} spot  a coach snapshot with `tournament`, `hole`, `action`, `bigBlind`
 * @returns {object|null} a verdict like the coach's others, or null if this is not a spot it can grade
 */
export function judgeIcm(spot) {
  const t = spot.tournament;
  if (!t || !spot.hole || spot.hole.length !== 2) return null;
  const { hero, villain, payouts, profiles = [] } = t;
  const bb = spot.bigBlind;
  const totals = t.stacks.map((s, i) => s + t.committed[i]);
  const committed = t.committed;
  const pool = sum(payouts);
  const hand = handKey(spot.hole);
  const chosen = spot.action === 'fold' || spot.action === 'check' ? 'fold' : 'go';
  const rng = makeRng(0x1c3 + spot.hole[0] * 53 + spot.hole[1] * 7 + totals[hero]);
  const trials = 1200;

  let goValue;
  let goLabel;
  const foldV = foldValue({ totals, committed, hero, payouts });

  if (villain !== null && villain !== undefined) {
    // Facing a raise: call (all of it, at these stacks) or fold.
    const vBb = totals[villain] / bb;
    const heavy = (committed[villain] || 0) >= 0.6 * totals[villain];
    const share = heavy ? Math.max(0.1, Math.min(0.7, shoveShare(profiles[villain], vBb))) : 0.2;
    const eq = equityVsRange(spot.hole, rangeOf(share), [], { trials, rng }).equity;
    goValue = callValue({ totals, committed, hero, villain, payouts, equity: eq }).ev;
    goLabel = { kind: 'call', eq, share };
  } else {
    // First in: shove, or fold. Everybody behind may call, in turn.
    const behind = t.behind || [];
    const callers = behind.map((j) => {
      const eff = Math.min(totals[hero], totals[j]);
      const price = (eff - committed[j]) / (sum(committed) + eff + (eff - committed[j]) || 1);
      const p = Math.min(1, callShare(eff / bb, Math.max(0, Math.min(1, price))) * (profiles[j] ? callMult(profiles[j]) : 1));
      return { j, p };
    });
    let pAllFold = 1;
    let ev = 0;
    let eqFirst = null;
    for (const { j, p } of callers) {
      const reach = pAllFold * p;
      if (reach > 1e-9) {
        const eq = equityVsRange(spot.hole, rangeOf(p), [], { trials, rng }).equity;
        if (eqFirst === null) eqFirst = eq;
        ev += reach * callValue({ totals, committed, hero, villain: j, payouts, equity: eq }).ev;
      }
      pAllFold *= 1 - p;
    }
    ev += pAllFold * value(settle({ totals, committed, hero, villain: null, heroWins: true, eff: 0 }), payouts, hero);
    goValue = ev;
    goLabel = { kind: 'push', pFold: pAllFold, eq: eqFirst };
  }

  const best = goValue > foldV ? 'go' : 'fold';
  const gap = Math.abs(goValue - foldV);
  const chipsPerDollar = (sum(totals) || 1) / (pool || 1);
  const level = chosen === best || gap < CLOSE * pool ? 'good' : gap < SMALL * pool ? 'ok' : 'bad';
  const costChips = level === 'good' ? 0 : gap * chipsPerDollar;
  const verb = goLabel.kind === 'call' ? 'Call' : 'Shove';
  const params = {
    hand, go: `$${goValue.toFixed(2)}`, fold: `$${foldV.toFixed(2)}`, verb: verb.toLowerCase(),
  };
  const priced = { cost: costChips, costKnown: costChips > 0 };

  if (level === 'good') {
    return {
      kind: 'icm', level, head: gap < CLOSE * pool ? 'A close call, either way is fine' : 'Right, with the prizes counted',
      body: best === 'go'
        ? 'With these stacks and these prizes, {verb} with {hand} is worth about {go} and folding is worth {fold}.'
        : 'With these stacks and these prizes, folding {hand} is worth about {fold}; the {verb} is worth {go}.',
      params, better: null, ...priced,
    };
  }
  return {
    kind: 'icm', level, id: 'icm-mistake',
    head: best === 'go' ? 'Too tight for the prizes' : 'The prize list says fold',
    body: best === 'go'
      ? 'The {verb} with {hand} is worth about {go} and folding only {fold}: at this stack the blinds are eating you, and the chips are worth more in the pot than in your hand.'
      : 'The {verb} with {hand} is worth about {go} but folding is worth {fold}: with a prize list, busting costs you more than the chips you would win are worth.',
    params, better: best === 'go' ? verb : 'Fold', ...priced,
  };
}
