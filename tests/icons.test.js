import { describe, it, assert, equal } from './harness.js';
import { ICON_NAMES, ICON_PATHS, icon } from '../src/js/ui/icons.js';
import { MODULE_META } from '../src/js/data/curriculum.js';

describe('iconography', () => {
  it('has a drawing for every module', () => {
    // The bug this guards, which I wrote: modules used to carry a picture and
    // now carry the name of one. Every place that still painted the field as
    // text printed the literal string "m-cbet" into the interface.
    for (const meta of MODULE_META) {
      assert(ICON_NAMES.includes(meta.icon),
        `${meta.id} names the icon "${meta.icon}", which is not drawn`);
    }
  });

  it('names icons distinctly from anything a reader could see', () => {
    // A module icon reads as a name, never as something printable. If one
    // ever leaks into the DOM as text, it should be obviously wrong rather
    // than plausibly a label.
    for (const meta of MODULE_META) {
      assert(/^m-/.test(meta.icon), `${meta.id}'s icon should be prefixed: ${meta.icon}`);
    }
  });

  it('draws nothing at all for a name it does not have', () => {
    // Better a gap than a broken glyph in the middle of a sentence.
    equal(icon('not-a-real-icon'), null);
  });

  it('draws every icon on one grid, with a real shape', () => {
    // The rendering itself is checked at the table, in a browser. What can be
    // checked here is the data: that each name has a path, that it is a path
    // and not a stray string, and that nothing strayed off the 24-unit grid
    // the whole set is drawn on — one icon at a different scale is the kind
    // of thing nobody can name but everybody sees.
    for (const name of ICON_NAMES) {
      const d = ICON_PATHS[name];
      assert(typeof d === 'string' && d.length > 8, `${name} has no shape`);
      assert(/^[Mm]/.test(d), `${name} does not start with a move: ${d.slice(0, 12)}`);
      // Only the absolute commands say where a point is; relative ones say
      // how far to move, and -14 there is a direction, not a coordinate.
      const absolute = d.match(/[MLHV]\s*-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?)?/g) || [];
      const off = absolute
        .flatMap((cmd) => (cmd.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number))
        .filter((n) => n < 0 || n > 24);
      equal(off.length, 0, `${name} is drawn off the 24-unit grid at ${off.join(', ')}`);
    }
  });
});
