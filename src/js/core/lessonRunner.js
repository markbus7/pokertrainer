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

import { botAction } from '../engine/bots.js';
import { STREETS } from '../engine/table.js';
import { equityVsField, outsToImprove } from './equity.js';
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
export function snapshotOf(table, hero, { rng, aggressor = {}, opener = null } = {}) {
  const live = table.contestants.filter((p) => !p.isHero).length;
  const toCall = Math.max(0, table.currentBet - hero.committed);
  const pot = table.totalPot;
  const previous = STREETS[Math.max(0, STREETS.indexOf(table.street) - 1)];
  return {
    equity: equityVsField(hero.hole, table.board, Math.max(1, live), table.variant, rng, 900),
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
