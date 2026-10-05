/**
 * Tables for fewer than six: you against one, or you against two.
 *
 * The practice table was always six-handed. Dealing it for fewer is easy; the
 * hard part is everything that quietly assumed six. The range charts are
 * drawn for six players, so a chart verdict at a heads-up table calls good
 * plays mistakes. Pearls pay for how much poker you play, and a table where
 * hands come twice as fast pays more an hour unless it is told not to. And
 * the felt put the other players on one side of the oval.
 */

import { describe, it, assert, equal } from './harness.js';
import { parseCards } from '../src/js/core/cards.js';
import { conceptOf } from '../src/js/core/spotConcept.js';
import { judgeSpot } from '../src/js/core/coach.js';
import { tableShare, scalePearls, playedThrough } from '../src/js/state/economy.js';
import { bites } from '../src/js/data/fish.js';
import { Profile } from '../src/js/state/profile.js';
import { slotFor } from '../src/js/ui/feltView.js';
import { resultLine } from '../src/js/ui/screenTable.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

const preflop = (over) => ({
  street: 'preflop', toCall: 2, pot: 3, bigBlind: 2, equity: 0.45, opponents: 1,
  effectiveStack: 200, firstIn: true, position: 'BTN', hole: parseCards('7h 2c'), ...over,
});

describe('tables of two and three: graded for the table they are', () => {
  it('names a short-handed preflop spot for what it is, the price, and keeps the chart for six', () => {
    equal(conceptOf(preflop({ seats: 6 })).id, 'preflop');
    equal(conceptOf(preflop({})).id, 'preflop', 'a spot with no table size is a full table');
    for (const seats of [2, 3]) {
      const c = conceptOf(preflop({ seats }));
      equal(c.id, 'pot-odds', `${seats} players`);
      assert(/six/i.test(c.why), 'it does not say why the chart is not used');
    }
    // Only before the flop: after it, a spot is a spot.
    equal(conceptOf({ street: 'flop', toCall: 0, pot: 20, equity: 0.5, seats: 2, wasAggressor: true }).id, 'cbet');
  });

  it('does not call a heads-up open a mistake because the six-handed chart folds it', () => {
    // 72o on the button is a fold at a full table and an ordinary open when it
    // is you against one. The chart says "outside the range"; the price says
    // the small blind is getting 3 to 1 and the hand has the equity for it.
    const open = { action: 'call', equity: 0.46, needed: 0.4 };
    const full = judgeSpot(preflop({ ...open, seats: 6, action: 'raise', amount: 6 }));
    equal(full.level, 'bad', 'at a full table the chart still says 72o is outside the range');
    const headsUp = judgeSpot(preflop({ ...open, seats: 2, action: 'call' }));
    assert(headsUp.level !== 'bad', `heads-up the same hand was graded ${headsUp.level}: ${headsUp.head}`);
  });
});

describe('tables of two and three: what they pay', () => {
  it('pay half of what a full table does, and a full table pays in full', () => {
    equal(tableShare(6), 1);
    equal(tableShare(), 1);
    equal(tableShare(3), 0.5);
    equal(tableShare(2), 0.5);
  });

  it('carries the fraction, so half a pearl a hand is paid in full over two hands', () => {
    let carry = 0;
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const r = scalePearls(carry, 1, 0.5);
      carry = r.carry;
      total += r.paid;
    }
    equal(total, 5, 'ten hands at half a pearl each should be five');
    equal(scalePearls(0, 1, 1).paid, 1);
    equal(scalePearls(0.3, 0, 0.5).carry, 0.3, 'paying nothing leaves what is owed alone');
    equal(scalePearls(0, 3, 0.5).paid, 1, 'a payment of three, halved, is one with half over');
  });

  it('keep the chart fish for full tables', () => {
    const steal = { street: 'preflop', action: 'raise', concept: 'preflop', level: 'good', helped: false, position: 'BTN', firstIn: true, toCall: 2 };
    assert(bites({ ...steal, seats: 6 }, 0).includes('perch'));
    assert(bites(steal, 0).includes('perch'), 'a cast with no table size is a full table');
    equal(bites({ ...steal, seats: 3 }, 0).length, 0, 'a chart fish bit at a three-handed table');
    const cbet = { street: 'flop', action: 'bet', concept: 'cbet', level: 'good', helped: false, position: 'BTN', firstIn: false, toCall: 0 };
    assert(bites({ ...cbet, seats: 2 }, 0).includes('carp'), 'a flop fish is a flop fish at any size');
  });
});

describe('a hand pays when it is played, not when it is sat through', () => {
  it('folding before the flop is not playing the hand', () => {
    assert(!playedThrough([{ street: 'preflop', action: 'fold' }]), 'a preflop fold paid its pearl');
    assert(!playedThrough([]), 'a hand with no decision of yours paid its pearl');
  });

  it('anything after that is: calling, raising, checking the option, folding on a later street', () => {
    assert(playedThrough([{ street: 'preflop', action: 'call' }]));
    assert(playedThrough([{ street: 'preflop', action: 'raise' }]));
    assert(playedThrough([{ street: 'preflop', action: 'check' }]), 'checking the big blind is playing it');
    assert(playedThrough([{ street: 'preflop', action: 'call' }, { street: 'flop', action: 'fold' }]));
    assert(playedThrough([{ street: 'flop', action: 'fold' }]), 'folding on the flop is a decision');
  });
});

describe('tables of two and three: counted and drawn properly', () => {
  it('counts a hand once: leaving a table does not add its hands a second time', () => {
    const p = new Profile({}, memory());
    p.data.handsPlayed = 3;                 // counted as they finished, at the table
    p.recordSession({ hands: 3, profitBb: 5, stake: 'practice', endedAt: 1 });
    equal(p.data.handsPlayed, 3, 'three hands at a table counted as six');
    equal(p.data.sessions.length, 1);
    equal(p.data.lifetimeProfitBb, 5);
  });

  it('spreads the seats round the oval instead of down one side', () => {
    equal([0, 1, 2, 3, 4, 5].map((i) => slotFor(i, 6)).join(), '0,1,2,3,4,5');
    equal([0, 1].map((i) => slotFor(i, 2)).join(), '0,3', 'heads-up: straight across');
    equal([0, 1, 2].map((i) => slotFor(i, 3)).join(), '0,2,4', 'three-handed: either side of the top');
    for (const n of [2, 3, 4, 5, 6]) {
      const slots = [...Array(n).keys()].map((i) => slotFor(i, n));
      equal(new Set(slots).size, n, `${n} seats share a place`);
      assert(slots.every((s) => s >= 0 && s <= 5), `${n} seats go off the felt`);
      equal(slots[0], 0, 'the hero is not at the bottom');
    }
  });

  it('says what the hand came to, and does not say you won nothing', () => {
    assert(/won 12/.test(resultLine(12)));
    assert(/lost 7/.test(resultLine(-7)));
    const none = resultLine(0);
    assert(!/won 0|lost 0/.test(none), `a hand that came to nothing says "${none}"`);
    assert(/No chips/.test(none));
  });
});
