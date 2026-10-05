/**
 * The prizes counted: grading a short stack in a tournament.
 *
 * A cash game grades a call on chips. On the bubble the same call can be a
 * mistake, because the chips you lose cost more than the chips you win are
 * worth. What these pin is that the grader knows the difference — a call that
 * is right when the winner takes all and wrong when three are paid — and that
 * it gets the plain cases right (aces shove, seven-deuce folds), only speaks
 * for a short stack in a tournament, and says everything in Dutch.
 */

import { describe, it, assert, equal } from './harness.js';
import { parseCards } from '../src/js/core/cards.js';
import { judgeIcm, rangeOf, CLOSE } from '../src/js/core/icmJudge.js';
import { judgeSpot } from '../src/js/core/coach.js';
import { conceptOf } from '../src/js/core/spotConcept.js';
import { BUBBLE, BUBBLE_START_HAND, bubbleStacks, START_STACK, FIELD, blindsFor, LEVEL_HANDS } from '../src/js/state/regatta.js';
import { makeRng } from '../src/js/core/rng.js';
import { NL } from '../src/js/i18n/nl.js';

const profile = { aggression: 0.55, callDown: 0.45 };
const BUBBLE_PRIZES = [50, 30, 20];

/** Facing a five-big-blind shove with four and a half of your own. */
const facing = (payouts, hole, action) => ({
  bigBlind: 300, hole: parseCards(hole), action,
  tournament: { stacks: [1100, 0, 3200, 3000], committed: [300, 1500, 0, 0], hero: 0, villain: 1, payouts, profiles: [null, profile, profile, profile], behind: [] },
});

/** First in on the button with five big blinds, three behind. */
const firstIn = (hole, action) => ({
  bigBlind: 300, hole: parseCards(hole), action,
  tournament: { stacks: [1500, 3000, 2500, 1900], committed: [0, 150, 300, 0], hero: 0, villain: null, payouts: BUBBLE_PRIZES, profiles: [null, profile, profile, profile], behind: [3, 1, 2] },
});

describe('the prizes counted: a call is not a call on chips', () => {
  it('says a marginal call is right when the winner takes all and wrong with three paid', () => {
    for (const hand of ['Ts 8s', 'Qd 7c']) {
      equal(judgeIcm(facing([100], hand, 'call')).level, 'good', `${hand}: a chip-EV call was graded wrong`);
      equal(judgeIcm(facing(BUBBLE_PRIZES, hand, 'call')).level, 'bad', `${hand}: the bubble did not tighten the call`);
      equal(judgeIcm(facing(BUBBLE_PRIZES, hand, 'fold')).level, 'good', `${hand}: folding on the bubble was graded wrong`);
    }
  });

  it('still calls the hands that are good on any prize list, and folds the ones that are bad on all', () => {
    for (const payouts of [[100], BUBBLE_PRIZES]) {
      equal(judgeIcm(facing(payouts, 'Ad Kc', 'call')).level, 'good');
      equal(judgeIcm(facing(payouts, 'Ad Kc', 'fold')).level, 'bad', 'folding ace-king to a shove was fine');
      equal(judgeIcm(facing(payouts, '7c 2d', 'call')).level, 'bad');
      equal(judgeIcm(facing(payouts, '7c 2d', 'fold')).level, 'good');
    }
  });

  it('prices a mistake, and prices nothing for a right play', () => {
    const wrong = judgeIcm(facing(BUBBLE_PRIZES, 'Ts 8s', 'call'));
    assert(wrong.costKnown && wrong.cost > 0, 'a mistake carried no price');
    const right = judgeIcm(facing(BUBBLE_PRIZES, 'Ts 8s', 'fold'));
    equal(right.cost, 0);
    equal(right.costKnown, false);
  });
});

describe('the prizes counted: shove or fold, first in', () => {
  it('shoves aces and folds seven-deuce', () => {
    equal(judgeIcm(firstIn('Ah Ad', 'raise')).level, 'good');
    equal(judgeIcm(firstIn('Ah Ad', 'fold')).level, 'bad');
    equal(judgeIcm(firstIn('7h 2c', 'fold')).level, 'good');
    equal(judgeIcm(firstIn('7h 2c', 'raise')).level, 'bad');
  });

  it('counts a bet or a raise as the shove, and a check or a fold as giving it up', () => {
    equal(judgeIcm(firstIn('Ah Ad', 'bet')).level, 'good');
    equal(judgeIcm(firstIn('Ah Ad', 'call')).level, 'good', 'completing with aces is not giving it up');
    equal(judgeIcm(firstIn('7h 2c', 'check')).level, 'good');
  });

  it('is the same grade for the same spot every time', () => {
    const a = judgeIcm(firstIn('Ks Qh', 'raise'));
    const b = judgeIcm(firstIn('Ks Qh', 'raise'));
    equal(JSON.stringify(a), JSON.stringify(b));
  });

  it('never calls both the shove and the fold a mistake', () => {
    for (const hand of ['Ks Qh', 'Jd Ts', 'Qs 9s', '9c 8c', 'Ad 5c', 'Kd 8h', 'Th 6d', '5c 4c']) {
      const a = judgeIcm(firstIn(hand, 'raise'));
      const b = judgeIcm(firstIn(hand, 'fold'));
      assert(!(a.level === 'bad' && b.level === 'bad'), `${hand}: both the shove and the fold are mistakes`);
      assert(a.level !== 'good' || b.level !== 'good' || (a.cost === 0 && b.cost === 0), 'a close spot was priced');
    }
    assert(CLOSE > 0 && CLOSE < 0.02);
  });
});

describe('the prizes counted: when it speaks', () => {
  const base = { street: 'preflop', toCall: 300, pot: 450, effectiveStack: 1500, bigBlind: 300, firstIn: true, seats: 4 };

  it('names a short stack in a tournament for what it is', () => {
    equal(conceptOf({ ...base, tournament: {} }).id, 'icm');
    assert(conceptOf({ ...base, tournament: {} }).why.length > 20);
  });

  it('leaves a deep stack, a cash table and a free check alone', () => {
    assert(conceptOf({ ...base, effectiveStack: 9000, tournament: {} }).id !== 'icm', 'a thirty big blind stack is not short');
    assert(conceptOf({ ...base }).id !== 'icm', 'a cash table was graded for the prizes');
    assert(conceptOf({ ...base, toCall: 0, firstIn: false, tournament: {} }).id !== 'icm', 'a free check is not shove or fold');
  });

  it('goes through the coach: a verdict with the skill named and the prizes in it', () => {
    const v = judgeSpot({ ...base, ...firstIn('Ah Ad', 'raise'), position: 'BTN', equity: 0.85, needed: 0.3, opponents: 3 });
    equal(v.concept.id, 'icm');
    equal(v.kind, 'icm');
    equal(v.level, 'good');
  });

  it('is not asked about a hand it cannot see', () => {
    equal(judgeIcm({ bigBlind: 300, action: 'fold', tournament: firstIn('Ah Ad', 'fold').tournament }), null);
    equal(judgeIcm({ bigBlind: 300, hole: parseCards('Ah Ad'), action: 'fold' }), null);
  });
});

describe('the prizes counted: the range it reasons against', () => {
  it('is the top share of the 169 hands, as combos', () => {
    const top = rangeOf(0.05);
    assert(top.length > 20 && top.length < 120, `${top.length} combos in the top 5%`);
    equal(rangeOf(1).length, 1326, 'the whole range is not every combo');
    assert(rangeOf(0.3).length > top.length);
    equal(rangeOf(0).length > 0, true, 'an empty range would divide by zero');
  });
});

describe('the bubble: the ICM chapter\'s table', () => {
  it('opens at four stacks that make up all the chips, with the reader short and not the biggest', () => {
    const rng = makeRng(77);
    for (let i = 0; i < 60; i++) {
      const s = bubbleStacks(rng);
      equal(s.length, BUBBLE.field);
      equal(s.reduce((a, b) => a + b, 0), START_STACK * FIELD, `${s} do not add up to the chips on the table`);
      assert(s.every((x) => x >= 700 && x % 50 === 0), `${s} has an odd stack`);
      assert(s[0] < Math.max(...s), 'the reader is the chip leader');
      assert(s[0] <= 2400, 'the reader is not short');
    }
  });

  it('starts at 150/300, so the reader has a handful of big blinds', () => {
    const b = blindsFor(BUBBLE_START_HAND);
    equal(b.big, 300);
    equal(b.left, LEVEL_HANDS, 'the first hand is not the first of its level');
    for (const hero of [900, 1200, 1500, 1900, 2400]) assert(hero / b.big >= 3 && hero / b.big <= 8);
  });

  it('is four players, three of them paid', () => {
    equal(BUBBLE.field, 4);
    assert(BUBBLE.maxHands > 0);
  });
});

describe('the prizes counted: in two languages', () => {
  it('has Dutch for every verdict it can give', () => {
    const missing = new Set();
    const hands = ['Ah Ad', '7h 2c', 'Ks Qh', 'Ts 8s', 'Ad 9c', 'Qd 7c'];
    for (const hand of hands) {
      for (const action of ['raise', 'fold', 'call', 'check']) {
        for (const v of [judgeIcm(firstIn(hand, action)), judgeIcm(facing(BUBBLE_PRIZES, hand, action)), judgeIcm(facing([100], hand, action))]) {
          for (const text of [v.head, v.body, v.better]) if (text && !NL[text]) missing.add(text);
        }
      }
    }
    equal([...missing].join('\n'), '', 'no Dutch for the ICM verdicts');
    const c = conceptOf({ street: 'preflop', toCall: 300, effectiveStack: 1500, bigBlind: 300, firstIn: true, tournament: {} });
    assert(NL[c.why], 'no Dutch for what the coach says about the spot');
  });
});
