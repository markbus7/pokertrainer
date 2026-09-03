/**
 * The Lab: solve spots at a table instead of picking from a list.
 *
 * Three things here are deliberate, and all three make the session feel
 * harder than a multiple-choice quiz — which is the point. Difficulty that
 * comes from having to retrieve, rather than from confusing presentation, is
 * what makes learning stick:
 *
 *  - You produce the answer. Typing "25" is recall; picking 25 from four
 *    options is recognition, and recognition fades much faster.
 *  - The sizing drill runs the calculation backwards, so you cannot pass by
 *    having memorised a table of five numbers.
 *  - You say how sure you are before seeing the result, which turns a vague
 *    feeling of knowing into something measurable.
 */

import { el, mount, richText, toast, fmt } from './dom.js';
import { cardRow } from './cardView.js';
import { potShareVisual, renderGauge } from './visuals.js';
import { generateSession } from '../trainers/lab.js';
import { CONFIDENCE, review, recordConfidence } from '../state/spacing.js';
import { handFromLabSpot, keepHand } from '../state/handHistory.js';

const SESSION_LENGTH = 9;

export function renderLab(ctx) {
  const { profile, rng, go } = ctx;
  const spots = generateSession(rng, SESSION_LENGTH);
  const state = { index: 0, value: null, result: null, correct: 0, answered: 0, saved: null };

  const header = el('div.panel');
  const body = el('div.panel');
  const footer = el('div.row');
  const root = el('div.screen', header, body, footer);

  const spot = () => spots[state.index];

  function submit(given, confidence) {
    if (state.result) return;
    const result = spot().solve(given);
    state.value = given;
    state.result = result;
    state.answered++;
    if (result.correct) {
      state.correct++;
      profile.addXp(14);
    }
    review(profile, spot().concept, result.correct);
    if (confidence) recordConfidence(profile, confidence, result.correct);
    // A "make the call" spot is a real decision at a table, so a wrong one is
    // kept and replayed exactly like a hand you misplayed in the game.
    state.saved = spot().type === 'decide'
      ? keepHand(handFromLabSpot(spot(), given))
      : null;
    draw();
  }

  function next() {
    if (state.index >= spots.length - 1) return finish();
    state.index++;
    state.value = null;
    state.result = null;
    state.saved = null;
    draw();
    window.scrollTo({ top: 0 });
    return null;
  }

  function finish() {
    const pct = state.answered ? state.correct / state.answered : 0;
    mount(header,
      el('h1', 'Session complete'),
      el('div.muted', `${state.correct} of ${state.answered} solved — ${fmt.pct(pct)}`),
    );
    mount(body,
      el('div.grid.cols-3',
        el('div.stat', el('div.label', 'Solved'), el('div.value', `${state.correct}/${state.answered}`)),
        el('div.stat', el('div.label', 'Accuracy'), el(`div.value.${pct >= 0.8 ? 'good' : pct < 0.5 ? 'bad' : ''}`, fmt.pct(pct))),
        el('div.stat', el('div.label', 'XP'), el('div.value', `+${state.correct * 14}`)),
      ),
      el('div.notice', { style: { marginTop: '16px' } },
        'These spots are scheduled to come back. You will see this concept again in a few days — just as it starts to fade, '
        + 'which is when practising it does the most good. Check the Progress page for what is due.'),
    );
    mount(footer,
      el('button.btn.primary', { onclick: () => go('lab') }, 'Another session'),
      el('button.btn.ghost', { onclick: () => go('home') }, 'Back to dashboard'),
    );
    return null;
  }

  /* ---------------- rendering ---------------- */

  function felt(s) {
    const t = s.table;
    return el('div.lab-felt',
      el('div.lab-pot',
        el('span.label', 'pot'),
        fmt.chips(t.potNow ?? t.pot),
        t.bet ? el('span.lab-bet', `they bet ${fmt.chips(t.bet)}`) : null,
      ),
      el('div.lab-board', cardRow(t.board, { size: 'lg', fourColour: profile.settings.fourColour })),
      el('div.lab-hands',
        el('div.lab-hand',
          el('div.faint', 'You'),
          cardRow(t.hole, { size: 'lg', fourColour: profile.settings.fourColour }),
        ),
        t.revealVillain && t.villain
          ? el('div.lab-hand',
              el('div.faint', 'Them'),
              cardRow(t.villain, { size: 'lg', fourColour: profile.settings.fourColour }),
            )
          : null,
      ),
    );
  }

  /** Confidence doubles as the submit button, so calibration costs no extra click. */
  function confidenceRow(getValue, validate) {
    const error = el('div.faint', { style: { minHeight: '18px', color: 'var(--red)' } });
    const row = el('div.confidence',
      el('span.faint', 'How sure are you?'),
      CONFIDENCE.map((c) => el('button.btn.sm.confidence-btn', {
        title: c.hint,
        onclick: () => {
          const v = getValue();
          const problem = validate(v);
          if (problem) { error.textContent = problem; return; }
          submit(v, c.key);
        },
      }, c.label)),
    );
    return el('div', row, error);
  }

  function inputFor(s) {
    if (s.inputKind === 'action') {
      return el('div.action-buttons',
        s.actions.map((a) => el(`button.btn.lg.${a.key === 'fold' ? 'danger' : 'success'}`, {
          onclick: () => submit(a.key, null),
        }, a.label)),
      );
    }

    if (s.inputKind === 'percent') {
      const input = el('input.lab-input', {
        type: 'number', min: '0', max: '100', step: '0.5', placeholder: '—',
        onkeydown: (e) => { if (e.key === 'Enter') e.preventDefault(); },
      });
      setTimeout(() => input.focus(), 30);
      return el('div',
        el('div.lab-entry', input, el('span.lab-unit', '%')),
        confidenceRow(
          () => Number(input.value),
          (v) => (input.value === '' || Number.isNaN(v) ? 'Type a percentage first.' : null),
        ),
      );
    }

    // chips: a slider, because sizing a bet is a physical act at a table
    const { min, max, step, start } = s.slider;
    const readout = el('span.lab-amount', fmt.chips(start));
    const slider = el('input.lab-slider', {
      type: 'range', min: String(min), max: String(max), step: String(step), value: String(start),
      oninput: (e) => { readout.textContent = fmt.chips(Number(e.target.value)); },
    });
    const quick = (label, amount) => el('button.btn.sm.ghost', {
      onclick: () => { slider.value = String(Math.round(amount)); readout.textContent = fmt.chips(Math.round(amount)); },
    }, label);

    return el('div',
      el('div.lab-entry',
        el('span.faint', 'You bet'), readout, el('span.faint', 'chips'),
      ),
      slider,
      el('div.row', { style: { marginTop: '8px' } },
        quick('⅓ pot', s.table.pot / 3),
        quick('½ pot', s.table.pot / 2),
        quick('¾ pot', s.table.pot * 0.75),
        quick('Pot', s.table.pot),
        quick('2× pot', s.table.pot * 2),
      ),
      confidenceRow(() => Number(slider.value), (v) => (v <= 0 ? 'Move the slider to choose a bet.' : null)),
    );
  }

  function feedback(s) {
    const r = state.result;
    const shown = s.inputKind === 'percent' ? `${state.value}%`
      : s.inputKind === 'chips' ? `${fmt.chips(state.value)} chips`
        : String(state.value);

    return el(`div.feedback.${r.correct ? 'correct' : 'wrong'}`,
      el('div.verdict', r.correct ? `✓ Correct — ${shown}` : `✗ Not quite — you said ${shown}`),
      el('div.stack-sm', r.lines.map((line) => el('div', richText(line)))),
      r.visual && r.visual.have !== undefined
        ? renderGauge({ need: r.visual.need, have: r.visual.have, needLabel: 'Price demands', haveLabel: 'Your hand has' })
        : r.visual
          ? potShareVisual(r.visual.pot, r.visual.call)
          : null,
    );
  }

  function draw() {
    const s = spot();
    mount(header,
      el('div.spread',
        el('div.row',
          el('span', { style: { fontSize: '1.6rem' } }, '🎛️'),
          el('div',
            el('div', { style: { fontWeight: '650' } }, 'The Lab'),
            el('div.faint', `Spot ${state.index + 1} of ${spots.length} · ${labelFor(s.type)}`),
          ),
        ),
        el('div.row',
          el('span.badge', `${state.correct}/${state.answered}`),
          el('button.btn.sm.ghost', { onclick: () => go('home') }, 'Leave'),
        ),
      ),
      el('div.bar', { style: { marginTop: '12px' } },
        el('span', { style: { width: `${((state.index + (state.result ? 1 : 0)) / spots.length) * 100}%` } })),
    );

    mount(body,
      felt(s),
      el('div.muted', { style: { marginTop: '14px' } }, s.prompt),
      el('div.question', { style: { marginTop: '6px' } }, richText(s.question)),
      state.result ? feedback(s) : inputFor(s),
    );

    mount(footer,
      state.saved
        ? el('button.btn.ghost', { onclick: () => go('review', { hand: state.saved.id }) }, 'Replay this spot')
        : null,
      state.result
        ? el('button.btn.primary', { onclick: next },
            state.index >= spots.length - 1 ? 'See results →' : 'Next spot →')
        : el('span.faint', s.inputKind === 'action'
          ? 'Choose an action.'
          : 'Work it out, then say how sure you are — that is the answer submitted.'),
    );
  }

  ctx.onKey = (e) => {
    if (state.result && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
  };

  draw();
  return root;
}

function labelFor(type) {
  return { price: 'name the price', size: 'size the bet', decide: 'make the call' }[type] || type;
}

/** Entry screen: says what the Lab is for before dropping you into it. */
export function renderLabIntro(ctx) {
  const { go } = ctx;
  return el('div.screen',
    el('div.panel',
      el('h1', '🎛️ The Lab'),
      el('p.muted', 'Spots at a table, solved rather than chosen from a list. There are no options to pick between — you work the number out and enter it.'),
      el('ul.lesson-points',
        el('li', el('span', richText('**Name the price** — face a bet and type the equity you need. Producing the number is what makes it stick; recognising it from a list does not.'))),
        el('li', el('span', richText('**Size the bet** — you are given a price and must find the bet that offers it. This is the calculation run backwards, so a memorised table will not save you.'))),
        el('li', el('span', richText('**Make the call** — real cards, real equity, and the actual Fold and Call buttons.'))),
      ),
      el('p.muted', 'The three kinds are shuffled together on purpose. Having to work out which calculation applies is most of the skill at a real table, and practising them in separate blocks quietly removes that part.'),
      el('button.btn.primary.lg', { onclick: () => go('lab-run') }, 'Start a session'),
    ),
  );
}
