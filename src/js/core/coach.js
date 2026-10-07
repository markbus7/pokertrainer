/**
 * The coach at the table: what skill this spot is asking you, and whether
 * your answer was the right one for that skill.
 *
 * core/judge.js grades one question — is the equity worth the price. That is
 * the right question in a lot of spots and the wrong one in the rest. Opening
 * 72o under the gun faces no bet, so the price grader had nothing to say and
 * said nothing; the whole preflop chapter of the curriculum was tested in the
 * drills and unenforced in the one place you actually play.
 *
 * So this looks at the spot first (core/spotConcept.js names the skill) and
 * then grades it the way that skill is graded: preflop against the charts the
 * drills use, a continuation bet against the board, everything price-shaped
 * against the price. One answer, from one place, so the table, the drills and
 * the hand review cannot disagree about the same hand.
 */

import { judgeIcm } from './icmJudge.js';
import { judgeDecision } from './judge.js';
import { conceptOf } from './spotConcept.js';
import { describeTexture } from './board.js';
import { handKey } from './cards.js';
import { preflopAdvice, rangePercent, CHARTS } from '../data/ranges.js';
import { judgeSize } from './sizing.js';

/**
 * @param {object} spot everything conceptOf takes, plus:
 * @param {string} spot.action     what you did
 * @param {number} [spot.amount]   total committed on a bet or raise
 * @param {Array<number>} [spot.hole]
 * @param {Array<number>} [spot.board]
 * @param {string} [spot.position] your seat, for the preflop charts
 * @param {string} [spot.raiser]   the seat that opened, when facing one
 * @param {object} [spot.sizing] the spot a bet or raise is sized in (core/sizing.js)
 * @returns {{concept: {id,why}, size: object|null} & ReturnType<typeof judgeDecision>}
 *   `size` grades how much you bet or raised, apart from whether you should
 *   have; `overall` folds the two into the one verdict a decision is counted by.
 */
export function judgeSpot(spot) {
  const concept = conceptOf(spot);
  // The opening charts cover the five seats that can open first in. The big
  // blind never opens — the pot is already raised or the hand is over — so a
  // spot that arrives here claiming otherwise gets the price grader rather
  // than a chart lookup that would throw.
  const chartable = spot.hole && spot.position
    && (!spot.firstIn || Boolean(CHARTS.rfi[spot.position]));
  const icm = concept.id === 'icm' && spot.tournament ? judgeIcm(spot) : null;
  const verdict = icm
    || (concept.id === 'preflop' && chartable
      ? judgePreflop(spot)
      : concept.id === 'cbet' && spot.board
        ? judgeCbet(spot)
        : judgeDecision(spot));
  const size = spot.action === 'bet' || spot.action === 'raise' ? judgeSize(spot) : null;
  return { concept, ...verdict, size };
}

const RANK = { bad: 0, ok: 1, skip: 1, good: 2 };

/**
 * A decision and its size, as one verdict: the size's, when the size is the
 * worse of the two. A 3-bet with the right hand to twice the open is a right
 * decision made the wrong size, and it counts as the mistake it is — in the
 * notes, the hand rating and the Log — while the table still shows both.
 */
export function overall(verdict) {
  const size = verdict && verdict.size;
  if (!size || RANK[size.level] >= RANK[verdict.level]) return verdict;
  return {
    ...verdict,
    level: size.level,
    id: size.id,
    head: size.head,
    body: size.body,
    better: size.better,
    params: size.params,
    cost: 0,
    costKnown: false,
  };
}

/* ------------------------------------------------------------------ *
 * Preflop: graded against the chart, not against the pot
 * ------------------------------------------------------------------ */

/**
 * A range mistake does not cost a computable number of chips in this hand —
 * it costs over the thousands of hands you play that seat. Saying "this cost
 * 4 chips" would be a made-up figure dressed as arithmetic, so these verdicts
 * report no cost and the review ranks them below the ones it can measure.
 */
const UNPRICED = { cost: 0, costKnown: false };

function judgePreflop(spot) {
  const { action, hole, position, raiser, firstIn } = spot;
  const hand = handKey(hole);
  // A limp is not an open: there is no raise to answer. The hands worth raising
  // over a limper are the ones worth raising first in from that seat, so the
  // opening chart is the one that applies, and the rest are folds.
  const limped = !firstIn && !raiser && Boolean(CHARTS.rfi[position]);
  const advice = preflopAdvice(hand, position, firstIn || limped ? { action: 'rfi' } : { action: 'vs_raise', raiser });
  const params = { hand, seat: position, pct: chartPercent(position) };

  // Limping first in: the one preflop action that is wrong against every
  // chart, which is why no chart contains it.
  if (firstIn && action === 'call') {
    return {
      kind: 'preflop',
      level: 'bad',
      id: 'limped', head: 'Limping gives the pot away',
      body: 'Calling the big blind first in lets everyone behind you play cheaply while you hold a hand you were '
        + 'not confident enough to raise. Raise {hand} or fold it.',
      params,
      better: advice.action === 'raise' ? 'Raise' : 'Fold',
      ...UNPRICED,
    };
  }

  const wanted = advice.action === 'raise' ? (firstIn || limped ? 'raise' : '3-bet') : advice.action;
  const did = action === 'bet' ? 'raise' : action;
  const right = (wanted === 'raise' || wanted === '3-bet') ? (did === 'raise') : did === wanted;

  if (right) {
    return {
      kind: 'preflop',
      level: 'good',
      head: firstIn ? 'Right side of the chart' : limped ? 'Right against the limp' : 'Correct against the open',
      body: advice.reason,
      params: {},
      better: null,
      ...UNPRICED,
    };
  }

  // Behind a limper: raise the hands the seat opens, fold the rest. Limping
  // along is neither.
  if (limped && did === 'call') {
    return advice.action === 'raise'
      ? {
        kind: 'preflop', level: 'ok', id: 'limped-behind', head: 'Raise the limper',
        body: '{hand} is worth a raise from {seat}. Limping behind invites the whole table in and hands away the '
          + 'lead: raise, and play the pot against one weak player instead.',
        params, better: 'Raise', ...UNPRICED,
      }
      : {
        kind: 'preflop', level: 'bad', id: 'over-limped', head: 'Limping behind with a fold',
        body: '{hand} is not worth a raise from {seat}, and a hand that is not worth a raise is not worth a call: '
          + 'it is behind, in a pot with several players, with nobody\'s lead to take.',
        params, better: 'Fold', ...UNPRICED,
      };
  }

  // Against an open the chart has three answers, and each has two wrong ones.
  // A re-raise where it calls, and a call where it re-raises, are neither of
  // them a fold, and are not graded as one.
  if (!firstIn && !limped && did === 'raise' && advice.action === 'call') {
    return {
      kind: 'preflop', level: 'ok', id: 'raised-a-call', head: 'A call here, not a 3-bet',
      body: '{hand} is a hand to play against this open, but as a call: too good to fold, not strong enough to '
        + '3-bet for value. Re-raised, it folds out the hands it beats and is called by the ones that beat it.',
      params, better: 'Call', ...UNPRICED,
    };
  }
  if (!firstIn && !limped && did === 'call' && advice.action === 'raise') {
    const value = advice.kind === 'value';
    return value
      ? {
        kind: 'preflop', level: 'bad', id: 'flatted-value', head: 'Too strong to just call',
        body: '{hand} 3-bets for value against this open. Calling lets the opener, and everybody still to act, see '
          + 'a flop cheaply, and keeps small the pot your best hands are meant to build.',
        params, better: '3-bet', ...UNPRICED,
      }
      : {
        kind: 'preflop', level: 'ok', id: 'flatted-bluff', head: 'This one 3-bets as a bluff',
        body: '{hand} is in the chart as a 3-bet bluff: it blocks the opener\'s best hands and plays well when it is '
          + 'called. Flatted, it is a weak hand in a raised pot.',
        params, better: '3-bet', ...UNPRICED,
      };
  }

  if (advice.action === 'fold') {
    if (!firstIn && !limped) {
      return {
        kind: 'preflop',
        level: 'bad',
        id: 'continued-outside-range', head: 'Too weak against the open',
        body: did === 'raise'
          ? '{hand} is not in the range that 3-bets against this open, nor the one that calls it. Re-raised, it is '
            + 'a bluff the opener\'s good hands are glad to see.'
          : '{hand} is not in the range that continues against this open. Calling with it is how a stack drips '
            + 'away: it is behind the hands that open, and often out of position.',
        params,
        better: 'Fold',
        ...UNPRICED,
      };
    }
    return {
      kind: 'preflop',
      level: 'bad',
      id: 'opened-outside-range', head: 'Outside the range',
      body: '{hand} is not in the {pct} of hands this seat plays. Hands like this are where a losing player '
        + 'quietly leaks their stack: they look playable, and they are dominated by everything that calls.',
      params,
      better: 'Fold',
      ...UNPRICED,
    };
  }

  // What is left is a fold of a hand the chart plays.
  return {
    kind: 'preflop',
    level: 'bad',
    id: 'folded-in-range', head: 'You folded a hand this seat plays',
    body: '{hand} is inside the range for {seat}. Folding it is not safe — it is passing up the pots this seat '
      + 'is supposed to win, which is where the money in position comes from.',
    params,
    better: advice.action === 'call' ? 'Call' : firstIn || limped ? 'Raise' : '3-bet',
    ...UNPRICED,
  };
}

const chartPercent = (position) => {
  const chart = CHARTS.rfi[position];
  return chart ? `${(rangePercent(chart) * 100).toFixed(0)}%` : '—';
};

/* ------------------------------------------------------------------ *
 * The continuation bet: graded against the board
 * ------------------------------------------------------------------ */

/**
 * The price grader reads a checked-to flop as "no bet faced" and grades on
 * equity alone, which misses the entire lesson: the same hand is a bet on one
 * board and a check on another, and the board is what says which.
 */
function judgeCbet(spot) {
  const { action, board, equity = 0, pot = 0, amount = 0 } = spot;
  const texture = describeTexture(board);
  const tags = texture.tags.join(', ');
  const betting = action === 'bet' || action === 'raise';
  const size = betting ? (amount - (spot.currentBet || 0)) / Math.max(1, pot) : 0;
  const params = { tags, equity: `${(equity * 100).toFixed(0)}%`, size: `${Math.round(size * 100)}%` };

  if (equity >= 0.65) {
    if (!betting) {
      return {
        kind: 'cbet', level: 'bad', id: 'checked-back-value', head: 'Checked back a hand that wanted to bet',
        body: 'You have {equity} on a {tags} board and they have shown weakness. Checking here wins the smallest '
          + 'pot available with the best hand.',
        params, better: texture.wet ? 'Bet big' : 'Bet small', cost: equity * pot * 0.5, costKnown: true,
      };
    }
    // With the size graded on its own (core/sizing.js), the bet is what is
    // judged here; only a spot with nothing to size it by is sized here too.
    if (spot.sizing) {
      return {
        kind: 'cbet', level: 'good', id: 'value-cbet', head: 'Right to bet a strong hand',
        body: 'You have {equity} on a {tags} board and they have shown weakness: betting builds the pot while you are '
          + 'ahead.',
        params, better: null, cost: 0, costKnown: true,
      };
    }
    const wantsBig = texture.wet;
    const wentBig = size >= 0.6;
    if (wantsBig === wentBig) {
      return {
        kind: 'cbet', level: 'good', id: 'good-cbet', head: 'Right bet on the right board',
        body: wantsBig
          ? 'A {tags} board gives them draws, and a big bet charges every one of them while you are ahead.'
          : 'A {tags} board missed them as often as it missed you. Small is enough, and it keeps their weak '
            + 'hands in.',
        params, better: null, cost: 0, costKnown: true,
      };
    }
    return {
      kind: 'cbet', level: 'ok', head: wantsBig ? 'Too small for this board' : 'Bigger than it needs to be',
      body: wantsBig
        ? 'A {tags} board is full of draws. At {size} of the pot you are charging them almost nothing to draw out.'
        : 'Nothing much can beat you on a {tags} board and nothing much is drawing. A smaller bet gets called by '
          + 'more of the hands you beat.',
      params, better: wantsBig ? 'Bet about three quarters' : 'Bet about a third', cost: 0, costKnown: true,
    };
  }

  if (texture.dry || !texture.wet) {
    return betting
      ? {
        kind: 'cbet', level: 'good', id: 'good-cbet-spot', head: 'Good spot to bet',
        body: 'A {tags} board missed their calling range too. A small bet folds out everything that missed, and '
          + 'that is most of what they have.',
        params, better: null, cost: 0, costKnown: true,
      }
      : {
        kind: 'cbet', level: 'ok', id: 'missed-free-cbet', head: 'A bet was free money here',
        body: 'You have {equity}, but on a {tags} board so do they. This is the flop your whole range can bet '
          + 'small on, and checking gives up a pot nobody wanted.',
        params, better: 'Bet small', cost: 0, costKnown: true,
      };
  }

  return betting
    ? {
      kind: 'cbet', level: 'bad', id: 'cbet-wrong-board', head: 'Bluffing into the wrong board',
      body: 'You have {equity} on a {tags} board. That is a board they connect with — too many of their hands '
        + 'will call, and the ones that fold were folding anyway.',
      params, better: 'Check and give up cheaply', cost: (amount - (spot.currentBet || 0)) * 0.5, costKnown: true,
    }
    : {
      kind: 'cbet', level: 'good', id: 'good-giveup', head: 'Right to give up',
      body: '{equity} on a {tags} board. They have too many hands that continue — betting here donates chips. '
        + 'Checking costs nothing and keeps the pot small.',
      params, better: null, cost: 0, costKnown: true,
    };
}
