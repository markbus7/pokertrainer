/**
 * The Long River: the front door.
 *
 * The career was a list of rooms in a building; this is the same climb
 * drawn as a place. Eight stops down a river, each a stake with somebody who
 * owns its table, from a crate on a mud landing to the Commodore's flagship
 * at the delta. Your boat is at the stop you are playing, the ones your
 * purse opens are lit, and the ones you have taken keep a keepsake of the
 * person you took them from.
 *
 * Money is still the only thing that moves you down it — the climb poker
 * actually makes you make — and every stop still says its NL label, because
 * the point of all this is to play the real stakes, not to learn a story.
 */

import { el, fmt } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { VENUES, venueFor, roomYouCanAfford } from '../data/venues.js';
import { bossFor, boatFor } from '../data/characters.js';
import { nextUp, moduleMeta } from '../data/curriculum.js';
import { MAP, mapSvg, stopPoint, boatSvg } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import * as audio from '../audio/engine.js';

/** Build a node from a trusted SVG string drawn by riverArt/portraits. */
export function svgNode(markup, className = '') {
  const wrap = el(`span${className ? `.${className}` : ''}`);
  wrap.innerHTML = markup;
  return wrap;
}

/** Everything the map and the side panel need to know about where you are. */
export function riverState(profile) {
  const career = profile.career;
  const bankroll = profile.data.bankroll;
  const here = venueFor(career.venue);
  const best = venueFor(career.best);
  const beatenKeys = new Set(career.beaten);
  const wonRiver = beatenKeys.has('nl500');
  return {
    bankroll,
    here,
    best: Math.max(best.index, here.index),
    open: roomYouCanAfford(bankroll).index,
    beaten: new Set(VENUES.filter((v) => beatenKeys.has(v.key)).map((v) => v.index)),
    beatenKeys,
    boat: boatFor(Math.max(best.index, here.index), wonRiver),
    wonRiver,
  };
}

/** What a stop's name plate says under it. */
export function stopStatus(venue, state) {
  if (venue.index === state.here.index) return { key: 'here', text: t('You are here') };
  if (state.bankroll >= venue.stake.minBankroll) {
    return state.beaten.has(venue.index)
      ? { key: 'beaten', text: t('Taken') }
      : { key: 'open', text: t('Open') };
  }
  return { key: 'shut', text: t('Needs {money}', { money: fmt.money(venue.stake.minBankroll) }) };
}

function stopPlate(venue, state, go) {
  const p = stopPoint(venue.index);
  const status = stopStatus(venue, state);
  const boss = bossFor(venue.boss);
  const never = venue.index > state.best && status.key === 'shut';
  return el(`button.map-stop.is-${status.key}${never ? '.far' : ''}${state.beaten.has(venue.index) ? '.taken' : ''}`, {
    dataset: { key: venue.key },
    style: { left: `${(p.x / MAP.W) * 100}%`, top: `${((p.y + 30) / MAP.H) * 100}%` },
    onclick: () => { audio.sfx('click'); go('stop', { at: venue.key }); },
    'aria-label': `${t(venue.name)}, ${venue.label}: ${status.text}`,
  },
    el('span.map-name', t(venue.name)),
    el('span.map-meta',
      el('span.map-stake', venue.label),
      state.beaten.has(venue.index) ? icon(`k-${boss.keepsake.key}`, { size: 14, className: 'map-keepsake' }) : null,
      el('span.map-status', status.text),
    ),
  );
}

function riverMap(state, go) {
  const chart = el('div.river-map', {
    style: { aspectRatio: `${MAP.W} / ${MAP.H}` },
  });
  chart.innerHTML = mapSvg({
    here: state.here.index,
    best: state.best,
    open: state.open,
    beaten: state.beaten,
    boat: state.boat.key,
    landmarks: VENUES.map((v) => v.landmark),
  });
  // The drawings answer taps as well as their name plates do.
  chart.querySelectorAll('.landmark').forEach((g) => {
    g.addEventListener('click', () => {
      const v = VENUES[Number(g.dataset.index)];
      audio.sfx('click');
      go('stop', { at: v.key });
    });
  });
  for (const v of VENUES) chart.appendChild(stopPlate(v, state, go));
  return chart;
}

/** Where you are, who owns the table, and the way to it. */
function hereCard(state, profile, go) {
  const { here } = state;
  const boss = bossFor(here.boss);
  const canSit = state.bankroll >= here.entry;
  return el('div.panel.here-card',
    el('div.here-kicker', t('You are moored at')),
    el('h1.sign.here-name', t(here.name)),
    el('div.here-where', t(here.where)),
    el('div.here-facts',
      el('span.fact', el('span.k', t('Stakes')), el('span.v', here.label)),
      el('span.fact', el('span.k', t('Blinds')), el('span.v', `${fmt.money(here.stake.bb / 2)} / ${fmt.money(here.stake.bb)}`)),
      el('span.fact', el('span.k', t('Seat')), el('span.v', fmt.money(here.entry))),
    ),
    el('div.here-boss',
      svgNode(portraitSvg(boss.key, { size: 64 }), 'here-portrait'),
      el('div.here-boss-text',
        el('div.here-boss-name', boss.name, el('span.here-boss-title', ` · ${t(boss.title)}`)),
        el('p.said', `“${t(boss.hello)}”`),
      ),
    ),
    el('div.here-actions',
      el('button.btn.primary.plank', {
        disabled: !canSit,
        onclick: () => { profile.setBankroll(state.bankroll, here.key); go('play', { mode: 'grind' }); },
      }, t('Take a seat — {money}', { money: fmt.money(here.entry) })),
      el('button.btn.ghost', { onclick: () => go('stop', { at: here.key }) }, t('Go ashore')),
    ),
  );
}

/** The boat you have, and the keepsakes on its shelf. */
function boatCard(state) {
  const got = VENUES.filter((v) => state.beaten.has(v.index)).length;
  return el('div.panel.boat-card',
    el('div.boat-head',
      svgNode(boatSvg(state.boat.key, { width: 112 }), 'boat-pic'),
      el('div',
        el('div.here-kicker', t('Your boat')),
        el('div.boat-name', t(state.boat.name)),
        el('div.faint', t('{n} of {total} keepsakes', { n: got, total: VENUES.length })),
      ),
    ),
    el('div.keepsakes', VENUES.map((v) => {
      const boss = bossFor(v.boss);
      const have = state.beaten.has(v.index);
      return el(`span.keepsake${have ? '.have' : ''}`, {
        title: have ? t(boss.keepsake.name) : t('Take {place} from {name}', { place: t(v.name), name: boss.short }),
      }, icon(`k-${boss.keepsake.key}`, { size: 20 }));
    })),
  );
}

/** One line to the lesson that would most help the next session. */
function studyLine(profile, go) {
  const plan = nextUp(profile);
  if (!plan) return null;
  const meta = moduleMeta(plan.module.id);
  return el('button.study-line', { onclick: () => go('learn', { module: plan.module.id }) },
    icon(meta.icon, { size: 16 }),
    el('span', t('Between sessions: {module}', { module: t(plan.module.name) })),
    icon('arrowRight', { size: 14, className: 'door-arrow' }),
  );
}

/** The first time the app is opened: where you are and what the game is. */
function prologue(state, profile, rerender) {
  return el('div.prologue.paper',
    el('div.prologue-year.sign', '1890'),
    el('p.said', t('The Long River runs from Mud Landing down to the delta. At every stop there is a card table, and somebody who owns it. At the end sits the Commodore, who owns most of the rest.')),
    el('p.said', t('You have {money} and a borrowed rowboat. Every seat is paid out of that purse, and a stop further down will only have you once the purse can stand its stakes.', { money: fmt.money(state.bankroll) })),
    el('p.said', t('Beat the one who owns a table and they give you something to remember them by. Lose the purse and the house stakes you back in — and writes it down.')),
    el('button.btn.primary.plank', {
      onclick: () => {
        profile.data.seenPrologue = true;
        profile.save();
        audio.sfx('whistle');
        rerender();
      },
    }, t('Cast off')),
  );
}

export function renderRiver(ctx) {
  const { profile, go } = ctx;
  const state = riverState(profile);
  const screen = el('div.screen.river-screen');
  const rerender = () => go('home');

  const map = riverMap(state, go);
  if (!profile.data.seenPrologue) screen.append(prologue(state, profile, rerender));
  screen.append(
    el('div.river-layout',
      el('div.river-side',
        hereCard(state, profile, go),
        boatCard(state),
        studyLine(profile, go),
      ),
      el('div.river-chart',
        el('div.cartouche',
          el('h2.sign', t('The Long River')),
          el('div.cartouche-sub', t('Eight tables from Mud Landing to the delta')),
        ),
        map,
      ),
    ),
  );
  // Bring your own stop into view once the page has laid out, the way a map
  // opens on where you are rather than on the top-left corner.
  requestAnimationFrame(() => {
    const plate = map.querySelector('.map-stop.is-here');
    if (plate && state.here.index > 1 && typeof plate.scrollIntoView === 'function') {
      plate.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
    }
  });
  return screen;
}
