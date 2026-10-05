/**
 * Duels: a game with a finish line.
 *
 * What these pin is the blind clock (so the match ends), the stars (so they
 * are for how it was played and cannot be farmed), what a star pays (once),
 * the save (a try, a win, a best), the road's reading of it (the duel is
 * offered when the city is done, and winning one takes the table), and that
 * everything the story says has a Dutch line.
 */

import { describe, it, assert, equal } from './harness.js';
import {
  DUEL_LEVELS, LEVEL_HANDS, blindsFor, duelStars, MIN_DECISIONS, STAR_SHARE, starPearls, STAR_PEARLS, duelOver, soundShare,
} from '../src/js/state/match.js';
import { Profile } from '../src/js/state/profile.js';
import { ROAD } from '../src/js/data/journey.js';
import { VENUES } from '../src/js/data/venues.js';
import { STORY, storyFor } from '../src/js/data/story.js';
import { BOSSES } from '../src/js/data/characters.js';
import { duelStatus, goalsFor, journeyState, takeTable } from '../src/js/state/journey.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const economy = (over = {}) => ({ version: 3, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings'], ...over });
const make = (data = {}) => new Profile({ economy: economy(), ...data }, memory());

/** A save that has done everything at the first city but take its table. */
const readyAtFirst = () => {
  const p = make({ walkthroughs: ['hand-rankings', 'pot-odds'], economy: economy({ owned: ['lesson:hand-rankings', 'lesson:pot-odds'] }) });
  for (let i = 0; i < ROAD[0].hands; i++) p.noteHandAt('nl2');
  return p;
};

describe('the blind clock', () => {
  it('starts at the small blinds and steps up on schedule', () => {
    const first = blindsFor(0);
    equal(first.small, 1);
    equal(first.big, 2);
    equal(first.level, 0);
    equal(blindsFor(LEVEL_HANDS - 1).level, 0, 'the level rose early');
    equal(blindsFor(LEVEL_HANDS).level, 1, 'the level did not rise on time');
    equal(blindsFor(LEVEL_HANDS).big, DUEL_LEVELS[1][1]);
  });

  it('says how long a level has left, and stops rising at the last one', () => {
    equal(blindsFor(0).left, LEVEL_HANDS);
    equal(blindsFor(LEVEL_HANDS - 1).left, 1);
    const last = blindsFor(10_000);
    equal(last.level, DUEL_LEVELS.length - 1);
    assert(last.last, 'the last level did not say so');
    equal(last.big, DUEL_LEVELS[DUEL_LEVELS.length - 1][1]);
  });

  it('only ever goes up, with the small blind half the big or thereabouts', () => {
    let prev = 0;
    for (const [small, big] of DUEL_LEVELS) {
      assert(big > prev, 'the blinds went down or stood still');
      assert(small >= big / 2 - 1 && small <= big / 2, `${small}/${big} is not a small blind`);
      prev = big;
    }
  });

  it('ends a match of two hundred chips each: the last level is a short stack', () => {
    const [, bigLast] = DUEL_LEVELS[DUEL_LEVELS.length - 1];
    assert(200 / bigLast <= 5, `the last level is still ${200 / bigLast} big blinds deep`);
    assert(200 / DUEL_LEVELS[0][1] >= 100, 'the match does not open at a hundred big blinds');
  });
});

describe('the stars: for how it was played', () => {
  it('gives nothing for a loss, and one for a win with too little to judge', () => {
    equal(duelStars({ won: false, decisions: 40, sound: 40 }), 0);
    equal(duelStars({ won: true, decisions: MIN_DECISIONS - 1, sound: MIN_DECISIONS - 1 }), 1, 'a win on seven decisions earned more than a star');
  });

  it('gives two for 92% of decisions sound, three for 97%', () => {
    equal(duelStars({ won: true, decisions: 25, sound: 22 }), 1, '88% is a win and nothing more');
    equal(duelStars({ won: true, decisions: 25, sound: 23 }), 2);
    equal(duelStars({ won: true, decisions: 50, sound: 48 }), 2, '96% is a hair under three');
    equal(duelStars({ won: true, decisions: 50, sound: 49 }), 3);
    equal(duelStars({ won: true, decisions: 20, sound: 20 }), 3);
  });

  it('is hard to get by guessing: the bars sit above what random play scores', () => {
    // Measured with tools/measure-duel.mjs: a hero choosing every action at
    // random is sound about 82% of the time, and 91% at the very best.
    assert(STAR_SHARE.two > 0.91, 'a lucky guesser can earn a second star');
    assert(STAR_SHARE.three > STAR_SHARE.two);
  });

  it('counts a mistake and a helped decision as the same thing: not sound', () => {
    const graded = [
      { level: 'good', helped: false }, { level: 'ok', helped: false }, { level: 'bad', helped: false },
      { level: 'good', helped: true }, { level: 'bad', helped: true },
    ];
    const s = soundShare(graded);
    equal(s.decisions, 5);
    equal(s.sound, 2, 'a helped decision counted as sound');
    assert(Math.abs(s.share - 0.4) < 1e-9);
    equal(soundShare([]).share, 0, 'no decisions divided by zero');
  });
});

describe('what a star pays', () => {
  it('pays each star the first time, more the further down the river', () => {
    equal(starPearls(0, 0, 1), STAR_PEARLS[1]);
    equal(starPearls(0, 0, 3), STAR_PEARLS[1] + STAR_PEARLS[2] + STAR_PEARLS[3]);
    assert(starPearls(7, 0, 1) > starPearls(0, 0, 1), 'a deeper stop pays no more');
  });

  it('pays only the stars you did not have, so a rematch is worth the next star and no more', () => {
    equal(starPearls(2, 1, 1), 0);
    equal(starPearls(2, 2, 1), 0, 'a lower result than the record paid');
    equal(starPearls(0, 2, 3), STAR_PEARLS[3]);
    equal(starPearls(0, 3, 3), 0);
  });
});

describe('when it is over', () => {
  it('is over when one of the two has no chips, and says who won', () => {
    equal(duelOver(120, 80).over, false);
    const won = duelOver(400, 0);
    assert(won.over && won.won, 'emptying the owner is a win');
    const lost = duelOver(0, 400);
    assert(lost.over && !lost.won, 'having no chips is a loss');
  });
});

describe('the save: tries, wins and the best', () => {
  it('starts with nothing, and keeps what a duel did', () => {
    const p = make();
    equal(p.duelRecord('nl2').tries, 0);
    const lost = p.noteDuel('nl2', { won: false, stars: 0 });
    assert(!lost.firstWin);
    const first = p.noteDuel('nl2', { won: true, stars: 2 });
    assert(first.firstWin, 'the first win was not the first win');
    equal(first.before, 0);
    equal(first.after, 2);
    const again = p.noteDuel('nl2', { won: true, stars: 1 });
    assert(!again.firstWin, 'a second win was a first win');
    equal(again.after, 2, 'a worse win lowered the best');
    const rec = p.duelRecord('nl2');
    equal(rec.tries, 3);
    equal(rec.wins, 2);
    equal(rec.stars, 2);
    equal(p.duelRecord('nl5').tries, 0, 'a duel counted at the wrong table');
  });

  it('survives a reload, and a save from before duels has none', () => {
    const store = memory();
    const p = Profile.load(store);
    p.noteDuel('nl5', { won: true, stars: 3 });
    p.markScene('arrive-nl5');
    const q = Profile.load(store);
    equal(q.duelRecord('nl5').stars, 3);
    equal(q.duelRecord('nl5').wins, 1);
    assert(q.seenScene('arrive-nl5'));
    equal(Profile.load(memory()).duelRecord('nl5').tries, 0);
  });

  it('remembers a scene it has shown, and shows each once', () => {
    const p = make();
    assert(!p.seenScene('arrive-nl2'));
    p.markScene('arrive-nl2');
    assert(p.seenScene('arrive-nl2'));
    assert(!p.seenScene('arrive-nl5'));
  });
});

describe('the road: the duel', () => {
  it('is not offered until the city is done, and then it is', () => {
    const fresh = duelStatus(make(), 0);
    assert(fresh.open, 'the first city is not open');
    assert(!fresh.ready, 'a stranger was let into a duel');
    assert(fresh.missing.length > 0 && fresh.missing.every((g) => g.required && g.kind !== 'take'),
      'it did not name what is left, or named the table itself');
    const p = readyAtFirst();
    const ready = duelStatus(p, 0);
    assert(ready.ready && !ready.taken);
    equal(ready.missing.length, 0);
  });

  it('is never open for a city the road has not reached', () => {
    const d = duelStatus(readyAtFirst(), 1);
    assert(!d.open && !d.ready, 'a duel with the owner of a city you have not reached');
  });

  it('can always be fought again once the table is taken, for the stars', () => {
    const p = make({ career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: ['nl2'] } });
    const d = duelStatus(p, 0);
    assert(d.taken && d.ready, 'a taken table cannot be fought again');
  });

  it('takes the table on a first win and hands over the purse, once', () => {
    const p = readyAtFirst();
    const won = takeTable(p, 0);
    assert(won.first);
    assert(won.purse > 0, 'the owner handed over nothing');
    assert(!takeTable(p, 0).first, 'the table was taken twice');
  });

  it('counts a duel won with two stars toward the star bonus, and one star short of it', () => {
    const p = make();
    const stars = () => goalsFor(p, ROAD[0]).find((g) => g.kind === 'stars');
    assert(stars(), 'the first city has no star goal');
    assert(!stars().done);
    p.noteDuel('nl2', { won: true, stars: 1 });
    assert(!stars().done, 'one star met a goal of two');
    equal(stars().have, 1);
    p.noteDuel('nl2', { won: true, stars: 2 });
    assert(stars().done);
  });

  it('never makes the stars hold a city up', () => {
    const p = readyAtFirst();
    p.noteResidentBeaten('nl2');
    assert(journeyState(p).chapters[0].complete, 'a star goal kept the city shut');
  });
});

describe('the story', () => {
  it('has a scene, a challenge and a loss for every stop, and no more', () => {
    for (const v of VENUES) {
      const s = storyFor(v.key);
      assert(s, `${v.key} has no story`);
      for (const k of ['arrival', 'challenge', 'loss']) {
        assert(typeof s[k] === 'string' && s[k].length > 20, `${v.key} has no ${k}`);
      }
    }
    equal(Object.keys(STORY).length, VENUES.length, 'a scene for a stop that does not exist');
    assert(storyFor('nowhere') === null);
  });

  it('is all in Dutch too', () => {
    const missing = [];
    for (const s of Object.values(STORY)) for (const line of Object.values(s)) if (!NL[line]) missing.push(line.slice(0, 70));
    assert(!missing.length, `no Dutch for:\n      ${missing.join('\n      ')}`);
  });

  it('keeps every owner in character: the challenge is not the hello', () => {
    for (const v of VENUES) {
      const boss = BOSSES[v.boss];
      assert(storyFor(v.key).challenge !== boss.hello, `${v.key}'s challenge is their hello`);
    }
  });
});
