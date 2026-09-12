import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { VENUES, venueFor, nextDoor, roomYouCanAfford, GRUBSTAKE } from '../src/js/data/venues.js';
import { STAKES } from '../src/js/state/stats.js';
import { PROFILES } from '../src/js/engine/bots.js';

const fresh = () => {
  const mem = new Map();
  return new Profile({}, {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  });
};

describe('the career: a building, not a grid', () => {
  it('gives every rung of the real stakes ladder a room', () => {
    // The NL labels stay on every door. The point of all this is to play
    // online profitably, and a reader who learns "the Anchor" without
    // learning "NL5" has learned a story instead of a stake.
    equal(VENUES.length, STAKES.length);
    for (const v of VENUES) {
      equal(v.stake.key, v.key, `${v.name} is not wired to its stake`);
      assert(v.label === v.stake.name, `${v.name} does not show its real stake`);
      assert(v.entry === v.stake.buyIn, `${v.name}'s seat is not the real buy-in`);
      assert(PROFILES[v.resident], `${v.name} has no regular`);
    }
  });

  it('opens doors on money and nothing else', () => {
    // The reader chose this: the climb is the one poker actually makes you
    // make. A door that opened on lessons read would be a course again.
    const p = fresh();
    p.data.bankroll = 60;
    equal(nextDoor(60, 'nl2').open, false, 'sixty dollars is not the Anchor');
    equal(nextDoor(150, 'nl2').open, true, 'a hundred and fifty is');
    equal(nextDoor(150, 'nl2').needed, 0);
    equal(nextDoor(100, 'nl2').needed, 50, 'and it says exactly how far off you are');
  });

  it('never claims a door is open that the bankroll cannot hold', () => {
    for (const v of VENUES) {
      const room = roomYouCanAfford(v.stake.minBankroll);
      assert(room.stake.minBankroll <= v.stake.minBankroll,
        `${v.stake.minBankroll} was offered ${room.name}, which asks more`);
    }
    equal(roomYouCanAfford(0).key, VENUES[0].key, 'with nothing you are at the cheapest table');
    equal(roomYouCanAfford(1e9).key, VENUES[VENUES.length - 1].key, 'and with everything, the last door');
  });

  it('has a top floor with no door beyond it', () => {
    equal(nextDoor(1e9, VENUES[VENUES.length - 1].key), null);
    equal(VENUES[VENUES.length - 1].bar, null);
  });

  it('counts going broke instead of quietly refilling the pocket', () => {
    // A bankroll that tops itself up teaches that busting costs nothing,
    // which is the opposite of the lesson this whole app is for.
    const p = fresh();
    p.data.bankroll = 0.5;
    p.stakedByTheHouse(GRUBSTAKE);
    equal(p.data.bankroll, GRUBSTAKE);
    equal(p.career.busted, 1);
    equal(p.career.staked, GRUBSTAKE);
    equal(p.career.venue, 'nl2', 'and it puts you back at the cheapest game');

    p.stakedByTheHouse(GRUBSTAKE);
    equal(p.career.busted, 2, 'every time is on the record');
    equal(p.career.staked, GRUBSTAKE * 2);
  });

  it('remembers a room you have taken, once', () => {
    const p = fresh();
    equal(p.noteResidentBeaten('nl5'), true);
    equal(p.noteResidentBeaten('nl5'), false, 'taking it twice is still once');
    assert(p.career.beaten.includes('nl5'));
  });

  it('records the furthest door that has opened, and does not lose it', () => {
    const p = fresh();
    const boat = venueFor('nl10');
    p.enterVenue(boat.key, boat.index, 0);
    equal(p.career.best, 'nl10');
    // Walking back downstairs to a softer game does not undo the climb.
    const kitchen = venueFor('nl2');
    p.enterVenue(kitchen.key, kitchen.index, boat.index);
    equal(p.career.venue, 'nl2');
    equal(p.career.best, 'nl10', 'the best room reached is a high-water mark');
  });

  it('starts you somewhere you can actually afford to sit', () => {
    const p = fresh();
    const here = venueFor(p.career.venue);
    assert(p.data.bankroll >= here.entry,
      `opening bankroll ${p.data.bankroll} cannot buy a ${here.entry} seat`);
  });
});
