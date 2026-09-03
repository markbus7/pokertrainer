/**
 * The Lab: spots you solve at a table rather than questions you pick from.
 *
 * The difference matters. Choosing the right answer from four options is
 * recognition, and recognition feels like knowing while being much weaker
 * than recall. Here you produce the number yourself — type the equity, or
 * drag a slider until the bet offers the price you were asked for — which is
 * the retrieval practice that actually builds durable memory.
 *
 * The sizing drill runs the calculation backwards on purpose. Being able to
 * go from a price to a bet, not just from a bet to a price, is the difference
 * between having memorised a table and understanding what it describes.
 */

import { makeDeck, cardsToString } from '../core/cards.js';
import { countOuts, describeOuts, handEquity, exactOutsEquity } from '../core/equity.js';
import { requiredEquity, potOddsRatio, callEV } from '../core/odds.js';
import { shuffle, randInt } from '../core/rng.js';
import { CLEAR_MARGIN } from '../core/judge.js';

export const LAB_TYPES = ['price', 'size', 'decide'];

/** Pots divisible by 12, so a third and three quarters are both whole chips. */
const CLEAN_POTS = [60, 120, 180, 240];

/**
 * Bet fractions paired with the equity they demand, as whole numbers.
 * Derived rather than hard-coded: B / (P + 2B).
 */
const SIZING_TARGETS = [
  { fraction: 1 / 3, label: 'a third of the pot', needPct: 20 },
  { fraction: 1 / 2, label: 'half the pot', needPct: 25 },
  { fraction: 3 / 4, label: 'three quarters of the pot', needPct: 30 },
  { fraction: 1, label: 'the whole pot', needPct: 33 },
  { fraction: 2, label: 'twice the pot', needPct: 40 },
];

/* ------------------------------------------------------------------ *
 * 1. PRICE — face a bet, type the equity you need
 * ------------------------------------------------------------------ */

function priceSpot(rng) {
  const pot = CLEAN_POTS[randInt(rng, CLEAN_POTS.length)];
  const { fraction } = SIZING_TARGETS[randInt(rng, SIZING_TARGETS.length)];
  const bet = Math.round(pot * fraction);
  const potNow = pot + bet;
  const need = requiredEquity(bet, potNow);
  const deck = shuffle(rng, makeDeck());

  return {
    type: 'price',
    concept: 'pot-odds',
    table: { board: deck.slice(0, 3), hole: deck.slice(3, 5), pot, bet, potNow },
    prompt: `The pot was ${pot}. Your opponent bets ${bet}, so the pot is now ${potNow}. It costs you ${bet} to call.`,
    question: 'What equity do you need to call?',
    inputKind: 'percent',
    answer: need * 100,
    tolerance: 1.5,
    solve: (given) => ({
      correct: Math.abs(given - need * 100) <= 1.5,
      exact: `${(need * 100).toFixed(1)}%`,
      lines: [
        `The pot is ${potNow} and your call is ${bet}, so the final pot is ${potNow + bet}.`,
        `Your ${bet} is ${bet} ÷ ${potNow + bet} = **${(need * 100).toFixed(1)}%** of it.`,
        `That is ${potOddsRatio(bet, potNow).toFixed(1)}-to-1 — a ${describeFraction(fraction)} bet always asks for about ${Math.round(need * 100)}%.`,
      ],
      visual: { pot: potNow, call: bet },
    }),
  };
}

/* ------------------------------------------------------------------ *
 * 2. SIZE — bet the amount that offers a given price (the inverse)
 * ------------------------------------------------------------------ */

function sizeSpot(rng) {
  const pot = CLEAN_POTS[randInt(rng, CLEAN_POTS.length)];
  const target = SIZING_TARGETS[randInt(rng, SIZING_TARGETS.length)];
  const answer = Math.round(pot * target.fraction);
  const deck = shuffle(rng, makeDeck());
  const tolerance = Math.max(3, Math.round(pot * 0.04));

  return {
    type: 'size',
    concept: 'pot-odds',
    table: { board: deck.slice(0, 3), hole: deck.slice(3, 5), pot },
    prompt: `There is ${pot} in the pot and your opponent has checked to you.`,
    question: `Bet an amount that makes them need about ${target.needPct}% equity to call.`,
    inputKind: 'chips',
    answer,
    tolerance,
    slider: { min: 0, max: pot * 2.5, step: 1, start: Math.round(pot * 0.6) },
    solve: (given) => {
      const offered = given > 0 ? requiredEquity(given, pot + given) : 0;
      const correct = Math.abs(given - answer) <= tolerance;
      return {
        correct,
        exact: `${answer}`,
        lines: correct
          ? [
              `**${answer}** — ${target.label}. After your bet the pot is ${pot + answer}, they call ${answer}, so the final pot is ${pot + answer * 2}.`,
              `Their ${answer} is ${(target.needPct)}% of that, which is exactly the price you were asked to offer.`,
            ]
          : [
              `You bet **${given}**, which actually offers them ${(offered * 100).toFixed(1)}% — you were aiming for ${target.needPct}%.`,
              `The number was **${answer}**, which is ${target.label}.`,
              `Working backwards: to make them need a fraction *t*, bet `
                + `t × pot ÷ (1 − 2t). For ${target.needPct}% of a ${pot} pot that is ${answer}.`,
            ],
        visual: { pot: pot + answer, call: answer },
      };
    },
  };
}

/* ------------------------------------------------------------------ *
 * 3. DECIDE — real cards, real equity, call or fold for real
 * ------------------------------------------------------------------ */

function decideSpot(rng) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const villain = deck.slice(2, 4);
    const board = deck.slice(4, 7);
    const { count, behindNow } = countOuts(hero, villain, board);
    if (!behindNow || count < 4 || count > 15) continue;

    const equity = handEquity([hero, villain], board, { rng }).equity[0];
    const pot = CLEAN_POTS[randInt(rng, CLEAN_POTS.length)];
    const { fraction } = SIZING_TARGETS[randInt(rng, SIZING_TARGETS.length)];
    const bet = Math.round(pot * fraction);
    const potNow = pot + bet;
    const need = requiredEquity(bet, potNow);
    // Skip close spots: the point is the comparison, not a guess. The margin
    // is the judge's own, so that a spot you get wrong here is one the hand
    // review will also call wrong when it replays it.
    if (Math.abs(equity - need) < CLEAR_MARGIN) continue;

    const shouldCall = equity > need;
    return {
      type: 'decide',
      // Tagged to outs, not pot odds: the price here is the easy half, and a
      // miss almost always means the outs were counted wrong. Scheduling a
      // pot-odds review would send you back to revise the wrong thing.
      concept: 'outs',
      table: { board, hole: hero, villain, revealVillain: true, pot, bet, potNow },
      prompt: `Their hand is face up, so nothing is hidden — count the cards that put you in front, then check them against the price.`,
      question: `The pot is now ${potNow} and it costs ${bet} to call. Call or fold?`,
      inputKind: 'action',
      actions: [
        { key: 'call', label: `Call ${bet}` },
        { key: 'fold', label: 'Fold' },
      ],
      answer: shouldCall ? 'call' : 'fold',
      outs: count,
      // Surfaced so a wrong answer can be saved as a replayable hand, graded
      // by the same numbers the feedback quotes.
      equity,
      need,
      solve: (given) => ({
        correct: given === (shouldCall ? 'call' : 'fold'),
        exact: shouldCall ? 'Call' : 'Fold',
        lines: [
          describeOuts(hero, villain, board).sentence,
          `That is about **${(equity * 100).toFixed(0)}%** by the river.`,
          `The price demands ${bet} ÷ ${potNow + bet} = **${(need * 100).toFixed(1)}%**.`,
          shouldCall
            ? `${(equity * 100).toFixed(0)} beats ${(need * 100).toFixed(0)}, so calling wins about ${callEV(equity, bet, potNow).toFixed(0)} chips each time you do it.`
            : `${(equity * 100).toFixed(0)} falls short of ${(need * 100).toFixed(0)}, so calling loses about ${Math.abs(callEV(equity, bet, potNow)).toFixed(0)} chips each time.`,
        ],
        visual: { pot: potNow, call: bet, have: equity, need },
      }),
    };
  }
  return priceSpot(rng); // fall back rather than hang
}

/* ------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------ */

const GENERATORS = { price: priceSpot, size: sizeSpot, decide: decideSpot };

export function generateSpot(type, rng) {
  const gen = GENERATORS[type];
  if (!gen) throw new Error(`Unknown lab spot type: ${type}`);
  return gen(rng);
}

/**
 * A mixed run. Interleaving beats blocked practice: shuffling the kinds of
 * problem forces you to work out *which* calculation applies, which is the
 * part that transfers to a real table.
 */
export function generateSession(rng, length = 9) {
  const bag = [];
  const spots = [];
  for (let i = 0; i < length; i++) {
    if (!bag.length) bag.push(...shuffle(rng, [...LAB_TYPES]));
    spots.push(generateSpot(bag.pop(), rng));
  }
  return spots;
}

function describeFraction(fraction) {
  if (fraction <= 0.34) return 'third-pot';
  if (fraction <= 0.51) return 'half-pot';
  if (fraction <= 0.76) return 'three-quarter-pot';
  if (fraction <= 1.01) return 'pot-sized';
  return 'overbet';
}

export { cardsToString, exactOutsEquity };
