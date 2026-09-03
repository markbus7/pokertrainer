/**
 * Hand review: the hands that went wrong, played back one action at a time.
 *
 * A verdict in the coach panel disappears the moment the next hand is dealt,
 * which is roughly the moment it stops being useful. This keeps the hands
 * worth keeping and replays them on the same felt you played them on, with
 * the decision that cost you money marked on the timeline so you can go
 * straight to it.
 *
 * Coolers are kept alongside mistakes on purpose. Judging a decision by
 * whether it won is the most expensive habit in poker, and the cure is not
 * being told so — it is seeing a hand of your own where you lost forty big
 * blinds and did nothing wrong.
 */

import { el, mount, richText, fmt, toast } from './dom.js';
import { t } from '../i18n/index.js';
import { cardRow } from './cardView.js';
import { renderFelt } from './feltView.js';
import { renderGauge } from './visuals.js';
import { getProfile } from '../engine/bots.js';
import { potOddsRatio } from '../core/odds.js';
import {
  recentHands, findHand, removeHand, clearHands, handSummary,
  frameAt, frameCount, reviewOf, MISTAKE_CAP, COOLER_BB,
} from '../state/handHistory.js';

const SOURCES = { play: 'Table', grind: 'Bankroll', lab: 'Lab' };

export function renderReview(ctx, params = {}) {
  return params.hand ? renderOneHand(ctx, params.hand) : renderList(ctx);
}

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */

function renderList(ctx) {
  const { go } = ctx;
  const hands = recentHands();
  const summary = handSummary();
  // Removing a hand re-renders the whole screen rather than patching the
  // list: the header counts the same hands the rows show, and redrawing only
  // one of them is how those two quietly drift apart.
  const refresh = () => go('review');

  return el('div.screen',
    el('div.panel',
      el('div.spread',
        el('div',
          el('h1', { style: { margin: 0 } }, '🔍 Hand review'),
          el('div.faint', { style: { marginTop: '4px' } },
            'Every hand here has something in it. Tap one to play it back.'),
        ),
        hands.length
          ? el('button.btn.sm.ghost', {
              onclick: () => {
                clearHands();
                refresh();
                toast({ icon: '🧹', title: 'Cleared', desc: 'Your saved hands have been deleted.' });
              },
            }, 'Clear all')
          : null,
      ),
      hands.length
        ? el('div.grid.cols-3', { style: { marginTop: '14px' } },
            el('div.stat', el('div.label', 'Mistakes'), el('div.value', String(summary.mistakes))),
            el('div.stat', el('div.label', 'Cost'), el('div.value.bad', `${summary.costBb.toFixed(1)}bb`)),
            el('div.stat', el('div.label', 'Coolers'), el('div.value', String(summary.coolers))),
          )
        : null,
    ),
    hands.length
      ? el('div.stack-sm', hands.map((hand) => handCard(hand, go, refresh)))
      : el('div.panel', el('div.notice', t(
          'Nothing saved yet. Hands land here when the coach grades one of your decisions as a mistake, or '
          + 'when you lose {n} big blinds or more having played it right. Go and play a few hands.',
          { n: COOLER_BB }))),
    el('div.panel',
      el('div.faint', { style: { fontSize: '0.82rem' } }, richText(t(
        '**What gets saved.** A hand is kept when the coach graded one of your decisions bad, or when you lost '
        + '{n} big blinds or more with no mistake in it — the second kind matters as much as the first, because '
        + 'it is the proof that losing and misplaying are different things. The last {cap} mistakes are kept. '
        + 'These live on this device only, so they do not bloat every sync of your progress.',
        { n: COOLER_BB, cap: MISTAKE_CAP }))),
    ),
  );
}

function handCard(hand, go, redraw) {
  const review = reviewOf(hand);
  const hero = hand.seats.find((s) => s.isHero);
  const cooler = review.kind === 'cooler';
  // The board as it stood when the decision was made, not the one the hand
  // finished on. You are trying to recognise the spot you were in, and a
  // preflop mistake shown against a five-card runout is a different spot.
  const board = review.worst ? frameAt(hand, review.worst.decision.step).board : hand.board;

  const card = el(`button.hand-card${cooler ? '.cooler' : ''}`, {
    onclick: () => go('review', { hand: hand.id }),
  },
    el('div.hand-card-head',
      el('span.badge' + (cooler ? '' : '.red'), cooler ? 'Cooler' : 'Mistake'),
      el('span.hand-card-title', review.headline),
      el('span.faint.hand-card-when', `${t(SOURCES[hand.source] || hand.source)} · ${whenText(hand.at)}`),
    ),
    el('div.hand-card-body',
      el('div.hand-card-cards',
        el('span.faint.hand-card-label', 'you'),
        cardRow(hero ? hero.hole : [], { size: 'sm' }),
        board.length ? el('span.faint.hand-card-label', 'board') : null,
        board.length ? cardRow(board, { size: 'sm' }) : null,
      ),
      el('div.hand-card-numbers',
        cooler
          ? el('span.faint', t('lost {amount}bb and played it right', { amount: review.lostBb.toFixed(1) }))
          : el('span.hand-card-cost',
              `${t(review.street)} · ${t('cost {amount}bb', { amount: review.costBb.toFixed(1) })}`),
      ),
    ),
  );

  return el('div.hand-card-wrap',
    card,
    el('button.hand-card-remove', {
      title: 'Remove this hand',
      'aria-label': 'Remove this hand',
      onclick: () => { removeHand(hand.id); redraw(); },
    }, '✕'),
  );
}

/**
 * Every fragment goes through t() before anything is joined. A sentence that
 * is only assembled at runtime has no key to look up, so the pieces have to
 * be the translatable units.
 */
function whenText(at) {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{n} min ago', { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('{n}h ago', { n: hours });
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ------------------------------------------------------------------ *
 * The replay
 * ------------------------------------------------------------------ */

function renderOneHand(ctx, id) {
  const { profile, go } = ctx;
  const hand = findHand(id);
  if (!hand) {
    return el('div.screen', el('div.panel',
      el('h1', 'That hand is gone'),
      el('p.muted', 'It was cleared, or pushed out by newer ones.'),
      el('button.btn.primary', { onclick: () => go('review') }, 'Back to the list'),
    ));
  }

  const review = reviewOf(hand);
  const total = frameCount(hand);
  // Open on the mistake rather than on the deal. You came here to see one
  // thing, and making you press Next eleven times to reach it is a tax.
  const mistakeFrame = review.worst ? review.worst.decision.step : 0;
  const state = { index: mistakeFrame };

  const feltHost = el('div');
  const stepHost = el('div');
  const transport = el('div.replay-transport');

  function goTo(i) {
    state.index = Math.max(0, Math.min(total - 1, i));
    draw();
  }

  function draw() {
    const frame = frameAt(hand, state.index);
    const reveal = hand.revealAll
      || (state.index >= hand.steps.length && hand.result.reason === 'showdown');

    mount(feltHost, renderFelt({
      players: frame.players.map((p) => ({
        ...p,
        emoji: !p.isHero && p.profileKey ? getProfile(p.profileKey).emoji : null,
        wonPot: reveal && hand.result.winners.includes(p.id),
      })),
      heroSeat: (hand.seats.find((s) => s.isHero) || hand.seats[0]).seat,
      seatCount: hand.seatCount || hand.seats.length,
      button: hand.button,
      board: frame.board,
      pot: frame.pot,
      street: state.index >= hand.steps.length && hand.result.reason === 'showdown' ? 'showdown' : frame.street,
      actingId: frame.actingId,
      reveal,
      fourColour: profile.settings.fourColour,
      boardPlaceholder: 'preflop',
    }));

    mount(transport,
      el('button.btn.sm.ghost', { onclick: () => goTo(state.index - 1), disabled: state.index === 0 }, '← Back'),
      el('div.replay-dots', timelineDots(hand, review, state.index, goTo)),
      el('button.btn.sm.ghost', { onclick: () => goTo(state.index + 1), disabled: state.index >= total - 1 }, 'Next →'),
    );

    mount(stepHost, stepPanel(hand, review, state.index, goTo));
  }

  ctx.onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(state.index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(state.index - 1); }
  };

  draw();

  return el('div.screen',
    el('div.panel',
      el('div.spread',
        el('div.row',
          el('span', { style: { fontSize: '1.5rem' } }, review.kind === 'cooler' ? '🧊' : '🔍'),
          el('div',
            el('div', { style: { fontWeight: '650' } }, review.headline),
            el('div.faint', [
              t(SOURCES[hand.source] || hand.source),
              hand.handNumber ? t('hand #{n}', { n: hand.handNumber }) : null,
              whenText(hand.at),
            ].filter(Boolean).join(' · ')),
          ),
        ),
        el('button.btn.sm.ghost', { onclick: () => go('review') }, 'All hands'),
      ),
    ),
    el('div.panel.replay-panel', feltHost, transport),
    stepHost,
    el('div.panel',
      el('div.faint', { style: { fontSize: '0.8rem' } }, richText(t(
        '**Where the equity comes from.** It is measured by dealing the rest of the hand out thousands of times '
        + 'against the players still in, and counting how often you end up winning. It assumes they could hold '
        + 'anything, which is generous to you when somebody has bet big — a real range is stronger than a random '
        + 'one. Treat a verdict that turns on two or three points as close rather than settled.'))),
    ),
  );
}

/**
 * The timeline. Every action is a dot; your own decisions are larger, and the
 * one that cost the most is red — the point of the row is that you can see
 * where the hand went wrong before you have read a word.
 */
function timelineDots(hand, review, index, goTo) {
  const dots = [];
  for (let i = 0; i < frameCount(hand); i++) {
    const step = hand.steps[i];
    const decisionIndex = step && step.kind === 'action' && step.decision !== undefined ? step.decision : -1;
    const verdict = decisionIndex >= 0 ? review.verdicts[decisionIndex] : null;
    const classes = ['replay-dot'];
    if (i === index) classes.push('here');
    if (verdict) classes.push('mine', verdict.level);
    if (step && step.kind === 'street') classes.push('street');
    dots.push(el(`button.${classes.join('.')}`, {
      onclick: () => goTo(i),
      title: dotTitle(hand, i, verdict),
      'aria-label': dotTitle(hand, i, verdict),
    }));
  }
  return dots;
}

function dotTitle(hand, i, verdict) {
  const step = hand.steps[i];
  if (!step) return t('The result');
  if (step.kind === 'street') return t('The {street}', { street: t(step.street) });
  const seat = hand.seats.find((s) => s.id === step.id);
  const label = actionLine(step, seat);
  return verdict ? `${label} — ${t(verdict.head)}` : label;
}

/** What is happening at this point in the hand, and what to make of it. */
function stepPanel(hand, review, index, goTo) {
  const step = hand.steps[index];

  if (!step) return resultPanel(hand, review);

  if (step.kind === 'street') {
    return el('div.panel',
      el('div.panel-title', el('h3', { style: { margin: 0 } },
        t('The {street}', { street: t(step.street) }))),
      el('div.faint', 'New cards. Nobody has acted yet on this street.'),
    );
  }

  const seat = hand.seats.find((s) => s.id === step.id);
  const line = actionLine(step, seat);

  if (step.decision === undefined) {
    return el('div.panel',
      el('div.panel-title', el('h3', { style: { margin: 0 } }, line)),
      el('div.faint', step.toCall > 0
        ? t('The pot was {pot}, and it cost {call} to stay in.',
            { pot: fmt.chips(step.pot), call: fmt.chips(step.toCall) })
        : t('The pot was {pot}.', { pot: fmt.chips(step.pot) })),
      el('button.btn.sm', { style: { marginTop: '10px' }, onclick: () => goTo(index + 1) }, 'Next →'),
    );
  }

  const verdict = review.verdicts[step.decision];
  const d = verdict.decision;

  return el(`div.panel.verdict-panel.${verdict.level}`,
    el('div.panel-title',
      el('h3', { style: { margin: 0 } }, line),
      el('span.badge' + (verdict.level === 'bad' ? '.red' : verdict.level === 'good' ? '.green' : ''), verdict.head),
    ),
    el('div', { style: { marginTop: '4px' } }, t(verdict.body, verdict.params)),
    verdict.better
      ? el('div.notice.warn', { style: { marginTop: '12px' } },
          richText(`**${t('Instead:')}** ${t(verdict.better, verdict.params)}.`))
      : null,
    d.toCall > 0
      ? el('div', { style: { marginTop: '12px' } },
          renderGauge({ need: d.needed, have: d.equity, needLabel: 'Price demands', haveLabel: 'Your hand has' }))
      : null,
    el('div.replay-numbers',
      metric('Pot', fmt.chips(d.pot)),
      d.toCall > 0 ? metric('To call', fmt.chips(d.toCall)) : metric('Facing', 'no bet'),
      d.toCall > 0 ? metric('Pot odds', `${potOddsRatio(d.toCall, d.pot).toFixed(1)} : 1`) : null,
      metric('Opponents', String(d.opponents ?? '—')),
      d.spr !== null && d.spr !== undefined ? metric('SPR', d.spr.toFixed(1)) : null,
      verdict.cost > 0
        ? metric('Cost', `${(verdict.cost / (hand.bigBlind || 1)).toFixed(1)}bb`, 'bad')
        : null,
    ),
  );
}

function resultPanel(hand, review) {
  // A Lab spot is one decision, not a hand that was played out. There is no
  // pot to have won, and inventing a result for it would be a lie the rest of
  // the screen would then have to live with.
  if (hand.result.reason === 'review') {
    const verdict = review.verdicts[0];
    return el('div.panel',
      el('div.panel-title', el('h3', { style: { margin: 0 } }, 'End of the spot')),
      el('div.faint',
        `${t('This one came from the Lab, so the hand stops here — the decision was the whole question.')} `
        + (verdict && verdict.better
          ? t('The answer was to {action}.', { action: t(verdict.better, verdict.params).split(' —')[0].toLowerCase() })
          : '')),
    );
  }

  const heroWon = hand.result.winners.includes(hand.heroId);
  const names = hand.result.winners
    .map((id) => (hand.seats.find((s) => s.id === id) || {}).name || id)
    .join(` ${t('and')} `);

  return el('div.panel',
    el('div.panel-title',
      el('h3', { style: { margin: 0 } },
        heroWon ? t('You won the pot') : t('{names} won the pot', { names })),
      el('span.badge' + (hand.result.net >= 0 ? '.green' : '.red'),
        `${fmt.signed(hand.result.net)} chips`),
    ),
    hand.result.showdown.length
      ? el('div.stack-sm', { style: { marginTop: '8px' } },
          hand.result.showdown.map((s) => {
            const seat = hand.seats.find((x) => x.id === s.id);
            const who = seat ? t(seat.name) : s.id;
            return el('div.faint', `${who}: ${t(s.description)}`);
          }))
      : el('div.faint', { style: { marginTop: '8px' } }, 'Everybody else folded, so no cards were shown.'),
    review.kind === 'cooler'
      ? el('div.notice', { style: { marginTop: '12px' } }, richText(
          t('**This one is not your fault.** You lost {amount}bb and the coach found nothing wrong with any '
            + 'decision in it. Hands like this are the reason results over a session say very little — the '
            + 'decisions are the only part you control, and these ones were right.',
          { amount: review.lostBb.toFixed(1) })))
      : review.mistakeCount > 1
        ? el('div.notice.warn', { style: { marginTop: '12px' } },
            t('{n} decisions in this hand went wrong. The red marks on the timeline are all of them.',
              { n: review.mistakeCount }))
        : null,
  );
}

/**
 * Whole sentences rather than a verb glued to a name: Dutch does not put the
 * words in the same order, and a template that has to be assembled from
 * fragments cannot be reordered by a translator.
 */
function actionLine(step, seat) {
  const you = seat && seat.isHero;
  // "You" and "Them" are labels this app chose and should be translated; a
  // bot's name is a name, and t() leaves anything it has no entry for alone.
  const name = seat ? t(seat.name) : step.id;
  switch (step.action) {
    case 'fold': return you ? t('You folded') : t('{name} folds', { name });
    case 'check': return you ? t('You checked') : t('{name} checks', { name });
    case 'call': return you
      ? t('You called {amount}', { amount: fmt.chips(step.paid) })
      : t('{name} calls {amount}', { name, amount: fmt.chips(step.paid) });
    case 'bet': return you
      ? t('You bet {amount}', { amount: fmt.chips(step.to) })
      : t('{name} bets {amount}', { name, amount: fmt.chips(step.to) });
    case 'raise': return you
      ? t('You raised to {amount}', { amount: fmt.chips(step.to) })
      : t('{name} raises to {amount}', { name, amount: fmt.chips(step.to) });
    default: return `${name}: ${t(step.action)}`;
  }
}

function metric(k, v, tone = '') {
  return el('div.coach-metric', el('span.k', k), el(`span.v${tone ? `.${tone}` : ''}`, v));
}
