import { describe, it, assert, equal } from './harness.js';
import {
  WATERS, SPECIES, speciesOf, fishesIn, bites, landed, weighIn, logCatch, bookProgress,
} from '../src/js/data/fish.js';
import { fishSvg } from '../src/js/ui/fishArt.js';
import { MODULE_META } from '../src/js/data/curriculum.js';

const cast = (over) => ({
  street: 'preflop', action: 'fold', concept: 'preflop', level: 'good', helped: false,
  position: 'UTG', firstIn: true, toCall: 0, ...over,
});

describe('the Catch Book: what lands each fish', () => {
  it('every species lives in a known water, links a real chapter, and has a way to be caught', () => {
    const modules = MODULE_META.map((m) => m.id);
    for (const s of SPECIES) {
      assert(WATERS.some((w) => w.key === s.water), `${s.key} lives nowhere`);
      assert(s.module === null || modules.includes(s.module), `${s.key} links a chapter that does not exist: ${s.module}`);
      assert(typeof s.bite === 'function' || s.special, `${s.key} cannot be caught`);
      assert(s.how && s.name, `${s.key} has no name or bait`);
    }
    equal(new Set(SPECIES.map((s) => s.key)).size, SPECIES.length, 'two species share a key');
  });

  it('an open from the button the chart agrees with hooks a perch; the same open from under the gun does not', () => {
    const steal = cast({ action: 'raise', position: 'BTN' });
    assert(bites(steal, 0).includes('perch'));
    assert(!bites({ ...steal, position: 'UTG' }, 0).includes('perch'));
  });

  it('nothing is hooked with help, or by a mistake', () => {
    const steal = cast({ action: 'raise', position: 'BTN' });
    equal(bites({ ...steal, helped: true }, 0).length, 0);
    equal(bites({ ...steal, level: 'bad' }, 0).length, 0);
  });

  it('bigger fish only bite further down the river', () => {
    const threeBet = cast({ action: 'raise', firstIn: false, toCall: 6, position: 'CO' });
    assert(!bites(threeBet, 0).includes('walleye'), 'a walleye in the shallows');
    assert(!bites(threeBet, null).includes('walleye'), 'a walleye at the practice table');
    assert(bites(threeBet, 2).includes('walleye'));
    assert(bites(threeBet, 7).includes('walleye'), 'a fish is not caught below its own water');
    assert(fishesIn(null, 'shallows') && !fishesIn(5, 'delta') && fishesIn(6, 'delta'));
  });

  it('every species with a bite can actually be hooked by some decision, at the bottom of the river', () => {
    // A fish nobody can catch is a page that can never be filled.
    const spots = [
      cast({ action: 'raise', position: 'BTN' }),
      cast({ action: 'fold' }),
      cast({ action: 'call', position: 'BB', firstIn: false, toCall: 4 }),
      cast({ street: 'flop', concept: 'cbet', action: 'bet', firstIn: false }),
      cast({ street: 'turn', concept: 'outs', action: 'call', toCall: 10 }),
      cast({ street: 'flop', concept: 'pot-odds', action: 'fold', toCall: 10 }),
      cast({ action: 'raise', firstIn: false, toCall: 6, position: 'CO' }),
      cast({ street: 'turn', concept: 'mdf', action: 'call', toCall: 10 }),
      cast({ street: 'flop', concept: 'bluffing', action: 'bet', level: 'ok' }),
      cast({ street: 'river', concept: 'exploit', action: 'bet' }),
      cast({ street: 'turn', concept: 'spr', action: 'call', toCall: 40 }),
      cast({ street: 'river', concept: 'mdf', action: 'call', toCall: 20 }),
    ];
    const hooked = new Set(spots.flatMap((c) => bites(c, 7)));
    for (const s of SPECIES.filter((x) => x.bite)) assert(hooked.has(s.key), `nothing hooks a ${s.key}`);
  });

  it('a bluff only lands if everybody folds; a hero call only if it wins the showdown', () => {
    equal(landed(['gar'], { heroWon: true, showdown: false }).join(), 'gar');
    equal(landed(['gar'], { heroWon: true, showdown: true }).length, 0);
    equal(landed(['gar'], { heroWon: false, showdown: false }).length, 0);
    equal(landed(['catfish'], { heroWon: true, showdown: true }).join(), 'catfish');
    equal(landed(['catfish'], { heroWon: false, showdown: true }).length, 0);
    // A fish with no landing rule comes in however the hand ends, once.
    equal(landed(['perch', 'perch'], { heroWon: false, showdown: true }).join(), 'perch');
  });
});

describe('the Catch Book: the book itself', () => {
  it('weighs a catch by its pot, never at nothing', () => {
    equal(weighIn(40, 2), 5);
    equal(weighIn(3, 2), 0.5);
    equal(weighIn(10, 0), 0.5);
  });

  it('pays the water\'s reward for the first of a kind only, and keeps the record', () => {
    const book = {};
    const first = logCatch(book, 'trout', { weight: 3, where: 'The Ferry', at: 1 });
    assert(first.first && first.reward === 15);
    const smaller = logCatch(book, 'trout', { weight: 2, where: 'Cotton Row' });
    assert(!smaller.first && !smaller.record && smaller.reward === 0);
    const bigger = logCatch(book, 'trout', { weight: 9.5, where: 'Cotton Row' });
    assert(bigger.record);
    equal(bigger.previous, 3);
    equal(book.trout.count, 3);
    equal(book.trout.best, 9.5);
    equal(book.trout.where, 'Cotton Row');
    equal(logCatch(book, 'kraken', { weight: 1, where: 'x' }), null);
  });

  it('counts the book per water and in all', () => {
    const p = bookProgress({ perch: { count: 1 }, pike: { count: 1 } });
    equal(p.caught, 2);
    equal(p.total, SPECIES.length);
    equal(p.per.find((w) => w.water === 'shallows').caught, 1);
    equal(p.per.find((w) => w.water === 'legend').caught, 1);
  });

  it('draws every fish, caught and as a shadow, with no colour of its own', () => {
    for (const s of SPECIES) {
      const art = fishSvg(s);
      const shadow = fishSvg(s, { caught: false });
      assert(art.startsWith('<svg') && art.includes('fish-body'), `${s.key} is not drawn`);
      assert(!/NaN|undefined/.test(art + shadow), `${s.key} has a broken coordinate`);
      assert(!/#[0-9a-f]{3,6}\b|rgb\(/i.test(art), `${s.key} carries a colour of its own`);
      assert(!shadow.includes('fish-eye'), `${s.key}'s shadow gives it away`);
    }
    equal(speciesOf('pike').shape.crown, true);
  });
});
