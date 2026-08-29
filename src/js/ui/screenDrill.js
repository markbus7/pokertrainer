/** Lessons, drills and the Gauntlet. */

import { el, mount, toast, fmt } from './dom.js';
import { scenarioView } from './scenarioView.js';
import { MODULE_META, moduleMeta } from '../data/curriculum.js';
import { generateQuestion, generateGauntlet, difficultyForLevel } from '../trainers/index.js';
import { checkAchievements } from '../state/achievements.js';

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
        el('button.btn.primary.lg', { onclick: () => go('drill', { module: meta.id }) }, 'Start drilling'),
      ),
      stats.attempts
        ? el('div.row', { style: { marginTop: '14px' } },
            el('span.badge', `${stats.attempts} attempts`),
            el('span.badge', `${stats.correct} correct`),
            acc !== null ? el(`span.badge.${acc >= 0.9 ? 'green' : acc >= 0.7 ? 'gold' : 'red'}`, `${fmt.pct(acc)} accuracy`) : null,
            stats.bestStreak ? el('span.badge', `best streak ${stats.bestStreak}`) : null,
          )
        : null,
    ),
    el('div.panel',
      el('h3', 'Why this matters'),
      el('p.muted', meta.lesson.summary),
      el('h3', { style: { marginTop: '18px' } }, 'The key points'),
      el('ul.lesson-points', meta.lesson.points.map((point) => el('li', el('span', point)))),
    ),
    el('div.row',
      el('button.btn.primary', { onclick: () => go('drill', { module: meta.id }) }, `Drill ${meta.name}`),
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

  const state = {
    index: 0,
    correct: 0,
    answered: 0,
    streak: 0,
    xpEarned: 0,
    question: null,
    locked: false,
  };

  const header = el('div.panel');
  const body = el('div.panel');
  const footer = el('div.row');
  const root = el('div.screen', header, body, footer);

  const nextQuestion = () => {
    if (gauntlet && state.index >= queue.length) return finish();
    state.question = gauntlet ? queue[state.index] : generateQuestion(meta.id, rng, difficulty);
    state.locked = false;
    state.index++;
    draw();
    return null;
  };

  const finish = () => {
    const pct = state.answered ? state.correct / state.answered : 0;
    if (gauntlet) {
      checkAchievements(profile, { type: 'gauntlet', correct: state.correct, total: state.answered })
        .forEach((a) => toast({ icon: a.icon, title: a.name, desc: a.description }));
    }
    mount(header,
      el('h1', gauntlet ? 'Gauntlet complete' : 'Session complete'),
      el('div.muted', `${state.correct} of ${state.answered} correct — ${fmt.pct(pct)}`),
    );
    mount(body,
      el('div.grid.cols-3',
        el('div.stat', el('div.label', 'Score'), el('div.value', `${state.correct}/${state.answered}`)),
        el('div.stat', el('div.label', 'Accuracy'), el(`div.value.${pct >= 0.8 ? 'good' : pct < 0.5 ? 'bad' : ''}`, fmt.pct(pct))),
        el('div.stat', el('div.label', 'XP earned'), el('div.value', `+${state.xpEarned}`)),
      ),
      el('p.muted', { style: { marginTop: '16px' } }, verdictText(pct, gauntlet)),
    );
    mount(footer,
      el('button.btn.primary', { onclick: () => go(gauntlet ? 'gauntlet' : 'drill', params) }, 'Go again'),
      el('button.btn.ghost', { onclick: () => go('home') }, 'Back to dashboard'),
    );
    return null;
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
        toast({ icon: profile.rank.emoji, title: `Level ${profile.level} — ${profile.rank.name}`, desc: profile.rank.blurb });
      }
    } else {
      state.streak = 0;
    }

    profile.recordDrill(q.module, wasCorrect);
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
            el('div.faint', gauntlet ? `Question ${state.index} of ${queue.length} · ${q.moduleName}` : `Difficulty ${q.difficulty}`),
          ),
        ),
        el('div.row',
          el(`span.streak-pill${state.streak >= 3 ? '.hot' : ''}`, state.streak >= 3 ? `🔥 ${state.streak} streak` : `${state.streak} streak`),
          el('span.badge', `${state.correct}/${state.answered}`),
        ),
      ),
      gauntlet
        ? el('div.bar', { style: { marginTop: '12px' } }, el('span', { style: { width: `${(state.index / queue.length) * 100}%` } }))
        : null,
    );

    const options = el('div.options',
      q.options.map((option, i) => el(`button.option${
        chosen === null ? '' : option.key === q.answer ? '.correct' : option.key === chosen ? '.wrong' : ''
      }`, {
        disabled: chosen !== null,
        onclick: () => answer(option.key),
      },
        el('span.key', String(i + 1)),
        el('span', option.label),
      )),
    );

    mount(body,
      scenarioView(q.scenario, ctx.profile.settings),
      el('div.question', { style: { marginTop: q.scenario ? '16px' : '0' } }, q.question),
      options,
      chosen === null ? null : el(`div.feedback.${chosen === q.answer ? 'correct' : 'wrong'}`,
        el('div.verdict', chosen === q.answer ? '✓ Correct' : '✗ Not quite'),
        el('div', q.explanation),
      ),
    );

    mount(footer,
      chosen === null
        ? el('span.faint', 'Press 1-4 to answer')
        : el('button.btn.primary', { onclick: () => (gauntlet && state.index >= queue.length ? finish() : nextQuestion()) },
            gauntlet && state.index >= queue.length ? 'See results' : 'Next question →'),
      chosen !== null && !gauntlet ? el('button.btn.ghost', { onclick: finish }, 'End session') : null,
      !gauntlet && chosen === null ? el('button.btn.ghost', { onclick: () => go('learn', { module: meta.id }) }, 'Review the lesson') : null,
    );
  };

  root.addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (state.question && !state.locked && n >= 1 && n <= state.question.options.length) {
      answer(state.question.options[n - 1].key);
    } else if (state.locked && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (gauntlet && state.index >= queue.length) finish(); else nextQuestion();
    }
  });

  ctx.onKey = (e) => root.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));

  if (gauntlet && !queue.length) {
    return el('div.empty', 'No modules unlocked yet — start with a lesson.');
  }
  nextQuestion();
  return root;
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
        unlocked.map((m) => el('span.badge', `${m.icon} ${m.name}`)),
      ),
      el('button.btn.primary.lg', { onclick: () => go('drill', { mode: 'gauntlet' }) }, 'Begin the run'),
    ),
  );
}
