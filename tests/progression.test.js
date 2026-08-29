import { describe, it, assert, equal, close } from './harness.js';
import { Profile, RANKS, rankForXp, rankProgress } from '../src/js/state/profile.js';
import { SessionStats, leakReport, bankrollAdvice, STAKES } from '../src/js/state/stats.js';
import { checkAchievements, ACHIEVEMENTS } from '../src/js/state/achievements.js';
import { generateQuestion, generateGauntlet, DRILL_MODULE_IDS, difficultyForLevel } from '../src/js/trainers/index.js';
import { MODULE_META, unlockedModules, recommendedModule } from '../src/js/data/curriculum.js';
import { makeRng } from '../src/js/core/rng.js';

const fresh = () => {
  const memory = new Map();
  return new Profile({}, {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  });
};

describe('progression: ranks', () => {
  it('starts as a fish and climbs to GTO Master', () => {
    equal(rankForXp(0).name, 'Fish');
    equal(rankForXp(999999).name, 'GTO Master');
    equal(RANKS.length, 10);
  });

  it('never lets a rank threshold go backwards', () => {
    for (let i = 1; i < RANKS.length; i++) {
      assert(RANKS[i].xp > RANKS[i - 1].xp, `${RANKS[i].name} must cost more than ${RANKS[i - 1].name}`);
      equal(RANKS[i].level, i + 1, 'levels are sequential');
    }
  });

  it('reports progress toward the next rank', () => {
    close(rankProgress(0), 0, 1e-9);
    const half = (RANKS[0].xp + RANKS[1].xp) / 2;
    close(rankProgress(half), 0.5, 1e-9);
    equal(rankProgress(999999), 1, 'maxed out');
  });

  it('gains levels as XP accrues', () => {
    const p = fresh();
    equal(p.level, 1);
    const result = p.addXp(RANKS[2].xp);
    equal(p.level, 3);
    equal(result.levelsGained, 2);
  });

  it('never drops below zero XP', () => {
    const p = fresh();
    p.addXp(-500);
    equal(p.xp, 0);
  });
});

describe('progression: persistence', () => {
  it('round-trips through storage', () => {
    const memory = new Map();
    const storage = {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k),
    };
    const p = new Profile({}, storage);
    p.addXp(1500);
    p.recordDrill('pot-odds', true);
    p.setBankroll(430, 'nl10');

    const loaded = Profile.load(storage);
    equal(loaded.xp, 1500);
    equal(loaded.drillStats('pot-odds').correct, 1);
    equal(loaded.data.bankroll, 430);
    equal(loaded.data.stakeKey, 'nl10');
  });

  it('survives a corrupt save without crashing', () => {
    const storage = { getItem: () => '{not json', setItem: () => {}, removeItem: () => {} };
    const p = Profile.load(storage);
    equal(p.xp, 0, 'falls back to a fresh profile');
  });

  it('keeps working when storage throws', () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => {},
    };
    const p = new Profile({}, storage);
    p.addXp(100);
    equal(p.xp, 100, 'the session still works without persistence');
  });
});

describe('progression: drill tracking', () => {
  it('tracks streaks and resets them on a miss', () => {
    const p = fresh();
    p.recordDrill('outs', true);
    p.recordDrill('outs', true);
    equal(p.drillStats('outs').streak, 2);
    p.recordDrill('outs', false);
    equal(p.drillStats('outs').streak, 0);
    equal(p.drillStats('outs').bestStreak, 2);
    equal(p.drillStats('outs').attempts, 3);
  });

  it('withholds an accuracy verdict until there is enough data', () => {
    const p = fresh();
    p.recordDrill('outs', true);
    equal(p.accuracy('outs'), null, 'one attempt proves nothing');
    for (let i = 0; i < 9; i++) p.recordDrill('outs', i % 2 === 0);
    assert(p.accuracy('outs') !== null, 'ten attempts is enough to judge');
  });

  it('recommends the weakest unlocked module', () => {
    const p = fresh();
    p.addXp(RANKS[4].xp);   // unlock a few modules
    const untouched = recommendedModule(p);
    assert(untouched, 'always recommends something');
    for (const m of unlockedModules(p.level)) {
      for (let i = 0; i < 10; i++) p.recordDrill(m.id, m.id !== 'outs');
    }
    equal(recommendedModule(p).id, 'outs', 'points at the weakest skill');
  });
});

describe('progression: achievements', () => {
  it('has a unique id, name and description for each', () => {
    const ids = new Set();
    for (const a of ACHIEVEMENTS) {
      assert(!ids.has(a.id), `duplicate achievement id ${a.id}`);
      ids.add(a.id);
      assert(a.name && a.description && a.icon, `${a.id} is incomplete`);
    }
  });

  it('unlocks on the first correct answer, and only once', () => {
    const p = fresh();
    p.recordDrill('outs', true);
    const first = checkAchievements(p);
    assert(first.some((a) => a.id === 'first-blood'), 'first blood unlocks');
    const second = checkAchievements(p);
    assert(!second.some((a) => a.id === 'first-blood'), 'and does not unlock twice');
  });

  it('unlocks streak and rank achievements at the right moment', () => {
    const p = fresh();
    for (let i = 0; i < 10; i++) p.recordDrill('outs', true);
    assert(checkAchievements(p).some((a) => a.id === 'streak-10'));
    p.addXp(RANKS[4].xp);
    assert(checkAchievements(p).some((a) => a.id === 'level-5'));
  });
});

describe('drills: every module produces valid questions', () => {
  it('covers every curriculum module with a generator', () => {
    for (const meta of MODULE_META) {
      assert(DRILL_MODULE_IDS.includes(meta.id), `${meta.id} has no drill generator`);
    }
  });

  it('generates well-formed questions at every difficulty', () => {
    const rng = makeRng(31337);
    for (const moduleId of DRILL_MODULE_IDS) {
      for (const difficulty of [1, 3, 5]) {
        for (let i = 0; i < 6; i++) {
          const q = generateQuestion(moduleId, rng, difficulty);
          assert(q.question && q.question.length > 10, `${moduleId}: missing question text`);
          assert(q.options.length >= 2, `${moduleId}: needs at least two options`);
          assert(q.options.some((o) => o.key === q.answer), `${moduleId}: answer must be one of the options`);
          assert(q.explanation && q.explanation.length > 30, `${moduleId}: explanation must teach`);
          assert(q.xp > 0, `${moduleId}: drills should award XP`);
          const labels = q.options.map((o) => o.label);
          equal(new Set(labels).size, labels.length, `${moduleId}: duplicate option labels ${labels.join('|')}`);
        }
      }
    }
  });

  it('never leaves an option undefined or empty', () => {
    const rng = makeRng(4242);
    for (const moduleId of DRILL_MODULE_IDS) {
      for (let i = 0; i < 8; i++) {
        for (const o of generateQuestion(moduleId, rng, 4).options) {
          assert(typeof o.label === 'string' && o.label.trim().length > 0, `${moduleId}: blank option`);
          assert(!/undefined|NaN|null/.test(o.label), `${moduleId}: broken option "${o.label}"`);
        }
      }
    }
  });

  it('never writes undefined or NaN into an explanation', () => {
    const rng = makeRng(515);
    for (const moduleId of DRILL_MODULE_IDS) {
      for (let i = 0; i < 8; i++) {
        const q = generateQuestion(moduleId, rng, 3);
        assert(!/undefined|NaN/.test(q.explanation), `${moduleId}: broken explanation "${q.explanation}"`);
        assert(!/undefined|NaN/.test(q.question), `${moduleId}: broken question "${q.question}"`);
      }
    }
  });

  it('builds a mixed gauntlet from unlocked modules only', () => {
    const rng = makeRng(99);
    const questions = generateGauntlet(rng, 1, 8);
    equal(questions.length, 8);
    const allowed = new Set(unlockedModules(1).map((m) => m.id));
    for (const q of questions) assert(allowed.has(q.module), `${q.module} should be locked at level 1`);

    const late = generateGauntlet(rng, 10, 12);
    equal(late.length, 12);
    assert(new Set(late.map((q) => q.module)).size >= 4, 'a high-level gauntlet should mix skills');
  });

  it('scales difficulty with rank', () => {
    assert(difficultyForLevel(1) < difficultyForLevel(10), 'higher ranks get harder drills');
    assert(difficultyForLevel(10) <= 6, 'difficulty stays in range');
  });
});

describe('stats: session tracking and coaching', () => {
  const playHand = (stats, { voluntary, raised, showdown, won, net }) => {
    stats.startHand();
    if (voluntary) stats.recordAction('preflop', raised ? 'raise' : 'call');
    else stats.recordAction('preflop', 'fold');
    if (showdown) stats.markStreet('flop');
    stats.endHand({ net, showdown, won, potSize: Math.abs(net) });
  };

  it('computes VPIP, PFR and aggression', () => {
    const stats = new SessionStats();
    for (let i = 0; i < 10; i++) {
      playHand(stats, { voluntary: i < 3, raised: i < 2, showdown: false, won: false, net: -1 });
    }
    close(stats.vpip, 0.3, 1e-9);
    close(stats.pfr, 0.2, 1e-9);
    equal(stats.hands, 10);
  });

  it('says nothing useful until there is a sample', () => {
    const stats = new SessionStats();
    playHand(stats, { voluntary: true, raised: true, showdown: false, won: true, net: 5 });
    const report = leakReport(stats);
    equal(report.ready, false, 'one hand is not a read');
  });

  it('spots a player who is too loose', () => {
    const stats = new SessionStats();
    for (let i = 0; i < 40; i++) {
      playHand(stats, { voluntary: i < 30, raised: i < 8, showdown: false, won: false, net: -1 });
    }
    const report = leakReport(stats);
    assert(report.leaks.some((l) => l.id === 'too-loose'), 'should flag a 75% VPIP');
    assert(report.leaks.every((l) => l.fix && l.fix.length > 20), 'every leak needs an actionable fix');
  });

  it('spots a passive player', () => {
    const stats = new SessionStats();
    for (let i = 0; i < 40; i++) {
      playHand(stats, { voluntary: i < 10, raised: false, showdown: false, won: false, net: -1 });
    }
    for (let i = 0; i < 20; i++) stats.calls++;
    const report = leakReport(stats);
    assert(report.leaks.some((l) => l.id === 'passive-postflop'), 'low aggression factor is a leak');
  });
});

describe('stats: bankroll ladder', () => {
  it('orders the stakes and their requirements', () => {
    for (let i = 1; i < STAKES.length; i++) {
      assert(STAKES[i].bb > STAKES[i - 1].bb, 'stakes climb');
      assert(STAKES[i].minBankroll > STAKES[i - 1].minBankroll, 'so do bankroll requirements');
    }
  });

  it('stops you sitting in a game you cannot afford', () => {
    const advice = bankrollAdvice(40, 'nl25');
    equal(advice.ok, false);
    assert(advice.suggestion.includes('Move down') || advice.suggestion.includes('NL2'), 'and tells you where to go');
  });

  it('lets you take a shot when you are rolled', () => {
    const advice = bankrollAdvice(5000, 'nl25');
    equal(advice.ok, true);
    assert(advice.suggestion && advice.suggestion.includes('NL50'), 'suggests the next rung up');
  });

  it('requires at least 30 buy-ins at every stake', () => {
    for (const stake of STAKES) {
      assert(stake.minBankroll / stake.buyIn >= 30, `${stake.name} should demand 30+ buy-ins`);
    }
  });
});
