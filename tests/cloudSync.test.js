import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import * as cloudSync from '../src/js/state/cloudSync.js';

const freshProfile = () => new Profile({}, memoryStorage());

function memoryStorage() {
  const memory = new Map();
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  };
}

/**
 * A fake GitHub Gists API: enough of the real surface (auth, list, get,
 * create, update, 404s) to drive cloudSync.js exactly like the browser would,
 * with an in-memory `gists` map standing in for GitHub's database. Reused
 * across "device" switches in a test to simulate two browsers sharing one
 * GitHub account.
 */
function makeFakeGithub({ token = 'good-token' } = {}) {
  let nextId = 1;
  const gists = new Map();
  let clock = Date.parse('2026-01-01T00:00:00Z');
  const tick = () => { clock += 1000; return new Date(clock).toISOString(); };

  const respond = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

  const fetchImpl = async (url, options = {}) => {
    const presented = (options.headers || {}).Authorization || '';
    if (presented !== `Bearer ${token}`) return respond(401, { message: 'Bad credentials' });

    const path = url.replace('https://api.github.com', '');
    const method = options.method || 'GET';

    if (method === 'GET' && path.startsWith('/gists?')) {
      return respond(200, [...gists.values()].map((g) => ({ id: g.id, description: g.description, updated_at: g.updated_at, files: g.files })));
    }
    if (method === 'GET' && /^\/gists\/[^/]+$/.test(path)) {
      const g = gists.get(path.split('/').pop());
      return g ? respond(200, g) : respond(404, { message: 'Not Found' });
    }
    if (method === 'POST' && path === '/gists') {
      const body = JSON.parse(options.body);
      const id = String(nextId++);
      const g = { id, description: body.description, files: body.files, updated_at: tick() };
      gists.set(id, g);
      return respond(201, g);
    }
    if (method === 'PATCH' && /^\/gists\/[^/]+$/.test(path)) {
      const g = gists.get(path.split('/').pop());
      if (!g) return respond(404, { message: 'Not Found' });
      const body = JSON.parse(options.body);
      g.files = { ...g.files, ...body.files };
      g.updated_at = tick();
      return respond(200, g);
    }
    return respond(404, { message: 'no route' });
  };

  return { fetchImpl, gists };
}

/** First "device" in a test: fresh connection storage + a fresh fake backend. */
const setup = (githubOpts) => {
  const github = makeFakeGithub(githubOpts);
  const storageA = memoryStorage();
  cloudSync._configureForTest({ storage: storageA, fetch: github.fetchImpl });
  cloudSync._resetAutoPushForTest();
  return { github, storageA };
};

/** A second "device": same backend (same GitHub account), its own local connection storage. */
const switchDevice = (github) => {
  const storage = memoryStorage();
  cloudSync._configureForTest({ storage, fetch: github.fetchImpl });
  return storage;
};

describe('cloudSync: connecting', () => {
  it('creates a new gist when none exists yet', async () => {
    const { github } = setup();
    const profile = freshProfile();
    profile.addXp(500);

    const result = await cloudSync.connect('good-token', profile);
    assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
    equal(result.remoteExisted, false);
    assert(cloudSync.isConnected());
    equal(github.gists.size, 1);
  });

  it('finds an existing save gist instead of creating a duplicate', async () => {
    const { github } = setup();
    const seed = freshProfile();
    seed.addXp(9000);
    await cloudSync.connect('good-token', seed);

    switchDevice(github);
    const result = await cloudSync.connect('good-token', freshProfile());

    equal(github.gists.size, 1, 'should not create a second gist');
    assert(result.ok);
    equal(result.remoteExisted, true);
    equal(result.remoteSummary.xp, 9000);
  });

  it('rejects a bad token with a readable reason and does not connect', async () => {
    setup();
    const result = await cloudSync.connect('wrong-token', freshProfile());
    equal(result.ok, false);
    equal(result.reason, 'bad-token');
    assert(!cloudSync.isConnected());
  });

  it('rejects empty input without making a request', async () => {
    setup();
    const result = await cloudSync.connect('   ', freshProfile());
    equal(result.ok, false);
    equal(result.reason, 'empty');
  });
});

describe('cloudSync: two devices sharing one GitHub account', () => {
  it('propagates a push from one device to another via applyRemoteIfNewer', async () => {
    const { github, storageA } = setup();
    const deviceA = freshProfile();
    await cloudSync.connect('good-token', deviceA);

    const storageB = switchDevice(github);
    const deviceB = freshProfile();
    await cloudSync.connect('good-token', deviceB);
    await cloudSync.applyRemote(deviceB); // establish a baseline, as the UI would after first connect

    cloudSync._configureForTest({ storage: storageA });
    deviceA.addXp(777);
    await cloudSync.pushLocal(deviceA);

    cloudSync._configureForTest({ storage: storageB });
    const result = await cloudSync.applyRemoteIfNewer(deviceB);
    assert(result.ok && result.applied, `expected an applied pull, got ${JSON.stringify(result)}`);
    equal(deviceB.xp, 777);
  });

  it('does not re-apply the same remote state twice', async () => {
    const { github } = setup();
    const deviceA = freshProfile();
    await cloudSync.connect('good-token', deviceA);

    switchDevice(github);
    const deviceB = freshProfile();
    await cloudSync.connect('good-token', deviceB);
    await cloudSync.applyRemote(deviceB);

    const again = await cloudSync.applyRemoteIfNewer(deviceB);
    equal(again.ok, true);
    equal(again.applied, false, 'nothing changed since the baseline sync');
  });

  it('round-trips drill stats and achievements, not just XP', async () => {
    const { github } = setup();
    const deviceA = freshProfile();
    deviceA.recordDrill('outs', true);
    deviceA.recordDrill('outs', false);
    deviceA.unlockAchievement('first-blood');
    await cloudSync.connect('good-token', deviceA);
    await cloudSync.pushLocal(deviceA);

    switchDevice(github);
    const deviceB = freshProfile();
    await cloudSync.connect('good-token', deviceB);
    await cloudSync.applyRemote(deviceB);

    equal(deviceB.drillStats('outs').attempts, 2);
    equal(deviceB.drillStats('outs').correct, 1);
    assert(deviceB.hasAchievement('first-blood'));
  });

  it('syncNow pulls newer remote state and then pushes this device\'s state back', async () => {
    const { github } = setup();
    const deviceA = freshProfile();
    await cloudSync.connect('good-token', deviceA);
    deviceA.addXp(100);
    await cloudSync.pushLocal(deviceA);

    switchDevice(github);
    const deviceB = freshProfile();
    await cloudSync.connect('good-token', deviceB);
    const result = await cloudSync.syncNow(deviceB);

    assert(result.ok);
    equal(deviceB.xp, 100, 'syncNow should have pulled device A\'s progress');
  });
});

describe('cloudSync: resilience', () => {
  it('self-heals by recreating the gist if it was deleted out from under it', async () => {
    const { github } = setup();
    const profile = freshProfile();
    await cloudSync.connect('good-token', profile);
    const originalId = [...github.gists.keys()][0];
    github.gists.delete(originalId); // simulate the user deleting it on github.com

    profile.addXp(20);
    const result = await cloudSync.pushLocal(profile);
    assert(result.ok, `push should self-heal, got ${JSON.stringify(result)}`);
    equal(github.gists.size, 1, 'a fresh gist should have been created');
  });

  it('handles a 404 during applyRemoteIfNewer without throwing', async () => {
    const { github } = setup();
    const profile = freshProfile();
    await cloudSync.connect('good-token', profile);
    github.gists.clear();

    const result = await cloudSync.applyRemoteIfNewer(profile);
    equal(result.ok, false);
    equal(result.reason, 'not-found');
  });

  it('reports a clean failure when the connection has never been established', async () => {
    setup();
    const result = await cloudSync.pushLocal(freshProfile());
    equal(result.ok, false);
    equal(result.reason, 'not-connected');
  });
});

describe('cloudSync: disconnecting', () => {
  it('clears the connection without touching local progress', async () => {
    setup();
    const profile = freshProfile();
    profile.addXp(500);
    await cloudSync.connect('good-token', profile);
    assert(cloudSync.isConnected());

    cloudSync.disconnect();
    equal(cloudSync.isConnected(), false);
    equal(profile.xp, 500, 'disconnecting must not touch local progress');
  });
});

describe('cloudSync: status reporting', () => {
  it('reflects connection and last-synced state for the UI', async () => {
    setup();
    equal(cloudSync.getStatus().connected, false);

    const profile = freshProfile();
    await cloudSync.connect('good-token', profile);
    await cloudSync.pushLocal(profile);

    const status = cloudSync.getStatus();
    assert(status.connected);
    assert(status.lastSyncedAt, 'should record when the last sync happened');
  });
});

describe('cloudSync: never leaks the token into synced data', () => {
  it('the gist content contains no trace of the token', async () => {
    const { github } = setup();
    const profile = freshProfile();
    profile.addXp(10);
    await cloudSync.connect('good-token', profile);
    await cloudSync.pushLocal(profile);

    for (const g of github.gists.values()) {
      const content = g.files[Object.keys(g.files)[0]].content;
      assert(!content.includes('good-token'), 'the token must never end up inside the synced payload');
    }
  });
});

describe('cloudSync: automatic debounced push', () => {
  it('does nothing when not connected', async () => {
    setup();
    let called = false;
    cloudSync.scheduleAutoPush(freshProfile(), () => { called = true; });
    await new Promise((r) => setTimeout(r, 30));
    equal(called, false);
  });

  it('coalesces rapid changes into a single push after the quiet period', async () => {
    const { github } = setup();
    cloudSync._configureForTest({ debounceMs: 20 });
    const profile = freshProfile();
    await cloudSync.connect('good-token', profile);
    const gistId = [...github.gists.keys()][0];
    const updatedBefore = github.gists.get(gistId).updated_at;

    let calls = 0;
    profile.addXp(10);
    cloudSync.scheduleAutoPush(profile, () => calls++);
    profile.addXp(10);
    cloudSync.scheduleAutoPush(profile, () => calls++);
    profile.addXp(10);
    cloudSync.scheduleAutoPush(profile, () => calls++);

    await new Promise((r) => setTimeout(r, 90));
    equal(calls, 1, 'three rapid changes should coalesce into one push');
    assert(github.gists.get(gistId).updated_at !== updatedBefore, 'the gist should actually have been updated');
  });

  it('skips scheduling while a remote pull is being applied, to avoid an immediate echo push', async () => {
    const { github } = setup();
    cloudSync._configureForTest({ debounceMs: 20 });
    const deviceA = freshProfile();
    await cloudSync.connect('good-token', deviceA);
    deviceA.addXp(42);
    await cloudSync.pushLocal(deviceA);

    switchDevice(github);
    cloudSync._configureForTest({ debounceMs: 20 });
    const deviceB = freshProfile();
    await cloudSync.connect('good-token', deviceB);

    let pushCount = 0;
    // Mirrors app.js: every profile.save() schedules a push.
    deviceB.onChange(() => cloudSync.scheduleAutoPush(deviceB, () => pushCount++));
    await cloudSync.applyRemote(deviceB); // internally calls profile.save()

    await new Promise((r) => setTimeout(r, 90));
    equal(pushCount, 0, 'applying a remote pull should not trigger a push back');
  });
});
