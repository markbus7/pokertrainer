/**
 * Application shell: routing, the top bar, and the screen lifecycle.
 * Routes live in the URL hash, so the back button and a refresh both work.
 */

import { el, mount, $, toast, fmt } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { renderCareer } from './ui/screenCareer.js';
import { Profile } from './state/profile.js';
import * as cloudSync from './state/cloudSync.js';
import { VERSION, checkForUpdate } from './version.js';
import { THEMES, applyTheme, isTheme, themeFor, DEFAULT_THEME } from './data/themes.js';
import { t, setLang, getLang, LANGUAGES } from './i18n/index.js';
import { makeRng } from './core/rng.js';
import { renderHome } from './ui/screenHome.js';
import { renderLearn, renderDrill, renderGauntletIntro } from './ui/screenDrill.js';
import { renderWalkthrough } from './ui/screenWalkthrough.js';
import { renderLab, renderLabIntro } from './ui/screenLab.js';
import { renderTable } from './ui/screenTable.js';
import { renderGrind } from './ui/screenGrind.js';
import { renderReview } from './ui/screenReview.js';
import { renderStats, renderCharts, renderGlossary } from './ui/screenStats.js';
import { renderLevels } from './ui/screenLevels.js';

const ROUTES = {
  home: { render: renderCareer, tab: 'home', title: 'Career' },
  train: { render: renderHome, tab: 'train', title: 'Training' },
  learn: { render: renderLearn, tab: 'train', title: 'Lesson' },
  walkthrough: { render: renderWalkthrough, tab: 'train', title: 'Guided lesson' },
  drill: { render: renderDrill, tab: 'train', title: 'Drill' },
  gauntlet: { render: renderGauntletIntro, tab: 'gauntlet', title: 'Gauntlet' },
  lab: { render: renderLabIntro, tab: 'lab', title: 'The Lab' },
  'lab-run': { render: renderLab, tab: 'lab', title: 'The Lab' },
  play: { render: renderTable, tab: 'play', title: 'Table' },
  grind: { render: renderGrind, tab: 'home', title: 'Bankroll' },
  review: { render: renderReview, tab: 'review', title: 'Hand review' },
  charts: { render: renderCharts, tab: 'charts', title: 'Charts' },
  glossary: { render: renderGlossary, tab: 'glossary', title: 'Glossary' },
  stats: { render: renderStats, tab: 'stats', title: 'Progress' },
  levels: { render: renderLevels, tab: 'stats', title: 'Ranks' },
};

const TABS = [
  { route: 'home', label: 'Career', icon: 'ladder' },
  { route: 'train', label: 'Train', icon: 'train' },
  { route: 'play', label: 'Play', icon: 'play' },
  { route: 'lab', label: 'Lab', icon: 'lab' },
  { route: 'gauntlet', label: 'Gauntlet', icon: 'gauntlet' },
  { route: 'review', label: 'Review', icon: 'review' },
  { route: 'charts', label: 'Charts', icon: 'charts' },
  { route: 'glossary', label: 'Glossary', icon: 'glossary' },
  { route: 'stats', label: 'Progress', icon: 'progress' },
];

const profile = Profile.load();
// The stored language and theme both have to be live before anything renders,
// or the first paint is English on the wrong palette and then flips. index.html
// paints the theme earlier still, straight from storage, so the very first
// frame is right too; this is the authoritative pass once the profile is
// parsed and knows about defaults and bad values.
setLang(profile.settings.lang || 'en');
applyTheme(isTheme(profile.settings.theme) ? profile.settings.theme : DEFAULT_THEME);
const rng = makeRng();
let currentCtx = null;
// Survives the topbar redraw that picking a theme causes.
let pickerOpen = false;

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
      el('pre.mono', { style: { whiteSpace: 'pre-wrap', color: 'var(--red)', fontSize: 'var(--t-sm)' } }, String(err && err.message)),
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

/**
 * Room picker.
 *
 * A dropdown of four words would have been a third of the code, and would
 * have asked the reader to choose a palette by name before ever seeing it.
 * So each entry paints itself: its ground, its accent and its cloth, in the
 * arrangement they appear on a real screen. Choosing is then recognition
 * rather than recall, which is the same reason the drills show a board
 * instead of describing one.
 *
 * It applies on tap and leaves the panel open, so the four can be compared
 * against the actual screen behind them rather than against a swatch.
 */
function themeSwatch(theme) {
  return el('span.theme-swatch', { 'aria-hidden': 'true' },
    el('span.theme-swatch-ground', { style: { background: theme.swatch.bg } },
      el('span.theme-swatch-felt', { style: { background: theme.swatch.felt } }),
      el('span.theme-swatch-accent', { style: { background: theme.swatch.accent } }),
    ),
  );
}

function themePicker() {
  const current = profile.settings.theme || DEFAULT_THEME;

  const panel = el('div.theme-panel', { hidden: true, role: 'listbox', 'aria-label': t('Look') },
    THEMES.map((theme) => el(`button.theme-option${theme.key === current ? '.active' : ''}`, {
      role: 'option',
      'aria-selected': theme.key === current ? 'true' : 'false',
      onclick: () => {
        applyTheme(theme.key);
        profile.updateSettings({ theme: theme.key });
        render();
        openPicker();
      },
    },
      themeSwatch(theme),
      el('span.theme-text',
        el('span.theme-name', t(theme.name)),
        el('span.theme-blurb', t(theme.blurb)),
      ),
    )),
  );

  const button = el('button.theme-button', {
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
    title: 'Pick how the app looks',
    onclick: (e) => { e.stopPropagation(); togglePicker(); },
  }, themeSwatch(themeFor(current)));

  function togglePicker() {
    const show = panel.hidden;
    panel.hidden = !show;
    button.setAttribute('aria-expanded', show ? 'true' : 'false');
  }

  // Re-rendering the topbar rebuilds this, so the flag has to live outside it.
  function openPicker() { pickerOpen = true; }

  if (pickerOpen) { panel.hidden = false; button.setAttribute('aria-expanded', 'true'); }

  // Anywhere else closes it — a panel with no way out is a trap on a tablet,
  // where there is no Escape key in reach.
  document.addEventListener('click', () => {
    if (panel.hidden) return;
    panel.hidden = true;
    pickerOpen = false;
    button.setAttribute('aria-expanded', 'false');
  }, { once: true });

  return el('div.theme-switch', { onclick: (e) => e.stopPropagation() }, button, panel);
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
      title: t(tab.label),
      'aria-label': t(tab.label),
    }, icon(tab.icon, { size: 17 }), el('span', t(tab.label))))),
    themePicker(),
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
        el('div.faint', `You are running ${result.current}. Reload to update. If the version still does not change after a few reloads, the new build has not finished publishing yet — wait rather than clearing your browsing data, which erases your progress along with the cache.`),
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
