/**
 * Plays duels the way the table deals them — heads-up, a hundred big blinds
 * each, the blinds rising on the clock in state/match.js — with a hero the
 * coach itself grades, and reports how they go: how often the hero wins, how
 * long a duel runs, and the stars it earns.
 *
 * What it answers is whether a duel is a fair fight and an evening's length:
 * not so long it is a chore (the worst case should be an hour at the outside),
 * not so short it is a coin flip with a button on it, and winnable by a hero
 * who plays well and not by one who guesses.
 *
 * Run: node tools/measure-duel.mjs [duels] [stop|all] [skill]
 *
 * Environment: SEED=n  a different deal;  LEVEL=n  the reader's rank (default 4)
 */
import { createTable } from '../src/js/engine/table.js';
import { botAction, getProfile } from '../src/js/engine/bots.js';
import { makeRng } from '../src/js/core/rng.js';
import { snapshotOf, captureRange } from '../src/js/core/lessonRunner.js';
import { judgeSpot } from '../src/js/core/coach.js';
import { potFraction, sizingContext } from '../src/js/core/betSizing.js';
import { VENUES } from '../src/js/data/venues.js';
import { blindsFor, duelStars, soundShare } from '../src/js/state/match.js';

const DUELS = Number(process.argv[2] || 40);
const WHICH = process.argv[3] === undefined || process.argv[3] === 'all' ? null : Number(process.argv[3]);
const SKILL = Number(process.argv[4] ?? 0.9);
const SEED = Number(process.env.SEED || 20261005);
const LEVEL = Number(process.env.LEVEL || 4);
const START = 200;
const HERO = 'hero';
const rank = { good: 2, ok: 1, bad: 0 };

const rng = makeRng(SEED);
const pick = (list) => list[Math.floor(rng() * list.length)];

function heroChoice(table, hero, snap) {
  const legal = table.legalActions(hero);
  const candidates = [];
  for (const spec of legal) {
    if (spec.type === 'fold' || spec.type === 'check' || spec.type === 'call') candidates.push({ type: spec.type });
    else {
      const ctx = sizingContext(table, hero, spec);
      for (const f of [0.5, 1]) candidates.push({ type: spec.type, amount: potFraction(ctx, f) });
    }
  }
  if (rng() > SKILL) {
    const c = pick(candidates);
    return { action: c, verdict: judgeSpot({ ...snap, action: c.type, amount: c.amount }) };
  }
  const graded = candidates.map((c) => ({ action: c, verdict: judgeSpot({ ...snap, action: c.type, amount: c.amount }) }));
  const best = Math.max(...graded.map((g) => rank[g.verdict.level]));
  return pick(graded.filter((g) => rank[g.verdict.level] === best));
}

function duel(venue) {
  const table = createTable({
    smallBlind: 1, bigBlind: 2, rng,
    players: [
      { id: HERO, name: 'You', stack: START, isHero: true },
      { id: 'bot0', name: 'Boss', stack: START, profile: venue.resident },
    ],
  });
  table.readerLevel = Math.min(10, LEVEL + 3);
  const hero = table.player(HERO);
  const boss = table.player('bot0');
  const graded = [];
  let hands = 0;
  while (hero.stack > 0 && boss.stack > 0 && hands < 400) {
    const b = blindsFor(hands);
    table.smallBlind = b.small;
    table.bigBlind = b.big;
    hands++;
    table.startHand();
    const state = { aggressor: {}, opener: null, ranges: {} };
    let guard = 0;
    while (!table.handOver && guard++ < 300) {
      const actor = table.actor;
      if (!actor) break;
      if (actor.isHero) {
        const snap = snapshotOf(table, hero, { rng, aggressor: state.aggressor, opener: state.opener, ranges: state.ranges, seats: 2 });
        const { action, verdict } = heroChoice(table, hero, snap);
        graded.push({ level: verdict.level, helped: false });
        if (action.type === 'bet' || action.type === 'raise') state.aggressor[table.street] = HERO;
        table.act(action);
      } else {
        const action = botAction(table, actor, rng);
        captureRange(table, actor, action, state, rng);
        if (action.type === 'bet' || action.type === 'raise') {
          state.aggressor[table.street] = actor.id;
          if (table.street === 'preflop' && !state.opener) state.opener = actor.position;
        }
        table.act(action);
      }
    }
  }
  const won = boss.stack <= 0;
  const { decisions, sound } = soundShare(graded);
  return { won, hands, decisions, share: decisions ? sound / decisions : 0, stars: duelStars({ won, decisions, sound }), chips: hero.stack + boss.stack };
}

const stops = WHICH === null ? VENUES : [VENUES[WHICH]];
console.log(`${DUELS} duels per stop, hero skill ${SKILL}, reader level ${LEVEL}`);
console.log('stop        win%   hands avg/p90/max   decisions avg   stars 0/1/2/3   sound share min/avg/max');
for (const venue of stops) {
  const results = Array.from({ length: DUELS }, () => duel(venue));
  const hands = results.map((r) => r.hands).sort((a, b) => a - b);
  const stars = [0, 0, 0, 0];
  results.forEach((r) => stars[r.stars]++);
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const broke = results.filter((r) => r.chips !== START * 2).length;
  console.log(
    `${venue.key.padEnd(10)} ${(100 * results.filter((r) => r.won).length / DUELS).toFixed(0).padStart(4)}%`
    + `   ${avg(hands).toFixed(0).padStart(4)} / ${hands[Math.floor(hands.length * 0.9)]} / ${hands[hands.length - 1]}`
    + `        ${avg(results.map((r) => r.decisions)).toFixed(0).padStart(5)}`
    + `        ${stars.join('/')}   ${(100 * Math.min(...results.map((r) => r.share))).toFixed(0)}/${(100 * avg(results.map((r) => r.share))).toFixed(0)}/${(100 * Math.max(...results.map((r) => r.share))).toFixed(0)}%${broke ? `   !! ${broke} duels lost chips` : ''}`);
}
