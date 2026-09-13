import { describe, it, assert, equal } from './harness.js';
import { readFileSync } from 'node:fs';
import { THEMES } from '../src/js/data/themes.js';

/**
 * Every room has to stay readable.
 *
 * This is checkable rather than a matter of taste, so it is checked — and now
 * four times over. The fourth text tone once sat at 3.33:1 on a card, under
 * the readable floor, while carrying stat labels, the module tiles' score line
 * and every .faint explanation. On a tablet in daylight that is the difference
 * between information and decoration, and a palette a reader picked for
 * themselves is no more exempt from that than one the app chose for them.
 *
 * The rule this suite really protects is the one in themes.css: colour lives
 * there and nowhere else. A hardcoded hex in a component is a surface that
 * silently keeps the old palette, so the last test walks the stylesheets and
 * fails on any that appear outside the two exempt surfaces.
 */
const themeCss = readFileSync(new URL('../src/css/themes.css', import.meta.url), 'utf8');

/** Parse themes.css into { theme: { token: value } }. */
function parseThemes(css) {
  const out = {};
  const block = /\[data-theme='([a-z]+)'\][^{]*\{([^}]*)\}/g;
  let m;
  while ((m = block.exec(css))) {
    const tokens = {};
    for (const [, name, value] of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
      tokens[name] = value.trim();
    }
    out[m[1]] = tokens;
  }
  return out;
}

const PALETTES = parseThemes(themeCss);

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// WCAG AA for body-sized text. Anything carrying words has to clear it.
const READABLE = 4.5;

const hex = (theme, name) => {
  const value = PALETTES[theme][name];
  assert(value, `--${name} is not defined for ${theme}`);
  assert(/^#[0-9a-fA-F]{6}$/.test(value), `--${name} in ${theme} is not a plain hex: ${value}`);
  return value;
};

describe('theme: every room is a complete palette', () => {
  it('defines all four rooms', () => {
    const parsed = Object.keys(PALETTES).sort();
    const declared = THEMES.map((t) => t.key).sort();
    equal(parsed.join(','), declared.join(','), 'themes.css and themes.js disagree on the room list');
  });

  it('gives every room the same token set, so none falls back to another', () => {
    // A token missing from one room does not break loudly: it inherits the
    // default room's value and paints one wrong colour into an otherwise
    // right screen, which is the hardest kind of theme bug to see.
    const reference = Object.keys(PALETTES.midnight).sort();
    for (const theme of Object.keys(PALETTES)) {
      const got = Object.keys(PALETTES[theme]).sort();
      const missing = reference.filter((k) => !got.includes(k));
      const extra = got.filter((k) => !reference.includes(k));
      assert(!missing.length && !extra.length,
        `${theme} differs from midnight — missing: [${missing}] extra: [${extra}]`);
    }
  });

  it('paints the picker in the colours the room actually uses', () => {
    // The swatch is duplicated into themes.js so the picker does not have to
    // wait on the stylesheet. Duplication is fine; drift is not.
    for (const theme of THEMES) {
      const p = PALETTES[theme.key];
      equal(theme.swatch.bg, p.bg, `${theme.key} swatch ground is stale`);
      equal(theme.swatch.accent, p.accent, `${theme.key} swatch accent is stale`);
      equal(theme.swatch.felt, p['felt-1'], `${theme.key} swatch felt is stale`);
    }
  });
});

describe('theme: everything that carries words stays readable', () => {
  it('clears the contrast floor on every surface text sits on', () => {
    const surfaces = ['bg', 'bg-raised', 'bg-card'];
    const inks = ['text', 'text-dim', 'text-faint', 'accent', 'green', 'red', 'blue'];
    const failures = [];
    for (const theme of Object.keys(PALETTES)) {
      for (const ink of inks) {
        for (const surface of surfaces) {
          const ratio = contrast(hex(theme, ink), hex(theme, surface));
          if (ratio < READABLE) failures.push(`${theme}: --${ink} on --${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
    }
    assert(!failures.length, `below the ${READABLE}:1 readable floor:\n      ${failures.join('\n      ')}`);
  });

  it('keeps the ink on a filled button readable', () => {
    // The primary button is accent-filled with --on-accent lettering. Get
    // this wrong in the light room and the main call to action goes blank.
    for (const theme of Object.keys(PALETTES)) {
      const ratio = contrast(hex(theme, 'on-accent'), hex(theme, 'accent'));
      assert(ratio >= READABLE, `${theme}: --on-accent on --accent is ${ratio.toFixed(2)}:1`);
    }
  });

  it('keeps the three text tones distinct, so hierarchy still reads', () => {
    // A palette can pass contrast and still be flat. Each step down has to
    // be visibly dimmer than the one above it on the same surface.
    for (const theme of Object.keys(PALETTES)) {
      const card = hex(theme, 'bg-card');
      const steps = ['text', 'text-dim', 'text-faint'].map((n) => contrast(hex(theme, n), card));
      for (let i = 1; i < steps.length; i++) {
        assert(steps[i] < steps[i - 1] * 0.9,
          `${theme}: text tone ${i + 1} is not a clear step down: ${steps.map((s) => s.toFixed(2)).join(' → ')}`);
      }
    }
  });

  it('keeps the felt legible, since the table is where the reading happens', () => {
    // Seat plates, pot labels and stack sizes are painted in white on the
    // cloth in every room — the felt is dark material even in daylight — so
    // the floor here is white against the cloth, not the room's own ink.
    for (const theme of Object.keys(PALETTES)) {
      for (const felt of ['felt-1', 'felt-2', 'felt-3']) {
        const ratio = contrast('#ffffff', hex(theme, felt));
        assert(ratio >= READABLE, `${theme}: white on --${felt} is ${ratio.toFixed(2)}:1`);
      }
    }
  });

  it('makes the rooms actually different, not one palette four times', () => {
    // Two rooms that differ only in a shade are a settings entry, not a
    // choice. Grounds have to be visibly apart from each other.
    const grounds = THEMES.map((t) => [t.key, hex(t.key, 'bg')]);
    for (let i = 0; i < grounds.length; i++) {
      for (let j = i + 1; j < grounds.length; j++) {
        const [a, av] = grounds[i];
        const [b, bv] = grounds[j];
        const apart = Math.abs(luminance(av) - luminance(bv)) > 0.002
          || channels(av).some((c, k) => Math.abs(c - channels(bv)[k]) > 0.02);
        assert(apart, `${a} and ${b} have near-identical grounds (${av} / ${bv})`);
      }
    }
  });
});

describe('theme: colour lives in themes.css and nowhere else', () => {
  it('leaves no colour literal in a component stylesheet', () => {
    // The exemptions are the felt and a playing card: dark cloth and a white
    // card are the same material in every room, and tokenising them would
    // make daylight paint white text onto a white card.
    const exempt = /felt|card|pot-chip|seat-plate|seat-action|spot-hole|replay-dot|range-cell|chip|watermark|dealer-button/i;
    const offenders = [];
    for (const file of ['base.css', 'table.css']) {
      const text = readFileSync(new URL(`../src/css/${file}`, import.meta.url), 'utf8');
      let selector = '';
      for (const line of text.split('\n')) {
        if (/[{,]\s*$/.test(line) && !/^\s*(\*|\/\*)/.test(line)) selector = line;
        if (/^\s*(\*|\/\*|\/\/)/.test(line)) continue;
        const literal = /(#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d)/.exec(line);
        if (!literal) continue;
        // black and white are finishes — shadows and lit edges — not palette.
        if (/rgba?\(\s*(0,\s*0,\s*0|255,\s*255,\s*255)/.test(line)) continue;
        if (exempt.test(selector) || exempt.test(line)) continue;
        offenders.push(`${file}: ${line.trim().slice(0, 72)}`);
      }
    }
    assert(!offenders.length,
      `colour literals outside themes.css:\n      ${offenders.join('\n      ')}`);
  });
});

describe('theme: the cloth keeps its own ink', () => {
  it('never letters something on the felt in the room\'s text colour', () => {
    // Found by looking at the light room: seat names inherited --text, which
    // is near-black there, and the whole table went blank against its dark
    // plates. Anything lettered on the cloth takes --on-felt*, which is
    // constant, because the cloth is dark in every room.
    const onFelt = /seat-name|seat-stack|seat-pos|seat-action|seat-bet|pot-chip|spot-hole|lab-pot/;
    const roomInk = /var\(--(text|text-dim|text-faint|gold|accent)\)/;
    const offenders = [];
    let selector = '';
    const css = ['base.css', 'table.css']
      .map((f) => readFileSync(new URL(`../src/css/${f}`, import.meta.url), 'utf8'))
      .join('\n');
    for (const line of css.split('\n')) {
      if (line.includes('{')) selector = line.slice(0, line.indexOf('{'));
      if (!onFelt.test(selector)) continue;
      for (const decl of line.split(';')) {
        if (/(^|\s)color:/.test(decl) && roomInk.test(decl)) {
          offenders.push(`${selector.trim()} → ${decl.trim()}`);
        }
      }
    }
    assert(!offenders.length,
      `room ink lettered onto the felt:\n      ${offenders.join('\n      ')}`);
  });
});
