/**
 * A plain-text summary of how the learning is actually going, written to be
 * pasted into a conversation.
 *
 * The point is not another dashboard. It is that the person building this
 * cannot see where the teaching is failing — which lesson was read and then
 * immediately failed, which skill has been drilled a hundred times and still
 * sits at 60%, which concept keeps coming back from the spaced scheduler.
 * Those are the places the explanation is wrong, not the places the reader
 * is lazy, and none of them are visible from the outside.
 *
 * Deliberately no identifying information: no name, no token, no gist id.
 * Just what was studied and how it went.
 *
 * The report itself stays in English even when the app is in Dutch. It is
 * not something the player reads — it is something they hand to whoever is
 * fixing the lessons, and keeping one wording means the same phrase always
 * means the same problem.
 */

import { MODULE_META } from '../data/curriculum.js';
import { masteryTier, REQUIREMENTS } from './mastery.js';
import { calibrationReport, getCard, strength } from './spacing.js';
import { RANKS, requirementRows } from './profile.js';

/**
 * The misreadings the exercises can name, written as a sentence rather than
 * a code. A tag like "chasing-a-flush-you-cannot-make" is only useful if the
 * report says what it means for the lesson.
 */
const MISREADINGS = {
  'chasing-a-flush-you-cannot-make':
    'picked cards of a suit they hold none of — reading the board\'s suits as their own draw',
  'improves-your-hand-but-still-loses':
    'picked cards that improve the hand but still lose — treating "improves" as "wins"',
  'does-not-change-your-hand':
    'picked cards that change nothing — misread what the hand currently is',
};
import { VERSION } from '../version.js';

const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

/**
 * Modules ordered by how much trouble they are giving you: plenty of
 * attempts with poor accuracy first, because that is where an explanation
 * is most likely to be at fault rather than the effort.
 */
function struggles(profile) {
  return MODULE_META
    .map((meta) => {
      const stats = profile.drillStats(meta.id);
      const accuracy = stats.attempts ? stats.correct / stats.attempts : null;
      const card = getCard(profile, meta.id);
      return {
        id: meta.id,
        name: meta.name,
        attempts: stats.attempts,
        accuracy,
        tier: masteryTier(profile, meta.id),
        lesson: profile.hasCompletedWalkthrough(meta.id),
        lapses: card.lapses || 0,
        strength: strength(profile, meta.id),
      };
    })
    .filter((m) => m.attempts >= 5)
    .sort((a, b) => (a.accuracy - b.accuracy) || (b.attempts - a.attempts));
}

export function learningReport(profile) {
  const lines = [];
  const rank = profile.rank;
  const next = profile.nextRank;
  const rows = struggles(profile);

  lines.push('POKER TRAINER — LEARNING REPORT');
  lines.push(`version ${VERSION} · generated ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(`Rank: ${rank.name} (level ${rank.level} of ${RANKS.length}) · ${profile.xp} XP`);
  lines.push(`Hands played: ${profile.data.handsPlayed}`);

  if (next) {
    const missing = requirementRows(profile, next).filter((r) => !r.met);
    lines.push(missing.length
      ? `Toward ${next.name}: ${missing.map((r) => `${r.label} ${r.have}/${r.need}`).join(', ')}`
      : `Toward ${next.name}: all requirements met.`);
  }

  /* ---- where it is going badly ---- */
  lines.push('');
  lines.push('WHERE I AM STRUGGLING (worst accuracy first, 5+ attempts)');
  if (!rows.length) {
    lines.push('  Not enough drilling yet to say.');
  } else {
    for (const m of rows.slice(0, 5)) {
      const bits = [`${m.correct || m.attempts ? `${pct(m.accuracy)} over ${m.attempts}` : ''}`];
      if (!m.lesson) bits.push('lesson NOT read');
      if (m.lapses) bits.push(`${m.lapses} lapse${m.lapses === 1 ? '' : 's'} in spaced review`);
      lines.push(`  ${m.name}: ${bits.filter(Boolean).join(' · ')}`);
    }
  }

  /* ---- the specific failure worth acting on ---- */
  const readThenFailed = rows.filter((m) => m.lesson && m.accuracy !== null && m.accuracy < 0.7);
  if (readThenFailed.length) {
    lines.push('');
    lines.push('READ THE LESSON AND STILL GETTING IT WRONG');
    lines.push('  (these are the ones where the explanation is probably at fault)');
    for (const m of readThenFailed) {
      lines.push(`  ${m.name}: ${pct(m.accuracy)} over ${m.attempts} attempts, after finishing the lesson.`);
    }
  }

  const neverRead = MODULE_META.filter((meta) => {
    const stats = profile.drillStats(meta.id);
    return stats.attempts >= 5 && !profile.hasCompletedWalkthrough(meta.id);
  });
  if (neverRead.length) {
    lines.push('');
    lines.push('DRILLED WITHOUT READING THE LESSON');
    lines.push(`  ${neverRead.map((m) => m.name).join(', ')}`);
  }

  /* ---- the exercises, and what the wrong answers reveal ---- */
  const practice = profile.practiceStats().filter((p) => p.attempts > 0);
  if (practice.length) {
    const named = (id) => (MODULE_META.find((m) => m.id === id) || {}).name || id;
    const exercises = practice.filter((p) => p.kind !== 'check');
    const checks = practice.filter((p) => p.kind === 'check');

    if (exercises.length) {
      lines.push('');
      lines.push('HANDS-ON EXERCISES');
      for (const ex of exercises.sort((a, b) => (a.correct / a.attempts) - (b.correct / b.attempts))) {
        lines.push(`  ${named(ex.module)} — ${ex.kind}: ${ex.correct} of ${ex.attempts} right`);
        const tags = Object.entries(ex.tags || {}).sort((a, b) => b[1] - a[1]);
        for (const [tag, count] of tags) {
          const wording = MISREADINGS[tag];
          if (wording) lines.push(`      ${count}× ${wording}`);
        }
      }
    }

    if (checks.length) {
      const total = checks.reduce((a, c) => a + c.attempts, 0);
      const right = checks.reduce((a, c) => a + c.correct, 0);
      lines.push('');
      lines.push(`LESSON CHECKS: ${right} of ${total} right first time`);
      const weak = checks.filter((c) => c.attempts >= 2 && c.correct / c.attempts < 0.6);
      for (const c of weak) {
        lines.push(`  ${named(c.module)}: ${c.correct} of ${c.attempts} — the steps here are not landing.`);
      }
    }
  }

  /* ---- everything, briefly ---- */
  lines.push('');
  lines.push('EVERY SKILL');
  for (const meta of MODULE_META) {
    const stats = profile.drillStats(meta.id);
    const accuracy = stats.attempts ? stats.correct / stats.attempts : null;
    const tier = masteryTier(profile, meta.id);
    const lesson = profile.hasCompletedWalkthrough(meta.id) ? 'lesson done' : 'lesson not done';
    lines.push(`  ${meta.name}: ${stats.correct}/${stats.attempts} (${pct(accuracy)}) · ${tier} · ${lesson}`);
  }
  lines.push(`  (Solid needs ${REQUIREMENTS.solid.attempts} at ${pct(REQUIREMENTS.solid.accuracy)}; `
    + `Mastered ${REQUIREMENTS.mastered.attempts} at ${pct(REQUIREMENTS.mastered.accuracy)} plus the lesson.)`);

  /* ---- confidence against reality ---- */
  const calib = calibrationReport(profile);
  if (calib.total) {
    lines.push('');
    lines.push('CONFIDENCE vs REALITY');
    for (const band of calib.bands) {
      if (!band.total) continue;
      lines.push(`  Said "${band.label}": right ${pct(band.accuracy)} of ${band.total}`);
    }
    if (calib.overconfidence > 0.1) {
      lines.push(`  Overconfident by ${pct(calib.overconfidence)} — feeling sure is running ahead of being right.`);
    }
  }

  lines.push('');
  lines.push('WHAT WOULD HELP ME MOST');
  lines.push('  (fill this in yourself before sending — the numbers cannot say it)');
  lines.push('  - Which explanation did not land?');
  lines.push('  - What were you doing when you got confused?');
  lines.push('  - What did you think the question was asking?');

  return lines.join('\n');
}
