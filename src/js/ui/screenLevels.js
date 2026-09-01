/**
 * The rank ladder: what you have earned, what the next rank asks for, and
 * how much of it is done.
 *
 * Ranks used to be a number that went up on its own, with no statement of
 * what it measured. Showing the requirements is most of the point — a target
 * you cannot see is not a target, and "XP" on its own never explained why a
 * level arrived or what it was supposed to prove.
 */

import { el, fmt, richText } from './dom.js';
import { t } from '../i18n/index.js';
import { RANKS, requirementRows, legacyRankForProfile } from '../state/profile.js';
import { MODULE_META } from '../data/curriculum.js';

export function renderLevels(ctx) {
  const { profile, go } = ctx;
  const current = profile.rank;
  const next = profile.nextRank;

  return el('div.screen',
    renderCurrent(profile, current, next),
    renderDropNotice(profile, current),
    next ? renderNext(profile, next, go) : renderMaxed(),
    renderLadder(profile, current, next),
    renderHowItWorks(),
  );
}

/* ------------------------------------------------------------------ *
 * Where you are now
 * ------------------------------------------------------------------ */

function renderCurrent(profile, rank, next) {
  return el('div.panel',
    el('div.spread',
      el('div.row',
        el('div', { style: { fontSize: '3.2rem', lineHeight: '1' } }, rank.emoji),
        el('div',
          el('div', { style: { fontSize: '1.5rem', fontWeight: '700' } }, rank.name),
          el('div.faint', t('Level {level} of {total}', { level: rank.level, total: RANKS.length })),
          el('div.faint', { style: { marginTop: '4px', maxWidth: '46ch' } }, rank.blurb),
        ),
      ),
      el('div', { style: { textAlign: 'right' } },
        el('div.mono', { style: { fontSize: '1.4rem', fontWeight: '700', color: 'var(--gold)' } },
          fmt.chips(profile.xp)),
        el('div.faint', 'total XP'),
      ),
    ),
    next
      ? el('div', { style: { marginTop: '14px' } },
          el('div.spread', { style: { marginBottom: '6px' } },
            el('span.faint', `Next: ${next.emoji} ${next.name}`),
            el('span.faint.mono', `${Math.round(profile.progress * 100)}%`),
          ),
          el('div.bar', el('span', { style: { width: `${Math.round(profile.progress * 100)}%` } })),
          el('div.faint', { style: { marginTop: '6px', fontSize: '0.8rem' } },
            'The bar tracks whichever requirement is furthest behind, so it only fills when all of them do.'),
        )
      : null,
  );
}

/* ------------------------------------------------------------------ *
 * What the next rank asks for
 * ------------------------------------------------------------------ */

function renderNext(profile, next, go) {
  const rows = requirementRows(profile, next);
  const done = rows.filter((r) => r.met).length;

  return el('div.panel',
    el('div.panel-title',
      el('h2', `${next.emoji} ${next.name}`),
      el('span.faint', t('{done} of {total} done', { done, total: rows.length })),
    ),
    el('div.faint', { style: { marginBottom: '12px' } }, next.blurb),
    el('div.stack-sm', rows.map((r) => requirementRow(r))),
    el('div.row', { style: { marginTop: '14px', flexWrap: 'wrap', gap: '8px' } },
      el('button.btn.sm', { onclick: () => go('home') }, 'Go to the lessons'),
      el('button.btn.sm', { onclick: () => go('stats') }, 'See every skill'),
    ),
  );
}

function requirementRow(r, { showSurplus = false } = {}) {
  const pct = r.need <= 0 ? 1 : Math.min(1, r.have / r.need);
  const fmtNum = (n) => (n >= 1000 ? fmt.chips(n) : String(n));
  // On a rank already earned, the honest figure is what you actually have —
  // clipping it back to the minimum hides the work.
  const shown = showSurplus ? r.have : Math.min(r.have, r.need);
  return el('div', { style: { padding: '8px 0', borderBottom: '1px solid var(--border)' } },
    el('div.spread',
      el('div.row',
        el('span', { style: { color: r.met ? 'var(--green)' : 'var(--text-dim)' } }, r.met ? '✓' : '○'),
        el('span', { style: { fontWeight: r.met ? '500' : '600' } }, r.label),
      ),
      el('span.faint.mono', `${fmtNum(shown)} / ${fmtNum(r.need)}`),
    ),
    el('div.bar', { style: { marginTop: '6px', height: '6px' } },
      el('span', {
        style: {
          width: `${Math.round(pct * 100)}%`,
          background: r.met ? 'var(--green)' : undefined,
        },
      })),
  );
}

function renderMaxed() {
  return el('div.panel',
    el('div.panel-title', el('h2', '🧠 Top of the ladder')),
    el('div.faint',
      'Every skill mastered and every lesson finished. There is no rank above this one — '
      + 'what is left is volume, and the Lab and the Gauntlet never run out of spots.'),
  );
}

/* ------------------------------------------------------------------ *
 * The whole ladder
 * ------------------------------------------------------------------ */

function renderLadder(profile, current, next) {
  return el('div.panel',
    el('div.panel-title',
      el('h2', 'The ladder'),
      el('span.faint', t('{n} of {total} reached', { n: current.level, total: RANKS.length })),
    ),
    el('div.faint', { style: { marginBottom: '10px', fontSize: '0.82rem' } },
      'Tap any rank you have reached to see what it took.'),
    el('div.stack-sm', RANKS.map((rank) => ladderRow(profile, rank, current, next))),
  );
}

/**
 * One rung. Anything you have reached — now or in the past — opens to show the
 * requirements and how you stand against them, because "what did I actually do
 * for this" is the obvious question and the ladder previously refused to
 * answer it. Ranks you have not reached stay shut.
 */
function ladderRow(profile, rank, current, next) {
  const achieved = rank.level <= current.level;
  const isNext = next && rank.level === next.level;
  const reachedAt = profile.rankReachedAt(rank.level);
  const lapsed = !achieved && !isNext && reachedAt;
  const openable = achieved || isNext || lapsed;

  const badge = achieved ? '✓ Earned' : isNext ? 'Next' : lapsed ? 'Reached before' : 'Locked';
  const rows = openable ? requirementRows(profile, rank) : [];

  const detail = el('div', { hidden: !isNext, style: { marginTop: '8px' } },
    el('div.faint', { style: { fontSize: '0.82rem', marginBottom: '6px' } }, rank.blurb),
    rank.level === 1
      ? el('div.faint', { style: { fontSize: '0.82rem' } }, 'Where everybody starts. Nothing to earn.')
      : el('div', rows.map((r) => requirementRow(r, { showSurplus: achieved }))),
    reachedAt
      ? el('div.faint', { style: { marginTop: '8px', fontSize: '0.78rem' } },
          t('First reached {date}.', { date: reachedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) }))
      : achieved && rank.level > 1
        ? el('div.faint', { style: { marginTop: '8px', fontSize: '0.78rem' } },
            'Reached before the game started keeping dates.')
        : null,
    lapsed
      ? el('div.faint', { style: { marginTop: '6px', fontSize: '0.78rem', color: 'var(--gold)' } },
          'You held this rank once. The rows above show what has slipped since.')
      : null,
  );

  const head = el('div.spread', { style: { alignItems: 'center' } },
    el('div.row',
      el('span', { style: { fontSize: '1.4rem' } }, openable ? rank.emoji : '🔒'),
      el('div',
        el('div', { style: { fontWeight: '600' } }, rank.name),
        el('div.faint', { style: { fontSize: '0.78rem' } }, t('Level {level}', { level: rank.level })),
      ),
    ),
    el('div.row', { style: { gap: '8px' } },
      el('span.badge', badge),
      openable ? el('span.faint.chevron', { style: { fontSize: '0.8rem' } }, detail.hidden ? '▾' : '▴') : null,
    ),
  );

  const row = el(openable ? 'button.ladder-row' : 'div.ladder-row', {
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '10px 12px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${isNext ? 'var(--gold-dim)' : 'var(--border)'}`,
      background: isNext ? 'rgba(214,168,63,0.06)' : 'transparent',
      color: 'inherit',
      font: 'inherit',
      opacity: openable ? '1' : '0.5',
      cursor: openable ? 'pointer' : 'default',
    },
    ...(openable
      ? {
          onclick: () => {
            detail.hidden = !detail.hidden;
            const chev = row.querySelector('.chevron');
            if (chev) chev.textContent = detail.hidden ? '▾' : '▴';
          },
        }
      : {}),
  },
    head,
    openable
      ? detail
      : el('div.faint', { style: { marginTop: '6px', fontSize: '0.82rem' } },
          t('What this asks for is revealed once you reach {rank}.', { rank: t(RANKS[rank.level - 2].name) })),
  );
  return row;
}

/**
 * If the requirements put you below where XP alone would have, say so here
 * rather than leaving a silently lower number to be discovered.
 */
function renderDropNotice(profile, current) {
  const legacy = legacyRankForProfile(profile);
  if (legacy.level <= current.level) return null;
  // Worded as a standing fact rather than an event: this shows for anyone
  // whose playing has outrun their drilling, not only just after ranks
  // gained requirements.
  return el('div.panel', { style: { borderColor: 'var(--gold-dim)' } },
    el('div.panel-title', el('h3', { style: { margin: 0 } }, '📉 Your XP is ahead of your skills')),
    el('div.faint',
      t('On XP alone you would be Level {legacy}, {legacyName}. Ranks also ask for lessons finished '
        + 'and skills drilled, and on those you are Level {level}, {name}.',
        { legacy: legacy.level, legacyName: t(legacy.name), level: current.level, name: t(current.name) })),
    el('div.faint', { style: { marginTop: '6px' } },
      'None of the XP is lost — it all still counts. The requirements above are what closes the gap.'),
  );
}

/* ------------------------------------------------------------------ *
 * Why it works this way
 * ------------------------------------------------------------------ */

function renderHowItWorks() {
  const total = MODULE_META.length;
  const lines = [
    '**XP** measures how much you have played — every drill answer, guided lesson, Lab spot and hand at the table adds to it.',
    `**Solid** and **Mastered** measure how widely. A skill is Solid at 15 questions and 75%, and Mastered at 30 questions and 90% with its guided lesson finished. There are ${total} skills in all.`,
    'Both matter, because XP on its own could be earned by repeating one drill forever — which would have unlocked the whole curriculum for somebody who had only ever practised one thing.',
    'A rank reflects what you can do now, so it can go down as well as up — if the skills behind it fade, the rank goes with them until you have them back. The date you first reached it is kept either way.',
  ];
  return el('div.panel',
    el('div.panel-title', el('h2', 'How ranks are earned')),
    el('div.stack-sm', lines.map((line) => el('div.faint', richText(line)))),
  );
}
