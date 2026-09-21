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
import {
  CHECKPOINTS, STAGES, ASKED, PASS, checkpointFor, stageAt, seatName,
} from '../data/rangeLadder.js';
import { rangeQuestion, rangeQuestionForHand, edgePoolFor } from '../trainers/rangeTrainer.js';
import { makeRng, randInt } from '../core/rng.js';
import { rangeGridFor } from './reference.js';
import { seatFelt } from './spotFelt.js';
import { seatRing } from '../core/seatMap.js';
import { cardRow } from './cardView.js';
import { copyButton } from './copySpot.js';
import { IDK, dontKnowButton } from './dontKnow.js';

// The exam mixes all three question kinds under one checkpoint key, so a
// hand missed there has no single chart to practise it back against —
// excluded from weak-hand tracking and practice alike, everywhere both are
// used below.
const PRACTICABLE = CHECKPOINTS.filter((c) => c.kind !== 'exam');
const PRACTICABLE_KEYS = PRACTICABLE.map((c) => c.key);

/** Three-betting has no seat of its own; everything else can just show its seat. */
const shortLabel = (checkpoint) => (checkpoint.kind === 'threebet' ? t('3-bet') : checkpoint.seat);

/* ------------------------------------------------------------------ *
 * The ladder
 * ------------------------------------------------------------------ */

export function renderRangeLadder(ctx) {
  const { profile, go } = ctx;
  // "Cleared" started requiring the boundary actually seen, not just a good
  // fifteen-question sample of it. A badge earned before that bar existed
  // gets re-checked against it once; the call is cheap and a no-op after
  // the first time it runs.
  profile.migrateEdgeCoverage(Object.fromEntries(PRACTICABLE.map((c) => [c.key, edgePoolFor(c)])));
  const cleared = profile.rangesCleared(CHECKPOINTS.map((c) => c.key));
  const weakCount = profile.weakRangeHands(PRACTICABLE_KEYS, 999).length;

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
      // The reader's own report said it plainly: "DRILLED WITHOUT READING THE
      // LESSON: Preflop Ranges". The lesson exists and teaches exactly this —
      // step 4 reads the shorthand, step 7 is five numbers instead of a
      // hundred and sixty-nine — and nothing had ever pointed at it from the
      // place somebody sits down to learn ranges. Reading it is not required;
      // not knowing it is there is a different thing.
      profile.hasCompletedWalkthrough('preflop')
        ? null
        : el('div.notice', { style: { marginBottom: 'var(--s-3)' } },
          el('div', { style: { fontWeight: '600' } }, t('There is a lesson behind these charts')),
          el('div.faint', { style: { marginTop: '4px' } },
            t('Eight steps on why position decides how many hands you play, how to read the '
              + 'shorthand, and the five numbers that replace the grid. You can drill without it — '
              + 'but the boundary is much easier to remember once you know why it is there.')),
          el('button.btn.sm.ghost', {
            style: { marginTop: '8px' },
            onclick: () => go('walkthrough', { module: 'preflop' }),
          }, t('Read it first')),
        ),

      el('div.ladder-head',
        el('span.badge.gold', t('{done} of {total} in your head', { done: cleared, total: CHECKPOINTS.length })),
      ),
      el('div.rungs', CHECKPOINTS.map(rung)),
    ),

    // Only appears once there is something to show: a hand nobody has ever
    // missed unaided is not a weak spot, and a button that opens onto an
    // empty screen is worse than no button.
    weakCount
      ? el('div.panel',
        el('div.panel-title', el('h3', icon('charts', { size: 18 }), t('Your weak hands'))),
        el('p.muted', t('{n} hands you have missed outside an open chart, across every checkpoint. '
          + 'Run them again, mixed together or one seat at a time.', { n: weakCount })),
        el('button.btn.primary', { onclick: () => go('ranges-weak') }, t('Practise them')),
      )
      : null,
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
  // The boundary this checkpoint has to have been asked about, unaided,
  // before it can honestly call itself cleared.
  const pool = edgePoolFor(checkpoint);

  const state = {
    index: 0, right: 0, peeks: 0, asked: new Set(),
    question: null, answered: null, peeked: false, showChart: false,
    deadline: 0, timer: null, done: false,
  };

  const root = el('div.screen');

  function nextQuestion() {
    // Chart-open answers never get recorded, so biasing toward what is
    // "uncovered" would only be steering toward the edge again — which the
    // normal draw already does. On the rungs that actually count, spend the
    // question on a boundary hand that has never been asked before, until
    // there are none left; only then fall back to the ordinary edge-biased
    // draw, which can repeat hands that are already known.
    const seenHands = profile.rangeProgress(checkpoint.key).hands || {};
    const uncovered = !stage.showsChart
      ? pool.filter((h) => !(h in seenHands) && !state.asked.has(h))
      : [];
    const forcedHand = uncovered.length ? uncovered[randInt(rng, uncovered.length)] : null;
    state.question = forcedHand
      ? rangeQuestionForHand(checkpoint, forcedHand, rng)
      : rangeQuestion(checkpoint, rng, state.asked);
    // The seat picture is built once per question. Rebuilding it on every
    // redraw would move the button around while the reader is looking at it.
    state.ring = seatRing(rng, { heroPosition: state.question.seat });
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
    // Weak-hand memory only means something for an unaided attempt: reading
    // the chart off the screen, or peeking at it, proves nothing about
    // whether the hand is actually known. The exam mixes three different
    // kinds of question under one checkpoint key, so a hand recorded there
    // would come back as the wrong kind of question if ever re-asked — left
    // out on purpose rather than recorded wrong.
    if (!state.peeked && !stage.showsChart && checkpoint.kind !== 'exam') {
      profile.recordRangeHand(checkpoint.key, state.question.hand, correct);
    }
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
    const coverage = profile.rangeCoverage(checkpoint.key, pool);
    const result = profile.noteRangeRun(checkpoint.key, {
      right: state.right, asked: ASKED, peeks: state.peeks, stage: stageIndex, pass: PASS,
      covered: coverage.complete,
    });
    if (result.cleared) {
      toast({ icon: 'check', title: t('{name} is in your head', { name: t(checkpoint.name) }),
        desc: t('No chart, on the clock, and you still knew it.'), duration: 7000 });
    }
    draw(result, coverage);
  }

  function draw(result = null, coverage = null) {
    if (state.done) return mount(root, summary(result, coverage));
    mount(root, running());
  }

  function summary(result, coverage) {
    const passed = state.right >= PASS;
    return el('div.panel',
      el('div.panel-title', el('h3', t(checkpoint.name))),
      el('div.run-score', `${state.right} / ${ASKED}`),
      el('p', passed
        ? result && result.cleared
          ? t('Cleared, with no chart and a clock running. That is the one that matters.')
          : stageIndex < 2
            ? t('Passed. The next run takes some of the help away.')
            : t('Passed — but {seen} of {total} edge hands have not come up yet, so it is not in '
              + 'your head yet. Run it again; it steers toward what you have not seen.',
            { seen: coverage.seen, total: coverage.total })
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

      // Where you are sitting, drawn rather than named. "Under the gun" is a
      // phrase you have to have learned; a seat two to the left of the button
      // is something you can see. The reader asked for exactly this: "if I
      // forgot what location under the gun is, I keep seeing the table".
      state.ring
        ? el('div.ask-table', seatFelt(state.ring, {
          raiser: q.raiser,
          fourColour: !!profile.settings.fourColour,
          compact: true,
        }))
        : null,

      el('div.range-ask', q.prompt),
      // Just the cards. Printing "32o" beside them, with a line explaining
      // what the o means, does the reading for you — and reading it is the
      // skill. The chart below is labelled in notation, so finding your hand
      // on it is the translation exercise, every question, for free.
      el('div.hand-row',
        q.cards ? cardRow(q.cards, { size: 'lg', fourColour: !!profile.settings.fourColour }) : null,
      ),

      el('div.ask-options', q.options.map((option) => {
        const mark = a && (option === q.answer ? '.correct' : option === a.choice ? '.wrong' : '');
        return el(`button.btn.lg.ask-option${mark || ''}`, {
          disabled: !!a,
          onclick: () => answer(option),
        }, t(option));
      })),
      !a ? dontKnowButton(() => answer(IDK)) : null,

      a
        ? el('div',
          el('div.verdict-box' + (a.choice === IDK ? '.skip' : a.correct ? '.good' : '.bad'),
            el('strong', a.choice === IDK
              ? t("You said you didn't know — here it is.")
              : a.correct ? (a.credited ? t('Right') : t('Right — but you looked')) : t('Not that one')),
            el('div', q.why),
            a.choice === null ? el('div.faint', t('The clock ran out. At the table it does too.')) : null),
          // The button comes before the chart, not after: the chart is a
          // study aid, not a gate you have to scroll past to move on. A
          // 169-cell grid is tall enough that "next hand" used to sit off
          // the bottom of the screen every single question.
          el('button.btn.primary.lg.block', { onclick: advance },
            state.index + 1 >= ASKED ? t('See how it went') : t('Next hand')),
          state.showChart ? rangeGridFor({ seat: q.seat, raiser: q.raiser, hand: q.hand }) : null,
          // Reproducing a spot by hand is enough work that nobody does it,
          // so the trainer writes it out — the drills have had this and the
          // reader had to send a screenshot instead.
          copyButton(() => ({
            module: t(checkpoint.name),
            scenario: { hole: q.cards, position: q.seat, heroSeat: q.seat, raiser: q.raiser },
            question: q.prompt,
            options: q.options.map((o) => ({ key: o, label: o })),
            given: a.choice === null ? t('(the clock ran out)')
              : a.choice === IDK ? t("I don't know") : a.choice,
            correct: q.answer,
            explanation: q.why,
          })),
        )
        : stage.showsChart
          ? rangeGridFor({ seat: q.seat, raiser: q.raiser })
          : stage.canPeek
            ? el('div',
              state.showChart
                ? rangeGridFor({ seat: q.seat, raiser: q.raiser })
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

/* ------------------------------------------------------------------ *
 * Weak hands: practice sourced from what you actually get wrong, not
 * another random draw from the whole chart.
 * ------------------------------------------------------------------ */

export function renderRangeWeak(ctx) {
  const { profile, go, params } = ctx;
  const scopeKey = params.spot && PRACTICABLE.some((c) => c.key === params.spot) ? params.spot : null;

  // One uncapped pass over everything there is to practise. It feeds both
  // the chip row — only a checkpoint that actually has something shows a
  // chip at all — and the "how many total" count on the mixed one.
  const everything = profile.weakRangeHands(PRACTICABLE_KEYS, 999);
  const countFor = (key) => everything.filter((row) => row.checkpointKey === key).length;

  const sessionKeys = scopeKey ? [scopeKey] : PRACTICABLE_KEYS;
  const pool = profile.weakRangeHands(sessionKeys);

  const rng = makeRng();
  const root = el('div.screen');

  function empty() {
    return el('div.panel',
      el('div.panel-title', el('h3', icon('charts', { size: 18 }), t('Your weak hands'))),
      el('p.muted', scopeKey
        ? t('Nothing missed here yet — that is a good sign, not a bug.')
        : t('Nothing missed yet. Play a rung on the ladder without the chart open, and the hands you '
          + 'get wrong start showing up here.')),
      el('button.btn.ghost', { onclick: () => go('ranges') }, t('Back to the ladder')),
    );
  }

  if (!pool.length) {
    mount(root, empty());
    return root;
  }

  const state = {
    started: false, index: 0, right: 0,
    checkpoint: null, question: null, answered: null, peeked: false, showChart: false, done: false,
  };

  function start() {
    state.started = true;
    nextQuestion();
  }

  function nextQuestion() {
    const row = pool[state.index];
    state.checkpoint = checkpointFor(row.checkpointKey);
    state.question = rangeQuestionForHand(state.checkpoint, row.hand, rng);
    // Same reason as the ladder: built once per question, not per redraw, so
    // the seat picture does not move while it is being read.
    state.ring = seatRing(rng, { heroPosition: state.question.seat });
    state.answered = null;
    state.peeked = false;
    state.showChart = false;
    draw();
  }

  function answer(choice) {
    if (state.answered) return;
    const correct = choice === state.question.answer;
    state.answered = { choice, correct, credited: correct && !state.peeked };
    if (state.answered.credited) state.right++;
    // Feed the result straight back into the same tracker the ladder writes
    // to. Improve on a hand here and it works its own way off this list;
    // miss it again and it stays exactly where it was.
    if (!state.peeked) profile.recordRangeHand(state.checkpoint.key, state.question.hand, correct);
    state.showChart = true;
    draw();
  }

  function advance() {
    state.index++;
    if (state.index >= pool.length) return finish();
    return nextQuestion();
  }

  function finish() {
    state.done = true;
    draw();
  }

  function draw() {
    if (!state.started) return mount(root, browse());
    if (state.done) return mount(root, summary());
    mount(root, running());
  }

  function weakRow(row) {
    return el('div.weak-row',
      el('span.weak-hand', row.hand),
      el('div.rung-body',
        !scopeKey ? el('span.rung-note', t(checkpointFor(row.checkpointKey).name)) : null,
        el('span.rung-note', t('{n} more right and it comes off this list.', { n: row.needed })),
      ),
      el('span.weak-marks', row.recent.map((ok) => el(`span.mark-dot${ok ? '.ok' : ''}`))),
    );
  }

  function browse() {
    return el('div.panel',
      el('div.panel-title', el('h3', icon('charts', { size: 18 }), t('Your weak hands'))),
      chips(),
      el('p.muted', t('Worst first. Get one right, unaided, and its count ticks down; miss it again and '
        + 'it resets.')),
      el('div.rungs', pool.map(weakRow)),
      el('button.btn.primary', { style: { marginTop: 'var(--s-3)' }, onclick: start }, t('Practise them')),
    );
  }

  function chips() {
    return el('div.row', { style: { flexWrap: 'wrap', marginBottom: '14px' } },
      el(`button.btn.sm${scopeKey ? '.ghost' : ''}`, { onclick: () => go('ranges-weak') },
        t('All ({n})', { n: everything.length })),
      PRACTICABLE.filter((c) => countFor(c.key) > 0).map((c) => el(
        `button.btn.sm${scopeKey === c.key ? '' : '.ghost'}`,
        { onclick: () => go('ranges-weak', { spot: c.key }) },
        `${shortLabel(c)} (${countFor(c.key)})`,
      )),
    );
  }

  function summary() {
    const stillWeak = profile.weakRangeHands(sessionKeys, 999).length;
    return el('div.panel',
      el('div.panel-title', el('h3', t('Your weak hands'))),
      el('div.run-score', `${state.right} / ${pool.length}`),
      el('p', stillWeak
        ? t('{n} of these are still on the list — run it again and they come back.', { n: stillWeak })
        : t('None of these are still on the list. Come back once there are more.')),
      el('div.row',
        el('button.btn.primary', { onclick: () => go('ranges-weak', scopeKey ? { spot: scopeKey } : {}) },
          t('Run it again')),
        el('button.btn.ghost', { onclick: () => go('ranges') }, t('Back to the ladder')),
      ),
    );
  }

  function running() {
    const q = state.question;
    const a = state.answered;
    return el('div.panel',
      chips(),
      el('div.run-head',
        el('div',
          el('div.run-where', t(state.checkpoint.name)),
          el('div.faint', t('From your weak hands')),
        ),
        el('div.run-count', `${state.index + 1} / ${pool.length}`),
      ),

      state.ring
        ? el('div.ask-table', seatFelt(state.ring, {
          raiser: q.raiser,
          fourColour: !!profile.settings.fourColour,
          compact: true,
        }))
        : null,

      el('div.range-ask', q.prompt),
      el('div.hand-row',
        q.cards ? cardRow(q.cards, { size: 'lg', fourColour: !!profile.settings.fourColour }) : null,
      ),

      el('div.ask-options', q.options.map((option) => {
        const mark = a && (option === q.answer ? '.correct' : option === a.choice ? '.wrong' : '');
        return el(`button.btn.lg.ask-option${mark || ''}`, {
          disabled: !!a,
          onclick: () => answer(option),
        }, t(option));
      })),
      !a ? dontKnowButton(() => answer(IDK)) : null,

      a
        ? el('div',
          el('div.verdict-box' + (a.choice === IDK ? '.skip' : a.correct ? '.good' : '.bad'),
            el('strong', a.choice === IDK
              ? t("You said you didn't know — here it is.")
              : a.correct ? (a.credited ? t('Right') : t('Right — but you looked')) : t('Not that one')),
            el('div', q.why)),
          el('button.btn.primary.lg.block', { onclick: advance },
            state.index + 1 >= pool.length ? t('See how it went') : t('Next hand')),
          state.showChart ? rangeGridFor({ seat: q.seat, raiser: q.raiser, hand: q.hand }) : null,
          copyButton(() => ({
            module: t(state.checkpoint.name),
            scenario: { hole: q.cards, position: q.seat, heroSeat: q.seat, raiser: q.raiser },
            question: q.prompt,
            options: q.options.map((o) => ({ key: o, label: o })),
            given: a.choice === IDK ? t("I don't know") : a.choice,
            correct: q.answer,
            explanation: q.why,
          })),
        )
        : el('div',
          state.showChart
            ? rangeGridFor({ seat: q.seat, raiser: q.raiser })
            : el('button.btn.ghost', {
              onclick: () => { state.peeked = true; state.showChart = true; draw(); },
            }, icon('charts', { size: 15 }), t('Show me the chart')),
          state.peeked ? el('div.faint', t('This one will not be counted.')) : null),
    );
  }

  draw();
  return root;
}
