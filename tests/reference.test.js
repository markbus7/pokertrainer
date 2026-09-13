import { describe, it, assert, equal } from './harness.js';
import { readFileSync } from 'node:fs';
import { CHARTS } from '../src/js/data/ranges.js';
import { PRICE_LADDER, requiredEquity } from '../src/js/core/odds.js';
import { generateQuestion } from '../src/js/trainers/index.js';
import { makeRng } from '../src/js/core/rng.js';

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

describe('reference: it is still there after you answer', () => {
  it('offers the chart on both sides of the answer', () => {
    // It used to vanish the moment you answered, on the reasoning that "the
    // right answer is already on screen and a chart adds nothing". Knowing
    // the answer was Fold tells you about one hand; seeing where that hand
    // sits — a rank outside the boundary — is the shape, and the shape is
    // what transfers. The range trainer was already built this way.
    const src = read('ui/screenDrill.js');
    assert(!/chosen === null && sheet/.test(src),
      'the reference is still withheld once the question is answered');
    assert(/answered: chosen !== null/.test(src),
      'the reference is not told whether the question has been answered');
  });

  it('rings your hand only after you have answered', () => {
    // Ringing it beforehand would hand over an opening question outright:
    // finding your hand on the grid is the work.
    const src = read('ui/screenDrill.js');
    assert(/hand: answered && scenario\.hole/.test(src),
      'the hand is ringed regardless of whether the question has been answered');
  });

  it('redraws with the answer still in hand', () => {
    // draw() takes the chosen answer as an argument and defaults it to null,
    // so reopening the chart with a bare draw() forgot the question had been
    // answered and showed a grid with nothing ringed on it.
    const src = read('ui/screenDrill.js');
    const reopen = src.slice(src.indexOf('state.reviewing = true'));
    assert(/draw\(chosen\)/.test(reopen.slice(0, 400)),
      'reopening the reference redraws without the answer');
  });
});

describe('reference: the question says which seat you are in', () => {
  it('never uses `hero` for a seat, because that field means cards', () => {
    // spotFelt reads scenario.hero and means the hero's CARDS by it. Naming a
    // seat with it passed a string to a function expecting a card array and
    // blanked the felt on every question that carried one.
    const src = read('trainers/preflop.js');
    assert(!/\bhero: '(UTG|HJ|CO|BTN|SB|BB)'/.test(src), 'a seat is stored in scenario.hero');
    assert(!/\bhero: (pick\.)?position\b/.test(src), 'a seat is stored in scenario.hero');
  });

  it('never claims you are sitting where the raiser is', () => {
    const rng = makeRng(21);
    for (const module of ['preflop', 'position']) {
      for (let i = 0; i < 120; i++) {
        const q = generateQuestion(module, rng, 1);
        const s = q.scenario || {};
        if (!s.heroSeat || !s.raiser) continue;
        assert(s.heroSeat !== s.raiser,
          `${module}: seated in the ${s.heroSeat} facing a raise from the ${s.raiser}`);
      }
    }
  });

  it('leaves the seat unnamed rather than guessing it', () => {
    // Two question shapes carry hole cards AND a position that is NOT yours:
    // the domination question ("Now the hijack raises") and the boundary
    // questions ("the cutoff opens and you are in the big blind"). Inferring
    // the seat from `position` got both wrong, so a question that does not
    // state where you sit must not pretend to.
    const rng = makeRng(22);
    let unnamed = 0;
    for (let i = 0; i < 150; i++) {
      const q = generateQuestion('preflop', rng, 1);
      const s = q.scenario || {};
      if (!s.heroSeat) unnamed++;
    }
    assert(unnamed > 0, 'every question claims to know your seat, which cannot be right');
  });
});
