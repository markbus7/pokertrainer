/**
 * A town off the river: Placer Gulch, Cypress Bayou, Bethel.
 *
 * The same shape as a stop, smaller: the place, the one who keeps its game,
 * how they play and how to beat it, the table, and the town's three things
 * to do. What is different is the table — the whole town plays one way, so
 * the lesson is the only lesson there — and that nobody owns it: there is no
 * duel and no room to buy, only the town's list, and what the town gives you
 * when the list is done.
 *
 * A town you have not heard of is uncharted: the page says who to ask.
 */

import { el, fmt } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { backwaterFor } from '../data/backwaters.js';
import { getProfile } from '../engine/bots.js';
import { sceneSvg } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import { svgNode, typedText } from './place.js';
import { riverState } from './screenRiver.js';
import { lobbyFace, payInPearls, notesCard } from './screenStop.js';
import { pearls } from './shop.js';
import { reportsOf } from '../state/sessionReport.js';
import {
  heard, canGo, townTable, townGoals, townDone, junctionOf,
} from '../state/backwaters.js';
import * as audio from '../audio/engine.js';

/** The town drawn big: the sky, the far bank and the landmark, with the boat if it is tied up here. */
function scene(town, { here, arrived, junction, boat }) {
  const art = sceneSvg({
    id: `town-${town.key}`,
    landmark: town.landmark,
    orbLeft: town.key === 'bayou',
    boat: here && town.way === 'water' ? boat : null,
    arriving: arrived,
  });
  return el('div.scene',
    svgNode(art, 'scene-art-wrap'),
    el('div.scene-title',
      el('div.scene-where', t(town.where)),
      el('h1.sign', t(town.name)),
      el('span.scene-stake', junction.label),
    ),
  );
}

/** Who keeps the game, in their own words, and the read on them. */
function localBlock(town, done) {
  const style = getProfile(town.local.plays);
  return el('div.boss',
    el('div.boss-figure',
      svgNode(portraitSvg(town.local.key, { size: 132 }), 'boss-portrait'),
      el('div.boss-plate',
        el('div.boss-name.sign', town.local.name),
        el('div.boss-title', t(town.local.title)),
      ),
    ),
    el('div.boss-talk',
      el('div.bubble.paper', el('p.said', typedText(`“${t(done ? town.beaten : town.hello)}”`))),
      el('div.boss-notes',
        el('div.note',
          el('div.note-head', el('span.style-tag', style.tag), t('How {name} plays', { name: town.local.short })),
          el('p', t(town.read)),
        ),
        el('div.note',
          el('div.note-head', icon('target', { size: 15 }), t('How to beat {name}', { name: town.local.short })),
          el('p', t(town.beat)),
        ),
      ),
    ),
  );
}

/** The town's one table: who is at it, the lobby's three numbers, and the way to a seat. */
function tableBlock(town, { here, state, profile, go }) {
  const junction = junctionOf(town);
  const table = townTable(town);
  const faces = table.styles.map((key, i) => (i === table.local.seat
    ? lobbyFace(town.local.short, town.local.key, { owner: true })
    : lobbyFace(table.names[i] || getProfile(key).name, key)));

  let action;
  if (here) {
    action = el('div.lobby-pay',
      el('button.btn.primary.plank', {
        disabled: state.bankroll < junction.entry,
        onclick: () => {
          audio.sfx('chips');
          profile.setBankroll(state.bankroll, junction.key);
          go('play', { mode: 'grind', table: table.id });
        },
      }, t('Take a seat — {money}', { money: fmt.money(junction.entry) })),
      payInPearls(profile, junction, () => {
        profile.setBankroll(state.bankroll, junction.key);
        go('play', { mode: 'grind', table: table.id, pay: 'pearls' });
      }),
    );
  } else if (canGo(profile, town)) {
    action = el('div.stop-actions',
      el('button.btn.primary.plank.lg', {
        onclick: () => {
          audio.sfx(town.way === 'water' ? 'whistle' : 'click');
          profile.enterTown(town.key, junction.key);
          go('town', { at: town.key, arrived: 1 });
        },
      }, town.way === 'water'
        ? t('Sail up to {place}', { place: t(town.name) })
        : t('Take the wagon road to {place}', { place: t(town.name) })),
    );
  } else {
    action = el('div.stop-actions.shut',
      el('div.stop-need', icon('lock', { size: 16 }),
        t('The way to {place} is from {stop}, and a seat there takes a purse of {money}. You have {have}.', {
          place: t(town.name), stop: t(junction.name), money: fmt.money(junction.stake.minBankroll), have: fmt.money(state.bankroll),
        })),
    );
  }

  return el('div.panel.table-block.town-table',
    el('div.panel-title', el('h3', icon('chip', { size: 16 }), t('The table'))),
    el('div.here-facts',
      el('span.fact', el('span.k', t('Stakes')), el('span.v', junction.label)),
      el('span.fact', el('span.k', t('Blinds')), el('span.v', `${fmt.money(junction.stake.bb / 2)} / ${fmt.money(junction.stake.bb)}`)),
      el('span.fact', el('span.k', t('Seat')), el('span.v', fmt.money(junction.entry))),
    ),
    el('p.muted', t(town.colour)),
    el('div.lobby-faces', faces),
    el('div.lobby-stats',
      el('span.lobby-stat', el('span.k', t('See the flop')), el('span.v', `${table.stats.flop}%`)),
      el('span.lobby-stat', el('span.k', t('Raised pots')), el('span.v', `${table.stats.raised}%`)),
      el('span.lobby-stat', el('span.k', t('Average pot')), el('span.v', t('{n} bb', { n: table.stats.pot }))),
    ),
    action,
  );
}

/** The town's three things to do, what each pays, and what the town gives when they are done. */
function listBlock(town, profile) {
  const goals = townGoals(profile, town);
  const done = townDone(profile, town);
  return el('div.panel.page.paper.road-panel.town-list',
    el('div.panel-title', el('h3', icon('river', { size: 16 }), t('What to do in {place}', { place: t(town.name) }))),
    el('div.faint.road-sub', done
      ? t('All three done.')
      : t('{done} of 3 done. None of it is on the road: it is here for what it teaches.', { done: goals.filter((g) => g.done).length })),
    el('div.road-list', el('ul.road-goals',
      goals.map((g) => el(`li.road-goal${g.done ? '.done' : ''}`,
        el('span.road-mark', { 'aria-hidden': 'true' }, g.done ? icon('check', { size: 15 }) : null),
        el('div.road-goal-body',
          el('div.road-goal-text', t(g.text, { ...g.params, town: t(town.name) }), g.done ? el('span.visually-hidden', ` — ${t('done')}`) : null),
          !g.done
            ? el('div.road-progress',
              el('div.road-bar', el('span', { style: { width: `${Math.max(3, Math.round((g.have / g.need) * 100))}%` } })),
              el('span.road-count', g.id === 'sound'
                ? t('{have}% of {need}%', { have: g.have, need: g.need })
                : t('{have} of {need}', { have: g.have, need: g.need })))
            : null,
        ),
        el('span.town-pays', g.paid ? el('span.faint', t('Paid')) : pearls(g.pearls)),
      )),
    )),
    el(`div.town-trophy${done ? '.have' : ''}`,
      el('span.keepsake.big' + (done ? '.have' : ''), icon(`k-${town.trophy.key}`, { size: 28 })),
      el('div',
        el('div.here-kicker', done ? t('Given to you in {place}', { place: t(town.name) }) : t('Do all three, and {name} gives you', { name: town.local.short })),
        el('div.boat-name', t(town.trophy.name)),
      ),
    ),
  );
}

/** The ways out: back down to the stop the town leaves the river from, and the chart. */
function nav(town, here, go) {
  const junction = junctionOf(town);
  return el('div.river-nav',
    el('button.btn.ghost.sm', { onclick: () => go('stop', { at: junction.key }) },
      icon('arrowLeft', { size: 14 }), here ? t('Back down to {place}', { place: t(junction.name) }) : t('To {place}', { place: t(junction.name) })),
    el('button.btn.ghost.sm', { onclick: () => go('home') }, icon('river', { size: 14 }), t('The map')),
    el('span'),
  );
}

/** The moment the list is done: the local's last word and what they hand over. Shown once. */
function finishedCard(town) {
  return el('div.panel.paper.story-card.town-finished',
    el('div.story-kicker', icon('star', { size: 14 }), t('{place} is done', { place: t(town.name) })),
    el('div.town-trophy.have',
      el('span.keepsake.big.have', icon(`k-${town.trophy.key}`, { size: 34 })),
      el('div',
        el('p.said', `“${t(town.beaten)}”`),
        el('div.boat-name', t(town.trophy.name)),
      ),
    ),
  );
}

export function renderTown(ctx, params = {}) {
  const { profile, go } = ctx;
  const town = backwaterFor(params.at);
  if (!town) {
    return el('div.screen', el('div.panel',
      el('h1', t('Not on any chart')),
      el('button.btn.primary', { onclick: () => go('home') }, t('The map')),
    ));
  }
  const junction = junctionOf(town);
  if (!heard(profile, town.key)) {
    return el('div.screen.stop-screen.town-screen',
      el('div.panel.uncharted-panel',
        el('div.here-kicker', t('Uncharted')),
        el('h1.sign', '?'),
        el('p.muted', t('Nobody has put a name to what is up there. Somebody at {place} knows.', { place: t(junction.name) })),
        el('div.row',
          el('button.btn.primary', { onclick: () => go('stop', { at: junction.key }) }, t('To {place}', { place: t(junction.name) })),
          el('button.btn.ghost', { onclick: () => go('home') }, t('The map')),
        ),
      ),
    );
  }

  const state = riverState(profile);
  const here = Boolean(state.town && state.town.key === town.key);
  const arrived = params.arrived === '1' && here;
  if (arrived) setTimeout(() => audio.sfx('bell'), 900);

  // The first time you get there, what the place is like. Told once.
  const arrivalKey = `arrive-town-${town.key}`;
  const showArrival = here && !profile.seenScene(arrivalKey);
  if (showArrival) profile.markScene(arrivalKey);

  const reports = reportsOf(profile);
  const notesIndex = params.notes != null && reports[Number(params.notes)] ? Number(params.notes) : null;
  const finished = params.after === 'done';
  if (finished) history.replaceState(null, '', `#town?at=${town.key}`);

  return el('div.screen.stop-screen.town-screen',
    scene(town, { here, arrived, junction, boat: state.boat.key }),
    finished ? finishedCard(town) : null,
    showArrival
      ? el('div.panel.paper.story-card',
        el('div.story-kicker', icon('anchor', { size: 14 }), t('Off the river, {place}', { place: t(town.name) })),
        el('p.story-text', typedText(t(town.arrival))))
      : null,
    localBlock(town, townDone(profile, town)),
    notesIndex !== null ? notesCard(reports[notesIndex], notesIndex, go) : null,
    tableBlock(town, { here, state, profile, go }),
    listBlock(town, profile),
    nav(town, here, go),
  );
}
