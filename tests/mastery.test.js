import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { masteryTier, nextTierGoal, promotion, REQUIREMENTS, TIERS, tierRank } from '../src/js/state/mastery.js';

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
    drill(p, 'hand-rankings', REQUIREMENTS.mastered.attempts);
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
    assert(goal.missing.some((m) => /more question/.test(m)), `should name the shortfall: ${goal.missing}`);
    assert(goal.requirement.includes('15'), 'should state the requirement');
  });

  it('names a missing lesson as well as missing volume', () => {
    const p = fresh();
    drill(p, 'outs', 20);
    const goal = nextTierGoal(p, 'outs');
    equal(goal.target, 'mastered');
    assert(goal.missing.some((m) => /lesson/.test(m)), 'the lesson requirement must be visible');
  });

  it('names an accuracy shortfall with the current figure', () => {
    const p = fresh();
    drill(p, 'outs', 30, 30); // 50%
    const goal = nextTierGoal(p, 'outs');
    assert(goal.missing.some((m) => /accuracy.*50%/.test(m)), `should show where you are: ${goal.missing}`);
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
