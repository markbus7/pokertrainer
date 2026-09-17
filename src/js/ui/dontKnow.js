/**
 * "I don't know" — the answer every graded question was missing.
 *
 * Every choice in this app had exactly two ways to leave a question: know
 * it, or guess. A guess that lands right teaches the tracking that you know
 * something you do not; a guess that lands wrong is graded identically to a
 * real misconception. The two feel completely different to the reader and
 * are treated identically by mastery and spaced repetition — which is
 * backwards, and it is what produced this: "zodat ik niet een goede antwoord
 * gok omdat ik wel iets moet kiezen."
 *
 * This does not change scoring. Choosing "I don't know" still counts as a
 * miss — mastery cannot be earned by declining to guess, and a card you do
 * not know should come back sooner, exactly like a card you got wrong. What
 * changes is that nobody is forced to manufacture a guess just because the
 * screen demands a click, and the feedback says plainly that no guess was
 * made rather than pretending one was.
 *
 * Two sentinels rather than one, because the grading in this app falls into
 * two families and a value safe for one is not safe for the other:
 *
 *   IDK is compared with === against a real key, label or band. A Symbol
 *   would do that safely too, but screenTable.js builds a template literal
 *   out of the raw picked value (`${read.picked}%`) to report it back, and a
 *   Symbol throws the moment a template literal tries to coerce it. A string
 *   does not, and stores and JSON-round-trips safely if it is ever touched
 *   by persisted state, so it is the boring, safe choice everywhere a key is
 *   compared.
 *
 *   IDK_NUMBER is compared with a tolerance check after Number(value). Every
 *   one of those checks guards on Number.isFinite(given) first and returns
 *   early — without computing the real answer — when that fails. NaN and
 *   Infinity both fail that guard, which would silence the very thing this
 *   feature exists to reveal. A large, finite, impossible number reaches the
 *   real comparison and gets a real answer back.
 */

import { el } from './dom.js';
import { t } from '../i18n/index.js';

export const IDK = '__idk__';
export const IDK_NUMBER = -999999999;

/** True for either sentinel, so a render branch does not need to know which. */
export const isSkipped = (value) => value === IDK || value === IDK_NUMBER;

/**
 * The button itself. Deliberately not styled like a peer of the real
 * options — it is an exit, not a fifth choice competing with the other
 * four, and a reader should reach for it because they mean it, not because
 * it is the path of least resistance.
 */
export function dontKnowButton(onClick, { block = false } = {}) {
  return el(`button.btn.sm.ghost.idk-btn${block ? '.block' : ''}`, {
    onclick: onClick,
  }, t("I don't know"));
}
