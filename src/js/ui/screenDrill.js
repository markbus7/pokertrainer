/** Lessons, drills and the Gauntlet. */

import { el, mount, richText, toast, fmt } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { scenarioView } from './scenarioView.js';
import { copyButton } from './copySpot.js';
import { MODULE_META, moduleMeta } from '../data/curriculum.js';
import { generateQuestion, generateGauntlet, difficultyForLevel } from '../trainers/index.js';
import { checkAchievements } from '../state/achievements.js';
import {
  masteryTier, nextTierGoal, promotion, tierByKey, EVIDENCE_BAR, tierPlan, REQUIREMENTS,
} from '../state/mastery.js';
import { requirementRow } from './screenLevels.js';
import { review } from '../state/spacing.js';
import { WALKTHROUGHS } from '../data/walkthroughs.js';
import { boundarySheet, priceSheet, rangeGridFor } from './reference.js';
import { IDK, dontKnowButton } from './dontKnow.js';
import { CHARTS } from '../data/ranges.js';
import { handKey } from '../core/cards.js';
import * as audio from '../audio/engine.js';
import {
  silasSays, silasVerdict, lanterns, xpPop, stamp, says, voiceLine, pickLine, raceStrip, raceMargin, sceneBanner,
} from './place.js';
import { RACE, bossFor, MENTOR } from '../data/characters.js';
import { riverState } from './screenRiver.js';
import { ownsLesson, ownedModules, itemByKey, itemState, EARN } from '../state/economy.js';
import { buyControl, pearls, pearlPop } from './shop.js';
import { RANKS } from '../state/profile.js';

/** The lesson page for a module, with the drill entry point. */
/** What the guided lesson actually is, in one line, so the name is not a riddle. */
function walkthroughShape(moduleId) {
  const walkthrough = WALKTHROUGHS[moduleId];
  if (!walkthrough || !walkthrough.steps) return null;
  const steps = walkthrough.steps.length;
  const checks = walkthrough.steps.filter((step) => step.check).length;
  return el('div.faint', { style: { marginTop: '8px' } },
    checks
      ? t('{steps} short steps, {checks} of them ending in a question. One pass through is what counts as finished.',
        { steps, checks })
      : t('{steps} short steps. One pass through is what counts as finished.', { steps }));
}

/** True when every other requirement for the next tier is already met. */
function lessonIsTheBlocker(profile, moduleId) {
  const goal = nextTierGoal(profile, moduleId);
  return Boolean(goal && goal.missing.length === 1 && /lesson/i.test(goal.missing[0]));
}


/**
 * The whole climb for one module: where you are, what each rung asks, and
 * what would get you to the next one.
 *
 * The reader's words: "I do not know how much of what I have to do to get to
 * Solid or Mastered." They were right that it was not stated anywhere. A tile
 * named the next bar in six words and the module page named none of it, so
 * the shape of the thing — three rungs, and which one you are standing on —
 * only existed in the source.
 */
function masteryLadder(profile, moduleId, go) {
  const plan = tierPlan(profile, moduleId);
  const here = masteryTier(profile, moduleId);

  return el('div.panel.page.paper.seals',
    el('div.panel-title', el('h2', t('Your way to Mastered'))),
    el('div.faint', { style: { marginBottom: '14px' } },
      t('Only your most recent answers count, so a rough start does not follow you around. '
        + 'Every rung is reachable from wherever you are standing.')),

    plan.map((rung) => {
      const state = rung.state;
      const tone = state === 'done' ? 'green' : state === 'here' ? 'gold' : '';
      return el(`div.rung${state === 'here' ? '.rung-here' : ''}`,
        el('div.spread', { style: { alignItems: 'center' } },
          el('div.row',
            el('span', { style: { fontSize: 'var(--t-lg)', opacity: state === 'ahead' ? '0.5' : '1' } }, rung.icon),
            el('div',
              el('div', { style: { fontWeight: '600' } }, t(rung.name)),
              el('div.faint', { style: { fontSize: 'var(--t-xs)' } }, t(rung.blurb)),
            ),
          ),
          el(`span.badge${tone ? `.${tone}` : ''}`,
            state === 'done' ? t('✓ Passed') : state === 'here' ? t('You are here') : t('Ahead')),
        ),

        rung.rows.length
          ? el('div', { style: { marginTop: '10px' } }, rung.rows.map((row) => requirementRow(row)))
          : el('div.faint', { style: { marginTop: '8px', fontSize: 'var(--t-sm)' } },
            t('Nothing to earn — this is where you stand from your first answer.')),

        // The number the reader asked for, and the one a window makes
        // possible to state at all.
        rung.rows.length && !rung.rows.every((row) => row.met)
          ? el('div', { style: { marginTop: '10px' } },
            rung.rows.some((row) => row.met === false && row.need > 1)
              ? el('div.notice.sm',
                rung.run === 0
                  ? t('The answers are already there — only the lesson is left.')
                  : rung.run === 1
                    ? t('One more right answer gets you to {tier}.', { tier: t(rung.name) })
                    : t('{n} right answers in a row would get you to {tier}.',
                      { n: rung.run, tier: t(rung.name) }))
              : null,
            rung.rows.some((row) => !row.met && row.need === 1)
              ? el('button.btn.sm.block', {
                style: { marginTop: '8px' },
                onclick: () => go('walkthrough', { module: moduleId }),
              }, t('Start the guided lesson'))
              : null)
          : null,
      );
    }),

    here === 'mastered'
      ? el('div.notice', { style: { marginTop: '12px' } },
        t('Mastered, on your last {n} answers. It reads your current form, so it is kept by playing, not by '
          + 'having played.', { n: REQUIREMENTS.mastered.window }))
      : null,
  );
}

/** Where a module sits in the course: its chapter number. */
const chapterOf = (id) => MODULE_META.findIndex((m) => m.id === id) + 1;

/** A module's medallion, as the course draws it. */
function medallion(meta) {
  return el('span.medallion', { 'aria-hidden': 'true' },
    el('span.medallion-face', icon(meta.icon, { size: 26 })),
    el('span.medallion-num', String(chapterOf(meta.id))),
  );
}

/**
 * A chapter that is still on the shelf: its title page, what it costs, and
 * either the button that buys it or what stands in the way. Every route into
 * a chapter lands here until it is bought — the lesson, the drill and the
 * guided lesson alike — so there is one place that explains the price.
 */
export function lockedChapter(ctx, meta) {
  const { profile, go } = ctx;
  const item = itemByKey(`lesson:${meta.id}`);
  const state = itemState(profile, item);
  const rankGate = state.missing.find((m) => m.key === 'level');
  const line = rankGate
    ? t(MENTOR.shelfRank, { rank: t(RANKS[meta.unlockLevel - 1].name) })
    : state.affordable ? t(MENTOR.shelfReady) : t(MENTOR.shelf);
  return el('div.screen.chapter.on-shelf',
    el('div.panel.page.paper.chapter-head',
      el('div.chapter-title-row',
        el('span.medallion.shelved', { 'aria-hidden': 'true' },
          el('span.medallion-face', icon('lock', { size: 24 })),
          el('span.medallion-num', String(chapterOf(meta.id))),
        ),
        el('div',
          el('div.chapter-kicker', t('Chapter {n}', { n: chapterOf(meta.id) })),
          el('h1.sign', meta.name),
          el('div.tagline', meta.tagline),
        ),
      ),
      el('div.shelf-buy',
        buyControl(profile, item.key, { go, onBought: () => go('learn', { module: meta.id }) }),
      ),
    ),
    el('div.panel.mentor-card', silasSays(line, { typed: false })),
    el('div.row',
      el('button.btn.primary', { onclick: () => go('store') }, icon('pearl', { size: 16 }), ' ', t('The Trading Post')),
      el('button.btn.ghost', { onclick: () => go('play') }, t('Play for pearls')),
      el('button.btn.ghost', { onclick: () => go('train') }, 'Back to the school'),
    ),
  );
}

export function renderLearn(ctx, params) {
  const meta = moduleMeta(params.module);
  if (!meta) return el('div.empty', 'Unknown module.');
  if (!ownsLesson(ctx.profile, meta.id)) return lockedChapter(ctx, meta);
  const { profile, go } = ctx;
  const stats = profile.drillStats(meta.id);
  const acc = profile.accuracy(meta.id);
  const done = profile.hasCompletedWalkthrough(meta.id);

  return el('div.screen.chapter',
    /* ---- the chapter's title page ---- */
    el('div.panel.page.paper.chapter-head',
      el('div.chapter-title-row',
        medallion(meta),
        el('div',
          el('div.chapter-kicker', t('Chapter {n}', { n: chapterOf(meta.id) })),
          el('h1.sign', meta.name),
          el('div.tagline', meta.tagline),
        ),
        done ? stamp(t('✓ Lesson done'), 'good') : null,
      ),
      el('div.chapter-actions',
        // The requirement calls this "the guided lesson", so the button
        // that is it says the same words. It used to say "Teach me this"
        // while the page above it already showed a summary and key points
        // — so a reader who had read the page, and was then told to finish
        // a guided lesson, had no way to tell which of those was meant.
        el('button.btn.primary.lg.plank', { onclick: () => go('walkthrough', { module: meta.id }) },
          done ? 'Do the guided lesson again' : 'Start the guided lesson'),
        el('button.btn.lg.ghost', { onclick: () => go('drill', { module: meta.id }) }, 'Skip to drills'),
      ),
      walkthroughShape(meta.id),
      // When the lesson is the only thing left, say so beside the button
      // that does it. Otherwise the two buttons look equally optional and
      // the reader drills a module that is already past both numbers.
      lessonIsTheBlocker(profile, meta.id)
        ? el('div.notice', { style: { marginTop: '12px' } },
          t('One pass through the guided lesson is the only thing left before {tier}. '
            + 'More drilling cannot move it: the answers are already there.',
          { tier: t(tierByKey('mastered').name) }))
        : null,
      stats.attempts
        ? el('div.row', { style: { marginTop: '14px' } },
            el('span.badge', t('{n} attempts', { n: stats.attempts })),
            el('span.badge', t('{n} correct', { n: stats.correct })),
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

    /* ---- why it matters, in Silas's words, and what to carry away ---- */
    el('div.panel.mentor-card', silasSays(t(meta.lesson.summary), { typed: false })),
    el('div.panel.page.paper',
      el('h3', 'The key points'),
      el('ul.lesson-points', meta.lesson.points.map((point) => el('li', el('span', point)))),
    ),
    masteryLadder(profile, meta.id, go),
    el('div.row',
      el('button.btn.primary', { onclick: () => go('walkthrough', { module: meta.id }) },
        done ? 'Do the guided lesson again' : 'Start the guided lesson'),
      el('button.btn.ghost', { onclick: () => go('drill', { module: meta.id }) },
        t('Drill {module}', { module: t(meta.name) })),
      el('button.btn.ghost', { onclick: () => go('train') }, 'Back to the school'),
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
  if (!gauntlet && !ownsLesson(ctx.profile, meta.id)) return lockedChapter(ctx, meta);

  const { profile, rng, go } = ctx;
  const difficulty = difficultyForLevel(profile.level);
  // The race asks about the chapters you own: a question from a chapter
  // still on the shelf would be a test of something nobody has taught you.
  const queue = gauntlet ? generateGauntlet(rng, profile.level, 10, ownedModules(profile).map((m) => m.id)) : [];

  // A session used to run forever, so there was no moment of having finished
  // and no target to aim at. It is now a fixed length with a stated pass mark,
  // and endless practice is an explicit choice afterwards rather than the
  // only mode available.
  const endless = params.endless === '1';
  const SESSION_LENGTH = 10;
  const PASS_MARK = 8;
  // The Gauntlet is run as a race against the Belle, in whatever boat you
  // have worked your way up to. Her pace is the pass mark.
  const raceBoat = gauntlet ? riverState(profile).boat.key : null;
  const tally = () => (gauntlet
    ? raceStrip(state.results, sessionLength, PASS_MARK, { boat: raceBoat, rival: RACE.boat })
    : lanterns(state.results, sessionLength));
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
    // Right or wrong, per question, for the lanterns along the top.
    results: [],
    verdictLine: null,
  };

  const sessionLength = gauntlet ? queue.length : SESSION_LENGTH;
  const bounded = gauntlet || !endless;
  const sessionOver = () => bounded && state.answered >= sessionLength;

  const header = el('div.panel.book-bar');
  const body = el('div.panel.page.paper.test-page');
  const footer = el('div.row');
  const root = el('div.screen.test', header, body, footer);

  const nextQuestion = () => {
    if (sessionOver()) return finish();
    if (gauntlet && state.index >= queue.length) return finish();
    state.question = gauntlet ? queue[state.index] : generateQuestion(meta.id, rng, difficulty);
    state.locked = false;
    state.typed = null;
    state.peeked = false;
    state.reviewing = false;
    state.index++;
    draw();
    return null;
  };

  const finish = () => {
    const pct = state.answered ? state.correct / state.answered : 0;
    const passed = state.correct >= PASS_MARK;
    if (gauntlet) {
      checkAchievements(profile, { type: 'gauntlet', correct: state.correct, total: state.answered })
        .forEach((a) => toast({ icon: a.icon, title: a.name, desc: a.description }));
    }

    const tierAfter = gauntlet ? null : masteryTier(profile, meta.id);
    const promoted = tierBefore ? promotion(tierBefore, tierAfter) : null;
    if (promoted) {
      audio.sfx('bell');
      toast({
        icon: '🎓',
        title: `${t(meta.name)}: ${t(promoted.name)}`,
        desc: t(promoted.blurb),
        duration: 7000,
      });
    }
    const goal = gauntlet ? null : nextTierGoal(profile, meta.id);

    // Three stars for a clean sheet, two for a pass, one for most of it.
    const stars = state.answered && state.correct === state.answered ? 3
      : passed ? 2 : pct >= 0.6 ? 1 : 0;
    if (passed) audio.sfx('fanfare');
    // Beating the Belle pays — the one place away from a card table that
    // does, because it is the one place nobody tells you which skill is next.
    const prize = gauntlet && passed ? profile.earnPearls(EARN.raceWon) : 0;
    if (prize) pearlPop(prize);

    mount(header,
      el('div.row',
        el('div',
          el('h1', { style: { margin: 0 } }, gauntlet
            ? (passed ? t('You beat the Belle') : t('The Belle got there first'))
            : passed ? 'Session passed' : 'Session complete'),
          el('div.muted', t('{correct} of {answered} correct — {pct}',
            { correct: state.correct, answered: state.answered, pct: fmt.pct(pct) })
            + (bounded ? t(' · pass mark was {pass}', { pass: PASS_MARK }) : '')
            + (gauntlet ? ` · ${raceMargin(state.correct, PASS_MARK)}` : '')),
        ),
      ),
      bounded ? tally() : null,
    );

    mount(body,
      el('div.result-head',
        el('div.stars.big', { 'aria-label': t('{n} of 3 stars', { n: stars }) },
          [0, 1, 2].map((k) => el(`span.star${k < stars ? '.lit' : ''}`, '★'))),
        stamp(gauntlet ? (passed ? t('Won') : t('Beaten')) : passed ? t('Passed') : t('Keep at it'), passed ? 'good' : 'soft'),
      ),
      gauntlet
        ? says(RACE.rival, t(passed ? RACE.won : RACE.lost), { name: t(bossFor(RACE.rival).name), typed: false, size: 60 })
        : null,
      prize
        ? el('div.race-prize', pearls(prize, { className: 'big' }), el('span', t('in pearls for beating the Belle')))
        : null,
      silasSays(t(verdictText(pct, gauntlet)), { typed: false, size: 60 }),
      el('div.grid.cols-3',
        el('div.stat', el('div.label', 'Score'), el('div.value', `${state.correct}/${state.answered}`)),
        el('div.stat', el('div.label', 'Accuracy'), el(`div.value.${pct >= 0.8 ? 'good' : pct < 0.5 ? 'bad' : ''}`, fmt.pct(pct))),
        el('div.stat', el('div.label', 'XP earned'), el('div.value', `+${state.xpEarned}`)),
      ),

      promoted
        ? el('div.panel', { style: { marginTop: '16px', borderColor: 'var(--green)', background: 'rgba(62,207,142,0.08)' } },
            el('div.row',
              el('span', { style: { fontSize: 'var(--t-xl)' } }, promoted.icon),
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

    );

    mount(footer,
      el('button.btn.primary', { onclick: () => go(gauntlet ? 'gauntlet' : 'drill', { module: params.module }) },
        gauntlet ? t('Race again') : 'Another session'),
      !gauntlet
        ? el('button.btn.ghost', { onclick: () => go('drill', { module: params.module, endless: '1' }) }, 'Endless practice')
        : null,
      gauntlet
        ? el('button.btn.ghost', { onclick: () => go('home') }, 'Back to the river')
        : el('button.btn.ghost', { onclick: () => go('train') }, 'Back to the school'),
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
    audio.sfx(wasCorrect ? 'right' : 'wrong');
    state.results.push(wasCorrect);
    // Silas's word on it, chosen once so a redraw does not change his mind.
    // In the race it is Rourke calling across the water instead.
    state.verdictLine = key === IDK ? null
      : gauntlet ? pickLine(wasCorrect ? RACE.gaining : RACE.falling)
        : silasVerdict(wasCorrect);

    if (wasCorrect) {
      state.correct++;
      state.streak++;
      const bonus = Math.min(state.streak, 10) * 2;
      const gained = q.xp + bonus;
      state.xpEarned += gained;
      const before = profile.level;
      profile.addXp(gained);
      xpPop(gained);
      if (profile.level > before) {
        audio.sfx('fanfare');
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
          el('span.module-glyph', icon(q.icon, { size: 20 })),
          el('div',
            el('div.book-title', gauntlet ? t('The Race') : t(q.moduleName)),
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
      bounded ? tally() : null,
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
    const sheet = cheatSheet(q, { answered: chosen !== null });

    mount(body,
      scenarioView(q.scenario, ctx.profile.settings),
      el('div.question', { style: { marginTop: q.scenario ? '16px' : '0' } }, richText(q.question)),
      entryBox || options,
      chosen === null ? dontKnowButton(() => answer(IDK)) : null,
      chosen === null ? null : el(`div.feedback.${
        chosen === IDK ? 'skip' : chosen === q.answer ? 'correct' : 'wrong'
      }`,
        state.verdictLine ? voiceLine(gauntlet ? RACE.rival : 'silas', state.verdictLine) : null,
        el('div.verdict', chosen === IDK
          ? t("You said you didn't know — here it is.")
          : chosen === q.answer
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
        given: chosen === IDK
          ? t("I don't know")
          : state.typed != null
            ? withUnit(state.typed, q.entry)
            : (q.options.find((o) => o.key === chosen) || {}).label,
        correct: (q.options.find((o) => o.key === q.answer) || {}).label,
        explanation: q.explanation,
      })),
      // Somewhere to look, on both sides of the answer. Left open if it was
      // already open: having to reopen the same chart you were just reading
      // is the kind of small friction that stops people checking at all.
      sheet
        ? (state.peeked || state.reviewing
          ? el('div.sheet-slip.paper', sheet.node)
          : el('button.btn.sm.ghost.block', {
            style: { marginTop: '14px' },
            onclick: () => {
              if (chosen === null) state.peeked = true; else state.reviewing = true;
              // draw() takes the answer as an argument and defaults it to
              // null, so redrawing without passing it back forgets that the
              // question was answered — and the chart came up with nothing
              // ringed on it, which is the one thing it was reopened for.
              draw(chosen);
            },
          }, t(sheet.label)))
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
// Modules whose questions are a price. What they need is not a chart but
// the routine for getting to the number without long division.
const PRICE_MODULES = new Set(['pot-odds', 'outs']);

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
/**
 * Somewhere to look — before you answer, and after.
 *
 * It used to vanish the moment you answered, on the reasoning that "the right
 * answer is already on screen and a chart adds nothing". That is wrong, and
 * the range trainer had already been built on the opposite principle without
 * this being brought into line. Knowing the answer was Fold tells you about
 * one hand. Seeing WHERE that hand sits — a rank outside the boundary, or the
 * suited twin of something that plays — is the shape, and the shape is the
 * part that transfers to the next hand you are dealt.
 *
 * So the difference between before and after is not whether you may look. It
 * is whether your hand is ringed on it: finding it yourself is the work, and
 * ringing it beforehand would hand over an opening question outright.
 */
function cheatSheet(question, { answered = false } = {}) {
  if (PRICE_MODULES.has(question.module)) {
    // The price is as worth checking afterwards as it was beforehand — this
    // is where you find out whether you divided when you should have counted.
    return { node: priceSheet(), label: answered ? 'Check it against the method' : 'Show me the method' };
  }
  // Only the two modules these charts actually answer. Defence frequency is
  // a formula from the numbers in its own question; offering a preflop grid
  // beside it is noise pretending to be help.
  if (!CHART_MODULES.has(question.module)) return null;

  const scenario = question.scenario || {};
  const label = answered ? 'Check it against the chart' : 'Show me the chart';

  // A question with a seat gets that seat's chart. This used to read "somebody
  // raised, therefore big-blind defence", which showed BB defence to a reader
  // sitting in the small blind facing a button open — a three-bet spot. The
  // three-betting charts were reachable from nowhere as a result.
  // Which seat the reader is in — stated by the question or not at all.
  // Inferring it from `position` was wrong twice over: on the boundary
  // questions `position` is whoever opened, and on the domination question it
  // is the raiser even though hole cards are dealt. A question that does not
  // say where you are sitting gets the five-column comparison instead.
  // `heroSeat`, not `hero`: spotFelt already reads `scenario.hero` and means
  // the hero's CARDS by it, so naming a seat that passed a string to a
  // function expecting a card array and blanked the felt on every question.
  const heroSeat = scenario.heroSeat || null;
  if (heroSeat && (CHARTS.rfi[heroSeat] || heroSeat === 'BB')) {
    const node = rangeGridFor({
      seat: heroSeat,
      raiser: scenario.raiser || null,
      hand: answered && scenario.hole ? handKey(scenario.hole) : null,
    });
    node.appendChild(el('div.faint', t('This one does not count toward your score.')));
    return { node, label };
  }

  // An all-in equity question has no chart behind it at all. Offering the
  // preflop grid there is noise pretending to be help, which is the same
  // reason defence frequency is kept off this list.
  if (scenario.compare) return null;

  // No seat in the question means the question is about comparing seats, and
  // five columns say that better than one grid does.
  const node = boundarySheet({ defending: Boolean(scenario.raiser), highlight: scenario.raiser });
  if (!node) return null;
  node.appendChild(el('div.faint', t('This one does not count toward your score.')));
  return { node, label };
}


function verdictText(pct, gauntlet) {
  if (pct >= 0.95) return gauntlet ? 'Flawless. That is the standard you want before moving up in stakes.' : 'Nearly perfect. Raise the difficulty by moving on to the next module.';
  if (pct >= 0.8) return 'Strong. A few more sessions at this level and it will be automatic.';
  if (pct >= 0.6) return 'Getting there. Re-read the lesson points you missed — the explanation under each wrong answer is the important part.';
  return 'This one needs work. Go back to the lesson and drill again; nobody gets this on the first pass.';
}

/** The start of the race: the Belle at the pole, Rourke, and what counts. */
export function renderGauntletIntro(ctx) {
  const { profile, go } = ctx;
  const unlocked = ownedModules(profile);
  const rival = bossFor(RACE.rival);
  return el('div.screen.race-start',
    sceneBanner({
      id: 'race', landmark: 'race', kicker: t('At the starting pole'), title: t('The Race'),
      boat: riverState(profile).boat.key,
    }),
    el('div.panel.mentor-card',
      says(RACE.rival, t(RACE.hello), { name: t(rival.name) }),
    ),
    el('div.panel.page.paper.race-card',
      el('div.page-kicker', t('The Gauntlet')),
      el('h2', t('Ten reaches, any water')),
      el('p.muted', 'Ten questions drawn at random from every module you have unlocked. You will not know which skill is coming, which is exactly the point — at the table, nobody tells you that this is a pot-odds spot.'),
      el('div.race-rules',
        el('div.race-rule', el('span.race-rule-n', '1'), el('span', t('A right answer moves your boat one reach.'))),
        el('div.race-rule', el('span.race-rule-n', '2'), el('span', t('The Belle keeps a steady pace: seven and a half reaches in ten.'))),
        el('div.race-rule', el('span.race-rule-n', '8'), el('span', t('Eight right and you are first to the landing.'))),
      ),
      el('div.page-kicker', t('The water you might meet')),
      el('div.row', { style: { marginBottom: '16px' } },
        unlocked.map((m) => el('span.badge', icon(m.icon, { size: 13 }), ' ', t(m.name))),
      ),
      el('button.btn.primary.lg.plank', { onclick: () => go('drill', { mode: 'gauntlet' }) }, t('Fire the boilers')),
    ),
  );
}
