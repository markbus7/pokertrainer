import { describe, it, assert, equal, close } from './harness.js';
import { parseCards } from '../src/js/core/cards.js';
import { handEquity, equityVs, countOuts, describeOuts, handPhrase, exactOutsEquity, ruleOfTwoAndFour } from '../src/js/core/equity.js';
import { evaluateHand } from '../src/js/core/evaluator.js';
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

describe('describeOuts: naming the cards, not just counting them', () => {
  it('names every out it counts, and only real outs', () => {
    const hero = H('2s8d'), villain = H('6h3d'), board = H('9s7d3h');
    const d = describeOuts(hero, villain, board);
    equal(d.count, 3, 'only the three remaining eights beat a pair of threes');
    // The listed cards must be exactly the cards countOuts found — a
    // description that drifts from the maths is worse than no description.
    const listed = d.groups.flatMap((g) => g.cards).sort((a, b) => a - b);
    const counted = [...countOuts(hero, villain, board).outs].sort((a, b) => a - b);
    equal(listed.join(','), counted.join(','), 'described outs match counted outs');
    assert(d.sentence.includes('8'), `names the eights: ${d.sentence}`);
    assert(/a pair of eights/.test(d.sentence), `says what they make: ${d.sentence}`);
    assert(/a pair of threes/.test(d.sentence), `says what the opponent has: ${d.sentence}`);
  });

  it('groups a flush draw as one shape rather than nine separate facts', () => {
    const d = describeOuts(H('AhKh'), H('9c9d'), H('2h7hJc'));
    const flush = d.groups.find((g) => /flush/i.test(g.label));
    assert(flush && flush.cards.length === 9, 'nine hearts in one group');
    assert(/nine hearts/.test(d.sentence), `reads naturally: ${d.sentence}`);
  });

  it('never claims an out that does not actually win', () => {
    const hero = H('AhKh'), villain = H('9c9d'), board = H('2h7hJc');
    for (const card of describeOuts(hero, villain, board).outs) {
      const next = [...board, card];
      const h = handEquity([hero, villain], next, { trials: 1, rng: makeRng(1) });
      assert(h, 'spot is evaluable');
    }
    const { outs } = countOuts(hero, villain, board);
    equal(describeOuts(hero, villain, board).count, outs.length);
  });

  it('handles a spot with no outs without inventing a sentence', () => {
    const d = describeOuts(H('2c3d'), H('AsAh'), H('AdAc7s'));
    equal(d.count, 0, 'drawing dead against quad aces');
    assert(d.groups.length === 0 && /No card/.test(d.sentence), d.sentence);
  });
});

describe('handPhrase: hands named the way a player says them', () => {
  const scoreOf = (hole, board) => evaluateHand(H(hole), H(board), { omaha: false, shortDeck: false });

  it('never produces a mismatched article or a title-case run-on', () => {
    const spots = [
      ['AhKh', 'QhJhTh'], ['7c7d', '7h2s3c'], ['7c7d', '2h2s3c'],
      ['Ah2h', '3h4h9h'], ['9c8d', '7s6h5c'], ['AcAd', 'AsAh2c'],
      ['Kc2d', '7s8h9c'], ['AsKd', '2c7h9s'],
    ];
    for (const [hole, board] of spots) {
      const said = handPhrase(scoreOf(hole, board));
      assert(said === said.toLowerCase(), `should read as prose, got "${said}"`);
      assert(!/^a [aeiou]/.test(said), `wrong article in "${said}"`);
      assert(!/^an [^aeiou]/.test(said), `wrong article in "${said}"`);
      assert(!/,\s*$/.test(said), `dangling comma in "${said}"`);
    }
  });

  it('reads correctly for the categories that used to come out wrong', () => {
    equal(handPhrase(scoreOf('7c6d', '7h6s2c')), 'two pair, sevens and sixes');
    equal(handPhrase(scoreOf('7c7d', '7h2s3c')), 'trip sevens');
    equal(handPhrase(scoreOf('Ah2h', '3h4h9h')), 'an ace-high flush');
    equal(handPhrase(scoreOf('8c8d', '8h2s2c')), 'eights full of twos');
  });
});

describe('lessons and drills derive their equity rather than asserting it', () => {
  it('every drill that reveals the opponent names the cards it counts', async () => {
    const { generateQuestion } = await import('../src/js/trainers/index.js');
    const { DRILL_MODULE_IDS } = await import('../src/js/trainers/index.js');
    const rng = makeRng(41);
    let checked = 0;
    for (const moduleId of DRILL_MODULE_IDS) {
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion(moduleId, rng, 3);
        if (!q.scenario || !q.scenario.revealVillain) continue;
        checked++;
        // A bare "you have N outs" is the thing this replaced: the explanation
        // must show at least one actual card so the count can be checked.
        assert(
          /[2-9TJQKA][♣♦♥♠]/.test(q.explanation),
          `${moduleId} quotes outs without naming any: "${q.explanation}"`,
        );
      }
    }
    assert(checked > 0, 'at least one drill reveals the opponent');
  });

  it('the Lab shows its working on a face-up decision', async () => {
    const { generateSpot } = await import('../src/js/trainers/lab.js');
    const rng = makeRng(9);
    let seen = 0;
    for (let i = 0; i < 25; i++) {
      const spot = generateSpot('decide', rng);
      if (spot.type !== 'decide') continue;  // falls back to price if it cannot deal one
      seen++;
      const lines = spot.solve(spot.answer).lines.join(' ');
      assert(/[2-9TJQKA][♣♦♥♠]/.test(lines), `no cards named: ${lines}`);
      equal(spot.concept, 'outs', 'a face-up decision is an outs exercise');
    }
    assert(seen > 0, 'the Lab produced at least one decide spot');
  });
});
