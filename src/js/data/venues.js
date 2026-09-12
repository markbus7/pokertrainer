/**
 * The rooms you play your way through.
 *
 * The app was a grid of training modules with a score attached, and the
 * reader's verdict was that it was not a game. It was not: a course with a
 * progress bar has no world in it, nowhere to be and nobody to beat.
 *
 * So the stakes ladder stops being an abstract list of blinds and becomes
 * eight rooms. Each has a buy-in you pay out of your own money, a regular who
 * sits there every night, and a bankroll at which the next room will let you
 * in. The climb is cash, the way it is at a real table and the way it is in
 * the games this borrows from: you move up when you can afford to, and you
 * move back down when you cannot.
 *
 * The NL labels stay on every room. The point of all this is to play online
 * profitably, and a reader who learns "the back room of the Anchor" without
 * learning "NL10" has learned a story instead of a stake.
 */

import { STAKES } from '../state/stats.js';

/** One room per rung of the real stakes ladder. */
const ROOMS = [
  {
    key: 'nl2',
    name: 'The Kitchen Table',
    where: 'Somebody\'s back room',
    resident: 'station',
    colour: 'A friendly game with terrible players and a bowl of crisps.',
  },
  {
    key: 'nl5',
    name: 'The Anchor',
    where: 'A pub back room',
    resident: 'station',
    colour: 'Nobody folds here. That is the whole strategy and it still works.',
  },
  {
    key: 'nl10',
    name: 'The Boat Club',
    where: 'Riverside, members only',
    resident: 'rock',
    colour: 'The first room with someone who has read a book.',
  },
  {
    key: 'nl25',
    name: 'The Card Room',
    where: 'Above a betting shop',
    resident: 'tag',
    colour: 'Regulars with notes on you. Position stops being a word.',
  },
  {
    key: 'nl50',
    name: 'The Continental',
    where: 'Hotel basement',
    resident: 'lag',
    colour: 'Loud, fast, and expensive if you play back without a hand.',
  },
  {
    key: 'nl100',
    name: 'The Ivory Room',
    where: 'Members\' club, city side',
    resident: 'pro',
    colour: 'Quiet. Everybody here studies as hard as you do.',
  },
  {
    key: 'nl200',
    name: 'The Vault',
    where: 'No sign on the door',
    resident: 'maniac',
    colour: 'Somebody at this table is gambling with money that is not theirs.',
  },
  {
    key: 'nl500',
    name: 'The Long Room',
    where: 'Invitation only',
    resident: 'pro',
    colour: 'The last door. Nobody here is going to give you anything.',
  },
];

/**
 * Every room, with the money attached.
 *
 * `entry` is what a seat costs, `bar` is the bankroll the next room asks for
 * — both read off the stakes table rather than invented here, so the rooms
 * and the ladder cannot drift apart.
 */
export const VENUES = ROOMS.map((room, i) => {
  const stake = STAKES.find((s) => s.key === room.key);
  const next = STAKES[i + 1];
  return {
    ...room,
    index: i,
    stake,
    label: stake.name,
    entry: stake.buyIn,
    /** The bankroll that opens the next door, or null at the top. */
    bar: next ? next.minBankroll : null,
  };
});

export const venueFor = (key) => VENUES.find((v) => v.key === key) || VENUES[0];

/** The best room this bankroll can afford a seat in. */
export function roomYouCanAfford(bankroll) {
  let best = VENUES[0];
  for (const v of VENUES) if (bankroll >= v.stake.minBankroll) best = v;
  return best;
}

/**
 * What stands between you and the next door.
 *
 * Money only, on purpose: the climb here is the one poker actually makes you
 * make. A ladder that opens on lessons read would be a course again.
 */
export function nextDoor(bankroll, venueKey) {
  const here = venueFor(venueKey);
  const next = VENUES[here.index + 1];
  if (!next) return null;
  return {
    venue: next,
    needed: Math.max(0, next.stake.minBankroll - bankroll),
    open: bankroll >= next.stake.minBankroll,
  };
}

/** Below this you cannot afford the cheapest seat in the building. */
export const BROKE = VENUES[0].entry;

/** What the house puts you back in with when you have nothing. */
export const GRUBSTAKE = 20;
