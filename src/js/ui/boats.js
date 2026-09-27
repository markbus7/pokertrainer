/**
 * The pieces the river and the boatyard both show about a boat: what it
 * does, and who is aboard it.
 */

import { el } from './dom.js';
import { t } from '../i18n/index.js';
import { crewAboard, currentBoat } from '../state/economy.js';
import { svgNode } from './place.js';
import { portraitSvg } from './portraits.js';

/** What a boat does, in one line: its berths and its strongbox. */
export function boatPerks(boat) {
  const berths = boat.berths === 1
    ? t('Carries one companion')
    : t('Carries {n} companions', { n: boat.berths });
  const box = boat.bonus > 0
    ? t('+{pct}% pearls at the tables', { pct: Math.round(boat.bonus * 100) })
    : t('No strongbox');
  return `${berths} · ${box}`;
}

/**
 * The berths, as faces: each companion aboard, then an empty ring for every
 * berth nobody is in. A full boat and an empty one look different at a
 * glance, which is the whole reason to draw it rather than count it.
 */
export function crewStrip(profile, { size = 34 } = {}) {
  const boat = currentBoat(profile);
  const aboard = crewAboard(profile);
  const slots = [];
  for (let i = 0; i < boat.berths; i++) {
    const c = aboard[i];
    slots.push(c
      ? el('span.berth.taken', { title: `${c.name} · ${t(c.kind)}` }, svgNode(portraitSvg(c.key, { size }), 'berth-face'))
      : el('span.berth.open', { title: t('An empty berth'), style: { width: `${size}px`, height: `${size}px` } }));
  }
  return el('div.crew-strip', { 'aria-label': t('{n} of {total} berths taken', { n: aboard.length, total: boat.berths }) }, slots);
}
