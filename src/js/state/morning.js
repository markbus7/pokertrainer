/**
 * Yesterday's hand.
 *
 * Today's question is three from the chapters, the same for everybody. This
 * is the fourth, and it is yours alone: the newest mistake the Log kept from
 * a day before today and has not seen put right, dealt again as it stood
 * when you acted (retry.js). A night between the mistake and the answer is
 * the point: the hand has to be found again, not remembered from a minute
 * ago.
 *
 * The first answer of the day counts, and a right one pays a few pearls. It
 * cannot be farmed: a hand only gets into the Log from a mistake at a table,
 * once put right it is not asked again, and a second go the same day pays
 * nothing.
 *
 * Free of the DOM and of the clock (the time is passed in), so it can be tested.
 */

import { retryQueue } from './retry.js';
import { dateKey } from './daily.js';

/** What putting yesterday's hand right pays, once a day. */
export const MORNING_PEARLS = 10;

/** Midnight at the start of the reader's own day, in milliseconds. */
export function dayStart(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The hand to ask this morning: the newest kept mistake from before today
 * that is still to be put right, or null when there is none.
 * @param {object[]} [hands]  the Log, oldest first
 */
export function morningHand(now = new Date(), hands) {
  const start = dayStart(now);
  return retryQueue(hands).find((h) => Number.isFinite(h.at) && h.at < start) || null;
}

/** The save: the last day yesterday's hand was answered, always a date key or null. */
export function morningOf(profile) {
  const d = profile.data;
  if (!d.morning || typeof d.morning !== 'object' || Array.isArray(d.morning)) d.morning = {};
  const x = d.morning;
  if (typeof x.last !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.last)) x.last = null;
  return x;
}

export const morningDone = (profile, now = new Date()) => morningOf(profile).last === dateKey(now);

/**
 * This morning's answer. Only the first of the day counts, right or wrong,
 * so three buttons cannot be pressed in turn until one pays. Right pays.
 * @returns {{counted:boolean, pearls:number}}
 */
export function recordMorning(profile, right, now = new Date()) {
  const x = morningOf(profile);
  const key = dateKey(now);
  if (x.last === key) return { counted: false, pearls: 0 };
  x.last = key;
  profile.save();
  return { counted: true, pearls: right ? profile.earnPearls(MORNING_PEARLS) : 0 };
}
