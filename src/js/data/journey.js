/**
 * The Road: what to do at each stop on the river, and in what order.
 *
 * The map had everything on it at once — the school, the charts, the
 * boatyard, eight tables — and nothing that said where to start. The reader
 * asked for what Governor of Poker gives: a city, with things to do in it that
 * can be done in any order, and the next city once they are. Work from city to
 * city, not a bit of everything everywhere.
 *
 * So each stop has a short list. Every list is the same three kinds of
 * thing, in the order a person would do them:
 *
 *   learn — the chapters that stop teaches, read through to the end
 *   play  — hands at that stop's own table, because a chapter only sticks
 *           once it has met some cards
 *   take  — the table itself, from the one who owns it
 *
 * plus a bonus or two that are worth doing and do not hold anybody up. The
 * next stop opens when the required ones are done. The chapters follow the
 * curriculum's order, and the rank each asks for (Minnow for the second city,
 * Nit for the third …) is the rank the lessons before it build, so a list
 * never asks for a chapter that rank will not yet let you open.
 *
 * Only the shape lives here; state/journey.js reads it against a profile.
 */

/**
 * @typedef {object} Bonus
 * @property {'stars'|'regatta'|'fish'|'chart'|'boat'|'pet'|'race'} kind
 * @property {number} [need]   how many, for stars, fish and companions
 * @property {string} [key]    the chart's checkpoint, or the boat's key
 */

/**
 * @typedef {object} Chapter
 * @property {string} stop       the stop's key, which is its stake's key
 * @property {string[]} lessons  module ids, in the order to read them
 * @property {number} hands      hands to play at this stop's table
 * @property {Bonus[]} bonus
 */

/** One chapter per stop, upriver to down. */
export const ROAD = [
  {
    stop: 'nl2',
    lessons: ['hand-rankings', 'pot-odds'],
    hands: 25,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'fish', need: 1 }],
  },
  {
    stop: 'nl5',
    lessons: ['outs', 'preflop'],
    hands: 40,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'chart', key: 'open:BTN' }, { kind: 'pet', need: 1 }],
  },
  {
    stop: 'nl10',
    lessons: ['position', 'bankroll'],
    hands: 60,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'regatta' }, { kind: 'boat', key: 'skiff' }],
  },
  {
    stop: 'nl25',
    lessons: ['cbet'],
    hands: 80,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'fish', need: 4 }],
  },
  {
    stop: 'nl50',
    lessons: ['mdf'],
    hands: 100,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'regatta' }, { kind: 'race', need: 1 }],
  },
  {
    stop: 'nl100',
    lessons: ['bluffing', 'exploit'],
    hands: 120,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'pet', need: 3 }],
  },
  {
    stop: 'nl200',
    lessons: ['spr'],
    hands: 150,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'regatta' }, { kind: 'boat', key: 'launch' }],
  },
  {
    stop: 'nl500',
    lessons: ['icm'],
    hands: 200,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'fish', need: 10 }],
  },

  /* ---- The Gulf: the second act, opened by taking the delta ---- */
  {
    stop: 'nl1000',
    lessons: ['value'],
    hands: 220,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'regatta' }],
  },
  {
    stop: 'nl2000',
    lessons: ['streets'],
    hands: 240,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'race', need: 3 }],
  },
  {
    stop: 'nl5000',
    lessons: ['threebet'],
    hands: 260,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'regatta' }],
  },
  {
    stop: 'nl10k',
    lessons: ['multiway'],
    hands: 280,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'pet', need: 6 }],
  },
  {
    stop: 'nl25k',
    lessons: ['pushfold'],
    hands: 300,
    bonus: [{ kind: 'stars', need: 2 }, { kind: 'regatta' }],
  },
];

/**
 * What the owner of a table hands over when it is taken, as a multiple of
 * the bankroll the next stop asks for. Exactly the bar would be a bar you
 * could fall below with one bad night, and then the stop you had just earned
 * would be shut again; half as much again leaves room to lose a few buy-ins
 * and still be let in.
 */
export const PURSE_MARGIN = 1.5;
