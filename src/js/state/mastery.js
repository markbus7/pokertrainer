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

/**
 * Thresholds are deliberately public, so the UI can state the target.
 *
 * These read "of your last N answers", not "of every answer you have ever
 * given". Lifetime accuracy was measured and it made the ladder a trap: a
 * module sitting at 40 answers and 75% needed **61 flawless answers in a
 * row** to reach Mastered, while the progress bar read 83% — because one bad
 * early session is divided into the average forever. A trainer that punishes
 * the learning it exists to cause has the sign backwards. A window forgets,
 * so the bar is always reachable: at most {window} answers, whatever happened
 * before.
 */
export const REQUIREMENTS = {
  solid: { window: 15, accuracy: 0.75 },
  mastered: { window: 30, accuracy: 0.9, lesson: true },
};

/** The longest window worth keeping, and so the size of the stored log. */
export const MASTERY_WINDOW = Math.max(...Object.values(REQUIREMENTS).map((r) => r.window));

/** How many of that window have to be right. Stated as a count, because
 *  "12 of your last 15" is checkable and "75%" is a sum to do. */
export const needCorrect = (req) => Math.ceil(req.window * req.accuracy);

/** How the last answers went: the only figure the tiers are judged on. */
export function windowScore(profile, moduleId, size = MASTERY_WINDOW) {
  const recent = (profile.drillStats(moduleId).recent || '').slice(-size);
  let correct = 0;
  for (const mark of recent) if (mark === '1') correct++;
  return { answered: recent.length, correct };
}

function meets(profile, moduleId, req) {
  const { answered, correct } = windowScore(profile, moduleId, req.window);
  if (answered < req.window || correct < needCorrect(req)) return false;
  return !req.lesson || profile.hasCompletedWalkthrough(moduleId);
}

/**
 * How many right-in-a-row would get you there from here.
 *
 * The number a reader actually wants, and one a window can answer at all:
 * every correct answer pushes an old one out, so the run is bounded by the
 * window itself. Under lifetime accuracy this figure was unbounded, which is
 * why it could never be shown.
 */
export function perfectRunNeeded(profile, moduleId, req) {
  const need = needCorrect(req);
  let recent = (profile.drillStats(moduleId).recent || '').slice(-req.window);
  for (let added = 0; added <= req.window; added++) {
    let correct = 0;
    for (const mark of recent) if (mark === '1') correct++;
    if (recent.length >= req.window && correct >= need) return added;
    recent = (recent + '1').slice(-req.window);
  }
  return req.window;
}

/**
 * Carry an old save's record into a window at the same rate.
 *
 * The totals are all a pre-window save has — the order the answers came in
 * was never stored — so the misses are spread evenly rather than invented at
 * a moment. Without this a reader with 52 answers at 96% opened the app to a
 * tile reading "96%" beside "you have 0 of your last 15", which is two
 * numbers for the same thing and no way to tell which one counts.
 */
export function seedWindow(attempts, correct) {
  const size = Math.min(attempts, MASTERY_WINDOW);
  if (!size) return '';
  const rate = correct / attempts;
  let done = 0;
  let out = '';
  for (let i = 0; i < size; i++) {
    const right = Math.round((i + 1) * rate) > done;
    if (right) done++;
    out += right ? '1' : '0';
  }
  return out;
}

/**
 * The rule this app used before windows, kept for one job: reading an
 * existing save. Somebody who earned Solid under the old rule keeps it.
 */
export function legacyTier(stats, lessonDone) {
  if (!stats || !stats.attempts) return 'untouched';
  const accuracy = stats.correct / stats.attempts;
  if (stats.attempts >= 30 && accuracy >= 0.9 && lessonDone) return 'mastered';
  if (stats.attempts >= 15 && accuracy >= 0.75) return 'solid';
  return 'learning';
}

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

/**
 * Which tier a module currently sits at, on current form.
 *
 * Deliberately not a high-water mark. Banking the best tier ever reached was
 * tried and is wrong here: a module you have since collapsed on would keep
 * its badge, and "what should I work on next" skips anything Mastered — so
 * the one skill that had fallen apart is the one the app would stop showing
 * you. A tier is a live reading, and the ladder says what would restore it.
 *
 * The exception is a save written before windows existed: it has totals but
 * no log, so its window starts empty. What the old rule had awarded stands
 * until the new window is full enough to speak for itself.
 */
export function masteryTier(profile, moduleId) {
  const stats = profile.drillStats(moduleId);
  if (!stats.attempts) return 'untouched';

  const live = meets(profile, moduleId, REQUIREMENTS.mastered) ? 'mastered'
    : meets(profile, moduleId, REQUIREMENTS.solid) ? 'solid' : 'learning';

  const grandfathered = stats.earned || 'untouched';
  const { answered } = windowScore(profile, moduleId, MASTERY_WINDOW);
  if (answered >= MASTERY_WINDOW || tierRank(live) >= tierRank(grandfathered)) return live;
  return grandfathered;
}

/**
 * Exactly what stands between you and the next tier, in plain terms.
 * Returns null once mastered.
 */
export function nextTierGoal(profile, moduleId) {
  const tier = masteryTier(profile, moduleId);
  if (tier === 'mastered') return null;

  const target = tier === 'solid' ? 'mastered' : 'solid';
  const req = REQUIREMENTS[target];
  const need = needCorrect(req);
  const { answered, correct } = windowScore(profile, moduleId, req.window);

  const run = perfectRunNeeded(profile, moduleId, req);
  const missing = [];
  if (answered < req.window || correct < need) {
    // The shortfall, not the target. A tile reading "12 of your last 15
    // right (you have 9)" leaves the reader subtracting one number on the
    // tile from another to find the only figure they wanted — the same
    // complaint that took the target off this line in the first place. The
    // full picture belongs on the module page, which has room to draw it.
    missing.push(run === 1 ? t('1 more right answer') : t('{n} right answers in a row', { n: run }));
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
    requirement: t('{need} of your last {window} answers right', { need, window: req.window })
      + (req.lesson ? t(', plus the lesson') : ''),
    missing,
    // A run of right answers that would do it — bounded, because the window
    // forgets. This is the figure a reader can act on today.
    run,
    // Gated by whichever requirement is furthest behind, and capped:
    // exceeding one requirement does not carry you past another.
    progress: Math.min(1, answered / req.window, correct / need),
  };
}

/**
 * The whole climb for one module, as rows a screen can draw.
 *
 * Built because the ladder existed only in prose, one tier at a time: a
 * reader could see the next bar but never the shape of the thing, so "how
 * much of what do I still have to do" had no answer on any screen.
 */
export function tierPlan(profile, moduleId) {
  const here = masteryTier(profile, moduleId);
  const rows = (key) => {
    const req = REQUIREMENTS[key];
    const need = needCorrect(req);
    const { answered, correct } = windowScore(profile, moduleId, req.window);
    const run = perfectRunNeeded(profile, moduleId, req);
    const out = [{
      label: t('{need} of your last {window} answers right', { need, window: req.window }),
      have: correct,
      need,
      // A window that is not full yet is short of answers, not of accuracy,
      // and saying "you have 6 of 12" hides that six of the missing ones are
      // questions nobody has asked you yet.
      //
      // The second note reconciles the two figures on the row. "11 of 12"
      // beside "3 right in a row" reads as a contradiction until you know
      // that a new answer pushes the oldest out — so a right answer replacing
      // a right answer moves nothing. Left unsaid, it is the same defect as
      // quoting a price against a pot the reader cannot see being built.
      note: answered < req.window
        ? t('{n} answered so far — the window fills as you go', { n: answered })
        : run > Math.max(0, need - correct)
          ? t('A new answer pushes the oldest out, so it takes a run of {run}, not {gap}.',
            { run, gap: Math.max(0, need - correct) })
          : null,
      met: answered >= req.window && correct >= need,
    }];
    if (req.lesson) {
      out.push({
        label: t('Finish the guided lesson'),
        have: profile.hasCompletedWalkthrough(moduleId) ? 1 : 0,
        need: 1,
        met: profile.hasCompletedWalkthrough(moduleId),
      });
    }
    return out;
  };

  return TIERS.filter((tier) => tier.key !== 'untouched').map((tier) => ({
    ...tier,
    // A module nobody has opened still has to say where the reader stands, or
    // all three rungs read "ahead" and the ladder marks nothing at all. The
    // first answer puts you on Learning, so that is where you are standing.
    state: tierRank(tier.key) < tierRank(here) ? 'done'
      : tier.key === here || (here === 'untouched' && tier.key === 'learning') ? 'here' : 'ahead',
    // Learning is where you stand the moment you answer one question, so it
    // has nothing to ask for. Stating that is better than an empty box.
    rows: tier.key === 'learning' ? [] : rows(tier.key),
    run: tier.key === 'learning' ? 0 : perfectRunNeeded(profile, moduleId, REQUIREMENTS[tier.key]),
  }));
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
