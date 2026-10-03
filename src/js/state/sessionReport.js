/**
 * What Silas writes down while you play, for you to read when you get up.
 *
 * Free play means nobody grades you out loud. The grading still happens —
 * every decision is judged exactly as it always was, it counts toward the
 * skill it exercised, and it decides the pearls — but it goes into his notes
 * instead of onto the table. This builds those notes from one sitting and
 * keeps the last few, so a session can be looked back on after the next one.
 *
 * Kept deliberately small: counts per skill, the three most expensive
 * decisions, and the style numbers once there are enough hands for them to
 * mean anything. The hands themselves already live in the Log.
 */

import { SAMPLE, leakReport } from './stats.js';

/** How many sittings' notes to keep. */
export const KEEP_REPORTS = 20;

/**
 * Two decisions of one kind is the least that says anything about it. One
 * right and one wrong is a coin that has been tossed, not a strength.
 */
export const SKILL_SAMPLE = 2;

/**
 * @param {object} s
 * @param {{kind:'stop'|'practice', key:string, name:string, label?:string}} s.place
 * @param {object} s.stats         the table's SessionStats
 * @param {Array} s.graded         one entry per decision: {skill, level, street, action, helped, head, costBb, handId}
 * @param {{hands:number, decisions:number, bonus:number, boat?:number}} s.pearls  `boat` is the strongbox's share
 * @param {Array<string>} s.savedHands  ids of hands kept in the Log this sitting
 * @param {{spent:number, back:number}|null} s.cash  at a stop: what the seats cost and what came back
 */
export function buildReport({ place, stats, graded, pearls, savedHands = [], cash = null, at = Date.now() }) {
  const bySkill = {};
  let sound = 0;
  let helped = 0;
  for (const d of graded) {
    if (d.helped) { helped++; continue; }
    const entry = bySkill[d.skill] || (bySkill[d.skill] = { right: 0, total: 0 });
    entry.total++;
    if (d.level !== 'bad') { entry.right++; sound++; }
  }
  const own = graded.length - helped;

  // The mistakes worth naming: priced ones first, most expensive first, then
  // the unpriced chart mistakes. A range error costs over thousands of hands
  // rather than this one, so it has no honest per-hand figure to sort by.
  const worst = graded
    .filter((d) => d.level === 'bad' && !d.helped)
    .sort((a, b) => (b.costBb || 0) - (a.costBb || 0))
    .slice(0, 3)
    .map((d) => ({ skill: d.skill, head: d.head, costBb: d.costBb || 0, handId: d.handId ?? null, street: d.street }));

  const summary = stats.summary();
  const leaks = leakReport(stats);
  const total = (pearls.hands || 0) + (pearls.decisions || 0) + (pearls.bonus || 0) + (pearls.boat || 0) + (pearls.bounty || 0)
    + (pearls.catches || 0);

  return {
    at,
    place,
    hands: summary.hands,
    profitBb: Math.round(summary.profitBb * 10) / 10,
    cash,
    pearls: {
      hands: pearls.hands || 0, decisions: pearls.decisions || 0, bonus: pearls.bonus || 0, boat: pearls.boat || 0, bounty: pearls.bounty || 0, catches: pearls.catches || 0, total,
    },
    decisions: { total: own, sound, helped, bySkill },
    worst,
    savedHands: savedHands.slice(-10),
    style: summary.hands >= SAMPLE.playStyle
      ? { vpip: summary.vpip, pfr: summary.pfr, af: summary.af }
      : null,
    leaks: leaks.ready ? leaks.leaks.map((l) => ({ id: l.id, title: l.title, fix: l.fix })) : [],
  };
}

/**
 * The skills a report has enough of to judge, best first. Each row carries
 * its share so the screen and the tests agree on what "strongest" means.
 */
export function rankedSkills(report) {
  return Object.entries(report.decisions.bySkill)
    .filter(([, s]) => s.total >= SKILL_SAMPLE)
    .map(([skill, s]) => ({ skill, ...s, share: s.right / s.total }))
    .sort((a, b) => b.share - a.share || b.total - a.total);
}

/**
 * The single strongest and weakest skill of a sitting, or nulls. A skill
 * cannot be both: with only one judged, it is reported as neither, because
 * "your best and your worst are the same thing" says nothing.
 */
export function strongestAndWeakest(report) {
  const rows = rankedSkills(report);
  if (rows.length < 2) return { strongest: null, weakest: null };
  const strongest = rows[0];
  const weakest = rows[rows.length - 1];
  if (strongest.share === weakest.share) return { strongest: null, weakest: null };
  return { strongest, weakest };
}

/** Keep a report on the profile, newest last, forgetting the oldest. */
export function keepReport(profile, report) {
  if (!Array.isArray(profile.data.reports)) profile.data.reports = [];
  profile.data.reports.push(report);
  if (profile.data.reports.length > KEEP_REPORTS) profile.data.reports.splice(0, profile.data.reports.length - KEEP_REPORTS);
  profile.save();
  return profile.data.reports.length - 1;
}

export function reportsOf(profile) {
  return Array.isArray(profile.data.reports) ? profile.data.reports : [];
}
