/**
 * Rendering the hands-on lesson exercises.
 *
 * Every one of these puts real cards on screen and asks you to do something
 * with them rather than pick a sentence off a list. The outs grid is the
 * clearest case: you tap the cards you believe win the hand, and when you
 * submit, the grid itself shows the ones you missed — which is a far more
 * durable correction than being told "9 outs".
 */

import { el, richText, fmt } from './dom.js';
import { t } from '../i18n/index.js';
import { cardEl, cardRow } from './cardView.js';
import { rankOf, suitOf, RANK_CHARS, SUIT_SYMBOLS } from '../core/cards.js';

/**
 * @param {object} spot     from trainers/practice.js
 * @param {function} onDone called with the grade result once submitted
 */
export function practiceView(spot, onDone, settings = {}) {
  switch (spot.kind) {
    case 'count-outs': return countOutsView(spot, onDone, settings);
    case 'pick-winner': return pickWinnerView(spot, onDone, settings);
    case 'price': return priceView(spot, onDone);
    case 'decide': return decideView(spot, onDone, settings);
    default: return null;
  }
}

const shell = (spot, ...children) => el('div.practice',
  el('div.practice-prompt', richText(t(spot.prompt))),
  ...children,
);

const seatBlock = (label, cards, settings, extraClass = '') => el(`div.practice-seat${extraClass}`,
  el('div.practice-label', t(label)),
  cardRow(cards, { size: 'sm', fourColour: settings.fourColour }),
);

/* ------------------------------------------------------------------ *
 * Count the outs
 * ------------------------------------------------------------------ */

function countOutsView(spot, onDone, settings) {
  const picked = new Set();
  let graded = null;

  const cellFor = (card) => {
    const cell = el('button.out-cell', {
      onclick: () => {
        if (graded) return;
        if (picked.has(card)) { picked.delete(card); cell.classList.remove('picked'); }
        else { picked.add(card); cell.classList.add('picked'); }
        count.textContent = t('{n} selected', { n: picked.size });
      },
      'aria-label': RANK_CHARS[rankOf(card) - 2] + SUIT_SYMBOLS[suitOf(card)],
    },
      el(`span.out-rank${[1, 2].includes(suitOf(card)) ? '.red' : ''}`, RANK_CHARS[rankOf(card) - 2]),
      el(`span.out-suit${[1, 2].includes(suitOf(card)) ? '.red' : ''}`, SUIT_SYMBOLS[suitOf(card)]),
    );
    cell.dataset.card = String(card);
    return cell;
  };

  const cells = spot.unseen.map(cellFor);
  const byCard = new Map(cells.map((c) => [Number(c.dataset.card), c]));
  const count = el('span.faint.mono', t('{n} selected', { n: 0 }));
  const feedback = el('div');

  const submit = el('button.btn.primary', {
    onclick: () => {
      if (graded) return;
      graded = spot.grade([...picked]);
      submit.disabled = true;
      // Mark the grid itself: found, missed, and wrongly chosen.
      for (const c of graded.hits) byCard.get(c)?.classList.add('hit');
      for (const c of graded.missed) byCard.get(c)?.classList.add('missed');
      for (const c of graded.wrong) byCard.get(c)?.classList.add('wrong');
      for (const cell of cells) cell.disabled = true;
      feedback.appendChild(gradeBox(graded, [
        graded.missed.length ? t('{n} you missed are outlined in gold.', { n: graded.missed.length }) : null,
        graded.wrong.length ? t('{n} you picked do not win the hand.', { n: graded.wrong.length }) : null,
      ].filter(Boolean)));
      onDone(graded);
    },
  }, t('Check my outs'));

  return shell(spot,
    el('div.practice-table',
      seatBlock('Your hand', spot.hero, settings),
      seatBlock('The flop', spot.board, settings),
      seatBlock('Their hand', spot.villain, settings, '.villain'),
    ),
    el('div.spread', { style: { margin: '12px 0 6px' } },
      el('span.faint', t('Every card still unseen:')),
      count,
    ),
    el('div.out-grid', cells),
    el('div.row', { style: { marginTop: '12px' } }, submit),
    feedback,
  );
}

/* ------------------------------------------------------------------ *
 * Who wins
 * ------------------------------------------------------------------ */

function pickWinnerView(spot, onDone, settings) {
  let graded = null;
  const feedback = el('div');
  const buttons = [];

  const choose = (key) => {
    if (graded) return;
    graded = spot.grade(key);
    for (const b of buttons) {
      b.disabled = true;
      if (b.dataset.key === graded.winner) b.classList.add('correct');
      else if (b.dataset.key === key) b.classList.add('wrong');
    }
    feedback.appendChild(gradeBox(graded));
    onDone(graded);
  };

  const handButton = (hand) => {
    const b = el('button.practice-hand', { onclick: () => choose(hand.key) },
      el('div.practice-label', t(hand.label)),
      cardRow(hand.cards, { fourColour: settings.fourColour }),
    );
    b.dataset.key = hand.key;
    buttons.push(b);
    return b;
  };

  const split = el('button.btn.sm', { onclick: () => choose('split') }, t('Split pot'));
  split.dataset.key = 'split';
  buttons.push(split);

  return shell(spot,
    el('div.practice-board',
      el('div.practice-label', t('The board')),
      cardRow(spot.board, { fourColour: settings.fourColour }),
    ),
    el('div.practice-hands', spot.hands.map(handButton)),
    spot.allowSplit ? el('div.row', { style: { marginTop: '10px' } }, split) : null,
    feedback,
  );
}

/* ------------------------------------------------------------------ *
 * Name the price
 * ------------------------------------------------------------------ */

function priceView(spot, onDone) {
  let graded = null;
  const feedback = el('div');
  const input = el('input.practice-input', {
    type: 'number', inputmode: 'decimal', min: '0', max: '100',
    placeholder: '25', 'aria-label': t('Equity you need, as a percentage'),
  });

  const submit = el('button.btn.primary', {
    onclick: () => {
      if (graded) return;
      graded = spot.grade(input.value);
      submit.disabled = true;
      input.disabled = true;
      feedback.appendChild(gradeBox(graded, graded.exact !== undefined
        ? [t('The answer is {pct}%.', { pct: graded.exact.toFixed(1) })] : []));
      onDone(graded);
    },
  }, t('Check'));

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit.click(); });

  return shell(spot,
    el('div.practice-money',
      moneyTile('In the pot', spot.pot),
      moneyTile('They bet', spot.bet),
      moneyTile('To call', spot.bet),
    ),
    el('div.row', { style: { marginTop: '12px', gap: '8px', flexWrap: 'wrap' } },
      input, el('span.faint', '%'), submit),
    feedback,
  );
}

const moneyTile = (label, value) => el('div.practice-money-tile',
  el('div.practice-label', t(label)),
  el('div.mono', { style: { fontSize: '1.25rem', fontWeight: '700' } }, fmt.chips(value)),
);

/* ------------------------------------------------------------------ *
 * Make the call
 * ------------------------------------------------------------------ */

function decideView(spot, onDone, settings) {
  let graded = null;
  const feedback = el('div');
  const buttons = [];

  const act = (key) => {
    if (graded) return;
    graded = spot.grade(key);
    for (const b of buttons) b.disabled = true;
    feedback.appendChild(gradeBox(graded));
    onDone(graded);
  };

  return shell(spot,
    el('div.practice-table',
      seatBlock('Your hand', spot.hero, settings),
      seatBlock('The flop', spot.board, settings),
      seatBlock('Their hand', spot.villain, settings, '.villain'),
    ),
    el('div.practice-money', { style: { marginTop: '12px' } },
      moneyTile('The pot is now', spot.potNow),
      moneyTile('To call', spot.bet),
    ),
    el('div.row', { style: { marginTop: '12px', gap: '8px', flexWrap: 'wrap' } },
      spot.actions.map((a) => {
        const b = el(`button.btn${a.key === 'call' ? '.primary' : ''}`, { onclick: () => act(a.key) }, t(a.label));
        buttons.push(b);
        return b;
      }),
    ),
    feedback,
  );
}

/* ------------------------------------------------------------------ */

function gradeBox(result, extraLines = []) {
  return el(`div.feedback.${result.correct ? 'correct' : 'wrong'}`, { style: { marginTop: '14px' } },
    el('div.verdict', result.correct ? t('✓ That is right') : t('✗ Not quite')),
    ...extraLines.map((line) => el('div', { style: { marginBottom: '6px' } }, line)),
    el('div', richText(result.explanation)),
  );
}

export { cardEl };
