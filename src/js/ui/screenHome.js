/**
 * Silas's card school, and School Creek below it: where the lessons live.
 *
 * It was a dashboard — a rank panel, a stack of cards and a grid of tiles —
 * and it looked like one after the rest of the app became a river. Then it
 * was a place with a list in it, behind a tab. Now it is part of the map:
 * the creek the school stands over, drawn from the spring by the schoolhouse
 * down to the Long River, with the twelve chapters as stops along the water
 * whose medallions fill with stars as each moves from learning to solid to
 * mastered. Silas says which chapter is next and why, and the way out is
 * down the creek to the river.
 *
 * Everything it knew stays: why this chapter, what is still missing on each,
 * the reviews that have come due, the hands worth another look. Only where
 * it is said changed.
 */

import { el, fmt } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { MODULE_META, nextUp } from '../data/curriculum.js';
import { dueConcepts, nextReviewLabel, hasStudied } from '../state/spacing.js';
import { masteryTier, nextTierGoal, tierByKey, scoreLine, EVIDENCE_BAR } from '../state/mastery.js';
import { RANKS, requirementRows } from '../state/profile.js';
import { ACHIEVEMENTS } from '../state/achievements.js';
import { handSummary } from '../state/handHistory.js';
import { MENTOR } from '../data/characters.js';
import { silasSays } from './place.js';
import { ownsLesson, ownedModules, nextPurchase, LESSON_PRICES } from '../state/economy.js';
import { buyControl, pearls } from './shop.js';
import { creekBend, bankScene, creekHead, creekMouth, regionBar } from './creekMap.js';
import { boatLook } from '../state/economy.js';

/**
 * What is actually still missing for the next rank. Reports the requirement
 * furthest from being met rather than assuming it is XP, which stopped being
 * true once ranks started asking for lessons and drilled skills too.
 */
function nextRankHint(profile, next) {
  const rows = requirementRows(profile, next);
  const behind = rows.filter((r) => !r.met);
  if (!behind.length) return t('Ready for {rank} — the requirements are met.', { rank: t(next.name) });
  const worst = behind.reduce((a, b) => ((a.have / a.need) <= (b.have / b.need) ? a : b));
  const remaining = worst.need - worst.have;
  return worst.key === 'xp'
    ? t('{n} XP to {rank}', { n: fmt.chips(remaining), rank: t(next.name) })
    : t('{n} more to {rank}: {what}', { n: remaining, rank: t(next.name), what: t(worst.label).toLowerCase() });
}

export function renderHome(ctx) {
  const { profile, go } = ctx;
  const plan = nextUp(profile);
  const recommended = plan.module;

  return el('div.screen.school.region',
    regionBar({ go, name: t('School Creek') }),

    /* ---- Silas, and the one chapter most worth studying now ---- */
    el('div.panel.mentor-card',
      silasSays(t(MENTOR.next[plan.reason] || MENTOR.next.weakest, { module: t(recommended.name) })),
      el('div.mentor-plan',
        // Naming a module without saying why leaves the reader to guess.
        el('div.faint', whyThisOne(plan)),
        el('div.mentor-actions',
          el('button.btn.primary.lg.plank', { onclick: () => go('learn', { module: recommended.id }) },
            t('Study {module}', { module: t(recommended.name) })),
          el('span.faint', describeProgress(profile, recommended.id)),
        ),
      ),
      shelfLine(profile, go),
    ),

    el('div.school-floor',
      /* ---- the course: the creek, from the school to the river ---- */
      el('section.course.creek-map',
        creekHead({
          kicker: t('School Creek'),
          title: t('Silas\'s Card School'),
          landmark: 'school',
          extra: el('div.course-head',
            el('h2.sign', t('The course')),
            el('span.faint', t('{n} of {total} yours', {
              n: ownedModules(profile).length,
              total: MODULE_META.length,
            })),
            el('span.course-purse', pearls(profile.pearls)),
          ),
        }),
        el('ol.creek-trail',
          MODULE_META.map((meta, i) => chapter(meta, i, profile, go, recommended.id)),
        ),
        creekMouth({ go, look: boatLook(profile) }),
      ),

      /* ---- what you carry: your papers, your record, Silas's notes ---- */
      el('aside.school-rail',
        certificate(profile),
        duePanel(profile, go),
        mistakesPanel(go),
        record(profile),
      ),
    ),
  );
}

/**
 * Your papers: the rank, written up like a certificate with the seal of the
 * level you hold, and what the next one still asks for.
 */
function certificate(profile) {
  const rank = profile.rank;
  const next = profile.nextRank;
  return el('div.certificate.paper',
    el('div.cert-kicker', t('Certificate of standing')),
    el('div.cert-body',
      el('span.seal', { 'aria-hidden': 'true' }, rank.emoji),
      el('div',
        el('div.cert-rank', t(rank.name)),
        el('div.faint', t('Level {level} of {total}', { level: rank.level, total: RANKS.length })),
      ),
      el('div.cert-xp',
        el('div.mono', fmt.chips(profile.xp)),
        el('div.faint', 'total XP'),
      ),
    ),
    el('p.cert-blurb', t(rank.blurb)),
    el('div.bar', el('span', { style: { width: `${Math.round(profile.progress * 100)}%` } })),
    el('div.spread.cert-foot',
      // Not "XP to next rank": ranks ask for lessons and drilled skills too,
      // so this names the requirement that is actually furthest behind.
      el('div.faint', next ? nextRankHint(profile, next) : t('Maximum rank reached — you have mastered the curriculum.')),
      el('div.faint', next ? `${fmt.chips(profile.xp)} / ${fmt.chips(next.xp)}` : ''),
    ),
  );
}

/** The record: the four numbers, written into the ledger rather than struck. */
function record(profile) {
  const totals = Object.values(profile.data.drills).reduce(
    (acc, d) => ({ attempts: acc.attempts + d.attempts, correct: acc.correct + d.correct }),
    { attempts: 0, correct: 0 },
  );
  // The same bar the chapters use. Without it the headline number reported
  // 100% off a single answer, while the chapter right beside it correctly
  // refused to show anything.
  const accuracy = totals.attempts >= EVIDENCE_BAR ? totals.correct / totals.attempts : null;
  return el('div.record',
    statTile('Hands played', fmt.chips(profile.data.handsPlayed)),
    statTile('Drill accuracy',
      accuracy === null ? '—' : fmt.pct(accuracy),
      accuracy === null
        ? t('{n} more before this is a score', { n: EVIDENCE_BAR - totals.attempts })
        : t('{correct} of {attempts}', { correct: totals.correct, attempts: totals.attempts })),
    statTile('Achievements', `${profile.data.achievements.length} / ${ACHIEVEMENTS.length}`),
    statTile('Lifetime', fmt.bb(profile.data.lifetimeProfitBb), 'across all sessions'),
  );
}

/**
 * Reviews that have come due. Spacing only works if something surfaces the
 * concept at the right moment — a schedule nobody is shown is just a record.
 */
function duePanel(profile, go) {
  const unlocked = ownedModules(profile);
  const started = unlocked.filter((m) => hasStudied(profile, m.id));
  if (!started.length) return null;

  const due = dueConcepts(profile, started.map((m) => m.id));
  if (!due.length) {
    const soonest = started
      .map((m) => ({ m, label: nextReviewLabel(profile, m.id) }))
      .filter((x) => x.label !== 'not started')
      .sort((a, b) => a.label.localeCompare(b.label))[0];
    return el('div.panel.note-card.paper',
      el('div.spread',
        el('div',
          el('h3', { style: { margin: 0 } }, icon('check', { size: 18 }), t('Nothing due for review')),
          el('div.faint', soonest
            ? t('Everything you have studied is still fresh. {module} is {when}.',
              { module: t(soonest.m.name), when: t(soonest.label) })
            : 'Everything you have studied is still fresh.'),
        ),
        el('button.btn.sm.ghost', { onclick: () => go('lab') }, 'Practise anyway'),
      ),
    );
  }

  const metaFor = (id) => MODULE_META.find((m) => m.id === id);
  return el('div.panel.note-card.paper.pinned',
    el('div.spread',
      el('div',
        el('h3', { style: { margin: 0 } }, icon('clock', { size: 18 }), t('{n} ready for review', { n: due.length })),
        el('div.faint', 'These are due now — practising a concept just as it starts to fade is what makes it stick.'),
      ),
      el('button.btn.sm.primary', { onclick: () => go('lab') }, 'Review now'),
    ),
    el('div.row', { style: { marginTop: '12px' } },
      due.slice(0, 6).map((id) => {
        const meta = metaFor(id);
        return meta ? el('span.badge.gold', icon(meta.icon, { size: 14 }), ' ', t(meta.name)) : null;
      }),
    ),
  );
}

/**
 * The hands waiting to be looked at. Only shown when there are some: an empty
 * "0 mistakes" panel on the dashboard every day would train you to ignore the
 * place where the mistakes appear.
 */
function mistakesPanel(go) {
  const summary = handSummary();
  if (!summary.total) return null;
  const parts = [];
  if (summary.mistakes) parts.push(t('{n} with a mistake in', { n: summary.mistakes }));
  if (summary.coolers) parts.push(t('{n} you lost through no fault of yours', { n: summary.coolers }));

  return el('div.panel.note-card.paper.pinned.urgent',
    el('div.spread',
      el('div',
        el('h3', { style: { margin: 0 } }, icon('review', { size: 18 }), t('{n} hands worth another look', { n: summary.total })),
        el('div.faint', `${parts.join(', ')}. ${t('Play them back and see where they turned.')}`),
      ),
      el('button.btn.sm.primary', { onclick: () => go('review') }, 'Review hands'),
    ),
    summary.mistakes
      ? el('div.faint', { style: { marginTop: '10px' } },
          t('Those mistakes have cost you {amount} big blinds so far.', { amount: summary.costBb.toFixed(1) }))
      : null,
  );
}

function describeProgress(profile, moduleId) {
  const stats = profile.drillStats(moduleId);
  if (!stats.attempts) return t('Not started yet.');
  // Thin evidence is checked before anything else. Six right out of six is
  // 100%, and calling that "nearly mastered" is the same mistake as calling
  // one wrong answer a catastrophe.
  if (stats.attempts < EVIDENCE_BAR) {
    return t('Only {n} answered — {short} more before there is a score to read.',
      { n: stats.attempts, short: EVIDENCE_BAR - stats.attempts });
  }
  const acc = profile.accuracy(moduleId);
  const pct = fmt.pct(acc);
  if (acc >= 0.9) return t('{pct} right — nearly mastered.', { pct });
  if (acc >= 0.7) return t('{pct} right — solid, but there is room.', { pct });
  return t('{pct} right — this is your weakest skill right now.', { pct });
}

/**
 * The sentence that was missing: not just which module, but on what grounds.
 * Every branch here matches a branch of nextUp(), so the two can never drift
 * into saying different things.
 */
function whyThisOne(plan) {
  const { reason, stats } = plan;
  if (reason === 'untouched') return t('You have not tried this one yet, so it is the fastest thing to learn.');
  if (reason === 'thin') {
    return t('Only {n} questions so far — a few more and the game can tell how you are really doing.',
      { n: stats.attempts });
  }
  if (reason === 'lesson') {
    return t('Under half right, and you have not read the lesson yet. Read it first — another ten '
      + 'questions is the slow way to find out what the page tells you in two minutes.');
  }
  if (reason === 'fresh') return t('Everything is mastered, so this is simply the one that is coldest.');
  return t('Lowest accuracy of everything you have unlocked, weighted so that a module you have '
    + 'barely tried cannot jump the queue.');
}

function statTile(label, value, sub = '') {
  return el('div.stat',
    el('div.label', label),
    el('div.value', value),
    sub ? el('div.sub', sub) : null,
  );
}

/**
 * The next chapter on the shelf, under Silas's recommendation: what it costs,
 * how far the purse is from it, and the button when it is not far at all.
 * Absent when the rank allows nothing new — the certificate beside it already
 * says what the next rank asks for.
 */
function shelfLine(profile, go) {
  const next = nextPurchase(profile);
  if (!next) return null;
  const meta = MODULE_META.find((m) => m.id === next.item.module);
  return el('div.shelf-line',
    el('span.shelf-what',
      icon('store', { size: 16 }),
      el('span', t('Next on the shelf: {module}', { module: t(meta.name) })),
    ),
    buyControl(profile, next.item.key, { go, onBought: () => go('learn', { module: meta.id }) }),
  );
}

/** Stars for a tier: none to start, one learning, two solid, three mastered. */
const STARS = { untouched: 0, learning: 1, solid: 2, mastered: 3 };

function chapter(meta, index, profile, go, recommendedId) {
  const rankLocked = meta.unlockLevel > profile.level && !ownsLesson(profile, meta.id);
  // On the shelf: the rank allows it and it has not been bought. It opens,
  // onto its price, rather than sitting shut like a chapter the rank does
  // not reach yet.
  const shelved = !rankLocked && !ownsLesson(profile, meta.id);
  const locked = rankLocked || shelved;
  // Silas names one chapter; without a marker on the trail the reader has
  // to match a name against twelve, several of which read "Learning".
  const isNext = !locked && meta.id === recommendedId;
  const stats = profile.drillStats(meta.id);
  const tier = locked ? 'untouched' : masteryTier(profile, meta.id);
  const tierInfo = tierByKey(tier);
  const goal = locked ? null : nextTierGoal(profile, meta.id);
  const stars = STARS[tier] || 0;

  // The chapters alternate banks down the creek, so the water runs between
  // them; the far bank of each has its own scenery.
  const bank = index % 2 === 0 ? 'left' : 'right';
  return el(`li.trail-stop.creek-row.card-${bank}${locked ? '.locked' : ''}${shelved ? '.shelved' : ''}${isNext ? '.is-next' : ''}.tier-${tier}`,
    creekBend(index),
    bankScene(index, MODULE_META.length),
    el(`button.module-tile${locked ? '.locked' : ''}${isNext ? '.next-up' : ''}`, {
      disabled: rankLocked,
      onclick: () => !rankLocked && go('learn', { module: meta.id }),
    },
      el('span.medallion', { 'aria-hidden': 'true' },
        el('span.medallion-face', rankLocked ? icon('lock', { size: 22 }) : shelved ? icon('store', { size: 22 }) : icon(meta.icon, { size: 24 })),
        el('span.medallion-num', String(index + 1)),
      ),
      el('span.chapter-card.paper',
        el('span.chapter-top',
          el('span.chapter-kicker', t('Chapter {n}', { n: index + 1 })),
          el('span.stars', { 'aria-label': t(tierInfo.name) },
            [0, 1, 2].map((k) => el(`span.star${k < stars ? '.lit' : ''}`, '★'))),
        ),
        el('span.name', meta.name),
        el('span.tagline', meta.tagline),
        el('span.chapter-badges',
          isNext ? el('span.badge.next-badge', t('DO THIS NEXT')) : null,
          shelved ? el('span.badge.price-badge', pearls(LESSON_PRICES[meta.id])) : null,
          rankLocked
            ? el('span.badge', t('Level {level}', { level: meta.unlockLevel }))
            : shelved ? null
            : tier !== 'untouched'
              ? el(`span.badge${tierInfo.tone ? `.${tierInfo.tone}` : ''}`, tierInfo.icon, ' ', t(tierInfo.name))
              : null,
        ),
        el('span.mastery', rankLocked
          ? t('Unlocks at {rank}', { rank: t(RANKS[meta.unlockLevel - 1].name) })
          : shelved
            ? t('On the shelf at the Trading Post')
            : scoreLine(profile, meta.id)),
        // What is still missing, not what the target is. A tile that reads
        // "90%" next to "Solid at 15 questions at 75%" looks like a hand
        // already met: the count is the half that is short.
        !locked && goal
          ? el('span.mastery.goal',
              t('{tier}: {missing}', {
                tier: t(goal.name),
                missing: goal.missing.map((m) => t(m)).join(t(' and ')),
              }))
          : null,
        !locked && stats.attempts
          ? el('span.bar', el('span', { style: { width: `${Math.round((goal ? goal.progress : 1) * 100)}%` } }))
          : null,
      ),
    ),
  );
}
