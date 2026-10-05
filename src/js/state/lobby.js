/**
 * The lobby: three tables at every stop, and which of them to sit at.
 *
 * Choosing the game is the cheapest edge in poker and the one beginners never
 * think of: the same hands, played just as well, win a great deal at a table
 * full of people who call too much and nothing at a table of regulars. A
 * real lobby shows a few numbers for each table — how many players see the
 * flop, how often pots are raised, how big the average pot is — and the whole
 * skill is reading them. So that is what this shows, and no more: the names
 * of the people at each table, and the numbers they add up to. Which table
 * is soft is for the reader to work out.
 *
 * Each stop has the owner's table (the owner and four others; the one you
 * take the stop from) and two side games with nobody in charge. What is at
 * them changes as people come and go — here, with every sitting you finish —
 * but the same lobby is shown for as long as you are looking at it, because
 * it is made from the stop and the count rather than from a roll of the dice
 * at the moment you open the screen.
 *
 * Free of the DOM, and of the clock, so it can be tested.
 */

import { getProfile } from '../engine/bots.js';
import { makeRng } from '../core/rng.js';
import { WANDERER_KEYS } from '../data/wanderers.js';

/** The chairs at every table: you, and five others. */
export const LOBBY_SEATS = 6;

export const OWNER_TABLE = 'owner';
export const SIDE_TABLES = [
  { id: 'back', name: 'The back room' },
  { id: 'corner', name: 'The corner game' },
];
export const TABLE_IDS = [OWNER_TABLE, ...SIDE_TABLES.map((t) => t.id)];

/**
 * What a side game can be made of. Not every one of these is worth sitting at,
 * and the lobby always has at least one that is.
 */
export const TEMPLATES = {
  // Everybody calls, nobody raises: the money is here, slowly.
  passive: ['station', 'station', 'rock', 'tag', 'station'],
  // Everybody raises: the money is here too, and so is the variance.
  wild: ['maniac', 'lag', 'station', 'maniac', 'tag'],
  // Nobody plays a hand: not much to win, not much to lose.
  nitty: ['rock', 'rock', 'tag', 'rock', 'pro'],
  // The regulars' game: the hardest on the river.
  regs: ['pro', 'tag', 'pro', 'tag', 'lag'],
};

/**
 * How much each style is worth at a table, as a share of a buy-in an hour —
 * relative and rough. Calling stations and maniacs give money away; the solid
 * styles do not. Never shown: the reader works it out from the numbers.
 */
const WORTH = { station: 1.0, maniac: 0.7, lag: 0.2, rock: 0.1, tag: -0.3, pro: -0.6 };
/** The wanderers are the extremes of their styles, and worth more than the style they are an extreme of. */
const WANDERER_WORTH = { hale: 1.4, dixie: 1.0, josiah: 0.2 };

/** A table is soft when its players are worth more than this, on average. */
export const SOFT = 0.3;

const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** How loose a style is: how much of the time it is in a hand. */
const looseness = (key) => {
  const p = getProfile(key);
  return clamp(p.openPct * 0.45 + p.defendPct * 0.55 + (p.limps || 0) * 0.1, 0, 1);
};

/**
 * The three numbers a lobby shows for a table of these styles: the share of
 * players seeing the flop, the share of pots raised before it, and the average
 * pot in big blinds. Each rises with the thing it is named for, and the
 * three together tell loose-passive (high, low, middling) from loose-aggressive
 * (high, high, big) from tight (low, low, small) from regulars (middling all
 * round).
 */
export function lobbyStats(styles) {
  const loose = styles.map(looseness);
  const aggression = styles.map((k) => getProfile(k).aggression);
  return {
    flop: Math.round(100 * (0.1 + mean(loose))),
    raised: Math.round(100 * (0.1 + 0.45 * mean(aggression))),
    pot: Math.round(5 + 28 * mean(loose.map((l, i) => l * (0.35 + aggression[i])))),
  };
}

/** What a table's players are worth, on average. Higher is softer. */
export const softness = (styles) => mean(styles.map((k) => WORTH[k] ?? WANDERER_WORTH[k] ?? 0));

/**
 * The lobby at a stop.
 *
 * @param {{key:string, index:number, resident:string}} stop
 * @param {number} sittings  how many sittings the reader has finished
 * @returns {{tables:Array, rival:string|null}}
 *   a table is { id, name, owner, styles (the five others), stats, soft }
 *   and `rival` is the id of the table the Rival sits at, or null
 */
export function lobbyFor(stop, sittings = 0) {
  const rng = makeRng(hash(`${stop.key}/${sittings}`));
  const draw = (list) => list[Math.floor(rng() * list.length)];

  // The owner's table is the classic one: the owner, and four different styles
  // of the other five, in no particular order — the table the river has always
  // dealt, so what you learn there is learned against one of everything.
  const others = Object.keys(WORTH).filter((k) => k !== stop.resident);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const owner = [stop.resident, ...others.slice(0, LOBBY_SEATS - 2)];

  // Two side games, different from each other, and not both hard.
  const names = Object.keys(TEMPLATES);
  const first = draw(names);
  let second = draw(names.filter((n) => n !== first));
  const sides = [first, second];
  if (!sides.some((n) => softness(TEMPLATES[n]) > SOFT)) sides[1] = 'passive';
  // Which is the back room and which the corner is a toss-up.
  if (rng() < 0.5) sides.reverse();

  const tables = [
    { id: OWNER_TABLE, name: 'The owner\'s table', owner: true, styles: owner },
    ...SIDE_TABLES.map((side, i) => ({
      id: side.id, name: side.name, owner: false, styles: TEMPLATES[sides[i]].slice(), template: sides[i],
    })),
  ].map((table) => ({ ...table, stats: lobbyStats(table.styles), soft: softness(table.styles) }));

  const rival = rivalAt(stop, rng, tables);
  return { tables, rival, wanderer: wandererAt(stop, sittings, tables) };
}

/**
 * Where the Rival is sitting, if anywhere: from the second city on, and
 * about two visits in three.
 */
export const RIVAL_FROM = 1;
/** She plays a solid regular's game; what is different about her is her memory. */
const RIVAL_STYLE = 'pro';
export const RIVAL_CHANCE = 0.65;
function rivalAt(stop, rng, tables) {
  const roll = rng();
  const pickTable = Math.floor(rng() * tables.length);
  if (stop.index < RIVAL_FROM || roll >= RIVAL_CHANCE) return null;
  const table = tables[pickTable];
  // She is a regular's equal, and sits where she changes the table least: in
  // the seat of whoever was worth least to it, never the owner's. A game
  // that was soft stays soft with her in it.
  let seat = -1;
  table.styles.forEach((key, i) => {
    if (table.owner && i === 0) return;
    if (seat < 0 || (WORTH[key] ?? 0) <= (WORTH[table.styles[seat]] ?? 0)) seat = i;
  });
  table.styles[seat] = RIVAL_STYLE;
  table.rivalSeat = seat;
  table.stats = lobbyStats(table.styles);
  table.soft = softness(table.styles);
  return table.id;
}

/**
 * A stranger passing through: from the second city on, about two periods in
 * five, and gone after three sittings. They take a seat at one of the side
 * games — never the owner's — where they change the table least, and never the
 * Rival's. Made from the stop and the period, so the same stranger is in the
 * same chair for all three sittings.
 */
export const WANDERER_FROM = 1;
export const WANDERER_CHANCE = 0.4;
export const WANDERER_STAY = 3;
function wandererAt(stop, sittings, tables) {
  const period = Math.floor(Math.max(0, sittings) / WANDERER_STAY);
  const rng = makeRng(hash(`wanderer/${stop.key}/${period}`));
  const roll = rng();
  const key = WANDERER_KEYS[Math.floor(rng() * WANDERER_KEYS.length)];
  const pickTable = Math.floor(rng() * SIDE_TABLES.length);
  if (stop.index < WANDERER_FROM || roll >= WANDERER_CHANCE) return null;
  const table = tables.find((t) => t.id === SIDE_TABLES[pickTable].id);
  let seat = -1;
  table.styles.forEach((style, i) => {
    if (table.rivalSeat === i) return;
    if (seat < 0 || (WORTH[style] ?? WANDERER_WORTH[style] ?? 0) <= (WORTH[table.styles[seat]] ?? WANDERER_WORTH[table.styles[seat]] ?? 0)) seat = i;
  });
  table.styles[seat] = key;
  table.wandererSeat = seat;
  table.stats = lobbyStats(table.styles);
  table.soft = softness(table.styles);
  return { key, table: table.id };
}

/**
 * Where a table ranks among the three for softness, 1 being the softest, and
 * whether it was (tied for) the best choice. For Silas's note on the choice.
 */
export function chosenRank(tables, id) {
  const chosen = tables.find((t) => t.id === id);
  if (!chosen) return null;
  const better = tables.filter((t) => t.soft > chosen.soft + 1e-9).length;
  return { rank: better + 1, of: tables.length, best: better === 0 };
}
