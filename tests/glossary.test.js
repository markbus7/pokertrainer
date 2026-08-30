import { describe, it, assert, equal } from './harness.js';
import { TERMS, TERM_KEYS, lookupTerm, allTerms } from '../src/js/data/glossary.js';
import { WALKTHROUGHS } from '../src/js/data/walkthroughs.js';

describe('glossary: entries are complete', () => {
  it('gives every term a name, a one-liner and a full explanation', () => {
    for (const key of TERM_KEYS) {
      const t = TERMS[key];
      assert(t.term && t.term.length > 1, `${key}: missing display name`);
      assert(t.short && t.short.length > 10, `${key}: needs a one-line summary`);
      assert(t.full && t.full.length > 60, `${key}: needs a real explanation`);
      assert(t.short.length < t.full.length, `${key}: the short form should be shorter`);
    }
  });

  it('has no broken text', () => {
    for (const key of TERM_KEYS) {
      const text = `${TERMS[key].short} ${TERMS[key].full}`;
      assert(!/undefined|NaN|TODO/.test(text), `${key}: broken text`);
    }
  });

  it('looks terms up regardless of case or a trailing s', () => {
    assert(lookupTerm('Gutshot'), 'case should not matter');
    assert(lookupTerm('GUTSHOT'), 'nor should shouting');
    assert(lookupTerm('  flush draw  '), 'nor should whitespace');
    equal(lookupTerm('outs').term, 'Outs');
    equal(lookupTerm('out').term, 'Out');
    equal(lookupTerm('not a real term'), null);
  });

  it('sorts the glossary alphabetically', () => {
    const names = allTerms().map((t) => t.term);
    equal(names.join('|'), [...names].sort((a, b) => a.localeCompare(b)).join('|'));
  });
});

describe('glossary: lessons only reference terms that exist', () => {
  it('resolves every [[term]] used in a lesson', () => {
    for (const [id, w] of Object.entries(WALKTHROUGHS)) {
      const text = JSON.stringify(w);
      for (const match of text.match(/\[\[([^\]]+)\]\]/g) || []) {
        const spec = match.slice(2, -2);
        const [name] = spec.split('|');
        assert(lookupTerm(name), `${id}: [[${name}]] has no glossary entry`);
      }
    }
  });

  it('defines the jargon that Pot Odds uses, since Outs unlocks later', () => {
    // Pot Odds is a level 1 module and talks about flush draws and gutshots;
    // Outs, which teaches both, does not unlock until level 2. The glossary
    // is what stops that ordering from leaving a reader stuck.
    for (const term of ['flush draw', 'gutshot', 'outs', 'equity']) {
      assert(lookupTerm(term), `${term} must be in the glossary`);
    }
  });

  it('explains a gutshot as an inside draw with four outs', () => {
    const g = lookupTerm('gutshot');
    assert(/four|4/i.test(g.full), 'should give the out count');
    assert(/inside|middle/i.test(g.full), 'should say where the gap is');
  });
});

describe('glossary: the pot odds lesson separates need from have', () => {
  it('states that the two numbers never convert into each other', () => {
    const text = JSON.stringify(WALKTHROUGHS['pot-odds']);
    assert(/neither one ever turns into the other/i.test(text),
      'the lesson must say the two figures are independent');
    assert(/comes from the \*\*money\*\* alone/i.test(text), 'need must be attributed to the money');
    assert(/comes from your \*\*cards\*\* alone/i.test(text), 'have must be attributed to the cards');
  });

  it('says what the 36% actually measures', () => {
    const text = JSON.stringify(WALKTHROUGHS['pot-odds']);
    assert(/chance one of your nine flush cards arrives/i.test(text),
      'the lesson should say what the equity figure is the probability of');
  });
});
