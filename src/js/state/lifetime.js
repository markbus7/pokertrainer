/**
 * Your career at the tables, kept hand by hand.
 *
 * A sitting's numbers (state/stats.js) are forgotten when you stand up, and
 * Silas's notes keep only the last few. What a player wants to know about
 * themselves is longer than that: what kind of player am I, which hand do I
 * win the most with, what is the biggest pot I have ever taken. So every hand
 * at a real table leaves a few facts here, and the Character screen reads
 * them back.
 *
 * Three kinds of hand, kept apart where it matters:
 *
 *   - Style (VPIP, PFR, aggression…) is only counted at a full cash table.
 *     Heads-up, three-handed, a duel or a short-stacked tournament is a
 *     different game where everybody plays more hands, and mixing them in
 *     would call a sound player loose.
 *   - Results in big blinds are only counted at cash tables. A tournament
 *     chip is not a big blind of anybody's money.
 *   - Everything else — the biggest pot, the best hand, the favourite cards,
 *     streaks and showdowns — counts every hand you actually played.
 *
 * Compact on purpose: it lives in the save and travels with cloud sync, so a
 * starting hand is four numbers in an array rather than an object.
 *
 * Free of the DOM, so it can be tested.
 */

import { SAMPLE } from './stats.js';

export const LIFETIME_VERSION = 1;

/** Below these, a rate is noise and is not shown. */
export const LIFE_SAMPLE = {
  style: SAMPLE.playStyle,   // VPIP and PFR
  aggression: 20,            // postflop calls before an aggression factor means anything
  showdown: 12,              // showdowns before a won-at-showdown rate
  flops: 20,                 // flops seen before a went-to-showdown rate
  winRate: SAMPLE.winRate,   // cash hands before bb/100
  hand: 4,                   // times a starting hand was played before it can be your best or worst
  seat: 25,                  // hands in a seat before it can be your best
  victim: 10,                // hands against a style before it can be your victim or nemesis
};

const round = (x) => Math.round(x * 100) / 100;
const num = (x, min = 0) => (Number.isFinite(x) && x >= min ? x : min);
const int = (x) => Math.max(0, Math.round(num(x)));
/** Big blinds won or lost: any finite number, and nothing for anything else. */
const money = (x) => (Number.isFinite(x) ? x : 0);

export function emptyLifetime() {
  return {
    v: LIFETIME_VERSION,
    // Every hand played at a real table, any kind.
    hands: 0,
    won: 0,
    showdowns: 0,
    showdownsWon: 0,
    noShowdownWins: 0,
    allIns: 0,
    folds: 0,
    decisions: 0,
    sound: 0,
    // Full cash tables only: the numbers a HUD would show about you.
    style: {
      hands: 0, vpip: 0, pfr: 0, threeBet: 0, threeBetChances: 0,
      sawFlop: 0, showdowns: 0, showdownsWon: 0, bets: 0, raises: 0, calls: 0,
    },
    // Cash tables only: results in big blinds.
    cash: { hands: 0, netBb: 0 },
    // Starting hands: key -> [dealt, played, won, netBb]. netBb is cash only.
    starting: {},
    // Seats: position -> [hands, netBb]. Full cash tables only: the button
    // heads-up is a different seat from the button at six.
    seats: {},
    // Who you take chips from and lose them to: style -> [hands, wonBb, lostBb]. Cash only.
    against: {},
    // Hands made at showdown, by category (0 high card … 8 straight flush), and royals.
    made: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    royals: 0,
    // Records. A made hand is kept as its score (core/evaluator.js, in the
    // standard order) and named when it is shown, in whatever language then.
    biggestPot: null,   // { bb, key, made, at, where }  cash only
    biggestBluff: null, // { bb, key, at, where }  won with nothing, no showdown; cash only
    bestHand: null,     // { score, key, at, where, won }
    bluffs: 0,          // pots won with nothing, no showdown
    streak: { now: 0, best: 0 },
  };
}

/** A lifetime read back from a save: only numbers and the shapes above, whatever was stored. */
export function sanitizeLifetime(raw) {
  const life = emptyLifetime();
  if (!raw || typeof raw !== 'object') return life;
  for (const k of ['hands', 'won', 'showdowns', 'showdownsWon', 'noShowdownWins', 'allIns', 'folds', 'decisions', 'sound', 'royals', 'bluffs']) {
    life[k] = int(raw[k]);
  }
  if (raw.style && typeof raw.style === 'object') {
    for (const k of Object.keys(life.style)) life.style[k] = int(raw.style[k]);
  }
  if (raw.cash && typeof raw.cash === 'object') {
    life.cash.hands = int(raw.cash.hands);
    life.cash.netBb = Number.isFinite(raw.cash.netBb) ? round(raw.cash.netBb) : 0;
  }
  // `money` names the columns that are big blinds and may be negative; the
  // rest are counts. 200 rows is more than any of the tables can honestly
  // hold (169 starting hands), so a save cannot grow without limit.
  const table = (obj, width, money) => {
    const out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    for (const [key, row] of Object.entries(obj).slice(0, 200)) {
      if (!Array.isArray(row) || !key || key.length > 12) continue;
      out[key] = Array.from({ length: width }, (_, i) => (money.includes(i)
        ? (Number.isFinite(row[i]) ? round(row[i]) : 0)
        : int(row[i])));
    }
    return out;
  };
  life.starting = table(raw.starting, 4, [3]);
  life.seats = table(raw.seats, 2, [1]);
  life.against = table(raw.against, 3, [1, 2]);
  if (Array.isArray(raw.made)) life.made = life.made.map((_, i) => int(raw.made[i]));
  // A record keeps its number only if it is a number, and the rest only if
  // it is the kind of thing it should be.
  const record = (r, field) => {
    if (!r || typeof r !== 'object' || !Number.isFinite(r[field])) return null;
    const out = { [field]: field === 'bb' ? round(r[field]) : r[field] };
    out.key = typeof r.key === 'string' && r.key.length <= 4 ? r.key : null;
    out.at = Number.isFinite(r.at) ? r.at : null;
    out.where = typeof r.where === 'string' && r.where.length <= 24 ? r.where : null;
    if ('made' in r) out.made = Number.isFinite(r.made) ? r.made : null;
    if ('won' in r) out.won = Boolean(r.won);
    return out;
  };
  life.biggestPot = record(raw.biggestPot, 'bb');
  life.biggestBluff = record(raw.biggestBluff, 'bb');
  life.bestHand = record(raw.bestHand, 'score');
  if (raw.streak && typeof raw.streak === 'object') {
    life.streak = { now: int(raw.streak.now), best: int(raw.streak.best) };
  }
  return life;
}

/**
 * One hand, as the table saw it.
 *
 * @typedef {object} HandFacts
 * @property {'cash'|'duel'|'regatta'} mode
 * @property {boolean} full        a full cash table: count the style numbers
 * @property {string|null} key     the starting hand, 'AKs', or null for Omaha
 * @property {string} position     'BTN', 'SB' …
 * @property {boolean} vpip        put money in voluntarily before the flop
 * @property {boolean} pfr         raised before the flop
 * @property {boolean} threeBet
 * @property {boolean} threeBetChance
 * @property {boolean} sawFlop
 * @property {boolean} showdown    you were in it at the showdown
 * @property {boolean} won         you took some of the pot
 * @property {number} netBb        what the hand won or lost you, in big blinds
 * @property {number} potBb        the size of the pot, in big blinds
 * @property {number} bets  @property {number} raises  @property {number} calls  @property {number} folds
 *           your actions after the flop (bets, raises, calls) and folds anywhere
 * @property {boolean} allIn
 * @property {{score:number, cat:number, royal:boolean}|null} made  your hand at showdown, scored in the standard order
 * @property {boolean} bluff       won with no showdown and nothing made: high card on a board
 * @property {number} decisions    graded decisions this hand
 * @property {number} sound        of which sound and unaided
 * @property {Array<{who:string, netBb:number}>} opponents  whose chips moved to or from you, by style (or
 *           the Rival, or a wanderer): netBb positive when they took chips off you
 * @property {number} at           when
 * @property {string} where        the stop's key, or 'practice'
 */

/** Add one hand. Mutates and returns the lifetime. */
export function recordHand(life, f) {
  life.hands += 1;
  if (f.won) life.won += 1;
  if (f.showdown) {
    life.showdowns += 1;
    if (f.won) life.showdownsWon += 1;
  } else if (f.won) {
    life.noShowdownWins += 1;
  }
  if (f.allIn) life.allIns += 1;
  life.folds += int(f.folds);
  life.decisions += int(f.decisions);
  life.sound += int(f.sound);

  // A streak of hands won, broken by a hand you put money in and lost. A fold
  // before the flop with nothing in is not a loss and does not break it.
  if (f.won) {
    life.streak.now += 1;
    life.streak.best = Math.max(life.streak.best, life.streak.now);
  } else if (f.netBb < 0 && (f.vpip || f.sawFlop || f.netBb < -1.01)) {
    life.streak.now = 0;
  }

  if (f.made && Number.isFinite(f.made.score)) {
    const cat = Math.max(0, Math.min(8, Math.floor(f.made.cat)));
    life.made[cat] += 1;
    if (f.made.royal) life.royals += 1;
    if (!life.bestHand || f.made.score > life.bestHand.score) {
      life.bestHand = { score: f.made.score, key: f.key, at: f.at, where: f.where, won: Boolean(f.won) };
    }
  }

  if (f.bluff) life.bluffs += 1;
  if (f.mode === 'cash' && f.won && Number.isFinite(f.potBb)) {
    if (!life.biggestPot || f.potBb > life.biggestPot.bb) {
      life.biggestPot = { bb: round(f.potBb), key: f.key, at: f.at, where: f.where, made: f.made ? f.made.score : null };
    }
    if (f.bluff && (!life.biggestBluff || f.potBb > life.biggestBluff.bb)) {
      life.biggestBluff = { bb: round(f.potBb), key: f.key, at: f.at, where: f.where };
    }
  }

  if (f.key) {
    const row = life.starting[f.key] || (life.starting[f.key] = [0, 0, 0, 0]);
    row[0] += 1;
    if (f.vpip) row[1] += 1;
    if (f.won) row[2] += 1;
    if (f.mode === 'cash') row[3] = round(row[3] + money(f.netBb));
  }

  if (f.mode === 'cash') {
    life.cash.hands += 1;
    life.cash.netBb = round(life.cash.netBb + money(f.netBb));
    if (f.position && f.full) {
      const seat = life.seats[f.position] || (life.seats[f.position] = [0, 0]);
      seat[0] += 1;
      seat[1] = round(seat[1] + money(f.netBb));
    }
    for (const o of f.opponents || []) {
      if (!o || typeof o.who !== 'string' || !Number.isFinite(o.netBb)) continue;
      const row = life.against[o.who] || (life.against[o.who] = [0, 0, 0]);
      row[0] += 1;
      // Their loss is your win, and the other way round.
      if (o.netBb < 0) row[1] = round(row[1] - o.netBb);
      else row[2] = round(row[2] + o.netBb);
    }
  }

  if (f.mode === 'cash' && f.full) {
    const s = life.style;
    s.hands += 1;
    if (f.vpip) s.vpip += 1;
    if (f.pfr) s.pfr += 1;
    if (f.threeBet) s.threeBet += 1;
    if (f.threeBetChance) s.threeBetChances += 1;
    if (f.sawFlop) s.sawFlop += 1;
    if (f.showdown) {
      s.showdowns += 1;
      if (f.won) s.showdownsWon += 1;
    }
    s.bets += int(f.bets);
    s.raises += int(f.raises);
    s.calls += int(f.calls);
  }
  return life;
}

/**
 * The numbers a HUD would show about you, each null until there is enough
 * play behind it to mean anything.
 */
export function styleNumbers(life) {
  const s = life.style;
  const rate = (a, b, bar) => (b >= bar && b > 0 ? a / b : null);
  return {
    hands: s.hands,
    vpip: rate(s.vpip, s.hands, LIFE_SAMPLE.style),
    pfr: rate(s.pfr, s.hands, LIFE_SAMPLE.style),
    threeBet: rate(s.threeBet, s.threeBetChances, LIFE_SAMPLE.aggression),
    af: s.calls >= LIFE_SAMPLE.aggression ? (s.bets + s.raises) / s.calls : null,
    wtsd: rate(s.showdowns, s.sawFlop, LIFE_SAMPLE.flops),
    wsd: rate(s.showdownsWon, s.showdowns, LIFE_SAMPLE.showdown),
  };
}

/**
 * VPIP and PFR from Silas's notes, for a save from before the lifetime was
 * kept: each report has the rates of one sitting of thirty hands or more, and
 * weighting them by their hands gives the reader a style straight away rather
 * than another thirty hands from now.
 */
export function styleFromReports(reports) {
  let hands = 0;
  let vpip = 0;
  let pfr = 0;
  for (const r of reports || []) {
    if (!r || !r.style || !Number.isFinite(r.style.vpip) || !Number.isFinite(r.style.pfr) || !(r.hands > 0)) continue;
    hands += r.hands;
    vpip += r.style.vpip * r.hands;
    pfr += r.style.pfr * r.hands;
  }
  if (hands < LIFE_SAMPLE.style) return null;
  return { hands, vpip: vpip / hands, pfr: pfr / hands };
}

/** Cash results: net in big blinds, and bb/100 once there are enough hands. */
export function cashResults(life) {
  const { hands, netBb } = life.cash;
  return { hands, netBb, winRate: hands >= LIFE_SAMPLE.winRate ? (netBb / hands) * 100 : null };
}

/**
 * Your starting hands: the one you play most, the one that has made you the
 * most, and the one that has cost you the most — each only from hands played
 * often enough to say so.
 */
export function startingHands(life) {
  const rows = Object.entries(life.starting).map(([key, [dealt, played, won, netBb]]) => ({ key, dealt, played, won, netBb }));
  const often = rows.filter((r) => r.played >= LIFE_SAMPLE.hand);
  const by = (list, f) => list.reduce((best, r) => (best === null || f(r) > f(best) ? r : best), null);
  const favourite = by(rows.filter((r) => r.played > 0), (r) => r.played + r.won / 1000);
  const best = by(often.filter((r) => r.netBb > 0), (r) => r.netBb);
  const worst = by(often.filter((r) => r.netBb < 0), (r) => -r.netBb);
  return { rows, favourite, best, worst };
}

/** Your best and worst seat at a cash table, per hand. */
export function seats(life) {
  const rows = Object.entries(life.seats)
    .map(([seat, [hands, netBb]]) => ({ seat, hands, netBb, perHand: hands ? netBb / hands : 0 }))
    .filter((r) => r.hands >= LIFE_SAMPLE.seat);
  if (rows.length < 2) return { rows, best: null, worst: null };
  const sorted = rows.slice().sort((a, b) => b.perHand - a.perHand);
  return { rows, best: sorted[0], worst: sorted[sorted.length - 1] };
}

/**
 * Who you take chips from, and who takes them from you: the style you have
 * won the most from (your favourite victim) and the one you have lost the
 * most to (your nemesis), each net and only from enough hands together.
 */
export function rivals(life) {
  const rows = Object.entries(life.against)
    .map(([who, [hands, wonBb, lostBb]]) => ({ who, hands, wonBb, lostBb, net: round(wonBb - lostBb) }))
    .filter((r) => r.hands >= LIFE_SAMPLE.victim);
  const sorted = rows.slice().sort((a, b) => b.net - a.net);
  const victim = sorted.length && sorted[0].net > 0 ? sorted[0] : null;
  const nemesis = sorted.length && sorted[sorted.length - 1].net < 0 ? sorted[sorted.length - 1] : null;
  return { rows, victim, nemesis: nemesis && nemesis !== victim ? nemesis : null };
}

/** The share of graded decisions that were sound and unaided, once there are enough. */
export function soundRate(life) {
  return life.decisions >= 20 ? life.sound / life.decisions : null;
}
