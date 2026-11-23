/**
 * The Log, sorted.
 *
 * Forty kept mistakes are a long page to scroll, and a list in the order the
 * hands were played hides the one thing it could say out loud: where the
 * money goes. This reads the kept hands by the street their costliest
 * mistake was made on, so the Log can show one street at a time, put the
 * dearest hands first, and name the street that costs the most.
 *
 * Nothing here is stored. It is all read off the hands as they are graded
 * now (reviewOf), like everything else in the Log.
 */

import { reviewOf } from './handHistory.js';
import { isFixed } from './retry.js';

export const STREETS = ['preflop', 'flop', 'turn', 'river'];

/** What the Log can be narrowed to: everything, a street, the coolers, or the mistakes not yet put right. */
export const LOG_FILTERS = ['all', ...STREETS, 'open', 'cooler'];

/** Mistakes on a street before it is called the one that costs you most. */
export const LEAK_SAMPLE = 2;

function matches(hand, review, filter) {
  if (filter === 'all') return true;
  if (filter === 'cooler') return review.kind === 'cooler';
  if (review.kind !== 'mistake') return false;
  if (filter === 'open') return !isFixed(hand);
  return review.street === filter;
}

/** The hands a filter keeps, in the order they came in. An unknown filter keeps them all. */
export function filterHands(hands, filter = 'all', review = reviewOf) {
  const key = LOG_FILTERS.includes(filter) ? filter : 'all';
  return (Array.isArray(hands) ? hands : []).filter((h) => matches(h, review(h), key));
}

/** How many hands each filter would show. */
export function filterCounts(hands, review = reviewOf) {
  const list = Array.isArray(hands) ? hands : [];
  const reviews = list.map((h) => [h, review(h)]);
  const out = {};
  for (const key of LOG_FILTERS) out[key] = reviews.filter(([h, r]) => matches(h, r, key)).length;
  return out;
}

/** A mistake's price for sorting: a priced one above an unpriced one, a cooler below both. */
function weight(review) {
  if (review.kind !== 'mistake') return -1;
  return review.costKnown === false ? 0 : Math.max(0, review.costBb) + 1;
}

/**
 * The same hands in the order asked for: `new` leaves them as they came
 * (newest first), `cost` puts the dearest mistake first and keeps the order
 * they came in between equals.
 */
export function sortHands(hands, order = 'new', review = reviewOf) {
  const list = (Array.isArray(hands) ? hands : []).slice();
  if (order !== 'cost') return list;
  return list
    .map((hand, i) => ({ hand, i, w: weight(review(hand)) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((row) => row.hand);
}

/**
 * Where the money goes: the kept mistakes by street.
 * @returns {{rows:{street:string, hands:number, costBb:number, share:number}[], total:number,
 *   worst:{street:string, hands:number, costBb:number, share:number}|null}}
 *   `share` is the street's part of the whole cost; `worst` is the dearest
 *   street, named only once it has LEAK_SAMPLE mistakes and costs more than any other.
 */
export function leakByStreet(hands, review = reviewOf) {
  const rows = STREETS.map((street) => ({ street, hands: 0, costBb: 0, share: 0 }));
  for (const hand of Array.isArray(hands) ? hands : []) {
    const r = review(hand);
    if (r.kind !== 'mistake') continue;
    const row = rows.find((x) => x.street === r.street);
    if (!row) continue;
    row.hands += 1;
    if (r.costKnown !== false && Number.isFinite(r.costBb)) row.costBb += Math.max(0, r.costBb);
  }
  const total = rows.reduce((sum, row) => sum + row.costBb, 0);
  for (const row of rows) {
    row.costBb = Math.round(row.costBb * 10) / 10;
    row.share = total > 0 ? row.costBb / total : 0;
  }
  const ranked = rows.filter((row) => row.hands >= LEAK_SAMPLE && row.costBb > 0).sort((a, b) => b.costBb - a.costBb);
  const top = ranked[0] || null;
  const tied = top && rows.some((row) => row !== top && row.costBb >= top.costBb);
  return { rows, total: Math.round(total * 10) / 10, worst: top && !tied ? top : null };
}
