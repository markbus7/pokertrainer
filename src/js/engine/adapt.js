/**
 * Opponents who notice how you play.
 *
 * Six fixed archetypes are the right opponents for a beginner: each has one
 * clean leak, and the whole of exploitative play is learning to see it and
 * attack it. But nobody real sits still. Beat a table by folding to every
 * river bet and the regulars start betting every river; the leak you were
 * attacking closes, and a new one opens in your own game.
 *
 * So adaptation is a rung on the ladder, not a setting. Below Regular — the
 * rank where the Exploitative Play module unlocks — nothing adapts at all,
 * because a reader who has not yet learned to read a static opponent cannot
 * learn anything from a moving one. From there it ramps in.
 */

/** The rank where opponents start watching, and where they are fully awake. */
export const ADAPT_FROM = 5;
export const ADAPT_FULL = 8;

/**
 * How much of an opponent's willingness to adapt is switched on at this rank.
 * @returns {number} 0 below Regular, 1 at Pro and above.
 */
export function adaptStrength(level) {
  if (level < ADAPT_FROM) return 0;
  return Math.min(1, (level - ADAPT_FROM + 1) / (ADAPT_FULL - ADAPT_FROM + 1));
}

/**
 * How many decisions they need before concluding anything.
 *
 * The same bar the app applies to itself: a fold rate over three spots is not
 * a read, it is a coin landing the same way twice. An opponent that adjusts
 * off two hands would teach the reader superstition.
 */
export const EVIDENCE = 12;

export const emptyMemory = () => ({ facedBet: 0, folded: 0 });

/** One of the reader's decisions, as the table saw it. */
export function watch(memory, { facingBet, action }) {
  if (!facingBet) return memory;
  memory.facedBet++;
  if (action === 'fold') memory.folded++;
  return memory;
}

/** The reader's fold-to-bet rate, or null while it is still noise. */
export function foldRate(memory) {
  if (!memory || memory.facedBet < EVIDENCE) return null;
  return memory.folded / memory.facedBet;
}

/**
 * What a player who folds this often is worth bluffing at.
 *
 * Half is taken as ordinary: fold to far more than that and a bluff prints,
 * fold to far less and it burns. The shift is bounded at both ends — an
 * opponent who triples their bluffing off one session is not observant, they
 * are a different player, and the reader would be learning to beat noise.
 */
export const NEUTRAL_FOLD = 0.5;
const MAX_SHIFT = 0.9;

export function adaptProfile(base, memory, level) {
  const strength = adaptStrength(level) * (base.adapts || 0);
  const rate = foldRate(memory);
  if (!strength || rate === null) return base;

  const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (rate - NEUTRAL_FOLD) * 2)) * strength;
  return {
    ...base,
    bluff: Math.max(0, Math.min(0.9, base.bluff * (1 + shift))),
    // The other side of the same read: somebody who folds too much is also
    // somebody whose own bets mean something, so their bets get more respect.
    respect: Math.max(0.5, Math.min(1.6, base.respect * (1 + shift * 0.25))),
    adapted: shift,
  };
}

/**
 * What the opponent would say about you, if opponents talked.
 *
 * Measured on what they actually do, not on how far their dial moved. The
 * nit's dial shifts 13% at a reader who folds to everything, and his bluffing
 * goes from 4% to 4.5% — announcing that as "Rocky has adjusted" would send
 * the reader hunting for a change they cannot see, and teach them to distrust
 * the notice. Three points of bluffing frequency is a difference you can feel
 * across a session.
 */
const NOTICEABLE = 0.03;

export function adaptationNote(base, memory, level) {
  const adapted = adaptProfile(base, memory, level);
  if (!adapted.adapted) return null;
  if (Math.abs(adapted.bluff - base.bluff) < NOTICEABLE) return null;
  return {
    name: base.name,
    foldRate: foldRate(memory),
    harder: adapted.adapted > 0,
    bluffWas: base.bluff,
    bluffNow: adapted.bluff,
  };
}
