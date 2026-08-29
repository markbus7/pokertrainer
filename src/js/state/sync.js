/**
 * Cross-device sync with no account and no server: your whole profile
 * serializes into a short text code (or a downloadable file). Paste it into
 * the trainer on another device to restore your progress there.
 *
 * This is a save code, not live sync — importing replaces what is on the
 * target device, the same way loading a save file would.
 */

import { rankForXp } from './profile.js';

const PREFIX = 'PT1';

/** Small integrity check to catch a chopped or mis-pasted code — not a security check. */
function checksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/** btoa is Latin1-only; this round-trips arbitrary UTF-8 (emoji in names, etc). */
function toBase64Utf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function fromBase64Utf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

/** Serialize a profile's save data into a shareable code. */
export function exportCode(profile) {
  const json = JSON.stringify(profile.data);
  return `${PREFIX}-${checksum(json)}-${toBase64Utf8(json)}`;
}

/** Parse a sync code back into save data, or throw with a message a player can act on. */
export function decodeSyncCode(code) {
  const trimmed = String(code || '').trim();
  const parts = trimmed.split('-');
  if (parts.length < 3 || parts[0] !== PREFIX) {
    throw new Error('That does not look like a Poker Trainer sync code.');
  }

  const [, sum, ...rest] = parts;
  const body = rest.join('-');
  let json;
  try {
    json = fromBase64Utf8(body);
  } catch {
    throw new Error('That code is corrupted or incomplete — check you copied all of it.');
  }
  if (checksum(json) !== sum) {
    throw new Error('That code is corrupted or incomplete — check you copied all of it.');
  }

  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('That code is corrupted or incomplete — check you copied all of it.');
  }
  if (typeof data !== 'object' || data === null || typeof data.xp !== 'number') {
    throw new Error('That code does not contain valid Poker Trainer progress.');
  }
  return data;
}

/** Apply imported save data onto a profile, replacing what is there now. */
export function importCode(profile, code) {
  const data = decodeSyncCode(code);
  profile.data = {
    ...profile.data,
    ...data,
    settings: { ...profile.data.settings, ...(data.settings || {}) },
  };
  profile.save();
  return profile;
}

/** A short human summary of save data, for a before-you-overwrite comparison. */
export function summarize(data) {
  const rank = rankForXp(data.xp || 0);
  return {
    rank: rank.name,
    emoji: rank.emoji,
    xp: data.xp || 0,
    hands: data.handsPlayed || 0,
    achievements: (data.achievements || []).length,
  };
}
