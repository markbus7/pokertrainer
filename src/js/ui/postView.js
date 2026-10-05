/**
 * The post office on the river: Silas's contracts and today's question.
 *
 * The two things on the map that are not about a place. The contracts are jobs
 * for the table, taken from the skills you are weakest at; today's question is
 * a three-question set that is the same for everybody on the same day. Both
 * are small on purpose: they are what to do when there is a quarter of an
 * hour, and a reason to come back tomorrow.
 */

import { el } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { pearls } from './shop.js';
import { furthestStop } from '../state/economy.js';
import { ensureContracts, contractsOf, contractText } from '../state/contracts.js';
import { dateKey, doneToday, liveStreak, dailyOf, DAILY_LENGTH } from '../state/daily.js';

/** A contract's sentence with its names translated. */
export function contractLine(k) {
  const { text, params } = contractText(k);
  return t(text, Object.fromEntries(Object.entries(params).map(([n, v]) => [n, typeof v === 'string' ? t(v) : v])));
}

function contractRow(k, profile, go) {
  const pct = Math.max(3, Math.round((k.have / k.need) * 100));
  const where = k.kind === 'fish'
    ? { label: t('To the Catch Book'), go: () => go('catchbook') }
    : { label: t('To the table'), go: () => go('stop', { at: profile.career.venue }) };
  return el('li.contract',
    el('div.contract-body',
      el('div.contract-text', contractLine(k)),
      el('div.road-progress',
        el('div.road-bar', el('span', { style: { width: `${pct}%` } })),
        el('span.road-count', t('{have} of {need}', { have: k.have, need: k.need })),
      ),
    ),
    el('div.contract-side', pearls(k.reward), el('button.btn.sm.ghost', { onclick: where.go }, where.label)),
  );
}

/** Silas's contracts: three jobs, each with a purse. */
export function contractsCard(profile, go) {
  const active = ensureContracts(profile, { reach: furthestStop(profile) });
  const { done } = contractsOf(profile);
  return el('div.panel.page.paper.post-card.contracts-card',
    el('div.panel-title', el('h3', icon('clipboard', { size: 16 }), t('Silas\'s contracts'))),
    el('p.muted', t('Jobs from the skills you are weakest at, to be done at a real table. A decision made with help does not count.')),
    el('ul.contracts', active.map((k) => contractRow(k, profile, go))),
    el('div.faint', t('{n} done so far. A new one is posted as each is finished.', { n: done })),
  );
}

/** Today's question: three from your chapters, and the streak. */
export function dailyCard(profile, go, now = new Date()) {
  const key = dateKey(now);
  const done = doneToday(profile, key);
  const streak = liveStreak(profile, key);
  const { best, correct } = dailyOf(profile);
  return el('div.panel.page.paper.post-card.daily-card',
    el('div.panel-title', el('h3', icon('spark', { size: 16 }), t('Today\'s question'))),
    el('p.muted', done
      ? t('Done for today: {n} of {total} right. Come back tomorrow for the next three.', { n: correct, total: DAILY_LENGTH })
      : t('Three questions from the chapters you have, the same for everybody today. Come every day and it pays more.')),
    el('div.daily-streak',
      el('span.daily-streak-n', String(streak)),
      el('span', streak === 1 ? t('day in a row') : t('days in a row')),
      best > streak ? el('span.faint', ` · ${t('best {n}', { n: best })}`) : null),
    el('button.btn.primary', { onclick: () => go('drill', { mode: 'daily' }) },
      done ? t('Go through them again') : t('Answer today\'s three')),
  );
}

/** The two side by side. */
export function postPanel(profile, go) {
  return el('div.post-panel', contractsCard(profile, go), dailyCard(profile, go));
}
