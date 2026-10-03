/**
 * The Catch Book, on the counter of Maggie Doyle's tackle shop at Fisher's
 * Rest.
 *
 * Every fish in it is a poker spot (data/fish.js says which), so a page is
 * three things at once: a picture to collect, the bait — what to do at the
 * table to land it — and a way into the chapter that teaches that spot.
 * Fish not yet caught are shown as shadows with their bait written under
 * them, because a collection you cannot see the gaps in is not one anybody
 * sets out to fill.
 */

import { el } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { ANGLER } from '../data/characters.js';
import { WATERS, SPECIES, bookProgress } from '../data/fish.js';
import { VENUES } from '../data/venues.js';
import { furthestStop, currentBoat } from '../state/economy.js';
import { sceneBanner, says, svgNode } from './place.js';
import { fishSvg } from './fishArt.js';
import { pearls } from './shop.js';

export function renderCatchBook(ctx) {
  const { profile, go } = ctx;
  const book = profile.catchBook;
  const progress = bookProgress(book);
  const reach = furthestStop(profile);
  const line = progress.caught === 0 ? ANGLER.empty
    : progress.caught === progress.total ? ANGLER.full
      : progress.caught < 4 ? ANGLER.some : ANGLER.hello;

  return el('div.screen.catchbook',
    sceneBanner({
      id: 'tackle', landmark: 'tackle', kicker: t('On the pier at Fisher\'s Rest'), title: t('The Catch Book'), boat: currentBoat(profile).key,
    }),
    el('div.panel.mentor-card',
      says(ANGLER.key, t(line), { name: ANGLER.name }),
      el('div.catch-tally',
        el('span.catch-tally-n', t('{n} of {total} caught', { n: progress.caught, total: progress.total })),
        el('div.catch-bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(progress.total), 'aria-valuenow': String(progress.caught) },
          el('span.catch-bar-fill', { style: { width: `${(progress.caught / progress.total) * 100}%` } })),
        el('span.faint', t('Fish are caught by playing a spot right at a real table: no help, no lesson tables, no mistakes. The first of each kind pays pearls.')),
        el('button.btn.sm.ghost', { onclick: () => go('play') }, icon('cards', { size: 14 }), t('Go fishing')),
      ),
    ),
    WATERS.map((water) => waterPage(water, book, progress, reach, go)),
  );
}

function waterPage(water, book, progress, reach, go) {
  const fish = SPECIES.filter((s) => s.water === water.key);
  const count = progress.per.find((p) => p.water === water.key);
  const unreached = water.key !== 'legend' && reach < water.from;
  const firstStop = VENUES[water.from];
  return el(`section.panel.page.paper.catch-water.water-${water.key}${unreached ? '.unreached' : ''}`,
    el('div.catch-water-head',
      el('div',
        el('h2', t(water.name)),
        el('p.muted', t(water.blurb)),
      ),
      el('div.catch-water-meta',
        el('span.catch-count', t('{n} of {total}', { n: count.caught, total: count.total })),
        el('span.faint', t('First catch pays'), ' ', pearls(water.reward)),
      ),
    ),
    unreached
      ? el('p.catch-unreached', icon('anchor', { size: 14 }),
        el('span', t('Your boat has not reached these waters. They start at {stop}.', { stop: t(firstStop.name) })))
      : null,
    el('div.catch-grid', fish.map((s) => fishCard(s, book[s.key], go))),
  );
}

function fishCard(species, entry, go) {
  const caught = Boolean(entry);
  return el(`article.catch-card${caught ? '.caught' : ''}`,
    svgNode(fishSvg(species, { width: 180, caught }), 'catch-pic'),
    el('h3.catch-name', t(species.name)),
    caught
      ? el('div.catch-record',
        el('span', t('Caught {n}×', { n: entry.count })),
        el('span', t('Best {lb} lb', { lb: entry.best.toFixed(1) })),
        entry.where ? el('span.faint', t('at {place}', { place: t(entry.where) })) : null,
      )
      : el('div.catch-record.faint', t('Not caught yet')),
    el('p.catch-bait', el('strong', t('Bait: ')), t(species.how)),
    species.module
      ? el('button.catch-chapter', { onclick: () => go('learn', { module: species.module }) }, icon('book', { size: 13 }), t('The chapter'))
      : null,
  );
}
