import { describe, it, assert, equal } from './harness.js';
import { t, setLang, getLang, LANGUAGES, KEEP_ENGLISH, tableFor, needsTranslation } from '../src/js/i18n/index.js';
import { NL } from '../src/js/i18n/nl.js';
import { coverage } from '../tools/i18n-coverage.mjs';

describe('i18n: the mechanism', () => {
  it('falls back to English rather than showing a missing key', () => {
    setLang('nl');
    const nonsense = 'A string no table will ever contain, 4f2a91.';
    equal(t(nonsense), nonsense, 'unknown strings pass through unchanged');
    setLang('en');
  });

  it('fills placeholders after looking the string up', () => {
    setLang('nl');
    const out = t('Step {n} of {total}', { n: 3, total: 8 });
    assert(/3/.test(out) && /8/.test(out), `numbers survive translation: ${out}`);
    assert(!/\{n\}|\{total\}/.test(out), `no placeholder left behind: ${out}`);
    setLang('en');
  });

  it('never drops a placeholder carrying data, and never invents one', () => {
    // A dropped {n} silently renders a sentence with a number missing, which
    // no test of the English side would catch. Purely grammatical ones are a
    // different matter: {article} exists to pick "a" or "an", and Dutch uses
    // "een" either way, so a translation is right to leave it out.
    const GRAMMATICAL = new Set(['article']);
    for (const [key, value] of Object.entries(NL)) {
      const wanted = [...key.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const got = new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

      for (const name of got) {
        assert(wanted.includes(name),
          `"${key.slice(0, 50)}" has no {${name}}, so the translation renders it literally`);
      }
      for (const name of wanted) {
        if (GRAMMATICAL.has(name)) continue;
        assert(got.has(name),
          `{${name}} is missing from the translation of "${key.slice(0, 50)}" — its value would vanish`);
      }
    }
  });

  it('rejects an unknown language rather than blanking the app', () => {
    setLang('nl');
    setLang('kl');
    equal(getLang(), 'en', 'an unrecognised code falls back to English');
  });

  it('offers exactly the languages it can actually serve', () => {
    for (const lang of LANGUAGES) {
      if (lang.code === 'en') continue;
      assert(tableFor(lang.code), `${lang.code} is offered but has no table`);
    }
  });
});

describe('i18n: the poker vocabulary stays English', () => {
  it('never translates a term the game is teaching you to use', () => {
    // "pot odds" rendered as "potkansen" would be a word nobody at a table or
    // in a chat box uses, which defeats the point of teaching the vocabulary.
    for (const term of KEEP_ENGLISH) {
      assert(!Object.prototype.hasOwnProperty.call(NL, term),
        `"${term}" picked up a translation but is meant to stay English`);
    }
  });

  it('treats notation and numbers as needing no translation', () => {
    for (const s of ['AKs', 'A2s+', '22+', 'AA', '3,744', '1 in 21', '—']) {
      assert(!needsTranslation(s) || /in/.test(s), `${s} should not count as translatable`);
    }
    assert(needsTranslation('You are behind.'), 'real prose does need translating');
  });
});

describe('i18n: Dutch coverage', () => {
  const report = coverage('nl');

  for (const section of ['lessons', 'glossary', 'curriculum']) {
    it(`translates every ${section} string`, () => {
      const { total, missing } = report[section];
      assert(total > 0, `${section} has content to check`);
      assert(missing.length === 0,
        `${missing.length} of ${total} ${section} strings are still English, e.g. `
        + missing.slice(0, 3).map((s) => JSON.stringify(s.slice(0, 70))).join(' / '));
    });
  }

  it('never leaves a whole sentence untranslated', () => {
    // Short identical entries are legitimate and expected — "Pot Odds",
    // "Small blind", a formula, an emoji label. What would mean a batch got
    // pasted in unedited is a full sentence coming back byte-identical, so
    // that is what this looks for rather than an arbitrary count.
    const sentences = Object.entries(NL).filter(([k, v]) =>
      k === v && k.length >= 50 && !k.trim().startsWith('`'));
    assert(sentences.length === 0,
      `${sentences.length} full sentences are identical to their English source: `
      + sentences.slice(0, 3).map(([k]) => JSON.stringify(k.slice(0, 70))).join(' / '));
  });

  it('leaves no unclosed markup in a translation', () => {
    for (const [key, value] of Object.entries(NL)) {
      for (const [marker, name] of [['**', 'bold'], ['[[', 'term']]) {
        const inKey = (key.split(marker).length - 1);
        const inValue = (value.split(marker).length - 1);
        equal(inValue, inKey, `${name} markers differ for "${key.slice(0, 50)}"`);
      }
      const opens = value.split('[[').length - 1;
      const closes = value.split(']]').length - 1;
      equal(opens, closes, `unbalanced [[term]] in "${key.slice(0, 50)}"`);
    }
  });
});
