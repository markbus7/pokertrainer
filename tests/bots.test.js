import { describe, it, assert, equal } from './harness.js';
import { createTable } from '../src/js/engine/table.js';
import { botAction, PROFILES, PROFILE_KEYS, getProfile, pickOpponents } from '../src/js/engine/bots.js';
import { makeRng } from '../src/js/core/rng.js';

/** Fraction of hands a profile voluntarily puts money in from a fixed seat. */
function measureVpip(profileKey, hands = 260, seed = 1) {
  const rng = makeRng(seed);
  let voluntary = 0;
  for (let i = 0; i < hands; i++) {
    const t = createTable({
      players: Array.from({ length: 6 }, (_, s) => ({ id: `p${s}`, stack: 200, profile: profileKey })),
      smallBlind: 1, bigBlind: 2, rng,
    });
    t.startHand();
    const action = botAction(t, t.actor, rng);
    if (action.type === 'raise' || action.type === 'bet' || action.type === 'call') voluntary++;
  }
  return voluntary / hands;
}

/** How often a profile bets when checked to on the flop. */
function measureFlopAggression(profileKey, hands = 160, seed = 2) {
  const rng = makeRng(seed);
  let bets = 0;
  let spots = 0;
  for (let i = 0; i < hands; i++) {
    const t = createTable({
      players: [{ id: 'a', stack: 200, profile: profileKey }, { id: 'b', stack: 200, profile: profileKey }],
      smallBlind: 1, bigBlind: 2, rng,
    });
    t.startHand();
    t.act({ type: 'call' });
    t.act({ type: 'check' });
    if (t.street !== 'flop') continue;
    spots++;
    const action = botAction(t, t.actor, rng);
    if (action.type === 'bet' || action.type === 'raise') bets++;
  }
  return spots ? bets / spots : 0;
}

describe('bots: profiles are distinct', () => {
  it('plays tighter as the profile gets tighter', () => {
    const rock = measureVpip('rock');
    const tag = measureVpip('tag');
    const lag = measureVpip('lag');
    const maniac = measureVpip('maniac');
    assert(rock < tag, `nit (${rock.toFixed(2)}) must be tighter than TAG (${tag.toFixed(2)})`);
    assert(tag < lag, `TAG (${tag.toFixed(2)}) must be tighter than LAG (${lag.toFixed(2)})`);
    assert(lag < maniac, `LAG (${lag.toFixed(2)}) must be tighter than maniac (${maniac.toFixed(2)})`);
    assert(rock < 0.25, `the nit should fold most hands, played ${rock.toFixed(2)}`);
    assert(maniac > 0.45, `the maniac should play most hands, played ${maniac.toFixed(2)}`);
  });

  it('bets more often as the profile gets more aggressive', () => {
    const station = measureFlopAggression('station');
    const maniac = measureFlopAggression('maniac');
    assert(station < maniac, `station (${station.toFixed(2)}) must bet less than maniac (${maniac.toFixed(2)})`);
    assert(station < 0.35, `a calling station should rarely lead out, bet ${station.toFixed(2)}`);
    assert(maniac > 0.5, `a maniac should bet constantly, bet ${maniac.toFixed(2)}`);
  });

  it('gives every profile a leak the student can attack', () => {
    for (const key of PROFILE_KEYS) {
      const p = PROFILES[key];
      assert(p.tell && p.tell.length > 15, `${key} needs a tell`);
      assert(p.counter && p.counter.length > 20, `${key} needs a counter-strategy`);
      assert(p.name && p.style && p.emoji, `${key} needs an identity`);
    }
  });

  it('falls back to a sane profile for an unknown key', () => {
    equal(getProfile('nonsense').key, 'tag');
  });

  it('seats a mix of styles', () => {
    const chosen = pickOpponents(5, makeRng(3));
    equal(chosen.length, 5);
    assert(new Set(chosen).size >= 4, 'a table should not be five clones');
  });
});

describe('bots: legality and termination', () => {
  it('never makes an illegal move across 300 bot-only hands', () => {
    const rng = makeRng(555);
    for (let game = 0; game < 60; game++) {
      const variant = ['holdem', 'omaha', 'shortdeck'][game % 3];
      const seats = pickOpponents(2 + (game % 5), rng).map((profile, i) => ({
        id: `p${i}`, stack: 60 + (i * 37) % 300, profile,
      }));
      const t = createTable({ players: seats, smallBlind: 1, bigBlind: 2, variant, rng });
      const chips = t.players.reduce((s, p) => s + p.stack, 0);

      for (let hand = 0; hand < 5; hand++) {
        if (t.players.filter((p) => p.stack > 0).length < 2) break;
        t.startHand();
        let guard = 0;
        while (!t.handOver && guard++ < 400) {
          const actor = t.actor;
          const action = botAction(t, actor, rng);
          const legal = t.legalActions(actor).map((a) => a.type);
          assert(legal.includes(action.type),
            `${actor.profile} chose ${action.type}, legal were [${legal.join(',')}] on ${t.street}`);
          t.act(action);
        }
        assert(t.handOver, `bot hand ${hand} of game ${game} did not finish`);
        equal(t.players.reduce((s, p) => s + p.stack, 0), chips, 'bots cannot conjure chips');
      }
    }
  });

  it('folds the worst hands and raises the best from a nit', () => {
    const rng = makeRng(77);
    const t = createTable({
      players: [{ id: 'a', stack: 200, profile: 'rock' }, { id: 'b', stack: 200, profile: 'rock' },
        { id: 'c', stack: 200, profile: 'rock' }],
      smallBlind: 1, bigBlind: 2, rng,
    });
    t.startHand();
    const actor = t.actor;
    actor.hole = [51, 50];   // AsAh
    assert(['raise', 'bet', 'call'].includes(botAction(t, actor, rng).type), 'a nit plays aces');
    actor.hole = [0, 13];    // 2c 5d - unconnected trash
    equal(botAction(t, actor, rng).type, 'fold', 'a nit folds trash');
  });
});
