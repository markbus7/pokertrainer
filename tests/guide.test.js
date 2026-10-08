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
import { sayings, RULES, QUESTIONS, answer, askFree } from '../src/js/ui/guide.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const fresh = () => new Profile({}, memory());

describe('Silas at your side', () => {
  it('always has a word: the road first at a stop, today\'s questions first on the river', () => {
    const p = fresh();
    const now = new Date('2026-10-08T12:00:00');
    const said = sayings(p, 'stop', now);
    assert(said.length > RULES.length, 'the rules, and more');
    equal(said[0].key, 'road');
    // The river has the road on its own banner, so he starts elsewhere there.
    equal(sayings(p, 'home', now)[0].key, 'daily');
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

describe('talking to Silas', () => {
  const played = () => {
    const p = fresh();
    p.lifetime.actions = { fold: [40, 36, 4, 1], call: [20, 12, 8, 14.5], raise: [12, 10, 2, 2] };
    p.lifetime.leaks = { 'called-short': [5, 9.5, 'Calling without the price', 1] };
    return p;
  };
  const said = (reply) => reply.lines.map((l) => l.text).join(' | ');

  it('answers "how am I doing" from your decisions, and names the weakest action', () => {
    const r = answer(played(), 'doing');
    equal(r.lines[0].params.pct, '81%');
    equal(r.lines[0].params.bb, '17.5 bb');
    equal(r.lines[1].params.action, 'Calls');
    equal(r.to.route, 'character');
    assert(/Nothing to judge yet/.test(said(answer(fresh(), 'doing'))), 'nothing played, nothing judged');
  });

  it('answers where the money goes, the size, the kind of player and the pearls', () => {
    const p = played();
    equal(answer(p, 'leak').lines[0].params.head, 'Calling without the price');
    assert(/No leak I can put a price on/.test(said(answer(fresh(), 'leak'))));
    assert(/No bets of yours measured yet/.test(said(answer(p, 'size'))));
    assert(/Too early to say/.test(said(answer(p, 'type'))), 'too few hands to name a style');
    assert(/No pearls yet/.test(said(answer(p, 'pearls'))));
    p.data.economy.pearls = 2000;
    equal(answer(p, 'pearls').to.route, 'store');
    assert(RULES.includes(answer(p, 'teach', () => 0).lines[0].text));
    assert(answer(p, 'next').lines.length === 1, 'the road has a next step');
  });

  it('looks up a word from the tables, the longest one named, in English or Dutch', () => {
    const r = askFree(fresh(), 'What are POT ODDS?');
    equal(r.lines[0].text, 'Pot odds');
    equal(r.to.route, 'glossary');
    equal(askFree(fresh(), 'tell me about the open-ended straight draw').lines[0].text, 'Open-ended straight draw');
  });

  it('turns a typed question into one of his, and says so when he cannot', () => {
    const p = played();
    equal(askFree(p, 'where do I lose the most?').lines[0].params.head, 'Calling without the price');
    assert(/No bets of yours measured/.test(said(askFree(p, 'am i betting too much'))));
    assert(/I do not know that one/.test(said(askFree(p, 'what is the weather'))));
    equal(askFree(p, '   '), null);
  });

  it('speaks Dutch: every question and every answer has an entry', () => {
    const p = played();
    const texts = new Set(QUESTIONS.map((q) => q.q));
    for (const { key } of QUESTIONS) for (const l of answer(p, key).lines) texts.add(l.text);
    for (const { key } of QUESTIONS) for (const l of answer(fresh(), key).lines) texts.add(l.text);
    texts.add(askFree(p, 'what is the weather').lines[0].text);
    p.data.economy.pearls = 2000;
    for (const l of answer(p, 'pearls').lines) texts.add(l.text);
    const missing = [...texts].filter((x) => !NL[x]);
    assert(missing.length === 0, `no Dutch for: ${missing.join(' | ')}`);
  });
});
