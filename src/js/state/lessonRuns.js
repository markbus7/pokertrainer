/**
 * A lesson as a fixed set of hands, marked at the end, remembered afterwards.
 *
 * A table that deals your own spots forever is practice, not a lesson: there
 * is no moment where somebody says how it went, and nothing carries over to
 * the next sitting. A run gives it a shape — ten spots, a report, and a note
 * of the specific mistakes you made so the next run can open by naming them.
 *
 * The memory is per mistake, not per module. "You are 60% at Pot Odds" tells
 * you nothing you can act on; "you called without the odds four times" is a
 * thing you can watch for on the very next hand.
 */

import { t } from '../i18n/index.js';

/** Spots in one run. Ten is long enough to see a pattern and short enough to finish. */
export const RUN_LENGTH = 10;

/** A mistake stops being "current" once you have gone this many spots without it. */
const FORGIVEN_AFTER = 12;

/**
 * What each mistake is, and the one thing to do about it. Keyed by the id the
 * judge stamps on its verdict, so renaming a headline cannot silently orphan
 * a reader's history.
 */
export const MISTAKES = {
  'called-without-odds': {
    label: 'Calling without the price',
    fix: 'Work out what the pot is asking before you look at your hand. If your equity is under it, fold.',
  },
  'folded-the-best': {
    label: 'Folding the best hand',
    fix: 'When you are ahead there is no price too high. Count what beats you before you fold.',
  },
  'fold-for-free': {
    label: 'Folding when checking was free',
    fix: 'If it costs nothing to see the next card, there is never a reason to fold.',
  },
  'missed-value': {
    label: 'Checking back a hand that should bet',
    fix: 'A hand that beats what they call with is a hand that should be betting.',
  },
  'thin-bet': {
    label: 'Betting a hand that cannot get called by worse',
    fix: 'Ask what calls you. If only better hands call, the bet is losing money.',
  },
  'opened-outside-range': {
    label: 'Opening hands the seat does not play',
    fix: 'Check the chart for this seat. Early position is much tighter than the button.',
  },
  'folded-in-range': {
    label: 'Folding hands the seat does play',
    fix: 'The chart is the whole answer preflop. If it is in the range, open it.',
  },
  limped: {
    label: 'Limping instead of raising',
    fix: 'Raise or fold. Limping gives everyone behind you a cheap look at a flop.',
  },
  'checked-back-value': {
    label: 'Checking back after taking the lead',
    fix: 'You raised before the flop; on most boards the bet is automatic.',
  },
  'cbet-wrong-board': {
    label: 'Continuation betting into the wrong board',
    fix: 'Boards that hit their calling range are boards to give up on.',
  },
  'misread-hand': {
    label: 'Reading your own hand wrong',
    fix: 'Say the five cards out loud: three from the board and two from your hand, or four and one.',
  },
  'missed-free-cbet': {
    label: 'Passing up a free continuation bet',
    fix: 'A dry board they checked on is the cheapest pot in poker.',
  },
};

export const mistakeInfo = (id) => MISTAKES[id] || null;

/* ------------------------------------------------------------------ *
 * A run in progress
 * ------------------------------------------------------------------ */

export function startRun(moduleId, length = RUN_LENGTH) {
  return { moduleId, length, spots: [] };
}

/** Record one graded decision. Only the lesson's own spots count toward it. */
export function recordSpot(run, verdict) {
  if (!run || run.spots.length >= run.length) return run;
  run.spots.push({ id: verdict.id || null, level: verdict.level, cost: verdict.cost || 0 });
  return run;
}

export const runComplete = (run) => Boolean(run) && run.spots.length >= run.length;

/**
 * How the run went, and what to say about it.
 *
 * Mistakes are counted by id and sorted by how often they happened, because
 * the one you made four times is the one worth naming first.
 */
export function scoreRun(run) {
  const spots = run.spots;
  const right = spots.filter((s) => s.level === 'good').length;
  const ok = spots.filter((s) => s.level === 'ok').length;
  const counts = new Map();
  for (const s of spots) {
    if (s.level !== 'bad' || !s.id) continue;
    counts.set(s.id, (counts.get(s.id) || 0) + 1);
  }
  const mistakes = [...counts]
    .map(([id, count]) => ({ id, count, ...(MISTAKES[id] || { label: id, fix: '' }) }))
    .sort((a, b) => b.count - a.count);
  const cost = spots.reduce((sum, s) => sum + (s.level === 'bad' ? Math.abs(s.cost) : 0), 0);
  return { total: spots.length, right, ok, wrong: spots.length - right - ok, mistakes, cost };
}

/* ------------------------------------------------------------------ *
 * What carries over
 * ------------------------------------------------------------------ */

const store = (profile) => {
  if (!profile.data.lessonRuns) profile.data.lessonRuns = {};
  return profile.data.lessonRuns;
};

const entryFor = (profile, moduleId) => {
  const all = store(profile);
  if (!all[moduleId]) all[moduleId] = { runs: 0, best: null, weak: {}, seen: 0 };
  return all[moduleId];
};

/**
 * File a finished run and update what is remembered.
 *
 * A mistake you did not repeat fades: `seen` counts every spot the module has
 * ever shown you, and a weak spot whose last sighting is far enough back is
 * dropped. Otherwise the first bad run would haunt the reader forever.
 */
export function saveRun(profile, run) {
  const score = scoreRun(run);
  const entry = entryFor(profile, run.moduleId);
  entry.runs += 1;
  entry.seen += score.total;
  const rate = score.total ? (score.right + score.ok) / score.total : 0;
  if (entry.best === null || rate > entry.best) entry.best = rate;

  for (const m of score.mistakes) {
    const was = entry.weak[m.id] || { count: 0, lastSeen: 0 };
    entry.weak[m.id] = { count: was.count + m.count, lastSeen: entry.seen };
  }
  for (const [id, w] of Object.entries(entry.weak)) {
    if (entry.seen - w.lastSeen >= FORGIVEN_AFTER) delete entry.weak[id];
  }
  entry.last = { at: Date.now(), ...score, mistakes: score.mistakes.map((m) => m.id) };
  profile.save();
  return score;
}

/** What this module keeps catching you on, worst first. */
export function weakSpots(profile, moduleId) {
  const entry = (profile.data.lessonRuns || {})[moduleId];
  if (!entry) return [];
  return Object.entries(entry.weak)
    .map(([id, w]) => ({ id, ...w, ...(MISTAKES[id] || { label: id, fix: '' }) }))
    .sort((a, b) => b.count - a.count);
}

/** Runs finished, and the best pass rate so far. */
export function runHistory(profile, moduleId) {
  const entry = (profile.data.lessonRuns || {})[moduleId];
  return entry ? { runs: entry.runs, best: entry.best, last: entry.last || null } : { runs: 0, best: null, last: null };
}

/** One line for the top of a run: what to watch for, from last time. */
export function watchFor(profile, moduleId) {
  const weak = weakSpots(profile, moduleId);
  if (!weak.length) return null;
  const worst = weak[0];
  return t('Last time this caught you {n} times: {label}. {fix}',
    { n: worst.count, label: t(worst.label), fix: t(worst.fix) });
}
