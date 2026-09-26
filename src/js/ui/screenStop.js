/**
 * A stop on the river: the place, the person who owns its table, and the
 * way to a seat.
 *
 * This is where the teaching sits next to the game. Before you sit down with
 * somebody you are told how they play and what beats it — the same read and
 * counter the drills teach for their style — and pointed at the one lesson
 * that covers it. Then you sit down and find out whether you listened.
 */

import { el, fmt, toast } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { VENUES, venueFor, GRUBSTAKE } from '../data/venues.js';
import { bossFor } from '../data/characters.js';
import { getProfile } from '../engine/bots.js';
import { moduleMeta } from '../data/curriculum.js';
import { LANDMARKS, BOAT_ART } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import { riverState, svgNode } from './screenRiver.js';
import * as audio from '../audio/engine.js';

/** The place itself: sky, the far bank, the water, and the stop drawn big. */
function scene(venue, state, arrived) {
  const here = venue.index === state.here.index;
  // Drawn 600 wide and cropped to the screen: a phone sees the middle, where
  // the stop and your boat are; a wide screen sees the whole reach of river.
  const stars = Array.from({ length: 40 }, (_, i) => {
    const x = (i * 149 + 37) % 600;
    const y = (i * 53 + 11) % 74 + 4;
    return `<circle class="star" cx="${x}" cy="${y}" r="${i % 5 === 0 ? 1.3 : 0.8}"/>`;
  }).join('');
  const trees = Array.from({ length: 16 }, (_, i) => {
    const x = (i * 83 + 12) % 600;
    const y = 104 + ((i * 7) % 6) + (x > 250 && x < 350 ? 40 : 0);
    const r = 4 + (i % 3);
    return y > 120 ? '' : `<circle class="far-tree" cx="${x}" cy="${y}" r="${r}"/>`;
  }).join('');
  const boat = here
    ? `<g class="scene-boat${arrived ? ' arriving' : ''}"><g transform="translate(400 146) scale(1.6)"><g class="bob"><g class="you">${(BOAT_ART[state.boat.key] || BOAT_ART.rowboat)()}</g></g></g></g>`
    : '';
  const art = `<svg class="scene-art" viewBox="0 0 600 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="sky-${venue.key}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sky-top"/><stop offset="1" class="sky-low"/></linearGradient></defs>
    <rect width="600" height="132" fill="url(#sky-${venue.key})"/>
    <g class="stars">${stars}</g>
    <circle class="orb" cx="${venue.index % 2 ? 190 : 430}" cy="42" r="14"/>
    <path class="far-bank" d="M0 116C50 104 90 112 140 106S230 96 280 104S380 112 430 102S530 108 600 104V134H0Z"/>
    ${trees}
    <rect class="scene-water" x="0" y="128" width="600" height="42"/>
    <path class="scene-ripple" d="M40 146q6-4 12 0t12 0M150 158q6-4 12 0t12 0M250 150q6-4 12 0t12 0M470 162q6-4 12 0t12 0M90 164q6-4 12 0t12 0M530 148q6-4 12 0t12 0"/>
    <g class="scene-landmark" transform="translate(292 114) scale(1.7)">${(LANDMARKS[venue.landmark] || LANDMARKS.landing)()}</g>
    ${boat}
  </svg>`;
  return el('div.scene',
    svgNode(art, 'scene-art-wrap'),
    el('div.scene-title',
      el('div.scene-where', t(venue.where)),
      el('h1.sign', t(venue.name)),
      el('span.scene-stake', venue.label),
    ),
  );
}

/**
 * Words appearing a few at a time, the way a character speaks in a game.
 * The whole line is in the page from the start for anything that reads it
 * aloud; only the visible copy is typed. A tap finishes it.
 */
function typed(text) {
  // The whole line is laid out invisibly first, so the bubble is its final
  // size from the start and nothing below it jumps as the words arrive; it is
  // also what a screen reader reads. The typed copy sits over it.
  const shown = el('span.typed-shown', { 'aria-hidden': 'true' });
  const node = el('span.typed', el('span.typed-ghost', text), shown);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { shown.textContent = text; return node; }
  let i = 0;
  const step = () => {
    i = Math.min(text.length, i + 2);
    shown.textContent = text.slice(0, i);
    if (i < text.length && node.isConnected) setTimeout(step, 28);
    else shown.textContent = text;
  };
  node.addEventListener('click', () => { i = text.length; shown.textContent = text; });
  setTimeout(step, 250);
  return node;
}

/** The boss, in their own words. */
function bossBlock(venue, state) {
  const boss = bossFor(venue.boss);
  const style = getProfile(boss.plays);
  const taken = state.beaten.has(venue.index);
  const line = taken ? boss.beaten : boss.hello;
  return el('div.boss',
    el('div.boss-figure',
      svgNode(portraitSvg(boss.key, { size: 132 }), 'boss-portrait'),
      el('div.boss-plate',
        el('div.boss-name.sign', boss.name),
        el('div.boss-title', t(boss.title)),
      ),
    ),
    el('div.boss-talk',
      el('div.bubble.paper', el('p.said', typed(`“${t(line)}”`))),
      el('div.boss-notes',
        el('div.note',
          el('div.note-head', el('span.style-tag', style.tag), t('How {name} plays', { name: boss.short })),
          el('p', t(boss.read)),
        ),
        el('div.note',
          el('div.note-head', icon('target', { size: 15 }), t('How to beat {name}', { name: boss.short })),
          el('p', t(boss.beat)),
        ),
      ),
    ),
  );
}

/** Seat price, stakes, and what your purse can do about them. */
function tableBlock(venue, state, profile, go) {
  const boss = bossFor(venue.boss);
  const here = venue.index === state.here.index;
  const canReach = state.bankroll >= venue.stake.minBankroll;
  const canSit = state.bankroll >= venue.entry;
  const lesson = moduleMeta(boss.lesson);
  const bestIndex = venueFor(profile.career.best).index;

  const facts = el('div.here-facts',
    el('span.fact', el('span.k', t('Stakes')), el('span.v', venue.label)),
    el('span.fact', el('span.k', t('Blinds')), el('span.v', `${fmt.money(venue.stake.bb / 2)} / ${fmt.money(venue.stake.bb)}`)),
    el('span.fact', el('span.k', t('Seat')), el('span.v', fmt.money(venue.entry))),
  );

  const study = lesson
    ? el('button.btn.ghost', { onclick: () => go('learn', { module: boss.lesson }) },
      icon(lesson.icon, { size: 16 }), t('Study first: {module}', { module: t(lesson.name) }))
    : null;

  let action;
  if (here && canSit) {
    action = el('div.stop-actions',
      el('button.btn.primary.plank.lg', {
        onclick: () => {
          audio.sfx('chips');
          profile.setBankroll(state.bankroll, venue.key);
          go('play', { mode: 'grind' });
        },
      }, t('Take a seat — {money}', { money: fmt.money(venue.entry) })),
      study,
    );
  } else if (here) {
    // Broke: the house puts you back in, and it is written down.
    action = el('div.stop-actions',
      el('p.muted', t('A seat at {room} is {money} and you have {have}.',
        { room: t(venue.name), money: fmt.money(venue.entry), have: fmt.money(state.bankroll) })),
      el('button.btn.primary.plank', {
        onclick: () => {
          profile.stakedByTheHouse(GRUBSTAKE);
          toast({
            icon: 'chip',
            title: t('The house stakes you'),
            desc: t('{money} and a seat at the cheapest game. It is counted.', { money: fmt.money(GRUBSTAKE) }),
          });
          go('stop', { at: VENUES[0].key });
        },
      }, t('Take {money} from the house', { money: fmt.money(GRUBSTAKE) })),
      el('button.btn.ghost', { onclick: () => go('train') }, t('Go and study instead')),
    );
  } else if (canReach) {
    const down = venue.index > state.here.index;
    action = el('div.stop-actions',
      el('button.btn.primary.plank.lg', {
        onclick: () => {
          audio.sfx('whistle');
          profile.enterVenue(venue.key, venue.index, bestIndex);
          go('stop', { at: venue.key, arrived: 1 });
        },
      }, down ? t('Steam down to {place}', { place: t(venue.name) }) : t('Head back up to {place}', { place: t(venue.name) })),
      study,
    );
  } else {
    const pct = Math.max(2, Math.min(100, Math.round((state.bankroll / venue.stake.minBankroll) * 100)));
    action = el('div.stop-actions.shut',
      el('div.stop-need',
        icon('lock', { size: 16 }),
        t('This stop takes a purse of {money}. You have {have}.',
          { money: fmt.money(venue.stake.minBankroll), have: fmt.money(state.bankroll) })),
      el('div.bar', el('span', { style: { width: `${pct}%` } })),
      el('p.faint', t('{n} seats\' worth, because a bad night at a table should cost you a night, not the river.',
        { n: Math.round(venue.stake.minBankroll / venue.entry) })),
      study,
    );
  }

  return el('div.panel.table-block',
    el('div.panel-title', el('h3', icon('chip', { size: 16 }), t('The table'))),
    facts,
    action,
  );
}

/** What you took from this table, if you took it. */
function keepsakeBlock(venue, state) {
  if (!state.beaten.has(venue.index)) return null;
  const boss = bossFor(venue.boss);
  return el('div.panel.keepsake-block',
    el('span.keepsake.have.big', icon(`k-${boss.keepsake.key}`, { size: 30 })),
    el('div',
      el('div.here-kicker', t('Taken from {name}', { name: boss.short })),
      el('div.boat-name', t(boss.keepsake.name)),
    ),
  );
}

/** The next stops up and down the river. */
function neighbours(venue, go) {
  const up = VENUES[venue.index - 1];
  const down = VENUES[venue.index + 1];
  return el('div.river-nav',
    up ? el('button.btn.ghost.sm', { onclick: () => go('stop', { at: up.key }) },
      icon('arrowLeft', { size: 14 }), t('Upriver: {place}', { place: t(up.name) })) : el('span'),
    el('button.btn.ghost.sm', { onclick: () => go('home') }, icon('river', { size: 14 }), t('The map')),
    down ? el('button.btn.ghost.sm', { onclick: () => go('stop', { at: down.key }) },
      t('Downriver: {place}', { place: t(down.name) }), icon('arrowRight', { size: 14 })) : el('span'),
  );
}

export function renderStop(ctx, params = {}) {
  const { profile, go } = ctx;
  const venue = venueFor(params.at || profile.career.venue);
  const state = riverState(profile);
  const arrived = params.arrived === '1' && venue.index === state.here.index;

  if (arrived) {
    // The whistle blew as you cast off; the bell is you tying up.
    setTimeout(() => audio.sfx('bell'), 1400);
  }

  return el('div.screen.stop-screen',
    scene(venue, state, arrived),
    bossBlock(venue, state),
    el('div.stop-grid',
      tableBlock(venue, state, profile, go),
      keepsakeBlock(venue, state),
    ),
    neighbours(venue, go),
  );
}
