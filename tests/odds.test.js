import { describe, it, assert, equal, close } from './harness.js';
import {
  requiredEquity, potOddsRatio, callEV, breakEvenBluffFrequency, minimumDefenceFrequency,
  bluffToValueRatio, bluffShareOfRange, spr, impliedOddsNeeded, icmEquity, riskOfRuin,
  bankrollForRisk, bbPer100,
} from '../src/js/core/odds.js';

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
