/** Shared plumbing for building multiple-choice drills. */

import { shuffle, randInt, pick } from '../core/rng.js';
import { cardsToString } from '../core/cards.js';
import { t } from '../i18n/index.js';
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
  // Four percentages in random order have to be read one at a time. In
  // ascending order they are a scale, and picking a place on a scale is the
  // thing the question is actually asking for. `sorted` may be a comparator
  // when the labels are not numbers.
  if (typeof extra.sorted === 'function') options.sort((a, b) => extra.sorted(a.label, b.label));
  else if (extra.sorted) options.sort((a, b) => parseFloat(a.label) - parseFloat(b.label));
  else shuffle(rng, options);
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
 *
 * How many land below the true value is decided first, and the rest walk
 * outward from there. Picking each one's side independently cannot produce a
 * one-sided spread — three values `minGap` apart do not fit in a band of
 * `spread` — so the answer was never the highest or lowest option, and could
 * be found by crossing off both ends without knowing any poker.
 */
export function percentDistractors(rng, truePct, count = 3, spread = 12, minGap = 5) {
  const chosen = [];
  // Each side grows outward from its own furthest value, so every step of at
  // least `minGap` also keeps that distance from everything already placed.
  const edgeOf = (direction) => chosen.reduce(
    (acc, v) => (direction > 0 ? Math.max(acc, v) : Math.min(acc, v)), truePct,
  );

  const walk = (direction, howMany) => {
    let cursor = edgeOf(direction);
    let placed = 0;
    for (let i = 0; i < howMany; i++) {
      const room = direction > 0 ? 97 - cursor : cursor - 2;
      if (room < minGap) break;
      // Near the ends of the scale, take shorter steps rather than
      // overshooting and dropping the value: a side that quietly comes up
      // short moves the answer's place in a sorted list.
      cursor += direction * (minGap + randInt(rng, Math.max(1, Math.min(spread, room - minGap + 1))));
      chosen.push(cursor);
      placed++;
    }
    return placed;
  };

  const below = randInt(rng, count + 1);
  let got = walk(-1, below) + walk(1, count - below);
  if (got < count) got += walk(-1, count - got);
  if (got < count) walk(1, count - got);
  return chosen.slice(0, count);
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

/**
 * The same price, the way you would actually reach it at a table.
 *
 * Every worked example in this app used to divide — and dividing by 55 is
 * not something anyone does mid-hand. The lesson teaches counting the final
 * pot in calls and the price ladder; the explanations modelled neither, so
 * the method being taught was never the method being demonstrated.
 */
export function tableMethod(pot, bet) {
  const times = pot / bet;
  const calls = times + 2;
  const neat = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ''));
  const approx = Math.round((1 / calls) * 100);

  // Name the rung when the bet is close to a standard size, because that is
  // the other shortcut this app drills and they are the same fact twice.
  const fraction = bet / pot;
  const rung = fraction <= 0.3 ? null
    : fraction <= 0.42 ? t('a third-pot bet')
      : fraction <= 0.62 ? t('a half-pot bet')
        : fraction <= 0.85 ? t('a three-quarter-pot bet')
          : fraction <= 1.15 ? t('a pot-sized bet') : null;

  const counted = t('At a table you would not divide: {bet} goes into {pot} {times} times, plus one for their '
    + 'bet and one for yours makes {calls}, and you are putting in one of them — about {approx}%.',
  { bet, pot, times: neat(times), calls: neat(calls), approx });

  return rung ? `${counted} ${t('That is {rung}.', { rung })}` : counted;
}

