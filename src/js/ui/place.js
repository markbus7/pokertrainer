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
import { sceneSvg, BOAT_ART, yourBoat } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import { icon } from './icons.js';
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
export function sceneBanner({ id, landmark, title, kicker = null, badge = null, className = '', boat = null }) {
  return el(`div.scene${className ? `.${className}` : ''}`,
    svgNode(sceneSvg({ id, landmark, orbLeft: false, scale: 1.6, boat }), 'scene-art-wrap'),
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
  return el(`div.says${className ? `.${className}` : ''}`, { 'data-who': who },
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

/** One line from a list, chosen at random so a run does not repeat itself. */
export function pickLine(list) {
  return t(list[Math.floor(Math.random() * list.length)]);
}

/** One of Silas's short verdicts. */
export function silasVerdict(right) {
  return pickLine(right ? MENTOR.right : MENTOR.wrong);
}

/**
 * A verdict said by somebody, above the explanation: a small cameo and one
 * short line. The explanation under it stays the lesson's own words.
 */
export function voiceLine(who, line, { size = 36 } = {}) {
  return el('div.silas-line', svgNode(portraitSvg(who, { size }), 'silas-face'), el('span', line));
}

/**
 * The sign over a room: a board with the room's name burnt into it. The
 * rooms are the records — the log, the chart room, the almanac, your cabin —
 * which are somewhere you go to look something up rather than somewhere on
 * the river, so they get a sign over the door instead of a whole reach.
 */
export function roomSign({ glyph = null, title, kicker = null, aside = null }) {
  return el('div.room-sign',
    el('span.room-nail'), el('span.room-nail.right'),
    el('div.room-board',
      glyph ? el('span.room-glyph', icon(glyph, { size: 22 })) : null,
      el('div',
        kicker ? el('div.room-kicker', kicker) : null,
        el('h1.sign', title),
      ),
      aside ? el('div.room-aside', aside) : null,
    ),
  );
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

/**
 * The assayer's tally: a coin per figure, gold when it weighed true and
 * lead when it did not.
 */
export function coins(results, total) {
  return el('div.lanterns.coins', { role: 'img', 'aria-label': t('{right} of {done} right so far.', {
    right: results.filter(Boolean).length, done: results.length,
  }) },
    Array.from({ length: total }, (_, i) => {
      const r = results[i];
      return el(`span.tally-coin${r === true ? '.gold' : r === false ? '.lead' : i === results.length ? '.now' : ''}`, coinSvg());
    }),
  );
}

function coinSvg() {
  return svgNode('<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
    + '<circle class="c-rim" cx="12" cy="12" r="10"/>'
    + '<circle class="c-face" cx="12" cy="12" r="6.6"/>'
    + '<path class="c-mark" d="M12 8.5v7M10 10.2q2-1.6 4 0M10 13.8q2 1.6 4 0"/>'
    + '<path class="c-crack" d="M6.5 7.5l4 4.2-1.8 2.4 3.6 4.4"/></svg>', 'coin-art');
}

/**
 * The race, drawn as it is run: your boat and the Belle on two lanes of the
 * same reach. Yours moves one reach for every right answer; the Belle moves
 * the same steady distance for every answer given, and her pace is the pass
 * mark, so at the last question the boat in front is the verdict.
 *
 * `results` is right/wrong per answer, `boat` the key of the boat you have
 * now, so you race in whatever you have worked your way up to.
 */
export function raceStrip(results, total, passMark, { boat = 'rowboat', rival = 'The Belle' } = {}) {
  const right = results.filter(Boolean).length;
  const bellePace = (passMark - 0.5) / total;
  const belle = bellePace * results.length;
  // A boat's left edge runs from the start of the lane to one boat short of
  // its end, so a boat that has made every reach sits with its bow on the
  // landing rather than past it.
  const at = (reaches) => `calc(${Math.min(1, reaches / total).toFixed(4)} * (100% - var(--racer-w)))`;
  const ahead = right > belle ? 'you' : right < belle ? 'belle' : 'level';
  return el(`div.race.lead-${ahead}`, { role: 'img', 'aria-label': t('{right} of {done} right so far.', {
    right, done: results.length,
  }) },
    el('div.race-lane.rival',
      el('span.race-name', t(rival)),
      el('span.race-boat', { style: { left: at(belle) } }, racerNode('sternwheeler', 'rival-art')),
    ),
    el('div.race-lane.mine',
      el('span.race-name', t('You')),
      el('span.race-boat', { style: { left: at(right) } }, racerNode(boat, 'you')),
    ),
    el('span.race-finish', { 'aria-hidden': 'true' }),
    el('div.race-marks', Array.from({ length: total }, (_, i) => el('span', { style: { left: `calc(${at(i + 1)} + var(--racer-w))` } }))),
  );
}

/**
 * How far in front, or behind, the race finished — in boat lengths, because
 * that is how a race on the river is told afterwards. The Belle's last
 * position is half a reach under the pass mark, so the margin is never a
 * dead heat and is never a whole number of lengths.
 */
export function raceMargin(correct, passMark) {
  const gap = Math.abs(correct - (passMark - 0.5));
  const lengths = gap === 0.5 ? t('half a length')
    : t('{n} lengths', { n: `${Math.floor(gap)}½` });
  return correct >= passMark ? t('won by {margin}', { margin: lengths }) : t('lost by {margin}', { margin: lengths });
}

function racerNode(key, className) {
  // Drawn facing left on the map; turned round here, since the race runs
  // left to right and a boat goes bow first.
  const art = className === 'you' ? yourBoat(key) : `<g class="${className}">${(BOAT_ART[key] || BOAT_ART.rowboat)()}</g>`;
  return svgNode(`<svg viewBox="-30 -34 60 46" width="64" height="49" aria-hidden="true"><g transform="scale(-1 1)">${art}</g></svg>`, 'racer');
}

/** The lamp over a table: a brass shade on a cord, and the light it throws. */
const LAMP = '<svg class="lamp-art" viewBox="0 0 140 46" aria-hidden="true">'
  + '<path class="lamp-cord" d="M70 0v11"/>'
  + '<path class="lamp-shade" d="M46 11h48l17 21H29z"/>'
  + '<path class="lamp-rim" d="M29 32h82"/>'
  + '<ellipse class="lamp-bulb" cx="70" cy="36" rx="11" ry="4.5"/></svg>';

export const lampNode = () => svgNode(LAMP, 'saloon-lamp');

/** A rubber stamp, struck at an angle: PASSED, or KEEP AT IT. */
export function stamp(text, tone = 'good') {
  return el(`div.stamp.${tone}`, text);
}
