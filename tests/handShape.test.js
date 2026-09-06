/**
 * Naming what you are looking at.
 *
 * The lessons used "gutshot", "open-ended" and "flush draw" sixty-odd times
 * between them and nothing in the game could recognise one. These are the
 * facts a player is expected to know by heart, so they are pinned here: nine
 * outs to a flush, eight to an open-ender, four to a gutshot, six to two
 * overcards, and a combo draw counted once rather than twice.
 */

import { describe, it, assert, equal } from './harness.js';
import { parseCards, makeDeck } from '../src/js/core/cards.js';
import { makeRng, shuffle } from '../src/js/core/rng.js';
import { readShape, SHAPES, shapeByKey } from '../src/js/core/handShape.js';
import { CAT } from '../src/js/core/evaluator.js';

const read = (hand, board) => readShape(parseCards(hand), parseCards(board));

describe('the shape reader names the draw', () => {
  it('knows the four draws by name and by count', () => {
    const cases = [
      ['Ah Kh', '7h 2h 9c', 'flush-draw', 9],
      ['9c 8d', '7h 6s 2c', 'open-ended', 8],
      ['9c 8d', 'Th 6s 2c', 'gutshot', 4],
      ['Ah Kd', '7c 2s 9h', 'overcards', 6],
    ];
    for (const [hand, board, key, outs] of cases) {
      const shape = read(hand, board).shape;
      equal(shape.key, key, `${hand} on ${board}`);
      equal(shape.outs, outs, `${key} should be ${outs} outs`);
    }
  });

  it('counts a combo draw once, not twice', () => {
    // Ah Kh on Qh Jc 2h: nine hearts and four tens, but the ten of hearts is
    // both. Twelve, not thirteen — and this is exactly the mistake a player
    // makes counting them in their head.
    const shape = read('Ah Kh', 'Qh Jc 2h').shape;
    equal(shape.key, 'combo');
    equal(shape.outs, 12);
  });

  it('lets the ace play low, so the wheel is a real draw', () => {
    equal(read('Ad 2c', '3h 4s Kc').shape.key, 'gutshot');
    equal(read('Ad 2c', '3h 4s 5c').shape.key, 'made');
  });

  it('calls a double gutshot open-ended, because it plays like one', () => {
    // 5-J on 7-8-9: a six fills 5-6-7-8-9 and a ten fills 7-8-9-T-J. Two
    // separate holes, eight cards between them, and it is worth the same as
    // an open-ender — which is why it gets the same name here.
    const shape = read('5c Jd', '7h 8s 9c').shape;
    equal(shape.key, 'open-ended');
    equal(shape.outs, 8);
    // And the single-hole version really is four.
    equal(read('Jc 8d', 'Th 7s 2c').shape.outs, 4);
  });

  it('does not call a finished hand a draw', () => {
    for (const [hand, board] of [['9c 8d', '7h 6s 5c'], ['Ah Kh', 'Qh Jh Th'], ['7c 7d', '7h 2s 9c']]) {
      const r = read(hand, board);
      assert(r.made, `${hand} on ${board} is already made`);
      equal(r.shape.key, 'made');
    }
  });

  it('separates a backdoor from a real draw', () => {
    // Three of a suit needs both remaining cards. It is worth something and
    // it is not a draw, and telling a beginner otherwise costs them money.
    const r = read('Th 4d', '7h 2h 9c');
    assert(r.draws.some((d) => d.key === 'backdoor-flush'), 'the backdoor is noticed');
    assert(!r.draws.some((d) => d.key === 'flush-draw'), 'and is not called a flush draw');
    equal(shapeByKey('backdoor-flush').outs, 0);
  });

  it('never names a shape the game has no word for', () => {
    const known = new Set(SHAPES.map((s) => s.key));
    const rng = makeRng(12);
    for (let i = 0; i < 4000; i++) {
      const deck = shuffle(rng, makeDeck());
      const r = readShape(deck.slice(0, 2), deck.slice(2, 5));
      assert(known.has(r.shape.key), `unknown shape ${r.shape.key}`);
      assert(r.shape.outs === null || r.shape.outs >= 0, 'outs are never negative');
      // Every card named as an out has to still be in the deck.
      const seen = new Set([...deck.slice(0, 2), ...deck.slice(2, 5)]);
      for (const draw of r.draws) {
        for (const card of draw.cards) assert(!seen.has(card), 'an out that is already on the table');
      }
    }
  });

  it('agrees with the evaluator about whether anything is made', () => {
    const rng = makeRng(77);
    for (let i = 0; i < 2000; i++) {
      const deck = shuffle(rng, makeDeck());
      const r = readShape(deck.slice(0, 2), deck.slice(2, 5));
      equal(r.made, r.madeCategory >= CAT.PAIR, 'made and the category disagree');
      if (r.made) equal(r.draws.some((d) => d.key === 'overcards'), false,
        'a made hand cannot also be two overcards');
    }
  });

  it('gives every out it names a card that actually completes the draw', () => {
    // A named out that does not get there would teach a wrong count, which is
    // worse than teaching no count.
    const rng = makeRng(5);
    let checked = 0;
    for (let i = 0; i < 600; i++) {
      const deck = shuffle(rng, makeDeck());
      const hole = deck.slice(0, 2);
      const board = deck.slice(2, 5);
      const r = readShape(hole, board);
      const flush = r.draws.find((d) => d.key === 'flush-draw');
      if (!flush) continue;
      for (const card of flush.cards) {
        const after = readShape(hole, [...board, card]);
        assert(after.madeCategory >= CAT.FLUSH, 'a flush out that does not make a flush');
      }
      checked++;
    }
    assert(checked > 20, `expected flush draws in the sample, got ${checked}`);
  });
});
