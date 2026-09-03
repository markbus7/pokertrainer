/**
 * The felt: seats around a table, the board in the middle, the pot under it.
 *
 * Pulled out of the table screen so that the replay can show a hand on the
 * same felt you played it on. A review screen that drew its own approximation
 * of a table would be asking you to recognise a spot from a diagram of it,
 * which is most of the way back to a quiz.
 *
 * Takes a plain description rather than a Table, so a live hand and a
 * rebuilt frame both go through the same code.
 */

import { el, fmt } from './dom.js';
import { cardEl, cardRow, hiddenCards } from './cardView.js';

/**
 * @param {object} state
 * @param {Array} state.players seats, each with seat/name/stack/committed/…
 * @param {number} state.heroSeat the seat that sits at the bottom of the screen
 * @param {number} state.seatCount total seats, for the slot arithmetic
 * @param {number} state.button seat index holding the button
 * @param {Array<number>} state.board community cards
 * @param {number} state.pot chips in the middle
 * @param {string} state.street label above the board
 * @param {string|null} state.actingId whose turn it is, highlighted
 * @param {boolean} [state.reveal] show everyone's cards (showdown or review)
 * @param {boolean} [state.fourColour]
 * @param {string} [state.potLabel]
 * @param {string} [state.boardPlaceholder]
 */
export function renderFelt(state) {
  const {
    players, heroSeat, seatCount, button, board, pot, street,
    actingId = null, reveal = false, fourColour = false,
    potLabel = 'pot', boardPlaceholder = 'waiting for the flop',
  } = state;

  const seats = players.map((p) => {
    const slot = (p.seat - heroSeat + seatCount) % seatCount;
    const isActing = p.id === actingId;
    const showCards = p.isHero || (reveal && !p.folded);

    return el(`div.seat${p.isHero ? '.hero' : ''}${p.folded ? '.folded' : ''}${isActing ? '.acting' : ''}${p.wonPot ? '.winner' : ''}`,
      { dataset: { slot: String(slot) } },
      p.lastAction ? el(`div.seat-action.${actionTone(p.lastAction)}`, p.lastAction) : null,
      // A folded seat collapses its card area entirely, so the "Fold" tag
      // stays pinned to the name plate instead of floating in empty space.
      p.folded
        ? null
        : p.hole && p.hole.length
          ? (showCards
              ? cardRow(p.hole, { size: p.isHero ? 'lg' : '', fourColour, dealt: true })
              : hiddenCards(p.hole.length))
          : el('div.seat-cards'),
      el('div.seat-plate',
        el('div.seat-name',
          !p.isHero && p.emoji ? el('span', p.emoji) : null,
          p.name,
        ),
        el('div.seat-stack', p.sittingOut ? 'sitting out' : fmt.chips(p.stack)),
        el('div.seat-pos', p.position),
      ),
      p.committed > 0 ? el('div.seat-bet', '🪙', fmt.chips(p.committed)) : null,
      p.seat === button ? el('div.dealer-button', 'D') : null,
    );
  });

  return el('div.felt',
    seats,
    el('div.board-area',
      el('div.street-tag', street),
      el('div.board',
        board.length
          ? board.map((c) => cardEl(c, { size: 'lg', fourColour, dealt: true }))
          : el('span.faint', boardPlaceholder),
      ),
      el('div.pot-chip', el('span.label', potLabel), fmt.chips(pot)),
    ),
  );
}

export function actionTone(label) {
  const l = String(label).toLowerCase();
  if (l.startsWith('fold')) return 'fold';
  if (l.startsWith('raise') || l.startsWith('bet') || l.startsWith('all-in')) return 'aggressive';
  return 'passive';
}
