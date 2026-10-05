/**
 * Today's question from the river.
 *
 * One short set — three questions — that is the same for everybody on the
 * same day, drawn from the chapters you own. It is a reason to open the game
 * for five minutes on a day there is no time for a sitting, and the streak is
 * what makes the reason last: each day done in a row is worth a little more.
 *
 * The questions are the drills' own, seeded by the date, so everything that
 * makes a drill honest (graded, recorded, spaced) applies, and a day's set is
 * not re-rolled by reloading.
 *
 * Free of the DOM and of the clock (the date is passed in), so it can be tested.
 */

import { generateQuestion } from '../trainers/index.js';
import { makeRng } from '../core/rng.js';

export const DAILY_LENGTH = 3;
/** Two right of three makes the day a good one. */
export const DAILY_PASS = 2;

/** The date as a key, in the reader's own time: the day they are living in. */
export function dateKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from one date key to another. */
export function daysBetween(a, b) {
  const t = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}

const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Today's three questions: three different chapters among those you own, and
 * a question from each, the same for the same date and the same chapters.
 *
 * @param {string} key        the date key
 * @param {string[]} owned    ids of the drillable chapters you own
 * @param {number} difficulty
 */
export function dailyQuestions(key, owned, difficulty = 3) {
  const rng = makeRng(hash(`daily/${key}`));
  const pool = owned.slice();
  const chosen = [];
  while (chosen.length < DAILY_LENGTH && pool.length) {
    chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  // With fewer chapters than questions, the ones you have are asked again.
  for (let i = 0; chosen.length < DAILY_LENGTH && owned.length; i++) chosen.push(owned[i % owned.length]);
  return chosen.map((id, i) => generateQuestion(id, makeRng(hash(`daily/${key}/${i}/${id}`)), difficulty));
}

/** The save: the last day done, the streak, the best, always numbers and a string. */
export function dailyOf(profile) {
  const d = profile.data;
  if (!d.daily || typeof d.daily !== 'object') d.daily = {};
  const x = d.daily;
  if (typeof x.last !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.last)) x.last = null;
  x.streak = Number.isFinite(x.streak) && x.streak > 0 ? Math.round(x.streak) : 0;
  x.best = Math.max(x.streak, Number.isFinite(x.best) && x.best > 0 ? Math.round(x.best) : 0);
  x.days = Number.isFinite(x.days) && x.days > 0 ? Math.round(x.days) : 0;
  x.correct = Number.isFinite(x.correct) && x.correct >= 0 ? Math.min(DAILY_LENGTH, Math.round(x.correct)) : 0;
  return x;
}

export const doneToday = (profile, key) => dailyOf(profile).last === key;

/**
 * What the streak is today, as it would read without doing anything: kept if
 * yesterday was done, broken if it was longer ago. Today done counts today.
 */
export function liveStreak(profile, key) {
  const x = dailyOf(profile);
  if (!x.last) return 0;
  const gap = daysBetween(x.last, key);
  return gap <= 1 ? x.streak : 0;
}

/** What a day pays: a base for turning up, a little for each right answer, and a bit more for each day running (a week caps it). */
export const dailyReward = ({ correct, streak }) => 10 + correct * 8 + Math.min(7, streak) * 5;

/**
 * Finish today's set. Once a day: a second go the same day is practice and
 * pays nothing. Returns whether it counted, and what it did to the streak.
 */
export function recordDaily(profile, key, { correct }) {
  const x = dailyOf(profile);
  if (x.last === key) return { counted: false, streak: x.streak, best: x.best, reward: 0 };
  const gap = x.last ? daysBetween(x.last, key) : Infinity;
  x.streak = gap === 1 ? x.streak + 1 : 1;
  x.best = Math.max(x.best, x.streak);
  x.days += 1;
  x.last = key;
  x.correct = correct;
  const reward = dailyReward({ correct, streak: x.streak });
  profile.save();
  return { counted: true, streak: x.streak, best: x.best, reward };
}
