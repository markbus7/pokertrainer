/**
 * The range trainer.
 *
 * Two screens: the ladder, and a run. The ladder is the honest answer to "not
 * endless, with checkpoints" — eight of them, each walked three times with a
 * little less help, and a visible end.
 *
 * The grid is the teaching. After every answer it comes up with the hand lit
 * and the range shaded, because a range is a shape before it is a list, and
 * the shape is what survives into a session. Reading "K9s+" off a line of
 * notation teaches nobody anything.
 */

import { el, mount, fmt, toast } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { handGrid } from '../core/cards.js';
import { CHARTS, POSITION_INFO } from '../data/ranges.js';
import {
  CHECKPOINTS, STAGES, ASKED, PASS, checkpointFor, stageAt, seatName,
} from '../data/rangeLadder.js';
import { rangeQuestion } from '../trainers/rangeTrainer.js';
import { makeRng } from '../core/rng.js';

/* ------------------------------------------------------------------ *
 * The grid
 * ------------------------------------------------------------------ */

/**
 * The chart the current question is testing, shaded, with your hand ringed.
 * One component for the on-screen chart and for the after-the-answer reveal,
 * so what you study and what you are marked against cannot drift apart.
 */
function chartGrid(question, { highlight = true } = {}) {
  const { seat, raiser } = question;
  let member = () => '';
  let caption = '';

  if (!raiser) {
    const range = CHARTS.rfi[seat];
    member = (key) => (range.has(key) ? 'in' : '');
    caption = t('Opening range — {seat}', { seat: t(seatName(seat)) });
  } else if (seat === 'BB') {
    const defend = CHARTS.bbDefend[raiser];
    const three = CHARTS.threeBet.BB;
    member = (key) => (three.all.has(key) ? 'value' : defend.has(key) ? 'in' : '');
    caption = t('Big blind against a {seat} open', { seat: t(seatName(raiser)) });
  } else {
    const three = CHARTS.threeBet[seat];
    member = (key) => (three.value.has(key) ? 'value' : three.bluff.has(key) ? 'bluff' : '');
    caption = t('Three-betting range — {seat}', { seat: t(seatName(seat)) });
  }

  return el('div.chart-panel',
    el('div.chart-caption', caption),
    el('div.range-grid-scroll', el('div.range-grid',
      handGrid().flat().map((key) => {
        const classes = [member(key)];
        if (key.length === 2) classes.push('pair');
        if (highlight && key === question.hand) classes.push('you');
        return el(`div.range-cell${classes.filter(Boolean).map((c) => `.${c}`).join('')}`, key);
      }),
    )),
  );
}

/* ------------------------------------------------------------------ *
 * The ladder
 * ------------------------------------------------------------------ */

export function renderRangeLadder(ctx) {
  const { profile, go } = ctx;
  const cleared = profile.rangesCleared(CHECKPOINTS.map((c) => c.key));

  const rung = (checkpoint) => {
    const p = profile.rangeProgress(checkpoint.key);
    const total = checkpoint.only === 'blind' ? 1 : STAGES.length;
    const done = checkpoint.only === 'blind' ? (p.cleared ? 1 : 0) : Math.min(p.stage, total);
    const locked = checkpoint.kind === 'exam' && cleared < CHECKPOINTS.length - 1;
    return el(`button.rung-row${p.cleared ? '.done' : ''}${locked ? '.shut' : ''}`, {
      disabled: locked,
      onclick: () => go('ranges-run', { spot: checkpoint.key }),
    },
      el('span.rung-mark', p.cleared ? icon('check', { size: 16 }) : locked ? icon('lock', { size: 15 }) : String(done)),
      el('span.rung-body',
        el('span.rung-name', t(checkpoint.name)),
        el('span.rung-note', p.cleared
          ? t('In your head.')
          : locked
            ? t('Opens once the rest are in your head.')
            : t(stageAt(p.stage).name)),
      ),
      el('span.rung-pips', Array.from({ length: total }, (_, i) =>
        el(`span.pip-dot${i < done ? '.lit' : ''}`))),
    );
  };

  return el('div.screen',
    el('div.panel',
      el('div.panel-title', el('h3', icon('charts', { size: 18 }), t('Range trainer'))),
      el('p.muted', t('One question, over and over: what does the chart say to do with this hand, here. '
        + 'Each checkpoint is walked three times — with the chart open, with it behind a button, and '
        + 'then from memory on a clock. The last one is the only one that counts, because it is the '
        + 'one the table asks for.')),
      el('div.ladder-head',
        el('span.badge.gold', t('{done} of {total} in your head', { done: cleared, total: CHECKPOINTS.length })),
      ),
      el('div.rungs', CHECKPOINTS.map(rung)),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * A run
 * ------------------------------------------------------------------ */

export function renderRangeRun(ctx) {
  const { profile, go, params } = ctx;
  const checkpoint = checkpointFor(params.spot);
  const progress = profile.rangeProgress(checkpoint.key);
  const stageIndex = checkpoint.only === 'blind' ? 2 : Math.min(progress.stage, STAGES.length - 1);
  const stage = stageAt(stageIndex);
  const rng = makeRng();

  const state = {
    index: 0, right: 0, peeks: 0, asked: new Set(),
    question: null, answered: null, peeked: false, showChart: false,
    deadline: 0, timer: null, done: false,
  };

  const root = el('div.screen');

  function nextQuestion() {
    state.question = rangeQuestion(checkpoint, rng, state.asked);
    state.asked.add(state.question.hand);
    state.answered = null;
    state.peeked = false;
    state.showChart = false;
    clearTimeout(state.timer);
    if (stage.seconds) {
      state.deadline = Date.now() + stage.seconds * 1000;
      state.timer = setTimeout(() => { if (!state.answered) answer(null); }, stage.seconds * 1000);
    }
    draw();
  }

  function answer(choice) {
    if (state.answered) return;
    clearTimeout(state.timer);
    const correct = choice === state.question.answer;
    // A peeked answer is not credited. Neither is one the clock took.
    state.answered = { choice, correct, credited: correct && !state.peeked };
    if (state.answered.credited) state.right++;
    if (state.peeked) state.peeks++;
    // The chart comes up either way — right answers need the shape too.
    state.showChart = true;
    draw();
  }

  function advance() {
    state.index++;
    if (state.index >= ASKED) return finish();
    return nextQuestion();
  }

  function finish() {
    state.done = true;
    clearTimeout(state.timer);
    const result = profile.noteRangeRun(checkpoint.key, {
      right: state.right, asked: ASKED, peeks: state.peeks, stage: stageIndex, pass: PASS,
    });
    if (result.cleared) {
      toast({ icon: 'check', title: t('{name} is in your head', { name: t(checkpoint.name) }),
        desc: t('No chart, on the clock, and you still knew it.'), duration: 7000 });
    }
    draw(result);
  }

  function draw(result = null) {
    if (state.done) return mount(root, summary(result));
    mount(root, running());
  }

  function summary(result) {
    const passed = state.right >= PASS;
    return el('div.panel',
      el('div.panel-title', el('h3', t(checkpoint.name))),
      el('div.run-score', `${state.right} / ${ASKED}`),
      el('p', passed
        ? result && result.cleared
          ? t('Cleared, with no chart and a clock running. That is the one that matters.')
          : t('Passed. The next run takes some of the help away.')
        : t('{pass} of {asked} passes this rung. Run it again — the hands you missed come back.',
          { pass: PASS, asked: ASKED })),
      state.peeks
        ? el('p.faint', t('You looked at the chart {n} times. Those answers were not counted, which is '
          + 'what the number is for — it says how much is still on the wall rather than in your head.',
        { n: state.peeks }))
        : null,
      el('div.row',
        el('button.btn.primary', { onclick: () => go('ranges-run', { spot: checkpoint.key }) }, t('Run it again')),
        el('button.btn.ghost', { onclick: () => go('ranges') }, t('Back to the ladder')),
      ),
    );
  }

  function running() {
    const q = state.question;
    const a = state.answered;
    return el('div.panel',
      el('div.run-head',
        el('div',
          el('div.run-where', t(checkpoint.name)),
          el('div.faint', t(stage.name)),
        ),
        el('div.run-count', `${state.index + 1} / ${ASKED}`),
      ),
      stage.seconds && !a ? el('div.clock-bar', el('span', {
        style: { animationDuration: `${stage.seconds}s` },
      })) : null,

      el('div.range-ask', q.prompt),
      el('div.hand-big', q.hand),

      el('div.ask-options', q.options.map((option) => {
        const mark = a && (option === q.answer ? '.correct' : option === a.choice ? '.wrong' : '');
        return el(`button.btn.lg.ask-option${mark || ''}`, {
          disabled: !!a,
          onclick: () => answer(option),
        }, t(option));
      })),

      a
        ? el('div',
          el('div.verdict-box' + (a.correct ? '.good' : '.bad'),
            el('strong', a.correct ? (a.credited ? t('Right') : t('Right — but you looked')) : t('Not that one')),
            el('div', q.why),
            a.choice === null ? el('div.faint', t('The clock ran out. At the table it does too.')) : null),
          state.showChart ? chartGrid(q) : null,
          el('button.btn.primary.lg.block', { onclick: advance },
            state.index + 1 >= ASKED ? t('See how it went') : t('Next hand')),
        )
        : stage.showsChart
          ? chartGrid(q, { highlight: false })
          : stage.canPeek
            ? el('div',
              state.showChart
                ? chartGrid(q, { highlight: false })
                : el('button.btn.ghost', {
                  onclick: () => { state.peeked = true; state.showChart = true; draw(); },
                }, icon('charts', { size: 15 }), t('Show me the chart')),
              state.peeked ? el('div.faint', t('This one will not be counted.')) : null)
            : null,
    );
  }

  nextQuestion();
  return root;
}
