/**
 * Playing the parts of a hand a lesson has not taught yet.
 *
 * A lesson table hands the reader control only when the decision in front of
 * them belongs to that lesson. Everything before it has to be played by
 * something — and the obvious choice, the solid-regular bot, turned out to be
 * exactly wrong: it folds most hands before the flop, so a lesson about flop
 * draws produced its own spot **zero times in four hundred hands**. The
 * reader would have sat watching poker happen next to them.
 *
 * So the autopilot's job is not to play well. It is to get the hand to the
 * street the lesson lives on, cheaply and without pretending otherwise — the
 * table says out loud that this part is being played for you.
 */

import { botAction, profileAt } from '../engine/bots.js';
import { makeRng, shuffle } from './rng.js';
import { makeDeck } from './cards.js';
import { STREETS } from '../engine/table.js';
import { equityVsField, equityVsHands, outsToImprove } from './equity.js';
import { readRange, equityAgainst } from './handRead.js';
import { evaluateHand, categoryOf, CAT } from './evaluator.js';
import { requiredEquity, spr } from './odds.js';

/**
 * Everything the coach needs to name the skill a spot is asking about.
 *
 * This used to live inside the table screen, which meant nothing could
 * measure how often a lesson's own spot actually turns up without rebuilding
 * it by hand — and a hand-built one leaves fields out. Leaving out `outs` is
 * how a measurement can report that a lesson about draws never produces a
 * draw.
 *
 * @param {object} table
 * @param {object} hero
 * @param {object} ctx  { rng, aggressor: {street: playerId}, opener }
 */
export function snapshotOf(table, hero, { rng, aggressor = {}, opener = null, ranges = null } = {}) {
  const live = table.contestants.filter((p) => !p.isHero).length;
  const toCall = Math.max(0, table.currentBet - hero.committed);
  const pot = table.totalPot;
  const previous = STREETS[Math.max(0, STREETS.indexOf(table.street) - 1)];
  return {
    equity: heroEquity(table, hero, live, rng, ranges),
    toCall,
    pot,
    needed: toCall > 0 ? requiredEquity(toCall, pot) : 0,
    opponents: live,
    spr: spr(table.effectiveStack(hero), pot),
    street: table.street,
    hole: hero.hole.slice(),
    board: table.board.slice(),
    position: hero.position,
    bigBlind: table.bigBlind,
    effectiveStack: table.effectiveStack(hero),
    currentBet: table.currentBet,
    // First in means nobody has voluntarily put money in yet — not merely
    // that nobody has raised. A limper leaves currentBet at the big blind,
    // and treating that as first in would ask the opening chart about a seat
    // it has no opinion on.
    firstIn: table.street === 'preflop' && !table.history.some((h) => h.street === 'preflop'
      && (h.type === 'call' || h.type === 'bet' || h.type === 'raise')),
    raiser: opener,
    wasAggressor: aggressor[previous] === hero.id,
    madeCategory: table.board.length
      ? categoryOf(evaluateHand(hero.hole, table.board, table.variant))
      : CAT.HIGH_CARD,
    outs: table.board.length >= 3 ? outsToImprove(hero.hole, table.board, table.variant) : 0,
  };
}

/**
 * The betting range of a lone opponent, on any postflop street.
 *
 * Exact on the river, sampled before it — 40 independent run-outs per hand,
 * which lands within about a point of a far more expensive reference and
 * takes 70ms. Only where a read is a fair thing to ask: one opponent, a bet
 * to answer, a profile to run, and no wildcard variant.
 */
export function tableReadRange(table, hero, live, toCall) {
  if (toCall <= 0 || live !== 1 || table.board.length < 3) return null;
  if (table.variant && (table.variant.omaha || table.variant.shortDeck)) return null;
  const villain = table.contestants.find((p) => !p.isHero && p.profile);
  if (!villain) return null;
  // The profile they are actually playing, adjustments included. Reading the
  // archetype while the seat plays an adapted version of it would be a read
  // of somebody who is not at the table.
  return readRange(profileAt(table, villain), table.board, 'bet', {
    toCall: 0,
    street: table.street,
    heroIsAggressor: table.lastAggressor ? table.lastAggressor.isHero : false,
    dead: hero.hole,
  });
}

/** How much of the stack the autopilot will pay to keep a hand alive. */
const MAX_SHARE = 0.12;

/**
 * @param {object} table  the live Table
 * @param {object} hero   the hero player
 * @param {object} lesson a LESSON_TABLES entry
 * @param {function} rng
 * @returns {{type: string, amount?: number}}
 */
export function autopilotAction(table, hero, lesson, rng) {
  const legal = table.legalActions(hero);
  const has = (type) => legal.find((a) => a.type === type);
  const toCall = Math.max(0, table.currentBet - hero.committed);
  const reached = STREETS.indexOf(table.street) >= STREETS.indexOf(lesson.street || 'flop');

  // Past the lesson's street there is nothing left to reach, so play properly.
  if (reached) return botAction(table, { ...hero, profile: 'tag' }, rng);

  // The lesson needs the reader to have taken the lead before the flop, so
  // the autopilot takes it — opening when it can and re-raising when it
  // cannot. Only opening produced a continuation-bet spot once in twenty
  // hands, because heads-up the hero is often the one facing the raise.
  if (lesson.autopilot === 'raise-first' && table.street === 'preflop') {
    const raise = has('raise');
    if (raise && toCall <= hero.stack * MAX_SHARE) {
      return { type: 'raise', amount: Math.min(raise.max, Math.max(raise.min, table.bigBlind * 3)) };
    }
  }

  if (!toCall && has('check')) return { type: 'check' };
  const call = has('call');
  if (call && toCall <= Math.max(table.bigBlind * 2, hero.stack * MAX_SHARE)) return { type: 'call' };
  return has('fold') ? { type: 'fold' } : { type: 'check' };
}

/**
 * The hands this opponent would have bet with, captured at the moment they
 * decide.
 *
 * It has to be here and not when the reader replies: by then the bet is paid,
 * the bot owes nothing, and asking it what it would do returns "check" for
 * every candidate. Sixty of sixty were rejected that way, silently, so the
 * first version of this fell back to random cards on every spot.
 *
 * @returns {Array<Array<number>>} the accepted holdings, possibly empty
 */
export function bettingRangeOf(table, villain, rng, { want = 45, cap = 700 } = {}) {
  const real = villain.hole;
  const dead = new Set([...table.board, ...table.players.flatMap((p) => p.hole)]);
  const deck = makeDeck(table.variant.shortDeck).filter((c) => !dead.has(c));
  const holeCards = table.variant.holeCards || 2;
  const kept = [];

  // Sample until enough hands pass, not for a fixed number of tries. A fixed
  // 120 left a tight opponent's range at five or seven hands, below the point
  // where averaging means anything — so nine spots in forty-five quietly fell
  // back to random cards, which is the whole bug this exists to fix.
  for (let i = 0; i < cap && kept.length < want; i++) {
    const draw = shuffle(rng, deck).slice(0, holeCards);
    villain.hole = draw;
    const guess = botAction(table, villain, makeRng(i + 1));
    if (guess.type === 'bet' || guess.type === 'raise') kept.push(draw);
  }
  villain.hole = real;
  return kept;
}

/**
 * What the hero is actually worth here.
 *
 * Against a lone opponent who has bet, this is equity against the hands that
 * opponent would have bet with. Everywhere else — nobody has bet, several
 * players still in, or too few hands passed the filter to average — the plain
 * field equity is the right question and much cheaper.
 */
function heroEquity(table, hero, live, rng, ranges) {
  const toCall = Math.max(0, table.currentBet - hero.committed);
  const range = ranges && ranges[table.street];

  // The range built from every holding, rather than the 45 that a sample
  // happened to keep. That sample was not close: the same river spot priced
  // the hero anywhere from 11.1% to 28.9% depending on its seed, against a
  // true 11.5% over 866 holdings — eighteen points, decided by nothing.
  const read = tableReadRange(table, hero, live, toCall);
  if (read) return equityAgainst(read, hero.hole, table.board);

  if (toCall > 0 && live === 1 && table.board.length >= 3 && range && range.length >= 20) {
    return equityVsHands(hero.hole, table.board, range, { variant: table.variant, rng });
  }
  return equityVsField(hero.hole, table.board, Math.max(1, live), table.variant, rng, 900);
}

/**
 * Play a hand forward until the reader's own decision arrives.
 *
 * The table screen and the reachability test both run this, which is the
 * whole point: the two bugs that made lessons unplayable were both cases of
 * a loop that looked right in one place and was measured somewhere else.
 * Forgetting to record that the autopilot had raised made a continuation-bet
 * spot *definitionally* impossible, and nothing noticed because the
 * measurement kept its own aggressor tally.
 *
 * @param {object} table
 * @param {object} opts
 * @param {object} opts.lesson    a LESSON_TABLES entry
 * @param {function} opts.rng
 * @param {function} opts.isMine  (snapshot, table) => boolean
 * @param {object} opts.state     { aggressor, opener } — mutated as play goes
 * @param {function} [opts.apply] performs the action — defaults to table.act.
 *        The table screen passes its recorder here, because HandRecorder.act
 *        runs the action itself; having the loop also call table.act made
 *        every autopilot move happen twice and the second one was illegal.
 * @param {function} [opts.onAuto]  called with (action, player) for the hero
 * @param {function} [opts.onBot]   called with (action, player) for a bot
 * @returns {{found: boolean, snapshot: object|null}}
 */
export function playUntilMySpot(table, { lesson, rng, isMine, state, apply, onAuto, onBot }) {
  const perform = apply || ((action) => table.act(action));
  let guard = 0;
  while (!table.handOver && guard++ < 120) {
    const actor = table.actor;
    if (!actor) break;

    if (actor.isHero) {
      const snapshot = snapshotOf(table, actor, { rng, ...state });
      if (isMine(snapshot, table)) return { found: true, snapshot };
      const action = autopilotAction(table, actor, lesson, rng);
      noteAggressor(state, table, actor, action);
      if (onAuto) onAuto(action, actor);
      perform(action, actor);
    } else {
      const action = botAction(table, actor, rng);
      captureRange(table, actor, action, state, rng);
      noteAggressor(state, table, actor, action);
      if (onBot) onBot(action, actor);
      perform(action, actor);
    }
  }
  return { found: false, snapshot: null };
}

/** Who took the lead on this street, for whoever asks next street. */
function noteAggressor(state, table, player, action) {
  if (action.type !== 'bet' && action.type !== 'raise') return;
  state.aggressor[table.street] = player.id;
  if (table.street === 'preflop' && !state.opener) state.opener = player.position;
}

/**
 * Stash what this opponent would have bet with, so the reader's next decision
 * can be judged against it. Only heads-up and only after a flop: with several
 * players in, one opponent's range is not what the reader is up against.
 */
export function captureRange(table, player, action, state, rng) {
  if (action.type !== 'bet' && action.type !== 'raise') return;
  if (player.isHero || !player.profile) return;
  if (table.board.length < 3) return;
  if (table.contestants.filter((p) => !p.isHero).length !== 1) return;
  if (!state.ranges) state.ranges = {};
  state.ranges[table.street] = bettingRangeOf(table, player, rng);
}
