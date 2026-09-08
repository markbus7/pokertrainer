import { describe, it, assert, equal } from './harness.js';
import { createTable } from '../src/js/engine/table.js';
import { makeRng } from '../src/js/core/rng.js';
import { botAction } from '../src/js/engine/bots.js';
import { sizingContext, potFraction, clampRaise, sizingOffers, SIZES } from '../src/js/core/betSizing.js';

const seats = (n, stack = 200) => [...Array(n).keys()].map((i) => ({ id: `p${i}`, name: `P${i}`, stack }));
const table = (n = 6, opts = {}) => createTable({
  players: seats(n, opts.stack), smallBlind: 1, bigBlind: 2, rng: makeRng(opts.seed ?? 42),
});

/** Walk real hands and hand back every spot where a raise was on offer. */
function raiseSpots(hands = 120, seed = 7) {
  const rng = makeRng(seed);
  const found = [];
  for (let h = 0; h < hands; h++) {
    const t = createTable({ players: seats(6), smallBlind: 1, bigBlind: 2, rng });
    t.startHand();
    let guard = 0;
    while (!t.handOver && guard++ < 200) {
      const actor = t.actor;
      if (!actor) break;
      const spec = t.legalActions(actor).find((a) => a.type === 'raise' || a.type === 'bet');
      // Everything is read now: the table plays on, so a reference to it
      // would answer about a different moment than the one collected.
      if (spec) found.push({ spec, ctx: sizingContext(t, actor, spec), potLimitMax: t.potLimitMax(actor) });
      t.act(botAction(t, actor, rng));
    }
  }
  return found;
}

describe('bet sizing: the pot maths', () => {
  it('sizes a pot raise the way the engine caps a pot-limit bet', () => {
    // The one definition worth pinning: "pot" means call what is owed, then
    // raise by the pot that call creates. If the button and the engine ever
    // disagree about that, one of them is teaching the reader wrong.
    let checked = 0;
    for (const { ctx, potLimitMax } of raiseSpots(60)) {
      equal(potFraction(ctx, 1), Math.min(ctx.spec.max, Math.max(ctx.spec.min, potLimitMax)),
        'a pot-sized raise is the pot-limit cap');
      checked++;
    }
    assert(checked > 200, `enough spots to mean something (${checked})`);
  });

  it('bets a plain fraction of the pot when nothing is owed', () => {
    // With no bet to call there is no call to fold into the pot first, so
    // half pot really is half the pot.
    const spots = raiseSpots(80).filter((s) => s.ctx.toCall === 0 && s.ctx.pot >= 20);
    assert(spots.length > 10, `found some open-betting spots (${spots.length})`);
    for (const { ctx } of spots.slice(0, 40)) {
      equal(potFraction(ctx, 0.5), Math.min(ctx.spec.max, Math.max(ctx.spec.min, Math.round(ctx.pot * 0.5))));
    }
  });

  it('counts the call the raiser still owes', () => {
    // The reader's own screenshot: small blind, pot 3, minimum raise 4.
    // Dropping the call from the sum put every fraction below the minimum,
    // so ⅓, ½ and ¾ all handed back 4 and the buttons looked dead.
    const ctx = { spec: { min: 4, max: 200 }, currentBet: 2, pot: 3, toCall: 1 };
    equal(potFraction(ctx, 1), 6, 'pot raise from the small blind');
    equal(potFraction(ctx, 0.75), 5);
    equal(potFraction(ctx, 0.5), 4);

    const forgotTheCall = Math.round(ctx.currentBet + 1 * ctx.pot);
    assert(potFraction(ctx, 1) > forgotTheCall, 'and it is bigger than forgetting the call');
  });

  it('offers four different raises wherever the pot is big enough to allow them', () => {
    // "Big enough" means the smallest offer clears the minimum raise on its
    // own: below that the rules, not the maths, decide the number.
    const spots = raiseSpots(120).filter((s) =>
      s.ctx.currentBet + (s.ctx.pot + s.ctx.toCall) / 3 > s.ctx.spec.min && s.ctx.spec.max > s.ctx.pot * 2);
    assert(spots.length > 20, `enough roomy spots (${spots.length})`);
    let collapsed = 0;
    for (const { ctx } of spots) {
      const amounts = new Set(sizingOffers(ctx).map((o) => o.amount));
      if (amounts.size < 4) collapsed++;
    }
    equal(collapsed, 0, 'no roomy spot hands back the same number twice');
  });
});

describe('bet sizing: staying legal', () => {
  it('never offers an amount the engine would refuse', () => {
    // Every button, played for real at a real table. A sizing button that
    // produces an illegal raise does not misprice a pot — it throws, mid-hand.
    const rng = makeRng(11);
    const taken = new Map();
    let played = 0;
    for (let h = 0; h < 150; h++) {
      const t = createTable({ players: seats(6), smallBlind: 1, bigBlind: 2, rng });
      t.startHand();
      let guard = 0;
      while (!t.handOver && guard++ < 200) {
        const actor = t.actor;
        if (!actor) break;
        const spec = t.legalActions(actor).find((a) => a.type === 'raise' || a.type === 'bet');
        if (!spec) { t.act(botAction(t, actor, rng)); continue; }
        const offers = sizingOffers(sizingContext(t, actor, spec));
        const offer = offers[Math.floor(rng() * offers.length)];
        for (const each of offers) {
          assert(each.amount >= spec.min && each.amount <= spec.max,
            `${each.id} → ${each.amount} outside ${spec.min}..${spec.max}`);
        }
        t.act({ type: spec.type, amount: offer.amount });
        taken.set(offer.id, (taken.get(offer.id) || 0) + 1);
        played++;
      }
    }
    assert(played > 300, `enough raises played (${played})`);
    for (const size of SIZES) {
      assert(taken.get(size.id) > 5, `${size.id} was played for real (${taken.get(size.id) || 0} times)`);
    }
  });

  it('clamps anything a reader can type into a legal raise', () => {
    const spec = { min: 14, max: 200 };
    equal(clampRaise(spec, 1), 14, 'below the minimum');
    equal(clampRaise(spec, 99999), 200, 'above the stack');
    equal(clampRaise(spec, 37.4), 37, 'fractions round');
    equal(clampRaise(spec, NaN), 14, 'junk falls back to the minimum');
    equal(clampRaise(spec, ''), 14, 'so does an empty field');
    equal(clampRaise(spec, '52'), 52, 'a typed string is a number');
  });

  it('marks a button the pot maths could not deliver', () => {
    // Honest labelling: in a tiny pot a third-pot raise is smaller than the
    // minimum raise, so the button offers the minimum and says so.
    const tiny = { spec: { min: 4, max: 200 }, currentBet: 2, pot: 3, toCall: 1 };
    const third = sizingOffers(tiny).find((o) => o.id === 'third');
    assert(third.clamped, 'a third of a 3-chip pot cannot make a legal raise');
    equal(third.amount, 4, 'so it offers the minimum');

    const roomy = { spec: { min: 20, max: 400 }, currentBet: 10, pot: 60, toCall: 10 };
    for (const offer of sizingOffers(roomy)) {
      if (offer.id === 'allin') continue;
      assert(!offer.clamped, `${offer.id} fits in a 60-chip pot`);
    }
  });

  it('keeps one button per size, in ladder order', () => {
    equal(SIZES.length, 5);
    equal(SIZES.map((s) => s.id).join(' '), 'third half threequarter pot allin');
    equal(SIZES[4].fraction, 'allin');
    const ctx = { spec: { min: 20, max: 400 }, currentBet: 10, pot: 60, toCall: 10 };
    equal(potFraction(ctx, 'allin'), 400, 'all-in is the whole stack, not a pot fraction');
  });
});
