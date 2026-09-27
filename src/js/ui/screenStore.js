/**
 * Delphine's Trading Post: where pearls are spent.
 *
 * Every shelf in the game is here in one place — the chapters, the charts for
 * the pilot house, and the companions — each with its price and, when it
 * cannot be bought yet, exactly what stands in the way. The school and the
 * pilot house sell their own things too, through the same control, so a
 * price is never different depending on where you read it.
 */

import { el, fmt } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { MODULE_META, moduleMeta } from '../data/curriculum.js';
import { CHECKPOINTS } from '../data/rangeLadder.js';
import { TRADER } from '../data/characters.js';
import { CATALOGUE, COMPANIONS, SHOPS, itemState, crewAboard } from '../state/economy.js';
import { sceneBanner, says, svgNode } from './place.js';
import { portraitSvg } from './portraits.js';
import { buyControl, pearls, itemName } from './shop.js';

const SECTIONS = [
  { kind: 'pet', title: 'Companions', blurb: 'They sit at the table with you and help when you ask. Each one needs its chapter finished first — they do the work for somebody who knows how it is done.' },
  { kind: 'lesson', title: 'Chapters', blurb: 'The course, one chapter at a time. Your rank decides which ones are on the shelf; pearls decide which ones are yours.' },
  { kind: 'chart', title: 'Charts for the pilot house', blurb: 'One reach of the river each: a range to learn by daylight, at dusk and at night.' },
];

export function renderStore(ctx) {
  const { profile, go } = ctx;
  const redraw = () => go('store', { at: Date.now() });

  // Delphine's greeting reads the purse: a customer who cannot afford the
  // cheapest thing they are allowed to buy is told where pearls come from.
  const ready = CATALOGUE.filter((i) => SHOPS.tradingpost.includes(i.kind) && itemState(profile, i).ready);
  const cheapest = ready.reduce((min, i) => Math.min(min, i.price), Infinity);
  const line = ready.length && profile.pearls < cheapest ? TRADER.poor : TRADER.hello;

  return el('div.screen.store',
    sceneBanner({ id: 'store', landmark: 'tradingpost', kicker: t('Where the two rivers meet'), title: t('The Trading Post') }),
    el('div.panel.mentor-card',
      says(TRADER.key, t(line), { name: TRADER.name }),
      el('div.store-purse',
        el('span.store-purse-label', t('Your purse')),
        pearls(profile.pearls, { className: 'big' }),
        el('span.faint', t('{n} earned at the tables so far', { n: fmt.chips(profile.economy.earned) })),
        el('button.btn.sm.ghost', { onclick: () => go('play') }, icon('cards', { size: 14 }), ' ', t('Play for pearls')),
      ),
    ),
    SECTIONS.map((section) => shelf(section, profile, go, redraw)),
    el('div.panel.page.paper.store-earn',
      el('h3', icon('pearl', { size: 18 }), t('Where pearls come from')),
      el('ul.lesson-points',
        el('li', el('span', t('A pearl for every hand you play at a table — more at the stops further down the river.'))),
        el('li', el('span', t('One more for every sound decision you make without asking for help.'))),
        el('li', el('span', t('A hundred for taking a table from the one who owns it, and twenty-five for beating the Belle in the race.'))),
      ),
      el('div.faint', t('Drills and lessons pay in XP, not pearls: the purse is filled at the tables, where nobody tells you which skill a spot is testing.')),
    ),
  );
}

function shelf(section, profile, go, redraw) {
  const items = CATALOGUE.filter((i) => i.kind === section.kind);
  return el(`div.panel.page.paper.shelf.shelf-${section.kind}`,
    el('div.panel-title', el('h2', t(section.title))),
    el('p.muted', t(section.blurb)),
    el(`div.shelf-items.${section.kind}`,
      items.map((item) => (section.kind === 'pet'
        ? companionCard(item, profile, go, redraw)
        : shelfRow(item, profile, go, redraw))),
    ),
  );
}

function shelfRow(item, profile, go, redraw) {
  const state = itemState(profile, item);
  const meta = item.kind === 'lesson' ? moduleMeta(item.module) : null;
  const checkpoint = item.kind === 'chart' ? CHECKPOINTS.find((c) => c.key === item.checkpoint) : null;
  const chapterNo = meta ? MODULE_META.indexOf(meta) + 1 : null;
  const open = () => (meta ? go('learn', { module: meta.id }) : go('ranges'));
  return el(`div.shelf-row${state.owned ? '.owned' : ''}${state.missing.length ? '.locked' : ''}`,
    el('span.module-glyph', icon(meta ? meta.icon : 'grid', { size: 18 })),
    el('div.shelf-text',
      el('div.shelf-name',
        chapterNo ? el('span.shelf-no', t('Chapter {n}', { n: chapterNo })) : null,
        itemName(item),
      ),
      el('div.faint', meta ? t(meta.tagline) : checkpoint && checkpoint.seat ? t('The {seat} chart', { seat: checkpoint.seat }) : t('Three-bet, call or fold')),
    ),
    el('div.shelf-buy',
      state.owned
        ? el('button.btn.sm.ghost', { onclick: open }, t('Open'))
        : buyControl(profile, item.key, { go, onBought: redraw }),
    ),
  );
}

function companionCard(item, profile, go, redraw) {
  const c = COMPANIONS.find((x) => x.key === item.pet);
  const state = itemState(profile, item);
  return el(`div.companion-card${state.owned ? '.owned' : ''}${state.missing.length ? '.locked' : ''}`,
    svgNode(portraitSvg(c.key, { size: 84 }), 'companion-face'),
    el('div.companion-text',
      el('div.companion-name', c.name, el('span.companion-kind', ` · ${t(c.kind)}`)),
      el('div.companion-does', t(c.does)),
      state.owned
        ? crewAboard(profile).some((x) => x.key === c.key)
          ? el('div.companion-with', icon('paw', { size: 14 }), ' ', t('Aboard your boat: comes to the table with you. Ask for help and they chip in.'))
          : el('div.companion-ashore',
            el('span', icon('anchor', { size: 14 }), ' ', t('Waiting at the landing — your boat has no berth free.')),
            el('button.btn.sm.ghost', { onclick: () => go('boatyard') }, t('To the boatyard')))
        : el('div.companion-buy', buyControl(profile, item.key, { go, onBought: redraw })),
    ),
  );
}
