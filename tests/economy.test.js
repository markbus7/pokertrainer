import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import {
  CATALOGUE, COMPANIONS, LESSON_PRICES, EARN, handPearls, decisionPearls, itemByKey, itemState,
  purchase, ownsLesson, ownedModules, nextPurchase, missingFor,
} from '../src/js/state/economy.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { buildReport, strongestAndWeakest, keepReport, reportsOf, KEEP_REPORTS } from '../src/js/state/sessionReport.js';
import { SessionStats } from '../src/js/state/stats.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const fresh = (data = {}) => new Profile(data, memory());

describe('economy: a new purse owns the first chapter and nothing else', () => {
  it('starts with no pearls and only Hand Rankings', () => {
    const p = fresh();
    equal(p.pearls, 0);
    assert(ownsLesson(p, 'hand-rankings'), 'the first chapter is not free');
    for (const m of MODULE_META.filter((x) => x.id !== 'hand-rankings')) {
      assert(!ownsLesson(p, m.id), `${m.id} is owned before anything was bought`);
    }
    equal(ownedModules(p).map((m) => m.id).join(','), 'hand-rankings');
  });

  it('prices every chapter but the first, and lists each one on the shelf once', () => {
    for (const m of MODULE_META) assert(m.id in LESSON_PRICES, `${m.id} has no price`);
    const keys = CATALOGUE.map((i) => i.key);
    equal(new Set(keys).size, keys.length, 'the same thing is on the shelf twice');
    assert(!keys.includes('lesson:hand-rankings'), 'the free chapter is for sale');
  });
});

describe('economy: a save from before pearls loses what can be bought and keeps what was earned', () => {
  it('re-locks chapters but keeps XP, lessons finished, drills, charts progress and the bankroll', () => {
    const old = {
      xp: 2400,
      walkthroughs: ['hand-rankings', 'pot-odds'],
      drills: { 'pot-odds': { attempts: 30, correct: 27, streak: 3, bestStreak: 9, recent: '1'.repeat(30) } },
      ranges: { 'open:BTN': { stage: 2, cleared: false, runs: 3, peeks: 0 } },
      bankroll: 740,
      handsPlayed: 300,
    };
    const p = fresh(old);
    equal(p.xp, 2400);
    equal(p.data.walkthroughs.length, 2);
    equal(p.drillStats('pot-odds').attempts, 30);
    equal(p.rangeProgress('open:BTN').stage, 2);
    equal(p.data.bankroll, 740);
    equal(p.pearls, 0);
    assert(!ownsLesson(p, 'pot-odds'), 'a chapter from before survived the change');
  });

  it('does the reset once: a bought chapter survives a reload', () => {
    const store = memory();
    const p = new Profile({}, store);
    p.earnPearls(100);
    assert(purchase(p, 'lesson:pot-odds').ok);
    const again = Profile.load(store);
    assert(ownsLesson(again, 'pot-odds'), 'the purchase was undone on reload');
    equal(again.pearls, 40);
  });
});

describe('economy: buying', () => {
  it('refuses on credit, refuses twice, and refuses what the rank does not allow', () => {
    const p = fresh();
    equal(purchase(p, 'lesson:pot-odds').reason, 'short');
    p.earnPearls(500);
    assert(purchase(p, 'lesson:pot-odds').ok);
    equal(purchase(p, 'lesson:pot-odds').reason, 'owned');
    // Outs opens at rank 2; a new profile is rank 1.
    equal(purchase(p, 'lesson:outs').reason, 'locked');
    equal(p.pearls, 500 - LESSON_PRICES['pot-odds']);
  });

  it('asks for the chapter before its charts, and for the lesson finished before its companion', () => {
    const p = fresh();
    p.earnPearls(1000);
    equal(purchase(p, 'chart:open:BTN').reason, 'locked');
    const owl = itemByKey('pet:owl');
    const missing = missingFor(p, owl);
    equal(missing.length, 1);
    equal(missing[0].key, 'lesson');
    p.markWalkthroughComplete('pot-odds');
    assert(itemState(p, owl).ready, 'finishing the lesson did not put the owl within reach');
    assert(purchase(p, 'pet:owl').ok);
  });

  it('gives every companion a chapter it depends on, or a count of them', () => {
    for (const c of COMPANIONS) {
      const needs = c.needs || {};
      assert(needs.lesson || needs.lessons, `${c.key} can be bought without learning anything`);
      if (needs.lesson) assert(MODULE_META.some((m) => m.id === needs.lesson), `${c.key} needs a lesson that does not exist`);
    }
  });

  it('names the cheapest chapter the rank already allows as the next thing to play for', () => {
    const p = fresh();
    equal(nextPurchase(p).item.key, 'lesson:pot-odds');
    p.earnPearls(60);
    purchase(p, 'lesson:pot-odds');
    // Nothing else is open at rank 1.
    equal(nextPurchase(p), null);
  });
});

describe('economy: what the tables pay', () => {
  it('pays more per hand further down the river', () => {
    equal(handPearls(null), 1);
    equal(handPearls(0), 1);
    assert(handPearls(7) > handPearls(0), 'the delta pays no more than the landing');
    for (let i = 1; i < 8; i++) assert(handPearls(i) >= handPearls(i - 1), `stop ${i} pays less than the one before it`);
  });

  it('pays for sound decisions only, never for a preflop fold or a decision somebody helped with', () => {
    equal(decisionPearls({ level: 'good', street: 'flop', action: 'call' }), EARN.sound);
    equal(decisionPearls({ level: 'bad', street: 'flop', action: 'call' }), 0);
    equal(decisionPearls({ level: 'ok', street: 'river', action: 'call' }), 0);
    equal(decisionPearls({ level: 'good', street: 'preflop', action: 'fold' }), 0);
    equal(decisionPearls({ level: 'good', street: 'preflop', action: 'raise' }), EARN.sound);
    equal(decisionPearls({ level: 'good', street: 'turn', action: 'bet', helped: true }), 0);
  });

  it('never lets the purse go below zero or take a negative payment', () => {
    const p = fresh();
    equal(p.earnPearls(-5), 0);
    equal(p.pearls, 0);
    assert(!p.buy('lesson:outs', -10), 'a negative price was accepted');
  });
});

describe('the session report: Silas\'s notes on one sitting', () => {
  const stats = new SessionStats();
  const graded = [
    { skill: 'pot-odds', level: 'good', street: 'flop', action: 'call', helped: false, head: 'A', costBb: 0 },
    { skill: 'pot-odds', level: 'good', street: 'turn', action: 'call', helped: false, head: 'B', costBb: 0 },
    { skill: 'pot-odds', level: 'bad', street: 'river', action: 'call', helped: false, head: 'Called without the odds', costBb: 6.5 },
    { skill: 'preflop', level: 'bad', street: 'preflop', action: 'call', helped: false, head: 'Limping gives the pot away', costBb: 0 },
    { skill: 'preflop', level: 'bad', street: 'preflop', action: 'raise', helped: false, head: 'Outside the range', costBb: 0 },
    { skill: 'preflop', level: 'good', street: 'preflop', action: 'raise', helped: true, head: 'helped', costBb: 0 },
  ];
  const report = buildReport({
    place: { kind: 'practice', key: 'practice', name: 'Silas\'s practice table' },
    stats,
    graded,
    pearls: { hands: 12, decisions: 2, bonus: 0 },
  });

  it('leaves helped decisions out of the judgement, and counts them apart', () => {
    equal(report.decisions.total, 5);
    equal(report.decisions.helped, 1);
    equal(report.decisions.sound, 2);
    equal(report.decisions.bySkill.preflop.total, 2);
  });

  it('names the strongest and weakest skill, and puts the costliest mistake first', () => {
    const { strongest, weakest } = strongestAndWeakest(report);
    equal(strongest.skill, 'pot-odds');
    equal(weakest.skill, 'preflop');
    equal(report.worst[0].head, 'Called without the odds');
    equal(report.pearls.total, 14);
  });

  it('keeps only the most recent sittings', () => {
    const p = fresh();
    for (let i = 0; i < KEEP_REPORTS + 5; i++) keepReport(p, { ...report, at: i });
    equal(reportsOf(p).length, KEEP_REPORTS);
    equal(reportsOf(p)[0].at, 5);
  });
});
