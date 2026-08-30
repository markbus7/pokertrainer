/** Dashboard: where you are, what to do next. */

import { el, fmt } from './dom.js';
import { MODULE_META, recommendedModule } from '../data/curriculum.js';
import { dueConcepts, nextReviewLabel, hasStudied } from '../state/spacing.js';
import { RANKS, nextRank } from '../state/profile.js';
import { ACHIEVEMENTS } from '../state/achievements.js';
import { stakeFor } from '../state/stats.js';

export function renderHome(ctx) {
  const { profile, go } = ctx;
  const rank = profile.rank;
  const next = nextRank(profile.xp);
  const recommended = recommendedModule(profile);
  const stake = stakeFor(profile.data.stakeKey);

  const totals = Object.values(profile.data.drills).reduce(
    (acc, d) => ({ attempts: acc.attempts + d.attempts, correct: acc.correct + d.correct }),
    { attempts: 0, correct: 0 },
  );
  const accuracy = totals.attempts ? totals.correct / totals.attempts : null;

  return el('div.screen',
    /* ---- rank header ---- */
    el('div.panel',
      el('div.spread',
        el('div.row',
          el('div', { style: { fontSize: '3rem', lineHeight: '1' } }, rank.emoji),
          el('div',
            el('div.faint', `Level ${rank.level} of ${RANKS.length}`),
            el('h1', { style: { margin: '2px 0 4px' } }, rank.name),
            el('div.muted', { style: { maxWidth: '460px' } }, rank.blurb),
          ),
        ),
        el('div', { style: { textAlign: 'right' } },
          el('div.mono', { style: { fontSize: '1.6rem', fontWeight: '700' } }, fmt.chips(profile.xp)),
          el('div.faint', 'total XP'),
        ),
      ),
      el('div', { style: { marginTop: '16px' } },
        el('div.bar', el('span', { style: { width: `${Math.round(profile.progress * 100)}%` } })),
        el('div.spread', { style: { marginTop: '6px' } },
          el('div.faint', next ? `${fmt.chips(next.xp - profile.xp)} XP to ${next.emoji} ${next.name}` : 'Maximum rank reached — you have mastered the curriculum.'),
          el('div.faint', next ? `${fmt.chips(profile.xp)} / ${fmt.chips(next.xp)}` : ''),
        ),
      ),
    ),

    /* ---- next step ---- */
    el('div.panel',
      el('div.panel-title', el('h3', '▶ Pick up where you left off')),
      el('div.spread',
        el('div.row',
          el('div', { style: { fontSize: '2rem' } }, recommended.icon),
          el('div',
            el('div', { style: { fontWeight: '650' } }, recommended.name),
            el('div.faint', describeProgress(profile, recommended.id)),
          ),
        ),
        el('button.btn.primary.lg', { onclick: () => go('learn', { module: recommended.id }) }, 'Train this'),
      ),
    ),

    duePanel(profile, go),

    /* ---- quick actions ---- */
    el('div.grid.cols-3',
      quickCard('🎛️', 'The Lab', 'Solve spots at a table — type the equity, size the bet. No multiple choice.', 'Open the Lab', () => go('lab')),
      quickCard('🃏', 'Play a Table', 'Six seats, real opponents, a coach watching every decision.', 'Sit down', () => go('play')),
      quickCard('💰', 'Bankroll Challenge', `Climb from NL2 to NL500. You are at ${stake.name} with ${fmt.money(profile.data.bankroll)}.`, 'Grind', () => go('grind')),
    ),

    /* ---- stats strip ---- */
    el('div.grid.cols-4',
      statTile('Hands played', fmt.chips(profile.data.handsPlayed)),
      statTile('Drill accuracy', accuracy === null ? '—' : fmt.pct(accuracy), accuracy === null ? 'answer a few first' : `${totals.correct} of ${totals.attempts}`),
      statTile('Achievements', `${profile.data.achievements.length} / ${ACHIEVEMENTS.length}`),
      statTile('Lifetime', fmt.bb(profile.data.lifetimeProfitBb), 'across all sessions'),
    ),

    /* ---- modules ---- */
    el('div.panel',
      el('div.panel-title',
        el('h2', 'Training modules'),
        el('span.faint', `${MODULE_META.filter((m) => m.unlockLevel <= profile.level).length} of ${MODULE_META.length} unlocked`),
      ),
      el('div.grid.cols-3',
        MODULE_META.map((meta) => moduleTile(meta, profile, go)),
      ),
    ),
  );
}

/**
 * Reviews that have come due. Spacing only works if something surfaces the
 * concept at the right moment — a schedule nobody is shown is just a record.
 */
function duePanel(profile, go) {
  const unlocked = MODULE_META.filter((m) => m.unlockLevel <= profile.level);
  const started = unlocked.filter((m) => hasStudied(profile, m.id));
  if (!started.length) return null;

  const due = dueConcepts(profile, started.map((m) => m.id));
  if (!due.length) {
    const soonest = started
      .map((m) => ({ m, label: nextReviewLabel(profile, m.id) }))
      .filter((x) => x.label !== 'not started')
      .sort((a, b) => a.label.localeCompare(b.label))[0];
    return el('div.panel',
      el('div.spread',
        el('div',
          el('h3', { style: { margin: 0 } }, '✅ Nothing due for review'),
          el('div.faint', soonest
            ? `Everything you have studied is still fresh. ${soonest.m.name} is ${soonest.label}.`
            : 'Everything you have studied is still fresh.'),
        ),
        el('button.btn.sm.ghost', { onclick: () => go('lab') }, 'Practise anyway'),
      ),
    );
  }

  const metaFor = (id) => MODULE_META.find((m) => m.id === id);
  return el('div.panel', { style: { borderColor: 'var(--gold-dim)' } },
    el('div.spread',
      el('div',
        el('h3', { style: { margin: 0 } }, `🔁 ${due.length} ready for review`),
        el('div.faint', 'These are due now — practising a concept just as it starts to fade is what makes it stick.'),
      ),
      el('button.btn.sm.primary', { onclick: () => go('lab') }, 'Review now'),
    ),
    el('div.row', { style: { marginTop: '12px' } },
      due.slice(0, 6).map((id) => {
        const meta = metaFor(id);
        return meta ? el('span.badge.gold', `${meta.icon} ${meta.name}`) : null;
      }),
    ),
  );
}

function describeProgress(profile, moduleId) {
  const stats = profile.drillStats(moduleId);
  if (!stats.attempts) return 'Not started yet — begin with the lesson.';
  const acc = profile.accuracy(moduleId);
  if (acc === null) return `${stats.attempts} attempts so far. Keep going.`;
  if (acc >= 0.9) return `${fmt.pct(acc)} accuracy — nearly mastered.`;
  if (acc >= 0.7) return `${fmt.pct(acc)} accuracy — solid, but there is room.`;
  return `${fmt.pct(acc)} accuracy — this is your weakest skill right now.`;
}

function quickCard(icon, title, body, cta, onclick) {
  return el('div.panel', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
    el('div', { style: { fontSize: '1.8rem' } }, icon),
    el('h3', { style: { margin: 0 } }, title),
    el('div.faint', { style: { flex: '1' } }, body),
    el('button.btn.block', { onclick }, cta),
  );
}

function statTile(label, value, sub = '') {
  return el('div.stat',
    el('div.label', label),
    el('div.value', value),
    sub ? el('div.sub', sub) : null,
  );
}

function moduleTile(meta, profile, go) {
  const locked = meta.unlockLevel > profile.level;
  const stats = profile.drillStats(meta.id);
  const acc = profile.accuracy(meta.id);

  return el(`button.module-tile${locked ? '.locked' : ''}`, {
    disabled: locked,
    onclick: () => !locked && go('learn', { module: meta.id }),
  },
    el('div.spread',
      el('span.icon', locked ? '🔒' : meta.icon),
      locked
        ? el('span.badge', `Level ${meta.unlockLevel}`)
        : acc !== null && acc >= 0.9 ? el('span.badge.green', 'Mastered') : null,
    ),
    el('div.name', meta.name),
    el('div.tagline', meta.tagline),
    el('div.mastery', locked
      ? `Unlocks at ${RANKS[meta.unlockLevel - 1].name}`
      : stats.attempts
        ? `${stats.correct}/${stats.attempts} correct${acc !== null ? ` · ${fmt.pct(acc)}` : ''}`
        : 'Not started'),
    !locked && stats.attempts
      ? el('div.bar', { style: { height: '5px' } }, el('span', { style: { width: `${Math.round((acc ?? 0) * 100)}%` } }))
      : null,
  );
}
