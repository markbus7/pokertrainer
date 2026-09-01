/**
 * Application shell: routing, the top bar, and the screen lifecycle.
 * Routes live in the URL hash, so the back button and a refresh both work.
 */

import { el, mount, $, toast, fmt } from './ui/dom.js';
import { Profile } from './state/profile.js';
import * as cloudSync from './state/cloudSync.js';
import { VERSION, checkForUpdate } from './version.js';
import { t, setLang, getLang, LANGUAGES } from './i18n/index.js';
import { makeRng } from './core/rng.js';
import { renderHome } from './ui/screenHome.js';
import { renderLearn, renderDrill, renderGauntletIntro } from './ui/screenDrill.js';
import { renderWalkthrough } from './ui/screenWalkthrough.js';
import { renderLab, renderLabIntro } from './ui/screenLab.js';
import { renderTable } from './ui/screenTable.js';
import { renderGrind } from './ui/screenGrind.js';
import { renderStats, renderCharts, renderGlossary } from './ui/screenStats.js';
import { renderLevels } from './ui/screenLevels.js';

const ROUTES = {
  home: { render: renderHome, tab: 'home', title: 'Dashboard' },
  learn: { render: renderLearn, tab: 'home', title: 'Lesson' },
  walkthrough: { render: renderWalkthrough, tab: 'home', title: 'Guided lesson' },
  drill: { render: renderDrill, tab: 'home', title: 'Drill' },
  gauntlet: { render: renderGauntletIntro, tab: 'gauntlet', title: 'Gauntlet' },
  lab: { render: renderLabIntro, tab: 'lab', title: 'The Lab' },
  'lab-run': { render: renderLab, tab: 'lab', title: 'The Lab' },
  play: { render: renderTable, tab: 'play', title: 'Table' },
  grind: { render: renderGrind, tab: 'grind', title: 'Bankroll' },
  charts: { render: renderCharts, tab: 'charts', title: 'Charts' },
  glossary: { render: renderGlossary, tab: 'glossary', title: 'Glossary' },
  stats: { render: renderStats, tab: 'stats', title: 'Progress' },
  levels: { render: renderLevels, tab: 'stats', title: 'Ranks' },
};

const TABS = [
  { route: 'home', label: 'Train' },
  { route: 'play', label: 'Play' },
  { route: 'lab', label: 'Lab' },
  { route: 'gauntlet', label: 'Gauntlet' },
  { route: 'grind', label: 'Bankroll' },
  { route: 'charts', label: 'Charts' },
  { route: 'glossary', label: 'Glossary' },
  { route: 'stats', label: 'Progress' },
];

const profile = Profile.load();
// The stored language has to be live before anything renders, or the first
// paint is English and then flips.
setLang(profile.settings.lang || 'en');
const rng = makeRng();
let currentCtx = null;

function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return { route: 'home', params: {} };
  const [route, query = ''] = raw.split('?');
  const params = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { route: ROUTES[route] ? route : 'home', params };
}

function go(route, params = {}) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const next = `#${route}${query ? `?${query}` : ''}`;
  if (location.hash === next) render();
  else location.hash = next;
}

function render() {
  // Let the outgoing screen stop its timers before it is torn down.
  if (currentCtx && typeof currentCtx.onLeave === 'function') currentCtx.onLeave();

  const { route, params } = parseHash();
  const def = ROUTES[route];
  const ctx = { profile, rng, go, route, params };
  currentCtx = ctx;

  let screen;
  try {
    screen = def.render(ctx, params);
  } catch (err) {
    console.error(err);
    screen = el('div.panel',
      el('h2', 'Something went wrong'),
      el('p.muted', 'That screen failed to load. The error is in the console.'),
      el('pre.mono', { style: { whiteSpace: 'pre-wrap', color: 'var(--red)', fontSize: '0.8rem' } }, String(err && err.message)),
      el('button.btn', { onclick: () => go('home') }, 'Back to dashboard'),
    );
  }

  mount($('#screen'), screen);
  drawTopbar(def.tab);
  document.title = `${t(def.title)} · Poker Trainer`;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/**
 * Language switch. Two languages fit as a pair of chips, which is one tap
 * rather than the two a dropdown costs, and shows the alternative exists
 * without being opened.
 */
function languageToggle() {
  return el('div.lang-switch', { role: 'group', 'aria-label': t('Language') },
    LANGUAGES.map((lang) => el(`button.lang-chip${lang.code === getLang() ? '.active' : ''}`, {
      onclick: () => {
        if (lang.code === getLang()) return;
        setLang(lang.code);
        profile.updateSettings({ lang: lang.code });
        render();
      },
      title: lang.label,
      'aria-pressed': lang.code === getLang() ? 'true' : 'false',
    }, `${lang.flag} ${lang.short}`)),
  );
}

function drawTopbar(activeTab) {
  const rank = profile.rank;
  const next = profile.nextRank;
  mount($('#topbar'),
    el('div.brand', el('span.pip', '♠'), 'Poker Trainer',
      el('button.version-chip', {
        onclick: () => go('stats'),
        title: 'Which build you are running — click for details and an update check',
      }, `v${VERSION}`)),
    el('nav.tabs', TABS.map((tab) => el(`button.tab${tab.route === activeTab ? '.active' : ''}`, {
      onclick: () => go(tab.route),
    }, t(tab.label)))),
    languageToggle(),
    el('button.rank-chip', {
      onclick: () => go('levels'),
      title: `${rank.blurb} — click to see what the next rank asks for`,
    },
      el('span.emoji', rank.emoji),
      el('div.meta',
        el('span.name', rank.name),
        el('span.xp', next ? `${fmt.chips(profile.xp)} / ${fmt.chips(next.xp)} XP` : `${fmt.chips(profile.xp)} XP`),
      ),
    ),
  );
}

/**
 * Tell the reader when their copy is out of date, instead of leaving them to
 * discover it. A user updated, reloaded, and still saw the old version with
 * nothing on screen explaining why — the app had an update check, but only if
 * you already knew to go and press it.
 *
 * Static hosting caches aggressively and iOS Safari has no true hard refresh,
 * so being behind for a few minutes after a release is normal rather than
 * broken. This says so, which is the part that was missing.
 *
 * Deliberately no cache-busting query on the module URLs: the imports are not
 * versioned, so busting only the entry point would load a new app.js against
 * cached older modules. Everything expiring together is the safe behaviour.
 */
function announceUpdateIfBehind() {
  checkForUpdate().then((result) => {
    if (!result.ok || !result.behind) return;
    if (sessionStorage.getItem('pt-update-dismissed') === result.latest) return;

    const banner = el('div.update-banner',
      el('div',
        el('strong', `Version ${result.latest} is available`),
        el('div.faint', `You are running ${result.current}. Reload to update — if the version does not change, your browser is still holding a cached copy, which usually clears within about ten minutes.`),
      ),
      el('div.row',
        el('button.btn.sm.primary', { onclick: () => location.reload() }, 'Reload'),
        el('button.btn.sm.ghost', {
          onclick: () => {
            try { sessionStorage.setItem('pt-update-dismissed', result.latest); } catch { /* private mode */ }
            banner.remove();
          },
        }, 'Later'),
      ),
    );
    document.body.insertBefore(banner, document.body.firstChild);
  });
}

window.addEventListener('hashchange', render);

document.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (currentCtx && typeof currentCtx.onKey === 'function') currentCtx.onKey(e);
});

profile.onChange(() => {
  drawTopbar(ROUTES[parseHash().route].tab);
  cloudSync.scheduleAutoPush(profile, (result) => {
    if (!result.ok && result.reason !== 'not-connected') {
      toast({ icon: '⚠️', title: 'Sync paused', desc: result.message || 'Could not reach GitHub. Your progress is still saved on this device.' });
    }
  });
});

render();

if (!profile.data.seenWelcome) {
  profile.data.seenWelcome = true;
  profile.save();
  setTimeout(() => toast({
    icon: '♠',
    title: 'Welcome to the table',
    desc: 'Start with Hand Rankings, then play a few hands. The coach explains every decision.',
    duration: 7000,
  }), 500);
}

/**
 * Reconcile with the cloud: render local state immediately (fast, works
 * offline), then catch up silently if another device pushed something newer
 * since this browser last synced. Runs on load AND whenever this tab becomes
 * visible again — a tab left open in the background for a day is exactly
 * when it is most likely to be behind, and skipping that check would let it
 * push its stale state right over a newer one on the very next local change.
 *
 * No throttle on the visibility listener: each check is a single cheap GET,
 * and GitHub's personal-token rate limit (5,000/hour) makes even frequent
 * tab-switching a non-issue. A rate limit here would only buy back a race
 * against the exact failure mode this exists to prevent.
 */
function reconcileWithCloud() {
  if (!cloudSync.isConnected()) return;
  cloudSync.applyRemoteIfNewer(profile).then((result) => {
    if (result.ok && result.applied) {
      toast({
        icon: '☁️',
        title: 'Synced from your other device',
        desc: `${result.summary.emoji} ${result.summary.rank}, ${fmt.chips(result.summary.xp)} XP.`,
      });
      render();
    }
  });
}

reconcileWithCloud();
announceUpdateIfBehind();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  reconcileWithCloud();
});
