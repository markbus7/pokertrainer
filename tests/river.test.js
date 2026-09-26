import { describe, it, assert, equal } from './harness.js';
import { VENUES } from '../src/js/data/venues.js';
import { BOSSES, BOSS_KEYS, bossFor, boatFor, BOATS, FLAGSHIP } from '../src/js/data/characters.js';
import { PROFILES } from '../src/js/engine/bots.js';
import { NL } from '../src/js/i18n/nl.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { MAP, stopPoint, riverGeometry, LANDMARKS, BOAT_ART, mapSvg } from '../src/js/ui/riverArt.js';
import { PORTRAIT_KEYS } from '../src/js/ui/portraits.js';
import { riverState, stopStatus } from '../src/js/ui/screenRiver.js';
import { Profile } from '../src/js/state/profile.js';
import { setLang } from '../src/js/i18n/index.js';

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
    for (const key of landmarks) assert(LANDMARKS[key], `nothing is drawn for the ${key}`);
  });

  it('points every boss at a lesson that teaches how to beat them', () => {
    // The stop offers "Study first" before you sit down; a lesson that does
    // not exist would be a button to nowhere, and two bosses sharing one
    // would leave a lesson the river never sends anybody to.
    const ids = new Set(MODULE_META.map((m) => m.id));
    const lessons = Object.values(BOSSES).map((b) => b.lesson);
    for (const b of Object.values(BOSSES)) assert(ids.has(b.lesson), `${b.key} studies ${b.lesson}, which is not a module`);
    equal(new Set(lessons).size, lessons.length, 'two bosses send you to the same lesson');
  });

  it('has a face for everybody who can sit at a table', () => {
    for (const key of BOSS_KEYS) assert(PORTRAIT_KEYS.includes(key), `${key} has no portrait`);
    for (const key of Object.keys(PROFILES)) assert(PORTRAIT_KEYS.includes(key), `the ${key} regular has no portrait`);
  });
});

describe('the river: the map is drawn where the stops are', () => {
  it('keeps every stop on dry land, clear of the water', () => {
    const { xAt, widthAt } = riverGeometry();
    for (const v of VENUES) {
      const p = stopPoint(v.index);
      const gap = Math.abs(p.x - xAt(p.y)) - widthAt(p.y) / 2;
      // A landmark is drawn about 80 across, so its centre needs 40 of land.
      assert(gap > 44, `${v.name} sits ${gap.toFixed(0)} from the water — its drawing would be in the river`);
      assert(p.x > 50 && p.x < MAP.W - 50, `${v.name} is drawn off the edge of the map`);
      assert(p.y > 100 && p.y < MAP.H - 100, `${v.name} is off the top or bottom of the map`);
    }
  });

  it('alternates the banks, so no two name plates stack up', () => {
    for (let i = 1; i < VENUES.length; i++) {
      assert(stopPoint(i).side !== stopPoint(i - 1).side, `stops ${i - 1} and ${i} share a bank`);
      assert(stopPoint(i).y - stopPoint(i - 1).y >= 140, `stops ${i - 1} and ${i} are drawn on top of each other`);
    }
  });

  it('runs the river down the map without doubling back', () => {
    // xAt() assumes the river only ever flows down the page; a loop would
    // put a stop's jetty on the wrong stretch of water.
    const { center } = riverGeometry();
    for (let i = 1; i < center.length; i++) {
      assert(center[i][1] >= center[i - 1][1], `the river turns back upstream at sample ${i}`);
    }
  });

  it('draws the boat you have at the stop you are at', () => {
    for (const boat of [...BOATS, FLAGSHIP]) assert(BOAT_ART[boat.key], `the ${boat.key} is never drawn`);
    const svg = mapSvg({
      here: 2, best: 3, open: 3, beaten: new Set([0, 1]), boat: 'skiff', landmarks: VENUES.map((v) => v.landmark),
    });
    equal((svg.match(/class="landmark/g) || []).length, VENUES.length, 'a stop is missing from the map');
    equal((svg.match(/class="landmark here/g) || []).length, 1, 'more than one stop claims to be where you are');
    assert(/class="your-boat"/.test(svg), 'your boat is not on the water');
    assert(!/#[0-9a-f]{6}/i.test(svg), 'the map paints a colour of its own instead of the room\'s');
  });
});

describe('the river: what a stop says about itself', () => {
  const at = (bankroll, career) => {
    const p = new Profile({ bankroll, career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [], ...career } }, null);
    return riverState(p);
  };

  it('opens a stop when the purse can stand its stakes, and not before', () => {
    setLang('en');
    const poor = at(100, {});
    equal(stopStatus(VENUES[0], poor).key, 'here');
    equal(stopStatus(VENUES[1], poor).key, 'shut', '$100 is not a purse for NL5');
    assert(/\$150/.test(stopStatus(VENUES[1], poor).text), 'a shut stop does not say what it takes');
    const rich = at(400, {});
    equal(stopStatus(VENUES[2], rich).key, 'open', '$400 is a purse for NL10');
    equal(stopStatus(VENUES[3], rich).key, 'shut');
  });

  it('marks the tables you have taken, and gives you the boat for how far you got', () => {
    const s = at(3200, { venue: 'nl50', best: 'nl100', beaten: ['nl2', 'nl5', 'nl10'] });
    equal(stopStatus(VENUES[1], s).key, 'beaten');
    equal(s.here.key, 'nl50');
    equal(s.best, 5, 'the furthest stop reached is where the boat comes from');
    equal(s.boat.key, 'launch');
    equal(at(20000, { venue: 'nl500', best: 'nl500', beaten: ['nl500'] }).boat.key, FLAGSHIP.key);
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
