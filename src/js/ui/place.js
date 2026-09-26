/**
 * The pieces every place on the river is built from: a scene to stand in,
 * and somebody talking to you.
 *
 * The map and the stops had them and the study screens did not, which is why
 * walking from a stop into a lesson felt like leaving the game for a website.
 * Every screen that is a place now opens on its scene, and the one who runs
 * it speaks — the bosses at their tables, Silas in the school and the pilot
 * house.
 */

import { el } from './dom.js';
import { t } from '../i18n/index.js';
import { sceneSvg } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import { MENTOR } from '../data/characters.js';

/** Build a node from a trusted SVG string drawn by riverArt/portraits. */
export function svgNode(markup, className = '') {
  const wrap = el(`span${className ? `.${className}` : ''}`);
  wrap.innerHTML = markup;
  return wrap;
}

/**
 * The scene at the top of a place: the room's hour of the day, the far bank,
 * the water and the building, with the place's name lettered over the sky.
 */
export function sceneBanner({ id, landmark, title, kicker = null, badge = null, className = '' }) {
  return el(`div.scene${className ? `.${className}` : ''}`,
    svgNode(sceneSvg({ id, landmark, orbLeft: false, scale: 1.6 }), 'scene-art-wrap'),
    el('div.scene-title',
      kicker ? el('div.scene-where', kicker) : null,
      el('h1.sign', title),
      badge ? el('span.scene-stake', badge) : null,
    ),
  );
}

/**
 * Words appearing a few at a time, the way a character speaks in a game.
 * The whole line is laid out invisibly first, so the bubble is its final
 * size from the start and nothing below it jumps as the words arrive; it is
 * also what a screen reader reads. The typed copy sits over it. A tap
 * finishes it.
 */
export function typedText(text) {
  const shown = el('span.typed-shown', { 'aria-hidden': 'true' });
  const node = el('span.typed', el('span.typed-ghost', text), shown);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { shown.textContent = text; return node; }
  let i = 0;
  const step = () => {
    i = Math.min(text.length, i + 2);
    shown.textContent = text.slice(0, i);
    if (i < text.length && node.isConnected) setTimeout(step, 24);
    else shown.textContent = text;
  };
  node.addEventListener('click', () => { i = text.length; shown.textContent = text; });
  setTimeout(step, 200);
  return node;
}

/**
 * Somebody saying something: their cameo, and a paper bubble with the line.
 * `who` is a portrait key; the name plate is optional, since a bubble next to
 * a face already says who is talking.
 */
export function says(who, line, { name = null, size = 72, typed = true, className = '', after = null } = {}) {
  const text = typed ? typedText(line) : line;
  return el(`div.says${className ? `.${className}` : ''}`,
    svgNode(portraitSvg(who, { size }), 'says-face'),
    el('div.bubble.paper',
      name ? el('div.says-name', name) : null,
      el('p.said', text),
      after,
    ),
  );
}

/** Silas, specifically. */
export const silasSays = (line, opts = {}) => says(MENTOR.key, line, { name: MENTOR.name, ...opts });

/** One of Silas's short verdicts, chosen at random so a run does not repeat. */
export function silasVerdict(right) {
  const list = right ? MENTOR.right : MENTOR.wrong;
  return t(list[Math.floor(Math.random() * list.length)]);
}

/**
 * XP earned, flown up to the rank on the rail — so the number you just
 * earned visibly goes somewhere, instead of a total silently ticking over.
 */
export function xpPop(amount) {
  if (typeof document === 'undefined' || !amount) return;
  const target = document.querySelector('#topbar .rank-chip');
  const box = target ? target.getBoundingClientRect() : { left: window.innerWidth - 160, bottom: 60, width: 120 };
  const pop = el('div.xp-pop', `+${amount} XP`);
  pop.style.left = `${Math.round(box.left + box.width / 2)}px`;
  pop.style.top = `${Math.round(box.bottom + 8)}px`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1400);
}

/**
 * A row of lanterns, one per question in a run: dark until it is asked,
 * then lit for a right answer or burnt red for a wrong one.
 */
export function lanterns(results, total) {
  return el('div.lanterns', { role: 'img', 'aria-label': t('{right} of {done} right so far.', {
    right: results.filter(Boolean).length, done: results.length,
  }) },
    Array.from({ length: total }, (_, i) => {
      const r = results[i];
      return el(`span.lantern${r === true ? '.lit' : r === false ? '.burnt' : i === results.length ? '.now' : ''}`, lanternSvg());
    }),
  );
}

function lanternSvg() {
  return svgNode('<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">'
    + '<path class="l-ring" d="M9 4a3 3 0 0 1 6 0"/>'
    + '<path class="l-cap" d="M7 7h10l-1 3H8z"/>'
    + '<path class="l-glass" d="M8 10h8l1 14H7z"/>'
    + '<path class="l-flame" d="M12 14c2 3 2 5 0 7-2-2-2-4 0-7z"/>'
    + '<path class="l-base" d="M6 24h12v3H6z"/></svg>', 'lantern-art');
}

/** A rubber stamp, struck at an angle: PASSED, or KEEP AT IT. */
export function stamp(text, tone = 'good') {
  return el(`div.stamp.${tone}`, text);
}
