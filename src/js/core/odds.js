/**
 * The arithmetic that turns poker from gambling into a job:
 * pot odds, expected value, minimum defence, bluff ratios, SPR, ICM,
 * bankroll requirements and risk of ruin.
 */

/** Equity you need for a call to break even. `pot` already includes the bet you face. */
export function requiredEquity(callAmount, pot) {
  if (callAmount <= 0) return 0;
  return callAmount / (pot + callAmount);
}

/** Pot odds expressed the way they are spoken at the table: "3.5 to 1". */
export function potOddsRatio(callAmount, pot) {
  if (callAmount <= 0) return Infinity;
  return pot / callAmount;
}

/** EV of calling, in chips. Positive means call. */
export function callEV(equity, callAmount, pot) {
  return equity * pot - (1 - equity) * callAmount;
}

/** EV of a bluff that folds out villain `foldFrequency` of the time. */
export function bluffEV(foldFrequency, betAmount, pot, equityWhenCalled = 0) {
  const folds = foldFrequency * pot;
  const called = (1 - foldFrequency) * (equityWhenCalled * (pot + betAmount) - (1 - equityWhenCalled) * betAmount);
  return folds + called;
}

/** How often a bluff must work to break even: risk / (risk + reward). */
export function breakEvenBluffFrequency(betAmount, pot) {
  return betAmount / (pot + betAmount);
}

/** Minimum Defence Frequency — fold more than this and bluffs print against you. */
export function minimumDefenceFrequency(betAmount, pot) {
  return pot / (pot + betAmount);
}

/**
 * Balanced bluff-to-value ratio for a river bet of `betAmount` into `pot`.
 * Pot-sized bet -> 1 bluff for every 2 value hands.
 */
export function bluffToValueRatio(betAmount, pot) {
  return betAmount / (pot + betAmount);
}

/** Share of a polarised betting range that should be bluffs. */
export function bluffShareOfRange(betAmount, pot) {
  const r = bluffToValueRatio(betAmount, pot);
  return r / (1 + r);
}

/** Stack-to-pot ratio: the single number that decides commitment. */
export function spr(effectiveStack, pot) {
  return pot > 0 ? effectiveStack / pot : Infinity;
}

/** Implied odds: extra chips you must win later to justify a call now. */
export function impliedOddsNeeded(equity, callAmount, pot) {
  if (equity <= 0) return Infinity;
  // Solve equity * (pot + extra) = (1 - equity) * call  for extra.
  const needed = ((1 - equity) * callAmount) / equity - pot;
  return Math.max(0, needed);
}

/** Win rate in big blinds per 100 hands — the currency of online poker. */
export function bbPer100(profitInBb, hands) {
  return hands > 0 ? (profitInBb / hands) * 100 : 0;
}

/**
 * Risk of ruin for a winning player, standard exponential approximation.
 * All units are big blinds per 100 hands.
 */
export function riskOfRuin(bankrollBb, winRatePer100, stdDevPer100 = 100) {
  if (winRatePer100 <= 0) return 1;
  const exponent = (-2 * winRatePer100 * bankrollBb) / (stdDevPer100 * stdDevPer100);
  return Math.min(1, Math.exp(exponent));
}

/** Bankroll (in big blinds) needed to hold risk of ruin at or below `target`. */
export function bankrollForRisk(winRatePer100, stdDevPer100 = 100, target = 0.05) {
  if (winRatePer100 <= 0) return Infinity;
  return (stdDevPer100 * stdDevPer100 * Math.log(1 / target)) / (2 * winRatePer100);
}

/** Expected swing after `hands` hands: one standard deviation, in big blinds. */
export function expectedSwing(hands, stdDevPer100 = 100) {
  return stdDevPer100 * Math.sqrt(hands / 100);
}

/**
 * ICM (Malmuth-Harville): chips are not money once there are payouts.
 * Returns each player's expected prize.
 */
export function icmEquity(stacks, payouts) {
  const n = stacks.length;
  const places = Math.min(payouts.length, n);
  const result = new Array(n).fill(0);

  const walk = (remaining, place, probability, taken) => {
    if (place >= places || probability <= 1e-12) return;
    let total = 0;
    for (const i of remaining) total += stacks[i];
    if (total <= 0) return;
    for (const i of remaining) {
      const p = probability * (stacks[i] / total);
      result[i] += p * payouts[place];
      if (place + 1 < places) {
        walk(remaining.filter((x) => x !== i), place + 1, p, taken.concat(i));
      }
    }
  };

  walk(stacks.map((_, i) => i), 0, 1, []);
  return result;
}

/** What one extra chip is worth relative to its face value (ICM pressure). */
export function icmPressure(stacks, payouts, index) {
  const base = icmEquity(stacks, payouts)[index];
  const totalChips = stacks.reduce((s, x) => s + x, 0);
  const totalPrize = payouts.slice(0, stacks.length).reduce((s, x) => s + x, 0);
  const chipChopValue = (stacks[index] / totalChips) * totalPrize;
  return { icmValue: base, chipValue: chipChopValue, ratio: chipChopValue > 0 ? base / chipChopValue : 1 };
}

/** Rake on a cash pot, capped — the tax that decides whether marginal spots print. */
export function rake(pot, { percent = 0.05, cap = 3, bigBlind = 1, noFlopNoDrop = true, sawFlop = true } = {}) {
  if (noFlopNoDrop && !sawFlop) return 0;
  return Math.min(pot * percent, cap * bigBlind);
}

export function formatPercent(x, digits = 1) {
  return `${(x * 100).toFixed(digits)}%`;
}

export function formatRatio(x) {
  if (!Number.isFinite(x)) return '∞';
  return `${x.toFixed(1)} : 1`;
}
