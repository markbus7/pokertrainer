/**
 * Wanderers: people who pass through.
 *
 * The owners are fixed and the Rival remembers; the wanderers are the other
 * thing a river has — strangers off a boat, who sit down at a side game for a
 * few sittings and move on. Each is an extreme of one of the six styles, so
 * the leak is easy to find and large: the lesson is the same one the regulars
 * teach, but turned all the way up, and with a purse on them worth taking.
 * Their bounty is twice an owner's, because they are going to leave and the
 * chance goes with them.
 *
 * Only the people live here. How they play is in engine/bots.js
 * (WANDERER_PROFILES), and when and where they sit is state/lobby.js.
 */

export const WANDERERS = {
  hale: {
    key: 'hale',
    name: 'Ezekiel Hale',
    short: 'Hale',
    title: 'Cattle buyer',
    plays: 'station',
    intro: 'A broad man in a dusty hat has taken the corner chair and a stack of chips the size of a feed sack. "Driving two hundred head to the delta," he says, "and I never saw a card I did not want to look at." He is going to pay to see every one of them.',
    hello: ['Deal me in. I never fold when I might be beaten by a better hand than mine.', 'Folding is for people who are not enjoying themselves.'],
    brag: ['Ha! I had nothing, and I called anyway!', 'Never count a man out who is still in the pot.'],
    sore: ['Well, that is cattle for you.', 'You had it. I had a feeling.'],
    read: 'Calls with anything, and has never folded a pair. He will pay you off with almost every hand.',
    beat: 'Never bluff him. Bet every good hand for value, three streets, as big as you dare.',
  },
  dixie: {
    key: 'dixie',
    name: 'Dixie Lamont',
    short: 'Dixie',
    title: 'Riverboat gambler',
    plays: 'maniac',
    intro: 'A woman in a green waistcoat is riffling chips one-handed, and every one of them is in the middle before you have sat down. "Dixie Lamont," she says. "I came off the Natchez with one rule, which is that I do not check."',
    hello: ['Raise! I have not even looked at my cards.', 'Everybody gets a bet from me. Everybody.'],
    brag: ['You folded! They always fold!', 'I was bluffing the whole time, and I will do it again.'],
    sore: ['You called a bluff? Rude.', 'Well, that is a lot of chips going the wrong way.'],
    read: 'Bets and raises with everything, over and over. Most of what she has is nothing at all.',
    beat: 'Tighten up, call down lighter than feels safe, and let her bluff off her stack into your good hands.',
  },
  josiah: {
    key: 'josiah',
    name: 'Brother Josiah',
    short: 'Josiah',
    title: 'Travelling preacher',
    plays: 'rock',
    intro: 'A thin man in a black coat sits with a Bible on one side of his chips and a glass of water on the other. He does not look at the cards when they come, only at you. "I wager only when the Lord is plainly on my side," he says, and the whole table believes it.',
    hello: ['Patience is a virtue.', 'I will not be hurried into a sin of folly.'],
    brag: ['The meek, as promised.', 'I told you the Lord was on my side.'],
    sore: ['Pride goeth before a fall, and so does a pair of kings.', 'Hm.'],
    read: 'Plays one hand in twenty, and bets only the very best of them. When he bets, he has it.',
    beat: 'Steal his blinds all night, and fold the moment he puts real money in.',
  },
};

export const WANDERER_KEYS = Object.keys(WANDERERS);
export const wandererFor = (key) => WANDERERS[key] || null;
