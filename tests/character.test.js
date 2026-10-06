/**
 * Your character: the lifetime of hands, the kind of player it names, the
 * clothes a rank wears, and the figure that wears them.
 *
 * What these pin: a hand is counted where it belongs (the style numbers only
 * at a full cash table, results in big blinds only where a chip is money); a
 * save survives anything that was stored in it; nothing is named from too few
 * hands; each of the river's six regulars, read the way the reader is read,
 * lands in its own box; and every look draws.
 */

import { describe, it, assert, equal, close } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import {
  emptyLifetime, sanitizeLifetime, recordHand, styleNumbers, styleFromReports, cashResults,
  startingHands, seats, rivals, soundRate, LIFE_SAMPLE,
} from '../src/js/state/lifetime.js';
import { PLAYER_TYPES, REGULARS, BOUNDS, HEALTHY, playerType } from '../src/js/data/playerTypes.js';
import {
  TIERS, tierFor, SKINS, HAIRS, HAIR_COLOURS, BEARDS, COLOURS, LOOK_LABELS, DEFAULT_LOOK, NAME_MAX,
  sanitizeLook, propsFor, PROPS_TEXT, formFor, FORM_TEXT,
} from '../src/js/data/looks.js';
import { whoYouAre, riverRecords } from '../src/js/state/character.js';
import { characterSvg } from '../src/js/ui/characterArt.js';
import { moduleMeta } from '../src/js/data/curriculum.js';
import { RANKS } from '../src/js/state/profile.js';
import { standardScore, categoryOf, CAT } from '../src/js/core/evaluator.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => {
  const mem = new Map();
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
};

/** A hand with sensible defaults: a cash hand at a full table, folded before the flop. */
const hand = (over = {}) => ({
  mode: 'cash', full: true, key: '72o', position: 'UTG',
  vpip: false, pfr: false, threeBet: false, threeBetChance: false, sawFlop: false,
  showdown: false, won: false, netBb: 0, potBb: 1.5,
  bets: 0, raises: 0, calls: 0, folds: 1, allIn: false,
  made: null, bluff: false, decisions: 1, sound: 1, opponents: [], at: 1000, where: 'nl2',
  ...over,
});

describe('your career: counting a hand', () => {
  it('counts every hand, and the style numbers only at a full cash table', () => {
    const life = emptyLifetime();
    recordHand(life, hand({ vpip: true, pfr: true }));
    recordHand(life, hand({ vpip: true, full: false }));                 // three-handed practice
    recordHand(life, hand({ vpip: true, mode: 'duel', full: false }));   // heads-up for a table
    recordHand(life, hand({ vpip: true, mode: 'regatta', full: false }));
    equal(life.hands, 4);
    equal(life.style.hands, 1, 'only the full cash hand reads your style');
    equal(life.style.vpip, 1);
    equal(life.style.pfr, 1);
    equal(life.cash.hands, 2, 'both cash hands are money, full table or not');
  });

  it('keeps results in big blinds only where a chip is money', () => {
    const life = emptyLifetime();
    recordHand(life, hand({ won: true, netBb: 12, potBb: 20 }));
    recordHand(life, hand({ won: true, netBb: 300, potBb: 600, mode: 'regatta', full: false }));
    equal(life.cash.netBb, 12, 'a tournament chip is not a big blind of anybody\'s money');
    equal(life.biggestPot.bb, 20, 'nor is a tournament pot your biggest');
    equal(life.won, 2, 'but a tournament pot is still a pot you won');
    equal(life.starting['72o'][3], 12, 'a starting hand\'s money is cash money');
  });

  it('tells a showdown won from a pot they folded to you', () => {
    const life = emptyLifetime();
    recordHand(life, hand({ won: true, showdown: true, sawFlop: true, vpip: true }));
    recordHand(life, hand({ won: true, showdown: false, vpip: true }));
    recordHand(life, hand({ won: false, showdown: true, sawFlop: true, vpip: true, netBb: -10 }));
    equal(life.showdowns, 2);
    equal(life.showdownsWon, 1);
    equal(life.noShowdownWins, 1);
    equal(life.style.showdowns, 2);
    equal(life.style.showdownsWon, 1);
  });

  it('breaks a winning run only on a hand you put money into and lost', () => {
    const life = emptyLifetime();
    recordHand(life, hand({ won: true, netBb: 3 }));
    recordHand(life, hand({ won: true, netBb: 3 }));
    recordHand(life, hand({ netBb: 0 }));                         // folded: nothing in
    recordHand(life, hand({ netBb: -0.5, position: 'SB' }));      // the small blind, folded
    recordHand(life, hand({ netBb: -1, position: 'BB' }));        // the big blind, folded to a raise
    equal(life.streak.now, 2, 'a fold with only a blind in is not a loss');
    recordHand(life, hand({ won: true, netBb: 2 }));
    equal(life.streak.best, 3);
    recordHand(life, hand({ netBb: -1, position: 'BB', sawFlop: true }));
    equal(life.streak.now, 0, 'a big blind taken to the flop and lost is a hand played');
    recordHand(life, hand({ won: true, netBb: 2 }));
    recordHand(life, hand({ vpip: true, netBb: -6 }));
    equal(life.streak.now, 0);
    equal(life.streak.best, 3, 'the best run is kept');
  });

  it('keeps the best hand by its score, and counts what was shown down', () => {
    const life = emptyLifetime();
    const pair = (1 << 20) | (10 << 16);
    const flush = (5 << 20) | (14 << 16);
    const royal = (8 << 20) | (14 << 16);
    recordHand(life, hand({ showdown: true, made: { score: flush, cat: 5, royal: false }, key: 'AKs', at: 5 }));
    recordHand(life, hand({ showdown: true, made: { score: pair, cat: 1, royal: false } }));
    equal(life.bestHand.score, flush);
    equal(life.bestHand.key, 'AKs');
    recordHand(life, hand({ showdown: true, made: { score: royal, cat: 8, royal: true } }));
    equal(life.bestHand.score, royal);
    equal(life.royals, 1);
    equal(life.made[1], 1);
    equal(life.made[5], 1);
    equal(life.made[8], 1);
  });

  it('remembers the biggest pot won and the biggest bluff, at cash tables', () => {
    const life = emptyLifetime();
    recordHand(life, hand({ won: true, potBb: 40, netBb: 20, bluff: true, key: 'J4s' }));
    recordHand(life, hand({ won: true, potBb: 90, netBb: 50 }));
    recordHand(life, hand({ won: false, potBb: 300, netBb: -150, vpip: true }));
    equal(life.biggestPot.bb, 90, 'a pot you lost is not your biggest pot won');
    equal(life.biggestBluff.bb, 40);
    equal(life.biggestBluff.key, 'J4s');
    equal(life.bluffs, 1);
  });

  it('keeps seats only at a full table, and whose chips moved where', () => {
    const life = emptyLifetime();
    recordHand(life, hand({ position: 'BTN', won: true, netBb: 5, opponents: [{ who: 'station', netBb: -3 }, { who: 'rock', netBb: -2 }] }));
    recordHand(life, hand({ position: 'BTN', full: false, netBb: -4, vpip: true, opponents: [{ who: 'maniac', netBb: 4 }] }));
    equal(life.seats.BTN[0], 1, 'the button heads-up is a different seat');
    equal(life.seats.BTN[1], 5);
    equal(life.against.station[1], 3, 'won from the station');
    equal(life.against.maniac[2], 4, 'lost to the maniac, short-handed or not');
    recordHand(life, hand({ mode: 'duel', full: false, netBb: -50, opponents: [{ who: 'maniac', netBb: 50 }] }));
    equal(life.against.maniac[2], 4, 'a duel\'s chips are not money');
  });
});

describe('your career: reading it back from a save', () => {
  it('turns anything stored into numbers and the right shapes', () => {
    for (const junk of [null, undefined, 'lifetime', 42, [], { hands: 'many' }, { style: 'tight', starting: [1, 2], seats: null }]) {
      const life = sanitizeLifetime(junk);
      equal(life.hands, 0);
      equal(typeof life.style.hands, 'number');
      assert(Array.isArray(life.made) && life.made.length === 9, 'made hands are nine counts');
      equal(Object.keys(life.starting).length, 0);
      equal(life.biggestPot, null);
      recordHand(life, hand({ won: true, netBb: 1 }));   // and it can be added to
      equal(life.hands, 1);
    }
  });

  it('keeps counts at zero or more and money as it was', () => {
    const life = sanitizeLifetime({
      hands: -5, won: 2.6, folds: NaN, royals: Infinity,
      cash: { hands: 10, netBb: -12.346 },
      starting: { AKs: [-3, 2, 'x', -40.5], ThisKeyIsFarTooLong: [1, 1, 1, 1], QQ: 'pocket queens' },
      seats: { BTN: [30, -7.25] },
      against: { station: [12, 30, -5] },
      made: [1, -1, 'two'],
      streak: { now: -2, best: 4.4 },
    });
    equal(life.hands, 0);
    equal(life.won, 3);
    equal(life.folds, 0);
    equal(life.royals, 0);
    equal(life.cash.netBb, -12.35);
    equal(life.starting.AKs[0], 0, 'a count cannot go negative');
    equal(life.starting.AKs[2], 0);
    equal(life.starting.AKs[3], -40.5, 'a loss stays a loss');
    equal(life.starting.ThisKeyIsFarTooLong, undefined);
    equal(life.starting.QQ, undefined);
    equal(life.seats.BTN[1], -7.25);
    equal(life.against.station[2], -5, 'money columns keep their sign');
    equal(life.made[1], 0);
    equal(life.made[2], 0);
    equal(life.streak.best, 4);
  });

  it('cannot be made to grow without limit', () => {
    const starting = {};
    for (let i = 0; i < 5000; i++) starting[`k${i}`] = [1, 1, 1, 1];
    assert(Object.keys(sanitizeLifetime({ starting }).starting).length <= 200, 'a table has at most 200 rows');
  });

  it('drops a record whose number is not a number, and keeps one that is', () => {
    const life = sanitizeLifetime({
      biggestPot: { bb: 'lots', key: 'AA' },
      biggestBluff: { bb: 33.333, key: 'J4s', at: 9, where: 'nl5', extra: '<script>' },
      bestHand: { score: 1234567, key: 'a very long key', won: 1 },
    });
    equal(life.biggestPot, null);
    equal(life.biggestBluff.bb, 33.33);
    equal(life.biggestBluff.where, 'nl5');
    equal(life.biggestBluff.extra, undefined, 'only the fields a record has');
    equal(life.bestHand.key, null, 'a key that is not a starting hand is dropped');
    equal(life.bestHand.won, true);
  });

  it('reads a lifetime it wrote back exactly as it was', () => {
    const life = emptyLifetime();
    for (let i = 0; i < 60; i++) {
      recordHand(life, hand({
        key: ['AKs', 'QQ', '72o', 'T9s'][i % 4], position: ['BTN', 'CO', 'BB'][i % 3],
        vpip: i % 2 === 0, won: i % 3 === 0, netBb: i % 3 === 0 ? 4.5 : -1.25, potBb: 6,
        showdown: i % 5 === 0, made: i % 5 === 0 ? { score: (2 << 20) | (i << 4), cat: 2, royal: false } : null,
        opponents: [{ who: 'tag', netBb: i % 3 === 0 ? -4.5 : 1.25 }], at: i,
      }));
    }
    const back = sanitizeLifetime(JSON.parse(JSON.stringify(life)));
    equal(JSON.stringify(back), JSON.stringify(life));
  });
});

describe('your career: nothing is named from too few hands', () => {
  it('shows no style until there are enough hands behind it', () => {
    const life = emptyLifetime();
    for (let i = 0; i < LIFE_SAMPLE.style - 1; i++) recordHand(life, hand({ vpip: i % 4 === 0 }));
    const thin = styleNumbers(life);
    equal(thin.vpip, null);
    equal(thin.pfr, null);
    equal(thin.af, null);
    equal(thin.wtsd, null);
    equal(thin.wsd, null);
    equal(playerType(thin), PLAYER_TYPES.rookie);
    recordHand(life, hand());
    close(styleNumbers(life).vpip, 8 / 30, 1e-9);
  });

  it('reads aggression after the flop, per call', () => {
    const life = emptyLifetime();
    for (let i = 0; i < LIFE_SAMPLE.aggression; i++) recordHand(life, hand({ vpip: true, sawFlop: true, bets: 1, raises: i % 2, calls: 1 }));
    close(styleNumbers(life).af, (20 + 10) / 20, 1e-9);
  });

  it('borrows a style from Silas\'s notes, weighted by hands, until there is one of its own', () => {
    equal(styleFromReports([]), null);
    equal(styleFromReports([{ hands: 20, style: { vpip: 0.2, pfr: 0.1 } }]), null, 'twenty hands is not a style');
    const s = styleFromReports([
      { hands: 30, style: { vpip: 0.2, pfr: 0.1 } },
      { hands: 90, style: { vpip: 0.4, pfr: 0.3 } },
      { hands: 50, style: null },
      null,
    ]);
    equal(s.hands, 120);
    close(s.vpip, 0.35, 1e-9);
    close(s.pfr, 0.25, 1e-9);
  });

  it('gives a win rate only after a hundred cash hands', () => {
    const life = emptyLifetime();
    for (let i = 0; i < 99; i++) recordHand(life, hand({ won: true, netBb: 1 }));
    equal(cashResults(life).winRate, null);
    recordHand(life, hand({ won: true, netBb: 1 }));
    close(cashResults(life).winRate, 100, 1e-9);
  });

  it('names a favourite hand from what you play, and a best and worst from enough of it', () => {
    const life = emptyLifetime();
    for (let i = 0; i < 6; i++) recordHand(life, hand({ key: 'AKs', vpip: true, won: true, netBb: 5 }));
    for (let i = 0; i < 3; i++) recordHand(life, hand({ key: 'KK', vpip: true, won: true, netBb: 30 }));
    for (let i = 0; i < 4; i++) recordHand(life, hand({ key: 'QJo', vpip: true, netBb: -8 }));
    for (let i = 0; i < 9; i++) recordHand(life, hand({ key: '72o' }));
    const { favourite, best, worst } = startingHands(life);
    equal(favourite.key, 'AKs', 'the favourite is the hand you play most, not the one you are dealt most');
    equal(best.key, 'AKs', 'three hands of kings is not enough to call them your money-maker');
    equal(worst.key, 'QJo');
  });

  it('names a best and worst seat, and a victim and nemesis, only from enough hands', () => {
    const life = emptyLifetime();
    for (let i = 0; i < LIFE_SAMPLE.seat; i++) {
      recordHand(life, hand({ position: 'BTN', won: true, netBb: 2, opponents: [{ who: 'station', netBb: -2 }] }));
      recordHand(life, hand({ position: 'SB', vpip: true, netBb: -1.5, opponents: [{ who: 'maniac', netBb: 1.5 }] }));
    }
    recordHand(life, hand({ position: 'CO', won: true, netBb: 99, opponents: [{ who: 'rock', netBb: -99 }] }));
    const s = seats(life);
    equal(s.best.seat, 'BTN', 'one great hand in the cutoff is not a best seat');
    equal(s.worst.seat, 'SB');
    const r = rivals(life);
    equal(r.victim.who, 'station');
    equal(r.nemesis.who, 'maniac');
    assert(!r.rows.some((x) => x.who === 'rock'), 'one hand against a rock is not a rivalry');
  });

  it('gives a share of sound decisions only from twenty', () => {
    const life = emptyLifetime();
    recordHand(life, hand({ decisions: 19, sound: 19 }));
    equal(soundRate(life), null);
    recordHand(life, hand({ decisions: 1, sound: 0 }));
    close(soundRate(life), 0.95, 1e-9);
  });
});

describe('your character: the kind of player you are', () => {
  it('puts each of the river\'s six regulars in its own box', () => {
    // The same two numbers the reader is named from, measured off the bots.
    const expected = { rock: 'nit', tag: 'tag', pro: 'tag', lag: 'lag', maniac: 'maniac', station: 'station' };
    for (const r of REGULARS) equal(playerType(r).key, expected[r.key], `${r.name} reads as ${playerType(r).key}`);
    const pro = REGULARS.find((r) => r.key === 'pro');
    equal(playerType(pro, { sound: 0.95, hands: 500, winRate: 4 }).key, 'reg', 'tight-aggressive, sound and winning is a regular');
  });

  it('asks all three things of a solid regular', () => {
    const tag = { vpip: 0.22, pfr: 0.18 };
    equal(playerType(tag, { sound: 0.95, hands: 500, winRate: 4 }).key, 'reg');
    equal(playerType(tag, { sound: 0.85, hands: 500, winRate: 4 }).key, 'tag', 'not without sound decisions');
    equal(playerType(tag, { sound: 0.95, hands: 120, winRate: 4 }).key, 'tag', 'not from a hundred and twenty hands');
    equal(playerType(tag, { sound: 0.95, hands: 500, winRate: null }).key, 'tag', 'not without a win rate');
    equal(playerType(tag, { sound: 0.95, hands: 500, winRate: -2 }).key, 'tag', 'not while losing');
  });

  it('cuts the map along the lines a HUD reads by', () => {
    equal(playerType({ vpip: BOUNDS.nit - 0.001, pfr: 0 }).key, 'nit');
    equal(playerType({ vpip: BOUNDS.nit, pfr: BOUNDS.nit * BOUNDS.aggressive }).key, 'tag', 'half the hands played, raised, is aggressive');
    equal(playerType({ vpip: BOUNDS.nit, pfr: BOUNDS.nit * 0.49 }).key, 'rock');
    equal(playerType({ vpip: 0.35, pfr: 0.05 }).key, 'station');
    equal(playerType({ vpip: 0.6, pfr: 0.05 }).key, 'station');
    equal(playerType({ vpip: 0.6, pfr: 0.5 }).key, 'maniac');
    equal(playerType({ vpip: 0, pfr: 0 }).key, 'nit', 'playing nothing is the tightest there is');
  });

  it('gives every type its words, a tag, and a chapter that exists', () => {
    for (const type of Object.values(PLAYER_TYPES)) {
      for (const field of ['tag', 'name', 'epithet', 'you', 'good', 'watch']) assert(type[field], `${type.key} has no ${field}`);
      assert(moduleMeta(type.next), `${type.key} points at a chapter that is not there: ${type.next}`);
      assert(type.like === null || REGULARS.some((r) => r.key === type.like), `${type.key} plays like nobody on the river`);
    }
  });

  it('draws a band where a winning regular sits, on a scale that holds it', () => {
    for (const [key, h] of Object.entries(HEALTHY)) {
      assert(h.lo < h.hi && h.hi < h.max, `${key}'s band is ${h.lo}–${h.hi} on a scale to ${h.max}`);
    }
  });
});

describe('your character: how you look', () => {
  it('dresses each rank, two at a time, from a deckhand to a legend', () => {
    equal(TIERS.length, 5);
    for (let level = 1; level <= RANKS.length; level++) equal(tierFor(level), Math.min(4, Math.floor((level - 1) / 2)), `level ${level}`);
    for (const tier of TIERS) {
      equal(tierFor(tier.from), tier.tier, `${tier.name} starts at level ${tier.from}`);
      if (tier.tier) equal(tierFor(tier.from - 1), tier.tier - 1, 'and not a rank before');
    }
  });

  it('keeps only choices that exist', () => {
    equal(JSON.stringify(sanitizeLook(null)), JSON.stringify(DEFAULT_LOOK));
    const odd = sanitizeLook({ skin: 'toString', hair: '__proto__', hairColour: 'constructor', beard: 'goatee', colour: 'hasOwnProperty', name: 7 });
    equal(JSON.stringify(odd), JSON.stringify(DEFAULT_LOOK), 'a name off the prototype is not a choice');
    const mine = sanitizeLook({ skin: 'deep', hair: 'curly', hairColour: 'grey', beard: 'beard', colour: 'plum', name: 'Mark' });
    equal(mine.skin, 'deep');
    equal(mine.hair, 'curly');
    equal(mine.hairColour, 'grey');
    equal(mine.beard, 'beard');
    equal(mine.colour, 'plum');
    equal(mine.name, 'Mark');
  });

  it('keeps a name short, on one line, and free of control characters', () => {
    equal(sanitizeLook({ name: '  Mark\u0007   the\nGreat  ' }).name, 'Mark the Great');
    const long = sanitizeLook({ name: 'Somebody with a very long name indeed' }).name;
    assert(long.length <= NAME_MAX, `${long} is longer than a plate`);
    equal(long, long.trim(), 'and does not end in a space');
  });

  it('labels every choice, and puts something in the hands of every type', () => {
    for (const [field, options] of [['skin', Object.keys(SKINS)], ['hair', HAIRS], ['hairColour', Object.keys(HAIR_COLOURS)], ['beard', BEARDS], ['colour', Object.keys(COLOURS)]]) {
      for (const o of options) assert(LOOK_LABELS[field][o], `${field}: ${o} has no label`);
    }
    for (const key of Object.keys(PLAYER_TYPES)) assert(propsFor(key) in PROPS_TEXT, `${key} holds something with no words`);
  });

  it('wears the last few sittings on its face', () => {
    equal(formFor([]), 'steady');
    equal(formFor(null), 'steady');
    equal(formFor([{ profitBb: 500 }, { profitBb: 5 }, { profitBb: 6 }, { profitBb: 3 }]), 'steady', 'only the last three count');
    equal(formFor([{ profitBb: 10 }, { profitBb: 10 }]), 'hot');
    equal(formFor([{ profitBb: -25 }]), 'cold');
    equal(formFor([{ profitBb: 'lots' }, null, { profitBb: 3 }]), 'steady');
    for (const f of ['hot', 'steady', 'cold']) assert(FORM_TEXT[f] && FORM_TEXT[f].name, `${f} has words`);
  });

  it('draws every look, with every face and everything in its hands', () => {
    const looks = [
      DEFAULT_LOOK,
      { skin: 'deep', hair: 'curly', hairColour: 'black', beard: 'beard', colour: 'navy' },
      { skin: 'fair', hair: 'bald', hairColour: 'white', beard: 'stubble', colour: 'mustard' },
      { skin: 'tan', hair: 'long', hairColour: 'auburn', beard: 'moustache', colour: 'emerald' },
      { skin: 'brown', hair: 'bun', hairColour: 'blond', beard: 'none', colour: 'plum' },
    ];
    for (let tier = 0; tier < TIERS.length; tier++) {
      for (const form of ['hot', 'steady', 'cold']) {
        for (const props of Object.keys(PROPS_TEXT)) {
          for (const look of looks) {
            const svg = characterSvg({ tier, form, look, props, trophy: tier > 2, width: 120 });
            assert(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'an svg');
            assert(!/undefined|NaN|null/.test(svg), `tier ${tier} ${form} ${props} drew something it did not have`);
          }
        }
      }
    }
    const plain = characterSvg({ tier: 4, stage: false });
    assert(!/radialGradient/.test(plain), 'a silhouette has no glow behind it');
  });

  it('escapes what it is told to call you, and never reuses an id', () => {
    const svg = characterSvg({ tier: 4, label: 'Mark "the Hand" <b>' });
    assert(svg.includes('aria-label="Mark &quot;the Hand&quot; &lt;b&gt;"'), 'the label is escaped');
    const ids = [characterSvg({ tier: 4 }), characterSvg({ tier: 4 })].map((s) => /id="([^"]+)"/.exec(s)[1]);
    assert(ids[0] !== ids[1], 'two figures on one page do not share a glow');
  });
});

describe('your character: on the profile', () => {
  it('reads a lifetime back once, and then the same object every time', () => {
    const p = new Profile({ lifetime: { hands: -3, style: 'junk' } }, memory());
    const life = p.lifetime;
    equal(life.hands, 0);
    assert(p.lifetime === life, 'the table writes to the object it was given');
    p.noteLifetimeHand(hand({ won: true, netBb: 2 }));
    equal(p.lifetime.hands, 1);
  });

  it('survives a save and a load, and an import that replaces the data', () => {
    const storage = memory();
    const p = new Profile({}, storage);
    p.noteLifetimeHand(hand({ vpip: true, won: true, netBb: 3, key: 'AKs' }));
    p.setLook({ skin: 'deep', name: 'Mark', hair: 'nonsense' });
    p.save();
    const again = Profile.load(storage);
    equal(again.lifetime.hands, 1);
    equal(again.lifetime.starting.AKs[0], 1);
    equal(again.look.skin, 'deep');
    equal(again.look.hair, 'short', 'a choice that does not exist is not kept');
    equal(again.look.name, 'Mark');
    again.data = { ...again.data, lifetime: { hands: 'x' } };   // what an import does
    equal(again.lifetime.hands, 0, 'an imported lifetime is checked too');
  });

  it('names a newcomer a newcomer, dressed as a deckhand', () => {
    const me = whoYouAre(new Profile({}, memory()));
    equal(me.type.key, 'rookie');
    equal(me.tier, 0);
    equal(me.form, 'steady');
    equal(me.props, 'none');
    equal(me.read, null);
    equal(me.toRead, LIFE_SAMPLE.style);
    equal(me.trophy, false);
  });

  it('reads an old save\'s style from the notes on its sittings at the stops', () => {
    const notes = (n, vpip, pfr, table) => ({ hands: n, style: { vpip, pfr }, place: table ? { kind: 'stop', key: 'nl2', table } : { kind: 'practice' } });
    const p = new Profile({ reports: [notes(40, 0.5, 0.45, 't1'), notes(200, 0.12, 0.1, null)] }, memory());
    const me = whoYouAre(p);
    equal(me.read.source, 'notes');
    equal(me.type.key, 'maniac', 'from the stop, not from a heads-up practice table');
    for (let i = 0; i < LIFE_SAMPLE.style; i++) p.noteLifetimeHand(hand({ vpip: i < 6, pfr: i < 5 }));
    const later = whoYouAre(p);
    equal(later.read.source, 'life', 'its own hands win once there are enough');
    equal(later.type.key, 'tag');
    equal(later.props, 'cards');
  });

  it('counts the river\'s records, and nothing for a new save', () => {
    const fresh = riverRecords(new Profile({}, memory()));
    for (const [k, v] of Object.entries(fresh)) if (!['stops', 'starsOf'].includes(k)) equal(v, 0, `${k} starts at nothing`);
    const p = new Profile({
      career: { venue: 'nl5', best: 'nl5', busted: 1, staked: 0, beaten: ['nl2'], played: {}, duels: { nl2: { tries: 2, wins: 1, stars: 3 } }, regattas: { nl2: { entered: 3, wins: 1, cashes: 2, best: 1, net: 5 } } },
      contracts: { active: [], done: 4, issued: 7 },
      daily: { best: 6, streak: 2 },
      rival: { met: 3 },
    }, memory());
    const r = riverRecords(p);
    equal(r.keepsakes, 1);
    equal(r.stars, 3);
    equal(r.duelWins, 1);
    equal(r.regattas, 3);
    equal(r.regattaWins, 1);
    equal(r.contracts, 4);
    equal(r.dailyBest, 6);
    equal(r.rivalMet, 3);
    assert(whoYouAre(p).trophy, 'a regatta won puts the cup at your feet');
  });
});

describe('your character: scored the same in every game', () => {
  it('puts a Short Deck flush back among the flushes', () => {
    const shortFlush = (6 << 20) | (14 << 16);   // Short Deck scores a flush above a full house
    equal(categoryOf(standardScore(shortFlush, true)), CAT.FLUSH);
    equal(categoryOf(standardScore((5 << 20) | (13 << 16), true)), CAT.FULL_HOUSE);
    equal(standardScore(shortFlush, false), shortFlush, 'Hold\'em is already in the standard order');
    equal(standardScore(standardScore(shortFlush, true), true), shortFlush, 'the swap is its own inverse');
  });
});

describe('your character: in Dutch', () => {
  it('has Dutch for every look, every type and every form', () => {
    const missing = [];
    const need = (s) => { if (s && !NL[s]) missing.push(s); };
    for (const tier of TIERS) { need(tier.name); need(tier.blurb); }
    for (const labels of Object.values(LOOK_LABELS)) Object.values(labels).forEach(need);
    Object.values(PROPS_TEXT).forEach(need);
    for (const f of Object.values(FORM_TEXT)) { need(f.name); need(f.blurb); }
    for (const type of Object.values(PLAYER_TYPES)) ['epithet', 'you', 'good', 'watch'].forEach((k) => need(type[k]));
    for (const type of Object.values(PLAYER_TYPES)) if (type.key !== 'nit') need(type.name);
    assert(missing.length === 0, `no Dutch for: ${missing.join(' | ')}`);
  });
});
