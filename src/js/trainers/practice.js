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

import { makeDeck, removeCards, cardsToString, rankOf, RANK_NAMES } from '../core/cards.js';
import { evaluate, describeScore, categoryOf, kickersOf } from '../core/evaluator.js';
import { evaluateHand } from '../core/evaluator.js';
import { countOuts, describeOuts, handEquity, exactOutsEquity, handPhrase } from '../core/equity.js';
import { requiredEquity, callEV, minimumDefenceFrequency, breakEvenBluffFrequency, spr, icmEquity } from '../core/odds.js';
import { handKey } from '../core/cards.js';
import { preflopAdvice, POSITIONS, POSITION_INFO, CHARTS, rangePercent } from '../data/ranges.js';
import { STAKES, bankrollAdvice } from '../state/stats.js';
import { shuffle, randInt, makeRng } from '../core/rng.js';
import { t } from '../i18n/index.js';

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

/**
 * Why a card that is not an out was picked anyway.
 *
 * Three distinct misreadings, and they call for three different fixes:
 * chasing a suit you hold none of is a misunderstanding of what a flush
 * needs; picking a card that improves your hand but still loses is a
 * misunderstanding of what "out" means; picking one that changes nothing is
 * usually a misread of the board.
 */
export function classifyWrongPicks(hero, villain, board, wrong) {
  const heroSuits = new Set(hero.map((c) => c & 3));
  const boardSuitCount = board.reduce((acc, c) => {
    acc[c & 3] = (acc[c & 3] || 0) + 1;
    return acc;
  }, {});
  // Compare hand CATEGORY, not raw score. A card that only improves your
  // kicker scores higher while leaving you with the same nothing, and calling
  // that "improved" would file every missed heart under the wrong lesson.
  const before = categoryOf(evaluateHand(hero, board, HOLDEM));

  const tally = {};
  for (const card of wrong) {
    const suit = card & 3;
    const afterScore = evaluateHand(hero, [...board, card], HOLDEM);
    const after = categoryOf(afterScore);
    const villainAfter = evaluateHand(villain, [...board, card], HOLDEM);
    const improved = after > before;

    let tag;
    if (!improved && !heroSuits.has(suit) && (boardSuitCount[suit] || 0) >= 2) {
      // The exact mistake a reader described: tapping every card of a suit
      // sitting on the board, while holding none of it themselves.
      tag = 'chasing-a-flush-you-cannot-make';
    } else if (!improved) {
      tag = 'does-not-change-your-hand';
    } else if (afterScore <= villainAfter) {
      tag = 'improves-your-hand-but-still-loses';
    } else {
      tag = 'unclassified';
    }
    tally[tag] = (tally[tag] || 0) + 1;
  }
  return tally;
}

/**
 * When two hands read the same, the card that actually separates them.
 *
 * Both "king high" tells you nothing about why one of them is losing. The
 * five cards each player plays differ somewhere, and that first difference
 * is the whole answer.
 */
export function decidingCard(hero, villain, board) {
  const heroScore = evaluateHand(hero, board, HOLDEM);
  const villainScore = evaluateHand(villain, board, HOLDEM);
  if (handPhrase(heroScore) !== handPhrase(villainScore)) return null;

  const mine = kickersOf(heroScore);
  const theirs = kickersOf(villainScore);
  for (let i = 0; i < mine.length; i++) {
    if (mine[i] === theirs[i]) continue;
    return {
      yours: RANK_NAMES[mine[i]].toLowerCase(),
      theirs: RANK_NAMES[theirs[i]].toLowerCase(),
      losing: theirs[i] > mine[i],
    };
  }
  return null;
}

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

  const described = describeOuts(hero, villain, board);

  return {
    kind: 'count-outs',
    // "if it came next" is doing real work. Without it the question reads as
    // "which cards help my hand", and a reader reasonably taps the flush and
    // straight cards — including suits they do not even hold, because the
    // board has two of them. One card, and it has to win outright.
    prompt: 'Tap every card that would put you in front **if it came next**.',
    // Stated before you start rather than only in the feedback, so "in front"
    // is anchored to a comparison you can see instead of a vague improvement.
    // When both hands are the same shape the line has to say what separates
    // them, or it reads as "you both have king high, so you are behind" —
    // which asserts the conclusion and hides the reason, the kicker.
    standings: {
      hero: described.heroNow,
      villain: described.villainNow,
      decidedBy: decidingCard(hero, villain, board),
    },
    hero, villain, board, unseen,
    /** @param {number[]} picked */
    grade(picked) {
      const chosen = new Set(picked);
      const hits = outs.filter((c) => chosen.has(c));
      const missed = outs.filter((c) => !chosen.has(c));
      const wrong = [...chosen].filter((c) => !outSet.has(c));
      const perfect = missed.length === 0 && wrong.length === 0;

      // Naming what a wrong pick actually leaves you with is the correction
      // that teaches: "K♥ still leaves you queen-high" lands where "8 of your
      // picks do not win" does not.
      let wrongLesson = null;
      if (wrong.length) {
        const worst = wrong[0];
        const wouldBe = handPhrase(evaluateHand(hero, [...board, worst], HOLDEM));
        wrongLesson = { card: worst, wouldBe, villain: described.villainNow };
      }

      return {
        correct: perfect,
        hits, missed, wrong, wrongLesson,
        // Why each wrong pick was wrong, as a named misconception rather than
        // a count. "Eleven picks were wrong" says nothing a lesson can act on;
        // "seven were a suit you hold none of" names the misreading exactly.
        misreadings: classifyWrongPicks(hero, villain, board, wrong),
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
    actions: [{ key: 'call', label: t('Call {amount}', { amount: bet }) }, { key: 'fold', label: 'Fold' }],
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


/* ------------------------------------------------------------------ *
 * The remaining lessons.
 *
 * Most of these are one of two shapes — produce a number from a real
 * situation, or choose between two real actions — so they share a view
 * rather than each getting a bespoke one. What differs is the maths behind
 * them, and every one is graded by the same engine the table runs on.
 * ------------------------------------------------------------------ */

/** Shared shape: a few figures on screen, you type the answer. */
const numberSpot = ({ prompt, tiles, exact, tolerance = 2, unit = '%', explain }) => ({
  kind: 'number',
  prompt, tiles, unit,
  grade(value) {
    const given = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(given)) {
      return { correct: false, explanation: 'Type a number.' };
    }
    return { correct: Math.abs(given - exact) <= tolerance, exact, explanation: explain(given) };
  },
});

/** Shared shape: real context, two or three buttons, one right answer. */
const choiceSpot = ({ prompt, tiles, cards, options, answer, explain }) => ({
  kind: 'choice',
  prompt, tiles, cards, options,
  grade(picked) {
    return { correct: picked === answer, answer, explanation: explain(picked) };
  },
});

/* ---- Preflop: a real hand, a real seat, raise or fold -------------- */

export function openOrFoldPractice(rng = makeRng()) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const seat = POSITIONS[randInt(rng, 4)];        // UTG..BTN — seats that open
    const key = handKey(hero);
    const advice = preflopAdvice(key, seat);
    return { hero, seat, key, advice };
  });
  const { hero, seat, key, advice } = spot;
  const pct = (rangePercent(CHARTS.rfi[seat]) * 100).toFixed(0);

  return choiceSpot({
    prompt: 'Everybody has folded to you. Raise or fold?',
    cards: { label: 'Your hand', cards: hero },
    tiles: [{ label: 'Your seat', value: seat }, { label: 'Players behind you', value: POSITIONS.length - 1 - POSITIONS.indexOf(seat) }],
    options: [{ key: 'raise', label: 'Raise' }, { key: 'fold', label: 'Fold' }],
    answer: advice.action,
    explain: () => t('{hand} from {seat}. That seat opens about {pct}% of hands, and this one is {inside} it.',
      { hand: key, seat, pct, inside: advice.action === 'raise' ? t('inside') : t('outside') }),
  });
}

/* ---- Position: the same hand, two different seats ------------------ */

export function seatMattersPractice(rng = makeRng()) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const key = handKey(hero);
    // Interesting only when the seat is what decides it.
    const early = preflopAdvice(key, 'UTG').action;
    const late = preflopAdvice(key, 'BTN').action;
    if (early === late) return null;
    return { hero, key };
  });
  if (!spot) return null;
  const { hero, key } = spot;

  return choiceSpot({
    prompt: 'Same hand, two seats. From which one is this a raise?',
    cards: { label: 'Your hand', cards: hero },
    options: [
      { key: 'utg', label: 'Under the gun' },
      { key: 'btn', label: 'On the button' },
      { key: 'both', label: 'Both' },
    ],
    answer: 'btn',
    explain: () => t('{hand} is a fold under the gun and a raise on the button. The cards did not change — five players can still wake up behind you in the first seat, and only two on the button.', { hand: key }),
  });
}

/* ---- C-betting: read the texture, bet or check --------------------- */

export function cbetPractice(rng = makeRng()) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const board = deck.slice(0, 3);
    const ranks = board.map(rankOf).sort((a, b) => b - a);
    const suits = new Set(board.map((c) => c & 3));
    const gaps = (ranks[0] - ranks[1]) + (ranks[1] - ranks[2]);
    const paired = new Set(ranks).size < 3;

    // Dry: three suits, spread out, no pair, a high card. Wet: two of a suit
    // and connected. Anything in between is a judgement call, so skip it.
    const dry = suits.size === 3 && gaps >= 6 && !paired && ranks[0] >= 12;
    const wet = suits.size <= 2 && gaps <= 4 && ranks[0] <= 11;
    if (!dry && !wet) return null;
    return { board, dry, ranks, suits: suits.size, gaps };
  });
  if (!spot) return null;
  const { board, dry, suits } = spot;

  return choiceSpot({
    prompt: 'You raised before the flop and they called. They check. Bet small, or check back?',
    cards: { label: 'The flop', cards: board },
    options: [{ key: 'bet', label: 'Bet small' }, { key: 'check', label: 'Check back' }],
    answer: dry ? 'bet' : 'check',
    explain: () => (dry
      ? t('Three different suits and nothing connected — a dry board. Very little of their calling range hit this, so a small bet folds out most of it. Bet your whole range here.')
      : t('{shape} and connected — a wet board. Straights, draws and pairs all continue against a bet, so this one favours the caller. Check and keep the pot small.',
        { shape: suits === 1 ? t('All one suit') : t('Two of a suit') })),
  });
}

/* ---- Defence frequency, bluff break-even, SPR: produce the number --- */

export function defendPractice(rng = makeRng()) {
  const pot = (4 + randInt(rng, 12)) * 10;
  const bet = Math.max(10, Math.round((pot * [0.25, 1 / 3, 0.5, 0.75, 1][randInt(rng, 5)]) / 10) * 10);
  const mdf = minimumDefenceFrequency(bet, pot) * 100;
  return numberSpot({
    prompt: 'What share of your range do you have to keep defending?',
    tiles: [{ label: 'In the pot', value: pot }, { label: 'They bet', value: bet }],
    exact: mdf,
    explain: () => t('MDF = pot ÷ (pot + bet) = {pot} ÷ {total} = {pct}%. Fold more often than that and they can bluff you with any two cards.',
      { pot, total: pot + bet, pct: mdf.toFixed(0) }),
  });
}

export function bluffPractice(rng = makeRng()) {
  const pot = (4 + randInt(rng, 12)) * 10;
  const bet = Math.max(10, Math.round((pot * [0.5, 0.75, 1, 1.5, 2][randInt(rng, 5)]) / 10) * 10);
  const need = breakEvenBluffFrequency(bet, pot) * 100;
  return numberSpot({
    prompt: 'You are bluffing with a hand that cannot win a showdown. How often must they fold?',
    tiles: [{ label: 'In the pot', value: pot }, { label: 'Your bluff', value: bet }],
    exact: need,
    explain: () => t('You risk {bet} to win {pot}, so break-even is {bet} ÷ {total} = {pct}%. A bigger bluff wins more when it works and has to work more often.',
      { bet, pot, total: bet + pot, pct: need.toFixed(0) }),
  });
}

export function sprPractice(rng = makeRng()) {
  const pot = (2 + randInt(rng, 8)) * 10;
  const yours = pot * (3 + randInt(rng, 12));
  const theirs = pot * (2 + randInt(rng, 10));
  const effective = Math.min(yours, theirs);
  const value = spr(effective, pot);
  return numberSpot({
    prompt: 'What is the stack-to-pot ratio?',
    tiles: [
      { label: 'Pot on the flop', value: pot },
      { label: 'Your stack', value: yours },
      { label: 'Their stack', value: theirs },
    ],
    exact: value,
    tolerance: 0.6,
    unit: '',
    explain: () => t('The effective stack is the smaller of the two — {effective} — because neither of you can win more than that. {effective} ÷ {pot} = {spr}.',
      { effective, pot, spr: value.toFixed(1) }) + ' '
      + (value <= 3 ? t('Under 3: top pair is committed.') : value >= 6 ? t('Over 6: one pair is just one pair.') : t('In between: proceed carefully.')),
  });
}

/* ---- ICM: the bubble call ----------------------------------------- */

export function bubblePractice(rng = makeRng()) {
  const payouts = [500, 300, 200];
  const stacks = [40 + randInt(rng, 40), 30 + randInt(rng, 30), 20 + randInt(rng, 25), 15 + randInt(rng, 20)];
  const equity = 0.52 + randInt(rng, 8) / 100;      // a genuine chip favourite
  const before = icmEquity(stacks, payouts)[0];
  return choiceSpot({
    prompt: 'It is the bubble — one more out and everyone left is paid. You can call an all-in. Do you?',
    tiles: [
      { label: 'Your equity if you call', value: `${(equity * 100).toFixed(0)}%` },
      { label: 'Your stack', value: stacks[0] },
      { label: 'Players left', value: stacks.length },
      { label: 'Places paid', value: payouts.length },
    ],
    options: [{ key: 'fold', label: 'Fold' }, { key: 'call', label: 'Call' }],
    answer: 'fold',
    explain: () => t('You are a favourite in chips at {pct}%, and that is not the question. Busting costs a payout you were about to lock up, while winning only slightly improves one you might have got anyway — your prize equity is about {equity} of a {pool} pool. On the bubble you fold hands you would happily get in with at any other stage.',
      { pct: (equity * 100).toFixed(0), equity: before.toFixed(0), pool: payouts.reduce((a, b) => a + b, 0) }),
  });
}

/* ---- Reading players: name the leak, then do the opposite ---------- */

const VILLAINS = [
  { name: 'Stan', vpip: 68, pfr: 4, folds: 8, leak: 'station',
    tell: 'plays 68% of hands and almost never folds after the flop' },
  { name: 'Rocky', vpip: 12, pfr: 9, folds: 71, leak: 'nit',
    tell: 'plays 12% of hands and folds to 71% of bets' },
  { name: 'Max', vpip: 54, pfr: 41, folds: 22, leak: 'maniac',
    tell: 'raises 41% of hands and bets at almost every pot' },
];

const LEAK_ANSWER = {
  station: { key: 'value', why: () => t('He cannot fold, so a bluff has nothing to win. Value bet thinner and larger than feels comfortable — he pays every time.') },
  nit: { key: 'steal', why: () => t('He folds far too much, so your cards barely matter. Steal relentlessly — and when he finally raises, believe him and fold.') },
  maniac: { key: 'callDown', why: () => t('He bluffs constantly, so you do not need to fight him. Stop bluffing, tighten your opens, and call him down much wider than normal.') },
};

export function leakPractice(rng = makeRng()) {
  const villain = VILLAINS[randInt(rng, VILLAINS.length)];
  const answer = LEAK_ANSWER[villain.leak];
  return choiceSpot({
    prompt: t('{name} {tell}. What is the adjustment?', { name: villain.name, tell: t(villain.tell) }),
    tiles: [
      { label: 'VPIP', value: `${villain.vpip}%` },
      { label: 'PFR', value: `${villain.pfr}%` },
      { label: 'Folds to a bet', value: `${villain.folds}%` },
    ],
    options: [
      { key: 'value', label: 'Never bluff, value bet wider' },
      { key: 'steal', label: 'Steal relentlessly, fold to his raises' },
      { key: 'callDown', label: 'Stop bluffing, call him down lighter' },
    ],
    answer: answer.key,
    explain: () => answer.why(),
  });
}

/* ---- Bankroll: can you sit down? ---------------------------------- */

export function rollPractice(rng = makeRng()) {
  const stake = STAKES[1 + randInt(rng, 4)];
  // Roughly half the time short, half comfortable, so neither answer is a habit.
  const buyIns = randInt(rng, 2) ? 6 + randInt(rng, 10) : 32 + randInt(rng, 30);
  const roll = Math.round(stake.buyIn * buyIns);
  const advice = bankrollAdvice(roll, stake.key);
  const wanted = Math.round(stake.minBankroll / stake.buyIn);
  return choiceSpot({
    prompt: t('You have this roll and want to sit at {stake}. Should you?', { stake: stake.name }),
    tiles: [
      { label: 'Your bankroll', value: `$${roll}` },
      { label: 'Buy-in', value: `$${stake.buyIn}` },
      { label: 'That is', value: t('{n} buy-ins', { n: buyIns }) },
    ],
    options: [{ key: 'yes', label: t('Sit at {stake}', { stake: stake.name }) }, { key: 'no', label: 'Play lower' }],
    answer: advice.ok ? 'yes' : 'no',
    explain: () => (advice.ok
      ? t('{n} buy-ins is enough for {stake}, which wants at least {wanted}.', { n: buyIns, stake: stake.name, wanted })
      : t('{n} buy-ins is not enough for {stake} — you want at least {wanted}. Normal downswings run past 20 buy-ins, so an ordinary bad run would take the lot.',
        { n: buyIns, stake: stake.name, wanted })),
  });
}

export const PRACTICE = {
  'count-outs': countOutsPractice,
  'pick-winner': (rng) => pickWinnerPractice(rng, { subtle: false }),
  'pick-winner-kicker': (rng) => pickWinnerPractice(rng, { subtle: true }),
  price: pricePractice,
  decide: decidePractice,
  'open-or-fold': openOrFoldPractice,
  'seat-matters': seatMattersPractice,
  cbet: cbetPractice,
  defend: defendPractice,
  bluff: bluffPractice,
  spr: sprPractice,
  bubble: bubblePractice,
  leak: leakPractice,
  roll: rollPractice,
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
