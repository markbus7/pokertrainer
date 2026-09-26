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
import { sceneSvg } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import { riverState } from './screenRiver.js';
import { svgNode, typedText } from './place.js';
import * as audio from '../audio/engine.js';

/** The place itself: sky, the far bank, the water, and the stop drawn big. */
function scene(venue, state, arrived) {
  const here = venue.index === state.here.index;
  const art = sceneSvg({
    id: venue.key,
    landmark: venue.landmark,
    orbLeft: venue.index % 2 === 1,
    boat: here ? state.boat.key : null,
    arriving: arrived,
  });
  return el('div.scene',
    svgNode(art, 'scene-art-wrap'),
    el('div.scene-title',
      el('div.scene-where', t(venue.where)),
      el('h1.sign', t(venue.name)),
      el('span.scene-stake', venue.label),
    ),
  );
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * What the boss says when you walk up: hello, or — coming back from their
 * table — something about how it went. Up on the night, they are sore about
 * it; down, they let you know.
 */
function lineFor(boss, taken, after) {
  if (after === 'took') return boss.beaten;
  if (after === 'up') return pick(boss.sore);
  if (after === 'down') return pick(boss.brag);
  return taken ? boss.beaten : boss.hello;
}

/** The boss, in their own words. */
function bossBlock(venue, state, after) {
  const boss = bossFor(venue.boss);
  const style = getProfile(boss.plays);
  const taken = state.beaten.has(venue.index);
  const line = lineFor(boss, taken, after);
  return el('div.boss',
    el('div.boss-figure',
      svgNode(portraitSvg(boss.key, { size: 132 }), 'boss-portrait'),
      el('div.boss-plate',
        el('div.boss-name.sign', boss.name),
        el('div.boss-title', t(boss.title)),
      ),
    ),
    el('div.boss-talk',
      el('div.bubble.paper', el('p.said', typedText(`“${t(line)}”`))),
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
          const from = state.here.index;
          profile.enterVenue(venue.key);
          // The trip itself happens on the map: the boat steams down (or
          // back up) the river from here to there, then ties up.
          go('home', { sail: `${from}-${venue.index}` });
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

/**
 * The moment a table is taken: the boss's last word, and what they hand
 * over. Shown once, on the way back from the table, with the brass.
 */
function tookIt(venue, close) {
  const boss = bossFor(venue.boss);
  return el('div.took-scrim', { onclick: close },
    el('div.took.paper', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': t('You took {room}', { room: t(venue.name) }),
      onclick: (e) => e.stopPropagation(),
    },
      el('div.took-kicker', t('You took the table at')),
      el('h2.sign', t(venue.name)),
      svgNode(portraitSvg(boss.key, { size: 112 }), 'took-portrait'),
      el('p.said', `“${t(boss.beaten)}”`),
      el('div.took-keepsake',
        el('span.keepsake.have.big', icon(`k-${boss.keepsake.key}`, { size: 34 })),
        el('div.boat-name', t(boss.keepsake.name)),
      ),
      el('button.btn.primary.plank', { onclick: close }, t('Hang it in the boat')),
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
  const after = ['took', 'up', 'down', 'even'].includes(params.after) ? params.after : null;

  if (arrived) {
    // The whistle blew as you cast off; the bell is you tying up.
    setTimeout(() => audio.sfx('bell'), 1400);
  }

  const screen = el('div.screen.stop-screen',
    scene(venue, state, arrived),
    bossBlock(venue, state, after),
    el('div.stop-grid',
      tableBlock(venue, state, profile, go),
      keepsakeBlock(venue, state),
    ),
    neighbours(venue, go),
  );

  if (after === 'took') {
    // Hung off the page rather than the screen, so nothing the screen is
    // doing (its entrance animation makes a stacking context) can put the
    // dock or the rail above it.
    const close = () => {
      overlay.remove();
      // Once is the celebration; a reload should not throw it again.
      history.replaceState(null, '', `#stop?at=${venue.key}`);
    };
    const overlay = tookIt(venue, close);
    document.body.appendChild(overlay);
    ctx.onLeave = () => overlay.remove();
    setTimeout(() => audio.sfx('fanfare'), 300);
  }
  return screen;
}
