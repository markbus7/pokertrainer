/**
 * Silas at your side: what he says on each screen.
 *
 * What these pin: he always has something to say; what a screen is about
 * comes first (your leak on your character, the road on the river, your
 * pearls at the Trading Post); every word he can say is in Dutch; and a word
 * that sends you somewhere sends you to a screen that exists.
 */

import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { sayings, RULES } from '../src/js/ui/guide.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const fresh = () => new Profile({}, memory());

describe('Silas at your side', () => {
  it('always has a word, and the road comes first on the river', () => {
    const p = fresh();
    const said = sayings(p, 'home', new Date('2026-10-08T12:00:00'));
    assert(said.length > RULES.length, 'the rules, and more');
    equal(said[0].key, 'road');
    assert(said.some((s) => s.key === 'daily'), 'today\'s questions while they are to do');
  });

  it('puts your costliest habit first on your character, and your pearls first at the Trading Post', () => {
    const p = fresh();
    p.lifetime.leaks = { 'called-short': [4, 7.5, 'Calling without the price', 1] };
    p.lifetime.actions = { call: [10, 6, 4, 7.5] };
    p.data.economy.pearls = 5000;
    const onCharacter = sayings(p, 'character');
    equal(onCharacter[0].key, 'leak');
    equal(onCharacter[0].params.bb, '7.5 bb');
    equal(onCharacter[0].to.route, 'character');
    equal(sayings(p, 'store')[0].key, 'pearls');
  });

  it('speaks Dutch: every sentence he can say has an entry', () => {
    const p = fresh();
    p.lifetime.leaks = { x: [4, 0, 'Outside the range', 0] };
    p.data.economy.pearls = 5000;
    const texts = new Set(sayings(p, 'home').map((s) => s.text));
    [
      'Your costliest mistake so far: “{head}”. About {bb} gone. That is the one we fix first.',
      'Your sizes run small on this one: {kind}. A small bet gives them a cheap price to draw and to catch up.',
      'Your sizes run big on this one: {kind}. Too big, and only the hands that beat you stay in.',
      'Today\'s three questions are waiting. {n} days in a row: keep it going.',
    ].forEach((x) => texts.add(x));
    const missing = [...texts].filter((x) => !NL[x]);
    assert(missing.length === 0, `no Dutch for: ${missing.join(' | ')}`);
  });
});
