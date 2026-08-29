/** Rendering playing cards. */

import { rankOf, suitOf, RANK_CHARS, SUIT_SYMBOLS } from '../core/cards.js';
import { el } from './dom.js';

const TWO_COLOUR = ['', 'red', 'red', ''];              // c d h s
const FOUR_COLOUR = ['green', 'blue', 'red', ''];       // c d h s

/** @param {number|null} card  null renders a face-down card. */
export function cardEl(card, { size = '', fourColour = false, dealt = false } = {}) {
  const classes = ['card', size, dealt ? 'dealt' : ''].filter(Boolean);
  if (card == null || card < 0) {
    return el(`div.${[...classes, 'back'].join('.')}`);
  }
  const rank = RANK_CHARS[rankOf(card) - 2];
  const suit = suitOf(card);
  const colour = (fourColour ? FOUR_COLOUR : TWO_COLOUR)[suit];
  if (colour) classes.push(colour);
  return el(`div.${classes.join('.')}`,
    el('span.rank', rank),
    el('span.suit', SUIT_SYMBOLS[suit]),
  );
}

export function cardRow(cards, options = {}) {
  return el('div.card-row', (cards || []).map((c, i) => cardEl(c, { ...options, dealt: options.dealt })));
}

/** Face-down placeholders for an opponent still in the hand. */
export function hiddenCards(count, options = {}) {
  return el('div.card-row', Array.from({ length: count }, () => cardEl(null, options)));
}
