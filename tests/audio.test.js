import { describe, it, assert, equal } from './harness.js';
import {
  midi, renderTune, arrange, styleFor, TUNES, STYLES, DEFAULT_STYLE, RIVER_RAG, PARLOUR_VAMP,
} from '../src/js/audio/tunes.js';
import { EFFECTS, sfx, unlock, audioState, setMusic, configure } from '../src/js/audio/engine.js';

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

describe('music: three styles of the same tunes', () => {
  it('defaults to the soft piano, and an unknown style falls back to it', () => {
    equal(DEFAULT_STYLE, 'soft');
    equal(styleFor(undefined).key, 'soft');
    equal(styleFor('kazoo').key, 'soft');
    for (const key of ['soft', 'honky', 'calm']) equal(styleFor(key).key, key);
  });

  it('the pianos play the written notes; the soft one a little slower and darker', () => {
    for (const tune of Object.values(TUNES)) {
      const written = renderTune(tune).events;
      for (const key of ['soft', 'honky']) {
        const { events, bpm } = arrange(tune, key);
        equal(events.length, written.length, `${key} drops notes from ${tune.key}`);
        equal(bpm, tune.bpm * STYLES[key].tempo);
      }
    }
    assert(STYLES.soft.tempo < STYLES.honky.tempo, 'the soft piano is not calmer than the upright');
    assert(STYLES.soft.brightness < STYLES.honky.brightness, 'the soft piano is not darker than the upright');
  });

  it('calm water holds every chord for as long as it lasts, and strikes nothing short', () => {
    for (const tune of Object.values(TUNES)) {
      const { events, beats, bpm } = arrange(tune, 'calm');
      equal(beats, tune.bars.length * 4);
      assert(bpm < tune.bpm * 0.7, `${tune.key} is not slowed for calm water`);
      for (const e of events) {
        assert(['pad', 'deep', 'glow'].includes(e.part), `calm water plays a ${e.part}`);
        assert(e.dur >= 2, `a note of ${e.dur} beats is not calm`);
      }
      // A chord on every bar, so the harmony never drops out.
      for (let b = 0; b < tune.bars.length; b++) {
        assert(events.some((e) => e.part === 'deep' && e.at === b * 4), `${tune.key} bar ${b + 1} has no root`);
      }
    }
    equal(arrange(PARLOUR_VAMP, 'calm').events.filter((e) => e.part === 'glow').length, 0, 'the table grew a tune');
    assert(arrange(RIVER_RAG, 'calm').events.some((e) => e.part === 'glow'), 'the river lost its tune entirely');
  });
});

describe('sound: the engine stays quiet until it is allowed to play', () => {
  it('has every effect the game asks for', () => {
    // Each of these is played by name from a screen; a typo there is silent,
    // so the list is pinned here instead.
    for (const name of ['card', 'shuffle', 'deal', 'flop', 'chip', 'chips', 'allin', 'check', 'fold',
      'win', 'lose', 'click', 'page', 'nudge', 'right', 'wrong', 'bell', 'whistle', 'fanfare']) {
      assert(EFFECTS.includes(name), `no effect called ${name}`);
    }
  });

  it('does nothing, and says so, where there is no audio at all', () => {
    // Node has no AudioContext, which is the same situation as a browser
    // before the first tap: nothing may be created and nothing may throw.
    equal(unlock(), false);
    equal(sfx('chips'), false);
    setMusic('river');
    configure({ sfx: false, music: true });
    const st = audioState();
    equal(st.supported, false);
    equal(st.unlocked, false);
    equal(st.context, 'none', 'an AudioContext was made without a gesture');
    equal(st.wanted, 'river', 'the screen\'s wish for music is remembered for when it can play');
    equal(st.playing, null);
    equal(st.style, 'soft');
    configure({ style: 'calm' });
    equal(audioState().style, 'calm');
    configure({ style: 'kazoo' });
    equal(audioState().style, 'soft', 'an unknown style is not kept');
    configure({ sfx: true });
    setMusic(null);
  });
});
