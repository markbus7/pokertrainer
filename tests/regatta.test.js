/**
 * Regattas: the blind clock, the prize list, and who finishes where.
 *
 * What these pin: the clock climbs and ends the game, the prize pool is paid
 * back in full (no rake, so an average player breaks even), ties on a single
 * hand are broken by who had fewer chips, and a replay pays only for a better
 * finish than the one held.
 */

import { describe, it, assert, equal, close } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { ROAD } from '../src/js/data/journey.js';
import { goalsFor } from '../src/js/state/journey.js';
import { NL } from '../src/js/i18n/nl.js';
import {
  FIELD, START_STACK, LEVELS, LEVEL_HANDS, blindsFor, SHARES, payouts, prizeFor, placesFor, PLACE_PEARLS, placePearls, standing, ordinal,
} from '../src/js/state/regatta.js';

describe('the regatta: the blind clock', () => {
  it('starts at a fortieth of a stack and goes up on schedule', () => {
    const first = blindsFor(0);
    equal(first.big, 50);
    equal(START_STACK / first.big, 30, 'the game does not open at thirty big blinds');
    equal(blindsFor(LEVEL_HANDS - 1).level, 0);
    equal(blindsFor(LEVEL_HANDS).level, 1);
    equal(blindsFor(LEVEL_HANDS).left, LEVEL_HANDS);
  });

  it('only goes up, with the small blind half the big, and stops at the last level', () => {
    let prev = 0;
    for (const [small, big] of LEVELS) {
      assert(big > prev, 'the blinds went down or stood still');
      equal(small * 2, big);
      prev = big;
    }
    const last = blindsFor(10_000);
    assert(last.last && last.level === LEVELS.length - 1);
  });

  it('ends a game of six: the last level is a few big blinds for the biggest stack in play', () => {
    const total = START_STACK * FIELD;
    const [, big] = LEVELS[LEVELS.length - 1];
    assert(total / big <= 5, `the last level is still ${total / big} big blinds of all the chips on the table`);
    // And it takes long enough to be a game: the clock does not reach a quarter of the chips before 30 hands.
    assert(blindsFor(29).big * 4 < total);
  });
});

describe('the regatta: the prize list', () => {
  it('pays back the whole pool, in half, three tenths and a fifth', () => {
    equal(SHARES.reduce((s, x) => s + x, 0), 1);
    const p = payouts(2);
    close(p[0], 6, 0.001);
    close(p[1], 3.6, 0.001);
    close(p[2], 2.4, 0.001);
    close(p.reduce((s, x) => s + x, 0), 2 * FIELD, 0.01, 'the prizes are not the pool');
  });

  it('means a player no better than the field breaks even', () => {
    const entry = 10;
    const average = payouts(entry).reduce((s, x) => s + x, 0) / FIELD;
    close(average, entry, 0.01, 'a field of equals loses or wins money');
  });

  it('pays the top three and nothing for the rest', () => {
    assert(prizeFor(1, 5) > prizeFor(2, 5) && prizeFor(2, 5) > prizeFor(3, 5) && prizeFor(3, 5) > 0);
    equal(prizeFor(4, 5), 0);
    equal(prizeFor(6, 5), 0);
    equal(prizeFor(0, 5), 0);
  });
});

describe('the regatta: who finishes where', () => {
  it('gives the place equal to the players alive when you go', () => {
    const [one] = placesFor(6, [{ id: 'a', stack: 300 }]);
    equal(one.place, 6);
    equal(placesFor(3, [{ id: 'b', stack: 80 }])[0].place, 3);
  });

  it('breaks a tie on one hand by who started it with fewer chips', () => {
    const places = placesFor(4, [{ id: 'big', stack: 900 }, { id: 'small', stack: 200 }]);
    const by = Object.fromEntries(places.map((p) => [p.id, p.place]));
    equal(by.small, 4, 'the shorter stack did not finish last');
    equal(by.big, 3);
  });

  it('knows when it is over, for the reader', () => {
    assert(!standing({ heroStack: 800, rivalsAlive: 3 }).over);
    equal(standing({ heroStack: 0, rivalsAlive: 3, aliveBeforeHeroOut: 4 }).place, 4);
    equal(standing({ heroStack: 0, rivalsAlive: 2 }).place, 3);
    equal(standing({ heroStack: 9000, rivalsAlive: 0 }).place, 1);
  });
});

describe('the regatta: what a finish pays in pearls', () => {
  it('pays only for improving on the best you hold, so a replay is for a better finish', () => {
    equal(placePearls(0, null, 3), PLACE_PEARLS[3]);
    equal(placePearls(0, 3, 3), 0, 'the same finish paid twice');
    equal(placePearls(0, 3, 2), PLACE_PEARLS[2] - PLACE_PEARLS[3]);
    equal(placePearls(0, 2, 3), 0, 'a worse finish than the best paid');
    equal(placePearls(0, null, 4), 0, 'a finish outside the money paid');
    equal(placePearls(0, null, 1), PLACE_PEARLS[1]);
  });

  it('pays more the further down the river', () => {
    assert(placePearls(7, null, 1) > placePearls(0, null, 1));
  });
});

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('the regatta: the record', () => {
  it('starts empty, and keeps entries, wins, money places and the net', () => {
    const p = Profile.load(memory());
    equal(JSON.stringify(p.regattaRecord('nl10')), JSON.stringify({ entered: 0, wins: 0, cashes: 0, best: 0, net: 0 }));
    const a = p.noteRegatta('nl10', { place: 4, entry: 10, prize: 0 });
    equal(a.bestBefore, 0);
    const b = p.noteRegatta('nl10', { place: 2, entry: 10, prize: 36 });
    equal(b.bestBefore, 4, 'the best before was not the fourth place');
    p.noteRegatta('nl10', { place: 1, entry: 10, prize: 60 });
    p.noteRegatta('nl10', { place: null, entry: 10, prize: 0 });
    const r = p.regattaRecord('nl10');
    equal(r.entered, 4);
    equal(r.wins, 1);
    equal(r.cashes, 2);
    equal(r.best, 1);
    close(r.net, (0 + 36 + 60 + 0) - 4 * 10, 0.001, 'the net is prizes less entries');
    equal(p.regattaRecord('nl5').entered, 0, 'a record kept at the wrong stop');
  });

  it('survives a reload, and a save from before regattas', () => {
    const store = memory();
    const p = Profile.load(store);
    p.noteRegatta('nl25', { place: 3, entry: 25, prize: 30 });
    const q = Profile.load(store);
    equal(q.regattaRecord('nl25').cashes, 1);
    equal(Profile.load(memory()).regattaRecord('nl25').entered, 0);
  });

  it('counts a withdrawal as an entry with no place, and keeps the best', () => {
    const p = Profile.load(memory());
    p.noteRegatta('nl10', { place: 3, entry: 10, prize: 12 });
    p.noteRegatta('nl10', { place: null, entry: 10, prize: 0 });
    equal(p.regattaRecord('nl10').best, 3);
    equal(p.regattaRecord('nl10').entered, 2);
  });
});

describe('the regatta: on the road, and in two languages', () => {
  it('is a bonus where it is offered, done by finishing in the money', () => {
    const chapter = ROAD.find((c) => c.bonus.some((b) => b.kind === 'regatta'));
    assert(chapter, 'no city offers the Regatta');
    const p = Profile.load(memory());
    const goal = () => goalsFor(p, chapter).find((g) => g.kind === 'regatta');
    assert(goal() && !goal().required, 'the Regatta is required, and would hold a city up');
    assert(!goal().done);
    p.noteRegatta(chapter.stop, { place: 4, entry: 5, prize: 0 });
    assert(!goal().done, 'finishing fourth is in the money');
    p.noteRegatta(chapter.stop, { place: 3, entry: 5, prize: 6 });
    assert(goal().done);
  });

  it('says its places in Dutch', () => {
    for (let n = 1; n <= FIELD; n++) assert(NL[ordinal(n)], `no Dutch for ${ordinal(n)}`);
    equal(ordinal(1), '1st');
    equal(ordinal(3), '3rd');
  });
});
