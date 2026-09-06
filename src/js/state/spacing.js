/**
 * Spaced repetition and calibration — the two mechanisms from *Make It Stick*
 * that do the most work.
 *
 * SPACING: reviewing a concept just as it starts to fade produces far more
 * durable memory than reviewing it while it is still fresh. So a concept you
 * get right comes back at a widening interval; one you get wrong comes back
 * tomorrow. The forgetting between sessions is not a bug — the effort of
 * retrieving something half-faded is exactly what strengthens it.
 *
 * CALIBRATION: people are poor judges of what they know, and fluency (having
 * just read something) feels like mastery. Recording confidence alongside
 * correctness makes that gap visible instead of letting it hide.
 */
import { t } from '../i18n/index.js';

/** Review gaps in days. After the last one a concept is considered durable. */
export const INTERVALS = [1, 3, 7, 16, 35, 75];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `expected` is what each word claims about your chances. Calibration is the
 * gap between that claim and what actually happened, so the number has to
 * live next to the word rather than being invented separately wherever it is
 * measured.
 */
export const CONFIDENCE = [
  { key: 'sure', label: 'Certain', hint: 'I know this', expected: 0.9 },
  { key: 'think', label: 'Fairly sure', hint: 'Pretty confident', expected: 0.7 },
  { key: 'guess', label: 'Guessing', hint: 'No real idea', expected: 0.4 },
];

const emptyCard = (concept) => ({
  concept,
  step: 0,          // how far along INTERVALS this concept has travelled
  due: 0,           // epoch ms; 0 means "never studied, due now"
  reps: 0,
  lapses: 0,
  lastSeen: 0,
});

export function getCard(profile, concept) {
  const all = profile.data.spacing || {};
  return all[concept] ? { ...emptyCard(concept), ...all[concept] } : emptyCard(concept);
}

/**
 * Record an attempt and schedule the next review.
 * @param {boolean} correct
 * @param {number} now  injectable so tests do not depend on the clock
 */
export function review(profile, concept, correct, now = Date.now()) {
  const card = getCard(profile, concept);
  card.reps++;
  card.lastSeen = now;

  if (correct) {
    card.step = Math.min(card.step + 1, INTERVALS.length);
  } else {
    // Getting it wrong drops you back a rung rather than to the very start:
    // one slip should not erase weeks of successful recall.
    card.lapses++;
    card.step = Math.max(0, card.step - 1);
  }

  const days = INTERVALS[Math.min(card.step, INTERVALS.length - 1)];
  card.due = now + (correct ? days : 1) * DAY_MS;

  if (!profile.data.spacing) profile.data.spacing = {};
  profile.data.spacing[concept] = card;
  profile.save();
  return card;
}

/** Concepts whose review is due, soonest first. */
export function dueConcepts(profile, concepts, now = Date.now()) {
  return concepts
    .map((concept) => getCard(profile, concept))
    .filter((card) => card.due <= now)
    .sort((a, b) => a.due - b.due)
    .map((card) => card.concept);
}

/**
 * Has this concept been met at all — in a lesson, a drill, or the Lab?
 * Anything that surfaces a review schedule needs this, and checking only
 * drill history quietly excludes practice done in the Lab.
 */
export function hasStudied(profile, concept) {
  if (getCard(profile, concept).reps > 0) return true;
  if (profile.hasCompletedWalkthrough && profile.hasCompletedWalkthrough(concept)) return true;
  return profile.drillStats(concept).attempts > 0;
}

/** How firmly a concept is held: 0 (never seen) to 1 (survived every interval). */
export function strength(profile, concept) {
  return getCard(profile, concept).step / INTERVALS.length;
}

/** Human-readable "next review in ..." for the UI. */
export function nextReviewLabel(profile, concept, now = Date.now()) {
  const card = getCard(profile, concept);
  if (!card.reps) return t('not started');
  if (card.due <= now) return t('due now');
  const days = Math.ceil((card.due - now) / DAY_MS);
  return days <= 1 ? t('due tomorrow') : t('due in {n} days', { n: days });
}

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

/** Record how sure you felt against whether you were actually right. */
export function recordConfidence(profile, level, correct) {
  if (!profile.data.calibration) profile.data.calibration = {};
  const store = profile.data.calibration;
  if (!store[level]) store[level] = { attempts: 0, correct: 0 };
  store[level].attempts++;
  if (correct) store[level].correct++;
  profile.save();
  return store[level];
}

/**
 * The calibration report: what you believed against what was true.
 * The interesting row is "Certain" — being right less than ~90% of the time
 * when you felt certain is the specific blind spot worth knowing about.
 */
/**
 * Answers per confidence level before that row is worth reading.
 *
 * The verdict below has always waited for fifteen answers in total; the rows
 * themselves showed "100% of 1" above it, which undercut the whole panel.
 */
export const CALIBRATION_BAR = 5;

export function calibrationReport(profile) {
  const store = profile.data.calibration || {};
  const rows = CONFIDENCE.map(({ key, label }) => {
    const s = store[key] || { attempts: 0, correct: 0 };
    return {
      key,
      label,
      attempts: s.attempts,
      correct: s.correct,
      accuracy: s.attempts ? s.correct / s.attempts : null,
    };
  });

  const total = rows.reduce((sum, r) => sum + r.attempts, 0);
  const sure = rows.find((r) => r.key === 'sure');
  const guess = rows.find((r) => r.key === 'guess');

  let verdict = null;
  if (total >= 15) {
    if (sure.accuracy !== null && sure.accuracy < 0.75) {
      verdict = 'Overconfident: when you said you were certain, you were wrong about a quarter of the time. '
        + 'That gap is the most useful thing on this page — those are the spots you are not actually checking.';
    } else if (guess.accuracy !== null && guess.attempts >= CALIBRATION_BAR && guess.accuracy > 0.7) {
      verdict = 'Underconfident: your guesses are landing far more often than guesses should. '
        + 'You know this better than you think — trust the calculation.';
    } else if (sure.accuracy !== null && sure.accuracy >= 0.85) {
      verdict = 'Well calibrated: when you feel certain, you generally are. That is exactly what you want.';
    }
  }
  // How far confidence runs ahead of reality — measured only on the bands
  // that claim confidence. Averaging the guessing band in would let being
  // right when you guessed cancel out being wrong when you were certain, and
  // those are two different faults: the verdict above names each separately.
  // Bands under the bar are skipped, so one unlucky "certain" is not read as
  // chronic overconfidence.
  let weighted = 0;
  let counted = 0;
  for (const row of rows) {
    if (row.key === 'guess') continue;
    const band = CONFIDENCE.find((c) => c.key === row.key);
    if (row.attempts < CALIBRATION_BAR || row.accuracy === null) continue;
    weighted += (band.expected - row.accuracy) * row.attempts;
    counted += row.attempts;
  }
  const overconfidence = counted ? Math.max(0, weighted / counted) : 0;

  return { rows, total, verdict, overconfidence, ready: total >= 15 };
}
