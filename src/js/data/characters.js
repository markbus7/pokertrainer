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
 * that should change about how you play. `lesson` is the module that teaches
 * the counter, which the stop offers before you sit down with them. They are written for the character
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
    lesson: 'exploit',
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
    lesson: 'bluffing',
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
    lesson: 'position',
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
    lesson: 'cbet',
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
    lesson: 'mdf',
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
    lesson: 'preflop',
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
    lesson: 'pot-odds',
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
    lesson: 'spr',
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

/**
 * The teacher.
 *
 * Silas piloted steamboats on this river for forty years, and a pilot is
 * the right teacher for this game: a pilot learns the river by heart — every
 * bend, every snag, in the dark with no chart — which is exactly what the
 * range trainer asks of the charts. He runs the card school, keeps the pilot
 * house, and stands at your shoulder at the practice table.
 *
 * His lines are short on purpose. He introduces, points, and says right or
 * wrong; the explanations themselves stay the lesson's own words, so the
 * voice never gets between the reader and what is being taught.
 */
export const MENTOR = {
  key: 'silas',
  name: 'Silas Ward',
  short: 'Silas',
  title: 'Old river pilot',
  school: 'Forty years at the wheel and thirty at the tables. Sit down — we start where you are.',
  // What he says about the chapter he points you at, by why nextUp chose it.
  next: {
    untouched: 'You have not opened {module} yet. That is the quickest ground you will ever gain.',
    thin: '{module} again. A few more answers and I will know whether you really have it.',
    lesson: 'Read the {module} chapter before you drill it. Two minutes of reading beats ten questions of guessing.',
    fresh: 'Everything is in your head. {module} is the coldest — warm it up.',
    weakest: '{module} is where you leak the most. That is where we work today.',
  },
  pilot: 'A pilot knows the river by heart: every bend and every snag, at night, with no chart. The charts are the same. First by daylight with the chart on the table, then at dusk with it in the drawer, then at night with nothing but what you remember.',
  shoals: 'These are your shoals — the hands you keep running aground on. Sound them until they are charted, and they come off this list on their own.',
  // A chapter still on the shelf: what it costs, and where pearls come from.
  shelf: 'This chapter is on Delphine\'s shelf at the Trading Post. The tables pay in pearls — a pearl a hand, and more for every hand played well.',
  shelfReady: 'You have the pearls for this one. Buy it and we start.',
  shelfRank: 'Not yet. This chapter is built on the ones before it, and it waits for {rank}.',
  // The records: the log of hands, the chart room, the almanac.
  log: 'Every pilot keeps a log. Write down where you ran aground, and you will not run aground there twice. The ones you lost and played right go in too — they are the proof that losing and misplaying are different things.',
  charts: 'These are the charts, drawn out by daylight. Study them here; the pilot house is where you learn them well enough to leave them in the drawer.',
  almanac: 'Every trade on the river has its own words, and the tables have more than most. When one stops you, it is in here.',
  right: ['That is it.', 'Good. Again.', 'Right, and no hesitation.', 'Clean.', 'Just so.'],
  wrong: ['Not quite. Look again.', 'No — here is the catch.', 'Easy mistake. Read why.', 'Careful. This one bites.'],
  asks: 'Silas asks',
  table: 'At your shoulder',
};

/**
 * The assayer, who keeps the Lab.
 *
 * An assay office weighs what comes over the counter and puts an exact
 * figure on it, which is what the Lab asks of you: the price, the bet that
 * offers it, the call — worked out and entered, never picked from a list.
 * Her verdicts are about weight because a figure that is nearly right is,
 * at a table, simply wrong.
 */
export const ASSAYER = {
  key: 'hattie',
  name: 'Hattie Quill',
  short: 'Hattie',
  title: 'Assayer',
  hello: 'Everything that crosses this counter gets weighed. Bring me figures, not feelings — a guess is no use to anybody at a table.',
  closed: 'Every figure here is a price, and you cannot weigh a price you have not learned to name. Bring me the Pot Odds chapter and the counter is yours.',
  right: ['Weighs true.', 'Exact. Next.', 'That figure passes.', 'Sound as gold.'],
  wrong: ['Short weight. See why.', 'That figure will not pass.', 'Close is not a price.', 'Weigh it again.'],
  done: {
    high: 'Good figures, all of them honest. I have booked each one to come back just as it starts to fade.',
    mid: 'Mostly sound. The ones that came up light are booked to come back soonest.',
    low: 'Too much of it came up light. Read the working under each miss, then weigh them again.',
  },
};

/**
 * The race, which is what the Gauntlet is on the river.
 *
 * Ten questions from everything you have unlocked, against Captain Rourke's
 * Belle. The Belle's pace IS the pass mark: she makes seven and a half
 * reaches in the time you answer ten, so eight right beats her to the
 * landing and seven does not. Nothing about the run changes — the race is
 * a way of seeing the score while it is being made.
 *
 * Rourke talks while he races, and the lines are his side of it: sour when
 * you gain on him, pleased with himself when you snag.
 */
export const RACE = {
  rival: 'rourke',
  boat: 'The Belle',
  hello: 'Ten reaches of river, and nobody tells you what is round the next bend. Get eight right and you beat the Belle to the landing. Get seven and I will be there waiting.',
  gaining: ['Hmph. Lucky water.', 'Stoke the boilers, boys!', 'You are gaining. I do not care for it.'],
  falling: ['Snagged! See you at the landing.', 'Full steam — do try to keep up.', 'That is why you are a passenger.'],
  won: 'Beaten to the landing by a passenger. Do not get used to it.',
  lost: 'The Belle takes it again. Come back when your boilers are hotter.',
};

/**
 * The trader, who keeps the Trading Post at the fork.
 *
 * Everything that can be bought is on her shelves: the chapters, the charts
 * for the pilot house, and the companions who help at the table. She takes
 * pearls and nothing else — never the bankroll, which is for the tables.
 */
export const TRADER = {
  key: 'delphine',
  name: 'Delphine Moreau',
  short: 'Delphine',
  title: 'Keeps the Trading Post',
  hello: 'Pearls on the counter and anything on these shelves is yours. No pearls, no business — the tables pay in them.',
  poor: 'Your purse is light, cher. Go and sit at a table; a pearl a hand, and more for playing it right.',
  thanks: ['A fine choice.', 'Mind how you use it.', 'Pleasure doing business.', 'That one will earn its keep.'],
};

export const bossFor = (key) => BOSSES[key] || null;

/**
 * The shipwright, who builds and sells boats at the yard below Fisher's Rest.
 *
 * He takes pearls, like everybody off the tables — never the bankroll, which
 * is for the tables and which the Bankroll chapter exists to protect — and he
 * only sells a boat to somebody who has taken their own that far down the
 * river: a steam launch is no use to a man who has never left Mud Landing.
 */
export const SHIPWRIGHT = {
  key: 'amos',
  name: 'Amos Leary',
  short: 'Amos',
  title: 'Shipwright',
  hello: 'Every boat on this river came off my slip. A bigger one carries more friends and a heavier strongbox — pearls on the plank and she is yours.',
  poor: 'Nothing on the slip for a light purse. Go and play some hands; I will still be here, and so will the boats.',
  far: 'You have not been far enough down the river for this one yet. Take what you have to the next stop and come back.',
  thanks: ['She will see you to the delta.', 'Mind the snags.', 'Built to last. Try not to sink her.', 'A fine boat for a fine player.'],
};

/**
 * The boats. The first is borrowed; the rest are built at the yard and paid
 * for in pearls, and each is only sold to somebody whose boat has already
 * reached `reach` — the index of a stop. The last is the Commodore's, which
 * nothing but beating him gets you.
 *
 * What a boat does is what a player notices at the table: `berths` is how
 * many companions come aboard with you (the rest wait at the landing), and
 * `bonus` is the share the boat's strongbox adds on top of every pearl the
 * tables pay for hands and decisions.
 */
export const BOATS = [
  { key: 'rowboat', name: 'A borrowed rowboat', price: 0, reach: 0, berths: 1, bonus: 0 },
  { key: 'skiff', name: 'A sailing skiff', price: 150, reach: 1, berths: 2, bonus: 0.1 },
  { key: 'launch', name: 'A steam launch', price: 450, reach: 2, berths: 3, bonus: 0.2 },
  { key: 'sternwheeler', name: 'A sternwheeler', price: 1000, reach: 4, berths: 5, bonus: 0.35 },
];

export const FLAGSHIP = { key: 'flagship', name: 'The Commodore\'s flagship', price: 0, reach: 7, berths: 6, bonus: 0.5 };

export const boatByKey = (key) => (key === FLAGSHIP.key ? FLAGSHIP : BOATS.find((b) => b.key === key) || null);

/**
 * The boat a save from before the boatyard had been given for how far it had
 * got. Kept so that nobody who had already earned a boat loses it: the
 * boatyard sells the next one, not the one you already sail.
 */
export function boatEarnedBy(bestIndex) {
  if (bestIndex >= 6) return 'sternwheeler';
  if (bestIndex >= 4) return 'launch';
  if (bestIndex >= 2) return 'skiff';
  return 'rowboat';
}
