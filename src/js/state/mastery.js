/**
 * What "mastered" actually means, stated once and used everywhere.
 *
 * This exists because it previously did not. A badge appeared on a module
 * once accuracy passed 90% over as few as five questions — a threshold you
 * could clear by luck, awarded silently, with nothing ever telling you the
 * target existed or that you had reached it. A goal you cannot see is not a
 * goal, and a milestone nobody announces is not a milestone.
 */
import { t } from '../i18n/index.js';

export const TIERS = [
  {
    key: 'untouched',
    name: 'Not started',
    icon: '○',
    tone: '',
    blurb: 'You have not tried this one yet.',
  },
  {
    key: 'learning',
    name: 'Learning',
    icon: '◔',
    tone: 'gold',
    blurb: 'Early days — keep drilling and the accuracy will follow.',
  },
  {
    key: 'solid',
    name: 'Solid',
    icon: '◑',
    tone: 'gold',
    blurb: 'You have this working. Now make it automatic.',
  },
  {
    key: 'mastered',
    name: 'Mastered',
    icon: '●',
    tone: 'green',
    blurb: 'Reliable under pressure, and proven over enough attempts to mean something.',
  },
];

/** Thresholds are deliberately public, so the UI can state the target. */
export const REQUIREMENTS = {
  solid: { attempts: 15, accuracy: 0.75 },
  mastered: { attempts: 30, accuracy: 0.9, lesson: true },
};

/**
 * How many answers a module needs before a percentage means anything.
 *
 * One number, used by every screen that shows a score and by the rule that
 * picks what to work on next. It used to be five in the profile and eight in
 * the recommendation, which is how a tile could read "3/3" — a perfect record
 * on the face of it, and worth nothing: three right in a row is what a coin
 * does one time in eight.
 */
export const EVIDENCE_BAR = 8;

/**
 * The honest one-line score for a module.
 *
 * Below the bar it says how many more answers it needs instead of printing a
 * percentage, because a number that cannot be trusted is worse than no number
 * — it reads as a verdict.
 */
export function scoreLine(profile, moduleId) {
  const stats = profile.drillStats(moduleId);
  if (!stats.attempts) return t('Not started');
  if (stats.attempts >= EVIDENCE_BAR) {
    return t('{correct}/{attempts} correct · {pct}%', {
      correct: stats.correct,
      attempts: stats.attempts,
      pct: Math.round((stats.correct / stats.attempts) * 100),
    });
  }
  const short = EVIDENCE_BAR - stats.attempts;
  return t('{correct}/{attempts} — {n} more before this counts as a score',
    { correct: stats.correct, attempts: stats.attempts, n: short });
}

export const tierByKey = (key) => TIERS.find((t) => t.key === key) || TIERS[0];

/** Which tier a module currently sits at. */
export function masteryTier(profile, moduleId) {
  const stats = profile.drillStats(moduleId);
  if (!stats.attempts) return 'untouched';

  const accuracy = stats.correct / stats.attempts;
  const m = REQUIREMENTS.mastered;
  const lessonDone = !m.lesson || profile.hasCompletedWalkthrough(moduleId);
  if (stats.attempts >= m.attempts && accuracy >= m.accuracy && lessonDone) return 'mastered';

  const s = REQUIREMENTS.solid;
  if (stats.attempts >= s.attempts && accuracy >= s.accuracy) return 'solid';
  return 'learning';
}

/**
 * Exactly what stands between you and the next tier, in plain terms.
 * Returns null once mastered.
 */
export function nextTierGoal(profile, moduleId) {
  const tier = masteryTier(profile, moduleId);
  if (tier === 'mastered') return null;

  const stats = profile.drillStats(moduleId);
  const accuracy = stats.attempts ? stats.correct / stats.attempts : 0;
  const target = tier === 'solid' ? 'mastered' : 'solid';
  const req = REQUIREMENTS[target];

  const missing = [];
  if (stats.attempts < req.attempts) {
    const short = req.attempts - stats.attempts;
    missing.push(short === 1 ? t('1 more question') : t('{n} more questions', { n: short }));
  }
  if (accuracy < req.accuracy) {
    missing.push(t('{need}% accuracy (you are at {have}%)',
      { need: Math.round(req.accuracy * 100), have: Math.round(accuracy * 100) }));
  }
  if (req.lesson && !profile.hasCompletedWalkthrough(moduleId)) {
    // An instruction, not a noun. Named as a thing rather than a thing to do,
    // this read as a category a reader could not act on — so they kept
    // drilling a module already past both numbers, which could never move it.
    missing.push(t('finish the guided lesson'));
  }

  return {
    target,
    name: tierByKey(target).name,
    requirement: t('{n} questions at {pct}%', { n: req.attempts, pct: Math.round(req.accuracy * 100) })
      + (req.lesson ? t(', plus the lesson') : ''),
    missing,
    // Progress is gated by whichever requirement is furthest behind, and
    // capped: exceeding one requirement does not carry you past another.
    progress: Math.min(1, Math.min(
      stats.attempts / req.attempts,
      req.accuracy > 0 ? accuracy / req.accuracy : 1,
    )),
  };
}

/**
 * Compare tiers around an action so a promotion can be announced at the
 * moment it happens, rather than discovered later on a tile.
 */
export function tierRank(key) {
  return TIERS.findIndex((t) => t.key === key);
}

export function promotion(beforeKey, afterKey) {
  return tierRank(afterKey) > tierRank(beforeKey) ? tierByKey(afterKey) : null;
}
