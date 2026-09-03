/** Dashboard: where you are, what to do next. */

import { el, fmt } from './dom.js';
import { t } from '../i18n/index.js';
import { MODULE_META, recommendedModule } from '../data/curriculum.js';
import { dueConcepts, nextReviewLabel, hasStudied } from '../state/spacing.js';
import { masteryTier, nextTierGoal, tierByKey } from '../state/mastery.js';
import { RANKS, requirementRows } from '../state/profile.js';
import { ACHIEVEMENTS } from '../state/achievements.js';
import { stakeFor } from '../state/stats.js';
import { handSummary } from '../state/handHistory.js';

/**
 * What is actually still missing for the next rank. Reports the requirement
 * furthest from being met rather than assuming it is XP, which stopped being
 * true once ranks started asking for lessons and drilled skills too.
 */
function nextRankHint(profile, next) {
  const rows = requirementRows(profile, next);
  const behind = rows.filter((r) => !r.met);
  if (!behind.length) return t('Ready for {rank} — the requirements are met.', { rank: t(next.name) });
  const worst = behind.reduce((a, b) => ((a.have / a.need) <= (b.have / b.need) ? a : b));
  const remaining = worst.need - worst.have;
  return worst.key === 'xp'
    ? t('{n} XP to {rank}', { n: fmt.chips(remaining), rank: `${next.emoji} ${t(next.name)}` })
    : t('{n} more to {rank}: {what}', { n: remaining, rank: `${next.emoji} ${t(next.name)}`, what: t(worst.label).toLowerCase() });
}

export function renderHome(ctx) {
  const { profile, go } = ctx;
  const rank = profile.rank;
  const next = profile.nextRank;
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
            el('div.faint', t('Level {level} of {total}', { level: rank.level, total: RANKS.length })),
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
          // Not "XP to next rank" any more: XP stopped being the only gate when
          // ranks gained requirements, so this read "-2,000 XP to Grinder" for
          // anyone whose XP had run ahead of their skills. Name the requirement
          // that is actually furthest behind instead.
          el('div.faint', next ? nextRankHint(profile, next) : t('Maximum rank reached — you have mastered the curriculum.')),
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
    mistakesPanel(go),

    /* ---- quick actions ---- */
    el('div.grid.cols-3',
      quickCard('🎛️', 'The Lab', 'Solve spots at a table — type the equity, size the bet. No multiple choice.', 'Open the Lab', () => go('lab')),
      quickCard('🃏', 'Play a Table', 'Six seats, real opponents, a coach watching every decision.', 'Sit down', () => go('play')),
      quickCard('💰', 'Bankroll Challenge', t('Climb from NL2 to NL500. You are at {stake} with {money}.', { stake: stake.name, money: fmt.money(profile.data.bankroll) }), 'Grind', () => go('grind')),
    ),

    /* ---- stats strip ---- */
    el('div.grid.cols-4',
      statTile('Hands played', fmt.chips(profile.data.handsPlayed)),
      statTile('Drill accuracy', accuracy === null ? '—' : fmt.pct(accuracy), accuracy === null ? 'answer a few first' : t('{correct} of {attempts}', { correct: totals.correct, attempts: totals.attempts })),
      statTile('Achievements', `${profile.data.achievements.length} / ${ACHIEVEMENTS.length}`),
      statTile('Lifetime', fmt.bb(profile.data.lifetimeProfitBb), 'across all sessions'),
    ),

    /* ---- modules ---- */
    el('div.panel',
      el('div.panel-title',
        el('h2', 'Training modules'),
        el('span.faint', t('{n} of {total} unlocked', { n: MODULE_META.filter((m) => m.unlockLevel <= profile.level).length, total: MODULE_META.length })),
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
        el('h3', { style: { margin: 0 } }, t('🔁 {n} ready for review', { n: due.length })),
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

/**
 * The hands waiting to be looked at. Only shown when there are some: an empty
 * "0 mistakes" panel on the dashboard every day would train you to ignore the
 * place where the mistakes appear.
 */
function mistakesPanel(go) {
  const summary = handSummary();
  if (!summary.total) return null;
  const parts = [];
  if (summary.mistakes) parts.push(t('{n} with a mistake in', { n: summary.mistakes }));
  if (summary.coolers) parts.push(t('{n} you lost through no fault of yours', { n: summary.coolers }));

  return el('div.panel', { style: { borderColor: 'var(--red)' } },
    el('div.spread',
      el('div',
        el('h3', { style: { margin: 0 } }, t('🔍 {n} hands worth another look', { n: summary.total })),
        el('div.faint', `${parts.join(', ')}. ${t('Play them back and see where they turned.')}`),
      ),
      el('button.btn.sm.primary', { onclick: () => go('review') }, 'Review hands'),
    ),
    summary.mistakes
      ? el('div.faint', { style: { marginTop: '10px' } },
          t('Those mistakes have cost you {amount} big blinds so far.', { amount: summary.costBb.toFixed(1) }))
      : null,
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
  const tier = locked ? 'untouched' : masteryTier(profile, meta.id);
  const tierInfo = tierByKey(tier);
  const goal = locked ? null : nextTierGoal(profile, meta.id);

  return el(`button.module-tile${locked ? '.locked' : ''}`, {
    disabled: locked,
    onclick: () => !locked && go('learn', { module: meta.id }),
  },
    el('div.spread',
      el('span.icon', locked ? '🔒' : meta.icon),
      locked
        ? el('span.badge', t('Level {level}', { level: meta.unlockLevel }))
        : tier !== 'untouched'
          ? el(`span.badge${tierInfo.tone ? `.${tierInfo.tone}` : ''}`, `${tierInfo.icon} ${tierInfo.name}`)
          : null,
    ),
    el('div.name', meta.name),
    el('div.tagline', meta.tagline),
    el('div.mastery', locked
      ? `Unlocks at ${RANKS[meta.unlockLevel - 1].name}`
      : stats.attempts
        ? t('{correct}/{attempts} correct', { correct: stats.correct, attempts: stats.attempts }) + (acc !== null ? ` · ${fmt.pct(acc)}` : '')
        : 'Not started'),
    !locked && goal
      ? el('div.mastery', { style: { color: 'var(--text-faint)' } },
          `${goal.name} at ${goal.requirement}`)
      : null,
    !locked && stats.attempts
      ? el('div.bar', { style: { height: '5px' } },
          el('span', { style: { width: `${Math.round((goal ? goal.progress : 1) * 100)}%` } }))
      : null,
  );
}
