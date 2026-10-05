/**
 * Contracts, today's question, and strangers passing through.
 *
 * What these pin: a contract is drawn from the skills the reader is weakest
 * at and counts only what it names (no help, no mistakes, no fold-farming);
 * the day's question is the same for everybody on the same date, counts once a
 * day, and keeps a streak that a missed day breaks; and a wanderer sits where
 * and for as long as it says, is an extreme of its style, and speaks Dutch.
 */

import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import {
  SLOTS, TABLE_SKILLS, weakestSkills, contractsOf, ensureContracts, nextContract, noteEvent, contractText, rewardFor,
} from '../src/js/state/contracts.js';
import {
  dateKey, daysBetween, dailyQuestions, dailyOf, recordDaily, liveStreak, doneToday, dailyReward, DAILY_LENGTH, DAILY_PASS,
} from '../src/js/state/daily.js';
import { lobbyFor, WANDERER_STAY, WANDERER_FROM, OWNER_TABLE } from '../src/js/state/lobby.js';
import { WANDERERS, WANDERER_KEYS } from '../src/js/data/wanderers.js';
import { PROFILES, PROFILE_KEYS, WANDERER_PROFILES, getProfile } from '../src/js/engine/bots.js';
import { VENUES } from '../src/js/data/venues.js';
import { SPECIES } from '../src/js/data/fish.js';
import { NL } from '../src/js/i18n/nl.js';
import { ownsLesson } from '../src/js/state/economy.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const owns = (...ids) => ids.map((id) => `lesson:${id}`);
/** A profile that owns every chapter a table can name, so any skill can be set. */
const rich = () => new Profile({ economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: owns(...TABLE_SKILLS, 'hand-rankings') } }, memory());

describe('contracts: where they come from', () => {
  it('posts three, from the skills you own, and no two the same', () => {
    const p = rich();
    const active = ensureContracts(p);
    equal(active.length, SLOTS);
    const keys = active.map((k) => `${k.kind}/${k.skill || k.key || ''}`);
    equal(new Set(keys).size, keys.length, `duplicates on the board: ${keys}`);
    for (const k of active) {
      assert(k.need > 0 && k.reward > 0 && k.have === 0);
      if (k.kind === 'sound') assert(TABLE_SKILLS.includes(k.skill), `${k.skill} is not a skill a table names`);
    }
  });

  it('sets the weakest skill first, by how the recent drill answers went', () => {
    const p = rich();
    for (let i = 0; i < 10; i++) p.recordDrill('spr', i < 2);        // 20%
    for (let i = 0; i < 10; i++) p.recordDrill('preflop', i < 9);    // 90%
    const order = weakestSkills(p);
    assert(order.indexOf('spr') < order.indexOf('preflop'), `spr (20%) is not ahead of preflop (90%): ${order}`);
    equal(order[0], 'spr');
    assert(ensureContracts(p).some((k) => k.kind === 'sound' && k.skill === 'spr'), 'the weakest skill was not set');
  });

  it('never sets a chapter you do not own', () => {
    const p = new Profile({ economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: owns('hand-rankings') } }, memory());
    for (const id of weakestSkills(p)) assert(ownsLesson(p, id), `${id} is not owned`);
    for (const k of ensureContracts(p)) if (k.kind === 'sound') assert(ownsLesson(p, k.skill), `set ${k.skill}, which is not owned`);
  });

  it('sets only fish whose chapter you have', () => {
    const p = new Profile({ economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: owns('hand-rankings') } }, memory());
    for (let n = 0; n < 40; n++) {
      const k = nextContract(p, { reach: 7, active: [], n });
      if (k && k.kind === 'fish') {
        const species = SPECIES.find((x) => x.key === k.key);
        assert(!species.module || ownsLesson(p, species.module), `set a ${species.name}, which needs ${species.module}`);
      }
    }
  });

  it('reads a save with junk in it as an empty board', () => {
    const p = rich();
    p.data.contracts = { active: [null, { kind: 5 }, { kind: 'sound', need: -2 }, 'x'], issued: 'a', done: -4 };
    const c = contractsOf(p);
    equal(c.active.length, 0);
    equal(c.issued, 0);
    equal(c.done, 0);
    equal(ensureContracts(p).length, SLOTS);
  });
});

describe('contracts: what counts', () => {
  const board = (p, ...contracts) => { contractsOf(p).active = contracts.map((c, i) => ({ id: `t${i}`, have: 0, reward: 30, ...c })); };

  it('counts a sound decision of the skill it names, and nothing else', () => {
    const p = rich();
    board(p, { kind: 'sound', skill: 'spr', need: 3 });
    noteEvent(p, { type: 'decision', skill: 'pot-odds', level: 'good', helped: false });
    noteEvent(p, { type: 'decision', skill: 'spr', level: 'bad', helped: false });
    noteEvent(p, { type: 'decision', skill: 'spr', level: 'good', helped: true });
    equal(contractsOf(p).active[0].have, 0, 'a decision of another skill, a mistake or a helped one counted');
    noteEvent(p, { type: 'decision', skill: 'spr', level: 'ok', helped: false });
    equal(contractsOf(p).active[0].have, 1);
  });

  it('finishes at its number, comes off the board, and is counted', () => {
    const p = rich();
    board(p, { kind: 'sound', skill: 'cbet', need: 2, reward: 44 });
    noteEvent(p, { type: 'decision', skill: 'cbet', level: 'good', helped: false });
    const done = noteEvent(p, { type: 'decision', skill: 'cbet', level: 'good', helped: false });
    equal(done.length, 1);
    equal(done[0].reward, 44);
    equal(contractsOf(p).active.length, 0);
    equal(contractsOf(p).done, 1);
  });

  it('wants clean hands in a row: a mistake starts it again', () => {
    const p = rich();
    board(p, { kind: 'clean', need: 3 });
    noteEvent(p, { type: 'hand', clean: true });
    noteEvent(p, { type: 'hand', clean: true });
    equal(contractsOf(p).active[0].have, 2);
    noteEvent(p, { type: 'hand', clean: false });
    equal(contractsOf(p).active[0].have, 0, 'a mistake did not break the run');
    noteEvent(p, { type: 'hand', clean: true });
    noteEvent(p, { type: 'hand', clean: true });
    assert(noteEvent(p, { type: 'hand', clean: true }).length === 1, 'three clean hands in a row did not finish it');
  });

  it('wants the one fish it names', () => {
    const p = rich();
    board(p, { kind: 'fish', key: 'perch', need: 1 });
    equal(noteEvent(p, { type: 'catch', key: 'minnow' }).length, 0);
    equal(noteEvent(p, { type: 'catch', key: 'perch' }).length, 1);
  });

  it('pays more for more, and a fish pays a flat purse', () => {
    assert(rewardFor('sound', 10) > rewardFor('sound', 6));
    assert(rewardFor('clean', 5) > rewardFor('clean', 3));
    equal(rewardFor('fish', 1), 40);
  });

  it('refills the board when one is finished', () => {
    const p = rich();
    ensureContracts(p);
    const first = contractsOf(p).active[0];
    first.have = first.need - 1;
    const kind = first.kind;
    if (kind === 'sound') noteEvent(p, { type: 'decision', skill: first.skill, level: 'good', helped: false });
    else if (kind === 'clean') noteEvent(p, { type: 'hand', clean: true });
    else noteEvent(p, { type: 'catch', key: first.key });
    equal(contractsOf(p).active.length, SLOTS - 1);
    equal(ensureContracts(p).length, SLOTS);
  });

  it('says every kind in words, and in Dutch', () => {
    const samples = [
      { kind: 'sound', skill: 'pot-odds', need: 8 }, { kind: 'clean', need: 4 }, { kind: 'fish', key: 'perch', need: 1 },
    ];
    for (const k of samples) {
      const { text, params } = contractText(k);
      assert(NL[text], `no Dutch for "${text}"`);
      for (const v of Object.values(params)) if (typeof v === 'string') assert(NL[v] || /^[A-Za-z-]+$/.test(v), `no Dutch for the name ${v}`);
    }
    for (const s of SPECIES) assert(NL[s.name], `no Dutch for the fish ${s.name}`);
  });
});

describe("today's question", () => {
  const owned = ['hand-rankings', 'pot-odds', 'outs', 'preflop', 'position'];

  it('is a date key in the reader\'s own day, and counts days between', () => {
    equal(dateKey(new Date(2026, 9, 5, 23, 59)), '2026-10-05');
    equal(dateKey(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
    equal(daysBetween('2026-10-05', '2026-10-06'), 1);
    equal(daysBetween('2026-10-05', '2026-10-05'), 0);
    equal(daysBetween('2026-02-27', '2026-03-01'), 2);
    equal(daysBetween('2025-12-31', '2026-01-01'), 1);
  });

  it('is the same three questions for the same date, and different on another', () => {
    const a = dailyQuestions('2026-10-05', owned);
    const b = dailyQuestions('2026-10-05', owned);
    equal(a.length, DAILY_LENGTH);
    equal(JSON.stringify(a.map((q) => q.answer + q.module)), JSON.stringify(b.map((q) => q.answer + q.module)));
    equal(new Set(a.map((q) => q.module)).size, DAILY_LENGTH, 'two of the three were the same chapter');
    const days = new Set();
    for (let d = 1; d <= 20; d++) days.add(JSON.stringify(dailyQuestions(`2026-10-${String(d).padStart(2, '0')}`, owned).map((q) => q.module)));
    assert(days.size > 5, `twenty days only made ${days.size} different sets`);
    for (const q of a) assert(owned.includes(q.module) && q.options.length >= 2);
  });

  it('asks again when you have fewer chapters than questions', () => {
    const q = dailyQuestions('2026-10-05', ['pot-odds']);
    equal(q.length, DAILY_LENGTH);
    assert(q.every((x) => x.module === 'pot-odds'));
  });

  it('counts once a day, and a streak a missed day breaks', () => {
    const p = rich();
    let r = recordDaily(p, '2026-10-05', { correct: 3 });
    assert(r.counted && r.streak === 1);
    assert(doneToday(p, '2026-10-05'));
    r = recordDaily(p, '2026-10-05', { correct: 3 });
    assert(!r.counted && r.reward === 0, 'a second go the same day paid');
    r = recordDaily(p, '2026-10-06', { correct: 2 });
    equal(r.streak, 2);
    r = recordDaily(p, '2026-10-07', { correct: 1 });
    equal(r.streak, 3);
    equal(liveStreak(p, '2026-10-08'), 3, 'a streak was lost the morning after');
    equal(liveStreak(p, '2026-10-09'), 0, 'a streak survived a missed day');
    r = recordDaily(p, '2026-10-10', { correct: 3 });
    equal(r.streak, 1, 'a missed day did not break the streak');
    equal(r.best, 3, 'the best was lost with the streak');
    equal(dailyOf(p).days, 4);
  });

  it('pays for turning up, for answers, and a little more each day running, up to a week', () => {
    assert(dailyReward({ correct: 3, streak: 1 }) > dailyReward({ correct: 0, streak: 1 }));
    assert(dailyReward({ correct: 2, streak: 5 }) > dailyReward({ correct: 2, streak: 1 }));
    equal(dailyReward({ correct: 2, streak: 7 }), dailyReward({ correct: 2, streak: 30 }), 'the streak bonus has no cap');
    assert(dailyReward({ correct: 0, streak: 1 }) > 0);
    assert(DAILY_PASS <= DAILY_LENGTH);
  });

  it('survives a save with junk in it', () => {
    const p = rich();
    p.data.daily = { last: 'yesterday', streak: -3, best: 'x', days: null, correct: 99 };
    const d = dailyOf(p);
    equal(d.last, null);
    equal(d.streak, 0);
    equal(d.correct, DAILY_LENGTH);
    equal(liveStreak(p, '2026-10-05'), 0);
  });
});

describe('wanderers: strangers passing through', () => {
  it('are extremes of the style they are, and worth more than it', () => {
    assert(WANDERER_PROFILES.hale.callDown > PROFILES.station.callDown, 'the cattle buyer calls less than a station');
    assert(WANDERER_PROFILES.dixie.aggression > PROFILES.maniac.aggression);
    assert(WANDERER_PROFILES.josiah.openPct < PROFILES.rock.openPct);
    assert(WANDERER_PROFILES.josiah.bluff === 0, 'the preacher bluffs');
    for (const key of WANDERER_KEYS) {
      equal(getProfile(key).key, key);
      assert(!PROFILE_KEYS.includes(key), `${key} is in the list of the six styles`);
    }
    equal(PROFILE_KEYS.length, 6);
  });

  it('are never at the first city, never at the owner\'s table, and in the same chair for three sittings', () => {
    for (let s = 0; s < 90; s++) assert(lobbyFor(VENUES[0], s).wanderer === null, 'a stranger at the first city');
    let seen = 0;
    for (const stop of VENUES.slice(WANDERER_FROM)) {
      for (let period = 0; period < 30; period++) {
        const first = lobbyFor(stop, period * WANDERER_STAY);
        if (!first.wanderer) continue;
        seen++;
        assert(first.wanderer.table !== OWNER_TABLE, 'a stranger at the owner\'s table');
        for (let k = 1; k < WANDERER_STAY; k++) {
          const again = lobbyFor(stop, period * WANDERER_STAY + k);
          equal(again.wanderer && again.wanderer.key, first.wanderer.key, 'the stranger changed within three sittings');
          equal(again.wanderer && again.wanderer.table, first.wanderer.table);
        }
        const table = first.tables.find((t) => t.id === first.wanderer.table);
        equal(table.styles[table.wandererSeat], first.wanderer.key);
        assert(table.wandererSeat !== table.rivalSeat, 'a stranger in the Rival\'s chair');
      }
    }
    assert(seen > 20, `only ${seen} strangers in 210 stays`);
  });

  it('come about two periods in five', () => {
    let here = 0;
    const n = 300;
    for (let period = 0; period < n; period++) if (lobbyFor(VENUES[3], period * WANDERER_STAY).wanderer) here++;
    assert(here / n > 0.28 && here / n < 0.52, `a stranger turned up ${Math.round(100 * here / n)}% of the time`);
  });

  it('leave the lobby with a soft game in it', () => {
    for (const stop of VENUES.slice(1)) {
      for (let s = 0; s < 80; s++) assert(lobbyFor(stop, s).tables.some((t) => t.soft > 0.3), `${stop.key}/${s}: no soft game`);
    }
  });

  it('say everything in Dutch', () => {
    const lines = [];
    for (const w of Object.values(WANDERERS)) {
      lines.push(w.name, w.title, w.intro, ...w.hello, ...w.brag, ...w.sore, w.read, w.beat);
    }
    for (const p of Object.values(WANDERER_PROFILES)) lines.push(p.style, p.blurb, p.tell, p.counter);
    const missing = lines.filter((l) => !NL[l]);
    assert(!missing.length, `no Dutch for:\n      ${missing.map((s) => s.slice(0, 70)).join('\n      ')}`);
  });
});
