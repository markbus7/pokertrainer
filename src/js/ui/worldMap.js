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
 *  - The boatyard has its slip on Gold Creek, a little up from the river.
 *  - At the end the river splits again into the delta, and runs out through
 *    three mouths into the sea.
 *  - Off the river, the backwaters (data/backwaters.js): a wagon road up into
 *    the diggings from the Catch Book, a creek from the racing chute down
 *    into the cypress to a lagoon, and a landing up the Black River. Each is
 *    uncharted until somebody tells you what is there.
 *
 * As before, nothing here carries a colour of its own: every shape names what
 * it is made of and river.css paints it from the room's map tokens, so one
 * chart is the river by moonlight, at dusk, in the bayou and by day.
 */

import { LANDMARKS, yourBoat } from './riverArt.js';
import { fogLayer } from './fog.js';
import { t } from '../i18n/index.js';

/**
 * The chart's own coordinate space. The page scales it, and on every screen
 * shows a window of it that is dragged around: the country is four times the
 * size of the river that runs through it.
 */
export const WORLD = { W: 3200, H: 2000 };

/**
 * Where the river country sits in the world. The river was drawn first, on a
 * chart of its own, and the regions round it were added later: everything
 * that was on that first chart keeps its place relative to the rest, shifted
 * by this much.
 */
const OX = 1000;
const OY = 500;
const sh = (pts) => pts.map(([x, y]) => [x + OX, y + OY]);
const shAt = (p) => ({ ...p, x: p.x + OX, y: p.y + OY });

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

/**
 * The Long River, west to east: rising on the prairie, past Mud Landing, and
 * down to the head of the delta.
 */
const MAIN_KNOTS = [
  [-40, 840], [180, 852], [420, 806], [640, 772], [840, 726],
  ...sh([
    [-40, 196], [40, 208], [120, 236], [205, 290], [285, 350], [380, 382], [470, 370],
    [560, 338], [650, 332], [740, 360], [820, 410], [900, 446], [990, 458], [1080, 452],
    [1160, 462], [1240, 500], [1300, 550],
  ]),
];

/** Where the delta splits, and its three mouths to the sea. */
const DELTA = [
  sh([[1300, 550], [1370, 548], [1450, 566], [1530, 574], [1640, 572]]),
  sh([[1300, 550], [1360, 598], [1420, 650], [1500, 686], [1640, 700]]),
  sh([[1300, 550], [1330, 620], [1370, 720], [1430, 810], [1520, 872], [1640, 900]]),
];

const TRIBUTARIES = {
  // Silas's creek, down out of the High Country to join above Fisher's Rest.
  school: [[1500, -40], [1470, 140], [1442, 320], ...sh([[430, -40], [405, 60], [372, 160], [330, 250], [290, 340]])],
  // Up from the Diggings in the south.
  gold: [[1520, 2040], [1580, 1860], [1610, 1690], ...sh([[600, 1040], [566, 930], [560, 820], [584, 700], [612, 580], [632, 460], [640, 340]])],
  // The Black River, down from the north to the fork where the Trading Post stands.
  black: [[2130, -40], [2186, 140], [2232, 320], ...sh([[1230, -40], [1200, 70], [1168, 180], [1158, 300], [1164, 400], [1162, 460]])],
  // Silver Creek, out of Silver Lake in the High Country.
  silver: [[716, 318], [730, 450], [756, 590], [790, 730]],
  // Buffalo Creek, across the prairie from the south-west.
  buffalo: [[260, 2040], [300, 1760], [350, 1460], [400, 1160], [452, 812]],
  // Bayou Noir, down from the delta through the cypress to the south.
  noir: [[2370, 1220], [2300, 1400], [2200, 1560], [2120, 1720], [2066, 1880], [2050, 2040]],
};

/** The racing chute: the straight channel south of Belle Island. */
const CHUTE = sh([[905, 450], [922, 556], [966, 650], [1060, 692], [1154, 668], [1214, 596], [1240, 502]]);

/** Down from the racing chute into the cypress, and the lagoon at the end of it. */
const BAYOU_CREEK = sh([[1052, 694], [1060, 748], [1080, 796], [1104, 830]]);
const LAGOON = { cx: 1118 + OX, cy: 846 + OY, rx: 46, ry: 22 };

/** The cut-off bend where the old steamer is laid up, and the ditch to it. */
const OXBOW = { cx: 690 + OX, cy: 168 + OY, rx: 96, ry: 52 };
const OXBOW_CUT = sh([[700, 218], [712, 270], [716, 336]]);

/** Silver Lake, high in the hills to the north-west, where Silver Creek rises. */
const SILVER_LAKE = { cx: 700, cy: 250, rx: 170, ry: 80 };
/** The still pools of the bayou, south of the delta. */
const POOLS = [
  { cx: 2210, cy: 1640, rx: 60, ry: 26 }, { cx: 1990, cy: 1800, rx: 46, ry: 20 },
  { cx: 2260, cy: 1880, rx: 70, ry: 28 }, { cx: 1880, cy: 1600, rx: 34, ry: 16 },
];
const LAKES = [OXBOW, LAGOON, SILVER_LAKE, ...POOLS];

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
].map(shAt);

export const stopAt = (i) => STOP_POINTS[Math.max(0, Math.min(STOP_POINTS.length - 1, i))];

/**
 * The towns off the river, keyed as in data/backwaters.js: where each is
 * drawn, and where a boat ties up there — on the lagoon, at the landing — or
 * null for a town at the end of a road, where the boat waits at the stop.
 */
export const TOWN_POINTS = {
  gulch: { x: 1330, y: 1690, moor: null },
  bayou: { x: 2186, y: 1334, moor: [2098, 1350] },
  bethel: { x: 2300, y: 190, moor: [2203, 190] },
  // The regions' cities, on the road.
  sweetwater: { x: 620, y: 1060, moor: null },
  timber: { x: 930, y: 250, moor: [838, 256] },
  copperhead: { x: 1720, y: 1600, moor: [1604, 1600] },
  lafitte: { x: 2240, y: 1760, moor: [2113, 1740] },
  eagle: { x: 2060, y: 300, moor: [2226, 300] },
  pelican: { x: 2400, y: 420, moor: [2545, 430] },
  // More backwaters.
  fort: { x: 380, y: 600, moor: null },
  cove: { x: 2830, y: 1400, moor: [2680, 1430] },
};

/** The places that are not tables: each with the landmark it is drawn as. */
export const PLACES = [
  { key: 'school', route: 'train', landmark: 'school', x: 262, y: 104, name: 'Silas\'s Card School', label: 'Lessons' },
  { key: 'saloon', route: 'play', landmark: 'saloon', x: 116, y: 352, name: 'The Saloon', label: 'Practice table' },
  { key: 'pilothouse', route: 'ranges', landmark: 'pilothouse', x: 690, y: 160, name: 'The Pilot House', label: 'Range charts' },
  { key: 'assay', route: 'lab', landmark: 'assay', x: 470, y: 690, name: 'The Assay Office', label: 'The Lab' },
  { key: 'race', route: 'gauntlet', landmark: 'race', x: 862, y: 640, name: 'The Racing Chute', label: 'The Race' },
  { key: 'tradingpost', route: 'store', landmark: 'tradingpost', x: 1070, y: 290, name: 'The Trading Post', label: 'Spend pearls' },
  { key: 'boatyard', route: 'boatyard', landmark: 'boatyard', x: 550, y: 556, name: 'The Boatyard', label: 'Boats and fittings' },
  { key: 'tackle', route: 'catchbook', landmark: 'tackle', x: 250, y: 600, name: 'The Catch Book', label: 'Every fish is a spot played right' },
].map(shAt);

/**
 * The regions round the river, each lettered across its own country: where
 * the name goes, and roughly how far the region reaches, for the fog.
 */
export const REGIONS = [
  { key: 'prairie', name: 'The Prairie', x: 470, y: 1180, size: 46 },
  { key: 'high', name: 'The High Country', x: 1200, y: 120, size: 44 },
  { key: 'diggings', name: 'The Diggings', x: 1020, y: 1820, size: 40 },
  { key: 'bayou', name: 'The Bayou', x: 2000, y: 1940, size: 40 },
  { key: 'coast', name: 'The Coast', x: 2770, y: 470, size: 40, sea: true },
];

/** How far round each thing the fog is cleared, in chart units. */
export const FOG_CLEAR = { stop: 230, place: 125, town: 160 };

/**
 * Where the river's chart is clear: every stop you have been to and the next
 * one down, the places that are not tables, and the towns you have heard of.
 * Null once you have reached the delta: there is nothing left on the river to
 * find. `charted` is how far the chart had been cleared before; the stops past
 * it are fresh, and the fog draws back from them as the chart is shown.
 *
 * @param {{best:number, heard?:string[], charted?:number|null}} o
 * @returns {null | {holes:Array<{x:number,y:number,r:number,fresh:boolean}>, reach:number}}
 */
export function riverFog({ best, heard = [], charted = null }) {
  const last = STOP_POINTS.length - 1;
  if (best >= last) return null;
  const reach = Math.min(last, Math.max(0, best) + 1);
  const holes = [];
  for (let i = 0; i <= reach; i++) {
    const p = STOP_POINTS[i];
    holes.push({ x: p.x, y: p.y, r: FOG_CLEAR.stop, fresh: charted != null && i > charted });
  }
  // The reach of the river just above Mud Landing.
  holes.push({ x: 960, y: 700, r: 180, fresh: false });
  for (const p of PLACES) holes.push({ x: p.x, y: p.y + 30, r: FOG_CLEAR.place, fresh: false });
  for (const key of heard) {
    const p = TOWN_POINTS[key];
    if (!p) continue;
    holes.push({ x: p.x, y: p.y + 20, r: FOG_CLEAR.town, fresh: false });
    // The water that takes you there, too.
    if (p.moor) holes.push({ x: (p.x + p.moor[0]) / 2, y: (p.y + p.moor[1]) / 2, r: 110, fresh: false });
    if (key === 'bayou') holes.push({ x: 1072 + OX, y: 760 + OY, r: 100, fresh: false });
  }
  return { holes, reach };
}

/**
 * Names on the water, lettered along it the way a chart does: each follows
 * a line of its own just off its water, clear of the boat's route.
 */
export const WATER_NAMES = [
  { id: 'long', text: 'The Long River', size: 13, pts: sh([[118, 280], [186, 326], [246, 372]]) },
  { id: 'upper', text: 'The Long River', size: 15, pts: [[150, 806], [330, 790], [520, 752]] },
  { id: 'school', text: 'School Creek', size: 11, pts: sh([[442, 16], [424, 86], [402, 156]]) },
  { id: 'gold', text: 'Gold Creek', size: 11, pts: sh([[588, 900], [580, 810], [602, 720]]) },
  { id: 'black', text: 'Black River', size: 11, pts: sh([[1224, 56], [1204, 126], [1190, 196]]) },
  { id: 'silver', text: 'Silver Creek', size: 11, pts: [[700, 410], [716, 500], [736, 590]] },
  { id: 'buffalo', text: 'Buffalo Creek', size: 11, pts: [[290, 1640], [326, 1460], [358, 1300]] },
  { id: 'noir', text: 'Bayou Noir', size: 11, pts: [[2230, 1560], [2160, 1680], [2110, 1790]] },
  { id: 'delta', text: 'The Delta', size: 11, pts: sh([[1350, 636], [1438, 708]]) },
  { id: 'gulf', text: 'The Gulf', size: 22, pts: [[2900, 700], [2920, 1100]], sea: true },
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
    + `<textPath href="#wm-name-${n.id}" xlink:href="#wm-name-${n.id}" startOffset="50%" text-anchor="middle">${esc(t(n.text).toUpperCase())}</textPath></text>`).join('');
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
    ...Object.values(TOWN_POINTS).map((p) => ({ x: p.x, y: p.y, r: 56 })),
    ...WATER_NAMES.flatMap((n) => smooth(n.pts, 6).map(([x, y]) => ({ x, y: y - n.size / 3, r: n.size }))),
    ...ROADS.flatMap((r) => smooth(r, 6).map(([x, y]) => ({ x, y, r: 7 }))),
  ];
  const boxes = [
    ...STOP_POINTS.map((p) => (p.side < 0
      ? { x0: p.x - 112, x1: p.x + 112, y0: p.y - 124, y1: p.y - 36 }
      : { x0: p.x - 112, x1: p.x + 112, y0: p.y + 20, y1: p.y + 108 })),
    ...PLACES.map((p) => ({ x0: p.x - 96, x1: p.x + 96, y0: p.y + 22, y1: p.y + 96 })),
    ...Object.values(TOWN_POINTS).map((p) => ({ x0: p.x - 96, x1: p.x + 96, y0: p.y + 22, y1: p.y + 96 })),
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
    { pts: smooth(BAYOU_CREEK, 10), w: 16 },
  ];
  return lines;
}

function nearWater(x, y, pad, lines) {
  for (const { pts, w } of lines) {
    for (let i = 0; i < pts.length; i += 2) {
      if (Math.hypot(x - pts[i][0], y - pts[i][1]) < w / 2 + pad) return true;
    }
  }
  for (const o of LAKES) {
    if (((x - o.cx) / (o.rx + pad)) ** 2 + ((y - o.cy) / (o.ry + pad)) ** 2 < 1) return true;
  }
  return false;
}

/**
 * Wagon roads between the places on land, kept off the name plates, and
 * the bridges where they cross the creeks.
 */
const ROADS = [
  ...[
    [[152, 128], [196, 114], [230, 110]],                          // Mud Landing up to the school
    [[152, 346], [215, 388], [280, 428], [330, 460]],              // the saloon along to Fisher's Rest
    [[508, 696], [584, 706], [700, 690], [822, 650]],              // the assay office over Gold Creek to the races
    [[1112, 286], [1160, 302], [1222, 340], [1262, 372]],          // the Trading Post over the Black River to the Barge
  ].map(sh),
  [[1262, 1202], [1288, 1390], [1308, 1540], [1322, 1656]],        // the wagon road from the Catch Book south into the Diggings
  [[2262, 198], [2232, 194], [2212, 192]],                         // Bethel down to its landing on the Black River
  [[1050, 856], [900, 930], [760, 1006], [668, 1044]],             // the drovers' trail from the Saloon out to Sweetwater
  [[1088, 628], [900, 622], [760, 622], [600, 612], [462, 604]],   // the old road west from Mud Landing to Fort Ransom
  [[2098, 300], [2150, 300], [2206, 300]],                         // Eagle Rock down to the Black River
  [[2440, 426], [2480, 428], [2510, 430]],                         // Pelican Point's wharf
];
const BRIDGES = [
  { x: 583 + OX, y: 706 + OY, angle: 4 },
  { x: 1162 + OX, y: 303 + OY, angle: 26 },
  { x: 757, y: 622, angle: 0 },
];

/**
 * The coastline, north to south: land west of it, the sea east. It runs the
 * whole height of the chart, and only ever down it, so the sea at any height
 * is everything east of one point on it.
 */
const COAST = [
  [2480, -40], [2502, 140], [2478, 300], [2496, 460],
  ...sh([[1514, 90], [1494, 210], [1516, 330], [1530, 450], [1526, 560], [1540, 640], [1556, 700],
    [1530, 800], [1504, 880], [1450, 950], [1400, 1040]]),
  [2366, 1700], [2420, 1860], [2392, 2040],
];
let coastCache = null;
const coastLine = () => (coastCache || (coastCache = smooth(COAST, 12)));

/** Islands off the coast, each an irregular blob around an ellipse. */
export const ISLANDS = [
  { cx: 2820, cy: 1420, rx: 120, ry: 70, wobble: 0.14, seed: 1.1 },
  { cx: 2760, cy: 260, rx: 80, ry: 46, wobble: 0.18, seed: 2.3 },
  { cx: 3020, cy: 1820, rx: 70, ry: 40, wobble: 0.2, seed: 0.7 },
  { cx: 2980, cy: 820, rx: 46, ry: 30, wobble: 0.2, seed: 2.9 },
];
const onIsland = (x, y, pad = 0) => ISLANDS.some((o) => ((x - o.cx) / Math.max(1, o.rx - pad)) ** 2 + ((y - o.cy) / Math.max(1, o.ry - pad)) ** 2 < 0.85);
function islandPath(o) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const k = 1 + o.wobble * Math.sin(a * 3 + o.seed) * Math.cos(a * 2 - o.seed);
    pts.push([o.cx + Math.cos(a) * o.rx * k, o.cy + Math.sin(a) * o.ry * k]);
  }
  pts.push(pts[0], pts[1]);
  return `${line(smooth(pts, 6))}Z`;
}

function inSea(x, y) {
  if (onIsland(x, y)) return false;
  const coast = coastLine();
  let cx = coast[coast.length - 1][0];
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
  const inside = (x, y) => x > 8 && x < WORLD.W - 8 && y > 8 && y < WORLD.H - 8;

  // Forests: clusters rather than a scatter, the way woods actually grow. The
  // river country's own woods first, then the regions round it: pine on the
  // high ground and in the Diggings, broadleaf along the prairie creeks.
  const groves = [
    ...[
      [960, 110, 120, 'broad'], [1320, 170, 90, 'pine'], [620, 520, 60, 'broad'], [230, 620, 110, 'broad'],
      [820, 860, 130, 'broad'], [1120, 830, 90, 'broad'], [40, 520, 90, 'pine'], [1380, 330, 70, 'broad'],
      [300, 900, 90, 'pine'], [940, 220, 60, 'broad'], [560, 120, 60, 'pine'], [110, 700, 60, 'pine'],
    ].map(([x, y, r, k]) => [x + OX, y + OY, r, k]),
    // The High Country.
    [260, 140, 120, 'pine'], [470, 420, 110, 'pine'], [980, 300, 130, 'pine'], [1700, 110, 120, 'pine'],
    [1960, 330, 110, 'pine'], [2340, 380, 90, 'pine'], [120, 440, 90, 'pine'], [1260, 420, 80, 'pine'],
    // The Prairie: thin woods along the creeks, and a few stands on the open grass.
    [380, 1000, 70, 'broad'], [560, 1420, 80, 'broad'], [180, 1260, 70, 'broad'], [700, 980, 60, 'broad'],
    [120, 1760, 90, 'broad'], [760, 1700, 70, 'broad'],
    // The Diggings.
    [1100, 1640, 90, 'pine'], [1460, 1880, 80, 'pine'], [1760, 1600, 70, 'pine'], [940, 1940, 70, 'pine'],
    // The Bayou's dry ground.
    [1880, 1960, 60, 'broad'], [2300, 1720, 50, 'broad'],
  ];
  const trees = [];
  for (const [gx, gy, gr, kind] of groves) {
    for (let n = 0; n < 110; n++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * gr;
      const x = gx + Math.cos(a) * d;
      const y = gy + Math.sin(a) * d * 0.7;
      const r = 4.5 + rnd() * 3.5;
      if (!inside(x, y) || !clear(x, y, 6)) continue;
      trees.push({ x, y, r, kind });
    }
  }
  // Back to front, so each crown stands in front of the one behind it and a
  // grove reads as a wood rather than a scatter of dots.
  trees.sort((a, b) => a.y - b.y);
  // Three sizes of tree, each drawn once and stamped where it grows.
  const treeArt = trees.map(({ x, y, r, kind }) => {
    const ref = `#wm-${kind}-${r < 5.7 ? 's' : r < 6.9 ? 'm' : 'l'}`;
    return `<use href="${ref}" xlink:href="${ref}" x="${f1(x)}" y="${f1(y)}"/>`;
  });

  // Cypress: by the delta, and all through the Bayou to the south of it.
  const cypress = [];
  const cypressIn = [[1180 + OX, 700 + OY, 260, 280, 46], [1800, 1480, 600, 520, 150]];
  for (const [x0, y0, w, h, most] of cypressIn) {
    let made = 0;
    for (let n = 0; n < most * 5 && made < most; n++) {
      const x = x0 + rnd() * w;
      const y = y0 + rnd() * h;
      if (!inside(x, y) || !clear(x, y, 4)) continue;
      const tall = 12 + rnd() * 8;
      cypress.push(`<path class="cypress" d="M${f1(x)} ${f1(y)}l-4 0 4 -${f1(tall)} 4 ${f1(tall)}z"/>`);
      made += 1;
    }
  }

  // Farmland: cotton rows by Cotton Row, and the homesteads along the upper river.
  const fieldAt = [
    ...[[640, 600], [760, 560], [300, 560], [1000, 380], [420, 180], [1180, 700], [120, 460]].map(([x, y]) => [x + OX, y + OY]),
    [260, 930], [520, 900], [700, 880], [140, 980], [610, 650], [320, 680], [860, 640], [440, 1080], [820, 1140],
  ];
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

  // The open prairie: grass in tufts, as far as the creeks let it.
  const grass = [];
  for (let n = 0; n < 1400 && grass.length < 420; n++) {
    const x = rnd() * 980;
    const y = 860 + rnd() * 1120;
    if (!clear(x, y, 4)) continue;
    grass.push(`M${f1(x - 3)} ${f1(y)}l2 -5M${f1(x)} ${f1(y)}v-6M${f1(x + 3)} ${f1(y)}l-2 -5`);
  }

  // Mountains: the High Country along the whole north, the hills the creeks
  // come down out of, and the Diggings in the south round Gold Creek.
  const hills = [];
  const ranges = [
    ...[
      [470, 64, 4, 1.1], [30, 640, 3, 0.9], [120, 850, 4, 1], [380, 900, 4, 1.15],
      [650, 950, 3, 0.9], [1330, 60, 3, 0.8], [760, 130, 2, 0.7],
    ].map(([x, y, c, b]) => [x + OX, y + OY, c, b]),
    // The High Country: range after range, the big ones in the middle.
    [60, 90, 5, 1.2], [360, 70, 4, 1.4], [900, 90, 6, 1.5], [1180, 260, 5, 1.3], [1560, 60, 5, 1.35],
    [1820, 230, 5, 1.25], [2050, 70, 4, 1.2], [2330, 290, 3, 1], [120, 330, 4, 1.1], [560, 470, 4, 1],
    [1350, 380, 3, 0.9], [1900, 440, 3, 0.9],
    // The Diggings.
    [930, 1560, 4, 1.1], [1150, 1760, 5, 1.2], [1380, 1560, 3, 1], [1640, 1780, 4, 1.15], [1000, 1900, 4, 1],
    [1700, 1940, 3, 0.9],
  ];
  for (const [hx, hy, count, big] of ranges) {
    for (let k = 0; k < count; k++) {
      const x = hx + k * 46 * big + (rnd() - 0.5) * 14;
      const y = hy + (rnd() - 0.5) * 24 + (k % 2) * 10;
      if (!inside(x, y) || !clear(x, y - 10, 4)) continue;
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

  // The Diggings' workings: a headframe over a shaft, and its spoil heap.
  const mines = [];
  for (const [x, y] of [[1040, 1700], [1230, 1620], [1500, 1700], [1720, 1680], [1180, 1900], [1590, 1960], [880, 1780]]) {
    if (!clear(x, y, 8)) continue;
    mines.push(`<g class="mine" transform="translate(${x} ${y})"><path class="ink" d="M-6 6L0 -10L6 6M-4 0h8M0 -10v-3"/>`
      + '<path class="spoil" d="M6 6q8-8 16 0z"/></g>');
  }

  // Reeds along the banks, in the wet by the delta, and all through the Bayou.
  const { center } = worldGeometry();
  const reeds = [];
  for (let i = 6; i < center.length - 4; i += 5) {
    if (rnd() < 0.5) continue;
    const [x, y] = center[i];
    const side = rnd() < 0.5 ? -1 : 1;
    const yy = y + side * (riverWidth(i, center.length) / 2 + 3);
    reeds.push(`M${f1(x)} ${f1(yy)}v-7M${f1(x + 3)} ${f1(yy + 1)}v-6M${f1(x - 3)} ${f1(yy + 1)}v-5`);
  }
  for (const [x0, y0, w, h, n] of [[1200 + OX, 740 + OY, 260, 220, 40], [1820, 1500, 560, 480, 160]]) {
    for (let k = 0; k < n; k++) {
      const x = x0 + rnd() * w;
      const y = y0 + rnd() * h;
      if (!inside(x, y) || !clear(x, y, 2)) continue;
      reeds.push(`M${f1(x)} ${f1(y)}v-7M${f1(x + 3)} ${f1(y + 1)}v-6M${f1(x - 3)} ${f1(y + 1)}v-5`);
    }
  }

  return {
    trees: treeArt.join(''), cypress: cypress.join(''), fields: fields.join(''), hills: hills.map((h) => h.art).join(''), reeds: reeds.join(''),
    grass: grass.join(''), mines: mines.join(''),
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
 * @param {Array<{key:string, landmark:string, heard:boolean, here:boolean, done:boolean}>} [s.towns]
 *   the backwaters: drawn once you have heard of them, a question mark until then
 * @param {{holes:Array<{x:number,y:number,r:number,fresh?:boolean}>}|null} [s.fog]
 *   the country you have not been to, with the holes where you have (ui/fog.js); none once the river is won
 */
export function worldSvg({ here, best, open, beaten, boat, landmarks, towns = [], fog = null }) {
  const { W, H } = WORLD;
  const g = worldGeometry();
  const sc = scenery();

  const deltaWidth = (i, n) => 38 - (i / (n - 1)) * 6 + (i === n - 1 ? 30 : 0);
  const creekWidth = (i, n) => 8 + (i / (n - 1)) * 14;
  const coast = coastLine();
  const sea = `${line(coast)} L${W + 40} ${H + 40} L${W + 40} -40Z`;
  const waters = [
    sea,
    ribbon(g.main),
    ...DELTA.map((k) => ribbon(banks(smooth(k, 16), deltaWidth))),
    ...Object.values(TRIBUTARIES).map((k) => ribbon(banks(smooth(k, 16), creekWidth))),
    ribbon(banks(smooth(CHUTE, 16), () => 26)),
    ribbon(banks(smooth(OXBOW_CUT, 8), () => 10)),
    ribbon(banks(smooth(BAYOU_CREEK, 10), () => 12)),
  ];
  // Every stretch of water, as one set of shapes. It is laid down three
  // times — a band of sand, a wet edge, then the water — and each pass covers
  // the inside of the last, so where two waters meet there is no seam.
  const water = LAKES.map((o) => `<ellipse cx="${o.cx}" cy="${o.cy}" rx="${o.rx}" ry="${o.ry}"/>`).join('')
    + waters.map((d) => `<path d="${d}"/>`).join('');
  // Engraved lines a little in from each bank of the main river, and off
  // the coast, the way the old charts showed water.
  const inner = banks(g.center, (i, n) => riverWidth(i, n) - 10);
  const riverLines = `<path class="water-line" d="${line(inner.left)}"/><path class="water-line" d="${line(inner.right)}"/>`;
  const seaLines = [10, 22, 38, 60].map((dx, k) => `<path class="sea-line l${k}" d="${line(coast.map(([x, y]) => [x + dx, y]))}"/>`).join('');

  // Where you have been, and the rest of the way to the sea.
  const route = voyage(0, Math.max(best, here));
  const ahead = voyage(Math.max(best, here), STOP_POINTS.length - 1);

  // Up a backwater, the boat is at the town, not at the stop it left from.
  const inTown = towns.some((town) => town.here);
  const stops = landmarks.map((key, i) => {
    const p = STOP_POINTS[i];
    const shut = i > open && i > best;
    const isHere = i === here && !inTown;
    const cls = ['landmark', shut ? 'shut' : '', isHere ? 'here' : '', beaten.has(i) ? 'beaten' : ''].filter(Boolean).join(' ');
    return (i === STOP_POINTS.length - 1 ? '' : `<path class="jetty" d="${jetty(p)}"/>`)
      + `<g class="${cls}" data-index="${i}" transform="translate(${p.x} ${p.y}) scale(0.9)">`
      + (isHere ? '<ellipse class="here-glow" cx="0" cy="2" rx="52" ry="36"/><ellipse class="here-ring" cx="0" cy="2" rx="52" ry="36"/>' : '')
      + (LANDMARKS[key] || LANDMARKS.landing)()
      + '</g>';
  }).join('');

  const places = PLACES.map((p) => `<g class="place" data-place="${p.key}" transform="translate(${p.x} ${p.y}) scale(0.8)">`
    + (LANDMARKS[p.landmark] || LANDMARKS.landing)()
    + '</g>').join('');

  // The towns off the river: the drawing once you know what is there, and
  // until then a mark on the chart where somebody has written a question.
  const townArt = towns.map((town) => {
    const p = TOWN_POINTS[town.key];
    if (!p) return '';
    if (!town.heard) {
      return `<g class="town uncharted" data-town="${town.key}" transform="translate(${p.x} ${p.y})">`
        + '<circle class="uncharted-ring" r="22"/><text class="uncharted-mark" y="8">?</text></g>';
    }
    const cls = ['town', town.here ? 'here' : '', town.done ? 'done' : ''].filter(Boolean).join(' ');
    return `<g class="${cls}" data-town="${town.key}" transform="translate(${p.x} ${p.y}) scale(0.8)">`
      + (town.here ? '<ellipse class="here-glow" cx="0" cy="2" rx="52" ry="36"/><ellipse class="here-ring" cx="0" cy="2" rx="52" ry="36"/>' : '')
      + (LANDMARKS[town.landmark] || LANDMARKS.landing)()
      + '</g>';
  }).join('');

  // Your boat: at the stop you are at, or tied up at the town you went up to.
  const moored = towns.find((town) => town.here && TOWN_POINTS[town.key] && TOWN_POINTS[town.key].moor);
  const tie = moored ? TOWN_POINTS[moored.key].moor : voyage(here, here)[0];

  // Old-chart dressing: a compass rose, a scale of leagues, a border ruled in
  // degrees, a lighthouse on the point and something in the sea.
  const compass = '<g class="compass" transform="translate(3060 150) scale(1.8)">'
    + '<circle class="compass-ring" r="22"/><circle class="compass-ring" r="17"/>'
    + '<path class="compass-star" d="M0 -26L4 -4L0 0L-4 -4zM0 26L4 4L0 0L-4 4z"/>'
    + '<path class="compass-star dim" d="M-26 0L-4 -4L0 0L-4 4zM26 0L4 -4L0 0L4 4z"/>'
    + '<text class="compass-n" x="0" y="-30">N</text></g>';
  const scale = '<g class="scale-bar" transform="translate(60 1950)">'
    + '<path class="scale-ink" d="M0 0h160M0 -5v10M40 -4v8M80 -5v10M120 -4v8M160 -5v10"/>'
    + '<path class="scale-fill" d="M0 -3h40v6h-40zM80 -3h40v6h-40z"/>'
    + `<text class="scale-text" x="80" y="-12">${esc(t('Leagues').toUpperCase())}</text></g>`;
  const ticks = [];
  for (let x = 100; x < W; x += 100) ticks.push(`M${x} 0v8M${x} ${H}v-8`);
  for (let y = 100; y < H; y += 100) ticks.push(`M0 ${y}h8M${W} ${y}h-8`);
  const lighthouse = '<g class="lighthouse" transform="translate(2516 930)">'
    + '<path class="wall ink" d="M-6 14L-4 -18H4L6 14Z"/><path class="roof ink" d="M-6 -18h12l-6 -8z"/>'
    + '<rect class="glow" x="-3" y="-17" width="6" height="5"/><path class="light-beam" d="M3 -15L60 -34L60 4Z"/>'
    + '<path class="ink" d="M-3 -4h6M-4 6h8"/></g>';
  const serpent = '<g class="serpent" transform="translate(2980 1600) scale(1.6)">'
    + '<path class="ink serpent-body" d="M-40 0q10-16 20 0t20 0t20 0"/><path class="ink" d="M20 0q6-12 12-8l-2 4"/></g>';
  const birds = '<path class="birds" d="M1820 570q5-5 10 0q5-5 10 0M1852 592q4-4 8 0q4-4 8 0M2260 1120q4-4 8 0q4-4 8 0M1300 800q4-4 8 0q4-4 8 0'
    + 'M420 980q5-5 10 0q5-5 10 0M446 1000q4-4 8 0q4-4 8 0M1300 300q5-5 10 0q5-5 10 0M2700 600q5-5 10 0q5-5 10 0"/>';
  // Each region lettered across its own country, the way a chart names a territory.
  const regionNames = REGIONS.map((r) => `<text class="region-name${r.sea ? ' sea-name' : ''}" x="${r.x}" y="${r.y}" font-size="${r.size}" text-anchor="middle">`
    + `${esc(t(r.name).toUpperCase())}</text>`).join('');

  return `<svg class="map-art world-art" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
    <defs>
      <radialGradient id="wm-vignette" cx="50%" cy="48%" r="72%">
        <stop offset="62%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.3"/>
      </radialGradient>
      ${labelPaths()}
      <g id="wm-water">${water}</g>

      ${TREE_SYMBOLS}
    </defs>
    <rect class="land" x="0" y="0" width="${W}" height="${H}"/>
    <g class="hills">${sc.hills}</g>
    <g class="mines">${sc.mines}</g>
    <g class="fields">${sc.fields}</g>
    <path class="grass" d="${sc.grass}"/>
    <use class="water-sand" href="#wm-water" xlink:href="#wm-water"/>
    <use class="water-edge" href="#wm-water" xlink:href="#wm-water"/>
    <use class="water" href="#wm-water" xlink:href="#wm-water"/>
    ${[36, 76, 124].map((dx) => `<path class="sea-band" d="${line(coast.map(([x, y]) => [x + dx, y]))} L${W + 40} ${H + 40} L${W + 40} -40Z"/>`).join('')}
    ${seaLines}
    ${riverLines}
    ${ISLANDS.map((o) => `<path class="land island" d="${islandPath(o)}"/>`).join('')}
    <path class="sea-waves" d="${[[2600, 200], [2900, 420], [2640, 700], [3100, 600], [2700, 1100], [3050, 1200], [2600, 1640], [2860, 1860], [2520, 1960], [3120, 980]]
    .map(([x, y]) => `M${x} ${y}q8 -5 16 0t16 0`).join('')}"/>
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
    ${townArt}
    ${stops}
    ${fog ? fogLayer({ id: 'wm-fog', W, H, holes: fog.holes }) : ''}
    ${regionNames}
    <g class="your-boat" transform="translate(${f1(tie[0])} ${f1(tie[1])})"><g class="bob">${yourBoat(boat)}</g></g>
    ${compass}
    ${scale}
    <path class="border-ticks" d="${ticks.join('')}"/>
    <rect class="chart-border" x="3" y="3" width="${W - 6}" height="${H - 6}"/>
  </svg>`;
}
