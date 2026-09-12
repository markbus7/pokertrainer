import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import {
  masteryTier, nextTierGoal, promotion, REQUIREMENTS, TIERS, tierRank,
  needCorrect, perfectRunNeeded, tierPlan, MASTERY_WINDOW,
} from '../src/js/state/mastery.js';

const fresh = () => {
  const mem = new Map();
  return new Profile({}, {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  });
};

const drill = (p, id, right, wrong = 0) => {
  for (let i = 0; i < right; i++) p.recordDrill(id, true);
  for (let i = 0; i < wrong; i++) p.recordDrill(id, false);
};

describe('mastery: tiers are earned, not stumbled into', () => {
  it('starts untouched', () => {
    equal(masteryTier(fresh(), 'hand-rankings'), 'untouched');
  });

  it('does NOT award mastery for a handful of lucky answers', () => {
    // The bug this replaces: 5 correct answers used to show "Mastered".
    const p = fresh();
    drill(p, 'hand-rankings', 5);
    p.markWalkthroughComplete('hand-rankings');
    equal(masteryTier(p, 'hand-rankings'), 'learning',
      'five right answers is not mastery, however clean the accuracy looks');
  });

  it('requires real volume and real accuracy for mastery', () => {
    const p = fresh();
    p.markWalkthroughComplete('hand-rankings');
    drill(p, 'hand-rankings', REQUIREMENTS.mastered.window);
    equal(masteryTier(p, 'hand-rankings'), 'mastered');
  });

  it('withholds mastery when accuracy is short, however many attempts', () => {
    const p = fresh();
    p.markWalkthroughComplete('outs');
    drill(p, 'outs', 60, 30); // 90 attempts at 67%
    assert(masteryTier(p, 'outs') !== 'mastered', 'volume alone is not mastery');
  });

  it('withholds mastery until the lesson is done', () => {
    const p = fresh();
    drill(p, 'outs', 40); // plenty of attempts, perfect accuracy, no lesson
    equal(masteryTier(p, 'outs'), 'solid', 'the lesson is part of the requirement');
    p.markWalkthroughComplete('outs');
    equal(masteryTier(p, 'outs'), 'mastered');
  });

  it('reaches solid on the way', () => {
    const p = fresh();
    drill(p, 'outs', 14, 2); // 16 attempts at 87.5%
    equal(masteryTier(p, 'outs'), 'solid');
  });
});

describe('mastery: the goal is always stated', () => {
  it('names what is missing, specifically', () => {
    const p = fresh();
    drill(p, 'outs', 5);
    const goal = nextTierGoal(p, 'outs');
    assert(goal, 'there should be a next goal');
    equal(goal.target, 'solid');
    // Work to do, in answers: five right so far, and the 15-answer window is
    // not full, so the run that gets there is ten.
    assert(goal.missing.some((m) => /10 right answers in a row/.test(m)),
      `should name the shortfall as work to do: ${goal.missing}`);
    assert(goal.requirement.includes('15'), 'should state the requirement');
    equal(goal.run, 10);
  });

  it('names a missing lesson as well as missing volume', () => {
    const p = fresh();
    drill(p, 'outs', 20);
    const goal = nextTierGoal(p, 'outs');
    equal(goal.target, 'mastered');
    assert(goal.missing.some((m) => /lesson/.test(m)), 'the lesson requirement must be visible');
  });

  it('names the shortfall as work to do, not a target to subtract from', () => {
    const p = fresh();
    drill(p, 'outs', 30, 30); // a good run, then thirty misses
    const goal = nextTierGoal(p, 'outs');
    // Twelve, not fifteen: the window is already full, so every right answer
    // pushes a miss out of it. That is the whole point of a window.
    assert(goal.missing.some((m) => /12 right answers in a row/.test(m)),
      `should say what is left to do: ${goal.missing}`);
    assert(!goal.missing.some((m) => /you have/.test(m)),
      'the tile line must not make the reader subtract; the ladder carries the detail');
  });

  it('always says how many right in a row would do it, and it is reachable', () => {
    // The figure that could not be shown before: under lifetime accuracy a
    // module at 40 answers and 75% needed 61 flawless answers for Mastered,
    // and there was no bound at all — the worse your history, the further
    // the bar ran away. A window is bounded by its own length.
    const p = fresh();
    drill(p, 'outs', 2, 60); // about as bad as a record gets
    p.markWalkthroughComplete('outs');
    const goal = nextTierGoal(p, 'outs');
    assert(goal.run > 0, 'there is work to do');
    assert(goal.run <= REQUIREMENTS[goal.target].window,
      `a perfect run of ${goal.run} is longer than the ${REQUIREMENTS[goal.target].window}-answer window`);

    // And it is not a claim: answering that many correctly has to arrive.
    drill(p, 'outs', goal.run);
    equal(masteryTier(p, 'outs'), goal.target, 'the stated run did not get there');
  });

  it('lets a bad start wash out', () => {
    // The complaint this is for: "I do not know how to get Mastered, it
    // feels impossible, even after 90% and then 100%." It was impossible —
    // a first bad session stayed in the average for good.
    const p = fresh();
    drill(p, 'outs', 0, 40);
    equal(masteryTier(p, 'outs'), 'learning');
    p.markWalkthroughComplete('outs');
    drill(p, 'outs', REQUIREMENTS.mastered.window);
    equal(masteryTier(p, 'outs'), 'mastered', 'a clean window has to count for what it is');
  });

  it('reads current form, and does not keep a badge a module has lost', () => {
    const p = fresh();
    p.markWalkthroughComplete('outs');
    drill(p, 'outs', 30);
    equal(masteryTier(p, 'outs'), 'mastered');
    drill(p, 'outs', 0, 30);
    assert(masteryTier(p, 'outs') !== 'mastered',
      'a module you have since fallen apart on cannot keep the badge — nextUp skips Mastered');
  });

  it('honours a tier earned before windows existed, until the window fills', () => {
    // An existing save has totals and no log of how the answers went. Judging
    // it on an empty window would demote everyone on upgrade day.
    const old = { attempts: 40, correct: 38, streak: 0, bestStreak: 5 };
    const p = new Profile({ drills: { outs: { ...old } }, walkthroughs: ['outs'] }, {
      getItem: () => null, setItem: () => {}, removeItem: () => {},
    });
    equal(masteryTier(p, 'outs'), 'mastered', 'what the old rule awarded stands');
    drill(p, 'outs', 0, MASTERY_WINDOW);
    equal(masteryTier(p, 'outs'), 'learning', 'and stops standing once there is a full window to read');
  });

  it('marks where you stand even on a module nobody has opened', () => {
    // Otherwise every rung reads "ahead" and the ladder, whose whole job is
    // saying where you are, marks nothing.
    const plan = tierPlan(fresh(), 'outs');
    equal(plan.filter((r) => r.state === 'here').length, 1);
    equal(plan.find((r) => r.state === 'here').key, 'learning');
  });

  it('reconciles the two figures on a row when they disagree', () => {
    // 11 of 12 beside "3 right in a row" is a contradiction until the row
    // says why: a new answer pushes the oldest out, so a right answer
    // replacing a right answer moves the count nowhere.
    const p = fresh();
    for (let i = 0; i < 22; i++) p.recordDrill('outs', i % 4 !== 0);  // 16/22, spread
    const solid = tierPlan(p, 'outs').find((r) => r.key === 'solid');
    const row = solid.rows[0];
    const gap = row.need - row.have;
    assert(solid.run > gap, `fixture should have a run (${solid.run}) longer than the gap (${gap})`);
    assert(/pushes the oldest out/.test(row.note || ''),
      `the row has to explain the difference: ${row.note}`);
  });

  it('states each rung of the ladder, in order, with where you stand', () => {
    const p = fresh();
    drill(p, 'outs', 9, 3);
    const plan = tierPlan(p, 'outs');
    equal(plan.map((r) => r.key).join(' '), 'learning solid mastered');
    equal(plan.filter((r) => r.state === 'here').length, 1, 'exactly one rung is where you are');

    const solid = plan.find((r) => r.key === 'solid');
    equal(solid.rows.length, 1);
    equal(solid.rows[0].need, needCorrect(REQUIREMENTS.solid));
    equal(solid.rows[0].have, 9);
    assert(solid.rows[0].note, 'a window that is not full yet has to say so');

    const mastered = plan.find((r) => r.key === 'mastered');
    equal(mastered.rows.length, 2, 'the lesson is a requirement of its own');
    assert(mastered.rows.some((row) => /lesson/i.test(row.label)));
    equal(mastered.run, perfectRunNeeded(p, 'outs', REQUIREMENTS.mastered));
  });

  it('stops setting goals once mastered', () => {
    const p = fresh();
    p.markWalkthroughComplete('outs');
    drill(p, 'outs', 40);
    equal(nextTierGoal(p, 'outs'), null);
  });

  it('never reports progress above 1', () => {
    const p = fresh();
    drill(p, 'outs', 100);
    const goal = nextTierGoal(p, 'outs');
    if (goal) assert(goal.progress <= 1.0001, `progress should cap, got ${goal.progress}`);
  });
});

describe('mastery: promotions can be announced', () => {
  it('detects a promotion and ignores standing still', () => {
    assert(promotion('learning', 'solid'), 'moving up is a promotion');
    equal(promotion('solid', 'solid'), null, 'staying put is not');
    equal(promotion('mastered', 'solid'), null, 'a drop is not a promotion');
  });

  it('orders the tiers', () => {
    equal(tierRank('untouched'), 0);
    equal(tierRank('mastered'), TIERS.length - 1);
  });
});
