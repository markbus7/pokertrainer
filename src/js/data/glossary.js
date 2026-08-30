/**
 * Plain-language definitions for the jargon the lessons use.
 *
 * This exists because vocabulary kept being the thing that blocked people,
 * not the ideas. Worse, the curriculum uses terms before it teaches them:
 * Pot Odds unlocks at level 1 and talks about gutshots and flush draws,
 * while Outs — which defines both — unlocks at level 2. Rather than reorder
 * the whole curriculum around vocabulary, any term can now be tapped
 * wherever it appears and explains itself on the spot.
 */

export const TERMS = {
  out: {
    term: 'Out',
    short: 'A card that would put you in front.',
    full: 'Any card still to come that turns your losing hand into a winning one. If you hold two hearts and two more are on the board, every remaining heart is an out, because it completes your flush.',
  },
  outs: {
    term: 'Outs',
    short: 'The cards that would put you in front.',
    full: 'The count of cards still unseen that would win you the hand. Nine for a flush draw, eight for an open-ended straight draw, four for a gutshot. Multiply by 4 on the flop, or 2 on the turn, to turn that count into a rough percentage.',
  },
  'flush draw': {
    term: 'Flush draw',
    short: 'Four to a flush — one more of that suit wins it.',
    full: 'You have four cards of the same suit and need a fifth. There are 13 of each suit, you can see four of them, so nine remain: nine outs. On the flop that is roughly 36% to get there by the river.',
  },
  gutshot: {
    term: 'Gutshot',
    short: 'A straight missing one card in the middle. Four outs.',
    full: 'Also called an inside straight draw. You need one specific rank to fill a hole in the middle of your run — holding 9-8 on a 6-5 board, only a 7 completes 9-8-7-6-5. Four cards of that rank exist, so four outs, which is about 16% by the river. Half as good as an open-ended draw.',
  },
  'open-ended straight draw': {
    term: 'Open-ended straight draw',
    short: 'Four in a row — either end completes it. Eight outs.',
    full: 'You have four consecutive cards and a card at either end makes the straight. Holding 9-8 on a 7-6 board, any ten or any five gets there — four of each, so eight outs, about 32% by the river.',
  },
  equity: {
    term: 'Equity',
    short: 'How often your hand wins. A fact about your cards.',
    full: 'Your share of the pot: how often this hand would win if the situation were played out again and again. A hand that wins three times in four has 75% equity. It describes your cards — which is what makes it comparable against the price the pot is offering.',
  },
  'pot odds': {
    term: 'Pot odds',
    short: 'The price the pot is offering. A fact about the money.',
    full: 'The equity you would need for a call to break even, worked out from the pot and the bet alone. Your call divided by the final pot. You can calculate it without ever looking at your cards.',
  },
  pot: {
    term: 'The pot',
    short: 'Every chip already bet, including the bet you are facing.',
    full: 'All the chips wagered so far in the hand, sitting in the centre of the table. When it is your turn, it includes the bet you are currently facing — that money stopped being your opponent’s the moment they pushed it forward.',
  },
  'open': {
    term: 'Open',
    short: 'To be the first player to raise.',
    full: 'Putting in the first raise when nobody before you has entered the pot. Your "opening range" is the set of hands you would do that with from a given seat — which gets wider the closer you sit to the button.',
  },
  '3-bet': {
    term: '3-bet',
    short: 'The re-raise: raising someone who already raised.',
    full: 'The big blind counts as the first bet, an open raise is the second, so re-raising is the third — hence 3-bet. A 3-betting range needs bluffs as well as strong hands, or observant opponents simply fold every time you do it.',
  },
  suited: {
    term: 'Suited',
    short: 'Both your cards are the same suit. Written "s".',
    full: 'Two cards of one suit, giving you a shot at a flush. Written with an s, so AKs is ace-king of the same suit. It is worth only two or three points of extra equity, but it is free, and it turns hands that would otherwise be folds into playable ones.',
  },
  offsuit: {
    term: 'Offsuit',
    short: 'Your two cards are different suits. Written "o".',
    full: 'Two cards of different suits, so no flush is possible from them alone. Written with an o, so AKo is ace-king of mixed suits. There are three times as many offsuit combinations of a given pair of ranks as suited ones.',
  },
  combo: {
    term: 'Combo',
    short: 'One specific two-card holding, of the 1,326 possible.',
    full: 'A single exact hand, like the ace of spades with the king of hearts. Any pair of ranks has 6 combos if paired, 4 if suited, and 12 if offsuit. Range percentages count combos, not grid squares, which is why an offsuit square is worth three times a suited one.',
  },
  limp: {
    term: 'Limp',
    short: 'Just calling the big blind instead of raising.',
    full: 'Entering the pot for the minimum rather than raising. It surrenders the initiative, invites everyone in cheaply, and tells observant opponents you do not hold a premium. Raise or fold instead.',
  },
  position: {
    term: 'Position',
    short: 'Acting after your opponents, on every street.',
    full: 'Where you sit relative to the players still in the hand. Being "in position" means acting last, so you see what everyone else does before you decide. It is worth more than good cards, which is why the button is the most profitable seat.',
  },
  kicker: {
    term: 'Kicker',
    short: 'The tie-breaking card when two hands match.',
    full: 'When two players make the same hand, the next highest card decides it. Both hold a pair of aces? The player with the king kicker beats the one with a five. This is why A-K is a very different hand from A-5.',
  },
  'semi-bluff': {
    term: 'Semi-bluff',
    short: 'A bluff with a hand that can still improve.',
    full: 'Betting with a hand that is probably behind but has outs. It wins two ways: they fold now, or they call and you hit. That extra way to win is free, which makes it far more profitable than bluffing with nothing.',
  },
  'bluff catcher': {
    term: 'Bluff catcher',
    short: 'A hand that beats a bluff and nothing else.',
    full: 'A hand too weak to beat any value bet, but good enough to beat a total bluff. Calling with one is a pure bet on how often your opponent is bluffing.',
  },
  range: {
    term: 'Range',
    short: 'All the hands someone could have here.',
    full: 'Rather than guessing one specific hand, you think about the whole set of hands an opponent would play this way. Good players think in ranges, because you can never know the single hand.',
  },
  'c-bet': {
    term: 'Continuation bet',
    short: 'Betting the flop after you raised preflop.',
    full: 'You raised before the flop, so you represent the stronger hand. Betting again on the flop continues that story — and works often because most hands miss most flops.',
  },
  street: {
    term: 'Street',
    short: 'A betting round: preflop, flop, turn, river.',
    full: 'Each stage of the hand. Preflop is before any shared cards, then the flop (three cards), the turn (a fourth), and the river (the fifth and last). Each has its own round of betting.',
  },
  showdown: {
    term: 'Showdown',
    short: 'Revealing hands at the end to see who wins.',
    full: 'If two or more players are still in after the last round of betting, they show their cards and the best five-card hand takes the pot.',
  },
  blinds: {
    term: 'Blinds',
    short: 'Forced bets that start the action.',
    full: 'Two players post bets before any cards are dealt — the small blind and the big blind — so there is always something to play for. They rotate each hand, so everyone pays them equally over time.',
  },
  spr: {
    term: 'SPR',
    short: 'Stack-to-pot ratio: the stack divided by the pot.',
    full: 'The effective stack divided by the size of the pot on the flop. It decides how committed one pair is: at an SPR of 3 top pair usually gets all the chips in, at 10 it is just one pair.',
  },
  mdf: {
    term: 'MDF',
    short: 'The share of your range you must keep defending.',
    full: 'Minimum defence frequency: pot divided by (pot + bet). Fold more often than this and your opponent can profitably bluff with any two cards. It is a floor for safety, not a rule to follow against someone who never bluffs.',
  },
  icm: {
    term: 'ICM',
    short: 'Converting tournament chips into real prize money.',
    full: 'The Independent Chip Model. In a tournament, chips only convert into a finishing position, and prizes are fixed — so the chips you win are worth less than the chips you risk. This is why correct-for-chips calls can be wrong for money.',
  },
  vpip: {
    term: 'VPIP',
    short: 'How often a player voluntarily puts money in preflop.',
    full: 'Voluntarily Put money In Pot — the share of hands a player chooses to play, ignoring blinds they were forced to post. A winning 6-max regular sits around 22-27%; anyone far above that is playing too many hands.',
  },
  rake: {
    term: 'Rake',
    short: 'The cut the house takes from each pot.',
    full: 'Typically 5% of the pot up to a cap of a few big blinds. Because of the cap, small pots are taxed hardest in percentage terms — which is why grinding lots of tiny pots loses money even when the cards break even.',
  },
  dominated: {
    term: 'Dominated',
    short: 'Sharing your best card with a better kicker.',
    full: 'Holding A-J against A-K: you share the ace, but their second card beats yours. Dominated hands are expensive precisely because they look strong and lose big — you hit your ace, feel great, and pay off.',
  },
  nut: {
    term: 'The nuts',
    short: 'The best possible hand on this board.',
    full: 'The hand that cannot be beaten given the cards showing. "Second nuts" is the next best, and is where a great deal of money is lost.',
  },
  'bb/100': {
    term: 'bb/100',
    short: 'Win rate: big blinds won per 100 hands.',
    full: 'The standard measure of how well someone is doing, independent of stake. A solid small-stakes win rate is 3-8bb/100. Anyone claiming much more over a real sample is either lucky or lying.',
  },
};

export const TERM_KEYS = Object.keys(TERMS);

/** Look up a term, tolerating case and simple plurals. */
export function lookupTerm(name) {
  const key = String(name).trim().toLowerCase();
  if (TERMS[key]) return TERMS[key];
  if (key.endsWith('s') && TERMS[key.slice(0, -1)]) return TERMS[key.slice(0, -1)];
  return TERMS[`${key}s`] || null;
}

/** Every term, alphabetically, for the glossary page. */
export function allTerms() {
  return TERM_KEYS
    .map((key) => ({ key, ...TERMS[key] }))
    .sort((a, b) => a.term.localeCompare(b.term));
}
