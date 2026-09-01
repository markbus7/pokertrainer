/**
 * What the app can still only say in English.
 *
 * Walks the content the app renders — lessons, glossary, curriculum — and
 * reports which strings have no entry in a language table. Run it as
 * `node tools/i18n-coverage.mjs [lang] [--list]`.
 */
import { WALKTHROUGHS } from '../src/js/data/walkthroughs.js';
import { TERMS } from '../src/js/data/glossary.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { tableFor, KEEP_ENGLISH, needsTranslation } from '../src/js/i18n/index.js';

/** Every user-facing string in the structured content, grouped by source. */
export function contentStrings() {
  const groups = { lessons: new Set(), glossary: new Set(), curriculum: new Set() };

  for (const [id, w] of Object.entries(WALKTHROUGHS)) {
    const add = (s) => { if (typeof s === 'string' && s.trim()) groups.lessons.add(s); };
    add(w.intro);
    for (const point of w.recap || []) add(point);
    for (const step of w.steps) {
      add(step.title);
      for (const p of step.body) add(p);
      if (step.visual) {
        add(step.visual.caption);
        for (const h of step.visual.headers || []) add(h);
        for (const row of step.visual.rows || []) for (const cell of row) add(cell);
        for (const seg of step.visual.segments || []) add(seg.label);
        add(step.visual.needLabel); add(step.visual.haveLabel);
      }
      if (step.check) {
        add(step.check.question);
        for (const o of step.check.options) { add(o.label); add(o.why); }
      }
    }
    void id;
  }

  for (const term of Object.values(TERMS)) {
    groups.glossary.add(term.term);
    groups.glossary.add(term.short);
    groups.glossary.add(term.full);
  }

  for (const m of MODULE_META) {
    groups.curriculum.add(m.name);
    groups.curriculum.add(m.tagline);
    if (m.lesson) {
      groups.curriculum.add(m.lesson.summary);
      for (const p of m.lesson.points || []) groups.curriculum.add(p);
    }
  }
  return groups;
}

export function coverage(lang) {
  const table = tableFor(lang) || {};
  const groups = contentStrings();
  const report = {};
  for (const [name, set] of Object.entries(groups)) {
    const all = [...set].filter(needsTranslation);
    const missing = all.filter((s) => !Object.prototype.hasOwnProperty.call(table, s)
      && !KEEP_ENGLISH.has(s) && needsTranslation(s));
    report[name] = { total: all.length, missing };
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lang = process.argv[2] || 'nl';
  const report = coverage(lang);
  let total = 0, missing = 0;
  for (const [name, r] of Object.entries(report)) {
    total += r.total; missing += r.missing.length;
    const done = r.total - r.missing.length;
    console.log(`${name.padEnd(12)} ${String(done).padStart(4)}/${String(r.total).padEnd(4)} ` +
      `${((done / r.total) * 100).toFixed(0).padStart(3)}%`);
  }
  console.log(`${'TOTAL'.padEnd(12)} ${String(total - missing).padStart(4)}/${String(total).padEnd(4)} ` +
    `${(((total - missing) / total) * 100).toFixed(0).padStart(3)}%`);
  if (process.argv.includes('--list')) {
    for (const [name, r] of Object.entries(report)) {
      if (!r.missing.length) continue;
      console.log(`\n--- ${name} (${r.missing.length}) ---`);
      for (const s of r.missing) console.log(JSON.stringify(s));
    }
  }
}
