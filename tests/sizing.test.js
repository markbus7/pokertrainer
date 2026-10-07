import { describe, it, assert, equal } from './harness.js';
import { createTable } from '../src/js/engine/table.js';
import { makeRng } from '../src/js/core/rng.js';
import { botAction } from '../src/js/engine/bots.js';
import { parseCards } from '../src/js/core/cards.js';
import { sizingContextOf, sizeAdvice, judgeSize, handClass, SIZE_KINDS } from '../src/js/core/sizing.js';
import { judgeSpot, overall } from '../src/js/core/coach.js';
import { reviewOf } from '../src/js/state/handHistory.js';

/** Six seats, deep, the blinds in: a = BTN, b = SB, c = BB, d = UTG, e = HJ, f = CO. */
function table6({ stack = 200, players = 6 } = {}) {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, players);
  const t = createTable({ smallBlind: 1, bigBlind: 2, rng: makeRng(3), players: ids.map((id) => ({ id, name: id, stack })) });
  t.startHand();
  return t;
}
const play = (t, ...moves) => {
  for (const m of moves) t.act(typeof m === 'string' ? { type: m } : m);
  return t;
};
const raiseTo = (amount) => ({ type: 'raise', amount });
const ctxOf = (t) => sizingContextOf(t, t.actor);
const sized = (t, amount, extra = {}) => {
  const ctx = ctxOf(t);
  const spec = t.legalActions(t.actor).find((a) => a.type === 'raise' || a.type === 'bet');
  return judgeSize({ sizing: ctx, action: spec.type, amount, street: t.street, ...extra });
};
/** To the flop, UTG having raised and the big blind called: the big blind first to act. */
function flop(board) {
  const t = play(table6(), raiseTo(6), 'fold', 'fold', 'fold', 'fold', 'call');
  t.board = parseCards(board);
  return t;
}

describe('bet sizing: the spot it reads off the table', () => {
  it('knows an open, a raise to answer, limpers and who will have position', () => {
    let c = ctxOf(table6());
    equal(c.raises, 0);
    equal(c.limpers, 0);
    equal(c.position, 'UTG');
    c = ctxOf(play(table6(), raiseTo(6), 'fold', 'fold'));
    equal(c.raises, 1);
    equal(c.position, 'BTN');
    equal(c.inPosition, true, 'the button has the opener after the flop');
    c = ctxOf(play(table6(), raiseTo(6), 'fold', 'fold', 'fold', 'fold'));
    equal(c.position, 'BB');
    equal(c.inPosition, false, 'the big blind does not');
    c = ctxOf(play(table6(), 'call', 'call'));
    equal(c.limpers, 2);
    equal(c.inPosition, true, 'the cutoff acts after both limpers');
    c = ctxOf(play(table6(), 'fold', 'fold', 'fold', 'fold', 'call'));
    equal(c.position, 'BB');
    equal(c.blindLimps, 1);
    equal(c.inPosition, true, 'the big blind acts after the small blind on every later street');
    c = ctxOf(play(table6(), raiseTo(6), 'fold', 'fold', raiseTo(18), 'fold', 'fold'));
    equal(c.raises, 2, 'facing a 3-bet is a 4-bet spot');
    equal(c.position, 'UTG');
  });

  it('reads the board and position after the flop', () => {
    const wet = ctxOf(flop('9h 8h 7s'));
    equal(wet.street, 'flop');
    equal(wet.wet, true);
    equal(wet.inPosition, false, 'the big blind is first to act');
    const dry = ctxOf(flop('Ks 7d 2c'));
    equal(dry.wet, false);
  });

  it('names the hand you bet the way the rules ask', () => {
    equal(handClass({ equity: 0.8, street: 'turn' }), 'strong');
    equal(handClass({ equity: 0.5, street: 'turn' }), 'medium');
    equal(handClass({ equity: 0.2, street: 'turn' }), 'weak');
    equal(handClass({ equity: 0.4, outs: 9, street: 'flop' }), 'draw');
    equal(handClass({ equity: 0.4, outs: 9, street: 'river' }), 'medium', 'nothing is a draw on the river');
  });
});

describe('bet sizing: what Silas says before you act', () => {
  it('gives the standard size where it does not turn on your hand', () => {
    equal(sizeAdvice(ctxOf(table6())).target, 5, 'an open is 2.5 big blinds');
    equal(sizeAdvice(ctxOf(play(table6(), 'fold', 'fold', 'fold', 'fold'))).target, 6, 'from the small blind, 3');
    equal(sizeAdvice(ctxOf(play(table6(), raiseTo(6), 'fold', 'fold'))).target, 18, '3x the open in position');
    equal(sizeAdvice(ctxOf(play(table6(), raiseTo(6), 'fold', 'fold', 'fold', 'fold'))).target, 24, '4x out of position');
    equal(sizeAdvice(ctxOf(play(table6(), raiseTo(6), 'fold', 'call'))).target, 24, 'one more time for the caller');
    equal(sizeAdvice(ctxOf(play(table6(), 'call', 'call'))).target, 10, '3 big blinds and 1 for each limper');
    equal(sizeAdvice(ctxOf(play(table6(), 'fold', 'fold', 'fold', 'fold', 'call'))).target, 6, 'the small blind\'s limp: 3');
    // Heads-up the button posts the small blind and acts last after the flop:
    // its limp is a blind completing, and the big blind is out of position.
    const hu = play(table6({ players: 2 }), 'call');
    equal(ctxOf(hu).blindLimps, 1);
    equal(sizeAdvice(ctxOf(hu)).target, 8, 'out of position against the limp: 4');
    equal(sizeAdvice(ctxOf(flop('Ks 7d 2c'))).target, 4, 'a third of the pot on a dry flop');
  });

  it('gives the rule, not a number, where the size depends on what you hold', () => {
    for (const board of ['9h 8h 7s']) {
      const advice = sizeAdvice(ctxOf(flop(board)));
      equal(advice.target, null);
      assert(/strong hand/.test(advice.rule) && /medium hand/.test(advice.rule), advice.rule);
    }
  });

  it('says all-in with a short stack', () => {
    const ten = sizeAdvice(ctxOf(table6({ stack: 20 })));
    equal(ten.target, 20, 'ten big blinds: all-in or fold');
    assert(ten.allIn);
    const twenty = sizeAdvice(ctxOf(table6({ stack: 40 })));
    equal(twenty.target, 4, 'twenty: a small raise, or all-in');
    const threeBet = sizeAdvice(ctxOf(play(table6({ stack: 50 }), raiseTo(5), 'fold', 'fold')));
    equal(threeBet.target, 50, 'a 3-bet with 25 big blinds is all-in');
  });

  it('says nothing where there is no bet to size', () => {
    const t = play(table6(), raiseTo(6), 'fold', 'fold', 'fold', 'fold', 'call');
    t.act({ type: 'check' });
    equal(sizeAdvice({ ...ctxOf(t), minTo: null, maxTo: null }), null);
  });
});

describe('bet sizing: the size, graded', () => {
  it('takes a 3-bet of half the pot for what it is', () => {
    // Half the pot is where the box starts. As a 3-bet it is 2.3x the open in
    // position, and 2.2x from the big blind — the commonest size leak there is.
    const ip = sized(play(table6(), raiseTo(6), 'fold', 'fold'), 14);
    equal(ip.verdict, 'small');
    equal(ip.level, 'ok');
    const oop = sized(play(table6(), raiseTo(6), 'fold', 'fold', 'fold', 'fold'), 13);
    equal(oop.verdict, 'small');
    equal(oop.level, 'bad');
    assert(/out of position/.test(oop.body));
    equal(oop.better, 'Raise to about {target}');
    equal(oop.params.target, '24');
    equal(sized(play(table6(), raiseTo(6), 'fold', 'fold'), 18).verdict, 'right');
  });

  it('keeps an open to its few big blinds', () => {
    equal(sized(table6(), 5).verdict, 'right');
    equal(sized(table6(), 9).level, 'ok', 'four and a half big blinds is big');
    const shove = sized(table6(), 200);
    equal(shove.level, 'bad', 'a hundred big blinds to win one and a half');
    equal(sized(table6({ stack: 20 }), 20).verdict, 'right', 'all-in is right with ten');
    equal(sized(table6({ stack: 20 }), 5).level, 'ok', 'a small raise with ten is not');
  });

  it('wants a raise over limpers big enough to thin the field', () => {
    equal(sized(play(table6(), 'call', 'call'), 5).level, 'bad', 'a min-raise over two limpers');
    equal(sized(play(table6(), 'call', 'call'), 10).verdict, 'right');
  });

  it('sizes after the flop by the board and by what you hold', () => {
    const wet = (amount, equity, outs = 0) => sized(flop('9h 8h 7s'), amount, { equity, outs });
    equal(wet(4, 0.8).verdict, 'small', 'a third with a strong hand on a wet board');
    equal(wet(10, 0.8).verdict, 'right');
    equal(wet(4, 0.5).verdict, 'right', 'a medium hand bets small');
    equal(wet(13, 0.5).verdict, 'big');
    equal(wet(10, 0.4, 9).verdict, 'right', 'a draw bets big');
    const dry = (amount, equity) => sized(flop('Ks 7d 2c'), amount, { equity });
    equal(dry(4, 0.8).verdict, 'right');
    equal(dry(13, 0.8).verdict, 'big', 'a dry board does not need the pot');
  });

  it('calls a far-off size a mistake and a near one close', () => {
    const t = flop('9h 8h 7s');
    equal(sized(t, 2, { equity: 0.9 }).level, 'bad', 'a min-bet with the best hand leaves the value behind');
    equal(sized(t, 194, { equity: 0.8 }).level, 'bad', 'fifteen pots with one pair');
    equal(sized(t, 30, { equity: 0.5 }).level, 'bad', 'a medium hand overbetting');
    equal(sized(t, 14, { equity: 0.5 }).level, 'ok', 'a medium hand a little big');
  });

  it('grades a raise against the bet it raises', () => {
    const t = flop('Ks 7d 2c');
    play(t, 'check', { type: 'bet', amount: 8 });
    equal(sized(t, 24).verdict, 'right', '3x their bet');
    equal(sized(t, 16).verdict, 'small');
    equal(sized(t, 48).verdict, 'big');
  });

  it('has nothing to say about a pot-limit open, or a size with no choice', () => {
    const t = createTable({
      smallBlind: 1, bigBlind: 2, rng: makeRng(3), variant: 'omaha',
      players: ['a', 'b', 'c'].map((id) => ({ id, name: id, stack: 200 })),
    });
    t.startHand();
    const ctx = sizingContextOf(t, t.actor);
    equal(judgeSize({ sizing: ctx, action: 'raise', amount: 7, street: 'preflop' }), null);
    equal(judgeSize({ sizing: { ...ctxOf(table6()), minTo: 40, maxTo: 40 }, action: 'raise', amount: 40 }), null);
    equal(judgeSize({ sizing: ctxOf(table6()), action: 'call', amount: 2 }), null);
  });
});

describe('bet sizing: Silas never grades his own advice wrong', () => {
  it('rates his size right in every spot real hands produce, and the sizes his rule names', () => {
    // The promise of the button: take it, and the size is right. Walked over
    // real hands, every street, every seat, every kind of hand.
    const rng = makeRng(11);
    let checked = 0;
    let named = 0;
    for (let h = 0; h < 150; h++) {
      const stack = [20, 40, 60, 200, 200, 200][h % 6];
      const t = createTable({ smallBlind: 1, bigBlind: 2, rng, players: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id, stack })) });
      t.startHand();
      let guard = 0;
      while (!t.handOver && guard++ < 200) {
        const actor = t.actor;
        if (!actor) break;
        const ctx = sizingContextOf(t, actor);
        const spec = t.legalActions(actor).find((a) => a.type === 'raise' || a.type === 'bet');
        const advice = sizeAdvice(ctx);
        if (spec && advice) {
          for (const [equity, outs] of [[0.1, 0], [0.5, 0], [0.8, 0], [0.4, 9]]) {
            const judge = (amount) => judgeSize({ sizing: ctx, action: spec.type, amount, street: t.street, equity, outs });
            if (advice.target !== null) {
              const v = judge(advice.target);
              assert(!v || v.verdict === 'right', `${t.street} ${advice.kind}: Silas's ${advice.target} graded ${v && v.verdict} (${v && v.head})`);
              checked++;
            } else {
              // Wet flop, turn, river: the size his rule names for this kind of hand.
              const cls = handClass({ equity, outs, street: t.street });
              const share = cls === 'medium' ? 1 / 3 : 0.75;
              const amount = Math.min(spec.max, Math.max(spec.min, Math.round(ctx.currentBet + share * (ctx.pot + ctx.toCall))));
              const v = judge(amount);
              assert(!v || v.verdict === 'right', `${t.street} ${cls}: the rule's ${amount} into ${ctx.pot} graded ${v && v.verdict} (${v && v.head})`);
              named++;
            }
          }
        }
        t.act(botAction(t, actor, rng));
      }
    }
    assert(checked > 300, `only ${checked} of Silas's sizes checked`);
    assert(named > 100, `only ${named} rule sizes checked`);
  });

  it('says every size verdict with a head, a reason and, when wrong, what instead', () => {
    const rng = makeRng(5);
    const seen = new Set();
    for (let h = 0; h < 80; h++) {
      const t = createTable({ smallBlind: 1, bigBlind: 2, rng, players: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id, stack: h % 2 ? 200 : 40 })) });
      t.startHand();
      let guard = 0;
      while (!t.handOver && guard++ < 200) {
        const actor = t.actor;
        if (!actor) break;
        const spec = t.legalActions(actor).find((a) => a.type === 'raise' || a.type === 'bet');
        if (spec) {
          const ctx = sizingContextOf(t, actor);
          for (const amount of [spec.min, Math.round((spec.min + spec.max) / 4), spec.max]) {
            for (const equity of [0.1, 0.5, 0.95]) {
              const v = judgeSize({ sizing: ctx, action: spec.type, amount, street: t.street, equity });
              if (!v) continue;
              seen.add(v.id);
              assert(v.head && v.body, `${v.id} says nothing`);
              assert(SIZE_KINDS.some((k) => k.key === v.sizeKind), `${v.sizeKind} is not a kind`);
              equal(v.level === 'good', v.verdict === 'right', `${v.id}: right and good go together`);
              if (v.verdict !== 'right') assert(v.better, `${v.id}: wrong with nothing instead`);
            }
          }
        }
        t.act(botAction(t, actor, rng));
      }
    }
    assert(seen.size >= 15, `only ${seen.size} kinds of size verdict met`);
  });
});

describe('bet sizing: one verdict for the decision and its size', () => {
  it('counts a right raise made the wrong size as the size mistake, and keeps both', () => {
    const t = play(table6(), raiseTo(6), 'fold', 'fold', 'fold', 'fold');
    const v = judgeSpot({
      street: 'preflop', toCall: 4, pot: 9, currentBet: 6, firstIn: false, raiser: 'UTG', position: 'BB',
      hole: parseCards('Ad As'), action: 'raise', amount: 12, opponents: 1, bigBlind: 2, sizing: ctxOf(t),
    });
    equal(v.level, 'good', 'aces 3-bet: the action is right');
    equal(v.size.verdict, 'small');
    const counted = overall(v);
    equal(counted.level, 'bad');
    equal(counted.head, 'Too small for a 3-bet');
    equal(counted.costKnown, false, 'a size has no honest price in one hand');
    const right = judgeSpot({
      street: 'preflop', toCall: 4, pot: 9, currentBet: 6, firstIn: false, raiser: 'UTG', position: 'BB',
      hole: parseCards('Ad As'), action: 'raise', amount: 24, opponents: 1, bigBlind: 2, sizing: ctxOf(t),
    });
    equal(overall(right), right, 'a right size leaves the verdict alone');
  });

  it('grades a stored hand\'s size in the Log the way the table did', () => {
    const t = play(table6(), raiseTo(6), 'fold', 'fold', 'fold', 'fold');
    const hand = {
      bigBlind: 2,
      result: { net: -12 },
      decisions: [{
        street: 'preflop', action: 'raise', equity: 0.5, needed: 0.3, toCall: 4, pot: 9, amount: 12, currentBet: 6,
        opponents: 1, spr: 10, sizing: ctxOf(t),
      }],
    };
    const review = reviewOf(hand);
    equal(review.kind, 'mistake');
    equal(review.worst.head, 'Too small for a 3-bet');
    equal(review.verdicts[0].size.verdict, 'small');
    assert(review.verdicts[0].action, 'the decision itself is kept beside its size');
  });
});
