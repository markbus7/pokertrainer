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
 * come from playing — a pearl a hand, one more for every sound decision made
 * unaided, and a fortune for taking somebody's table. XP and the rank ladder
 * are untouched: they still measure what you know, and pearls measure what
 * you have played for.
 *
 * Two lines are held on purpose:
 *
 *  - Pearls reward decisions, not results. A pot won with a bad call pays the
 *    same single pearl as a pot lost with a good fold, because the chips you
 *    win are the one number at a table you do not control. The bankroll
 *    already pays out on results; the pearl purse pays on judgement.
 *  - The bankroll is never spent in the store. The boat is not bought for the
 *    same reason: spending the roll would teach the one habit the Bankroll
 *    chapter exists to stop.
 */

import { MODULE_META } from '../data/curriculum.js';
import { CHECKPOINTS } from '../data/rangeLadder.js';

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
 * @param {number|null} stopIndex  0 for Mud Landing … 7 for the delta, or
 *   null at the practice table
 */
export function handPearls(stopIndex = null) {
  if (stopIndex == null || stopIndex < 0) return 1;
  return 1 + Math.floor(stopIndex / 2);
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
    does: 'Sits on the chart for your seat, with your hand ringed on it.',
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
 * Everything on the Trading Post's shelves, in the order it is shown.
 * `key` is what the profile stores; the rest is read off the catalogue so a
 * price is only ever written down once.
 */
export const CATALOGUE = [
  ...MODULE_META.filter((m) => LESSON_PRICES[m.id] > 0).map((m) => ({
    key: `lesson:${m.id}`, kind: 'lesson', module: m.id, price: LESSON_PRICES[m.id], needs: { level: m.unlockLevel },
  })),
  ...CHECKPOINTS.filter((c) => c.kind !== 'exam').map((c) => ({
    key: `chart:${c.key}`, kind: 'chart', checkpoint: c.key, price: CHART_PRICE, needs: { owns: 'lesson:preflop' },
  })),
  ...COMPANIONS.map((c) => ({ key: `pet:${c.key}`, kind: 'pet', pet: c.key, price: c.price, needs: c.needs })),
];

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
