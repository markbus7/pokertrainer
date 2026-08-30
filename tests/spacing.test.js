import { describe, it, assert, equal, close } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import {
  INTERVALS, getCard, review, dueConcepts, strength, nextReviewLabel, hasStudied,
  recordConfidence, calibrationReport, CONFIDENCE,
} from '../src/js/state/spacing.js';
import { generateSpot, generateSession, LAB_TYPES } from '../src/js/trainers/lab.js';
import { requiredEquity } from '../src/js/core/odds.js';
import { makeRng } from '../src/js/core/rng.js';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-01-01T00:00:00Z');
const fresh = () => {
  const mem = new Map();
  return new Profile({}, {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  });
};

describe('spacing: the schedule expands with success', () => {
  it('starts every concept due immediately', () => {
    const p = fresh();
    equal(getCard(p, 'pot-odds').due, 0, 'never studied means due now');
    equal(dueConcepts(p, ['pot-odds', 'outs'], T0).length, 2);
  });

  it('pushes the next review further out on each success', () => {
    const p = fresh();
    let now = T0;
    const gaps = [];
    for (let i = 0; i < 4; i++) {
      const card = review(p, 'pot-odds', true, now);
      gaps.push(Math.round((card.due - now) / DAY));
      now = card.due;
    }
    for (let i = 1; i < gaps.length; i++) {
      assert(gaps[i] > gaps[i - 1], `gap ${i} (${gaps[i]}d) should exceed gap ${i - 1} (${gaps[i - 1]}d)`);
    }
    equal(gaps[0], INTERVALS[1], 'first success schedules the second interval');
  });

  it('brings a lapse back tomorrow', () => {
    const p = fresh();
    let now = T0;
    for (let i = 0; i < 3; i++) now = review(p, 'pot-odds', true, now).due;
    const card = review(p, 'pot-odds', false, now);
    equal(Math.round((card.due - now) / DAY), 1, 'a miss returns tomorrow');
  });

  it('drops back one rung on a lapse rather than resetting to zero', () => {
    const p = fresh();
    let now = T0;
    for (let i = 0; i < 4; i++) now = review(p, 'pot-odds', true, now).due;
    const before = getCard(p, 'pot-odds').step;
    const after = review(p, 'pot-odds', false, now).step;
    equal(after, before - 1, 'one slip should not erase weeks of recall');
    assert(after > 0, 'and should not fall to the very beginning');
  });

  it('never schedules beyond the last interval', () => {
    const p = fresh();
    let now = T0;
    for (let i = 0; i < 20; i++) now = review(p, 'pot-odds', true, now).due;
    const card = getCard(p, 'pot-odds');
    equal(card.step, INTERVALS.length, 'step tops out');
    close((card.due - card.lastSeen) / DAY, INTERVALS[INTERVALS.length - 1], 0.01, 'gap tops out too');
  });

  it('only reports concepts that are actually due', () => {
    const p = fresh();
    review(p, 'pot-odds', true, T0);
    equal(dueConcepts(p, ['pot-odds', 'outs'], T0).join(','), 'outs', 'the just-reviewed one is not due');
    const later = T0 + 40 * DAY;
    assert(dueConcepts(p, ['pot-odds', 'outs'], later).includes('pot-odds'), 'it comes back later');
  });

  it('reports strength and a readable next-review label', () => {
    const p = fresh();
    equal(strength(p, 'pot-odds'), 0, 'unstudied is zero');
    equal(nextReviewLabel(p, 'pot-odds', T0), 'not started');
    review(p, 'pot-odds', true, T0);
    assert(strength(p, 'pot-odds') > 0, 'studying builds strength');
    assert(/due in \d+ days/.test(nextReviewLabel(p, 'pot-odds', T0)), 'label names the gap');
    equal(nextReviewLabel(p, 'pot-odds', T0 + 99 * DAY), 'due now');
  });

  it('persists across a reload', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
    const p = new Profile({}, storage);
    review(p, 'pot-odds', true, T0);
    const loaded = Profile.load(storage);
    equal(getCard(loaded, 'pot-odds').reps, 1, 'the schedule survives a reload');
  });
});

describe('spacing: what counts as studied', () => {
  it('counts a concept practised only in the Lab', () => {
    // The Lab records reviews but no drill attempt. Gating the review panels
    // on drill history alone hid them from Lab-only practice.
    const p = fresh();
    equal(hasStudied(p, 'pot-odds'), false, 'untouched');
    review(p, 'pot-odds', true, T0);
    equal(hasStudied(p, 'pot-odds'), true, 'a Lab review counts as having studied it');
  });

  it('also counts drills and completed lessons', () => {
    const byDrill = fresh();
    byDrill.recordDrill('outs', true);
    equal(hasStudied(byDrill, 'outs'), true);

    const byLesson = fresh();
    byLesson.markWalkthroughComplete('outs');
    equal(hasStudied(byLesson, 'outs'), true);
  });
});

describe('spacing: calibration', () => {
  it('withholds a verdict until there is a sample', () => {
    const p = fresh();
    recordConfidence(p, 'sure', true);
    const r = calibrationReport(p);
    equal(r.ready, false, 'one answer is not a calibration');
    equal(r.verdict, null);
  });

  it('names overconfidence when certainty is often wrong', () => {
    const p = fresh();
    for (let i = 0; i < 20; i++) recordConfidence(p, 'sure', i < 10); // 50% while "certain"
    const r = calibrationReport(p);
    assert(r.ready);
    assert(/Overconfident/.test(r.verdict), `expected an overconfidence verdict, got: ${r.verdict}`);
  });

  it('names underconfidence when guesses keep landing', () => {
    const p = fresh();
    for (let i = 0; i < 20; i++) recordConfidence(p, 'guess', i < 18); // 90% while "guessing"
    assert(/Underconfident/.test(calibrationReport(p).verdict));
  });

  it('recognises good calibration', () => {
    const p = fresh();
    for (let i = 0; i < 20; i++) recordConfidence(p, 'sure', i < 19);
    assert(/Well calibrated/.test(calibrationReport(p).verdict));
  });

  it('reports a row per confidence level', () => {
    const p = fresh();
    recordConfidence(p, 'sure', true);
    const r = calibrationReport(p);
    equal(r.rows.length, CONFIDENCE.length);
    for (const row of r.rows) assert(row.label, 'every level is labelled');
  });
});

describe('lab: spots are solvable and correct', () => {
  it('generates every type without throwing', () => {
    const rng = makeRng(11);
    for (const type of LAB_TYPES) {
      for (let i = 0; i < 20; i++) {
        const s = generateSpot(type, rng);
        equal(s.type, type);
        assert(s.question && s.question.length > 10, `${type}: needs a question`);
        assert(s.table && s.table.board.length === 3, `${type}: needs a board`);
        assert(typeof s.solve === 'function', `${type}: needs a solver`);
      }
    }
  });

  it('accepts its own answer and rejects a wrong one, for every type', () => {
    const rng = makeRng(23);
    for (const type of LAB_TYPES) {
      for (let i = 0; i < 25; i++) {
        const s = generateSpot(type, rng);
        assert(s.solve(s.answer).correct, `${type}: should accept its own answer`);
        const wrong = s.inputKind === 'action'
          ? (s.answer === 'call' ? 'fold' : 'call')
          : s.answer * 2 + 20;
        assert(!s.solve(wrong).correct, `${type}: should reject ${wrong}`);
      }
    }
  });

  it('prices spots against the odds library, not a lookup table', () => {
    const rng = makeRng(31);
    for (let i = 0; i < 40; i++) {
      const s = generateSpot('price', rng);
      const expected = requiredEquity(s.table.bet, s.table.potNow) * 100;
      close(s.answer, expected, 1e-9, 'the taught answer must be the computed one');
    }
  });

  it('makes the sizing answer actually offer the price it asks for', () => {
    const rng = makeRng(37);
    for (let i = 0; i < 40; i++) {
      const s = generateSpot('size', rng);
      const offered = requiredEquity(s.answer, s.table.pot + s.answer) * 100;
      const asked = Number(s.question.match(/about (\d+)%/)[1]);
      close(offered, asked, 1.0, `betting ${s.answer} into ${s.table.pot} should offer ~${asked}%`);
    }
  });

  it('only asks you to decide when the answer is not a coin flip', () => {
    const rng = makeRng(41);
    for (let i = 0; i < 25; i++) {
      const s = generateSpot('decide', rng);
      if (s.type !== 'decide') continue;
      const need = requiredEquity(s.table.bet, s.table.potNow);
      const r = s.solve(s.answer);
      assert(r.correct, 'its own answer must be right');
      assert(need > 0 && need < 1, 'the price must be a real fraction');
    }
  });

  it('explains every spot with real numbers', () => {
    const rng = makeRng(43);
    for (const type of LAB_TYPES) {
      const s = generateSpot(type, rng);
      for (const given of [s.answer, s.inputKind === 'action' ? 'fold' : 1]) {
        const r = s.solve(given);
        assert(r.lines.length >= 2, `${type}: feedback should explain, not just verdict`);
        for (const line of r.lines) {
          assert(!/undefined|NaN/.test(line), `${type}: broken feedback line: ${line}`);
        }
      }
    }
  });

  it('interleaves the three kinds rather than blocking them', () => {
    const spots = generateSession(makeRng(47), 9);
    equal(spots.length, 9);
    equal(new Set(spots.map((s) => s.type)).size, 3, 'all three kinds should appear');
    let runs = 1;
    for (let i = 1; i < spots.length; i++) if (spots[i].type !== spots[i - 1].type) runs++;
    assert(runs >= 5, `expected the kinds to be mixed, got ${runs} switches in 9 spots`);
  });
});
