/**
 * Odd jobs: somebody in every town with a job for a card player.
 *
 * A stop used to be its owner and their table. A town has more people in it
 * than that, and the reader asked for places to go and people to meet in each
 * one. So every stop has a local with a standing job on the notice board: the
 * bait-seller at Mud Landing, the ferry's pilot, the hotel's night porter. The
 * job is always the same shape — play one kind of decision well at this
 * town's tables, a number of times — and the kind is what this town teaches,
 * so the job is the town's chapter, sent to the felt.
 *
 * `skill` is one of the ids a decision at a table is filed under
 * (core/spotConcept.js), so it can be counted as it happens.
 */

export const JOBS = [
  {
    stop: 'nl2', skill: 'pot-odds', need: 6,
    who: 'Amos, who sells bait on the landing',
    says: 'Every man at that table calls without asking what it costs. Show me one who counts, and I will pay him for it.',
  },
  {
    stop: 'nl5', skill: 'outs', need: 6,
    who: 'Peg, who traps eels under the tavern',
    says: 'A draw is like an eel trap: you count what can swim in before you pay for the bait. Count yours right and the bait is on me.',
  },
  {
    stop: 'nl10', skill: 'position', need: 8,
    who: 'Gus, the ferry\'s pilot',
    says: 'In the blinds you have paid half the fare before the boat leaves. Defend the seat with the right hands, and I will pay the fare back.',
  },
  {
    stop: 'nl25', skill: 'cbet', need: 8,
    who: 'Mr. Delaune, a cotton broker',
    says: 'You raised, they checked. A broker who will not follow through on a price he named does not stay a broker. Follow through well, and I will pay.',
  },
  {
    stop: 'nl50', skill: 'mdf', need: 10,
    who: 'Hattie, the Belle\'s purser',
    says: 'The Captain bets at everybody, and everybody folds. Stand up to him with the right hands and I will settle your account myself.',
  },
  {
    stop: 'nl100', skill: 'bluffing', need: 10,
    who: 'Booker, the night porter',
    says: 'The guests here fold to a good story. Tell them one at the right moment, and tell me about it after. There is a tip in it.',
  },
  {
    stop: 'nl200', skill: 'spr', need: 12,
    who: 'a croupier who will not give a name',
    says: 'Down here a pot gets big before anybody notices. Know when you are committed and when you are not, and the house will look kindly on you.',
  },
  {
    stop: 'nl500', skill: 'exploit', need: 12,
    who: 'Fitch, the Commodore\'s steward',
    says: 'The Commodore\'s guests each have a habit. Find it and make them pay for it, and I will see you are paid as well.',
  },
  {
    stop: 'nl1000', skill: 'exploit', need: 12,
    who: 'Mr. Pettibone, a customs clerk',
    says: 'Every merchant in this room pays duty on what he carries. Collect it from them with your good hands and I will stamp your papers.',
  },
  {
    stop: 'nl2000', skill: 'mdf', need: 12,
    who: 'Tom, the keeper\'s boy',
    says: 'On the late streets they bet like the lamp will go out. Keep enough hands to call them, and I will tell the keeper you can stay.',
  },
  {
    stop: 'nl5000', skill: 'preflop', need: 14,
    who: 'Luz, who dives for the pearls',
    says: 'Every open here is raised again. Know which hands go back in and which come up for air, and a pearl of mine is yours.',
  },
  {
    stop: 'nl10k', skill: 'pot-odds', need: 14,
    who: 'Quill, the privateers\' quartermaster',
    says: 'Four in every pot and the price changes with every one. Pay the right price each time and I will put you on the share list.',
  },
  {
    stop: 'nl25k', skill: 'spr', need: 16,
    who: 'Lieutenant Ames, the Admiral\'s flag officer',
    says: 'At this table a bet is a commitment. Make every one of them knowing what it commits you to, and the Admiral will hear of it.',
  },
];

export const jobAt = (stopKey) => JOBS.find((j) => j.stop === stopKey) || null;
