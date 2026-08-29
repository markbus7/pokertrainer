/** Shared plumbing for building multiple-choice drills. */

import { shuffle, randInt, pick } from '../core/rng.js';
import { cardsToString } from '../core/cards.js';

/** Build shuffled options with a known-correct key. */
export function buildChoices(rng, correctLabel, distractorLabels, extra = {}) {
  const unique = [];
  for (const label of [correctLabel, ...distractorLabels]) {
    if (!unique.includes(label)) unique.push(label);
  }
  const options = unique.map((label, i) => ({ key: `o${i}`, label, ...(extra[label] || {}) }));
  const answer = options.find((o) => o.label === correctLabel).key;
  shuffle(rng, options);
  return { options, answer };
}

/** Numeric distractors around a true value, never colliding with it. */
export function numericDistractors(rng, value, { spread = 4, count = 3, min = 0, max = Infinity, step = 1 } = {}) {
  const out = new Set();
  let guard = 0;
  while (out.size < count && guard++ < 60) {
    const delta = (randInt(rng, spread) + 1) * step * (rng() < 0.5 ? -1 : 1);
    const candidate = Math.round((value + delta) / step) * step;
    if (candidate !== value && candidate >= min && candidate <= max) out.add(candidate);
  }
  return [...out];
}

/**
 * Percentage distractors, kept inside 1..99 and at least `minGap` points from
 * the true answer — otherwise two options are both defensible and the drill
 * punishes a student who did the arithmetic right.
 */
export function percentDistractors(rng, truePct, count = 3, spread = 12, minGap = 5) {
  const out = new Set();
  let guard = 0;
  while (out.size < count && guard++ < 120) {
    const delta = minGap + randInt(rng, spread);
    const candidate = truePct + (rng() < 0.5 ? -delta : delta);
    if (candidate >= 2 && candidate <= 97 && Math.abs(candidate - truePct) >= minGap
        && ![...out].some((x) => Math.abs(x - candidate) < minGap)) {
      out.add(candidate);
    }
  }
  return [...out];
}

/** Retry a generator until it produces a usable spot. */
export function attempt(fn, tries = 400) {
  for (let i = 0; i < tries; i++) {
    const result = fn();
    if (result) return result;
  }
  return null;
}

export const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const chips = (n) => `${Math.round(n)}`;
export const cardText = cardsToString;
export { pick, randInt, shuffle };

/** Random board texture description, for coaching language. */
export function describeTexture(board) {
  const ranks = board.map((c) => (c >> 2) + 2);
  const suits = board.map((c) => c & 3);
  const suitCounts = [0, 0, 0, 0];
  for (const s of suits) suitCounts[s]++;
  const maxSuit = Math.max(...suitCounts);
  const sorted = [...new Set(ranks)].sort((a, b) => b - a);
  const paired = ranks.length !== new Set(ranks).size;
  const connected = sorted.length >= 2 && (sorted[0] - sorted[sorted.length - 1]) <= 4;
  const highCard = Math.max(...ranks);

  const tags = [];
  if (maxSuit >= 3) tags.push('monotone');
  else if (maxSuit === 2) tags.push('two-tone');
  else tags.push('rainbow');
  if (paired) tags.push('paired');
  if (connected) tags.push('connected');
  if (highCard >= 13) tags.push('ace/king-high');
  else if (highCard <= 9) tags.push('low');

  const wet = (maxSuit >= 2 ? 1 : 0) + (connected ? 1 : 0) + (highCard <= 11 ? 1 : 0);
  return { tags, wet: wet >= 2, dry: wet === 0, paired, monotone: maxSuit >= 3, twoTone: maxSuit === 2, highCard };
}
