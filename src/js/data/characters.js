/**
 * The people on the river.
 *
 * Every stop has somebody who owns its table: the one you came to beat. They
 * are not new opponents under the hood — each plays exactly like one of the
 * six styles the engine already runs, so the lesson a boss teaches is the
 * lesson that style teaches. What a boss adds is a face and a voice, and a
 * reason to remember the stake as a place rather than as a number.
 *
 * `read` and `beat` are the teaching half: how this person plays, and what
 * that should change about how you play. They are written for the character
 * rather than borrowed from the style's generic text, because "he calls with
 * any piece of the board" is wrong about Ma Tilly in a way a reader notices.
 * Where the generic counter already says it exactly, it is reused word for
 * word, so the drills and the river never give two versions of one lesson.
 */

export const BOSSES = {
  wade: {
    key: 'wade',
    name: 'Wade Barlow',
    short: 'Wade',
    title: 'Dockhand',
    plays: 'station',
    hello: 'Pull up a crate. I don\'t fold, friend — I came to see cards.',
    read: 'Calls with any piece of the board and almost never raises.',
    beat: 'Never bluff him. Value bet thin, three streets, and size up — he will pay.',
    brag: ['Told you. Never fold a hand that might get there.', 'River\'s been good to me tonight.'],
    sore: ['Shoot. I had a piece of that board.', 'Called it anyway. Would again.'],
    beaten: 'Well, shoot. Take the lantern — you\'ll need it downriver.',
    keepsake: { key: 'lantern', name: 'Wade\'s lantern' },
  },
  tilly: {
    key: 'tilly',
    name: 'Ma Tilly',
    short: 'Tilly',
    title: 'Keeps the tavern',
    plays: 'station',
    hello: 'Tea\'s free, the chairs creak, and I\'ll call anything once, dearie.',
    read: 'Pays off everything. Folding is not something she does.',
    beat: 'Bluffing her is throwing money in the river. Bet your made hands, and bet them big.',
    brag: ['Ooh, look at that. Pass the sugar.', 'Patience, dearie. The river always comes.'],
    sore: ['Well, I had to see it, didn\'t I?', 'Mind the chairs when you gloat.'],
    beaten: 'You\'ve a head on you. Take the old teapot — it has brought luck to worse players.',
    keepsake: { key: 'teapot', name: 'Tilly\'s teapot' },
  },
  hollis: {
    key: 'hollis',
    name: 'Hollis Crane',
    short: 'Hollis',
    title: 'Ferryman',
    plays: 'rock',
    hello: 'Nine thousand crossings. I have played maybe twelve hands. Sit.',
    read: 'Folds nearly everything. When he finally bets, he has it.',
    beat: 'Steal his blinds relentlessly, and fold the moment he raises you.',
    brag: ['Waited all night for that one.', 'When I bet, I have it. Everybody knows that.'],
    sore: ['Hm. Should have kept waiting.', 'Hm.'],
    beaten: 'You stole my blinds till I had nothing left. Here — the ferry bell. Ring it when you land.',
    keepsake: { key: 'bell', name: 'The ferry bell' },
  },
  evangeline: {
    key: 'evangeline',
    name: 'Evangeline Marsh',
    short: 'Evangeline',
    title: 'Cotton broker',
    plays: 'tag',
    hello: 'I trade for a living. I know what a price is. Do you?',
    read: 'Few hands, played hard. She continues with real equity and barrels the boards that suit her.',
    beat: 'Give her credit on scary boards, but attack when she checks twice — she gives up.',
    brag: ['Priced in, darling.', 'A good bet is only ever a good price.'],
    sore: ['Noted.', 'I shall remember that price.'],
    beaten: 'You read the market better than I did tonight. Keep my ledger — the numbers in it are honest.',
    keepsake: { key: 'ledger', name: 'Evangeline\'s ledger' },
  },
  rourke: {
    key: 'rourke',
    name: 'Captain Rourke',
    short: 'Rourke',
    title: 'Master of the Belle',
    plays: 'lag',
    hello: 'My boat, my rules. And my rule is: I raise.',
    read: 'Raises constantly. His bets are far stronger than his hands.',
    beat: 'Widen your calling range and let him bluff into you. Trap with strong hands.',
    brag: ['Full steam, never look back!', 'Fold, fold, fold — that is why you are a passenger.'],
    sore: ['Lucky! You will not catch me like that twice.', 'Bah. Stoke the boilers.'],
    beaten: 'You called me down like you owned the river. Take the cap — Captain.',
    keepsake: { key: 'cap', name: 'Rourke\'s cap' },
  },
  ashby: {
    key: 'ashby',
    name: 'Professor Ashby',
    short: 'Ashby',
    title: 'Mathematician',
    plays: 'pro',
    hello: 'I have studied this game for thirty years. Let us see what you have learned.',
    read: 'Balanced and patient. He plays the charts you are learning, and plays them well.',
    beat: 'Play your own solid game. Grind small edges and avoid marginal spots out of position.',
    brag: ['The arithmetic was on my side.', 'A small edge, repeated, is a fortune.'],
    sore: ['Well played. Genuinely.', 'A fine decision.'],
    beaten: 'You played sounder than I did, and I know no higher compliment. Keep my watch — and better time than I did.',
    keepsake: { key: 'watch', name: 'Ashby\'s pocket watch' },
  },
  delacroix: {
    key: 'delacroix',
    name: 'Lucky Delacroix',
    short: 'Delacroix',
    title: 'Gambler',
    plays: 'maniac',
    hello: 'Money is for spending, friend. Somebody else\'s, preferably.',
    read: 'Enormous bets with nothing at all, over and over.',
    beat: 'Tighten up, stop bluffing, and wait to snap him off with a real hand.',
    brag: ['Luck is a lady, and she likes me!', 'All in! Why ever not?'],
    sore: ['Easy come, easy go!', 'Ah. You actually had it.'],
    beaten: 'You waited, and I went broke watching you do it. Take my lucky coin — it has done nothing for me.',
    keepsake: { key: 'coin', name: 'The lucky coin' },
  },
  commodore: {
    key: 'commodore',
    name: 'The Commodore',
    short: 'Commodore',
    title: 'Owns half the river',
    plays: 'pro',
    hello: 'Everybody on this river works for me eventually. Sit down.',
    read: 'Plays the charts, watches how you play, and gives nothing away.',
    beat: 'Play your own solid game. Grind small edges and avoid marginal spots out of position.',
    brag: ['The river provides. For me.', 'You are learning. Slowly.'],
    sore: ['Enjoy it. It will not last.', 'Hm. Interesting.'],
    beaten: 'The boat is yours. The river too, I suppose. Hoist my pennant — you have earned it.',
    keepsake: { key: 'pennant', name: 'The Commodore\'s pennant' },
  },
};

export const BOSS_KEYS = Object.keys(BOSSES);

export const bossFor = (key) => BOSSES[key] || null;

/**
 * Which boat you have, read off how far down the river you have been.
 *
 * Nothing buys it: bankroll stays bankroll, because spending the roll on a
 * boat would teach the one habit the bankroll lesson exists to stop. The
 * boat is a picture of the climb, not a purchase — and the last one is the
 * Commodore's, which nothing but beating him gets you.
 */
export const BOATS = [
  { key: 'rowboat', name: 'A borrowed rowboat', from: 0 },
  { key: 'skiff', name: 'A sailing skiff', from: 2 },
  { key: 'launch', name: 'A steam launch', from: 4 },
  { key: 'sternwheeler', name: 'A sternwheeler', from: 6 },
];

export const FLAGSHIP = { key: 'flagship', name: 'The Commodore\'s flagship' };

/** `bestIndex`: the furthest stop reached. `wonRiver`: the Commodore is beaten. */
export function boatFor(bestIndex, wonRiver = false) {
  if (wonRiver) return FLAGSHIP;
  let boat = BOATS[0];
  for (const b of BOATS) if (bestIndex >= b.from) boat = b;
  return boat;
}
