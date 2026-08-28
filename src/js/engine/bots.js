/**
 * Opponents.
 *
 * Each profile is a recognisable player type with a real, exploitable leak.
 * That is the point: you beat online poker by noticing that the nit never
 * bluffs and the station never folds, then attacking exactly that.
 */

import { handKey, makeDeck } from '../core/cards.js';
import { evaluateHand } from '../core/evaluator.js';
import { requiredEquity } from '../core/odds.js';
import { HAND_STRENGTH, STRENGTH_RANK } from '../data/handStrength.js';
import { CHARTS } from '../data/ranges.js';
import { makeRng } from '../core/rng.js';

export const PROFILES = {
  rock: {
    key: 'rock',
    name: 'Rocky',
    style: 'The Nit',
    emoji: '🪨',
    openPct: 0.12,
    defendPct: 0.10,
    threeBetPct: 0.03,
    aggression: 0.25,
    bluff: 0.04,
    callDown: 0.22,
    respect: 1.25,
    sizings: [0.5, 0.66],
    blurb: 'Folds and folds, then wakes up with the nuts.',
    tell: 'If Rocky raises, Rocky has it. He has never bluffed in his life.',
    counter: 'Steal his blinds relentlessly, and fold the moment he raises you.',
  },
  tag: {
    key: 'tag',
    name: 'Tessa',
    style: 'Tight-Aggressive',
    emoji: '🎯',
    openPct: 0.22,
    defendPct: 0.24,
    threeBetPct: 0.07,
    aggression: 0.55,
    bluff: 0.22,
    callDown: 0.45,
    respect: 1.0,
    sizings: [0.5, 0.66, 0.75],
    blurb: 'Plays few hands, but plays them hard. The standard winning reg.',
    tell: 'She only continues with real equity, and she barrels when the board favours her range.',
    counter: 'Give her credit on scary boards, but attack when she checks twice — she gives up.',
  },
  lag: {
    key: 'lag',
    name: 'Leo',
    style: 'Loose-Aggressive',
    emoji: '🔥',
    openPct: 0.38,
    defendPct: 0.42,
    threeBetPct: 0.13,
    aggression: 0.72,
    bluff: 0.38,
    callDown: 0.5,
    respect: 0.85,
    sizings: [0.66, 0.75, 1.0],
    blurb: 'Applies pressure in every pot and makes you guess.',
    tell: 'He bets far too often for his range to be strong.',
    counter: 'Widen your calling range and let him bluff into you. Trap with strong hands.',
  },
  station: {
    key: 'station',
    name: 'Stan',
    style: 'Calling Station',
    emoji: '🚉',
    openPct: 0.30,
    defendPct: 0.62,
    threeBetPct: 0.02,
    aggression: 0.12,
    bluff: 0.02,
    callDown: 0.88,
    respect: 0.7,
    sizings: [0.33, 0.5],
    blurb: 'Came to see cards, not to fold them.',
    tell: 'He calls with any piece of the board, and almost never raises.',
    counter: 'Never bluff him. Value bet thin, three streets, and size up — he will pay.',
  },
  maniac: {
    key: 'maniac',
    name: 'Max',
    style: 'The Maniac',
    emoji: '💥',
    openPct: 0.58,
    defendPct: 0.55,
    threeBetPct: 0.22,
    aggression: 0.86,
    bluff: 0.55,
    callDown: 0.55,
    respect: 0.7,
    sizings: [0.75, 1.0, 1.35],
    blurb: 'Raises everything. Occasionally has aces.',
    tell: 'Enormous bets with nothing at all, over and over.',
    counter: 'Tighten up, stop bluffing, and wait to snap him off with a real hand.',
  },
  pro: {
    key: 'pro',
    name: 'Nova',
    style: 'Solid Regular',
    emoji: '🧊',
    openPct: 0.24,
    defendPct: 0.34,
    threeBetPct: 0.09,
    aggression: 0.6,
    bluff: 0.3,
    callDown: 0.52,
    respect: 1.0,
    usesCharts: true,
    sizings: [0.33, 0.5, 0.75],
    blurb: 'Plays the charts you are learning, and plays them well.',
    tell: 'Balanced. There is no obvious leak to attack.',
    counter: 'Play your own solid game. Grind small edges and avoid marginal spots out of position.',
  },
};

export const PROFILE_KEYS = Object.keys(PROFILES);

export function getProfile(key) {
  return PROFILES[key] || PROFILES.tag;
}

/* ------------------------------------------------------------------ *
 * Hand strength estimation
 * ------------------------------------------------------------------ */

/**
 * Equity against `opponents` random hands, by simulation. Bots do not get to
 * see anyone's cards — they estimate from their own hand and the board, the
 * same information a human has.
 */
function monteCarlo(hole, board, table, rng, trials, opponents) {
  const variant = table.variant;
  const used = new Set([...hole, ...board]);
  const deck = makeDeck(variant.shortDeck).filter((c) => !used.has(c));
  const need = 5 - board.length;
  const draw = opponents * variant.holeCards + need;
  if (draw > deck.length) return 0.5;

  let total = 0;
  for (let t = 0; t < trials; t++) {
    for (let k = 0; k < draw; k++) {
      const j = k + Math.floor(rng() * (deck.length - k));
      const tmp = deck[k]; deck[k] = deck[j]; deck[j] = tmp;
    }
    const offset = opponents * variant.holeCards;
    const full = board.concat(deck.slice(offset, offset + need));
    const heroScore = evaluateHand(hole, full, variant);
    let best = heroScore;
    let ties = 1;
    for (let o = 0; o < opponents; o++) {
      const villain = deck.slice(o * variant.holeCards, (o + 1) * variant.holeCards);
      const score = evaluateHand(villain, full, variant);
      if (score > best) { best = score; ties = 1; } else if (score === best) ties++;
    }
    if (heroScore === best) total += 1 / ties;
  }
  return total / trials;
}

/* ------------------------------------------------------------------ *
 * Decisions
 * ------------------------------------------------------------------ */

/** Later position -> play more hands. 0 (big blind) .. 1 (button). */
function positionFactor(table, player) {
  const order = ['BB', 'SB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN'];
  const idx = order.indexOf(player.position);
  return idx < 0 ? 0.5 : idx / (order.length - 1);
}

function chooseSizing(profile, rng, pot, bigBlind) {
  const fraction = profile.sizings[Math.floor(rng() * profile.sizings.length)];
  return Math.max(bigBlind, Math.round(pot * fraction));
}

function pickLegal(legal, type) {
  return legal.find((a) => a.type === type);
}

/** Clamp a desired total bet into the legal window. */
function raiseTo(legal, type, desiredTotal) {
  const spec = pickLegal(legal, type);
  if (!spec) return null;
  const amount = Math.max(spec.min, Math.min(Math.round(desiredTotal), spec.max));
  return { type, amount };
}

/**
 * The bot's move.
 * @returns {{type:string, amount?:number, note?:string}}
 */
export function botAction(table, player, rngIn) {
  const rng = rngIn || table.rng || makeRng();
  const profile = getProfile(player.profile);
  const legal = table.legalActions(player);
  if (!legal.length) return { type: 'check' };

  const toCall = Math.max(0, table.currentBet - player.committed);
  const pot = table.totalPot;
  const canCheck = !!pickLegal(legal, 'check');

  return table.street === 'preflop'
    ? preflopDecision({ table, player, profile, legal, rng, toCall, pot, canCheck })
    : postflopDecision({ table, player, profile, legal, rng, toCall, pot, canCheck });
}

function preflopDecision({ table, player, profile, legal, rng, toCall, pot, canCheck }) {
  const opponents = table.contestants.length - 1;
  const strength = table.variant.omaha
    ? monteCarlo(player.hole, [], table, rng, 300, 1)
    : (HAND_STRENGTH[handKey(player.hole)] ?? 0.42);

  // Chart players use the real opening ranges; everyone else uses a
  // percentile cut widened or tightened by position.
  const posFactor = positionFactor(table, player);
  let openThreshold = profile.openPct * (0.55 + 1.1 * posFactor);
  if (profile.usesCharts && !table.variant.omaha) {
    const chart = CHARTS.rfi[player.position] || CHARTS.rfi.CO;
    const inRange = chart.has(handKey(player.hole));
    openThreshold = inRange ? 1 : 0;
  }

  const rank = table.variant.omaha ? null : STRENGTH_RANK[handKey(player.hole)];
  const percentile = rank ? rank / 169 : 1 - strength;

  const facingRaise = toCall > table.bigBlind;
  const raiseSpec = pickLegal(legal, 'raise') || pickLegal(legal, 'bet');

  // --- Nobody has raised: open or check the option -----------------
  if (!facingRaise) {
    const opening = profile.usesCharts ? openThreshold === 1 : percentile <= openThreshold;
    if (opening && raiseSpec) {
      const open = Math.round(table.bigBlind * (2.2 + rng() * 1.1) + table.bigBlind * opponents * 0.35);
      return { ...raiseTo(legal, raiseSpec.type, open), note: 'opening' };
    }
    if (canCheck) return { type: 'check' };
    // Limping is a leak; loose profiles do it anyway.
    if (percentile <= profile.defendPct && pickLegal(legal, 'call')) return { type: 'call', note: 'limp' };
    return { type: 'fold' };
  }

  // --- Facing a raise ----------------------------------------------
  const threeBetCut = profile.threeBetPct;
  const wantsThreeBet = percentile <= threeBetCut
    || (rng() < profile.bluff * 0.35 && percentile <= threeBetCut * 4);

  if (wantsThreeBet && raiseSpec) {
    const target = Math.round(table.currentBet * (2.8 + rng() * 0.9));
    return { ...raiseTo(legal, raiseSpec.type, target), note: '3-bet' };
  }

  const priceIn = requiredEquity(toCall, pot);
  const defendCut = profile.defendPct * (0.7 + 0.8 * posFactor)
    * (toCall > table.bigBlind * 6 ? 0.45 : 1);
  if (percentile <= defendCut && strength > priceIn * profile.respect * 0.9) {
    if (pickLegal(legal, 'call')) return { type: 'call', note: 'defend' };
  }
  if (canCheck) return { type: 'check' };
  return { type: 'fold' };
}

function postflopDecision({ table, player, profile, legal, rng, toCall, pot, canCheck }) {
  const opponents = Math.max(1, table.contestants.length - 1);
  const trials = opponents > 2 ? 220 : 320;
  const equity = monteCarlo(player.hole, table.board, table, rng, trials, opponents);

  const raiseSpec = pickLegal(legal, 'raise') || pickLegal(legal, 'bet');
  const needed = toCall > 0 ? requiredEquity(toCall, pot) : 0;
  const heroIsAggressor = table.lastAggressor === player;

  // --- Facing a bet -------------------------------------------------
  if (toCall > 0) {
    const raiseCut = 0.78 - profile.aggression * 0.1;
    if (equity > raiseCut && raiseSpec && rng() < 0.35 + profile.aggression * 0.5) {
      return { ...raiseTo(legal, raiseSpec.type, table.currentBet + chooseSizing(profile, rng, pot, table.bigBlind)), note: 'value raise' };
    }
    // Bluff-raise, but only from profiles that actually do it.
    if (equity < 0.3 && raiseSpec && rng() < profile.bluff * 0.25 && table.street !== 'river') {
      return { ...raiseTo(legal, raiseSpec.type, table.currentBet + chooseSizing(profile, rng, pot, table.bigBlind)), note: 'bluff raise' };
    }

    const threshold = needed * profile.respect;
    const stationSlack = profile.callDown * 0.16;
    if (equity + stationSlack > threshold && pickLegal(legal, 'call')) {
      return { type: 'call', note: 'call' };
    }
    if (canCheck) return { type: 'check' };
    return { type: 'fold' };
  }

  // --- Checked to -----------------------------------------------------
  if (raiseSpec) {
    const valueCut = 0.62 - profile.aggression * 0.08;
    if (equity > valueCut && rng() < 0.55 + profile.aggression * 0.4) {
      return { ...raiseTo(legal, raiseSpec.type, chooseSizing(profile, rng, pot, table.bigBlind)), note: 'value bet' };
    }
    const bluffChance = profile.bluff * (heroIsAggressor ? 1.15 : 0.8) * (table.street === 'river' ? 0.7 : 1);
    if (equity < 0.42 && rng() < bluffChance) {
      return { ...raiseTo(legal, raiseSpec.type, chooseSizing(profile, rng, pot, table.bigBlind)), note: 'bluff' };
    }
    // Thin value from stations who bet only when they connect.
    if (equity > 0.55 && rng() < profile.aggression * 0.5) {
      return { ...raiseTo(legal, raiseSpec.type, chooseSizing(profile, rng, pot, table.bigBlind)), note: 'thin value' };
    }
  }
  return canCheck ? { type: 'check' } : { type: 'fold' };
}

/** Deal a fresh table of opponents with distinct styles. */
export function pickOpponents(count, rng = makeRng()) {
  const pool = ['tag', 'station', 'lag', 'rock', 'maniac', 'pro'];
  const chosen = [];
  for (let i = 0; i < count; i++) chosen.push(pool[i % pool.length]);
  // Shuffle seat order so the same style is not always in the same seat.
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen;
}
