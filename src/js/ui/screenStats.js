/** Career stats, mastery, achievements and the leak report. */

import { el, mount, fmt, sparkline, toast } from './dom.js';
import { t } from '../i18n/index.js';
import { MODULE_META } from '../data/curriculum.js';
import { ACHIEVEMENTS } from '../state/achievements.js';
import { RANKS } from '../state/profile.js';
import { exportCode, importCode, decodeSyncCode, summarize } from '../state/sync.js';
import * as cloudSync from '../state/cloudSync.js';
import { VERSION, BUILT, REPO, checkForUpdate } from '../version.js';
import { calibrationReport, nextReviewLabel, strength, hasStudied } from '../state/spacing.js';
import { handGrid } from '../core/cards.js';
import { CHARTS, POSITION_INFO, rangePercent, RFI, THREE_BET } from '../data/ranges.js';
import { STRENGTH_RANK, HAND_STRENGTH } from '../data/handStrength.js';
import { allTerms } from '../data/glossary.js';
import { learningReport } from '../state/learningReport.js';

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
      tile('Rank', [profile.rank.emoji, ' ', t(profile.rank.name)],
        t('Level {level} of {total}', { level: profile.level, total: RANKS.length })),
      tile('Total XP', fmt.chips(profile.xp)),
      tile('Drill accuracy', accuracy === null ? '—' : fmt.pct(accuracy), t('{correct} of {attempts}', { correct: totals.correct, attempts: totals.attempts })),
      tile('Hands played', fmt.chips(profile.data.handsPlayed)),
    ),

    renderCalibration(profile),
    renderRetention(profile),
    renderLearningReport(ctx),
    renderVersionPanel(),
    renderSyncPanel(ctx),

    curve.length >= 2
      ? el('div.panel',
          el('div.panel-title', el('h3', 'Lifetime results'),
            el('span.faint', t('{n} sessions', { n: sessions.length }))),
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
                locked ? el('span.badge', t('Level {level}', { level: meta.unlockLevel })) : null,
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
  // 16px is a floor, not a preference: iOS Safari zooms the whole page when
  // you focus a field smaller than this, and does not zoom back out.
  fontSize: '16px',
  resize: 'vertical',
  background: 'var(--bg-raised)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px',
};

/**
 * Which build is running, and whether it is the current one. The check reads
 * the version from package.json on the main branch — the same file the build
 * was stamped from — so "am I up to date" has a real answer rather than a
 * guess based on a date.
 */
/**
 * A report to hand back to whoever is building this.
 *
 * Progress screens tell you how you are doing. This one is aimed the other
 * way: it says where the teaching is failing — a lesson read and then
 * failed, a skill drilled a hundred times that never improves — because
 * that is invisible from the outside and is where the explanation, not the
 * reader, is usually at fault.
 */
function renderLearningReport(ctx) {
  const { profile } = ctx;
  const box = el('textarea.report-box', {
    readonly: true,
    rows: 10,
    'aria-label': 'Your learning report',
  });
  box.value = learningReport(profile);

  const copy = el('button.btn.sm', {
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(box.value);
        toast({ icon: '📋', title: 'Copied', desc: 'Paste it into the chat and say what confused you.' });
      } catch {
        // Clipboard access is refused in plenty of contexts; selecting the
        // text is a fallback that always works.
        box.select();
        toast({ icon: '📋', title: 'Select and copy', desc: 'The report is selected — copy it by hand.' });
      }
    },
  }, 'Copy report');

  const refresh = el('button.btn.sm.ghost', {
    onclick: () => { box.value = learningReport(profile); },
  }, 'Refresh');

  return el('div.panel',
    el('div.panel-title',
      el('h2', '🧾 Learning report'),
      el('span.faint', 'for improving the lessons'),
    ),
    el('div.faint', { style: { marginBottom: '10px' } },
      'A summary of what you have studied and where it is going badly — which lesson you read and '
      + 'then still got wrong, which skill keeps slipping. Copy it into the chat when something did '
      + 'not make sense, and the explanation can be fixed rather than guessed at.'),
    el('div.faint', { style: { marginBottom: '10px', fontSize: '0.82rem' } },
      'It contains no name, no token and nothing that identifies you — only what you studied and how it went. '
      + 'The report itself is written in English whatever language the app is in, because it is meant to be handed over rather than read.'),
    box,
    el('div.row', { style: { marginTop: '10px', gap: '8px', flexWrap: 'wrap' } }, copy, refresh),
  );
}

function renderVersionPanel() {
  const status = el('div.faint', { style: { minHeight: '20px' } },
    'Click to compare against the latest published version.');
  const button = el('button.btn.sm', { onclick: run }, 'Check for updates');

  async function run() {
    button.disabled = true;
    status.style.color = '';
    status.textContent = 'Checking…';
    const result = await checkForUpdate();
    button.disabled = false;

    if (!result.ok) {
      status.style.color = 'var(--text-dim)';
      status.textContent = `Could not check: ${result.message} Your copy still works offline.`;
      return;
    }
    if (result.upToDate) {
      status.style.color = 'var(--green)';
      status.textContent = `✅ You are on the latest version (${result.latest}).`;
      return;
    }
    status.style.color = 'var(--gold)';
    status.textContent = `⬆️ Version ${result.latest} is available — you are running ${result.current}. `
      + 'If you cloned the repo, run "git pull" and reload. If you use the hosted page, a hard refresh will pick it up.';
  }

  return el('div.panel',
    el('div.panel-title', el('h2', '🏷️ Version'), el('span.faint', REPO)),
    el('div.spread',
      el('div',
        el('div.row',
          el('span.mono', { style: { fontSize: '1.35rem', fontWeight: '700', color: 'var(--gold)' } }, `v${VERSION}`),
          el('span.faint', t('built {date}', { date: BUILT })),
        ),
        el('div.faint', { style: { marginTop: '4px' } },
          'Your progress is stored separately from the code, so updating never affects it.'),
      ),
      button,
    ),
    el('div', { style: { marginTop: '12px' } }, status),
  );
}

/**
 * What you believed against what was true. People are poor judges of their own
 * knowledge, and the gap is invisible unless something measures it — which is
 * the whole reason the Lab asks how sure you are before showing the answer.
 */
function renderCalibration(profile) {
  const report = calibrationReport(profile);
  if (!report.total) return null;

  return el('div.panel',
    el('div.panel-title',
      el('h2', '🎯 Calibration'),
      el('span.faint', `${report.total} judged answers`),
    ),
    el('p.muted', 'How often you were right, split by how sure you felt at the time.'),
    el('div',
      report.rows.map((row) => el('div.calib-row',
        el('div.calib-label', row.label),
        el('div.calib-track',
          el(`div.calib-fill${row.accuracy !== null && row.accuracy < 0.6 ? '.low' : ''}`, {
            style: { width: `${Math.round((row.accuracy || 0) * 100)}%` },
          }),
        ),
        el('div.calib-value', row.attempts
          ? t('{pct} of {n}', { pct: fmt.pct(row.accuracy), n: row.attempts })
          : '—'),
      )),
    ),
    report.verdict
      ? el('div.notice', { style: { marginTop: '14px' } }, report.verdict)
      : el('div.faint', { style: { marginTop: '14px' } },
          t('Answer {n} more in the Lab and this will tell you whether your confidence is trustworthy.',
            { n: Math.max(0, 15 - report.total) })),
  );
}

/** How firmly each concept is held, and when it next comes back. */
function renderRetention(profile) {
  const studied = MODULE_META.filter((m) => m.unlockLevel <= profile.level && hasStudied(profile, m.id));
  if (!studied.length) return null;

  return el('div.panel',
    el('div.panel-title', el('h2', '🔁 Retention'), el('span.faint', 'spaced review schedule')),
    el('p.muted', 'Each concept comes back at a widening gap for as long as you keep getting it right. A miss brings it back tomorrow.'),
    el('div.stack-sm',
      studied.map((meta) => {
        const s = strength(profile, meta.id);
        const label = nextReviewLabel(profile, meta.id);
        return el('div', { style: { padding: '8px 0', borderBottom: '1px solid var(--border)' } },
          el('div.spread',
            el('div.row', el('span', meta.icon), el('span', { style: { fontWeight: '600' } }, meta.name)),
            el('span.faint.mono', label),
          ),
          el('div.bar.green', { style: { marginTop: '6px', height: '6px' } },
            el('span', { style: { width: `${Math.round(s * 100)}%` } })),
        );
      }),
    ),
  );
}

function timeAgo(iso) {
  if (!iso) return 'never';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

/**
 * Automatic sync via a private GitHub Gist. One-time setup per device (paste
 * a token), then progress pulls in on load and pushes out a few seconds
 * after any change — no code to copy each time you switch devices.
 */
function renderAutoSync(ctx) {
  const { profile, go } = ctx;
  const status = cloudSync.getStatus();
  const container = el('div');

  const decideDirection = async (result) => {
    if (!result.remoteExisted) {
      toast({ icon: '☁️', title: 'Connected', desc: 'This device now syncs automatically.' });
      go('stats');
      return;
    }
    const remote = result.remoteSummary;
    const local = result.localSummary;

    if (!remote) {
      await cloudSync.pushLocal(profile);
      toast({ icon: '☁️', title: 'Connected', desc: "The cloud save looked empty, so this device's progress was uploaded." });
      go('stats');
      return;
    }

    const fresh = local.xp === 0 && local.hands === 0 && local.achievements === 0;
    const identical = local.xp === remote.xp && local.hands === remote.hands && local.achievements === remote.achievements;

    if (fresh || identical) {
      await cloudSync.applyRemote(profile);
      toast({ icon: '☁️', title: 'Connected', desc: `Pulled in ${remote.emoji} ${remote.rank}, ${remote.xp} XP from the cloud.` });
      go('stats');
      return;
    }

    const useCloud = confirm(
      `This device: ${local.emoji} ${local.rank}, ${local.xp} XP, ${local.hands} hands played.\n`
      + `The cloud (from your other device): ${remote.emoji} ${remote.rank}, ${remote.xp} XP, ${remote.hands} hands played.\n\n`
      + "Press OK to bring the cloud's progress to this device.\n"
      + "Press Cancel to keep this device's progress and overwrite the cloud with it instead.",
    );
    if (useCloud) {
      await cloudSync.applyRemote(profile);
      toast({ icon: '☁️', title: 'Synced from the cloud', desc: `${remote.emoji} ${remote.rank}, ${remote.xp} XP.` });
    } else {
      await cloudSync.pushLocal(profile);
      toast({ icon: '☁️', title: 'Cloud updated', desc: "This device's progress is now the cloud copy." });
    }
    go('stats');
  };

  const renderDisconnected = () => {
    const tokenInput = el('input', {
      type: 'password',
      placeholder: 'Paste your token here…',
      autocomplete: 'off',
      style: { ...codeBoxStyle, padding: '9px 10px' },
    });
    const connectStatus = el('div.faint', { style: { minHeight: '20px', marginTop: '8px' } });
    const connectBtn = el('button.btn.sm.primary', { onclick: doConnect }, 'Connect');

    async function doConnect() {
      const token = tokenInput.value;
      if (!token.trim()) {
        connectStatus.textContent = 'Paste a token first.';
        connectStatus.style.color = 'var(--red)';
        return;
      }
      connectBtn.disabled = true;
      connectStatus.style.color = '';
      connectStatus.textContent = 'Connecting…';
      const result = await cloudSync.connect(token, profile);
      if (!result.ok) {
        connectBtn.disabled = false;
        connectStatus.textContent = `⚠️ ${result.message || 'Could not connect.'}`;
        connectStatus.style.color = 'var(--red)';
        return;
      }
      await decideDirection(result);
    }

    mount(container,
      el('p.muted', "One-time setup: create a free GitHub token, paste it below, and this device will sync automatically from then on — no code to copy, ever."),
      el('ol', { style: { color: 'var(--text-dim)', fontSize: '0.85rem', paddingLeft: '20px', margin: '0 0 12px' } },
        el('li', el('a', { href: cloudSync.TOKEN_SETUP_URL, target: '_blank', rel: 'noopener' }, 'Create a token ↗'),
          ' — the description and the "gist" scope are already filled in for you.'),
        el('li', 'Under ', el('strong', 'Expiration'), ', pick ', el('strong', 'No expiration'), ' (recommended) — GitHub does not let a link pre-select this part, so it defaults to 30 days if you leave it. An expired token just pauses sync until you reconnect; it does not lose anything.'),
        el('li', 'Scroll down and click "Generate token", then copy what GitHub shows you (starts with "ghp_").'),
        el('li', 'Paste it below and click Connect.'),
      ),
      el('div.row', tokenInput, connectBtn),
      connectStatus,
      el('p.faint', { style: { marginTop: '12px' } },
        'This creates a secret Gist in your GitHub account to hold your save. It is not publicly listed, but anyone with the exact link could view it, so do not share it. The token is stored only in this browser and can manage Gists only — nothing else in your account.'),
    );
  };

  const renderConnected = () => {
    const syncStatus = el('div.faint', { style: { minHeight: '20px', marginTop: '8px' } });
    const syncBtn = el('button.btn.sm.primary', { onclick: doSyncNow }, 'Sync now');

    async function doSyncNow() {
      syncBtn.disabled = true;
      syncStatus.style.color = '';
      syncStatus.textContent = 'Syncing…';
      const result = await cloudSync.syncNow(profile);
      syncBtn.disabled = false;
      if (!result.ok) {
        syncStatus.textContent = `⚠️ ${result.message || 'Sync failed.'}`;
        syncStatus.style.color = 'var(--red)';
        return;
      }
      syncStatus.textContent = result.applied ? '✅ Pulled in changes from another device.' : '✅ Already up to date.';
      toast({ icon: '☁️', title: 'Synced', desc: result.applied ? 'Brought in progress from another device.' : 'Already up to date.' });
      go('stats');
    }

    function doDisconnect() {
      if (!confirm("Disconnect this device from automatic sync? Your progress on this device is not affected — you can reconnect any time.")) return;
      cloudSync.disconnect();
      toast({ icon: '☁️', title: 'Disconnected', desc: 'This device will no longer sync automatically.' });
      go('stats');
    }

    mount(container,
      el('div.row',
        el('span.badge.green', '✅ Connected'),
        el('span.faint', `Last synced ${timeAgo(status.lastSyncedAt)}`),
      ),
      el('p.muted', { style: { margin: '10px 0' } }, 'This device syncs automatically. Open the trainer on your other synced device and it will catch up within a few seconds of you making progress here.'),
      el('div.row', syncBtn, el('button.btn.sm.ghost', { onclick: doDisconnect }, 'Disconnect')),
      syncStatus,
    );
  };

  if (status.connected) renderConnected(); else renderDisconnected();
  return container;
}

/**
 * A save code, not live sync: generate a code from this device, paste it in
 * on another one. Importing replaces what is there, so this always shows a
 * before-you-overwrite comparison rather than silently clobbering progress.
 */
function renderManualSync(ctx) {
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

  return el('div',
    el('p.muted', 'No GitHub account, or just want a one-off transfer? Generate a code here and paste it in on the other device — like a save file. This always overwrites, so it needs you to do it each time.'),
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

/** Automatic GitHub sync up top (the recommended path), manual code as a fallback below it. */
function renderSyncPanel(ctx) {
  const connected = cloudSync.getStatus().connected;
  return el('div.panel',
    el('div.panel-title', el('h2', '🔄 Sync progress'), el('span.faint', connected ? 'automatic' : 'no account needed')),
    renderAutoSync(ctx),
    el('div', { style: { borderTop: '1px solid var(--border)', margin: '18px 0' } }),
    renderManualSync(ctx),
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
        }, t('Open {pos}', { pos }))),
      ),
      el('div.row', { style: { marginTop: '8px' } },
        ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'].map((pos) => el(`button.btn.sm${view === `3bet:${pos}` ? '.primary' : '.ghost'}`, {
          onclick: () => ctx.go('charts', { chart: `3bet:${pos}` }),
        }, t('3-bet {pos}', { pos }))),
      ),
    ),

    el('div.panel',
      el('div.panel-title',
        el('h2', isThreeBet
          ? t('3-betting from {seat}', { seat: t(POSITION_INFO[position].name) })
          : t('Opening from {seat}', { seat: t(POSITION_INFO[position].name) })),
        el('span.badge.gold', t('{pct} of hands', { pct: fmt.pct(combos, 1) })),
      ),
      el('p.muted', t(POSITION_INFO[position].blurb)),

      el('div.range-grid-scroll', el('div.range-grid',
        grid.flat().map((key) => {
          // Touch screens have no hover, so the detail line was unreachable
          // on the devices this is most often read on.
          const describe = () => {
            detail.textContent = `${t('{hand} — {pct} against a random hand, ranked {rank} of 169.',
              { hand: key, pct: fmt.pct(HAND_STRENGTH[key], 1), rank: STRENGTH_RANK[key] })} ${
              inRange(key) ? t('In this range.') : t('Not in this range.')
            }`;
          };
          return el(`div.range-cell.${cellClass(key)}${key.length === 2 ? '.pair' : ''}`, {
            onmouseenter: describe,
            onclick: describe,
          }, key);
        }),
      )),

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


/* ------------------------------------------------------------------ *
 * Glossary
 * ------------------------------------------------------------------ */

/** Every term in one place, for when a word rather than an idea is the blocker. */
export function renderGlossary() {
  const terms = allTerms();
  return el('div.screen',
    el('div.panel',
      el('h1', '📖 Glossary'),
      el('p.muted', `Every piece of jargon the lessons use, in plain language. Terms appear underlined inside a lesson — tap one there and it explains itself without losing your place.`),
      el('span.badge', t('{n} terms', { n: terms.length })),
    ),
    el('div.panel',
      terms.map((t) => el('div.glossary-entry',
        el('div.glossary-term', t.term),
        el('div.glossary-short', t.short),
        el('div.glossary-full', t.full),
      )),
    ),
  );
}
