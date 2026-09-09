/**
 * Naming a preflop all-in by its shape.
 *
 * There are 169 starting hands, so 14,196 possible matchups. Nobody memorises
 * that, and nobody needs to: almost every preflop all-in falls into one of six
 * shapes, and each shape has a number that barely moves inside it. Learn the
 * six and you can price a spot you have never seen.
 *
 * Every figure here was measured with this app's own equity engine over
 * 60,000 sampled matchups; `tests/matchup.test.js` recomputes them and fails
 * if a taught number drifts from what the engine actually produces.
 */

import { randInt } from './rng.js';

const rankOf = (card) => (card >> 2) + 2;
const ranks = (hand) => hand.map(rankOf).sort((a, b) => b - a);

/**
 * The six shapes, each with the figure the favourite wins.
 *
 * `typical` is what to remember; `spread` is the middle 90% of the shape as
 * the drill actually deals it, so a fifth of instances sit outside it. Both
 * are published because a rule of thumb quoted without its width gets
 * remembered as a law.
 */
export const MATCHUPS = Object.freeze({
  'pair-vs-unders': {
    id: 'pair-vs-unders',
    label: 'a pair against two lower cards',
    typical: 0.84,
    spread: [0.79, 0.88],
    why: 'They have to catch a card to beat you, and their pair would still be smaller than yours.',
  },
  'pair-over-pair': {
    id: 'pair-over-pair',
    label: 'the bigger pair against the smaller pair',
    typical: 0.81,
    spread: [0.80, 0.83],
    why: 'The small pair needs its own third card: about one time in five.',
  },
  'pair-vs-split': {
    id: 'pair-vs-split',
    label: 'a pair against one higher and one lower card',
    typical: 0.69,
    spread: [0.65, 0.73],
    why: 'Only their higher card really threatens you, so they have half the outs of a coinflip.',
  },
  domination: {
    id: 'domination',
    label: 'the same top card with a better kicker',
    typical: 0.71,
    spread: [0.62, 0.76],
    why: 'When their card pairs, yours pairs too — and yours plays the better kicker. This is the shape that costs the most money, because it looks like a win right up until showdown.',
  },
  'overs-vs-unders': {
    id: 'overs-vs-unders',
    label: 'two higher cards against two lower cards',
    typical: 0.65,
    spread: [0.60, 0.69],
    why: 'Pair either card and you are ahead; they have to pair first to get there.',
  },
  'pair-vs-overs': {
    id: 'pair-vs-overs',
    label: 'a pair against two higher cards',
    typical: 0.53,
    spread: [0.49, 0.57],
    why: 'The famous coinflip. You are ahead now, they have six cards to catch — it comes out close to even, and suited or connected overcards close it further.',
  },
  'same-pair': {
    id: 'same-pair',
    label: 'the same pair on both sides',
    typical: 0.50,
    spread: [0.48, 0.52],
    why: 'Neither of you can pull ahead unless the board runs out four to a flush or a straight. Mostly a split pot.',
  },
});

/** The numbers worth carrying to a table, coarsest first. */
export const ANCHORS = Object.freeze(['pair-vs-overs', 'overs-vs-unders', 'domination', 'pair-over-pair', 'pair-vs-unders']);

/**
 * Which shape two hands make, and which side the figure belongs to.
 * @returns {{shape: object, favourite: 0|1}|null} null when the two hands
 *   make no shape worth naming (two unpaired hands sharing both ranks, say).
 */
export function matchupOf(handA, handB) {
  const a = ranks(handA);
  const b = ranks(handB);
  const aPair = a[0] === a[1];
  const bPair = b[0] === b[1];
  const shape = (id, favourite) => ({ shape: MATCHUPS[id], favourite });

  if (aPair && bPair) {
    // Two players can hold the same pair — four distinct cards, one rank.
    if (a[0] === b[0]) return shape('same-pair', 0);
    return shape('pair-over-pair', a[0] > b[0] ? 0 : 1);
  }

  if (aPair !== bPair) {
    const pairSide = aPair ? 0 : 1;
    const pair = aPair ? a : b;
    const other = aPair ? b : a;
    if (other[1] > pair[0]) return shape('pair-vs-overs', pairSide);
    if (other[0] < pair[0]) return shape('pair-vs-unders', pairSide);
    return shape('pair-vs-split', pairSide);
  }

  const shared = a.filter((r) => b.includes(r));
  if (shared.length === 1) {
    const aKicker = a.find((r) => r !== shared[0]);
    const bKicker = b.find((r) => r !== shared[0]);
    if (aKicker === bKicker) return null;         // same ranks, different suits
    return shape('domination', aKicker > bKicker ? 0 : 1);
  }
  if (shared.length === 0) {
    if (a[1] > b[0]) return shape('overs-vs-unders', 0);
    if (b[1] > a[0]) return shape('overs-vs-unders', 1);
  }
  return null;                                     // interleaved, e.g. K8 vs Q9
}

/** Every shape worth drilling. A pair against the same pair is a split. */
export const DRILLABLE_SHAPES = Object.keys(MATCHUPS).filter((id) => id !== 'same-pair');

/**
 * Two hands that make a chosen shape, built rather than searched for.
 * Returns null if the draw collides on a card, which the caller retries.
 */
export function buildMatchup(rng, shapeId) {
  const RANKS = [...Array(13).keys()].map((i) => i + 2);       // 2..14
  const pickRank = (from) => from[randInt(rng, from.length)];
  const card = (rank, suit) => ((rank - 2) << 2) | suit;
  const pair = (rank) => {
    const s1 = randInt(rng, 4);
    let s2 = randInt(rng, 4);
    while (s2 === s1) s2 = randInt(rng, 4);
    return [card(rank, s1), card(rank, s2)];
  };
  // Two different ranks, suited or not — suits chosen so the two hands never
  // share a card.
  const two = (hi, lo, suited) => (suited
    ? (() => { const s = randInt(rng, 4); return [card(hi, s), card(lo, s)]; })()
    : (() => {
      const s1 = randInt(rng, 4);
      let s2 = randInt(rng, 4);
      while (s2 === s1) s2 = randInt(rng, 4);
      return [card(hi, s1), card(lo, s2)];
    })());
  const coin = () => randInt(rng, 2) === 0;

  let a;
  let b;
  if (shapeId === 'pair-over-pair') {
    const hi = pickRank(RANKS.slice(1));
    const lo = pickRank(RANKS.filter((r) => r < hi));
    a = pair(hi); b = pair(lo);
  } else if (shapeId === 'pair-vs-overs') {
    const p = pickRank(RANKS.filter((r) => r <= 12));
    const overs = RANKS.filter((r) => r > p);
    if (overs.length < 2) return null;
    const hi = pickRank(overs);
    const lo = pickRank(overs.filter((r) => r !== hi));
    a = pair(p); b = two(Math.max(hi, lo), Math.min(hi, lo), coin());
  } else if (shapeId === 'pair-vs-unders') {
    const p = pickRank(RANKS.filter((r) => r >= 4));
    const unders = RANKS.filter((r) => r < p);
    if (unders.length < 2) return null;
    const hi = pickRank(unders);
    const lo = pickRank(unders.filter((r) => r !== hi));
    a = pair(p); b = two(Math.max(hi, lo), Math.min(hi, lo), coin());
  } else if (shapeId === 'pair-vs-split') {
    const p = pickRank(RANKS.slice(1, 12));
    const over = pickRank(RANKS.filter((r) => r > p));
    const under = pickRank(RANKS.filter((r) => r < p));
    a = pair(p); b = two(over, under, coin());
  } else if (shapeId === 'domination') {
    const shared = pickRank(RANKS.slice(2));
    const rest = RANKS.filter((r) => r !== shared);
    const k1 = pickRank(rest);
    // A meaningful kicker gap: A-K against A-Q teaches the shape, A-5
    // against A-4 is a coin toss wearing its clothes.
    const far = rest.filter((r) => Math.abs(r - k1) >= 3);
    if (!far.length) return null;
    const k2 = pickRank(far);
    const suits = shuffleSuits(rng);
    a = [card(shared, suits[0]), card(k1, suits[1])];
    b = [card(shared, suits[2]), card(k2, suits[3] === suits[2] ? (suits[3] + 1) % 4 : suits[3])];
  } else if (shapeId === 'overs-vs-unders') {
    const picked = [];
    while (picked.length < 4) {
      const r = pickRank(RANKS);
      if (!picked.includes(r)) picked.push(r);
    }
    picked.sort((x, y) => y - x);
    a = two(picked[0], picked[1], coin());
    b = two(picked[2], picked[3], coin());
  } else {
    return null;
  }
  if (!a || !b) return null;
  return new Set([...a, ...b]).size === 4 ? [a, b] : null;
}

/** Four suits in random order, so built hands do not always share suits. */
function shuffleSuits(rng) {
  const s = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
  }
  return s;
}
