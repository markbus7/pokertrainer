import { describe, it, assert, equal } from './harness.js';
import { readFileSync } from 'node:fs';
import { CHARTS } from '../src/js/data/ranges.js';
import { PRICE_LADDER, requiredEquity } from '../src/js/core/odds.js';

const read = (f) => readFileSync(new URL(`../src/js/${f}`, import.meta.url), 'utf8');

describe('reference: the chart lives in one place', () => {
  it('is not reimplemented anywhere it is used', () => {
    // It existed twice — a boundary table in the drill, a grid in the range
    // trainer — and in neither of the places a reader was actually applying
    // it. Three copies of a chart is three charts that can disagree.
    const users = ['ui/screenTable.js', 'ui/screenDrill.js', 'ui/screenRangeTrainer.js'];
    for (const file of users) {
      const src = read(file);
      assert(/from '\.\/reference\.js'/.test(src), `${file} does not use the shared reference`);
      assert(!/handGrid\(\)\.flat\(\)/.test(src),
        `${file} builds its own 13x13 grid instead of asking for one`);
      assert(!/PRICE_LADDER/.test(src), `${file} builds its own price ladder`);
    }
  });

  it('derives the price from the same function that marks the answer', () => {
    // A typed percentage is a percentage that drifts from the engine. Every
    // row of the ladder has to come out of requiredEquity.
    const src = read('ui/reference.js');
    assert(/requiredEquity\(/.test(src), 'the price ladder does not derive its percentages');
    assert(!/\b(25|33|29|17)%/.test(src), 'a percentage is typed into the reference by hand');
    for (const { fraction } of PRICE_LADDER) {
      const needed = requiredEquity(fraction, 1 + fraction);
      assert(needed > 0 && needed < 0.5, `a bet of ${fraction} pot needs ${needed}`);
    }
  });
});

describe('reference: a reference is not an answer', () => {
  it(`shows the chart and the price, and never this hand equity`, () => {
    const src = read('ui/reference.js');
    // The distinction the whole design rests on: the chart is the thing being
    // memorised and looking at it is how you learn it; your own equity worked
    // out for you is the answer, and there is no version of being told the
    // answer that is practice.
    for (const giveaway of ['equityVsField', 'outsToImprove', 'monteCarlo', 'judgeSpot']) {
      assert(!src.includes(giveaway), `the reference computes ${giveaway} — that is the answer, not a reference`);
    }
  });

  it(`keeps the answer button behind its own warning`, () => {
    const src = read('ui/screenTable.js');
    assert(/will not count as solved on your own/.test(src),
      'the numbers button stopped warning that it is not solving it yourself');
    // ...while the reference costs nothing and says so.
    assert(/costs you nothing/.test(src), 'the reference does not say it is free');
  });
});

describe('reference: the chart it shows is the chart for the spot', () => {
  it('has a range for every seat the table can put you in', () => {
    // A player on the button facing a raise was shown big-blind defence,
    // because the seat was hardcoded the moment anyone had raised.
    const src = read('ui/screenTable.js');
    assert(!/seat: raiser \? 'BB'/.test(src),
      'the table forces the big-blind chart whenever somebody has raised');
    for (const seat of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
      assert(CHARTS.rfi[seat], `no opening range for ${seat}`);
      assert(CHARTS.threeBet[seat], `no three-betting range for ${seat}`);
    }
    assert(CHARTS.threeBet.BB, 'no three-betting range for the big blind');
  });

  it('says what the colours mean, including what is missing', () => {
    const src = read('ui/reference.js');
    assert(/chart-legend/.test(src), 'the grid has no legend');
    // Outside the big blind there is no call-an-open chart, so an uncoloured
    // cell is not evidence of a fold. Saying nothing would imply it is.
    assert(/there is no calling range/.test(src),
      'the three-betting chart implies every blank cell is a fold');
  });
});
