/**
 * Measures how the river's six regulars actually play, the way a HUD would see
 * them: the share of hands each puts money into before the flop (VPIP), the
 * share it raises (PFR), and how much of what it plays it raises — the two
 * numbers the Character screen names a player from, and draws them on its map.
 *
 * What it answers is whether REGULARS in data/playerTypes.js is still true
 * after a change to the bots, and whether each style still lands in a box of
 * its own on the map. Paste the printed lines over REGULARS when they move.
 *
 * Run: node tools/measure-styles.mjs [hands]      (default 3000)
 *
 * Environment: SEED=n  a different deal
 */
import { createTable } from '../src/js/engine/table.js';
import { botAction, PROFILES } from '../src/js/engine/bots.js';
import { makeRng } from '../src/js/core/rng.js';
import { playerType } from '../src/js/data/playerTypes.js';

const HANDS = Number(process.argv[2] || 3000);
const rng = makeRng(Number(process.env.SEED || 7));
const STYLES = ['rock', 'tag', 'lag', 'station', 'maniac', 'pro'];
const seen = Object.fromEntries(STYLES.map((k) => [k, { hands: 0, vpip: 0, pfr: 0, bets: 0, calls: 0 }]));

let table = null;
function seat() {
  const order = STYLES.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  table = createTable({ smallBlind: 1, bigBlind: 2, rng, players: order.map((k) => ({ id: k, name: k, stack: 200, profile: k })) });
  table.readerLevel = 1;
}

seat();
for (let h = 0; h < HANDS; h++) {
  // A fresh order now and then, so nobody sits on the button's left all night.
  if (h % 50 === 0) seat();
  for (const p of table.players) if (p.stack < 40) p.stack = 200;
  table.startHand();
  const marked = new Set();
  let guard = 0;
  while (!table.handOver && guard++ < 400) {
    const actor = table.actor;
    if (!actor) break;
    const move = botAction(table, actor, rng);
    const street = table.street;
    table.act(move);
    const s = seen[actor.id];
    if (street === 'preflop' && ['call', 'bet', 'raise'].includes(move.type)) {
      if (!marked.has(`${actor.id}v`)) { s.vpip++; marked.add(`${actor.id}v`); }
      if (move.type !== 'call' && !marked.has(`${actor.id}r`)) { s.pfr++; marked.add(`${actor.id}r`); }
    }
    if (street !== 'preflop') {
      if (move.type === 'bet' || move.type === 'raise') s.bets++;
      if (move.type === 'call') s.calls++;
    }
  }
  for (const k of STYLES) seen[k].hands++;
}

console.log(`${HANDS} hands, the six regulars at one table:\n`);
for (const k of ['rock', 'tag', 'pro', 'lag', 'maniac', 'station']) {
  const s = seen[k];
  const vpip = s.vpip / s.hands;
  const pfr = s.pfr / s.hands;
  const type = playerType({ vpip, pfr });
  console.log(`  { key: '${k}', name: '${PROFILES[k].name}', vpip: ${vpip.toFixed(3)}, pfr: ${pfr.toFixed(3)} },`
    + `   // raises ${Math.round((pfr / vpip) * 100)}% of what it plays, AF ${(s.bets / Math.max(1, s.calls)).toFixed(2)} → ${type.key}`);
}
