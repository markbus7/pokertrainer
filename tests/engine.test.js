import { describe, it, assert, equal, throws } from './harness.js';
import { createTable } from '../src/js/engine/table.js';
import { makeRng, randInt } from '../src/js/core/rng.js';
import { parseCards } from '../src/js/core/cards.js';

const seats = (...stacks) => stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack }));
const table = (stacks, opts = {}) => createTable({
  players: seats(...stacks), smallBlind: 1, bigBlind: 2, rng: makeRng(opts.seed ?? 42), ...opts,
});

describe('engine: blinds and positions', () => {
  it('posts blinds and starts action under the gun', () => {
    const t = table([200, 200, 200]).startHand();
    equal(t.players[1].totalCommitted, 1, 'small blind');
    equal(t.players[2].totalCommitted, 2, 'big blind');
    equal(t.totalPot, 3);
    equal(t.actor.id, 'p0', 'button acts first three-handed');
  });

  it('names seats relative to the button', () => {
    const t = table([200, 200, 200, 200, 200, 200]).startHand();
    equal(t.players.map((p) => p.position).join(','), 'BTN,SB,BB,UTG,HJ,CO');
  });

  it('makes the button post the small blind heads-up', () => {
    const t = table([200, 200]).startHand();
    equal(t.players[0].position, 'BTN');
    equal(t.players[0].totalCommitted, 1, 'button posts the small blind');
    equal(t.players[1].totalCommitted, 2, 'the other seat posts the big blind');
    equal(t.actor.id, 'p0', 'button acts first preflop heads-up');
  });

  it('acts on the big blind last postflop heads-up', () => {
    const t = table([200, 200]).startHand();
    t.act({ type: 'call' });
    t.act({ type: 'check' });
    equal(t.street, 'flop');
    equal(t.actor.id, 'p1', 'big blind acts first postflop');
  });

  it('gives the big blind an option when the pot is limped', () => {
    const t = table([200, 200, 200]).startHand();
    t.act({ type: 'call' });            // button limps
    t.act({ type: 'call' });            // small blind completes
    equal(t.actor.id, 'p2', 'big blind still has an option');
    assert(t.legalActions().some((a) => a.type === 'check'), 'and can check it through');
  });

  it('moves the button between hands', () => {
    const t = table([200, 200, 200]).startHand();
    t.act({ type: 'fold' }); t.act({ type: 'fold' });
    equal(t.button, 0);
    t.startHand();
    equal(t.button, 1, 'button advances');
  });
});

describe('engine: betting rules', () => {
  it('rejects illegal actions', () => {
    const t = table([200, 200, 200]).startHand();
    throws(() => t.act({ type: 'check' }), 'cannot check facing the big blind');
    throws(() => t.act({ type: 'nonsense' }), 'unknown action type');
  });

  it('enforces the minimum raise', () => {
    const t = table([200, 200, 200]).startHand();
    const raise = t.legalActions().find((a) => a.type === 'raise');
    equal(raise.min, 4, 'min raise is to twice the big blind');
    t.act({ type: 'raise', amount: 6 });
    const reraise = t.legalActions().find((a) => a.type === 'raise');
    equal(reraise.min, 10, 'must raise by at least the last raise size');
  });

  it('clamps an oversized raise to the stack', () => {
    const t = table([200, 200, 200]).startHand();
    t.act({ type: 'raise', amount: 999999 });
    equal(t.players[0].committed, 200, 'capped at all-in');
    assert(t.players[0].allIn);
  });

  it('does not let a short all-in reopen the betting', () => {
    // p0 raises to 20, p1 shoves 25 (a raise of only 5, less than the 18 min),
    // p2 calls 25 -> p0 may call the extra 5 but may not re-raise.
    const t = table([200, 25, 200]).startHand();
    t.act({ type: 'raise', amount: 20 });     // p0
    t.act({ type: 'raise', amount: 25 });     // p1 all-in, short raise
    equal(t.players[1].allIn, true);
    t.act({ type: 'call' });                  // p2
    equal(t.actor.id, 'p0');
    const options = t.legalActions().map((a) => a.type);
    assert(options.includes('call'), 'p0 can call the difference');
    assert(!options.includes('raise'), `short all-in must not reopen betting, got ${options.join(',')}`);
  });

  it('does let a full raise reopen the betting', () => {
    const t = table([200, 200, 200]).startHand();
    t.act({ type: 'raise', amount: 6 });
    t.act({ type: 'raise', amount: 18 });
    t.act({ type: 'fold' });
    assert(t.legalActions().some((a) => a.type === 'raise'), 'a full raise reopens action');
  });

  it('caps bets at the pot in pot-limit games', () => {
    const t = table([200, 200, 200], { variant: 'omaha' }).startHand();
    // Pot is 3; p0 calls 2 making it 5, then may raise to 2 + 5 = 7.
    const raise = t.legalActions().find((a) => a.type === 'raise');
    equal(raise.max, 7, 'pot-limit maximum');
    assert(!raise.allIn, 'not an all-in, just the pot');
  });
});

describe('engine: pots and settlement', () => {
  it('awards the pot when everyone folds', () => {
    const t = table([200, 200, 200]).startHand();
    t.act({ type: 'fold' }); t.act({ type: 'fold' });
    equal(t.street, 'complete');
    equal(t.result.reason, 'fold');
    equal(t.players[2].stack, 201, 'big blind collects the dead small blind');
  });

  it('returns an uncalled bet', () => {
    const t = table([200, 50]).startHand();
    t.act({ type: 'raise', amount: 200 });   // button shoves 200
    t.act({ type: 'call' });                 // big blind can only call 50
    const total = t.players.reduce((s, p) => s + p.stack, 0);
    equal(total, 250, 'the uncalled 150 is returned, not burned');
  });

  it('builds correct main and side pots', () => {
    const t = table([50, 100, 200]).startHand();
    t.act({ type: 'raise', amount: 200 });   // p0 shoves, capped at 50
    t.act({ type: 'call' });                 // p1 calls 50 -> then p2
    t.act({ type: 'raise', amount: 200 });   // p2 shoves
    t.act({ type: 'call' });                 // p1 calls all-in for 100
    const pots = t.result.pots;
    equal(pots[0].amount, 150, 'main pot: 50 from each');
    equal(pots[0].eligible.length, 3);
    equal(pots[1].amount, 100, 'side pot: 50 more from p1 and p2');
    equal(pots[1].eligible.join(','), 'p1,p2');
    equal(pots[2].amount, 100, 'p2 overbet 100 that nobody could call');
    equal(pots[2].eligible.join(','), 'p2', 'and gets it straight back');
    equal(pots.reduce((s, x) => s + x.amount, 0), 350, 'every chip on the table is in a pot');
  });

  it('keeps a folded player money in the pot but out of the running', () => {
    const t = table([200, 200, 200]).startHand();
    t.act({ type: 'raise', amount: 10 });  // p0
    t.act({ type: 'call' });               // p1
    t.act({ type: 'fold' });               // p2 folds having posted the big blind
    equal(t.totalPot, 22, '10 + 10 + the dead big blind');
  });

  it('splits a chopped pot and gives odd chips to the first seat left of the button', () => {
    const t = table([200, 200, 200], { seed: 5 });
    t.startHand();
    // Both players make the same broadway straight, so the pot must chop.
    // p2 folds having posted a blind, which makes the pot an odd number.
    t.players[0].hole = parseCards('AsKs');
    t.players[1].hole = parseCards('AhKh');
    t.players[2].folded = true;
    t.board = parseCards('QdJcTh9c8d');
    t.street = 'river';
    t.pot = 0;
    for (const p of t.players) p.committed = 0;
    t.players[0].totalCommitted = 10;
    t.players[1].totalCommitted = 10;
    t.players[2].totalCommitted = 1;  // dead blind -> 21 chips between two winners
    t.finish('showdown');
    const paid = t.players[0].wonThisHand + t.players[1].wonThisHand;
    equal(paid, 21, 'every chip is paid out');
    equal(t.result.showdown[0].description, 'Straight, Ace high', 'both make broadway');
    equal(t.players[1].wonThisHand, 11, 'the odd chip goes to the first seat left of the button');
    equal(t.players[0].wonThisHand, 10);
  });

  it('deals the full board when everyone is all-in', () => {
    const t = table([100, 100]).startHand();
    t.act({ type: 'raise', amount: 100 });
    t.act({ type: 'call' });
    equal(t.board.length, 5, 'runout completes the board');
    equal(t.street, 'complete');
    equal(t.result.showdown.length, 2, 'both hands are shown');
  });

  it('ranks the showdown best hand first', () => {
    const t = table([100, 100]).startHand();
    t.act({ type: 'raise', amount: 100 });
    t.act({ type: 'call' });
    const [first, second] = t.result.showdown;
    assert(first.score >= second.score, 'showdown is sorted by hand strength');
    assert(t.players.find((p) => p.id === first.id).wonThisHand > 0, 'the best hand gets paid');
  });
});

describe('engine: invariants under random play', () => {
  it('never creates or destroys a chip over 400 random hands', () => {
    const rng = makeRng(987654);
    for (let game = 0; game < 40; game++) {
      const stacks = [];
      const count = 2 + randInt(rng, 5);
      for (let i = 0; i < count; i++) stacks.push(20 + randInt(rng, 400));
      const variant = ['holdem', 'omaha', 'shortdeck'][randInt(rng, 3)];
      const t = table(stacks, { seed: 1000 + game, variant });
      const startingChips = t.players.reduce((s, p) => s + p.stack, 0);

      for (let hand = 0; hand < 10; hand++) {
        if (t.players.filter((p) => p.stack > 0).length < 2) break;
        t.startHand();
        let guard = 0;
        while (!t.handOver && guard++ < 500) {
          const legal = t.legalActions();
          if (!legal.length) break;
          const choice = legal[randInt(rng, legal.length)];
          const action = { type: choice.type };
          if (choice.type === 'bet' || choice.type === 'raise') {
            action.amount = choice.min + randInt(rng, Math.max(1, choice.max - choice.min + 1));
          }
          t.act(action);
        }
        assert(t.handOver, `hand did not terminate (game ${game}, hand ${hand})`);
        const chips = t.players.reduce((s, p) => s + p.stack, 0);
        equal(chips, startingChips, `chips leaked in game ${game} hand ${hand}`);
        assert(t.players.every((p) => p.stack >= 0), 'no negative stacks');
      }
    }
  });

  it('always leaves exactly one live pot claim', () => {
    const rng = makeRng(24680);
    for (let game = 0; game < 25; game++) {
      const t = table([100, 100, 100, 100], { seed: 500 + game });
      t.startHand();
      let guard = 0;
      while (!t.handOver && guard++ < 300) {
        const legal = t.legalActions();
        const choice = legal[randInt(rng, legal.length)];
        const action = { type: choice.type };
        if (choice.type === 'bet' || choice.type === 'raise') action.amount = choice.min;
        t.act(action);
      }
      const paid = Object.values(t.result.payouts).reduce((s, x) => s + x, 0);
      const committed = t.players.reduce((s, p) => s + p.totalCommitted, 0);
      equal(paid, committed, 'everything committed is paid back out');
    }
  });
});
