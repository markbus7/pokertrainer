/**
 * Regattas: a tournament with a finish line and a prize list.
 *
 * Six players, 1,500 chips each, and a blind clock that climbs until one of
 * them has everything. The top three are paid: half the prize pool, three
 * tenths, a fifth. It is the same game with two things changed that change
 * everything — you cannot rebuy, and a chip is no longer worth what it was.
 * With payouts, the chips that would take you out are worth more to you than
 * the chips you would win, and that is the whole of tournament poker.
 *
 * The entry is a seat's price and the pool is paid back in full, so a player
 * who is no better than the field breaks even and nobody takes a rake: it is a
 * game for finding out whether you are.
 *
 * Free of the DOM, so it can be tested.
 */

export const FIELD = 6;
export const START_STACK = 1500;

/** The blinds, as [small, big]: eleven levels, the last of which stays up. */
export const LEVELS = [
  [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400],
  [300, 600], [400, 800], [600, 1200], [800, 1600], [1000, 2000],
];
export const LEVEL_HANDS = 6;

/** The blinds for the nth hand dealt (0 for the first), and what is left of the level. */
export function blindsFor(handIndex, levels = LEVELS, perLevel = LEVEL_HANDS) {
  const raw = Math.floor(Math.max(0, handIndex) / perLevel);
  const level = Math.min(raw, levels.length - 1);
  const last = level === levels.length - 1;
  const [small, big] = levels[level];
  return { small, big, level, last, left: last ? Infinity : perLevel - (handIndex % perLevel) };
}

/** How the prize pool is shared: first, second, third. */
export const SHARES = [0.5, 0.3, 0.2];

/** What each place pays, in the money of the entry, for a given entry. */
export function payouts(entry, field = FIELD) {
  const pool = entry * field;
  return SHARES.map((share) => Math.round(pool * share * 100) / 100);
}

/** What a place pays: 0 outside the money. */
export const prizeFor = (place, entry, field = FIELD) => payouts(entry, field)[place - 1] || 0;

/**
 * Who finishes where when several players are knocked out on the same hand.
 * The one who started the hand with the fewest chips finishes last of them
 * (the way every tournament breaks the tie).
 *
 * @param {number} aliveBefore  players with chips when the hand was dealt
 * @param {Array<{id:string, stack:number}>} out  the players with none now, and what they started the hand with
 * @returns {Array<{id:string, place:number}>}
 */
export function placesFor(aliveBefore, out) {
  const ordered = out.slice().sort((a, b) => a.stack - b.stack || (a.id < b.id ? -1 : 1));
  return ordered.map((p, i) => ({ id: p.id, place: aliveBefore - i }));
}

/**
 * What finishing pays in pearls, on top of the prize: the first time a place
 * is reached at a stop, and only the improvement on the best one held, so a
 * replay is worth playing for a better finish and not for the same one again.
 */
export const PLACE_PEARLS = [0, 60, 35, 20];
export function placePearls(stopIndex, bestBefore, place) {
  const value = (p) => (p >= 1 && p <= 3 ? PLACE_PEARLS[p] : 0);
  const before = bestBefore ? value(bestBefore) : 0;
  const gain = Math.max(0, value(place) - before);
  return Math.round(gain * (1 + 0.25 * Math.max(0, stopIndex)));
}

/**
 * Whether the reader's tournament is over, and where they finished: out when
 * they have no chips (their place is the number of players who were alive when
 * they went), or first when everyone else is.
 */
export function standing({ heroStack, rivalsAlive, aliveBeforeHeroOut = null }) {
  if (heroStack <= 0) return { over: true, place: aliveBeforeHeroOut ?? rivalsAlive + 1 };
  if (rivalsAlive === 0) return { over: true, place: 1 };
  return { over: false, place: null };
}

/** 1st … 6th, as keys for t(): the Dutch is 1e, 2e, and so on. */
const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
export const ordinal = (n) => ORDINALS[n] || `${n}th`;
