/**
 * Preflop drills. Preflop is where most money is lost, and it is the only
 * street you can genuinely memorise — so these drills grade against the
 * actual charts in data/ranges.js.
 */

import { expandHandKey, ALL_HAND_KEYS } from '../core/cards.js';
import { matchupOf, buildMatchup, DRILLABLE_SHAPES } from '../core/matchup.js';
import { equityVs } from '../core/equity.js';
import { VS_RANGE, RANGE_WIDTH, RANGE_POSITIONS } from '../data/rangeEquity.js';
import { CHARTS, preflopAdvice, POSITIONS, POSITION_INFO, rangePercent, BOUNDARY_ROWS, rowBoundary, pairBoundary } from '../data/ranges.js';
import { STRENGTH_RANK, HAND_STRENGTH } from '../data/handStrength.js';
import { randInt } from '../core/rng.js';
import { buildChoices, pct, percentDistractors } from './helpers.js';
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

/**
 * Put a number on an all-in, by naming the shape it belongs to.
 *
 * The reader types the percentage rather than picking one, because
 * recognising "about half" among four options is not the same skill as
 * arriving at it. The graded figure is the real equity of these two hands,
 * run through the same engine the coach grades with; the explanation names
 * the shape, so the next unfamiliar matchup is still answerable.
 */
export function matchupEquityDrill(rng, difficulty = 2) {
  // Pick the shape first, then build hands that make it. Dealing at random
  // would ask about two higher cards against two lower ones four times in
  // five, and the rare shapes are the ones worth practising.
  const wanted = DRILLABLE_SHAPES[randInt(rng, DRILLABLE_SHAPES.length)];
  const built = buildMatchup(rng, wanted);
  if (!built) return null;
  const found = matchupOf(built[0], built[1]);
  if (!found || found.shape.id !== wanted) return null;

  // Always ask about the favourite: "what does the better hand win" has one
  // answer the reader can sanity-check against the shape.
  const hero = found.favourite === 0 ? built[0] : built[1];
  const villain = found.favourite === 0 ? built[1] : built[0];
  const equity = equityVs(hero, [villain], [], { trials: 8000, rng });
  const truePct = Math.round(equity * 100);
  const heroKey = keyOf(hero);
  const villainKey = keyOf(villain);
  const { options, answer } = buildChoices(
    rng, `${truePct}%`, percentDistractors(rng, truePct, 3, 14, 8).map((p) => `${p}%`),
    { sorted: true },
  );

  // A shape is a rule of thumb, not a promise. When this instance sits well
  // off the shape's usual figure, saying so is what stops the rule of thumb
  // from being remembered as a law.
  const off = equity - found.shape.typical;
  const edge = Math.abs(off) > 0.06
    ? ` ${t('This one lands {gap} points {side} that: most of the shape falls between {low} and {high}, and the edges are where the suits and the gaps between cards do their work.', {
      gap: Math.round(Math.abs(off) * 100),
      side: off > 0 ? t('above') : t('below'),
      low: pct(found.shape.spread[0], 0),
      high: pct(found.shape.spread[1], 0),
    })}`
    : '';

  return {
    module: 'preflop',
    difficulty,
    scenario: { compare: [hero, villain] },
    question: t('All-in before the flop: {hero} against {villain}. What percentage of the time does {hero} win?',
      { hero: heroKey, villain: villainKey }),
    options,
    answer,
    // Picking off a scale, not typing into an empty box. Every other typed
    // drill hands you the numbers and names the formula — "use the rule of
    // 4" — so typing there is arithmetic. Here there is nothing to compute
    // until the shapes are known, and typing a number you cannot derive is
    // guessing, which costs effort and teaches nothing. Recognising which
    // rung of the ladder a matchup sits on is the actual skill; producing
    // the number from memory is worth asking for only once that is fluent.
    ...(difficulty >= 5 ? { entry: { unit: '%', value: truePct, tolerance: 5 } } : {}),
    explanation: `${t('{hero} wins {actual}. This is {shape} — typically {typical}. {why}', {
      hero: heroKey,
      actual: pct(equity, 0),
      shape: t(found.shape.label),
      typical: pct(found.shape.typical, 0),
      why: t(found.shape.why),
    })}${edge}`,
    xp: 10 + difficulty * 2,
  };
}

/**
 * The number that actually decides the hand: not what your cards beat, but
 * what they beat against the hands still willing to play.
 *
 * This is the drill that explains why a chart exists at all. K-Q wins 62% of
 * the time against a random hand and 45% against an early-position opening
 * range — the hand did not change, the opposition did.
 */
export function rangeEquityDrill(rng, difficulty = 2) {
  const position = RANGE_POSITIONS[randInt(rng, RANGE_POSITIONS.length)];
  // Hands where the two numbers differ most are the ones worth asking about.
  const hand = attemptHand(rng, difficulty, position);
  if (!hand) return null;

  const vsRandom = HAND_STRENGTH[hand];
  const vsRange = VS_RANGE[position][hand];
  const truePct = Math.round(vsRange * 100);
  const { options, answer } = buildChoices(
    rng, `${truePct}%`, percentDistractors(rng, truePct, 3, 14, 8).map((p) => `${p}%`),
    { sorted: true },
  );

  return {
    module: 'preflop',
    difficulty,
    scenario: { hole: expandHandKey(hand)[0], position, positionName: t(POSITION_INFO[position].name) },
    question: t('You hold {hand}. Against a random hand it wins {random}. Now {seat} raises, so you are up '
      + 'against the top {width}% of hands instead. What does {hand} win against that?',
    { hand, random: pct(vsRandom, 0), seat: t(POSITION_INFO[position].name), width: RANGE_WIDTH[position] }),
    options,
    answer,
    ...(difficulty >= 5 ? { entry: { unit: '%', value: truePct, tolerance: 5 } } : {}),
    explanation: t('{hand} wins {range} against a {width}% range, down from {random} against a random hand — '
      + 'a drop of {drop} points. Nothing about your cards changed; the hands you are up against did. '
      + 'This is the whole reason a starting-hand chart exists.',
    { hand, range: pct(vsRange, 0), width: RANGE_WIDTH[position], random: pct(vsRandom, 0),
      drop: Math.round((vsRandom - vsRange) * 100) }),
    xp: 12 + difficulty * 2,
  };
}

/* ---------------- helpers ---------------- */

/** The 169-key form of two cards, e.g. 'AKs'. */
function keyOf(hand) {
  const RANKS = '23456789TJQKA';
  const [a, b] = hand.map((c) => ({ r: (c >> 2) + 2, s: c & 3 })).sort((x, y) => y.r - x.r);
  const chars = RANKS[a.r - 2] + RANKS[b.r - 2];
  if (a.r === b.r) return chars;
  return chars + (a.s === b.s ? 's' : 'o');
}

/**
 * A hand worth asking about: one whose value actually moves when the
 * opposition narrows. Asking about 7-2 teaches nothing.
 */
function attemptHand(rng, difficulty, position) {
  let best = null;
  for (let i = 0; i < 60; i++) {
    const hand = ALL_HAND_KEYS[randInt(rng, 169)];
    const drop = HAND_STRENGTH[hand] - VS_RANGE[position][hand];
    // Harder levels ask about the hands that look strong and are not.
    const wanted = difficulty >= 4 ? drop > 0.12 : drop > 0.06;
    if (wanted && HAND_STRENGTH[hand] > 0.5) return hand;
    if (!best || drop > HAND_STRENGTH[best] - VS_RANGE[position][best]) best = hand;
  }
  return best;
}

/**
 * Where a row of the chart stops.
 *
 * Every other preflop question shows a hand and asks what to do with it,
 * which is the chart applied. This asks for the chart itself: how far down
 * the suited kings you go from each seat. That is the form the boundary is
 * actually carried in — seven rows and a rule about position beats 169
 * squares — and it is the only question here you cannot answer by feel.
 */
export function chartBoundaryDrill(rng, difficulty = 2) {
  const RANKS = '23456789TJQKA';
  const spots = [];

  // Raising first in: how far down each row you open.
  for (const position of OPEN_POSITIONS) {
    const chart = CHARTS.rfi[position];
    if (!chart) continue;
    for (const row of BOUNDARY_ROWS) {
      const boundary = rowBoundary(chart, row.high, row.suited);
      if (boundary) spots.push({ kind: 'open', position, row, boundary });
    }
  }

  // Defending the big blind: the same rows, against each opener. This is the
  // frame that comes up most — you are in the big blind every orbit.
  for (const position of OPEN_POSITIONS) {
    const chart = CHARTS.bbDefend[position];
    if (!chart) continue;
    for (const row of BOUNDARY_ROWS) {
      const boundary = rowBoundary(chart, row.high, row.suited);
      if (boundary) spots.push({ kind: 'defend', position, row, boundary });
    }
  }

  // Three-betting for value: the pairs are the frame here, since the rest of
  // the range is a short list rather than a row with an end.
  for (const position of POSITIONS) {
    const entry = CHARTS.threeBet[position];
    if (!entry || !entry.value) continue;
    const boundary = pairBoundary(entry.value);
    if (boundary && boundary !== '22') spots.push({ kind: 'threebet', position, boundary });
  }

  if (!spots.length) return null;
  const pick = spots[randInt(rng, spots.length)];
  const seat = t(POSITION_INFO[pick.position].name);

  // Four neighbouring rungs of the same row — the question is "how far
  // down", never "which of these unrelated hands".
  const rungWindow = (lowIndex, topIndex, label) => {
    const window = [];
    for (let offset = -1; window.length < 4 && offset <= 3; offset++) {
      const i = lowIndex + offset;
      if (i >= 0 && i < topIndex) window.push(i);
    }
    for (let i = lowIndex - 2; window.length < 4 && i >= 0; i--) window.unshift(i);
    return window.includes(lowIndex) ? window.sort((a, b) => b - a).map(label) : null;
  };

  let labels;
  let question;
  let across;
  if (pick.kind === 'threebet') {
    const lowIndex = RANKS.indexOf(pick.boundary[0]);
    labels = rungWindow(lowIndex, RANKS.length, (i) => RANKS[i] + RANKS[i]);
    question = t('{seat} opens and it is on you. What is the weakest pair you 3-bet for value?', { seat });
    across = POSITIONS
      .map((p) => ({ p, b: CHARTS.threeBet[p] && CHARTS.threeBet[p].value ? pairBoundary(CHARTS.threeBet[p].value) : null }))
      .filter((x) => x.b && x.b !== '22')
      .map((x) => `${x.p} ${x.b}`)
      .join(' · ');
  } else {
    const { row } = pick;
    const topIndex = RANKS.indexOf(row.high);
    const lowIndex = RANKS.indexOf(pick.boundary[1]);
    labels = rungWindow(lowIndex, topIndex, (i) => row.high + RANKS[i] + (row.suited ? 's' : 'o'));
    question = pick.kind === 'open'
      ? t('Opening from {seat}: how far down the {row}s do you go? Pick the weakest one you still raise.',
        { seat, row: t(row.label) })
      : t('{seat} opens and you are in the big blind: how far down the {row}s do you defend? Pick the weakest '
        + 'one you still call.', { seat, row: t(row.label) });
    const source = pick.kind === 'open' ? CHARTS.rfi : CHARTS.bbDefend;
    across = OPEN_POSITIONS
      .map((p) => ({ p, b: source[p] ? rowBoundary(source[p], row.high, row.suited) : null }))
      .filter((x) => x.b)
      .map((x) => `${x.p} ${x.b}`)
      .join(' · ');
  }
  if (!labels) return null;

  const rungOf = (l) => (l.length === 2 ? RANKS.indexOf(l[0]) : RANKS.indexOf(l[1]));
  const { options, answer } = buildChoices(rng, pick.boundary, labels,
    { sorted: (a, b) => rungOf(b) - rungOf(a) });

  const tail = pick.kind === 'defend'
    ? t('You are already half in from the blind and you close the action, so you defend wider than you would open.')
    : pick.kind === 'threebet'
      ? t('The wider they open, the further down you can 3-bet for value.')
      : t('The further down you go, the fewer players are left to act behind you. The small blind is the '
        + 'exception, because it acts last now and first for the rest of the hand.');

  return {
    module: 'preflop',
    difficulty,
    scenario: { position: pick.position, positionName: seat },
    question,
    options,
    answer,
    explanation: `${t('{boundary}. Across the seats this runs {across}. ', { boundary: pick.boundary, across })}${tail}`,
    xp: 10 + difficulty * 2,
  };
}
