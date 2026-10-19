/**
 * Your win rate against the bands: which band a rate is in, the range around
 * it narrowing with the hands, profit in money at the stake each sitting was
 * played at (the practice table left out), and all of it in Dutch.
 */

import { describe, it, assert, equal, close } from './harness.js';
import { WINRATE_BANDS, BAND_TYPICAL, bandFor, confidence, cashProfit, expectedProfit, scaleAt, SCALE, byStake, bySession, graphPoints } from '../src/js/state/winrate.js';
import { NL } from '../src/js/i18n/nl.js';

describe('winrate', () => {
  it('puts each rate in one band, from beginner to elite', () => {
    equal(bandFor(-4).key, 'beginner');
    equal(bandFor(0).key, 'intermediate');
    equal(bandFor(2.9).key, 'intermediate');
    equal(bandFor(3).key, 'regular');
    equal(bandFor(7).key, 'pro');
    equal(bandFor(25).key, 'elite');
    for (const b of WINRATE_BANDS) equal(bandFor(BAND_TYPICAL[b.key]).key, b.key, b.key);
  });
  it('narrows the range as the hands come', () => {
    const few = confidence(5, 1000);
    const many = confidence(5, 100000);
    assert(few.half > many.half * 9, 'a hundred times the hands, a tenth the range');
    close(many.half, 1.96 * 90 / Math.sqrt(1000), 1e-9);
    equal(confidence(5, 0), null);
  });
  it('counts profit at each sitting\'s stake and leaves out practice', () => {
    const p = cashProfit([
      { hands: 100, profitBb: 50, stake: 'nl10' },
      { hands: 200, profitBb: -20, stake: 'nl100' },
      { hands: 300, profitBb: 999, stake: 'practice' },
      null,
    ]);
    close(p.money, 50 * 0.1 - 20, 1e-9);
    equal(p.bb, 30);
    equal(p.hands, 300);
  });
  it('says what a rate makes at a stake', () => {
    equal(expectedProfit(5, 1000, 'nl100'), 50);
    equal(expectedProfit(-5, 10000, 'nl10'), -50);
  });
  it('keeps the mark on the scale', () => {
    equal(scaleAt(-100), 0);
    equal(scaleAt(100), 100);
    close(scaleAt(0), (-SCALE.lo / (SCALE.hi - SCALE.lo)) * 100, 1e-9);
  });
  it('is all in Dutch', () => {
    for (const b of WINRATE_BANDS) {
      assert(NL[b.name], `no Dutch for ${b.name}`);
      assert(NL[b.note], `no Dutch for ${b.note}`);
    }
  });
});

describe('winrate by stake', () => {
  it('adds up each stake, lowest first, without practice', () => {
    const rows = byStake([
      { hands: 500, profitBb: 40, stake: 'nl25' },
      { hands: 500, profitBb: -10, stake: 'nl25' },
      { hands: 200, profitBb: -20, stake: 'nl5' },
      { hands: 100, profitBb: 99, stake: 'practice' },
      { hands: 0, profitBb: 5, stake: 'nl10' },
    ]);
    equal(rows.map((r) => r.stake.key).join(), 'nl5,nl25');
    equal(rows[1].hands, 1000);
    close(rows[1].rate, 3, 1e-9);
    equal(rows[1].band.key, 'regular');
    close(rows[1].money, 7.5, 1e-9);
    equal(rows[0].band.key, 'beginner');
  });
});

describe('winrate by session', () => {
  it('counts sittings ahead, the average, the best and the worst in money', () => {
    const s = bySession([
      { hands: 100, profitBb: 50, stake: 'nl10' },
      { hands: 100, profitBb: -30, stake: 'nl100' },
      { hands: 200, profitBb: 20, stake: 'nl100' },
      { hands: 50, profitBb: 999, stake: 'practice' },
    ]);
    equal(s.count, 3);
    equal(s.up, 2);
    close(s.avgMoney, (5 - 30 + 20) / 3, 1e-9);
    equal(s.best.bb, 20);
    equal(s.worst.bb, -30);
    equal(bySession([]), null);
  });
});

describe('winrate graph', () => {
  it('runs the totals in the order played, from nothing, without practice', () => {
    const pts = graphPoints([
      { hands: 100, profitBb: -10, stake: 'nl100', endedAt: 3 },
      { hands: 1000, profitBb: 50, stake: 'nl5', endedAt: 1 },
      { hands: 50, profitBb: 99, stake: 'practice', endedAt: 2 },
    ]);
    equal(pts.length, 3);
    equal(pts[0].hands, 0);
    equal(pts[1].stake.key, 'nl5');
    equal(pts[2].hands, 1100);
    equal(pts[2].bb, 40);
    // In money the hundred hands at NL100 outweigh the thousand at NL5.
    close(pts[2].money, 50 * 0.05 - 10, 1e-9);
    assert(pts[2].money < 0 && pts[2].bb > 0);
  });
});
