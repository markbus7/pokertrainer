import { describe, it, assert, equal } from './harness.js';
import { VENUES, RIVER, GULF, RIVER_END, LAST_TABLE } from '../src/js/data/venues.js';
import { gulfSvg, PORT_POINTS, GULF as GULF_CHART } from '../src/js/ui/gulfMap.js';
import {
  BOSSES, BOSS_KEYS, bossFor, boatEarnedBy, BOATS, FLAGSHIP, MENTOR, ASSAYER, RACE, SHIPWRIGHT,
} from '../src/js/data/characters.js';
import { PROFILES } from '../src/js/engine/bots.js';
import { NL } from '../src/js/i18n/nl.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { LANDMARKS, BOAT_ART } from '../src/js/ui/riverArt.js';
import {
  WORLD, STOP_POINTS, PLACES, WATER_NAMES, worldGeometry, worldSvg, voyage, isDry,
} from '../src/js/ui/worldMap.js';
import { PORTRAIT_KEYS } from '../src/js/ui/portraits.js';
import { riverState, stopStatus } from '../src/js/ui/screenRiver.js';
import { Profile } from '../src/js/state/profile.js';
import { setLang } from '../src/js/i18n/index.js';
import { raceMargin } from '../src/js/ui/place.js';

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
    assert(PORTRAIT_KEYS.includes(MENTOR.key), 'Silas has no face');
    assert(PORTRAIT_KEYS.includes(ASSAYER.key), 'the assayer has no face');
  });

  it('draws the places you study as well as the places you play', () => {
    for (const key of ['school', 'pilothouse', 'assay', 'race']) assert(LANDMARKS[key], `nothing is drawn for the ${key}`);
  });

  it('gives the assayer and the Belle enough to say that a run does not repeat itself', () => {
    assert(ASSAYER.right.length >= 3 && ASSAYER.wrong.length >= 3, 'the assayer repeats herself within a session');
    for (const key of ['high', 'mid', 'low']) assert(ASSAYER.done[key], `the assayer has nothing to say for a ${key} session`);
    assert(RACE.gaining.length >= 3 && RACE.falling.length >= 3, 'Rourke repeats himself within a race');
    assert(bossFor(RACE.rival), 'the Belle is raced by somebody who does not exist');
  });
});

describe('the river: the race is the pass mark, told as a race', () => {
  it('puts the Belle between the pass mark and one short of it, so there is never a dead heat', () => {
    // The Belle finishes on 7.5 reaches of 10, so eight right is a win and
    // seven is a loss — exactly the pass mark, never a tie to explain.
    equal(raceMargin(8, 8), 'won by half a length');
    equal(raceMargin(7, 8), 'lost by half a length');
  });

  it('tells a bigger win or loss in lengths, the way it would be told on the landing', () => {
    equal(raceMargin(10, 8), 'won by 2½ lengths');
    equal(raceMargin(9, 8), 'won by 1½ lengths');
    equal(raceMargin(0, 8), 'lost by 7½ lengths');
  });

  it('gives Silas a word for every reason he can point you at a chapter', () => {
    // nextUp() gives one of these reasons; a reason with no line would put
    // an empty bubble at the top of the school.
    for (const reason of ['untouched', 'thin', 'lesson', 'fresh', 'weakest']) {
      assert(MENTOR.next[reason] && MENTOR.next[reason].includes('{module}'), `Silas has nothing to say for "${reason}"`);
    }
    assert(MENTOR.right.length >= 3 && MENTOR.wrong.length >= 3, 'Silas repeats himself within a run');
  });
});

describe('the river: the chart is drawn where things are', () => {
  it('has a place on the chart for every stop', () => {
    equal(STOP_POINTS.length, RIVER.length, 'a stop has nowhere to stand');
  });

  it('keeps every stop on dry land, clear of the water', () => {
    RIVER.forEach((v, i) => {
      const p = STOP_POINTS[i];
      assert(p.x > 60 && p.x < WORLD.W - 60 && p.y > 60 && p.y < WORLD.H - 60, `${v.name} is drawn off the edge of the chart`);
      // A landmark is drawn about 80 across; the last is the Commodore's
      // boat at anchor between the mouths, so it only has to be out of the sea.
      const pad = i === RIVER.length - 1 ? 0 : 44;
      assert(isDry(p.x, p.y, pad), `${v.name} is drawn in the water`);
    });
  });

  it('puts every other place on land too — except the steamer, which is afloat', () => {
    for (const place of PLACES) {
      if (place.key === 'pilothouse') {
        assert(!isDry(place.x, place.y), 'the pilot house steamer should be laid up on the oxbow, not on land');
        continue;
      }
      assert(isDry(place.x, place.y, 44), `${place.name} is drawn in the water`);
    }
  });

  it('sends each place to a screen the app has', () => {
    const routes = new Set(['train', 'play', 'ranges', 'lab', 'gauntlet', 'store', 'boatyard', 'catchbook']);
    equal(new Set(PLACES.map((p) => p.key)).size, PLACES.length, 'two places share a key');
    for (const place of PLACES) {
      assert(routes.has(place.route), `${place.name} leads nowhere`);
      assert(LANDMARKS[place.landmark], `${place.name} has no drawing`);
    }
  });

  it('runs the river east without doubling back', () => {
    // yAt() assumes the river only ever flows east; a loop would put a
    // stop's jetty on the wrong stretch of water.
    const { center } = worldGeometry();
    for (let i = 1; i < center.length; i++) {
      assert(center[i][0] >= center[i - 1][0], `the river turns back upstream at sample ${i}`);
    }
  });

  it('sails from any stop to any other along the water, without jumping', () => {
    for (const [from, to] of [[0, 7], [7, 0], [2, 3], [5, 1]]) {
      const path = voyage(from, to);
      assert(path.length >= 2, `no way from ${from} to ${to}`);
      for (let i = 1; i < path.length; i++) {
        const step = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        assert(step < 60, `the boat jumps ${step.toFixed(0)} between ${from} and ${to}`);
      }
      for (const [x, y] of path) assert(!isDry(x, y), `the boat runs aground at ${x.toFixed(0)},${y.toFixed(0)} between ${from} and ${to}`);
    }
    const there = voyage(0, 7);
    const back = voyage(7, 0);
    equal(there[0].join(), back[back.length - 1].join(), 'the way back ends somewhere else');
  });

  it('draws the boat you have at the stop you are at, and every place', () => {
    for (const boat of [...BOATS, FLAGSHIP]) assert(BOAT_ART[boat.key], `the ${boat.key} is never drawn`);
    const svg = worldSvg({
      here: 2, best: 3, open: 3, beaten: new Set([0, 1]), boat: 'skiff', landmarks: RIVER.map((v) => v.landmark),
    });
    equal((svg.match(/class="landmark/g) || []).length, RIVER.length, 'a stop is missing from the chart');
    equal((svg.match(/class="landmark here/g) || []).length, 1, 'more than one stop claims to be where you are');
    equal((svg.match(/class="place"/g) || []).length, PLACES.length, 'a place is missing from the chart');
    assert(/class="your-boat"/.test(svg), 'your boat is not on the water');
    assert(!/#[0-9a-f]{6}\b/i.test(svg), 'the chart paints a colour of its own instead of the room\'s');
  });

  it('carries its own colours where a stylesheet cannot be trusted to reach', () => {
    // On a phone the edge shading painted solid black: its gradient stops
    // took their colour from stylesheet rules, which that browser did not
    // apply, and a black stop covers everything drawn before it. Stops say
    // their colour themselves now, and every reference is written both ways.
    const svg = worldSvg({
      here: 0, best: 0, open: 0, beaten: new Set(), boat: 'rowboat', landmarks: RIVER.map((v) => v.landmark),
    });
    const stops = svg.match(/<stop[^>]*>/g) || [];
    assert(stops.length > 0, 'the chart has no gradient to check');
    for (const stop of stops) {
      assert(/stop-color="/.test(stop) && /stop-opacity="/.test(stop), `a gradient stop leaves its colour to the stylesheet: ${stop}`);
    }
    for (const ref of svg.match(/<(use|textPath)\b[^>]*>/g) || []) {
      assert(/ xlink:href="#/.test(ref) && / href="#/.test(ref), `a reference is only written one way: ${ref.slice(0, 80)}`);
    }
  });

  it('letters the waters, in Dutch as well', () => {
    const svg = worldSvg({
      here: 0, best: 0, open: 0, beaten: new Set(), boat: 'rowboat', landmarks: RIVER.map((v) => v.landmark),
    });
    for (const n of WATER_NAMES) {
      assert(svg.includes(n.text.toUpperCase()), `${n.text} is not lettered on the chart`);
      assert(NL[n.text], `${n.text} has no Dutch`);
    }
    setLang('nl');
    try {
      const nl = worldSvg({
        here: 0, best: 0, open: 0, beaten: new Set(), boat: 'rowboat', landmarks: RIVER.map((v) => v.landmark),
      });
      assert(nl.includes(NL['The Long River'].toUpperCase()), 'the Dutch chart still says The Long River');
    } finally {
      setLang('en');
    }
  });
});

describe('the river: what a stop says about itself', () => {
  const at = (bankroll, career) => {
    const p = new Profile({ bankroll, career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [], ...career } }, null);
    return riverState(p);
  };

  it('opens a stop when the purse can stand its stakes, and not before', () => {
    setLang('en');
    // Somebody who has already been down the river, so the road is open all
    // the way and the purse is the only thing left to say no.
    const been = { best: 'nl500' };
    const poor = at(100, been);
    equal(stopStatus(VENUES[0], poor).key, 'here');
    equal(stopStatus(VENUES[1], poor).key, 'shut', '$100 is not a purse for NL5');
    assert(/\$150/.test(stopStatus(VENUES[1], poor).text), 'a shut stop does not say what it takes');
    const rich = at(400, been);
    equal(stopStatus(VENUES[2], rich).key, 'open', '$400 is a purse for NL10');
    equal(stopStatus(VENUES[3], rich).key, 'shut');
  });

  it('keeps a city shut until the one before it is finished, whatever the purse says', () => {
    setLang('en');
    const fresh = at(20000, {});
    equal(stopStatus(VENUES[0], fresh).key, 'here');
    for (let i = 1; i < VENUES.length; i++) {
      const status = stopStatus(VENUES[i], fresh);
      equal(status.key, 'locked', `${VENUES[i].name} was open to somebody who has done nothing`);
      assert(/^After /.test(status.text), `a closed city does not say what opens it: ${status.text}`);
      assert(status.text.includes(VENUES[i - 1].name), `${VENUES[i].name} is not opened by ${VENUES[i - 1].name}`);
    }
    // Finish the first city (read it, play it, take it) and the next one opens.
    const done = new Profile({
      bankroll: 20000,
      career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: ['nl2'], played: {} },
      walkthroughs: ['hand-rankings', 'pot-odds'],
      economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings', 'lesson:pot-odds'] },
    }, null);
    const after = riverState(done);
    equal(stopStatus(VENUES[1], after).key, 'open');
    equal(stopStatus(VENUES[2], after).key, 'locked');
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

describe('the river: boats are bought, and each one does more', () => {
  it('sells bigger boats for more pearls, further down the river', () => {
    for (let i = 1; i < BOATS.length; i++) {
      const [a, b] = [BOATS[i - 1], BOATS[i]];
      assert(b.price > a.price, `the ${b.key} costs no more than the ${a.key}`);
      assert(b.reach >= a.reach, `the ${b.key} is sold nearer the start than the ${a.key}`);
      assert(b.berths > a.berths, `the ${b.key} carries no more companions than the ${a.key}`);
      assert(b.bonus > a.bonus, `the ${b.key}'s strongbox is no heavier than the ${a.key}'s`);
    }
    equal(BOATS[0].price, 0, 'the rowboat is borrowed, not bought');
    assert(FLAGSHIP.berths >= BOATS[BOATS.length - 1].berths && FLAGSHIP.bonus > BOATS[BOATS.length - 1].bonus,
      'the Commodore\'s flagship is not the best boat on the river');
  });

  it('keeps the boat a save had already earned before the boatyard opened', () => {
    equal(boatEarnedBy(0), 'rowboat');
    equal(boatEarnedBy(1), 'rowboat');
    equal(boatEarnedBy(2), 'skiff');
    equal(boatEarnedBy(4), 'launch');
    equal(boatEarnedBy(7), 'sternwheeler');
  });

  it('gives the shipwright something to say to every customer', () => {
    for (const line of ['hello', 'poor', 'far']) assert(SHIPWRIGHT[line], `Amos has nothing to say for "${line}"`);
    assert(SHIPWRIGHT.thanks.length >= 3, 'Amos thanks everybody the same way');
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
    [MENTOR.title, MENTOR.school, MENTOR.pilot, MENTOR.shoals, MENTOR.asks, MENTOR.table,
      MENTOR.log, MENTOR.charts, MENTOR.almanac,
      ...Object.values(MENTOR.next), ...MENTOR.right, ...MENTOR.wrong].forEach(need);
    [ASSAYER.name, ASSAYER.title, ASSAYER.hello, ...ASSAYER.right, ...ASSAYER.wrong, ...Object.values(ASSAYER.done)].forEach(need);
    [RACE.boat, RACE.hello, RACE.won, RACE.lost, ...RACE.gaining, ...RACE.falling].forEach(need);
    assert(!missing.length, `no Dutch for:\n      ${missing.join('\n      ')}`);
  });
});

describe('the Gulf: the second act, past the delta', () => {
  it('has five ports after the river, in order of stakes, the delta the river\'s end', () => {
    equal(RIVER.length, 8);
    equal(GULF.length, 5);
    equal(RIVER_END, 'nl500');
    equal(LAST_TABLE, 'nl25k');
    GULF.forEach((v, i) => {
      equal(v.index, RIVER.length + i, `${v.name} is out of order`);
      assert(v.entry > VENUES[v.index - 1].entry, `${v.name} is not dearer than the stop before it`);
      equal(v.act, 2);
    });
    assert(RIVER.every((v) => v.act === 1), 'a river stop thinks it is at sea');
  });

  it('draws every port on its own chart, inside it, apart from each other', () => {
    equal(PORT_POINTS.length, GULF.length, 'a port has nowhere to stand');
    for (const p of PORT_POINTS) {
      assert(p.x > 60 && p.x < GULF_CHART.W - 60 && p.y > 60 && p.y < GULF_CHART.H - 60, 'a port is drawn off the edge of the chart');
    }
    for (let i = 0; i < PORT_POINTS.length; i++) {
      for (let j = i + 1; j < PORT_POINTS.length; j++) {
        const d = Math.hypot(PORT_POINTS[i].x - PORT_POINTS[j].x, PORT_POINTS[i].y - PORT_POINTS[j].y);
        assert(d > 200, 'two ports are drawn on top of each other');
      }
    }
    const svg = gulfSvg({ here: 1, best: 2, open: 2, beaten: new Set([0]), boat: 'flagship' });
    equal((svg.match(/class="landmark/g) || []).length, GULF.length, 'a port is missing from the chart');
    equal((svg.match(/class="landmark here/g) || []).length, 1, 'more than one port claims to be where you are');
    assert(/class="your-boat"/.test(svg), 'your boat is not on the water');
    assert(!/#[0-9a-f]{6}\b/i.test(svg), 'the chart paints a colour of its own instead of the room\'s');
    // Still on the river: the boat waits at the mouth, and no port is "here".
    const river = gulfSvg({ here: -1, best: -1, open: -1, beaten: new Set(), boat: 'flagship' });
    equal((river.match(/class="landmark here/g) || []).length, 0);
    equal((river.match(/class="landmark shut/g) || []).length, GULF.length, 'a port is open before the river is won');
  });
});

