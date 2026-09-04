/**
 * What the generated text can still only say in English.
 *
 * The lessons and the glossary are fixed prose, and tools/i18n-coverage.mjs
 * measures those. The drills, the Lab and the hands-on exercises are not:
 * they build their sentences at run time with the numbers of the spot in
 * them. A sentence assembled that way has no key to look up, so it renders
 * in English however complete the translation table is — which is how a
 * Dutch reader ends up with a Dutch outs sentence followed by three English
 * ones underneath it.
 *
 * This runs every generator many times over, collects everything a reader
 * would see, and reports what has no Dutch. Run it as
 * `node tools/i18n-generated.mjs [--list]`.
 */

import { makeRng } from '../src/js/core/rng.js';
import { generateQuestion, DRILL_MODULE_IDS } from '../src/js/trainers/index.js';
import { generateSpot, LAB_TYPES } from '../src/js/trainers/lab.js';
import { makePractice, PRACTICE } from '../src/js/trainers/practice.js';
import { tableFor, KEEP_ENGLISH, needsTranslation, recordKeys, setLang, getLang } from '../src/js/i18n/index.js';

/** Everything a reader sees, grouped by where it comes from. */
export function generatedStrings({ rounds = 40, seed = 1 } = {}) {
  const groups = { drills: new Set(), lab: new Set(), exercises: new Set() };
  const rng = makeRng(seed);
  // Two things are collected at once. `groups` holds what a reader ends up
  // seeing — the measure that matters — and `keys` holds what the generators
  // asked t() for, which is the list somebody has to actually translate.
  const keys = new Set();
  recordKeys(keys);
  const add = (set, s) => { if (typeof s === 'string' && s.trim()) set.add(s.trim()); };

  for (let i = 0; i < rounds; i++) {
    for (const id of DRILL_MODULE_IDS) {
      let q;
      try { q = generateQuestion(id, rng, 3 + (i % 4)); } catch { continue; }
      add(groups.drills, q.prompt);
      add(groups.drills, q.question);
      add(groups.drills, q.explanation);
      for (const o of q.options || []) { add(groups.drills, o.label); add(groups.drills, o.why); }
    }

    for (const type of LAB_TYPES) {
      const spot = generateSpot(type, rng);
      add(groups.lab, spot.prompt);
      add(groups.lab, spot.question);
      for (const a of spot.actions || []) add(groups.lab, a.label);
      // Both a right and a wrong answer, since they explain differently.
      for (const given of answersFor(spot)) {
        const result = spot.solve(given);
        for (const line of result.lines || []) add(groups.lab, line);
        add(groups.lab, result.exact);
      }
    }

    for (const kind of Object.keys(PRACTICE)) {
      let spot;
      try { spot = makePractice(kind, rng); } catch { continue; }
      if (!spot) continue;
      collectDeep(groups.exercises, spot);
    }
  }
  recordKeys(null);
  groups.keys = keys;
  return groups;
}

/**
 * Exercise spots vary in shape — prompts, options, per-card explanations,
 * standings — so everything stringy is collected rather than a fixed set of
 * fields. Missing one field is how a sentence stays English unnoticed.
 */
function collectDeep(set, value, depth = 0) {
  if (depth > 6 || value == null) return;
  if (typeof value === 'string') {
    if (value.trim() && /\s/.test(value) && /[a-z]{3}/i.test(value)) set.add(value.trim());
    return;
  }
  if (Array.isArray(value)) { for (const v of value) collectDeep(set, v, depth + 1); return; }
  if (typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue;
      collectDeep(set, v, depth + 1);
    }
  }
}

/** Fields that are data or identifiers, never prose shown to a reader. */
const SKIP_KEYS = new Set(['id', 'kind', 'type', 'concept', 'module', 'answer', 'key',
  'cards', 'hole', 'board', 'villain', 'outs', 'tags', 'solve']);

/** A right answer and a wrong one, so both branches of solve() are seen. */
function answersFor(spot) {
  if (spot.inputKind === 'action') return spot.actions.map((a) => a.key);
  if (spot.inputKind === 'percent') return [spot.answer, spot.answer + 12];
  return [spot.answer, Math.round(spot.answer * 1.6) + 7];
}

/**
 * Keys as regexes, anchored at the start only: an explanation is often one key
 * followed by another, and what matters is whether the text came from keys.
 */
function patternsFor(keys) {
  return keys.map((key) => new RegExp(
    `^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '[\\s\\S]*?')}`,
  ));
}

/**
 * Rendered sentences that no key could have produced — text still being built
 * with a template literal somewhere. This asks how much of the *job* is left,
 * as opposed to how much of the translating is: a key with no Dutch shows up
 * in English, but so does a sentence that never reached t() at all, and only
 * the second kind needs a code change.
 */
export function untemplated(options = {}) {
  const groups = generatedStrings(options);
  const patterns = patternsFor([...groups.keys]);
  const out = {};
  for (const name of ['drills', 'lab', 'exercises']) {
    out[name] = [...groups[name]]
      .filter((s) => needsTranslation(s) && !KEEP_ENGLISH.has(s))
      .filter((s) => !patterns.some((re) => re.test(s)));
  }
  return out;
}

/**
 * What a reader in `lang` still sees in English.
 *
 * Generated twice from the same seed, once in each language, and compared
 * sentence for sentence. Checking the English text against the table instead
 * would answer a different question — once a string is translated the reader
 * never sees the English, so the English being absent from the table means
 * nothing. Coming out identical in both languages is the real symptom.
 */
export function coverage(lang = 'nl', options = {}) {
  const before = getLang();
  setLang('en');
  const english = generatedStrings(options);
  setLang(lang);
  const translated = generatedStrings(options);
  setLang(before);

  const table = tableFor(lang) || {};
  // Some entries are deliberately the same in both languages — "Call", "Fold",
  // "Hand A", "buy-ins". Those come out identical and are finished, so a
  // sentence only counts as missing if no *translated* key could have made it.
  const settled = patternsFor([...english.keys].filter((k) => table[k]));
  const report = {};
  for (const name of ['drills', 'lab', 'exercises']) {
    const en = [...english[name]];
    const nl = new Set(translated[name]);
    const wanted = en.filter((str) => needsTranslation(str) && !KEEP_ENGLISH.has(str));
    // Still there word for word after switching language, and not explained
    // by a key somebody chose to leave alone: untranslated.
    const missing = wanted.filter((str) => nl.has(str) && !settled.some((re) => re.test(str)));
    report[name] = { total: wanted.length, missing };
  }
  const keys = [...english.keys].filter((k) => needsTranslation(k) && !KEEP_ENGLISH.has(k));
  report.keys = { total: keys.length, missing: keys.filter((k) => !table[k]) };
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lang = process.argv.find((a) => /^[a-z]{2}$/.test(a) && a !== 'js') || 'nl';
  const report = coverage(lang, { rounds: 60 });

  console.log('What a reader sees (sentences, numbers and all):');
  for (const name of ['drills', 'lab', 'exercises']) {
    const r = report[name];
    console.log(`  ${name.padEnd(11)} ${String(r.total - r.missing.length).padStart(4)} / ${r.total}`);
  }
  const keys = report.keys;
  console.log(`\nKeys the generators ask for: ${keys.total - keys.missing.length} / ${keys.total} translated`);
  if (process.argv.includes('--list')) {
    console.log('\nStill to translate:');
    for (const s of keys.missing.sort()) console.log(`  ${JSON.stringify(s)},`);
  }
  if (process.argv.includes('--untemplated')) {
    const left = untemplated({ rounds: 60 });
    console.log('\nStill built with a template literal (needs a code change, not a translation):');
    for (const [name, list] of Object.entries(left)) {
      console.log(`  ${name}: ${list.length}`);
      for (const s of list.slice(0, 25)) console.log(`    ${s.slice(0, 150)}`);
    }
  }
  if (process.argv.includes('--english')) {
    console.log('\nStill rendering in English:');
    for (const name of ['drills', 'lab', 'exercises']) {
      for (const s of report[name].missing.sort().slice(0, 400)) console.log(`  [${name}] ${s}`);
    }
  }
}
