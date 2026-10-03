/**
 * Auto-deal: the next hand, dealt for you.
 *
 * At a table you are actually playing, pressing "Deal next hand" after every
 * hand is the dull part of the evening, and a dealer would not wait to be
 * asked. So a real table deals itself once the result has had a moment on
 * screen, and the player keeps a switch for the sittings where they want to
 * study each hand before the next one comes out.
 *
 * Only the rules and the timing live here, free of the DOM so they can be
 * tested; screenTable.js owns the timer and the buttons.
 */

/**
 * How long the result stays up before the next hand, in milliseconds.
 * A hand that ended in a fold is over quickly; a showdown has cards to look
 * at; and with Silas giving his verdict on every decision there is something
 * to read as well, so that adds a little more on top of either.
 */
export const AUTO_DEAL_MS = { quick: 2000, showdown: 3500, coaching: 3000 };

/**
 * On unless the player turned it off. A profile saved before the switch
 * existed has nothing stored for it, and those players get it too: it is the
 * way the table is meant to run, not an option somebody has to find.
 */
export const autoDealEnabled = (settings) => !settings || settings.autoDeal !== false;

/** @param {{showdown?: boolean, coaching?: boolean}} [how] */
export function autoDealDelay({ showdown = false, coaching = false } = {}) {
  return (showdown ? AUTO_DEAL_MS.showdown : AUTO_DEAL_MS.quick) + (coaching ? AUTO_DEAL_MS.coaching : 0);
}

/**
 * Whether a table that has just finished a hand should count down to the
 * next one. Not a lesson table, which is a chapter with a run to finish and
 * a report at the end rather than a game; not once the screen has been left;
 * and not when the player has no chips, where the next move is a rebuy and
 * that is theirs to decide.
 */
export function autoDealReady({ on, lesson = false, cancelled = false, heroBust = false }) {
  return Boolean(on) && !lesson && !cancelled && !heroBust;
}

/**
 * Where a countdown stands.
 *
 * @param {{total: number, started: number}} wait  its length and when it began, in ms
 * @param {number} [now]
 * @returns {{left: number, progress: number, seconds: number}}
 *          what is left in ms, how far along it is (0..1), and the whole
 *          seconds to show: a countdown reads 3, 2, 1 and never 0.
 */
export function countdown(wait, now = Date.now()) {
  const left = Math.max(0, Math.min(wait.total, wait.total - (now - wait.started)));
  return {
    left,
    progress: wait.total > 0 ? 1 - left / wait.total : 1,
    seconds: Math.ceil(left / 1000),
  };
}
