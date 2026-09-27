/**
 * A stretch of water drawn down the page, for the places that are regions of
 * the chart rather than stops on it: School Creek, where the chapters are,
 * and the pilot's channel, where the charts are learned.
 *
 * The reader wanted the lessons and the ranges on the map, not behind two
 * tabs. The world map shows where the school and the pilot house are; going
 * in is going up their water. Every chapter or chart is a stop on it, the
 * banks are dressed like the big chart — woods, mountains, a mill — and at
 * the bottom the creek runs out into the Long River, which is the way back.
 *
 * It is drawn a row at a time. Each row carries its own bend of water that
 * starts and ends at the middle of the channel, so the water runs unbroken
 * however tall a row grows with its text, on a phone or a desktop. As on the
 * big chart, no shape carries a colour: river.css paints them from the
 * room's map tokens.
 */

import { el } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { svgNode } from './place.js';
import { LANDMARKS, yourBoat } from './riverArt.js';

/* ------------------------------------------------------------------ *
 * The water
 * ------------------------------------------------------------------ */

/**
 * One bend of the creek, filling its row. Drawn in a 100 x 100 box that is
 * stretched to the row, with strokes that do not stretch with it, so the
 * water is the same width in a short row and a tall one.
 */
export function creekBend(i, { from = 'top' } = {}) {
  const out = i % 2 === 0 ? 74 : 26;
  const back = 100 - out;
  const start = from === 'spring' ? 'M50 30C50 42' : 'M50 0C50 20';
  const d = `${start} ${out} 30 50 50C${back} 70 50 80 50 100`;
  return svgNode('<svg class="creek-bend-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'
    + `<path class="creek-sand" d="${d}"/><path class="creek-edge" d="${d}"/>`
    + `<path class="creek-water" d="${d}"/><path class="creek-current" d="${d}"/></svg>`, 'creek-bend');
}

/** The spring the creek rises from, among rocks, at the head of the page. */
function spring() {
  return svgNode('<svg class="creek-bend-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'
    + '<path class="creek-sand" d="M50 0V100"/><path class="creek-edge" d="M50 0V100"/>'
    + '<path class="creek-water" d="M50 0V100"/><path class="creek-current" d="M50 0V100"/></svg>'
    + '<svg class="creek-spring-art map-art world-art" viewBox="0 0 120 80" aria-hidden="true">'
    + '<ellipse class="spring-pool" cx="60" cy="60" rx="26" ry="12"/>'
    + '<path class="hill" d="M22 64L34 44L46 60Z"/><path class="hill-shade" d="M34 44L46 60L38 62Z"/>'
    + '<path class="hill" d="M74 62L88 40L102 64Z"/><path class="hill-shade" d="M88 40L102 64L92 64Z"/>'
    + '<path class="reeds" d="M40 66v-8M43 67v-7M78 66v-8M81 67v-6"/></svg>', 'creek-bend creek-spring');
}

/* ------------------------------------------------------------------ *
 * The banks
 * ------------------------------------------------------------------ */

const f1 = (n) => Math.round(n * 10) / 10;

function pine(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">`
    + '<ellipse class="tree-shade" cx="3" cy="2" rx="8" ry="2.6"/>'
    + '<path class="tree-lit" d="M0 -22L8.5 2H-8.5Z"/><path class="tree-crown" d="M0 -22L8.5 2H0Z"/></g>';
}

function broadleaf(x, y, r = 9) {
  return `<g transform="translate(${x} ${y})">`
    + `<ellipse class="tree-shade" cx="${f1(r * 0.4)}" cy="${f1(r * 0.9)}" rx="${r}" ry="${f1(r * 0.35)}"/>`
    + `<circle class="tree-lit" r="${r}"/>`
    + `<path class="tree-crown" d="M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${f1(r * 0.62)} ${r} 0 0 0 0 ${-r}Z"/></g>`;
}

function peak(x, base, w, h) {
  const top = `${x} ${base - h}`;
  return `<path class="hill" d="M${x - w / 2} ${base}L${top}L${x + w / 2} ${base}Z"/>`
    + `<path class="hill-shade" d="M${top}L${x + w / 2} ${base}L${x + w * 0.08} ${base}Z"/>`
    + `<path class="hill-snow" d="M${top}L${f1(x - w * 0.1)} ${f1(base - h * 0.78)}L${f1(x - w * 0.02)} ${f1(base - h * 0.82)}L${f1(x + w * 0.05)} ${f1(base - h * 0.76)}L${f1(x + w * 0.12)} ${f1(base - h * 0.8)}Z"/>`;
}

/**
 * What stands on the far bank of each bend: mountains where the creek rises,
 * woods and a mill and farms along the middle, and reeds and a fishing hut
 * where it meets the river. Each is a small drawing in a 200 x 120 box.
 */
const SCENES = {
  mountains: () => peak(58, 112, 96, 78) + peak(136, 112, 110, 96) + pine(22, 112) + pine(36, 116, 0.9) + pine(170, 114) + pine(184, 110, 0.8),
  pines: () => [[30, 70], [52, 64], [74, 72], [44, 90], [66, 94], [90, 88], [112, 76], [134, 84], [120, 100], [150, 96], [98, 108], [168, 104]]
    .map(([x, y], k) => pine(x, y, 0.8 + (k % 3) * 0.12)).join(''),
  prospectors: () => '<path class="field" d="M20 108h160"/>'
    + '<path class="wall ink" d="M36 104L60 66L84 104Z"/><path class="ink" d="M60 66V104M52 104l8 -14 8 14"/>'
    + '<path class="wall ink" d="M92 104L110 76L128 104Z"/><path class="ink" d="M110 76V104"/>'
    + '<path class="ink" d="M140 104l12 -6M146 104l10 -8"/><path class="glow" d="M146 102q2-10 6-2q2-7 5 2z"/>'
    + '<ellipse class="wall ink" cx="172" cy="104" rx="9" ry="3"/>'
    + pine(20, 100, 0.8) + pine(184, 92, 0.9),
  mill: () => '<path class="shallows" d="M100 104h90v10h-90z"/>'
    + '<path class="wall ink" d="M30 106V62h60v44z"/><path class="roof ink" d="M24 62L60 36L96 62z"/>'
    + '<rect class="glow" x="42" y="72" width="10" height="10"/><rect class="glow" x="66" y="72" width="10" height="10"/>'
    + '<path class="roof ink" d="M54 106V90h12v16z"/>'
    + '<circle class="wall ink" cx="112" cy="86" r="20"/><circle class="ink" cx="112" cy="86" r="4"/>'
    + '<path class="ink" d="M112 66v40M92 86h40M98 72l28 28M126 72l-28 28"/>'
    + broadleaf(160, 84, 11) + broadleaf(178, 96, 9),
  grove: () => [[34, 70, 12], [60, 62, 14], [86, 74, 11], [48, 94, 13], [76, 98, 12], [104, 90, 14], [128, 70, 11], [150, 84, 13], [134, 104, 10], [170, 100, 12]]
    .map(([x, y, r]) => broadleaf(x, y, r)).join(''),
  farm: () => '<path class="field" d="M20 78h78l12 32h-78z"/>'
    + '<path class="furrow" d="M26 84h74M29 90h74M32 96h74M35 102h74"/>'
    + '<path class="wall ink" d="M124 108V74h44v34z"/><path class="roof ink" d="M118 74L146 52L174 74z"/>'
    + '<rect class="glow" x="134" y="84" width="8" height="8"/><path class="roof ink" d="M150 108V92h9v16z"/>'
    + broadleaf(186, 94, 9),
  hut: () => '<path class="shallows" d="M10 100h180v14h-180z"/>'
    + '<path class="ink" d="M44 112V96M76 112V96"/><path class="roof ink" d="M36 96h48v-3h-48z"/>'
    + '<path class="wall ink" d="M42 93V70h36v23z"/><path class="roof ink" d="M38 70L60 54L82 70z"/>'
    + '<rect class="glow" x="52" y="78" width="8" height="8"/>'
    + '<path class="roof ink" d="M110 104h46l-6 5h-34z"/><path class="ink" d="M132 104l18 -30M150 74q10 18 6 34"/>'
    + '<path class="reeds" d="M170 100v-10M174 101v-8M166 101v-7M20 100v-9M24 101v-7"/>',
  heron: () => '<path class="shallows" d="M10 100h180v14h-180z"/>'
    + '<path class="reeds" d="M30 102v-16M35 103v-12M40 102v-18M45 103v-10M150 102v-16M155 103v-12M160 102v-18M165 103v-11M170 102v-14"/>'
    + '<path class="ink" d="M96 104V86M104 104V86"/>'
    + '<path class="wall ink" d="M88 86q12 -24 28 -8q-10 12 -28 8z"/>'
    + '<path class="ink" d="M112 80q4 -16 -6 -22q-6 -4 -2 -10l14 2"/>'
    + '<circle class="glow" cx="106" cy="49" r="1.6"/>',
};

/*
 * The pilot's channel has what a pilot learns a river by: the snags, the
 * sandbars, a wreck to steer wide of, the daymarks on the bank — and a
 * lighthouse at the end, where the exam is.
 */
Object.assign(SCENES, {
  snag: () => '<path class="shallows" d="M10 100h180v14h-180z"/>'
    + '<path class="ink" d="M92 106L96 60M96 72l-16 -14M95 82l18 -12M96 60l6 -12M96 60l-8 -8"/>'
    + '<path class="ink" d="M140 106l2 -20M141 94l-8 -6"/>' + broadleaf(40, 88, 11) + broadleaf(170, 90, 9),
  sandbar: () => '<path class="shallows" d="M10 96h180v18h-180z"/>'
    + '<path class="beach-bar" d="M40 104q40-14 90-6q30 4 40 6q-60 8-130 0z"/>'
    + '<path class="reeds" d="M60 100v-8M64 101v-7M120 99v-8M124 100v-6"/>'
    + '<path class="birds" d="M84 70q5-5 10 0q5-5 10 0M112 58q4-4 8 0q4-4 8 0"/>',
  wreck: () => '<path class="shallows" d="M10 96h180v18h-180z"/>'
    + '<path class="ink" d="M78 104V70M92 104V64M78 70h-6M92 64h6"/>'
    + '<path class="roof ink" d="M60 104l10 -8h50l6 8z"/>'
    + '<path class="ink" d="M104 96l14 -18"/><path class="mark ink" d="M118 78l8 3-8 3z"/>'
    + broadleaf(30, 90, 10) + pine(172, 98),
  beacon: () => '<path class="field" d="M20 110h160"/>'
    + '<path class="ink" d="M100 110V56"/><path class="wall ink" d="M86 56l14 -20 14 20z"/>'
    + '<path class="mark ink" d="M92 60h16v10h-16z"/>'
    + pine(40, 108) + pine(56, 112, 0.8) + broadleaf(150, 96, 12),
  lighthouse: () => '<path class="shallows" d="M10 100h180v14h-180z"/>'
    + '<path class="wall ink" d="M86 106L90 44h20l4 62z"/><path class="roof ink" d="M86 44h28l-14 -12z"/>'
    + '<rect class="glow" x="94" y="46" width="12" height="8"/><path class="light-beam" d="M106 50L180 30V70Z"/>'
    + '<path class="ink" d="M91 70h18M89 88h22"/>' + pine(40, 104) + pine(58, 108, 0.8),
});

/** The banks from the source to the mouth, in the order a creek has them. */
const BANKS = {
  creek: ['mountains', 'pines', 'prospectors', 'mill', 'grove', 'farm', 'pines', 'grove', 'mill', 'farm', 'hut', 'heron'],
  channel: ['beacon', 'snag', 'grove', 'sandbar', 'wreck', 'pines', 'heron', 'lighthouse'],
};

/** The far-bank drawing for row i of n, upstream to downstream. */
export function bankScene(i, n, set = 'creek') {
  const banks = BANKS[set] || BANKS.creek;
  const key = banks[Math.min(banks.length - 1, Math.round((i / Math.max(1, n - 1)) * (banks.length - 1)))];
  return svgNode(`<svg class="map-art world-art creek-scene-art" viewBox="0 0 200 120" aria-hidden="true">${SCENES[key]()}</svg>`, `creek-scene scene-${key}`);
}

/* ------------------------------------------------------------------ *
 * Head and mouth
 * ------------------------------------------------------------------ */

/**
 * The top of a region: its name lettered like the big chart's cartouche, the
 * place it is named for drawn on the bank, and the spring the water rises
 * from.
 */
export function creekHead({ kicker, title, landmark, extra = null }) {
  return el('div.creek-row.creek-head',
    el('div.creek-cell.side.creek-place',
      svgNode(`<svg class="map-art world-art creek-place-art" viewBox="-60 -56 120 84" aria-hidden="true">`
        + '<path class="ground" d="M-56 20h112"/>'
        + `${(LANDMARKS[landmark] || LANDMARKS.landing)()}</svg>`, 'creek-place-pic'),
    ),
    el('div.creek-cell.water', spring()),
    el('div.creek-cell.side.creek-title',
      el('div.creek-kicker', kicker),
      el('h1.sign.creek-name', title),
      extra,
    ),
  );
}

/**
 * The bottom of a region: the water running out into the Long River, your
 * boat at the jetty, and the way back to the big chart.
 */
export function creekMouth({ go, boat }) {
  return el('div.creek-mouth',
    el('div.creek-row.creek-last',
      el('div.creek-cell.side'),
      el('div.creek-cell.water', creekBend(1)),
      el('div.creek-cell.side'),
    ),
    el('div.creek-river',
      svgNode(`<svg class="creek-river-boat" viewBox="-34 -36 68 50" aria-hidden="true"><g class="bob">${yourBoat(boat)}</g></svg>`, 'creek-boat'),
      el('button.btn.plank.creek-home', { onclick: () => go('home') }, icon('river', { size: 18 }), ' ', t('Down to the Long River')),
    ),
  );
}

/** Where you are on the chart, and the way back out, above a region. */
export function regionBar({ go, name }) {
  return el('nav.region-bar', { 'aria-label': t('Where you are') },
    el('button.region-back', { onclick: () => go('home') }, icon('arrowLeft', { size: 16 }), ' ', t('The Long River')),
    el('span.region-sep', { 'aria-hidden': 'true' }, '›'),
    el('span.region-here', name),
  );
}
