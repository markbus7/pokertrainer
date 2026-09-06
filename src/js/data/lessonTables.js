/**
 * A table built for one lesson.
 *
 * The lessons were a questionnaire with a felt drawn next to it. This turns
 * each one into a hand of poker instead, cut down to the thing being taught:
 * fewer seats where the seats are not the point, a hand that ends once its
 * question has been answered, and an autopilot that plays every decision the
 * lesson has not covered yet so the reader is only ever asked about the one
 * it has.
 *
 * `concept` is the tag core/spotConcept.js puts on a decision. The runner
 * hands control over the moment the hero's spot carries that tag, and plays
 * on by itself otherwise — which is what makes this playing rather than
 * answering.
 */

export const LESSON_TABLES = {
  'hand-rankings': {
    seats: 2,
    lastStreet: 'river',
    // No decision tag: every hand is the lesson. The question comes at the
    // river, before the cards turn over.
    // No concept tag: the moment is the river, not a kind of bet. Everything
    // before it is played for the reader, because folding correctly before
    // the flop teaches nothing about reading a hand.
    concept: null,
    ask: 'name-hand',
    street: 'river',
    autopilot: 'see-flops',
    // The coach would otherwise tag each decision with the module it really
    // belongs to — "Preflop Ranges" — which is true and beside the point in
    // a lesson about reading your own hand.
    coachNote: 'Play the hand however you like. At the river, before you act, I will ask you what you have.',
    simplified: 'Two players, and every hand runs to the river — so there is always a hand to read.',
  },
  'pot-odds': {
    seats: 2,
    lastStreet: 'flop',
    concept: 'pot-odds',
    street: 'flop',
    autopilot: 'see-flops',
    simplified: 'Heads up, and the hand stops on the flop. One price, one decision.',
  },
  outs: {
    seats: 2,
    lastStreet: 'river',
    concept: 'outs',
    street: 'flop',
    autopilot: 'see-flops',
    simplified: 'Heads up, played to the river — so you find out whether the draw got there.',
  },
  preflop: {
    seats: 6,
    lastStreet: 'preflop',
    concept: null,
    simplified: 'A full table, but the hand ends before the flop. This lesson is only about the first decision.',
  },
  position: {
    seats: 6,
    lastStreet: 'preflop',
    // Every preflop decision is this lesson: the seat you are in is the
    // subject, so there is nothing to play for you. The `position` tag only
    // fires in the blinds with nothing to call, which would have left the
    // reader watching five hands out of six.
    concept: null,
    coachNote: 'Find the button, work out your seat, then decide. The hand ends before the flop.',
    simplified: 'Six seats with the button moving round, because where you sit is the whole subject. '
      + 'The hand ends before the flop.',
  },
  cbet: {
    seats: 2,
    lastStreet: 'flop',
    concept: 'cbet',
    street: 'flop',
    // A continuation bet only exists if you took the lead before the flop.
    autopilot: 'raise-first',
    simplified: 'Heads up, stopping on the flop — the street the continuation bet lives on.',
  },
  mdf: {
    seats: 2,
    lastStreet: 'river',
    concept: 'mdf',
    street: 'river',
    autopilot: 'see-flops',
    simplified: 'Heads up to the river, where folding too much costs the most.',
  },
  bluffing: {
    seats: 2,
    lastStreet: 'river',
    concept: 'bluffing',
    street: 'river',
    autopilot: 'raise-first',
    simplified: 'Heads up to the river. A bluff only means anything when there is nothing left to catch up with.',
  },
  spr: {
    seats: 3,
    lastStreet: 'turn',
    concept: 'spr',
    street: 'flop',
    autopilot: 'see-flops',
    simplified: 'Three players, stopping on the turn — deep enough for the stack to matter, short enough to see it.',
  },
  exploit: {
    seats: 3,
    lastStreet: 'river',
    concept: 'exploit',
    street: 'flop',
    autopilot: 'see-flops',
    simplified: 'Three players to the river, so there is a real opponent to read rather than a described one.',
  },
  // ICM is a tournament idea and this is a cash table; Bankroll is about
  // which table to sit at, which is what the Bankroll Challenge already is.
  // Saying so is better than inventing a table that teaches neither.
  icm: null,
  bankroll: null,
};

/** The table this lesson should be played on, or null if it has none. */
export const lessonTable = (moduleId) => LESSON_TABLES[moduleId] || null;

/** Every module that can be played rather than answered. */
export const playableModules = () =>
  Object.keys(LESSON_TABLES).filter((id) => LESSON_TABLES[id]);
