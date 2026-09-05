/** Shared plumbing for building multiple-choice drills. */

import { shuffle, randInt, pick } from '../core/rng.js';
import { cardsToString } from '../core/cards.js';
// Board reading moved to core so the table's coach grades a continuation bet
// against the same texture the drills do.
export { describeTexture } from '../core/board.js';

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
