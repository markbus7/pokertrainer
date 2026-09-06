/**
 * Where you are sitting, and what that means.
 *
 * Position is taught in this game as vocabulary — "open wider on the button" —
 * but nothing ever asked the reader to *find* the button on a table and work
 * out what their own seat is called. That is the same gap the hand shapes had:
 * the word is used long before the picture behind it is automatic.
 *
 * This module builds a seat ring the felt can draw, and answers the two
 * questions that make position mean something: who acts after you before the
 * flop, and who acts after you once there is a board.
 */

import { positionNames } from '../engine/variants.js';
import { POSITION_INFO } from '../data/ranges.js';
import { randInt } from './rng.js';
import { t } from '../i18n/index.js';

export const BOT_NAMES = ['Rocky', 'Tessa', 'Leo', 'Stan', 'Max', 'Nina', 'Pia', 'Owen'];

/**
 * A table with a button, a hero seat and a name for every chair.
 *
 * @param {function} rng
 * @param {object} [opts] seatCount, or a fixed heroPosition to build around
 * @returns {{seatCount, button, heroSeat, seats: Array}}
 */
export function seatRing(rng, opts = {}) {
  const seatCount = opts.seatCount || 6;
  const names = positionNames(seatCount);
  const button = randInt(rng, seatCount);

  // Seat i's position is names[(i - button + seatCount) % seatCount], because
  // names[0] is the button itself and the list runs clockwise from there.
  const positionAt = (seat) => names[(seat - button + seatCount) % seatCount];

  let heroSeat = randInt(rng, seatCount);
  if (opts.heroPosition) {
    heroSeat = [...Array(seatCount).keys()].find((s) => positionAt(s) === opts.heroPosition);
    if (heroSeat === undefined) return null;
  }

  const seats = [...Array(seatCount).keys()].map((seat) => ({
    seat,
    position: positionAt(seat),
    isHero: seat === heroSeat,
    name: seat === heroSeat ? t('You') : BOT_NAMES[(seat + button) % BOT_NAMES.length],
  }));

  return { seatCount, button, heroSeat, seats, heroPosition: positionAt(heroSeat) };
}

/**
 * Preflop, action starts to the left of the big blind and ends with the big
 * blind. So the number of players still to act after you is your distance
 * from the end of that order.
 */
export function preflopOrder(ring) {
  const bbSeat = ring.seats.find((s) => s.position === 'BB').seat;
  return rotate(ring, (bbSeat + 1) % ring.seatCount);
}

/** Postflop, the small blind is first and the button is last. */
export function postflopOrder(ring) {
  const sb = ring.seats.find((s) => s.position === 'SB');
  return rotate(ring, sb ? sb.seat : (ring.button + 1) % ring.seatCount);
}

function rotate(ring, firstSeat) {
  return [...Array(ring.seatCount).keys()]
    .map((i) => ring.seats[(firstSeat + i) % ring.seatCount]);
}

/** How many players act after you on a given street. */
export function playersAfter(ring, street = 'preflop') {
  const order = street === 'preflop' ? preflopOrder(ring) : postflopOrder(ring);
  const idx = order.findIndex((s) => s.isHero);
  return order.length - 1 - idx;
}

/** The long name — "Cutoff" rather than "CO". */
export const seatName = (position) => {
  const info = POSITION_INFO[position];
  return info ? t(info.name) : position;
};

/** Every seat name this table size uses, in the order a player learns them. */
export const seatChoices = (seatCount = 6) => positionNames(seatCount);
