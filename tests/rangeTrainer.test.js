import { describe, it, assert, equal } from './harness.js';
import { CHARTS, POSITIONS } from '../src/js/data/ranges.js';
import {
  CHECKPOINTS, STAGES, ASKED, PASS, edgeHands, allHands, checkpointFor, stageAt,
} from '../src/js/data/rangeLadder.js';
import { rangeQuestion } from '../src/js/trainers/rangeTrainer.js';
import { makeRng } from '../src/js/core/rng.js';
import { Profile } from '../src/js/state/profile.js';

describe('range trainer: the questions are the chart and nothing else', () => {
  it('never asks anything but raise, call or fold', () => {
    const rng = makeRng(11);
    const allowed = new Set(['Raise', 'Call', 'Fold']);
    for (const checkpoint of CHECKPOINTS) {
      for (let i = 0; i < 60; i++) {
        const q = rangeQuestion(checkpoint, rng, new Set());
        for (const option of q.options) {
          assert(allowed.has(option), `${checkpoint.key} offered "${option}"`);
        }
        assert(q.options.includes(q.answer), `${checkpoint.key}: the answer is not on the list`);
      }
    }
  });

  it('grades every opening question straight off the chart', () => {
    // The whole point is that the drill and the chart cannot disagree. If the
    // reader learns the chart and the drill marks them wrong, the drill has
    // taught them to distrust the thing they are memorising.
    const rng = makeRng(12);
    const utg = CHECKPOINTS[0];
    for (let i = 0; i < 300; i++) {
      const q = rangeQuestion(utg, rng, new Set());
      const expected = CHARTS.rfi.UTG.has(q.hand) ? 'Raise' : 'Fold';
      equal(q.answer, expected, `${q.hand} from UTG`);
    }
  });

  it('always offers the limp and never rewards it in an unopened pot', () => {
    // Leaving Call off would make the question easier than the table, where
    // the button is right there and calling feels safe.
    const rng = makeRng(13);
    for (const checkpoint of CHECKPOINTS.filter((c) => c.kind === 'open')) {
      let sawCall = false;
      for (let i = 0; i < 80; i++) {
        const q = rangeQuestion(checkpoint, rng, new Set());
        if (q.options.includes('Call')) sawCall = true;
        assert(q.answer !== 'Call', `${checkpoint.key}: limping ${q.hand} was marked correct`);
      }
      assert(sawCall, `${checkpoint.key} never offers the limp`);
    }
  });

  it('asks mostly about the edge of the range, where the mistakes are', () => {
    // Measured: 32-36% of the 169-hand grid has a neighbour that disagrees
    // with it. Drawing uniformly would spend two thirds of a session
    // confirming that aces are a raise.
    const rng = makeRng(14);
    const edge = new Set(edgeHands(CHARTS.rfi.UTG));
    const uniform = edge.size / allHands().length;
    let onEdge = 0;
    const runs = 600;
    for (let i = 0; i < runs; i++) {
      if (edge.has(rangeQuestion(CHECKPOINTS[0], rng, new Set()).hand)) onEdge++;
    }
    const share = onEdge / runs;
    assert(share > uniform * 1.8,
      `only ${(100 * share).toFixed(0)}% of questions came off the edge; uniform would already give ${(100 * uniform).toFixed(0)}%`);
  });

  it('does not ask the same hand twice while a run has anywhere else to go', () => {
    const rng = makeRng(15);
    const asked = new Set();
    for (let i = 0; i < ASKED; i++) {
      const q = rangeQuestion(CHECKPOINTS[0], rng, asked);
      assert(!asked.has(q.hand), `${q.hand} was asked twice inside one run`);
      asked.add(q.hand);
    }
  });
});

describe('range trainer: the support comes off', () => {
  it('removes the chart one rung at a time and ends with a clock', () => {
    equal(STAGES[0].showsChart, true, 'the first rung should show the chart');
    equal(!!STAGES[1].showsChart, false, 'the second rung should not show it unasked');
    equal(STAGES[1].canPeek, true, 'the second rung should allow a peek');
    equal(!!STAGES[2].showsChart, false, 'the last rung should not show the chart');
    assert(STAGES[2].seconds > 0, 'the last rung should be timed — that is the point of it');
    // A ladder that never removes the chart teaches chart-reading.
    assert(STAGES.some((s) => !s.showsChart && !s.canPeek), 'no rung is unaided');
  });

  it('only clears a checkpoint on the unaided rung', () => {
    const p = new Profile();
    p.noteRangeRun('open:UTG', { right: 15, asked: ASKED, stage: 0, pass: PASS });
    assert(!p.rangeProgress('open:UTG').cleared, 'cleared while the chart was on screen');
    p.noteRangeRun('open:UTG', { right: 15, asked: ASKED, stage: 1, pass: PASS });
    assert(!p.rangeProgress('open:UTG').cleared, 'cleared on the rung where peeking is allowed');
    p.noteRangeRun('open:UTG', { right: 12, asked: ASKED, stage: 2, pass: PASS });
    assert(p.rangeProgress('open:UTG').cleared, 'the unaided rung did not clear it');
  });

  it('does not take back a rung after a bad run', () => {
    // The ladder asks for practice; punishing practice is how a reader stops.
    const p = new Profile();
    for (const stage of [0, 1, 2]) {
      p.noteRangeRun('open:CO', { right: 13, asked: ASKED, stage, pass: PASS });
    }
    const before = p.rangeProgress('open:CO');
    p.noteRangeRun('open:CO', { right: 1, asked: ASKED, stage: 2, pass: PASS });
    const after = p.rangeProgress('open:CO');
    equal(after.stage, before.stage, 'a bad run cost a rung');
    equal(after.cleared, true, 'a bad run un-cleared a checkpoint');
  });

  it('counts a peeked answer as not known', () => {
    const p = new Profile();
    // Fifteen right, but every one of them looked up: that is not a pass.
    const result = p.noteRangeRun('open:HJ', { right: PASS - 1, asked: ASKED, peeks: 9, stage: 1, pass: PASS });
    assert(!result.passed, 'passed a rung on looked-up answers');
    equal(p.rangeProgress('open:HJ').peeks, 9, 'peeks are not recorded');
  });
});

describe('range trainer: the ladder is finite and ends somewhere', () => {
  it('has an end, and the end is unaided', () => {
    const exam = CHECKPOINTS[CHECKPOINTS.length - 1];
    equal(exam.kind, 'exam', 'the ladder does not end in an exam');
    equal(exam.only, 'blind', 'the exam offers the chart');
    assert(CHECKPOINTS.length <= 10, `${CHECKPOINTS.length} checkpoints is an endless list, not a ladder`);
  });

  it('covers every position the charts have a range for', () => {
    const seats = CHECKPOINTS.filter((c) => c.kind === 'open').map((c) => c.seat).sort();
    const charted = Object.keys(CHARTS.rfi).sort();
    equal(seats.join(','), charted.join(','), 'a charted position has no checkpoint');
    assert(CHECKPOINTS.some((c) => c.seat === 'BB'), 'the big blind has no checkpoint');
  });

  it('asks enough to mean something, and a pass is most of them', () => {
    assert(ASKED >= 10, `${ASKED} questions is too few to tell knowing from guessing`);
    assert(PASS / ASKED >= 0.75, `passing at ${PASS}/${ASKED} is a coin flip, not knowing it`);
  });

  it('draws the exam from every kind of spot, because the table does not announce them', () => {
    const rng = makeRng(16);
    const kinds = new Set();
    for (let i = 0; i < 200; i++) {
      const q = rangeQuestion(checkpointFor('exam'), rng, new Set());
      kinds.add(q.raiser === null ? 'open' : q.seat === 'BB' ? 'defend' : 'threebet');
    }
    equal(kinds.size, 3, `the exam only ever asked about: ${[...kinds].join(', ')}`);
  });
});
