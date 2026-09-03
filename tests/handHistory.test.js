/**
 * The hand recorder, the store, and the grading that decides what is worth
 * keeping.
 *
 * The load-bearing test here is the integrity one. Everything else about this
 * feature fails loudly — a broken screen throws, a wrong number looks wrong.
 * A replay that quietly disagrees with the hand you played would look
 * completely fine and teach you the wrong lesson, so it is checked by
 * deliberately hiding an action from the recorder and requiring the recording
 * to be thrown away.
 */

import { describe, it, assert, equal, close } from './harness.js';
import { createTable } from '../src/js/engine/table.js';
import { botAction, getProfile, pickOpponents } from '../src/js/engine/bots.js';
import { makeRng } from '../src/js/core/rng.js';
import { equityVsField } from '../src/js/core/equity.js';
import { requiredEquity } from '../src/js/core/odds.js';
import { judgeDecision, CLEAR_MARGIN, NOISE } from '../src/js/core/judge.js';
import { generateSpot } from '../src/js/trainers/lab.js';
import {
  HandRecorder, frameAt, frameCount, reviewOf, worthKeeping, prune,
  keepHand, loadHands, clearHands, recentHands, handSummary, findHand, removeHand,
  handFromLabSpot, matchesTable, _useStorage, MISTAKE_CAP, COOLER_CAP, COOLER_BB,
} from '../src/js/state/handHistory.js';

function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/** Plays one hand, optionally hiding the nth action from the recorder. */
function playHand({ seed = 1, hide = -1, hero = 'call' } = {}) {
  const rng = makeRng(seed);
  const opponents = pickOpponents(5, rng);
  const table = createTable({
    smallBlind: 1, bigBlind: 2, rng,
    players: [
      { id: 'hero', name: 'You', stack: 200, isHero: true },
      ...opponents.map((key, i) => ({ id: `bot${i}`, name: getProfile(key).name, stack: 200, profile: key })),
    ],
  });
  table.startHand();
  const rec = new HandRecorder(table, 'hero', { source: 'play' });
  let n = 0;
  let hidden = null;
  while (!table.handOver && n < 200) {
    const actor = table.actor;
    if (!actor) break;
    let action;
    let coach = null;
    if (actor.isHero) {
      const live = table.contestants.filter((p) => !p.isHero).length;
      const toCall = Math.max(0, table.currentBet - actor.committed);
      const pot = table.totalPot;
      coach = {
        equity: equityVsField(actor.hole, table.board, Math.max(1, live), table.variant, rng, 200),
        needed: toCall > 0 ? requiredEquity(toCall, pot) : 0,
        opponents: live,
        spr: 4,
      };
      const legal = table.legalActions(actor);
      action = { type: (legal.find((a) => a.type === hero) || legal[0]).type };
    } else {
      action = botAction(table, actor, rng);
    }
    if (n === hide) { hidden = action.type; table.act(action); rec.syncBoard(table); }
    else rec.act(table, action, coach);
    n++;
  }
  return { hand: rec.finish(table), table, actions: n, hidden };
}

describe('the hand recorder keeps a replayable record', () => {
  it('records a hand that rebuilds to the same finish', () => {
    const { hand, table } = playHand({ seed: 5 });
    assert(hand, 'an honest recording should be accepted');
    const final = frameAt(hand, hand.steps.length);
    for (const p of final.players) {
      const real = table.player(p.id);
      const start = hand.seats.find((s) => s.id === p.id).stack;
      close(start - p.stack, real.totalCommitted, 0.5, `${p.id} put in the wrong amount`);
      equal(p.folded, real.folded, `${p.id} folded state disagrees`);
    }
  });

  it('throws away a recording with an action missing from it', () => {
    // Every action of every hand across a spread of seeds, hidden one at a
    // time. Silence here would mean the check is decoration.
    let hidden = 0;
    let caught = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { actions } = playHand({ seed });
      for (let i = 0; i < actions; i++) {
        const run = playHand({ seed, hide: i });
        if (!run.hidden) continue;
        hidden++;
        if (!run.hand) caught++;
      }
    }
    assert(hidden > 50, `expected plenty of injected faults, got ${hidden}`);
    equal(caught, hidden, 'every hidden action must be caught');
  });

  it('rejects a rebuild that stops registering folds', () => {
    // A fold moves no chips and is one action like any other, so neither the
    // chip total nor the action count would notice this. It is the folded
    // flags that do, which is why they are checked separately.
    let tested = 0;
    for (let seed = 1; seed <= 10 && tested < 3; seed++) {
      const { hand, table } = playHand({ seed });
      if (!hand) continue;
      const fold = hand.steps.find((s) => s.action === 'fold');
      if (!fold) continue;
      assert(matchesTable(hand, table), 'the honest recording should pass');
      fold.action = 'check';
      assert(!matchesTable(hand, table), 'a fold recorded as a check must be caught');
      tested++;
    }
    equal(tested, 3, 'expected folds to corrupt');
  });

  it('walks every frame of a hand without falling over', () => {
    const { hand } = playHand({ seed: 9 });
    equal(frameCount(hand), hand.steps.length + 1);
    let pot = 0;
    for (let i = 0; i < frameCount(hand); i++) {
      const frame = frameAt(hand, i);
      assert(frame.players.length === hand.seats.length, 'lost a seat');
      assert(frame.pot >= pot - 0.001, 'the pot went backwards');
      pot = frame.pot;
      for (const p of frame.players) assert(p.stack >= 0, `${p.id} has a negative stack`);
    }
  });

  it('opens on the hand as dealt, with the blinds out and nobody acting', () => {
    const { hand } = playHand({ seed: 3 });
    const first = frameAt(hand, 0);
    const posted = hand.posts.reduce((s, p) => s + p.amount, 0);
    close(first.pot, posted, 0.001, 'frame zero should hold exactly the blinds');
    assert(first.players.every((p) => !p.folded), 'nobody has folded before the deal');
    assert(first.board.length === 0, 'no board before the flop');
  });
});

describe('grading decides what is worth keeping', () => {
  it('calls a call without the odds a mistake, and prices it', () => {
    const v = judgeDecision({ action: 'call', equity: 0.2, needed: 0.4, toCall: 100, pot: 150 });
    equal(v.level, 'bad');
    // Losing 100 four times in five and winning 150 once: -50 a go.
    close(v.cost, 50, 0.001, 'the cost should be the EV it burned');
    assert(v.better.startsWith('Fold'), 'a bad call should name folding');
  });

  it('does not punish a call inside the simulation noise', () => {
    const v = judgeDecision({ action: 'call', equity: 0.3 - NOISE + 0.001, needed: 0.3, toCall: 50, pot: 100 });
    equal(v.level, 'ok');
    equal(v.cost, 0);
  });

  it('condemns folding for free without needing an equity estimate', () => {
    const v = judgeDecision({ action: 'fold', equity: 0.05, needed: 0, toCall: 0, pot: 80 });
    equal(v.level, 'bad');
    equal(v.better, 'Check');
  });

  it('keeps a hand with a bad decision and drops a clean one', () => {
    const bad = {
      bigBlind: 2,
      decisions: [{ action: 'call', equity: 0.1, needed: 0.4, toCall: 60, pot: 90 }],
      result: { net: -60, reason: 'showdown' },
    };
    equal(reviewOf(bad).kind, 'mistake');
    assert(worthKeeping(bad));

    const clean = {
      bigBlind: 2,
      decisions: [{ action: 'fold', equity: 0.1, needed: 0.4, toCall: 60, pot: 90 }],
      result: { net: -4, reason: 'fold' },
    };
    equal(reviewOf(clean).kind, 'clean');
    assert(!worthKeeping(clean));
  });

  it('keeps a big loss with no mistake in it, and says so', () => {
    const cooler = {
      bigBlind: 2,
      decisions: [{ action: 'call', equity: 0.9, needed: 0.3, toCall: 60, pot: 200 }],
      result: { net: -2 * COOLER_BB, reason: 'showdown' },
    };
    const review = reviewOf(cooler);
    equal(review.kind, 'cooler');
    equal(review.worst, null, 'a cooler has no worst decision');
    close(review.lostBb, COOLER_BB, 0.001);
  });

  it('ranks by what a mistake cost, not by which came last', () => {
    const hand = {
      bigBlind: 2,
      decisions: [
        { action: 'call', equity: 0.1, needed: 0.35, toCall: 200, pot: 300 },
        { action: 'call', equity: 0.1, needed: 0.35, toCall: 10, pot: 15 },
      ],
      result: { net: -210, reason: 'showdown' },
    };
    const review = reviewOf(hand);
    equal(review.worstIndex, 0, 'the expensive one is the one to show');
    equal(review.mistakeCount, 2);
  });
});

describe('the store keeps the useful hands and forgets the rest', () => {
  it('saves only what is worth keeping', () => {
    _useStorage(memoryStore());
    clearHands();
    const { hand } = playHand({ seed: 4 });
    hand.decisions = [{ action: 'call', equity: 0.1, needed: 0.5, toCall: 40, pot: 40 }];
    equal(loadHands().length, 0);
    keepHand(hand);
    equal(loadHands().length, 1);

    const clean = { ...hand, id: 'clean', decisions: [], result: { ...hand.result, net: 1 } };
    keepHand(clean);
    equal(loadHands().length, 1, 'a hand with nothing in it should not be stored');
  });

  it('caps each kind on its own, so mistakes cannot bury coolers', () => {
    const mistake = (i) => ({ id: `m${i}`, kind: 'mistake' });
    const cooler = (i) => ({ id: `c${i}`, kind: 'cooler' });
    const hands = [];
    for (let i = 0; i < COOLER_CAP + 5; i++) hands.push(cooler(i));
    for (let i = 0; i < MISTAKE_CAP + 20; i++) hands.push(mistake(i));

    const kept = prune(hands);
    equal(kept.filter((h) => h.kind === 'mistake').length, MISTAKE_CAP);
    equal(kept.filter((h) => h.kind === 'cooler').length, COOLER_CAP);
    // Oldest go first inside a bucket.
    assert(kept.some((h) => h.id === `m${MISTAKE_CAP + 19}`), 'the newest mistake must survive');
    assert(!kept.some((h) => h.id === 'm0'), 'the oldest mistake should have been dropped');
  });

  it('lists newest first, finds by id, and removes one', () => {
    _useStorage(memoryStore());
    clearHands();
    const make = (id, net) => ({
      id, bigBlind: 2, steps: [], at: Date.now(),
      decisions: [{ action: 'call', equity: 0.1, needed: 0.5, toCall: 40, pot: 40 }],
      result: { net, reason: 'showdown' },
    });
    keepHand(make('first', -40));
    keepHand(make('second', -40));
    equal(recentHands()[0].id, 'second');
    equal(findHand('first').id, 'first');
    removeHand('first');
    equal(findHand('first'), null);
    equal(handSummary().mistakes, 1);
  });

  it('survives a corrupt store rather than taking the screen down with it', () => {
    const broken = memoryStore();
    broken.setItem('poker-trainer.hands.v1', '{not json');
    _useStorage(broken);
    equal(loadHands().length, 0);
    _useStorage(memoryStore());
  });
});

describe('a Lab spot replays like a hand', () => {
  it('turns a wrong answer into a hand the judge also calls wrong', () => {
    // The Lab and the review share one grader, so a spot you are told you got
    // wrong cannot come back as "actually that was fine".
    const rng = makeRng(31);
    let checked = 0;
    for (let i = 0; i < 60; i++) {
      const spot = generateSpot('decide', rng);
      if (spot.type !== 'decide') continue;
      checked++;
      const wrong = spot.answer === 'call' ? 'fold' : 'call';
      equal(reviewOf(handFromLabSpot(spot, wrong)).kind, 'mistake',
        `a wrong answer at ${(spot.equity * 100).toFixed(0)}% vs ${(spot.need * 100).toFixed(0)}% was not graded a mistake`);
      equal(reviewOf(handFromLabSpot(spot, spot.answer)).kind, 'clean',
        'a right answer should not be saved');
    }
    assert(checked > 50, `expected decide spots, got ${checked}`);
  });

  it('never generates a spot too close for the grader to call', () => {
    const rng = makeRng(77);
    for (let i = 0; i < 60; i++) {
      const spot = generateSpot('decide', rng);
      if (spot.type !== 'decide') continue;
      assert(Math.abs(spot.equity - spot.need) >= CLEAR_MARGIN,
        `spot only ${((spot.equity - spot.need) * 100).toFixed(1)} points from the line`);
    }
  });

  it('claims no chips won or lost, because none were', () => {
    const spot = generateSpot('decide', makeRng(12));
    const hand = handFromLabSpot(spot, 'call');
    equal(hand.result.net, 0);
    equal(reviewOf(hand).lostBb, 0);
  });

  it('rebuilds every frame, opening on the flop the spot posed', () => {
    const spot = generateSpot('decide', makeRng(8));
    const hand = handFromLabSpot(spot, spot.answer === 'call' ? 'fold' : 'call');
    const first = frameAt(hand, 0);
    equal(first.board.length, 3, 'a Lab spot opens with its flop already out');
    close(first.pot, spot.table.pot, 1, 'and with its pot already there');
    for (let i = 0; i < frameCount(hand); i++) frameAt(hand, i);
  });
});
