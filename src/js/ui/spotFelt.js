/**
 * One green table for every question that has cards in it.
 *
 * The drills used to lay their cards out as a worksheet — a row labelled
 * "Your hand", a row labelled "Board" — and the lesson exercises drew their
 * own felt. Reading a spot is a thing you do while looking at a table, so
 * both go through here: the same green, the board in the middle, your two
 * cards below it, the pot on the felt where the pot sits.
 */

import { el, fmt } from './dom.js';
import { t } from '../i18n/index.js';
import { cardEl, cardRow } from './cardView.js';
import { renderFelt } from './feltView.js';

const STREET = ['preflop', 'preflop', 'preflop', 'flop', 'turn', 'river'];

/** True when there is anything to draw a table around. */
export function hasCards(spot) {
  if (!spot) return false;
  return Boolean((spot.hero && spot.hero.length) || (spot.hole && spot.hole.length)
    || (spot.board && spot.board.length));
}

/**
 * @param {object} spot     { board?, hero|hole?, villain?, revealVillain?, pot?, toCall?, seat? }
 * @param {object} settings the player's display settings (four-colour deck)
 */
export function spotFelt(spot, settings = {}) {
  const four = !!settings.fourColour;
  const board = spot.board || [];
  const hero = spot.hero || spot.hole;
  const villain = spot.revealVillain && Array.isArray(spot.villain) ? spot.villain : null;
  const chips = [];
  if (spot.pot != null) chips.push(el('div.pot-chip', el('span.label', t('pot')), fmt.chips(spot.pot)));
  if (spot.toCall != null) {
    chips.push(el('div.pot-chip.bet-chip', el('span.label', t('they bet')), fmt.chips(spot.toCall)));
  }

  return el('div.felt.spot-felt',
    villain ? el('div.spot-hole.villain',
      el('div.spot-hole-label', t('Them')),
      cardRow(villain, { size: 'lg', fourColour: four, dealt: true }),
    ) : null,
    el('div.board-area',
      board.length ? el('div.street-tag', t(STREET[board.length])) : null,
      board.length
        ? el('div.board', board.map((c) => cardEl(c, { size: 'lg', fourColour: four, dealt: true })))
        : null,
      chips.length ? el('div.spot-chips', chips) : null,
    ),
    hero && hero.length ? el('div.spot-hole',
      cardRow(hero, { size: 'lg', fourColour: four, dealt: true }),
      el('div.spot-hole-label', spot.seat ? t('You — {seat}', { seat: spot.seat }) : t('You')),
    ) : null,
  );
}

/**
 * The other picture a question can be asked over: a ring of seats with the
 * button on one of them. Drawn by the game's own felt, so the table you learn
 * position on is the table you play on.
 *
 * @param {object} ring          from core/seatMap.js
 * @param {boolean} hideSeatNames blank the position plates — leaving them on
 *                                prints the answer when the name is the question
 */
export function seatFelt(ring, { hideSeatNames = false, fourColour = false } = {}) {
  const table = renderFelt({
    players: ring.seats.map((seat) => ({
      id: `s${seat.seat}`,
      seat: seat.seat,
      name: seat.name,
      stack: 100,
      committed: 0,
      isHero: seat.isHero,
      folded: false,
      position: hideSeatNames ? '' : seat.position,
      hole: [],
    })),
    heroSeat: ring.heroSeat,
    seatCount: ring.seatCount,
    button: ring.button,
    board: [],
    pot: 0,
    street: '',
    fourColour,
    potLabel: '',
    boardPlaceholder: '',
  });
  table.classList.add('seat-felt');
  return table;
}
