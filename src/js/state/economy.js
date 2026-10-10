/**
 * Pearls: what the river pays for playing it, and what everything costs.
 *
 * Freshwater pearls, because the real rivers had them: in the 1890s the
 * mussel beds of the upper Mississippi set off a pearl rush, and a lucky
 * shell could pay a season's wages. Here they are the one currency that
 * only the card tables pay out.
 *
 * The reader asked for it plainly: playing had become something done for the
 * rank alone, and nothing in the game needed a hand to be played to get it.
 * So the chapters, the charts and the companions now cost pearls, and pearls
 * come from playing — a pearl for every hand you play, one more for every sound
 * decision made unaided, and a fortune for taking somebody's table. XP and the rank ladder
 * are untouched: they still measure what you know, and pearls measure what
 * you have played for.
 *
 * Two lines are held on purpose:
 *
 *  - Pearls reward decisions, not results. A pot won with a bad call pays the
 *    same single pearl as a pot lost with a good fold, because the chips you
 *    win are the one number at a table you do not control. The bankroll
 *    already pays out on results; the pearl purse pays on judgement.
 *  - The bankroll is never spent in the store. Boats are bought with pearls
 *    at the boatyard for the same reason: spending the roll would teach the
 *    one habit the Bankroll chapter exists to stop.
 *
 * Since 3.2 the purse buys boats too, and what a boat does ties the rest
 * together: a bigger one carries more companions to the table, and its
 * strongbox adds a share to every pearl the tables pay. So pearls buy the
 * boat that earns pearls faster and carries the help the chapters unlock.
 */

import { MODULE_META } from '../data/curriculum.js';
import { CHECKPOINTS } from '../data/rangeLadder.js';
import { BOATS, FLAGSHIP, boatByKey } from '../data/characters.js';
import { VENUES, venueFor, RIVER_END } from '../data/venues.js';

/* ------------------------------------------------------------------ *
 * What the tables pay
 * ------------------------------------------------------------------ */

export const EARN = {
  /** A sound decision, made without asking for help. */
  sound: 1,
  /** The first time you take a stop's table from the one who owns it. */
  tableTaken: 100,
  /** Beating the Belle to the landing. */
  raceWon: 25,
};

/**
 * Pearls for one hand played through. The practice table pays a pearl a
 * hand; the stops pay more the further down the river they are, so the climb
 * is worth making for the purse as well as for the stakes.
 *
 * A hand you fold before the flop is not played through: folding is the
 * default, and a table that paid for it paid the most for the least play.
 * Measured, a player who folded every hand earned 360 pearls an hour against
 * 500 for one who played them well, so skill was worth under half again what
 * sitting there was.
 *
 * @param {number|null} stopIndex  0 for Mud Landing … 7 for the delta, or
 *   null at the practice table
 */
export function handPearls(stopIndex = null) {
  if (stopIndex == null || stopIndex < 0) return 1;
  return 1 + Math.floor(stopIndex / 2);
}

/**
 * Whether a hand was played through, which is what pays its pearl: you made
 * at least one decision in it that was not folding before the flop. A hand
 * with no decision of yours (the table folded to your big blind) was not
 * played by you either.
 *
 * @param {Array<{street:string, action:string}>} decisions  yours, in this hand
 */
export function playedThrough(decisions) {
  return decisions.some((d) => !(d.street === 'preflop' && d.action === 'fold'));
}

/**
 * What a table of this size pays, as a share of a full one.
 *
 * Measured with the coach as the player (tools/measure-pearls.mjs): a
 * heads-up table paid about half as much again an hour as a full one, and a
 * three-handed table two thirds as much again — hands come round twice as
 * fast, and there is a decision to make in nearly every one. Pearls are for
 * how much poker you play and how well, not for finding the table where it
 * is quickest, so a short-handed table pays half.
 */
export function tableShare(seats = 6) {
  return seats >= 6 ? 1 : 0.5;
}

/**
 * A payment scaled by a table's share, with the fraction carried to the next
 * one so that half a pearl a hand is paid in full over two hands instead of
 * being rounded away every time — the way the strongbox does it.
 *
 * @param {number} carry   the fraction owed from earlier payments
 * @param {number} amount  what the table would pay a full table
 * @param {number} share   tableShare(seats)
 * @returns {{paid:number, carry:number}}
 */
export function scalePearls(carry, amount, share) {
  if (!(amount > 0)) return { paid: 0, carry };
  if (share >= 1) return { paid: amount, carry };
  const owed = carry + amount * share;
  const paid = Math.floor(owed + 1e-9);
  return { paid, carry: owed - paid };
}

/**
 * The pearls each opponent carries: a bounty for knocking them out, the way
 * every player at a Governor of Poker table has something to take off them.
 * Regulars carry more further down the river; the owner of a table carries
 * the most. A bounty is there once per sitting — busted and refilled, a
 * player sits back down with nothing on them.
 *
 * @param {number|null} stopIndex  0 … 7 down the river, or null at the practice table
 * @param {boolean} owner           the one who owns the table
 */
export function seatBounty(stopIndex = null, owner = false) {
  const i = stopIndex == null || stopIndex < 0 ? 0 : stopIndex;
  return owner ? 25 + Math.round((i * 25) / 7) : 5 + Math.round((i * 10) / 7);
}

/**
 * What a bounty pays, by how the hand that took it was played. Busting
 * somebody is a result, and results are luck as much as skill; the bounty is
 * paid on the decisions that got the money in. Every decision sound: all of
 * it. One mistake — or one decision made with help — halves it. Two, and a
 * lucky card does not get paid for.
 */
export function bountyPaid(bounty, mistakes) {
  if (!(bounty > 0)) return 0;
  if (mistakes <= 0) return bounty;
  if (mistakes === 1) return Math.ceil(bounty / 2);
  return 0;
}

/**
 * Whether a graded decision earns its pearl.
 *
 * Folding before the flop is the default rather than a decision anybody has
 * to be paid to make: paying for it would pay the most for the least play,
 * and a table where folding every hand fills the purse teaches nothing.
 * Everything else earns it when the coach grades it sound — and only when it
 * was made without asking, the same standard every drill holds a looked-up
 * answer to.
 */
export function decisionPearls({ level, street, action, helped = false }) {
  if (helped || level !== 'good') return 0;
  if (street === 'preflop' && action === 'fold') return 0;
  return EARN.sound;
}

/* ------------------------------------------------------------------ *
 * What a pearl is worth in money
 * ------------------------------------------------------------------ */

/**
 * The shelves hold about five thousand pearls of things, and the tables pay
 * five hundred to fifteen hundred an hour: a few evenings in, everything was
 * bought and the purse filled up with pearls that bought nothing. The reader
 * asked for them to keep their worth to the end of the river.
 *
 * So Delphine buys them, for money, and every seat and Regatta entry on the
 * river can be paid in them. What a pearl fetches is set by where your boat
 * is moored: a seat costs PEARLS_PER_SEAT pearls a tier, the tier being what
 * a hand pays there (handPearls), so a seat costs about the same hours of
 * play in pearls at every stop — and a pearl is worth more money the further
 * down the river you are: 0.80 a thousand at Mud Landing, 50 at the delta.
 * Saving them for the far end pays.
 *
 * How much: measured with tools/measure-pearls.mjs, an hour's pearls is worth
 * about a third of what an hour of faultless play wins at the same stop (half
 * at the first two). Enough that the purse always matters; never enough that
 * it replaces playing well, which is what the bankroll is for. The money only
 * goes one way: nobody sells pearls, so the purse is still only filled at the
 * tables, by how well you play.
 */
export const PEARLS_PER_SEAT = 2500;

const stopAt = (i) => VENUES[Math.max(0, Math.min(VENUES.length - 1, Math.round(Number(i) || 0)))];

/** A seat's price in pearls at a stop — and a Regatta's entry, which costs a seat. */
export function seatInPearls(stopIndex) {
  return PEARLS_PER_SEAT * handPearls(stopAt(stopIndex).index);
}

/** What one pearl fetches at a stop, in money. */
export function pearlPrice(stopIndex) {
  const venue = stopAt(stopIndex);
  return venue.entry / seatInPearls(venue.index);
}

/** What a thousand pearls fetch at a stop: the price as the Trading Post shows it. */
export const perThousand = (stopIndex) => saleValue(1000, stopIndex);

/** What selling `n` pearls at a stop pays, to the cent below. */
export function saleValue(n, stopIndex) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  return Math.floor(count * pearlPrice(stopIndex) * 100 + 1e-9) / 100;
}

/** The stop whose price you get: where your boat is moored. */
export const pricedAt = (profile) => venueFor(profile.career.venue).index;

/**
 * Sell pearls to Delphine at the price where your boat is moored. Refuses,
 * and says why, rather than throwing: every caller is a button.
 * @returns {{ok:boolean, reason?:string, money?:number, pearls?:number, at?:number}}
 */
export function sellPearls(profile, n) {
  const count = Math.floor(Number(n) || 0);
  if (!(count > 0)) return { ok: false, reason: 'none' };
  if (count > profile.pearls) return { ok: false, reason: 'short' };
  const at = pricedAt(profile);
  const money = saleValue(count, at);
  if (!(money > 0)) return { ok: false, reason: 'too-few' };
  if (!profile.spendPearls(count, { sold: money })) return { ok: false, reason: 'short' };
  profile.setBankroll(profile.data.bankroll + money);
  return { ok: true, money, pearls: count, at };
}

/** What your purse would fetch where your boat is, and at the far end. */
export function purseWorth(profile) {
  const here = pricedAt(profile);
  return {
    here: saleValue(profile.pearls, here),
    at: here,
    delta: saleValue(profile.pearls, VENUES.length - 1),
  };
}

/* ------------------------------------------------------------------ *
 * What things cost
 * ------------------------------------------------------------------ */

/** The chapters, priced by how far into the course they sit. */
export const LESSON_PRICES = {
  'hand-rankings': 0,
  'pot-odds': 60,
  outs: 90,
  preflop: 90,
  position: 120,
  bankroll: 120,
  cbet: 160,
  mdf: 200,
  bluffing: 200,
  exploit: 220,
  spr: 240,
  icm: 280,
  // The Gulf's chapters.
  value: 320,
  streets: 340,
  threebet: 360,
  multiway: 380,
  pushfold: 420,
};

/** One reach of the pilot house's charts. */
export const CHART_PRICE = 30;

/** What you own before you have played a hand: the first chapter. */
export const STARTER = ['lesson:hand-rankings'];

/**
 * The companions. Each one does at the table what one chapter teaches, and
 * none of them can be bought until that chapter has been read to the end:
 * the owl does the sum for somebody who knows how the sum goes, not instead
 * of them ever learning it. The parrot says outright what Silas would do,
 * which is the most help there is, so it asks for three chapters finished.
 */
export const COMPANIONS = [
  {
    key: 'owl', name: 'Hoot', kind: 'Owl', price: 100, needs: { lesson: 'pot-odds' },
    does: 'Does the sum: what the call costs, the share of the pot it has to win, and what your hand has.',
  },
  {
    key: 'cat', name: 'Whiskers', kind: 'Cat', price: 120, needs: { lesson: 'preflop' },
    does: 'Remembers the hands you went wrong with. When one comes back in the same seat and spot, she warns you to think twice — free. Ask her, and she says what was right, on the chart for your seat.',
  },
  {
    key: 'raccoon', name: 'Bandit', kind: 'Raccoon', price: 140, needs: { lesson: 'outs' },
    does: 'Counts the cards that save you, and turns the count into a percentage.',
  },
  {
    key: 'turtle', name: 'Shelly', kind: 'Turtle', price: 200, needs: { lesson: 'spr' },
    does: 'Knows how deep the stacks are, and tells you when the pot has you committed.',
  },
  {
    key: 'hound', name: 'Duke', kind: 'Bloodhound', price: 220, needs: { lesson: 'exploit' },
    does: 'Sniffs out how everybody at the table plays, and whether they have noticed you.',
  },
  {
    key: 'parrot', name: 'Rosie', kind: 'Parrot', price: 260, needs: { lessons: 3 },
    does: 'Repeats what Silas would do here, and why — the whole answer, so use her sparingly.',
  },
];

export const companionByKey = (key) => COMPANIONS.find((c) => c.key === key) || null;

/**
 * Fittings for the boat. Each does one thing at the table, on whatever boat
 * you sail. There were paint and flags here once; the reader wanted nothing
 * on the shelves that does nothing, so every fitting now earns its keep.
 */
export const UPGRADES = [
  {
    key: 'cabin', name: 'A spare cabin', price: 120, berths: 1, bonus: 0,
    does: 'Room for one more companion at the table, on whatever boat you sail.',
  },
  {
    key: 'strongbox', name: 'A heavier strongbox', price: 250, berths: 0, bonus: 0.1, needs: { reach: 1 },
    does: 'A tenth more pearls at the tables, on top of your boat\'s own share.',
  },
];

export const upgradeByKey = (key) => UPGRADES.find((u) => u.key === key) || null;

/* ------------------------------------------------------------------ *
 * The card rooms: the far end of the purse
 * ------------------------------------------------------------------ */

/**
 * Once a stop's table is yours, the house it stands in can be bought: the
 * long game, the way Governor of Poker sells the town's buildings. Each room
 * costs more pearls the further down the river — about 150,000 for all eight,
 * a hundred hours and more at the tables — and pays its owner the house's
 * cut: ROOM_CUT of a big blind for every hand you are dealt at its cash
 * tables, paid when you cash out. A room is mostly a flag on the river; the
 * cut makes it one that pays back, slowly.
 */
export const ROOM_PRICES = [3000, 5000, 8000, 12000, 18000, 25000, 34000, 45000,
  // The Gulf's rooms.
  60000, 80000, 105000, 135000, 170000];
export const ROOM_CUT = 0.02;
export const roomKey = (venueKey) => `room:${venueKey}`;
export const ownsRoom = (profile, venueKey) => profile.owns(roomKey(venueKey));
export const roomsOwned = (profile) => VENUES.filter((v) => ownsRoom(profile, v.key)).length;

/** The cut for a sitting: hands dealt at the room's tables, in money, to the cent below. */
export function roomCut(hands, bigBlind) {
  const n = Math.max(0, Math.floor(Number(hands) || 0));
  return Math.floor(n * ROOM_CUT * bigBlind * 100 + 1e-9) / 100;
}

/**
 * Everything on the shelves, in the order it is shown. The Trading Post
 * sells the chapters, charts and companions; the boatyard the boats and
 * their fittings.
 * `key` is what the profile stores; the rest is read off the catalogue so a
 * price is only ever written down once.
 */
export const CATALOGUE = [
  ...MODULE_META.filter((m) => LESSON_PRICES[m.id] > 0).map((m) => ({
    key: `lesson:${m.id}`, kind: 'lesson', module: m.id, price: LESSON_PRICES[m.id], needs: { level: m.unlockLevel, ...(m.act === 2 ? { river: true } : {}) },
  })),
  ...CHECKPOINTS.filter((c) => c.kind !== 'exam').map((c) => ({
    key: `chart:${c.key}`, kind: 'chart', checkpoint: c.key, price: CHART_PRICE, needs: { owns: 'lesson:preflop' },
  })),
  ...COMPANIONS.map((c) => ({ key: `pet:${c.key}`, kind: 'pet', pet: c.key, price: c.price, needs: c.needs })),
  ...BOATS.filter((b) => b.price > 0).map((b) => ({
    key: `boat:${b.key}`, kind: 'boat', boat: b.key, price: b.price, needs: { reach: b.reach },
  })),
  ...UPGRADES.map((u) => ({ key: `up:${u.key}`, kind: 'upgrade', upgrade: u.key, price: u.price, needs: u.needs || {} })),
  ...VENUES.map((v) => ({ key: roomKey(v.key), kind: 'room', venue: v.key, price: ROOM_PRICES[v.index], needs: { tableAt: v.key } })),
];

/**
 * Pay the cut for a sitting at a room you own, into the bankroll, and keep
 * the running total the room's panel shows. Nothing for a room you do not own.
 */
export function payRoomCut(profile, venueKey, hands, bigBlind) {
  if (!ownsRoom(profile, venueKey)) return 0;
  const money = roomCut(hands, bigBlind);
  if (!(money > 0)) return 0;
  const earned = profile.data.roomIncome && typeof profile.data.roomIncome === 'object' ? profile.data.roomIncome : {};
  earned[venueKey] = Math.round(((Number(earned[venueKey]) || 0) + money) * 100) / 100;
  profile.data.roomIncome = earned;
  profile.setBankroll(profile.data.bankroll + money);
  return money;
}

/** What a room has paid its owner so far. */
export const roomIncome = (profile, venueKey) => {
  const earned = profile.data.roomIncome;
  return earned && Number.isFinite(earned[venueKey]) ? earned[venueKey] : 0;
};

/** Which kinds each shop sells. */
export const SHOPS = {
  tradingpost: ['lesson', 'chart', 'pet'],
  boatyard: ['boat', 'upgrade'],
};

export const itemByKey = (key) => CATALOGUE.find((i) => i.key === key) || null;

/* ------------------------------------------------------------------ *
 * What you have, and what you may buy
 * ------------------------------------------------------------------ */

/** Whether a chapter is yours to study. */
export function ownsLesson(profile, moduleId) {
  return LESSON_PRICES[moduleId] === 0 || profile.owns(`lesson:${moduleId}`);
}

/** Whether a reach of the pilot house is yours to run. */
export function ownsChart(profile, checkpointKey) {
  return profile.owns(`chart:${checkpointKey}`);
}

/** The companions you have bought, in catalogue order. */
export function ownedCompanions(profile) {
  return COMPANIONS.filter((c) => profile.owns(`pet:${c.key}`));
}

/** Chapters you own, in course order. */
export function ownedModules(profile) {
  return MODULE_META.filter((m) => ownsLesson(profile, m.id));
}

/**
 * What stands between you and buying something: each unmet requirement, as
 * a sentence template with its parameters, so the shelf can say exactly what
 * is missing rather than only that something is.
 */
export function missingFor(profile, item) {
  const needs = item.needs || {};
  const missing = [];
  if (needs.level && profile.level < needs.level) {
    missing.push({ key: 'level', text: 'Reach rank {level}', params: { level: needs.level } });
  }
  if (needs.owns && !profile.owns(needs.owns)) {
    const moduleId = needs.owns.replace(/^lesson:/, '');
    missing.push({ key: 'owns', text: 'Own the {module} chapter', params: { module: moduleId } });
  }
  if (needs.lesson && !profile.hasCompletedWalkthrough(needs.lesson)) {
    missing.push({ key: 'lesson', text: 'Finish the {module} lesson', params: { module: needs.lesson } });
  }
  if (needs.lessons) {
    const done = MODULE_META.filter((m) => profile.hasCompletedWalkthrough(m.id)).length;
    if (done < needs.lessons) {
      missing.push({ key: 'lessons', text: 'Finish {n} guided lessons ({done} so far)', params: { n: needs.lessons, done } });
    }
  }
  if (needs.reach && furthestStop(profile) < needs.reach) {
    missing.push({ key: 'reach', text: 'Take your boat as far as {place}', params: { place: VENUES[needs.reach].name } });
  }
  if (needs.tableAt && !(profile.career.beaten || []).includes(needs.tableAt)) {
    missing.push({ key: 'tableAt', text: 'Take the table at {place} first', params: { place: venueFor(needs.tableAt).name } });
  }
  if (needs.river && !wonTheRiver(profile)) {
    missing.push({ key: 'river', text: 'Take the delta: the Gulf\'s chapters are for after the river', params: {} });
  }
  if (needs.taken && tablesTaken(profile) < needs.taken) {
    missing.push({ key: 'taken', text: 'Take a table from the one who owns it', params: {} });
  }
  return missing;
}

/**
 * Everything the shelf needs to know about one item.
 * @returns {{owned:boolean, missing:Array, ready:boolean, affordable:boolean, short:number}}
 */
export function itemState(profile, item) {
  const owned = profile.owns(item.key) || (item.kind === 'lesson' && ownsLesson(profile, item.module));
  const missing = owned ? [] : missingFor(profile, item);
  const short = Math.max(0, item.price - profile.pearls);
  return { owned, missing, ready: !owned && !missing.length, affordable: short === 0, short };
}

/**
 * Buy something. Refuses — and says why — rather than throwing, since every
 * caller is a button that has to explain itself either way.
 * @returns {{ok:boolean, reason?:string}}
 */
export function purchase(profile, key) {
  const item = itemByKey(key);
  if (!item) return { ok: false, reason: 'unknown' };
  const state = itemState(profile, item);
  if (state.owned) return { ok: false, reason: 'owned' };
  if (state.missing.length) return { ok: false, reason: 'locked' };
  if (!state.affordable) return { ok: false, reason: 'short' };
  profile.buy(item.key, item.price);
  const e = profile.economy;
  if (item.kind === 'boat') e.boat = item.boat;
  // A new boat, a new companion or a spare cabin can each free a berth for
  // somebody waiting at the landing.
  if (item.kind === 'boat' || item.kind === 'pet' || item.kind === 'upgrade') fillBerths(profile);
  profile.save();
  return { ok: true };
}

/**
 * The next thing worth playing for: the cheapest chapter your rank already
 * allows and you do not yet own. This is what the school and the table name
 * when they tell you what your pearls are for.
 */
export function nextPurchase(profile) {
  return CATALOGUE
    .filter((i) => i.kind === 'lesson')
    .map((i) => ({ item: i, state: itemState(profile, i) }))
    .filter(({ state }) => state.ready)
    .sort((a, b) => a.item.price - b.item.price)[0] || null;
}

/**
 * Whether the shop at a place has anything you could buy right now: on the
 * shelf for you, and within the purse. The map lights a sign up for it.
 */
export function somethingToBuy(profile, shop) {
  const kinds = SHOPS[shop] || [];
  return CATALOGUE.some((item) => {
    if (!kinds.includes(item.kind)) return false;
    const state = itemState(profile, item);
    return state.ready && state.affordable;
  });
}

/* ------------------------------------------------------------------ *
 * The boat
 * ------------------------------------------------------------------ */

/** The index of the furthest stop your boat has reached. */
export function furthestStop(profile) {
  const career = profile.career;
  return Math.max(venueFor(career.best).index, venueFor(career.venue).index);
}

/** How many tables you have taken from their owners. */
export function tablesTaken(profile) {
  return (profile.career.beaten || []).length;
}

/** Whether the Commodore is beaten, which is the only way to his flagship. */
export function wonTheRiver(profile) {
  return (profile.career.beaten || []).includes(RIVER_END);
}

/** Whether a boat is yours to sail: the rowboat always, the flagship if won. */
export function ownsBoat(profile, key) {
  if (key === BOATS[0].key) return true;
  if (key === FLAGSHIP.key) return wonTheRiver(profile);
  return profile.owns(`boat:${key}`);
}

/** Every boat you could sail, smallest first. */
export function ownedBoats(profile) {
  return [...BOATS, FLAGSHIP].filter((b) => ownsBoat(profile, b.key));
}

/**
 * The boat you are sailing. Whatever is stored, it is one you own: a save
 * that names a boat it does not have sails the best one it does.
 */
export function currentBoat(profile) {
  const chosen = profile.economy.boat;
  if (chosen && ownsBoat(profile, chosen)) return boatByKey(chosen);
  const owned = ownedBoats(profile);
  return owned[owned.length - 1];
}

/** Whether a fitting is on your boat. */
export function ownsUpgrade(profile, key) {
  return profile.owns(`up:${key}`);
}

/** How many companions come to the table: the boat's berths and any cabin. */
export function boatBerths(profile) {
  return currentBoat(profile).berths
    + UPGRADES.filter((u) => ownsUpgrade(profile, u.key)).reduce((n, u) => n + u.berths, 0);
}

/** The strongbox's share: the boat's own, and a heavier box if fitted. */
export function boatBonus(profile) {
  return currentBoat(profile).bonus
    + UPGRADES.filter((u) => ownsUpgrade(profile, u.key)).reduce((n, u) => n + u.bonus, 0);
}

/** Take another boat you own out. The crew that does not fit stays ashore. */
export function sailBoat(profile, key) {
  if (!ownsBoat(profile, key)) return false;
  profile.economy.boat = key;
  fillBerths(profile);
  profile.save();
  return true;
}

/**
 * The companions aboard, in the order they boarded: the ones you own that
 * are on the crew list, as many as the boat has berths for.
 */
export function crewAboard(profile) {
  const berths = boatBerths(profile);
  const crew = Array.isArray(profile.economy.crew) ? profile.economy.crew : [];
  return crew
    .filter((key, i) => crew.indexOf(key) === i && profile.owns(`pet:${key}`))
    .slice(0, berths)
    .map(companionByKey)
    .filter(Boolean);
}

/** The companions you own who are waiting at the landing. */
export function crewAshore(profile) {
  const aboard = new Set(crewAboard(profile).map((c) => c.key));
  return ownedCompanions(profile).filter((c) => !aboard.has(c.key));
}

/**
 * Tidy the crew list to what fits, then fill any empty berths with whoever is
 * waiting ashore, in the order they were bought. Called after anything that
 * changes the boat or the companions.
 */
export function fillBerths(profile) {
  const e = profile.economy;
  const berths = boatBerths(profile);
  const aboard = crewAboard(profile).map((c) => c.key);
  for (const c of ownedCompanions(profile)) {
    if (aboard.length >= berths) break;
    if (!aboard.includes(c.key)) aboard.push(c.key);
  }
  e.crew = aboard;
}

/** Send a companion ashore, or bring one aboard in their place if full. */
export function toggleCrew(profile, key) {
  if (!profile.owns(`pet:${key}`)) return false;
  const e = profile.economy;
  const aboard = crewAboard(profile).map((c) => c.key);
  const berths = boatBerths(profile);
  if (aboard.includes(key)) {
    e.crew = aboard.filter((k) => k !== key);
  } else {
    // A full boat swaps out whoever has been aboard longest.
    if (aboard.length >= berths) aboard.shift();
    e.crew = [...aboard, key];
  }
  profile.save();
  return true;
}

/**
 * The strongbox: the share a boat adds to the pearls a table pays for hands
 * and decisions, kept as a running fraction so a tenth of a pearl a hand is
 * paid in full over ten hands instead of rounded away every time.
 *
 * @param {number} carry   the fraction owed from earlier payments
 * @param {number} amount  what the table just paid
 * @param {number} bonus   the boat's share, 0.1 for a tenth
 * @returns {{extra:number, carry:number}}
 */
export function strongbox(carry, amount, bonus) {
  if (!(amount > 0) || !(bonus > 0)) return { extra: 0, carry };
  const owed = carry + amount * bonus;
  const extra = Math.floor(owed + 1e-9);
  return { extra, carry: owed - extra };
}
