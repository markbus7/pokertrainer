/**
 * Which skill is this decision actually about?
 *
 * The curriculum is twelve named skills, and until now they only existed in
 * the drills: you proved you understood pot odds by answering a question with
 * "pot odds" written at the top of it. At a table nobody tells you which
 * skill a spot is testing, and working that out is most of the job — so the
 * table could grade you on equity and nothing else, and playing a hand
 * counted toward nothing.
 *
 * This names the skill from the spot itself: the street, the seat, the price,
 * the board and what you are holding. Once a decision has a name, playing can
 * be recorded against the same mastery the drills feed, and the coach can say
 * what the hand is asking you rather than only whether the arithmetic worked.
 *
 * One skill per decision, not a list. A flop bet with a flush draw touches
 * outs, pot odds, board texture and stack depth all at once; saying so is
 * true and useless. The one named is the one the decision turns on.
 */

import { categoryOf, CAT } from './evaluator.js';
import { spr as sprOf } from './odds.js';

/** Above this, a hand is strong enough that the question stops being a price. */
const VALUE = 0.65;

/** Below this, a hand has nothing to show down and the question is a bluff. */
const AIR = 0.33;

/**
 * @param {object} spot
 * @param {'preflop'|'flop'|'turn'|'river'} spot.street
 * @param {number} spot.toCall      chips to continue, 0 when checked to you
 * @param {number} spot.pot         chips in the middle, their bet included
 * @param {number} spot.bigBlind
 * @param {number} spot.equity      0..1 against the players still in
 * @param {number} spot.effectiveStack
 * @param {number} spot.opponents   how many are still in
 * @param {boolean} spot.wasAggressor  did you take the lead on the last street
 * @param {boolean} spot.firstIn    preflop, is the pot still unopened
 * @param {number} [spot.madeCategory]  what your five cards make right now
 * @param {number} [spot.outs]      cards that improve you to a likely winner
 * @returns {{id: string, why: string}} a curriculum module id and one line
 *          saying what makes this that kind of spot
 */
export function conceptOf(spot) {
  const {
    street, toCall = 0, pot = 0, equity = 0, opponents = 1,
    effectiveStack = 0, wasAggressor = false, firstIn = false,
    madeCategory = CAT.HIGH_CARD, outs = 0,
  } = spot;
  const facing = toCall > 0;

  if (street === 'preflop') {
    // Opening and defending are the same chart work; which one it is decides
    // whether the seat or the raise is the thing being tested.
    return firstIn
      ? { id: 'preflop', why: 'Nobody has opened. This is your opening range.' }
      : facing
        ? { id: 'preflop', why: 'Somebody opened. This is 3-bet, call or fold.' }
        : { id: 'position', why: 'You are in the blinds with a price. This is defending your seat.' };
  }

  // Stack depth stops being background and becomes the decision once the pot
  // is large enough that one more bet commits you.
  const ratio = sprOf(effectiveStack, pot);
  if (facing && Number.isFinite(ratio) && ratio <= 1.2 && equity > 0.35) {
    return { id: 'spr', why: 'The stack is barely bigger than the pot. This is a commitment decision.' };
  }

  if (facing) {
    // A draw facing a price is the outs lesson. Nothing made is the test: a
    // hand that has already paired is being asked whether it can call, which
    // is a defence question, not a counting one — even though it also has
    // cards that would improve it.
    if (madeCategory === CAT.HIGH_CARD && outs >= 6) {
      return { id: 'outs', why: 'You are drawing and being charged for it. Count the outs, then check the price.' };
    }
    if (equity >= VALUE) {
      return { id: 'exploit', why: 'You are ahead and they are betting. What they do it with decides your answer.' };
    }
    if (madeCategory === CAT.HIGH_CARD) {
      return { id: 'pot-odds', why: 'Nothing made and a price to pay. This is arithmetic.' };
    }
    // A made hand that beats a bluff and little else is the defence spot:
    // fold too many of these and betting into you is free money.
    return opponents === 1
      ? { id: 'mdf', why: 'A hand that beats a bluff and not much else. This is how much you have to defend.' }
      : { id: 'pot-odds', why: 'Several players in and a price to pay. Start with the arithmetic.' };
  }

  // Nobody has bet: the question is whether to.
  if (street === 'flop' && wasAggressor) {
    return { id: 'cbet', why: 'You raised before the flop and they checked. This is the continuation bet.' };
  }
  if (equity <= AIR) {
    return { id: 'bluffing', why: 'Nothing to show down. Betting here has to make them fold.' };
  }
  if (equity >= VALUE) {
    return { id: 'exploit', why: 'You are well ahead and they have checked. Getting paid is the whole question.' };
  }
  return { id: 'spr', why: 'A middling hand and chips behind. How big this pot gets is the decision.' };
}

/** True when the spot turns on a skill the reader has not unlocked yet. */
export const isUnlocked = (conceptId, level, modules) => {
  const meta = modules.find((m) => m.id === conceptId);
  return !meta || meta.unlockLevel <= level;
};
