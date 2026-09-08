/**
 * What "half pot" actually costs.
 *
 * A bet or raise is quoted as the TOTAL you will have committed on this
 * street — the way every poker site reports it ("raise to 30"). So a
 * pot-sized raise is not "the size of the pot": it is call what is owed
 * first, then raise by the pot that call creates. Forgetting the call is
 * how a half-pot button ends up offering less than the minimum raise.
 *
 * `potFraction(ctx, 1)` is by construction the same number the engine's
 * own pot-limit cap produces, and a test pins the two together.
 */

/** The buttons above the action bar, in the order they are shown. */
export const SIZES = [
  { id: 'third', fraction: 1 / 3, label: '⅓ pot' },
  { id: 'half', fraction: 0.5, label: '½ pot' },
  { id: 'threequarter', fraction: 0.75, label: '¾ pot' },
  { id: 'pot', fraction: 1, label: 'Pot' },
  { id: 'allin', fraction: 'allin', label: 'All-in' },
];

/**
 * The betting context a raise is sized against.
 * @param {object} table a Table mid-hand
 * @param {object} player the player to act
 * @param {{min:number,max:number}} spec the raise/bet entry from legalActions
 */
export function sizingContext(table, player, spec) {
  return {
    spec,
    currentBet: table.currentBet,
    pot: table.totalPot,
    toCall: Math.max(0, table.currentBet - player.committed),
  };
}

/** Round to a legal total, and never outside the spec the engine gave us. */
export function clampRaise(spec, amount) {
  const n = Math.round(Number(amount));
  if (!Number.isFinite(n)) return spec.min;
  return Math.min(spec.max, Math.max(spec.min, n));
}

/** The total to raise to for a fraction of the pot, clamped to what is legal. */
export function potFraction(ctx, fraction) {
  if (fraction === 'allin') return ctx.spec.max;
  return clampRaise(ctx.spec, ctx.currentBet + fraction * (ctx.pot + ctx.toCall));
}

/**
 * Every sizing button with the amount it will actually produce.
 *
 * `clamped` marks a button the pot maths could not deliver — in a tiny pot a
 * third-pot raise is smaller than the minimum raise, so the button honestly
 * offers the minimum instead. Showing the number is what stops that reading
 * as a dead button.
 */
export function sizingOffers(ctx) {
  return SIZES.map((size) => {
    const amount = potFraction(ctx, size.fraction);
    const wanted = size.fraction === 'allin'
      ? ctx.spec.max
      : Math.round(ctx.currentBet + size.fraction * (ctx.pot + ctx.toCall));
    return { ...size, amount, clamped: amount !== wanted };
  });
}
