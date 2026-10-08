/**
 * Silas at your side.
 *
 * Away from the table he stands in the corner of every screen, head to toe,
 * with one thing to say: the next step on the road, the habit that costs you
 * the most, today's questions, what your pearls are worth, or one of the
 * rules he has played by for thirty years. A word from him is a button to the
 * place it is about. Sent to sit back, he is a portrait in the corner until
 * you call him again. At the table he is already at your shoulder, so he is
 * not here twice.
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
  const first = { character: ['leak', 'sizes'], stats: ['leak', 'sizes'], review: ['leak'], store: ['pearls'], home: ['road', 'daily'], stop: ['road'] }[route] || [];
  const rank = (s) => {
    const i = first.indexOf(s.key);
    return i === -1 ? first.length : i;
  };
  return said.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(({ s }) => s);
}

/** Open or sat back: the setting if you have chosen, else open where there is room for him. */
function isOpen(profile) {
  const s = profile.settings.guide;
  if (s === 'open') return true;
  if (s === 'small') return false;
  return typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(min-width: 1100px)').matches;
}

/**
 * Draw him into #guide-host for this screen.
 * @param {{profile, route:string, focus:boolean, go:Function}} ctx
 */
export function drawGuide({ profile, route, focus, go }) {
  let host = document.getElementById('guide-host');
  if (!host) {
    host = el('div#guide-host');
    document.body.appendChild(host);
  }
  document.body.classList.remove('guide-open');
  if (hiddenOn(route, focus)) {
    mount(host);
    return;
  }

  // A screen with a place kept for him (a .guide-slot) has him in the page,
  // where he covers nothing; everywhere else he stands in the corner.
  const slot = document.querySelector('#screen .guide-slot');
  const target = slot || host;
  if (slot) mount(host);

  const list = sayings(profile, route);
  // A new screen starts at the top of what matters there; "another word" walks on.
  turn = 0;

  const draw = () => {
    const open = isOpen(profile);
    document.body.classList.toggle('guide-open', open && !slot);
    if (!open) {
      mount(target, el('button.guide-call', {
        type: 'button',
        title: t('Silas has a word for you'),
        'aria-label': t('Silas has a word for you'),
        onclick: () => { profile.updateSettings({ guide: 'open' }); draw(); },
      }, svgNode(portraitSvg('silas', { size: 54 }), 'guide-face'), el('span.guide-dot', { 'aria-hidden': 'true' })));
      return;
    }
    const say = list[turn % list.length];
    const another = () => { turn += 1; draw(); };
    mount(target, el('aside.guide', { 'aria-label': t('Silas, your guide') },
      el('div.guide-bubble', { role: 'status' },
        el('div.guide-who',
          svgNode(portraitSvg('silas', { size: 30 }), 'guide-mini'),
          el('strong', MENTOR.short),
          el('span.faint', t(MENTOR.title)),
          el('button.guide-close', {
            type: 'button',
            title: t('Let Silas sit back'),
            'aria-label': t('Let Silas sit back'),
            onclick: () => { profile.updateSettings({ guide: 'small' }); draw(); },
          }, '×'),
        ),
        el('p.guide-says', t(say.text, say.params)),
        el('div.guide-actions',
          say.to && !(say.to.route === route && !say.to.params)
            ? el('button.btn.sm.primary', { type: 'button', onclick: () => go(say.to.route, say.to.params || {}) }, t(say.label))
            : null,
          el('button.btn.sm.ghost', { type: 'button', onclick: another }, t('Another word')),
        ),
      ),
      el('button.guide-body', {
        type: 'button',
        title: t('Another word'),
        'aria-label': t('Another word from Silas'),
        onclick: another,
      }, svgNode(silasFigure(118), 'guide-figure')),
    ));
  };
  draw();
}
