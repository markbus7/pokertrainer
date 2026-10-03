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
 *
 * Since 3.1 it is the whole country, not one strip of it: the school, the
 * pilot house, the saloon, the assay office, the racing chute and the
 * Trading Post stand on the creeks and bends around the main river, each a
 * sign that says what is waiting there and takes you in.
 */

import { el, fmt } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { VENUES, venueFor, roomYouCanAfford } from '../data/venues.js';
import { bossFor } from '../data/characters.js';
import { nextUp, moduleMeta, MODULE_META } from '../data/curriculum.js';
import { boatSvg } from './riverArt.js';
import { WORLD, stopAt, PLACES, worldSvg, voyage } from './worldMap.js';
import { portraitSvg } from './portraits.js';
import { svgNode } from './place.js';
import {
  ownedModules, ownsLesson, ownsChart, somethingToBuy, currentBoat, boatBerths, boatBonus,
} from '../state/economy.js';
import { CHECKPOINTS } from '../data/rangeLadder.js';
import { pearls } from './shop.js';
import { boatPerks, crewStrip } from './boats.js';
import * as audio from '../audio/engine.js';
import { bookProgress } from '../data/fish.js';

export { svgNode };

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
    boat: currentBoat(profile),
    // What the boat carries and pays with its fittings, not just its hull.
    berths: boatBerths(profile),
    bonus: boatBonus(profile),
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
  const p = stopAt(venue.index);
  const status = stopStatus(venue, state);
  const boss = bossFor(venue.boss);
  const never = venue.index > state.best && status.key === 'shut';
  // North-bank plates hang above their drawing and south-bank ones below,
  // so a plate never lies across the river it belongs to.
  const north = p.side < 0;
  return el(`button.map-stop.is-${status.key}${never ? '.far' : ''}${state.beaten.has(venue.index) ? '.taken' : ''}${north ? '.north' : ''}`, {
    dataset: { key: venue.key },
    style: { left: `${(p.x / WORLD.W) * 100}%`, top: `${((north ? p.y - 40 : p.y + 24) / WORLD.H) * 100}%` },
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

/** What each place off the main river says on its plate. */
function placeStatus(place, profile) {
  switch (place.key) {
    case 'school': return t('{n} of {total} chapters yours', { n: ownedModules(profile).length, total: MODULE_META.length });
    case 'pilothouse': {
      const charts = CHECKPOINTS.filter((c) => c.kind !== 'exam');
      return t('{n} of {total} charts yours', { n: charts.filter((c) => ownsChart(profile, c.key)).length, total: charts.length });
    }
    case 'assay': return ownsLesson(profile, 'pot-odds') ? t('The counter is open') : t('Needs the Pot Odds chapter');
    case 'race': return t('Beat the Belle for pearls');
    case 'tradingpost': return null;
    case 'saloon': return t('Free play, pearls a hand');
    case 'boatyard': return t('Boats and fittings');
    case 'tackle': {
      const p = bookProgress(profile.catchBook);
      return t('{n} of {total} fish caught', { n: p.caught, total: p.total });
    }
    default: return null;
  }
}

function placePlate(place, profile, go) {
  const status = placeStatus(place, profile);
  const canBuy = (place.key === 'tradingpost' || place.key === 'boatyard') && somethingToBuy(profile, place.key);
  return el(`button.map-place.place-${place.key}${canBuy ? '.can-buy' : ''}`, {
    style: { left: `${(place.x / WORLD.W) * 100}%`, top: `${((place.y + 26) / WORLD.H) * 100}%` },
    onclick: () => { audio.sfx('click'); go(place.route); },
    'aria-label': `${t(place.name)} — ${t(place.label)}`,
  },
    el('span.map-place-name', t(place.name)),
    place.key === 'tradingpost'
      ? el('span.map-place-meta', pearls(profile.pearls), canBuy ? el('span.place-new', t('Something to buy')) : null)
      : el('span.map-place-meta', canBuy ? el('span.place-new', t('Something to buy')) : status),
  );
}

function riverMap(state, profile, go) {
  const chart = el('div.river-map.world', {
    style: { aspectRatio: `${WORLD.W} / ${WORLD.H}` },
  });
  chart.innerHTML = worldSvg({
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
  chart.querySelectorAll('.place').forEach((g) => {
    g.addEventListener('click', () => {
      const place = PLACES.find((x) => x.key === g.dataset.place);
      audio.sfx('click');
      if (place) go(place.route);
    });
  });
  for (const v of VENUES) chart.appendChild(stopPlate(v, state, go));
  for (const place of PLACES) chart.appendChild(placePlate(place, profile, go));
  // On a narrow screen the chart is wider than the page and scrolls sideways,
  // the way a map is dragged; on a wide one the scroller simply fits.
  return el('div.map-scroller', chart);
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

/** The boat you have, who is aboard, and the keepsakes on its shelf. */
function boatCard(state, profile, go) {
  const got = VENUES.filter((v) => state.beaten.has(v.index)).length;
  return el('div.panel.boat-card',
    el('div.boat-head',
      svgNode(boatSvg(state.boat.key, { width: 112 }), 'boat-pic'),
      el('div',
        el('div.here-kicker', t('Your boat')),
        el('div.boat-name', t(state.boat.name)),
        el('div.faint.boat-perks', boatPerks({ berths: state.berths, bonus: state.bonus })),
      ),
    ),
    el('div.boat-crew',
      el('span.boat-crew-label', t('Aboard')),
      crewStrip(profile, { size: 34 }),
      el('button.btn.sm.ghost.boat-yard-link', { onclick: () => go('boatyard') }, icon('anchor', { size: 14 }), ' ', t('To the boatyard')),
    ),
    el('div.faint.keepsake-count', t('{n} of {total} keepsakes', { n: got, total: VENUES.length })),
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
    el('p.said', t('The tables pay in pearls, too: one for every hand, one more for every hand played well. Pearls buy your lessons, your charts and your companions at the Trading Post — so the first thing to do is play.')),
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

/**
 * The boat, steaming from one stop to another down the middle of the river,
 * with the page following it. Then it ties up at the stop.
 */
function sail(scroller, fromIndex, toIndex, onArrive) {
  const boat = scroller.querySelector('.your-boat');
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!boat || still || fromIndex === toIndex) return onArrive();
  const path = voyage(fromIndex, toIndex);
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  const total = lengths[lengths.length - 1] || 1;
  const at = (d) => {
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < d) i++;
    const span = lengths[i] - lengths[i - 1] || 1;
    const k = (d - lengths[i - 1]) / span;
    return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k];
  };
  const duration = Math.min(4200, 1400 + Math.abs(toIndex - fromIndex) * 750);
  const start = performance.now();
  boat.classList.add('sailing');
  // Put it where it is leaving from before anything is painted.
  boat.setAttribute('transform', `translate(${path[0][0].toFixed(1)} ${path[0][1].toFixed(1)})`);
  const frame = (now) => {
    if (!boat.isConnected) return;
    const k = Math.min(1, (now - start) / duration);
    const eased = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
    const [x, y] = at(eased * total);
    boat.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    // Keep the boat in view, easing after it rather than snapping — across
    // the chart when it is wider than the screen, and down the page.
    const r = boat.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    const offX = r.left + r.width / 2 - (box.left + box.width / 2);
    if (Math.abs(offX) > 40) scroller.scrollLeft += offX * 0.12;
    const off = r.top + r.height / 2 - window.innerHeight / 2;
    if (Math.abs(off) > 60) window.scrollTo(0, window.scrollY + off * 0.08);
    if (k < 1) requestAnimationFrame(frame);
    else setTimeout(onArrive, 250);
  };
  requestAnimationFrame(frame);
  return null;
}

/** Scroll the chart sideways so a stop sits in the middle of the view. */
function centreOn(scroller, index) {
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  const p = stopAt(index);
  scroller.scrollLeft = (p.x / WORLD.W) * scroller.scrollWidth - scroller.clientWidth / 2;
}

export function renderRiver(ctx) {
  const { profile, go } = ctx;
  const state = riverState(profile);
  const screen = el('div.screen.river-screen');
  const rerender = () => go('home');

  const map = riverMap(state, profile, go);
  if (!profile.data.seenPrologue) screen.append(prologue(state, profile, rerender));
  screen.append(
    el('div.river-layout.world-layout',
      el('div.river-chart',
        el('div.cartouche',
          el('h2.sign', t('The Long River')),
          el('div.cartouche-sub', t('Eight tables from Mud Landing to the delta, and everything on the water between')),
        ),
        map,
      ),
      el('div.river-below',
        hereCard(state, profile, go),
        el('div.river-side',
          boatCard(state, profile, go),
          studyLine(profile, go),
        ),
      ),
    ),
  );
  // A trip in progress: the stop screen sent us here to watch the boat go.
  const trip = /^(\d+)-(\d+)$/.exec(ctx.params.sail || '');
  if (trip) {
    const from = Number(trip[1]);
    const to = Number(trip[2]);
    // The trip is taken once; the back button should not replay it.
    history.replaceState(null, '', '#home');
    requestAnimationFrame(() => {
      centreOn(map, from);
      sail(map, from, to, () => go('stop', { at: VENUES[to].key, arrived: 1 }));
    });
    return screen;
  }

  // Open the chart on where you are rather than on its west edge — which on
  // a phone, where the chart scrolls sideways, is the difference between
  // seeing your boat and not.
  requestAnimationFrame(() => centreOn(map, state.here.index));
  return screen;
}
