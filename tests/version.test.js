import { describe, it, assert, equal } from './harness.js';
import { VERSION, BUILT, REPO, MANIFEST_URL, compareVersions, checkForUpdate } from '../src/js/version.js';
import { readFileSync } from 'node:fs';

describe('version: the stamp matches the package', () => {
  it('is stamped from package.json, so the update check compares like with like', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    equal(VERSION, pkg.version, 'run `npm run stamp` after bumping the version');
  });

  it('carries a plausible build date and repo', () => {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(BUILT), `bad build date: ${BUILT}`);
    equal(REPO, 'markbus7/pokertrainer');
    assert(MANIFEST_URL.startsWith('https://raw.githubusercontent.com/'), 'should read the raw manifest');
    assert(MANIFEST_URL.endsWith('/main/package.json'), 'should track the main branch');
  });
});

describe('version: comparison', () => {
  it('orders versions correctly', () => {
    equal(compareVersions('1.0.0', '1.0.0'), 0);
    equal(compareVersions('1.0.1', '1.0.0'), 1);
    equal(compareVersions('1.0.0', '1.0.1'), -1);
    equal(compareVersions('2.0.0', '1.9.9'), 1);
  });

  it('does not compare version parts as strings', () => {
    // The classic bug: "1.10.0" < "1.9.0" under string comparison.
    equal(compareVersions('1.10.0', '1.9.0'), 1, '1.10.0 is newer than 1.9.0');
    equal(compareVersions('1.2.10', '1.2.9'), 1, '1.2.10 is newer than 1.2.9');
  });

  it('treats missing parts as zero', () => {
    equal(compareVersions('1.4', '1.4.0'), 0);
    equal(compareVersions('2', '1.9.9'), 1);
  });
});

describe('version: the update check never throws', () => {
  const withFetch = async (impl, fn) => {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    try { return await fn(); } finally { globalThis.fetch = original; }
  };

  it('reports being up to date when the published version matches', async () => {
    const r = await withFetch(
      async () => ({ ok: true, json: async () => ({ version: VERSION }) }),
      () => checkForUpdate(),
    );
    assert(r.ok && r.upToDate, `expected up to date, got ${JSON.stringify(r)}`);
  });

  it('reports being behind when a newer version is published', async () => {
    const r = await withFetch(
      async () => ({ ok: true, json: async () => ({ version: '99.0.0' }) }),
      () => checkForUpdate(),
    );
    assert(r.ok && r.behind, 'should notice a newer version');
    equal(r.latest, '99.0.0');
    equal(r.current, VERSION);
  });

  it('does not claim to be behind when running ahead of main', async () => {
    const r = await withFetch(
      async () => ({ ok: true, json: async () => ({ version: '0.0.1' }) }),
      () => checkForUpdate(),
    );
    assert(r.ok && r.upToDate && !r.behind, 'a dev build ahead of main is not "behind"');
  });

  it('degrades gracefully when the network fails', async () => {
    const r = await withFetch(
      async () => { throw new Error('offline'); },
      () => checkForUpdate(),
    );
    equal(r.ok, false);
    equal(r.reason, 'network');
    assert(r.message && r.message.length > 10, 'should say something a person can act on');
  });

  it('degrades gracefully on an HTTP error or rate limit', async () => {
    const r = await withFetch(async () => ({ ok: false, status: 429 }), () => checkForUpdate());
    equal(r.ok, false);
    equal(r.reason, 'http');
    assert(r.message.includes('429'), 'should name the status');
  });

  it('degrades gracefully on a malformed manifest', async () => {
    const r = await withFetch(
      async () => ({ ok: true, json: async () => ({ nope: true }) }),
      () => checkForUpdate(),
    );
    equal(r.ok, false);
    equal(r.reason, 'malformed');
  });
});
