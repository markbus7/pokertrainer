/**
 * The drills every player needs before anything else works:
 * what beats what, how many cards save you, and what the pot is offering.
 */

import { makeDeck, cardsToString } from '../core/cards.js';
import { evaluate, describeScore, shortCategoryName } from '../core/evaluator.js';
import { countOuts, describeOuts, exactOutsEquity, handEquity } from '../core/equity.js';
import { requiredEquity, potOddsRatio, callEV } from '../core/odds.js';
import { shuffle, randInt } from '../core/rng.js';
import { buildChoices, numericDistractors, percentDistractors, attempt, pct } from './helpers.js';

/** "Which hand wins?" — the first thing a beginner must never get wrong. */
export function handRankingDrill(rng, difficulty = 1) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const board = deck.slice(0, 5);
    const a = deck.slice(5, 7);
    const b = deck.slice(7, 9);
    const scoreA = evaluate([...a, ...board]);
    const scoreB = evaluate([...b, ...board]);
    // At low difficulty, make the gap obvious; later, make it a kicker war.
    const gapCategories = (scoreA >> 20) !== (scoreB >> 20);
    if (difficulty <= 2 && !gapCategories) return null;
    if (difficulty >= 4 && gapCategories && rng() < 0.7) return null;
    return { board, a, b, scoreA, scoreB };
  });
  if (!spot) return null;

  const { board, a, b, scoreA, scoreB } = spot;
  const winner = scoreA > scoreB ? 'Player A' : scoreB > scoreA ? 'Player B' : 'Split pot';
  const { options, answer } = buildChoices(rng, winner, ['Player A', 'Player B', 'Split pot']);

  return {
    module: 'hand-rankings',
    difficulty,
    scenario: { board, hands: [{ label: 'Player A', cards: a }, { label: 'Player B', cards: b }] },
    question: 'Both players are all-in. Who takes it down?',
    options,
    answer,
    explanation: `Player A has ${describeScore(scoreA)}. Player B has ${describeScore(scoreB)}. ${
      scoreA === scoreB
        ? 'Identical hands — the pot is chopped.'
        : `${winner} wins${(scoreA >> 20) === (scoreB >> 20) ? ' on the kicker' : ''}.`
    }`,
    xp: 8 + difficulty * 2,
  };
}

/** "What have you actually got?" — reading your own hand under time pressure. */
export function nameThatHandDrill(rng, difficulty = 1) {
  const deck = shuffle(rng, makeDeck());
  const hole = deck.slice(0, 2);
  const board = deck.slice(2, 7);
  const score = evaluate([...hole, ...board]);
  const correct = shortCategoryName(score);
  const all = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  const distractors = shuffle(rng, all.filter((n) => n !== correct)).slice(0, 3);

  const { options, answer } = buildChoices(rng, correct, distractors);
  return {
    module: 'hand-rankings',
    difficulty,
    scenario: { board, hole },
    question: 'What is your best five-card hand?',
    options,
    answer,
    explanation: `${describeScore(score)} — using ${cardsToString(hole)} with ${cardsToString(board)}.`,
    xp: 6 + difficulty,
  };
}

/** Counting outs: the single most useful number at the table. */
export function outsDrill(rng, difficulty = 2) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const villain = deck.slice(2, 4);
    const board = deck.slice(4, 7);
    const { count, outs, behindNow } = countOuts(hero, villain, board);
    if (!behindNow) return null;              // we must be drawing, not ahead
    if (count < 4 || count > 15) return null; // a countable draw
    return { hero, villain, board, count, outs };
  });
  if (!spot) return null;

  const { hero, villain, board, count } = spot;
  const distractors = numericDistractors(rng, count, { spread: 5, count: 3, min: 1, max: 21 });
  const { options, answer } = buildChoices(rng, String(count), distractors.map(String));
  const equity = exactOutsEquity(count, 'flop');

  return {
    module: 'outs',
    difficulty,
    scenario: { board, hole: hero, villain, revealVillain: true },
    question: 'You are behind. How many cards on the turn put you in front?',
    options,
    answer,
    // Naming the cards is the whole lesson: a bare count asks you to take the
    // number on trust, which teaches nothing you can repeat at a table.
    explanation: `${describeOuts(hero, villain, board).sentence} With two cards to come that is about ${
      pct(equity)} — the rule of 4 gives you ${count * 4}%, which is close enough to act on.`,
    xp: 10 + difficulty * 3,
  };
}

/** Turning outs into equity with the rule of 2 and 4. */
export function ruleOfFourDrill(rng, difficulty = 2) {
  const outs = 4 + randInt(rng, 12);
  const street = rng() < 0.5 ? 'flop' : 'turn';
  const equity = exactOutsEquity(outs, street);
  // The drill teaches the shortcut, so the shortcut is the graded answer.
  const shortcut = outs * (street === 'flop' ? 4 : 2);
  const { options, answer } = buildChoices(
    rng, `${shortcut}%`, percentDistractors(rng, shortcut, 3, 10, 6).map((p) => `${p}%`),
  );

  return {
    module: 'outs',
    difficulty,
    scenario: null,
    question: `You have ${outs} outs on the ${street}. Use the rule of ${street === 'flop' ? 4 : 2} — roughly what is your equity?`,
    options,
    answer,
    explanation: street === 'flop'
      ? `Two cards to come, so multiply by 4: ${outs} × 4 = ${shortcut}%. The exact figure is ${pct(equity, 1)} — the shortcut drifts a little high with many outs, which is close enough at the table.`
      : `One card to come, so multiply by 2: ${outs} × 2 = ${shortcut}%. The exact figure is ${pct(equity, 1)}, since ${outs} of the 46 unseen cards win.`,
    xp: 8 + difficulty * 2,
  };
}

/** Pot odds: the price you are being offered. */
export function potOddsDrill(rng, difficulty = 2) {
  const pot = (2 + randInt(rng, 12)) * 5;
  const betFraction = [0.33, 0.5, 0.66, 0.75, 1][randInt(rng, 5)];
  const bet = Math.max(5, Math.round(pot * betFraction / 5) * 5);
  const potFacing = pot + bet;
  const need = requiredEquity(bet, potFacing);
  const truePct = Math.round(need * 100);

  const { options, answer } = buildChoices(
    rng, `${truePct}%`, percentDistractors(rng, truePct, 3, 10).map((p) => `${p}%`),
  );

  return {
    module: 'pot-odds',
    difficulty,
    scenario: { pot, toCall: bet, potFacing },
    question: `There is ${pot} in the pot. Your opponent bets ${bet}. What equity do you need to call profitably?`,
    options,
    answer,
    explanation: `You call ${bet} to win ${potFacing}, so you need ${bet} ÷ ${potFacing + bet} = ${pct(need, 1)}. That is ${potOddsRatio(bet, potFacing).toFixed(1)} to 1.`,
    xp: 10 + difficulty * 2,
  };
}

/**
 * The comparison on its own: equity is handed to you, so the only skill under
 * test is "is what I have at least what I need". Pot Odds unlocks a level
 * before Outs & Equity, so its drills must not require counting outs.
 */
export function equityGivenDrill(rng, difficulty = 2) {
  const spot = attempt(() => {
    const pot = (4 + randInt(rng, 10)) * 5;
    const bet = Math.max(5, Math.round(pot * [0.33, 0.5, 0.75, 1][randInt(rng, 4)] / 5) * 5);
    const need = requiredEquity(bet, pot + bet);
    const equity = (10 + randInt(rng, 45)) / 100;
    // Skip anything close enough that the right answer is a judgement call.
    if (Math.abs(equity - need) < 0.05) return null;
    return { pot, bet, need, equity };
  });
  if (!spot) return null;

  const { pot, bet, need, equity } = spot;
  const shouldCall = equity > need;
  const { options, answer } = buildChoices(rng, shouldCall ? 'Call' : 'Fold', ['Call', 'Fold']);
  const ev = callEV(equity, bet, pot + bet);

  return {
    module: 'pot-odds',
    difficulty,
    scenario: { pot, toCall: bet, potFacing: pot + bet },
    question: `You will win this hand ${pct(equity)} of the time. There is ${
      pot} in the pot and they bet ${bet}. Call or fold?`,
    options,
    answer,
    explanation: `You call ${bet} to win ${pot + bet + bet}, so you need ${bet} ÷ ${
      pot + bet + bet} = ${pct(need, 1)}. You have ${pct(equity)}, which is ${
      shouldCall ? 'more than' : 'less than'} the price asks. ${
      shouldCall
        ? `Calling wins about ${ev.toFixed(1)} chips every time.`
        : `Calling loses about ${Math.abs(ev).toFixed(1)} chips every time.`
    }`,
    xp: 12 + difficulty * 2,
  };
}

/**
 * Put the two together: you have a draw and a price. Call or fold?
 * Lives in the outs module, not pot odds, because it cannot be answered
 * without counting outs first \u2014 and pot odds unlocks a level earlier.
 */
export function callOrFoldDrill(rng, difficulty = 3) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const villain = deck.slice(2, 4);
    const board = deck.slice(4, 7);
    const { count, behindNow } = countOuts(hero, villain, board);
    if (!behindNow || count < 3 || count > 15) return null;
    const equity = handEquity([hero, villain], board, { rng }).equity[0];
    const pot = (4 + randInt(rng, 10)) * 5;
    const bet = Math.round(pot * [0.33, 0.5, 0.75, 1][randInt(rng, 4)] / 5) * 5;
    const need = requiredEquity(bet, pot + bet);
    // Only use spots where the answer is not a coin flip.
    if (Math.abs(equity - need) < 0.055) return null;
    return { hero, villain, board, equity, pot, bet, need, count };
  });
  if (!spot) return null;

  const { hero, villain, board, equity, pot, bet, need, count } = spot;
  const shouldCall = equity > need;
  const { options, answer } = buildChoices(rng, shouldCall ? 'Call' : 'Fold', ['Call', 'Fold']);
  const ev = callEV(equity, bet, pot + bet);

  // The outs figure and the engine's equity rarely match exactly, and the gap
  // is itself worth teaching: backdoor draws push it up, cards that can be
  // beaten again by the river pull it down. Saying which way, and why, stops
  // the two numbers looking like a contradiction.
  const fromOuts = exactOutsEquity(count, 'flop');
  const drift = equity - fromOuts;
  const reconcile = Math.abs(drift) < 0.015
    ? ''
    : drift > 0
      ? ` It comes out a little above that because some runner-runner cards win for you too.`
      : ` It comes out a little below that because a few of those cards can still be beaten by the river.`;

  return {
    module: 'outs',
    difficulty,
    scenario: { board, hole: hero, villain, revealVillain: true, pot, toCall: bet },
    question: `The pot is ${pot} and you face a bet of ${bet}. Your opponent's hand is face up. Call or fold?`,
    options,
    answer,
    explanation: `${describeOuts(hero, villain, board).sentence} With two cards to come, ${count} outs is roughly ${
      count * 4}% by the rule of 4; the exact figure is ${pct(equity, 1)}.${reconcile
    } The price demands ${bet} ÷ ${pot + bet + bet} = ${pct(need, 1)}, so you ${
      shouldCall ? 'have more than enough' : 'fall short'}. ${
      shouldCall
        ? `Calling wins about ${ev.toFixed(1)} chips every time you make it.`
        : `Calling loses about ${Math.abs(ev).toFixed(1)} chips every time — a fold is a profit.`
    }`,
    xp: 14 + difficulty * 3,
  };
}
