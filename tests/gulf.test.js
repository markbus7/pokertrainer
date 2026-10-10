/**
 * The Gulf: the second act's drills and its place on the road.
 *
 * What these pin: every hand-written spot deals real cards, none twice, and
 * offers one right answer among different ones; push or fold answers by the
 * same shares the bots shove with, and never asks about a hand on the edge;
 * every Gulf port has a chapter on the road, opened only by taking the delta.
 */

import { describe, it, assert, equal } from './harness.js';
import { BANKS, shoveDrill, callShoveDrill, shoveShare, handPercentile, SEAT_WIDTH } from '../src/js/trainers/gulf.js';
import { generateQuestion } from '../src/js/trainers/index.js';
import { parseCards, handKey } from '../src/js/core/cards.js';
import { makeRng } from '../src/js/core/rng.js';
import { gulfFog, PORT_POINTS } from '../src/js/ui/gulfMap.js';
import { ROAD } from '../src/js/data/journey.js';
import { GULF, RIVER } from '../src/js/data/venues.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { CATALOGUE, missingFor } from '../src/js/state/economy.js';
import { Profile } from '../src/js/state/profile.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

describe('the Gulf\'s drills', () => {
  it('deals real cards in every written spot, none of them twice', () => {
    for (const [module, bank] of Object.entries(BANKS)) {
      assert(bank.length >= 6, `${module} has too few spots to drill`);
      for (const s of bank) {
        const cards = [...(s.hole ? parseCards(s.hole) : []), ...(s.board ? parseCards(s.board) : [])];
        equal(new Set(cards).size, cards.length, `${module}: a card is dealt twice in "${s.q.slice(0, 40)}"`);
        if (s.hole) equal(parseCards(s.hole).length, 2, `${module}: a hand is not two cards`);
        equal(new Set([s.right, ...s.wrong]).size, 3, `${module}: two answers are the same in "${s.q.slice(0, 40)}"`);
        assert(s.why && s.why.length > 40, `${module}: a spot does not say why`);
      }
    }
  });

  it('asks every Gulf chapter as a drill with exactly one right answer', () => {
    const rng = makeRng(3);
    for (const id of ['value', 'streets', 'threebet', 'multiway', 'pushfold']) {
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion(id, rng, 4);
        equal(q.options.filter((o) => o.key === q.answer).length, 1, `${id} has no single right answer`);
        assert(q.explanation && q.question, `${id} asks nothing or explains nothing`);
      }
    }
  });

  it('shoves wider later and shorter, and answers by that share, clear of the edge', () => {
    assert(shoveShare(10, 'BTN') > shoveShare(10, 'UTG'), 'the button does not shove wider than under the gun');
    assert(shoveShare(4, 'CO') > shoveShare(10, 'CO'), 'a shorter stack does not shove wider');
    assert(SEAT_WIDTH.SB > SEAT_WIDTH.BTN, 'the small blind is not the widest');
    const rng = makeRng(11);
    for (let i = 0; i < 200; i++) {
      const q = shoveDrill(rng);
      const key = handKey(q.scenario.hole);
      const stack = Number(/You have (\d+) big blinds/.exec(q.question)[1]);
      const cut = shoveShare(stack, q.scenario.position);
      const p = handPercentile(key);
      assert(Math.abs(p - cut) >= 0.12, `${key} at ${stack} bb is too close to the edge to ask`);
      const right = q.options.find((o) => o.key === q.answer).label;
      equal(right, p < cut ? 'Shove all in' : 'Fold', `${key} at ${stack} bb from ${q.scenario.position}`);
      assert(q.options.some((o) => /Raise to 2.5/.test(o.label)), 'the raise is not offered as the mistake it is');
    }
    for (let i = 0; i < 100; i++) {
      const q = callShoveDrill(rng);
      assert([8, 10, 12].includes(Number(/shoves (\d+) big blinds/.exec(q.question)[1])), 'a call question at a stack too short to trust');
    }
  });
});

describe('the Gulf on the road', () => {
  it('has a chapter for every port, after the river\'s, each teaching a Gulf chapter', () => {
    equal(ROAD.length, RIVER.length + GULF.length);
    GULF.forEach((v, i) => {
      const chapter = ROAD[RIVER.length + i];
      equal(chapter.stop, v.key);
      for (const id of chapter.lessons) {
        const meta = MODULE_META.find((m) => m.id === id);
        assert(meta && meta.act === 2, `${v.name} teaches ${id}, which is not a Gulf chapter`);
      }
    });
    const taught = ROAD.flatMap((c) => c.lessons);
    equal(new Set(taught).size, MODULE_META.length, 'a chapter is taught twice, or never');
  });

  it('keeps the Gulf\'s chapters on the shelf until the delta is taken', () => {
    const item = CATALOGUE.find((i) => i.key === 'lesson:value');
    const p = new Profile({}, memory());
    assert(missingFor(p, item).some((m) => m.key === 'river'), 'the Gulf\'s chapter is for sale before the river is won');
    p.career.beaten.push('nl2', 'nl5', 'nl10', 'nl25', 'nl50', 'nl100', 'nl200', 'nl500');
    assert(!missingFor(p, item).some((m) => m.key === 'river'), 'the river is won and the chapter is still shut for it');
    // The river's chapters never ask for the river.
    const river = CATALOGUE.find((i) => i.key === 'lesson:icm');
    assert(!river.needs.river, 'a river chapter waits for the river');
  });
});

describe('the Gulf: fog over the ports you have not reached', () => {
  it('clears the river\'s mouth and the first port before you have sailed, and lifts at the Admiralty', () => {
    const start = gulfFog({ best: -1 });
    equal(start.reach, 0);
    equal(start.holes.length, 2, 'more than the mouth and Salt Harbour are clear at the start');
    equal(gulfFog({ best: 2 }).reach, 3);
    equal(gulfFog({ best: PORT_POINTS.length - 1 }), null);
  });
});
