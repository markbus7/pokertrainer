/** The games you can sit down in. */

export const VARIANTS = {
  holdem: {
    key: 'holdem',
    name: "No-Limit Hold'em",
    short: 'NLHE',
    holeCards: 2,
    omaha: false,
    shortDeck: false,
    betting: 'no-limit',
    blurb: 'The main event of online poker. Two cards each, five shared, bet anything you like.',
  },
  omaha: {
    key: 'omaha',
    name: 'Pot-Limit Omaha',
    short: 'PLO',
    holeCards: 4,
    omaha: true,
    shortDeck: false,
    betting: 'pot-limit',
    blurb: 'Four cards, and you must use exactly two. Equities run close, so pots get enormous.',
  },
  shortdeck: {
    key: 'shortdeck',
    name: 'Short Deck (6+)',
    short: '6+',
    holeCards: 2,
    omaha: false,
    shortDeck: true,
    betting: 'no-limit',
    blurb: 'Twos through fives removed. Flushes beat full houses and everyone hits everything.',
  },
};

export const VARIANT_KEYS = Object.keys(VARIANTS);

export function getVariant(key) {
  const v = VARIANTS[key];
  if (!v) throw new Error(`Unknown variant: ${key}`);
  return v;
}

/**
 * Seat names relative to the button. Index 0 is the button itself.
 * Heads-up is its own animal: the button posts the small blind.
 */
const SEAT_NAMES = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO'],
};

export function positionNames(playerCount) {
  return SEAT_NAMES[playerCount] || SEAT_NAMES[9].slice(0, playerCount);
}

/** How late you act, 0 (worst) to 1 (button). Drives bot aggression. */
export function positionalRank(seatOffsetFromButton, playerCount) {
  if (playerCount <= 1) return 1;
  // Offset 0 is the button (best); the big blind is the worst preflop seat.
  const order = (playerCount - seatOffsetFromButton) % playerCount;
  return 1 - order / (playerCount - 1);
}
