/**
 * The Long River, drawn.
 *
 * Everything here is SVG built from a handful of shapes, and none of it
 * carries a colour: each shape names what it is made of (`ink`, `wall`,
 * `roof`, `glow`, `water`…) and river.css paints those from the room's map
 * tokens. That is what lets one drawing be the river by moonlight, at dusk,
 * in the bayou green and by day without four copies of it.
 *
 * Split from the screens so the geometry can be checked without a browser:
 * where each stop sits, where the river runs past it, and that the two never
 * overlap are plain arithmetic.
 */

/** The map's own coordinate space. The page scales it to fit. */
export const MAP = { W: 400, H: 1410, top: 184, gap: 150 };

const STOPS = 8;

/** Where stop `i` stands, and which bank it is on (-1 left, 1 right). */
export function stopPoint(i) {
  const side = i % 2 === 0 ? -1 : 1;
  return { x: side < 0 ? 104 : 296, y: MAP.top + i * MAP.gap, side };
}

/** The river swings away from each stop's bank to leave it room. */
const knots = () => [
  [214, -40],
  [224, 70],
  ...Array.from({ length: STOPS }, (_, i) => {
    const { y, side } = stopPoint(i);
    return [side < 0 ? 236 : 164, y];
  }),
  [214, 1326],
  [206, 1450],
];

/** Width of the river at height y: a creek at the top, wide at the delta. */
const widthAt = (y) => 34 + Math.max(0, Math.min(1, y / 1270)) * 40;

/** Catmull-Rom through the knots, sampled evenly in parameter. */
function sampleCenterline(perSegment = 40) {
  const k = knots();
  const out = [];
  for (let s = 0; s < k.length - 1; s++) {
    const p0 = k[Math.max(0, s - 1)];
    const p1 = k[s];
    const p2 = k[s + 1];
    const p3 = k[Math.min(k.length - 1, s + 2)];
    for (let j = 0; j < perSegment; j++) {
      const t = j / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(k[k.length - 1]);
  return out;
}

let cached = null;

/** The river as the page needs it: centreline, both banks, and a lookup. */
export function riverGeometry() {
  if (cached) return cached;
  const center = sampleCenterline();
  const left = [];
  const right = [];
  center.forEach(([x, y], i) => {
    const [ax, ay] = center[Math.max(0, i - 1)];
    const [bx, by] = center[Math.min(center.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const half = widthAt(y) / 2;
    left.push([x - nx * half, y - ny * half]);
    right.push([x + nx * half, y + ny * half]);
  });
  /** Centreline x at height y (the river never doubles back on itself). */
  const xAt = (y) => {
    for (let i = 1; i < center.length; i++) {
      if (center[i][1] >= y) {
        const [x0, y0] = center[i - 1];
        const [x1, y1] = center[i];
        return x0 + ((y - y0) / ((y1 - y0) || 1)) * (x1 - x0);
      }
    }
    return center[center.length - 1][0];
  };
  cached = { center, left, right, xAt, widthAt };
  return cached;
}

/* ------------------------------------------------------------------ *
 * A small deterministic scatter, so the trees do not move on a redraw
 * ------------------------------------------------------------------ */

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L');

/** Keep scenery off the water, the stops, their name plates and the title. */
function clearOfEverything(x, y, pad) {
  const { xAt } = riverGeometry();
  if (y < 128) return false;
  if (y > 1306) return false;
  if (Math.abs(x - xAt(y)) < widthAt(y) / 2 + pad) return false;
  for (let i = 0; i < STOPS; i++) {
    const s = stopPoint(i);
    if (Math.abs(x - s.x) < 58 + pad && y > s.y - 52 - pad && y < s.y + 92 + pad) return false;
  }
  return true;
}

function scenery() {
  const rnd = seeded(1890);
  const trees = [];
  const fields = [];
  const reeds = [];
  const ripples = [];
  const { center, xAt } = riverGeometry();

  for (let n = 0; n < 900 && trees.length < 150; n++) {
    const x = 10 + rnd() * 380;
    const y = 128 + rnd() * 1180;
    if (!clearOfEverything(x, y, 10)) continue;
    const r = 4 + rnd() * 4;
    trees.push(`<g class="tree" transform="translate(${f1(x)} ${f1(y)})">`
      + `<ellipse class="tree-shade" cx="2" cy="${f1(r + 1.5)}" rx="${f1(r * 0.9)}" ry="1.6"/>`
      + `<path class="tree-trunk" d="M0 ${f1(r * 0.5)}V${f1(r + 1.5)}"/>`
      + `<circle class="tree-crown" r="${f1(r)}"/></g>`);
  }

  for (let n = 0; n < 400 && fields.length < 14; n++) {
    const x = 20 + rnd() * 330;
    const y = 150 + rnd() * 1140;
    if (!clearOfEverything(x, y, 36) || !clearOfEverything(x + 40, y + 20, 14)) continue;
    const w = 26 + rnd() * 14;
    const rows = [];
    for (let k = 3; k < 22; k += 4) rows.push(`M${f1(x)} ${f1(y + k)}h${f1(w)}`);
    fields.push(`<path class="field" d="M${f1(x)} ${f1(y)}h${f1(w)}l6 22h-${f1(w)}z"/>`
      + `<path class="furrow" d="${rows.join('')}"/>`);
  }

  for (let i = 8; i < center.length - 8; i += 3) {
    const [, y] = center[i];
    if (y < 128 || y > 1300) continue;
    if (rnd() < 0.55) continue;
    const side = rnd() < 0.5 ? -1 : 1;
    const x = xAt(y) + side * (widthAt(y) / 2 + 2);
    reeds.push(`M${f1(x)} ${f1(y)}v-6M${f1(x + 2.5)} ${f1(y + 1)}v-5M${f1(x - 2.5)} ${f1(y + 1)}v-4`);
  }

  for (let i = 6; i < center.length - 4; i += 7) {
    const [, y] = center[i];
    const x = xAt(y) + (rnd() - 0.5) * widthAt(y) * 0.5;
    ripples.push(`M${f1(x - 6)} ${f1(y)}q3 -3 6 0t6 0`);
  }

  return { trees: trees.join(''), fields: fields.join(''), reeds: reeds.join(''), ripples: ripples.join('') };
}

/* ------------------------------------------------------------------ *
 * The landmarks, one per stop, drawn around (0,0) in about 80 x 64
 * ------------------------------------------------------------------ */

const windowsRow = (x0, y, n, step, w = 4, h = 4) => Array.from({ length: n },
  (_, i) => `<rect class="glow" x="${f1(x0 + i * step)}" y="${y}" width="${w}" height="${h}"/>`).join('');

export const LANDMARKS = {
  landing: () => `
    <path class="ground" d="M-40 18h80"/>
    <path class="wall ink" d="M-32 18V-3h26v21z"/>
    <path class="roof ink" d="M-35 -2L-19 -16L-3 -2z"/>
    <rect class="glow" x="-26" y="2" width="7" height="7"/>
    <path class="ink" d="M-13 18v-10h4v10"/>
    <rect class="wall ink" x="3" y="8" width="10" height="10"/>
    <rect class="wall ink" x="13" y="11" width="8" height="7"/>
    <rect class="wall ink" x="6" y="0" width="8" height="8"/>
    <path class="ink" d="M3 13h10M8 8v10"/>
    <path class="ink" d="M29 18V-14h7"/>
    <path class="ink" d="M36 -14v3"/>
    <circle class="glow ink" cx="36" cy="-7.5" r="3.4"/>`,

  tavern: () => `
    <path class="shallows" d="M-40 16h80v9h-80z"/>
    <path class="ink" d="M-24 24V7M-11 24V7M3 24V7M17 24V7"/>
    <path class="roof ink" d="M-31 7h55v-3h-55z"/>
    <path class="wall ink" d="M-27 4V-14h46V4z"/>
    <path class="roof ink" d="M-31 -13L-4 -30L23 -13z"/>
    <path class="roof ink" d="M9 -21v-9h5v12"/>
    <path class="smoke" d="M11.5 -33c-3-3 3-5 0-8s3-5 0-7"/>
    <rect class="glow" x="-21" y="-9" width="6" height="6"/>
    <rect class="glow" x="7" y="-9" width="6" height="6"/>
    <path class="ink" d="M-7 4v-10h6v10"/>
    <path class="ink" d="M23 -5h9M28 -5v3"/>
    <rect class="wall ink" x="23.5" y="-2" width="9" height="6"/>`,

  ferry: () => `
    <path class="ground" d="M-40 18h36"/>
    <path class="wall ink" d="M-37 18V1h21v17z"/>
    <path class="roof ink" d="M-39 2L-26.5 -10L-14 2z"/>
    <rect class="glow" x="-31" y="5" width="6" height="6"/>
    <path class="ink" d="M-8 18V-15h9"/>
    <path class="glow ink" d="M1 -14c-3 0-3.6 3-4 6.5h8c-.4-3.5-1-6.5-4-6.5z"/>
    <path class="roof ink" d="M-4 13h44l-4 7h-36z"/>
    <path class="wall ink" d="M8 13V1h19v12z"/>
    <path class="roof ink" d="M6 2L17.5 -6L29 2z"/>
    <rect class="glow" x="14" y="4" width="6" height="5"/>`,

  exchange: () => `
    <path class="ground" d="M-40 18h80"/>
    <path class="wall ink" d="M-35 17V-8h52v25z"/>
    <path class="roof ink" d="M-39 -8L-9 -27L21 -8z"/>
    <path class="ink" d="M-19 -13h20"/>
    <path class="ink" d="M-29 17V-5M-19 17V-5M-9 17V-5M1 17V-5M11 17V-5"/>
    <path class="roof ink" d="M-37 17h56v2h-56z"/>
    <rect class="glow" x="-26" y="3" width="5" height="8"/>
    <rect class="glow" x="-6" y="3" width="5" height="8"/>
    <rect class="glow" x="4" y="3" width="5" height="8"/>
    <rect class="wall ink" x="23" y="8" width="13" height="10" rx="2"/>
    <rect class="wall ink" x="26" y="-2" width="11" height="10" rx="2"/>
    <path class="ink" d="M27 8v10M32 8v10M30 -2v10M34 -2v10"/>`,

  steamer: () => `
    <path class="roof ink" d="M-40 10h78l-8 10h-62z"/>
    <path class="wall ink" d="M-32 10V0h56v10z"/>
    ${windowsRow(-28, 3, 7, 7.5)}
    <path class="wall ink" d="M-25 0V-8h40V0z"/>
    ${windowsRow(-20, -6, 4, 9, 4, 3)}
    <path class="wall ink" d="M-7 -8v-7h12v7z"/>
    <rect class="glow" x="-4" y="-13" width="6" height="3"/>
    <path class="roof ink" d="M-21 -8v-24h5v24zM-12 -8v-24h5v24z"/>
    <path class="ink" d="M-23 -32h9M-14 -32h9"/>
    <path class="smoke" d="M-18.5 -35c-4-4 4-6 0-10M-9.5 -35c-4-4 4-6 0-10"/>
    <circle class="wall ink" cx="31" cy="5" r="9"/>
    <path class="ink" d="M22 5h18M31 -4v18M24.6 -1.4l12.8 12.8M37.4 -1.4l-12.8 12.8"/>`,

  hotel: () => `
    <path class="ground" d="M-40 18h80"/>
    <path class="wall ink" d="M-38 18V-14h76v32z"/>
    <path class="roof ink" d="M-40 -14h80v-4h-80z"/>
    <path class="roof ink" d="M-8 -18v-7h16v7z"/>
    <path class="wall ink" d="M-9 -25a9 9 0 0 1 18 0z"/>
    <path class="ink" d="M0 -34v-9"/>
    <path class="mark ink" d="M0 -43l9 2.5L0 -38z"/>
    ${windowsRow(-33, -10, 8, 8.8)}
    ${windowsRow(-33, -2, 8, 8.8)}
    ${windowsRow(-33, 6, 3, 8.8)}
    ${windowsRow(10.2, 6, 3, 8.8)}
    <path class="roof ink" d="M-5 18v-10h10v10z"/>
    <path class="mark ink" d="M-9 8h18l-2 -3h-14z"/>`,

  barge: () => `
    <path class="roof ink" d="M-40 10h80l-6 9h-68z"/>
    <path class="glow" d="M-39 10h78v2h-78z"/>
    <path class="wall ink" d="M-31 10V-7h58v17z"/>
    <path class="roof ink" d="M-34 -6c10-9 54-9 64 0z"/>
    <path class="glow ink" d="M-25 6v-6a3 3 0 0 1 6 0v6zM-12 6v-6a3 3 0 0 1 6 0v6zM1 6v-6a3 3 0 0 1 6 0v6zM14 6v-6a3 3 0 0 1 6 0v6z"/>
    <path class="ink" d="M-40 -19c12 6 30 6 40 0s26-6 40 0"/>
    <circle class="glow" cx="-30" cy="-15.5" r="2.2"/>
    <circle class="glow" cx="-15" cy="-13.4" r="2.2"/>
    <circle class="glow" cx="0" cy="-18" r="2.2"/>
    <circle class="glow" cx="15" cy="-21.6" r="2.2"/>
    <circle class="glow" cx="30" cy="-19.5" r="2.2"/>`,

  flagship: () => `
    <path class="roof ink" d="M-44 8h88l-11 12h-66z"/>
    <path class="wall ink" d="M-35 8V-2h68v10z"/>
    ${windowsRow(-31, 1, 8, 8)}
    <path class="wall ink" d="M-28 -2v-8h54v8z"/>
    ${windowsRow(-24, -8, 6, 8, 4, 3)}
    <path class="wall ink" d="M-7 -10v-8h14v8z"/>
    <rect class="glow" x="-4" y="-16" width="8" height="3"/>
    <path class="roof ink" d="M-23 -10v-28h6v28zM-13 -10v-28h6v28z"/>
    <path class="ink" d="M-24 -38l2-3 2 3 2-3 2 3M-14 -38l2-3 2 3 2-3 2 3"/>
    <path class="ink" d="M21 -10v-32"/>
    <path class="mark ink" d="M21 -42l15 3.5-15 3.5z"/>
    <path class="glow ink" d="M21 -33l10 2.5-10 2.5z"/>
    <path class="roof ink" d="M-3 8a10 10 0 0 1 20 0z"/>`,
};

/* ------------------------------------------------------------------ *
 * The player's boat, which grows as the climb does
 * ------------------------------------------------------------------ */

export const BOAT_ART = {
  rowboat: () => `
    <path class="hull ink" d="M-14 0h28l-5 7h-18z"/>
    <path class="ink" d="M-7 2l-9 8M7 2l9 8"/>`,
  skiff: () => `
    <path class="hull ink" d="M-16 1h32l-6 7h-20z"/>
    <path class="ink" d="M-2 1v-23"/>
    <path class="sail ink" d="M-1 -21l15 20h-15z"/>
    <path class="sail ink" d="M-3 -17l-9 16h9z"/>`,
  launch: () => `
    <path class="hull ink" d="M-19 1h38l-6 8h-26z"/>
    <path class="deck ink" d="M-9 1v-8h15v8z"/>
    <rect class="glow" x="-6" y="-5" width="4" height="3"/>
    <path class="deck ink" d="M9 1v-12h4v12z"/>
    <path class="smoke" d="M11 -14c-3-3 3-5 0-8"/>`,
  sternwheeler: () => `
    <path class="hull ink" d="M-22 1h40l-6 8h-30z"/>
    <path class="deck ink" d="M-17 1v-7h32v7z"/>
    ${windowsRow(-14, -4, 4, 7, 3, 3)}
    <path class="deck ink" d="M-10 -6v-5h16v5z"/>
    <path class="deck ink" d="M-12 -11v-12h4v12zM-5 -11v-12h4v12z"/>
    <circle class="deck ink" cx="21" cy="1" r="6"/>
    <path class="ink" d="M15 1h12M21 -5v12"/>`,
  flagship: () => `
    <path class="hull ink" d="M-26 1h52l-7 9h-38z"/>
    <path class="deck ink" d="M-20 1v-7h40v7z"/>
    ${windowsRow(-17, -4, 5, 7.5, 3, 3)}
    <path class="deck ink" d="M-14 -6v-6h28v6z"/>
    <path class="deck ink" d="M-12 -12v-14h4v14zM-5 -12v-14h4v14z"/>
    <path class="ink" d="M14 -12v-18"/>
    <path class="mark ink" d="M14 -30l10 2.5-10 2.5z"/>`,
};

/** A boat drawn on its own, for the side panel. */
export function boatSvg(key, { width = 120 } = {}) {
  const art = (BOAT_ART[key] || BOAT_ART.rowboat)();
  return `<svg class="boat-art" viewBox="-34 -36 68 50" width="${width}" aria-hidden="true">`
    + `<path class="water" d="M-34 6h68v8h-68z"/><path class="ripple" d="M-28 9q3 -2.5 6 0t6 0M12 11q3 -2.5 6 0t6 0"/>`
    + `<g class="you">${art}</g></svg>`;
}

/** A landmark drawn on its own, for the scene at a stop. */
export function landmarkSvg(key, { width = 240 } = {}) {
  const art = (LANDMARKS[key] || LANDMARKS.landing)();
  return `<svg class="landmark-art" viewBox="-48 -50 96 78" width="${width}" aria-hidden="true">${art}</svg>`;
}

/* ------------------------------------------------------------------ *
 * The whole map
 * ------------------------------------------------------------------ */

/**
 * @param {object} state
 *   here   index of the stop you are at
 *   best   index of the furthest stop reached
 *   open   highest index your bankroll opens
 *   beaten set of stop indexes whose boss is beaten
 *   boat   key into BOAT_ART
 *   landmarks  landmark key per stop index
 */
export function mapSvg({ here, best, open, beaten, boat, landmarks }) {
  const { W, H } = MAP;
  const { center, left, right, xAt } = riverGeometry();
  const sc = scenery();

  const riverPath = `M${pts(left)} L${pts([...right].reverse())}Z`;
  const bankPath = (side) => `M${pts(side)}`;

  // The way you have come: down the middle of the river to the furthest stop.
  const travelledTo = MAP.top + best * MAP.gap;
  const route = center.filter(([, y]) => y > 60 && y <= travelledTo);
  const ahead = center.filter(([, y]) => y >= travelledTo && y < 1320);

  const sea = 'M0 1314 C40 1304 70 1326 110 1316 S180 1300 214 1310 S300 1326 340 1312 S390 1306 400 1314 V1410 H0Z';

  const stops = landmarks.map((key, i) => {
    const s = stopPoint(i);
    const shut = i > open && i > best;
    // From the side of the drawing that faces the water, out to the near
    // bank and a few planks into the river, where a boat can tie up.
    const toward = -s.side;
    const from = s.x + toward * 30;
    const to = xAt(s.y + 10) - toward * (widthAt(s.y) / 2) + toward * 9;
    const jetty = `M${f1(from)} ${s.y + 10}H${f1(to)}`;
    const cls = ['landmark', shut ? 'shut' : '', i === here ? 'here' : '', beaten.has(i) ? 'beaten' : ''].filter(Boolean).join(' ');
    return `<path class="jetty" d="${jetty}"/>`
      + `<g class="${cls}" data-index="${i}" transform="translate(${s.x} ${s.y})">`
      + (i === here ? '<ellipse class="here-glow" cx="0" cy="2" rx="47" ry="33"/><ellipse class="here-ring" cx="0" cy="2" rx="47" ry="33"/>' : '')
      + (LANDMARKS[key] || LANDMARKS.landing)()
      + '</g>';
  }).join('');

  const hereStop = stopPoint(here);
  const boatX = xAt(hereStop.y + 8) + hereStop.side * 6;
  const boatArt = (BOAT_ART[boat] || BOAT_ART.rowboat)();

  // A compass rose, as every chart has, tucked into the top right.
  const compass = `<g class="compass" transform="translate(346 70)">`
    + '<circle class="compass-ring" r="22"/><circle class="compass-ring" r="17"/>'
    + '<path class="compass-star" d="M0 -26L4 -4L0 0L-4 -4zM0 26L4 4L0 0L-4 4z"/>'
    + '<path class="compass-star dim" d="M-26 0L-4 -4L0 0L-4 4zM26 0L4 -4L0 0L4 4z"/>'
    + '<text class="compass-n" x="0" y="-30">N</text></g>';

  return `<svg class="map-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin meet" role="img" aria-hidden="true">
    <rect class="land" x="0" y="0" width="${W}" height="${H}"/>
    <g class="fields">${sc.fields}</g>
    <path class="river" d="${riverPath}"/>
    <path class="bank" d="${bankPath(left)}"/>
    <path class="bank" d="${bankPath(right)}"/>
    <path class="current" d="M${pts(center.filter(([, y]) => y < 1320))}"/>
    <path class="ripple" d="${sc.ripples}"/>
    <path class="sea" d="${sea}"/>
    <path class="sea-waves" d="M20 1350q8 -5 16 0t16 0M120 1370q8 -5 16 0t16 0M250 1356q8 -5 16 0t16 0M320 1384q8 -5 16 0t16 0M60 1390q8 -5 16 0t16 0"/>
    <path class="reeds" d="${sc.reeds}"/>
    <g class="trees">${sc.trees}</g>
    ${ahead.length > 1 ? `<path class="route-ahead" d="M${pts(ahead)}"/>` : ''}
    ${route.length > 1 ? `<path class="route" d="M${pts(route)}"/>` : ''}
    ${stops}
    <g class="your-boat" transform="translate(${f1(boatX)} ${hereStop.y + 8})"><g class="bob"><g class="you">${boatArt}</g></g></g>
    ${compass}
  </svg>`;
}
