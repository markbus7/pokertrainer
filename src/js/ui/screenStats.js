/** Career stats, mastery, achievements and the leak report. */

import { el, fmt, sparkline } from './dom.js';
import { MODULE_META } from '../data/curriculum.js';
import { ACHIEVEMENTS } from '../state/achievements.js';
import { RANKS } from '../state/profile.js';
import { handGrid } from '../core/cards.js';
import { CHARTS, POSITION_INFO, rangePercent, RFI, THREE_BET } from '../data/ranges.js';
import { STRENGTH_RANK, HAND_STRENGTH } from '../data/handStrength.js';

export function renderStats(ctx) {
  const { profile, go } = ctx;
  const drills = profile.data.drills;
  const totals = Object.values(drills).reduce(
    (acc, d) => ({ attempts: acc.attempts + d.attempts, correct: acc.correct + d.correct }),
    { attempts: 0, correct: 0 },
  );
  const accuracy = totals.attempts ? totals.correct / totals.attempts : null;
  const sessions = profile.data.sessions;

  const curve = [];
  let running = 0;
  for (const s of sessions) { running += s.profitBb || 0; curve.push(running); }

  return el('div.screen',
    el('div.grid.cols-4',
      tile('Rank', `${profile.rank.emoji} ${profile.rank.name}`, `Level ${profile.level} of ${RANKS.length}`),
      tile('Total XP', fmt.chips(profile.xp)),
      tile('Drill accuracy', accuracy === null ? '—' : fmt.pct(accuracy), `${totals.correct} of ${totals.attempts}`),
      tile('Hands played', fmt.chips(profile.data.handsPlayed)),
    ),

    curve.length >= 2
      ? el('div.panel',
          el('div.panel-title', el('h3', 'Lifetime results'), el('span.faint', `${sessions.length} sessions`)),
          sparkline(curve, { color: running >= 0 ? '#3ecf8e' : '#f2555a' }),
        )
      : null,

    el('div.panel',
      el('div.panel-title', el('h2', 'Skill mastery')),
      el('div.stack-sm',
        MODULE_META.map((meta) => {
          const stats = profile.drillStats(meta.id);
          const acc = profile.accuracy(meta.id);
          const locked = meta.unlockLevel > profile.level;
          return el('div', { style: { padding: '8px 0', borderBottom: '1px solid var(--border)' } },
            el('div.spread',
              el('div.row',
                el('span', locked ? '🔒' : meta.icon),
                el('span', { style: { fontWeight: '600' } }, meta.name),
                locked ? el('span.badge', `Level ${meta.unlockLevel}`) : null,
              ),
              el('span.faint.mono', stats.attempts
                ? `${stats.correct}/${stats.attempts}${acc !== null ? ` · ${fmt.pct(acc)}` : ''}`
                : 'not started'),
            ),
            el('div.bar', { style: { marginTop: '6px', height: '6px' } },
              el('span', { style: { width: `${Math.round((acc ?? 0) * 100)}%` } })),
          );
        }),
      ),
    ),

    el('div.panel',
      el('div.panel-title',
        el('h2', 'Achievements'),
        el('span.faint', `${profile.data.achievements.length} of ${ACHIEVEMENTS.length}`),
      ),
      el('div.grid.cols-3',
        ACHIEVEMENTS.map((a) => {
          const owned = profile.hasAchievement(a.id);
          return el(`div.achievement${owned ? '' : '.locked'}`,
            el('span.icon', owned ? a.icon : '🔒'),
            el('div',
              el('div.name', a.name),
              el('div.desc', a.description),
            ),
          );
        }),
      ),
    ),

    el('div.panel',
      el('div.spread',
        el('div',
          el('h3', { style: { margin: 0 } }, 'Start over?'),
          el('div.faint', 'Clears your rank, drill history, achievements and bankroll.'),
        ),
        el('button.btn.sm.danger', {
          onclick: () => {
            if (confirm('Reset all progress? This cannot be undone.')) {
              profile.reset();
              go('home');
            }
          },
        }, 'Reset progress'),
      ),
    ),
  );
}

function tile(label, value, sub = '') {
  return el('div.stat', el('div.label', label), el('div.value', value), sub ? el('div.sub', sub) : null);
}

/* ------------------------------------------------------------------ *
 * Range chart viewer
 * ------------------------------------------------------------------ */

export function renderCharts(ctx, params = {}) {
  const view = params.chart || 'UTG';
  const grid = handGrid();

  const isThreeBet = view.startsWith('3bet:');
  const position = isThreeBet ? view.slice(5) : view;
  const chart = isThreeBet ? CHARTS.threeBet[position] : CHARTS.rfi[position];
  if (!chart) return el('div.empty', 'Unknown chart.');

  const inRange = (key) => (isThreeBet ? chart.all.has(key) : chart.has(key));
  const cellClass = (key) => {
    if (isThreeBet) {
      if (chart.value.has(key)) return 'value';
      if (chart.bluff.has(key)) return 'bluff';
      return '';
    }
    return chart.has(key) ? 'in' : '';
  };

  const combos = isThreeBet ? rangePercent(chart.all) : rangePercent(chart);
  const notation = isThreeBet
    ? `${THREE_BET[position].value}  ·  bluffs: ${THREE_BET[position].bluff}`
    : RFI[position];

  const detail = el('div.faint', { style: { minHeight: '22px' } }, 'Hover a cell for details.');

  return el('div.screen',
    el('div.panel',
      el('h1', '📋 Range charts'),
      el('p.muted', 'These are the ranges the drills grade you against, and the ranges the "Solid Regular" bot plays. Learn one position at a time — the button and the big blind matter most.'),
      el('div.row',
        ['UTG', 'HJ', 'CO', 'BTN', 'SB'].map((pos) => el(`button.btn.sm${view === pos ? '.primary' : '.ghost'}`, {
          onclick: () => ctx.go('charts', { chart: pos }),
        }, `Open ${pos}`)),
      ),
      el('div.row', { style: { marginTop: '8px' } },
        ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'].map((pos) => el(`button.btn.sm${view === `3bet:${pos}` ? '.primary' : '.ghost'}`, {
          onclick: () => ctx.go('charts', { chart: `3bet:${pos}` }),
        }, `3-bet ${pos}`)),
      ),
    ),

    el('div.panel',
      el('div.panel-title',
        el('h2', isThreeBet ? `3-betting from ${POSITION_INFO[position].name}` : `Opening from ${POSITION_INFO[position].name}`),
        el('span.badge.gold', `${fmt.pct(combos, 1)} of hands`),
      ),
      el('p.muted', POSITION_INFO[position].blurb),

      el('div.range-grid',
        grid.flat().map((key) => el(`div.range-cell.${cellClass(key)}${key.length === 2 ? '.pair' : ''}`, {
          onmouseenter: () => {
            detail.textContent = `${key} — ${fmt.pct(HAND_STRENGTH[key], 1)} against a random hand, ranked ${STRENGTH_RANK[key]} of 169. ${
              inRange(key) ? 'In this range.' : 'Not in this range.'
            }`;
          },
        }, key)),
      ),

      detail,

      el('div.range-legend', { style: { marginTop: '12px' } },
        isThreeBet
          ? [
              legend('#2fa06a', 'Value 3-bets'),
              legend('#b8532f', 'Bluff 3-bets'),
              legend('#131c26', 'Fold or call'),
            ]
          : [
              legend('#e3b23c', 'Raise'),
              legend('#131c26', 'Fold'),
            ],
      ),

      el('div', { style: { marginTop: '14px' } },
        el('div.faint', { style: { textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.06em', marginBottom: '4px' } }, 'Notation'),
        el('div.mono', { style: { fontSize: '0.82rem', color: 'var(--text-dim)' } }, notation),
      ),
    ),

    el('div.notice',
      'These are solid, teachable baselines rather than solver output. Real solver ranges shift with bet sizing, stack depth and how the table is playing — but a player who follows these consistently already beats most small-stakes games.',
    ),
  );
}

function legend(colour, label) {
  return el('span', el('span.swatch', { style: { background: colour } }), label);
}
