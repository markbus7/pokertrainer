/** Career stats, mastery, achievements and the leak report. */

import { el, fmt, sparkline, toast } from './dom.js';
import { MODULE_META } from '../data/curriculum.js';
import { ACHIEVEMENTS } from '../state/achievements.js';
import { RANKS } from '../state/profile.js';
import { exportCode, importCode, decodeSyncCode, summarize } from '../state/sync.js';
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

    renderSyncPanel(ctx),

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
 * Cross-device sync
 * ------------------------------------------------------------------ */

const codeBoxStyle = {
  width: '100%',
  fontFamily: 'var(--mono)',
  fontSize: '0.76rem',
  resize: 'vertical',
  background: 'var(--bg-raised)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px',
};

/**
 * A save code, not live sync: generate a code from this device, paste it in
 * on another one. Importing replaces what is there, so this always shows a
 * before-you-overwrite comparison rather than silently clobbering progress.
 */
function renderSyncPanel(ctx) {
  const { profile, go } = ctx;

  const codeBox = el('textarea', {
    readOnly: true,
    rows: 3,
    placeholder: 'Click "Generate code", then copy it to your other device…',
    style: codeBoxStyle,
    onfocus: (e) => e.target.select(),
  });

  const pasteBox = el('textarea', {
    rows: 3,
    placeholder: 'Paste a sync code from another device here…',
    style: codeBoxStyle,
  });

  const importStatus = el('div.faint', { style: { minHeight: '20px', marginTop: '8px' } });

  const generate = () => {
    codeBox.value = exportCode(profile);
    codeBox.select();
  };

  const copyCode = async () => {
    if (!codeBox.value) generate();
    try {
      await navigator.clipboard.writeText(codeBox.value);
      toast({ icon: '📋', title: 'Copied', desc: 'Paste it into the trainer on your other device.' });
    } catch {
      codeBox.select();
      toast({ icon: '⚠️', title: 'Could not auto-copy', desc: 'The code is selected — copy it manually.' });
    }
  };

  const downloadFile = () => {
    if (!codeBox.value) generate();
    const blob = new Blob([codeBox.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: 'poker-trainer-sync.txt' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const loadFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { pasteBox.value = String(reader.result || '').trim(); };
    reader.readAsText(file);
  };

  const doImport = () => {
    let data;
    try {
      data = decodeSyncCode(pasteBox.value);
    } catch (err) {
      importStatus.textContent = `⚠️ ${err.message}`;
      importStatus.style.color = 'var(--red)';
      return;
    }
    const incoming = summarize(data);
    const current = summarize(profile.data);
    const proceed = confirm(
      `This code: ${incoming.rank} (${incoming.emoji}), ${incoming.xp} XP, ${incoming.hands} hands played.\n`
      + `This device right now: ${current.rank} (${current.emoji}), ${current.xp} XP, ${current.hands} hands played.\n\n`
      + 'Importing replaces this device\'s progress with the code\'s progress. Continue?',
    );
    if (!proceed) return;
    importCode(profile, pasteBox.value);
    toast({ icon: '✅', title: 'Progress restored', desc: `${incoming.emoji} ${incoming.rank}, ${incoming.xp} XP.` });
    go('stats');
  };

  return el('div.panel',
    el('div.panel-title', el('h2', '🔄 Sync progress'), el('span.faint', 'no account needed')),
    el('p.muted', 'Your progress lives in this browser only. To bring it to another device or browser, generate a code here and paste it in over there — like a save file.'),
    el('div.grid.cols-2',
      el('div',
        el('h3', { style: { fontSize: '0.9rem', marginBottom: '8px' } }, 'This device → elsewhere'),
        el('div.row', { style: { marginBottom: '8px' } },
          el('button.btn.sm', { onclick: generate }, 'Generate code'),
          el('button.btn.sm.primary', { onclick: copyCode }, 'Copy'),
          el('button.btn.sm.ghost', { onclick: downloadFile }, 'Download file'),
        ),
        codeBox,
      ),
      el('div',
        el('h3', { style: { fontSize: '0.9rem', marginBottom: '8px' } }, 'Elsewhere → this device'),
        pasteBox,
        el('div.row', { style: { marginTop: '8px' } },
          el('button.btn.sm.primary', { onclick: doImport }, 'Import'),
          el('label.btn.sm.ghost', { style: { cursor: 'pointer', margin: 0 } },
            'Load from file',
            el('input', { type: 'file', accept: '.txt,.json', style: { display: 'none' }, onchange: loadFile }),
          ),
        ),
        importStatus,
      ),
    ),
  );
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
