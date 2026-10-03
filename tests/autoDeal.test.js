import { describe, it, assert, equal } from './harness.js';
import {
  AUTO_DEAL_MS, autoDealEnabled, autoDealDelay, autoDealReady, countdown,
} from '../src/js/state/autoDeal.js';
import { Profile } from '../src/js/state/profile.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const fresh = (data = {}) => new Profile(data, memory());

describe('auto-deal: when the next hand comes', () => {
  it('waits long enough to see how the hand ended, and longer after a showdown', () => {
    const quick = autoDealDelay();
    const showdown = autoDealDelay({ showdown: true });
    assert(quick >= 1500, `a fold-out gives only ${quick}ms to read the result`);
    assert(showdown > quick, 'a showdown is dealt over as fast as a fold-out');
    assert(showdown <= 6000, `${showdown}ms is a long time to wait for cards`);
  });

  it('gives Silas\'s verdict time to be read, on top of either', () => {
    equal(autoDealDelay({ coaching: true }), autoDealDelay() + AUTO_DEAL_MS.coaching);
    equal(autoDealDelay({ showdown: true, coaching: true }), autoDealDelay({ showdown: true }) + AUTO_DEAL_MS.coaching);
  });

  it('counts down by whole seconds, 3, 2, 1, and never shows 0', () => {
    const wait = { total: 3000, started: 10_000 };
    equal(countdown(wait, 10_000).seconds, 3);
    equal(countdown(wait, 10_001).seconds, 3, 'a millisecond in, still 3');
    equal(countdown(wait, 11_000).seconds, 2);
    equal(countdown(wait, 12_999).seconds, 1);
    equal(countdown(wait, 13_000).seconds, 0, 'at zero the hand is dealt, so 0 is never drawn');
    equal(countdown(wait, 13_000).left, 0);
  });

  it('fills from nothing to full, and stays inside that however late it is read', () => {
    const wait = { total: 2000, started: 0 };
    equal(countdown(wait, 0).progress, 0);
    equal(countdown(wait, 1000).progress, 0.5);
    equal(countdown(wait, 2000).progress, 1);
    equal(countdown(wait, 9000).progress, 1, 'a timer that fired late overfills the bar');
    equal(countdown(wait, -500).progress, 0, 'a clock that stepped back underfills it');
    equal(countdown(wait, -500).seconds, 2);
  });
});

describe('auto-deal: where it applies', () => {
  const real = { on: true, lesson: false, cancelled: false, heroBust: false };

  it('deals itself at a table you are playing', () => {
    assert(autoDealReady(real));
  });

  it('never at a lesson table, after leaving, or when you are out of chips', () => {
    assert(!autoDealReady({ ...real, lesson: true }), 'a lesson dealt itself');
    assert(!autoDealReady({ ...real, cancelled: true }), 'a table dealt after it was left');
    assert(!autoDealReady({ ...real, heroBust: true }), 'a rebuy was decided for the player');
  });

  it('never when it is switched off', () => {
    assert(!autoDealReady({ ...real, on: false }));
  });
});

describe('auto-deal: the switch', () => {
  it('is on for a new player, and for a save from before the switch existed', () => {
    equal(autoDealEnabled(fresh().settings), true);
    // An old save has settings, just not this one.
    equal(autoDealEnabled(fresh({ settings: { sound: false, theme: 'midnight' } }).settings), true);
    equal(autoDealEnabled(undefined), true);
    equal(autoDealEnabled({}), true);
  });

  it('stays off once it is turned off, across a save', () => {
    const store = memory();
    const p = new Profile({}, store);
    p.updateSettings({ autoDeal: false });
    equal(autoDealEnabled(p.settings), false);
    const back = Profile.load(store);
    equal(autoDealEnabled(back.settings), false, 'the choice was forgotten on reload');
    back.updateSettings({ autoDeal: true });
    equal(autoDealEnabled(Profile.load(store).settings), true);
  });
});
