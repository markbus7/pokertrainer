/**
 * Preflop drills. Preflop is where most money is lost, and it is the only
 * street you can genuinely memorise — so these drills grade against the
 * actual charts in data/ranges.js.
 */

import { expandHandKey, ALL_HAND_KEYS } from '../core/cards.js';
import { CHARTS, preflopAdvice, POSITIONS, POSITION_INFO, rangePercent } from '../data/ranges.js';
import { STRENGTH_RANK, HAND_STRENGTH } from '../data/handStrength.js';
import { randInt } from '../core/rng.js';
import { buildChoices, pct } from './helpers.js';
import { t } from '../i18n/index.js';

const OPEN_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

/** Raise or fold, first into the pot. */
export function openingDrill(rng, difficulty = 2) {
  const position = OPEN_POSITIONS[randInt(rng, OPEN_POSITIONS.length)];
  // Bias toward borderline hands as difficulty rises: those are the ones
  // that actually cost money.
  const hand = pickHandForDifficulty(rng, difficulty, CHARTS.rfi[position]);
  const advice = preflopAdvice(hand, position);
  const raising = advice.action === 'raise';
  const correct = raising ? t('Raise') : t('Fold');
  const { options, answer } = buildChoices(rng, correct, [t('Raise'), t('Fold'), t('Limp (call the big blind)')]);

  return {
    module: 'preflop',
    difficulty,
    scenario: { hole: expandHandKey(hand)[0], position, positionName: t(POSITION_INFO[position].name) },
    question: t('It folds to you in the {seat}. What is your move?', { seat: t(POSITION_INFO[position].name) }),
    options,
    answer,
    explanation: `${advice.reason} ${t(POSITION_INFO[position].blurb)}${
      raising ? '' : ` ${t('And limping is never the answer: it lets everyone behind you in cheaply while you hold '
        + 'a weak hand out of position.')}`
    }`,
    xp: 12 + difficulty * 3,
  };
}

/** Facing an open: 3-bet, call, or fold. */
export function facingRaiseDrill(rng, difficulty = 3) {
  const raiserIndex = randInt(rng, 4);          // UTG..BTN
  const raiser = POSITIONS[raiserIndex];
  const heroChoices = POSITIONS.slice(raiserIndex + 1);
  const position = heroChoices[randInt(rng, heroChoices.length)];
  const chart = CHARTS.threeBet[position];
  const pool = difficulty >= 3
    ? [...chart.value, ...chart.bluff, ...(CHARTS.bbDefend[raiser] || [])]
    : ALL_HAND_KEYS;
  const hand = pool[randInt(rng, pool.length)];

  const advice = preflopAdvice(hand, position, { action: 'vs_raise', raiser });
  const label = advice.action === 'raise' ? '3-bet' : advice.action === 'call' ? t('Call') : t('Fold');
  const { options, answer } = buildChoices(rng, label, ['3-bet', t('Call'), t('Fold')]);

  return {
    module: 'preflop',
    difficulty,
    scenario: { hole: expandHandKey(hand)[0], position, positionName: t(POSITION_INFO[position].name), raiser },
    question: t('{raiser} opens to 2.5 big blinds and it folds to you in the {seat}. What is your move?',
      { raiser, seat: t(POSITION_INFO[position].name) }),
    options,
    answer,
    explanation: `${advice.reason}${
      advice.kind === 'bluff'
        ? ` ${t('A 3-bet range needs bluffs as well as value hands, or observant opponents simply fold every '
          + 'time you raise.')}`
        : ''
    }`,
    xp: 16 + difficulty * 3,
  };
}

/** Which position is this hand playable from? Teaches positional awareness. */
export function positionDrill(rng, difficulty = 3) {
  const hand = pickBorderlineHand(rng);
  const openable = OPEN_POSITIONS.filter((p) => CHARTS.rfi[p].has(hand));
  if (!openable.length || openable.length === OPEN_POSITIONS.length) return null;

  const earliest = OPEN_POSITIONS.find((p) => CHARTS.rfi[p].has(hand));
  const { options, answer } = buildChoices(
    rng,
    t(POSITION_INFO[earliest].name),
    OPEN_POSITIONS.filter((p) => p !== earliest).map((p) => t(POSITION_INFO[p].name)),
  );

  return {
    module: 'position',
    difficulty,
    scenario: { hole: expandHandKey(hand)[0] },
    question: t('What is the earliest position you should open {hand} from?', { hand }),
    options,
    answer,
    explanation: `${t('{hand} first appears in the opening range at {seat} ({pct} of hands). Opening it earlier '
      + 'means playing it out of position against too many opponents.',
      { hand, seat: t(POSITION_INFO[earliest].name), pct: pct(rangePercent(CHARTS.rfi[earliest])) })
    } ${t(POSITION_INFO[earliest].blurb)}`,
    xp: 15 + difficulty * 3,
  };
}

/** Big blind defence — the widest and least intuitive range in poker. */
export function blindDefenceDrill(rng, difficulty = 3) {
  const raiser = ['UTG', 'HJ', 'CO', 'BTN'][randInt(rng, 4)];
  const defend = CHARTS.bbDefend[raiser];
  const hand = pickHandForDifficulty(rng, difficulty, defend);
  const advice = preflopAdvice(hand, 'BB', { action: 'vs_raise', raiser });
  const label = advice.action === 'raise' ? '3-bet' : advice.action === 'call' ? t('Call') : t('Fold');
  const { options, answer } = buildChoices(rng, label, ['3-bet', t('Call'), t('Fold')]);

  return {
    module: 'position',
    difficulty,
    scenario: { hole: expandHandKey(hand)[0], position: 'BB', positionName: t('Big Blind'), raiser },
    question: t('{raiser} raises to 2.5 big blinds and everyone folds to you in the big blind. What is your move?',
      { raiser }),
    options,
    answer,
    explanation: `${advice.reason} ${t('You only have to put in 1.5 more big blinds to win a pot of 4, so you '
      + 'defend far wider here than anywhere else — but you are out of position for the whole hand, which is why '
      + 'the range still has a limit.')}`,
    xp: 16 + difficulty * 3,
  };
}

/** Rank two starting hands against each other. */
export function handStrengthDrill(rng, difficulty = 2) {
  let a = ALL_HAND_KEYS[randInt(rng, 169)];
  let b = ALL_HAND_KEYS[randInt(rng, 169)];
  let guard = 0;
  const gap = difficulty >= 4 ? 12 : 40;
  while ((a === b || Math.abs(STRENGTH_RANK[a] - STRENGTH_RANK[b]) > gap
    || Math.abs(STRENGTH_RANK[a] - STRENGTH_RANK[b]) < 3) && guard++ < 400) {
    a = ALL_HAND_KEYS[randInt(rng, 169)];
    b = ALL_HAND_KEYS[randInt(rng, 169)];
  }
  const stronger = STRENGTH_RANK[a] < STRENGTH_RANK[b] ? a : b;
  const { options, answer } = buildChoices(rng, stronger, [a, b]);

  return {
    module: 'preflop',
    difficulty,
    scenario: { compare: [expandHandKey(a)[0], expandHandKey(b)[0]] },
    question: t('All-in preflop against a random hand — which of these is stronger, {a} or {b}?', { a, b }),
    options,
    answer,
    explanation: `${t('{a} wins {pctA} against a random hand (rank {rankA} of 169); {b} wins {pctB} (rank {rankB}).',
      { a, pctA: pct(HAND_STRENGTH[a], 1), rankA: STRENGTH_RANK[a],
        b, pctB: pct(HAND_STRENGTH[b], 1), rankB: STRENGTH_RANK[b] })
    } ${compareLesson(a, b, stronger)}`,
    xp: 10 + difficulty * 2,
  };
}

/* ---------------- helpers ---------------- */

/** The actual reason one starting hand beats another. */
function compareLesson(a, b, stronger) {
  const weaker = stronger === a ? b : a;
  const isPair = (k) => k.length === 2;
  const isSuited = (k) => k[2] === 's';
  if (isPair(stronger) && !isPair(weaker)) {
    return t('A pair starts ahead and does not need to improve — that is worth more than any amount of connectivity.');
  }
  if (!isPair(stronger) && isPair(weaker)) {
    return t('Even a small pair is usually a coin flip at worst, which is why the bigger unpaired hand needs real '
      + 'high-card strength to beat one.');
  }
  if (isSuited(stronger) && !isSuited(weaker)) {
    return t('Suited beats offsuit by roughly two to three points of equity — small, but it is free, and it comes '
      + 'from the pots you win rather than chop.');
  }
  if (isPair(stronger) && isPair(weaker)) {
    return t('Between two pairs it is simply the higher pair; the lower one is drawing to a set.');
  }
  return t('With both hands offsuit, raw high-card strength decides it: the hand that makes the better top pair '
    + 'wins far more often than the one that needs to connect.');
}

/** Easy drills use clear-cut hands; hard drills use the chart boundary. */
function pickHandForDifficulty(rng, difficulty, range) {
  if (difficulty <= 2) {
    // Clearly in or clearly out.
    const inRange = [...range];
    const outRange = ALL_HAND_KEYS.filter((k) => !range.has(k));
    const source = rng() < 0.5 ? inRange : outRange;
    const strongFirst = [...source].sort((x, y) => STRENGTH_RANK[x] - STRENGTH_RANK[y]);
    const slice = rng() < 0.5
      ? strongFirst.slice(0, Math.max(1, Math.floor(strongFirst.length * 0.4)))
      : strongFirst.slice(Math.floor(strongFirst.length * 0.6));
    return slice[randInt(rng, slice.length)] || ALL_HAND_KEYS[randInt(rng, 169)];
  }
  return pickBorderlineHand(rng, range);
}

/** Hands sitting on the edge of a range, where the real mistakes happen. */
function pickBorderlineHand(rng, range = null) {
  if (range) {
    const inRange = [...range].sort((a, b) => STRENGTH_RANK[b] - STRENGTH_RANK[a]).slice(0, 14);
    const outRange = ALL_HAND_KEYS.filter((k) => !range.has(k))
      .sort((a, b) => STRENGTH_RANK[a] - STRENGTH_RANK[b]).slice(0, 14);
    const pool = [...inRange, ...outRange];
    return pool[randInt(rng, pool.length)];
  }
  const mid = ALL_HAND_KEYS.filter((k) => STRENGTH_RANK[k] >= 20 && STRENGTH_RANK[k] <= 110);
  return mid[randInt(rng, mid.length)];
}
