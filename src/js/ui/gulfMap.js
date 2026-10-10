/**
 * The Gulf, drawn: the second act's chart.
 *
 * The Long River runs out through its delta into the sea, and the river map
 * stops at the coast. Past it is the Gulf — mostly water, with the mainland
 * along the top, the river's mouth at the top left where you come in, and
 * five ports on the coast and the islands: Salt Harbour on the shore, the
 * lighthouse on its headland, the pearl beds in open water, Hurricane Key
 * behind its reef, and the Admiralty on the last island at the end of the
 * sea lanes.
 *
 * It is drawn with the same named shapes as the river (`land`, `water`,
 * `landmark`, `route`…), so river.css paints it in every room's colours.
 */

import { LANDMARKS, yourBoat } from './riverArt.js';
import { fogLayer } from './fog.js';
import { t } from '../i18n/index.js';

/** The same coordinate space as the river chart, so the page lays both out alike. */
export const GULF = { W: 1600, H: 1000 };

const f1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * The five ports, in order: where each is drawn, where its plate hangs
 * (`side` 1 below, -1 above) and where a boat ties up in the water beside it.
 */
export const PORT_POINTS = [
  { x: 360, y: 228, side: 1, boat: [430, 318] },     // Salt Harbour
  { x: 752, y: 226, side: 1, boat: [700, 318] },     // Lighthouse Point
  { x: 1010, y: 470, side: 1, boat: [1010, 470] },   // The Pearl Banks: the schooner is the port
  { x: 620, y: 700, side: 1, boat: [520, 640] },     // Hurricane Key
  { x: 1330, y: 744, side: 1, boat: [1210, 690] },   // The Admiralty
];
export const portAt = (i) => PORT_POINTS[Math.max(0, Math.min(PORT_POINTS.length - 1, i))];

/** Where you come in from the river: the delta's mouth, top left. */
export const RIVER_MOUTH = { x: 92, y: 150 };

/**
 * Where the Gulf's chart is clear: the river's mouth you came out of, every
 * port you have been to and the next one. Null once the last port is reached.
 * As on the river, ports past `charted` are fresh and the fog draws back.
 *
 * @param {{best:number, charted?:number|null}} o  best is the furthest port reached, -1 for none
 */
export function gulfFog({ best, charted = null }) {
  const last = PORT_POINTS.length - 1;
  if (best >= last) return null;
  const reach = Math.min(last, Math.max(-1, best) + 1);
  const holes = [{ x: RIVER_MOUTH.x + 30, y: RIVER_MOUTH.y + 40, r: 190, fresh: false }];
  for (let i = 0; i <= reach; i++) {
    const p = PORT_POINTS[i];
    holes.push({ x: p.x, y: p.y + 20, r: 250, fresh: charted != null && i > charted });
  }
  return { holes, reach };
}

/** Catmull-Rom through the knots. *//** Catmull-Rom through the knots. */
function smooth(knots, per = 18) {
  const out = [];
  for (let s = 0; s < knots.length - 1; s++) {
    const p0 = knots[Math.max(0, s - 1)];
    const p1 = knots[s];
    const p2 = knots[s + 1];
    const p3 = knots[Math.min(knots.length - 1, s + 2)];
    for (let j = 0; j < per; j++) {
      const u = j / per;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(knots[knots.length - 1]);
  return out;
}
const line = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');

/** The mainland's shore, west to east. */
const SHORE = [[0, 196], [70, 168], [130, 196], [210, 250], [300, 272], [400, 262], [500, 232], [600, 196], [690, 182],
  [730, 222], [752, 268], [778, 226], [830, 176], [960, 214], [1100, 180], [1250, 132], [1420, 150], [1600, 118]];

/** An island as a closed, slightly irregular blob. */
function island(cx, cy, rx, ry, wobble, seed) {
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const k = 1 + wobble * Math.sin(a * 3 + seed) * Math.cos(a * 2 - seed);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  pts.push(pts[0], pts[1]);
  return `${line(smooth(pts, 6))}Z`;
}

/** The sea lane through the ports, from the river's mouth, in order. */
export function lane(fromPort, toPort) {
  const knots = [[RIVER_MOUTH.x + 40, RIVER_MOUTH.y + 60], ...PORT_POINTS.map((p) => p.boat)];
  const a = fromPort < 0 ? 0 : fromPort + 1;
  const b = toPort + 1;
  if (b <= a) return [knots[a]];
  return smooth(knots.slice(a, b + 1), 14);
}

/**
 * The chart. Indices are the ports' (0 Salt Harbour … 4 the Admiralty);
 * `here` is -1 when the boat is still on the river.
 */
export function gulfSvg({ here, best, open, beaten, boat, fog = null }) {
  const { W, H } = GULF;
  const shore = smooth(SHORE, 10);
  const mainland = `${line(shore)}L${W} 0L0 0Z`;
  const islands = [
    island(620, 732, 120, 70, 0.12, 1.3),    // Hurricane Key
    island(1330, 776, 190, 110, 0.1, 2.1),   // the Admiralty's island
    island(250, 560, 36, 22, 0.2, 0.4),
    island(1180, 330, 28, 18, 0.25, 1.7),
    island(930, 860, 44, 24, 0.18, 2.9),
    island(1520, 420, 30, 50, 0.15, 0.9),
  ];
  // Hills along the top of the mainland and woods down to the shore, so the
  // land reads as land in every room — the river's chart does it the same way.
  const hills = Array.from({ length: 11 }, (_, i) => {
    const x = 40 + i * 150 + ((i * 37) % 50);
    const y = 70 + ((i * 29) % 40);
    const w = 70 + ((i * 13) % 40);
    return `<path class="hill" d="M${x - w} ${y + 30}Q${x} ${y - 40} ${x + w} ${y + 30}Z"/>`;
  }).join('');
  const onLand = (x, y) => {
    for (let i = 1; i < shore.length; i++) {
      if (shore[i][0] >= x) return y < shore[i][1] - 26;
    }
    return false;
  };
  const trees = [];
  for (let i = 0; i < 160; i++) {
    const x = (i * 97 + 31) % 1600;
    const y = 30 + ((i * 53) % 230);
    if (onLand(x, y)) trees.push(`<circle class="tree-crown" cx="${x}" cy="${y}" r="${5 + (i % 3)}"/>`);
  }
  for (const [cx, cy, rx, ry, n] of [[620, 732, 90, 46, 14], [1330, 776, 150, 80, 22]]) {
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / n);
      const x = cx + Math.cos(a) * rx * r;
      const y = cy + Math.sin(a) * ry * r;
      if (Math.hypot((x - 620) / 40, (y - 700) / 30) < 1 || Math.hypot((x - 1330) / 60, (y - 744) / 36) < 1) continue;
      trees.push(`<circle class="tree-crown" cx="${f1(x)}" cy="${f1(y)}" r="${4 + (i % 3)}"/>`);
    }
  }
  const reef = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2;
    return `<circle class="reef" cx="${f1(620 + Math.cos(a) * 168)}" cy="${f1(732 + Math.sin(a) * 104)}" r="3"/>`;
  }).join('');
  // The pearl beds: buoys round the schooner.
  const beds = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    return `<circle class="buoy" cx="${f1(1010 + Math.cos(a) * 90)}" cy="${f1(500 + Math.sin(a) * 46)}" r="4"/>`;
  }).join('');
  // The river comes out through the delta at the top left.
  const mouth = `<path class="gulf-river" d="M0 70C40 84 70 108 ${RIVER_MOUTH.x} ${RIVER_MOUTH.y + 8}L${RIVER_MOUTH.x + 40} ${RIVER_MOUTH.y + 40}"/>`;

  const reached = Math.max(best, here);
  const route = reached >= 0 ? lane(-1, reached) : [];
  const ahead = lane(Math.max(-1, reached), PORT_POINTS.length - 1);

  const ports = PORT_POINTS.map((p, i) => {
    const shut = i > open && i > best;
    const cls = ['landmark', shut ? 'shut' : '', i === here ? 'here' : '', beaten.has(i) ? 'beaten' : ''].filter(Boolean).join(' ');
    return `<g class="${cls}" data-port="${i}" transform="translate(${p.x} ${p.y}) scale(0.9)">`
      + (i === here ? '<ellipse class="here-glow" cx="0" cy="2" rx="52" ry="36"/><ellipse class="here-ring" cx="0" cy="2" rx="52" ry="36"/>' : '')
      + (LANDMARKS[['customs', 'lighthouse', 'pearler', 'fort', 'admiralty'][i]])()
      + '</g>';
  }).join('');
  const tie = here >= 0 ? PORT_POINTS[here].boat : [RIVER_MOUTH.x + 40, RIVER_MOUTH.y + 60];

  const compass = '<g class="compass" transform="translate(1460 900) scale(1.5)">'
    + '<circle class="compass-ring" r="22"/><circle class="compass-ring" r="17"/>'
    + '<path class="compass-star" d="M0 -26L4 -4L0 0L-4 -4zM0 26L4 4L0 0L-4 4z"/>'
    + '<path class="compass-star dim" d="M-26 0L-4 -4L0 0L-4 4zM26 0L4 -4L0 0L4 4z"/>'
    + '<text class="compass-n" x="0" y="-30">N</text></g>';
  const ticks = [];
  for (let x = 100; x < W; x += 100) ticks.push(`M${x} 0v8M${x} ${H}v-8`);
  for (let y = 100; y < H; y += 100) ticks.push(`M0 ${y}h8M${W} ${y}h-8`);
  const waves = 'M180 420q8-5 16 0t16 0M420 860q8-5 16 0t16 0M860 640q8-5 16 0t16 0M1200 560q8-5 16 0t16 0M1420 300q8-5 16 0t16 0M300 760q8-5 16 0t16 0M1080 900q8-5 16 0t16 0M780 400q8-5 16 0t16 0';
  const label = (x, y, text, size = 22) => `<text class="water-name sea-name" x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${esc(text)}</text>`;

  return `<svg class="map-art world-art gulf-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
    <defs>
      <radialGradient id="gm-vignette" cx="50%" cy="48%" r="72%">
        <stop offset="62%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.3"/>
      </radialGradient>
    </defs>
    <rect class="water" x="0" y="0" width="${W}" height="${H}"/>
    ${[12, 28, 48].map((dy, k) => `<path class="sea-line l${k}" d="${line(shore.map(([x, y]) => [x, y + dy]))}"/>`).join('')}
    <path class="sea-waves" d="${waves}"/>
    <path class="land" d="${mainland}"/>
    ${islands.map((d) => `<path class="land gulf-island" d="${d}"/>`).join('')}
    <g class="hills">${hills}</g>
    <g class="trees">${trees.join('')}</g>
    ${mouth}
    ${reef}
    ${beds}
    ${label(1000, 620, t('The Pearl Banks').toUpperCase(), 18)}
    ${label(330, 470, t('The Gulf').toUpperCase(), 40)}
    ${label(1080, 980, t('The open sea').toUpperCase(), 20)}
    <rect class="vignette" x="0" y="0" width="${W}" height="${H}" fill="url(#gm-vignette)"/>
    ${route.length > 1 ? `<path class="route" d="${line(route)}"/>` : ''}
    ${ahead.length > 1 ? `<path class="route-ahead" d="${line(ahead)}"/>` : ''}
    ${ports}
    ${fog ? fogLayer({ id: 'gm-fog', W, H, holes: fog.holes }) : ''}
    <g class="your-boat" transform="translate(${f1(tie[0])} ${f1(tie[1])})"><g class="bob">${yourBoat(boat)}</g></g>
    ${compass}
    <path class="border-ticks" d="${ticks.join('')}"/>
    <rect class="chart-border" x="3" y="3" width="${W - 6}" height="${H - 6}"/>
  </svg>`;
}
