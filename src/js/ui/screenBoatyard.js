/**
 * Amos Leary's boatyard, on Gold Creek a little up from the river.
 *
 * The reader asked whether better boats could be bought, and for things
 * worth playing for. A boat is the biggest of them, and it is not only a
 * picture: a bigger one carries more companions to the table and its
 * strongbox adds a share to every pearl the tables pay. So the boatyard is
 * where the purse, the companions and the river meet — pearls buy the boat
 * that earns pearls faster and carries the help the chapters unlock, and the
 * shipwright only sells a boat to somebody who has taken theirs that far.
 *
 * The fittings are here too, and each does one thing at the table on
 * whatever boat you sail: a spare cabin takes one more companion, a heavier
 * strongbox adds a tenth more pearls. Nothing here is only for show — the
 * reader asked for nothing on a shelf that does nothing.
 */

import { el } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { BOATS, FLAGSHIP, SHIPWRIGHT } from '../data/characters.js';
import {
  CATALOGUE, UPGRADES, SHOPS, itemState, itemByKey, currentBoat, ownsBoat, sailBoat,
  crewAboard, crewAshore, toggleCrew, ownsUpgrade, ownedCompanions, boatBerths, boatBonus,
} from '../state/economy.js';
import { sceneBanner, says, svgNode } from './place.js';
import { boatSvg } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import { buyControl, pearls } from './shop.js';
import { boatPerks, crewStrip } from './boats.js';
import * as audio from '../audio/engine.js';

export function renderBoatyard(ctx) {
  const { profile, go } = ctx;
  const redraw = () => go('boatyard', { at: Date.now() });
  const boat = currentBoat(profile);

  // Amos reads the purse the way Delphine does: somebody who cannot afford
  // anything they are allowed to buy is sent to the tables.
  const ready = CATALOGUE.filter((i) => SHOPS.boatyard.includes(i.kind) && itemState(profile, i).ready);
  const cheapest = ready.reduce((min, i) => Math.min(min, i.price), Infinity);
  const nextBoat = BOATS.find((b) => !ownsBoat(profile, b.key));
  const line = ready.length && profile.pearls < cheapest ? SHIPWRIGHT.poor
    : nextBoat && itemState(profile, itemByKey(`boat:${nextBoat.key}`)).missing.length ? SHIPWRIGHT.far
      : SHIPWRIGHT.hello;

  return el('div.screen.boatyard',
    sceneBanner({ id: 'boatyard', landmark: 'boatyard', kicker: t('On Gold Creek, below the diggings'), title: t('The Boatyard'), boat: boat.key }),
    el('div.panel.mentor-card',
      says(SHIPWRIGHT.key, t(line), { name: SHIPWRIGHT.name }),
      el('div.store-purse',
        el('span.store-purse-label', t('Your purse')),
        pearls(profile.pearls, { className: 'big' }),
        el('span.faint', t('Boats are paid for in pearls, never from the bankroll.')),
        el('button.btn.sm.ghost', { onclick: () => go('play') }, icon('cards', { size: 14 }), ' ', t('Play for pearls')),
      ),
    ),

    /* ---- the boat you sail, and who is aboard ---- */
    el('div.panel.page.paper.yard-yours',
      el('div.yard-yours-head',
        svgNode(boatSvg(boat.key, { width: 180 }), 'yard-boat-pic'),
        el('div',
          el('div.page-kicker', t('You are sailing')),
          el('h2.yard-boat-name', t(boat.name)),
          el('div.faint', boatPerks({ berths: boatBerths(profile), bonus: boatBonus(profile) })),
        ),
      ),
      crewPanel(profile, go, redraw),
    ),

    /* ---- boats on the slip ---- */
    el('div.panel.page.paper.shelf.shelf-boat',
      el('div.panel-title', el('h2', t('Boats on the slip'))),
      el('p.muted', t('A bigger boat carries more companions to the table, and its strongbox adds a share to every pearl the tables pay for hands and decisions. Amos only sells a boat to somebody who has taken theirs that far down the river.')),
      el('div.yard-boats', [...BOATS, FLAGSHIP].map((b) => boatCard(b, profile, go, redraw))),
    ),

    /* ---- fittings: each one does something at the table ---- */
    el('div.panel.page.paper.shelf.shelf-upgrade',
      el('div.panel-title', el('h2', t('Fittings'))),
      el('p.muted', t('Each one does one thing at the table, on whatever boat you sail.')),
      el('div.yard-fittings', UPGRADES.map((u) => upgradeRow(u, profile, go, redraw))),
    ),
  );
}

/** Who is aboard, who is waiting at the landing, and the swap between them. */
function crewPanel(profile, go, redraw) {
  const boat = currentBoat(profile);
  const aboard = crewAboard(profile);
  const ashore = crewAshore(profile);
  if (!ownedCompanions(profile).length) {
    return el('div.yard-crew',
      el('div.yard-crew-head', el('strong', t('Aboard')), crewStrip(profile, { size: 40 })),
      el('p.faint', t('No companions yet. The Trading Post sells them, once you have finished the chapter each one helps with.')),
      el('button.btn.sm.ghost', { onclick: () => go('store') }, icon('store', { size: 14 }), ' ', t('The Trading Post')),
    );
  }
  const full = aboard.length >= boatBerths(profile);
  const face = (c) => svgNode(portraitSvg(c.key, { size: 40 }), 'crew-face');
  return el('div.yard-crew',
    el('div.yard-crew-head',
      el('strong', t('Aboard')),
      el('span.faint', t('{n} of {total} berths taken', { n: aboard.length, total: boatBerths(profile) })),
    ),
    el('div.crew-list',
      aboard.map((c) => el('div.crew-row.aboard',
        face(c),
        el('span.crew-name', c.name, el('span.faint', ` · ${t(c.kind)}`)),
        el('button.btn.sm.ghost', { onclick: () => { toggleCrew(profile, c.key); audio.sfx('click'); redraw(); } }, t('Send ashore')),
      )),
    ),
    ashore.length
      ? el('div.crew-ashore',
        el('div.faint', full
          ? t('Waiting at the landing — the boat is full. Bringing one aboard sends the longest-serving ashore, or a bigger boat takes them all.')
          : t('Waiting at the landing.')),
        el('div.crew-list', ashore.map((c) => el('div.crew-row.ashore',
          face(c),
          el('span.crew-name', c.name, el('span.faint', ` · ${t(c.kind)}`)),
          el('button.btn.sm', { onclick: () => { toggleCrew(profile, c.key); audio.sfx('click'); redraw(); } }, full ? t('Swap in') : t('Bring aboard')),
        ))),
      )
      : null,
  );
}

/** One boat on the slip, with what it does. */
function boatCard(b, profile, go, redraw) {
  const sailing = currentBoat(profile).key === b.key;
  const owned = ownsBoat(profile, b.key);
  let action;
  if (sailing) action = el('span.badge.green', icon('check', { size: 13 }), ' ', t('Sailing now'));
  else if (owned) {
    action = el('button.btn.sm', {
      onclick: () => { sailBoat(profile, b.key); audio.sfx('whistle'); redraw(); },
    }, t('Sail her'));
  } else if (b.key === FLAGSHIP.key) {
    action = el('div.buy-locked', el('ul.needs', el('li', icon('lock', { size: 13 }), el('span', t('Beat the Commodore at the delta — nothing else buys her.')))));
  } else {
    action = buyControl(profile, `boat:${b.key}`, { go, onBought: () => { audio.sfx('whistle'); redraw(); }, label: t('Buy her') });
  }
  return el(`div.yard-boat${sailing ? '.sailing' : ''}${owned ? '.owned' : ''}`,
    svgNode(boatSvg(b.key, { width: 132 }), 'yard-boat-art'),
    el('div.yard-boat-text',
      el('div.yard-boat-title', t(b.name)),
      el('div.faint', boatPerks(b)),
      el('div.yard-boat-do', action),
    ),
  );
}

/** One fitting: what it does, and the button — or that it is fitted. */
function upgradeRow(u, profile, go, redraw) {
  const fitted = ownsUpgrade(profile, u.key);
  return el(`div.shelf-row.yard-upgrade${fitted ? '.owned' : ''}`,
    el('span.module-glyph', icon(u.key === 'cabin' ? 'paw' : 'pearl', { size: 18 })),
    el('div.shelf-text',
      el('div.shelf-name', t(u.name)),
      el('div.faint', t(u.does)),
    ),
    el('div.shelf-buy', fitted
      ? el('span.badge.green', icon('check', { size: 13 }), ' ', t('Fitted'))
      : buyControl(profile, `up:${u.key}`, { go, onBought: redraw })),
  );
}
