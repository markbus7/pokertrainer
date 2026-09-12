import { describe, it, assert, equal, close } from './harness.js';
import { Profile, RANKS, rankForXp, rankProgress, requirementRows, meetsRank } from '../src/js/state/profile.js';
import { SessionStats, leakReport, bankrollAdvice, STAKES, SAMPLE } from '../src/js/state/stats.js';
import { checkAchievements, ACHIEVEMENTS } from '../src/js/state/achievements.js';
import { generateQuestion, generateGauntlet, DRILL_MODULE_IDS, difficultyForLevel } from '../src/js/trainers/index.js';
import {
  MODULE_META, unlockedModules, recommendedModule, nextUp, confidenceAdjusted,
} from '../src/js/data/curriculum.js';
import { makeRng } from '../src/js/core/rng.js';
import { scoreLine, EVIDENCE_BAR } from '../src/js/state/mastery.js';

/** Earn a rank properly: the lessons, the drilling, the hands, then the XP. */
const promoteTo = (p, level) => {
  const rank = RANKS[level - 1];
  const req = rank.requires || {};
  const ids = MODULE_META.map((m) => m.id);
  const drill = (id, n) => { for (let i = 0; i < n; i++) p.recordDrill(id, true); };

  for (let i = 0; i < (req.mastered || 0); i++) { p.markWalkthroughComplete(ids[i]); drill(ids[i], 30); }
  for (let i = 0; i < (req.solid || 0); i++) drill(ids[i], Math.max(0, 15 - p.drillStats(ids[i]).attempts));
  for (let i = 0; i < (req.lessons || 0); i++) p.markWalkthroughComplete(ids[i]);
  if (req.hands) p.data.handsPlayed = Math.max(p.data.handsPlayed, req.hands);
  if (p.xp < rank.xp) p.addXp(rank.xp - p.xp);
  return p;
};

/** Promoted, with every unlocked module answered enough to be judged. */
const settled = (level) => {
  const p = promoteTo(fresh(), level);
  for (const m of unlockedModules(p.level)) {
    for (let i = p.drillStats(m.id).attempts; i < 20; i++) p.recordDrill(m.id, true);
  }
  return p;
};

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

  it('does not promote on XP alone', () => {
    // The whole point of the requirements: grinding one drill forever used to
    // reach level 10 and unlock the entire curriculum, ICM included, for
    // somebody who had only ever practised one thing.
    const p = fresh();
    equal(p.level, 1);
    p.addXp(RANKS[9].xp * 2);
    equal(p.level, 1, 'XP without breadth is not a rank');
  });

  it('cannot reach the top by repeating a single module', () => {
    const p = fresh();
    p.markWalkthroughComplete('pot-odds');
    for (let i = 0; i < 4000; i++) p.recordDrill('pot-odds', true);
    p.addXp(RANKS[9].xp * 2);
    assert(p.level <= 2, `one module carried the player to level ${p.level}`);
  });

  it('promotes once every requirement is met', () => {
    const p = promoteTo(fresh(), 4);
    equal(p.level, 4);
    assert(meetsRank(p, RANKS[3]), 'level 4 requirements are satisfied');
  });

  it('gives up a rank when the skills behind it are gone', () => {
    const p = promoteTo(fresh(), 3);
    equal(p.level, 3);
    p.data.drills = {};
    p.data.walkthroughs = [];
    assert(p.level < 3, 'a rank measures what you can do now, not what you once could');
  });

  it('recomputes an older save honestly rather than trusting its XP', () => {
    // A save written before requirements existed carries plenty of XP and no
    // record of any skill. Under the old rule that was level 3; it is not.
    const legacy = new Profile({ xp: 1450, drills: {}, walkthroughs: [] }, null);
    equal(rankForXp(1450).level, 3, 'the old rule called this level 3');
    equal(legacy.level, 1, 'the requirements do not agree');
  });

  it('remembers when a rank was first reached', () => {
    const p = promoteTo(fresh(), 3);
    const at = p.rankReachedAt(3);
    assert(at instanceof Date, 'a date is recorded');
    equal(p.rankReachedAt(10), null, 'nothing recorded for a rank never reached');
    // The record survives losing the rank: it says you were there once.
    p.data.drills = {};
    p.data.walkthroughs = [];
    assert(p.rankReachedAt(3) instanceof Date, 'the history is not rewritten');
  });

  it('reports exactly what is missing for the next rank', () => {
    const p = fresh();
    const rows = requirementRows(p, RANKS[1]);
    assert(rows.length >= 2, 'more than XP is required');
    assert(rows.some((r) => r.key === 'xp'), 'XP is one of the rows');
    assert(rows.every((r) => typeof r.have === 'number' && typeof r.need === 'number'));
    assert(rows.some((r) => !r.met), 'a fresh player has unmet requirements');
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

describe('the Ranks screen does not describe behaviour the code lost', () => {
  it('never promises that a rank is permanent', async () => {
    // This exact class of rot has bitten twice: profile.js claimed to be
    // "skill-gated" when it was not, and this screen went on promising a
    // rank could not be taken away after that guarantee was removed.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/js/ui/screenLevels.js', import.meta.url), 'utf8');
    assert(
      !/never taken away|cannot be lost|never lose (?:a |your )?rank/i.test(src),
      'the screen still promises ranks are permanent, which the code no longer does',
    );
  });
});

describe('rank requirements are reachable', () => {
  it('never asks for more skills than are unlocked at the rank below', () => {
    // The trap this guards: requiring "8 skills at Solid" for a rank whose
    // predecessor has only 6 modules unlocked would make the ladder
    // impossible to climb, and nothing else in the app would notice.
    for (let i = 1; i < RANKS.length; i++) {
      const rank = RANKS[i];
      const available = unlockedModules(RANKS[i - 1].level).length;
      const req = rank.requires || {};
      for (const key of ['lessons', 'solid', 'mastered']) {
        if (!req[key]) continue;
        assert(
          req[key] <= available,
          `${rank.name} wants ${req[key]} ${key} but only ${available} modules are unlocked at ${RANKS[i - 1].name}`,
        );
      }
    }
  });

  it('asks for hands played from the moment there is a table to play at', () => {
    // Every other requirement can be met without ever sitting down. This is
    // the one that says the ladder is for players, so it must actually be
    // there — and it must not appear before the reader has a reason to play.
    const withHands = RANKS.filter((r) => (r.requires || {}).hands);
    assert(withHands.length >= RANKS.length - 2,
      `only ${withHands.length} of ${RANKS.length} ranks ask for hands played`);
    for (const rank of withHands) {
      const rows = requirementRows(fresh(), rank);
      assert(rows.some((r) => r.key === 'hands'), `${rank.name} hides its hands requirement`);
    }
  });

  it('never eases off as the ladder climbs', () => {
    const keys = ['lessons', 'solid', 'mastered', 'hands'];
    for (let i = 2; i < RANKS.length; i++) {
      for (const key of keys) {
        const prev = (RANKS[i - 1].requires || {})[key] || 0;
        const here = (RANKS[i].requires || {})[key] || 0;
        assert(here >= prev, `${RANKS[i].name} asks for less ${key} than ${RANKS[i - 1].name}`);
      }
    }
  });

  it('mastering everything is exactly what the top rank means', () => {
    const top = RANKS[RANKS.length - 1].requires;
    equal(top.mastered, MODULE_META.length, 'GTO Master requires every skill mastered');
  });

  it('can actually be climbed all the way, one rank at a time', () => {
    const p = fresh();
    for (let level = 2; level <= RANKS.length; level++) {
      promoteTo(p, level);
      equal(p.level, level, `stuck below level ${level}`);
    }
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
    const p = promoteTo(fresh(), 5);   // unlock a few modules
    const untouched = recommendedModule(p);
    assert(untouched, 'always recommends something');
    for (const m of unlockedModules(p.level)) {
      for (let i = 0; i < 10; i++) p.recordDrill(m.id, m.id !== 'outs');
    }
    equal(recommendedModule(p).id, 'outs', 'points at the weakest skill');
  });

  it('never prints a score it cannot back up', () => {
    // "3/3" reads as a perfect record and is worth nothing — three right in a
    // row is what a coin does one time in eight. Below the bar the line has to
    // say what is missing rather than show a percentage.
    const p = fresh();
    for (let i = 0; i < EVIDENCE_BAR - 1; i++) {
      p.recordDrill('outs', true);
      const line = scoreLine(p, 'outs');
      assert(!/%/.test(line), `${i + 1} answers should not produce a percentage: "${line}"`);
      // The whole complaint was that "3/3" is a number that says nothing, so
      // a bare fraction is the failure this is guarding against — not just
      // the absence of a percent sign.
      assert(!/^\s*\d+\s*\/\s*\d+\s*$/.test(line),
        `"${line}" is a bare fraction — it tells the reader nothing`);
      assert(line.includes(String(EVIDENCE_BAR - (i + 1))),
        `the line has to say how many more are needed: "${line}"`);
      equal(p.accuracy('outs'), null, `accuracy must stay unknown at ${i + 1} answers`);
    }
    p.recordDrill('outs', true);
    assert(/100%/.test(scoreLine(p, 'outs')), 'at the bar it becomes a real score');
    assert(p.accuracy('outs') !== null, 'and accuracy is finally knowable');
  });

  it('uses one evidence bar everywhere, not one per screen', () => {
    // It used to be five in the profile and eight in the recommendation,
    // which is how a tile could show a bare "3/3" that nothing explained.
    const p = fresh();
    for (let i = 0; i < EVIDENCE_BAR; i++) p.recordDrill('outs', i > 0);
    equal(p.accuracy('outs') === null, false);
    assert(scoreLine(p, 'outs').includes('%'), 'the same bar unlocks both');
  });

  it('does not let one bad answer outrank a module you have really struggled with', () => {
    // Raw accuracy says 0 of 1 is a 0% disaster and 5 of 12 is 42%, so the
    // module you have barely opened wins "your weakest skill" over the one
    // you have genuinely fought with.
    const p = settled(5);
    for (let i = 0; i < 12; i++) p.recordDrill('pot-odds', i < 5);   // 5/12, a real hole
    p.recordDrill('outs', false);                                     // 0/1, no evidence
    equal(nextUp(p).module.id, 'pot-odds',
      'a module with real evidence of trouble outranks one bad answer');

    // A short perfect run is not proof of mastery either.
    assert(confidenceAdjusted(3, 3) < confidenceAdjusted(26, 26),
      'three right in a row is not the same as twenty-six');
  });

  it('sends you at the hole you are in, not at a module you have never opened', () => {
    // The reader's own screen: Position at 54%, Outs at 58%, Preflop at 61%
    // — three modules under the Solid bar — and the game pointed at Bankroll,
    // which had never been opened. "Never tried" was tested before "actually
    // failing" and returned first, so the recommendation could not see the
    // thing it exists to find.
    const p = fresh();
    const played = { 'hand-rankings': [26, 26], 'pot-odds': [30, 39], outs: [32, 55], preflop: [20, 33], position: [7, 13] };
    for (const [id, [right, total]] of Object.entries(played)) {
      // Spread the misses through the run rather than stacking them at the
      // end. Tiers read the last answers now, so a fixture that answers
      // everything right and then everything wrong describes a collapse, not
      // a reader sitting at 77%.
      let done = 0;
      for (let i = 0; i < total; i++) {
        const correct = Math.round(((i + 1) * right) / total) > done;
        if (correct) done++;
        p.recordDrill(id, correct);
      }
      equal(p.drillStats(id).correct, right, `${id} fixture keeps its ratio`);
    }
    p.data.xp = 3000;
    p.data.walkthroughs = ['hand-rankings', 'pot-odds'];
    p.data.handsPlayed = 60;
    equal(p.level, 3, 'the fixture reaches the rank that unlocks Bankroll');
    equal(p.drillStats('bankroll').attempts, 0, 'and Bankroll is untouched');

    const plan = nextUp(p);
    equal(plan.module.id, 'position', 'the weakest judged module, at 54%');
    equal(plan.reason, 'weakest');
  });

  it('falls back to a module never opened once nothing is demonstrably weak', () => {
    // The other half of the same rule: an untouched module is still the most
    // informative next answer when there is no hole to fill.
    const p = fresh();
    for (let i = 0; i < 20; i++) p.recordDrill('hand-rankings', true);
    for (let i = 0; i < 20; i++) p.recordDrill('pot-odds', i < 18);
    p.data.xp = 600;
    p.data.walkthroughs = ['hand-rankings'];
    p.data.handsPlayed = 10;
    assert(p.level >= 2, 'a third module is unlocked and untouched');

    const plan = nextUp(p);
    equal(plan.reason, 'untouched');
    equal(p.drillStats(plan.module.id).attempts, 0);

    // Drop one of the finished modules below the bar and the hole wins again.
    // Its lesson is marked read first, so the answer is "drill this" rather
    // than "go and read it" — a different branch, tested elsewhere.
    p.markWalkthroughComplete('pot-odds');
    for (let i = 0; i < 20; i++) p.recordDrill('pot-odds', false);
    const after = nextUp(p);
    equal(after.module.id, 'pot-odds');
    equal(after.reason, 'weakest', 'a real hole outranks an unknown');
  });

  it('says why, and the reason always matches what it picked', () => {
    const p = promoteTo(fresh(), 5);
    equal(nextUp(p).reason, 'untouched', 'nothing tried yet');

    const ids = unlockedModules(p.level).map((m) => m.id);
    for (const id of ids) {
      for (let i = 0; i < 4 - p.drillStats(id).attempts; i++) p.recordDrill(id, true);
    }
    // promoteTo already drilled the early modules to mastery, so only the
    // untouched tail is thin — which is exactly what should be recommended.
    equal(nextUp(p).reason, 'thin', 'four questions each is not enough to judge');

    // Now make one module genuinely bad, with its lesson unread.
    const victim = ids.find((id) => !p.hasCompletedWalkthrough(id));
    assert(victim, 'the fixture leaves at least one lesson unread');
    for (let i = 0; i < 24; i++) p.recordDrill(victim, false);
    for (const id of ids) {
      if (id === victim) continue;
      for (let i = 0; i < 24; i++) p.recordDrill(id, true);
    }
    const plan = nextUp(p);
    equal(plan.module.id, victim);
    equal(plan.reason, 'lesson', 'under half right with the lesson unread means read the lesson');

    // Read it, and the advice becomes "this is your weakest — drill it".
    p.markWalkthroughComplete(victim);
    equal(nextUp(p).reason, 'weakest');
  });

  it('never points at a module that is already mastered while others are open', () => {
    const p = promoteTo(fresh(), 5);
    const open = unlockedModules(p.level);
    for (const m of open) {
      p.markWalkthroughComplete(m.id);
      for (let i = 0; i < 40; i++) p.recordDrill(m.id, true);
    }
    // Everything mastered: it still has to name something, and say so.
    equal(nextUp(p).reason, 'fresh', 'with nothing left open it says the queue is empty');
    // Break one open again and it must be the pick.
    for (let i = 0; i < 40; i++) p.recordDrill('outs', false);
    equal(nextUp(p).module.id, 'outs', 'a module that fell out of mastery is the one to fix');
  });
});

describe('statistics refuse to speak without a sample', () => {
  it('has no aggression factor until you have called something', () => {
    // (bets + raises) / calls is undefined at zero calls. It used to fall
    // back to the raw count, so four bets and no calls reported "4.0" as a
    // ratio — a count wearing a ratio's clothes — and nothing at all
    // reported 0.0, which reads as maximally passive rather than as no data.
    const s = new SessionStats(2);
    equal(s.aggressionFactor, null, 'nothing played is not an aggression of zero');

    s.bets = 4;
    equal(s.aggressionFactor, null, 'four bets and no calls is still not a ratio');

    s.calls = 2;
    equal(s.aggressionFactor, 2, 'once there are calls it is bets and raises per call');
  });

  it('still produces a leak report when there is no aggression factor', () => {
    const s = new SessionStats(2);
    s.hands = 40;
    s.vpipHands = 9;
    s.pfrHands = 7;
    const report = leakReport(s);            // must not throw on a null AF
    assert(report.ready, 'forty hands is past the bar');
    assert(!report.leaks.some((l) => /aggression/i.test(l.title + l.detail)),
      'it cannot name an aggression leak it has no number for');
    assert(!report.strengths.some((x) => /AF/.test(x)),
      'nor call an absent number well balanced');
  });

  it('names the number of hands it is still waiting for', () => {
    const s = new SessionStats(2);
    s.hands = SAMPLE.leaks - 3;
    const report = leakReport(s);
    equal(report.ready, false);
    assert(report.message.includes('3'), `should say how many are missing: "${report.message}"`);
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
    promoteTo(p, 5);
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

describe('curriculum ordering: a drill never needs a later module', () => {
  const levelOf = (id) => MODULE_META.find((m) => m.id === id).unlockLevel;
  const OUTS_LEVEL = levelOf('outs');

  it('never reveals the opponent\'s hand in a module that unlocks before outs', () => {
    // Showing the opponent's cards is only useful if you are expected to count
    // outs against them. Any module reachable before Outs & Equity that does so
    // is asking for a skill the student has not been taught yet — which is
    // exactly how the call-or-fold drill ended up inside Pot Odds.
    const rng = makeRng(23);
    const early = DRILL_MODULE_IDS.filter((id) => levelOf(id) < OUTS_LEVEL);
    assert(early.length > 0, 'there are modules that unlock before outs');
    for (const moduleId of early) {
      for (let i = 0; i < 40; i++) {
        const q = generateQuestion(moduleId, rng, 3);
        assert(
          !q.scenario || !q.scenario.revealVillain,
          `${moduleId} (level ${levelOf(moduleId)}) revealed the opponent's hand, `
          + `which needs outs (level ${OUTS_LEVEL}): "${q.question}"`,
        );
      }
    }
  });

  it('still teaches the combined call/fold decision, in Outs & Equity', () => {
    const rng = makeRng(5);
    let seen = 0;
    for (let i = 0; i < 60; i++) {
      const q = generateQuestion('outs', rng, 3);
      if (/Call or fold/.test(q.question)) seen++;
    }
    assert(seen > 0, 'the call-or-fold drill survived the move');
  });

  it('lets Pot Odds still drill the comparison, by supplying the equity', () => {
    const rng = makeRng(31);
    let seen = 0;
    for (let i = 0; i < 60; i++) {
      const q = generateQuestion('pot-odds', rng, 3);
      if (/Call or fold/.test(q.question)) {
        seen++;
        // The invariant is that the equity is handed over rather than counted,
        // whatever words the question uses to hand it over.
        assert(/\d+% of the time/.test(q.question), `equity must be given: "${q.question}"`);
      }
    }
    assert(seen > 0, 'pot odds still practises the call/fold comparison');
  });
});
