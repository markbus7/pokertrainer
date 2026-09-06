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
import { t } from '../i18n/index.js';
import { readShape, explainShape, SHAPES, shapeByKey } from '../core/handShape.js';
import { seatRing, seatName, seatChoices } from '../core/seatMap.js';
import { POSITION_INFO } from '../data/ranges.js';

export const LAB_TYPES = ['shape', 'seat', 'ladder', 'price', 'size', 'decide'];

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
 * 0. SHAPE — look at the cards and say what it is called
 * ------------------------------------------------------------------ */

/**
 * The recognition half, which the Lab had none of.
 *
 * Every other spot here assumes you can already look at a board and know
 * whether you are on a gutshot or an open-ender. That assumption is where a
 * beginner falls off: the words appear in the lessons and the answers, and
 * nothing ever asks you to produce one from cards.
 */
function shapeSpot(rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const board = deck.slice(2, 5);
    const read = readShape(hero, board);
    if (read.shape.key === 'nothing' || read.shape.key === 'backdoor-flush') continue;

    const others = SHAPES
      .filter((sh) => sh.key !== read.shape.key && sh.key !== 'nothing' && sh.key !== 'backdoor-flush')
      .map((sh) => sh.key);
    const keys = shuffle(rng, [read.shape.key, ...shuffle(rng, others).slice(0, 3)]);

    return {
      type: 'shape',
      concept: 'outs',
      table: { board, hole: hero },
      prompt: t('Look at what you are holding, not at what you might make.'),
      question: t('What is this called?'),
      inputKind: 'action',
      actions: keys.map((key) => ({ key, label: t(shapeByKey(key).label) })),
      answer: read.shape.key,
      solve: (given) => ({
        correct: given === read.shape.key,
        exact: t(read.shape.label),
        lines: [
          explainShape(hero, board),
          read.shape.outs
            ? t('That is {outs} outs, which is about {pct}% by the river.',
              { outs: read.shape.outs, pct: (exactOutsEquity(read.shape.outs, 'flop') * 100).toFixed(0) })
            : t('Nothing to count here — the hand is already made.'),
        ],
      }),
    };
  }
  return priceSpot(rng);
}

/* ------------------------------------------------------------------ *
 * 0a. SEAT — find the button and say what your chair is called
 * ------------------------------------------------------------------ */

/**
 * The same recognition gap as the draws, one street earlier. Every preflop
 * answer in this app is phrased in seat names, and nothing ever asked the
 * reader to work one out from a table with a button on it.
 */
function seatSpot(rng) {
  const ring = seatRing(rng);
  if (!ring) return priceSpot(rng);
  const answer = ring.heroPosition;
  const others = seatChoices().filter((p) => p !== answer);
  const keys = shuffle(rng, [answer, ...shuffle(rng, others).slice(0, 3)]);
  const gap = (ring.heroSeat - ring.button + ring.seatCount) % ring.seatCount;

  return {
    type: 'seat',
    concept: 'position',
    table: { ring, hideSeatNames: true },
    prompt: t('The dealer button is the D. Seats act clockwise from it.'),
    question: t('Which seat are you in?'),
    inputKind: 'action',
    actions: keys.map((key) => ({ key, label: seatName(key) })),
    answer,
    solve: (given) => ({
      correct: given === answer,
      exact: seatName(answer),
      lines: [
        gap === 0
          ? t('The button is in front of you — you have it.')
          : gap === 1
            ? t('The button is one seat to your right, so you are the seat straight after it.')
            : t('The button is {gap} seats to your right.', { gap }),
        t(POSITION_INFO[answer].blurb),
      ],
    }),
  };
}

/* ------------------------------------------------------------------ *
 * 0b. LADDER — the five prices worth knowing cold
 * ------------------------------------------------------------------ */

/**
 * A quarter is 17%, a third 20%, half 25%, three quarters 30%, the pot 33%.
 * The lesson derives them and the decision card uses them; nothing ever asked
 * for one directly, so they stayed a calculation to redo rather than five
 * facts to recall.
 */
const LADDER = [
  { fraction: 1 / 4, name: 'a quarter of the pot' },
  { fraction: 1 / 3, name: 'a third of the pot' },
  { fraction: 1 / 2, name: 'half the pot' },
  { fraction: 3 / 4, name: 'three quarters of the pot' },
  { fraction: 1, name: 'the whole pot' },
];

function ladderSpot(rng) {
  const pot = CLEAN_POTS[randInt(rng, CLEAN_POTS.length)];
  const rung = LADDER[randInt(rng, LADDER.length)];
  const bet = Math.round(pot * rung.fraction);
  const need = requiredEquity(bet, pot + bet);
  const deck = shuffle(rng, makeDeck());

  return {
    type: 'ladder',
    concept: 'pot-odds',
    table: { board: deck.slice(0, 3), hole: deck.slice(3, 5), pot, bet, potNow: pot + bet },
    prompt: t('They bet {name} — {bet} into {pot}.', { name: t(rung.name), bet, pot }),
    question: t('What share of the time do you have to win for the call to break even?'),
    inputKind: 'percent',
    answer: need * 100,
    tolerance: 2,
    solve: (given) => ({
      correct: Math.abs(given - need * 100) <= 2,
      exact: `${(need * 100).toFixed(0)}%`,
      lines: [
        t('Your {bet} goes into a final pot of {final}, so you need {pct}%.',
          { bet, final: pot + bet + bet, pct: (need * 100).toFixed(0) }),
        t('The five worth knowing cold: a quarter asks 17%, a third 20%, half 25%, three quarters 30%, the whole '
          + 'pot 33%.'),
      ],
      visual: { pot: pot + bet, call: bet },
    }),
  };
}

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
    prompt: t('The pot was {pot}. Your opponent bets {bet}, so the pot is now {potNow}. It costs you {bet} to call.',
      { pot, bet, potNow }),
    question: t('What equity do you need to call?'),
    inputKind: 'percent',
    answer: need * 100,
    tolerance: 1.5,
    solve: (given) => ({
      correct: Math.abs(given - need * 100) <= 1.5,
      exact: `${(need * 100).toFixed(1)}%`,
      lines: [
        t('The pot is {potNow} and your call is {bet}, so the final pot is {final}.',
          { potNow, bet, final: potNow + bet }),
        t('Your {bet} is {bet} ÷ {final} = **{pct}%** of it.',
          { bet, final: potNow + bet, pct: (need * 100).toFixed(1) }),
        t('That is {ratio}-to-1 — a {size} bet always asks for about {pct}%.',
          { ratio: potOddsRatio(bet, potNow).toFixed(1), size: describeFraction(fraction), pct: Math.round(need * 100) }),
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
    prompt: t('There is {pot} in the pot and your opponent has checked to you.', { pot }),
    question: t('Bet an amount that makes them need about {pct}% equity to call.', { pct: target.needPct }),
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
              t('**{answer}** — {size}. After your bet the pot is {after}, they call {answer}, so the final pot is {final}.',
                { answer, size: t(target.label), after: pot + answer, final: pot + answer * 2 }),
              t('Their {answer} is {pct}% of that, which is exactly the price you were asked to offer.',
                { answer, pct: target.needPct }),
            ]
          : [
              t('You bet **{given}**, which actually offers them {offered}% — you were aiming for {pct}%.',
                { given, offered: (offered * 100).toFixed(1), pct: target.needPct }),
              t('The number was **{answer}**, which is {size}.', { answer, size: t(target.label) }),
              t('Working backwards: to make them need a fraction *t*, bet t × pot ÷ (1 − 2t). '
                + 'For {pct}% of a {pot} pot that is {answer}.', { pct: target.needPct, pot, answer }),
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
    const read = readShape(hero, board);
    const namedShape = read.shape.key === 'nothing' || read.shape.key === 'made'
      ? null
      : t(read.shape.label);
    return {
      type: 'decide',
      // Tagged to outs, not pot odds: the price here is the easy half, and a
      // miss almost always means the outs were counted wrong. Scheduling a
      // pot-odds review would send you back to revise the wrong thing.
      concept: 'outs',
      table: { board, hole: hero, villain, revealVillain: true, pot, bet, potNow },
      prompt: t('Their hand is face up, so nothing is hidden — count the cards that put you in front, then '
        + 'check them against the price.'),
      question: t('The pot is now {potNow} and it costs {bet} to call. Call or fold?', { potNow, bet }),
      inputKind: 'action',
      actions: [
        { key: 'call', label: t('Call {bet}', { bet }) },
        { key: 'fold', label: t('Fold') },
      ],
      answer: shouldCall ? 'call' : 'fold',
      outs: count,
      // Surfaced so a wrong answer can be saved as a replayable hand, graded
      // by the same numbers the feedback quotes.
      equity,
      need,
      solve: (given) => ({
        correct: given === (shouldCall ? 'call' : 'fold'),
        exact: shouldCall ? t('Call') : t('Fold'),
        lines: [
          // Naming it first is deliberate: the recognition spots teach the
          // word and this is where the word has to earn its keep. A reader
          // who counts right but never learns "gutshot" has to redo the
          // count every time instead of recalling a number.
          namedShape ? t('What you are holding is called {shape}.', { shape: namedShape }) : null,
          describeOuts(hero, villain, board).sentence,
          t('That is about **{pct}%** by the river.', { pct: (equity * 100).toFixed(0) }),
          t('The price demands {bet} ÷ {final} = **{pct}%**.',
            { bet, final: potNow + bet, pct: (need * 100).toFixed(1) }),
          shouldCall
            ? t('{have} beats {need}, so calling wins about {chips} chips each time you do it.',
                { have: (equity * 100).toFixed(0), need: (need * 100).toFixed(0), chips: callEV(equity, bet, potNow).toFixed(0) })
            : t('{have} falls short of {need}, so calling loses about {chips} chips each time.',
                { have: (equity * 100).toFixed(0), need: (need * 100).toFixed(0), chips: Math.abs(callEV(equity, bet, potNow)).toFixed(0) }),
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

const GENERATORS = {
  shape: shapeSpot, seat: seatSpot, ladder: ladderSpot, price: priceSpot, size: sizeSpot, decide: decideSpot,
};

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
  if (fraction <= 0.34) return t('third-pot');
  if (fraction <= 0.51) return t('half-pot');
  if (fraction <= 0.76) return t('three-quarter-pot');
  if (fraction <= 1.01) return t('pot-sized');
  return t('overbet');
}

export { cardsToString, exactOutsEquity };
