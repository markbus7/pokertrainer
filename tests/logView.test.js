/**
 * The Log, sorted: one street at a time, the dearest hands first, and the
 * street that costs the most named only when the hands bear it out.
 */

import { describe, it, assert, equal } from './harness.js';
import { LOG_FILTERS, filterHands, filterCounts, sortHands, leakByStreet } from '../src/js/state/logView.js';

/** A kept hand, with the review the Log would give it written on it. */
const hand = (id, kind, street, costBb, extra = {}) => ({ id, kind, street, costBb, ...extra });
const review = (h) => ({ kind: h.kind, street: h.street, costBb: h.costBb, costKnown: h.costKnown });

const HANDS = [
  hand('a', 'mistake', 'turn', 6),
  hand('b', 'mistake', 'preflop', 0, { costKnown: false }),
  hand('c', 'cooler', 'river', 0),
  hand('d', 'mistake', 'turn', 14, { retry: { fixed: true } }),
  hand('e', 'mistake', 'river', 9),
  hand('f', 'mistake', 'flop', 2.5),
];
const ids = (list) => list.map((h) => h.id).join('');

describe('the Log, one street at a time', () => {
  it('keeps every hand when nothing is picked, or when the pick is not a filter', () => {
    equal(ids(filterHands(HANDS, 'all', review)), 'abcdef');
    equal(ids(filterHands(HANDS, 'nonsense', review)), 'abcdef');
    equal(filterHands(null, 'turn', review).length, 0);
  });

  it('shows a street by where the costliest mistake was made, and leaves the coolers out of it', () => {
    equal(ids(filterHands(HANDS, 'turn', review)), 'ad');
    equal(ids(filterHands(HANDS, 'river', review)), 'e', 'the cooler that went to the river is not a river mistake');
    equal(ids(filterHands(HANDS, 'cooler', review)), 'c');
  });

  it('"still open" is the mistakes not yet put right', () => {
    equal(ids(filterHands(HANDS, 'open', review)), 'abef');
  });

  it('counts what each filter would show, and the counts agree with the lists', () => {
    const counts = filterCounts(HANDS, review);
    for (const key of LOG_FILTERS) equal(counts[key], filterHands(HANDS, key, review).length, key);
    equal(counts.all, 6);
    equal(counts.turn, 2);
  });
});

describe('the Log, dearest first', () => {
  it('leaves the order alone unless cost is asked for', () => {
    equal(ids(sortHands(HANDS, 'new', review)), 'abcdef');
    assert(sortHands(HANDS, 'new', review) !== HANDS, 'the list handed back is a copy');
  });

  it('puts the dearest mistake first, an unpriced one after the priced, and coolers last', () => {
    equal(ids(sortHands(HANDS, 'cost', review)), 'deafbc');
  });

  it('keeps the order they came in between hands that cost the same', () => {
    const same = [hand('x', 'mistake', 'flop', 3), hand('y', 'mistake', 'turn', 3), hand('z', 'mistake', 'river', 3)];
    equal(ids(sortHands(same, 'cost', review)), 'xyz');
  });
});

describe('where the money goes', () => {
  it('adds the mistakes up by street, and each street\'s share of the whole', () => {
    const leak = leakByStreet(HANDS, review);
    equal(leak.rows.map((r) => r.street).join(), 'preflop,flop,turn,river');
    const turn = leak.rows.find((r) => r.street === 'turn');
    equal(turn.hands, 2);
    equal(turn.costBb, 20);
    equal(leak.total, 31.5);
    assert(Math.abs(turn.share - 20 / 31.5) < 1e-9, 'the turn\'s share');
    equal(leak.rows.find((r) => r.street === 'preflop').costBb, 0, 'an unpriced mistake counts as a hand, not as a cost');
    equal(leak.rows.find((r) => r.street === 'preflop').hands, 1);
  });

  it('names the dearest street', () => {
    equal(leakByStreet(HANDS, review).worst.street, 'turn');
  });

  it('names none on one hand, however dear, nor a cheaper street in its place', () => {
    const one = [hand('a', 'mistake', 'river', 40), hand('b', 'mistake', 'flop', 1), hand('c', 'mistake', 'flop', 1)];
    equal(leakByStreet(one, review).worst, null, 'the river is one hand, and the flop does not cost the most');
    equal(leakByStreet([hand('a', 'mistake', 'river', 40)], review).worst, null);
  });

  it('names none when two streets cost the same, or when nothing is kept', () => {
    const tie = [hand('a', 'mistake', 'flop', 5), hand('b', 'mistake', 'flop', 5), hand('c', 'mistake', 'turn', 4), hand('d', 'mistake', 'turn', 6)];
    equal(leakByStreet(tie, review).worst, null);
    const none = leakByStreet([], review);
    equal(none.worst, null);
    equal(none.total, 0);
    equal(none.rows.every((r) => r.share === 0), true);
  });
});
