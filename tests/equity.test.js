import { describe, it, assert, equal, close } from './harness.js';
import { parseCards } from '../src/js/core/cards.js';
import { handEquity, equityVs, countOuts, exactOutsEquity, ruleOfTwoAndFour } from '../src/js/core/equity.js';
import { makeRng } from '../src/js/core/rng.js';

const H = (s) => parseCards(s);

describe('equity: known matchups', () => {
  it('prices AA vs KK at the textbook 82%', () => {
    const r = handEquity([H('AhAd'), H('KsKc')], [], { trials: 40000, rng: makeRng(7) });
    close(r.equity[0], 0.823, 0.012, 'AA vs KK preflop');
  });

  it('prices a coin flip: pair vs two overcards', () => {
    const r = handEquity([H('8h8d'), H('AsKc')], [], { trials: 40000, rng: makeRng(11) });
    close(r.equity[0], 0.542, 0.015, '88 vs AKo');
  });

  it('prices AKs vs QQ as the classic 46%', () => {
    const r = handEquity([H('AsKs'), H('QhQd')], [], { trials: 40000, rng: makeRng(13) });
    close(r.equity[0], 0.463, 0.015, 'AKs vs QQ');
  });

  it('enumerates the river exactly', () => {
    const r = handEquity([H('AhKh'), H('2c2d')], H('AsKs7h2h'), { rng: makeRng(3) });
    assert(r.exact, 'turn spot should enumerate');
    equal(r.iterations, 44, 'one card to come, 44 unseen cards');
  });

  it('gives a made hand 100% when it is already unbeatable', () => {
    const r = handEquity([H('AsKs'), H('2c3d')], H('QsJsTs4h5h'));
    equal(r.equity[0], 1, 'royal flush wins every time');
  });

  it('splits a chopped board evenly', () => {
    const r = handEquity([H('2c3d'), H('2h3s')], H('AsKsQhJhTd'));
    close(r.equity[0], 0.5, 1e-9, 'both play the board');
    equal(r.tie[0], 1, 'always a tie');
  });

  it('equity across all players sums to 1', () => {
    const r = handEquity([H('AhAd'), H('KsKc'), H('7h8h')], [], { trials: 8000, rng: makeRng(5) });
    close(r.equity.reduce((s, e) => s + e, 0), 1, 1e-9, 'equity is a share of one pot');
  });
});

describe('equity: outs', () => {
  it('counts nine outs for a bare flush draw', () => {
    // Kh4h on Ah9h3s against a pair of aces: only the nine remaining hearts
    // get there. Pairing the king or the four still loses.
    const { count } = countOuts(H('Kh4h'), H('As7c'), H('Ah9h3s'));
    equal(count, 9, 'nine hearts, nothing else');
  });

  it('counts the famous fifteen-out combo draw', () => {
    // 5h4h on 7h2h3s: nine hearts, plus the aces and sixes that complete a
    // straight (minus the two already counted as hearts).
    const { count } = countOuts(H('5h4h'), H('9s9c'), H('7h2h3s'));
    equal(count, 15, 'flush draw plus open-ended straight draw');
  });

  it('does not count an out that makes the opponent a better hand', () => {
    // Qh3h on Kh8h2s vs a set of kings: the 2h fills our flush but boats him up.
    const { outs } = countOuts(H('Qh3h'), H('KsKc'), H('Kh8h2s'));
    const strings = outs.map((c) => ['c', 'd', 'h', 's'][c & 3]);
    assert(strings.every((s) => s === 'h'), 'only hearts can win');
    assert(outs.length === 8, `the board-pairing heart is not an out (got ${outs.length})`);
  });

  it('counts eight outs for an open-ended straight draw', () => {
    const { count } = countOuts(H('9c8d'), H('AhAs'), H('7s6h2c'));
    equal(count, 8, 'four tens and four fives');
  });

  it('matches the rule of 4 within a couple of points on the flop', () => {
    const exact = exactOutsEquity(9, 'flop');
    const shortcut = ruleOfTwoAndFour(9, 'flop');
    close(exact, 0.35, 0.005, 'nine outs by the turn+river');
    assert(Math.abs(exact - shortcut) < 0.02, 'the shortcut is close enough to trust at the table');
  });

  it('is exact on the turn: outs over 46', () => {
    close(exactOutsEquity(9, 'turn'), 9 / 46, 1e-12);
  });
});
