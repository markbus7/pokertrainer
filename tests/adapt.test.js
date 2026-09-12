import { describe, it, assert, equal } from './harness.js';
import {
  adaptProfile, adaptStrength, adaptationNote, emptyMemory, watch, foldRate,
  EVIDENCE, ADAPT_FROM, ADAPT_FULL,
} from '../src/js/engine/adapt.js';
import { PROFILES, profileAt, getProfile } from '../src/js/engine/bots.js';
import { readRange } from '../src/js/core/handRead.js';
import { makeDeck } from '../src/js/core/cards.js';
import { makeRng, shuffle } from '../src/js/core/rng.js';

const memoryOf = (rate, n = 40) => {
  const m = emptyMemory();
  for (let i = 0; i < n; i++) watch(m, { facingBet: true, action: i < Math.round(n * rate) ? 'fold' : 'call' });
  return m;
};
const board = shuffle(makeRng(42), makeDeck()).slice(0, 5);
const airOf = (p) => readRange(p, board, 'bet', { toCall: 0, street: 'river', heroIsAggressor: false }).share.air;

describe('adapting opponents: a rung on the ladder, not a setting', () => {
  it('leaves a beginner alone entirely', () => {
    // Six fixed archetypes are the right opponents while the whole skill is
    // learning to see one leak and attack it. A reader who cannot yet read a
    // player who sits still learns nothing from one who moves.
    for (let level = 1; level < ADAPT_FROM; level++) equal(adaptStrength(level), 0, `level ${level}`);
    const nailed = memoryOf(0.85);
    for (const key of Object.keys(PROFILES)) {
      equal(adaptProfile(PROFILES[key], nailed, 4), PROFILES[key],
        `${key} must be untouched below Regular`);
    }
  });

  it('ramps in from Regular to Pro', () => {
    assert(adaptStrength(ADAPT_FROM) > 0, 'something happens at Regular');
    assert(adaptStrength(ADAPT_FROM) < adaptStrength(ADAPT_FROM + 1), 'and grows from there');
    equal(adaptStrength(ADAPT_FULL), 1);
    equal(adaptStrength(ADAPT_FULL + 2), 1, 'and does not run past full');
  });

  it('waits for evidence before concluding anything', () => {
    // A fold rate over three spots is a coin landing the same way twice. An
    // opponent that adjusts off it would teach the reader superstition.
    const thin = emptyMemory();
    for (let i = 0; i < EVIDENCE - 1; i++) watch(thin, { facingBet: true, action: 'fold' });
    equal(foldRate(thin), null);
    equal(adaptProfile(PROFILES.pro, thin, 10), PROFILES.pro, 'nothing moves on thin evidence');
    watch(thin, { facingBet: true, action: 'fold' });
    assert(foldRate(thin) !== null, 'and the bar is reached exactly at the evidence count');
  });

  it('only counts decisions where there was a bet to fold to', () => {
    const m = emptyMemory();
    watch(m, { facingBet: false, action: 'fold' });
    watch(m, { facingBet: false, action: 'check' });
    equal(m.facedBet, 0, 'checking round says nothing about how much you fold');
  });
});

describe('adapting opponents: what they do about it', () => {
  it('bluffs more at a reader who folds too much', () => {
    const base = PROFILES.pro;
    const before = airOf(base);
    const after = airOf(adaptProfile(base, memoryOf(0.85), 10));
    assert(after > before + 0.04,
      `folding too much has to draw more bluffs: ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%`);
  });

  it('stops bluffing at a reader who never folds', () => {
    const base = PROFILES.pro;
    const before = airOf(base);
    const after = airOf(adaptProfile(base, memoryOf(0.1), 10));
    assert(after < before - 0.04,
      `never folding has to dry the bluffs up: ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%`);
  });

  it('leaves the station and the nit where they are', () => {
    // Not a difficulty dial. The station's whole character is that he is not
    // working out what you do, and a reader who learns that some opponents
    // never adjust has learned something true about a real table.
    for (const key of ['station', 'rock']) {
      const base = PROFILES[key];
      const moved = Math.abs(airOf(adaptProfile(base, memoryOf(0.85), 10)) - airOf(base));
      assert(moved < 0.03, `${key} moved ${(moved * 100).toFixed(1)} points — that is not their character`);
    }
    const pro = Math.abs(airOf(adaptProfile(PROFILES.pro, memoryOf(0.85), 10)) - airOf(PROFILES.pro));
    const station = Math.abs(airOf(adaptProfile(PROFILES.station, memoryOf(0.85), 10)) - airOf(PROFILES.station));
    assert(pro > station * 3, 'the pro has to notice far more than the station');
  });

  it('says so, rather than getting quietly harder', () => {
    // An opponent who adjusts in silence is not a lesson, it is a table that
    // got harder for no visible reason.
    equal(adaptationNote(PROFILES.pro, memoryOf(0.85), 4), null, 'nothing to say below Regular');
    equal(adaptationNote(PROFILES.station, memoryOf(0.85), 10), null, 'and nothing when nobody moved');
    const note = adaptationNote(PROFILES.pro, memoryOf(0.85), 10);
    assert(note, 'the pro adjusting has to be announceable');
    equal(note.harder, true);
    assert(note.bluffNow > note.bluffWas, 'and the note carries what actually changed');

    // Measured on behaviour, not on how far a dial moved. The nit's dial
    // shifts against a reader who folds to everything, and his bluffing goes
    // from 4% to 4.5% — a change nobody can see, and announcing it would
    // teach the reader to distrust the notice.
    const nit = adaptProfile(PROFILES.rock, memoryOf(1), 10);
    assert(nit.adapted > 0, 'the nit\'s dial does move');
    equal(adaptationNote(PROFILES.rock, memoryOf(1), 10), null,
      'but a half-point of bluffing frequency is not something to announce');
  });
});

describe('adapting opponents: the read follows the player', () => {
  it('reads the seat as it is playing now, not as its archetype', () => {
    // The failure this guards: the bot plays an adjusted game while the read
    // the app asks for is built from the archetype. The reader would be
    // graded on a player who is not at the table.
    const memory = memoryOf(0.85);
    const table = { readerMemory: memory, readerLevel: 10, contestants: [] };
    const seat = { isHero: false, profile: 'pro' };
    const playing = profileAt(table, seat);
    assert(playing.bluff > PROFILES.pro.bluff, 'the seat is playing an adjusted game');
    equal(airOf(playing), airOf(adaptProfile(PROFILES.pro, memory, 10)),
      'and the read is built from that same adjusted profile');
    assert(airOf(playing) !== airOf(PROFILES.pro), 'which is not the archetype');
  });

  it('hands an already-adapted profile straight back', () => {
    const adapted = adaptProfile(PROFILES.pro, memoryOf(0.85), 10);
    equal(getProfile(adapted), adapted, 'looking the key up again would discard the adjustment');
  });

  it('leaves the table alone when nobody is watching', () => {
    const seat = { isHero: false, profile: 'pro' };
    equal(profileAt({ contestants: [] }, seat), PROFILES.pro, 'no memory, no adjustment');
    equal(profileAt(null, seat), PROFILES.pro);
  });
});
