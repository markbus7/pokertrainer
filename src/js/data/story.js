/**
 * The story of the river, a few lines at a time.
 *
 * The people on the Long River already talk — a hello, a boast, a sore loser's
 * grumble — but nothing happened *to* you: you sat, you played, you left. This
 * is where things happen. Each stop has a short scene the first time you tie
 * up there, and each owner has something to say when you challenge them to a
 * duel and when they beat you at it. Between them they run one thread down
 * the river: a drifter with a borrowed rowboat, and a Commodore at the delta
 * who has noticed.
 *
 * Kept as data, and as short as it can be: a scene is read once, so every
 * sentence has to earn it.
 */

export const STORY = {
  nl2: {
    arrival: 'You tie the borrowed rowboat to a piling at Mud Landing. A dockhand is dealing on an upturned crate and does not look up. "Everybody starts here," says Silas, behind you. "Everybody who is going anywhere, anyway."',
    challenge: 'A duel? Just the two of us and one crate? Friend, I have never folded in my life. Deal.',
    loss: 'Told you. Never fold a hand that might get there. Go and read your book, and come back.',
  },
  nl5: {
    arrival: 'Fisher\'s Rest stands on stilts over the shallows, and every plank of it complains. Ma Tilly pours the tea herself, and she has already heard who took Wade\'s crate.',
    challenge: 'Just you and me, dearie? Pour the tea. I will call anything once, and you will find out how long once can last.',
    loss: 'Ooh. Patience, dearie, the river always comes. Try me again when you have learned to wait.',
  },
  nl10: {
    arrival: 'The Ferry is one table bolted to a deck, going nowhere for the nine-thousandth time. Hollis Crane looks at you for a long minute and folds a hand without picking it up.',
    challenge: 'Heads up. Hm. Waiting is a skill, and I have had a lifetime of practice. Sit, and do not mistake my silence for weakness.',
    loss: 'I waited for the hand and the hand came. That is the whole of my method.',
  },
  nl25: {
    arrival: 'Upstairs at the cotton exchange nobody raises their voice, because nobody needs to. Evangeline Marsh keeps a ledger of the river\'s debts, and yours has just acquired a new line.',
    challenge: 'A private match, then? Very well. I price everything, so let us see what you are worth.',
    loss: 'Position is a price, and you paid it twice. Do read the chapter before you come back.',
  },
  nl50: {
    arrival: 'The Belle is a paddle steamer with the engine room turned into a card room, and it is loud. Captain Rourke has been raising since Memphis and shows no sign of stopping.',
    challenge: 'Heads up, on my own deck? Ha! Stoke the engine. I bet every street.',
    loss: 'Played back without a hand, did you? I raise, you pay. That is the Belle.',
  },
  nl100: {
    arrival: 'The Grand Hotel\'s parlour is so quiet you can hear the cards land. Professor Ashby is the only person in it who looks pleased to see you, which is somehow worse.',
    challenge: 'One against one, then. I should warn you that I have read everything you have ever done at a table. Shall we?',
    loss: 'You have a pattern, I am afraid. Everyone does. Find yours before I find it again.',
  },
  nl200: {
    arrival: 'The Gilded Barge has no name painted on its hull and does not need one. Lucky Delacroix throws chips about as though they were somebody else\'s, and a whisper on the gangway says they are the Commodore\'s.',
    challenge: 'A duel! Marvellous! Double or nothing, triple or nothing, I never count!',
    loss: 'Luck! It is a gift, my friend, and today it is not yours.',
  },
  nl500: {
    arrival: 'The river opens into the delta, and there, riding at anchor, is the Commodore\'s flagship. Every debt and every table on this river leads to this room, and he knows exactly who you are.',
    challenge: 'Nobody has asked me for a duel in twenty years. Sit down. Let us see what the river has made of you.',
    loss: 'Nobody here is going to give you anything. Come back when you have earned it.',
  },
};

/** The scene for a stop, or null. */
export const storyFor = (stopKey) => STORY[stopKey] || null;
