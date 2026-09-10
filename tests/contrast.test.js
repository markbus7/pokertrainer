import { describe, it, assert } from './harness.js';
import { readFileSync } from 'node:fs';

/**
 * The palette has to stay readable.
 *
 * This is checkable rather than a matter of taste, so it is checked. The
 * fourth text tone once sat at 3.33:1 on a card — under the readable floor —
 * while carrying stat labels, the module tiles' score line and every .faint
 * explanation. On a tablet in daylight that is the difference between
 * information and decoration.
 */
const CSS = readFileSync(new URL('../src/css/base.css', import.meta.url), 'utf8');

/** Pull a custom property out of :root. */
function token(name) {
  const found = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
  assert(found, `--${name} is not defined in base.css`);
  return found[1];
}

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

describe('theme: everything that carries words stays readable', () => {
  it('clears the contrast floor on every surface text sits on', () => {
    const surfaces = ['bg', 'bg-raised', 'bg-card'];
    const inks = ['text', 'text-dim', 'text-faint', 'gold', 'green', 'red', 'blue'];
    const failures = [];
    for (const ink of inks) {
      for (const surface of surfaces) {
        const ratio = contrast(token(ink), token(surface));
        if (ratio < READABLE) failures.push(`--${ink} on --${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
    assert(!failures.length, `below the ${READABLE}:1 readable floor:\n      ${failures.join('\n      ')}`);
  });

  it('keeps the three text tones distinct, so hierarchy still reads', () => {
    // A palette can pass contrast and still be flat. Each step down has to
    // be visibly dimmer than the one above it on the same surface.
    const card = token('bg-card');
    const steps = ['text', 'text-dim', 'text-faint'].map((n) => contrast(token(n), card));
    for (let i = 1; i < steps.length; i++) {
      assert(steps[i] < steps[i - 1] * 0.9,
        `text tone ${i + 1} is not a clear step down: ${steps.map((s) => s.toFixed(2)).join(' → ')}`);
    }
  });

  it('keeps the felt legible, since the table is where the reading happens', () => {
    for (const felt of ['felt-1', 'felt-2']) {
      const ratio = contrast(token('text'), token(felt));
      assert(ratio >= READABLE, `--text on --${felt} is ${ratio.toFixed(2)}:1`);
    }
  });
});
