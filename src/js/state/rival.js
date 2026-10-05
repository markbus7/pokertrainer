/**
 * What the Rival remembers.
 *
 * The practice table's regulars have a short memory: one sitting, then they
 * forget who you were. The Rival keeps hers in the save, so her read on you
 * is built over a whole career rather than a night — and so a leak you were
 * getting away with is eventually found.
 *
 * What she tallies is the same thing the tables' regulars do (engine/adapt):
 * how often you fold when somebody bets. The difference is only that it lasts.
 * The tally is capped, because a person who folded constantly last month and
 * calls down everything now should be believed about now: past the cap the
 * oldest half is let go.
 *
 * Free of the DOM, so it can be tested.
 */

import { watch, foldRate, EVIDENCE, NEUTRAL_FOLD, emptyMemory } from '../engine/adapt.js';

/** How many bets she keeps count of before the oldest are let go. */
export const MEMORY_CAP = 120;

/** Within this of an even fold rate, she has nothing to work with. */
export const EVEN_BAND = 0.1;

export { emptyMemory };

/** A memory read back from a save: only numbers, and never negative. */
export function sanitize(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const num = (x) => (Number.isFinite(x) && x > 0 ? Math.round(x) : 0);
  const facedBet = num(m.facedBet);
  return { facedBet, folded: Math.min(num(m.folded), facedBet) };
}

/**
 * One of the reader's decisions, as she saw it. Mutates the memory (it lives
 * in the save) and halves it when it passes the cap.
 */
export function remember(memory, decision) {
  watch(memory, decision);
  if (memory.facedBet > MEMORY_CAP) {
    memory.facedBet = Math.round(memory.facedBet / 2);
    memory.folded = Math.round(memory.folded / 2);
  }
  return memory;
}

/**
 * What she would say about you, for the stop screen and Silas's notes:
 * `kind` is one of watching, folds, calls and even, and `pct` and `n` are
 * the fold rate and the number of bets it is built on.
 */
export function readOn(memory) {
  const n = memory ? memory.facedBet : 0;
  const rate = foldRate(memory);
  if (rate === null) return { kind: 'watching', n, pct: null };
  const pct = Math.round(rate * 100);
  if (rate > NEUTRAL_FOLD + EVEN_BAND) return { kind: 'folds', n, pct };
  if (rate < NEUTRAL_FOLD - EVEN_BAND) return { kind: 'calls', n, pct };
  return { kind: 'even', n, pct };
}

export { EVIDENCE };
