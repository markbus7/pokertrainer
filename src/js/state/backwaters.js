/**
 * The backwaters, read against a profile: which towns you have heard of, which
 * of them a stop's regulars are ready to tell you about, what each town's
 * table is, and how far through its three goals you are.
 *
 * data/backwaters.js says what each town is. Found is a scene marked read
 * (`rumour-<key>`), the same flag the story uses, so nothing new has to be
 * kept to remember it; the town's record — its best sittings and which of its
 * goals have been paid — lives in profile.data.towns.
 *
 * Free of the DOM so it can be tested.
 */

import { BACKWATERS, backwaterFor, RUMOUR_HANDS } from '../data/backwaters.js';
import { venueFor } from '../data/venues.js';
import { lobbyFor, lobbyStats, softness } from './lobby.js';
import { handPearls } from './economy.js';

const sceneKey = (key) => `rumour-${key}`;
/** Where a town's hands are counted, beside the stops' own counts. */
export const handsKey = (key) => `town:${key}`;

/** Whether you have heard of a town: it is on your chart. */
export const heard = (profile, key) => profile.seenScene(sceneKey(key));

/** Mark a town found. Returns whether it was news. */
export function hear(profile, key) {
  if (!backwaterFor(key) || heard(profile, key)) return false;
  profile.markScene(sceneKey(key));
  return true;
}

/**
 * The town a stop's regulars will tell you about now, if any: one you have not
 * heard of, leaving the river at this stop, once you have played a little at
 * its table — or taken it, which is more than a little.
 */
export function rumourAt(profile, venueKey) {
  const venue = venueFor(venueKey);
  const town = BACKWATERS.find((b) => b.junction === venue.key);
  if (!town || heard(profile, town.key)) return null;
  const played = profile.handsAt(venue.key) >= RUMOUR_HANDS || profile.career.beaten.includes(venue.key);
  return played ? town : null;
}

/** The stop a town leaves the river from: its stakes, its seat price, and where the boat waits. */
export const junctionOf = (town) => venueFor(town.junction);

/**
 * Whether you can go: you have heard of it, and your purse would let you
 * into the stop it leaves the river from.
 */
export function canGo(profile, town) {
  return heard(profile, town.key) && profile.data.bankroll >= junctionOf(town).stake.minBankroll;
}

/** The town your boat is moored at, or null on the river. */
export function townHere(profile) {
  const key = profile.career.town;
  const town = key ? backwaterFor(key) : null;
  return town && heard(profile, town.key) ? town : null;
}

/**
 * A town's table, in the lobby's shape so the table screen can sit you at it
 * the way it sits you at a stop's side game: the local in the first chair and
 * the rest of the town around them. Nobody owns it.
 */
export function townTable(town) {
  const styles = town.lineup.slice();
  return {
    id: town.key,
    name: town.name,
    owner: false,
    town: true,
    styles,
    // Townsfolk have names of their own: a table of three regulars all called
    // by their style's one name reads like a mistake.
    names: town.folk ? town.folk.slice() : [],
    local: { seat: 0, key: town.local.key, short: town.local.short, name: town.local.name },
    stats: lobbyStats(styles),
    soft: softness(styles),
  };
}

/**
 * A table at a stop, by id: one of the three in its lobby, or the table of the
 * town that leaves the river there. Unknown ids fall back to the owner's table,
 * which is what the lobby has always done.
 */
export function tableAt(venue, sittings, id) {
  const town = BACKWATERS.find((b) => b.key === id && b.junction === venue.key);
  if (town) return townTable(town);
  const tables = lobbyFor(venue, sittings).tables;
  return tables.find((x) => x.id === id) || tables[0];
}

/** What a town's record holds, repaired as it is read. */
export function townRecord(profile, key) {
  const all = profile.data.towns && typeof profile.data.towns === 'object' ? profile.data.towns : {};
  const r = all[key] && typeof all[key] === 'object' ? all[key] : {};
  const num = (x) => (Number.isFinite(x) ? x : 0);
  return {
    hands: profile.handsAt(handsKey(key)),
    sittings: Math.max(0, Math.round(num(r.sittings))),
    bestUp: num(r.bestUp),
    bestSound: Math.max(0, Math.min(1, num(r.bestSound))),
    paid: Array.isArray(r.paid) ? r.paid.filter((x) => typeof x === 'string') : [],
  };
}

/** What each of a town's three goals pays: more for the towns further down the river. */
export function goalPearls(town, i) {
  return [20, 30, 40][i] * handPearls(junctionOf(town).index);
}

/**
 * A town's three goals: hands at its table, a sitting that wins, and a sitting
 * played well. Each is done from the record and pays once.
 *
 * @returns {Array<{id:string, text:string, params:object, have:number, need:number, done:boolean, paid:boolean, pearls:number}>}
 */
export function townGoals(profile, town) {
  const r = townRecord(profile, town.key);
  const g = town.goals;
  const pct = (x) => Math.round(x * 100);
  const goals = [
    {
      id: 'hands', text: 'Play {n} hands at {town}', params: { n: g.hands, town: town.name },
      have: Math.min(r.hands, g.hands), need: g.hands, done: r.hands >= g.hands,
    },
    {
      id: 'up', text: 'Get up from the table at least {n} big blinds ahead', params: { n: g.up },
      have: Math.max(0, Math.min(g.up, Math.floor(r.bestUp))), need: g.up, done: r.bestUp >= g.up,
    },
    {
      id: 'sound', text: 'Play a sitting of {hands} hands or more with {pct}% of your decisions sound', params: { hands: g.soundHands, pct: pct(g.sound) },
      have: Math.min(pct(g.sound), pct(r.bestSound)), need: pct(g.sound), done: r.bestSound >= g.sound,
    },
  ];
  return goals.map((goal, i) => ({ ...goal, paid: r.paid.includes(goal.id), pearls: goalPearls(town, i) }));
}

/** Whether all three are done: the town gives you its trophy. */
export const townDone = (profile, town) => townGoals(profile, town).every((g) => g.done);

/**
 * A sitting at a town's table is over. Keeps the best of it, pays for every
 * goal that is done and not yet paid, and says what changed.
 *
 * @param {{hands:number, netBb:number, right:number, total:number}} sitting
 * @returns {{paid:Array<{id:string, pearls:number}>, finished:boolean}}
 *   the goals paid now, and whether this sitting finished the town
 */
export function noteTownSitting(profile, key, { hands, netBb, right, total }) {
  const town = backwaterFor(key);
  if (!town) return { paid: [], finished: false };
  const before = townGoals(profile, town);
  const r = townRecord(profile, key);
  const share = total > 0 ? right / total : 0;
  const counts = hands >= town.goals.soundHands;
  if (!profile.data.towns || typeof profile.data.towns !== 'object') profile.data.towns = {};
  profile.data.towns[key] = {
    sittings: r.sittings + 1,
    bestUp: Math.max(r.bestUp, Number.isFinite(netBb) ? netBb : 0),
    bestSound: counts ? Math.max(r.bestSound, share) : r.bestSound,
    paid: r.paid,
  };
  const after = townGoals(profile, town);
  const paid = [];
  for (const goal of after) {
    if (goal.done && !goal.paid) {
      profile.data.towns[key].paid.push(goal.id);
      paid.push({ id: goal.id, pearls: profile.earnPearls(goal.pearls) });
    }
  }
  profile.save();
  const finished = after.every((g) => g.done) && !before.every((g) => g.done);
  return { paid, finished };
}

/** Every town, with where you stand with it: for the chart and the boat. */
export function backwatersState(profile) {
  return BACKWATERS.map((town) => ({
    town,
    heard: heard(profile, town.key),
    here: townHere(profile) === town,
    done: townDone(profile, town),
    goals: townGoals(profile, town),
  }));
}
