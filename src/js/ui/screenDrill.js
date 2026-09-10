/** Lessons, drills and the Gauntlet. */

import { el, mount, richText, toast, fmt } from './dom.js';
import { t } from '../i18n/index.js';
import { scenarioView } from './scenarioView.js';
import { copyButton } from './copySpot.js';
import { MODULE_META, moduleMeta } from '../data/curriculum.js';
import { generateQuestion, generateGauntlet, difficultyForLevel } from '../trainers/index.js';
import { checkAchievements } from '../state/achievements.js';
import { masteryTier, nextTierGoal, promotion, tierByKey, EVIDENCE_BAR } from '../state/mastery.js';
import { review } from '../state/spacing.js';
import { CHARTS, BOUNDARY_ROWS, rowBoundary } from '../data/ranges.js';

/** The lesson page for a module, with the drill entry point. */
export function renderLearn(ctx, params) {
  const meta = moduleMeta(params.module);
  if (!meta) return el('div.empty', 'Unknown module.');
  const { profile, go } = ctx;
  const stats = profile.drillStats(meta.id);
  const acc = profile.accuracy(meta.id);

  return el('div.screen',
    el('div.panel',
      el('div.spread',
        el('div.row',
          el('span', { style: { fontSize: '2.4rem' } }, meta.icon),
          el('div',
            el('h1', { style: { margin: 0 } }, meta.name),
            el('div.muted', meta.tagline),
          ),
        ),
        el('div.row',
          el('button.btn.primary.lg', { onclick: () => go('walkthrough', { module: meta.id }) },
            profile.hasCompletedWalkthrough(meta.id) ? 'Read the lesson again' : 'Teach me this'),
          el('button.btn.lg.ghost', { onclick: () => go('drill', { module: meta.id }) }, 'Skip to drills'),
        ),
      ),
      stats.attempts
        ? el('div.row', { style: { marginTop: '14px' } },
            el('span.badge', `${stats.attempts} attempts`),
            el('span.badge', `${stats.correct} correct`),
            // Below the evidence bar there is no percentage to show, and a
            // blank where a score should be tells the reader nothing about
            // why. Say what is missing instead.
            acc !== null
              ? el(`span.badge.${acc >= 0.9 ? 'green' : acc >= 0.7 ? 'gold' : 'red'}`,
                t('{pct} accuracy', { pct: fmt.pct(acc) }))
              : el('span.badge', t('{n} more for a score', { n: EVIDENCE_BAR - stats.attempts })),
            stats.bestStreak ? el('span.badge', t('best streak {n}', { n: stats.bestStreak })) : null,
          )
        : null,
    ),
    el('div.panel',
      el('div.spread',
        el('h3', { style: { margin: 0 } }, 'Why this matters'),
        profile.hasCompletedWalkthrough(meta.id) ? el('span.badge.green', '✓ Lesson done') : null,
      ),
      el('p.muted', meta.lesson.summary),
      el('h3', { style: { marginTop: '18px' } }, 'The key points'),
      el('ul.lesson-points', meta.lesson.points.map((point) => el('li', el('span', point)))),
    ),
    el('div.row',
      el('button.btn.primary', { onclick: () => go('walkthrough', { module: meta.id }) }, 'Walk me through it, step by step'),
      el('button.btn.ghost', { onclick: () => go('drill', { module: meta.id }) },
        t('Drill {module}', { module: t(meta.name) })),
      el('button.btn.ghost', { onclick: () => go('home') }, 'Back'),
    ),
  );
}

/**
 * The drill runner. Used for both single-module practice and the Gauntlet;
 * the only difference is where the questions come from and whether the run ends.
 */
export function renderDrill(ctx, params) {
  const gauntlet = params.mode === 'gauntlet';
  const meta = gauntlet ? null : moduleMeta(params.module);
  if (!gauntlet && !meta) return el('div.empty', 'Unknown module.');

  const { profile, rng, go } = ctx;
  const difficulty = difficultyForLevel(profile.level);
  const queue = gauntlet ? generateGauntlet(rng, profile.level, 10) : [];

  // A session used to run forever, so there was no moment of having finished
  // and no target to aim at. It is now a fixed length with a stated pass mark,
  // and endless practice is an explicit choice afterwards rather than the
  // only mode available.
  const endless = params.endless === '1';
  const SESSION_LENGTH = 10;
  const PASS_MARK = 8;
  const tierBefore = gauntlet ? null : masteryTier(profile, meta.id);

  const state = {
    index: 0,
    correct: 0,
    answered: 0,
    streak: 0,
    peeked: false,
    xpEarned: 0,
    question: null,
    locked: false,
  };

  const sessionLength = gauntlet ? queue.length : SESSION_LENGTH;
  const bounded = gauntlet || !endless;
  const sessionOver = () => bounded && state.answered >= sessionLength;

  const header = el('div.panel');
  const body = el('div.panel');
  const footer = el('div.row');
  const root = el('div.screen', header, body, footer);

  const nextQuestion = () => {
    if (sessionOver()) return finish();
    if (gauntlet && state.index >= queue.length) return finish();
    state.question = gauntlet ? queue[state.index] : generateQuestion(meta.id, rng, difficulty);
    state.locked = false;
    state.typed = null;
    state.peeked = false;
    state.index++;
    draw();
    return null;
  };

  const finish = () => {
    const pct = state.answered ? state.correct / state.answered : 0;
    const passed = state.correct >= (gauntlet ? 8 : PASS_MARK);
    if (gauntlet) {
      checkAchievements(profile, { type: 'gauntlet', correct: state.correct, total: state.answered })
        .forEach((a) => toast({ icon: a.icon, title: a.name, desc: a.description }));
    }

    const tierAfter = gauntlet ? null : masteryTier(profile, meta.id);
    const promoted = tierBefore ? promotion(tierBefore, tierAfter) : null;
    if (promoted) {
      toast({
        icon: '🎓',
        title: `${t(meta.name)}: ${t(promoted.name)}`,
        desc: t(promoted.blurb),
        duration: 7000,
      });
    }
    const goal = gauntlet ? null : nextTierGoal(profile, meta.id);

    mount(header,
      el('div.row',
        el('span', { style: { fontSize: '2rem' } }, passed ? '✅' : '📘'),
        el('div',
          el('h1', { style: { margin: 0 } }, gauntlet ? 'Gauntlet complete' : passed ? 'Session passed' : 'Session complete'),
          el('div.muted', t('{correct} of {answered} correct — {pct}',
            { correct: state.correct, answered: state.answered, pct: fmt.pct(pct) })
            + (bounded ? t(' · pass mark was {pass}', { pass: gauntlet ? 8 : PASS_MARK }) : '')),
        ),
      ),
    );

    mount(body,
      el('div.grid.cols-3',
        el('div.stat', el('div.label', 'Score'), el('div.value', `${state.correct}/${state.answered}`)),
        el('div.stat', el('div.label', 'Accuracy'), el(`div.value.${pct >= 0.8 ? 'good' : pct < 0.5 ? 'bad' : ''}`, fmt.pct(pct))),
        el('div.stat', el('div.label', 'XP earned'), el('div.value', `+${state.xpEarned}`)),
      ),

      promoted
        ? el('div.panel', { style: { marginTop: '16px', borderColor: 'var(--green)', background: 'rgba(62,207,142,0.08)' } },
            el('div.row',
              el('span', { style: { fontSize: '1.8rem' } }, promoted.icon),
              el('div',
                el('h3', { style: { margin: 0 } },
                  t('{module} is now {tier}', { module: t(meta.name), tier: t(promoted.name) })),
                el('div.faint', promoted.blurb),
              ),
            ),
          )
        : null,

      goal
        ? el('div.panel', { style: { marginTop: '16px', background: 'var(--bg-raised)' } },
            el('div.spread',
              el('div',
                el('div', { style: { fontWeight: '650' } }, t('Next: {tier}', { tier: t(goal.name) })),
                el('div.faint', t('Needs {requirement}. Still to go: {missing}.',
                  { requirement: t(goal.requirement), missing: goal.missing.map((m) => t(m)).join(', ') })),
              ),
            ),
            el('div.bar', { style: { marginTop: '10px' } },
              el('span', { style: { width: `${Math.round(goal.progress * 100)}%` } })),
          )
        : !gauntlet
          ? el('div.notice', { style: { marginTop: '16px' } },
              t('You have mastered {module}. It will come back for spaced review so it stays that way.',
                { module: t(meta.name) }))
          : null,

      el('p.muted', { style: { marginTop: '16px' } }, verdictText(pct, gauntlet)),
    );

    mount(footer,
      el('button.btn.primary', { onclick: () => go(gauntlet ? 'gauntlet' : 'drill', { module: params.module }) },
        'Another session'),
      !gauntlet
        ? el('button.btn.ghost', { onclick: () => go('drill', { module: params.module, endless: '1' }) }, 'Endless practice')
        : null,
      el('button.btn.ghost', { onclick: () => go('home') }, 'Back to dashboard'),
    );
    return null;
  };

  /**
   * Grades a typed number through the same path a picked option takes, so
   * mastery, XP and the review schedule only ever see one kind of event.
   */
  const submitTyped = (raw) => {
    const q = state.question;
    const value = Number(String(raw).replace(',', '.').replace('%', '').trim());
    if (!Number.isFinite(value)) return;
    state.typed = value;
    const close = Math.abs(value - q.entry.value) <= q.entry.tolerance;
    // A wrong typed answer is graded through some option key so that mastery,
    // XP and the review schedule only ever see one kind of event — but that
    // key is an implementation detail, not something the reader picked, so
    // draw() knows not to paint it red. Saying "you said 16" and then
    // highlighting 11 is a lie about what happened.
    const wrong = q.options.find((o) => o.key !== q.answer);
    answer(close ? q.answer : wrong.key);
  };

  /** "24%" but "6 outs" — a symbol hugs the number, a word does not. */
  const withUnit = (value, entry) => {
    if (!entry || !entry.unit) return String(value);
    return /^[%°]/.test(entry.unit) ? `${value}${entry.unit}` : `${value} ${entry.unit}`;
  };

  const typedAnswer = (q) => {
    const input = el('input.drill-entry-input', {
      type: 'number', step: 'any', placeholder: '—', inputmode: 'decimal',
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); submitTyped(input.value); } },
    });
    const box = el('div.drill-entry',
      input,
      q.entry.unit ? el('span.drill-entry-unit', q.entry.unit) : null,
      el('button.btn.primary', { onclick: () => submitTyped(input.value) }, t('Answer')),
    );
    // Autofocus would pop the keyboard on a phone before the reader has even
    // looked at the board, so the input waits to be tapped.
    return box;
  };

  const answer = (key) => {
    if (state.locked) return;
    state.locked = true;
    state.answered++;
    const q = state.question;
    const wasCorrect = key === q.answer;

    if (wasCorrect) {
      state.correct++;
      state.streak++;
      const bonus = Math.min(state.streak, 10) * 2;
      const gained = q.xp + bonus;
      state.xpEarned += gained;
      const before = profile.level;
      profile.addXp(gained);
      if (profile.level > before) {
        toast({
          icon: profile.rank.emoji,
          title: t('Level {n} — {rank}', { n: profile.level, rank: t(profile.rank.name) }),
          desc: t(profile.rank.blurb),
        });
      }
    } else {
      state.streak = 0;
    }

    // An answer read off the chart is not an answer you knew. It still
    // teaches — looking a boundary up is how it gets encoded in the first
    // place — but crediting it would let mastery be earned by lookup.
    profile.recordDrill(q.module, wasCorrect && !state.peeked);
    review(profile, q.module, wasCorrect);
    checkAchievements(profile).forEach((a) => toast({ icon: a.icon, title: a.name, desc: a.description }));
    draw(key);
  };

  const draw = (chosen = null) => {
    const q = state.question;
    mount(header,
      el('div.spread',
        el('div.row',
          el('span', { style: { fontSize: '1.6rem' } }, q.icon),
          el('div',
            el('div', { style: { fontWeight: '650' } }, gauntlet ? 'The Gauntlet' : q.moduleName),
            el('div.faint', gauntlet
              ? t('Question {n} of {total} · {module}', { n: state.index, total: queue.length, module: t(q.moduleName) })
              : bounded
                ? t('Question {n} of {total} · pass mark {pass}', { n: Math.min(state.index, sessionLength), total: sessionLength, pass: PASS_MARK })
                : t('Endless practice · question {n}', { n: state.index })),
          ),
        ),
        el('div.row',
          el(`span.streak-pill${state.streak >= 3 ? '.hot' : ''}`, state.streak >= 3
            ? t('🔥 {n} streak', { n: state.streak })
            : t('{n} streak', { n: state.streak })),
          el('span.badge', `${state.correct}/${state.answered}`),
        ),
      ),
      bounded
        ? el('div.bar', { style: { marginTop: '12px' } },
            el('span', { style: { width: `${(Math.min(state.answered, sessionLength) / sessionLength) * 100}%` } }))
        : null,
    );

    const options = el('div.options',
      q.options.map((option, i) => el(`button.option${
        chosen === null ? ''
          : option.key === q.answer ? '.correct'
            : option.key === chosen && state.typed == null ? '.wrong' : ''
      }`, {
        disabled: chosen !== null,
        onclick: () => answer(option.key),
      },
        el('span.key', String(i + 1)),
        el('span', richText(option.label)),
      )),
    );

    // A question with a number for an answer asks you to produce it rather
    // than spot it in a list. Picking 25% from four options is a recognition
    // task; saying "25%" is the one you have to do at a table, where nobody
    // offers you a shortlist. The options still appear afterwards, marked, so
    // you always see the right number next to the one you gave.
    const entryBox = q.entry && chosen === null ? typedAnswer(q) : null;
    const sheet = cheatSheet(q);

    mount(body,
      scenarioView(q.scenario, ctx.profile.settings),
      el('div.question', { style: { marginTop: q.scenario ? '16px' : '0' } }, richText(q.question)),
      entryBox || options,
      chosen === null ? null : el(`div.feedback.${chosen === q.answer ? 'correct' : 'wrong'}`,
        el('div.verdict', chosen === q.answer
          ? t('✓ Correct')
          : state.typed != null
            ? t('✗ Not quite — you said {said}', { said: withUnit(state.typed, q.entry) })
            : t('✗ Not quite')),
        // Through richText, not as a bare string: the explanations carry
        // **emphasis**, and every jargon word in them can explain itself.
        el('div', richText(q.explanation)),
      ),
    );

    mount(footer,
      chosen === null
        ? el('span.faint', entryBox ? t('Type your answer, then press Enter') : 'Press 1-4 to answer')
        : el('button.btn.primary', { onclick: () => (sessionOver() ? finish() : nextQuestion()) },
            sessionOver() ? 'See results →' : 'Next question →'),
      // Once it is graded there is something worth asking about, and asking
      // well means reproducing the whole spot — five cards, the pot, the
      // options and what you said. Retyping that is enough work that nobody
      // does it, so the game writes it out.
      chosen === null ? null : copyButton(() => ({
        module: meta.name,
        scenario: q.scenario,
        question: q.question,
        options: q.options,
        given: state.typed != null
          ? withUnit(state.typed, q.entry)
          : (q.options.find((o) => o.key === chosen) || {}).label,
        correct: (q.options.find((o) => o.key === q.answer) || {}).label,
        explanation: q.explanation,
      })),
      // Somewhere to look. Offered before you answer, because afterwards the
      // right answer is already on screen and a chart adds nothing.
      chosen === null && sheet
        ? (state.peeked
          ? sheet
          : el('button.btn.sm.ghost.block', {
            style: { marginTop: '14px' },
            onclick: () => { state.peeked = true; draw(); },
          }, t('Show me the chart')))
        : null,

      chosen !== null && !bounded ? el('button.btn.ghost', { onclick: finish }, 'End session') : null,
      !gauntlet && chosen === null ? el('button.btn.ghost', { onclick: () => go('learn', { module: meta.id }) }, 'Review the lesson') : null,
    );
  };

  root.addEventListener('keydown', (e) => {
    const n = Number(e.key);
    // Keys meant for the answer box are not shortcuts. app.js already drops
    // these before calling any screen, but this listener sits on the screen's
    // own root, above the input, so bubbling reaches it regardless: Enter
    // submitted the answer and then arrived here, where Enter means "next
    // question", and one press both answered and skipped past the result.
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    // Number keys pick an option, but only when there are options on screen —
    // otherwise typing "2" into the answer box would submit option 2.
    if (state.question && state.question.entry && !state.locked) return;
    if (state.question && !state.locked && n >= 1 && n <= state.question.options.length) {
      answer(state.question.options[n - 1].key);
    } else if (state.locked && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (sessionOver()) finish(); else nextQuestion();
    }
  });

  ctx.onKey = (e) => root.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));

  if (gauntlet && !queue.length) {
    return el('div.empty', 'No modules unlocked yet — start with a lesson.');
  }
  nextQuestion();
  return root;
}

/** The modules whose questions a preflop chart is the reference for. */
const CHART_MODULES = new Set(['preflop', 'position']);

/**
 * The chart, in the compressed form, for the question on screen.
 *
 * Preflop questions used to be asked with nowhere to look anything up: the
 * Charts tab is a different screen, and leaving mid-session abandons it. A
 * boundary you have never seen is not a boundary you can retrieve, and being
 * asked twenty times without it is not practice — it is guessing with a
 * score attached.
 *
 * Returns null when the question is not one a chart answers.
 */
function cheatSheet(question) {
  // Only the two modules these charts actually answer. Defence frequency is
  // a formula from the numbers in its own question; offering a preflop grid
  // beside it is noise pretending to be help.
  if (!CHART_MODULES.has(question.module)) return null;
  const scenario = question.scenario || {};
  const defending = Boolean(scenario.raiser);
  const source = defending ? CHARTS.bbDefend : CHARTS.rfi;
  const seats = ['UTG', 'HJ', 'CO', 'BTN', 'SB'].filter((p) => source[p]);
  if (!seats.length) return null;

  const rows = BOUNDARY_ROWS
    .map((row) => ({
      row,
      cells: seats.map((seat) => rowBoundary(source[seat], row.high, row.suited)),
    }))
    .filter((entry) => entry.cells.some(Boolean));
  if (!rows.length) return null;

  const highlight = defending ? scenario.raiser : scenario.position;
  return el('div.cheat-sheet',
    el('div.faint', defending
      ? t('Defending the big blind — how far down each row you still call.')
      : t('Opening — how far down each row you still raise.')),
    el('div.cheat-scroll', el('table.cheat-table',
      el('thead', el('tr',
        el('th', defending ? t('vs a raise from') : t('Row')),
        seats.map((seat) => el(`th${seat === highlight ? '.here' : ''}`, seat)),
      )),
      el('tbody', rows.map(({ row, cells }) => el('tr',
        el('th', t(row.label)),
        cells.map((cell, i) => el(`td${seats[i] === highlight ? '.here' : ''}`, cell || '—')),
      ))),
    )),
    el('div.faint', t('Pairs and suited aces are always in. This one does not count toward your score.')),
  );
}

function verdictText(pct, gauntlet) {
  if (pct >= 0.95) return gauntlet ? 'Flawless. That is the standard you want before moving up in stakes.' : 'Nearly perfect. Raise the difficulty by moving on to the next module.';
  if (pct >= 0.8) return 'Strong. A few more sessions at this level and it will be automatic.';
  if (pct >= 0.6) return 'Getting there. Re-read the lesson points you missed — the explanation under each wrong answer is the important part.';
  return 'This one needs work. Go back to the lesson and drill again; nobody gets this on the first pass.';
}

/** Module picker for the Gauntlet entry screen. */
export function renderGauntletIntro(ctx) {
  const { profile, go } = ctx;
  const unlocked = MODULE_META.filter((m) => m.unlockLevel <= profile.level);
  return el('div.screen',
    el('div.panel',
      el('h1', '⚡ The Gauntlet'),
      el('p.muted', 'Ten questions drawn at random from every module you have unlocked. You will not know which skill is coming, which is exactly the point — at the table, nobody tells you that this is a pot-odds spot.'),
      el('div.row', { style: { marginBottom: '16px' } },
        unlocked.map((m) => el('span.badge', m.icon, ' ', t(m.name))),
      ),
      el('button.btn.primary.lg', { onclick: () => go('drill', { mode: 'gauntlet' }) }, 'Begin the run'),
    ),
  );
}
