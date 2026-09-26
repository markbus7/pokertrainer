/**
 * The music, as notes.
 *
 * Written out rather than generated: a rag is a composed thing, and a random
 * walk over chord tones sounds like a random walk. These are original, in the
 * style of the pieces a riverboat piano would have played around 1900 —
 * straight eighths, a syncopated right hand, and a stride left hand that
 * goes bass-chord-bass-chord under it.
 *
 * Kept free of anything the browser owns so it can be checked in Node: a
 * tune goes in, a list of timed notes comes out, and the synthesiser only
 * ever sees the list.
 */

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C4' → 60, 'F#5' → 78, 'Bb4' → 70. */
export function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const [, letter, accidental, octave] = m;
  return 12 * (Number(octave) + 1) + PITCH[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
}

/** Pitch classes from the root, which the left hand voices itself. */
export const CHORDS = {
  C: [0, 4, 7],
  C7: [0, 4, 7, 10],
  Dm: [2, 5, 9],
  D7: [2, 6, 9, 0],
  E7: [4, 8, 11, 2],
  F: [5, 9, 0],
  Fm: [5, 8, 0],
  G7: [7, 11, 2, 5],
  A7: [9, 1, 4, 7],
};

/**
 * "E5:1 G5:2 r:1" — a note or a rest, then its length in eighths. Every bar
 * adds up to eight; renderTune checks, because a bar one eighth short does
 * not fail loudly, it just drifts the right hand off the left for good.
 */
const bar = (chords, melody) => ({ chords: chords.split(' '), melody });

/** "The Long River Rag" — the map and the stops. */
export const RIVER_RAG = {
  key: 'river',
  bpm: 96,
  bars: [
    // A
    bar('C', 'E5:1 G5:2 E5:1 C5:1 E5:1 G5:2'),
    bar('A7', 'A5:1 G5:1 E5:2 C#5:1 E5:1 A5:2'),
    bar('Dm', 'F5:1 A5:2 F5:1 D5:1 F5:1 A5:2'),
    bar('G7', 'G5:1 F5:1 D5:2 B4:1 D5:1 F5:2'),
    bar('C', 'E5:1 G5:2 E5:1 C6:2 B5:1 A5:1'),
    bar('C7', 'G5:1 E5:1 Bb4:2 C5:1 E5:1 G5:2'),
    bar('F Fm', 'A5:1 F5:1 C5:2 Ab5:1 F5:1 C5:2'),
    bar('C G7', 'E5:2 G5:1 E5:1 D5:1 F5:1 B4:2'),
    // A'
    bar('C', 'E5:1 G5:2 E5:1 C5:1 E5:1 G5:2'),
    bar('A7', 'A5:1 G5:1 E5:2 C#5:1 E5:1 A5:2'),
    bar('Dm', 'F5:1 A5:2 F5:1 D5:1 F5:1 A5:2'),
    bar('G7', 'G5:1 F5:1 D5:2 B4:1 D5:1 F5:2'),
    bar('C', 'E5:1 G5:2 C6:1 E6:2 D6:1 C6:1'),
    bar('E7', 'B5:1 G#5:1 E5:2 D5:1 E5:1 G#5:2'),
    bar('F G7', 'A5:1 F5:1 C5:2 B5:1 G5:1 D5:2'),
    bar('C', 'C6:2 G5:1 E5:1 C5:4'),
    // B
    bar('F', 'C6:1 A5:1 F5:1 A5:1 C6:2 A5:2'),
    bar('F', 'Bb5:1 A5:1 G5:1 F5:1 A5:4'),
    bar('C', 'G5:1 E5:1 C5:1 E5:1 G5:2 E5:2'),
    bar('C', 'F5:1 E5:1 D5:1 C5:1 E5:4'),
    bar('D7', 'F#5:1 A5:2 F#5:1 D5:1 F#5:1 A5:2'),
    bar('G7', 'G5:1 B5:2 G5:1 F5:1 D5:1 B4:2'),
    bar('C', 'C5:1 E5:1 G5:1 C6:1 E6:2 C6:2'),
    bar('C', 'E5:1 D5:1 C5:2 G4:4'),
    // B'
    bar('F', 'C6:1 A5:1 F5:1 A5:1 C6:2 A5:2'),
    bar('Fm', 'Ab5:1 G5:1 F5:1 C5:1 Ab5:4'),
    bar('C', 'G5:1 E5:1 C5:1 E5:1 G5:2 C6:2'),
    bar('A7', 'A5:1 C#6:1 E6:2 C#6:1 A5:1 G5:2'),
    bar('Dm G7', 'F5:1 A5:1 D6:2 B5:1 G5:1 F5:2'),
    bar('C', 'E5:1 G5:2 E5:1 C5:2 E5:2'),
    bar('G7', 'D5:1 F5:1 G5:1 B5:1 D6:2 B5:2'),
    bar('C', 'C6:4 r:4'),
  ],
};

/**
 * "Parlour Vamp" — the table. The same changes with the tune taken out and
 * the tempo let down: at a table the reader is thinking, and a melody is
 * something to follow. A left hand on its own is a room with a piano in it.
 */
export const PARLOUR_VAMP = {
  key: 'table',
  bpm: 84,
  melodyless: true,
  bars: RIVER_RAG.bars.slice(0, 16).map((b) => ({ chords: b.chords, melody: 'r:8' })),
};

export const TUNES = { river: RIVER_RAG, table: PARLOUR_VAMP };

/** The lowest octave the stride bass may use, and the chord's register. */
const BASS_FLOOR = midi('E2');
const CHORD_FLOOR = midi('G3');

/** The pitch of this class at or above the floor, within an octave of it. */
const place = (pitchClass, floor) => floor + ((pitchClass - floor) % 12 + 12) % 12;

/**
 * Everything a tune plays, in beats from the top.
 *
 * Returns { events, beats }, each event { at, dur, midi, part }, part being
 * 'melody', 'bass' or 'chord'. Durations are in beats, where a bar is four.
 */
export function renderTune(tune) {
  const events = [];
  tune.bars.forEach((b, i) => {
    const start = i * 4;
    // Two chords split the bar down the middle; one holds it all.
    const halves = b.chords.length === 1 ? [b.chords[0], b.chords[0]] : b.chords;
    halves.forEach((name, half) => {
      const pcs = CHORDS[name];
      if (!pcs) throw new Error(`Unknown chord ${name} in bar ${i + 1}`);
      const root = pcs[0];
      const t0 = start + half * 2;
      // Stride: bass on the beat, chord on the off-beat. The second bass of
      // a held chord drops to the fifth, which is what makes it walk.
      const bassPc = half === 1 && b.chords.length === 1 ? (root + 7) % 12 : root;
      events.push({ at: t0, dur: 0.9, midi: place(bassPc, BASS_FLOOR), part: 'bass' });
      for (const pc of pcs) {
        events.push({ at: t0 + 1, dur: 0.6, midi: place(pc, CHORD_FLOOR), part: 'chord' });
      }
    });

    let pos = 0;
    for (const token of b.melody.split(' ')) {
      const [name, len] = token.split(':');
      const eighths = Number(len);
      if (name !== 'r') {
        events.push({ at: start + pos / 2, dur: eighths / 2, midi: midi(name), part: 'melody' });
      }
      pos += eighths;
    }
    if (pos !== 8) throw new Error(`Bar ${i + 1} of ${tune.key} is ${pos} eighths long, not 8`);
  });
  events.sort((a, b) => a.at - b.at);
  return { events, beats: tune.bars.length * 4 };
}
