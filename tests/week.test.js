/**
 * Your week: the last seven days against the seven before, and one job.
 */

import { describe, it, assert, equal } from './harness.js';
import { weekReview, WEEK, keepGoal, goalOf, goalProgress, goalTarget, GOAL_PEARLS } from '../src/js/state/week.js';
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
    assert(askFree(p, 'hoe ging mijn week', Math.random, NOW).lines.length >= 1, 'asked in Dutch');
    equal(askFree(p, 'how was my week?', Math.random, NOW).to.route, a.to.route, 'and in English');
  });
});

describe('the job for next week, kept', () => {
  const profile = (reports) => {
    const p = new Profile({}, memory());
    p.data.reports = reports;
    return p;
  };
  const LATER = (days) => NOW + days * DAY;

  it('sets the job from the weakest skill of the week, at the share it stood at', () => {
    const p = profile([sitting(2, { preflop: [2, 5], 'pot-odds': [5, 5] })]);
    const kept = keepGoal(p, p.data.reports, NOW);
    assert(kept.fresh);
    equal(kept.goal.skill, 'preflop');
    equal(goalOf(p).from, 0.4);
    equal(goalTarget(goalOf(p)), 0.55, 'fifteen points better');
    const again = keepGoal(p, p.data.reports, NOW + 1000);
    assert(!again.fresh, 'set once, not again every time it is asked');
  });

  it('calls it done once the skill comes in at the target, and pays once', () => {
    const reports = [sitting(2, { preflop: [2, 5] })];
    const p = profile(reports);
    keepGoal(p, reports, NOW);
    reports.push({ ...sitting(0, { preflop: [4, 5] }), at: LATER(2) });
    const before = p.economy.pearls;
    const kept = keepGoal(p, reports, LATER(3));
    equal(kept.settled, 'met');
    equal(kept.pearls, GOAL_PEARLS);
    equal(p.economy.pearls, before + GOAL_PEARLS);
    equal(keepGoal(p, reports, LATER(3)).pearls, 0, 'not paid twice');
  });

  it('says so when the week runs out without it, and pays nothing', () => {
    const reports = [sitting(2, { preflop: [2, 5] })];
    const p = profile(reports);
    keepGoal(p, reports, NOW);
    reports.push({ ...sitting(0, { preflop: [2, 5] }), at: LATER(2) });
    equal(goalProgress(reports, goalOf(p), LATER(3)).state, 'open', 'still open inside the week');
    const kept = keepGoal(p, reports, LATER(8));
    equal(kept.settled, 'missed');
    equal(kept.pearls, 0);
  });

  it('needs enough decisions before it is called done', () => {
    const reports = [sitting(2, { preflop: [1, 5] })];
    const p = profile(reports);
    keepGoal(p, reports, NOW);
    reports.push({ ...sitting(0, { preflop: [2, 2] }), at: LATER(1) });
    equal(goalProgress(reports, goalOf(p), LATER(2)).state, 'open', 'two right of two is not enough to say');
  });

  it('reads a damaged save as no job', () => {
    const p = profile([]);
    p.data.weekGoal = { skill: 3 };
    equal(goalOf(p), null);
    p.data.weekGoal = 'x';
    equal(goalOf(p), null);
  });

  it('tells you the job in Silas\'s week, and how it went a week later', () => {
    const reports = [sitting(2, { preflop: [2, 5], 'pot-odds': [5, 5] })];
    const p = profile(reports);
    const first = weekAnswer(p, NOW);
    assert(first.lines.some((l) => /job for next week/.test(l.text)), 'the job is set');
    equal(first.to.params.module, 'preflop');
    const mid = weekAnswer(p, LATER(1));
    assert(mid.lines.some((l) => /This week's job/.test(l.text)), 'and followed while it is open');
    reports.push({ ...sitting(0, { preflop: [5, 5] }), at: LATER(3) });
    const done = weekAnswer(p, LATER(4));
    assert(done.lines.some((l) => /job is done/.test(l.text)), 'and called done');
  });
});
