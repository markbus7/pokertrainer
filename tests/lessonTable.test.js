/**
 * A lesson that never asks you anything is not a lesson.
 *
 * These pin the property that broke twice while this was being built, both
 * times silently: a lesson table dealt hand after hand and handed the reader
 * nothing, because the spot it was waiting for could not occur. Once because
 * the autopilot folded before the flop, and once because it forgot to record
 * that it had raised — which makes a continuation bet definitionally
 * impossible, since a continuation bet is a bet by the preflop raiser.
 */

import { describe, it, assert, equal } from './harness.js';
import { Table, STREETS } from '../src/js/engine/table.js';
import { botAction, pickOpponents, getProfile } from '../src/js/engine/bots.js';
import { playUntilMySpot } from '../src/js/core/lessonRunner.js';
import { conceptOf } from '../src/js/core/spotConcept.js';
import { LESSON_TABLES, lessonTable, playableModules } from '../src/js/data/lessonTables.js';
import { MODULE_IDS } from '../src/js/data/curriculum.js';
import { makeRng } from '../src/js/core/rng.js';

/** Build the table a lesson describes, the way the screen builds it. */
function tableFor(cfg, rng) {
  const bots = pickOpponents(cfg.seats - 1, rng);
  return new Table({
    smallBlind: 1,
    bigBlind: 2,
    rng,
    lastStreet: cfg.lastStreet,
    players: [
      { id: 'hero', name: 'You', stack: 200, isHero: true },
      ...bots.map((k, i) => ({ id: `b${i}`, name: getProfile(k).name, stack: 200, profile: k })),
    ],
  });
}

/** How many hands before this lesson hands the reader a decision. */
function handsUntilAsked(cfg, seed, maxHands = 120) {
  const rng = makeRng(seed);
  const table = tableFor(cfg, rng);
  const isMine = (snap, t) => (cfg.ask === 'name-hand'
    ? t.board.length === 5
    : !cfg.concept || conceptOf(snap).id === cfg.concept);

  for (let hand = 1; hand <= maxHands; hand++) {
    if (table.players.filter((p) => p.stack > 0).length < 2 || table.players[0].stack <= 0) {
      for (const p of table.players) p.stack = 200;
    }
    table.startHand();
    const state = { aggressor: {}, opener: null };
    const { found } = playUntilMySpot(table, { lesson: cfg, rng, isMine, state });
    if (found) return hand;
    // Settle whatever is left so the next hand can start.
    let guard = 0;
    while (!table.handOver && guard++ < 120) {
      const actor = table.actor;
      if (!actor) break;
      table.act(botAction(table, actor, rng));
    }
  }
  return Infinity;
}

describe('lesson tables: every lesson actually asks you something', () => {
  it('reaches its own spot from every starting seed', () => {
    for (const id of playableModules()) {
      const cfg = lessonTable(id);
      const waits = [0, 1, 2, 3, 4].map((seed) => handsUntilAsked(cfg, 100 + seed));
      const never = waits.filter((w) => w === Infinity).length;
      assert(never === 0,
        `${id}: ${never} of 5 sessions never asked the reader anything (${waits.join(', ')})`);
      const worst = Math.max(...waits);
      assert(worst <= 120,
        `${id}: worst case ${worst} hands is more than a reader will sit through`);
    }
  });

  it('holds a lesson to the table it describes', () => {
    for (const id of playableModules()) {
      const cfg = lessonTable(id);
      assert(cfg.seats >= 2 && cfg.seats <= 6, `${id}: ${cfg.seats} seats`);
      assert(STREETS.includes(cfg.lastStreet), `${id}: unknown last street ${cfg.lastStreet}`);
      assert(cfg.simplified && cfg.simplified.length > 20,
        `${id}: must say what it simplified away`);
      // A concept has to be one the tagger can actually produce, or the table
      // waits for something that never comes.
      if (cfg.concept) assert(MODULE_IDS.includes(cfg.concept), `${id}: unknown concept ${cfg.concept}`);
    }
  });

  it('names the modules that have no table rather than faking one', () => {
    for (const id of MODULE_IDS) {
      assert(id in LESSON_TABLES, `${id} has no entry — every module must be decided about`);
    }
    equal(lessonTable('icm'), null, 'ICM is a tournament idea and this is a cash table');
    equal(lessonTable('bankroll'), null, 'the Bankroll Challenge already is that lesson');
  });
});

describe('lesson tables: the hand stops where the lesson does', () => {
  it('ends on the configured street and still deals a result', () => {
    for (const last of STREETS) {
      const rng = makeRng(9);
      const table = tableFor({ seats: 3, lastStreet: last }, rng);
      table.startHand();
      let guard = 0;
      while (!table.handOver && guard++ < 120) {
        const legal = table.legalActions(table.actor);
        const pick = legal.find((a) => a.type === 'check') || legal.find((a) => a.type === 'call');
        table.act({ type: pick.type });
      }
      assert(table.result, `${last}: no result`);
      // Stopping early still runs the board out, so there is always something
      // to show for the hand rather than two cards and no answer.
      equal(table.board.length, 5, `${last}: board was left unfinished`);
    }
  });
});
