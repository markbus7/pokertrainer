/**
 * The backwaters: towns off the river, found by rumour.
 *
 * What these pin: each town leaves the river at a real stop and plays one
 * style, with its local in the first chair; a town is uncharted until the
 * stop's owner tells you of it, and they only do once you have played there;
 * going up a backwater moors the boat at the town and going back to any stop
 * leaves it; a town's table is found by its id at its own stop and nowhere
 * else; the three goals come from the best sittings, pay once each, and say
 * when the town is done; the chart draws a question mark until you know and
 * the town after, with every town on dry land and the bayou's boat afloat;
 * and all of it is in Dutch.
 */

import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { BACKWATERS, backwaterFor, RUMOUR_HANDS } from '../src/js/data/backwaters.js';
import {
  heard, hear, rumourAt, townHere, tableAt, townTable, townGoals, townDone, noteTownSitting, goalPearls, handsKey, canGo, junctionOf,
} from '../src/js/state/backwaters.js';
import { VENUES, venueFor, RIVER } from '../src/js/data/venues.js';
import { getProfile } from '../src/js/engine/bots.js';
import { lobbyFor } from '../src/js/state/lobby.js';
import { TOWN_POINTS, worldSvg, isDry } from '../src/js/ui/worldMap.js';
import { LANDMARKS } from '../src/js/ui/riverArt.js';
import { portraitSvg } from '../src/js/ui/portraits.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const fresh = (data = {}) => new Profile(data, memory());

describe('the backwaters: what they are', () => {
  it('has three towns, each off a stop on the river and playing one style', () => {
    equal(BACKWATERS.length, 3);
    const riverKeys = new Set(RIVER.map((v) => v.key));
    for (const town of BACKWATERS) {
      assert(riverKeys.has(town.junction), `${town.name} leaves the river from nowhere`);
      equal(town.lineup.length, 5, `${town.name} does not seat five others`);
      equal(town.lineup[0], town.local.plays, `${town.name}'s local is not in the first chair`);
      for (const style of town.lineup) assert(getProfile(style), `${town.name} seats a style the engine does not have: ${style}`);
      // The lesson is one style turned all the way up: most of the table plays like the local.
      const same = town.lineup.filter((s) => s === town.local.plays).length;
      assert(same >= 3, `${town.name} is not one kind of player: ${town.lineup.join(', ')}`);
      assert(LANDMARKS[town.landmark], `${town.name} has no drawing`);
      assert(/<svg/.test(portraitSvg(town.local.key)) && !/fill="#3a3a40"/.test(portraitSvg(town.local.key)), `${town.local.name} has no face`);
      equal(town.folk.length, 5, `${town.name}'s townsfolk are not named seat for seat`);
    }
    equal(new Set(BACKWATERS.map((b) => b.junction)).size, 3, 'two towns leave the river at the same stop');
  });

  it('teaches a different thing in each: calling stations, maniacs and rocks', () => {
    equal(backwaterFor('gulch').local.plays, 'station');
    equal(backwaterFor('bayou').local.plays, 'maniac');
    equal(backwaterFor('bethel').local.plays, 'rock');
  });
});

describe('the backwaters: found by rumour', () => {
  it('is uncharted until the stop\'s owner tells you, and they only do once you have played there', () => {
    const p = fresh();
    const gulch = backwaterFor('gulch');
    assert(!heard(p, 'gulch'), 'a town is known before anybody told you');
    equal(rumourAt(p, 'nl5'), null, 'the rumour came before a hand was played at Fisher\'s Rest');
    for (let i = 0; i < RUMOUR_HANDS - 1; i++) p.noteHandAt('nl5');
    equal(rumourAt(p, 'nl5'), null, 'the rumour came a hand early');
    p.noteHandAt('nl5');
    equal(rumourAt(p, 'nl5'), gulch, 'the rumour did not come after the hands');
    equal(rumourAt(p, 'nl2'), null, 'Mud Landing has a rumour of its own now');
    assert(hear(p, 'gulch'), 'hearing it was not news');
    assert(heard(p, 'gulch'));
    equal(rumourAt(p, 'nl5'), null, 'the rumour is told twice');
    assert(!hear(p, 'gulch'), 'hearing it again was news');
  });

  it('tells you anyway at a stop whose table you have taken', () => {
    const p = fresh({ career: { venue: 'nl50', best: 'nl50', beaten: ['nl2', 'nl5', 'nl10', 'nl25', 'nl50'], played: {} } });
    equal(rumourAt(p, 'nl50'), backwaterFor('bayou'));
  });
});

describe('the backwaters: going there and back', () => {
  it('moors the boat at the town, at its stop\'s stakes, and leaves it for any stop', () => {
    const p = fresh({ bankroll: 2000 });
    const bayou = backwaterFor('bayou');
    assert(!canGo(p, bayou), 'you can go somewhere you have not heard of');
    hear(p, 'bayou');
    assert(canGo(p, bayou), 'a purse of $2,000 cannot go to an NL50 town');
    p.enterTown('bayou', bayou.junction);
    equal(townHere(p), bayou);
    equal(p.career.venue, 'nl50', 'the town is not played at its stop\'s stakes');
    p.enterVenue('nl25');
    equal(townHere(p), null, 'the boat stayed up the creek after going to a stop');
    p.enterTown('bayou', bayou.junction);
    p.stakedByTheHouse(20);
    equal(townHere(p), null, 'going broke left the boat up the creek');
  });

  it('will not go with a purse too small for the stop it leaves from', () => {
    const p = fresh({ bankroll: 100 });
    hear(p, 'bethel');
    assert(!canGo(p, backwaterFor('bethel')), 'NL100 stakes with a $100 purse');
  });
});

describe('the backwaters: the table', () => {
  it('is found by its id at its own stop, and nowhere else', () => {
    const fisher = venueFor('nl5');
    const t = tableAt(fisher, 0, 'gulch');
    assert(t.town, 'the Gulch\'s table is not a town\'s');
    equal(t.styles.join(), backwaterFor('gulch').lineup.join());
    equal(t.local.seat, 0);
    equal(t.local.key, 'ike');
    equal(t.names[1], 'Dusty');
    // Not at another stop: there it is an unknown id, and the owner's table.
    equal(tableAt(venueFor('nl10'), 0, 'gulch').id, 'owner');
    // The lobby's own tables are found as before.
    for (const id of ['owner', 'back', 'corner']) equal(tableAt(fisher, 3, id).id, lobbyFor(fisher, 3).tables.find((x) => x.id === id).id);
  });

  it('shows the numbers a lobby shows, and they read the town: loose, wild, tight', () => {
    const gulch = townTable(backwaterFor('gulch')).stats;
    const bayou = townTable(backwaterFor('bayou')).stats;
    const bethel = townTable(backwaterFor('bethel')).stats;
    assert(gulch.flop > bethel.flop && bayou.flop > bethel.flop, 'Bethel sees as many flops as the loose towns');
    assert(bayou.raised > gulch.raised && bayou.raised > bethel.raised, 'the bayou does not raise the most');
    assert(townTable(backwaterFor('gulch')).soft > townTable(backwaterFor('bethel')).soft, 'the Gulch is not softer than Bethel');
  });
});

describe('the backwaters: the town\'s list', () => {
  it('ticks off from the best sittings and pays each goal once', () => {
    const p = fresh();
    const gulch = backwaterFor('gulch');
    const g = gulch.goals;
    const pearlsAt = () => p.pearls;
    equal(townGoals(p, gulch).filter((x) => x.done).length, 0);
    // A losing sitting that was played well, but too short to count.
    for (let i = 0; i < 20; i++) p.noteHandAt(handsKey('gulch'));
    let before = pearlsAt();
    let r = noteTownSitting(p, 'gulch', { hands: 20, netBb: -12, right: 20, total: 20 });
    equal(r.paid.length, 0, 'a short sitting paid for playing well');
    equal(pearlsAt(), before);
    // A long winning one, played well: up and sound are done, and paid.
    for (let i = 0; i < g.soundHands; i++) p.noteHandAt(handsKey('gulch'));
    before = pearlsAt();
    r = noteTownSitting(p, 'gulch', { hands: g.soundHands, netBb: g.up + 5, right: 19, total: 20 });
    const expect = ['sound', 'up', ...(p.handsAt(handsKey('gulch')) >= g.hands ? ['hands'] : [])].sort();
    equal(r.paid.map((x) => x.id).sort().join(), expect.join());
    assert(pearlsAt() > before, 'the goals paid nothing');
    // The hands goal is done once enough hands are counted, and pays at the next sitting.
    while (p.handsAt(handsKey('gulch')) < g.hands) p.noteHandAt(handsKey('gulch'));
    before = pearlsAt();
    r = noteTownSitting(p, 'gulch', { hands: 1, netBb: 0, right: 0, total: 1 });
    assert(townDone(p, gulch), 'all three are done and the town is not');
    // Paying again pays nothing.
    const after = pearlsAt();
    r = noteTownSitting(p, 'gulch', { hands: 40, netBb: 100, right: 40, total: 40 });
    equal(r.paid.length, 0, 'a goal was paid twice');
    equal(pearlsAt(), after);
    equal(r.finished, false, 'the town was finished twice');
  });

  it('says when a sitting finishes the town', () => {
    const p = fresh();
    const bethel = backwaterFor('bethel');
    for (let i = 0; i < bethel.goals.hands; i++) p.noteHandAt(handsKey('bethel'));
    const r = noteTownSitting(p, 'bethel', { hands: 40, netBb: bethel.goals.up, right: 40, total: 40 });
    equal(r.paid.length, 3);
    assert(r.finished, 'the sitting that did all three did not finish the town');
  });

  it('pays more for the towns further down the river', () => {
    const gulch = goalPearls(backwaterFor('gulch'), 0);
    const bethel = goalPearls(backwaterFor('bethel'), 0);
    assert(bethel > gulch, 'Bethel pays no more than the Gulch');
    for (const town of BACKWATERS) {
      assert(goalPearls(town, 2) > goalPearls(town, 0), `${town.name}'s goals do not climb`);
    }
  });

  it('keeps the best sitting, not the last', () => {
    const p = fresh();
    noteTownSitting(p, 'bayou', { hands: 40, netBb: 30, right: 30, total: 40 });
    noteTownSitting(p, 'bayou', { hands: 40, netBb: -50, right: 10, total: 40 });
    const up = townGoals(p, backwaterFor('bayou')).find((g) => g.id === 'up');
    equal(up.have, 30, 'a bad night forgot the good one');
  });

  it('reads a broken record as an empty one', () => {
    const p = fresh({ towns: { gulch: { sittings: 'x', bestUp: null, bestSound: 7, paid: 'all' } } });
    const goals = townGoals(p, backwaterFor('gulch'));
    assert(goals.every((g) => !g.paid), 'a broken record paid for goals');
    equal(goals.find((g) => g.id === 'up').have, 0);
  });
});

describe('the backwaters: on the chart', () => {
  const draw = (towns) => worldSvg({
    here: 1, best: 5, open: 5, beaten: new Set([0]), boat: 'skiff', landmarks: RIVER.map((v) => v.landmark), towns,
  });
  const all = (over = {}) => BACKWATERS.map((b) => ({ key: b.key, landmark: b.landmark, heard: false, here: false, done: false, ...over }));

  it('draws a question mark until you know, and the town after', () => {
    const before = draw(all());
    equal((before.match(/class="town uncharted"/g) || []).length, 3);
    const after = draw(all({ heard: true }));
    equal((after.match(/class="town uncharted"/g) || []).length, 0);
    equal((after.match(/class="town[" ]/g) || []).length, 3);
    // Still the river's stops: the towns are not counted among them.
    equal((after.match(/class="landmark/g) || []).length, RIVER.length);
  });

  it('puts the glow on the town, not the stop, when the boat is up a backwater', () => {
    const towns = all({ heard: true }).map((x) => ({ ...x, here: x.key === 'gulch' }));
    const svg = draw(towns);
    equal((svg.match(/class="landmark here/g) || []).length, 0, 'the stop still says you are there');
    equal((svg.match(/class="town here/g) || []).length, 1);
  });

  it('stands every town on dry land, and moors a boat on water', () => {
    for (const town of BACKWATERS) {
      const p = TOWN_POINTS[town.key];
      assert(p, `${town.name} has nowhere on the chart`);
      assert(isDry(p.x, p.y, town.landmark === 'stilts' ? 0 : 30), `${town.name} is drawn in the water`);
      if (p.moor) assert(!isDry(p.moor[0], p.moor[1]), `${town.name}'s boat is moored on land`);
      equal(Boolean(p.moor), town.way === 'water', `${town.name} is reached by ${town.way} but the boat is ${p.moor ? '' : 'not '}moored there`);
    }
  });
});

describe('the backwaters: in Dutch', () => {
  it('has every word of every town', () => {
    for (const town of BACKWATERS) {
      for (const text of [town.name, town.where, town.colour, town.rumour, town.arrival, town.hello, town.read, town.beat, town.beaten, town.local.title, town.trophy.name]) {
        assert(NL[text], `no Dutch for "${text.slice(0, 60)}"`);
      }
    }
  });

  it('has the goals and the screen\'s words', () => {
    const p = fresh();
    for (const goal of townGoals(p, backwaterFor('gulch'))) assert(NL[goal.text], `no Dutch for "${goal.text}"`);
    for (const text of ['Uncharted', 'Ask at {place}', 'Mark {place} on your chart', '{name} leans over', 'What to do in {place}',
      'Sail up to {place}', 'Take the wagon road to {place}', 'Back down to {place}', '{place} is on your chart', '{name}\'s game',
      'Up the creek: {place}', 'Up the wagon road: {place}', 'Off the river, {place}', 'Done in {place}']) {
      assert(NL[text], `no Dutch for "${text}"`);
    }
  });
});

describe('the backwaters: where they leave the river', () => {
  it('is reached from a stop the road opens before the Gulf', () => {
    for (const town of BACKWATERS) assert(junctionOf(town).act === 1, `${town.name} leaves from the Gulf`);
    assert(VENUES.length > 8);
  });
});
