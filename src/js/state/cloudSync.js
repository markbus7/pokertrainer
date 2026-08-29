/**
 * Automatic cross-device sync backed by a private GitHub Gist on your own
 * account. One-time setup per device — paste a classic personal access token
 * with the `gist` scope — and after that, progress pulls in on load and
 * pushes out automatically a few seconds after you make any.
 *
 * This is last-write-wins, not real-time collaboration: if you played both
 * devices at literally the same moment, whichever pushes last overwrites the
 * other. In the realistic case — finish on one device, open the trainer on
 * another later — it just has your current progress with no action needed.
 *
 * Sibling of sync.js (the manual save-code path): that one needs nothing but
 * a browser, this one needs a token but never needs you to copy anything.
 */

import { summarize, applyImportedData } from './sync.js';

const STORAGE_KEY = 'poker-trainer.cloudsync.v1';
const FILE_NAME = 'poker-trainer-save.json';
const DESCRIPTION = 'Poker Trainer sync save — safe to ignore, do not edit by hand';
const API = 'https://api.github.com';
const DEFAULT_DEBOUNCE_MS = 3500;

/** New-token page with the right scope pre-selected, so setup is one click plus a copy. */
export const TOKEN_SETUP_URL = 'https://github.com/settings/tokens/new?description=Poker%20Trainer%20sync&scopes=gist';

function createStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('__pt_probe', '1');
      localStorage.removeItem('__pt_probe');
      return localStorage;
    }
  } catch {
    /* Private browsing, blocked storage: fall through to memory. */
  }
  const memory = new Map();
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  };
}

let storage = createStorage();
let fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null;
let debounceMs = DEFAULT_DEBOUNCE_MS;

/** Test hook: swap the storage backend, the fetch implementation, and/or the push delay. */
export function _configureForTest({ storage: s, fetch: f, debounceMs: d } = {}) {
  if (s) storage = s;
  if (f) fetchImpl = f;
  if (d) debounceMs = d;
}

function readConnection() {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeConnection(conn) {
  storage.setItem(STORAGE_KEY, JSON.stringify(conn));
}

export function isConnected() {
  const c = readConnection();
  return !!(c && c.token && c.gistId);
}

/** For the settings UI: connection state without exposing the token itself. */
export function getStatus() {
  const c = readConnection();
  if (!c || !c.token) return { connected: false };
  return { connected: !!c.gistId, lastSyncedAt: c.lastSyncedAt || null };
}

export function disconnect() {
  storage.removeItem(STORAGE_KEY);
}

/* ------------------------------------------------------------------ *
 * GitHub Gist API plumbing
 * ------------------------------------------------------------------ */

async function request(token, path, options = {}) {
  if (!fetchImpl) return { ok: false, reason: 'no-fetch', message: 'This environment cannot make network requests.' };

  let res;
  try {
    res = await fetchImpl(`${API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    return { ok: false, reason: 'network', message: 'Could not reach GitHub — check your connection.' };
  }

  if (res.status === 401) {
    return { ok: false, reason: 'bad-token', message: 'GitHub rejected that token. It may be mistyped, revoked, or expired — create a new one and reconnect.' };
  }
  if (res.status === 403) {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'GitHub refused that request. Make sure the token is a classic token with the "gist" scope — fine-grained tokens cannot access Gists — or you may be temporarily rate-limited.',
    };
  }
  if (res.status === 404) {
    return { ok: false, reason: 'not-found', message: 'That was not found on GitHub.' };
  }
  if (!res.ok) {
    return { ok: false, reason: 'http-error', message: `GitHub returned an error (${res.status}).` };
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* Some responses have no body. */
  }
  return { ok: true, data };
}

function extractSave(gist) {
  const file = gist.files && gist.files[FILE_NAME];
  if (!file || !file.content) return null;
  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

async function findExistingGist(token) {
  const listed = await request(token, '/gists?per_page=100');
  if (!listed.ok) return listed;
  const match = (listed.data || []).find((g) => g.files && g.files[FILE_NAME]);
  if (!match) return { ok: true, data: null };
  return request(token, `/gists/${match.id}`);
}

function createGist(token, profileData) {
  return request(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: DESCRIPTION,
      public: false,
      files: { [FILE_NAME]: { content: JSON.stringify(profileData, null, 2) } },
    }),
  });
}

function updateGist(token, gistId, profileData) {
  return request(token, `/gists/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      files: { [FILE_NAME]: { content: JSON.stringify(profileData, null, 2) } },
    }),
  });
}

/* ------------------------------------------------------------------ *
 * Connecting
 * ------------------------------------------------------------------ */

/**
 * Validate a token and find-or-create the save gist.
 * If a save already existed remotely, this does NOT pick a side — it hands
 * back both summaries so the caller can ask which one to keep, the same way
 * the manual import flow confirms before overwriting anything.
 */
export async function connect(token, profile) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { ok: false, reason: 'empty', message: 'Paste a token first.' };

  const found = await findExistingGist(trimmed);
  if (!found.ok) return found;

  if (found.data) {
    const remoteData = extractSave(found.data);
    writeConnection({ token: trimmed, gistId: found.data.id, lastSyncedAt: null });
    return {
      ok: true,
      remoteExisted: true,
      remoteData,
      remoteSummary: remoteData ? summarize(remoteData) : null,
      localSummary: summarize(profile.data),
    };
  }

  const created = await createGist(trimmed, profile.data);
  if (!created.ok) return created;
  writeConnection({ token: trimmed, gistId: created.data.id, lastSyncedAt: created.data.updated_at });
  return { ok: true, remoteExisted: false };
}

/* ------------------------------------------------------------------ *
 * Syncing
 * ------------------------------------------------------------------ */

let applyingRemote = false;

/** Unconditionally overwrite the local profile with what is on GitHub right now. */
export async function applyRemote(profile) {
  const conn = readConnection();
  if (!conn || !conn.gistId) return { ok: false, reason: 'not-connected' };

  const got = await request(conn.token, `/gists/${conn.gistId}`);
  if (!got.ok) {
    if (got.reason === 'not-found') writeConnection({ ...conn, gistId: null });
    return got;
  }
  const remoteData = extractSave(got.data);
  if (!remoteData) return { ok: false, reason: 'empty', message: 'The cloud save looks empty or corrupted.' };

  applyingRemote = true;
  try {
    applyImportedData(profile, remoteData);
  } finally {
    applyingRemote = false;
  }
  writeConnection({ ...conn, lastSyncedAt: got.data.updated_at });
  return { ok: true, summary: summarize(remoteData) };
}

/** Pull and apply only if GitHub has something newer than what this device last synced. */
export async function applyRemoteIfNewer(profile) {
  const conn = readConnection();
  if (!conn || !conn.gistId) return { ok: false, reason: 'not-connected' };

  const got = await request(conn.token, `/gists/${conn.gistId}`);
  if (!got.ok) {
    if (got.reason === 'not-found') writeConnection({ ...conn, gistId: null });
    return got;
  }

  const remoteUpdatedAt = got.data.updated_at;
  if (conn.lastSyncedAt && new Date(remoteUpdatedAt).getTime() <= new Date(conn.lastSyncedAt).getTime()) {
    return { ok: true, applied: false };
  }

  const remoteData = extractSave(got.data);
  if (!remoteData) return { ok: true, applied: false };

  applyingRemote = true;
  try {
    applyImportedData(profile, remoteData);
  } finally {
    applyingRemote = false;
  }
  writeConnection({ ...conn, lastSyncedAt: remoteUpdatedAt });
  return { ok: true, applied: true, summary: summarize(remoteData) };
}

/** Push this device's current progress to GitHub. Self-heals if the gist was deleted out from under it. */
export async function pushLocal(profile) {
  const conn = readConnection();
  if (!conn || !conn.token) return { ok: false, reason: 'not-connected' };

  if (!conn.gistId) {
    const created = await createGist(conn.token, profile.data);
    if (!created.ok) return created;
    writeConnection({ ...conn, gistId: created.data.id, lastSyncedAt: created.data.updated_at });
    return { ok: true };
  }

  const updated = await updateGist(conn.token, conn.gistId, profile.data);
  if (!updated.ok) {
    if (updated.reason === 'not-found') {
      writeConnection({ ...conn, gistId: null });
      return pushLocal(profile);
    }
    return updated;
  }
  writeConnection({ ...conn, lastSyncedAt: updated.data.updated_at });
  return { ok: true };
}

/** Manual "Sync now": catch up from the cloud, then make sure the cloud has this device's state. */
export async function syncNow(profile) {
  if (!isConnected()) return { ok: false, reason: 'not-connected' };
  const pulled = await applyRemoteIfNewer(profile);
  if (!pulled.ok) return pulled;
  const pushed = await pushLocal(profile);
  return pushed.ok ? { ok: true, applied: pulled.applied } : pushed;
}

/* ------------------------------------------------------------------ *
 * Automatic background push
 * ------------------------------------------------------------------ */

let pushTimer = null;
let pushInFlight = false;
let pushAgainAfter = false;

/**
 * Call after any local profile change. Coalesces a burst of changes (a
 * Gauntlet run, a hand with five betting actions) into one push a few
 * seconds after things go quiet, rather than a request per change.
 */
export function scheduleAutoPush(profile, onResult) {
  if (applyingRemote || !isConnected()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => runPush(profile, onResult), debounceMs);
}

async function runPush(profile, onResult) {
  if (pushInFlight) { pushAgainAfter = true; return; }
  pushInFlight = true;
  const result = await pushLocal(profile);
  pushInFlight = false;
  if (typeof onResult === 'function') onResult(result);
  if (pushAgainAfter) {
    pushAgainAfter = false;
    runPush(profile, onResult);
  }
}

/** Test hook: cancel any pending debounced push and reset bookkeeping between tests. */
export function _resetAutoPushForTest() {
  clearTimeout(pushTimer);
  pushTimer = null;
  pushInFlight = false;
  pushAgainAfter = false;
  debounceMs = DEFAULT_DEBOUNCE_MS;
}
