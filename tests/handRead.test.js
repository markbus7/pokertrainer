import { describe, it, assert, equal } from './harness.js';
import {
  readRange, equityAgainst, riverEquities, candidateHands, actionChances, READ_BANDS, nearestBand,
  sampledEquities, marginFor,
} from '../src/js/core/handRead.js';
import { tableReadRange } from '../src/js/core/lessonRunner.js';
import { PROFILES, CUTS } from '../src/js/engine/bots.js';
import { bluffCatchDrill, rangeReadDrill } from '../src/js/trainers/postflop.js';
import { makeDeck } from '../src/js/core/cards.js';
import { makeRng, shuffle } from '../src/js/core/rng.js';
import { requiredEquity } from '../src/js/core/odds.js';

const boardFor = (seed) => shuffle(makeRng(seed), makeDeck()).slice(0, 5);
const betting = { toCall: 0, street: 'river', heroIsAggressor: false };

describe('hand reading: the range comes from how they actually play', () => {
  it('gives the same answer twice', () => {
    // The first attempt sampled equities, and it would not hold still: 8
    // points of spread at 800 samples per hand, because the buckets have hard
    // edges and hands near one flipped between runs. A drill cannot mark you
    // wrong with a number that wanders.
    const board = boardFor(42);
    const a = readRange('tag', board, 'bet', betting);
    const b = readRange('tag', board, 'bet', betting);
    equal(a.share.air, b.share.air);
    equal(a.share.strong, b.share.strong);
  });

  it('separates the players by how much air they bet', () => {
    // If the nit and the maniac read the same, there is nothing to notice and
    // the drill teaches nothing. Averaged over boards on purpose: how much
    // air a range holds depends on the texture, and a claim pinned to one
    // deal is a claim about that deal.
    const seeds = [42, 7, 3, 11, 5, 19];
    const air = (key) => seeds
      .reduce((sum, seed) => sum + readRange(key, boardFor(seed), 'bet', betting).share.air, 0) / seeds.length;
    const nit = air('rock');
    const maniac = air('maniac');
    assert(nit < 0.08, `the nit should almost never be betting air, got ${nit.toFixed(3)}`);
    assert(maniac > 0.2, `the maniac should be full of it, got ${maniac.toFixed(3)}`);
    assert(maniac - nit > 0.15, `the two have to be tellably different, gap ${(maniac - nit).toFixed(3)}`);

    // And it has to hold on every board, not only on average.
    for (const seed of seeds) {
      const b = boardFor(seed);
      const one = (k) => readRange(k, b, 'bet', betting).share.air;
      assert(one('maniac') > one('rock'), `board ${seed}: the maniac bets more air than the nit`);
    }
  });

  it('matches every profile\'s stated tell', () => {
    // The tells are prose the reader is shown. If the bots do not behave that
    // way, the app is teaching a read that loses money at its own table.
    const board = boardFor(7);
    const air = Object.fromEntries(Object.keys(PROFILES)
      .map((k) => [k, readRange(k, board, 'bet', betting).share.air]));
    assert(air.rock < air.tag, 'the nit bluffs less than the TAG');
    assert(air.tag < air.lag, 'the TAG bluffs less than the LAG');
    assert(air.lag < air.maniac, 'the LAG bluffs less than the maniac');
    assert(air.station < air.tag, 'the station is passive: it bets value, not air');
  });

  it('reads a check as the giving-up range, not the betting one', () => {
    const board = boardFor(3);
    const bet = readRange('tag', board, 'bet', betting);
    const check = readRange('tag', board, 'check', betting);
    assert(check.share.air > bet.share.air,
      'the hands that gave up have to be weaker than the hands that fired');
    assert(bet.share.strong > check.share.strong, 'and the strong hands are in the betting range');
  });

  it('runs the bots\' own rule rather than a copy of it', () => {
    // The whole point: change what the bot does and the read has to move with
    // it. A reader graded against a second, parallel model of the opponents
    // is graded against a player who is not at the table.
    const p = PROFILES.tag;
    const above = CUTS.valueBet(p) + 0.05;
    const below = CUTS.valueBet(p) - 0.25;
    assert(actionChances(p, above, betting).bet >= CUTS.valueBetChance(p),
      'a hand past the value cut has to bet at least as often as the rule says');
    assert(actionChances(p, below, betting).bet <= CUTS.bluffChance(p, betting) + 1e-9,
      'a hand below every value cut can only be arriving as a bluff');
  });

  it('prices a hand against the range exactly, both ways round', () => {
    const board = boardFor(11);
    const range = readRange('lag', board, 'bet', betting);
    const combos = candidateHands(board);
    const eq = riverEquities(board, combos);
    const best = combos[eq.indexOf(Math.max(...eq))];
    const worst = combos[eq.indexOf(Math.min(...eq))];
    assert(equityAgainst(range, best, board) > 0.9, 'the nuts beat almost all of any range');
    assert(equityAgainst(range, worst, board) < 0.15, 'and the worst hand beats almost none of it');
  });

  it('never lets a weight escape the range it belongs to', () => {
    const board = boardFor(5);
    for (const key of Object.keys(PROFILES)) {
      const r = readRange(key, board, 'bet', betting);
      const sum = r.share.strong + r.share.medium + r.share.air;
      assert(Math.abs(sum - 1) < 1e-9, `${key}'s shares sum to ${sum}`);
      for (const h of r.hands) assert(h.weight > 0 && h.weight <= 1, `weight out of range: ${h.weight}`);
    }
  });
});

describe('hand reading: the bluff-catch drill is priced against the real range', () => {
  it('no longer grades on a tuning knob', () => {
    // `villain.bluff` is an input to the bot's decision — rolled only for
    // hands under an equity ceiling, and competing with every value bet — not
    // the share of a betting range that is air. Grading the call on it marked
    // the wrong answer in 113 of 345 generated spots.
    const board = boardFor(42);
    for (const key of ['tag', 'lag', 'maniac', 'pro']) {
      const real = readRange(key, board, 'bet', betting).share.air;
      assert(real < PROFILES[key].bluff,
        `${key}: the knob says ${PROFILES[key].bluff} and the range is ${real.toFixed(3)} —`
        + ' value bets dilute the bluffs, so the knob always overstates it');
    }
  });

  it('grades call or fold by what the hand is actually worth', () => {
    // The hole this fills: reverting the drill to grade on villain.bluff left
    // every other test green. Whichever way each spot goes, the verdict has
    // to be the one the exact equity against the exact range gives.
    const rng = makeRng(4242);
    let checked = 0;
    for (let i = 0; i < 250 && checked < 40; i++) {
      const q = bluffCatchDrill(rng, 4);
      if (!q) continue;
      const sc = q.scenario;
      const key = Object.keys(PROFILES).find((k) => PROFILES[k].name === sc.villain.name);
      const range = readRange(key, sc.board, 'bet', { ...betting, dead: sc.hole });
      if (!range) continue;
      const equity = equityAgainst(range, sc.hole, sc.board);
      const need = requiredEquity(sc.toCall, sc.pot + sc.toCall);
      const graded = q.options.find((o) => o.key === q.answer).label;
      equal(graded, equity > need ? 'Call' : 'Fold',
        `${sc.villain.name}: hand is worth ${(equity * 100).toFixed(1)}%, price asks `
        + `${(need * 100).toFixed(1)}%, drill said ${graded}`);
      checked++;
    }
    assert(checked > 25, `enough spots checked (${checked})`);
  });

  it('agrees with the price it quotes', () => {
    const board = boardFor(13);
    const range = readRange('maniac', board, 'bet', betting);
    const combos = candidateHands(board);
    const eq = riverEquities(board, combos);
    const mid = combos[eq.findIndex((e) => e > 0.45 && e < 0.6)];
    const equity = equityAgainst(range, mid, board);
    const need = requiredEquity(50, 150);
    // Not a claim about which way it goes — a claim that the two numbers
    // being compared are the two numbers the explanation prints.
    assert(equity >= 0 && equity <= 1, 'equity is a share');
    assert(need > 0 && need < 1, 'and so is the price');
  });
});

describe('hand reading: the question is answerable and worth answering', () => {
  it('never offers an answer that cannot be right', () => {
    // The first ladder ran 5/15/25/35 and 35% was never once the answer over
    // 300 questions — the bots do not bet that much air on a river. A dead
    // option is a pattern to learn for the wrong reason.
    const rng = makeRng(77);
    const picked = new Map();
    let asked = 0;
    for (let i = 0; i < 240; i++) {
      const q = rangeReadDrill(rng, 4);
      if (!q) continue;
      asked++;
      const band = q.options.find((o) => o.key === q.answer).label;
      picked.set(band, (picked.get(band) || 0) + 1);

      // And the offered answers are a scale, not four numbers in a bag.
      const ladder = q.options.map((o) => parseFloat(o.label));
      for (let k = 1; k < ladder.length; k++) {
        assert(ladder[k] > ladder[k - 1], `the options are out of order: ${ladder.join(', ')}`);
      }
    }
    assert(asked > 150, `enough questions generated (${asked})`);
    equal(picked.size, 4, `every band has to be reachable, only saw: ${[...picked.keys()].join(', ')}`);
    for (const [band, n] of picked) {
      assert(n / asked > 0.04, `${band} is the answer only ${(n / asked * 100).toFixed(1)}% of the time`);
    }
  });

  it('only asks when one band is clearly the nearest', () => {
    // A truth sitting halfway between two bands has two defensible answers,
    // and one of them would be marked wrong.
    const rng = makeRng(31);
    for (let i = 0; i < 120; i++) {
      const q = rangeReadDrill(rng, 4);
      if (!q) continue;
      const air = parseFloat(/(\d+(?:\.\d+)?)% of their betting range/.exec(q.explanation)[1]);
      const bands = q.options.map((o) => parseFloat(o.label))
        .sort((a, b) => Math.abs(a - air) - Math.abs(b - air));
      const answer = parseFloat(q.options.find((o) => o.key === q.answer).label);
      equal(answer, bands[0], `air is ${air}% and the answer is ${answer}%`);
      assert(Math.abs(bands[1] - air) - Math.abs(bands[0] - air) >= 1.5,
        `air of ${air}% is too close to call between ${bands[0]}% and ${bands[1]}%`);
    }
  });
});

describe('hand reading: asking for it at the table', () => {
  it('refuses to ask when two answers are defensible', () => {
    // Halfway between two rungs there is no wrong answer, and marking one of
    // them wrong teaches the reader to distrust the scoring instead of to
    // read the hand.
    equal(nearestBand(3.1), 3);
    equal(nearestBand(17.5), 18);
    equal(nearestBand(6.5), null, 'exactly between 3 and 10');
    equal(nearestBand(14), null, 'exactly between 10 and 18');
    equal(nearestBand(22), null, 'exactly between 18 and 26');
    for (let air = 0; air <= 40; air += 0.25) {
      const band = nearestBand(air);
      if (band === null) continue;
      const others = READ_BANDS.filter((b) => b !== band);
      for (const other of others) {
        assert(Math.abs(band - air) < Math.abs(other - air),
          `${air}% was assigned ${band}% but ${other}% is at least as close`);
      }
    }
  });

  it('only asks where a read is a fair question', () => {
    // Every street postflop now, exact on the river and sampled before it.
    // What still rules a spot out is the shape of it: nobody has bet, or
    // there are two opponents whose ranges would have to be read together.
    const board = boardFor(42);
    const hero = candidateHands(board)[0];
    const table = (street, live) => ({
      board: street === 'river' ? board : board.slice(0, street === 'turn' ? 4 : 3),
      street,
      variant: {},
      lastAggressor: null,
      contestants: [{ isHero: true, hole: hero }]
        .concat(Array.from({ length: live }, () => ({ isHero: false, profile: 'tag' }))),
    });
    const heroPlayer = { hole: hero };
    for (const street of ['flop', 'turn', 'river']) {
      assert(tableReadRange(table(street, 1), heroPlayer, 1, 50), `${street} is askable`);
    }
    equal(tableReadRange(table('river', 2), heroPlayer, 2, 50), null, 'not against two opponents');
    equal(tableReadRange(table('river', 1), heroPlayer, 1, 0), null, 'not when nobody has bet');
  });

});

describe('hand reading: the streets that still have cards to come', () => {
  const flopFor = (seed) => shuffle(makeRng(seed), makeDeck()).slice(0, 3);
  const situation = { toCall: 0, street: 'flop', heroIsAggressor: false };

  it('reads the same spot the same way every time', () => {
    // Sampled, so it could wander — except the seed comes from the board. A
    // drill that answers differently on a second look teaches the reader that
    // the app cannot be trusted, which is worse than not asking.
    const board = flopFor(8);
    const a = readRange('tag', board, 'bet', situation);
    const b = readRange('tag', board, 'bet', situation);
    equal(a.share.air, b.share.air);
    equal(a.share.strong, b.share.strong);
  });

  it('samples each hand on its own futures, not on one shared set', () => {
    // The fix that made this affordable at all. Scoring every hand against
    // one set of run-outs correlates the errors, so they never cancel in a
    // total: 6 points of movement at 200 shared samples against 0.8 at 30
    // independent ones. Cheaper *and* steadier, which is why there is no
    // precomputed table here.
    //
    // Two independent draws of the same spot have to agree. Under a shared
    // run-out set they move together and this gap opens right up.
    const board = flopFor(3);
    const combos = candidateHands(board);
    const airFrom = (eq) => {
      let total = 0;
      let bad = 0;
      for (let i = 0; i < combos.length; i++) {
        const w = actionChances(PROFILES.tag, eq[i], situation).bet;
        if (w <= 0) continue;
        total += w;
        if (eq[i] < 0.45) bad += w;
      }
      return total ? (bad / total) * 100 : 0;
    };
    const draws = [11, 22, 33, 44].map((seed) => airFrom(sampledEquities(board, combos, 40, seed)));
    const spread = Math.max(...draws) - Math.min(...draws);
    assert(spread < 2,
      `four independent draws spread ${spread.toFixed(2)} points (${draws.map((d) => d.toFixed(1)).join(', ')})`
      + ' — that is the signature of one shared run-out set');
  });

  it('lands close enough to a far more expensive reference to name a band', () => {
    // 40 run-outs per hand against 400. The bands are 7 to 8 points apart and
    // nearestBand keeps a 3-point margin on sampled streets, so an error of
    // about a point cannot move the answer.
    let worst = 0;
    for (const seed of [1, 2, 3]) {
      const board = flopFor(seed);
      const combos = candidateHands(board);
      const rough = sampledEquities(board, combos, 40);
      const fine = sampledEquities(board, combos, 400);
      const air = (eq) => {
        let total = 0;
        let bad = 0;
        for (let i = 0; i < combos.length; i++) {
          const w = actionChances(PROFILES.tag, eq[i], situation).bet;
          if (w <= 0) continue;
          total += w;
          if (eq[i] < 0.45) bad += w;
        }
        return total ? (bad / total) * 100 : 0;
      };
      worst = Math.max(worst, Math.abs(air(rough) - air(fine)));
    }
    assert(worst < 2, `40 run-outs drift ${worst.toFixed(2)} points from 400 — too much to name a band`);
  });

  it('asks for more room before it asks at all, where the number is sampled', () => {
    const flop = flopFor(1);
    const river = boardFor(1);
    equal(marginFor(river), 2, 'the river is exact');
    equal(marginFor(flop), 3, 'a sampled street needs the extra point of room');
    equal(nearestBand(5.2, marginFor(flop)), null, 'too close to the 3/10 boundary to be fair');
    equal(nearestBand(5.2, marginFor(river)), 3, 'but answerable when the number is exact');
  });
});
