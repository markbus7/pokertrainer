import { describe, it, assert, equal, close } from './harness.js';
import { WALKTHROUGHS } from '../src/js/data/walkthroughs.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { requiredEquity, minimumDefenceFrequency, breakEvenBluffFrequency, spr } from '../src/js/core/odds.js';
import { exactOutsEquity } from '../src/js/core/equity.js';

const entries = Object.entries(WALKTHROUGHS);

describe('walkthroughs: every module is covered', () => {
  it('has a guided lesson for every curriculum module', () => {
    for (const meta of MODULE_META) {
      assert(WALKTHROUGHS[meta.id], `${meta.id} has no guided lesson`);
    }
  });

  it('does not define lessons for modules that do not exist', () => {
    const known = new Set(MODULE_META.map((m) => m.id));
    for (const [id] of entries) assert(known.has(id), `walkthrough "${id}" matches no module`);
  });

  it('gives every lesson an intro, steps and a recap', () => {
    for (const [id, w] of entries) {
      assert(w.intro && w.intro.length > 30, `${id}: intro must set up what you will learn`);
      assert(w.steps.length >= 3, `${id}: needs at least three steps, has ${w.steps.length}`);
      assert(w.recap && w.recap.length >= 3, `${id}: needs a recap`);
    }
  });
});

describe('walkthroughs: step structure', () => {
  it('gives every step a title, real body text and a check', () => {
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        const at = `${id} step ${i + 1}`;
        assert(step.title && step.title.length > 5, `${at}: missing title`);
        assert(Array.isArray(step.body) && step.body.length >= 2, `${at}: body should be several paragraphs`);
        // A low floor on purpose: some lines are meant to be terse (a formula
        // line, or "You have: 36%" answering the line above it). This catches
        // empty strings and stubs, and the placeholder test catches the rest.
        for (const para of step.body) {
          assert(typeof para === 'string', `${at}: paragraph must be a string`);
          assert(para.trim().length >= 8, `${at}: empty or stub paragraph: ${JSON.stringify(para)}`);
        }
        const prose = step.body.join(' ');
        assert(prose.length > 200, `${at}: not enough explanation to teach the idea (${prose.length} chars)`);
        assert(step.check, `${at}: every step must end in a comprehension check`);
      });
    }
  });

  it('makes every check answerable, with the answer among the options', () => {
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        const at = `${id} step ${i + 1}`;
        const { check } = step;
        assert(check.question && check.question.length > 10, `${at}: check needs a question`);
        assert(check.options.length >= 2, `${at}: check needs at least two options`);
        const answer = check.options.find((o) => o.key === check.answer);
        assert(answer, `${at}: answer key "${check.answer}" is not one of the options`);
      });
    }
  });

  it('explains every option — including, and especially, the wrong ones', () => {
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        for (const option of step.check.options) {
          const at = `${id} step ${i + 1} option ${option.key}`;
          assert(option.label && option.label.length >= 1, `${at}: missing label`);
          assert(option.why && option.why.length > 40,
            `${at}: needs an explanation aimed at this specific answer, not a generic one`);
        }
      });
    }
  });

  it('uses unique option keys and distinct labels within a check', () => {
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        const at = `${id} step ${i + 1}`;
        const keys = step.check.options.map((o) => o.key);
        equal(new Set(keys).size, keys.length, `${at}: duplicate option keys`);
        const labels = step.check.options.map((o) => o.label);
        equal(new Set(labels).size, labels.length, `${at}: duplicate option labels`);
      });
    }
  });

  it('never leaves a broken placeholder in the prose', () => {
    for (const [id, w] of entries) {
      const text = JSON.stringify(w);
      for (const bad of ['undefined', 'NaN', '[object Object]', 'TODO', 'XXX']) {
        assert(!text.includes(bad), `${id}: contains "${bad}"`);
      }
    }
  });

  it('closes every emphasis marker it opens, bold and italic alike', () => {
    // An unbalanced marker renders as a literal asterisk in the lesson text.
    const checkText = (text, where) => {
      const bold = (text.match(/\*\*/g) || []).length;
      equal(bold % 2, 0, `${where}: unbalanced ** in "${text.slice(0, 50)}…"`);
      const singles = ((text.replace(/\*\*/g, '')).match(/\*/g) || []).length;
      equal(singles % 2, 0, `${where}: unbalanced * in "${text.slice(0, 50)}…"`);
    };
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        const where = `${id} step ${i + 1}`;
        for (const para of step.body) checkText(para, where);
        checkText(step.check.question, `${where} question`);
        for (const option of step.check.options) checkText(option.why, `${where} option ${option.key}`);
      });
      for (const line of w.recap) checkText(line, `${id} recap`);
    }
  });
});

describe('walkthroughs: visuals are well formed', () => {
  it('only uses visual types the renderer understands', () => {
    const supported = new Set(['stack', 'table', 'gauge']);
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        if (!step.visual) return;
        assert(supported.has(step.visual.type), `${id} step ${i + 1}: unknown visual "${step.visual.type}"`);
      });
    }
  });

  it('gives stack visuals positive segments', () => {
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        if (!step.visual || step.visual.type !== 'stack') return;
        assert(step.visual.segments.length >= 2, `${id} step ${i + 1}: a stack needs segments to compare`);
        for (const seg of step.visual.segments) {
          assert(seg.value > 0, `${id} step ${i + 1}: segment "${seg.label}" has no size`);
          assert(seg.label, `${id} step ${i + 1}: unlabelled segment`);
        }
      });
    }
  });

  it('keeps table rows the same width as their headers', () => {
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        if (!step.visual || step.visual.type !== 'table') return;
        const width = step.visual.headers.length;
        step.visual.rows.forEach((row, r) => {
          equal(row.length, width, `${id} step ${i + 1} row ${r + 1}: wrong number of cells`);
        });
      });
    }
  });

  it('keeps gauge values inside 0..1', () => {
    for (const [id, w] of entries) {
      w.steps.forEach((step, i) => {
        if (!step.visual || step.visual.type !== 'gauge') return;
        for (const key of ['need', 'have']) {
          const v = step.visual[key];
          assert(v > 0 && v <= 1, `${id} step ${i + 1}: ${key} should be a fraction, got ${v}`);
        }
      });
    }
  });
});

/**
 * The lessons quote a lot of specific numbers. If the engine and the teaching
 * material ever disagree, the material is what a student believes — so these
 * check the taught figures against the same functions the app computes with.
 */
describe('walkthroughs: the numbers taught match the engine', () => {
  it('teaches pot odds figures that the odds library agrees with', () => {
    // "There is 100 in the pot, they bet 50" -> 150 in the middle, call 50.
    equal(Math.round(requiredEquity(50, 150) * 100), 25, 'half pot should be 25%');
    // Pot-sized: 80 in the pot, they bet 80 -> 160 in the middle, call 80.
    equal(Math.round(requiredEquity(80, 160) * 100), 33, 'pot-sized should be 33%');
    // The step-4 check: 60 in the pot, they bet 20 -> 80 in the middle, call 20.
    equal(Math.round(requiredEquity(20, 80) * 100), 20, 'quarter-ish bet should be 20%');
    // The step-6 check: 90 in the pot, they bet 90.
    equal(Math.round(requiredEquity(90, 180) * 100), 33, 'gutshot spot should demand 33%');
  });

  it('teaches the pot-odds table correctly', () => {
    const pot = 100;
    const expected = { 0.25: 17, 0.5: 25, 0.75: 30, 1: 33, 2: 40 };
    for (const [fraction, taught] of Object.entries(expected)) {
      const bet = pot * Number(fraction);
      const actual = Math.round(requiredEquity(bet, pot + bet) * 100);
      equal(actual, taught, `a ${fraction}x pot bet should require ${taught}%`);
    }
  });

  it('teaches that the pot-odds table is NOT proportional, correctly', () => {
    // The lesson warns against halving a row to guess the row below it, and
    // states a 50% ceiling. Both claims are asserted here.
    const P = 100;
    const need = (B) => requiredEquity(B, P + B);

    // The intuitive-but-wrong answer, and the real one.
    close(need(50), 0.25, 0.001, 'half pot needs 25%');
    assert(Math.abs(need(25) - 0.125) > 0.03,
      'a quarter pot is NOT half of the half-pot figure — that is the trap the lesson warns about');
    close(need(25), 1 / 6, 0.002, 'a quarter pot needs 16.7%, taught as 17%');

    // The closed form the lesson gives: B / (P + 2B).
    for (const B of [25, 50, 75, 100, 200, 1000]) {
      close(need(B), B / (P + 2 * B), 1e-9, `B/(P+2B) should match requiredEquity at B=${B}`);
    }

    // The stated ceiling: approaches 50% from below, never reaches it.
    assert(need(1000) < 0.5, 'even a huge overbet stays under 50%');
    equal(Math.round(need(1000) * 100), 48, 'a 1000 overbet into 100 asks for 48%, as the lesson says');
    assert(need(1e9) < 0.5 && need(1e9) > 0.499, 'the limit is 50%, approached but not reached');
  });

  it('teaches MDF figures that match the formula', () => {
    const pot = 100;
    const expected = { 0.25: 80, 0.5: 67, 0.75: 57, 1: 50, 2: 33 };
    for (const [fraction, taught] of Object.entries(expected)) {
      const actual = Math.round(minimumDefenceFrequency(pot * Number(fraction), pot) * 100);
      equal(actual, taught, `MDF against a ${fraction}x pot bet should be ${taught}%`);
    }
  });

  it('teaches bluff break-even figures that match the formula', () => {
    const pot = 100;
    equal(Math.round(breakEvenBluffFrequency(50, pot) * 100), 33, 'half-pot bluff needs 33%');
    equal(Math.round(breakEvenBluffFrequency(100, pot) * 100), 50, 'pot-sized bluff needs 50%');
    equal(Math.round(breakEvenBluffFrequency(200, pot) * 100), 67, 'double-pot bluff needs 67%');
  });

  it('teaches outs equities that match the exact maths', () => {
    equal(Math.round(exactOutsEquity(9, 'flop') * 100), 35, 'flush draw on the flop is ~35%, shortcut says 36%');
    equal(Math.round(exactOutsEquity(8, 'flop') * 100), 31, 'open-ended on the flop is 31.5%, shortcut says 32%');
    equal(Math.round(exactOutsEquity(9, 'turn') * 100), 20, 'flush draw on the turn is ~20%, shortcut says 18%');
    equal(Math.round(exactOutsEquity(15, 'flop') * 100), 54, 'the 15-out monster is 54%, shortcut says 60%');
  });

  it('teaches a correct account of WHY the rule of 4 drifts', () => {
    // The lesson claims: naive addition overshoots by the double-counted
    // overlap, and rounding 2.1% down to 2% roughly cancels it at 9 outs but
    // not at 15. Every one of those numbers is asserted here, because an
    // explanation that sounds right and is wrong is worse than none.
    const perCard = (unseen) => 1 / unseen;
    const naive = (outs) => outs * (perCard(47) + perCard(46));
    const overlap = (outs) => (outs / 47) * ((outs - 1) / 46);

    close(naive(9), 0.387, 0.002, 'nine outs, added honestly, is 38.7%');
    close(overlap(9), 0.033, 0.002, 'the nine-out overlap is about 3%');
    close(naive(9) - overlap(9), exactOutsEquity(9, 'flop'), 0.006,
      'naive minus overlap should land on the true figure');

    close(overlap(15), 0.097, 0.003, 'the fifteen-out overlap is nearly 10%');
    close(naive(15) - overlap(15), exactOutsEquity(15, 'flop'), 0.008,
      'the same accounting holds at fifteen outs');

    // And the claim that the shortcut is close at 9 outs but not at 15.
    assert(Math.abs(0.36 - exactOutsEquity(9, 'flop')) < 0.015, 'x4 is close at nine outs');
    assert(Math.abs(0.60 - exactOutsEquity(15, 'flop')) > 0.04, 'x4 is visibly high at fifteen outs');
  });

  it('teaches the SPR example correctly', () => {
    equal(spr(120, 40), 3, 'effective stack 120 into a pot of 40 is an SPR of 3');
  });
});
