/**
 * A lesson is ten spots, a mark, and a memory.
 *
 * The table already dealt the reader their own decisions; what made it
 * practice rather than a lesson was that nothing ever said how it went and
 * nothing carried over. These pin the three properties that make it one.
 */

import { describe, it, assert, equal, close } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import {
  startRun, recordSpot, runComplete, scoreRun, saveRun,
  weakSpots, watchFor, runHistory, mistakeInfo, MISTAKES, RUN_LENGTH,
} from '../src/js/state/lessonRuns.js';
import { judgeDecision } from '../src/js/core/judge.js';
import { judgeSpot } from '../src/js/core/coach.js';

const fresh = () => {
  const mem = new Map();
  return new Profile({}, {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  });
};

const fill = (run, spots) => { for (const s of spots) recordSpot(run, s); return run; };
const bad = (id) => ({ id, level: 'bad', cost: 10 });
const good = () => ({ id: 'correct-call', level: 'good', cost: 0 });

describe('lesson runs: a run has an end and a mark', () => {
  it('closes after its own length and refuses more', () => {
    const run = startRun('pot-odds');
    assert(!runComplete(run), 'an empty run is not finished');
    fill(run, Array.from({ length: RUN_LENGTH }, good));
    assert(runComplete(run), `${RUN_LENGTH} spots should finish it`);
    recordSpot(run, bad('called-without-odds'));
    equal(run.spots.length, RUN_LENGTH, 'a finished run cannot take more spots');
  });

  it('counts the mistakes and names the commonest first', () => {
    const run = fill(startRun('pot-odds'), [
      bad('called-without-odds'), bad('folded-the-best'), bad('called-without-odds'),
      bad('called-without-odds'), good(), good(),
    ]);
    const score = scoreRun(run);
    equal(score.total, 6);
    equal(score.right, 2);
    equal(score.wrong, 4);
    equal(score.mistakes[0].id, 'called-without-odds');
    equal(score.mistakes[0].count, 3, 'the one made three times comes first');
    assert(score.mistakes[0].fix.length > 20, 'every mistake needs one thing to do about it');
  });
});

describe('lesson runs: what you got wrong is remembered', () => {
  it('carries a mistake into the warning for the next run', () => {
    const p = fresh();
    saveRun(p, fill(startRun('pot-odds'), [
      bad('called-without-odds'), bad('called-without-odds'), good(),
    ]));
    const weak = weakSpots(p, 'pot-odds');
    equal(weak.length, 1);
    equal(weak[0].count, 2);

    const line = watchFor(p, 'pot-odds');
    assert(line && /2/.test(line), `the warning must say how often: "${line}"`);
    assert(line.includes(MISTAKES['called-without-odds'].label), 'and name the mistake');
    equal(runHistory(p, 'pot-odds').runs, 1);
  });

  it('accumulates a repeated mistake across runs', () => {
    const p = fresh();
    for (let i = 0; i < 3; i++) {
      saveRun(p, fill(startRun('outs'), [bad('folded-the-best'), good(), good()]));
    }
    equal(weakSpots(p, 'outs')[0].count, 3, 'three runs, three of the same mistake');
  });

  it('forgets a mistake you have stopped making', () => {
    const p = fresh();
    saveRun(p, fill(startRun('cbet'), [bad('checked-back-value'), good()]));
    assert(weakSpots(p, 'cbet').length === 1, 'it starts remembered');
    // Clean runs long enough to push it out of sight.
    for (let i = 0; i < 3; i++) {
      saveRun(p, fill(startRun('cbet'), Array.from({ length: RUN_LENGTH }, good)));
    }
    equal(weakSpots(p, 'cbet').length, 0, 'a mistake you no longer make stops being your weak spot');
    equal(watchFor(p, 'cbet'), null, 'and there is nothing left to warn about');
  });

  it('keeps the memory of each lesson separate', () => {
    const p = fresh();
    saveRun(p, fill(startRun('pot-odds'), [bad('called-without-odds')]));
    equal(weakSpots(p, 'outs').length, 0, 'a pot-odds mistake is not an outs mistake');
  });
});

describe('lesson runs: every mistake the coach can name is one the run can explain', () => {
  it('gives a label and a fix to every verdict id that means a mistake', () => {
    // A judged mistake with no entry would be filed under its raw slug and
    // reported to the reader as "cbet-wrong-board", which is not English.
    const seen = new Set();
    const spots = [
      { action: 'call', equity: 0.1, needed: 0.4, toCall: 50, pot: 100 },
      { action: 'fold', equity: 0.8, needed: 0.2, toCall: 20, pot: 100 },
      { action: 'fold', equity: 0.5, needed: 0, toCall: 0, pot: 100 },
      { action: 'check', equity: 0.85, needed: 0, toCall: 0, pot: 100 },
      { action: 'bet', equity: 0.2, needed: 0, toCall: 0, pot: 100, amount: 50, currentBet: 0 },
    ];
    for (const s of spots) {
      const v = judgeDecision(s);
      if (v.level === 'bad' && v.id) seen.add(v.id);
    }
    assert(seen.size >= 3, `expected several kinds of mistake, saw ${[...seen].join(', ')}`);
    for (const id of seen) {
      assert(mistakeInfo(id), `the judge can produce "${id}" and the run cannot explain it`);
    }
  });

  it('stamps an id on every verdict, so a renamed headline cannot orphan a history', () => {
    const v = judgeDecision({ action: 'call', equity: 0.1, needed: 0.4, toCall: 50, pot: 100 });
    assert(v.id, 'a verdict without an id cannot be remembered');
    equal(v.id, 'called-without-odds');
    const spot = judgeSpot({
      action: 'call', equity: 0.1, needed: 0.4, toCall: 50, pot: 100,
      street: 'flop', hole: [], board: [1, 2, 3],
    });
    assert(spot.id, 'judgeSpot must pass the id through');
  });
});
