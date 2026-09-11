import { describe, it, assert, equal, close } from './harness.js';
import {
  requiredEquity, potOddsRatio, callEV, breakEvenBluffFrequency, minimumDefenceFrequency,
  bluffToValueRatio, bluffShareOfRange, spr, impliedOddsNeeded, icmEquity, riskOfRuin,
  bankrollForRisk, bbPer100,
} from '../src/js/core/odds.js';
import { makeRng } from '../src/js/core/rng.js';
import { callOrFoldDrill } from '../src/js/trainers/fundamentals.js';
import { generateQuestion } from '../src/js/trainers/index.js';
import { PRICE_LADDER } from '../src/js/core/odds.js';

describe('odds: pot odds', () => {
  it('prices a half-pot call at 25%', () => {
    close(requiredEquity(50, 150), 0.25, 1e-9, 'call 50 into 150');
    close(potOddsRatio(50, 150), 3, 1e-9, '3 to 1');
  });

  it('prices a pot-sized call at 33.3%', () => {
    close(requiredEquity(100, 200), 1 / 3, 1e-9);
  });

  it('makes EV zero exactly at the required equity', () => {
    const call = 50;
    const pot = 150;
    close(callEV(requiredEquity(call, pot), call, pot), 0, 1e-9, 'break-even by construction');
    assert(callEV(0.4, call, pot) > 0, 'more equity than needed is profitable');
    assert(callEV(0.2, call, pot) < 0, 'less equity than needed loses money');
  });

  it('computes implied odds needed for a losing-now call', () => {
    // 20% equity calling 50 into 150 is short; we need extra chips later.
    const extra = impliedOddsNeeded(0.2, 50, 150);
    assert(extra > 0, 'the call needs future money');
    close(0.2 * (150 + extra), 0.8 * 50, 1e-6, 'break even including implied chips');
  });
});

describe('odds: bluffing and defence', () => {
  it('needs a pot-sized bluff to work half the time', () => {
    close(breakEvenBluffFrequency(100, 100), 0.5, 1e-9);
  });

  it('needs a half-pot bluff to work a third of the time', () => {
    close(breakEvenBluffFrequency(50, 100), 1 / 3, 1e-9);
  });

  it('defends the pot at MDF', () => {
    close(minimumDefenceFrequency(100, 100), 0.5, 1e-9, 'vs pot bet, defend half');
    close(minimumDefenceFrequency(50, 100), 2 / 3, 1e-9, 'vs half pot, defend two thirds');
  });

  it('balances one bluff per two value hands at pot size', () => {
    close(bluffToValueRatio(100, 100), 0.5, 1e-9, '1 bluff : 2 value');
    close(bluffShareOfRange(100, 100), 1 / 3, 1e-9, 'a third of the range bluffs');
  });

  it('computes stack-to-pot ratio', () => {
    close(spr(400, 100), 4, 1e-9);
  });
});

describe('odds: ICM', () => {
  it('pays every prize exactly once', () => {
    const stacks = [5000, 3000, 2000];
    const payouts = [500, 300, 200];
    const eq = icmEquity(stacks, payouts);
    close(eq.reduce((s, x) => s + x, 0), 1000, 1e-6, 'total equity equals the prize pool');
  });

  it('ranks equity by stack size', () => {
    const eq = icmEquity([5000, 3000, 2000], [500, 300, 200]);
    assert(eq[0] > eq[1] && eq[1] > eq[2], 'bigger stack, bigger equity');
  });

  it('shows chips are worth less than face value for the leader', () => {
    const eq = icmEquity([5000, 3000, 2000], [500, 300, 200]);
    const chipChop = (5000 / 10000) * 1000;
    assert(eq[0] < chipChop, 'ICM taxes the big stack');
  });

  it('splits evenly when stacks are equal', () => {
    const eq = icmEquity([1000, 1000, 1000], [500, 300, 200]);
    for (const e of eq) close(e, 1000 / 3, 1e-6, 'equal stacks, equal equity');
  });

  it('gives a bubble stack near-zero when others are huge', () => {
    const eq = icmEquity([100, 10000, 10000], [600, 400]);
    assert(eq[0] < 40, `short stack on the bubble is worth little, got ${eq[0]}`);
  });
});

describe('odds: bankroll', () => {
  it('drops risk of ruin as the bankroll grows', () => {
    const small = riskOfRuin(500, 5, 100);
    const large = riskOfRuin(3000, 5, 100);
    assert(large < small, 'more buy-ins, less ruin');
    assert(small <= 1 && large >= 0);
  });

  it('treats a break-even player as certain to bust', () => {
    equal(riskOfRuin(100000, 0, 100), 1, 'no edge means ruin is certain eventually');
  });

  it('sizes a bankroll for a 5% risk target', () => {
    const br = bankrollForRisk(5, 100, 0.05);
    close(riskOfRuin(br, 5, 100), 0.05, 1e-6, 'the two formulas agree');
  });

  it('computes win rate in bb/100', () => {
    close(bbPer100(250, 5000), 5, 1e-9);
  });
});

describe('pot odds: the price is shown being built, not asserted', () => {
  it('spells out the final pot in every call-or-fold explanation', () => {
    // "25 ÷ 100" beside a board reading "pot 50, bet 25" leaves the 100
    // coming from nowhere, and the obvious reading of those two numbers is
    // 25 of 75. Every explanation now shows the sum that makes the 100.
    const rng = makeRng(4242);
    let checked = 0;
    for (let i = 0; i < 200 && checked < 40; i++) {
      const q = callOrFoldDrill(rng, 2);
      if (!q) continue;
      const { pot, toCall } = q.scenario;
      const final = pot + toCall + toCall;

      // The figure the price divides by has to appear as a sum, not only as
      // a result, and the pot on the felt has to be in it.
      assert(q.explanation.includes(`${toCall} ÷ ${final}`),
        `the price is not quoted against the final pot: ${q.explanation}`);
      assert(q.explanation.includes(String(final)) && q.explanation.includes(String(pot)),
        `the explanation never connects ${pot} on the felt to ${final} in the price`);

      // And the price itself must be the real one.
      close(requiredEquity(toCall, pot + toCall), toCall / final, 0.0001,
        'the required equity is the call over the final pot');
      checked++;
    }
    assert(checked > 30, `enough explanations checked (${checked})`);
  });

  it('prices a bet the reader can verify by hand', () => {
    // The worked example from the lesson, and the one that caused the
    // question: 50 in the pot, a bet of 25, so 100 in the end and 25 of it
    // is yours.
    equal(Math.round(requiredEquity(25, 50 + 25) * 1000) / 10, 25);
    equal(Math.round(requiredEquity(50, 100 + 50) * 1000) / 10, 25);
    equal(Math.round(requiredEquity(55, 55 + 55) * 1000) / 10, 33.3);
    // And the reading that looks right but is not: the pot on the felt is
    // what was there before the bet, so it is not the denominator.
    assert(Math.abs(requiredEquity(25, 50) - 0.333) < 0.001,
      'treating the pre-bet pot as the whole pot gives the 33% that feels right');
  });
});

describe('pot odds: the shortcut is demonstrated, not just described', () => {
  it('shows the table method in every priced explanation', () => {
    // The lesson teaches counting the final pot in calls, and the app drills
    // the price ladder separately — and then 1,600 worked examples modelled
    // neither, every one of them dividing. The method being taught was never
    // the method being shown.
    const rng = makeRng(2026);
    let checked = 0;
    let worst = 0;
    for (let i = 0; i < 600 && checked < 120; i++) {
      for (const module of ['pot-odds', 'outs']) {
        const q = generateQuestion(module, rng, 2);
        if (!q || !q.scenario || q.scenario.pot == null || q.scenario.toCall == null) continue;
        if (!/÷/.test(q.explanation)) continue;      // only the ones that quote a price

        assert(/goes into/.test(q.explanation),
          `a priced explanation never shows the table method: ${q.explanation.slice(0, 120)}`);

        // The figure it rounds to has to be the real price, or the shortcut
        // teaches a number the engine disagrees with.
        const { pot, toCall } = q.scenario;
        const exact = requiredEquity(toCall, pot + toCall) * 100;
        const said = Number(/about (\d+)%/.exec(q.explanation)[1]);
        worst = Math.max(worst, Math.abs(said - exact));
        checked++;
      }
    }
    assert(checked > 60, `enough priced explanations checked (${checked})`);
    assert(worst <= 1, `the shortcut's rounding drifts ${worst.toFixed(1)} points from the real price`);
  });
});

describe('the price ladder taught is the price ladder graded', () => {
  it('derives the five rungs from the same function that marks the answer', () => {
    // These five numbers are quoted as prose in a drill explanation and drawn
    // as a table on the drill screen's method card. Neither is allowed to be
    // a number somebody typed once: they come from requiredEquity, and this
    // pins them to the figures the learner is told to memorise.
    const expected = { '¼ pot': 17, '⅓ pot': 20, '½ pot': 25, '¾ pot': 30, pot: 33 };
    for (const { fraction, short } of PRICE_LADDER) {
      const need = requiredEquity(fraction, 1 + fraction) * 100;
      assert(Math.abs(need - expected[short]) < 0.5,
        `${short} is taught as ${expected[short]}% but prices at ${need.toFixed(1)}%`);

      // And the counting route has to land on the same rung as the division,
      // or the shortcut is a different sum wearing the same answer.
      const calls = 1 / fraction + 2;
      assert(Math.abs((100 / calls) - need) < 0.05,
        `counting ${short} in calls gives ${(100 / calls).toFixed(1)}%, dividing gives ${need.toFixed(1)}%`);
    }
  });
});
