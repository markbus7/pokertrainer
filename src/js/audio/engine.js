/**
 * Sound, made on the spot.
 *
 * No files: every chip, card, knock and whistle is synthesised with Web Audio
 * when it is needed, and the piano is a pair of oscillators per note. That
 * keeps the app a folder of text that works offline, and it means every
 * sound is original — nothing here was sampled from anywhere.
 *
 * Two switches, kept apart on purpose: effects (`settings.sound`) tell you
 * what just happened at the table, music (`settings.music`) is atmosphere.
 * Somebody studying on a train wants the first and not the second.
 *
 * Browsers will not start audio before the reader has touched the page, and
 * log a warning when anything tries. So nothing here creates an AudioContext
 * until unlock() is called from a real gesture; a sound asked for before
 * that is simply not played, and music asked for before that waits for it.
 */

import { TUNES, arrange, styleFor, DEFAULT_STYLE } from './tunes.js';

const state = {
  sfx: true,
  music: true,
  style: DEFAULT_STYLE,
  unlocked: false,
  wanted: null,   // the track the current screen asks for
  playing: null,  // the track actually running
};

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let musicTone = null;
let noise = null;
let track = null; // { key, style, gain, events, beats, beatDur, loopStart, idx, timer }
let preview = null; // a few bars played when a style is picked on a quiet screen

const supported = () => typeof window !== 'undefined'
  && (typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function');

/* ------------------------------------------------------------------ *
 * The mixer
 * ------------------------------------------------------------------ */

function build() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0.9;
  // A soft ceiling so a pile of chips on top of a chord cannot clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = state.sfx ? 0.85 : 0;
  sfxBus.connect(master);

  // The piano sits behind everything and is rolled off at the top, so it
  // reads as a room with a piano in it rather than a piano in your ear.
  musicTone = ctx.createBiquadFilter();
  musicTone.type = 'lowpass';
  musicTone.frequency.value = styleFor(state.style).brightness;
  musicBus = ctx.createGain();
  musicBus.gain.value = state.music ? 0.36 : 0;
  musicBus.connect(musicTone).connect(master);

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

/** Call from a pointer or key handler. Safe to call on every one. */
export function unlock() {
  if (!supported()) return false;
  if (!ctx) build();
  if (ctx.state === 'suspended') ctx.resume();
  if (!state.unlocked) {
    state.unlocked = true;
    syncMusic();
  }
  return true;
}

/** Apply the reader's switches and music style. Any may be left out. */
export function configure({ sfx, music, style } = {}) {
  if (typeof sfx === 'boolean') state.sfx = sfx;
  if (typeof music === 'boolean') state.music = music;
  if (typeof style === 'string') state.style = styleFor(style).key;
  if (ctx) {
    const now = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(state.sfx ? 0.85 : 0, now, 0.05);
    musicBus.gain.setTargetAtTime(state.music ? 0.36 : 0, now, 0.2);
  }
  syncMusic();
}

/** Which track this screen wants: 'river', 'table', or null for quiet. */
export function setMusic(key) {
  state.wanted = key && TUNES[key] ? key : null;
  syncMusic();
}

/** A tab in the background should not keep a piano going. */
export function pause() {
  if (ctx && ctx.state === 'running') ctx.suspend();
}

export function resume() {
  if (ctx && state.unlocked && ctx.state === 'suspended') ctx.resume();
}

/** For tests and the settings screen. */
export function audioState() {
  return {
    supported: supported(),
    unlocked: state.unlocked,
    sfx: state.sfx,
    music: state.music,
    wanted: state.wanted,
    playing: state.playing,
    style: state.style,
    context: ctx ? ctx.state : 'none',
  };
}

/* ------------------------------------------------------------------ *
 * Music
 * ------------------------------------------------------------------ */

function syncMusic() {
  if (!ctx || !state.unlocked) return;
  musicTone.frequency.setTargetAtTime(styleFor(state.style).brightness, ctx.currentTime, 0.3);
  const want = state.music ? state.wanted : null;
  if (want === state.playing && (!track || track.style === state.style)) return;
  if (track) fadeOut(track);
  if (preview && (want || !state.music)) { fadeOut(preview); preview = null; }
  track = null;
  state.playing = null;
  if (want) {
    track = startTrack(want, state.style);
    state.playing = want;
  }
}

/**
 * Let the reader hear a style they just picked, on a screen that is quiet
 * on purpose: a few bars of the river tune, then gone. A screen with music
 * of its own needs none — the change is already playing.
 */
export function previewStyle() {
  if (!ctx || !state.unlocked || !state.music || track) return false;
  if (preview) fadeOut(preview);
  const t = startTrack('river', state.style);
  preview = t;
  setTimeout(() => {
    if (preview !== t) return;
    fadeOut(t);
    preview = null;
  }, 7000);
  return true;
}

function startTrack(key, style) {
  const tune = TUNES[key];
  const { events, beats, bpm } = arrange(tune, style);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
  gain.connect(musicBus);
  const t = {
    key,
    style,
    voice: VOICES[styleFor(style).key],
    ctx,
    gain,
    events,
    beats,
    beatDur: 60 / bpm,
    loopStart: ctx.currentTime + 0.15,
    idx: 0,
    timer: null,
  };
  // Standard look-ahead scheduling: a coarse JavaScript timer hands notes to
  // the audio clock a little early, and the audio clock plays them exactly.
  t.timer = setInterval(() => schedule(t), 40);
  schedule(t);
  return t;
}

function schedule(t) {
  // A measurement borrows the module's context for a moment; a track must
  // never schedule into anything but the one it was started on.
  if (!ctx || ctx !== t.ctx) return;
  const horizon = ctx.currentTime + 0.2;
  const loopLen = t.beats * t.beatDur;
  for (let guard = 0; guard < 64; guard++) {
    const e = t.events[t.idx];
    const when = t.loopStart + e.at * t.beatDur;
    if (when > horizon) break;
    if (when >= ctx.currentTime - 0.02) t.voice(t.gain, when, e, t.beatDur);
    t.idx++;
    if (t.idx >= t.events.length) {
      t.idx = 0;
      t.loopStart += loopLen;
    }
  }
}

function fadeOut(t) {
  clearInterval(t.timer);
  if (t.ctx !== ctx) return;
  const now = ctx.currentTime;
  t.gain.gain.cancelScheduledValues(now);
  t.gain.gain.setValueAtTime(Math.max(t.gain.gain.value, 0.0001), now);
  t.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  setTimeout(() => t.gain.disconnect(), 1200);
}

const freq = (m) => 440 * 2 ** ((m - 69) / 12);

const VOICE = {
  melody: { level: 0.2, ring: 0.9 },
  chord: { level: 0.075, ring: 0.5 },
  bass: { level: 0.19, ring: 1.3 },
};

/**
 * One piano note: a triangle at pitch and a sine an octave up, a few cents
 * apart. The detune is the honky-tonk — an upright nobody has tuned since
 * the boat was launched.
 */
function pianoNote(out, time, e, beatDur) {
  const v = VOICE[e.part];
  const held = Math.max(0.12, e.dur * beatDur);
  const end = time + Math.min(v.ring, held + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(v.level, time + 0.006);
  g.gain.exponentialRampToValueAtTime(v.level * 0.4, time + 0.14);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(out);

  const f = freq(e.midi);
  const a = ctx.createOscillator();
  a.type = 'triangle';
  a.frequency.value = f;
  a.detune.value = 5;
  const b = ctx.createOscillator();
  b.type = 'sine';
  b.frequency.value = f * 2;
  b.detune.value = -6;
  const bLevel = ctx.createGain();
  bLevel.gain.value = e.part === 'bass' ? 0.2 : 0.32;
  a.connect(g);
  b.connect(bLevel).connect(g);
  a.start(time);
  b.start(time);
  a.stop(end + 0.02);
  b.stop(end + 0.02);
}

/**
 * The felt piano. A sine at pitch with a little triangle under it for body,
 * through a filter that starts warm and closes as the note dies — which is
 * what a hammer with felt on it does, and what makes it gentle: there is no
 * click at the front and no glassy overtone ringing on after it. No detune;
 * this one has been tuned.
 */
const SOFT = {
  melody: { level: 0.11, ring: 1.6 },
  chord: { level: 0.032, ring: 0.8 },
  bass: { level: 0.11, ring: 1.5 },
};

function softNote(out, time, e, beatDur) {
  const v = SOFT[e.part];
  const held = Math.max(0.15, e.dur * beatDur);
  const end = time + Math.min(v.ring, held + 0.4);
  const f = freq(e.midi);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(v.level, time + 0.02);
  g.gain.exponentialRampToValueAtTime(v.level * 0.45, time + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(out);

  const felt = ctx.createBiquadFilter();
  felt.type = 'lowpass';
  felt.Q.value = 0.5;
  felt.frequency.setValueAtTime(Math.min(f * 3, 1800), time);
  felt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.3, 220), end);
  felt.connect(g);

  const a = ctx.createOscillator();
  a.type = 'sine';
  a.frequency.value = f;
  const b = ctx.createOscillator();
  b.type = 'triangle';
  b.frequency.value = f;
  const bLevel = ctx.createGain();
  bLevel.gain.value = 0.2;
  a.connect(felt);
  b.connect(bLevel).connect(felt);
  a.start(time);
  b.start(time);
  a.stop(end + 0.02);
  b.stop(end + 0.02);
}

/**
 * "Calm water": every note swells in rather than being struck. The pad is
 * two triangles a few cents apart under a low filter, so it moves slowly
 * against itself; the low root is a plain sine; the glow is a soft bell on
 * top that fades over a couple of seconds.
 */
const CALM = {
  pad: { level: 0.032 },
  deep: { level: 0.065 },
  glow: { level: 0.07 },
};

function calmNote(out, time, e, beatDur) {
  const v = CALM[e.part];
  const f = freq(e.midi);
  const g = ctx.createGain();
  g.connect(out);
  let end;
  if (e.part === 'glow') {
    end = time + 2.6;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(v.level, time + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    const held = e.dur * beatDur;
    const swell = Math.min(0.9, held * 0.4);
    end = time + held + 1.6;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(v.level, time + swell);
    g.gain.setValueAtTime(v.level, time + held);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }

  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.Q.value = 0.3;
  soft.frequency.value = e.part === 'glow' ? 1600 : 900;
  soft.connect(g);

  const voices = e.part === 'pad' ? [['triangle', 4], ['triangle', -4]] : [['sine', 0]];
  for (const [type, detune] of voices) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(soft);
    o.start(time);
    o.stop(end + 0.02);
  }
}

const VOICES = { soft: softNote, honky: pianoNote, calm: calmNote };

/* ------------------------------------------------------------------ *
 * Effects
 * ------------------------------------------------------------------ */

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

function envGain(out, time, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  g.connect(out);
  return g;
}

function tone(out, time, { type = 'sine', f, peak, attack = 0.003, decay, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, time);
  o.detune.value = detune;
  o.connect(envGain(out, time, peak, attack, decay));
  o.start(time);
  o.stop(time + attack + decay + 0.02);
  return o;
}

function hiss(out, time, { peak, attack = 0.003, decay, type = 'bandpass', f = 3000, q = 1, to = null }) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(f, time);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, time + attack + decay);
  filter.Q.value = q;
  src.connect(filter).connect(envGain(out, time, peak, attack, decay));
  src.start(time, rand(0, 0.5));
  src.stop(time + attack + decay + 0.02);
}

function chip(out, time, lift = 1) {
  const j = rand(0.94, 1.06) * lift;
  tone(out, time, { f: 3150 * j, peak: 0.1, decay: 0.05 });
  tone(out, time, { f: 4630 * j, peak: 0.065, decay: 0.04 });
  tone(out, time, { f: 6720 * j, peak: 0.04, decay: 0.03 });
  hiss(out, time, { peak: 0.08, decay: 0.012, type: 'highpass', f: 5000, q: 0.5 });
}

function knock(out, time, peak) {
  tone(out, time, { f: rand(190, 225), peak, decay: 0.07 });
  hiss(out, time, { peak: peak * 0.6, decay: 0.05, type: 'lowpass', f: 900, q: 0.7 });
}

function bellTone(out, time, base, peak) {
  const partials = [[1, 1, 2.2], [2.0, 0.45, 1.6], [2.76, 0.38, 1.2], [3.93, 0.22, 0.9], [5.4, 0.14, 0.6]];
  for (const [ratio, share, decay] of partials) {
    tone(out, time, { f: base * ratio, peak: peak * share, attack: 0.002, decay });
  }
  hiss(out, time, { peak: peak * 0.4, decay: 0.02, f: 4000, q: 0.8 });
}

function brass(out, time, f, dur, peak) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(f * 1.2, time);
  filter.frequency.exponentialRampToValueAtTime(f * 6, time + 0.06);
  filter.frequency.exponentialRampToValueAtTime(f * 3, time + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.03);
  g.gain.setValueAtTime(peak, time + Math.max(0.04, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.12);
  o.connect(filter).connect(g).connect(out);
  o.start(time);
  o.stop(time + dur + 0.15);
}

const NOTE = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, Eb4: 311.13, D4: 293.66 };

/** Every effect by name. Each takes (bus, startTime). */
const RECIPES = {
  card(out, t) {
    hiss(out, t, { peak: 0.32, attack: 0.004, decay: 0.065, f: rand(2600, 3800), q: 0.9 });
    tone(out, t + 0.02, { f: 170, peak: 0.08, decay: 0.05 });
  },
  shuffle(out, t) {
    for (let i = 0; i < 14; i++) {
      hiss(out, t + i * 0.03 + rand(0, 0.01), { peak: rand(0.06, 0.12), decay: 0.02, f: 3500, q: 1.2 });
    }
  },
  deal(out, t) {
    for (let i = 0; i < 4; i++) RECIPES.card(out, t + i * 0.09);
  },
  right(out, t) {
    // A right answer: two bright notes, up a third. Short, so a run of
    // twelve does not become a tune.
    tone(out, t, { f: NOTE.C6, peak: 0.1, attack: 0.004, decay: 0.16 });
    tone(out, t + 0.07, { f: 1318.5, peak: 0.1, attack: 0.004, decay: 0.3 });
    tone(out, t + 0.07, { f: 2637, peak: 0.02, attack: 0.004, decay: 0.12 });
  },
  wrong(out, t) {
    // A wrong one: a soft, low knock and a note that sags. Information, not a
    // buzzer — being told off by a game is how people stop studying.
    knock(out, t, 0.14);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(165, t + 0.4);
    o.connect(envGain(out, t + 0.05, 0.08, 0.02, 0.38));
    o.start(t + 0.05);
    o.stop(t + 0.5);
  },
  flop(out, t) {
    for (let i = 0; i < 3; i++) RECIPES.card(out, t + i * 0.11);
  },
  nudge(out, t) {
    // Your turn: two soft notes, a question rather than an alarm.
    tone(out, t, { f: NOTE.E5, peak: 0.05, attack: 0.01, decay: 0.25 });
    tone(out, t + 0.1, { f: NOTE.G5, peak: 0.045, attack: 0.01, decay: 0.3 });
  },
  chip(out, t) { chip(out, t); },
  chips(out, t) {
    let at = t;
    for (let i = 0; i < 4; i++) { chip(out, at); at += rand(0.028, 0.048); }
  },
  allin(out, t) {
    let at = t;
    for (let i = 0; i < 12; i++) { chip(out, at, rand(0.9, 1.1)); at += rand(0.018, 0.04); }
    tone(out, t, { f: 90, peak: 0.25, decay: 0.2 });
  },
  check(out, t) {
    knock(out, t, 0.32);
    knock(out, t + 0.11, 0.24);
  },
  fold(out, t) {
    hiss(out, t, { peak: 0.14, attack: 0.02, decay: 0.2, f: 2600, to: 700, q: 0.7 });
  },
  win(out, t) {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
      tone(out, t + i * 0.08, { f, peak: 0.13, decay: 0.55 });
      tone(out, t + i * 0.08, { f: f * 2, peak: 0.04, decay: 0.3 });
    });
    RECIPES.chips(out, t + 0.12);
  },
  lose(out, t) {
    tone(out, t, { type: 'triangle', f: NOTE.G4, peak: 0.1, attack: 0.02, decay: 0.3 });
    tone(out, t + 0.28, { type: 'triangle', f: NOTE.Eb4, peak: 0.1, attack: 0.02, decay: 0.45 });
  },
  click(out, t) {
    tone(out, t, { f: 1500, peak: 0.05, decay: 0.012 });
  },
  page(out, t) {
    // A page turned: the sweep of paper through air, then the edge settling.
    hiss(out, t, { peak: 0.09, attack: 0.03, decay: 0.12, f: 1200, to: 3800, q: 0.6 });
    hiss(out, t + 0.1, { peak: 0.05, attack: 0.01, decay: 0.08, type: 'highpass', f: 2500, q: 0.5 });
  },
  bell(out, t) {
    bellTone(out, t, 587.33, 0.16);
    bellTone(out, t + 0.45, 587.33, 0.12);
  },
  whistle(out, t) {
    // A three-chime steam whistle: a short toot, then the long one, sliding
    // up to pitch the way a whistle does while the steam gets going.
    const toot = (start, len) => {
      for (const f of [311.13, 392, 466.16]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.95, start);
        o.frequency.exponentialRampToValueAtTime(f, start + 0.18);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.05, start + 0.07);
        g.gain.setValueAtTime(0.05, start + len);
        g.gain.exponentialRampToValueAtTime(0.0001, start + len + 0.3);
        o.connect(filter).connect(g).connect(out);
        o.start(start);
        o.stop(start + len + 0.35);
      }
      hiss(out, start, { peak: 0.05, attack: 0.05, decay: len + 0.25, f: 1500, q: 0.6 });
    };
    toot(t, 0.22);
    toot(t + 0.42, 0.95);
  },
  fanfare(out, t) {
    const steps = [[NOTE.G4, 0.16], [NOTE.C5, 0.16], [NOTE.E5, 0.16], [NOTE.G5, 0.8]];
    let at = t;
    for (const [f, len] of steps) { brass(out, at, f, len, 0.075); at += len + 0.02; }
    const held = at - 0.82;
    for (const f of [261.63, 329.63, 392]) brass(out, held, f, 0.8, 0.04);
  },
};

export const EFFECTS = Object.keys(RECIPES);

/** Play an effect by name. Silently does nothing if it cannot. */
export function sfx(name) {
  if (!ctx || !state.unlocked || !state.sfx || !RECIPES[name]) return false;
  if (ctx.state === 'suspended') ctx.resume();
  RECIPES[name](sfxBus, ctx.currentTime + 0.01);
  return true;
}

/**
 * Render an effect or some music offline and report its level, so a test
 * can check nothing clips without anybody having to listen.
 */
export async function measure(kind, name, seconds = 2, style = DEFAULT_STYLE) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const saved = { ctx, master, sfxBus, musicBus, noise };
  const off = new Offline(1, Math.ceil(44100 * seconds), 44100);
  ctx = off;
  master = off.createGain();
  master.gain.value = 0.9;
  master.connect(off.destination);
  sfxBus = off.createGain();
  sfxBus.gain.value = 0.85;
  sfxBus.connect(master);
  musicBus = off.createGain();
  musicBus.gain.value = 0.36;
  const rolloff = off.createBiquadFilter();
  rolloff.type = 'lowpass';
  rolloff.frequency.value = styleFor(style).brightness;
  musicBus.connect(rolloff).connect(master);
  noise = off.createBuffer(1, off.sampleRate, off.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  try {
    if (kind === 'sfx') {
      RECIPES[name](sfxBus, 0.01);
    } else {
      const { events, bpm } = arrange(TUNES[name], style);
      const beatDur = 60 / bpm;
      const voice = VOICES[styleFor(style).key];
      for (const e of events) {
        const when = e.at * beatDur;
        if (when < seconds) voice(musicBus, when, e, beatDur);
      }
    }
    const buffer = await off.startRendering();
    const samples = buffer.getChannelData(0);
    let peak = 0;
    let sum = 0;
    for (const s of samples) { const a = Math.abs(s); if (a > peak) peak = a; sum += s * s; }
    return { peak, rms: Math.sqrt(sum / samples.length), samples };
  } finally {
    ({ ctx, master, sfxBus, musicBus, noise } = saved);
  }
}
