/**
 * Plays hands the way the practice table and the stops deal them, with a hero
 * the coach itself grades, and reports what the purse earns: pearls a hand,
 * pearls an hour, and how long a shelf takes to fill.
 *
 * Whether pearls are "too easy" is a question about pacing, and pacing is a
 * number: what everything on the shelves costs, divided by what an hour at a
 * table pays. This measures the second half, with the same functions the
 * table calls (handPearls, decisionPearls, seatBounty, bountyPaid, strongbox,
 * the Catch Book's bites and landings) and the same coach (judgeSpot), so a
 * change to any of them moves the report.
 *
 * The hero is a ceiling and a floor in one knob. `skill` is the chance of
 * taking the action the coach grades best; otherwise a random legal one.
 * 1 is a player who never makes a mistake the coach can see; 0.7 is a decent
 * one; 0.4 is somebody who is guessing.
 *
 * Time is an estimate and says so: the bots' own delay (620 ms an action, as
 * on the screen), the hero's thinking at THINK seconds a decision, the
 * auto-deal wait, and a beat for the cards.
 *
 * Run: node tools/measure-pearls.mjs [hands] [seats] [stop|p] [skill] [boatBonus]
 *   stop: 0..7 for a stop on the river, p for the practice table
 *
 * Environment:
 *   POLICY=fold   the hero folds every hand it can: the cheapest way to sit there
 *   PLAYED=1      a hand pays its pearl only if the hero did not fold before the flop
 *   FACTOR=0.5    pearls scale by this much (a short-handed table's share)
 *   SEED=n        a different deal
 */
import { createTable } from '../src/js/engine/table.js';
import { botAction, getProfile, pickOpponents } from '../src/js/engine/bots.js';
import { makeRng } from '../src/js/core/rng.js';
import { snapshotOf, captureRange } from '../src/js/core/lessonRunner.js';
import { judgeSpot } from '../src/js/core/coach.js';
import { potFraction, sizingContext } from '../src/js/core/betSizing.js';
import {
  handPearls, decisionPearls, seatBounty, bountyPaid, strongbox,
} from '../src/js/state/economy.js';
import { bites, landed, logCatch, SPECIES } from '../src/js/data/fish.js';
import { autoDealDelay } from '../src/js/state/autoDeal.js';

const HANDS = Number(process.argv[2] || 300);
const SEATS = Number(process.argv[3] || 6);
const STOP = process.argv[4] === undefined || process.argv[4] === 'p' ? null : Number(process.argv[4]);
const SKILL = Number(process.argv[5] ?? 1);
const BOAT_BONUS = Number(process.argv[6] ?? 0);
const SEED = Number(process.env.SEED || 20261005);
const POLICY = process.env.POLICY || 'play';
const PLAYED = process.env.PLAYED === '1';
const FACTOR = Number(process.env.FACTOR ?? 1);
const SITTING = 80;      // hands in a sitting: a bounty is taken once per sitting
const THINK = 4;         // seconds a hero decision takes
const BOT_DELAY = 0.62;  // seconds, as on the screen

const rng = makeRng(SEED);
const bigBlind = 2;
const START = bigBlind * 100;
const HERO = 'hero';

const rank = { good: 2, ok: 1, bad: 0 };
const pick = (list) => list[Math.floor(rng() * list.length)];

/** What the hero does: the coach's best grade, or at random with chance 1 - skill. */
function heroChoice(table, hero, snap) {
  const legal = table.legalActions(hero);
  if (POLICY === 'fold') {
    const action = legal.find((a) => a.type === 'fold') ? { type: 'fold' } : { type: 'check' };
    return { action, verdict: judgeSpot({ ...snap, action: action.type }) };
  }
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

const totals = {
  hands: 0, handPearls: 0, decisionPearls: 0, boatPearls: 0, bountyPearls: 0, catchPearls: 0,
  heroDecisions: 0, soundDecisions: 0, botActions: 0, seconds: 0, bounties: 0, showdowns: 0,
};
const book = {};
const bookAt = [];   // hand number of each first catch
let carry = 0;
let scaleCarry = 0;
/** What a table of this size pays: the amount scaled, the fraction carried. */
function scaled(amount) {
  if (FACTOR === 1) return amount;
  const owed = scaleCarry + amount * FACTOR;
  const whole = Math.floor(owed + 1e-9);
  scaleCarry = owed - whole;
  return whole;
}

let table = null;
let bounties = {};
let stacksAtStart = {};

function newSitting() {
  const opponents = pickOpponents(SEATS - 1, rng);
  table = createTable({
    smallBlind: bigBlind / 2, bigBlind, rng,
    players: [
      { id: HERO, name: 'You', stack: START, isHero: true },
      ...opponents.map((key, i) => ({ id: `bot${i}`, name: getProfile(key).name, stack: START, profile: key })),
    ],
  });
  table.readerLevel = 4;
  bounties = {};
  // The boss only sits at a stop; the practice table has regulars.
  opponents.forEach((key, i) => { bounties[`bot${i}`] = seatBounty(STOP, STOP != null && i === 0); });
}

function playHand() {
  if (table.players.find((p) => p.id === HERO).stack <= 0) table.players.find((p) => p.id === HERO).stack = START;
  if (table.players.filter((p) => p.stack > 0).length < 2) {
    for (const p of table.players) if (!p.isHero && p.stack < bigBlind * 20) p.stack = START;
  }
  table.startHand();
  stacksAtStart = Object.fromEntries(table.players.map((p) => [p.id, p.stack + p.committed]));
  const hero = table.player(HERO);
  const state = { aggressor: {}, opener: null, ranges: {} };
  const graded = [];
  const hooked = [];
  let botActions = 0;
  let heroDecisions = 0;
  let heroFoldedPreflop = false;
  let guard = 0;

  while (!table.handOver && guard++ < 300) {
    const actor = table.actor;
    if (!actor) break;
    if (actor.isHero) {
      const snap = snapshotOf(table, hero, { rng, aggressor: state.aggressor, opener: state.opener, ranges: state.ranges, seats: SEATS });
      const { action, verdict } = heroChoice(table, hero, snap);
      heroDecisions++;
      graded.push({ level: verdict.level, helped: false });
      const earned = scaled(decisionPearls({ level: verdict.level, street: table.street, action: action.type, helped: false }));
      if (earned) {
        totals.decisionPearls += earned;
        totals.soundDecisions += earned;
        const s = strongbox(carry, earned, BOAT_BONUS);
        carry = s.carry;
        totals.boatPearls += s.extra;
      }
      for (const key of bites({
        street: table.street, action: action.type, concept: verdict.concept.id, level: verdict.level,
        helped: false, position: snap.position, firstIn: snap.firstIn, toCall: snap.toCall,
      }, STOP)) hooked.push(key);
      if (action.type === 'fold' && table.street === 'preflop') heroFoldedPreflop = true;
      if (action.type === 'bet' || action.type === 'raise') state.aggressor[table.street] = HERO;
      table.act(action);
    } else {
      const action = botAction(table, actor, rng);
      captureRange(table, actor, action, state, rng);
      if (action.type === 'bet' || action.type === 'raise') {
        state.aggressor[table.street] = actor.id;
        if (table.street === 'preflop' && !state.opener) state.opener = actor.position;
      }
      botActions++;
      table.act(action);
    }
  }

  const result = table.result;
  const showdown = result.reason === 'showdown';
  const heroWon = (result.payouts[HERO] || 0) > 0;
  totals.hands++;
  if (showdown) totals.showdowns++;

    const played = !PLAYED || (graded.length > 0 && !heroFoldedPreflop);
  const paid = played ? scaled(handPearls(STOP)) : 0;
  totals.handPearls += paid;
  const s = strongbox(carry, paid, BOAT_BONUS);
  carry = s.carry;
  totals.boatPearls += s.extra;

  // Bounties: a player who sat down with chips, has none, and was in a pot the hero won.
  const mistakes = graded.filter((d) => d.level === 'bad').length;
  for (const p of table.players) {
    const b = bounties[p.id] || 0;
    if (p.isHero || !b || p.stack > 0 || !(stacksAtStart[p.id] > 0)) continue;
    bounties[p.id] = 0;
    const shared = heroWon && result.pots.some((pot) => pot.eligible.includes(p.id) && pot.eligible.includes(HERO));
    if (!shared) continue;
    const got = bountyPaid(b, mistakes);
    totals.bountyPearls += got;
    if (got) totals.bounties++;
  }

  // The Catch Book: the first of each kind pays its water's reward.
  for (const key of landed(hooked, { heroWon, showdown })) {
    const got = logCatch(book, key, { weight: 1, where: 'sim' });
    if (got && got.first) {
      totals.catchPearls += got.reward;
      bookAt.push({ key, hand: totals.hands });
    }
  }

  totals.heroDecisions += heroDecisions;
  totals.botActions += botActions;
  totals.seconds += botActions * BOT_DELAY + heroDecisions * THINK
    + autoDealDelay({ showdown }) / 1000 + 0.5;
}

const started = Date.now();
for (let h = 0; h < HANDS; h++) {
  if (h % SITTING === 0) newSitting();
  playHand();
}

const per = (n) => (n / totals.hands).toFixed(2);
const hours = totals.seconds / 3600;
const total = totals.handPearls + totals.decisionPearls + totals.boatPearls + totals.bountyPearls + totals.catchPearls;
const steady = totals.handPearls + totals.decisionPearls + totals.boatPearls;
const where = STOP == null ? 'the practice table' : `stop ${STOP}`;
console.log(`${HANDS} hands, ${SEATS}-handed at ${where}, ${POLICY === 'fold' ? 'folding everything' : `skill ${SKILL}`}, strongbox +${Math.round(BOAT_BONUS * 100)}%${PLAYED ? ', hands pay only when played' : ''}${FACTOR !== 1 ? `, x${FACTOR}` : ''}  (${((Date.now() - started) / 1000).toFixed(0)}s to simulate)`);
console.log(`  per hand      hand ${per(totals.handPearls)}  decisions ${per(totals.decisionPearls)}  boat ${per(totals.boatPearls)}  = ${per(steady)} steady`);
console.log(`  hero decisions a hand ${per(totals.heroDecisions)}, sound ${per(totals.soundDecisions)}; bot actions a hand ${per(totals.botActions)}; showdowns ${(100 * totals.showdowns / totals.hands).toFixed(0)}%`);
console.log(`  bounties      ${totals.bounties} taken for ${totals.bountyPearls} pearls (${(totals.bountyPearls / (HANDS / SITTING)).toFixed(1)} a sitting of ${SITTING} hands)`);
console.log(`  catch book    ${Object.keys(book).length} of ${SPECIES.length} kinds, ${totals.catchPearls} pearls`);
console.log(`  time          ${(totals.seconds / totals.hands).toFixed(1)}s a hand → ${(3600 / (totals.seconds / totals.hands)).toFixed(0)} hands an hour`);
console.log(`  PEARLS        ${(total / totals.hands).toFixed(2)} a hand overall, ${(steady / hours).toFixed(0)} an hour steady, ${(total / hours).toFixed(0)} an hour with bounties and catches`);
if (process.env.BOOK) console.log('  first catches', bookAt.map((b) => `${b.key}@${b.hand}`).join(' '));
