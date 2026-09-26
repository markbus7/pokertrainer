/**
 * The stops on the Long River.
 *
 * The app was a grid of training modules with a score attached, and the
 * reader's verdict was that it was not a game. It was not: a course with a
 * progress bar has no world in it, nowhere to be and nobody to beat.
 *
 * So the stakes ladder is a river, and every rung of it is a stop: a landing,
 * a tavern, a ferry, a steamer's saloon, down to the Commodore's flagship at
 * the delta. Each has a buy-in you pay out of your own money, somebody who
 * owns its table, and a bankroll at which the next stop downriver will have
 * you. The climb is cash, the way it is at a real table and the way it is in
 * the games this borrows from: you move on when you can afford to, and you
 * move back upriver when you cannot.
 *
 * The NL labels stay on every stop. The point of all this is to play online
 * profitably, and a reader who learns "the Ferry" without learning "NL10" has
 * learned a story instead of a stake.
 *
 * `resident` is the style the stop's boss plays (a key into the bot
 * profiles), `boss` is who they are, and `landmark` is what the map draws.
 */

import { STAKES } from '../state/stats.js';

/** One stop per rung of the real stakes ladder, upriver to down. */
const ROOMS = [
  {
    key: 'nl2',
    name: 'Mud Landing',
    where: 'A crate table on the landing',
    resident: 'station',
    boss: 'wade',
    landmark: 'landing',
    colour: 'Lantern light, river mud, and a dockhand who has never folded anything in his life.',
  },
  {
    key: 'nl5',
    name: 'Fisher\'s Rest',
    where: 'A tavern on stilts over the shallows',
    resident: 'station',
    boss: 'tilly',
    landmark: 'tavern',
    colour: 'Nobody folds here either. The tea is free and the chairs complain.',
  },
  {
    key: 'nl10',
    name: 'The Ferry',
    where: 'One table bolted to a ferry deck',
    resident: 'rock',
    boss: 'hollis',
    landmark: 'ferry',
    colour: 'The first table where somebody sits and waits for a hand.',
  },
  {
    key: 'nl25',
    name: 'Cotton Row',
    where: 'Upstairs at the cotton exchange',
    resident: 'tag',
    boss: 'evangeline',
    landmark: 'exchange',
    colour: 'Traders who know what a price is. Position stops being a word.',
  },
  {
    key: 'nl50',
    name: 'The Belle',
    where: 'A paddle steamer\'s saloon',
    resident: 'lag',
    boss: 'rourke',
    landmark: 'steamer',
    colour: 'Loud, fast, and expensive if you play back without a hand.',
  },
  {
    key: 'nl100',
    name: 'The Grand Hotel',
    where: 'The quiet parlour on the riverfront',
    resident: 'pro',
    boss: 'ashby',
    landmark: 'hotel',
    colour: 'Quiet. Everybody here studies as hard as you do.',
  },
  {
    key: 'nl200',
    name: 'The Gilded Barge',
    where: 'No name on the hull',
    resident: 'maniac',
    boss: 'delacroix',
    landmark: 'barge',
    colour: 'Somebody at this table is gambling with money that is not theirs.',
  },
  {
    key: 'nl500',
    name: 'Delta Crown',
    where: 'The Commodore\'s flagship, at the delta',
    resident: 'pro',
    boss: 'commodore',
    landmark: 'flagship',
    colour: 'The last table on the river. Nobody here is going to give you anything.',
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
