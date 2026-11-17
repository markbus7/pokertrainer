/**
 * Yesterday's hand: the newest Log mistake from before today, asked again
 * under today's question. Only the first answer of a day counts, and only a
 * right one pays, so it cannot be farmed.
 */

import { describe, it, assert, equal } from './harness.js';
import { makeRng } from '../src/js/core/rng.js';
import { generateSpot } from '../src/js/trainers/lab.js';
import { handFromLabSpot, keepHand, loadHands, _useStorage } from '../src/js/state/handHistory.js';
import { noteRetry } from '../src/js/state/retry.js';
import { Profile } from '../src/js/state/profile.js';
import { morningHand, morningDone, morningOf, recordMorning, dayStart, MORNING_PEARLS } from '../src/js/state/morning.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

// A fixed clock: noon on 17 November 2026, in the reader's own time.
const NOW = new Date(2026, 10, 17, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

/** Lab spots answered wrong, kept in the Log at the given times. */
function keepMistakes(times) {
  _useStorage(memory());
  const out = [];
  for (let seed = 1; out.length < times.length && seed < 400; seed++) {
    const spot = generateSpot('decide', makeRng(seed));
    if (spot.type !== 'decide') continue;
    const hand = handFromLabSpot(spot, spot.answer === 'call' ? 'fold' : 'call');
    const kept = keepHand({ ...hand, id: `m${out.length}`, at: times[out.length] });
    if (kept) out.push(kept);
  }
  equal(loadHands().length, times.length, 'every mistake kept');
  return out;
}

describe('yesterday\'s hand', () => {
  it('starts the day at the reader\'s own midnight', () => {
    equal(dayStart(NOW), new Date(2026, 10, 17).getTime());
    equal(dayStart(NOW.getTime()), dayStart(NOW), 'a time in milliseconds works too');
  });

  it('is the newest mistake from before today, not one from this morning', () => {
    const start = dayStart(NOW);
    const [older, newer, today] = keepMistakes([start - 30 * HOUR, start - 2 * HOUR, start + HOUR]);
    equal(morningHand(NOW).id, newer.id, 'last night\'s, not this morning\'s');
    noteRetry(newer.id, true, NOW.getTime());
    equal(morningHand(NOW).id, older.id, 'one put right is not asked again');
    noteRetry(older.id, true, NOW.getTime());
    equal(morningHand(NOW), null, 'nothing from before today left');
    assert(today, 'today\'s mistake waits for tomorrow');
    equal(morningHand(new Date(NOW.getTime() + 24 * HOUR)).id, today.id);
  });

  it('has nothing to ask with an empty Log', () => {
    _useStorage(memory());
    equal(morningHand(NOW), null);
  });

  it('pays a right first answer once a day, and nothing for a second go', () => {
    const p = new Profile({}, memory());
    const before = p.economy.pearls;
    assert(!morningDone(p, NOW));
    const first = recordMorning(p, true, NOW);
    equal(first.counted, true);
    equal(first.pearls, MORNING_PEARLS);
    equal(p.economy.pearls, before + MORNING_PEARLS);
    assert(morningDone(p, NOW), 'answered today');
    const again = recordMorning(p, true, NOW);
    equal(again.counted, false);
    equal(again.pearls, 0, 'a second go the same day pays nothing');
    equal(recordMorning(p, true, new Date(NOW.getTime() + 24 * HOUR)).pearls, MORNING_PEARLS, 'the next day pays again');
  });

  it('counts a wrong first answer, so the buttons cannot be pressed in turn until one pays', () => {
    const p = new Profile({}, memory());
    const wrong = recordMorning(p, false, NOW);
    equal(wrong.counted, true);
    equal(wrong.pearls, 0);
    equal(recordMorning(p, true, NOW).pearls, 0, 'right on the second press pays nothing');
  });

  it('reads back a damaged save as nothing answered', () => {
    const p = new Profile({}, memory());
    p.data.morning = { last: 42 };
    equal(morningOf(p).last, null);
    p.data.morning = 'x';
    equal(morningOf(p).last, null);
    assert(!morningDone(p, NOW));
  });
});
