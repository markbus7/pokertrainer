/**
 * The Road: a city at a time.
 *
 * The map had everything on it at once and nothing that said where to start.
 * What these pin is that the list is sound (every lesson taught once, never a
 * chapter the rank before it cannot open), that it reads a save correctly
 * (what is done, what is in the way, what to do next), that a city only
 * opens when the one before it is finished, and that a save from before the
 * road existed is not sent back to the start of it.
 */

import { describe, it, assert, equal } from './harness.js';
import { Profile, RANKS } from '../src/js/state/profile.js';
import { ROAD, PURSE_MARGIN } from '../src/js/data/journey.js';
import { VENUES } from '../src/js/data/venues.js';
import { MODULE_META, moduleMeta } from '../src/js/data/curriculum.js';
import { CHECKPOINTS } from '../src/js/data/rangeLadder.js';
import { BOATS } from '../src/js/data/characters.js';
import { PLACES } from '../src/js/ui/worldMap.js';
import {
  journeyState, goalsFor, nextGoal, roadOpen, purseFor, gatedBy, takeTable,
} from '../src/js/state/journey.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

const economy = (over = {}) => ({ version: 3, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings'], ...over });
const make = (data = {}) => new Profile({ economy: economy(), ...data }, memory());

/** Earn a rank properly: the lessons, the drilling, the hands, then the XP. */
const promoteTo = (p, level) => {
  const rank = RANKS[level - 1];
  const req = rank.requires || {};
  const ids = MODULE_META.map((m) => m.id);
  const drill = (id, n) => { for (let i = 0; i < n; i++) p.recordDrill(id, true); };
  for (let i = 0; i < (req.mastered || 0); i++) { p.markWalkthroughComplete(ids[i]); drill(ids[i], 30); }
  for (let i = 0; i < (req.solid || 0); i++) drill(ids[i], Math.max(0, 15 - p.drillStats(ids[i]).attempts));
  for (let i = 0; i < (req.lessons || 0); i++) p.markWalkthroughComplete(ids[i]);
  if (req.hands) p.data.handsPlayed = Math.max(p.data.handsPlayed, req.hands);
  if (p.xp < rank.xp) p.addXp(rank.xp - p.xp);
  return p;
};

const ROUTES = new Set(['walkthrough', 'store', 'stop', 'levels', 'catchbook', 'ranges', 'boatyard', 'gauntlet']);

describe('the road: the list is sound', () => {
  it('has one chapter for every stop, in order', () => {
    equal(ROAD.length, VENUES.length);
    ROAD.forEach((chapter, i) => equal(chapter.stop, VENUES[i].key, `chapter ${i + 1} is for ${chapter.stop}`));
  });

  it('teaches every lesson in the course exactly once', () => {
    const taught = ROAD.flatMap((c) => c.lessons);
    equal(new Set(taught).size, taught.length, 'a lesson is taught in two cities');
    for (const m of MODULE_META) assert(taught.includes(m.id), `${m.id} is taught nowhere on the road`);
    for (const id of taught) assert(moduleMeta(id), `${id} is not a lesson`);
  });

  it('never asks for a chapter the rank before it cannot open', () => {
    // The city a lesson is in is the city it is first read in. Each city's
    // lessons ask for no more than the rank the cities before it build: rank 2
    // after the first, 3 after the second, and so on one at a time.
    ROAD.forEach((chapter, i) => {
      for (const id of chapter.lessons) {
        const need = moduleMeta(id).unlockLevel;
        assert(need <= i + 1, `${id} asks for rank ${need} in city ${i + 1}, which only has ${i + 1} cities' worth of ranks behind it`);
      }
    });
  });

  it('asks for more hands the further down the river it is, and names only things that exist', () => {
    for (let i = 1; i < ROAD.length; i++) assert(ROAD[i].hands > ROAD[i - 1].hands, `city ${i + 1} asks for no more hands than city ${i}`);
    const boats = new Set(BOATS.map((b) => b.key));
    const charts = new Set(CHECKPOINTS.map((c) => c.key));
    for (const chapter of ROAD) {
      for (const b of chapter.bonus) {
        assert(['fish', 'chart', 'boat', 'pet', 'race'].includes(b.kind), `${b.kind} is not a kind of bonus`);
        if (b.kind === 'boat') assert(boats.has(b.key), `no boat called ${b.key}`);
        if (b.kind === 'chart') assert(charts.has(b.key), `no chart called ${b.key}`);
      }
    }
  });

  it('gives every goal somewhere to go that the app has', () => {
    const places = new Set(PLACES.map((p) => p.key));
    const stops = new Set(VENUES.map((v) => v.key));
    for (const chapter of journeyState(make()).chapters) {
      for (const g of chapter.goals) {
        assert(ROUTES.has(g.to.route), `${g.id} goes to "${g.to.route}", which is not a screen`);
        assert(g.to.place === null || places.has(g.to.place), `${g.id} points at a place called ${g.to.place}`);
        assert(g.to.stop === null || stops.has(g.to.stop), `${g.id} points at a stop called ${g.to.stop}`);
        assert(g.text && typeof g.text === 'string', `${g.id} says nothing`);
      }
    }
  });
});

describe('the road: reading a save', () => {
  it('starts at the first city, with the first lesson next and every other city shut', () => {
    const j = journeyState(make());
    equal(j.current, 0);
    assert(!j.finished);
    equal(j.next.goal.id, 'learn:hand-rankings');
    assert(roadOpen(make(), 0));
    for (let i = 1; i < VENUES.length; i++) assert(!roadOpen(make(), i), `city ${i + 1} is open to a new player`);
  });

  it('counts the lesson read, the hands played at that table, and the table taken', () => {
    const p = make({ career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [], played: {} } });
    const goal = (id) => goalsFor(p, ROAD[0]).find((g) => g.id === id);
    assert(!goal('learn:hand-rankings').done);
    p.markWalkthroughComplete('hand-rankings');
    assert(goal('learn:hand-rankings').done);

    equal(goal('play:nl2').have, 0);
    for (let i = 0; i < 10; i++) p.noteHandAt('nl2');
    equal(goal('play:nl2').have, 10);
    equal(goal('play:nl2').need, ROAD[0].hands);
    assert(!goal('play:nl2').done);
    for (let i = 0; i < 30; i++) p.noteHandAt('nl2');
    assert(goal('play:nl2').done);
    equal(goal('play:nl2').have, ROAD[0].hands, 'the count runs past what is asked');
    equal(p.handsAt('nl5'), 0, 'hands at one table counted at another');

    assert(!goal('take:nl2').done);
    p.noteResidentBeaten('nl2');
    assert(goal('take:nl2').done);
  });

  it('counts a table you took as one you played, for a save from before there was a count', () => {
    const p = make({ career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: ['nl2'] } });
    const play = goalsFor(p, ROAD[0]).find((g) => g.id === 'play:nl2');
    assert(play.done, 'a table already taken still asks for its hands');
  });

  it('says what is in the way of a lesson: the rank first, then the pearls', () => {
    const p = make();
    const outs = () => goalsFor(p, ROAD[1]).find((g) => g.id === 'learn:outs');
    equal(outs().blocked.key, 'rank');
    assert(/Minnow/.test(outs().blocked.params.rank), `it does not say which rank: ${outs().blocked.params.rank}`);
    equal(outs().to.route, 'levels', 'a rank in the way sends you to your papers');

    promoteTo(p, 2);
    equal(outs().blocked.key, 'pearls');
    equal(outs().to.route, 'store');
    p.earnPearls(500);
    equal(outs().blocked, null);
    assert(/Trading Post/.test(outs().hint), 'a lesson you can buy does not say where');
    p.buy('lesson:outs', 90);
    equal(outs().to.route, 'walkthrough', 'a lesson you own is read, not bought');
  });

  it('points at something you can do, not at something in the way', () => {
    const p = make({ walkthroughs: ['hand-rankings'] });
    // Hand Rankings is read; Pot Odds costs 60 and the purse is empty.
    const j = journeyState(p);
    equal(j.next.goal.id, 'play:nl2', 'it pointed at a lesson that cannot be bought yet');
    p.earnPearls(100);
    equal(journeyState(p).next.goal.id, 'learn:pot-odds');
    // Nothing but blocked goals left: the first of them, and it says why.
    const stuck = make({ walkthroughs: ['hand-rankings'], career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: ['nl2'] } });
    equal(journeyState(stuck).next.goal.id, 'learn:pot-odds');
    assert(journeyState(stuck).next.goal.blocked, 'a goal nobody can do says nothing about why');
  });

  it('shuts every city after the one you are working on, and opens the next when this one is done', () => {
    const p = make({ walkthroughs: ['hand-rankings', 'pot-odds'], economy: economy({ owned: ['lesson:hand-rankings', 'lesson:pot-odds'] }) });
    for (let i = 0; i < ROAD[0].hands; i++) p.noteHandAt('nl2');
    // Everything but the table itself.
    let j = journeyState(p);
    equal(j.current, 0);
    equal(j.chapters[0].done, j.chapters[0].total - 1);
    assert(!roadOpen(p, 1));
    equal(j.next.goal.id, 'take:nl2');

    p.noteResidentBeaten('nl2');
    j = journeyState(p);
    assert(j.chapters[0].complete);
    equal(j.current, 1);
    assert(roadOpen(p, 1));
    assert(!roadOpen(p, 2), 'the city after next opened too');
  });

  it('never makes a bonus hold a city up, and offers one only when the rest is done', () => {
    const p = make({ walkthroughs: ['hand-rankings', 'pot-odds'], economy: economy({ owned: ['lesson:hand-rankings', 'lesson:pot-odds'] }) });
    for (let i = 0; i < ROAD[0].hands; i++) p.noteHandAt('nl2');
    p.noteResidentBeaten('nl2');
    const chapter = journeyState(p).chapters[0];
    assert(chapter.complete, 'a bonus left undone kept the city shut');
    assert(chapter.goals.some((g) => !g.required && !g.done), 'the test has no bonus to leave undone');
    // With the required goals unfinished, the bonus is not what is next.
    assert(journeyState(make()).next.goal.required, 'a bonus was offered before the real goals');
    // With them done and a bonus left, it is what is next for the same city.
    const c = journeyState(p).chapters[0];
    const after = nextGoal({ ...c, required: c.required });
    assert(after && !after.goal.required, 'nothing was offered once the required goals were done');
  });

  it('does not send a save that has been further down the river back to the start', () => {
    const been = make({ bankroll: 800, career: { venue: 'nl25', best: 'nl25', busted: 0, staked: 0, beaten: [] } });
    const j = journeyState(been);
    equal(j.current, 3, 'somebody at Cotton Row was sent back to Mud Landing');
    for (let i = 0; i < 3; i++) assert(j.chapters[i].complete && j.chapters[i].passed, `city ${i + 1} was not counted as passed`);
    assert(roadOpen(been, 3));
    assert(!roadOpen(been, 4));
    // And what they are asked for is this city's list, not one they have left.
    assert(/lesson|hands|Take/.test(j.next.goal.text));
    assert(j.next.chapter === 3);
  });

  it('is finished when the last table is taken', () => {
    const everything = MODULE_META.map((m) => m.id);
    const p = make({
      walkthroughs: everything,
      economy: economy({ owned: everything.map((id) => `lesson:${id}`) }),
      career: { venue: 'nl500', best: 'nl500', busted: 0, staked: 0, beaten: VENUES.map((v) => v.key) },
    });
    const j = journeyState(p);
    assert(j.finished, 'a river with every table taken is not finished');
    equal(j.next, null);
    assert(j.chapters.every((c) => c.complete));
    equal(j.current, VENUES.length - 1);
  });

  it('counts the race, the catch book and the companions for the bonuses', () => {
    const p = make();
    const bonus = (i, kind) => goalsFor(p, ROAD[i]).find((g) => g.kind === kind);
    assert(!bonus(4, 'race').done);
    p.noteRaceWon();
    assert(bonus(4, 'race').done);
    equal(p.raceWins, 1);
    assert(!bonus(0, 'fish').done);
    p.landCatch('minnow', { weight: 1, where: 'The Saloon' });
    assert(bonus(0, 'fish').done);
  });
});

describe('the road: what a table taken hands over', () => {
  it('is enough for the next stop to let you in, with room to lose a few buy-ins', () => {
    for (let i = 0; i < VENUES.length - 1; i++) {
      const bar = VENUES[i + 1].stake.minBankroll;
      const purse = purseFor(i);
      assert(purse >= bar * PURSE_MARGIN - 1, `the purse for taking ${VENUES[i].name} is ${purse}, not ${bar * PURSE_MARGIN}`);
      assert(purse > bar, 'the purse is not past the bar it has to clear');
      // Room: what is above the bar is at least a few buy-ins at the stop it opens.
      assert((purse - bar) / VENUES[i + 1].entry >= 5, `only ${(purse - bar) / VENUES[i + 1].entry} buy-ins of room at ${VENUES[i + 1].name}`);
    }
    equal(purseFor(VENUES.length - 1), null, 'the last table hands over a purse for a stop that is not there');
  });

  it('names the city that has to be finished first', () => {
    equal(gatedBy(0), null);
    for (let i = 1; i < VENUES.length; i++) equal(gatedBy(i).key, VENUES[i - 1].key);
  });
});

describe('the road: taking a table', () => {
  it('hands over the purse the first time, and only tops the bankroll up to it', () => {
    const p = make({ bankroll: 200 });
    const got = takeTable(p, 1);                       // Fisher's Rest -> The Ferry's bar
    assert(got.first);
    equal(p.data.bankroll, purseFor(1), 'the bankroll is not the purse');
    equal(got.purse, purseFor(1) - 200);
    assert(p.career.beaten.includes('nl5'));
    const again = takeTable(p, 1);
    assert(!again.first && again.purse === 0, 'a table taken twice paid its purse twice');
    equal(p.data.bankroll, purseFor(1));
  });

  it('adds nothing to a bankroll that is already past it, and nothing at the last table', () => {
    const rich = make({ bankroll: 99999 });
    const got = takeTable(rich, 0);
    assert(got.first && got.purse === 0);
    equal(rich.data.bankroll, 99999, 'a rich player was handed money for being rich');
    const last = make({ bankroll: 100 });
    const end = takeTable(last, VENUES.length - 1);
    assert(end.first && end.purse === 0, 'the last table handed over a purse');
    equal(last.data.bankroll, 100);
  });

  it('opens the next stop to a purse that was too small for it', () => {
    const p = make({ bankroll: 200 });
    assert(p.data.bankroll < VENUES[2].stake.minBankroll, 'the test starts with enough already');
    takeTable(p, 1);
    assert(p.data.bankroll >= VENUES[2].stake.minBankroll, 'taking the table did not open the next stop');
  });
});

describe('the road: bookkeeping at the table', () => {
  it('counts hands at each table separately, and keeps counting from an old save', () => {
    const p = make();
    p.noteHandAt('nl5');
    p.noteHandAt('nl5');
    p.noteHandAt('nl10');
    equal(p.handsAt('nl5'), 2);
    equal(p.handsAt('nl10'), 1);
    equal(p.handsAt('nl2'), 0);
    // A save with a career but no count: the count starts from nothing, safely.
    const old = new Profile({ economy: economy(), career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [] } }, memory());
    equal(old.handsAt('nl2'), 0);
    old.noteHandAt('nl2');
    equal(old.handsAt('nl2'), 1);
  });
});
