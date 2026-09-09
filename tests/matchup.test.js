import { describe, it, assert, equal, close } from './harness.js';
import { MATCHUPS, ANCHORS, DRILLABLE_SHAPES, matchupOf, buildMatchup } from '../src/js/core/matchup.js';
import { equityVs } from '../src/js/core/equity.js';
import { equityVsRange } from '../src/js/core/equity.js';
import { parseCards, expandHandKey } from '../src/js/core/cards.js';
import { makeRng } from '../src/js/core/rng.js';
import { VS_RANGE, RANGE_WIDTH, RANGE_POSITIONS } from '../src/js/data/rangeEquity.js';
import { HAND_STRENGTH } from '../src/js/data/handStrength.js';
import { RFI, parseRange, rangePercent, CHARTS, BOUNDARY_ROWS, rowBoundary } from '../src/js/data/ranges.js';
import { matchupEquityDrill, rangeEquityDrill, chartBoundaryDrill } from '../src/js/trainers/preflop.js';
import { percentDistractors } from '../src/js/trainers/helpers.js';

const hands = (a, b) => [parseCards(a), parseCards(b)];

/** Play a shape many times and report what the engine actually pays it. */
function sample(shapeId, rng, n = 260) {
  const out = [];
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const built = buildMatchup(rng, shapeId);
    if (!built) continue;
    const found = matchupOf(built[0], built[1]);
    if (!found || found.shape.id !== shapeId) continue;
    const hero = found.favourite === 0 ? built[0] : built[1];
    const villain = found.favourite === 0 ? built[1] : built[0];
    out.push(equityVs(hero, [villain], [], { trials: 2500, rng }));
  }
  out.sort((a, b) => a - b);
  return out;
}

describe('matchup: naming the shape', () => {
  it('recognises each shape from the cards alone', () => {
    const cases = [
      ['8h8d', 'AsKc', 'pair-vs-overs', 0],
      ['AsKc', '8h8d', 'pair-vs-overs', 1],
      ['ThTd', '7s6c', 'pair-vs-unders', 0],
      ['8h8d', 'As5c', 'pair-vs-split', 0],
      ['AhAd', '8s8c', 'pair-over-pair', 0],
      ['8s8c', 'AhAd', 'pair-over-pair', 1],
      ['AhKd', 'AsQc', 'domination', 0],
      ['AsQc', 'AhKd', 'domination', 1],
      ['AhKd', 'QsJc', 'overs-vs-unders', 0],
    ];
    for (const [a, b, id, favourite] of cases) {
      const got = matchupOf(...hands(a, b));
      assert(got, `${a} vs ${b} should make a shape`);
      equal(got.shape.id, id, `${a} vs ${b}`);
      equal(got.favourite, favourite, `${a} vs ${b}: which side the figure describes`);
    }
  });

  it('keeps the same pair on both sides out of the pair-over-pair shape', () => {
    // Two players can hold 8-8 at once — four distinct cards, one rank. Read
    // as "the bigger pair", it quoted 81% for what is almost always a split.
    const got = matchupOf(...hands('8h8d', '8s8c'));
    equal(got.shape.id, 'same-pair');
    assert(!DRILLABLE_SHAPES.includes('same-pair'), 'and it is never drilled');
  });

  it('declines to name a matchup that has no shape', () => {
    equal(matchupOf(...hands('Kh8d', 'Qs9c')), null, 'interleaved ranks');
    equal(matchupOf(...hands('AhKd', 'AsKc')), null, 'the same two ranks');
  });

  it('always names the favourite, never the underdog', () => {
    const rng = makeRng(808);
    for (const id of DRILLABLE_SHAPES) {
      const built = buildMatchup(rng, id);
      const found = matchupOf(built[0], built[1]);
      const hero = found.favourite === 0 ? built[0] : built[1];
      const villain = found.favourite === 0 ? built[1] : built[0];
      const equity = equityVs(hero, [villain], [], { trials: 4000, rng });
      assert(equity >= 0.49, `${id}: the named side wins ${(equity * 100).toFixed(0)}%, so it is not the favourite`);
    }
  });
});

describe('matchup: the numbers it teaches', () => {
  it('quotes a typical figure the engine agrees with', () => {
    // The whole point of the shapes is that the number is trustworthy. If a
    // taught figure drifts from what the engine pays, the lesson is wrong.
    const rng = makeRng(4242);
    for (const id of DRILLABLE_SHAPES) {
      const eq = sample(id, rng);
      const mean = eq.reduce((a, b) => a + b, 0) / eq.length;
      close(MATCHUPS[id].typical, mean, 0.025,
        `${id}: teaches ${(MATCHUPS[id].typical * 100).toFixed(0)}%, engine pays ${(mean * 100).toFixed(1)}%`);
    }
  });

  it('publishes a spread that really holds most of the shape', () => {
    const rng = makeRng(1234);
    for (const id of DRILLABLE_SHAPES) {
      const eq = sample(id, rng);
      const [low, high] = MATCHUPS[id].spread;
      const inside = eq.filter((e) => e >= low - 0.005 && e <= high + 0.005).length / eq.length;
      assert(inside > 0.8, `${id}: only ${(inside * 100).toFixed(0)}% of instances fall inside ${(low * 100).toFixed(0)}-${(high * 100).toFixed(0)}%`);
      assert(low < MATCHUPS[id].typical && MATCHUPS[id].typical < high, `${id}: typical sits inside its own spread`);
    }
  });

  it('offers five anchors, coarsest first', () => {
    equal(ANCHORS.length, 5);
    const values = ANCHORS.map((id) => MATCHUPS[id].typical);
    for (let i = 1; i < values.length; i++) {
      assert(values[i] > values[i - 1], `anchors climb: ${ANCHORS[i]} after ${ANCHORS[i - 1]}`);
    }
    for (const id of ANCHORS) assert(MATCHUPS[id], `${id} is a real shape`);
  });
});

describe('matchup: building a spot to order', () => {
  it('builds the shape it was asked for, every time', () => {
    const rng = makeRng(99);
    for (const id of DRILLABLE_SHAPES) {
      let built = 0;
      for (let i = 0; i < 200; i++) {
        const pair = buildMatchup(rng, id);
        if (!pair) continue;
        equal(new Set([...pair[0], ...pair[1]]).size, 4, `${id}: four distinct cards`);
        const found = matchupOf(pair[0], pair[1]);
        assert(found && found.shape.id === id, `${id}: built ${found ? found.shape.id : 'nothing'} instead`);
        built++;
      }
      assert(built > 150, `${id}: built ${built} of 200 attempts`);
    }
  });

  it('gives domination a kicker gap worth teaching', () => {
    // A-5 against A-4 is a coin toss wearing domination's clothes: it would
    // teach 71% for a spot the engine pays 56%.
    const rng = makeRng(31);
    for (let i = 0; i < 120; i++) {
      const built = buildMatchup(rng, 'domination');
      if (!built) continue;
      const ranks = (h) => h.map((c) => (c >> 2) + 2).sort((a, b) => b - a);
      const a = ranks(built[0]);
      const b = ranks(built[1]);
      const shared = a.find((r) => b.includes(r));
      const gap = Math.abs(a.find((r) => r !== shared) - b.find((r) => r !== shared));
      assert(gap >= 3, `kicker gap of ${gap} is too small to demonstrate domination`);
    }
  });
});

describe('matchup: the lesson agrees with the engine', () => {
  it('quotes an example that really is worth what the row claims', () => {
    // The lesson's table is the thing a reader will actually memorise, so
    // every example in it is played out here. A row whose example is far
    // from its headline figure teaches a number that will not survive a
    // real table.
    const rows = [
      ['pair-vs-overs', '8h8d', 'AsKc', 0.53],
      ['overs-vs-unders', 'AhKd', 'QsJc', 0.65],
      ['domination', 'AhKd', 'AsQc', 0.71],
      ['pair-over-pair', 'QhQd', '8s8c', 0.81],
      ['pair-vs-unders', 'ThTd', '7s6c', 0.84],
    ];
    const rng = makeRng(606);
    for (const [id, a, b, quoted] of rows) {
      const [hero, villain] = hands(a, b);
      const got = matchupOf(hero, villain);
      equal(got.shape.id, id, `${a} vs ${b} is the row it illustrates`);
      equal(got.favourite, 0, `${a} is the side the row quotes`);
      equal(MATCHUPS[id].typical, quoted, `${id}: the lesson and the shape quote the same figure`);
      const actual = equityVs(hero, [villain], [], { trials: 30000, rng });
      close(actual, quoted, 0.04,
        `${a} vs ${b} pays ${(actual * 100).toFixed(1)}% but the lesson says ${(quoted * 100).toFixed(0)}%`);
    }
  });
});

describe('range equity: the number that actually decides', () => {
  it('agrees with the app\'s own equity engine', () => {
    const rng = makeRng(31337);
    let worst = 0;
    for (const pos of ['UTG', 'BTN']) {
      const combos = [...parseRange(RFI[pos])].flatMap((k) => expandHandKey(k));
      for (const key of ['AA', 'AJo', 'KQo', 'A5s', '99', 'JTs', '72o']) {
        const live = equityVsRange(expandHandKey(key)[0], combos, [], { trials: 20000, rng }).equity;
        worst = Math.max(worst, Math.abs(live - VS_RANGE[pos][key]));
      }
    }
    assert(worst < 0.02, `worst disagreement ${(worst * 100).toFixed(1)} points`);
  });

  it('never makes a hand stronger by narrowing the field', () => {
    // A tighter range is a better range, so equity against it can only fall.
    // A hand that gained would mean the table was generated wrong.
    for (const pos of RANGE_POSITIONS) {
      for (const [key, random] of Object.entries(HAND_STRENGTH)) {
        assert(VS_RANGE[pos][key] <= random + 0.01,
          `${key} wins ${(VS_RANGE[pos][key] * 100).toFixed(0)}% against ${pos} but only ${(random * 100).toFixed(0)}% against random cards`);
      }
    }
  });

  it('costs the middling hands far more than the strong ones', () => {
    // This is the claim the lesson makes, so it is the claim to pin.
    const drop = (k) => HAND_STRENGTH[k] - VS_RANGE.UTG[k];
    assert(drop('AA') < 0.05, `aces lose ${(drop('AA') * 100).toFixed(0)} points`);
    assert(drop('KQo') > 0.12, `K-Q loses only ${(drop('KQo') * 100).toFixed(0)} points`);
    assert(drop('KQo') > drop('AA') * 3, 'K-Q pays several times what aces pay');
    assert(VS_RANGE.UTG.KQo < 0.5, 'K-Q is an underdog against an early raiser');
    assert(VS_RANGE.UTG.AA > 0.8, 'aces are not');
  });

  it('knows how wide each published range is', () => {
    for (const pos of RANGE_POSITIONS) {
      const real = Math.round(rangePercent(parseRange(RFI[pos])) * 100);
      equal(RANGE_WIDTH[pos], real, `${pos} width`);
      equal(Object.keys(VS_RANGE[pos]).length, 169, `${pos} covers every starting hand`);
    }
  });
});

describe('preflop equity drills: how the answer is given', () => {
  const ask = (difficulty, n = 120) => {
    const rng = makeRng(515);
    const out = [];
    for (let i = 0; i < n; i++) {
      for (const gen of [matchupEquityDrill, rangeEquityDrill]) {
        const q = gen(rng, difficulty);
        if (q) out.push(q);
      }
    }
    return out;
  };

  it('offers a choice rather than an empty box, until the shapes are fluent', () => {
    // Every other typed drill names its method in the question — "use the
    // rule of 4" — so typing there is arithmetic. These two hand over two
    // cards, and typing a number you have no way to derive is guessing.
    for (const q of ask(2)) {
      assert(!q.entry, `difficulty 2 should be a choice, got a typed box: ${q.question.slice(0, 60)}`);
      assert(q.options.length >= 3, `only ${q.options.length} options`);
    }
    for (const q of ask(5, 40)) {
      assert(q.entry, 'difficulty 5 should ask for the number itself');
      equal(q.entry.unit, '%');
    }
  });

  it('never lets the answer be found by crossing off both ends', () => {
    // The distractors used to be placed one side at a time, and three of them
    // could not fit on one side — so the answer was always one of the middle
    // two and could be found without knowing any poker.
    const seats = [0, 0, 0, 0];
    const questions = ask(2);
    for (const q of questions) {
      const values = q.options.map((o) => parseFloat(o.label));
      const sorted = [...values].every((v, i) => i === 0 || values[i - 1] <= v);
      assert(sorted, `options are not in order: ${values.join(', ')}`);
      seats[values.indexOf(parseFloat(q.options.find((o) => o.key === q.answer).label))] += 1;
    }
    for (let i = 0; i < 4; i++) {
      const share = seats[i] / questions.length;
      assert(share > 0.08, `the answer lands in position ${i} only ${(share * 100).toFixed(0)}% of the time`);
    }
  });

  it('keeps every option far enough apart to be a real choice', () => {
    for (const q of ask(2)) {
      const values = q.options.map((o) => parseFloat(o.label));
      for (let i = 1; i < values.length; i++) {
        assert(values[i] - values[i - 1] >= 8,
          `${values[i - 1]}% and ${values[i]}% are too close to tell apart`);
      }
    }
  });

  it('spreads distractors on both sides, and on one side when asked', () => {
    const rng = makeRng(4);
    let allBelow = 0;
    let allAbove = 0;
    for (let i = 0; i < 400; i++) {
      const got = percentDistractors(rng, 50, 3, 12, 5);
      equal(got.length, 3, 'always three distractors away from the edges');
      if (got.every((v) => v < 50)) allBelow++;
      if (got.every((v) => v > 50)) allAbove++;
    }
    assert(allBelow > 20, `three distractors below the answer happened ${allBelow} times in 400`);
    assert(allAbove > 20, `three distractors above the answer happened ${allAbove} times in 400`);
  });

  it('still keeps distractors clear of the true answer near the ends of the scale', () => {
    const rng = makeRng(9);
    for (const truth of [3, 8, 50, 92, 96]) {
      for (let i = 0; i < 60; i++) {
        for (const v of percentDistractors(rng, truth, 3, 12, 5)) {
          assert(v >= 2 && v <= 97, `${v}% is off the scale`);
          assert(Math.abs(v - truth) >= 5, `${v}% is too close to the true ${truth}%`);
        }
      }
    }
  });
});

describe('chart boundaries: the form a chart is actually carried in', () => {
  it('finds where each row of the grid stops', () => {
    // Read straight off the published charts, so the drill and the Charts
    // tab can never disagree about where a row ends.
    equal(rowBoundary(CHARTS.rfi.UTG, 'K', true), 'K9s');
    equal(rowBoundary(CHARTS.rfi.CO, 'K', true), 'K5s');
    equal(rowBoundary(CHARTS.rfi.BTN, 'K', true), 'K2s');
    equal(rowBoundary(CHARTS.rfi.UTG, 'A', false), 'AJo');
    equal(rowBoundary(CHARTS.rfi.UTG, 'Q', false), null, 'a row nobody opens has no boundary');
  });

  it('refuses to name a boundary for a row with a hole in it', () => {
    // "K9s and K5s but nothing between" has no single weakest hand worth
    // teaching, and quoting one would be a lie about the chart.
    const gappy = new Set(['K9s', 'K5s', 'K4s', 'K3s', 'K2s']);
    equal(rowBoundary(gappy, 'K', true), null);
    const solid = new Set(['K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'KTs', 'KJs', 'KQs']);
    equal(rowBoundary(solid, 'K', true), 'K2s');
  });

  it('asks for the boundary and offers the rungs around it, in order', () => {
    const rng = makeRng(88);
    let asked = 0;
    for (let i = 0; i < 200; i++) {
      const q = chartBoundaryDrill(rng, 2);
      if (!q) continue;
      asked++;
      const correct = q.options.find((o) => o.key === q.answer).label;
      const chart = CHARTS.rfi[q.scenario.position];
      const row = BOUNDARY_ROWS.find((r) => r.high === correct[0] && r.suited === (correct[2] === 's'));
      equal(correct, rowBoundary(chart, row.high, row.suited), `${q.scenario.position} ${row.id}`);

      // Every option is a rung of the same row, strongest first: the
      // question is "how far down", not "which of these unrelated hands".
      const RANKS = '23456789TJQKA';
      const rungs = q.options.map((o) => {
        assert(o.label[0] === correct[0] && o.label[2] === correct[2],
          `${o.label} is not on the same row as ${correct}`);
        return RANKS.indexOf(o.label[1]);
      });
      for (let k = 1; k < rungs.length; k++) {
        assert(rungs[k] < rungs[k - 1], `options are not in row order: ${q.options.map((o) => o.label).join(' ')}`);
      }
      equal(new Set(rungs).size, rungs.length, 'no repeated rung');
    }
    assert(asked > 150, `enough questions produced (${asked})`);
  });

  it('teaches the row across every seat, not just this seat\'s answer', () => {
    const rng = makeRng(12);
    const q = chartBoundaryDrill(rng, 2);
    for (const seat of ['UTG', 'HJ', 'CO', 'BTN']) {
      assert(q.explanation.includes(seat), `the explanation skips ${seat}: ${q.explanation}`);
    }
  });
});
