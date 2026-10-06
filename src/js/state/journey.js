/**
 * The Road, read against a profile: where you are on it, what is left in this
 * city, what to do next, and whether the next city's door is open.
 *
 * data/journey.js says what each stop asks for. This turns that into goals
 * with a state — done, how far along, what is in the way, where to go to do
 * it — from things the game already keeps: the chapters you have read, the
 * hands you have played at each table, the tables you have taken. Nothing
 * here is stored; it is worked out every time, so it can never disagree with
 * the rest of the save.
 *
 * Free of the DOM so it can be tested.
 */

import { ROAD, PURSE_MARGIN } from '../data/journey.js';
import { VENUES, venueFor } from '../data/venues.js';
import { moduleMeta } from '../data/curriculum.js';
import { CHECKPOINTS } from '../data/rangeLadder.js';
import { RANKS } from './profile.js';
import { bossFor, boatByKey } from '../data/characters.js';
import { bookProgress } from '../data/fish.js';
import {
  ownsLesson, ownsChart, ownsBoat, ownedCompanions, itemByKey, itemState, furthestStop,
} from './economy.js';

/** The boss's first name for a stop, or the stop's own name. */
const bossName = (venue) => bossFor(venue.boss).short;

/**
 * One goal, worked out for a profile.
 *
 * @param {object} profile
 * @param {object} chapter  an entry of ROAD
 * @param {object} spec     { kind, ...} as built by goalsFor
 * @returns {{id:string, kind:string, required:boolean, text:string, params:object,
 *   hint:string|null, hintParams:object, done:boolean, have:number|null, need:number|null,
 *   blocked:{key:string,text:string,params:object}|null,
 *   to:{route:string, params:object, place:string|null, stop:string|null}}}
 */
function evaluate(profile, chapter, spec) {
  const venue = VENUES.find((v) => v.key === chapter.stop);
  const beaten = profile.career.beaten.includes(venue.key);
  const base = {
    id: spec.id, kind: spec.kind, required: spec.required !== false,
    hint: null, hintParams: {}, have: null, need: null, blocked: null,
  };

  switch (spec.kind) {
    case 'learn': {
      const meta = moduleMeta(spec.module);
      const done = profile.hasCompletedWalkthrough(spec.module);
      const owned = ownsLesson(profile, spec.module);
      let blocked = null;
      let hint = null;
      let hintParams = {};
      let to = { route: 'walkthrough', params: { module: spec.module }, place: 'school', stop: null };
      if (!done && !owned) {
        const item = itemByKey(`lesson:${spec.module}`);
        const state = itemState(profile, item);
        to = { route: 'store', params: {}, place: 'tradingpost', stop: null };
        const level = state.missing.find((m) => m.key === 'level');
        if (level) {
          const rank = RANKS.find((r) => r.level === level.params.level);
          blocked = { key: 'rank', text: 'Needs rank {rank} first. Playing and drilling earn it — Your Papers shows what is missing.', params: { rank: rank ? rank.name : level.params.level } };
          to = { route: 'levels', params: {}, place: 'school', stop: null };
        } else if (!state.affordable) {
          blocked = { key: 'pearls', text: 'Costs {price} pearls and you have {have}. The tables pay them.', params: { price: item.price, have: profile.pearls } };
        } else {
          hint = 'On the shelf at the Trading Post for {price} pearls.';
          hintParams = { price: item.price };
        }
      }
      return { ...base, text: 'Read the {module} lesson', params: { module: meta.name }, hint, hintParams, done, blocked, to };
    }

    case 'play': {
      const have = profile.handsAt(venue.key);
      // You cannot take a table without playing it, so a table already taken
      // has had its hands, whatever the counter says about a save from before
      // there was one.
      const done = beaten || have >= spec.need;
      return {
        ...base, text: 'Play {n} hands at {stop}', params: { n: spec.need, stop: venue.name },
        done, have: Math.min(have, spec.need), need: spec.need,
        to: { route: 'stop', params: { at: venue.key }, place: null, stop: venue.key },
      };
    }

    case 'take': {
      // "Double your buy-in" was the whole instruction, and it did not say what
      // to do: it means sitting down for the price of a seat and getting up —
      // with the Cash out button — holding at least twice that.
      const money = (n) => `$${n.toFixed(2)}`;
      return {
        ...base, text: 'Take {stop} from {boss}', params: { stop: venue.name, boss: bossName(venue) },
        hint: 'Sit at {boss}\'s table for {buyin}, then cash out with {target} or more: double what you sat down with. Or beat {boss} in a duel.',
        hintParams: { boss: bossName(venue), buyin: money(venue.entry), target: money(venue.entry * 2) },
        done: beaten,
        to: { route: 'stop', params: { at: venue.key }, place: null, stop: venue.key },
      };
    }

    case 'stars': {
      const stars = profile.duelRecord(venue.key).stars;
      return {
        ...base, text: 'Win the duel with {n} stars', params: { n: spec.need },
        done: stars >= spec.need, have: Math.min(stars, spec.need), need: spec.need,
        to: { route: 'stop', params: { at: venue.key }, place: null, stop: venue.key },
      };
    }

    case 'regatta': {
      const best = profile.regattaRecord(venue.key).best;
      return {
        ...base, text: 'Finish in the money at the Regatta', params: {},
        done: best >= 1 && best <= 3,
        to: { route: 'stop', params: { at: venue.key }, place: null, stop: venue.key },
        hint: 'A six-player tournament: the top three are paid.',
      };
    }

    case 'fish': {
      const caught = bookProgress(profile.catchBook).caught;
      return {
        ...base, text: spec.need === 1 ? 'Land your first fish in the Catch Book' : 'Land {n} kinds of fish in the Catch Book',
        params: { n: spec.need }, done: caught >= spec.need, have: Math.min(caught, spec.need), need: spec.need,
        to: { route: 'catchbook', params: {}, place: 'tackle', stop: null },
      };
    }

    case 'chart': {
      const checkpoint = CHECKPOINTS.find((c) => c.key === spec.key);
      const done = profile.rangeProgress(spec.key).cleared;
      const owned = ownsChart(profile, spec.key);
      let blocked = null;
      if (!done && !owned) {
        const state = itemState(profile, itemByKey(`chart:${spec.key}`));
        if (state.missing.length) blocked = { key: 'chapter', text: 'Needs the Preflop Ranges chapter first.', params: {} };
        else if (!state.affordable) blocked = { key: 'pearls', text: 'Costs {price} pearls and you have {have}. The tables pay them.', params: { price: itemByKey(`chart:${spec.key}`).price, have: profile.pearls } };
      }
      return {
        ...base, text: 'Pass the chart at the Pilot House: {chart}', params: { chart: checkpoint.name },
        done, blocked,
        to: { route: 'ranges', params: {}, place: 'pilothouse', stop: null },
      };
    }

    case 'boat': {
      const boat = boatByKey(spec.key);
      const done = ownsBoat(profile, spec.key);
      let blocked = null;
      if (!done) {
        const item = itemByKey(`boat:${spec.key}`);
        const state = item ? itemState(profile, item) : null;
        if (state && state.missing.length) blocked = { key: 'reach', text: 'Your boat has not been far enough down the river for this one yet.', params: {} };
        else if (state && !state.affordable) blocked = { key: 'pearls', text: 'Costs {price} pearls and you have {have}. The tables pay them.', params: { price: item.price, have: profile.pearls } };
      }
      return {
        ...base, text: 'Buy the {boat} at the Boatyard', params: { boat: boat.name.toLowerCase() },
        done, blocked,
        to: { route: 'boatyard', params: {}, place: 'boatyard', stop: null },
      };
    }

    case 'pet': {
      const have = ownedCompanions(profile).length;
      return {
        ...base, text: spec.need === 1 ? 'Take a companion aboard' : 'Have {n} companions aboard',
        params: { n: spec.need }, done: have >= spec.need, have: Math.min(have, spec.need), need: spec.need,
        to: { route: 'store', params: {}, place: 'tradingpost', stop: null },
      };
    }

    case 'race': {
      const won = profile.raceWins;
      return {
        ...base, text: 'Beat the Belle in the Racing Chute', params: {},
        done: won >= spec.need, have: Math.min(won, spec.need), need: spec.need,
        to: { route: 'gauntlet', params: {}, place: 'race', stop: null },
      };
    }

    default:
      throw new Error(`Unknown goal kind: ${spec.kind}`);
  }
}

/** The goals of one chapter, required ones first and in the order to do them. */
export function goalsFor(profile, chapter) {
  const specs = [
    ...chapter.lessons.map((module) => ({ id: `learn:${module}`, kind: 'learn', module })),
    { id: `play:${chapter.stop}`, kind: 'play', need: chapter.hands },
    { id: `take:${chapter.stop}`, kind: 'take' },
    ...chapter.bonus.map((b, i) => ({ ...b, id: `${b.kind}:${chapter.stop}:${i}`, required: false })),
  ];
  return specs.map((spec) => evaluate(profile, chapter, spec));
}

/**
 * The whole road for a profile.
 *
 * A city is finished when its required goals are, or when you have already
 * been further down the river than it: a save from before the road existed
 * has sailed past cities it never ticked anything in, and sending somebody
 * back to read Hand Rankings from Cotton Row would be the road getting in the
 * way of the game it is there to guide.
 *
 * @returns {{
 *   chapters: Array<{index:number, venue:object, goals:Array, required:Array,
 *     done:number, total:number, complete:boolean, passed:boolean}>,
 *   current: number, finished: boolean,
 *   next: null | {chapter:number, goal:object}
 * }}
 */
export function journeyState(profile) {
  const reached = furthestStop(profile);
  const chapters = ROAD.map((chapter, index) => {
    const goals = goalsFor(profile, chapter);
    const required = goals.filter((g) => g.required);
    const done = required.filter((g) => g.done).length;
    const passed = index < reached;
    return {
      index,
      venue: VENUES[index],
      goals,
      required,
      done,
      total: required.length,
      complete: passed || done === required.length,
      passed,
    };
  });
  const open = chapters.findIndex((c) => !c.complete);
  const finished = open === -1;
  const current = finished ? chapters.length - 1 : open;
  return { chapters, current, finished, next: finished ? null : nextGoal(chapters[current]) };
}

/**
 * What to do next in a chapter: the first required goal that is not done and
 * not stuck behind something, because pointing somebody at a lesson they
 * cannot open yet is the road being wrong. If everything left is stuck, the
 * first of those, and it says what is in the way. Bonus goals only once the
 * required ones are all done.
 */
export function nextGoal(chapter) {
  const undone = chapter.required.filter((g) => !g.done);
  const pick = undone.find((g) => !g.blocked) || undone[0];
  if (pick) return { chapter: chapter.index, goal: pick };
  const bonus = chapter.goals.find((g) => !g.required && !g.done && !g.blocked);
  return bonus ? { chapter: chapter.index, goal: bonus } : null;
}

/**
 * Whether you may challenge a stop's owner to a duel. The road has to be open
 * to the stop, and the lessons and hands of that city done: an owner will not
 * duel a stranger. A table already taken can always be fought again, for stars.
 *
 * @returns {{open:boolean, ready:boolean, taken:boolean, missing:Array, record:object}}
 */
export function duelStatus(profile, stopIndex) {
  const journey = journeyState(profile);
  const chapter = journey.chapters[stopIndex];
  const venue = VENUES[stopIndex];
  const open = stopIndex <= journey.current;
  const taken = profile.career.beaten.includes(venue.key);
  const missing = chapter.goals.filter((g) => g.required && g.kind !== 'take' && !g.done);
  return { open, taken, missing, ready: open && (taken || missing.length === 0), record: profile.duelRecord(venue.key) };
}

/** Whether the road lets you into a stop (the bankroll is a separate bar). */
export function roadOpen(profile, stopIndex) {
  return stopIndex <= journeyState(profile).current;
}

/**
 * What the owner of a table hands over when it is taken: enough for the next
 * stop to let you in with room to spare, or nothing at the last table.
 */
export function purseFor(stopIndex) {
  const next = VENUES[stopIndex + 1];
  return next ? Math.round(next.stake.minBankroll * PURSE_MARGIN) : null;
}

/**
 * Taking a table from the one who owns it. The first time marks it taken and
 * hands over their purse: enough for the next stop to let you in with room to
 * spare, which is what a table is worth in money. Without it the river was
 * shut past the second stop — a perfect sitting at NL5 wins about $25, and
 * the Ferry asks for $300.
 *
 * @returns {{first:boolean, purse:number}}  whether this was the first time,
 *   and how much was added to the bankroll (0 if it was already past the bar)
 */
export function takeTable(profile, stopIndex) {
  const first = profile.noteResidentBeaten(VENUES[stopIndex].key);
  if (!first) return { first: false, purse: 0 };
  const target = purseFor(stopIndex);
  if (!target || profile.data.bankroll >= target) return { first: true, purse: 0 };
  const purse = Math.round((target - profile.data.bankroll) * 100) / 100;
  profile.setBankroll(target);
  return { first: true, purse };
}

/** The stop that has to be finished before this one opens, or null for the first. */
export const gatedBy = (stopIndex) => (stopIndex > 0 ? venueFor(VENUES[stopIndex - 1].key) : null);
