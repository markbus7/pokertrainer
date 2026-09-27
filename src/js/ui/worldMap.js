/**
 * The whole river system, drawn as one chart.
 *
 * The first map was a single river running down a long strip, with the eight
 * tables on it and everything else somewhere in a menu. The reader wanted to
 * see more of the world at once, a river worth looking at, and the other
 * places — the school, the pilot house, the saloon — on the water too. So
 * this is the country the Long River runs through, seen from higher up: the
 * river rising in the hills in the west and running east to the sea, eight
 * stops along it, and the side waters that lead to everywhere else.
 *
 *  - School Creek comes down from the north to Mud Landing, with Silas's
 *    school on its bluff, and the saloon across the water.
 *  - An old bend of the river, cut off into an oxbow lake, is where the
 *    steamer with the pilot house is laid up.
 *  - Gold Creek comes up from the diggings in the south, and the assay
 *    office stands on it.
 *  - Below the Belle the river splits around Belle Island; the straight
 *    southern channel is the racing chute.
 *  - The Black River joins from the north, and the Trading Post stands at
 *    the fork.
 *  - At the end the river splits again into the delta, and runs out through
 *    three mouths into the sea.
 *
 * As before, nothing here carries a colour of its own: every shape names what
 * it is made of and river.css paints it from the room's map tokens, so one
 * chart is the river by moonlight, at dusk, in the bayou and by day.
 */

import { LANDMARKS, BOAT_ART } from './riverArt.js';
import { t } from '../i18n/index.js';

/** The chart's own coordinate space. The page scales it. */
export const WORLD = { W: 1600, H: 1000 };

const f1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ *
 * Curves
 * ------------------------------------------------------------------ */

/** Catmull-Rom through the knots, sampled evenly per segment. */
function smooth(knots, perSegment = 24) {
  const out = [];
  for (let s = 0; s < knots.length - 1; s++) {
    const p0 = knots[Math.max(0, s - 1)];
    const p1 = knots[s];
    const p2 = knots[s + 1];
    const p3 = knots[Math.min(knots.length - 1, s + 2)];
    for (let j = 0; j < perSegment; j++) {
      const t = j / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(knots[knots.length - 1]);
  return out;
}

/** The two banks of a stretch of water, `width(i, n)` wide at sample i of n. */
function banks(center, width) {
  const left = [];
  const right = [];
  const n = center.length;
  center.forEach(([x, y], i) => {
    const [ax, ay] = center[Math.max(0, i - 1)];
    const [bx, by] = center[Math.min(n - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const half = width(i, n) / 2;
    left.push([x + nx * half, y + ny * half]);
    right.push([x - nx * half, y - ny * half]);
  });
  return { left, right };
}

const line = (pts) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')}`;

/** A filled ribbon of water between two banks. */
function ribbon({ left, right }) {
  return `${line(left)} L${right.slice().reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')}Z`;
}

/* ------------------------------------------------------------------ *
 * The waters
 * ------------------------------------------------------------------ */

/** The Long River, west to east, from the hills to the head of the delta. */
const MAIN_KNOTS = [
  [-40, 196], [40, 208], [120, 236], [205, 290], [285, 350], [380, 382], [470, 370],
  [560, 338], [650, 332], [740, 360], [820, 410], [900, 446], [990, 458], [1080, 452],
  [1160, 462], [1240, 500], [1300, 550],
];

/** Where the delta splits, and its three mouths to the sea. */
const DELTA = [
  [[1300, 550], [1370, 548], [1450, 566], [1530, 574], [1640, 572]],
  [[1300, 550], [1360, 598], [1420, 650], [1500, 686], [1640, 700]],
  [[1300, 550], [1330, 620], [1370, 720], [1430, 810], [1520, 872], [1640, 900]],
];

const TRIBUTARIES = {
  // Silas's creek, down from the north to join above Fisher's Rest.
  school: [[430, -40], [405, 60], [372, 160], [330, 250], [290, 340]],
  // Up from the diggings in the south.
  gold: [[600, 1040], [566, 930], [560, 820], [584, 700], [612, 580], [632, 460], [640, 340]],
  // The Black River, joining at the fork where the Trading Post stands.
  black: [[1230, -40], [1200, 70], [1168, 180], [1158, 300], [1164, 400], [1162, 460]],
};

/** The racing chute: the straight channel south of Belle Island. */
const CHUTE = [[905, 450], [922, 556], [966, 650], [1060, 692], [1154, 668], [1214, 596], [1240, 502]];

/** The cut-off bend where the old steamer is laid up, and the ditch to it. */
const OXBOW = { cx: 690, cy: 168, rx: 96, ry: 52 };
const OXBOW_CUT = [[700, 218], [712, 270], [716, 336]];

const riverWidth = (i, n) => 20 + (i / (n - 1)) * 34;

/** Everything the page and the boat need to know about the main river. */
let cached = null;
export function worldGeometry() {
  if (cached) return cached;
  const center = smooth(MAIN_KNOTS, 28);
  const main = banks(center, riverWidth);
  /** Centreline y at x (the river only ever runs east). */
  const yAt = (x) => {
    for (let i = 1; i < center.length; i++) {
      if (center[i][0] >= x) {
        const [x0, y0] = center[i - 1];
        const [x1, y1] = center[i];
        return y0 + ((x - x0) / ((x1 - x0) || 1)) * (y1 - y0);
      }
    }
    return center[center.length - 1][1];
  };
  const widthAtX = (x) => {
    const i = center.findIndex(([cx]) => cx >= x);
    return riverWidth(i < 0 ? center.length - 1 : i, center.length);
  };
  cached = { center, main, yAt, widthAtX };
  return cached;
}

/* ------------------------------------------------------------------ *
 * Where things are
 * ------------------------------------------------------------------ */

/**
 * The eight stops. Each stands on a bank, with a short jetty to the water;
 * `side` is which bank (-1 north, 1 south), which is also where its name
 * plate goes.
 */
export const STOP_POINTS = [
  { x: 132, y: 140, side: -1 },   // Mud Landing
  { x: 360, y: 478, side: 1 },    // Fisher's Rest
  { x: 478, y: 262, side: -1 },   // The Ferry
  { x: 760, y: 470, side: 1 },    // Cotton Row
  { x: 880, y: 330, side: -1 },   // The Belle
  { x: 1070, y: 548, side: 1 },   // The Grand Hotel, on Belle Island
  { x: 1290, y: 400, side: -1 },  // The Gilded Barge
  { x: 1446, y: 772, side: 1 },   // Delta Crown, between the mouths
];

export const stopAt = (i) => STOP_POINTS[Math.max(0, Math.min(STOP_POINTS.length - 1, i))];

/** The places that are not tables: each with the landmark it is drawn as. */
export const PLACES = [
  { key: 'school', route: 'train', landmark: 'school', x: 262, y: 104, name: 'Silas\'s Card School', label: 'Lessons' },
  { key: 'saloon', route: 'play', landmark: 'saloon', x: 116, y: 352, name: 'The Saloon', label: 'Practice table' },
  { key: 'pilothouse', route: 'ranges', landmark: 'pilothouse', x: 690, y: 160, name: 'The Pilot House', label: 'Range charts' },
  { key: 'assay', route: 'lab', landmark: 'assay', x: 470, y: 690, name: 'The Assay Office', label: 'The Lab' },
  { key: 'race', route: 'gauntlet', landmark: 'race', x: 862, y: 640, name: 'The Racing Chute', label: 'The Race' },
  { key: 'tradingpost', route: 'store', landmark: 'tradingpost', x: 1070, y: 290, name: 'The Trading Post', label: 'Spend pearls' },
];

/**
 * Names on the water, lettered along it the way a chart does: each follows
 * a line of its own just off its water, clear of the boat's route.
 */
export const WATER_NAMES = [
  { id: 'long', text: 'The Long River', size: 13, pts: [[118, 280], [186, 326], [246, 372]] },
  { id: 'school', text: 'School Creek', size: 11, pts: [[442, 16], [424, 86], [402, 156]] },
  { id: 'gold', text: 'Gold Creek', size: 11, pts: [[588, 900], [580, 810], [602, 720]] },
  { id: 'black', text: 'Black River', size: 11, pts: [[1224, 56], [1204, 126], [1190, 196]] },
  { id: 'delta', text: 'The Delta', size: 11, pts: [[1350, 636], [1438, 708]] },
  { id: 'gulf', text: 'The Gulf', size: 16, pts: [[1558, 130], [1566, 400]], sea: true },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A tree of radius r, lit from the left: a round broadleaf crown, or a pine.
 * Both are two tones of the room's green and a shadow on the ground.
 */
function treeSymbol(id, kind, r) {
  const shade = `<ellipse class="tree-shade" cx="${f1(r * 0.35)}" cy="${f1(r * 0.9)}" rx="${f1(r * 0.9)}" ry="${f1(r * 0.35)}"/>`;
  if (kind === 'pine') {
    const h = r * 2.6;
    const w = r * 1.5;
    return `<g id="${id}">${shade}`
      + `<path class="tree-lit" d="M0 ${f1(-h * 0.75)}L${f1(w / 2)} ${f1(h * 0.25)}H${f1(-w / 2)}Z"/>`
      + `<path class="tree-crown" d="M0 ${f1(-h * 0.75)}L${f1(w / 2)} ${f1(h * 0.25)}H0Z"/></g>`;
  }
  return `<g id="${id}">${shade}`
    + `<circle class="tree-lit" r="${f1(r)}"/>`
    + `<path class="tree-crown" d="M0 ${f1(-r)}A${f1(r)} ${f1(r)} 0 0 1 0 ${f1(r)}A${f1(r * 0.62)} ${f1(r)} 0 0 0 0 ${f1(-r)}Z"/></g>`;
}

const TREE_SYMBOLS = ['broad', 'pine'].flatMap((kind) => [['s', 5], ['m', 6.3], ['l', 7.5]]
  .map(([size, r]) => treeSymbol(`wm-${kind}-${size}`, kind, r))).join('');

function labelPaths() {
  return WATER_NAMES.map((n) => `<path id="wm-name-${n.id}" d="${line(smooth(n.pts, 8))}"/>`).join('');
}

function labels() {
  return WATER_NAMES.map((n) => `<text class="water-name${n.sea ? ' sea-name' : ''}" font-size="${n.size}">`
    + `<textPath href="#wm-name-${n.id}" startOffset="50%" text-anchor="middle">${esc(t(n.text).toUpperCase())}</textPath></text>`).join('');
}

/* ------------------------------------------------------------------ *
 * Scenery
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

/**
 * Everything that must stay clear of trees, fields and mountains: each
 * drawing, each name plate (north-bank plates hang above their stop, the
 * rest below) and the lettering on the water.
 */
function occupied() {
  const round = [
    ...STOP_POINTS.map((p) => ({ x: p.x, y: p.y, r: 62 })),
    ...PLACES.map((p) => ({ x: p.x, y: p.y, r: 56 })),
    ...WATER_NAMES.flatMap((n) => smooth(n.pts, 6).map(([x, y]) => ({ x, y: y - n.size / 3, r: n.size }))),
    ...ROADS.flatMap((r) => smooth(r, 6).map(([x, y]) => ({ x, y, r: 7 }))),
  ];
  const boxes = [
    ...STOP_POINTS.map((p) => (p.side < 0
      ? { x0: p.x - 112, x1: p.x + 112, y0: p.y - 124, y1: p.y - 36 }
      : { x0: p.x - 112, x1: p.x + 112, y0: p.y + 20, y1: p.y + 108 })),
    ...PLACES.map((p) => ({ x0: p.x - 96, x1: p.x + 96, y0: p.y + 22, y1: p.y + 96 })),
  ];
  return (x, y, pad) => round.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + pad)
    || boxes.some((b) => x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad);
}

/** Distance from a point to the nearest water, roughly, from sampled lines. */
function waterLines() {
  const { center } = worldGeometry();
  const lines = [
    { pts: center, w: 60 },
    ...DELTA.map((k) => ({ pts: smooth(k, 16), w: 44 })),
    ...Object.values(TRIBUTARIES).map((k) => ({ pts: smooth(k, 16), w: 22 })),
    { pts: smooth(CHUTE, 16), w: 34 },
    { pts: smooth(OXBOW_CUT, 8), w: 14 },
  ];
  return lines;
}

function nearWater(x, y, pad, lines) {
  for (const { pts, w } of lines) {
    for (let i = 0; i < pts.length; i += 2) {
      if (Math.hypot(x - pts[i][0], y - pts[i][1]) < w / 2 + pad) return true;
    }
  }
  const o = OXBOW;
  if (((x - o.cx) / (o.rx + pad)) ** 2 + ((y - o.cy) / (o.ry + pad)) ** 2 < 1) return true;
  return false;
}

/**
 * Wagon roads between the places on land, kept off the name plates, and
 * the bridges where they cross the creeks.
 */
const ROADS = [
  [[152, 128], [196, 114], [230, 110]],                            // Mud Landing up to the school
  [[152, 346], [215, 388], [280, 428], [330, 460]],                // the saloon along to Fisher's Rest
  [[508, 696], [584, 706], [700, 690], [822, 650]],                // the assay office over Gold Creek to the races
  [[1112, 286], [1160, 302], [1222, 340], [1262, 372]],            // the Trading Post over the Black River to the Barge
];
const BRIDGES = [
  { x: 583, y: 706, angle: 4 },
  { x: 1162, y: 303, angle: 26 },
];

/** Coastline: land ends here and the sea begins. */
const COAST = [[1496, -40], [1514, 90], [1494, 210], [1516, 330], [1530, 450], [1526, 560], [1540, 640], [1556, 700]];
const COAST_SOUTH = [[1556, 700], [1530, 800], [1504, 880], [1450, 950], [1400, 1040]];

function inSea(x, y) {
  const coast = smooth([...COAST, ...COAST_SOUTH], 12);
  // Walk along the coast: the sea is east of it, and south-east of its tail.
  if (y > 700) {
    const seg = coast.filter(([, cy]) => cy > 690);
    let cx = 1600;
    for (let i = 1; i < seg.length; i++) if (seg[i][1] >= y) { cx = seg[i][0]; break; }
    return x > cx - 10;
  }
  let cx = 1500;
  for (let i = 1; i < coast.length; i++) if (coast[i][1] >= y) { cx = coast[i][0]; break; }
  return x > cx - 10;
}

/** Whether a point is on dry land, at least `pad` from any water. */
export function isDry(x, y, pad = 0) {
  return !nearWater(x, y, pad, waterLines()) && !inSea(x, y);
}

function scenery() {
  const rnd = seeded(1890);
  const lines = waterLines();
  const taken = occupied();
  const clear = (x, y, pad) => !nearWater(x, y, pad, lines) && !inSea(x, y) && !taken(x, y, pad);

  // Forests: clusters rather than a scatter, the way woods actually grow.
  const groves = [
    [960, 110, 120, 'broad'], [1320, 170, 90, 'pine'], [620, 520, 60, 'broad'], [230, 620, 110, 'broad'],
    [820, 860, 130, 'broad'], [1120, 830, 90, 'broad'], [40, 520, 90, 'pine'], [1380, 330, 70, 'broad'],
    [300, 900, 90, 'pine'], [940, 220, 60, 'broad'], [560, 120, 60, 'pine'], [110, 700, 60, 'pine'],
  ];
  const trees = [];
  for (const [gx, gy, gr, kind] of groves) {
    for (let n = 0; n < 110; n++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * gr;
      const x = gx + Math.cos(a) * d;
      const y = gy + Math.sin(a) * d * 0.7;
      const r = 4.5 + rnd() * 3.5;
      if (x < 8 || x > WORLD.W - 8 || y < 8 || y > WORLD.H - 8 || !clear(x, y, 6)) continue;
      trees.push({ x, y, r, kind });
    }
  }
  // Back to front, so each crown stands in front of the one behind it and a
  // grove reads as a wood rather than a scatter of dots.
  trees.sort((a, b) => a.y - b.y);
  // Three sizes of tree, each drawn once and stamped where it grows.
  const treeArt = trees.map(({ x, y, r, kind }) => `<use href="#wm-${kind}-${r < 5.7 ? 's' : r < 6.9 ? 'm' : 'l'}" x="${f1(x)}" y="${f1(y)}"/>`);

  // Cypress in the bayou by the delta: tall, thin, standing in the wet.
  const cypress = [];
  for (let n = 0; n < 220 && cypress.length < 46; n++) {
    const x = 1180 + rnd() * 260;
    const y = 700 + rnd() * 280;
    if (!clear(x, y, 4)) continue;
    const h = 12 + rnd() * 8;
    cypress.push(`<path class="cypress" d="M${f1(x)} ${f1(y)}l-4 0 4 -${f1(h)} 4 ${f1(h)}z"/>`);
  }

  // Farmland along the middle river: cotton rows by Cotton Row.
  const fieldAt = [[640, 600], [760, 560], [300, 560], [1000, 380], [420, 180], [1180, 700], [120, 460]];
  const fields = [];
  for (const [x0, y0] of fieldAt) {
    const x = x0 + (rnd() - 0.5) * 20;
    const y = y0 + (rnd() - 0.5) * 20;
    if (!clear(x + 20, y + 12, 16)) continue;
    const w = 44 + rnd() * 20;
    const rows = [];
    for (let k = 4; k < 26; k += 5) rows.push(`M${f1(x + 3)} ${f1(y + k)}h${f1(w - 2)}`);
    fields.push(`<path class="field" d="M${f1(x)} ${f1(y)}h${f1(w)}l8 28h-${f1(w)}z"/>`
      + `<path class="furrow" d="${rows.join('')}"/>`);
  }

  // Mountains: the high country in the north-west where the creeks rise,
  // and the diggings to the south around Gold Creek.
  const hills = [];
  const ranges = [
    [470, 64, 4, 1.1], [30, 640, 3, 0.9], [120, 850, 4, 1], [380, 900, 4, 1.15],
    [650, 950, 3, 0.9], [1330, 60, 3, 0.8], [760, 130, 2, 0.7],
  ];
  for (const [hx, hy, count, big] of ranges) {
    for (let k = 0; k < count; k++) {
      const x = hx + k * 46 * big + (rnd() - 0.5) * 14;
      const y = hy + (rnd() - 0.5) * 24 + (k % 2) * 10;
      if (!clear(x, y - 10, 4)) continue;
      const w = (30 + rnd() * 18) * big;
      const h = (34 + rnd() * 20) * big;
      const peak = x + (rnd() - 0.5) * w * 0.2;
      const left = `${f1(x - w / 2)} ${f1(y)}`;
      const right = `${f1(x + w / 2)} ${f1(y)}`;
      const top = `${f1(peak)} ${f1(y - h)}`;
      hills.push({ y, art: `<path class="hill" d="M${left}L${f1(peak - w * 0.18)} ${f1(y - h * 0.62)}L${top}L${f1(peak + w * 0.2)} ${f1(y - h * 0.58)}L${right}Z"/>`
        + `<path class="hill-shade" d="M${top}L${f1(peak + w * 0.2)} ${f1(y - h * 0.58)}L${right}L${f1(peak + w * 0.05)} ${f1(y)}Z"/>`
        + `<path class="hill-snow" d="M${top}L${f1(peak - w * 0.12)} ${f1(y - h * 0.74)}L${f1(peak - w * 0.03)} ${f1(y - h * 0.7)}L${f1(peak + w * 0.05)} ${f1(y - h * 0.78)}L${f1(peak + w * 0.13)} ${f1(y - h * 0.72)}Z"/>` });
    }
  }
  hills.sort((a, b) => a.y - b.y);

  // Reeds along the banks, and sandbars in the wide water.
  const { center } = worldGeometry();
  const reeds = [];
  for (let i = 6; i < center.length - 4; i += 5) {
    if (rnd() < 0.5) continue;
    const [x, y] = center[i];
    const side = rnd() < 0.5 ? -1 : 1;
    const yy = y + side * (riverWidth(i, center.length) / 2 + 3);
    reeds.push(`M${f1(x)} ${f1(yy)}v-7M${f1(x + 3)} ${f1(yy + 1)}v-6M${f1(x - 3)} ${f1(yy + 1)}v-5`);
  }
  for (let n = 0; n < 40; n++) {
    const x = 1200 + rnd() * 260;
    const y = 740 + rnd() * 220;
    if (!clear(x, y, 2)) continue;
    reeds.push(`M${f1(x)} ${f1(y)}v-7M${f1(x + 3)} ${f1(y + 1)}v-6M${f1(x - 3)} ${f1(y + 1)}v-5`);
  }

  return {
    trees: treeArt.join(''), cypress: cypress.join(''), fields: fields.join(''), hills: hills.map((h) => h.art).join(''), reeds: reeds.join(''),
  };
}

/* ------------------------------------------------------------------ *
 * The chart
 * ------------------------------------------------------------------ */

function jetty(p) {
  const { yAt, widthAtX } = worldGeometry();
  const toward = -p.side;                 // toward the river from the bank
  const water = yAt(p.x) - toward * (widthAtX(p.x) / 2) + toward * 8;
  const from = p.y + toward * 22;
  return `M${f1(p.x)} ${f1(from)}V${f1(water)}`;
}

/**
 * The path the boat takes between two stops, along the middle of the river.
 * The delta stop is reached down the southern mouth.
 */
export function voyage(fromIndex, toIndex) {
  const { center, yAt } = worldGeometry();
  const delta = smooth(DELTA[2], 16);
  const tie = (i) => {
    const p = stopAt(i);
    // The Commodore lies between the mouths: tie up in the nearest one.
    if (i === STOP_POINTS.length - 1) {
      return delta.reduce((a, b) => (Math.hypot(b[0] - p.x, b[1] - p.y) < Math.hypot(a[0] - p.x, a[1] - p.y) ? b : a));
    }
    return [p.x, yAt(p.x) + p.side * 8];
  };
  const a = tie(fromIndex);
  const b = tie(toIndex);
  const lastX = center[center.length - 1][0];
  const along = (x0, x1) => {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    const mid = center.filter(([x]) => x > lo && x < hi);
    const tail = hi > lastX ? delta.filter(([x]) => x > Math.max(lo, lastX) && x < hi) : [];
    const pts = [...mid, ...tail];
    return x1 < x0 ? pts.reverse() : pts;
  };
  return [a, ...along(a[0], b[0]), b];
}

/**
 * @param {object} s
 * @param {number} s.here      index of the stop you are at
 * @param {number} s.best      furthest stop reached
 * @param {number} s.open      furthest stop the purse opens
 * @param {Set<number>} s.beaten
 * @param {string} s.boat      key of your boat
 * @param {Array<string>} s.landmarks  one per stop
 */
export function worldSvg({ here, best, open, beaten, boat, landmarks }) {
  const { W, H } = WORLD;
  const g = worldGeometry();
  const sc = scenery();

  const deltaWidth = (i, n) => 38 - (i / (n - 1)) * 6 + (i === n - 1 ? 30 : 0);
  const creekWidth = (i, n) => 8 + (i / (n - 1)) * 14;
  const coast = smooth([...COAST, ...COAST_SOUTH], 12);
  const sea = `${line(coast)} L${W + 40} ${H + 40} L${W + 40} -40Z`;
  const waters = [
    sea,
    ribbon(g.main),
    ...DELTA.map((k) => ribbon(banks(smooth(k, 16), deltaWidth))),
    ...Object.values(TRIBUTARIES).map((k) => ribbon(banks(smooth(k, 16), creekWidth))),
    ribbon(banks(smooth(CHUTE, 16), () => 26)),
    ribbon(banks(smooth(OXBOW_CUT, 8), () => 10)),
  ];
  // Every stretch of water, as one set of shapes. It is laid down three
  // times — a band of sand, a wet edge, then the water — and each pass covers
  // the inside of the last, so where two waters meet there is no seam.
  const water = `<ellipse cx="${OXBOW.cx}" cy="${OXBOW.cy}" rx="${OXBOW.rx}" ry="${OXBOW.ry}"/>`
    + waters.map((d) => `<path d="${d}"/>`).join('');
  // Engraved lines a little in from each bank of the main river, and off
  // the coast, the way the old charts showed water.
  const inner = banks(g.center, (i, n) => riverWidth(i, n) - 10);
  const riverLines = `<path class="water-line" d="${line(inner.left)}"/><path class="water-line" d="${line(inner.right)}"/>`;
  const seaLines = [10, 22, 38, 60].map((dx, k) => `<path class="sea-line l${k}" d="${line(coast.map(([x, y]) => [x + dx, y]))}"/>`).join('');

  // Where you have been, and the rest of the way to the sea.
  const route = voyage(0, Math.max(best, here));
  const ahead = voyage(Math.max(best, here), STOP_POINTS.length - 1);

  const stops = landmarks.map((key, i) => {
    const p = STOP_POINTS[i];
    const shut = i > open && i > best;
    const cls = ['landmark', shut ? 'shut' : '', i === here ? 'here' : '', beaten.has(i) ? 'beaten' : ''].filter(Boolean).join(' ');
    return (i === STOP_POINTS.length - 1 ? '' : `<path class="jetty" d="${jetty(p)}"/>`)
      + `<g class="${cls}" data-index="${i}" transform="translate(${p.x} ${p.y}) scale(0.9)">`
      + (i === here ? '<ellipse class="here-glow" cx="0" cy="2" rx="52" ry="36"/><ellipse class="here-ring" cx="0" cy="2" rx="52" ry="36"/>' : '')
      + (LANDMARKS[key] || LANDMARKS.landing)()
      + '</g>';
  }).join('');

  const places = PLACES.map((p) => `<g class="place" data-place="${p.key}" transform="translate(${p.x} ${p.y}) scale(0.8)">`
    + (LANDMARKS[p.landmark] || LANDMARKS.landing)()
    + '</g>').join('');

  const tie = voyage(here, here)[0];
  const boatArt = (BOAT_ART[boat] || BOAT_ART.rowboat)();

  // Old-chart dressing: a compass rose, a scale of leagues, a border ruled in
  // degrees, a lighthouse on the point and something in the sea.
  const compass = '<g class="compass" transform="translate(1440 120) scale(1.5)">'
    + '<circle class="compass-ring" r="22"/><circle class="compass-ring" r="17"/>'
    + '<path class="compass-star" d="M0 -26L4 -4L0 0L-4 -4zM0 26L4 4L0 0L-4 4z"/>'
    + '<path class="compass-star dim" d="M-26 0L-4 -4L0 0L-4 4zM26 0L4 -4L0 0L4 4z"/>'
    + '<text class="compass-n" x="0" y="-30">N</text></g>';
  const scale = '<g class="scale-bar" transform="translate(40 960)">'
    + '<path class="scale-ink" d="M0 0h160M0 -5v10M40 -4v8M80 -5v10M120 -4v8M160 -5v10"/>'
    + '<path class="scale-fill" d="M0 -3h40v6h-40zM80 -3h40v6h-40z"/>'
    + `<text class="scale-text" x="80" y="-12">${esc(t('Leagues').toUpperCase())}</text></g>`;
  const ticks = [];
  for (let x = 100; x < W; x += 100) ticks.push(`M${x} 0v8M${x} ${H}v-8`);
  for (let y = 100; y < H; y += 100) ticks.push(`M0 ${y}h8M${W} ${y}h-8`);
  const lighthouse = '<g class="lighthouse" transform="translate(1516 430)">'
    + '<path class="wall ink" d="M-6 14L-4 -18H4L6 14Z"/><path class="roof ink" d="M-6 -18h12l-6 -8z"/>'
    + '<rect class="glow" x="-3" y="-17" width="6" height="5"/><path class="light-beam" d="M3 -15L60 -34L60 4Z"/>'
    + '<path class="ink" d="M-3 -4h6M-4 6h8"/></g>';
  const serpent = '<g class="serpent" transform="translate(1560 960)">'
    + '<path class="ink serpent-body" d="M-40 0q10-16 20 0t20 0t20 0"/><path class="ink" d="M20 0q6-12 12-8l-2 4"/></g>';
  const birds = '<path class="birds" d="M820 70q5-5 10 0q5-5 10 0M852 92q4-4 8 0q4-4 8 0M1260 620q4-4 8 0q4-4 8 0M300 300q4-4 8 0q4-4 8 0"/>';

  return `<svg class="map-art world-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
    <defs>
      <radialGradient id="wm-vignette" cx="50%" cy="48%" r="72%">
        <stop class="vignette-clear" offset="62%"/><stop class="vignette-edge" offset="100%"/>
      </radialGradient>
      ${labelPaths()}
      <g id="wm-water">${water}</g>
      <linearGradient id="wm-sea" x1="0" y1="0" x2="1" y2="0">
        <stop class="sea-near" offset="0"/><stop class="sea-far" offset="1"/>
      </linearGradient>
      ${TREE_SYMBOLS}
    </defs>
    <rect class="land" x="0" y="0" width="${W}" height="${H}"/>
    <g class="hills">${sc.hills}</g>
    <g class="fields">${sc.fields}</g>
    <use class="water-sand" href="#wm-water"/>
    <use class="water-edge" href="#wm-water"/>
    <use class="water" href="#wm-water"/>
    <path class="sea-glow" d="${sea}" fill="url(#wm-sea)"/>
    ${seaLines}
    ${riverLines}
    <path class="sea-waves" d="M1548 500q8 -5 16 0t16 0M1560 640q8 -5 16 0t16 0M1560 760q8 -5 16 0t16 0M1540 860q8 -5 16 0t16 0M1450 1000q8 -5 16 0t16 0"/>
    <path class="current" d="${line(g.center.filter((_, i) => i % 2 === 0))}"/>
    ${ROADS.map((r) => `<path class="road" d="${line(smooth(r, 8))}"/>`).join('')}
    ${BRIDGES.map((b) => `<g class="bridge" transform="translate(${b.x} ${b.y}) rotate(${b.angle})">`
      + '<rect class="bridge-deck" x="-15" y="-4" width="30" height="8"/><path class="bridge-rail" d="M-15 -4h30M-15 4h30M-9 -4v8M-3 -4v8M3 -4v8M9 -4v8"/></g>').join('')}
    <path class="reeds" d="${sc.reeds}"/>
    <g class="trees">${sc.trees}</g>
    <g class="cypress-trees">${sc.cypress}</g>
    ${birds}
    ${labels()}
    ${lighthouse}
    ${serpent}
    <rect class="vignette" x="0" y="0" width="${W}" height="${H}" fill="url(#wm-vignette)"/>
    ${route.length > 1 ? `<path class="route" d="${line(route)}"/>` : ''}
    ${ahead.length > 1 ? `<path class="route-ahead" d="${line(ahead)}"/>` : ''}
    ${places}
    ${stops}
    <g class="your-boat" transform="translate(${f1(tie[0])} ${f1(tie[1])})"><g class="bob"><g class="you">${boatArt}</g></g></g>
    ${compass}
    ${scale}
    <path class="border-ticks" d="${ticks.join('')}"/>
    <rect class="chart-border" x="3" y="3" width="${W - 6}" height="${H - 6}"/>
  </svg>`;
}
