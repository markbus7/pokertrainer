/**
 * Postflop drills: continuation betting, defence frequencies, bluff catching
 * and bet sizing. The graded answers come from board texture plus real equity,
 * not from a table of hand-written verdicts.
 */

import { makeDeck, cardsToString } from '../core/cards.js';
import { handEquity } from '../core/equity.js';
import {
  minimumDefenceFrequency, breakEvenBluffFrequency, bluffShareOfRange,
  requiredEquity, spr,
} from '../core/odds.js';
import { shuffle, randInt } from '../core/rng.js';
import { PROFILES } from '../engine/bots.js';
import { buildChoices, percentDistractors, attempt, describeTexture, pct } from './helpers.js';
import { t } from '../i18n/index.js';

// Read through t() at call time rather than once at module load: the language
// can change while the app is open, and a constant captured at import would
// still be in whichever language happened to be current then.
const SIZE_SMALL = () => t('Bet small (about a third of the pot)');
const SIZE_BIG = () => t('Bet big (about three quarters of the pot)');
const CHECK = () => t('Check');

/**
 * Should you continuation bet, and how big?
 * The heuristic: on dry boards your whole range can bet small, because the
 * caller missed too. On wet boards you need a real hand to keep firing.
 */
export function cbetDrill(rng, difficulty = 3) {
  const spot = attempt(() => {
    const deck = shuffle(rng, makeDeck());
    const hero = deck.slice(0, 2);
    const board = deck.slice(2, 5);
    const equity = handEquity([hero], board, { trials: 900, rng }).equity[0];
    const texture = describeTexture(board);
    // Skip the genuinely close spots; a drill should have a defensible answer.
    if (equity > 0.42 && equity < 0.48) return null;
    return { hero, board, equity, texture };
  });
  if (!spot) return null;

  const { hero, board, equity, texture } = spot;
  let correct;
  let why;

  if (equity >= 0.70) {
    correct = texture.wet ? SIZE_BIG() : SIZE_SMALL();
    why = texture.wet
      ? t('You are well ahead ({equity} equity) on a board that gives them plenty of draws. Bet big: charge the '
        + 'draws and build the pot while you are in front.', { equity: pct(equity) })
      : t('You are well ahead ({equity} equity) on a dry board. Bet small — they have few draws to charge, and a '
        + 'small bet keeps their weak hands in.', { equity: pct(equity) });
  } else if (equity >= 0.48) {
    correct = texture.wet ? SIZE_BIG() : SIZE_SMALL();
    why = texture.wet
      ? t('{equity} equity on a coordinated board. Bet big to deny equity — checking lets every draw see a free '
        + 'card.', { equity: pct(equity) })
      : t('{equity} equity on a dry board. A small bet works with your whole range: they missed this flop as '
        + 'often as you did.', { equity: pct(equity) });
  } else if (!texture.wet) {
    correct = SIZE_SMALL();
    why = t('You only have {equity} equity, but this board is dry and disconnected. A small continuation bet '
      + 'folds out everything that missed, and that is most of their range.', { equity: pct(equity) });
  } else {
    correct = CHECK();
    why = t('{equity} equity on a wet, connected board. They have too many hands that will continue — a bluff '
      + 'here just donates chips. Check and give up cheaply.', { equity: pct(equity) });
  }

  const { options, answer } = buildChoices(rng, correct, [SIZE_SMALL(), SIZE_BIG(), CHECK()]);
  return {
    module: 'cbet',
    difficulty,
    scenario: { board, hole: hero, texture: texture.tags },
    question: t('You raised preflop and the big blind called. They check to you on the flop. What now?'),
    options,
    answer,
    explanation: `${t('{board} is {tags}.',
      { board: cardsToString(board), tags: texture.tags.map((tag) => t(tag)).join(', ') })} ${why}`,
    xp: 14 + difficulty * 3,
  };
}

/** Minimum defence frequency: how much you must call to stop being bluffed. */
export function mdfDrill(rng, difficulty = 4) {
  const pot = (4 + randInt(rng, 10)) * 10;
  const fraction = [0.33, 0.5, 0.66, 0.75, 1][randInt(rng, 5)];
  const bet = Math.round(pot * fraction / 5) * 5;
  const mdf = minimumDefenceFrequency(bet, pot);
  const truePct = Math.round(mdf * 100);
  const { options, answer } = buildChoices(
    rng, `${truePct}%`, percentDistractors(rng, truePct, 3, 12, 7).map((p) => `${p}%`),
  );

  return {
    module: 'mdf',
    difficulty,
    scenario: { pot, toCall: bet },
    question: t('The pot is {pot} and your opponent bets {bet}. What share of your range must you continue with '
      + 'to stop a pure bluff from printing money?', { pot, bet }),
    options,
    answer,
    explanation: t('Minimum defence frequency is pot ÷ (pot + bet) = {pot} ÷ {total} = {mdf}. Fold more often '
      + 'than that and any two cards can profitably bluff you. Note this is a defensive guideline, not a law: '
      + 'against someone who never bluffs, over-folding is correct.',
      { pot, total: pot + bet, mdf: pct(mdf, 1) }),
    xp: 16 + difficulty * 3,
  };
}

/** How often does a bluff have to work? */
export function bluffMathDrill(rng, difficulty = 4) {
  const pot = (4 + randInt(rng, 10)) * 10;
  const fraction = [0.5, 0.66, 0.75, 1, 1.5][randInt(rng, 5)];
  const bet = Math.round(pot * fraction / 5) * 5;
  const need = breakEvenBluffFrequency(bet, pot);
  const truePct = Math.round(need * 100);
  const { options, answer } = buildChoices(
    rng, `${truePct}%`, percentDistractors(rng, truePct, 3, 12, 7).map((p) => `${p}%`),
  );

  return {
    module: 'bluffing',
    difficulty,
    scenario: { pot, betSize: bet },
    question: t('You want to bluff {bet} into a pot of {pot} with a hand that never wins at showdown. How often '
      + 'must they fold for this to break even?', { bet, pot }),
    options,
    answer,
    explanation: t('You risk {bet} to win {pot}, so you need {bet} ÷ {total} = {need}. Bigger bluffs need to work '
      + 'more often — which is why sizing up is not automatically better.',
      { bet, pot, total: bet + pot, need: pct(need, 1) }),
    xp: 16 + difficulty * 3,
  };
}

/** Balanced bluff-to-value ratio for a river bet. */
export function balanceDrill(rng, difficulty = 5) {
  const pot = 100;
  const fraction = [0.5, 0.75, 1][randInt(rng, 3)];
  const bet = Math.round(pot * fraction);
  const share = bluffShareOfRange(bet, pot);
  const truePct = Math.round(share * 100);
  const { options, answer } = buildChoices(
    rng, `${truePct}%`, percentDistractors(rng, truePct, 3, 12, 6).map((p) => `${p}%`),
  );

  return {
    module: 'bluffing',
    difficulty,
    scenario: { pot, betSize: bet },
    question: t('You bet {bet} into {pot} on the river. For a balanced range that gives your opponent no '
      + 'profitable choice, what share of your betting hands should be bluffs?', { bet, pot }),
    options,
    answer,
    explanation: t('Your opponent needs {need} to call. To make them exactly indifferent, bluffs should be {share} '
      + 'of your betting range — roughly {ratio} bluffs for every value hand. At pot size that is the familiar '
      + '1 bluff per 2 value bets.',
      { need: pct(requiredEquity(bet, pot + bet), 1), share: pct(share, 1), ratio: (share / (1 - share)).toFixed(2) }),
    xp: 20 + difficulty * 3,
  };
}

/**
 * Bluff catching against a known player type — the drill that turns
 * "reading players" into arithmetic.
 */
export function bluffCatchDrill(rng, difficulty = 4) {
  const keys = ['rock', 'tag', 'lag', 'station', 'maniac'];
  const villain = PROFILES[keys[randInt(rng, keys.length)]];
  const pot = (4 + randInt(rng, 8)) * 10;
  const fraction = [0.5, 0.75, 1][randInt(rng, 3)];
  const bet = Math.round(pot * fraction / 5) * 5;
  const need = requiredEquity(bet, pot + bet);
  // Holding a pure bluff catcher, your equity IS their bluff frequency.
  const bluffFreq = villain.bluff;
  if (Math.abs(bluffFreq - need) < 0.05) return null;

  const shouldCall = bluffFreq > need;
  const { options, answer } = buildChoices(rng, shouldCall ? t('Call') : t('Fold'), [t('Call'), t('Fold')]);
  const opener = t('You need to be right {need} of the time. {name} bluffs about {freq} of the time — {tell}',
    { need: pct(need, 1), name: villain.name, freq: pct(bluffFreq), tell: t(villain.tell).toLowerCase() });
  const verdict = shouldCall
    ? t('Since {freq} beats the {need} you need, this is a profitable call.',
      { freq: pct(bluffFreq), need: pct(need) })
    : t('Since {freq} falls short of the {need} you need, folding is correct.',
      { freq: pct(bluffFreq), need: pct(need) });

  return {
    module: 'exploit',
    difficulty,
    scenario: { pot, toCall: bet, villain: { name: villain.name, style: t(villain.style), emoji: villain.emoji, tell: t(villain.tell) } },
    question: t('River. You hold a hand that beats a bluff and nothing else. {name} ({style}) bets {bet} into '
      + '{pot}. Call or fold?', { name: villain.name, style: t(villain.style), bet, pot }),
    options,
    answer,
    explanation: `${opener} ${verdict} ${t(villain.counter)}`,
    xp: 18 + difficulty * 4,
  };
}

/** Stack-to-pot ratio: the number that decides whether you can fold later. */
export function sprDrill(rng, difficulty = 4) {
  const pot = (2 + randInt(rng, 8)) * 10;
  const stack = pot * (1 + randInt(rng, 12));
  const ratio = spr(stack, pot);
  const rounded = Math.round(ratio);
  const { options, answer } = buildChoices(
    rng, String(rounded), [rounded + 2, Math.max(1, rounded - 2), rounded + 5].map(String),
  );
  const guidance = ratio <= 3
    ? t('With an SPR of 3 or less, top pair is usually committed: plan to get all the chips in.')
    : ratio <= 6
      ? t('A medium SPR means you need a strong hand — overpairs and better — to play a big pot.')
      : t('A deep SPR means one pair is just one pair. Keep the pot small and look for a hand that can stack them.');

  return {
    module: 'spr',
    difficulty,
    scenario: { pot, effectiveStack: stack },
    question: t('The pot is {pot} on the flop and the effective stack is {stack}. What is the stack-to-pot ratio?',
      { pot, stack }),
    options,
    answer,
    explanation: `${t('SPR = {stack} ÷ {pot} = {ratio}.', { stack, pot, ratio: ratio.toFixed(1) })} ${guidance}`,
    xp: 14 + difficulty * 3,
  };
}
