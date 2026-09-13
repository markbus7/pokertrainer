/**
 * The reference: the chart and the price, wherever you need them.
 *
 * These existed twice and in the wrong places. The drill had a range table and
 * a price ladder; the range trainer had a grid; the table — the one place a
 * reader is actually trying to apply this — had neither. What the table
 * offered instead was your own equity for this exact hand, which is not a
 * reference at all. It is the answer, and handing over the answer teaches
 * nothing about the chart you are trying to learn.
 *
 * So they live here once, and the difference matters:
 *
 *   A REFERENCE is the thing you are memorising. Looking at it is how you
 *   learn it, the app has a whole ladder built to take it away on purpose,
 *   and charging for it at the table too would be charging twice.
 *
 *   An ANSWER is this hand's equity, worked out for you. That stays behind
 *   the old "will not count as solved on your own" button, because there is
 *   no version of being told the answer that is practice.
 */

import { el } from './dom.js';
import { t } from '../i18n/index.js';
import { handGrid } from '../core/cards.js';
import { CHARTS, POSITION_INFO, BOUNDARY_ROWS, rowBoundary } from '../data/ranges.js';
import { PRICE_LADDER, requiredEquity } from '../core/odds.js';

const seatName = (seat) => (POSITION_INFO[seat] ? POSITION_INFO[seat].name : seat);

/**
 * The 13x13 grid for one spot, shaded, with a hand ringed if you name one.
 *
 * The same component the range trainer drills against, on purpose: a range is
 * a shape before it is a list, and the shape only becomes memory if the thing
 * you study and the thing you glance at during a hand look identical.
 */
export function rangeGridFor({ seat, raiser = null, hand = null, caption = true }) {
  let member = () => '';
  let title = '';

  if (!raiser) {
    const range = CHARTS.rfi[seat] || CHARTS.rfi.BTN;
    member = (key) => (range.has(key) ? 'in' : '');
    title = t('Opening range — {seat}', { seat: t(seatName(seat)) });
  } else if (seat === 'BB') {
    const defend = CHARTS.bbDefend[raiser] || CHARTS.bbDefend.CO;
    const three = CHARTS.threeBet.BB;
    member = (key) => (three.all.has(key) ? 'value' : defend.has(key) ? 'in' : '');
    title = t('Big blind against a {seat} open', { seat: t(seatName(raiser)) });
  } else {
    const three = CHARTS.threeBet[seat] || CHARTS.threeBet.CO;
    member = (key) => (three.value.has(key) ? 'value' : three.bluff.has(key) ? 'bluff' : '');
    title = t('Three-betting range — {seat}', { seat: t(seatName(seat)) });
  }

  // What the shading means. Without this the grid is three colours and a
  // guess — and for a three-betting chart the honest note is that the hands
  // it leaves blank are not all folds: there is no call-an-open chart outside
  // the big blind, so saying nothing here would imply one.
  const legend = !raiser
    ? [['in', 'Raise']]
    : seat === 'BB'
      ? [['value', '3-bet'], ['in', 'Call']]
      : [['value', '3-bet for value'], ['bluff', '3-bet as a bluff']];

  return el('div.chart-panel',
    caption ? el('div.chart-caption', title) : null,
    el('div.range-grid-scroll', el('div.range-grid',
      handGrid().flat().map((key) => {
        const classes = [member(key)];
        if (key.length === 2) classes.push('pair');
        if (hand && key === hand) classes.push('you');
        return el(`div.range-cell${classes.filter(Boolean).map((c) => `.${c}`).join('')}`, key);
      }),
    )),
    el('div.chart-legend',
      legend.map(([cls, label]) => el('span.chart-key',
        el('span', { class: `chart-swatch ${cls}` }), t(label))),
      raiser && seat !== 'BB'
        ? el('span.faint', t('Everything else folds — outside the big blind there is no calling range.'))
        : null,
    ),
  );
}

/**
 * The compact version: how far down each row the range still reaches.
 *
 * Five columns instead of a hundred and sixty-nine cells, which is what fits
 * beside a question and what the lesson's own step 7 argues you should be
 * carrying in your head anyway.
 */
export function boundarySheet({ defending = false, highlight = null } = {}) {
  const source = defending ? CHARTS.bbDefend : CHARTS.rfi;
  const seats = ['UTG', 'HJ', 'CO', 'BTN', 'SB'].filter((p) => source[p]);
  if (!seats.length) return null;

  const rows = BOUNDARY_ROWS
    .map((row) => ({ row, cells: seats.map((seat) => rowBoundary(source[seat], row.high, row.suited)) }))
    .filter((entry) => entry.cells.some(Boolean));
  if (!rows.length) return null;

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
    el('div.faint', t('Pairs and suited aces are always in.')),
  );
}

/**
 * The price, as a method rather than a division.
 *
 * The percentages are derived from the same `requiredEquity` the coach marks
 * with, never typed, so this card cannot come to disagree with the engine.
 */
export function priceSheet() {
  return el('div.cheat-sheet',
    el('div.faint', t('At a table you count, you do not divide.')),
    el('ol.cheat-steps',
      el('li', t('How many times does their bet fit into the pot?')),
      el('li', t('Add two — one for their bet, one for your call.')),
      el('li', t('That is the final pot counted in calls, and you are putting in one of them.')),
    ),
    el('div.cheat-scroll', el('table.cheat-table',
      el('thead', el('tr', el('th', t('They bet')), el('th', t('In calls')), el('th', t('You need')))),
      el('tbody', PRICE_LADDER.map(({ fraction, short }) => {
        const calls = 1 / fraction + 2;
        return el('tr',
          el('th', short),
          el('td', `${Number.isInteger(calls) ? calls : calls.toFixed(1)}`),
          el('td', `${Math.round(requiredEquity(fraction, 1 + fraction) * 100)}%`),
        );
      })),
    )),
    el('div.faint', t('Worth knowing cold.')),
  );
}
