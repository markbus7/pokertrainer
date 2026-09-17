import { describe, it, assert, equal } from './harness.js';
import { readFileSync } from 'node:fs';
import { IDK, IDK_NUMBER, isSkipped } from '../src/js/ui/dontKnow.js';
import { PRACTICE, makePractice } from '../src/js/trainers/practice.js';
import { generateQuestion, DRILL_MODULE_IDS } from '../src/js/trainers/index.js';
import { rangeQuestion } from '../src/js/trainers/rangeTrainer.js';
import { CHECKPOINTS } from '../src/js/data/rangeLadder.js';
import { makeRng } from '../src/js/core/rng.js';

const read = (f) => readFileSync(new URL(`../src/js/${f}`, import.meta.url), 'utf8');

/**
 * Which sentinel a practice kind's grade() expects. Key-shaped kinds compare
 * with === against a string; value-shaped kinds run a submitted value through
 * Number() and a tolerance check.
 */
const NUMERIC_KINDS = new Set(['price', 'number', 'felt-number']);

describe("\"I don't know\": the sentinels are safe wherever they are compared", () => {
  it('never equals a real answer, and stringifies without throwing', () => {
    assert(!isSkipped('a'), 'a real single-letter key reads as skipped');
    assert(!isSkipped(3) && !isSkipped(10) && !isSkipped(18) && !isSkipped(26),
      'a real read-band reads as skipped');
    assert(isSkipped(IDK) && isSkipped(IDK_NUMBER), 'the sentinels do not read as skipped');
    // The exact trap that ruled out a Symbol: screenTable.js builds
    // `${read.picked}%` directly out of whatever was picked, and a Symbol
    // throws the moment a template literal tries to coerce it — a string
    // just interpolates.
    const interpolated = `${IDK}%`;
    equal(interpolated, '__idk__%', 'interpolating the sentinel produced something unexpected');
  });

  it('is a finite number, so a tolerance check reaches the real comparison instead of bailing out', () => {
    // Every numeric grade() in this app guards `if (!Number.isFinite(given))`
    // and returns early WITHOUT the true answer when that fails. NaN and
    // Infinity both fail that guard — which would silently defeat the whole
    // feature for every typed-number question. This is the property that
    // makes IDK_NUMBER safe and NaN/Infinity not.
    assert(Number.isFinite(IDK_NUMBER), 'IDK_NUMBER is not finite');
    assert(!Number.isFinite(NaN), 'sanity: NaN really does fail the guard');
    assert(!Number.isFinite(Infinity), 'sanity: Infinity really does fail the guard');
  });
});

describe("\"I don't know\": grading every practice kind with the real generators", () => {
  it('scores every practice kind as not correct, and still hands back the real answer', () => {
    const rng = makeRng(7);
    for (const name of Object.keys(PRACTICE)) {
      for (let i = 0; i < 8; i++) {
        const spot = makePractice(name, rng);
        const sentinel = NUMERIC_KINDS.has(spot.kind) ? IDK_NUMBER : IDK;
        const graded = spot.grade(sentinel);
        assert(graded, `${name}: grade(${String(sentinel)}) returned nothing`);
        assert(!graded.correct, `${name}: the sentinel graded as correct`);
        // Every kind exposes the truth somewhere in the result — under a
        // different key per shape, because the generators were not written
        // with a skip in mind and this proves they do not need to be. `decide`
        // is the one exception: it never exposes a structured answer field,
        // even for a real wrong guess — the maths in the explanation states
        // the correct action in prose instead ("...so you have enough —
        // calling wins..."), which is a pre-existing design of that
        // generator and not something a skip needs to change.
        const revealsAnswer = spot.kind === 'decide' || graded.answer !== undefined
          || graded.exact !== undefined || graded.winner !== undefined
          || (graded.hits !== undefined && graded.missed !== undefined);
        assert(revealsAnswer, `${name}: no answer field survived grading a skip — got ${Object.keys(graded).join(',')}`);
        assert(typeof graded.explanation === 'string' && graded.explanation.length > 0,
          `${name}: no explanation survived grading a skip`);
      }
    }
  });

  it('never hides the answer behind the same guard that also rejects garbage input', () => {
    // The numeric grade() functions all share one shape: parse, then bail
    // early with a generic message if the parse failed. NaN triggers that
    // guard and DOES hide the answer — this is the trap IDK_NUMBER exists to
    // avoid, pinned here so the two are never confused again.
    const rng = makeRng(11);
    for (const name of Object.keys(PRACTICE)) {
      const spot = makePractice(name, rng);
      if (!NUMERIC_KINDS.has(spot.kind)) continue;
      const garbage = spot.grade(NaN);
      const real = spot.grade(IDK_NUMBER);
      assert(garbage.exact === undefined,
        `${name}: NaN no longer hides the answer — IDK_NUMBER may not be needed here any more, update the sentinel choice`);
      assert(real.exact !== undefined, `${name}: IDK_NUMBER hid the answer exactly like NaN does`);
    }
  });

  it('treats a skip in the outs picker exactly like an honest empty search', () => {
    const rng = makeRng(13);
    const spot = makePractice('count-outs', rng);
    const graded = spot.grade([]);
    equal(graded.hits.length, 0, 'an empty pick found a hit');
    equal(graded.wrong.length, 0, 'an empty pick was marked as a wrong guess');
    assert(graded.missed.length > 0, 'an empty pick missed nothing, so this spot has no real outs to test with');
    assert(!graded.correct, 'an empty pick graded as a perfect answer');
  });
});

describe("\"I don't know\": drill and lesson questions never let the sentinel sneak in as a real key", () => {
  it('never equals a generated question\'s answer, across every module', () => {
    const rng = makeRng(23);
    for (const moduleId of DRILL_MODULE_IDS) {
      for (let i = 0; i < 15; i++) {
        const q = generateQuestion(moduleId, rng, 1 + (i % 6));
        assert(q.answer !== IDK, `${moduleId}: a real question's answer key collided with IDK`);
        for (const option of q.options) {
          assert(option.key !== IDK, `${moduleId}: a real option key collided with IDK`);
        }
      }
    }
  });

  it('never equals a range-trainer answer, across every checkpoint', () => {
    const rng = makeRng(29);
    for (const checkpoint of CHECKPOINTS) {
      for (let i = 0; i < 20; i++) {
        const q = rangeQuestion(checkpoint, rng, new Set());
        assert(q.answer !== IDK, `${checkpoint.key}: a real answer collided with IDK`);
        for (const option of q.options) assert(option !== IDK, `${checkpoint.key}: a real option collided with IDK`);
      }
    }
  });
});

describe("\"I don't know\": every graded surface offers the button", () => {
  // A source scan rather than a live render — this project has no DOM shim
  // under the unit runner, and the e2e suite already drives the real
  // buttons in a real browser. What this catches is the class of bug it
  // was written to catch: wiring the button in one place and forgetting the
  // handler, or the reverse — which happened three times while building
  // this, once in each of feltNumberView, priceView and numberView.
  it('is offered on every screen that renders a graded question', () => {
    const surfaces = [
      'ui/screenDrill.js', 'ui/screenWalkthrough.js', 'ui/screenRangeTrainer.js',
      'ui/screenTable.js', 'ui/practiceView.js',
    ];
    for (const file of surfaces) {
      const src = read(file);
      assert(/dontKnowButton\(/.test(src), `${file} never renders the button`);
      assert(/from '\.\/dontKnow\.js'/.test(src), `${file} does not import the shared module`);
    }
  });

  it('never references a skip button it did not define in the same scope', () => {
    // The exact bug this pins: `const skip = dontKnowButton(...)` written in
    // one function while `skip,` was rendered by another — a silent
    // ReferenceError the first time that view actually rendered, and the
    // unit suite above does not touch rendering at all, so nothing else here
    // would have caught it.
    const src = read('ui/practiceView.js');
    const functionBodies = src.split(/\nfunction /).slice(1);
    for (const body of functionBodies) {
      const name = body.slice(0, body.indexOf('(')).trim();
      const definesSkip = /const skip = dontKnowButton/.test(body);
      const rendersSkipVar = /(^|[^.\w])skip,/.test(body);
      if (rendersSkipVar) {
        assert(definesSkip, `${name} renders a bare "skip," variable it never defines`);
      }
    }
  });

  it('is never folded into the real options list, so it cannot shift a keyboard shortcut or an options.length check', () => {
    // Everywhere else in the app assumes q.options / check.options / the
    // rendered .option buttons are the real, gradeable choices — number-key
    // shortcuts index into them directly. The button has to stay a sibling.
    const drill = read('ui/screenDrill.js');
    assert(!/q\.options\.push|options\.concat\(\[.*IDK/.test(drill), 'IDK was appended to the real options list');
    const rangeTrainer = read('ui/screenRangeTrainer.js');
    assert(!/q\.options\.push|options\.concat\(\[.*IDK/.test(rangeTrainer), 'IDK was appended to the real options list');
  });
});
