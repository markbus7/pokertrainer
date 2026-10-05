/**
 * Plays whole regattas with bots in every seat, the way the table deals them:
 * six players, 1,500 chips, the blind clock in state/regatta.js, short stacks
 * pushing and folding (engine/pushfold.js).
 *
 * What it answers is whether a regatta is a game and an evening's length: that
 * chips are conserved and every one ends with a single winner; that it takes
 * long enough to be worth entering (the hand count) and not so long it is a
 * chore; and that the styles finish about where their play says they should
 * (the calling station and the maniac are the ones a solid player beats).
 *
 * Run: node tools/measure-regatta.mjs [regattas]      Environment: SEED=n
 */
import { createTable } from '../src/js/engine/table.js';
import { botAction, getProfile } from '../src/js/engine/bots.js';
import { makeRng } from '../src/js/core/rng.js';
import { FIELD, START_STACK, blindsFor, placesFor, payouts } from '../src/js/state/regatta.js';

const N = Number(process.argv[2] || 60);
const SEED = Number(process.env.SEED || 20261005);
const rng = makeRng(SEED);
const STYLES = ['pro', 'tag', 'lag', 'station', 'maniac', 'rock'];

function regatta() {
  const order = STYLES.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const table = createTable({
    smallBlind: 25, bigBlind: 50, rng,
    players: order.map((key, i) => ({ id: key, name: key, stack: START_STACK, profile: key })),
  });
  table.pushFold = true;
  table.readerLevel = 1;
  const places = {};
  let hands = 0;
  let leaked = 0;
  while (table.players.filter((p) => p.stack > 0).length > 1 && hands < 500) {
    const b = blindsFor(hands);
    table.smallBlind = b.small;
    table.bigBlind = b.big;
    hands++;
    const alive = table.players.filter((p) => p.stack > 0).length;
    table.startHand();
    const start = Object.fromEntries(table.players.map((p) => [p.id, p.stack + p.committed]));
    let guard = 0;
    while (!table.handOver && guard++ < 400) {
      const actor = table.actor;
      if (!actor) break;
      table.act(botAction(table, actor, rng));
    }
    if (table.players.reduce((s, p) => s + p.stack + p.committed, 0) !== START_STACK * FIELD) leaked++;
    const out = table.players.filter((p) => p.stack <= 0 && start[p.id] > 0 && !places[p.id]).map((p) => ({ id: p.id, stack: start[p.id] }));
    for (const { id, place } of placesFor(alive, out)) places[id] = place;
  }
  const winner = table.players.find((p) => p.stack > 0);
  if (winner && table.players.filter((p) => p.stack > 0).length === 1) places[winner.id] = 1;
  return { places, hands, leaked, done: table.players.filter((p) => p.stack > 0).length === 1 };
}

const results = Array.from({ length: N }, regatta);
const hands = results.map((r) => r.hands).sort((a, b) => a - b);
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
console.log(`${N} regattas, six bots, seed ${SEED}`);
console.log(`hands: average ${avg(hands).toFixed(0)}, median ${hands[Math.floor(N / 2)]}, 90th ${hands[Math.floor(N * 0.9)]}, longest ${hands[N - 1]}`);
console.log(`finished with one winner: ${results.filter((r) => r.done).length} of ${N}; chips leaked in ${results.reduce((s, r) => s + r.leaked, 0)} hands`);
const pay = payouts(1);
console.log('style      avg place   wins   top3   ROI (entry 1, no rake)');
for (const key of STYLES) {
  const ps = results.map((r) => r.places[key] || FIELD);
  const wins = ps.filter((p) => p === 1).length;
  const top3 = ps.filter((p) => p <= 3).length;
  const roi = avg(ps.map((p) => (pay[p - 1] || 0))) - 1;
  console.log(`${key.padEnd(9)} ${avg(ps).toFixed(2).padStart(8)}   ${String(wins).padStart(4)}   ${String(top3).padStart(4)}   ${(roi >= 0 ? '+' : '') + roi.toFixed(2)}`);
}
