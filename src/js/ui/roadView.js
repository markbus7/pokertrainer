/**
 * The Road, drawn: a banner that says what to do next, a strip of the eight
 * cities, and a city's list with a way to each thing on it.
 *
 * state/journey.js works out what is done and what is in the way; this only
 * lays it out. The same list is used on the map and on a stop's own screen,
 * so what the map says to do and what the stop says to do cannot differ.
 */

import { el, fmt, mount } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { VENUES } from '../data/venues.js';
import { purseFor, gatedBy } from '../state/journey.js';
import { bossFor } from '../data/characters.js';

/** "A sailing skiff" in the middle of a sentence is "a sailing skiff". */
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * A goal's sentence, with the names in it translated: the chapter, the stop,
 * the person. A boat's name begins "A …", which mid-sentence wants a small a.
 */
export function goalText(goal) {
  const params = {};
  for (const [k, v] of Object.entries(goal.params || {})) {
    params[k] = typeof v === 'string' ? (k === 'boat' ? lowerFirst(t(v)) : t(v)) : v;
  }
  return t(goal.text, params);
}

/** What the button to a goal says, from where it goes. */
const GO_LABEL = {
  walkthrough: 'Read it',
  store: 'To the Trading Post',
  stop: 'To the table',
  levels: 'Your Papers',
  catchbook: 'To the Catch Book',
  ranges: 'To the Pilot House',
  boatyard: 'To the Boatyard',
  gauntlet: 'To the Racing Chute',
};

export const goLabel = (goal) => t(GO_LABEL[goal.to.route] || 'Go there');

function goalRow(goal, { next, go, interactive }) {
  const sub = [];
  if (goal.need != null && !goal.done) {
    const pct = Math.max(3, Math.round((goal.have / goal.need) * 100));
    sub.push(el('div.road-progress',
      el('div.road-bar', el('span', { style: { width: `${pct}%` } })),
      el('span.road-count', t('{have} of {need}', { have: goal.have, need: goal.need })),
    ));
  }
  if (goal.blocked && !goal.done) {
    sub.push(el('div.road-note.blocked', icon('lock', { size: 12 }), t(goal.blocked.text, goal.blocked.params)));
  } else if (goal.hint && !goal.done) {
    sub.push(el('div.road-note', t(goal.hint, goal.hintParams)));
  }

  return el(`li.road-goal${goal.done ? '.done' : ''}${next ? '.next' : ''}${goal.required ? '' : '.bonus'}`,
    el('span.road-mark', { 'aria-hidden': 'true' },
      goal.done ? icon('check', { size: 15 }) : next ? icon('arrowRight', { size: 15 }) : null),
    el('div.road-goal-body',
      el('div.road-goal-text', goalText(goal), goal.done ? el('span.visually-hidden', ` — ${t('done')}`) : null),
      sub,
    ),
    interactive && !goal.done
      ? el(`button.btn.sm${next ? '.primary' : '.ghost'}`, {
        onclick: () => go(goal.to.route, goal.to.params),
      }, goLabel(goal))
      : null,
  );
}

/**
 * One city's list: what has to be done here, then what is only worth doing.
 *
 * @param {object} chapter   a chapter of journeyState()
 * @param {object} opts
 * @param {{goal:object}|null} opts.next   the one goal to point at, if it is in this list
 * @param {boolean} [opts.interactive]     false for a city you cannot be in yet
 */
export function roadList(chapter, { next = null, go, interactive = true }) {
  const required = chapter.goals.filter((g) => g.required);
  const bonus = chapter.goals.filter((g) => !g.required);
  return el('div.road-list',
    el('ul.road-goals', required.map((g) => goalRow(g, { next: next && next.goal.id === g.id, go, interactive }))),
    bonus.length
      ? el('div.road-bonus',
        el('div.road-bonus-title', t('Worth doing here, and nobody is waiting on them')),
        el('ul.road-goals', bonus.map((g) => goalRow(g, { next: next && next.goal.id === g.id, go, interactive }))))
      : null,
  );
}

/** What finishing a city opens, in a sentence. */
export function opensLine(chapter) {
  const next = VENUES[chapter.index + 1];
  if (!next) return t('This is the last table there is. Take it, and the river and the sea are yours.');
  const boss = bossFor(chapter.venue.boss);
  // The delta: the end of the river, and the door to the sea.
  if (next.act !== chapter.venue.act) {
    return t('This is the last table on the river. Take it and the river is yours — and past the delta the Gulf opens, {next} first. {boss} also hands over a purse of {money}, enough for a seat there.',
      { next: t(next.name), boss: boss.short, money: fmt.money(purseFor(chapter.index)) });
  }
  return t('When these are done, {next} opens. Taking this table also has {boss} hand over a purse of {money}, enough for a seat there.',
    { next: t(next.name), boss: boss.short, money: fmt.money(purseFor(chapter.index)) });
}

/**
 * The strip: eight cities in a row, where you have been and where you are.
 * Tapping one shows its list.
 */
export function roadStrip(journey, viewing, onPick) {
  return el('div.road-strip', { role: 'tablist', 'aria-label': t('The cities on the road') },
    journey.chapters.map((c) => {
      const state = c.complete ? 'done' : c.index === journey.current ? 'current' : 'locked';
      const gate = gatedBy(c.index);
      return el(`button.road-node.is-${state}${c.index === viewing ? '.viewing' : ''}`, {
        role: 'tab',
        'aria-selected': c.index === viewing ? 'true' : 'false',
        title: `${t(c.venue.name)} — ${state === 'locked' && gate ? t('after {place}', { place: t(gate.name) }) : `${c.done} / ${c.total}`}`,
        'aria-label': `${t(c.venue.name)}: ${state === 'done' ? t('finished') : state === 'current' ? t('you are here') : t('closed')}`,
        onclick: () => onPick(c.index),
      }, state === 'done' ? icon('check', { size: 13 }) : state === 'locked' ? icon('lock', { size: 12 }) : String(c.index + 1));
    }),
  );
}

/**
 * The banner above the map: the city you are working on, how far through it
 * you are, and the one thing to do next with a way to it.
 */
export function roadBanner(journey, go) {
  if (journey.finished) {
    return el('div.road-banner.finished',
      icon('check', { size: 18 }),
      el('div.road-banner-text',
        el('div.road-kicker', t('The Road')),
        el('div.road-banner-line', t('You have taken every table on the river and the sea.'))));
  }
  const chapter = journey.chapters[journey.current];
  const { goal } = journey.next || {};
  return el('div.road-banner',
    el('div.road-banner-text',
      el('div.road-kicker', t('The Road'), el('span.road-where', ` · ${t(chapter.venue.name)} · ${chapter.done} / ${chapter.total}`)),
      goal
        ? el('div.road-banner-line', el('span.road-next-label', t('Next')), ' ', goalText(goal))
        : el('div.road-banner-line', t('Everything here is done. The next stop is open.')),
      goal && goal.blocked ? el('div.road-note.blocked', icon('lock', { size: 12 }), t(goal.blocked.text, goal.blocked.params)) : null,
    ),
    goal
      ? el('button.btn.primary.plank', { onclick: () => go(goal.to.route, goal.to.params) }, goLabel(goal), icon('arrowRight', { size: 14 }))
      : null,
  );
}

/** The Road panel under the map: the strip, and the list for the city you pick. */
export function roadPanel(journey, go) {
  let viewing = journey.current;
  const host = el('div.road-body');
  const strip = el('div');

  const draw = () => {
    const chapter = journey.chapters[viewing];
    const here = viewing === journey.current;
    const gate = gatedBy(viewing);
    const locked = !chapter.complete && viewing > journey.current;
    mount(strip, roadStrip(journey, viewing, (i) => { viewing = i; draw(); }));
    mount(host,
      el('div.road-head',
        el('h3.road-city', t(chapter.venue.name), el('span.road-stake', chapter.venue.label)),
        el('div.faint.road-sub', chapter.complete
          ? t('Finished.')
          : locked
            ? t('Opens when {place} is finished.', { place: t(gate.name) })
            : t('{done} of {total} done. Any order, but the first undone one is the best place to start.', { done: chapter.done, total: chapter.total })),
      ),
      roadList(chapter, { next: here && journey.next ? journey.next : null, go, interactive: !locked }),
      !chapter.complete ? el('p.faint.road-opens', opensLine(chapter)) : null,
    );
  };
  draw();

  return el('div.panel.page.paper.road-panel',
    el('div.panel-title', el('h2', icon('river', { size: 18 }), t('The Road'))),
    el('p.muted', t('A city at a time, the way a river goes. Do what is listed for the one you are in, in any order; when it is done the next one opens.')),
    strip,
    host,
  );
}
