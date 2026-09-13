/**
 * Questions for the range ladder. One kind of question only: what does the
 * chart say to do with this hand, here.
 *
 * The module drill for Preflop Ranges has five generators and three of them
 * ask about equity rather than about the chart, which is why a reader who set
 * out to learn their ranges kept being asked how often ace-king beats a pair.
 * This asks nothing else, ever.
 */

import { CHARTS, POSITIONS } from '../data/ranges.js';
import { edgeHands, allHands, seatName } from '../data/rangeLadder.js';
import { randInt, pick } from '../core/rng.js';
import { expandHandKey } from '../core/cards.js';
import { t } from '../i18n/index.js';

/** Seven of every ten questions come off the edge of the range. */
const EDGE_SHARE = 0.7;

function drawHand(rng, range, asked) {
  const edge = edgeHands(range);
  const pool = rng() < EDGE_SHARE && edge.length ? edge : allHands();
  // Don't ask the same hand twice in one run while there is anything left.
  for (let tries = 0; tries < 40; tries++) {
    const hand = pool[randInt(rng, pool.length)];
    if (!asked.has(hand)) return hand;
  }
  return pool[randInt(rng, pool.length)];
}

/** One real pair of cards for a hand type, so the reader sees suits. */
const dealFrom = (rng, key) => {
  const combos = expandHandKey(key);
  return combos[randInt(rng, combos.length)] || combos[0];
};

const OPEN = { raise: 'Raise', call: 'Call', fold: 'Fold' };

/** An unopened pot: the chart says raise, and everything else is a fold. */
function openQuestion(rng, seat, asked) {
  const range = CHARTS.rfi[seat];
  const hand = drawHand(rng, range, asked);
  const inRange = range.has(hand);
  return {
    hand,
    // "88" is correct notation and unreadable until you already know it. The
    // reader asked outright: "what is 88? Are that cards, and suited or
    // offsuit?" So the question carries the cards as well, drawn once here so
    // they cannot change under a redraw.
    cards: dealFrom(rng, hand),
    seat,
    raiser: null,
    prompt: t('Folded to you in the {seat}. {hand}.', { seat: t(seatName(seat)), hand }),
    options: [OPEN.raise, OPEN.call, OPEN.fold],
    answer: inRange ? OPEN.raise : OPEN.fold,
    // Limping is on the list at every question and is never the answer here.
    // The table offers the button too, and it is the one that feels safe.
    why: inRange
      ? t('{hand} is in the {seat} opening range. Nobody has raised, so it is a raise — never a limp.', { hand, seat: t(seatName(seat)) })
      : t('{hand} is not in the {seat} opening range. Fold it.', { hand, seat: t(seatName(seat)) }),
  };
}

/** Big blind facing one raise: three-bet, call the discount, or fold. */
function defendQuestion(rng, asked) {
  const raiser = pick(rng, POSITIONS.filter((p) => CHARTS.bbDefend[p]));
  const defend = CHARTS.bbDefend[raiser];
  const three = CHARTS.threeBet.BB;
  const hand = drawHand(rng, defend, asked);
  const isThree = three.all.has(hand);
  const isCall = !isThree && defend.has(hand);
  return {
    hand,
    cards: dealFrom(rng, hand),
    seat: 'BB',
    raiser,
    prompt: t('The {seat} raises. You are in the big blind with {hand}.', { seat: t(seatName(raiser)), hand }),
    options: [OPEN.raise, OPEN.call, OPEN.fold],
    answer: isThree ? OPEN.raise : isCall ? OPEN.call : OPEN.fold,
    why: isThree
      ? t('{hand} three-bets against a {seat} open.', { hand, seat: t(seatName(raiser)) })
      : isCall
        ? t('{hand} is a call. You have a discount to see the flop, but not enough hand to raise.', { hand })
        : t('{hand} is not worth a call even at the discount. Fold.', { hand }),
  };
}

/** Facing a raise outside the blinds: it three-bets or it goes. */
function threeBetQuestion(rng, asked) {
  const seat = pick(rng, ['CO', 'BTN', 'SB']);
  const three = CHARTS.threeBet[seat];
  const hand = drawHand(rng, three.all, asked);
  const isThree = three.all.has(hand);
  return {
    hand,
    cards: dealFrom(rng, hand),
    seat,
    raiser: 'UTG',
    prompt: t('An early raise comes to you in the {seat} with {hand}.', { seat: t(seatName(seat)), hand }),
    options: [OPEN.raise, OPEN.fold],
    answer: isThree ? OPEN.raise : OPEN.fold,
    why: isThree
      ? t('{hand} is a three-bet from the {seat} — {kind}.', {
        hand, seat: t(seatName(seat)),
        kind: three.value.has(hand) ? t('for value') : t('as a bluff'),
      })
      : t('{hand} is not in the {seat} three-betting range. Fold it.', { hand, seat: t(seatName(seat)) }),
  };
}

/**
 * One question for a checkpoint. The exam draws from all three kinds, which
 * is the point of it: at the table nobody announces which chart you are in.
 */
export function rangeQuestion(checkpoint, rng, asked = new Set()) {
  if (checkpoint.kind === 'open') return openQuestion(rng, checkpoint.seat, asked);
  if (checkpoint.kind === 'defend') return defendQuestion(rng, asked);
  if (checkpoint.kind === 'threebet') return threeBetQuestion(rng, asked);
  const roll = rng();
  if (roll < 0.6) return openQuestion(rng, pick(rng, Object.keys(CHARTS.rfi)), asked);
  if (roll < 0.8) return defendQuestion(rng, asked);
  return threeBetQuestion(rng, asked);
}
