/**
 * The guided lesson: one concept, taught in ordered steps, with a
 * comprehension check after each one.
 *
 * The check is the point. Reading a lesson and believing you understood it is
 * the failure mode this screen exists to prevent, so you cannot reach the end
 * without answering — and a wrong answer gets an explanation aimed at that
 * specific misunderstanding rather than a generic correction.
 */

import { el, mount, richText, toast } from './dom.js';
import { t } from '../i18n/index.js';
import { renderVisual } from './visuals.js';
import { moduleMeta, WALKTHROUGHS } from '../data/curriculum.js';

export function renderWalkthrough(ctx, params) {
  const meta = moduleMeta(params.module);
  const walkthrough = WALKTHROUGHS[params.module];
  if (!meta || !walkthrough) {
    return el('div.empty', 'That lesson is not available yet.');
  }

  const { profile, go } = ctx;
  const state = { index: 0, chosen: null, correctCount: 0, answered: new Set() };

  const header = el('div.panel');
  const body = el('div.panel');
  const footer = el('div.row');
  const root = el('div.screen', header, body, footer);

  const totalSteps = walkthrough.steps.length;

  function answer(optionKey) {
    if (state.chosen) return;
    const step = walkthrough.steps[state.index];
    state.chosen = optionKey;
    const isCorrect = optionKey === step.check.answer;

    if (isCorrect && !state.answered.has(state.index)) {
      state.answered.add(state.index);
      state.correctCount++;
      const before = profile.level;
      profile.addXp(10);
      if (profile.level > before) {
        toast({ icon: profile.rank.emoji, title: `Level ${profile.level} — ${profile.rank.name}`, desc: profile.rank.blurb });
      }
    }
    draw();
  }

  function next() {
    if (state.index >= totalSteps - 1) return finish();
    state.index++;
    state.chosen = null;
    draw();
    window.scrollTo({ top: 0 });
    return null;
  }

  function back() {
    if (state.index === 0) return;
    state.index--;
    state.chosen = null;
    draw();
  }

  function finish() {
    const firstTime = profile.markWalkthroughComplete(meta.id);
    if (firstTime) profile.addXp(25);

    mount(header,
      el('div.row',
        el('span', { style: { fontSize: '2rem' } }, meta.icon),
        el('div',
          el('h1', { style: { margin: 0 } }, 'Lesson complete'),
          el('div.muted', `${meta.name} — ${state.correctCount} of ${totalSteps} checks correct first time`),
        ),
      ),
    );

    mount(body,
      el('h3', 'The whole thing, in five lines'),
      el('ul.lesson-points', walkthrough.recap.map((point) => el('li', el('span', richText(point))))),
      el('div.notice', { style: { marginTop: '16px' } },
        state.correctCount === totalSteps
          ? 'You answered every check correctly. Go and drill it — the drills use randomly generated spots, so they will test whether it really stuck.'
          : 'Some of those checks took a second attempt, which is exactly what they are for. The drills will give you unlimited fresh spots to practise on.',
      ),
    );

    mount(footer,
      el('button.btn.primary.lg', { onclick: () => go('drill', { module: meta.id }) }, `Drill ${meta.name}`),
      el('button.btn.ghost', { onclick: () => { state.index = 0; state.chosen = null; draw(); } }, 'Read it again'),
      el('button.btn.ghost', { onclick: () => go('home') }, 'Back to dashboard'),
    );
    return null;
  }

  function draw() {
    const step = walkthrough.steps[state.index];
    const stepNumber = state.index + 1;

    mount(header,
      el('div.spread',
        el('div.row',
          el('span', { style: { fontSize: '1.6rem' } }, meta.icon),
          el('div',
            el('div', { style: { fontWeight: '650' } }, meta.name),
            el('div.faint', t('Step {n} of {total}', { n: stepNumber, total: totalSteps })),
          ),
        ),
        el('button.btn.sm.ghost', { onclick: () => go('learn', { module: meta.id }) }, 'Exit lesson'),
      ),
      el('div.bar', { style: { marginTop: '12px' } },
        el('span', { style: { width: `${(stepNumber / totalSteps) * 100}%` } })),
    );

    const check = step.check;
    const answered = state.chosen !== null;
    const chosenOption = answered ? check.options.find((o) => o.key === state.chosen) : null;
    const isCorrect = answered && state.chosen === check.answer;

    mount(body,
      state.index === 0 && walkthrough.intro
        ? el('div.notice', { style: { marginBottom: '18px' } }, walkthrough.intro)
        : null,

      el('h2', step.title),
      el('div.lesson-body', step.body.map((paragraph) => el('p', richText(paragraph)))),
      step.visual ? renderVisual(step.visual) : null,

      el('div', { style: { marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--border)' } },
        el('div.row', { style: { marginBottom: '10px' } },
          el('span.badge.gold', 'Check yourself'),
        ),
        el('div.question', richText(check.question)),
        el('div.options',
          check.options.map((option, i) => el(`button.option${
            !answered ? '' : option.key === check.answer ? '.correct' : option.key === state.chosen ? '.wrong' : ''
          }`, {
            disabled: answered,
            onclick: () => answer(option.key),
          },
            el('span.key', String(i + 1)),
            el('span', richText(option.label)),
          )),
        ),
        answered
          ? el(`div.feedback.${isCorrect ? 'correct' : 'wrong'}`,
              el('div.verdict', isCorrect ? '✓ That is right' : '✗ Not quite'),
              el('div', richText(chosenOption.why)),
              !isCorrect
                ? el('div', { style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' } },
                    el('strong', 'The answer: '),
                    richText(check.options.find((o) => o.key === check.answer).why),
                  )
                : null,
            )
          : null,
      ),
    );

    mount(footer,
      state.index > 0 ? el('button.btn.ghost', { onclick: back }, '← Previous') : null,
      answered
        ? el('button.btn.primary', { onclick: next },
            state.index >= totalSteps - 1 ? 'Finish lesson →' : 'Next step →')
        : el('span.faint', 'Answer the check to continue — press 1-4 or click.'),
    );
  }

  ctx.onKey = (e) => {
    const step = walkthrough.steps[state.index];
    const n = Number(e.key);
    if (state.chosen === null && n >= 1 && n <= step.check.options.length) {
      answer(step.check.options[n - 1].key);
    } else if (state.chosen !== null && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      next();
    }
  };

  draw();
  return root;
}
