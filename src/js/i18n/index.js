/**
 * Translation, keyed on the English source string.
 *
 * There is no separate key vocabulary — t('Start drilling') looks up that
 * exact sentence. Two reasons. The call sites stay readable, so the code
 * still says what it will show; and anything missing from a table falls
 * back to English automatically rather than rendering a bare key like
 * "drill.start" at somebody mid-lesson.
 *
 * The same function covers lesson prose, so the 234 paragraphs of teaching
 * text need no parallel content files that could drift out of step with
 * the originals.
 */

import { NL } from './nl.js';

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'nl', label: 'Nederlands', short: 'NL', flag: '🇳🇱' },
];

const TABLES = { nl: NL };

/**
 * Poker vocabulary that stays English in every language.
 *
 * This is a list rather than a comment so it can be checked: the coverage
 * tool stops reporting these as unfinished work, and a test fails if one of
 * them ever picks up a translation. "Pot odds" rendered as "potkansen" would
 * be words nobody at a table or in a chat box uses, which defeats the point
 * of teaching the vocabulary at all.
 */
export const KEEP_ENGLISH = new Set([
  'Out', 'Outs', 'Flush draw', 'Gutshot', 'Open-ended straight draw',
  'Equity', 'Pot odds', 'Open', '3-bet', 'Suited', 'Offsuit', 'Combo', 'Limp',
  'Value bet', 'Fold equity', 'Overcard', 'Rainbow', 'Dry board', 'Wet board',
  'Stack', 'Kicker', 'Semi-bluff', 'Bluff catcher', 'Range', 'Continuation bet',
  'Street', 'Showdown', 'Blinds', 'SPR', 'MDF', 'ICM', 'VPIP', 'Rake',
  // The streets. Every Dutch table and hand history calls them these.
  'preflop', 'flop', 'turn', 'river', 'showdown',
  // The action, not the verb. Dutch players check; they do not "controleer".
  // The practice view's verify button says "Check my answer" for the same
  // reason — one English word was doing both jobs and losing one of them.
  'Check',
  'Dominated', 'The nuts', 'bb/100',
  // Hand categories: the names every room, chat box and hand history uses.
  // Both casings, because the lessons write them in a sentence and the
  // evaluator titles them — and a set only helps if it matches what the code
  // actually produces.
  'High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush',
  'Full house', 'Four of a kind', 'Straight flush', 'Royal Flush',
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
  'Full House', 'Four of a Kind', 'Straight Flush',
  // Formulas are notation, not language. The one below that does contain
  // words ("required equity = your call ...") is translated like any prose.
  '`W × 150  =  (100 − W) × 50`', '`150W = 5000 − 50W`', '`200W = 5000`', '`W = 25`',
]);

/** Poker hand shorthand: AA, AKs, AKo, A2s+, 22+. Notation, not language. */
const HAND_NOTATION = /^[2-9TJQKA]{2}[so]?\+?$/;

/**
 * Numbers, symbols and hand notation carry no language, so they are never
 * outstanding translation work.
 */
export const needsTranslation = (s) => {
  const text = String(s);
  return /\p{Letter}/u.test(text) && !HAND_NOTATION.test(text);
};

let current = 'en';
const listeners = new Set();

export const getLang = () => current;
export const languageOf = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

export function setLang(code) {
  const next = LANGUAGES.some((l) => l.code === code) ? code : 'en';
  if (next === current) return current;
  current = next;
  for (const fn of listeners) fn(current);
  return current;
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Optional recorder. The coverage tool for generated text needs the keys the
 * generators ask for, not the sentences that come back with the numbers
 * already in them — in English those two are the same string, and there is no
 * way to tell them apart from outside.
 *
 * @param {Set<string>|null} into  collect keys here, or null to stop.
 */
let recorder = null;

export function recordKeys(into) { recorder = into; }

/**
 * Translate, then fill in {placeholders}.
 *
 * Numbers are interpolated after lookup rather than baked into the key, so one
 * entry covers every value a screen can show and a translator never has to
 * guess which digits are part of the sentence.
 */
export function t(text, params = null) {
  if (text == null) return text;
  if (recorder && typeof text === 'string') recorder.add(text);
  const table = TABLES[current];
  let out = (table && Object.prototype.hasOwnProperty.call(table, text)) ? table[text] : text;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      out = out.split(`{${key}}`).join(String(value));
    }
  }
  return out;
}

/** True when a string has a translation in the active language. */
export function isTranslated(text) {
  const table = TABLES[current];
  return Boolean(table && Object.prototype.hasOwnProperty.call(table, text));
}

/** Every English string the given language has an entry for — used by tests. */
export const tableFor = (code) => TABLES[code] || null;
