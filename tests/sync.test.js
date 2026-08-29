import { describe, it, assert, equal, throws } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { exportCode, importCode, decodeSyncCode, summarize } from '../src/js/state/sync.js';

const freshProfile = () => {
  const memory = new Map();
  return new Profile({}, {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  });
};

describe('sync: export and import round-trip', () => {
  it('restores xp, drills, achievements and bankroll exactly', () => {
    const a = freshProfile();
    a.addXp(1234);
    a.recordDrill('outs', true);
    a.recordDrill('outs', false);
    a.unlockAchievement('first-blood');
    a.setBankroll(430, 'nl10');

    const code = exportCode(a);
    const b = freshProfile();
    importCode(b, code);

    equal(b.xp, a.xp);
    equal(b.data.bankroll, 430);
    equal(b.data.stakeKey, 'nl10');
    equal(b.drillStats('outs').attempts, 2);
    equal(b.drillStats('outs').correct, 1);
    assert(b.hasAchievement('first-blood'), 'achievement should carry over');
  });

  it('carries unicode through the base64 round trip intact', () => {
    // Not a real profile field — just a payload the base64/UTF-8 handling
    // must not mangle, since rank names and toasts are full of emoji.
    const a = freshProfile();
    a.data._unicodeProbe = 'Café ♠ 大 🐟🧠';
    a.save();
    const b = freshProfile();
    importCode(b, exportCode(a));
    equal(b.data._unicodeProbe, 'Café ♠ 大 🐟🧠');
  });

  it('produces a code carrying the format prefix', () => {
    const code = exportCode(freshProfile());
    assert(code.startsWith('PT1-'), `expected a PT1- prefixed code, got "${code.slice(0, 12)}"`);
  });

  it('is deterministic: two exports of the same state both import to the same result', () => {
    const a = freshProfile();
    a.addXp(50);
    const code1 = exportCode(a);
    const code2 = exportCode(a);

    const b = freshProfile();
    importCode(b, code1);
    const c = freshProfile();
    importCode(c, code2);
    equal(b.xp, c.xp);
  });

  it('overwrites the target rather than merging', () => {
    const source = freshProfile();
    source.addXp(100);

    const target = freshProfile();
    target.addXp(99999);
    target.unlockAchievement('level-10');

    importCode(target, exportCode(source));
    equal(target.xp, 100, 'import replaces, it does not keep the larger value');
    assert(!target.hasAchievement('level-10'), 'the overwritten achievement list should not survive');
  });
});

describe('sync: rejects bad input without crashing', () => {
  it('rejects a completely unrelated string', () => {
    throws(() => decodeSyncCode('hello world'), 'should reject a non-code string');
  });

  it('rejects empty or missing input', () => {
    throws(() => decodeSyncCode(''), 'should reject an empty string');
    throws(() => decodeSyncCode(undefined), 'should reject undefined');
    throws(() => decodeSyncCode(null), 'should reject null');
  });

  it('rejects a truncated code', () => {
    const a = freshProfile();
    a.addXp(999);
    const code = exportCode(a);
    throws(() => decodeSyncCode(code.slice(0, code.length - 10)), 'a chopped code should fail the checksum');
  });

  it('rejects a code with a tampered body', () => {
    const a = freshProfile();
    a.addXp(999);
    const code = exportCode(a);
    throws(() => decodeSyncCode(`${code.slice(0, -4)}xxxx`), 'a corrupted body should fail the checksum');
  });

  it('tolerates surrounding whitespace from a copy-paste', () => {
    const a = freshProfile();
    a.addXp(250);
    const code = exportCode(a);
    const data = decodeSyncCode(`  \n${code}\t\n `);
    equal(data.xp, 250);
  });

  it('gives a short, readable message rather than a stack trace or a broken template', () => {
    try {
      decodeSyncCode('garbage');
      assert(false, 'should have thrown');
    } catch (err) {
      assert(err.message.length > 10 && err.message.length < 200, 'message should be a real sentence');
      assert(!/undefined|NaN|\[object/.test(err.message), `broken message: "${err.message}"`);
    }
  });
});

describe('sync: summarize', () => {
  it('describes a fresh profile sanely', () => {
    const s = summarize(freshProfile().data);
    equal(s.xp, 0);
    equal(s.hands, 0);
    equal(s.achievements, 0);
    equal(s.rank, 'Fish');
  });

  it('reflects real progress', () => {
    const a = freshProfile();
    a.addXp(5000);
    a.data.handsPlayed = 42;
    a.unlockAchievement('first-blood');
    const s = summarize(a.data);
    equal(s.hands, 42);
    equal(s.xp, 5000);
    equal(s.achievements, 1);
    assert(s.rank !== 'Fish', 'rank should have advanced past the starting rank');
  });
});
