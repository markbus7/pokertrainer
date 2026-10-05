/**
 * Push or fold: what a short-stacked bot does.
 *
 * The shape is what is pinned — wider as the stack shrinks, later seats wider
 * than earlier ones, a call tighter than a shove, a maniac wider than a nit —
 * because a tournament table full of bots that all do something different from
 * a real short stack would teach the wrong thing.
 */

import { describe, it, assert, equal } from './harness.js';
import { pushShare, callShare, shortStackMove, SHORT_STACK_BB, pushMult, callMult } from '../src/js/engine/pushfold.js';
import { PROFILES, botAction } from '../src/js/engine/bots.js';
import { createTable } from '../src/js/engine/table.js';
import { makeRng } from '../src/js/core/rng.js';
import { parseCards } from '../src/js/core/cards.js';

describe('push or fold: how wide', () => {
  it('shoves more as the stack shrinks, and never more than everything', () => {
    let prev = Infinity;
    for (let bb = 1; bb <= 25; bb += 0.5) {
      const s = pushShare(bb);
      assert(s >= 0 && s <= 1, `${s} at ${bb}bb`);
      assert(s <= prev + 1e-9, `the range widened at ${bb}bb`);
      prev = s;
    }
    equal(pushShare(1), 1);
    assert(pushShare(10) > 0.25 && pushShare(10) < 0.45, `${pushShare(10)} at ten big blinds`);
    assert(pushShare(5) > 0.5, 'less than half the hands at five big blinds');
  });

  it('calls a shove with about half what it would shove, and wider at a good price', () => {
    for (const bb of [3, 6, 10]) {
      assert(callShare(bb, 0.5) < pushShare(bb), `a call is not tighter than a shove at ${bb}bb`);
      assert(callShare(bb, 0.1) > callShare(bb, 0.5), 'a good price did not widen the call');
    }
  });

  it('puts a nit well inside a maniac, in both directions', () => {
    assert(pushMult(PROFILES.rock) < pushMult(PROFILES.maniac));
    assert(callMult(PROFILES.rock) < callMult(PROFILES.station));
    assert(callMult(PROFILES.station) > callMult(PROFILES.tag), 'a station does not call more than a regular');
  });
});

describe('push or fold: what it does', () => {
  const base = { posFactor: 0.5, facing: false, price: 0.5, canCheck: false, profile: PROFILES.tag };

  it('leaves a deep stack to the ordinary bot', () => {
    equal(shortStackMove({ ...base, stackBb: SHORT_STACK_BB + 1, percentile: 0.01 }), null);
  });

  it('shoves aces, folds the worst hand, and checks a free big blind', () => {
    equal(shortStackMove({ ...base, stackBb: 8, percentile: 0.01 }), 'push');
    equal(shortStackMove({ ...base, stackBb: 8, percentile: 0.99 }), 'fold');
    equal(shortStackMove({ ...base, stackBb: 8, percentile: 0.99, canCheck: true }), 'check');
  });

  it('shoves later seats wider than earlier ones', () => {
    const at = (posFactor) => {
      let n = 0;
      for (let i = 1; i <= 100; i++) if (shortStackMove({ ...base, stackBb: 9, percentile: i / 100, posFactor }) === 'push') n++;
      return n;
    };
    assert(at(1) > at(0.5) && at(0.5) > at(0), `the button shoves ${at(1)}, the middle ${at(0.5)}, the early seats ${at(0)}`);
  });

  it('calls a shove with fewer hands than it would shove with', () => {
    const count = (facing) => {
      let n = 0;
      for (let i = 1; i <= 100; i++) if (shortStackMove({ ...base, stackBb: 7, percentile: i / 100, facing }) !== 'fold') n++;
      return n;
    };
    assert(count(true) < count(false), 'a bot calls as wide as it shoves');
    equal(shortStackMove({ ...base, stackBb: 7, percentile: 0.01, facing: true }), 'call', 'aces folded to a shove');
  });

  it('plays a maniac wider than a nit with the same hand and stack', () => {
    const width = (profile) => {
      let n = 0;
      for (let i = 1; i <= 100; i++) if (shortStackMove({ ...base, stackBb: 8, percentile: i / 100, profile }) === 'push') n++;
      return n;
    };
    assert(width(PROFILES.maniac) > width(PROFILES.rock), `maniac ${width(PROFILES.maniac)}, nit ${width(PROFILES.rock)}`);
  });
});

describe('push or fold: in a tournament table', () => {
  const setup = (stackBb, hole, { pushFold = true, position = null } = {}) => {
    const table = createTable({
      players: [
        { id: 'bot', name: 'Bot', stack: 100 * stackBb, profile: 'tag' },
        { id: 'a', name: 'A', stack: 3000, profile: 'tag' },
        { id: 'b', name: 'B', stack: 3000, profile: 'tag' },
      ],
      smallBlind: 50, bigBlind: 100, rng: makeRng(11),
    });
    table.pushFold = pushFold;
    table.startHand();
    // First to act three-handed is the button: the bot.
    const bot = table.player('bot');
    while (table.actor && table.actor.id !== 'bot') table.act({ type: 'fold' });
    bot.hole = parseCards(hole);
    return { table, bot };
  };

  it('shoves aces with six big blinds, as an all-in raise', () => {
    const { table, bot } = setup(6, 'Ah Ad');
    const move = botAction(table, bot, makeRng(1));
    assert(move.type === 'raise' || move.type === 'bet', `aces did ${move.type}`);
    equal(move.amount, bot.stack + bot.committed, 'the shove was not all in');
  });

  it('folds the worst hand with six big blinds rather than playing it', () => {
    const { table, bot } = setup(6, '7h 2c');
    equal(botAction(table, bot, makeRng(1)).type, 'fold');
  });

  it('leaves a deep stack alone: seventy-two is still not shoved with a hundred big blinds', () => {
    const { table, bot } = setup(100, '7h 2c');
    const move = botAction(table, bot, makeRng(1));
    assert(!(move.amount && move.amount >= bot.stack), `shoved 72o with a deep stack: ${JSON.stringify(move)}`);
  });

  it('does nothing different when the table is not a tournament', () => {
    // The same six big blinds and aces, but a cash table: the ordinary bot opens to a normal size.
    const { table, bot } = setup(6, 'Ah Ad', { pushFold: false });
    const move = botAction(table, bot, makeRng(1));
    assert(move.note !== 'push', 'a cash table pushed');
  });
});
