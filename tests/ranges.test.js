import { describe, it, assert, equal, close } from './harness.js';
import { parseRange, rangePercent, rangeCombos, CHARTS, preflopAdvice, POSITIONS } from '../src/js/data/ranges.js';
import { HAND_STRENGTH, STRENGTH_ORDER, STRENGTH_RANK } from '../src/js/data/handStrength.js';
import { ALL_HAND_KEYS, comboCount } from '../src/js/core/cards.js';

describe('ranges: notation parser', () => {
  it('expands pair ranges', () => {
    equal([...parseRange('TT+')].sort().join(','), ['TT', 'JJ', 'QQ', 'KK', 'AA'].sort().join(','));
    equal(parseRange('22+').size, 13, 'every pair');
    equal([...parseRange('AA-JJ')].sort().join(','), ['AA', 'KK', 'QQ', 'JJ'].sort().join(','));
  });

  it('expands suited and offsuit runs', () => {
    equal([...parseRange('KTs+')].sort().join(','), ['KTs', 'KJs', 'KQs'].sort().join(','));
    equal([...parseRange('AJo+')].sort().join(','), ['AJo', 'AQo', 'AKo'].sort().join(','));
    equal(parseRange('A2s+').size, 12, 'A2s through AKs');
    equal([...parseRange('A5s-A3s')].sort().join(','), ['A3s', 'A4s', 'A5s'].sort().join(','));
  });

  it('handles single hands and whitespace', () => {
    equal([...parseRange('  QJo , T9s ')].sort().join(','), ['QJo', 'T9s'].sort().join(','));
  });

  it('never invents a hand outside the 169 grid', () => {
    const valid = new Set(ALL_HAND_KEYS);
    for (const notation of Object.values({ ...CHARTS.rfi })) {
      for (const key of notation) assert(valid.has(key), `unknown hand key: ${key}`);
    }
  });

  it('counts combos the way a solver does', () => {
    close(rangePercent(parseRange('22+')), 78 / 1326, 1e-9, 'pairs are 5.9% of hands');
    equal(rangeCombos(parseRange('AKs, AKo')), 4 + 12, 'AK is 16 combos');
  });
});

describe('ranges: charts are sane', () => {
  it('opens wider the closer you get to the button', () => {
    const order = ['UTG', 'HJ', 'CO', 'BTN'];
    for (let i = 1; i < order.length; i++) {
      const tighter = rangePercent(CHARTS.rfi[order[i - 1]]);
      const wider = rangePercent(CHARTS.rfi[order[i]]);
      assert(wider > tighter, `${order[i]} should open wider than ${order[i - 1]}`);
    }
  });

  it('keeps every opening range in a believable band', () => {
    const bands = { UTG: [0.13, 0.21], HJ: [0.18, 0.26], CO: [0.24, 0.33], BTN: [0.40, 0.52], SB: [0.34, 0.46] };
    for (const [pos, [lo, hi]] of Object.entries(bands)) {
      const pct = rangePercent(CHARTS.rfi[pos]);
      assert(pct >= lo && pct <= hi, `${pos} opens ${(pct * 100).toFixed(1)}%, expected ${lo * 100}-${hi * 100}%`);
    }
  });

  it('never folds a premium from any position', () => {
    for (const pos of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
      for (const hand of ['AA', 'KK', 'QQ', 'AKs', 'AKo']) {
        equal(preflopAdvice(hand, pos).action, 'raise', `${pos} must open ${hand}`);
      }
    }
  });

  it('folds trash from early position', () => {
    for (const hand of ['72o', '83o', 'J2o', '95o']) {
      equal(preflopAdvice(hand, 'UTG').action, 'fold', `UTG must fold ${hand}`);
    }
  });

  it('defends the big blind wider against a button open than an UTG open', () => {
    assert(rangePercent(CHARTS.bbDefend.BTN) > rangePercent(CHARTS.bbDefend.UTG),
      'wider opens deserve wider defence');
  });

  it('3-bets value hands and bluffs, but never the same hand twice', () => {
    for (const [pos, chart] of Object.entries(CHARTS.threeBet)) {
      for (const hand of chart.value) {
        assert(!chart.bluff.has(hand), `${pos}: ${hand} cannot be both value and bluff`);
      }
      assert(chart.value.size > 0 && chart.bluff.size > 0, `${pos} needs both halves`);
    }
  });

  it('gives a reason with every verdict', () => {
    for (const pos of POSITIONS.slice(0, 5)) {
      const advice = preflopAdvice('T9s', pos);
      assert(advice.reason && advice.reason.length > 20, 'advice must teach, not just rule');
    }
  });
});

describe('ranges: hand strength table', () => {
  it('covers all 169 hands', () => {
    equal(Object.keys(HAND_STRENGTH).length, 169);
    equal(STRENGTH_ORDER.length, 169);
  });

  it('matches published all-in equity against a random hand', () => {
    close(HAND_STRENGTH.AA, 0.852, 0.01, 'AA vs random');
    close(HAND_STRENGTH.KK, 0.824, 0.01, 'KK vs random');
    close(HAND_STRENGTH['72o'], 0.346, 0.012, '72o vs random');
  });

  it('ranks the premiums at the top and the trash at the bottom', () => {
    equal(STRENGTH_ORDER[0], 'AA');
    equal(STRENGTH_ORDER[1], 'KK');
    assert(STRENGTH_RANK['32o'] >= 165, 'the worst hands sit at the bottom');
    assert(STRENGTH_RANK.AKs < STRENGTH_RANK.AKo, 'suited beats offsuit');
    assert(STRENGTH_RANK['76s'] < STRENGTH_RANK['76o'], 'suited connectors beat their offsuit twin');
  });

  it('is monotonic: every pair beats the pair below it', () => {
    const pairs = ['22', '33', '44', '55', '66', '77', '88', '99', 'TT', 'JJ', 'QQ', 'KK', 'AA'];
    for (let i = 1; i < pairs.length; i++) {
      assert(HAND_STRENGTH[pairs[i]] > HAND_STRENGTH[pairs[i - 1]], `${pairs[i]} > ${pairs[i - 1]}`);
    }
  });
});
