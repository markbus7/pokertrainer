/**
 * The pieces every shelf is built from: a pearl, a price, and the control
 * that either buys the thing or says exactly what stands in the way.
 *
 * One control for every place something can be bought — the Trading Post,
 * a chapter in the school, a reach in the pilot house — so the rules for
 * what may be bought are only ever read in one way (state/economy.js) and
 * only ever explained in one voice.
 */

import { el, fmt, toast } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import * as audio from '../audio/engine.js';
import { itemByKey, itemState, purchase, companionByKey, upgradeByKey } from '../state/economy.js';
import { boatByKey } from '../data/characters.js';
import { moduleMeta } from '../data/curriculum.js';
import { CHECKPOINTS } from '../data/rangeLadder.js';
import { RANKS } from '../state/profile.js';

/** A pearl: lustre is the whole point, so it is drawn, not an emoji. */
export function pearl(size = 16) {
  return el('span.pearl', { 'aria-hidden': 'true', style: { width: `${size}px`, height: `${size}px` } });
}

/** A number of pearls, with the pearl beside it. */
export function pearls(n, { className = '' } = {}) {
  return el(`span.pearls${className ? `.${className}` : ''}`, pearl(), el('span.pearls-n', fmt.chips(n)));
}

/** What a shelf item is called, in the reader's language. */
export function itemName(item) {
  if (item.kind === 'lesson') return t(moduleMeta(item.module).name);
  if (item.kind === 'chart') {
    const checkpoint = CHECKPOINTS.find((c) => c.key === item.checkpoint);
    return checkpoint ? t(checkpoint.name) : item.checkpoint;
  }
  if (item.kind === 'pet') {
    const c = companionByKey(item.pet);
    return t('{name} the {kind}', { name: c.name, kind: t(c.kind).toLowerCase() });
  }
  if (item.kind === 'boat') return t(boatByKey(item.boat).name);
  if (item.kind === 'upgrade') return t(upgradeByKey(item.upgrade).name);
  return item.key;
}

/** One unmet requirement, as a sentence. */
export function requirementText(missing) {
  const p = missing.params || {};
  if (missing.key === 'level') {
    const rank = RANKS[p.level - 1];
    return t('Reach {rank}', { rank: rank ? t(rank.name) : p.level });
  }
  if (missing.key === 'owns' || missing.key === 'lesson') {
    const meta = moduleMeta(p.module);
    return t(missing.text, { module: meta ? t(meta.name) : p.module });
  }
  if (missing.key === 'reach') return t(missing.text, { place: t(p.place) });
  return t(missing.text, p);
}

/**
 * The buying control for one item.
 *
 * Owned: says so. Locked: lists what is missing, each with a lock, so the
 * reader knows what to go and do. Short of pearls: shows the price, how many
 * more are needed, and the way to the tables that pay them. Otherwise, the
 * button — which buys, rings the bell, and calls `onBought` so the screen can
 * redraw with the thing in it.
 */
export function buyControl(profile, key, { onBought = null, go = null, label = null } = {}) {
  const item = itemByKey(key);
  if (!item) return null;
  const state = itemState(profile, item);

  if (state.owned) return el('span.badge.green.owned-tag', icon('check', { size: 13 }), ' ', t('Yours'));

  if (state.missing.length) {
    return el('div.buy-locked',
      el('span.price-tag.dim', pearls(item.price)),
      el('ul.needs', state.missing.map((m) => el('li', icon('lock', { size: 13 }), el('span', requirementText(m))))),
    );
  }

  if (!state.affordable) {
    return el('div.buy-short',
      el('span.price-tag', pearls(item.price)),
      el('span.faint', t('{n} more pearls to go — the tables pay them.', { n: state.short })),
      go ? el('button.btn.sm.ghost', { onclick: () => go('play') }, icon('cards', { size: 14 }), ' ', t('Play for pearls')) : null,
    );
  }

  return el('button.btn.primary.buy-btn', {
    onclick: () => {
      const result = purchase(profile, key);
      if (!result.ok) return;
      audio.sfx('bell');
      toast({
        icon: pearl(22),
        title: t('Bought: {name}', { name: itemName(item) }),
        desc: t('{n} pearls left in the purse.', { n: fmt.chips(profile.pearls) }),
      });
      if (onBought) onBought();
    },
  }, label || t('Buy'), ' ', el('span.price-tag.on-button', pearls(item.price)));
}

/**
 * Pearls flying up to the purse on the rail, the way XP flies to the rank:
 * a number that goes somewhere is a number you notice.
 */
export function pearlPop(amount, from = null) {
  if (typeof document === 'undefined' || !amount) return;
  const target = document.querySelector('#topbar .pearl-chip');
  const box = target ? target.getBoundingClientRect() : { left: window.innerWidth - 220, bottom: 60, width: 80 };
  const start = from ? from.getBoundingClientRect() : null;
  const node = el('div.pearl-pop', pearl(14), `+${amount}`);
  node.style.left = `${Math.round((start ? start.left + start.width / 2 : box.left + box.width / 2))}px`;
  node.style.top = `${Math.round(start ? start.top : box.bottom + 8)}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1400);
}
