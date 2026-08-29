import { describe, it, assert, equal } from './harness.js';
import { parseCards, makeDeck } from '../src/js/core/cards.js';
import { evaluate, evaluateOmaha, describeScore, categoryOf, CAT } from '../src/js/core/evaluator.js';
import { makeRng, shuffle } from '../src/js/core/rng.js';

const ev = (s) => evaluate(parseCards(s));
const cat = (s) => categoryOf(ev(s));

describe('evaluator: categories', () => {
  it('identifies every hand category', () => {
    equal(cat('AsKsQsJsTs'), CAT.STRAIGHT_FLUSH, 'royal');
    equal(cat('5h4h3h2hAh'), CAT.STRAIGHT_FLUSH, 'steel wheel');
    equal(cat('AhAdAcAs2h'), CAT.QUADS, 'quads');
    equal(cat('KhKdKcQsQh'), CAT.FULL_HOUSE, 'boat');
    equal(cat('Ah9h7h4h2h'), CAT.FLUSH, 'flush');
    equal(cat('9s8h7d6c5s'), CAT.STRAIGHT, 'straight');
    equal(cat('As2h3d4c5s'), CAT.STRAIGHT, 'wheel');
    equal(cat('7h7d7c2s3h'), CAT.TRIPS, 'trips');
    equal(cat('AhAdKsKd9c'), CAT.TWO_PAIR, 'two pair');
    equal(cat('AhAd9s7c2d'), CAT.PAIR, 'pair');
    equal(cat('Ah9d7c4s2h'), CAT.HIGH_CARD, 'high card');
  });

  it('does not read Q-K-A-2-3 as a straight', () => {
    assert(cat('QhKdAs2c3h') === CAT.HIGH_CARD, 'ace may not wrap around');
  });

  it('orders hands correctly across categories', () => {
    const ordered = [
      'Ah9d7c4s2h', 'AhAd9s7c2d', 'AhAdKsKd9c', '7h7d7c2s3h',
      '9s8h7d6c5s', 'Ah9h7h4h2h', 'KhKdKcQsQh', 'AhAdAcAs2h', 'AsKsQsJsTs',
    ].map(ev);
    for (let i = 1; i < ordered.length; i++) {
      assert(ordered[i] > ordered[i - 1], `hand ${i} should beat hand ${i - 1}`);
    }
  });

  it('breaks ties on kickers', () => {
    assert(ev('AhAdKs9c2d') > ev('AhAdQs9c2d'), 'better first kicker wins');
    assert(ev('AhAdKs9c3d') > ev('AhAdKs9c2d'), 'better last kicker wins');
    equal(ev('AhAdKs9c2d'), ev('AcAsKd9h2c'), 'suits are irrelevant');
    assert(ev('AsKsQsJs9s') > ev('AhKhQhJh8h'), 'flushes compare by rank');
    assert(ev('5h5d5c2s2h') > ev('4h4d4c3s3h'), 'boats compare by trips first');
    assert(ev('AhAdAcKsKd') > ev('AhAdAcQsQd'), 'boats compare by pair second');
  });

  it('scores the wheel as five high, below a six-high straight', () => {
    assert(ev('6s5h4d3c2s') > ev('As2h3d4c5s'), 'the wheel is the worst straight');
  });
});

describe('evaluator: exhaustive 5-card frequencies', () => {
  it('matches the published counts for all 2,598,960 five-card hands', () => {
    const deck = makeDeck();
    const counts = new Array(9).fill(0);
    const hand = new Array(5);
    for (let a = 0; a < 48; a++) {
      hand[0] = deck[a];
      for (let b = a + 1; b < 49; b++) {
        hand[1] = deck[b];
        for (let c = b + 1; c < 50; c++) {
          hand[2] = deck[c];
          for (let d = c + 1; d < 51; d++) {
            hand[3] = deck[d];
            for (let e = d + 1; e < 52; e++) {
              hand[4] = deck[e];
              counts[evaluate(hand) >> 20]++;
            }
          }
        }
      }
    }
    equal(counts[CAT.STRAIGHT_FLUSH], 40, 'straight flushes');
    equal(counts[CAT.QUADS], 624, 'four of a kind');
    equal(counts[CAT.FULL_HOUSE], 3744, 'full houses');
    equal(counts[CAT.FLUSH], 5108, 'flushes');
    equal(counts[CAT.STRAIGHT], 10200, 'straights');
    equal(counts[CAT.TRIPS], 54912, 'three of a kind');
    equal(counts[CAT.TWO_PAIR], 123552, 'two pair');
    equal(counts[CAT.PAIR], 1098240, 'one pair');
    equal(counts[CAT.HIGH_CARD], 1302540, 'high card');
    equal(counts.reduce((s, n) => s + n, 0), 2598960, 'total');
  });
});

describe('evaluator: 7-card path', () => {
  it('agrees with brute force over all 21 five-card subsets', () => {
    const rng = makeRng(20240607);
    const five = new Array(5);
    for (let trial = 0; trial < 4000; trial++) {
      const deck = shuffle(rng, makeDeck());
      const seven = deck.slice(0, 7);
      let brute = 0;
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 4; b++) for (let c = b + 1; c < 5; c++) {
        for (let d = c + 1; d < 6; d++) for (let e = d + 1; e < 7; e++) {
          five[0] = seven[a]; five[1] = seven[b]; five[2] = seven[c];
          five[3] = seven[d]; five[4] = seven[e];
          const s = evaluate(five);
          if (s > brute) brute = s;
        }
      }
      equal(evaluate(seven), brute, `7-card mismatch on trial ${trial}`);
    }
  });

  it('finds the nut hand hidden in seven cards', () => {
    equal(describeScore(ev('2c7d AsKsQsJsTs')), 'Royal Flush');
    equal(describeScore(ev('AhAd KcKsKh 2c3d')), 'Full House, Kings full of Aces');
  });
});

describe('evaluator: Short Deck', () => {
  it('ranks a flush above a full house', () => {
    const flush = parseCards('Ah9h7h8hJh');
    const boat = parseCards('KhKdKcQsQh');
    assert(evaluate(flush, true) > evaluate(boat, true), 'short deck: flush beats boat');
    assert(evaluate(flush, false) < evaluate(boat, false), 'full deck: boat beats flush');
  });

  it('treats A-6-7-8-9 as the lowest straight', () => {
    equal(evaluate(parseCards('Ah6d7c8s9h'), true) >> 20, CAT.STRAIGHT, 'short-deck wheel');
    assert(evaluate(parseCards('Th9d8c7s6h'), true) > evaluate(parseCards('Ah6d7c8s9h'), true));
    assert((evaluate(parseCards('Ah6d7c8s9h'), false) >> 20) === CAT.HIGH_CARD, 'not a straight in holdem');
  });
});

describe('evaluator: Omaha', () => {
  it('forces exactly two hole cards', () => {
    // Four spades in hand + one on board is NOT a flush in Omaha.
    const hole = parseCards('AsKsQsJs');
    const board = parseCards('2s7h8d9c3h');
    equal(categoryOf(evaluateOmaha(hole, board)), CAT.HIGH_CARD, 'cannot use four hole cards');
  });

  it('finds the nuts using two hole cards and three board cards', () => {
    equal(describeScore(evaluateOmaha(parseCards('AsKs2c3d'), parseCards('QsJsTs4h5h'))), 'Royal Flush');
    equal(describeScore(evaluateOmaha(parseCards('AhAd2c3d'), parseCards('AsKhKd7c8s'))), 'Full House, Aces full of Kings');
  });

  it('cannot play the board', () => {
    // Board is a straight; the hand must still use two hole cards.
    const score = evaluateOmaha(parseCards('2c2d3h3s'), parseCards('9s8h7d6c5s'));
    assert(categoryOf(score) < CAT.STRAIGHT, 'board alone is not a hand in Omaha');
  });
});
