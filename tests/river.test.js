import { describe, it, assert, equal } from './harness.js';
import { VENUES } from '../src/js/data/venues.js';
import { BOSSES, BOSS_KEYS, bossFor, boatFor, BOATS, FLAGSHIP } from '../src/js/data/characters.js';
import { PROFILES } from '../src/js/engine/bots.js';
import { NL } from '../src/js/i18n/nl.js';

describe('the river: every stop has somebody to beat', () => {
  it('puts one boss at every stop, and nobody at two', () => {
    const seen = new Set();
    for (const v of VENUES) {
      const boss = bossFor(v.boss);
      assert(boss, `${v.name} has no boss`);
      assert(!seen.has(boss.key), `${boss.name} owns two stops`);
      seen.add(boss.key);
    }
    equal(seen.size, BOSS_KEYS.length, 'a boss exists who owns no stop');
  });

  it('has each boss play the style the stop was built around', () => {
    // The boss is a face on an existing style, not a new engine. If the two
    // disagreed, the stop would teach one lesson and the table another.
    for (const v of VENUES) {
      const boss = bossFor(v.boss);
      equal(boss.plays, v.resident, `${boss.name} plays ${boss.plays} at a ${v.resident} stop`);
      assert(PROFILES[boss.plays], `${boss.name} plays a style the engine does not have`);
    }
  });

  it('gives every boss something to say at every moment the table asks for one', () => {
    for (const boss of Object.values(BOSSES)) {
      for (const field of ['name', 'short', 'title', 'hello', 'read', 'beat', 'beaten']) {
        assert(typeof boss[field] === 'string' && boss[field].trim(), `${boss.key} has no ${field}`);
      }
      assert(boss.brag.length && boss.sore.length, `${boss.key} is silent when a pot is won or lost`);
      assert(boss.keepsake && boss.keepsake.key && boss.keepsake.name, `${boss.key} leaves nothing behind`);
    }
    const keepsakes = Object.values(BOSSES).map((b) => b.keepsake.key);
    equal(new Set(keepsakes).size, keepsakes.length, 'two bosses leave the same keepsake');
  });

  it('draws a landmark for every stop', () => {
    const landmarks = VENUES.map((v) => v.landmark);
    assert(landmarks.every(Boolean), 'a stop has nothing on the map');
    equal(new Set(landmarks).size, landmarks.length, 'two stops share a landmark');
  });
});

describe('the river: the boat is a picture of the climb, not a purchase', () => {
  it('upgrades with the furthest stop reached, and never goes back', () => {
    equal(boatFor(0).key, 'rowboat');
    equal(boatFor(1).key, 'rowboat');
    equal(boatFor(2).key, 'skiff');
    equal(boatFor(4).key, 'launch');
    equal(boatFor(7).key, 'sternwheeler');
    let last = -1;
    for (let i = 0; i < VENUES.length; i++) {
      const rank = BOATS.findIndex((b) => b.key === boatFor(i).key);
      assert(rank >= last, `stop ${i} hands back a smaller boat`);
      last = rank;
    }
  });

  it('keeps the flagship for beating the Commodore', () => {
    equal(boatFor(7, false).key, 'sternwheeler', 'reaching the delta is not the same as winning it');
    equal(boatFor(7, true).key, FLAGSHIP.key);
  });
});

describe('the river: it speaks Dutch too', () => {
  it('translates every stop and every line a boss can say', () => {
    const missing = [];
    const need = (s) => { if (!NL[s]) missing.push(s); };
    for (const v of VENUES) [v.name, v.where, v.colour].forEach(need);
    for (const b of Object.values(BOSSES)) {
      [b.name, b.title, b.hello, b.read, b.beat, b.beaten, b.keepsake.name, ...b.brag, ...b.sore].forEach(need);
    }
    for (const boat of [...BOATS, FLAGSHIP]) need(boat.name);
    assert(!missing.length, `no Dutch for:\n      ${missing.join('\n      ')}`);
  });
});
