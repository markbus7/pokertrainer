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
    // Two-sided, and pinned to the real game rather than to whatever the bots
    // happened to do: a live nit runs about 12% VPIP and a maniac about 40%.
    // The upper bound is the one that matters — this used to demand the maniac
    // play MORE than 45%, which was a threshold written around bots that were
    // far too loose, and it failed the moment they were corrected.
    assert(rock > 0.04 && rock < 0.22, `a nit plays about 12% of hands, played ${rock.toFixed(2)}`);
    assert(maniac > 0.33 && maniac < 0.62, `a maniac plays about 40% of hands, played ${maniac.toFixed(2)}`);
    assert(tag > 0.14 && tag < 0.34, `a TAG plays about 22% of hands, played ${tag.toFixed(2)}`);
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
      assert(p.name && p.style && p.tag, `${key} needs an identity`);
      // The mark is the abbreviation the game already uses, so it has to be
      // one — three or four tracked capitals, not a picture and not a word.
      assert(/^[A-Z]{3,4}$/.test(p.tag), `${key}'s seat mark should be a style code, got "${p.tag}"`);
    }
  });

  it('gives no two seats the same mark', () => {
    const marks = PROFILE_KEYS.map((k) => PROFILES[k].tag);
    equal(new Set(marks).size, marks.length, `two seats share a mark: ${marks.join(' ')}`);
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

describe('bots: folding after the flop is a thing that happens', () => {
  /**
   * The bug this pins was the most damaging one the project has had, and no
   * test saw it: every profile folded to a postflop bet between 2% and 13% of
   * the time, against a real 6-max range of 40-60%. Pots averaged 98bb rather
   * than 10 and a solid player beat the table for +229bb/100.
   *
   * The cause was that the calling rule compared the pot-odds price against
   * equity vs a RANDOM holding, which almost any hand clears. Somebody who
   * bets does not hold a random hand, so the number was answering a question
   * nobody had asked.
   *
   * Bounds are wide on purpose: this asserts that the game is poker, not that
   * a particular constant is 1.45. What it will not tolerate is the table
   * going back to a place where nobody can be bluffed, because a trainer whose
   * tables punish every bluff teaches the opposite of its own lessons.
   */
  const foldRates = (games = 90) => {
    const faced = {};
    const folded = {};
    for (const k of PROFILE_KEYS) { faced[k] = 0; folded[k] = 0; }
    const rng = makeRng(99);
    for (let game = 0; game < games; game++) {
      const seats = Array.from({ length: 6 }, (_, i) => ({
        id: `p${i}`, stack: 200, profile: PROFILE_KEYS[(game + i) % PROFILE_KEYS.length],
      }));
      const t = createTable({ players: seats, smallBlind: 1, bigBlind: 2, rng, button: game % 6 });
      for (let h = 0; h < 6; h++) {
        for (const p of t.players) p.stack = 200;
        t.startHand();
        let guard = 0;
        while (!t.handOver && guard++ < 400) {
          const actor = t.actor;
          const facing = t.currentBet - actor.committed > 0 && t.street !== 'preflop';
          const action = botAction(t, actor, rng);
          if (facing) { faced[actor.profile]++; if (action.type === 'fold') folded[actor.profile]++; }
          t.act(action);
        }
        if (!t.handOver) break;
      }
    }
    return Object.fromEntries(PROFILE_KEYS.map((k) => [k, faced[k] ? folded[k] / faced[k] : 0]));
  };

  it('lets every profile fold to a bet, at a rate a real game would recognise', () => {
    const rates = foldRates();
    const report = PROFILE_KEYS.map((k) => `${k} ${(100 * rates[k]).toFixed(0)}%`).join(', ');
    // Even the station folds sometimes; even the nit calls sometimes.
    for (const k of PROFILE_KEYS) {
      assert(rates[k] > 0.05, `${k} almost never folds after the flop — ${report}`);
      assert(rates[k] < 0.85, `${k} folds to almost everything — ${report}`);
    }
    // The whole table cannot be a calling station: bluffing has to work
    // somewhere, or every lesson about fold equity is contradicted by the felt.
    const table = Object.values(rates).reduce((a, b) => a + b, 0) / PROFILE_KEYS.length;
    assert(table > 0.25, `the table folds ${(100 * table).toFixed(0)}% of the time — nobody can be bluffed: ${report}`);
  });

  it('folds in the order the profiles claim to play', () => {
    const r = foldRates();
    assert(r.rock > r.tag, `the nit should fold more than the TAG (${(100 * r.rock).toFixed(0)}% vs ${(100 * r.tag).toFixed(0)}%)`);
    assert(r.tag > r.lag, `the TAG should fold more than the LAG (${(100 * r.tag).toFixed(0)}% vs ${(100 * r.lag).toFixed(0)}%)`);
    assert(r.lag > r.station, `the LAG should fold more than the station (${(100 * r.lag).toFixed(0)}% vs ${(100 * r.station).toFixed(0)}%)`);
    assert(r.station < 0.25, `the calling station is not calling: ${(100 * r.station).toFixed(0)}%`);
  });
});

describe('bots: the preflop tree has four nodes, not one', () => {
  /**
   * Preflop was a single decision repeated: the three-bet branch fired again
   * against a three-bet and again against a four-bet, at the same frequency,
   * so four-bets ran at 3-7% of hands where a real game shows 1-2%. Opens were
   * sized `2.2-3.3bb + 0.35bb per opponent`, which on six seats is 4-5bb —
   * nearly double a real online open — and the pot arrived at the flop four to
   * seven times too big before a card was dealt.
   */
  const preflop = (profile, games = 110) => {
    let dealt = 0; let fourBets = 0; let fiveBets = 0; const opens = []; const flopPots = [];
    const rng = makeRng(77);
    for (let g = 0; g < games; g++) {
      const seats = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, stack: 200, profile }));
      const t = createTable({ players: seats, smallBlind: 1, bigBlind: 2, rng, button: g % 6 });
      for (let h = 0; h < 6; h++) {
        for (const p of t.players) p.stack = 200;
        t.startHand();
        dealt += 6;
        let guard = 0;
        let sawFlop = false;
        while (!t.handOver && guard++ < 400) {
          const pre = t.street === 'preflop';
          const before = t.raisesThisStreet;
          const a = botAction(t, t.actor, rng);
          if (pre && (a.type === 'raise' || a.type === 'bet')) {
            if (before === 0) opens.push(a.amount / 2);
            if (before === 2) fourBets++;
            if (before >= 3) fiveBets++;
          }
          t.act(a);
          if (t.street !== 'preflop') sawFlop = true;
        }
        if (!t.handOver) break;
        if (sawFlop) flopPots.push(t.players.reduce((s, p) => s + p.totalCommitted, 0) / 2);
      }
    }
    const median = (xs) => (xs.length ? xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
    return {
      open: median(opens), fourBetRate: fourBets / dealt, fiveBetRate: fiveBets / dealt,
      flopPot: median(flopPots),
    };
  };

  it('opens to a size a real online game would recognise', () => {
    for (const key of ['rock', 'tag', 'lag', 'pro']) {
      const { open } = preflop(key);
      assert(open >= 2 && open <= 3.2, `${key} opens to ${open.toFixed(1)}bb — a real open is 2.2-2.5bb`);
    }
  });

  it('four-bets like a real game, not like a three-bet repeated', () => {
    // This first watched the FIVE-bet rate and passed happily while the
    // four-bet range was widened back to the three-bet range — the bug it
    // exists to catch. Found by reintroducing that bug and seeing green.
    // A real four-bet runs 1-2% of hands dealt; the fifth bet is rarer still.
    for (const key of ['tag', 'lag', 'pro']) {
      const { fourBetRate, fiveBetRate } = preflop(key);
      assert(fourBetRate < 0.035,
        `${key} four-bets ${(100 * fourBetRate).toFixed(1)}% of hands dealt — a real game shows 1-2%`);
      assert(fiveBetRate < 0.015, `${key} five-bets ${(100 * fiveBetRate).toFixed(1)}% of hands dealt`);
    }
  });

  it('arrives at the flop with a pot the size of a real one', () => {
    // The reg profiles only: six maniacs really do build a 40bb pot, and that
    // is the maniac being a maniac rather than the tree being broken.
    for (const key of ['tag', 'pro']) {
      const { flopPot } = preflop(key);
      assert(flopPot > 2 && flopPot < 14,
        `${key} tables reach the flop with ${flopPot.toFixed(1)}bb — a real one is 5-9bb`);
    }
  });
});
