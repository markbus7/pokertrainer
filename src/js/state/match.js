/**
 * Matches: a game with a finish line.
 *
 * A cash table goes on until you stand up. A duel, and later a regatta, ends:
 * somebody has all the chips. What makes that work is a blind clock — the
 * blinds go up on a schedule, so stacks that start deep end up short and the
 * game finishes — and a way of saying how well you played the winning of it.
 *
 * Free of the DOM so it can be tested.
 */

/**
 * The duel's blinds, in chips, as [small, big]. Both players start with 200 —
 * a hundred big blinds — and every LEVEL_HANDS hands the blinds step up, so
 * by the last level a stack is four big blinds and the next hand is the one.
 */
export const DUEL_LEVELS = [[1, 2], [2, 4], [3, 6], [4, 8], [6, 12], [10, 20], [15, 30], [25, 50]];
export const LEVEL_HANDS = 8;

/**
 * The blinds for the nth hand (0 for the first) and what is left of the level.
 * @returns {{small:number, big:number, level:number, left:number, last:boolean}}
 */
export function blindsFor(handIndex, levels = DUEL_LEVELS, perLevel = LEVEL_HANDS) {
  const raw = Math.floor(Math.max(0, handIndex) / perLevel);
  const level = Math.min(raw, levels.length - 1);
  const last = level === levels.length - 1;
  const [small, big] = levels[level];
  return { small, big, level, last, left: last ? Infinity : perLevel - (handIndex % perLevel) };
}

/**
 * Stars for a duel, for how well it was played rather than for winning it:
 * one for the win, a second for deciding soundly 92% of the time, a third
 * for 97%. A decision made with help is not a sound
 * one, and a win with too few decisions to judge (the other player ran into
 * aces) is a win and nothing more.
 *
 * The bars are high because the coach is kind: it calls a decision a mistake
 * only when it clearly is one, and a player choosing at random is still
 * "sound" four times in five (measured over duels with tools/measure-duel.mjs:
 * a coach-perfect hero scores 100%, one who plays well 95%, one who plays
 * half at random 91%, one who plays entirely at random 82%). Seventy-five per
 * cent would have given two stars for guessing.
 *
 * @param {{won:boolean, decisions:number, sound:number}} result
 * @returns {0|1|2|3}
 */
export const MIN_DECISIONS = 8;
export const STAR_SHARE = { two: 0.92, three: 0.97 };
export function duelStars({ won, decisions, sound }) {
  if (!won) return 0;
  if (decisions < MIN_DECISIONS) return 1;
  const share = sound / decisions;
  if (share >= STAR_SHARE.three) return 3;
  if (share >= STAR_SHARE.two) return 2;
  return 1;
}

/**
 * What each new star pays, the first time it is earned at a stop: the further
 * down the river, the more. A star already held pays nothing, so a rematch is
 * worth playing only for the one it does not have.
 */
export const STAR_PEARLS = [0, 30, 40, 70];
export function starPearls(stopIndex, before, after) {
  let total = 0;
  for (let s = before + 1; s <= after; s++) total += STAR_PEARLS[s];
  return Math.round(total * (1 + 0.25 * Math.max(0, stopIndex)));
}

/** A duel is over when one of the two has no chips. */
export function duelOver(heroStack, bossStack) {
  if (heroStack <= 0) return { over: true, won: false };
  if (bossStack <= 0) return { over: true, won: true };
  return { over: false, won: false };
}

/** The share of graded decisions that were sound, 0..1, for a list of graded decisions. */
export function soundShare(graded) {
  const sound = graded.filter((d) => d.level !== 'bad' && !d.helped).length;
  return { decisions: graded.length, sound, share: graded.length ? sound / graded.length : 0 };
}
