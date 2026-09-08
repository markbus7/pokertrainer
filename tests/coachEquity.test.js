/**
 * What the coach grades you against.
 *
 * Every verdict rests on one number: your equity. It was measured against
 * random hands, and somebody who has just bet is not holding a random hand.
 * Over 125 spots facing a bet after the flop that overstated the reader by 20
 * points — 36 against the tightest opponent — and flipped the verdict on 46%
 * of them, always toward calling. The Pot Odds lesson calls that the single
 * biggest leak in small-stakes poker, so the app was teaching the leak it
 * warns about.
 */

import { describe, it, assert } from './harness.js';
import { Table } from '../src/js/engine/table.js';
import { botAction, getProfile, PROFILE_KEYS } from '../src/js/engine/bots.js';
import { snapshotOf, captureRange, bettingRangeOf } from '../src/js/core/lessonRunner.js';
import { equityVsHands } from '../src/js/core/equity.js';
import { makeRng } from '../src/js/core/rng.js';

/** Play heads-up against one profile, gathering spots where the hero faces a bet. */
function spotsAgainst(profile, seed, want = 12) {
  const rng = makeRng(seed);
  const out = [];
  for (let hand = 0; hand < 220 && out.length < want; hand++) {
    const table = new Table({
      smallBlind: 1, bigBlind: 2, rng,
      players: [
        { id: 'hero', name: 'You', stack: 200, isHero: true },
        { id: 'v', name: getProfile(profile).name, stack: 200, profile },
      ],
    });
    table.startHand();
    const state = { aggressor: {}, opener: null, ranges: {} };
    let guard = 0;
    while (!table.handOver && guard++ < 60 && out.length < want) {
      const actor = table.actor;
      if (!actor) break;
      if (actor.isHero && table.board.length >= 3
        && table.currentBet - actor.committed > 0 && state.ranges[table.street]) {
        const snap = snapshotOf(table, actor, { rng, ...state, ranges: state.ranges });
        const truth = equityVsHands(actor.hole, table.board, state.ranges[table.street], { rng });
        out.push({ shown: snap.equity, truth });
      }
      const action = botAction(table, actor, rng);
      captureRange(table, actor, action, state, rng);
      if (action.type === 'bet' || action.type === 'raise') state.aggressor[table.street] = actor.id;
      table.act(action);
    }
  }
  return out;
}

describe('the coach grades you against what they would have bet', () => {
  it('does not overstate your equity when you are facing a bet', () => {
    const errors = [];
    let n = 0;
    let bias = 0;
    for (const profile of PROFILE_KEYS) {
      const spots = spotsAgainst(profile, 700 + PROFILE_KEYS.indexOf(profile));
      if (spots.length < 5) continue;
      const off = spots.reduce((s, x) => s + (x.shown - x.truth), 0) / spots.length;
      n += spots.length;
      bias += off * spots.length;
      // Two Monte Carlo estimates of the same quantity differ by a few
      // points; twelve is the shape of grading against random cards.
      if (Math.abs(off) > 0.12) {
        errors.push(`${profile}: shown equity is off by ${(off * 100).toFixed(0)} points over ${spots.length} spots`);
      }
    }
    assert(n >= 30, `only ${n} spots gathered — the sweep proves nothing`);
    assert(!errors.length, `the coach is grading against the wrong hands:\n      ${errors.join('\n      ')}`);
    assert(Math.abs(bias / n) < 0.08,
      `overall bias ${((bias / n) * 100).toFixed(1)} points across ${n} spots`);
  });

  it('builds the range at the moment they decide, not after they have paid', () => {
    // Asked once the bet is in, the bot owes nothing and answers "check" for
    // every candidate — sixty of sixty were rejected that way, silently, and
    // the whole thing fell back to random cards without saying so.
    const rng = makeRng(4);
    for (let hand = 0; hand < 200; hand++) {
      const table = new Table({
        smallBlind: 1, bigBlind: 2, rng,
        players: [
          { id: 'hero', name: 'You', stack: 200, isHero: true },
          { id: 'v', name: 'Tessa', stack: 200, profile: 'tag' },
        ],
      });
      table.startHand();
      let guard = 0;
      while (!table.handOver && guard++ < 60) {
        const actor = table.actor;
        if (!actor) break;
        const action = botAction(table, actor, rng);
        if (!actor.isHero && table.board.length >= 3
          && (action.type === 'bet' || action.type === 'raise')) {
          const atDecision = bettingRangeOf(table, actor, rng);
          table.act(action);
          const afterPaying = bettingRangeOf(table, actor, rng);
          assert(atDecision.length >= 15,
            `asked while deciding, only ${atDecision.length} hands would bet`);
          assert(afterPaying.length === 0,
            'asked after paying it should reject everything — that is the trap this guards');
          return;
        }
        table.act(action);
      }
    }
    assert(false, 'no bot bet after a flop in 200 hands');
  });
});
