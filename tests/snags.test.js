/**
 * Your snags: the spots before the flop you went wrong in at a table,
 * gathered, practised and cleared.
 *
 * What these pin: a snag is one hand in one seat with one thing in front of
 * you, whatever else differs; a spot with no chart is not one; cleared stays
 * cleared until you go wrong there again at a table; a sitting asks each
 * snag only as often as it still needs; three right in a row clears it and
 * pays, a wrong answer starts it again; the question asked is the spot, and
 * its answer is the chart's; and all of it is in Dutch.
 */

import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { snagsOf } from '../src/js/state/lifetime.js';
import { openSnags, snagSitting, noteSnag, snagRecord, SNAG_CLEAR, SNAG_PEARLS, SEAT_WORDS, FACING_WORDS } from '../src/js/state/snags.js';
import { snagQuestion } from '../src/js/trainers/preflop.js';
import { preflopAdvice } from '../src/js/data/ranges.js';
import { makeRng } from '../src/js/core/rng.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const mistake = (over = {}) => ({ key: 'AJo', street: 'preflop', action: 'call', head: 'Too strong to just call', better: '3-bet', position: 'BTN', facing: 'raised', raiser: 'CO', at: 100, ...over });
const withMistakes = (list) => {
  const p = new Profile({}, memory());
  p.lifetime.mistakes = list;
  return p;
};

describe('your snags: gathered from the table', () => {
  it('makes one snag of the same hand, seat and spot, the most often first', () => {
    const snags = snagsOf({ mistakes: [
      mistake({ at: 300 }), mistake({ at: 200, raiser: null }), mistake({ key: 'K9o', position: 'UTG', facing: 'first', raiser: null }),
      mistake({ position: 'CO', raiser: 'HJ' }),
    ] });
    equal(snags.length, 3);
    equal(snags[0].id, 'AJo|BTN|raised');
    equal(snags[0].times, 2);
    equal(snags[0].last, 300);
    equal(snags[0].raiser, 'CO', 'the raiser is kept from whichever mistake knew it');
  });

  it('leaves out what is not a spot before the flop with a chart', () => {
    const snags = snagsOf({ mistakes: [
      mistake({ street: 'flop', facing: 'bet' }),
      mistake({ position: 'BB', facing: 'limped' }),
      mistake({ position: null }),
      mistake({ facing: null }),
    ] });
    equal(snags.length, 0);
  });

  it('keeps a cleared snag off the list until it goes wrong again at a table', () => {
    const life = { mistakes: [mistake({ at: 100 })] };
    equal(snagsOf(life, { 'AJo|BTN|raised': { cleared: 150 } }).length, 0);
    life.mistakes.unshift(mistake({ at: 200 }));
    equal(snagsOf(life, { 'AJo|BTN|raised': { cleared: 150 } }).length, 1, 'gone wrong again after it was cleared');
  });
});

describe('your snags: sailed in practice', () => {
  it('asks each snag only as often as it still needs, and not twice running when it can help it', () => {
    const rng = makeRng(7);
    const spots = ['a', 'b', 'c'].map((id) => ({ id, streak: 0 }));
    const sitting = snagSitting(spots, rng);
    equal(sitting.length, SNAG_CLEAR * 3 > 8 ? 8 : SNAG_CLEAR * 3);
    for (let i = 1; i < sitting.length; i++) assert(sitting[i].id !== sitting[i - 1].id || sitting.slice(i).every((s) => s.id === sitting[i].id), 'the same snag twice in a row');
    equal(snagSitting([{ id: 'x', streak: 2 }], rng).length, 1, 'one more right clears it');
    equal(snagSitting([], rng).length, 0);
    equal(snagSitting(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, streak: 0 })), rng).filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i).length, 4, 'four snags at most');
  });

  it('clears a snag on the third right in a row and pays for it; wrong starts it again', () => {
    const p = withMistakes([mistake()]);
    const id = 'AJo|BTN|raised';
    equal(openSnags(p).length, 1);
    equal(noteSnag(p, id, true, 500).streak, 1);
    equal(noteSnag(p, id, false, 500).streak, 0, 'wrong: back to the start');
    noteSnag(p, id, true, 500);
    noteSnag(p, id, true, 500);
    equal(openSnags(p)[0].streak, 2);
    const before = p.pearls;
    const done = noteSnag(p, id, true, 500);
    assert(done.cleared, 'cleared on the third');
    equal(p.pearls - before, SNAG_PEARLS);
    equal(openSnags(p).length, 0);
  });

  it('reads the record back as numbers, whatever was stored', () => {
    const p = withMistakes([]);
    p.data.snags = { 'AJo|BTN|raised': { streak: 99, cleared: 'yes' }, bad: 'x', [`${'x'.repeat(30)}`]: { streak: 1 } };
    const r = snagRecord(p);
    equal(r['AJo|BTN|raised'].streak, SNAG_CLEAR);
    equal(r['AJo|BTN|raised'].cleared, 0);
    equal(Object.keys(r).length, 1);
    p.data.snags = [1, 2];
    equal(Object.keys(snagRecord(p)).length, 0);
  });
});

describe('your snags: the question is the spot', () => {
  const rng = makeRng(11);
  it('deals the hand in the seat, against the raiser it was, with the chart\'s answer', () => {
    const q = snagQuestion({ id: 'AJo|BTN|raised', key: 'AJo', position: 'BTN', facing: 'raised', raiser: 'CO', head: 'Too strong to just call' }, rng);
    equal(q.scenario.position, 'BTN');
    equal(q.scenario.raiser, 'CO');
    equal(q.snag, 'AJo|BTN|raised');
    const advice = preflopAdvice('AJo', 'BTN', { action: 'vs_raise', raiser: 'CO' });
    const want = advice.action === 'raise' ? '3-bet' : advice.action === 'call' ? 'Call' : 'Fold';
    equal(q.options.find((o) => o.key === q.answer).label, want);
    assert(/Last time at a table: “Too strong to just call”/.test(q.explanation));
  });

  it('first in and after a limp are raise or fold, by the opening chart', () => {
    for (const [key, position, facing] of [['72o', 'UTG', 'first'], ['AKs', 'UTG', 'first'], ['K9s', 'SB', 'limped'], ['32o', 'CO', 'limped']]) {
      const q = snagQuestion({ id: 'x', key, position, facing }, rng);
      const want = preflopAdvice(key, position).action === 'raise' ? 'Raise' : 'Fold';
      equal(q.options.find((o) => o.key === q.answer).label, want, `${key} ${position} ${facing}`);
      equal(q.options.length, 3);
    }
  });

  it('a raise in front comes from a seat that acts before yours', () => {
    for (let i = 0; i < 30; i++) {
      const q = snagQuestion({ id: 'x', key: 'QQ', position: 'HJ', facing: 'raised', raiser: 'BTN' }, rng);
      equal(q.scenario.raiser, 'UTG', 'only under the gun can open before the hijack');
    }
  });

  it('says all of it in Dutch', () => {
    const texts = [...Object.values(SEAT_WORDS), ...Object.values(FACING_WORDS)];
    const missing = texts.filter((x) => !NL[x]);
    assert(missing.length === 0, `no Dutch for: ${missing.join(' | ')}`);
  });
});
