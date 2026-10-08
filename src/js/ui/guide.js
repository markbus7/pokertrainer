/**
 * Silas at your side.
 *
 * Away from the table he stands in a dock along the bottom of every screen,
 * head to toe, always in view and never over anything: the page keeps the
 * room he stands in. He has one thing to say at a time — the next step on
 * the road, the habit that costs you the most, today's questions, what your
 * pearls are worth, or one of the rules he has played by for thirty years —
 * and a tap on the word is another word. Tap him, or "Ask Silas", and you
 * can talk to him: pick a question about your game, or type one, or any word
 * from the tables, and he answers from your own numbers. At the table he is
 * already at your shoulder, so he is not here twice.
 */

import { el, mount, fmt } from './dom.js';
import { t } from '../i18n/index.js';
import { characterSvg } from './characterArt.js';
import { portraitSvg } from './portraits.js';
import { svgNode } from './place.js';
import { MENTOR } from '../data/characters.js';
import { journeyState } from '../state/journey.js';
import { goalText, goLabel } from './roadView.js';
import { moneyHabits, sizeHabits } from '../state/lifetime.js';
import { purseWorth } from '../state/economy.js';
import { whoYouAre } from '../state/character.js';
import { allTerms } from '../data/glossary.js';
import { dateKey, doneToday, liveStreak } from '../state/daily.js';

/** Him, head to toe: the long coat and the wide hat, white whiskers, a cup of tea. */
const SILAS_LOOK = { skin: 'light', hair: 'bald', hairColour: 'white', beard: 'moustache', colour: 'crimson', name: '' };

export const silasFigure = (width = 120, form = 'steady') => characterSvg({
  tier: 3, form, look: SILAS_LOOK, props: 'tea', width, label: `${MENTOR.name}, ${t(MENTOR.title)}`,
});

/** His face for a verdict: pleased with a good one, concerned by a mistake. */
export const moodFor = (level) => (level === 'good' ? 'hot' : level === 'bad' ? 'cold' : 'steady');

/** What he has to teach when there is nothing in particular to say. */
export const RULES = [
  'Price first, then the hand. A call is right when your chance of winning beats the price you are offered.',
  'Fold more before the flop than feels comfortable. The money is made after it.',
  'Every bet needs a reason: to be called by worse, or to make better fold. No reason, check.',
  'Position is worth more than a pretty hand. Play more from the button, fewer from the first seats.',
  'A loss played right is not a mistake. Judge the decision, never the card that came.',
  'Big pots for big hands. With one pair, keep the pot the size of one pair.',
  'When somebody who never raises raises, believe them.',
  'A draw wants a cheap price or a big pot later. Without one of the two, let it go.',
  'Tired, angry or chasing a loss: get up. The table will still be there tomorrow.',
  'Size your bet for what you hold and what they might call with, not for the button nearest your thumb.',
];

/** Screens where he does not stand: the table has him already, and a drill wants the whole screen. */
const hiddenOn = (route, focus) => focus || route === 'play';

let turn = 0;

/**
 * Everything he could say right now, the most pressing for this screen first.
 * Each: { text, params, to?: {route, params}, label? }.
 */
export function sayings(profile, route, now = new Date()) {
  const said = [];
  const life = profile.lifetime;

  // The road: the one next thing to do.
  const road = journeyState(profile).next;
  if (road && road.goal) {
    said.push({
      key: 'road',
      text: 'Next on the road: {goal}',
      params: { goal: goalText(road.goal) },
      to: road.goal.to,
      label: goLabel(road.goal),
    });
  }

  // The money: the costliest habit, or the one repeated most.
  const money = moneyHabits(life);
  const costly = money.costly[0];
  const often = money.often[0];
  if (costly) {
    said.push({
      key: 'leak',
      text: 'Your costliest mistake so far: “{head}”. About {bb} gone. That is the one we fix first.',
      params: { head: t(costly.head), bb: `${costly.bbLost.toFixed(1)} bb` },
      to: { route: 'character', params: { at: 'money' } },
      label: 'Your money decisions',
    });
  } else if (often) {
    said.push({
      key: 'leak',
      text: 'The mistake you make most: “{head}”, {n} times now.',
      params: { head: t(often.head), n: often.times },
      to: { route: 'character', params: { at: 'money' } },
      label: 'Your money decisions',
    });
  }

  // The sizes: which kind of bet runs small or big.
  const worst = sizeHabits(life).worst;
  if (worst && (worst.miss === 'small' || worst.miss === 'big')) {
    said.push({
      key: 'sizes',
      text: worst.miss === 'small'
        ? 'Your sizes run small on this one: {kind}. A small bet gives them a cheap price to draw and to catch up.'
        : 'Your sizes run big on this one: {kind}. Too big, and only the hands that beat you stay in.',
      params: { kind: t(worst.name) },
      to: { route: 'character', params: { at: 'sizes' } },
      label: 'Bet sizes',
    });
  }

  // Today's questions, while they are still to do.
  const key = dateKey(now);
  if (!doneToday(profile, key)) {
    const streak = liveStreak(profile, key);
    said.push({
      key: 'daily',
      text: streak > 0
        ? 'Today\'s three questions are waiting. {n} days in a row: keep it going.'
        : 'Today\'s three questions are waiting. Five minutes, every day: that is how a pilot learns a river.',
      params: { n: streak },
      to: { route: 'drill', params: { mode: 'daily' } },
      label: 'Answer today\'s three',
    });
  }

  // The pearls, once there are enough to be worth something.
  if (profile.pearls >= 1000) {
    const worth = purseWorth(profile);
    said.push({
      key: 'pearls',
      text: 'Your {n} pearls fetch {here} here, and {far} at the far end of the river. No hurry to sell.',
      params: { n: fmt.chips(profile.pearls), here: fmt.money(worth.here), far: fmt.money(worth.delta) },
      to: { route: 'store' },
      label: 'To the Trading Post',
    });
  }

  // And always one of his rules.
  RULES.forEach((text, i) => said.push({ key: `rule${i}`, text, params: {} }));

  // What this screen is about goes first.
  const first = { character: ['leak', 'sizes'], stats: ['leak', 'sizes'], review: ['leak'], store: ['pearls'], home: ['daily', 'leak', 'sizes'], stop: ['road'] }[route] || [];
  const rank = (s) => {
    const i = first.indexOf(s.key);
    return i === -1 ? first.length : i;
  };
  return said.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(({ s }) => s);
}

/* ---- talking to him ------------------------------------------------------ */

const ACTION_NAMES = { fold: 'Folds', check: 'Checks', call: 'Calls', bet: 'Bets', raise: 'Raises' };
const pctOf = (x) => `${Math.round(x * 100)}%`;
const bbOf = (x) => `${x.toFixed(1)} bb`;

/** What you can ask him, in the order the chips show them. */
export const QUESTIONS = [
  { key: 'doing', q: 'How am I doing?' },
  { key: 'next', q: 'What should I do next?' },
  { key: 'leak', q: 'Where am I losing money?' },
  { key: 'size', q: 'Am I betting the right size?' },
  { key: 'type', q: 'What kind of player am I?' },
  { key: 'pearls', q: 'What are my pearls worth?' },
  { key: 'teach', q: 'Teach me something' },
];

/**
 * His answer to one of the questions, from your own numbers.
 * @returns {{lines:Array<{text:string, params?:object}>, to?:{route, params}, label?:string}}
 */
export function answer(profile, key, rng = Math.random) {
  const life = profile.lifetime;
  if (key === 'doing') {
    const m = moneyHabits(life);
    if (!m.decisions) return { lines: [{ text: 'Nothing to judge yet. Sit down at a real table and play: I grade every decision and keep the count.' }], to: { route: 'home' }, label: 'The river' };
    const lines = [{ text: '{right} of {n} decisions right: {pct}. The mistakes have cost about {bb}.', params: { right: fmt.chips(m.right), n: fmt.chips(m.decisions), pct: pctOf(m.share), bb: bbOf(m.bbLost) } }];
    const weakest = m.actions.filter((r) => r.decisions >= 10).sort((a, b) => a.share - b.share)[0];
    if (weakest && weakest.share < 1) lines.push({ text: 'Your weakest: {action}, {pct} right.', params: { action: t(ACTION_NAMES[weakest.key]), pct: pctOf(weakest.share) } });
    return { lines, to: { route: 'character', params: { at: 'money' } }, label: 'Your money decisions' };
  }
  if (key === 'next') {
    const road = journeyState(profile).next;
    if (!road || !road.goal) return { lines: [{ text: 'The road is done. Now it is the tables, and every decision at them.' }] };
    return { lines: [{ text: 'Next on the road: {goal}', params: { goal: goalText(road.goal) } }], to: road.goal.to, label: goLabel(road.goal) };
  }
  if (key === 'leak') {
    const m = moneyHabits(life);
    const to = { route: 'character', params: { at: 'money' } };
    if (m.costly[0]) return { lines: [{ text: 'Your costliest mistake so far: “{head}”. About {bb} gone. That is the one we fix first.', params: { head: t(m.costly[0].head), bb: bbOf(m.costly[0].bbLost) } }], to, label: 'Your money decisions' };
    if (m.often[0]) return { lines: [{ text: 'The mistake you make most: “{head}”, {n} times now.', params: { head: t(m.often[0].head), n: m.often[0].times } }], to, label: 'Your money decisions' };
    return { lines: [{ text: 'No leak I can put a price on yet. Play more hands at a real table and I will find one — everybody has one.' }] };
  }
  if (key === 'size') {
    const h = sizeHabits(life);
    const to = { route: 'character', params: { at: 'sizes' } };
    if (!h.sized) return { lines: [{ text: 'No bets of yours measured yet. A place to start: a third of the pot on a dry board, two thirds when the board is wet or you want to be paid.' }] };
    if (h.worst && (h.worst.miss === 'small' || h.worst.miss === 'big')) {
      return {
        lines: [{ text: h.worst.miss === 'small'
          ? 'Your sizes run small on this one: {kind}. A small bet gives them a cheap price to draw and to catch up.'
          : 'Your sizes run big on this one: {kind}. Too big, and only the hands that beat you stay in.', params: { kind: t(h.worst.name) } }],
        to, label: 'Bet sizes',
      };
    }
    return { lines: [{ text: 'Your bets are the right size {pct} of the time. Keep sizing for a reason, not out of habit.', params: { pct: pctOf(h.share) } }], to, label: 'Bet sizes' };
  }
  if (key === 'type') {
    const me = whoYouAre(profile);
    if (me.toRead > 0) return { lines: [{ text: 'Too early to say. {n} more hands at a full table and I will know what kind of player you are.', params: { n: me.toRead } }] };
    return { lines: [{ text: 'You play like this: {name}.', params: { name: t(me.type.name) } }, { text: me.type.watch }], to: { route: 'character' }, label: 'Your character' };
  }
  if (key === 'pearls') {
    if (!(profile.pearls > 0)) return { lines: [{ text: 'No pearls yet. The tables pay them: a pearl for every hand you play through, and more for every decision made well.' }] };
    const worth = purseWorth(profile);
    return {
      lines: [{ text: 'Your {n} pearls fetch {here} here, and {far} at the far end of the river. No hurry to sell.', params: { n: fmt.chips(profile.pearls), here: fmt.money(worth.here), far: fmt.money(worth.delta) } }],
      to: { route: 'store' }, label: 'To the Trading Post',
    };
  }
  // 'teach', and anything else: one of his rules.
  return { lines: [{ text: RULES[Math.floor(rng() * RULES.length)] }] };
}

/** Words that mean one of the questions, in either language. */
const ASKS = [
  ['leak', /leak|losing|lose|lost|mistake|lek|verlie|fout/],
  ['size', /size|how much|too much|too little|too big|too small|betting|sizing|inzet|hoeveel|te veel|te weinig/],
  ['next', /next|what now|what should|volgende|wat nu|wat moet/],
  ['type', /kind of player|what player|style|type|speler|stijl/],
  ['pearls', /pearl|parel/],
  ['doing', /how am i|doing|progress|hoe doe|hoe gaat|gaat het/],
  ['teach', /teach|tip|rule|leer|regel/],
];

/**
 * Anything typed: a word from the tables is looked up in the almanac (the
 * longest one named wins), else a question about your game, else he says
 * what he can talk about.
 */
export function askFree(profile, text, rng = Math.random) {
  const q = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return null;
  let best = null;
  for (const entry of allTerms()) {
    for (const name of [entry.term, t(entry.term)]) {
      const n = name.toLowerCase();
      // A whole word or phrase only: "spr" is not in "spread".
      const at = q.indexOf(n);
      const whole = at >= 0 && !/[a-z0-9]/.test(q[at - 1] || '') && !/[a-z0-9]/.test(q[at + n.length] || '');
      if (n.length >= 3 && whole && (!best || n.length > best.len)) best = { entry, len: n.length };
    }
  }
  if (best) return { lines: [{ text: best.entry.term, strong: true }, { text: best.entry.full }], to: { route: 'glossary' }, label: 'The Almanac' };
  const hit = ASKS.find(([, re]) => re.test(q));
  if (hit) return answer(profile, hit[0], rng);
  return { lines: [{ text: 'I do not know that one. Ask me about a word from the tables — pot odds, equity, a 3-bet — or about your own game, or pick one of the questions.' }] };
}

/* ---- the dock and the conversation --------------------------------------- */

/** The conversation, kept while the app is open: the last few exchanges. */
const talk = [];
const TALK_KEPT = 6;
let sheetOpen = false;
let rotate = null;
let escHooked = false;

/**
 * Draw him for this screen: the dock, and the conversation if it is open.
 * @param {{profile, route:string, focus:boolean, go:Function}} ctx
 */
export function drawGuide({ profile, route, focus, go }) {
  let host = document.getElementById('guide-host');
  if (!host) {
    host = el('div#guide-host');
    document.body.appendChild(host);
  }
  if (rotate) { clearInterval(rotate); rotate = null; }
  sheetOpen = false;
  if (hiddenOn(route, focus)) {
    document.body.classList.remove('guide-docked');
    mount(host);
    return;
  }
  document.body.classList.add('guide-docked');
  const list = sayings(profile, route);
  turn = 0;

  const ask = (q, reply) => {
    talk.push({ q, reply });
    if (talk.length > TALK_KEPT) talk.shift();
    draw();
    const log = host.querySelector('.ask-log');
    if (log) log.scrollTop = log.scrollHeight;
  };
  const goTo = (to) => { sheetOpen = false; go(to.route, to.params || {}); };
  const lineNodes = (reply) => reply.lines.map((l) => (l.strong
    ? el('strong.ask-term', t(l.text))
    : el('p', t(l.text, l.params || {}))));

  const sheet = () => {
    const input = el('input.ask-input', { type: 'text', placeholder: 'Ask about a word or your game…', 'aria-label': 'Ask Silas', maxlength: '120' });
    return el('section.ask-sheet', { role: 'dialog', 'aria-label': t('Ask Silas') },
      el('div.ask-head',
        svgNode(portraitSvg('silas', { size: 40 }), 'ask-face'),
        el('div',
          el('strong', MENTOR.short),
          el('div.faint', t('Ask me about your game, or a word from the tables'))),
        el('button.guide-close', { type: 'button', title: 'Close', 'aria-label': 'Close', onclick: () => { sheetOpen = false; draw(); } }, '×'),
      ),
      el('div.ask-log',
        talk.length ? null : el('div.ask-a', el('p', t(MENTOR.school))),
        talk.map(({ q, reply }) => [
          el('div.ask-q', q),
          el('div.ask-a', lineNodes(reply),
            reply.to ? el('button.btn.sm.primary', { type: 'button', onclick: () => goTo(reply.to) }, t(reply.label)) : null),
        ]),
      ),
      el('div.ask-chips', QUESTIONS.map(({ key, q }) => el('button.btn.sm.ghost', {
        type: 'button', onclick: () => ask(t(q), answer(profile, key)),
      }, t(q)))),
      el('form.ask-form', {
        onsubmit: (e) => {
          e.preventDefault();
          const text = input.value.trim();
          const reply = askFree(profile, text);
          if (reply) ask(text, reply);
        },
      }, input, el('button.btn.sm.primary', { type: 'submit' }, 'Ask')),
    );
  };

  const draw = () => {
    const say = list[turn % list.length];
    const another = () => { turn += 1; draw(); };
    const open = () => { sheetOpen = !sheetOpen; draw(); if (sheetOpen) { const i = host.querySelector('.ask-input'); if (i && window.matchMedia('(min-width: 761px)').matches) i.focus(); } };
    mount(host,
      sheetOpen ? sheet() : null,
      el('aside.guide-dock', { 'aria-label': t('Silas, your guide') },
        el('button.guide-body', { type: 'button', title: t('Ask Silas'), 'aria-label': t('Ask Silas'), onclick: open },
          svgNode(silasFigure(52), 'guide-figure')),
        el('button.dock-word', { type: 'button', title: t('Another word'), onclick: another },
          el('span.dock-name', MENTOR.short),
          el('span.dock-says', t(say.text, say.params))),
        el('div.dock-actions',
          say.to && !(say.to.route === route && !say.to.params)
            ? el('button.btn.sm.ghost.dock-go', { type: 'button', onclick: () => goTo(say.to) }, t(say.label))
            : null,
          el(`button.btn.sm${sheetOpen ? '' : '.primary'}.dock-ask`, { type: 'button', onclick: open }, sheetOpen ? t('Close') : t('Ask Silas')),
        ),
      ),
    );
  };
  draw();
  // A word every so often while you read, so he is not a painting.
  rotate = setInterval(() => { if (!sheetOpen && document.visibilityState !== 'hidden') { turn += 1; draw(); } }, 45000);
  if (!escHooked) {
    escHooked = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sheetOpen) { sheetOpen = false; const c = host.querySelector('.guide-close'); if (c) c.click(); }
    });
  }
}
