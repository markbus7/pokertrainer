/**
 * Deals bot-only hands (no hero) and reports how postflop action actually
 * behaves in aggregate: pot size, and how often each street gets bet given
 * the street before it was bet and called.
 *
 * This is what caught the bug fixed in engine/bots.js: the checked-to
 * betting decision measured its equity against a literally random field
 * (equityVsField), which is on average far weaker than the players who
 * actually stuck around — the same mistake equityVsBettors already existed
 * to fix on the calling side. That understated field made continuing to bet
 * look good more and more often as a hand ran deeper into a street with
 * fewer opponents left, so measured turn barrels fired MORE often than the
 * flop c-bet that started the line (81% vs 67%), not less. Before any fix:
 * ~65bb average pot once a flop was seen. After (equity read against a
 * realistic continuing range that narrows further each street it survives,
 * decayed bluff/thin-value continuation, trimmed bet sizing): ~48bb, and a
 * barrel shape that finally decays street over street instead of climbing.
 *
 * Run: node tools/measure-postflop.mjs [hands]
 */
import { Table } from '../src/js/engine/table.js';
import { botAction, pickOpponents } from '../src/js/engine/bots.js';
import { makeRng } from '../src/js/core/rng.js';

const HANDS = Number(process.argv[2] || 20000);
const rng = makeRng(12345);
const bigBlind = 2;
const streets = ['flop', 'turn', 'river'];

let handsPlayed = 0;
let handsReachingFlop = 0;
let sumPotBB = 0;
let sumPotBBFlopSeen = 0;
let sumPotAtFlop = 0;
let potAtFlopCount = 0;
let betsAndRaisesTotal = 0;
let actionsTotal = 0;

let flopBetAndCalled = 0;
let turnBetAndCalledGivenFlop = 0;
const betEvents = { flop: 0, turn: 0, river: 0 };
const noteByStreet = { flop: {}, turn: {}, river: {} };
const sizingSum = { flop: 0, turn: 0, river: 0 };
const sizingCount = { flop: 0, turn: 0, river: 0 };
const raiseCount = { flop: 0, turn: 0, river: 0 };
const callCount = { flop: 0, turn: 0, river: 0 };

for (let h = 0; h < HANDS; h++) {
  const profiles = pickOpponents(6, rng);
  const table = new Table({
    smallBlind: 1, bigBlind, rng,
    players: profiles.map((p, i) => ({ id: `p${i}`, name: p, stack: 200, profile: p })),
  });
  table.startHand();

  let guard = 0;
  const streetSeen = { flop: false, turn: false, river: false };
  const streetBetThisHand = { flop: false, turn: false, river: false };
  const streetCalledThisHand = { flop: false, turn: false, river: false };

  while (!table.handOver && guard++ < 80) {
    const actor = table.actor;
    if (!actor) break;
    const street = table.street;
    const facingBet = table.currentBet - actor.committed > 0;
    const potBefore = table.totalPot;
    if (street === 'flop' && !streetSeen.flop) { sumPotAtFlop += potBefore / bigBlind; potAtFlopCount++; }
    if (streets.includes(street)) streetSeen[street] = true;

    const action = botAction(table, actor, rng);
    actionsTotal++;
    if (action.type === 'bet' || action.type === 'raise') {
      betsAndRaisesTotal++;
      if (streets.includes(street)) streetBetThisHand[street] = true;
      if (streets.includes(street) && !facingBet) {
        const bucket = noteByStreet[street];
        bucket[action.note] = (bucket[action.note] || 0) + 1;
        if (potBefore > 0 && action.amount) {
          sizingSum[street] += action.amount / potBefore;
          sizingCount[street]++;
        }
      }
      if (action.type === 'raise' && facingBet && streets.includes(street)) raiseCount[street]++;
    }
    if (action.type === 'call' && facingBet && streets.includes(street)) callCount[street]++;
    if (action.type === 'call' && streets.includes(street) && streetBetThisHand[street]) {
      streetCalledThisHand[street] = true;
    }
    table.act(action);
  }

  handsPlayed++;
  if (!table.result) continue;
  const potBB = table.result.pots.reduce((s, p) => s + p.amount, 0) / bigBlind;
  sumPotBB += potBB;
  if (!streetSeen.flop) continue;

  handsReachingFlop++;
  sumPotBBFlopSeen += potBB;
  if (!streetBetThisHand.flop) continue;
  betEvents.flop++;
  if (!streetCalledThisHand.flop || !streetSeen.turn) continue;
  flopBetAndCalled++;
  if (!streetBetThisHand.turn) continue;
  betEvents.turn++;
  if (!streetCalledThisHand.turn || !streetSeen.river) continue;
  turnBetAndCalledGivenFlop++;
  if (streetBetThisHand.river) betEvents.river++;
}

console.log(`Hands simulated: ${handsPlayed}`);
console.log(`Average final pot (all hands): ${(sumPotBB / handsPlayed).toFixed(2)} BB`);
console.log(`Average pot at the moment the flop is dealt: ${(sumPotAtFlop / potAtFlopCount).toFixed(2)} BB`);
console.log(`Hands reaching flop: ${handsReachingFlop} (${(100 * handsReachingFlop / handsPlayed).toFixed(1)}%)`);
console.log(`Average final pot (flop seen): ${(sumPotBBFlopSeen / handsReachingFlop).toFixed(2)} BB`);
console.log(`Actions per hand (avg): ${(actionsTotal / handsPlayed).toFixed(2)}, of which bet/raise: ${(betsAndRaisesTotal / handsPlayed).toFixed(2)}`);
console.log('');
console.log('Continuation ("barrel") frequency, conditional on the previous street being bet AND called:');
console.log(`  flop bet given flop reached:    ${betEvents.flop} / ${handsReachingFlop} = ${(100 * betEvents.flop / handsReachingFlop).toFixed(1)}%`);
console.log(`  turn bet given flop bet+called: ${betEvents.turn} / ${flopBetAndCalled} = ${(100 * betEvents.turn / flopBetAndCalled).toFixed(1)}%`);
console.log(`  river bet given turn bet+called: ${betEvents.river} / ${turnBetAndCalledGivenFlop} = ${(100 * betEvents.river / turnBetAndCalledGivenFlop).toFixed(1)}%`);
console.log('');
console.log('Which decision path drove a bet into a check, by street:');
for (const street of streets) console.log(`  ${street}:`, JSON.stringify(noteByStreet[street]));
console.log('');
console.log('Average opening-bet size as a fraction of the pot, by street:');
for (const street of streets) {
  console.log(`  ${street}: ${(sizingSum[street] / sizingCount[street]).toFixed(2)}x pot (n=${sizingCount[street]})`);
}
console.log('');
console.log('Raise-vs-call split when facing a bet, by street:');
for (const street of streets) {
  const total = raiseCount[street] + callCount[street];
  console.log(`  ${street}: raise ${raiseCount[street]} / call ${callCount[street]} = ${total ? (100 * raiseCount[street] / total).toFixed(1) : '—'}% raised`);
}
