import { runAll } from './harness.js';

const modules = [
  './evaluator.test.js',
  './equity.test.js',
  './odds.test.js',
  './ranges.test.js',
  './engine.test.js',
  './handHistory.test.js',
  './bots.test.js',
  './progression.test.js',
  './sync.test.js',
  './cloudSync.test.js',
  './walkthroughs.test.js',
  './version.test.js',
  './spacing.test.js',
  './mastery.test.js',
  './glossary.test.js',
  './i18n.test.js',
];

for (const m of modules) {
  await import(m);
}

const ok = await runAll();
if (!ok) process.exit(1);
