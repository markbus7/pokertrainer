/**
 * Application shell: routing, the rail and the ledger, and the
 * screen lifecycle. Routes live in the URL hash, so the back button and a
 * refresh both work.
 *
 * The shell used to be a website's: a brand, nine tabs and a row of chips.
 * It is a game's now. The rail across the top holds what a player checks
 * between hands — the purse, the pearls and the rank — and the way back to
 * the river. There are no tabs: the map is how you get anywhere, the way it
 * is in a game, and everything that is not a place on it, and the switches,
 * are in the ledger, which opens over the screen rather than replacing it.
 */

import { el, mount, $, toast, fmt } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { renderRiver } from './ui/screenRiver.js';
import { renderStop } from './ui/screenStop.js';
import { renderRangeLadder, renderRangeRun, renderRangeWeak } from './ui/screenRangeTrainer.js';
import { Profile } from './state/profile.js';
import * as cloudSync from './state/cloudSync.js';
import { VERSION, BUILT, checkForUpdate } from './version.js';
import { THEMES, applyTheme, isTheme, themeFor, DEFAULT_THEME } from './data/themes.js';
import { t, setLang, getLang, LANGUAGES } from './i18n/index.js';
import { makeRng } from './core/rng.js';
import { renderHome } from './ui/screenHome.js';
import { renderLearn, renderDrill, renderGauntletIntro } from './ui/screenDrill.js';
import { renderWalkthrough } from './ui/screenWalkthrough.js';
import { renderLab, renderLabIntro } from './ui/screenLab.js';
import { renderTable, waitingTable } from './ui/screenTable.js';
import { seatOf, seatValue, clearSeat } from './state/seat.js';
import { venueFor } from './data/venues.js';
import { renderReview } from './ui/screenReview.js';
import { renderStats, renderCharts, renderGlossary } from './ui/screenStats.js';
import { renderLevels } from './ui/screenLevels.js';
import { renderCharacter } from './ui/screenCharacter.js';
import { renderStore } from './ui/screenStore.js';
import { renderBoatyard } from './ui/screenBoatyard.js';
import { renderCatchBook } from './ui/screenCatchBook.js';
import { renderReport } from './ui/screenReport.js';
import { pearl } from './ui/shop.js';
import { bustSvg } from './ui/characterArt.js';
import { svgNode } from './ui/place.js';
import { tierFor } from './data/looks.js';
import { drawGuide } from './ui/guide.js';
import * as audio from './audio/engine.js';
import { STYLES, styleFor } from './audio/tunes.js';

/**
 * `music` is the track a screen plays ('river', 'table', or none); `focus`
 * screens are the ones you are in the middle of — a hand, a run on the
 * clock, a lesson — and get the whole screen. The rail and its ledger stay,
 * so there is always a way out.
 */
const ROUTES = {
  home: { render: renderRiver, title: 'The river', music: 'river' },
  stop: { render: renderStop, title: 'The river', music: 'river' },
  train: { render: renderHome, title: 'Lessons' },
  learn: { render: renderLearn, title: 'Lesson' },
  walkthrough: { render: renderWalkthrough, title: 'Guided lesson', focus: true },
  drill: { render: renderDrill, title: 'Drill', focus: true },
  ranges: { render: renderRangeLadder, title: 'Range trainer' },
  'ranges-run': { render: renderRangeRun, title: 'Range trainer', focus: true },
  'ranges-weak': { render: renderRangeWeak, title: 'Weak hands' },
  gauntlet: { render: renderGauntletIntro, title: 'The Race' },
  lab: { render: renderLabIntro, title: 'The Assay Office' },
  'lab-run': { render: renderLab, title: 'The Assay Office', focus: true },
  play: { render: renderTable, title: 'Table', music: 'table', focus: true },
  review: { render: renderReview, title: 'The Log' },
  charts: { render: renderCharts, title: 'The Chart Room' },
  glossary: { render: renderGlossary, title: 'The Almanac' },
  stats: { render: renderStats, title: 'Your Cabin' },
  levels: { render: renderLevels, title: 'Your Papers' },
  character: { render: renderCharacter, title: 'Your character' },
  store: { render: renderStore, title: 'The Trading Post' },
  boatyard: { render: renderBoatyard, title: 'The Boatyard', music: 'river' },
  catchbook: { render: renderCatchBook, title: 'The Catch Book', music: 'river' },
  report: { render: renderReport, title: 'Silas\'s notes' },
};

/** Everything, in the order a player looks for it. */
const LEDGER = [
  {
    title: 'Study',
    items: [
      { route: 'train', label: 'Lessons', icon: 'book', note: 'Read it, then drill it' },
      { route: 'ranges', label: 'Range trainer', icon: 'grid', note: 'Learn the charts until you do not need them' },
      { route: 'lab', label: 'The Assay Office', icon: 'lab', note: 'The Lab: work the figure out, then enter it' },
      { route: 'gauntlet', label: 'The Race', icon: 'gauntlet', note: 'The Gauntlet: every module mixed, against the Belle' },
    ],
  },
  {
    title: 'Play',
    items: [
      { route: 'home', label: 'The river', icon: 'river', note: 'The road down it: what to do next' },
      { route: 'play', label: 'Free table', icon: 'cards', note: 'Six-handed, with no bankroll at stake' },
      { route: 'store', label: 'The Trading Post', icon: 'store', note: 'Spend your pearls: chapters, charts, companions' },
      { route: 'boatyard', label: 'The Boatyard', icon: 'anchor', note: 'Better boats, and fittings that earn their keep' },
      { route: 'catchbook', label: 'The Catch Book', icon: 'fish', note: 'Every fish is a spot played right' },
    ],
  },
  {
    title: 'Records',
    items: [
      { route: 'character', label: 'Your character', icon: 'person', note: 'Who you are at the table: your style, your hands, your records' },
      { route: 'report', label: 'Silas\'s notes', icon: 'notes', note: 'What he saw at your last sittings' },
      { route: 'review', label: 'The Log', icon: 'review', note: 'Hand review: the hands worth a second look' },
      { route: 'charts', label: 'The Chart Room', icon: 'charts', note: 'Every range chart, by seat' },
      { route: 'glossary', label: 'The Almanac', icon: 'glossary', note: 'Glossary: every word the tables use' },
      { route: 'stats', label: 'Your Cabin', icon: 'progress', note: 'Progress, trophies and your save' },
      { route: 'levels', label: 'Your Papers', icon: 'ladder', note: 'Ranks: what the next one asks for' },
    ],
  },
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
// Both survive the redraw that picking a theme or a language causes.
let pickerOpen = false;
let ledgerOpen = false;

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
  ledgerOpen = false;
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
      el('button.btn', { onclick: () => go('home') }, 'Back to the river'),
    );
  }

  mount($('#screen'), screen);
  document.body.classList.toggle('focus', !!def.focus);
  document.body.dataset.route = route;
  drawShell();
  drawGuide({ profile, route, focus: !!def.focus, go });
  // The river has a tune, a table has a piano in the corner, and a lesson is
  // quiet: music under reading is noise, whatever it is.
  audio.setMusic(def.music || null);
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
  }, themeSwatch(themeFor(current)), el('span.theme-current', t(themeFor(current).name)));

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

/* ------------------------------------------------------------------ *
 * The rail: purse, rank, ledger
 * ------------------------------------------------------------------ */

// What the purse reads right now, and what it is rolling towards. Kept out
// here because the rail is redrawn on every save, and a count that restarted
// at each redraw would never finish.
let purseShown = null;
let purseTarget = null;
let purseRaf = 0;
const stillMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The bankroll, on the rail at all times. It is the score on the river —
 * what every seat is paid from and what opens the next stop — so it is the
 * one number a player should never have to go looking for. When it changes
 * it counts to the new figure rather than jumping, and coins land when it
 * goes up: cashing out should feel like cashing out.
 */
function purse() {
  const amount = profile.data.bankroll;
  const figure = el('span.purse-amount', fmt.money(purseShown ?? amount));
  const node = el('button.purse', {
    onclick: () => go('home'),
    title: 'Your bankroll. Every seat on the river is paid out of it.',
  }, el('span.coin', { 'aria-hidden': 'true' }), figure);

  if (purseShown === null || stillMotion()) {
    purseShown = amount;
    purseTarget = amount;
    figure.textContent = fmt.money(amount);
  } else if (purseShown !== amount) {
    if (purseTarget !== amount && amount > purseShown) audio.sfx('chips');
    purseTarget = amount;
    rollPurse(figure, purseShown, amount);
  }
  return node;
}

function rollPurse(figure, from, to) {
  cancelAnimationFrame(purseRaf);
  const start = performance.now();
  const duration = Math.min(1400, 500 + Math.abs(to - from) * 4);
  const tick = (now) => {
    const k = Math.min(1, (now - start) / duration);
    purseShown = from + (to - from) * (1 - (1 - k) ** 3);
    if (k >= 1) purseShown = to;
    figure.textContent = fmt.money(purseShown);
    if (k < 1) purseRaf = requestAnimationFrame(tick);
  };
  purseRaf = requestAnimationFrame(tick);
}

function drawHud() {
  const rank = profile.rank;
  const next = profile.nextRank;
  // On the river the crest is the game's name. Everywhere else it is the
  // way back to the river: with no tabs, it is the one door out of any room.
  const onRiver = parseHash().route === 'home';
  mount($('#topbar'),
    el(`button.crest${onRiver ? '' : '.back'}`, {
      onclick: () => go('home'),
      // The build is on the rail of every screen, so "do I have the right one?"
      // is a glance and not a trip through the ledger. The title has the date.
      title: `${t('Back to the river')} · v${VERSION} (${BUILT})`,
      'aria-label': `${t('Back to the river')}, v${VERSION}`,
    },
      el('span.crest-mark',
        el('span.crest-disc', { 'aria-hidden': 'true' }, onRiver ? '♠' : icon('river', { size: 20 })),
        el('span.crest-version', { 'aria-hidden': 'true' }, `v${VERSION}`),
      ),
      el('span.crest-name', onRiver ? 'Poker Trainer' : t('The river')),
    ),
    purse(),
    el('button.pearl-chip', {
      onclick: () => go('store'),
      title: t('Your pearls. The tables pay them; the Trading Post takes them, and buys them for money.'),
      'aria-label': t('{n} pearls — the Trading Post', { n: profile.pearls }),
    }, pearl(18), el('span.pearl-count', fmt.chips(profile.pearls))),
    // The chip is you: your rank, and the way to your character — the figure,
    // the kind of player you are, and from there your papers.
    el('button.rank-chip', {
      onclick: () => go('character'),
      title: t('{blurb} — your character', { blurb: t(rank.blurb) }),
    },
      svgNode(bustSvg({ tier: tierFor(profile.level), look: profile.look }, 38), 'chip-figure'),
      el('div.meta',
        el('span.chip-kicker', 'Your character'),
        el('span.name', el('span.emoji', rank.emoji), ' ', rank.name),
        el('span.xp', next ? `${fmt.chips(profile.xp)} / ${fmt.chips(next.xp)} XP` : `${fmt.chips(profile.xp)} XP`),
      ),
    ),
    el('button.ledger-button', {
      onclick: () => toggleLedger(!ledgerOpen),
      title: 'Everything else, and the settings',
      'aria-haspopup': 'dialog',
      'aria-expanded': ledgerOpen ? 'true' : 'false',
    }, icon('ledger', { size: 20 }), el('span.ledger-button-label', 'Ledger')),
  );
}

/* ------------------------------------------------------------------ *
 * The ledger
 * ------------------------------------------------------------------ */

/**
 * The switches for sound. Separate on purpose, like the engine: the effects
 * say what happened at the table, the music is atmosphere, and somebody
 * studying on a train wants the one and not the other.
 */
function soundSwitch(key, label, iconName) {
  const on = profile.settings[key] !== false;
  return el(`button.switch${on ? '.on' : ''}`, {
    role: 'switch',
    'aria-checked': on ? 'true' : 'false',
    onclick: () => {
      profile.updateSettings({ [key]: !on });
      if (key === 'sound' && !on) audio.sfx('click');
    },
  },
    icon(iconName, { size: 18 }),
    el('span.switch-label', t(label)),
    el('span.switch-track', { 'aria-hidden': 'true' }, el('span.switch-knob')),
  );
}

/**
 * How the music is played: three styles of the same tunes. Picking one on a
 * screen with music changes it in place; on a quiet screen it plays a few
 * bars, so the choice is made by ear rather than by name.
 */
function musicStylePicker() {
  const current = styleFor(profile.settings.musicStyle).key;
  return el('div.music-styles', { role: 'radiogroup', 'aria-label': t('Music style') },
    Object.values(STYLES).map((style) => el(`button.music-style${style.key === current ? '.active' : ''}`, {
      role: 'radio',
      'aria-checked': style.key === current ? 'true' : 'false',
      onclick: () => {
        profile.updateSettings({ musicStyle: style.key });
        audio.previewStyle();
      },
    },
      el('span.music-style-name', t(style.name)),
      el('span.music-style-blurb', t(style.blurb)),
    )),
  );
}

function ledgerItem(item, activeRoute) {
  const here = item.route === activeRoute;
  return el(`button.ledger-item${here ? '.active' : ''}`, {
    onclick: () => { audio.sfx('click'); ledgerOpen = false; go(item.route); },
    'aria-current': here ? 'page' : null,
  },
    icon(item.icon, { size: 20 }),
    el('span.ledger-text',
      el('span.ledger-label', t(item.label)),
      item.note ? el('span.ledger-note', t(item.note)) : null,
    ),
  );
}

let ledgerLastFocus = null;

function toggleLedger(open) {
  if (open === ledgerOpen) return;
  ledgerOpen = open;
  audio.sfx(open ? 'page' : 'click');
  if (open) ledgerLastFocus = document.activeElement;
  drawHud();
  drawLedger({ entering: open });
  if (open) {
    const close = $('.ledger-close');
    if (close) close.focus({ preventScroll: true });
  } else if (ledgerLastFocus && document.contains(ledgerLastFocus)) {
    ledgerLastFocus.focus({ preventScroll: true });
  }
}

function drawLedger({ entering = false } = {}) {
  const host = $('#ledger-host');
  if (!ledgerOpen) { mount(host); return; }
  const { route } = parseHash();
  mount(host,
    el('div.ledger-scrim', { onclick: () => toggleLedger(false) }),
    el(`aside.ledger.paper${entering ? '.entering' : ''}`, {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Ledger',
    },
      el('header.ledger-head',
        el('h2.sign', t('Ledger')),
        el('button.ledger-close', { onclick: () => toggleLedger(false), 'aria-label': 'Close' }, '×'),
      ),
      el('div.ledger-body',
        LEDGER.map((section) => el('section.ledger-section',
          el('h3.ledger-title', t(section.title)),
          section.items.map((item) => ledgerItem(item, route)),
        )),
        el('section.ledger-section.ledger-settings',
          el('h3.ledger-title', t('Settings')),
          el('div.setting', el('span.setting-label', t('Language')), languageToggle()),
          el('div.setting', el('span.setting-label', t('Look')), themePicker()),
          soundSwitch('sound', 'Sound effects', 'speaker'),
          soundSwitch('music', 'Music', 'note'),
          profile.settings.music !== false ? musicStylePicker() : null,
          el('button.version-chip', {
            onclick: () => { ledgerOpen = false; go('stats'); },
            title: 'Which build you are running — click for details and an update check',
          }, `v${VERSION}`),
        ),
      ),
    ),
  );
}

function drawShell() {
  drawHud();
  drawSeatBar();
  drawLedger();
}

/**
 * The bar under the rail while a table waits for you: where you are sitting,
 * what is on it, and the two ways out of anywhere — back to it, or up from it.
 * Not on the table itself, where the table says all of that.
 */
function drawSeatBar() {
  let bar = $('#seatbar');
  if (!bar) {
    bar = el('div#seatbar', { role: 'status' });
    $('#topbar').after(bar);
  }
  const onTable = parseHash().route === 'play';
  const waiting = onTable ? null : waitingTable();
  const kept = onTable || waiting ? null : seatOf(profile);
  if (!waiting && !(kept && kept.mode === 'grind' && kept.chips > 0)) {
    bar.hidden = true;
    mount(bar);
    return;
  }
  bar.hidden = false;
  if (waiting) {
    const line = waiting.mode === 'grind'
      ? (waiting.money > 0
        ? t('You are still seated at {place}, with {money} in front of you.', { place: waiting.place, money: fmt.money(waiting.money) })
        : t('You are still seated at {place}, out of chips.', { place: waiting.place }))
      : waiting.mode === 'duel' ? t('Your duel is waiting: {place}.', { place: waiting.place })
        : waiting.mode === 'regatta' ? t('Your Regatta is waiting: {place}.', { place: waiting.place })
          : t('Your table is waiting: {place}.', { place: waiting.place });
    mount(bar, el('div.seatbar-inner',
      icon('cards', { size: 18 }),
      el('span.seatbar-line', line),
      el('div.seatbar-actions',
        el('button.btn.sm.primary', { onclick: () => waiting.back() }, t('Back to the table')),
        el('button.btn.sm.ghost', { onclick: () => waiting.getUp() }, t(waiting.getUpLabel)),
      ),
    ));
    return;
  }
  mount(bar, el('div.seatbar-inner',
    icon('cards', { size: 18 }),
    el('span.seatbar-line', t('You still have a seat at {place}, with {money} on the table.',
      { place: t(venueFor(kept.venue).name), money: fmt.money(seatValue(kept)) })),
    el('div.seatbar-actions',
      el('button.btn.sm.primary', { onclick: () => go('play', { mode: 'grind', table: kept.table, resume: '1' }) }, t('Back to the table')),
      el('button.btn.sm.ghost', { onclick: () => go('play', { mode: 'grind', table: kept.table, resume: '1', cashout: '1' }) }, t('Cash out')),
    ),
  ));
}

/**
 * What a closed tab left behind. A cash seat is kept as it was, for the bar to
 * offer back. A Regatta cannot be dealt again where it stopped, so it is
 * settled the way the Withdraw button settles one: the entry back if no card
 * was dealt, otherwise a try with no place.
 */
function settleWhatWasLeft() {
  const kept = seatOf(profile);
  if (!kept) {
    if (profile.data.seat) { clearSeat(profile); profile.save(); }
    return;
  }
  if (kept.mode === 'grind' && kept.chips <= 0) {
    clearSeat(profile);
    profile.save();
    return;
  }
  if (kept.mode !== 'regatta') return;
  clearSeat(profile);
  if (kept.dealt > 0) {
    // An entry paid in pearls cost no money, and the try counts the money.
    profile.noteRegatta(kept.venue, { place: null, entry: kept.pearls ? 0 : kept.entry, prize: 0 });
    toast({ icon: '⛵', title: t('Your Regatta was interrupted'), desc: t('The page closed in the middle of it, so it counts as withdrawn. The entry stays in the pool.') });
  } else if (kept.pearls) {
    profile.refundPearls(kept.pearls);
    toast({ icon: '⛵', title: t('Your Regatta was interrupted'), desc: t('No card had been dealt, so the pearls you entered with are back in your purse.') });
  } else {
    profile.setBankroll(profile.data.bankroll + kept.entry, kept.venue);
    toast({ icon: '⛵', title: t('Your Regatta was interrupted'), desc: t('No card had been dealt, so the entry is back in your bankroll.') });
  }
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

window.addEventListener('hashchange', () => { ledgerOpen = false; render(); });

/**
 * Sound. The switches live in settings so they travel with the cloud sync;
 * the engine is told whenever they change. Browsers only let audio start
 * from something the reader did, so the first tap or key unlocks it — and
 * every later one too, which is what brings it back after the phone rang.
 */
const applySound = () => audio.configure({
  sfx: profile.settings.sound !== false,
  music: profile.settings.music !== false,
  style: profile.settings.musicStyle,
});
applySound();
for (const type of ['pointerdown', 'keydown']) {
  document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
}

document.addEventListener('keydown', (e) => {
  if (ledgerOpen) {
    if (e.key === 'Escape') toggleLedger(false);
    return;
  }
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (currentCtx && typeof currentCtx.onKey === 'function') currentCtx.onKey(e);
});

profile.onChange(() => {
  applySound();
  drawShell();
  cloudSync.scheduleAutoPush(profile, (result) => {
    if (!result.ok && result.reason !== 'not-connected') {
      toast({ icon: '⚠️', title: 'Sync paused', desc: result.message || 'Could not reach GitHub. Your progress is still saved on this device.' });
    }
  });
});

// Before the first screen: a reload that lands on a Regatta's own address
// deals a new one, and the one the closed tab left must be settled first, not
// taken for it.
settleWhatWasLeft();
render();

// The first visit is welcomed by the river's prologue on the map, which
// says where you are and what the game is; the old corner toast said less.

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
  // A tab in the background should not keep a piano going.
  if (document.visibilityState !== 'visible') { audio.pause(); return; }
  audio.resume();
  reconcileWithCloud();
});
