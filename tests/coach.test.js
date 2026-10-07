/**
 * The coach at the table: naming the skill a spot is asking, and grading it
 * the way that skill is graded.
 *
 * The load-bearing test is the preflop one. The range charts were drilled in
 * five generators and two exercises and then not enforced anywhere you
 * actually played: the old grader asked "is the equity worth the price", and
 * preflop with nobody betting there is no price, so opening 72o under the gun
 * drew no comment at all.
 */

import { describe, it, assert, equal } from './harness.js';
import { parseCards, handKey, ALL_HAND_KEYS, expandHandKey } from '../src/js/core/cards.js';
import { evaluateHand, categoryOf, CAT } from '../src/js/core/evaluator.js';
import { outsToImprove } from '../src/js/core/equity.js';
import { conceptOf } from '../src/js/core/spotConcept.js';
import { judgeSpot, overall } from '../src/js/core/coach.js';
import { CHARTS, preflopAdvice } from '../src/js/data/ranges.js';
import { MODULE_META } from '../src/js/data/curriculum.js';

const at = (extra) => ({
  street: 'flop', toCall: 0, pot: 100, bigBlind: 2, equity: 0.4,
  opponents: 1, effectiveStack: 200, ...extra,
});

const spotFor = (hand, board, extra = {}) => {
  const hole = parseCards(hand);
  const cards = parseCards(board);
  return at({
    hole,
    board: cards,
    madeCategory: categoryOf(evaluateHand(hole, cards)),
    outs: outsToImprove(hole, cards),
    ...extra,
  });
};

describe('the coach names the skill a spot is asking', () => {
  it('calls every decision something the curriculum teaches', () => {
    // A name nothing in the app can teach would be worse than no name: the
    // coach would send you to a lesson that does not exist.
    const ids = new Set(MODULE_META.map((m) => m.id));
    const seen = new Set();
    for (const street of ['preflop', 'flop', 'turn', 'river']) {
      for (const toCall of [0, 20, 90]) {
        for (const equity of [0.1, 0.3, 0.5, 0.7, 0.95]) {
          for (const outs of [0, 8]) {
            for (const made of [CAT.HIGH_CARD, CAT.PAIR, CAT.TRIPS]) {
              for (const wasAggressor of [true, false]) {
                for (const effectiveStack of [40, 400]) {
                  const c = conceptOf(at({
                    street, toCall, equity, outs, madeCategory: made, wasAggressor,
                    effectiveStack, firstIn: street === 'preflop' && toCall === 0,
                  }));
                  assert(ids.has(c.id), `"${c.id}" is not a module the game teaches`);
                  assert(c.why && c.why.length > 12, `${c.id} gave no reason`);
                  seen.add(c.id);
                }
              }
            }
          }
        }
      }
    }
    assert(seen.size >= 7, `only ${seen.size} skills ever come up: ${[...seen].join(', ')}`);
  });

  it('knows a draw from a made hand facing the same bet', () => {
    equal(conceptOf(spotFor('Ah Kh', '7h 2h 9c', { toCall: 60 })).id, 'outs');
    equal(conceptOf(spotFor('Ac 7d', '7h Ks 2c', { toCall: 60 })).id, 'mdf');
    equal(conceptOf(spotFor('7c 4d', 'Ah Ks 9h', { toCall: 60 })).id, 'pot-odds');
  });

  it('knows a continuation bet from any other check-to', () => {
    equal(conceptOf(spotFor('Ad Qh', 'Ks 7d 2c', { toCall: 0, wasAggressor: true })).id, 'cbet');
    equal(conceptOf(spotFor('Ad Qh', 'Ks 7d 2c', { toCall: 0, wasAggressor: false, equity: 0.2 })).id, 'bluffing');
  });
});

describe('preflop is graded against the chart, everywhere you play', () => {
  it('condemns an open the chart does not contain', () => {
    const v = judgeSpot(at({
      street: 'preflop', toCall: 2, pot: 3, firstIn: true, action: 'raise',
      hole: parseCards('7d 2c'), position: 'UTG', opponents: 5,
    }));
    equal(v.concept.id, 'preflop');
    equal(v.level, 'bad');
    equal(v.better, 'Fold');
  });

  it('condemns folding a hand the seat plays', () => {
    const v = judgeSpot(at({
      street: 'preflop', toCall: 2, pot: 3, firstIn: true, action: 'fold',
      hole: parseCards('Ad Ks'), position: 'BTN', opponents: 2,
    }));
    equal(v.level, 'bad');
    assert(/plays/.test(v.head), v.head);
  });

  it('condemns a limp whatever the hand is', () => {
    for (const hand of ['Ad As', '7d 2c']) {
      const v = judgeSpot(at({
        street: 'preflop', toCall: 2, pot: 3, firstIn: true, action: 'call',
        hole: parseCards(hand), position: 'CO', opponents: 3,
      }));
      equal(v.level, 'bad', `limping ${hand} should never be right`);
    }
  });

  it('agrees with the drills about every hand in every seat', () => {
    // The drills grade preflop against these charts and so does the table
    // now. If they ever disagreed, the game would be marking the same hand
    // right in one place and wrong in the other.
    let checked = 0;
    for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
      for (const key of ALL_HAND_KEYS) {
        const advice = preflopAdvice(key, position);
        const correct = advice.action === 'raise' ? 'raise' : 'fold';
        const v = judgeSpot(at({
          street: 'preflop', toCall: 2, pot: 3, firstIn: true, action: correct,
          hole: expandHandKey(key)[0], position, opponents: 4,
        }));
        equal(v.level, 'good', `${key} from ${position}: the chart says ${correct} and the coach disagreed`);
        checked++;
      }
    }
    equal(checked, 5 * 169);
  });

  it('never grades a hand the chart has no opinion on', () => {
    // Every one of the 169 starting hands is in or out of every chart, so
    // there is no third answer for the coach to fall through to.
    for (const position of Object.keys(CHARTS.rfi)) {
      for (const key of ALL_HAND_KEYS) {
        assert(typeof CHARTS.rfi[position].has(key) === 'boolean');
      }
    }
    equal(handKey(parseCards('Ad Ks')), 'AKo');
  });
});

describe('preflop against an open or a limp says what you did, not something else', () => {
  const vs = (hand, position, action, raiser = 'CO', extra = {}) => judgeSpot(at({
    street: 'preflop', toCall: 4, pot: 9, currentBet: 6, firstIn: false, raiser, action,
    hole: parseCards(hand), position, opponents: 2, ...extra,
  }));

  it('calls a 3-bet with a hand the chart flats a 3-bet, not a fold', () => {
    // Pocket eights on the button, re-raising the cutoff: a reader raised and
    // was told "You folded a hand this seat plays", because the grader had no
    // answer for a raise where the chart calls and fell through to the fold.
    const v = vs('8h 8d', 'BTN', 'raise');
    equal(v.concept.id, 'preflop');
    equal(v.id, 'raised-a-call');
    equal(v.level, 'ok', 'a close spot, not a blunder');
    equal(v.better, 'Call');
    assert(!/fold/i.test(v.head), `a raise was described as a fold: ${v.head}`);
  });

  it('marks flatting a value 3-bet as a mistake, and flatting a bluff as close', () => {
    const value = vs('Ah Ad', 'BTN', 'call');
    equal(value.id, 'flatted-value');
    equal(value.level, 'bad');
    equal(value.better, '3-bet');
    const bluffKey = [...CHARTS.threeBet.BTN.bluff][0];
    const bluff = vs('2c 2d', 'BTN', 'call', 'CO', { hole: expandHandKey(bluffKey)[0] });
    equal(bluff.id, 'flatted-bluff');
    equal(bluff.level, 'ok');
  });

  it('calls continuing with a hand that folds to an open too weak', () => {
    for (const action of ['call', 'raise']) {
      const v = vs('7h 2d', 'BTN', action);
      equal(v.id, 'continued-outside-range', action);
      equal(v.better, 'Fold');
    }
  });

  it('grades a raise over a limper against the seat\'s opening chart', () => {
    const limp = (hand, action) => vs(hand, 'BTN', action, null, { toCall: 2, currentBet: 2, pot: 5 });
    equal(limp('8h 8d', 'raise').level, 'good', 'raising eights over a limper on the button is right');
    equal(limp('8h 8d', 'call').id, 'limped-behind');
    equal(limp('7h 2d', 'call').id, 'over-limped');
    equal(limp('7h 2d', 'raise').id, 'opened-outside-range');
    equal(limp('7h 2d', 'fold').level, 'good');
  });

  it('never calls anything but a fold a fold, in any seat against any open', () => {
    let checked = 0;
    const seats = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    for (const [i, raiser] of seats.slice(0, 5).entries()) {
      for (const position of seats.slice(i + 1)) {
        for (const key of ALL_HAND_KEYS) {
          const hole = expandHandKey(key)[0];
          for (const action of ['fold', 'call', 'raise']) {
            const v = judgeSpot(at({
              street: 'preflop', toCall: 4, pot: 9, currentBet: 6, firstIn: false, raiser, action,
              hole, position, opponents: 2,
            }));
            const advice = preflopAdvice(key, position, { action: 'vs_raise', raiser });
            if (action !== 'fold') assert(v.id !== 'folded-in-range', `${key} ${position} vs ${raiser}: a ${action} was called a fold`);
            if (action === 'fold') assert(v.level === 'good' || v.id === 'folded-in-range', `${key} ${position} vs ${raiser}: a fold was called ${v.id}`);
            const wanted = advice.action === 'raise' ? 'raise' : advice.action;
            if (action === wanted) equal(v.level, 'good', `${key} ${position} vs ${raiser}: did what the chart says`);
            else assert(v.better, `${key} ${position} vs ${raiser} ${action}: wrong, with nothing to do instead`);
            checked++;
          }
        }
      }
    }
    equal(checked, 15 * 169 * 3);
  });
});

describe('a continuation bet is graded against the board', () => {
  const cbet = (hand, board, action, extra = {}) => judgeSpot(spotFor(hand, board, {
    toCall: 0, wasAggressor: true, action, pot: 20, currentBet: 0, ...extra,
  }));

  it('wants a small bet on a dry board and says so', () => {
    const v = cbet('Ad Qh', 'Ks 7d 2c', 'bet', { equity: 0.45, amount: 7 });
    equal(v.concept.id, 'cbet');
    equal(v.level, 'good');
  });

  it('calls out bluffing into a board that hit them', () => {
    const v = cbet('Ad Qh', '9h 8h 7s', 'bet', { equity: 0.2, amount: 15 });
    equal(v.level, 'bad');
    assert(v.cost > 0, 'a bluff into a wet board has a measurable cost');
  });

  it('grades the size, not just the decision', () => {
    const small = cbet('Kd Ks', '9h 8h 7h', 'bet', { equity: 0.75, amount: 4 });
    const big = cbet('Kd Ks', '9h 8h 7h', 'bet', { equity: 0.75, amount: 15 });
    equal(small.level, 'ok', 'too small on a monotone board');
    equal(big.level, 'good');
  });

  it('leaves the size to the size grader when the spot carries one', () => {
    // At a real table every bet carries the spot it was sized in, and the size
    // is graded on its own: the bet is right, the size is too small, and the
    // decision counts as the worse of the two.
    const sizing = {
      street: 'flop', bb: 2, pot: 20, currentBet: 0, toCall: 0, stack: 180, allInTo: 180, effective: 180,
      minTo: 2, maxTo: 180, raises: 0, limpers: 0, callers: 0, inPosition: true, position: 'BTN',
      opponents: 1, wet: true, tags: 'monotone, connected', potLimit: false, outs: 0,
    };
    const small = cbet('Kd Ks', '9h 8h 7h', 'bet', { equity: 0.75, amount: 4, sizing });
    equal(small.level, 'good', 'betting the overpair is right');
    equal(small.size.verdict, 'small');
    equal(overall(small).level, 'ok');
    equal(overall(small).head, 'Too small for this board');
    const big = cbet('Kd Ks', '9h 8h 7h', 'bet', { equity: 0.75, amount: 15, sizing });
    equal(big.size.verdict, 'right');
    equal(overall(big), big);
  });

  it('never reports a cost it cannot compute', () => {
    // A range mistake is real and its price is not knowable from one hand.
    // Saying "this cost 4 chips" would be a made-up number dressed as
    // arithmetic, so those verdicts say so instead.
    const range = judgeSpot(at({
      street: 'preflop', toCall: 2, pot: 3, firstIn: true, action: 'raise',
      hole: parseCards('7d 2c'), position: 'UTG', opponents: 5,
    }));
    equal(range.costKnown, false);
    equal(range.cost, 0);
    const priced = cbet('Ad Qh', '9h 8h 7s', 'bet', { equity: 0.2, amount: 15 });
    equal(priced.costKnown, true);
  });
});

describe('the coach survives the spots a real table produces', () => {
  it('does not ask the opening charts about the big blind', () => {
    // The five opening charts cover the seats that can open first in. The big
    // blind is not one of them, and a limped pot leaves the hero there with
    // nobody having raised — which read as "first in" and threw.
    const v = judgeSpot(at({
      street: 'preflop', toCall: 0, pot: 5, firstIn: true, action: 'check',
      hole: parseCards('7d 2c'), position: 'BB', opponents: 2,
    }));
    equal(v.concept.id, 'preflop');
    assert(v.head, 'a verdict came back rather than an exception');
  });

  it('grades every seat and action a hand can reach without throwing', () => {
    const seats = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    let graded = 0;
    for (const position of seats) {
      for (const firstIn of [true, false]) {
        for (const action of ['fold', 'check', 'call', 'raise']) {
          for (const raiser of [null, 'UTG', 'CO']) {
            const v = judgeSpot(at({
              street: 'preflop', toCall: firstIn ? 0 : 6, pot: 9, firstIn, action, raiser,
              hole: parseCards('Th 9h'), position, opponents: 3,
            }));
            assert(v.head && v.level, `${position}/${action} produced no verdict`);
            graded++;
          }
        }
      }
    }
    equal(graded, seats.length * 2 * 4 * 3);
  });
});
