/**
 * The lobby and the Rival: three tables at a stop, and the one who remembers.
 *
 * What these pin is that the lobby is the same every time it is looked at (so
 * the table you sit at is the one you were shown), that it always offers a
 * choice worth making (a soft game among them, and not three the same), that
 * the numbers it shows move the way their names say, and that the Rival's
 * memory is kept and capped, and read back honestly.
 */

import { describe, it, assert, equal } from './harness.js';
import {
  lobbyFor, lobbyStats, softness, chosenRank, TEMPLATES, SOFT, LOBBY_SEATS, TABLE_IDS, OWNER_TABLE, RIVAL_FROM,
} from '../src/js/state/lobby.js';
import { PROFILES, getProfile, profileAt } from '../src/js/engine/bots.js';
import { createTable } from '../src/js/engine/table.js';
import { makeRng } from '../src/js/core/rng.js';
import { Profile } from '../src/js/state/profile.js';
import { VENUES } from '../src/js/data/venues.js';
import { remember, readOn, sanitize, emptyMemory, MEMORY_CAP } from '../src/js/state/rival.js';
import { EVIDENCE } from '../src/js/engine/adapt.js';
import { RIVAL, RIVAL_NOTES } from '../src/js/data/rival.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('the lobby: what is offered at a stop', () => {
  it('is the same lobby every time it is looked at, and a different one after a sitting', () => {
    const stop = VENUES[1];
    const a = lobbyFor(stop, 3);
    const b = lobbyFor(stop, 3);
    equal(JSON.stringify(a), JSON.stringify(b), 'the lobby changed between two looks');
    const seen = new Set();
    for (let s = 0; s < 12; s++) seen.add(JSON.stringify(lobbyFor(stop, s).tables.map((t) => t.styles)));
    assert(seen.size > 6, `twelve sittings only made ${seen.size} different lobbies`);
  });

  it('has three tables with five other players each, the owner at the owner\'s', () => {
    for (const stop of VENUES) {
      for (let s = 0; s < 8; s++) {
        const { tables } = lobbyFor(stop, s);
        equal(tables.map((t) => t.id).join(), TABLE_IDS.join());
        for (const t of tables) {
          equal(t.styles.length, LOBBY_SEATS - 1, `${stop.key} ${t.id} has ${t.styles.length} others`);
          assert(t.styles.every((k) => PROFILES[k]), `${t.id} seats a style that does not exist`);
        }
        const owner = tables.find((t) => t.id === OWNER_TABLE);
        assert(owner.owner && owner.styles[0] === stop.resident, `${stop.key}: the owner is not at the owner's table`);
        assert(tables.filter((t) => t.owner).length === 1, 'more than one owner\'s table');
      }
    }
  });

  it('always offers a choice worth making: a soft game, and not two of a kind', () => {
    for (const stop of VENUES) {
      for (let s = 0; s < 60; s++) {
        const { tables } = lobbyFor(stop, s);
        assert(tables.some((t) => t.soft > SOFT), `${stop.key}/${s}: no soft game in the lobby`);
        const [, a, b] = tables;
        // Rival swaps one seat, so compare the templates the side games were made from.
        assert(a.template !== b.template, `${stop.key}/${s}: both side games are ${a.template}`);
      }
    }
  });

  it('shows numbers that move the way their names say', () => {
    const tight = lobbyStats(TEMPLATES.nitty);
    const loose = lobbyStats(TEMPLATES.passive);
    const wild = lobbyStats(TEMPLATES.wild);
    assert(loose.flop > tight.flop, 'a table of callers does not see more flops');
    assert(wild.raised > loose.raised, 'a table of maniacs does not raise more');
    assert(wild.pot > tight.pot, 'a table of maniacs does not play bigger pots');
    for (const t of Object.values(TEMPLATES)) {
      const s = lobbyStats(t);
      assert(s.flop >= 15 && s.flop <= 70, `flop ${s.flop}% is not a plausible lobby number`);
      assert(s.raised >= 10 && s.raised <= 60, `raised ${s.raised}% is not a plausible lobby number`);
      assert(s.pot >= 5 && s.pot <= 40, `pot ${s.pot}bb is not a plausible lobby number`);
    }
  });

  it('can tell a soft table from a hard one without being shown the styles', () => {
    assert(softness(TEMPLATES.passive) > softness(TEMPLATES.regs), 'callers are not softer than regulars');
    assert(softness(TEMPLATES.wild) > softness(TEMPLATES.nitty), 'maniacs are not softer than nits');
    // And the lobby numbers separate them: the soft game is where more players see the flop.
    assert(lobbyStats(TEMPLATES.passive).flop > lobbyStats(TEMPLATES.regs).flop);
  });

  it('ranks the table that was sat at among the three', () => {
    for (let n = 0; n < 40; n++) {
      const { tables } = lobbyFor(VENUES[0], n);
      const order = [...tables].sort((x, y) => y.soft - x.soft);
      const top = chosenRank(tables, order[0].id);
      equal(top.rank, 1);
      assert(top.best, 'the softest table was not the best choice');
      const bottom = chosenRank(tables, order[2].id);
      assert(bottom.rank >= 1 && bottom.rank <= 3);
      if (order[2].soft < order[0].soft - 1e-9) assert(!bottom.best, 'a softer table was available and the worst was called best');
      equal(bottom.of, 3);
    }
    assert(chosenRank(lobbyFor(VENUES[0], 0).tables, 'nowhere') === null);
  });

  it('names every table in Dutch', () => {
    for (const name of ['The owner\'s table', 'The back room', 'The corner game']) assert(NL[name], `no Dutch for ${name}`);
  });
});

describe('the Rival: where she sits', () => {
  it('is never at the first city, and at about two visits in three after it', () => {
    for (let s = 0; s < 30; s++) assert(lobbyFor(VENUES[0], s).rival === null, 'the Rival at the first city');
    let here = 0;
    const n = 400;
    for (let s = 0; s < n; s++) if (lobbyFor(VENUES[RIVAL_FROM + 1], s).rival) here++;
    assert(here / n > 0.5 && here / n < 0.8, `the Rival turned up ${Math.round(100 * here / n)}% of the time`);
  });

  it('sits in one seat at one table, and never in the owner\'s chair', () => {
    for (let s = 0; s < 80; s++) {
      const { tables, rival } = lobbyFor(VENUES[3], s);
      const seated = tables.filter((t) => t.rivalSeat !== undefined);
      equal(seated.length, rival ? 1 : 0);
      if (rival) {
        const t = seated[0];
        equal(t.id, rival);
        assert(!t.owner || t.rivalSeat > 0, 'the Rival took the owner\'s seat');
        equal(t.styles[t.rivalSeat], RIVAL.plays);
      }
    }
  });
});

describe('the Rival: what she remembers', () => {
  it('counts bets faced and folded, and keeps no read until it has seen enough', () => {
    const m = emptyMemory();
    for (let i = 0; i < EVIDENCE - 1; i++) remember(m, { facingBet: true, action: 'fold' });
    equal(readOn(m).kind, 'watching');
    equal(readOn(m).n, EVIDENCE - 1);
    remember(m, { facingBet: true, action: 'fold' });
    equal(readOn(m).kind, 'folds');
    equal(readOn(m).pct, 100);
  });

  it('ignores a decision with nothing to call', () => {
    const m = emptyMemory();
    remember(m, { facingBet: false, action: 'check' });
    equal(m.facedBet, 0);
  });

  it('reads a caller, a folder and an even player for what they are', () => {
    const play = (folds, calls) => {
      const m = emptyMemory();
      for (let i = 0; i < folds; i++) remember(m, { facingBet: true, action: 'fold' });
      for (let i = 0; i < calls; i++) remember(m, { facingBet: true, action: 'call' });
      return readOn(m);
    };
    equal(play(14, 6).kind, 'folds');
    equal(play(4, 16).kind, 'calls');
    equal(play(10, 10).kind, 'even');
  });

  it('lets go of the oldest half past the cap, so a changed player is believed', () => {
    const m = emptyMemory();
    for (let i = 0; i < MEMORY_CAP; i++) remember(m, { facingBet: true, action: 'fold' });
    equal(m.facedBet, MEMORY_CAP);
    remember(m, { facingBet: true, action: 'call' });
    assert(m.facedBet < MEMORY_CAP, 'the tally grew past its cap');
    for (let i = 0; i < 400; i++) remember(m, { facingBet: true, action: 'call' });
    assert(readOn(m).pct < 40, `a player who now calls everything is still read as folding ${readOn(m).pct}%`);
    assert(m.facedBet <= MEMORY_CAP, 'the tally is over the cap');
  });

  it('reads back from a save as plain numbers, whatever was in it', () => {
    for (const junk of [null, undefined, 'x', 7, [], { facedBet: -3, folded: 'a' }, { facedBet: 5, folded: 90 }]) {
      const m = sanitize(junk);
      assert(Number.isInteger(m.facedBet) && m.facedBet >= 0, `facedBet ${m.facedBet}`);
      assert(Number.isInteger(m.folded) && m.folded >= 0 && m.folded <= m.facedBet, `folded ${m.folded} of ${m.facedBet}`);
    }
    equal(JSON.stringify(sanitize({ facedBet: 30, folded: 12 })), JSON.stringify({ facedBet: 30, folded: 12 }));
  });
});

describe('the Rival: what she says, in two languages', () => {
  it('has Dutch for everything she says and every note about her', () => {
    const lines = [
      RIVAL.name, RIVAL.title, RIVAL.intro, RIVAL.harder, RIVAL.softer, ...RIVAL.hello, ...RIVAL.brag, ...RIVAL.sore,
      ...Object.values(RIVAL_NOTES),
    ];
    const missing = lines.filter((l) => !NL[l] && l !== RIVAL.name);
    assert(!missing.length, `no Dutch for:\n      ${missing.map((s) => s.slice(0, 70)).join('\n      ')}`);
  });
});

describe('the Rival: her memory is hers, and it is in the save', () => {
  it('plays a different game once she has seen you fold, whatever rank you have reached', () => {
    const table = createTable({
      players: [
        { id: 'hero', name: 'You', stack: 200, isHero: true },
        { id: 'nell', name: 'Nell', stack: 200, profile: 'pro', memory: { facedBet: 40, folded: 34 } },
        { id: 'nova', name: 'Nova', stack: 200, profile: 'pro' },
      ],
      smallBlind: 1, bigBlind: 2, rng: makeRng(3),
    });
    table.readerLevel = 1;   // a new player: the table's own regulars are not watching yet
    const base = getProfile('pro');
    const nell = profileAt(table, table.player('nell'));
    const nova = profileAt(table, table.player('nova'));
    assert(nell.bluff > base.bluff, 'she did not bluff more at somebody who folds 85% of the time');
    equal(nova.bluff, base.bluff, 'the table\'s own regular adapted to a reader who has not got far enough to be watched');
  });

  it('is kept between sittings, and the count of meetings starts with the first', () => {
    const store = memory();
    const p = Profile.load(store);
    equal(p.rival.met, 0);
    assert(p.noteRivalMet(), 'the first meeting was not the first');
    assert(!p.noteRivalMet(), 'the second meeting was the first');
    for (let i = 0; i < 14; i++) remember(p.rival.memory, { facingBet: true, action: 'fold' });
    p.save();
    const q = Profile.load(store);
    equal(q.rival.met, 2);
    equal(q.rival.memory.facedBet, 14);
    equal(readOn(q.rival.memory).kind, 'folds');
  });

  it('hands out the same memory every time, because the table writes to it', () => {
    const p = Profile.load(memory());
    const first = p.rival.memory;
    p.noteRivalMet();
    assert(p.rival.memory === first, 'the memory was replaced by a copy');
    remember(first, { facingBet: true, action: 'fold' });
    equal(p.rival.memory.facedBet, 1);
  });

  it('counts finished sittings, which is what changes the lobby', () => {
    const p = Profile.load(memory());
    equal(p.sittings, 0);
    p.noteSitting();
    p.noteSitting();
    equal(p.sittings, 2);
    equal(Profile.load(memory()).sittings, 0);
  });
});
