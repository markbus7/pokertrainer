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

describe('the learning report', () => {
  it('says where the teaching is failing, not just how the player is doing', async () => {
    const { Profile } = await import('../src/js/state/profile.js');
    const { learningReport } = await import('../src/js/state/learningReport.js');
    const mem = new Map();
    const p = new Profile({}, {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    });
    // Someone who read the pot odds lesson and is still getting it wrong is
    // exactly the signal this exists to surface.
    p.markWalkthroughComplete('pot-odds');
    for (let i = 0; i < 30; i++) p.recordDrill('pot-odds', i % 3 !== 0);
    const report = learningReport(p);

    assert(/READ THE LESSON AND STILL GETTING IT WRONG/.test(report),
      'a lesson read and then failed must be called out');
    assert(/Pot Odds/.test(report), 'the failing module must be named');
    assert(/WHERE I AM STRUGGLING/.test(report), 'the struggle list must be present');
  });

  it('carries nothing that identifies the player', async () => {
    const { Profile } = await import('../src/js/state/profile.js');
    const { learningReport } = await import('../src/js/state/learningReport.js');
    const mem = new Map();
    const p = new Profile({}, {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    });
    p.addXp(500);
    const report = learningReport(p);
    // A token pasted into a report and shared would be a real leak.
    assert(!/ghp_|github_pat_|gist/i.test(report), 'the report must never carry a credential');
    assert(!/@/.test(report), 'no email-shaped text should appear');
  });
});

describe('exercises are recorded, and say what went wrong', () => {
  const fresh = () => {
    const mem = new Map();
    return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  };

  it('classifies the exact misreading a reader described', async () => {
    // Holding no hearts, with two on the board, and tapping the hearts anyway.
    const { classifyWrongPicks } = await import('../src/js/trainers/practice.js');
    const { parseCards, makeDeck, rankOf } = await import('../src/js/core/cards.js');
    const { countOuts } = await import('../src/js/core/equity.js');

    const hero = parseCards('Jd4d');
    const villain = parseCards('5dKs');
    const board = parseCards('2h5hQd');
    const seen = [...hero, ...villain, ...board];
    const outs = new Set(countOuts(hero, villain, board).outs);
    const hearts = makeDeck().filter((c) => (c & 3) === 2 && !outs.has(c) && !seen.includes(c));

    const tally = classifyWrongPicks(hero, villain, board, hearts);
    assert(tally['chasing-a-flush-you-cannot-make'] >= 4,
      `hearts should read as chasing a flush, got ${JSON.stringify(tally)}`);

    // A card that pairs the hero but still loses is a different misreading.
    const fours = makeDeck().filter((c) => rankOf(c) === 4 && !outs.has(c) && !seen.includes(c));
    const pairTally = classifyWrongPicks(hero, villain, board, fours);
    assert(pairTally['improves-your-hand-but-still-loses'] === fours.length,
      `pairing cards should read as improves-but-loses, got ${JSON.stringify(pairTally)}`);
  });

  it('does not call a better kicker an improvement', async () => {
    // The trap in classifying: a card that lifts your kicker scores higher
    // while leaving you the same nothing, and filing that under "improved"
    // would put every missed heart under the wrong lesson.
    const { classifyWrongPicks } = await import('../src/js/trainers/practice.js');
    const { parseCards } = await import('../src/js/core/cards.js');
    const tally = classifyWrongPicks(parseCards('Jd4d'), parseCards('5dKs'), parseCards('2h5hQd'), parseCards('3h'));
    assert(!tally['improves-your-hand-but-still-loses'],
      `a kicker bump is not an improvement, got ${JSON.stringify(tally)}`);
  });

  it('stores exercise results and surfaces them in the report', async () => {
    const { Profile } = await import('../src/js/state/profile.js');
    const { learningReport } = await import('../src/js/state/learningReport.js');
    const p = new Profile({}, fresh());

    p.recordPractice('outs', 'count-outs', false, { 'chasing-a-flush-you-cannot-make': 6 });
    p.recordPractice('outs', 'count-outs', true, {});
    const stats = p.practiceStats();
    equal(stats.length, 1, 'one exercise recorded');
    equal(stats[0].attempts, 2);
    equal(stats[0].correct, 1);
    equal(stats[0].tags['chasing-a-flush-you-cannot-make'], 6);

    const report = learningReport(p);
    assert(/HANDS-ON EXERCISES/.test(report), 'the report shows exercises');
    assert(/suit they hold none of/.test(report),
      'the report must name the misreading in words, not as a tag');
  });

  it('survives a save and reload, and keeps the tags', async () => {
    const { Profile } = await import('../src/js/state/profile.js');
    const storage = fresh();
    const first = new Profile({}, storage);
    first.recordPractice('outs', 'count-outs', false, { 'does-not-change-your-hand': 3 });

    const reloaded = Profile.load(storage);
    equal(reloaded.practiceStats()[0].tags['does-not-change-your-hand'], 3,
      'exercise history must persist like everything else');
  });

  it('never records a tag it has no wording for', async () => {
    const { Profile } = await import('../src/js/state/profile.js');
    const p = new Profile({}, fresh());
    p.recordPractice('outs', 'count-outs', false, { unclassified: 4, 'does-not-change-your-hand': 1 });
    const tags = p.practiceStats()[0].tags;
    assert(!('unclassified' in tags), 'an unnamed bucket teaches nothing and is dropped');
    equal(tags['does-not-change-your-hand'], 1);
  });
});
