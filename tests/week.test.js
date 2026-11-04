/**
 * Your week: the last seven days against the seven before, and one job.
 */

import { describe, it, assert, equal } from './harness.js';
import { weekReview, WEEK } from '../src/js/state/week.js';
import { Profile } from '../src/js/state/profile.js';
import { weekAnswer, askFree } from '../src/js/ui/guide.js';

const NOW = Date.parse('2026-11-03T20:00:00Z');
const DAY = WEEK / 7;
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

/** A sitting `days` ago, with `skills` as {skill: [right, total]}. */
function sitting(days, skills, worst = []) {
  const bySkill = {};
  let total = 0;
  let sound = 0;
  for (const [k, [right, n]] of Object.entries(skills)) { bySkill[k] = { right, total: n }; total += n; sound += right; }
  return { at: NOW - days * DAY, hands: 40, profitBb: 5, decisions: { total, sound, helped: 0, bySkill }, worst: worst.map((head) => ({ head })) };
}

describe('your week', () => {
  it('counts only the last seven days, and compares them with the seven before', () => {
    const reports = [
      sitting(20, { 'pot-odds': [0, 10] }),           // too old for either week
      sitting(10, { 'pot-odds': [3, 8], preflop: [4, 4] }),
      sitting(2, { 'pot-odds': [7, 8], preflop: [2, 4] }),
      sitting(1, { 'pot-odds': [1, 1] }),
    ];
    const w = weekReview(reports, NOW);
    assert(w.ready);
    equal(w.sittings, 2);
    equal(w.hands, 80);
    equal(w.decisions, 13);
    equal(w.sound, 10);
    equal(Math.round(w.change * 100), Math.round((10 / 13 - 7 / 12) * 100), 'against the week before');
    equal(w.better.skill, 'pot-odds', 'pot odds came on, from 3 in 8 to 8 in 9');
    equal(w.weakest.skill, 'preflop', 'and preflop fell back: the job for next week');
  });

  it('says nothing about a week without sittings, and compares nothing on too few decisions', () => {
    equal(weekReview([sitting(9, { preflop: [1, 4] })], NOW).ready, false);
    equal(weekReview([], NOW).ready, false);
    const w = weekReview([sitting(9, { preflop: [1, 2] }), sitting(1, { preflop: [2, 2] })], NOW);
    equal(w.change, null, 'two decisions is not a week to compare');
    equal(w.better, null);
  });

  it('names a mistake that was among the costliest of more than one sitting', () => {
    const w = weekReview([
      sitting(3, { preflop: [3, 4] }, ['Called without the odds', 'Outside the range']),
      sitting(1, { preflop: [3, 4] }, ['Called without the odds']),
    ], NOW);
    equal(w.repeated.head, 'Called without the odds');
    equal(w.repeated.times, 2);
    equal(weekReview([sitting(1, { preflop: [3, 4] }, ['Outside the range'])], NOW).repeated, null, 'once is a hand, not a habit');
  });

  it('is something you can ask Silas, who sends you to the chapter to study', () => {
    const p = new Profile({}, memory());
    equal(weekAnswer(p, NOW).lines.length, 1, 'no sittings: one line, and the river');
    p.data.reports = [sitting(2, { 'pot-odds': [1, 5] })];
    const a = weekAnswer(p, NOW);
    equal(a.to.route, 'learn');
    equal(a.to.params.module, 'pot-odds');
    assert(askFree(p, 'hoe ging mijn week').lines.length >= 1, 'asked in Dutch');
    equal(askFree(p, 'how was my week?').to.route, a.to.route, 'and in English');
  });
});
