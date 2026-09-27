/**
 * The help drawer at the table: Silas, and whichever companions you have
 * brought.
 *
 * Free play means nobody talks you through a hand. Help is there when you
 * ask for it — a button, not a voice at your shoulder — and asking has the
 * same price every drill charges for looking an answer up: the decision still
 * teaches, but it earns no pearls and does not count as solved on your own.
 *
 * What help you get depends on what you own. Silas always names the kind of
 * question the spot is asking and repeats the facts on the felt; he does not
 * do the sum. Each companion does one thing the chapters teach, and only for
 * somebody who has read that chapter to the end — the owl works out the
 * price, the cat sits on the chart, the raccoon counts outs, the turtle
 * knows the stack depth, the hound reads the table, and the parrot says what
 * Silas would do outright.
 */

import { el, fmt } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { moduleMeta } from '../data/curriculum.js';
import { MENTOR } from '../data/characters.js';
import { companionByKey } from '../state/economy.js';
import { potOddsRatio } from '../core/odds.js';
import { handKey } from '../core/cards.js';
import { rangeGridFor } from './reference.js';
import { svgNode } from './place.js';
import { portraitSvg } from './portraits.js';

/**
 * @param {object} h
 * @param {Array} h.owned        companions owned, from ownedCompanions()
 * @param {object} h.snap        the decision snapshot (lessonRunner.snapshotOf)
 * @param {object} h.spot        conceptOf(snap): {id, why}
 * @param {string} h.handText    your hand, described
 * @param {Array} h.opponents    [{name, style, read, adjusted}] for the players still in
 * @param {Function} h.bestAction  () => {label, verdict} — what Silas would do
 * @param {string|null} h.focus  a companion key to open on, or null
 * @param {Function} h.onClose
 */
export function helpDrawer(h) {
  const sections = [silasSection(h), ...h.owned.map((c) => companionSection(c, h))];
  const drawer = el('div.help-drawer.paper', { role: 'region', 'aria-label': t('Help') },
    el('div.help-head',
      el('span.help-title', icon('help', { size: 18 }), t('Help for this decision')),
      el('span.faint.help-cost', t('Asking costs this decision its pearl, and it will not count as solved on your own.')),
      el('button.btn.sm.ghost', { onclick: h.onClose }, t('Close')),
    ),
    el('div.help-sections', sections),
    h.owned.length
      ? null
      : el('div.faint.help-more', icon('paw', { size: 14 }), ' ',
        t('Companions from the Trading Post add more here: the price, the chart, your outs, the table\'s habits.')),
  );
  if (h.focus) {
    requestAnimationFrame(() => {
      const target = drawer.querySelector(`[data-helper="${h.focus}"]`);
      if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  return drawer;
}

function section(key, who, name, body) {
  return el('section.help-section', { dataset: { helper: key } },
    svgNode(portraitSvg(who, { size: 40 }), 'help-face'),
    el('div.help-body',
      el('div.help-name', name),
      body,
    ),
  );
}

function fact(k, v) {
  return el('div.coach-metric', el('span.k', k), el('span.v', v));
}

/** Silas: what kind of question this is, and the facts on the felt. */
function silasSection({ snap, spot, handText }) {
  const meta = spot ? moduleMeta(spot.id) : null;
  return section('silas', MENTOR.key, MENTOR.short,
    el('div',
      meta
        ? el('div.help-said', t('This is a {skill} decision.', { skill: t(meta.name) }), ' ', spot ? t(spot.why) : '')
        : el('div.help-said', t('Take your time. What do you know about this spot?')),
      fact(t('Pot / to call'), `${fmt.chips(snap.pot)} / ${fmt.chips(snap.toCall)}`),
      fact(t('Opponents'), String(snap.opponents)),
      fact(t('Your hand'), handText),
    ));
}

function companionSection(c, h) {
  const title = `${c.name} · ${t(c.kind)}`;
  const body = {
    owl: owlSays,
    cat: catSays,
    raccoon: raccoonSays,
    turtle: turtleSays,
    hound: houndSays,
    parrot: parrotSays,
  }[c.key];
  return section(c.key, c.key, title, body ? body(h) : el('div'));
}

/** The owl does the sum: price, what it asks, and what you have. */
function owlSays({ snap }) {
  if (snap.toCall <= 0) {
    return el('div',
      el('div.help-said', t('Nobody has bet, so there is no price to pay. Checking costs nothing.')),
      fact(t('Your equity'), fmt.pct(snap.equity, 1)),
    );
  }
  return el('div',
    el('div.help-said', t('You are asked to put in {call} to win {pot}.', { call: fmt.chips(snap.toCall), pot: fmt.chips(snap.pot) })),
    fact(t('Pot odds'), `${potOddsRatio(snap.toCall, snap.pot).toFixed(1)} : 1`),
    fact(t('Equity needed'), fmt.pct(snap.needed, 1)),
    fact(t('Your equity'), fmt.pct(snap.equity, 1)),
  );
}

/** The cat sits on the chart for your seat, with your hand ringed. */
function catSays({ snap }) {
  if (snap.street !== 'preflop') {
    return el('div.help-said', t('The charts are for before the flop. Now the board decides what your hand is worth.'));
  }
  if (!snap.position || !snap.hole || snap.hole.length !== 2) {
    return el('div.help-said', t('No chart for this seat.'));
  }
  const raiser = snap.firstIn ? null : snap.raiser;
  if (!raiser && snap.position === 'BB') {
    return el('div.help-said', t('Everybody limped or folded to you in the big blind — there is no chart for this one.'));
  }
  return el('div',
    el('div.help-said', t('Your hand is ringed. Find it and read the colour.')),
    rangeGridFor({ seat: snap.position, raiser, hand: handKey(snap.hole) }),
  );
}

/** The raccoon counts the cards that save you. */
function raccoonSays({ snap }) {
  if (snap.street === 'preflop') return el('div.help-said', t('Nothing to count before the flop.'));
  if (snap.street === 'river') return el('div.help-said', t('No more cards are coming. What you have is what you have.'));
  const outs = snap.outs || 0;
  if (!outs) return el('div.help-said', t('No clean outs that I can find. You are ahead, or you are drawing thin.'));
  const cards = snap.street === 'flop' ? 2 : 1;
  const pct = Math.min(100, outs * (cards === 2 ? 4 : 2));
  return el('div',
    el('div.help-said', cards === 2
      ? t('{n} outs. Times four with two cards to come: about {pct}% to get there by the river.', { n: outs, pct })
      : t('{n} outs. Times two with one card to come: about {pct}% to get there on the river.', { n: outs, pct })),
    fact(t('Outs'), String(outs)),
  );
}

/** The turtle knows how deep the stacks are, and when the pot has you. */
function turtleSays({ snap }) {
  const bb = snap.bigBlind || 1;
  const stackBb = snap.effectiveStack / bb;
  if (snap.street === 'preflop') {
    return el('div',
      el('div.help-said', t('Stacks are {n} big blinds deep. Plan the hand now: how big will this pot get if you play it?', { n: Math.round(stackBb) })),
      fact(t('Effective stack'), t('{n} bb', { n: Math.round(stackBb) })),
    );
  }
  const spr = snap.spr;
  const line = !Number.isFinite(spr) ? t('Nobody has anything behind. The pot is all that is left.')
    : spr < 2 ? t('Stack to pot under two: you are committed. A strong pair does not fold here — the money goes in.')
      : spr <= 5 ? t('A middling stack to pot. Top pair is worth getting the stacks in with; weaker pairs are not.')
        : t('Deep: one pair is not worth your whole stack. Play for sets, straights and flushes.');
  return el('div',
    el('div.help-said', line),
    fact('SPR', Number.isFinite(spr) ? spr.toFixed(1) : '∞'),
    fact(t('Effective stack'), t('{n} bb', { n: Math.round(stackBb) })),
  );
}

/** The hound reads everybody still in the hand. */
function houndSays({ opponents }) {
  if (!opponents.length) return el('div.help-said', t('Nobody left to read.'));
  return el('div.stack-sm',
    opponents.map((o) => el('div.help-read',
      el('div', el('strong', o.name), el('span.faint', ` · ${t(o.style)}`)),
      el('div.help-said', t(o.read)),
      o.adjusted ? el('div.faint', t('Has noticed how you play, and adjusted.')) : null,
    )),
  );
}

/** The parrot says what Silas would do, and why. */
function parrotSays({ bestAction }) {
  const best = bestAction();
  if (!best) return el('div.help-said', t('Squawk! Even I do not know this one.'));
  return el('div',
    el('div.help-said.help-answer', t('Silas would {action}.', { action: best.label })),
    el('div.help-said', t(best.verdict.head)),
    el('div.faint', t(best.verdict.body, best.verdict.params)),
  );
}

/** A companion's name for a tray button or a title. */
export function companionTitle(key) {
  const c = companionByKey(key);
  return c ? `${c.name} · ${t(c.kind)}` : key;
}
