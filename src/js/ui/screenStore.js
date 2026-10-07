/**
 * Delphine's Trading Post: where pearls are spent.
 *
 * Every shelf in the game is here in one place — the chapters, the charts for
 * the pilot house, and the companions — each with its price and, when it
 * cannot be bought yet, exactly what stands in the way. The school and the
 * pilot house sell their own things too, through the same control, so a
 * price is never different depending on where you read it.
 */

import { el, fmt, toast, mount } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { MODULE_META, moduleMeta } from '../data/curriculum.js';
import { CHECKPOINTS } from '../data/rangeLadder.js';
import { TRADER } from '../data/characters.js';
import {
  CATALOGUE, COMPANIONS, SHOPS, itemState, crewAboard,
  pricedAt, perThousand, seatInPearls, saleValue, sellPearls, furthestStop,
} from '../state/economy.js';
import { VENUES } from '../data/venues.js';
import * as audio from '../audio/engine.js';
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
        el('button.btn.sm.ghost', {
          onclick: () => document.querySelector('.exchange') && document.querySelector('.exchange').scrollIntoView({ behavior: 'smooth', block: 'start' }),
        }, icon('chip', { size: 14 }), ' ', t('Pearls for money')),
      ),
    ),
    SECTIONS.map((section) => shelf(section, profile, go, redraw)),
    exchangePanel(profile, redraw),
    el('div.panel.page.paper.store-earn',
      el('h3', icon('pearl', { size: 18 }), t('Where pearls come from')),
      el('ul.lesson-points',
        el('li', el('span', t('A pearl for every hand you play through at a table — more at the stops further down the river. A hand you fold before the flop pays nothing, and a table with fewer than six players pays half.'))),
        el('li', el('span', t('One more for every sound decision you make without asking for help.'))),
        el('li', el('span', t('A bounty for every player you knock out: all of it if you played the hand right, half with one mistake, nothing with two.'))),
        el('li', el('span', t('The first of every fish in the Catch Book: each one is a spot played right at a real table.'))),
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

/**
 * Delphine buys pearls, at what they fetch where your boat is moored — more
 * the further down the river — and the money goes in the bankroll. Nothing
 * sells them back: the purse is only ever filled at the tables. The board
 * shows the whole river, because the far end is the reason to keep some.
 */
function exchangePanel(profile, redraw) {
  const node = el('div.panel.page.paper.exchange');
  let pending = null;
  const paint = () => {
    const at = pricedAt(profile);
    const here = VENUES[at];
    const have = profile.pearls;
    const reached = furthestStop(profile);
    const offers = [...new Set([1000, 5000, 20000].filter((n) => n < have).concat(have > 0 ? [have] : []))]
      .filter((n) => saleValue(n, at) > 0);
    const sold = profile.economy.sold || 0;
    const sell = (n) => {
      const result = sellPearls(profile, n);
      if (!result.ok) return;
      audio.sfx('chips');
      toast({
        icon: 'chip',
        title: t('Sold {n} pearls for {money}', { n: fmt.chips(result.pearls), money: fmt.money(result.money) }),
        desc: t('Into your bankroll, at the {place} price.', { place: t(here.name) }),
      });
      redraw();
    };
    mount(node,
      el('div.panel-title',
        el('h2', icon('chip', { size: 18 }), ' ', t('Pearls for money')),
        el('span.faint', t('Your boat is at {place}', { place: t(here.name) })),
      ),
      el('p.muted', t('Delphine buys pearls for what they fetch where your boat is moored: {money} a thousand at {place}. '
        + 'The further down the river, the more a pearl is worth. Any seat or Regatta entry on the river can be paid in them too.',
      { money: fmt.money(perThousand(at)), place: t(here.name) })),
      have > 0
        ? el('div.exchange-have', t('Your {n} pearls fetch {money} here.', { n: fmt.chips(have), money: fmt.money(saleValue(have, at)) }))
        : el('div.exchange-have.faint', t('No pearls to sell. The tables pay them.')),
      pending !== null
        ? el('div.exchange-confirm',
          el('span', t('Sell {n} pearls for {money}? It cannot be undone.', { n: fmt.chips(pending), money: fmt.money(saleValue(pending, at)) })),
          el('button.btn.primary', { onclick: () => { const n = pending; pending = null; sell(n); } }, t('Sell')),
          el('button.btn.ghost', { onclick: () => { pending = null; paint(); } }, t('Not now')),
        )
        : offers.length
          ? el('div.exchange-offers', offers.map((n) => el('button.btn.ghost.exchange-offer', {
            onclick: () => { pending = n; paint(); },
          },
            el('span.exchange-n', n === have ? t('All {n}', { n: fmt.chips(n) }) : fmt.chips(n)),
            el('span.exchange-money', fmt.money(saleValue(n, at))))))
          : null,
      el('div.cheat-scroll', el('table.cheat-table.exchange-board',
        el('thead', el('tr', el('th', t('Where your boat is')), el('th', t('A seat in pearls')), el('th', t('1,000 pearls fetch')))),
        el('tbody', VENUES.map((v) => el(`tr${v.index === at ? '.here' : ''}${v.index > reached ? '.ahead' : ''}`,
          el('th', t(v.name), ' ', el('span.faint', v.label)),
          el('td', fmt.chips(seatInPearls(v.index))),
          el('td', fmt.money(perThousand(v.index))),
        ))),
      )),
      sold ? el('p.faint', t('Sold so far: {n} pearls for {money}.', { n: fmt.chips(sold), money: fmt.money(profile.economy.soldFor || 0) })) : null,
      el('p.faint', t('Nobody on the river sells pearls: they are only ever earned at the tables, by how well you play.')),
    );
  };
  paint();
  return node;
}
