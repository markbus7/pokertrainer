import { describe, it, assert, equal, close } from './harness.js';
import { WALKTHROUGHS } from '../src/js/data/walkthroughs.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { requiredEquity, minimumDefenceFrequency, breakEvenBluffFrequency, spr } from '../src/js/core/odds.js';
import { exactOutsEquity } from '../src/js/core/equity.js';
import { CHARTS, rangePercent, rangeCombos, parseRange } from '../src/js/data/ranges.js';
import { comboCount, ALL_HAND_KEYS, makeDeck } from '../src/js/core/cards.js';
import { evaluate } from '../src/js/core/evaluator.js';
import { icmEquity } from '../src/js/core/odds.js';
import { lookupTerm } from '../src/js/data/glossary.js';

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

  it('does not describe the pot as being "in the middle"', () => {
    // A reader took "150 is in the middle" to mean the middle of the number.
    // It is real poker jargon, so the lessons introduce it once and then say
    // "the pot" everywhere else. Other senses of the word are fine and stay:
    // "middle pair", "the awkward middle", and a card in the middle of a
    // straight are not the table's centre, so the test distinguishes them
    // rather than banning the word outright.
    const ALLOWED = [
      /players often say|meaning simply that they are in the pot/i,  // the definition itself
      /card in the middle|middle of (a |the )?(straight|run)/i,       // a gap in a straight
    ];
    let explanatory = 0;
    for (const [id, w] of entries) {
      const text = JSON.stringify(w);
      for (const match of text.match(/[^"]{0,120}in the middle[^"]{0,60}/gi) || []) {
        if (ALLOWED[0].test(match)) { explanatory++; continue; }
        if (ALLOWED[1].test(match)) continue;
        assert(false, `${id}: pot described as "in the middle" — …${match.trim().slice(-100)}`);
      }
    }
    equal(explanatory, 1, 'the jargon should be defined exactly once');
  });

  it('never leaves a broken placeholder in the prose', () => {
    for (const [id, w] of entries) {
      const text = JSON.stringify(w);
      for (const bad of ['undefined', 'NaN', '[object Object]', 'TODO', 'XXX']) {
        assert(!text.includes(bad), `${id}: contains "${bad}"`);
      }
    }
  });

  it('nests glossary terms inside emphasis without breaking either', () => {
    // **[[term]]** used to render as literal brackets, because the bold
    // pattern matched first and swallowed the term marker whole.
    for (const [id, w] of entries) {
      for (const match of JSON.stringify(w).match(/\*\*\[\[[^\]]+\]\]\*\*/g) || []) {
        const inner = match.slice(4, -4).split('|')[0];
        assert(lookupTerm(inner), `${id}: nested term [[${inner}]] must resolve`);
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

  it('teaches the count-in-calls shortcut correctly', () => {
    // The step claims 1 / (pot-in-calls + 2) is not an approximation but the
    // same fraction with the chips divided out. Assert that across a wide
    // sweep, because a shortcut that is merely close would be worse than none.
    let worst = 0;
    for (let pot = 5; pot <= 400; pot += 5) {
      for (let bet = 1; bet <= pot * 3; bet++) {
        worst = Math.max(worst, Math.abs(requiredEquity(bet, pot + bet) - 1 / (pot / bet + 2)));
      }
    }
    assert(worst < 1e-12, `the shortcut drifts from the real figure by ${worst}`);
  });

  it('gets every worked example in the count-in-calls step right', () => {
    // Each example is stated as "N fits, plus 2, so you need 1 in N+2".
    const examples = [
      { pot: 100, bet: 50, fits: 2, need: 25 },
      { pot: 55, bet: 55, fits: 1, need: 33 },
      { pot: 120, bet: 40, fits: 3, need: 20 },
    ];
    for (const { pot, bet, fits, need } of examples) {
      equal(pot / bet, fits, `${bet} should fit into ${pot} ${fits} times`);
      equal(Math.round(requiredEquity(bet, pot + bet) * 100), need,
        `pot ${pot}, bet ${bet} should need ${need}%`);
      close(1 / (fits + 2), requiredEquity(bet, pot + bet), 1e-12, 'the shortcut agrees');
    }
  });

  it('gets the count-in-calls table right, including the overbet row', () => {
    // Reads the figures the lesson actually prints rather than a copy of them:
    // a test that restates the intended numbers cannot catch a typo in the
    // step itself, which is the only place a reader ever looks.
    const step = WALKTHROUGHS['pot-odds'].steps
      .find((s) => /count in calls/i.test(s.title));
    assert(step && step.visual && step.visual.rows, 'the count-in-calls step has a table');

    const FRACTIONS = {
      'a quarter of it': 0.25,
      'a third of it': 1 / 3,
      'half of it': 0.5,
      'all of it': 1,
      'twice the pot': 2,
    };
    const pot = 120;   // divides cleanly by every fraction above

    for (const [size, fitsText, plusTwo, needText] of step.visual.rows) {
      const fraction = FRACTIONS[size];
      assert(fraction !== undefined, `unrecognised row label "${size}"`);
      const bet = pot * fraction;

      // "1 in 6 — 17%" must agree with the engine on both halves.
      const m = needText.match(/1 in ([\d.]+)\s*—\s*(\d+)%/);
      assert(m, `could not read the taught figure from "${needText}"`);
      const denominator = Number(m[1]);
      const taught = Number(m[2]);

      // "once" and "half a time" carry no digits, so read them by name.
      const WORDS = { once: 1, 'half a time': 0.5 };
      const fits = WORDS[fitsText] ?? Number((fitsText.match(/[\d.]+/) || [])[0]);
      assert(Number.isFinite(fits), `could not read the fits column "${fitsText}"`);
      close(fits, pot / bet, 1e-9, `"${size}": the Fits column`);
      close(denominator, pot / bet + 2, 1e-9, `"${size}": plus-2 denominator`);
      close(Number(plusTwo), pot / bet + 2, 1e-9, `"${size}": the Plus 2 column`);
      equal(Math.round(requiredEquity(bet, pot + bet) * 100), taught,
        `"${size}" is taught as ${taught}% but the engine disagrees`);
      close(1 / denominator, requiredEquity(bet, pot + bet), 0.005,
        `"${size}": 1 in ${denominator} must be the real price`);
    }

    // The caption's claim: a bigger bet fits FEWER times and prices you worse.
    const need = (f) => requiredEquity(pot * f, pot + pot * f);
    assert(need(2) > need(1) && need(1) > need(0.5) && need(0.5) > need(0.25),
      'bigger bets must demand more equity, as the caption says');
  });

  it("makes every wrong answer in the count-in-calls check numerically true", () => {
    // Each distractor names the bet size it would be correct for. If that
    // claim is wrong the explanation teaches a falsehood, which is worse than
    // saying nothing.
    equal(Math.round(requiredEquity(30, 120) * 100), 20, 'the check spot: pot 90, bet 30');
    equal(Math.round(requiredEquity(50, 150) * 100), 25, '25% is indeed the half-pot answer');
    equal(Math.round(requiredEquity(90, 180) * 100), 33, '33% is indeed the pot-sized answer');
    equal(Math.round(requiredEquity(25, 125) * 100), 17, '17% is indeed the quarter-pot answer');
    // And the arithmetic the correct option quotes.
    equal(90 / 30, 3, 'thirty goes into ninety three times');
    close(1 / (3 + 2), 0.2, 1e-12, 'three plus two is five, and one in five is 20%');
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

  it('teaches hand frequencies that match an exhaustive count', () => {
    // The hand-rankings lesson prints these as the reason the ranking order
    // is what it is. Counted here rather than trusted.
    const deck = makeDeck();
    const counts = new Array(9).fill(0);
    const hand = new Array(5);
    for (let a = 0; a < 48; a++) {
      hand[0] = deck[a];
      for (let b = a + 1; b < 49; b++) {
        hand[1] = deck[b];
        for (let c = b + 1; c < 50; c++) {
          hand[2] = deck[c];
          for (let d = c + 1; d < 51; d++) {
            hand[3] = deck[d];
            for (let e = d + 1; e < 52; e++) {
              hand[4] = deck[e];
              counts[evaluate(hand) >> 20]++;
            }
          }
        }
      }
    }

    const table = WALKTHROUGHS['hand-rankings'].steps[0].visual.rows;
    const byName = Object.fromEntries(table.map((r) => [r[0], Number(r[1].replace(/,/g, ''))]));
    const expected = {
      'Straight flush': counts[8],
      'Four of a kind': counts[7],
      'Full house': counts[6],
      Flush: counts[5],
      Straight: counts[4],
      'Three of a kind': counts[3],
      'Two pair': counts[2],
      'One pair': counts[1],
      'High card': counts[0],
    };
    for (const [name, actual] of Object.entries(expected)) {
      equal(byName[name], actual, `the lesson's count for ${name} must match the evaluator`);
    }

    // And the claim the whole step rests on: flushes really are rarer.
    assert(counts[5] < counts[4], 'a flush must be rarer than a straight for the lesson to hold');
    assert(counts[6] < counts[5], 'and a full house rarer than a flush');
  });

  it('teaches the ICM equal-stacks figure correctly', () => {
    // "Three players, equal stacks, prizes 500/300/200 -> each worth 333."
    const eq = icmEquity([1000, 1000, 1000], [500, 300, 200]);
    close(eq[0], 333.3, 0.5, 'equal stacks should split the prize pool evenly');
    const text = JSON.stringify(WALKTHROUGHS.icm);
    assert(/333/.test(text), 'the lesson should quote that figure');
  });

  it('teaches opening percentages that match the actual charts', () => {
    // The lesson prints a table of opening ranges. If the charts are ever
    // retuned, the lesson must not keep quoting the old numbers.
    const taught = { UTG: 18, HJ: 23, CO: 30, BTN: 47, SB: 40 };
    for (const [pos, pct] of Object.entries(taught)) {
      const actual = rangePercent(CHARTS.rfi[pos]) * 100;
      close(actual, pct, 1.2, `${pos} is taught as ~${pct}% but the chart is ${actual.toFixed(1)}%`);
    }
  });

  it('teaches the combo counts the card model actually produces', () => {
    // The shorthand table claims specific combination counts; these are the
    // numbers the engine derives, so the two cannot drift apart.
    equal(comboCount('AA'), 6, 'a pair is 6 combos');
    equal(comboCount('AKs'), 4, 'suited is 4');
    equal(comboCount('AKo'), 12, 'offsuit is 12');
    equal(rangeCombos(parseRange('22+')), 78, 'every pair is 78 combos');
    equal(rangeCombos(parseRange('A2s+')), 48, 'every suited ace is 48 combos');

    // And the total the lesson quotes as the denominator.
    const total = ALL_HAND_KEYS.reduce((sum, k) => sum + comboCount(k), 0);
    equal(total, 1326, 'there are 1,326 two-card hands');

    // "Opening 18% means about 238 of those" — check that arithmetic.
    equal(rangeCombos(CHARTS.rfi.UTG), 238, 'the UTG range really is 238 combos');
  });

  it('teaches the small-blind exception correctly, against the real charts', () => {
    // The lesson's whole second step rests on this being true.
    const btn = rangePercent(CHARTS.rfi.BTN);
    const sb = rangePercent(CHARTS.rfi.SB);
    assert(sb < btn,
      `the lesson explains why SB opens tighter than BTN, so it must: SB ${(sb * 100).toFixed(1)}% vs BTN ${(btn * 100).toFixed(1)}%`);
    assert(sb > rangePercent(CHARTS.rfi.CO),
      'and the lesson places SB between the cutoff and the button');
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
