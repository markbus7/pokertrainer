/**
 * Drills for the Gulf's chapters.
 *
 * Value betting, the turn and river, 3-bet pots and multiway pots are about
 * judgement in whole spots, and a spot generated at random is as likely to be
 * a coin flip as a lesson. So those four ask from a bank of spots written out
 * by hand, each with the reason the right answer is right — the same reasons
 * the guided lesson gives. Push or fold is arithmetic, and is generated from
 * the same shares the bots shove with (engine/pushfold.js), keeping well clear
 * of the edge of the range so every question has one answer.
 */

import { parseCards, expandHandKey, ALL_HAND_KEYS } from '../core/cards.js';
import { STRENGTH_RANK } from '../data/handStrength.js';
import { POSITION_INFO } from '../data/ranges.js';
import { pushShare, callShare } from '../engine/pushfold.js';
import { randInt } from '../core/rng.js';
import { buildChoices } from './helpers.js';
import { t } from '../i18n/index.js';

/* ---- the banks --------------------------------------------------------- */

/**
 * @typedef {object} Spot
 * @property {string} q       the question
 * @property {string} right   the right answer
 * @property {string[]} wrong two wrong answers
 * @property {string} why     why the right answer is right
 * @property {string} [hole]  your cards, e.g. 'KsJs'
 * @property {string} [board]
 * @property {string} [position]
 */

export const BANKS = {
  value: [
    {
      q: 'River. A calling station has called the flop and the turn, and checks to you. You have top pair. What do you do?',
      hole: 'KsJs', board: 'Kd8c4h2s9d',
      right: 'Bet three-quarters of the pot',
      wrong: ['Check behind', 'Bet a quarter of the pot'],
      why: 'A station calls with any pair and many worse hands, and calls a big bet almost as often as a small one. Size for the caller: bet big.',
    },
    {
      q: 'River. A careful player called the flop and has checked twice since. You hold queens on an ace-high board. What do you do?',
      hole: 'QhQd', board: 'Ac7d3s5h2c',
      right: 'Check — a careful player calls with an ace and folds what you beat',
      wrong: ['Bet big for value', 'Bet small for value'],
      why: 'Which worse hands call? A careful player folds small pairs to a river bet and calls with aces. Only better hands pay, so check.',
    },
    {
      q: 'River. The calling station checks to you. You hold second pair. What do you do?',
      hole: 'Td9d', board: 'Ac6s3hTc2d',
      right: 'Bet about half the pot — worse pairs and ace-high still call',
      wrong: ['Check — second pair is too weak to bet', 'Bet the whole pot as a bluff'],
      why: 'Against a station the list of worse hands that call is long: sixes, threes, twos, even king-high. That is thin value, and it is where the money is.',
    },
    {
      q: 'Which of these is a value bet?',
      right: 'A bet that worse hands call',
      wrong: ['A bet that makes better hands fold', 'Any bet made with a strong hand'],
      why: 'A value bet is defined by who calls it: worse hands. A bet that makes better hands fold is a bluff, and a strong hand bet into only better hands is neither.',
    },
    {
      q: 'You flop a very strong hand against one caller, with 100 big blinds behind. What plan builds the biggest pot?',
      right: 'Bet every street, each bet bigger with the pot',
      wrong: ['Check the flop and turn, then shove the river', 'Shove the flop'],
      why: 'Bets that grow with the pot — flop, turn, river — get a stack in while each one still looks like a price worth paying. One huge bet scares off the hands that would have paid three smaller ones.',
    },
    {
      q: 'Against a careful player who calls only with good hands, how big should a thin value bet be?',
      right: 'Small — a third to half the pot, so their medium hands still call',
      wrong: ['Big — make them pay', 'The size does not matter'],
      why: 'A careful player calls a small bet with medium hands and folds them to a big one. Size so that the worse hands you want can still call.',
    },
  ],
  streets: [
    {
      q: 'You raised before the flop and bet the flop. They called. The turn is the 4, which completes straights. You have no pair. What now?',
      hole: 'AsKc', board: '8h7h5d4c',
      right: 'Check, and usually give up — the turn helps the hands that called',
      wrong: ['Barrel — keep the pressure on', 'Shove — they cannot have it'],
      why: 'A flop call on 8-7-5 is full of sixes, pairs and draws, and the 4 makes straights for them. A second bet here has no story behind it.',
    },
    {
      q: 'You raised before the flop, bet J-7-2 and were called. The turn is an ace. What now?',
      hole: 'KdQd', board: 'Js7d2cAh',
      right: 'Bet again — the ace is better for your range than for theirs',
      wrong: ['Check — the ace may have hit them', 'Check and fold to any bet'],
      why: 'You raised before the flop, so aces are in your range. Their flop call on J-7-2 is mostly jacks, sevens and draws, and an ace scares all of them.',
    },
    {
      q: 'You bet the flop with top pair, weak kicker, and were called. The turn is a blank. The stacks are deep. What is usually best?',
      hole: 'Ts9s', board: 'Td8c3h2d',
      right: 'Check, to keep the pot the size of your hand',
      wrong: ['Bet the pot to protect it', 'Shove — top pair is strong'],
      why: 'A weak top pair at a deep stack wins small pots and loses big ones. Checking one street keeps the pot small and lets worse hands bluff.',
    },
    {
      q: 'River. Your nut flush draw missed and you have ace-high. Your opponent checks. What are your choices?',
      hole: 'Ah5h', board: 'Kh9h2c7s3d',
      right: 'Bluff or give up — ace-high rarely wins a showdown here',
      wrong: ['Bet small for value — ace-high is often best', 'Check, then call any bet'],
      why: 'A missed draw has almost no showdown value. It wins the pot only by betting, so it either bluffs with a good story or gives up.',
    },
    {
      q: 'A careful player who has not bluffed all night bets the pot on a dry river. You hold top pair, medium kicker. What does the price say?',
      hole: 'Qs9c', board: 'Qd7h2c4s3d',
      right: 'Fold — you need to win one time in three, and they rarely bluff',
      wrong: ['Call — top pair is too good to fold', 'Raise all in'],
      why: 'A pot-sized bet asks you to be good 33% of the time. On a dry board with no missed draws, a player who never bluffs is value almost every time.',
    },
    {
      q: 'Facing a pot-sized bet on the river, how often do you need to win for a call to break even?',
      right: 'One time in three — 33%',
      wrong: ['Half the time — 50%', 'One time in four — 25%'],
      why: 'You call one pot to win three: the pot, their bet and your call. One divided by three is 33%.',
    },
  ],
  threebet: [
    {
      q: 'Before the flop, 20 big blinds go into the pot and 80 sit behind each player. What is the stack-to-pot ratio on the flop?',
      right: 'About 4',
      wrong: ['About 13', 'About 1'],
      why: '80 behind divided by a pot of 20 is 4. At that depth top pair is a hand you get all in with.',
    },
    {
      q: 'You open on the button with KJ offsuit and the big blind 3-bets. What is usually best?',
      hole: 'KcJd', position: 'BTN',
      right: 'Fold — it is dominated by the hands that 3-bet',
      wrong: ['Call — two broadway cards play well', '4-bet to take control'],
      why: 'A 3-betting range holds AK, KQ and AJ, which crush KJ. Flopping a king or a jack too often means second best in a big pot.',
    },
    {
      q: 'You open in the cutoff with queens and the button 3-bets. What is best?',
      hole: 'QsQh', position: 'CO',
      right: '4-bet — queens are among your very best hands',
      wrong: ['Fold — a 3-bet means aces', 'Call and fold if an ace or a king comes'],
      why: 'Queens are near the top of any range that opens and gets 3-bet. 4-bet them for value; folding or playing scared wastes one of your best hands.',
    },
    {
      q: 'You 3-bet before the flop and were called. The flop is K-7-2 of three suits. What is a good plan?',
      hole: 'AdQc', board: 'Ks7h2c',
      right: 'C-bet small, about a third of the pot',
      wrong: ['Check and give up', 'Bet the whole pot'],
      why: 'A dry king-high flop suits the 3-bettor, who has more kings and big pairs. A small bet takes the pot often and risks little when called.',
    },
    {
      q: 'You open from the small blind with a small suited connector, and the big blind 3-bets. What is usually best?',
      hole: '7c6c', position: 'SB',
      right: 'Fold',
      wrong: ['Call — suited connectors play well in big pots', 'Call, and check-fold any flop you miss'],
      why: 'Out of position in a 3-bet pot, the stack is short and you act first: suited connectors miss most flops and cannot win the big pots that would pay for them.',
    },
    {
      q: 'In a 3-bet pot you flop top pair, good kicker, with a stack-to-pot ratio of about 4. They raise your c-bet. What now?',
      hole: 'AhKs', board: 'Kd8c3s',
      right: 'Get it in — at this depth top pair, good kicker is a hand to go with',
      wrong: ['Fold — a raise means two pair', 'Call, and fold the turn'],
      why: 'With only four pots behind, there is no room to fold top pair, good kicker cheaply. Their raising range holds draws and worse kings too.',
    },
  ],
  multiway: [
    {
      q: 'You bluff into three opponents. Each would fold two times in three. Roughly how often does everybody fold?',
      right: 'About 30% of the time',
      wrong: ['About 67% of the time', 'About 90% of the time'],
      why: 'Every player has to fold: two-thirds, three times over, is about 30%. A bluff that works against one player mostly fails against three.',
    },
    {
      q: 'You raised before the flop and three players called. The flop is J-9-8 with two hearts. You hold AK with no heart. What is usually best?',
      hole: 'AsKd', board: 'Jh9h8c',
      right: 'Check',
      wrong: ['C-bet — you were the preflop raiser', 'Bet big to thin the field'],
      why: 'A connected two-tone board hits three calling ranges hard. A c-bet with nothing here is a bluff into a crowd.',
    },
    {
      q: 'Four players see a flop with two spades, and you hold the 6♠ 5♠. Why be careful?',
      hole: '6s5s', board: 'Ks9s2d',
      right: 'With several players in, a bigger flush is more likely',
      wrong: ['Flush draws are worthless in multiway pots', 'There is no reason — a flush is a flush'],
      why: 'Your flush can arrive and still lose. With four players, somebody holding a higher spade is far more likely than heads up.',
    },
    {
      q: 'You flop a set in a pot with three opponents. What is usually best?',
      hole: '7d7c', board: 'Kc7h2s',
      right: 'Bet',
      wrong: ['Check to trap them', 'Check, and fold to a big bet'],
      why: 'Several players can pay you, and every free card is a chance for one of them to outdraw you. Bet strong hands in crowded pots.',
    },
    {
      q: 'Four-way pot. One player bets and another calls before you. You hold top pair, weak kicker. What is usually best?',
      hole: 'Kd6c', board: 'Kh9s5d',
      right: 'Fold — a bet and a call in a crowd usually beat a weak top pair',
      wrong: ['Raise to find out where you stand', 'Call — top pair is always good'],
      why: 'A bet and a call with more players still to come is strength. Weak top pair is good heads up; in a crowd it is often second best.',
    },
    {
      q: 'Four players see a flop. You hold the nut flush draw. How do you feel about the crowd?',
      hole: 'AsTs', board: 'Ks8s3d',
      right: 'Happy — a draw to the best hand gets paid by several players',
      wrong: ['Worried — draws are bad in multiway pots', 'Rushed — shove now to win it'],
      why: 'When the nut flush arrives, several players can pay you. Draws to the best hand get better with every caller.',
    },
  ],
};

/** One spot from a bank, as a drill question. */
function fromBank(module, rng) {
  const bank = BANKS[module];
  const s = bank[randInt(rng, bank.length)];
  const { options, answer } = buildChoices(rng, t(s.right), s.wrong.map((w) => t(w)));
  const scenario = {};
  if (s.hole) scenario.hole = parseCards(s.hole);
  if (s.board) scenario.board = parseCards(s.board);
  if (s.position) Object.assign(scenario, { position: s.position, heroSeat: s.position, positionName: t(POSITION_INFO[s.position].name) });
  return {
    module,
    difficulty: 4,
    scenario: Object.keys(scenario).length ? scenario : null,
    question: t(s.q),
    options,
    answer,
    explanation: t(s.why),
    xp: 24,
  };
}

export const valueDrill = (rng) => fromBank('value', rng);
export const streetsDrill = (rng) => fromBank('streets', rng);
export const threebetDrill = (rng) => fromBank('threebet', rng);
export const multiwayDrill = (rng) => fromBank('multiway', rng);

/* ---- push or fold -------------------------------------------------------- */

/** How much wider than an average seat each seat shoves: later seats, wider. */
export const SEAT_WIDTH = { UTG: 0.6, HJ: 0.75, CO: 0.9, BTN: 1.2, SB: 1.4 };
const STACKS = [3, 4, 5, 6, 8, 10, 12];
/** Not asked about a hand this close to the edge of the range: it has no one answer. */
const MARGIN = 0.12;

/** The share of hands to shove first in, by stack and seat. */
export const shoveShare = (stackBb, seat) => Math.min(1, pushShare(stackBb) * SEAT_WIDTH[seat]);
/** Where a hand stands among the 169: 0 the best, 1 the worst. */
export const handPercentile = (key) => STRENGTH_RANK[key] / 169;

/**
 * Folded to you, short: shove or fold. A raise is offered too, because it is
 * the mistake the chapter is about.
 */
export function shoveDrill(rng) {
  for (let i = 0; i < 60; i++) {
    const stack = STACKS[randInt(rng, STACKS.length)];
    const seats = Object.keys(SEAT_WIDTH);
    const seat = seats[randInt(rng, seats.length)];
    const hand = ALL_HAND_KEYS[randInt(rng, ALL_HAND_KEYS.length)];
    const cut = shoveShare(stack, seat);
    const p = handPercentile(hand);
    if (Math.abs(p - cut) < MARGIN) continue;
    const shove = p < cut;
    const seatName = t(POSITION_INFO[seat].name);
    const { options, answer } = buildChoices(rng, shove ? t('Shove all in') : t('Fold'), [shove ? t('Fold') : t('Shove all in'), t('Raise to 2.5 big blinds')]);
    const combos = expandHandKey(hand);
    return {
      module: 'pushfold',
      difficulty: 4,
      scenario: { hole: combos[randInt(rng, combos.length)], position: seat, heroSeat: seat, positionName: seatName },
      question: t('You have {n} big blinds in the {seat}, and it is folded to you. What do you do?', { n: stack, seat: seatName }),
      options,
      answer,
      explanation: t('At {n} big blinds from the {seat} you shove about {pct}% of hands, and {hand} is {where} that range. A raise to 2.5 commits you anyway: shove or fold.', {
        n: stack, seat: seatName, pct: Math.round(cut * 100), hand, where: shove ? t('well inside') : t('well outside'),
      }),
      xp: 24,
    };
  }
  return null;
}

/** In the big blind, facing a shove: call or fold, about half as wide as shoving. */
// Only from 8 big blinds up: shorter than that the real calling ranges are
// very wide and the engine's share is a rougher guide than a question can lean on.
const CALL_STACKS = [8, 10, 12];
export function callShoveDrill(rng) {
  for (let i = 0; i < 60; i++) {
    const stack = CALL_STACKS[randInt(rng, CALL_STACKS.length)];
    const hand = ALL_HAND_KEYS[randInt(rng, ALL_HAND_KEYS.length)];
    // You have posted one big blind; the shove is the stack, and the small blind is in the pot.
    const price = (stack - 1) / (stack + stack + 0.5);
    const cut = callShare(stack, price);
    const p = handPercentile(hand);
    if (Math.abs(p - cut) < MARGIN) continue;
    const call = p < cut;
    const seatName = t(POSITION_INFO.BB.name);
    const { options, answer } = buildChoices(rng, call ? t('Call') : t('Fold'), [call ? t('Fold') : t('Call')]);
    const combos = expandHandKey(hand);
    return {
      module: 'pushfold',
      difficulty: 4,
      scenario: { hole: combos[randInt(rng, combos.length)], position: 'BB', heroSeat: 'BB', positionName: seatName },
      question: t('The button shoves {n} big blinds, and it is folded to you in the big blind. Call or fold?', { n: stack }),
      options,
      answer,
      explanation: t('Against a {n} big blind shove you call with about {pct}% of hands — roughly half as wide as you would shove, because a call cannot win by a fold. {hand} is {where} that range.', {
        n: stack, pct: Math.round(cut * 100), hand, where: call ? t('well inside') : t('well outside'),
      }),
      xp: 24,
    };
  }
  return null;
}
