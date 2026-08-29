/**
 * The curriculum: what to learn, in what order, and why it matters.
 * Each module gates the next, so the path from beginner to winning player
 * is a ladder rather than a pile of disconnected tips.
 */

export const MODULE_META = [
  {
    id: 'hand-rankings',
    name: 'Hand Rankings',
    icon: '🃏',
    unlockLevel: 1,
    tagline: 'What beats what, instantly.',
    lesson: {
      summary: 'Before anything else, reading your own hand has to be automatic. Hesitating at showdown costs money and gives away information.',
      points: [
        'The order, worst to best: high card, one pair, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush.',
        'A flush beats a straight because flushes are rarer — 5,108 five-card flushes against 10,200 straights.',
        'The ace plays both high and low, so A-2-3-4-5 is a straight (the "wheel"). But it does not wrap: Q-K-A-2-3 is nothing.',
        'You always play the best five cards available. Sometimes that means the board plays and the pot is chopped.',
        'Kickers decide ties. A-K on an ace-high board beats A-Q, and that single card is worth a lot of money over a career.',
      ],
    },
  },
  {
    id: 'pot-odds',
    name: 'Pot Odds',
    icon: '🧮',
    unlockLevel: 1,
    tagline: 'The price the pot is offering you.',
    lesson: {
      summary: 'Every call is a bet that you will win often enough to justify the price. Pot odds turn that from a feeling into arithmetic.',
      points: [
        'Required equity = your call ÷ (the pot + your call). Worked through: there is 75 in the pot, they bet 25, so 100 sits in the middle — you call 25, making the final pot 125, and 25 ÷ 125 = 20%.',
        'A half-pot bet asks you to be right 25% of the time. A pot-sized bet asks for 33%. An overbet asks for more.',
        'This is why big bets are not automatically better: they need to work more often to break even.',
        'Say the price out loud before every call. "I call 25 to win 125, so I need 20%." Most losing calls never get counted.',
        'Implied odds are the extra chips you expect to win later. They justify some calls — but only against opponents who actually pay you off.',
      ],
    },
  },
  {
    id: 'outs',
    name: 'Outs & Equity',
    icon: '🎯',
    unlockLevel: 2,
    tagline: 'Counting the cards that save you.',
    lesson: {
      summary: 'An out is a card that turns a losing hand into a winning one. Counting them fast is the most useful skill at the table.',
      points: [
        'Flush draw: 9 outs. Open-ended straight draw: 8. Gutshot: 4. Overcards: 6. Set to a full house: 10.',
        'The rule of 4 and 2: multiply outs by 4 on the flop (two cards to come) or by 2 on the turn.',
        'That shortcut drifts high with many outs. With 15 outs the rule says 60%; the truth is 54%. Close enough to act on.',
        'Not every out is clean. A card that completes your straight may also complete their flush — discount it.',
        'Combine outs with pot odds and the decision makes itself: 9 outs is 36% on the flop, so any bet asking for less than that is a call.',
      ],
    },
  },
  {
    id: 'preflop',
    name: 'Preflop Ranges',
    icon: '📋',
    unlockLevel: 2,
    tagline: 'The only street you can memorise.',
    lesson: {
      summary: 'Most money is lost before the flop, by playing hands that were never profitable. Preflop is solved enough to simply learn.',
      points: [
        'Open roughly 18% of hands under the gun, 25% from the cutoff, and 45% on the button. Position, not optimism, sets the width.',
        'Raise or fold. Limping caps your hand strength, builds no pot with your good hands, and invites everyone in behind you.',
        'A 3-betting range needs bluffs as well as value. Suited aces are ideal: they block the hands that continue and still flop well.',
        'Fold the hands that are dominated. A-J looks strong until an early-position raiser turns it into A-Q, A-K and aces.',
        'Suited beats offsuit, and connected beats scattered. 76s outperforms K3o despite the lower cards.',
      ],
    },
  },
  {
    id: 'position',
    name: 'Position',
    icon: '🪑',
    unlockLevel: 3,
    tagline: 'Acting last is worth more than good cards.',
    lesson: {
      summary: 'Position means information. Acting last on every street lets you control the pot size and bluff far more accurately.',
      points: [
        'The button is the most profitable seat in poker, and the blinds are the two losing seats for everyone.',
        'In position you can check behind for a free card, value bet thinner, and fold without ever putting in a bet.',
        'Out of position you must act first with less information, which is why your continuing range has to be tighter.',
        'Defend the big blind wide against late-position steals — you are getting a discount — but not so wide that you are playing trash out of position.',
        'When choosing between two marginal spots, take the one where you act last. It is worth several big blinds per hundred hands.',
      ],
    },
  },
  {
    id: 'cbet',
    name: 'Continuation Betting',
    icon: '🔫',
    unlockLevel: 4,
    tagline: 'Keeping the lead after the flop.',
    lesson: {
      summary: 'You raised preflop, so you represent the strongest range. A continuation bet turns that story into chips — on the right boards.',
      points: [
        'Dry, disconnected, high boards (A-7-2 rainbow) favour the raiser. Bet small with your entire range; they missed too.',
        'Wet, connected, low boards (9-8-7 two-tone) favour the caller. Check often — too many of their hands will continue.',
        'Bet big when you are ahead on a board full of draws. Making a draw pay is how you get value from being in front.',
        'A bet that folds out only worse hands and gets called by only better ones is a bet that loses money.',
        'If you fire the flop and turn and then check the river, you have told the whole table you missed. Plan all three streets before the first one.',
      ],
    },
  },
  {
    id: 'mdf',
    name: 'Defence Frequency',
    icon: '🛡️',
    unlockLevel: 5,
    tagline: 'Folding too much is its own leak.',
    lesson: {
      summary: 'If you fold too often, any two cards can profitably bluff you. Minimum defence frequency puts a floor on how much you must continue.',
      points: [
        'MDF = pot ÷ (pot + bet). Against a pot-sized bet you must continue with half your range; against a half-pot bet, two thirds.',
        'This is a defensive guideline, not a law. It makes you unexploitable, not maximally profitable.',
        'Against someone who never bluffs, ignore MDF entirely and over-fold. Against a maniac, defend even wider than it says.',
        'Defend with the hands that have the most equity and the best blockers, not simply the ones that feel strong.',
        'The mirror image: when you bluff, your bet must work often enough to pay for itself. Bet 100 into 100 and it must work half the time.',
      ],
    },
  },
  {
    id: 'bluffing',
    name: 'Bluffing & Balance',
    icon: '🎭',
    unlockLevel: 5,
    tagline: 'Making your bluffs pay for themselves.',
    lesson: {
      summary: 'A bluff is not a hope; it is a price. Balance means your value hands and bluffs arrive in a ratio that gives opponents no good answer.',
      points: [
        'Break-even bluff frequency = bet ÷ (bet + pot). Bigger bluffs must work more often.',
        'At a pot-sized bet, a balanced range is one bluff for every two value hands — 33% bluffs.',
        'Bluff with hands that have equity when called: a flush draw that misses still wins when it hits.',
        'Bluff the boards where your range makes sense. If you would not have the nuts here, neither will your story.',
        'Against weak opponents, forget balance. Value bet more and bluff less — exploitation beats theory when the opponent is exploitable.',
      ],
    },
  },
  {
    id: 'spr',
    name: 'Stack Depth',
    icon: '📏',
    unlockLevel: 6,
    tagline: 'Plan the hand before you enter it.',
    lesson: {
      summary: 'Stack-to-pot ratio decides whether top pair is a monster or a bluff catcher, before a single postflop chip goes in.',
      points: [
        'SPR = effective stack ÷ pot on the flop. It is set by how the preflop pot was built.',
        'SPR of 3 or less: top pair is committed. Get the chips in and stop agonising.',
        'SPR of 6 or more: one pair is one pair. Keep the pot small unless you improve.',
        'You choose your SPR preflop. A bigger 3-bet creates a low SPR that suits big pairs; a call keeps it deep, which suits suited connectors.',
        'The effective stack is the smaller of the two — you can never win more than the shorter stack.',
      ],
    },
  },
  {
    id: 'exploit',
    name: 'Reading Players',
    icon: '🔍',
    unlockLevel: 5,
    tagline: 'Where the real money is.',
    lesson: {
      summary: 'Theory keeps you safe; exploitation makes you money. Every opponent has a leak, and your job is to name it and attack it.',
      points: [
        'The calling station never folds: never bluff, and value bet thinner and larger than feels comfortable.',
        'The nit folds too much: steal his blinds relentlessly and believe him when he finally raises.',
        'The maniac bluffs too much: stop bluffing, widen your calling range, and let him bet into your good hands.',
        'The solid regular has no obvious leak: play a simple, well-balanced game and take your edge elsewhere at the table.',
        'Watch showdowns. Every hand a player shows down tells you what they will do with that hand class next time.',
      ],
    },
  },
  {
    id: 'icm',
    name: 'Tournament ICM',
    icon: '🏆',
    unlockLevel: 7,
    tagline: 'Chips are not money.',
    lesson: {
      summary: 'In tournaments the chips you win are worth less than the chips you lose. ICM converts stacks into actual prize money.',
      points: [
        'Doubling your stack does not double your equity — the pay jumps are shared, so the marginal chip is worth less.',
        'On the bubble, calls that are clearly correct for chips become clearly wrong for money.',
        'The big stack has enormous leverage: everyone else risks a pay jump, so they should be attacking constantly.',
        'The short stack should shove rather than call. Fold equity is worth more than a slightly better hand.',
        'Once the bubble bursts, ICM pressure drops sharply and the game opens back up.',
      ],
    },
  },
  {
    id: 'bankroll',
    name: 'Bankroll & The Business',
    icon: '💰',
    unlockLevel: 3,
    tagline: 'How winning players stay solvent.',
    lesson: {
      summary: 'Poker is a job with a very noisy paycheque. Bankroll management is what keeps a winning player from going broke anyway.',
      points: [
        'Keep 30 to 50 buy-ins for no-limit cash games. Winning players still run 20 buy-ins below expectation.',
        'A realistic win rate at small stakes is 3 to 8bb/100. Anyone promising more is selling something.',
        'Standard deviation is around 100bb/100. Over 10,000 hands your result can swing 30 buy-ins in either direction and mean nothing.',
        'Rake is the silent killer: 5% capped means small pots are taxed hardest, so tight aggressive play beats loose passive play twice over.',
        'Game selection outweighs skill. One loose player at the table is worth more than any strategy adjustment you can make.',
      ],
    },
  },
];

export { WALKTHROUGHS } from './walkthroughs.js';

export const MODULE_IDS = MODULE_META.map((m) => m.id);

export function moduleMeta(id) {
  return MODULE_META.find((m) => m.id === id) || null;
}

export function unlockedModules(level) {
  return MODULE_META.filter((m) => m.unlockLevel <= level);
}

/** What the player should work on next. */
export function recommendedModule(profile) {
  const unlocked = unlockedModules(profile.level);
  // Anything untouched comes first, then the weakest accuracy.
  const untouched = unlocked.find((m) => profile.drillStats(m.id).attempts === 0);
  if (untouched) return untouched;
  let worst = null;
  let worstAcc = 1.1;
  for (const m of unlocked) {
    const acc = profile.accuracy(m.id);
    if (acc !== null && acc < worstAcc) { worstAcc = acc; worst = m; }
  }
  return worst || unlocked[unlocked.length - 1];
}
