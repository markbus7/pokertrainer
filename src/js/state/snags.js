/**
 * Your snags, in practice.
 *
 * A snag is a spot before the flop you went wrong in at a real table: the
 * same hand, the same seat, the same thing in front of you (lifetime.js
 * snagsOf). The cat warns you when one comes round by chance; this deals
 * them on purpose. Right three times in a row and a snag comes off the list,
 * for a few pearls — until you go wrong in it again at a table, when it is
 * back. Practice never adds one: only a table can.
 */

import { snagsOf } from './lifetime.js';
import { shuffle } from '../core/rng.js';

/** A spot in words: the seat, and what was in front of you. Run through t(). */
export const SEAT_WORDS = { UTG: 'under the gun', HJ: 'in the hijack', CO: 'in the cutoff', BTN: 'on the button', SB: 'in the small blind', BB: 'in the big blind' };
export const FACING_WORDS = { first: 'first in', raised: 'facing a raise', limped: 'after a limp', bet: 'facing a bet', checked: 'checked to you' };

/** Right this many times in a row, and a snag is cleared. */
export const SNAG_CLEAR = 3;
/** What clearing one pays. Snags only come from real mistakes, so this cannot be farmed. */
export const SNAG_PEARLS = 15;
/** How many questions a sitting asks, and from how many snags. */
export const SNAG_SITTING = 8;
const SNAG_SPOTS = 4;

/** The practice record, read back as numbers whatever was stored: id -> { streak, cleared }. */
export function snagRecord(profile) {
  const d = profile.data;
  const raw = d.snags && typeof d.snags === 'object' && !Array.isArray(d.snags) ? d.snags : {};
  const out = {};
  for (const [id, v] of Object.entries(raw).slice(0, 500)) {
    if (typeof id !== 'string' || id.length > 20 || !v || typeof v !== 'object') continue;
    out[id] = {
      streak: Number.isFinite(v.streak) && v.streak > 0 ? Math.min(SNAG_CLEAR, Math.round(v.streak)) : 0,
      cleared: Number.isFinite(v.cleared) && v.cleared > 0 ? v.cleared : 0,
    };
  }
  d.snags = out;
  return out;
}

/** The snags still on the list, the most often first, each with its streak. */
export function openSnags(profile) {
  const record = snagRecord(profile);
  return snagsOf(profile.lifetime, record).map((s) => ({ ...s, streak: record[s.id] ? record[s.id].streak : 0 }));
}

/**
 * A sitting: up to four snags, each asked as many times as it still needs
 * to come off the list, spread out so the same one does not come twice in a
 * row when there is another to ask between.
 */
export function snagSitting(snags, rng, length = SNAG_SITTING) {
  const spots = snags.slice(0, SNAG_SPOTS);
  if (!spots.length) return [];
  const per = Math.max(1, Math.ceil(length / spots.length));
  const piles = spots.map((s) => Array(Math.min(per, SNAG_CLEAR - (s.streak || 0))).fill(s));
  const out = [];
  while (out.length < length && piles.some((p) => p.length)) {
    const round = shuffle(rng, piles.filter((p) => p.length));
    // Not the one just asked first, when there is another to start with.
    if (round.length > 1 && out.length && round[0][0] === out[out.length - 1]) round.push(round.shift());
    for (const pile of round) {
      if (out.length >= length) break;
      out.push(pile.pop());
    }
  }
  return out;
}

/**
 * One answer to a snag: right keeps the streak going and clears it on the
 * third; wrong starts it again.
 * @returns {{streak:number, cleared:boolean, pearls:number}}
 */
export function noteSnag(profile, id, right, now = Date.now()) {
  const record = snagRecord(profile);
  const row = record[id] || { streak: 0, cleared: 0 };
  if (!right) {
    row.streak = 0;
    record[id] = row;
    profile.save();
    return { streak: 0, cleared: false, pearls: 0 };
  }
  row.streak += 1;
  let cleared = false;
  if (row.streak >= SNAG_CLEAR) {
    cleared = true;
    row.streak = 0;
    row.cleared = now;
  }
  record[id] = row;
  profile.save();
  const pearls = cleared ? profile.earnPearls(SNAG_PEARLS) : 0;
  return { streak: cleared ? SNAG_CLEAR : row.streak, cleared, pearls };
}
