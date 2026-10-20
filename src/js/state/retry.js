/**
 * The Log's mistakes, asked again.
 *
 * Watching a hand back shows you the answer before you have had to find it.
 * This deals the spot you went wrong in as it stood at the moment you acted
 * (your cards, the board, the pot, what it cost to stay in) and asks what you
 * do, without saying what you did. Graded by the same judge as the Log, so a
 * retry can never disagree with the verdict that kept the hand.
 *
 * Only the choice of action is asked. A mistake that was only in the size of
 * a bet is not one a fold, call or raise button can fix, so those are left to
 * the replay.
 */

import { judgeSpot } from '../core/coach.js';
import { reviewOf, loadHands, updateHand } from './handHistory.js';

const RANK = { bad: 0, ok: 1, skip: 1, good: 2 };

/**
 * The spot to ask from a kept hand, or null when it has none: a cooler, or a
 * mistake that was only in how much was bet.
 * @returns {{step:number, decision:object, did:string, choices:string[], verdict:object}|null}
 */
export function retryOf(hand) {
  if (!hand || !Array.isArray(hand.decisions)) return null;
  const review = reviewOf(hand);
  const worst = review.worst;
  if (!worst || !worst.action || worst.action.level !== 'bad') return null;
  const d = worst.decision;
  return {
    step: d.step,
    decision: d,
    did: d.action,
    choices: d.toCall > 0 ? ['fold', 'call', 'raise'] : ['check', 'bet'],
    verdict: worst.action,
  };
}

/**
 * How a choice is judged. A bet or raise the hand never made is sized at two
 * thirds of the pot: only the action is being asked, and the price grader does
 * not turn on the size.
 */
function judged(d, choice) {
  const amount = choice === d.action && d.amount
    ? d.amount
    : (d.currentBet || 0) + Math.max(1, Math.round((d.pot || 0) * 2 / 3));
  const v = judgeSpot({ ...d, action: choice, amount: choice === 'bet' || choice === 'raise' ? amount : null });
  // The action's own verdict, not the size's: the size was not asked.
  const { size, ...action } = v;
  return action;
}

/**
 * Grade one answer. Right is the best any of the choices could have done:
 * a bluff raise is "defensible" in the abstract, but where folding was the
 * good answer it is not the lesson the hand was kept for.
 * @returns {{right:boolean, verdict:object, best:string[]}}
 */
export function gradeRetry(spot, choice) {
  const all = spot.choices.map((c) => ({ choice: c, verdict: judged(spot.decision, c) }));
  const top = Math.max(...all.map((x) => RANK[x.verdict.level] ?? 0));
  const mine = all.find((x) => x.choice === choice) || { verdict: judged(spot.decision, choice) };
  const level = RANK[mine.verdict.level] ?? 0;
  return {
    right: level > 0 && level === top,
    verdict: mine.verdict,
    best: all.filter((x) => (RANK[x.verdict.level] ?? 0) === top).map((x) => x.choice),
  };
}

/** Has this hand's mistake been put right on a retry? */
export const isFixed = (hand) => Boolean(hand && hand.retry && hand.retry.fixed);

/**
 * The kept mistakes still to put right, newest first. The ones already fixed
 * stay in the Log, marked, but are not asked again in a sitting.
 */
export function retryQueue(hands = loadHands()) {
  return hands.slice().reverse().filter((h) => !isFixed(h) && retryOf(h));
}

/**
 * Note one answer on the hand: right marks it fixed, wrong takes the mark off
 * again (a fix that does not hold was not one).
 * @returns {object|null} the hand as stored
 */
export function noteRetry(id, right, now = Date.now()) {
  return updateHand(id, (h) => {
    const prev = h.retry && typeof h.retry === 'object' ? h.retry : {};
    const tries = (Number.isFinite(prev.tries) ? prev.tries : 0) + 1;
    return { ...h, retry: { tries, fixed: right ? now : 0 } };
  });
}
