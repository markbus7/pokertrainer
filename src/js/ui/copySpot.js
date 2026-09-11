/**
 * "Copy this question" — a button that turns whatever is on screen into plain
 * text you can paste somewhere else to ask about it.
 *
 * Asking a good question about a poker spot means reproducing the spot, and
 * retyping five cards, a pot, four options and your own answer is enough work
 * that nobody does it. So the game writes it out.
 */

import { el } from './dom.js';
import { t } from '../i18n/index.js';
import { cardsToString } from '../core/cards.js';
import { VERSION } from '../version.js';

/**
 * @param {object} spot
 * @param {string} [spot.module]      which lesson or drill this came from
 * @param {object} [spot.scenario]    board / hole / villain / pot, as the drills carry it
 * @param {string} spot.question
 * @param {Array}  [spot.options]     [{key, label}]
 * @param {string} [spot.correct]     the right answer, as text
 * @param {string} [spot.given]       what the reader actually answered
 * @param {string} [spot.explanation]
 * @returns {string} plain text, safe to paste anywhere
 */
export function spotToText(spot) {
  const lines = [`Poker Trainer v${VERSION}${spot.module ? ` — ${spot.module}` : ''}`];
  const sc = spot.scenario || {};

  if (sc.position) lines.push(`Position: ${sc.positionName || sc.position}`);
  if (sc.hole && sc.hole.length) lines.push(`My hand: ${cardsToString(sc.hole)}`);
  if (sc.board && sc.board.length) lines.push(`Board: ${cardsToString(sc.board)}`);
  if (sc.revealVillain && Array.isArray(sc.villain)) {
    lines.push(`Their hand (face up): ${cardsToString(sc.villain)}`);
  }
  if (Array.isArray(sc.hands)) {
    for (const h of sc.hands) lines.push(`${h.label}: ${cardsToString(h.cards)}`);
  }
  if (Array.isArray(sc.compare)) {
    sc.compare.forEach((hand, i) => lines.push(`Hand ${i === 0 ? 'A' : 'B'}: ${cardsToString(hand)}`));
  }
  // "Pot: 50 / To call: 25" reads as a pot of 50 that costs 25 to enter, so
  // the price looks like 25 of 75. In these spots the 50 is what was there
  // before the bet, and by the time it is your turn the pot holds both.
  if (sc.pot != null && sc.toCall != null) {
    lines.push(`Pot before their bet: ${sc.pot}`);
    lines.push(`To call: ${sc.toCall}`);
    lines.push(`Pot now: ${sc.pot + sc.toCall}`);
  } else {
    if (sc.pot != null) lines.push(`Pot: ${sc.pot}`);
    if (sc.toCall != null) lines.push(`To call: ${sc.toCall}`);
  }
  if (sc.betSize != null) lines.push(`My bet: ${sc.betSize}`);
  if (sc.effectiveStack != null) lines.push(`Effective stack: ${sc.effectiveStack}`);

  lines.push('', `Q: ${spot.question}`);
  if (spot.options && spot.options.length) {
    lines.push(`Options: ${spot.options.map((o) => o.label).join(' / ')}`);
  }
  if (spot.given != null) lines.push(`I answered: ${spot.given}`);
  if (spot.correct != null) lines.push(`Correct answer: ${spot.correct}`);
  if (spot.explanation) lines.push('', `The game explained: ${stripMarkup(spot.explanation)}`);
  return lines.join('\n');
}

/** The explanations carry **bold** markers, which are noise once out of the app. */
const stripMarkup = (text) => String(text).replace(/\*\*/g, '');

/**
 * The button itself. Copying can fail — an insecure context, a browser that
 * refuses, permissions — so a failure falls back to putting the text on screen
 * where it can be selected by hand rather than silently doing nothing.
 */
export function copyButton(getSpot, { className = 'btn.sm.ghost' } = {}) {
  const wrap = el('div');
  const button = el(`button.${className}`, {
    onclick: async () => {
      const text = spotToText(getSpot());
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = t('Copied ✓');
        setTimeout(() => { button.textContent = t('📋 Copy this question'); }, 2000);
      } catch {
        wrap.appendChild(el('textarea.copy-fallback', {
          readOnly: true,
          onclick: (e) => e.target.select(),
        }, text));
        button.disabled = true;
      }
    },
  }, t('📋 Copy this question'));
  wrap.appendChild(button);
  return wrap;
}
