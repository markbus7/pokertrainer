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
import { portraitSvg } from './portraits.js';
import { t } from '../i18n/index.js';
import { pearl } from './shop.js';

/**
 * A few chips, stacked: one for a blind, up to five for a big bet, so the
 * size of a bet is something you see before you read the number beside it.
 * `bb` is the big blind the stack is measured against.
 */
export function chipStack(amount, bb = 2, { max = 5 } = {}) {
  const inBlinds = amount / (bb || 1);
  const n = Math.max(1, Math.min(max, Math.ceil(Math.log2(inBlinds + 1))));
  const tone = inBlinds >= 40 ? 'black' : inBlinds >= 10 ? 'green' : inBlinds >= 3 ? 'blue' : 'red';
  return el(`span.chip-stack.${tone}`, { 'aria-hidden': 'true' },
    Array.from({ length: n }, () => el('span.chip-disc')));
}

/** A seat's face, from a trusted SVG string drawn by portraits.js. */
function face(key) {
  const node = el('span.seat-face', { 'aria-hidden': 'true' });
  node.innerHTML = portraitSvg(key, { size: 40 });
  return node;
}

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
 *
 * Each player may also carry `portrait` (whose face to draw on the plate),
 * `boss` (the person who owns this table) and `speech` (a line they are
 * saying right now, shown in a bubble by their seat).
 */
/**
 * Which of the felt's six places a seat sits in, counting clockwise from the
 * hero at the bottom. A full table fills all six. A smaller one spreads what
 * it has round the oval instead of crowding one side of it: heads-up puts
 * the other player straight across, three-handed puts them either side of
 * the top. (Counting round without the spread had both opponents on the
 * left, hugging the rail with the whole right of the table empty.)
 *
 * @param {number} order      places clockwise from the hero, 0 for the hero
 * @param {number} seatCount  chairs at the table
 */
const SPREAD = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 2, 3, 4], 5: [0, 1, 2, 4, 5] };
export function slotFor(order, seatCount) {
  const layout = SPREAD[seatCount];
  return layout ? layout[order] : order;
}

export function renderFelt(state) {
  const {
    players, heroSeat, seatCount, button, board, pot, street,
    actingId = null, reveal = false, fourColour = false,
    potLabel = 'pot', boardPlaceholder = 'waiting for the flop',
    bigBlind = 2,
  } = state;

  const seats = players.map((p) => {
    const slot = slotFor((p.seat - heroSeat + seatCount) % seatCount, seatCount);
    const isActing = p.id === actingId;
    const showCards = p.isHero || (reveal && !p.folded);

    return el(`div.seat${p.isHero ? '.hero' : ''}${p.folded ? '.folded' : ''}${isActing ? '.acting' : ''}${p.wonPot ? '.winner' : ''}${p.boss ? '.boss' : ''}`,
      { dataset: { slot: String(slot) } },
      p.speech ? el('div.seat-speech', p.speech) : null,
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
      el(`div.seat-plate${p.portrait ? '.has-face' : ''}`,
        p.portrait ? face(p.portrait) : null,
        el('div.seat-name',
          !p.isHero && p.tag ? el('span.style-tag', p.tag) : null,
          p.name,
        ),
        el('div.seat-stack', p.sittingOut ? 'sitting out' : fmt.chips(p.stack)),
        el('div.seat-pos', p.position),
        // What they carry: pearls for whoever knocks them out.
        p.bounty > 0 ? el('div.seat-bounty', { title: t('{n} pearls for knocking {name} out', { n: p.bounty, name: p.name }) }, pearl(12), String(p.bounty)) : null,
      ),
      p.committed > 0 ? el('div.seat-bet', chipStack(p.committed, bigBlind), fmt.chips(p.committed)) : null,
      p.seat === button ? el('div.table-marker.dealer', 'D') : null,
      p.position === 'SB' ? el('div.table-marker.blind.sb', 'SB') : null,
      p.position === 'BB' ? el('div.table-marker.blind.bb', 'BB') : null,
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
      el('div.pot-chip', pot > 0 ? chipStack(pot, bigBlind, { max: 6 }) : null, el('span.label', potLabel), fmt.chips(pot)),
    ),
  );
}

export function actionTone(label) {
  const l = String(label).toLowerCase();
  if (l.startsWith('fold')) return 'fold';
  if (l.startsWith('raise') || l.startsWith('bet') || l.startsWith('all-in')) return 'aggressive';
  return 'passive';
}
