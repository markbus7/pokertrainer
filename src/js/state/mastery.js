/**
 * What "mastered" actually means, stated once and used everywhere.
 *
 * This exists because it previously did not. A badge appeared on a module
 * once accuracy passed 90% over as few as five questions — a threshold you
 * could clear by luck, awarded silently, with nothing ever telling you the
 * target existed or that you had reached it. A goal you cannot see is not a
 * goal, and a milestone nobody announces is not a milestone.
 */

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
    missing.push(`${req.attempts - stats.attempts} more question${req.attempts - stats.attempts === 1 ? '' : 's'}`);
  }
  if (accuracy < req.accuracy) {
    missing.push(`${Math.round(req.accuracy * 100)}% accuracy (you are at ${Math.round(accuracy * 100)}%)`);
  }
  if (req.lesson && !profile.hasCompletedWalkthrough(moduleId)) {
    missing.push('the guided lesson');
  }

  return {
    target,
    name: tierByKey(target).name,
    requirement: `${req.attempts} questions at ${Math.round(req.accuracy * 100)}%`
      + (req.lesson ? ', plus the lesson' : ''),
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
