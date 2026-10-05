/**
 * The Rival.
 *
 * Every other person on the river is a fixed thing: the owner of a table is a
 * style with a face, and the style never changes however you play. The Rival
 * is the one who does. Nell Corbin came down the river the same week you did,
 * in a boat just as borrowed, and she keeps count. Fold to her bets and she
 * bets more at you; call her down and she stops bluffing. Unlike the tables'
 * regulars, who forget you when you stand up, she remembers from one sitting
 * to the next — which is how the good players you will meet online work, and
 * the reason a leak you have been getting away with does not last.
 *
 * She plays a solid regular's game. What she adds is the memory, and a place
 * in the story: you will meet her more than once.
 */

export const RIVAL = {
  key: 'nell',
  name: 'Nell Corbin',
  short: 'Nell',
  title: 'Another drifter',
  plays: 'pro',
  // The first time she sits across from you.
  intro: 'A woman in a patched coat is at the table, shuffling a deck one-handed. She looks up, and you recognise the rowboat tied behind her: it is the twin of yours. "Silas has told me about you," she says. "He told me about me, too. We shall see which of us listened."',
  hello: [
    'Back again. I have been counting.',
    'Same river, same boat. Let us see who learned more.',
    'I remember how you played last time.',
  ],
  brag: [
    'You fold more than you think. I wrote it down.',
    'I read you like a chart. Pity about that.',
    'Another pot for the notebook.',
  ],
  sore: [
    'Lucky. I will remember that.',
    'Hm. You are not folding as much as you were.',
    'You changed something. Good. Do it again and I will change too.',
  ],
  // When her read on you has moved her play.
  harder: 'You have been folding to my bets, so I am making more of them.',
  softer: 'You keep calling me down, so I have stopped bluffing at you. Be careful what that costs you.',
};

/**
 * Silas on what she is doing, in plain words, for the card on the stop screen
 * and the note at the table. Kept next to her lines so they say the same thing.
 */
export const RIVAL_NOTES = {
  explain: 'Nell keeps a tally of how often you fold when she bets, and she does not forget between sittings. Fold too much and she bluffs you more; call too much and she bluffs less and values harder. The answer is not to do the opposite. It is to mix it up: sometimes you call, sometimes you fold, and she cannot tell which.',
  watching: 'Still watching you: {n} bets seen so far. She needs a few more before she will change anything.',
  folds: 'You fold to {pct}% of the bets she has seen ({n}). She is bluffing you more now.',
  calls: 'You fold to only {pct}% of the bets she has seen ({n}). She has stopped bluffing at you.',
  even: 'You fold to {pct}% of the bets she has seen ({n}). That is about even, and gives her nothing to work with.',
};
