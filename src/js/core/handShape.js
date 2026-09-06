/**
 * Naming what you are looking at.
 *
 * The lessons say "gutshot" fourteen times, "open-ended" eighteen, "flush
 * draw" thirty — and until now nothing in the game could look at two cards
 * and a board and tell you which of those you were holding. The words were
 * taught by using them, which works for a reader who already knows them and
 * leaves everybody else guessing.
 *
 * Recognition has to come before application. "You have a gutshot, what do
 * you do" is a fair question only once "which of these is a gutshot" has been
 * asked and answered, and this is the engine that lets it be asked.
 *
 * Straight draws are counted on the ranks alone rather than by dealing every
 * card out and evaluating: a card that would complete your straight but also
 * put a third heart out there is still a straight card, and an evaluator
 * looking at categories would report the flush instead.
 */

import { rankOf, suitOf, RANK_NAMES } from './cards.js';
import { evaluateHand, categoryOf, CAT } from './evaluator.js';
import { t } from '../i18n/index.js';

/**
 * Every shape the game names, in the order a player would say them.
 *
 * `label` is the name standing on its own — on a button, as an answer. It is
 * capitalised and carries no article. `phrase` is the same thing inside a
 * sentence, where "You have Flush draw" is not English and "Je hebt Flush
 * draw" is not Dutch either. The two are separate strings because the article
 * belongs to the language and the term itself deliberately does not: the
 * jargon stays English in both.
 */
export const SHAPES = [
  { key: 'made', label: 'A made hand', phrase: 'a made hand', outs: 0 },
  // A combo draw's count depends on the overlap — a card that is both a
  // heart and a straight card is one out, not two — so it is computed rather
  // than listed. The rest are fixed: nine, eight, four, six.
  { key: 'combo', label: 'Flush draw and a straight draw', phrase: 'a flush draw and a straight draw', outs: null },
  { key: 'flush-draw', label: 'Flush draw', phrase: 'a flush draw', outs: 9 },
  { key: 'open-ended', label: 'Open-ended straight draw', phrase: 'an open-ended straight draw', outs: 8 },
  { key: 'gutshot', label: 'Gutshot', phrase: 'a gutshot', outs: 4 },
  { key: 'overcards', label: 'Two overcards', phrase: 'two overcards', outs: 6 },
  { key: 'backdoor-flush', label: 'Backdoor flush draw', phrase: 'a backdoor flush draw', outs: 0 },
  { key: 'nothing', label: 'Nothing yet', phrase: 'nothing yet', outs: 0 },
];

export const shapeByKey = (key) => SHAPES.find((s) => s.key === key);

/** The name as it reads inside a sentence, article and all. */
export const shapePhrase = (shape) => t(shape.phrase);

/**
 * What two cards and a board add up to.
 *
 * @returns {{
 *   madeCategory: number,
 *   made: boolean,          true once you hold a pair or better
 *   draws: Array<{key: string, label: string, outs: number, cards: number[]}>,
 *   shape: {key: string, label: string, outs: number},  the one-word answer
 *   outs: number,           cards that get you there, counted once
 * }}
 */
export function readShape(hole, board) {
  const cards = [...hole, ...board];
  const madeCategory = categoryOf(evaluateHand(hole, board));
  const draws = [];

  const flush = flushDraw(cards);
  if (flush) draws.push(flush);
  const straight = straightDraw(cards);
  if (straight) draws.push(straight);
  const over = overcards(hole, board, madeCategory);
  if (over) draws.push(over);
  const backdoor = !flush && backdoorFlush(cards);
  if (backdoor) draws.push(backdoor);

  const combo = flush && straight;
  const shape = combo
    ? { ...shapeByKey('combo'), outs: countDistinct([...flush.cards, ...straight.cards]) }
    : draws.length
      ? draws[0]
      : madeCategory >= CAT.PAIR
        ? shapeByKey('made')
        : shapeByKey('nothing');

  return {
    madeCategory,
    made: madeCategory >= CAT.PAIR,
    draws,
    shape,
    outs: countDistinct(draws.flatMap((d) => d.cards)),
  };
}

const countDistinct = (cards) => new Set(cards).size;

/* ------------------------------------------------------------------ *
 * The shapes
 * ------------------------------------------------------------------ */

function flushDraw(cards) {
  for (let suit = 0; suit < 4; suit++) {
    const held = cards.filter((c) => suitOf(c) === suit);
    if (held.length !== 4) continue;
    const seen = new Set(cards);
    const outs = [];
    for (let card = suit; card < 52; card += 4) if (!seen.has(card)) outs.push(card);
    return { ...shapeByKey('flush-draw'), outs: outs.length, cards: outs };
  }
  return null;
}

function backdoorFlush(cards) {
  for (let suit = 0; suit < 4; suit++) {
    if (cards.filter((c) => suitOf(c) === suit).length === 3) {
      return { ...shapeByKey('backdoor-flush'), outs: 0, cards: [] };
    }
  }
  return null;
}

/**
 * How many distinct ranks complete a straight, and therefore which draw this
 * is. Two or more completing ranks is open-ended (or a double gutshot, which
 * plays the same and is worth the same eight cards); exactly one is a
 * gutshot.
 */
function straightDraw(cards) {
  const have = rankSet(cards);
  if (fiveInARow(have)) return null;              // already there
  const seen = new Set(cards);
  const completing = [];

  for (let rank = 2; rank <= 14; rank++) {
    if (have.has(rank)) continue;
    if (!fiveInARow(withAce(new Set([...have, rank])))) continue;
    completing.push(rank);
  }
  if (!completing.length) return null;

  const outs = [];
  for (const rank of completing) {
    for (let suit = 0; suit < 4; suit++) {
      const card = (rank - 2) * 4 + suit;
      if (!seen.has(card)) outs.push(card);
    }
  }
  const key = completing.length >= 2 ? 'open-ended' : 'gutshot';
  return { ...shapeByKey(key), outs: outs.length, cards: outs, ranks: completing };
}

const rankSet = (cards) => withAce(new Set(cards.map(rankOf)));

/** An ace plays low as well, so 5-4-3-2-A is a straight. */
function withAce(ranks) {
  const out = new Set(ranks);
  if (out.has(14)) out.add(1);
  return out;
}

function fiveInARow(ranks) {
  for (let low = 1; low <= 10; low++) {
    let run = 0;
    for (let r = low; r < low + 5; r++) if (ranks.has(r)) run++;
    if (run === 5) return true;
  }
  return false;
}

/**
 * Two cards both bigger than anything on the board, with no pair yet. Six
 * cards pair one of them, and the outs lesson counts them as a draw because
 * that is how a player thinks about them.
 */
function overcards(hole, board, madeCategory) {
  if (madeCategory >= CAT.PAIR || hole.length !== 2) return null;
  const high = Math.max(...board.map(rankOf));
  const over = hole.filter((c) => rankOf(c) > high);
  if (over.length !== 2) return null;
  const seen = new Set([...hole, ...board]);
  const outs = [];
  for (const card of over) {
    const rank = rankOf(card);
    for (let suit = 0; suit < 4; suit++) {
      const candidate = (rank - 2) * 4 + suit;
      if (!seen.has(candidate)) outs.push(candidate);
    }
  }
  return { ...shapeByKey('overcards'), outs: outs.length, cards: outs };
}

/** The shape's name, translated, for a question or an answer. */
export const shapeName = (shape) => t(shape.label);

/** A sentence saying why it is that shape, for the feedback after a guess. */
export function explainShape(hole, board) {
  const read = readShape(hole, board);
  const straight = read.draws.find((d) => d.key === 'open-ended' || d.key === 'gutshot');
  switch (read.shape.key) {
    case 'combo':
      return t('Four to a flush and an open end as well — {outs} cards give you one or the other, which is the '
        + 'biggest draw you can flop.', { outs: read.outs });
    case 'flush-draw':
      return t('You hold two of a suit and two more are out there. Nine cards left in that suit fill it.');
    case 'open-ended':
      return t('The run is open at both ends: {ranks} completes it, which is eight cards.',
        { ranks: rankList(straight) });
    case 'gutshot':
      return t('The run has one hole in it. Only {ranks} fills that gap — four cards, half an open-ender.',
        { ranks: rankList(straight) });
    case 'overcards':
      return t('Nothing yet, but both your cards beat the whole board. Six cards pair one of them.');
    case 'backdoor-flush':
      return t('Three of a suit. You would need both of the next two cards, so it is not a draw yet — it is a '
        + 'reason to keep the hand alive cheaply.');
    case 'made':
      return t('You already have something. This is a hand to value, not a draw to complete.');
    default:
      return t('No draw and nothing made. This is the flop to let go of.');
  }
}

const rankList = (draw) => (draw ? draw.ranks.map((r) => t(RANK_NAMES[r === 1 ? 14 : r])).join(t(' or ')) : '');
