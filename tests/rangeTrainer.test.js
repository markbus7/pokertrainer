import { describe, it, assert, equal } from './harness.js';
import { CHARTS, POSITIONS } from '../src/js/data/ranges.js';
import {
  CHECKPOINTS, STAGES, ASKED, PASS, edgeHands, allHands, checkpointFor, stageAt,
} from '../src/js/data/rangeLadder.js';
import { rangeQuestion, rangeQuestionForHand, edgePoolFor } from '../src/js/trainers/rangeTrainer.js';
import { makeRng } from '../src/js/core/rng.js';
import { Profile } from '../src/js/state/profile.js';
import { handKey } from '../src/js/core/cards.js';
import { readFileSync } from 'node:fs';

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

  it('grades every "facing a raise" question straight off the chart, three ways', () => {
    // Same guarantee as the opening chart, extended to a three-way answer:
    // the drill and the chart cannot disagree, whichever of the three it
    // lands on.
    const rng = makeRng(16);
    const threebet = CHECKPOINTS.find((c) => c.kind === 'threebet');
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const q = rangeQuestion(threebet, rng, new Set());
      const three = CHARTS.threeBet[q.seat];
      const call = CHARTS.callVsRaise[q.seat];
      const expected = three.all.has(q.hand) ? 'Raise' : call.has(q.hand) ? 'Call' : 'Fold';
      equal(q.answer, expected, `${q.hand} from ${q.seat}`);
      seen.add(q.answer);
    }
    for (const outcome of ['Raise', 'Call', 'Fold']) {
      assert(seen.has(outcome), `300 questions never once produced ${outcome}`);
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

describe('range trainer: a pass is a sample, and cleared wants the whole boundary', () => {
  it('names the same edge the draw already leans on, for a single fixed range', () => {
    const utg = CHECKPOINTS.find((c) => c.key === 'open:UTG');
    const pool = edgePoolFor(utg);
    const expected = edgeHands(CHARTS.rfi.UTG);
    equal(pool.length, expected.length, 'the pool size does not match the chart edge');
    for (const hand of expected) assert(pool.includes(hand), `${hand} is on the chart edge but not in the pool`);
  });

  it('unions the edge across every raiser or seat a compound checkpoint can land on', () => {
    const defend = CHECKPOINTS.find((c) => c.key === 'defend:BB');
    const pool = new Set(edgePoolFor(defend));
    // A hand that is only ever an edge case against one particular raiser
    // still has to show up in the pool, or that raiser's boundary would
    // never get covered.
    let foundOne = false;
    for (const raiser of POSITIONS.filter((p) => CHARTS.bbDefend[p])) {
      for (const hand of edgeHands(CHARTS.bbDefend[raiser])) {
        assert(pool.has(hand), `${hand} is an edge case against a ${raiser} open but missing from the pool`);
        foundOne = true;
      }
    }
    assert(foundOne, 'the test itself found no edge hands to check');
  });

  it('opts the exam out, the same way weak-hand tracking already does', () => {
    const exam = CHECKPOINTS.find((c) => c.kind === 'exam');
    equal(edgePoolFor(exam).length, 0, 'the exam has a boundary to cover, and it should not');
  });

  it('counts what has actually been asked, not what has been answered right', () => {
    const p = new Profile();
    p.recordRangeHand('open:UTG', 'AJo', false);
    p.recordRangeHand('open:UTG', 'K9s', true);
    const coverage = p.rangeCoverage('open:UTG', ['AJo', 'K9s', 'T8s']);
    equal(coverage.seen, 2, 'a right answer did not count as seen');
    equal(coverage.total, 3);
    assert(!coverage.complete, 'a hand never asked was counted as covered');
  });

  it('a good sample of fifteen does not clear a boundary of more than fifteen', () => {
    const p = new Profile();
    // Every one of these fifteen is answered right, on the blind rung — the
    // old bar for "cleared" — but the checkpoint's edge is larger than
    // fifteen hands, and none of the rest have ever been asked.
    const result = p.noteRangeRun('open:UTG', {
      right: PASS, asked: ASKED, stage: 2, pass: PASS, covered: false,
    });
    assert(result.passed, 'the run itself did not pass');
    assert(!result.cleared, 'fifteen right answers cleared a boundary nobody has fully seen');
    assert(!p.rangeProgress('open:UTG').cleared);
  });

  it('clears once the boundary actually has been seen, not before', () => {
    const p = new Profile();
    p.noteRangeRun('open:UTG', { right: PASS, asked: ASKED, stage: 2, pass: PASS, covered: false });
    assert(!p.rangeProgress('open:UTG').cleared, 'set up wrong: already cleared before the covered run');
    const result = p.noteRangeRun('open:UTG', { right: PASS, asked: ASKED, stage: 2, pass: PASS, covered: true });
    assert(result.cleared, 'a fully covered, passing run still did not clear it');
  });
});

describe('range trainer: a "cleared" earned before coverage counted gets re-checked once', () => {
  it('downgrades a checkpoint that was cleared without ever seeing its boundary', () => {
    const p = new Profile({
      ranges: { 'open:UTG': { stage: 2, cleared: true, runs: 3, peeks: 0, best: 15, hands: { AA: '1' } } },
    });
    const pool = edgePoolFor(CHECKPOINTS.find((c) => c.key === 'open:UTG'));
    p.migrateEdgeCoverage({ 'open:UTG': pool });
    assert(!p.rangeProgress('open:UTG').cleared, 'a badge earned on a single seen hand survived the re-check');
    // Stage and history are not the thing that changed shape here — only
    // the bar "cleared" has to clear. Punishing a bad run already does not
    // take a rung away, and this should not either.
    equal(p.rangeProgress('open:UTG').stage, 2, 'the re-check took the rung away, not just the badge');
  });

  it('leaves a checkpoint alone whose boundary really was fully seen', () => {
    const utg = CHECKPOINTS.find((c) => c.key === 'open:UTG');
    const pool = edgePoolFor(utg);
    const hands = Object.fromEntries(pool.map((h) => [h, '1']));
    const p = new Profile({
      ranges: { 'open:UTG': { stage: 2, cleared: true, runs: 3, peeks: 0, best: 15, hands } },
    });
    p.migrateEdgeCoverage({ 'open:UTG': pool });
    assert(p.rangeProgress('open:UTG').cleared, 'a genuinely earned badge was taken away');
  });

  it('runs exactly once, and does not undo progress earned after it ran', () => {
    const utg = CHECKPOINTS.find((c) => c.key === 'open:UTG');
    const pool = edgePoolFor(utg);
    const p = new Profile({
      ranges: { 'open:UTG': { stage: 2, cleared: true, runs: 1, peeks: 0, best: 15, hands: { AA: '1' } } },
    });
    p.migrateEdgeCoverage({ 'open:UTG': pool });
    assert(!p.rangeProgress('open:UTG').cleared, 'set up wrong: the first pass did not downgrade it');
    // Earn it properly, the way the ladder itself would after the downgrade.
    for (const hand of pool) p.recordRangeHand('open:UTG', hand, true);
    p.noteRangeRun('open:UTG', { right: PASS, asked: ASKED, stage: 2, pass: PASS, covered: true });
    assert(p.rangeProgress('open:UTG').cleared, 'set up wrong: could not earn it back');
    p.migrateEdgeCoverage({ 'open:UTG': pool });
    assert(p.rangeProgress('open:UTG').cleared, 'a second migration pass erased progress earned after the first');
  });
});

describe('range trainer: facing a raise changed shape, so stale progress resets', () => {
  it('wipes progress recorded against the old binary raise-or-fold version, once', () => {
    // "Facing a raise" used to be raise-or-fold; adding a call option makes
    // it a different question, so a "cleared" badge and a weak-hand window
    // earned against the old one do not mean anything against the new one.
    const stale = {
      ranges: {
        threebet: { stage: 2, cleared: true, runs: 4, peeks: 0, best: 15, hands: { AKo: '0' } },
        'open:UTG': { stage: 2, cleared: true, runs: 3, peeks: 0, best: 14, hands: { AA: '0' } },
      },
    };
    const p = new Profile(stale);
    assert(!p.rangeProgress('threebet').cleared, 'stale progress on the changed checkpoint survived');
    equal(p.weakRangeHands(['threebet']).length, 0, 'stale weak-hand history on it survived');
    // Untouched: only the checkpoint whose decision shape actually changed resets.
    assert(p.rangeProgress('open:UTG').cleared, 'an unrelated checkpoint was reset too');
    equal(p.weakRangeHands(['open:UTG']).length, 1, 'an unrelated checkpoint lost its weak-hand history');
  });

  it('does not wipe it again on a later load, including fresh progress earned after the reset', () => {
    const stale = { ranges: { threebet: { stage: 2, cleared: true, runs: 1, peeks: 0, best: 15 } } };
    const p = new Profile(stale);
    p.noteRangeRun('threebet', { right: 13, asked: ASKED, stage: 2, pass: PASS });
    assert(p.rangeProgress('threebet').cleared, 'the run just played did not clear it');
    // Reloading from what was just saved must not run the migration again —
    // it would erase the progress earned one line above.
    const reloaded = new Profile(p.data);
    assert(reloaded.rangeProgress('threebet').cleared, 'a second load re-ran the migration and erased fresh progress');
  });
});

describe('range trainer: it remembers which hands you actually miss', () => {
  it('never surfaces a hand that has not been missed', () => {
    const p = new Profile();
    p.recordRangeHand('open:UTG', 'AA', true);
    p.recordRangeHand('open:UTG', 'AA', true);
    equal(p.weakRangeHands(['open:UTG']).length, 0, 'a hand with no misses was called weak');
  });

  it('surfaces a hand with a real miss in its recent window', () => {
    const p = new Profile();
    p.recordRangeHand('open:UTG', '72o', false);
    const weak = p.weakRangeHands(['open:UTG']);
    equal(weak.length, 1);
    equal(weak[0].hand, '72o');
    equal(weak[0].checkpointKey, 'open:UTG');
  });

  it('a peeked or aided answer is not something to record at all', () => {
    // Nothing in the profile decides "aided" — that judgement is the
    // screen's, made once before ever calling recordRangeHand. This just
    // proves the reverse holds: never calling it leaves nothing to surface.
    const p = new Profile();
    equal(p.weakRangeHands(['open:UTG']).length, 0, 'a checkpoint with no recorded hands found one anyway');
  });

  it('the window forgets: enough right answers since retire a miss', () => {
    const p = new Profile();
    p.recordRangeHand('open:BTN', 'K9o', false);
    assert(p.weakRangeHands(['open:BTN']).length === 1, 'the first miss did not register');
    for (let i = 0; i < 5; i++) p.recordRangeHand('open:BTN', 'K9o', true);
    equal(p.weakRangeHands(['open:BTN']).length, 0,
      'five right answers since did not push the one miss out of the window');
  });

  it('ranks the worst share first, and a fresher miss ahead of a diluted one', () => {
    const p = new Profile();
    // 1 of 1 wrong: the worst possible share.
    p.recordRangeHand('open:CO', 'J9o', false);
    // 1 of 3 wrong, same absolute miss count, better share.
    p.recordRangeHand('open:CO', 'Q8s', false);
    p.recordRangeHand('open:CO', 'Q8s', true);
    p.recordRangeHand('open:CO', 'Q8s', true);
    const weak = p.weakRangeHands(['open:CO']);
    equal(weak[0].hand, 'J9o', 'the 100%-wrong hand should rank first');
    equal(weak[1].hand, 'Q8s');
  });

  it('mixes across every checkpoint it is asked about, and none it is not', () => {
    const p = new Profile();
    p.recordRangeHand('open:UTG', 'A5o', false);
    p.recordRangeHand('open:BTN', 'K4s', false);
    p.recordRangeHand('threebet', 'Q9s', false);

    const mixed = p.weakRangeHands(['open:UTG', 'open:BTN', 'threebet']);
    equal(mixed.length, 3, 'a mixed pull did not find every checkpoint it was given');

    const utgOnly = p.weakRangeHands(['open:UTG']);
    equal(utgOnly.length, 1, 'asking for one checkpoint leaked another one in');
    equal(utgOnly[0].hand, 'A5o');
  });

  it('respects the limit, worst-first', () => {
    const p = new Profile();
    const hands = ['A2o', 'A3o', 'A4o', 'A5o', 'A6o'];
    for (const h of hands) p.recordRangeHand('open:SB', h, false);
    equal(p.weakRangeHands(['open:SB'], 2).length, 2, 'the limit was not respected');
  });

  it('a miss survives the run finishing, not just the question being answered', () => {
    // The screen calls recordRangeHand once per question, then noteRangeRun
    // once at the end of the whole rung. noteRangeRun used to rebuild the
    // checkpoint's stored progress from scratch and drop the hands map that
    // recordRangeHand had just written — so every miss vanished the instant
    // the rung you missed it on was completed, and the weak-hands panel
    // never had anything to show.
    const p = new Profile();
    p.recordRangeHand('open:UTG', '72o', false);
    p.noteRangeRun('open:UTG', { right: PASS, asked: ASKED, stage: 1, pass: PASS });
    const weak = p.weakRangeHands(['open:UTG']);
    equal(weak.length, 1, 'the miss did not survive the rung being completed');
    equal(weak[0].hand, '72o');
  });
});

describe('range trainer: a weak hand can be asked about again on purpose', () => {
  it('asks about the requested hand, not a drawn one, for every kind of checkpoint', () => {
    const rng = makeRng(51);
    const cases = [
      [checkpointFor('open:UTG'), 'AKo'],
      [checkpointFor('defend:BB'), 'T9s'],
      [checkpointFor('threebet'), '65s'],
    ];
    for (const [checkpoint, hand] of cases) {
      for (let i = 0; i < 10; i++) {
        const q = rangeQuestionForHand(checkpoint, hand, rng);
        equal(q.hand, hand, `${checkpoint.key} did not ask about the hand it was told to`);
      }
    }
  });

  it('still grades the forced hand straight off the chart', () => {
    const rng = makeRng(52);
    const utg = checkpointFor('open:UTG');
    const inRange = CHARTS.rfi.UTG.has('AKo') ? 'Raise' : 'Fold';
    const q = rangeQuestionForHand(utg, 'AKo', rng);
    equal(q.answer, inRange, 'the forced-hand question disagreed with the chart');
    assert(q.options.includes(q.answer), 'the graded answer is not even on the option list');
  });

  it('deals real cards for the forced hand too', () => {
    const rng = makeRng(53);
    const q = rangeQuestionForHand(checkpointFor('open:BTN'), 'J9s', rng);
    equal(handKey(q.cards), 'J9s', 'the dealt cards do not match the requested hand');
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

describe('range trainer: the question is readable without already knowing it', () => {
  it('deals real cards for every hand it names', () => {
    // "88" is correct notation and says nothing to somebody still learning to
    // read it — and for every non-pair it hides the one thing that decides
    // the answer. The reader asked outright: "what is 88? Are that cards, and
    // suited or offsuit?"
    const rng = makeRng(31);
    for (const checkpoint of CHECKPOINTS) {
      for (let i = 0; i < 40; i++) {
        const q = rangeQuestion(checkpoint, rng, new Set());
        assert(Array.isArray(q.cards) && q.cards.length === 2,
          `${checkpoint.key}: ${q.hand} came with no cards`);
      }
    }
  });

  it('never shows cards that are a different hand from the one it asks about', () => {
    // The cards and the notation have to be the same hand, or the reader is
    // marked against a chart entry for a hand they were not shown. Checked by
    // reading the cards back through the same function the engine uses.
    const rng = makeRng(32);
    for (const checkpoint of CHECKPOINTS) {
      for (let i = 0; i < 60; i++) {
        const q = rangeQuestion(checkpoint, rng, new Set());
        equal(handKey(q.cards), q.hand,
          `${checkpoint.key}: asked about ${q.hand} and dealt ${handKey(q.cards)}`);
      }
    }
  });

  it('draws suited hands in one suit and offsuit hands in two', () => {
    const rng = makeRng(33);
    const suitOf = (card) => card % 4;
    for (let i = 0; i < 200; i++) {
      const q = rangeQuestion(CHECKPOINTS[3], rng, new Set());
      const same = suitOf(q.cards[0]) === suitOf(q.cards[1]);
      if (q.hand.endsWith('s')) assert(same, `${q.hand} was dealt in two suits`);
      if (q.hand.endsWith('o')) assert(!same, `${q.hand} was dealt in one suit`);
      if (q.hand.length === 2) assert(!same, `the pair ${q.hand} was dealt as two of the same card`);
    }
  });

  it('shows the table, so a seat name is something you can see', () => {
    // "Under the gun" is a phrase you have to have been taught. Two seats to
    // the left of the button is something you can look at.
    const src = readFileSync(new URL('../src/js/ui/screenRangeTrainer.js', import.meta.url), 'utf8');
    assert(/seatFelt\(/.test(src), 'the question does not draw the table');
    assert(/heroPosition: state\.question\.seat/.test(src),
      'the table is not built around the seat the question puts you in');
    // Rebuilding it per redraw would move the button while it is being read.
    assert(/state\.ring = seatRing/.test(src) && !/seatRing\(rng, \{ heroPosition: q\./.test(src),
      'the seat picture is rebuilt on every redraw');
  });

  it('can hand a spot back without a screenshot', () => {
    const src = readFileSync(new URL('../src/js/ui/screenRangeTrainer.js', import.meta.url), 'utf8');
    assert(/copyButton\(/.test(src), 'there is no way to copy a question out of the trainer');
  });
});

describe('range trainer: the picture is a real table', () => {
  it('marks the dealer and both blinds, not only the button', () => {
    // A table with one marker on it makes you count seats to work out who
    // pays what. A real one shows all three, and the felt draws every table
    // in the app — the question, the lessons and the game itself.
    const src = readFileSync(new URL('../src/js/ui/feltView.js', import.meta.url), 'utf8');
    assert(/table-marker\.dealer/.test(src), 'the dealer button is not drawn');
    assert(/blind\.sb/.test(src) && /blind\.bb/.test(src), 'the blinds are not marked');
    assert(!/dealer-button/.test(src), 'the old single-marker class is still being rendered');
  });

  it('shows the cards and lets the chart carry the notation', () => {
    const src = readFileSync(new URL('../src/js/ui/screenRangeTrainer.js', import.meta.url), 'utf8');
    assert(/cardRow\(q\.cards/.test(src), 'the hand is not shown as cards');
    assert(!/hand-big|hand-note/.test(src), 'the notation is printed beside its own cards');
  });

  it('does not name the hand in the prompt either', () => {
    const rng = makeRng(41);
    for (const checkpoint of CHECKPOINTS) {
      for (let i = 0; i < 30; i++) {
        const q = rangeQuestion(checkpoint, rng, new Set());
        assert(!q.prompt.includes(q.hand),
          `${checkpoint.key}: the prompt says "${q.hand}" with the cards right under it`);
      }
    }
  });
});
