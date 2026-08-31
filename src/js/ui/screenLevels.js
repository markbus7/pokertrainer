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
import { RANKS, requirementRows, meetsRank } from '../state/profile.js';
import { MODULE_META } from '../data/curriculum.js';

export function renderLevels(ctx) {
  const { profile, go } = ctx;
  const current = profile.rank;
  const next = profile.nextRank;

  return el('div.screen',
    renderCurrent(profile, current, next),
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
          el('div.faint', `Level ${rank.level} of ${RANKS.length}`),
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
      el('span.faint', `${done} of ${rows.length} done`),
    ),
    el('div.faint', { style: { marginBottom: '12px' } }, next.blurb),
    el('div.stack-sm', rows.map((r) => requirementRow(r))),
    el('div.row', { style: { marginTop: '14px', flexWrap: 'wrap', gap: '8px' } },
      el('button.btn.sm', { onclick: () => go('home') }, 'Go to the lessons'),
      el('button.btn.sm', { onclick: () => go('stats') }, 'See every skill'),
    ),
  );
}

function requirementRow(r) {
  const pct = r.need <= 0 ? 1 : Math.min(1, r.have / r.need);
  const fmtNum = (n) => (n >= 1000 ? fmt.chips(n) : String(n));
  return el('div', { style: { padding: '8px 0', borderBottom: '1px solid var(--border)' } },
    el('div.spread',
      el('div.row',
        el('span', { style: { color: r.met ? 'var(--green)' : 'var(--text-dim)' } }, r.met ? '✓' : '○'),
        el('span', { style: { fontWeight: r.met ? '500' : '600' } }, r.label),
      ),
      el('span.faint.mono', `${fmtNum(Math.min(r.have, r.need))} / ${fmtNum(r.need)}`),
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
      el('span.faint', `${current.level} of ${RANKS.length} reached`),
    ),
    el('div.stack-sm', RANKS.map((rank) => {
      const earned = rank.level <= current.level;
      const isNext = next && rank.level === next.level;
      return el('div', {
        style: {
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${isNext ? 'var(--gold-dim)' : 'var(--border)'}`,
          background: isNext ? 'rgba(214,168,63,0.06)' : 'transparent',
          opacity: earned || isNext ? '1' : '0.5',
        },
      },
        el('div.spread',
          el('div.row',
            el('span', { style: { fontSize: '1.4rem' } }, earned || isNext ? rank.emoji : '🔒'),
            el('div',
              el('div', { style: { fontWeight: '600' } }, `${rank.name}`),
              el('div.faint', { style: { fontSize: '0.78rem' } }, `Level ${rank.level}`),
            ),
          ),
          el('span.badge', earned ? '✓ Earned' : isNext ? 'Next' : 'Locked'),
        ),
        // Only the next rank spells out its requirements. The ones beyond it
        // stay shut until the rank before them is reached, so the ladder shows
        // one clear target instead of a wall of numbers.
        isNext
          ? el('div.faint', { style: { marginTop: '6px', fontSize: '0.82rem' } }, rank.blurb)
          : earned
            ? null
            : el('div.faint', { style: { marginTop: '6px', fontSize: '0.82rem' } },
                `What this asks for is revealed once you reach ${RANKS[rank.level - 2].name}.`),
      );
    })),
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
    'A rank you have already reached is never taken away, even if the requirements change afterwards.',
  ];
  return el('div.panel',
    el('div.panel-title', el('h2', 'How ranks are earned')),
    el('div.stack-sm', lines.map((line) => el('div.faint', richText(line)))),
  );
}
