/**
 * Hands-on exercises for the guided lessons.
 *
 * The lessons were 45 steps of prose, 10 static diagrams between them, and a
 * multiple-choice question at the end of every one — not a single card dealt
 * anywhere. You can recognise the right answer among four without being able
 * to do the thing, which is exactly the gap this closes: every exercise here
 * deals real cards and grades what you produce against the same engine the
 * table runs on.
 *
 * Spots are generated fresh rather than fixed, so the answer cannot be
 * remembered from last time — the point is the skill, not the spot.
 */

import { makeDeck, removeCards, cardsToString } from '../core/cards.js';
import { evaluate, describeScore } from '../core/evaluator.js';
import { countOuts, describeOuts, handEquity, exactOutsEquity, handPhrase } from '../core/equity.js';
import { requiredEquity, callEV } from '../core/odds.js';
import { shuffle, randInt, makeRng } from '../core/rng.js';

const HOLDEM = { omaha: false, shortDeck: false };
const attempt = (fn, tries = 400) => {
  for (let i = 0; i < tries; i++) { const r = fn(); if (r) return r; }
  return null;
};

/* ------------------------------------------------------------------ *
 * 1. COUNT THE OUTS — tap the actual cards
 *
 * The one exercise that cannot be faked. You are not picking a number from
 * four options; you are pointing at every card in the deck that saves you,
 * and the grid shows exactly which ones you missed.
 * ------------------------------------------------------------------ */

export function countOutsPractice(rng = makeRng()) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const villain = deck.slice(2, 4);
    const board = deck.slice(4, 7);
    const { outs, count, behindNow } = countOuts(hero, villain, board);
    // Behind, with a countable number of outs: too few is trivial, too many
    // is a tapping chore rather than a counting exercise.
    if (!behindNow || count < 3 || count > 12) return null;
    return { hero, villain, board, outs, count };
  });
  if (!spot) return null;

  const { hero, villain, board, outs } = spot;
  const unseen = removeCards(makeDeck(), [...hero, ...villain, ...board]);
  const outSet = new Set(outs);

  return {
    kind: 'count-outs',
    prompt: 'Tap every card that would put you in front.',
    hero, villain, board, unseen,
    /** @param {number[]} picked */
    grade(picked) {
      const chosen = new Set(picked);
      const hits = outs.filter((c) => chosen.has(c));
      const missed = outs.filter((c) => !chosen.has(c));
      const wrong = [...chosen].filter((c) => !outSet.has(c));
      const perfect = missed.length === 0 && wrong.length === 0;
      const described = describeOuts(hero, villain, board);
      return {
        correct: perfect,
        hits, missed, wrong,
        outs,
        explanation: described.sentence,
        equity: exactOutsEquity(outs.length, 'flop'),
      };
    },
  };
}

/* ------------------------------------------------------------------ *
 * 2. WHO WINS — read two real hands against a real board
 * ------------------------------------------------------------------ */

export function pickWinnerPractice(rng = makeRng(), { subtle = false } = {}) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const board = deck.slice(0, 5);
    const a = deck.slice(5, 7);
    const b = deck.slice(7, 9);
    const scoreA = evaluate([...a, ...board]);
    const scoreB = evaluate([...b, ...board]);
    const sameCategory = (scoreA >> 20) === (scoreB >> 20);
    // "Subtle" spots come down to a kicker, which is where the money is lost.
    if (subtle && !sameCategory) return null;
    if (!subtle && sameCategory) return null;
    return { board, a, b, scoreA, scoreB };
  });
  if (!spot) return null;

  const { board, a, b, scoreA, scoreB } = spot;
  const winner = scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'split';
  return {
    kind: 'pick-winner',
    prompt: 'Both players are all-in. Tap the hand that wins.',
    board,
    hands: [{ key: 'a', label: 'Hand A', cards: a }, { key: 'b', label: 'Hand B', cards: b }],
    allowSplit: true,
    grade(picked) {
      return {
        correct: picked === winner,
        winner,
        explanation: winner === 'split'
          ? `Both make ${handPhrase(scoreA)} — the board plays and the pot is split.`
          : `Hand A has ${describeScore(scoreA)}. Hand B has ${describeScore(scoreB)}. `
            + `${winner === 'a' ? 'Hand A' : 'Hand B'} wins${
              (scoreA >> 20) === (scoreB >> 20) ? ' on the kicker' : ''}.`,
      };
    },
  };
}

/* ------------------------------------------------------------------ *
 * 3. NAME THE PRICE — a real bet, and you produce the number
 * ------------------------------------------------------------------ */

export function pricePractice(rng = makeRng()) {
  const pot = (4 + randInt(rng, 12)) * 5;
  const fraction = [0.25, 1 / 3, 0.5, 0.75, 1][randInt(rng, 5)];
  const bet = Math.max(5, Math.round((pot * fraction) / 5) * 5);
  const need = requiredEquity(bet, pot + bet);

  return {
    kind: 'price',
    prompt: 'Type the equity you need to call, as a percentage.',
    pot, bet, potNow: pot + bet,
    grade(value) {
      const given = Number(value);
      if (!Number.isFinite(given)) {
        return { correct: false, explanation: 'Type a number — the percentage you need.' };
      }
      const truth = need * 100;
      const fits = pot / bet;
      return {
        // Two points either way: the skill is arriving at the right figure,
        // not matching the engine's rounding.
        correct: Math.abs(given - truth) <= 2,
        exact: truth,
        explanation: `Their bet fits into the pot ${
          Number.isInteger(fits) ? fits : fits.toFixed(1)} times, plus 2 is ${
          (fits + 2).toFixed(Number.isInteger(fits) ? 0 : 1)} — so you need 1 in ${
          (fits + 2).toFixed(Number.isInteger(fits) ? 0 : 1)}, which is ${truth.toFixed(1)}%. `
          + `The long way: ${bet} ÷ ${pot + bet + bet} = ${truth.toFixed(1)}%.`,
      };
    },
  };
}

/* ------------------------------------------------------------------ *
 * 4. MAKE THE CALL — real cards, real price, real buttons
 * ------------------------------------------------------------------ */

export function decidePractice(rng = makeRng()) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const villain = deck.slice(2, 4);
    const board = deck.slice(4, 7);
    const { count, behindNow } = countOuts(hero, villain, board);
    if (!behindNow || count < 4 || count > 15) return null;

    const equity = handEquity([hero, villain], board, { rng }).equity[0];
    const pot = (4 + randInt(rng, 10)) * 10;
    const bet = Math.round((pot * [0.33, 0.5, 0.75, 1][randInt(rng, 4)]) / 5) * 5;
    const need = requiredEquity(bet, pot + bet);
    // Skip anything close enough that either answer is defensible.
    if (Math.abs(equity - need) < 0.07) return null;
    return { hero, villain, board, equity, pot, bet, need, count };
  });
  if (!spot) return null;

  const { hero, villain, board, equity, pot, bet, need } = spot;
  const shouldCall = equity > need;
  return {
    kind: 'decide',
    prompt: 'Their hand is face up. Count what saves you, price the bet, then decide.',
    hero, villain, board, pot, bet, potNow: pot + bet,
    actions: [{ key: 'call', label: `Call ${bet}` }, { key: 'fold', label: 'Fold' }],
    grade(picked) {
      const ev = callEV(equity, bet, pot + bet);
      return {
        correct: picked === (shouldCall ? 'call' : 'fold'),
        explanation: `${describeOuts(hero, villain, board).sentence} That is about ${
          (equity * 100).toFixed(0)}%. The price demands ${bet} ÷ ${pot + bet + bet} = ${
          (need * 100).toFixed(0)}%, so you ${shouldCall ? 'have enough' : 'fall short'} — ${
          shouldCall
            ? `calling wins about ${ev.toFixed(0)} chips every time.`
            : `calling loses about ${Math.abs(ev).toFixed(0)} chips every time.`}`,
      };
    },
  };
}

export const PRACTICE = {
  'count-outs': countOutsPractice,
  'pick-winner': (rng) => pickWinnerPractice(rng, { subtle: false }),
  'pick-winner-kicker': (rng) => pickWinnerPractice(rng, { subtle: true }),
  price: pricePractice,
  decide: decidePractice,
};

/** Build one exercise by name, retrying because generators may decline a deal. */
export function makePractice(kind, rng = makeRng()) {
  const build = PRACTICE[kind];
  if (!build) throw new Error(`Unknown practice kind: ${kind}`);
  for (let i = 0; i < 40; i++) {
    const spot = build(rng);
    if (spot) return spot;
  }
  throw new Error(`Could not build a ${kind} exercise`);
}

export { cardsToString, HOLDEM };
