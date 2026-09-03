/**
 * Grading one decision against the price you were offered and the equity you
 * actually held.
 *
 * This lives on its own because two places need the same answer: the coach
 * panel while you are playing, and the replay afterwards. A replay that
 * graded a hand differently from the coach who watched it happen would be
 * worse than no replay at all — you would not know which one to believe.
 *
 * Every verdict carries a chip cost as well as a level. "Bad" on its own
 * ranks nothing: a fold that gave up two chips and a call that burned eighty
 * are not the same mistake, and the hands worth going back to are chosen by
 * that number.
 *
 * The sentences come back as templates with their numbers in `params` rather
 * than already stitched together. A sentence with a number baked into it can
 * never be translated — there is no key to look up — and this is the text
 * that carries the entire point of the feature.
 */

import { callEV, breakEvenBluffFrequency } from './odds.js';

const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const chips = (n) => Math.round(n).toLocaleString('en-US');

/** Below this, a difference in equity is inside the simulation's own noise. */
export const NOISE = 0.03;

/**
 * How far the wrong side of the line a fold has to be before it is graded a
 * mistake rather than a thin one. Exported because the Lab uses it to pick
 * spots: a "make the call" question you got wrong must be a question this
 * grader also calls wrong, or the two would contradict each other about the
 * same hand.
 */
export const CLEAR_MARGIN = 0.08;

/**
 * @param {object} d  A decision: what you did and what you were facing.
 * @param {'fold'|'check'|'call'|'bet'|'raise'} d.action
 * @param {number} d.equity   0..1, your share of the pot at that moment
 * @param {number} d.needed   0..1, the equity the price demanded
 * @param {number} d.toCall   chips it cost to continue
 * @param {number} d.pot      chips in the middle, including their bet
 * @param {number} [d.amount] total committed on a bet or raise
 * @param {number} [d.currentBet] the bet being raised, for sizing a bluff
 * @returns {{kind:string, level:'good'|'ok'|'bad', head:string, body:string,
 *            params:object, better:string|null, cost:number}}
 */
export function judgeDecision(d) {
  const equity = clamp01(d.equity);
  const needed = clamp01(d.needed);
  const toCall = Math.max(0, d.toCall || 0);
  const pot = Math.max(0, d.pot || 0);
  const ev = callEV(equity, toCall, pot);
  const params = { equity: pct(equity), needed: pct(needed), call: chips(toCall), pot: chips(pot) };

  if (d.action === 'fold') return judgeFold({ equity, needed, toCall, pot, ev, params });
  if (d.action === 'check') return judgeCheck({ equity, pot, params });
  if (d.action === 'call') return judgeCall({ equity, needed, toCall, pot, ev, params });
  return judgeBet({ ...d, equity, pot, params });
}

function judgeFold({ equity, needed, toCall, pot, ev, params }) {
  if (toCall === 0) {
    // Folding when checking was free is the one decision that needs no
    // equity estimate to condemn — there was no price to be wrong about.
    return {
      kind: 'fold',
      level: 'bad',
      head: 'Never fold for free',
      body: 'Nobody had bet. Checking would have shown you the next card at no cost, and you gave up a pot '
        + 'you held {equity} of instead.',
      params,
      better: 'Check',
      cost: equity * pot,
    };
  }
  if (equity > needed + CLEAR_MARGIN) {
    return {
      kind: 'fold',
      level: 'bad',
      head: 'You folded the best of it',
      body: 'You had {equity} and the price only asked for {needed}. Calling was worth about {gain} chips, '
        + 'and folding threw that away.',
      params: { ...params, gain: chips(ev) },
      better: 'Call {call}',
      cost: Math.max(0, ev),
    };
  }
  if (equity > needed) {
    return {
      kind: 'fold',
      level: 'ok',
      head: 'Close fold',
      body: '{equity} against {needed} needed — a thin call. Folding is defensible against somebody who never '
        + 'bluffs, and this is not the kind of spot a session is won or lost on.',
      params,
      better: null,
      cost: 0,
    };
  }
  return {
    kind: 'fold',
    level: 'good',
    head: 'Good fold',
    body: 'The price asked for {needed} and you had {equity}. Folding saves money, and the folds are where '
      + "most of a winning player's edge quietly comes from.",
    params,
    better: null,
    cost: 0,
  };
}

function judgeCheck({ equity, params }) {
  if (equity > 0.7) {
    return {
      kind: 'check',
      level: 'ok',
      head: 'Missed value',
      body: 'With {equity} you are well ahead. Betting here gets called by worse hands — money left behind, '
        + 'though how much depends on whether they would have paid.',
      params,
      better: 'Bet for value',
      cost: 0,
    };
  }
  return {
    kind: 'check',
    level: 'good',
    head: 'Fine check',
    body: 'With {equity}, keeping the pot small is reasonable. Checking also protects the hands you check with '
      + 'on later streets.',
    params,
    better: null,
    cost: 0,
  };
}

function judgeCall({ equity, needed, ev, params }) {
  if (equity >= needed + 0.05) {
    return {
      kind: 'call',
      level: 'good',
      head: 'Correct call',
      body: 'You needed {needed} and had {equity}. This call wins about {gain} chips on average.',
      params: { ...params, gain: chips(ev) },
      better: null,
      cost: 0,
    };
  }
  if (equity >= needed - NOISE) {
    return {
      kind: 'call',
      level: 'ok',
      head: 'Marginal call',
      body: '{equity} against {needed} needed — close enough to break-even that the answer comes from the later '
        + 'streets rather than from this one.',
      params,
      better: null,
      cost: 0,
    };
  }
  return {
    kind: 'call',
    level: 'bad',
    head: 'Called without the odds',
    body: 'The price asked for {needed} and you had {equity}. A call like this loses about {loss} chips every '
      + 'time you make it. Over a career these are the single biggest leak in small-stakes poker.',
    params: { ...params, loss: chips(-ev) },
    better: 'Fold — {call} into {pot} was too expensive',
    cost: Math.max(0, -ev),
  };
}

function judgeBet(d) {
  const { equity, pot, params } = d;
  const betSize = Math.max(1, (d.amount || 0) - (d.currentBet || 0));
  const foldsNeeded = breakEvenBluffFrequency(betSize, pot);
  if (equity >= 0.65) {
    return {
      kind: 'bet',
      level: 'good',
      head: 'Value bet',
      body: '{equity} — you are ahead, so betting builds the pot and charges their draws. Size it so worse hands '
        + 'can still call.',
      params,
      better: null,
      cost: 0,
    };
  }
  if (equity <= 0.35) {
    return {
      kind: 'bet',
      level: 'ok',
      head: 'Bluff',
      body: 'With {equity} this is a bluff. It has to work {folds} of the time to break even. Against somebody '
        + 'who folds too much that is a bargain; against a calling station it is a donation.',
      params: { ...params, folds: pct(foldsNeeded, 0) },
      better: null,
      cost: 0,
    };
  }
  return {
    kind: 'bet',
    level: 'ok',
    head: 'Thin bet',
    body: '{equity} is the awkward middle. Ask the two questions: does a worse hand call, and does a better hand '
      + 'fold? If neither, checking is usually better.',
    params,
    better: null,
    cost: 0,
  };
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
