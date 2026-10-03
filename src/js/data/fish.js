/**
 * The Catch Book: the fish of the Long River, and what lands each one.
 *
 * The reader asked for a fishing game alongside the poker, and then for
 * rewards that only have to do with poker. This is both: every fish is a
 * kind of poker spot, and the only way to land one is to play that spot
 * right at a real table. A Steal Perch is an open from the late seats that
 * the chart agrees with; a Hero-Call Catfish is a river call that the price
 * allowed and the showdown proved. Nothing is caught with help, at a lesson
 * table, or by a decision the coach marked as a mistake.
 *
 * The bigger fish live further down the river, the way the harder spots do:
 * the shallows by Mud Landing hold the preflop basics, the delta holds the
 * commitment decisions. A fish can be caught in its own water and anywhere
 * below it, never above — so the book fills in as the boat goes down.
 *
 * Kept free of the DOM so the rules can be tested in Node.
 */

/**
 * The waters, top of the river to the bottom. `from` is the first stop
 * (VENUES index) that is in them; the Saloon's practice table fishes the
 * shallows. `reward` is what a first catch of one of its fish pays.
 */
export const WATERS = [
  { key: 'shallows', name: 'The Shallows', blurb: 'Mud Landing, Fisher\'s Rest and the Saloon. The preflop basics.', from: 0, reward: 5 },
  { key: 'channel', name: 'The Channel', blurb: 'The Ferry and Cotton Row. Draws, prices and the 3-bet.', from: 2, reward: 15 },
  { key: 'deep', name: 'Deep Water', blurb: 'The Belle and the Grand Hotel. Bluffs, bluff-catchers and value.', from: 4, reward: 30 },
  { key: 'delta', name: 'The Delta', blurb: 'The Gilded Barge and Delta Crown. The big decisions.', from: 6, reward: 60 },
  { key: 'legend', name: 'Legends', blurb: 'Caught anywhere on the river, by very few.', from: 0, reward: 150 },
];

export const waterOf = (key) => WATERS.find((w) => w.key === key);

const LATE = ['CO', 'BTN', 'SB'];

/**
 * A decision as the table hands it over: the spot as it stood, what was
 * done, and how the coach graded it.
 *
 * @typedef {object} Cast
 * @property {string} street
 * @property {string} action       fold | check | call | bet | raise
 * @property {string} concept      the curriculum id the coach named
 * @property {'good'|'ok'|'bad'} level
 * @property {boolean} helped
 * @property {string} [position]
 * @property {boolean} [firstIn]
 * @property {number} [toCall]
 */

const aggressive = (a) => a === 'bet' || a === 'raise';

/**
 * Every species. `bite` says whether a decision hooks it; `land` is set on
 * the few that are only landed by how the hand ended ('won-fold' when
 * everybody folded to you, 'won-showdown' when you won at showdown), and
 * `special` on the one caught some other way.
 *
 * The pictures are drawn from `shape` by ui/fishArt.js.
 */
export const SPECIES = [
  // ---- the shallows: preflop -----------------------------------------
  {
    key: 'perch', water: 'shallows', name: 'Steal Perch', module: 'preflop',
    how: 'Open-raise first in from the cutoff, the button or the small blind, with a hand the chart opens.',
    bite: (c) => c.street === 'preflop' && c.firstIn && LATE.includes(c.position) && aggressive(c.action) && c.level === 'good',
    shape: { len: 52, depth: 20, tail: 'fork', pattern: 'bars', dorsal: 'spiny' },
  },
  {
    key: 'minnow', water: 'shallows', name: 'Patient Minnow', module: 'preflop',
    how: 'Fold before the flop a hand the chart says to fold.',
    bite: (c) => c.street === 'preflop' && c.action === 'fold' && c.level === 'good',
    shape: { len: 36, depth: 11, tail: 'fork', pattern: 'stripe', dorsal: 'small' },
  },
  {
    key: 'bream', water: 'shallows', name: 'Blind Bream', module: 'preflop',
    how: 'Defend the big blind against an open — call or 3-bet a hand the chart plays.',
    bite: (c) => c.street === 'preflop' && c.position === 'BB' && !c.firstIn && c.toCall > 0
      && (c.action === 'call' || aggressive(c.action)) && c.level === 'good',
    shape: { len: 46, depth: 26, tail: 'fork', pattern: 'plain', dorsal: 'long' },
  },
  {
    key: 'carp', water: 'shallows', name: 'C-Bet Carp', module: 'cbet',
    how: 'Raise before the flop, then make a continuation bet on a board that suits it.',
    bite: (c) => c.street === 'flop' && c.concept === 'cbet' && aggressive(c.action) && c.level === 'good',
    shape: { len: 58, depth: 24, tail: 'fork', pattern: 'scales', dorsal: 'long', barbels: true },
  },

  // ---- the channel: prices, draws, the 3-bet -------------------------
  {
    key: 'trout', water: 'channel', name: 'Drawing Trout', module: 'outs',
    how: 'Call a bet with a draw when the outs pay for the price.',
    bite: (c) => c.concept === 'outs' && c.action === 'call' && c.level === 'good',
    shape: { len: 56, depth: 18, tail: 'square', pattern: 'spots', dorsal: 'small', adipose: true },
  },
  {
    key: 'eel', water: 'channel', name: 'Pot-Odds Eel', module: 'pot-odds',
    how: 'Fold to a bet with nothing made when the price is too high.',
    bite: (c) => c.street !== 'preflop' && c.concept === 'pot-odds' && c.action === 'fold' && c.level === 'good',
    shape: { len: 70, depth: 9, tail: 'eel', pattern: 'plain', dorsal: 'ribbon' },
  },
  {
    key: 'walleye', water: 'channel', name: '3-Bet Walleye', module: 'preflop',
    how: 'Re-raise an open before the flop with a hand the chart 3-bets.',
    bite: (c) => c.street === 'preflop' && !c.firstIn && c.toCall > 0 && aggressive(c.action) && c.level === 'good',
    shape: { len: 60, depth: 17, tail: 'fork', pattern: 'mottled', dorsal: 'spiny', eye: 'big' },
  },

  // ---- deep water: bluffs, bluff-catchers, value ---------------------
  {
    key: 'bass', water: 'deep', name: 'Bluff-Catcher Bass', module: 'mdf',
    how: 'Call a bet after the flop with a hand that only beats a bluff, when the price says defend.',
    bite: (c) => c.street !== 'preflop' && c.concept === 'mdf' && c.action === 'call' && c.level === 'good',
    shape: { len: 58, depth: 22, tail: 'round', pattern: 'stripe', dorsal: 'spiny', jaw: 'big' },
  },
  {
    key: 'gar', water: 'deep', name: 'Bluffing Gar', module: 'bluffing',
    how: 'Bet with nothing to show down after the flop — and have everybody fold.',
    bite: (c) => c.street !== 'preflop' && c.concept === 'bluffing' && aggressive(c.action) && c.level !== 'bad',
    land: 'won-fold',
    shape: { len: 72, depth: 12, tail: 'round', pattern: 'spots', dorsal: 'back', snout: 'long' },
  },
  {
    key: 'muskie', water: 'deep', name: 'Value Muskie', module: 'exploit',
    how: 'Bet or raise for value on the turn or the river when you are well ahead.',
    bite: (c) => (c.street === 'turn' || c.street === 'river') && c.concept === 'exploit' && aggressive(c.action) && c.level === 'good',
    shape: { len: 74, depth: 16, tail: 'fork', pattern: 'bars', dorsal: 'back', snout: 'duck' },
  },

  // ---- the delta: the big decisions ----------------------------------
  {
    key: 'sturgeon', water: 'delta', name: 'Commitment Sturgeon', module: 'spr',
    how: 'Face a bet with the stack barely bigger than the pot, and make the right call or fold.',
    bite: (c) => c.street !== 'preflop' && c.concept === 'spr' && c.toCall > 0 && c.action !== 'check' && c.level === 'good',
    shape: { len: 78, depth: 16, tail: 'shark', pattern: 'scutes', dorsal: 'back', snout: 'long', barbels: true },
  },
  {
    key: 'catfish', water: 'delta', name: 'Hero-Call Catfish', module: 'mdf',
    how: 'Call a river bet the price allows with a hand that only beats a bluff — and win at showdown.',
    bite: (c) => c.street === 'river' && (c.concept === 'mdf' || c.concept === 'pot-odds') && c.action === 'call' && c.level === 'good',
    land: 'won-showdown',
    shape: { len: 66, depth: 20, tail: 'square', pattern: 'mottled', dorsal: 'small', barbels: true, whiskers: true },
  },

  // ---- legends -------------------------------------------------------
  {
    key: 'pike', water: 'legend', name: 'The Golden Pike', module: null,
    how: 'Knock a table\'s owner out of their seat, with every decision in that hand sound.',
    special: 'owner-bust',
    shape: { len: 76, depth: 15, tail: 'fork', pattern: 'spots', dorsal: 'back', snout: 'duck', crown: true },
  },
];

export const speciesOf = (key) => SPECIES.find((s) => s.key === key);

/** Whether a stop (VENUES index, or null for the practice table) fishes a water. */
export function fishesIn(stopIndex, waterKey) {
  const water = waterOf(waterKey);
  if (!water) return false;
  const i = stopIndex == null || stopIndex < 0 ? 0 : stopIndex;
  return i >= water.from;
}

/**
 * Which fish a decision hooks, at this stop. A helped or mistaken decision
 * hooks nothing, and nor does anything at a lesson table (the caller does
 * not cast there). Fish with a `land` rule are only hooked here; the hand's
 * end says whether they come in.
 *
 * @param {Cast} cast
 * @param {number|null} stopIndex
 * @returns {string[]} species keys
 */
export function bites(cast, stopIndex) {
  if (!cast || cast.helped || cast.level === 'bad') return [];
  return SPECIES
    .filter((s) => s.bite && fishesIn(stopIndex, s.water) && s.bite(cast))
    .map((s) => s.key);
}

/**
 * Which hooked fish come in, given how the hand ended.
 *
 * @param {string[]} hooked   species keys hooked during the hand
 * @param {{heroWon: boolean, showdown: boolean}} ending
 */
export function landed(hooked, { heroWon, showdown }) {
  const out = [];
  for (const key of new Set(hooked)) {
    const s = speciesOf(key);
    if (!s) continue;
    if (!s.land) { out.push(key); continue; }
    if (!heroWon) continue;
    if (s.land === 'won-fold' && !showdown) out.push(key);
    if (s.land === 'won-showdown' && showdown) out.push(key);
  }
  return out;
}

/**
 * How heavy a catch is: the pot it came out of, in big blinds, at a pound
 * for every four. A perch off the blinds is a small one; a catfish from a
 * stacked river pot is the one you tell people about.
 */
export function weighIn(potChips, bigBlind) {
  if (!(bigBlind > 0)) return 0.5;
  return Math.max(0.5, Math.round((potChips / bigBlind / 4) * 10) / 10);
}

/**
 * Put a catch in the book. Returns what happened: whether it is the first
 * of its kind (which pays the water's reward), and whether it is a new
 * record weight.
 *
 * @param {object} book   profile.data.catchBook, mutated
 * @param {string} key
 * @param {{weight: number, where: string, at?: number}} details
 */
export function logCatch(book, key, { weight, where, at = Date.now() }) {
  const s = speciesOf(key);
  if (!s) return null;
  const entry = book[key];
  if (!entry) {
    book[key] = { count: 1, best: weight, where, first: at };
    return { key, first: true, record: false, reward: waterOf(s.water).reward };
  }
  entry.count += 1;
  const previous = entry.best;
  const record = weight > previous;
  if (record) { entry.best = weight; entry.where = where; }
  return { key, first: false, record, previous, reward: 0 };
}

/** How far the book is filled: per water, and in all. */
export function bookProgress(book = {}) {
  const per = WATERS.map((w) => {
    const fish = SPECIES.filter((s) => s.water === w.key);
    return { water: w.key, caught: fish.filter((s) => book[s.key]).length, total: fish.length };
  });
  return {
    per,
    caught: per.reduce((n, p) => n + p.caught, 0),
    total: SPECIES.length,
  };
}
