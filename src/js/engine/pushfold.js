/**
 * Short stacks: push or fold.
 *
 * Below about twelve big blinds there is no poker left to play — a raise and a
 * call would commit the stack anyway, so the decision collapses to one chip
 * move: all in, or out. The ordinary bots, built for a hundred big blinds,
 * have nothing to say about it, and a tournament is mostly played here.
 *
 * What a bot does when short is a width: the share of hands it shoves with, as
 * a function of its stack, then widened or narrowed for its seat and its
 * style. The shares are the shape of the real equilibrium charts rather than
 * the charts themselves — about a third of hands at ten big blinds, over half
 * at five, nearly everything at two — and the calling range facing a shove
 * is a little over half the pushing one, tighter the bigger the shove is
 * against the pot.
 *
 * Free of the DOM and of the table, so it can be tested.
 */

/** Stack in big blinds → share of hands to push, for an average seat. */
const PUSH = [[2, 1], [3, 0.9], [4, 0.74], [5, 0.63], [6, 0.54], [8, 0.42], [10, 0.34], [12, 0.28], [15, 0.2]];

/** Above this, a stack is not short and the ordinary bot plays it. */
export const SHORT_STACK_BB = 12;

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** The share of hands to shove at this many big blinds, between 0 and 1. */
export function pushShare(stackBb) {
  if (stackBb <= PUSH[0][0]) return PUSH[0][1];
  for (let i = 1; i < PUSH.length; i++) {
    const [x1, y1] = PUSH[i];
    const [x0, y0] = PUSH[i - 1];
    if (stackBb <= x1) return y0 + ((stackBb - x0) / (x1 - x0)) * (y1 - y0);
  }
  return PUSH[PUSH.length - 1][1] * Math.max(0, 1 - (stackBb - 15) / 20);
}

/**
 * The share of hands to call a shove with. About 55% of the pushing share, and
 * wider when the price is good: calling 1 to win 6 is not calling 1 to win 1.
 *
 * @param {number} stackBb
 * @param {number} price  what it costs, as a share of what you could win (toCall / (pot + toCall))
 */
export function callShare(stackBb, price) {
  const cheap = clamp(0.3 - price, 0, 0.3) / 0.3;       // 0 at a poor price, 1 at a free one
  return clamp(pushShare(stackBb) * 0.55 * (1 + 0.9 * cheap), 0, 1);
}

/** Style: how much wider or narrower than the average a style pushes and calls. */
export const pushMult = (profile) => clamp(0.55 + (profile.aggression ?? 0.5) * 0.6, 0.6, 1.3);
export const callMult = (profile) => clamp(0.5 + (profile.callDown ?? 0.5), 0.7, 1.6);

/**
 * What a short-stacked bot does before the flop.
 *
 * @param {object} s
 * @param {number} s.stackBb     its stack, with what it has already posted, in big blinds
 * @param {number} s.percentile  the rank of its hand, 0 the best and 1 the worst
 * @param {number} s.posFactor   0 (big blind) to 1 (button)
 * @param {boolean} s.facing     somebody has raised or shoved
 * @param {number} s.price       toCall / (pot + toCall), when facing
 * @param {boolean} s.canCheck
 * @param {object} s.profile
 * @returns {'push'|'call'|'fold'|'check'|null}  null when the stack is not short
 */
export function shortStackMove({ stackBb, percentile, posFactor, facing, price = 0.5, canCheck, profile }) {
  if (stackBb > SHORT_STACK_BB) return null;
  if (!facing) {
    // Nobody has raised. The big blind with a free look takes it.
    const seat = 0.6 + 0.8 * posFactor;
    const cut = clamp(pushShare(stackBb) * seat * pushMult(profile), 0, 1);
    if (percentile <= cut) return 'push';
    return canCheck ? 'check' : 'fold';
  }
  const cut = clamp(callShare(stackBb, price) * callMult(profile), 0, 1);
  if (percentile <= cut) return 'call';
  return canCheck ? 'check' : 'fold';
}
