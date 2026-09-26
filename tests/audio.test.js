import { describe, it, assert, equal } from './harness.js';
import { midi, renderTune, TUNES, RIVER_RAG, PARLOUR_VAMP } from '../src/js/audio/tunes.js';

describe('music: the notes are written down right', () => {
  it('reads note names the way a piano is numbered', () => {
    equal(midi('C4'), 60);
    equal(midi('A4'), 69);
    equal(midi('F#5'), 78);
    equal(midi('Bb4'), 70);
    equal(midi('E2'), 40);
  });

  it('fills every bar exactly, so the hands never drift apart', () => {
    // renderTune throws on a bar that is an eighth long or short; a tune
    // that renders at all has every bar at eight.
    for (const tune of Object.values(TUNES)) {
      const { beats } = renderTune(tune);
      equal(beats, tune.bars.length * 4, `${tune.key} has the wrong length`);
    }
  });

  it('strides: bass on the beat, chord on the off-beat, in every bar', () => {
    for (const tune of Object.values(TUNES)) {
      const { events } = renderTune(tune);
      for (let b = 0; b < tune.bars.length; b++) {
        for (const beat of [0, 2]) {
          assert(events.some((e) => e.part === 'bass' && e.at === b * 4 + beat),
            `${tune.key} bar ${b + 1} has no bass on beat ${beat + 1}`);
          assert(events.some((e) => e.part === 'chord' && e.at === b * 4 + beat + 1),
            `${tune.key} bar ${b + 1} has no chord on beat ${beat + 2}`);
        }
      }
    }
  });

  it('keeps each hand in its own part of the keyboard', () => {
    const { events } = renderTune(RIVER_RAG);
    const range = (part) => {
      const notes = events.filter((e) => e.part === part).map((e) => e.midi);
      return [Math.min(...notes), Math.max(...notes)];
    };
    const [bassLo, bassHi] = range('bass');
    const [chordLo, chordHi] = range('chord');
    const [tuneLo, tuneHi] = range('melody');
    assert(bassLo >= midi('E2') && bassHi < midi('E3'), `bass wanders: ${bassLo}–${bassHi}`);
    assert(chordLo >= midi('G3') && chordHi < midi('G4'), `chords wander: ${chordLo}–${chordHi}`);
    assert(tuneLo >= midi('G4') && tuneHi <= midi('E6'), `the tune goes out of reach: ${tuneLo}–${tuneHi}`);
    assert(chordHi < tuneLo + 1, 'the left hand climbs into the tune');
  });

  it('loops long enough not to grate, and the table stays out of the way', () => {
    const seconds = (tune) => (renderTune(tune).beats * 60) / tune.bpm;
    const river = seconds(RIVER_RAG);
    assert(river >= 60 && river <= 120, `the river rag loops every ${river.toFixed(0)}s`);
    // A melody is something to follow; at a table the reader is thinking.
    const { events } = renderTune(PARLOUR_VAMP);
    equal(events.filter((e) => e.part === 'melody').length, 0, 'the table music carries a tune');
    assert(PARLOUR_VAMP.bpm < RIVER_RAG.bpm, 'the table music is not calmer than the river');
  });
});
