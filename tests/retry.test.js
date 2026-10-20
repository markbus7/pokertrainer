/**
 * Playing a Log mistake again: the spot is the one you went wrong in, the
 * grading is the Log's own, and a fix is kept on the hand.
 */

import { describe, it, assert, equal } from './harness.js';
import { makeRng } from '../src/js/core/rng.js';
import { generateSpot } from '../src/js/trainers/lab.js';
import { handFromLabSpot, keepHand, findHand, frameAt, reviewOf, _useStorage } from '../src/js/state/handHistory.js';
import { retryOf, gradeRetry, retryQueue, isFixed, noteRetry } from '../src/js/state/retry.js';

function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/** A Lab spot answered wrong, so the Log keeps it as a mistake. */
function wrongSpot(seed) {
  const spot = generateSpot('decide', makeRng(seed));
  if (spot.type !== 'decide') return null;
  const wrong = spot.answer === 'call' ? 'fold' : 'call';
  return { spot, hand: handFromLabSpot(spot, wrong), wrong };
}

function spots(n) {
  const out = [];
  for (let seed = 1; out.length < n && seed < 400; seed++) {
    const s = wrongSpot(seed);
    if (s) out.push(s);
  }
  return out;
}

describe('playing a mistake again', () => {
  it('asks the spot you went wrong in, before you acted', () => {
    for (const { hand, wrong } of spots(10)) {
      const spot = retryOf(hand);
      assert(spot, 'a mistake should be askable');
      equal(spot.did, wrong, 'it knows what you did');
      assert(spot.choices.includes('fold') && spot.choices.includes('call'), 'facing a bet: fold or call');
      const frame = frameAt(hand, spot.step);
      equal(frame.actingId, hand.heroId, 'the frame stops with you to act');
    }
  });

  it('marks the Lab answer right and the mistake wrong again', () => {
    let both = 0;
    for (const { spot: lab, hand, wrong } of spots(25)) {
      const spot = retryOf(hand);
      assert(gradeRetry(spot, lab.answer).right, `${lab.answer} was the answer`);
      assert(!gradeRetry(spot, wrong).right, `${wrong} was the mistake`);
      if (lab.answer === 'fold') {
        assert(!gradeRetry(spot, 'raise').right, 'a bluff raise is not the fold the hand was kept for');
        both++;
      }
    }
    assert(both > 0, 'expected some folds among the answers');
  });

  it('agrees with the Log about what was wrong', () => {
    for (const { hand } of spots(10)) {
      const spot = retryOf(hand);
      equal(gradeRetry(spot, spot.did).verdict.id, reviewOf(hand).worst.action.id);
    }
  });

  it('has nothing to ask of a hand played right', () => {
    const { hand } = spots(1)[0];
    const sized = JSON.parse(JSON.stringify(hand));
    sized.decisions[0].action = sized.decisions[0].equity > sized.decisions[0].needed ? 'call' : 'fold';
    equal(retryOf(sized), null, 'a hand played right has nothing to ask');
    equal(retryOf(null), null);
  });

  it('keeps a fix on the hand, and takes it off when it does not hold', () => {
    _useStorage(memoryStore());
    const kept = spots(3).map(({ hand }) => keepHand(hand));
    equal(retryQueue().length, 3);
    equal(retryQueue()[0].id, kept[2].id, 'newest first');

    noteRetry(kept[1].id, true, 1000);
    assert(isFixed(findHand(kept[1].id)), 'right marks it fixed');
    equal(retryQueue().length, 2, 'a fixed one is not asked again in a sitting');
    assert(retryOf(findHand(kept[1].id)), 'but can still be tried on its own');

    noteRetry(kept[1].id, false);
    assert(!isFixed(findHand(kept[1].id)), 'wrong again takes the mark off');
    equal(findHand(kept[1].id).retry.tries, 2);
    equal(noteRetry('gone', true), null, 'a hand that is gone is left alone');
  });
});
