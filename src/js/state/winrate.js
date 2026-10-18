/**
 * Where your win rate stands: your bb a hundred hands at the cash tables,
 * against what players of each kind make, and how sure the number is yet.
 *
 * The bands are the ones the online six-max cash games are usually measured
 * by: most players lose, a good regular makes a few big blinds a hundred, a
 * pro more, and the best beat their games by ten and over. A win rate swings a
 * long way over a few thousand hands — about 90 bb a hundred hands of standard
 * deviation at six-max — so the range around yours narrows as the hands come.
 *
 * Free of the DOM so it can be tested.
 */

import { stakeFor } from './stats.js';

/** bb/100 bands, from the bottom up: each runs from its `from` to the next one's. */
export const WINRATE_BANDS = [
  { key: 'beginner', name: 'Beginner', from: -Infinity, to: 0, note: 'Most players lose: the rake and the mistakes add up.' },
  { key: 'intermediate', name: 'Intermediate', from: 0, to: 3, note: 'Breaking even to a small win. Solid before the flop.' },
  { key: 'regular', name: 'Strong regular', from: 3, to: 6, note: 'Wins steadily. Few leaks, and picks the right tables.' },
  { key: 'pro', name: 'Pro', from: 6, to: 10, note: 'Makes a living at it: sound everywhere, and punishes mistakes.' },
  { key: 'elite', name: 'Elite', from: 10, to: Infinity, note: 'The best in the game, or the softest tables.' },
];

/** What each band makes, as a typical figure for the profit table. */
export const BAND_TYPICAL = { beginner: -5, intermediate: 1.5, regular: 4.5, pro: 8, elite: 12 };

/** Standard deviation of a six-max cash win rate, in bb a hundred hands. */
export const WINRATE_SD = 90;

/** The scale the chart draws: -15 to +20 bb a hundred. */
export const SCALE = { lo: -15, hi: 20 };

export const bandFor = (rate) => WINRATE_BANDS.find((b) => rate >= b.from && rate < b.to) || WINRATE_BANDS[0];

/** The range your true win rate is likely in (about 95%), given the hands it is from. */
export function confidence(rate, hands) {
  if (!hands) return null;
  const half = 1.96 * WINRATE_SD / Math.sqrt(hands / 100);
  return { lo: rate - half, hi: rate + half, half };
}

/**
 * Your cash profit in money: each sitting's big blinds at the stake it was
 * played at. The practice table plays for nothing and is left out.
 */
export function cashProfit(sessions) {
  let money = 0;
  let bb = 0;
  let hands = 0;
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (!s || s.stake === 'practice' || !Number.isFinite(s.profitBb)) continue;
    money += s.profitBb * stakeFor(s.stake).bb;
    bb += s.profitBb;
    hands += Number.isFinite(s.hands) ? s.hands : 0;
  }
  return { money: Math.round(money * 100) / 100, bb: Math.round(bb * 10) / 10, hands };
}

/** What a band makes over a number of hands at a stake, in money. */
export const expectedProfit = (rate, hands, stakeKey) => Math.round((rate * hands / 100) * stakeFor(stakeKey).bb * 100) / 100;

/** Where on the scale a win rate sits, 0–100%, clamped to the ends. */
export const scaleAt = (rate) => Math.max(0, Math.min(100, ((rate - SCALE.lo) / (SCALE.hi - SCALE.lo)) * 100));

/**
 * Your win rate at each stake you have played for money, lowest stake first:
 * hands, big blinds, bb a hundred, the band it is in, and the money. From the
 * sittings the save keeps (the last 200); the practice table is left out.
 */
export function byStake(sessions) {
  const rows = new Map();
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (!s || s.stake === 'practice' || !Number.isFinite(s.profitBb) || !Number.isFinite(s.hands) || s.hands <= 0) continue;
    const stake = stakeFor(s.stake);
    const row = rows.get(stake.key) || { stake, hands: 0, bb: 0 };
    row.hands += s.hands;
    row.bb += s.profitBb;
    rows.set(stake.key, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.stake.bb - b.stake.bb)
    .map((r) => {
      const rate = (r.bb / r.hands) * 100;
      return { ...r, bb: Math.round(r.bb * 10) / 10, rate, band: bandFor(rate), money: Math.round(r.bb * r.stake.bb * 100) / 100 };
    });
}
