/**
 * The Long River, drawn.
 *
 * Everything here is SVG built from a handful of shapes, and none of it
 * carries a colour: each shape names what it is made of (`ink`, `wall`,
 * `roof`, `glow`, `water`…) and river.css paints those from the room's map
 * tokens. That is what lets one drawing be the river by moonlight, at dusk,
 * in the bayou green and by day without four copies of it.
 *
 * The drawings live here — each stop's landmark, each boat, the scene at a
 * stop — and worldMap.js lays them out on the chart of the whole river.
 */

const f1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ *
 * The landmarks, one per stop, drawn around (0,0) in about 80 x 64
 * ------------------------------------------------------------------ */

const windowsRow = (x0, y, n, step, w = 4, h = 4) => Array.from({ length: n },
  (_, i) => `<rect class="glow" x="${f1(x0 + i * step)}" y="${y}" width="${w}" height="${h}"/>`).join('');


/*
 * The detail a drawing earns when it is seen large: clapboards and shingles
 * (`fine`, a thin pen), the shadow side of a roof, the shadow under the eaves
 * and on the ground (`shade`). river.css shows them only where a drawing is
 * big (a stop's scene, the head of a creek, the boatyard), so the chart of the
 * whole river stays as clean as it was.
 */
const n1 = (n) => f1(n).toString();
/** Clapboards: level lines across a wall, every `step` from the top. */
const siding = (x1, x2, top, bottom, step = 4) => {
  let d = '';
  for (let y = top + step; y < bottom - 0.5; y += step) d += `M${n1(x1)} ${n1(y)}H${n1(x2)}`;
  return `<path class="fine" d="${d}"/>`;
};
/** Rows of shingles on a gable roof from (x1,y) to (x2,y) under its apex (ax,ay). */
const shingles = (x1, x2, y, ax, ay, rows = 2) => {
  let d = '';
  for (let k = 1; k <= rows; k++) {
    const t = k / (rows + 1);
    d += `M${n1(x1 + (ax - x1) * t)} ${n1(y + (ay - y) * t)}H${n1(x2 + (ax - x2) * t)}`;
  }
  return `<path class="fine" d="${d}"/>`;
};
/** Planks standing upright: board-and-batten on a mill or a warehouse. */
const boards = (x1, x2, top, bottom, step = 4) => {
  let d = '';
  for (let x = x1 + step; x < x2 - 0.5; x += step) d += `M${n1(x)} ${n1(top)}V${n1(bottom)}`;
  return `<path class="fine" d="${d}"/>`;
};
/** Dressed stone or brick: level courses, their joints staggered row by row. */
const courses = (x1, x2, top, bottom, step = 4, block = 8) => {
  let d = '';
  let row = 0;
  for (let y = top + step; y < bottom + 0.1; y += step, row++) {
    if (y < bottom - 0.5) d += `M${n1(x1)} ${n1(y)}H${n1(x2)}`;
    for (let x = x1 + (row % 2 ? block : block / 2); x < x2 - 0.5; x += block) d += `M${n1(x)} ${n1(y - step)}V${n1(Math.min(y, bottom))}`;
  }
  return `<path class="fine" d="${d}"/>`;
};
/** The side of a gable away from the light, which comes from the left. */
const gableShade = (x2, y, ax, ay) => `<path class="shade" d="M${n1(ax)} ${n1(ay)}L${n1(x2)} ${n1(y)}H${n1(ax)}z"/>`;
/** The shadow under the eaves, a band across the top of a wall. */
const eaves = (x1, x2, y, h = 2.5) => `<path class="shade" d="M${n1(x1)} ${n1(y)}H${n1(x2)}v${n1(h)}H${n1(x1)}z"/>`;
/** A window's glazing bars, a cross through its middle. */
const panes = (x, y, w, h) => `<path class="fine" d="M${n1(x + w / 2)} ${n1(y)}v${n1(h)}M${n1(x)} ${n1(y + h / 2)}h${n1(w)}"/>`;
/** The shadow a building throws on the ground under it. */
const footShadow = (cx, rx, y = 18) => `<ellipse class="shade" cx="${n1(cx)}" cy="${n1(y + 0.8)}" rx="${n1(rx)}" ry="1.8"/>`;

export const LANDMARKS = {
  landing: () => `
    ${footShadow(-8, 34)}
    <path class="ground" d="M-40 18h80"/>
    <path class="wall ink" d="M-32 18V-3h26v21z"/>
    ${siding(-32, -6, -3, 18)}${eaves(-32, -6, -3)}
    <path class="roof ink" d="M-35 -2L-19 -16L-3 -2z"/>
    ${shingles(-35, -3, -2, -19, -16)}${gableShade(-3, -2, -19, -16)}
    <rect class="glow" x="-26" y="2" width="7" height="7"/>${panes(-26, 2, 7, 7)}
    <path class="ink" d="M-13 18v-10h4v10"/>
    <rect class="wall ink" x="3" y="8" width="10" height="10"/>
    <rect class="wall ink" x="13" y="11" width="8" height="7"/>
    <rect class="wall ink" x="6" y="0" width="8" height="8"/>
    <path class="ink" d="M3 13h10M8 8v10"/>
    <path class="fine" d="M13 14.5h8M6 4h8"/>
    <path class="ink" d="M29 18V-14h7"/>
    <path class="ink" d="M36 -14v3"/>
    <circle class="glow ink" cx="36" cy="-7.5" r="3.4"/>`,

  tavern: () => `
    <path class="shallows" d="M-40 16h80v9h-80z"/>
    <path class="ink" d="M-24 24V7M-11 24V7M3 24V7M17 24V7"/>
    <path class="roof ink" d="M-31 7h55v-3h-55z"/>
    <path class="wall ink" d="M-27 4V-14h46V4z"/>
    ${siding(-27, 19, -14, 4, 3.6)}${eaves(-27, 19, -14)}
    <path class="roof ink" d="M-31 -13L-4 -30L23 -13z"/>
    ${shingles(-31, 23, -13, -4, -30, 3)}${gableShade(23, -13, -4, -30)}
    <path class="roof ink" d="M9 -21v-9h5v12"/>
    <path class="smoke" d="M11.5 -33c-3-3 3-5 0-8s3-5 0-7"/>
    <rect class="glow" x="-21" y="-9" width="6" height="6"/>${panes(-21, -9, 6, 6)}
    <rect class="glow" x="7" y="-9" width="6" height="6"/>${panes(7, -9, 6, 6)}
    <path class="ink" d="M-7 4v-10h6v10"/>
    <path class="ink" d="M23 -5h9M28 -5v3"/>
    <rect class="wall ink" x="23.5" y="-2" width="9" height="6"/>`,

  ferry: () => `
    <path class="ground" d="M-40 18h36"/>
    ${footShadow(-26, 14)}
    <path class="wall ink" d="M-37 18V1h21v17z"/>
    ${siding(-37, -16, 1, 18)}${eaves(-37, -16, 1, 2)}
    <path class="roof ink" d="M-39 2L-26.5 -10L-14 2z"/>
    ${shingles(-39, -14, 2, -26.5, -10)}${gableShade(-14, 2, -26.5, -10)}
    <rect class="glow" x="-31" y="5" width="6" height="6"/>${panes(-31, 5, 6, 6)}
    <path class="ink" d="M-8 18V-15h9"/>
    <path class="glow ink" d="M1 -14c-3 0-3.6 3-4 6.5h8c-.4-3.5-1-6.5-4-6.5z"/>
    <path class="roof ink" d="M-4 13h44l-4 7h-36z"/>
    <path class="fine" d="M-2.3 16h40.6"/><path class="shade" d="M-1.7 17h41.4l-1.7 3h-38z"/>
    <path class="wall ink" d="M8 13V1h19v12z"/>${eaves(8, 27, 1, 2)}
    <path class="roof ink" d="M6 2L17.5 -6L29 2z"/>
    <rect class="glow" x="14" y="4" width="6" height="5"/>`,

  exchange: () => `
    <path class="ground" d="M-40 18h80"/>
    ${footShadow(-6, 40)}
    <path class="wall ink" d="M-35 17V-8h52v25z"/>
    ${eaves(-35, 17, -8, 3)}
    <path class="roof ink" d="M-39 -8L-9 -27L21 -8z"/>
    ${gableShade(21, -8, -9, -27)}
    <path class="ink" d="M-19 -13h20"/>
    <path class="ink" d="M-29 17V-5M-19 17V-5M-9 17V-5M1 17V-5M11 17V-5"/>
    <path class="roof ink" d="M-37 17h56v2h-56z"/>
    <path class="shade" d="M-27 17V-5h-2v22zM-17 17V-5h-2v22zM-7 17V-5h-2v22zM3 17V-5h-2v22zM13 17V-5h-2v22z"/>
    <rect class="glow" x="-26" y="3" width="5" height="8"/>${panes(-26, 3, 5, 8)}
    <rect class="glow" x="-6" y="3" width="5" height="8"/>${panes(-6, 3, 5, 8)}
    <rect class="glow" x="4" y="3" width="5" height="8"/>${panes(4, 3, 5, 8)}
    <rect class="wall ink" x="23" y="8" width="13" height="10" rx="2"/>
    <rect class="wall ink" x="26" y="-2" width="11" height="10" rx="2"/>
    <path class="ink" d="M27 8v10M32 8v10M30 -2v10M34 -2v10"/>`,

  steamer: () => `
    <path class="roof ink" d="M-40 10h78l-8 10h-62z"/>
    <path class="fine" d="M-37.6 13h72.6M-35.2 16h67.8"/><path class="shade" d="M-35.2 16h67.8l-3.2 4h-62z"/>
    <path class="wall ink" d="M-32 10V0h56v10z"/>${eaves(-32, 24, 0, 2)}
    ${windowsRow(-28, 3, 7, 7.5)}
    <path class="wall ink" d="M-25 0V-8h40V0z"/>${eaves(-25, 15, -8, 1.6)}
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
    ${footShadow(0, 42)}
    <path class="wall ink" d="M-38 18V-14h76v32z"/>
    ${siding(-38, 38, -14, 18, 8)}${eaves(-38, 38, -14, 3)}
    <path class="shade" d="M20 -14h18v32h-18z"/>
    <path class="roof ink" d="M-40 -14h80v-4h-80z"/>
    <path class="roof ink" d="M-8 -18v-7h16v7z"/>
    <path class="wall ink" d="M-9 -25a9 9 0 0 1 18 0z"/><path class="shade" d="M0 -34a9 9 0 0 1 9 9h-9z"/>
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
    <path class="fine" d="M-38.7 13h77.4M-37.3 16h74.6"/><path class="shade" d="M-37.3 16h74.6l-2 3h-70.6z"/>
    <path class="glow" d="M-39 10h78v2h-78z"/>
    <path class="wall ink" d="M-31 10V-7h58v17z"/>${eaves(-31, 27, -7, 3)}
    <path class="roof ink" d="M-34 -6c10-9 54-9 64 0z"/>
    <path class="fine" d="M-26 -9.6c10-4 36-4 46 0"/>
    <path class="glow ink" d="M-25 6v-6a3 3 0 0 1 6 0v6zM-12 6v-6a3 3 0 0 1 6 0v6zM1 6v-6a3 3 0 0 1 6 0v6zM14 6v-6a3 3 0 0 1 6 0v6z"/>
    <path class="ink" d="M-40 -19c12 6 30 6 40 0s26-6 40 0"/>
    <circle class="glow" cx="-30" cy="-15.5" r="2.2"/>
    <circle class="glow" cx="-15" cy="-13.4" r="2.2"/>
    <circle class="glow" cx="0" cy="-18" r="2.2"/>
    <circle class="glow" cx="15" cy="-21.6" r="2.2"/>
    <circle class="glow" cx="30" cy="-19.5" r="2.2"/>`,

  // Not stops: the places you study. Drawn in the same hand so the school
  // and the pilot house sit on the same river as the tables.
  school: () => `
    ${footShadow(-6, 30)}
    <path class="ground" d="M-42 18h84"/>
    <path class="wall ink" d="M-30 18V-5h48v23z"/>
    ${siding(-30, 18, -5, 18, 3.8)}${eaves(-30, 18, -5, 3)}
    <path class="roof ink" d="M-34 -4L-6 -23L22 -4z"/>
    ${shingles(-34, 22, -4, -6, -23, 3)}${gableShade(22, -4, -6, -23)}
    <path class="wall ink" d="M-11 -18v-12h10v12"/>
    <path class="shade" d="M-6 -30h5v8.6l-5 3.4z"/>
    <path class="roof ink" d="M-13.5 -30L-6 -41L1.5 -30z"/>
    ${gableShade(1.5, -30, -6, -41)}
    <circle class="glow ink" cx="-6" cy="-24" r="2.4"/>
    <path class="ink" d="M-6 -24v-1.6M-6 -24h1.2"/>
    <rect class="glow" x="-25" y="-1" width="7" height="8"/>
    <rect class="glow" x="6" y="-1" width="7" height="8"/>
    <path class="fine" d="M-21.5 -1v8M9.5 -1v8"/>
    <path class="ink" d="M-25 3h7M6 3h7"/>
    <path class="ink" d="M-26 7.5h9M5 7.5h9"/>
    <path class="roof ink" d="M-10 18v-13h8v13z"/>
    <path class="fine" d="M-6 5v13"/><circle class="ink" cx="-4.2" cy="12" r=".5"/>
    <path class="ink" d="M-12 18v1.5h12V18"/>
    <path class="ink" d="M-13 18h14"/>
    <path class="ink" d="M26 18V-22"/>
    <path class="mark ink" d="M26 -22l12 3.5-12 3.5z"/>
    <path class="ink" d="M-42 11h9M-42 15h9M-40 18v-9M-35 18v-9M30 11h12M30 15h12M33 18v-9M39 18v-9"/>`,

  pilothouse: () => `
    <path class="roof ink" d="M-44 12h88l-9 9h-70z"/>
    <path class="fine" d="M-42 15h84M-39.5 18h79"/>
    <path class="wall ink" d="M-36 12V2h72v10z"/>${eaves(-36, 36, 2, 2)}
    ${windowsRow(-32, 5, 9, 7.8)}
    <path class="wall ink" d="M-26 2V-6h52v8z"/>${eaves(-26, 26, -6, 2)}
    <path class="roof ink" d="M-30 -6v-24h5v24zM-21 -6v-24h5v24z"/>
    <path class="ink" d="M-32 -30h9M-23 -30h9"/>
    <path class="smoke" d="M-27.5 -33c-4-4 4-6 0-10M-18.5 -33c-4-4 4-6 0-10"/>
    <path class="wall ink" d="M-2 -6v-20h26v20z"/>
    ${siding(-2, 24, -12, -6, 2)}${eaves(-2, 24, -26, 2.5)}
    <path class="roof ink" d="M-5 -26h32l-4 -6h-24z"/>
    <rect class="glow" x="1" y="-23" width="9" height="11"/>
    <rect class="glow" x="12" y="-23" width="9" height="11"/>
    <circle class="ink" cx="11" cy="-14" r="5.2"/>
    <path class="ink" d="M5 -14h12M11 -20v12M6.8 -18.2l8.4 8.4M15.2 -18.2l-8.4 8.4"/>
    <path class="ink" d="M36 2V-18"/>
    <path class="mark ink" d="M36 -18l10 3-10 3z"/>`,

  // A false-fronted office on the main street, with its scales out front.
  assay: () => `
    <path class="ground" d="M-44 18h88"/>
    <path class="wall ink" d="M-28 18V-4h42v22z"/>
    <path class="wall ink" d="M-32 -4V-25h50v21z"/>
    <path class="roof ink" d="M-34 -25h54v-3h-54z"/>
    <rect class="mark ink" x="-24" y="-21" width="34" height="9"/>
    <path class="ink" d="M-19 -16.5h24"/>
    <path class="roof ink" d="M-33 -4h52l4 5h-60z"/>
    <path class="ink" d="M-30 1v17M16 1v17"/>
    <rect class="glow" x="-24" y="4" width="8" height="9"/>
    <rect class="glow" x="4" y="4" width="7" height="9"/>
    <path class="ink" d="M-24 8.5h8M4 8.5h7"/>
    <path class="roof ink" d="M-11 18V5h8v13z"/>
    <path class="ink" d="M32 18V-10M26 18h12"/>
    <path class="ink" d="M22 -9h20"/>
    <circle class="glow ink" cx="32" cy="-11" r="1.6"/>
    <path class="ink" d="M22 -9l-3 6M22 -9l3 6M42 -9l-3 6M42 -9l3 6"/>
    <path class="glow ink" d="M17.5 -3h9a4.5 3 0 0 1-9 0zM37.5 -3h9a4.5 3 0 0 1-9 0z"/>`,

  // The start of a race: a pole with the chequered flag, and the Belle
  // alongside with her boilers already roaring.
  race: () => `
    <path class="shallows" d="M-44 16h88v8h-88z"/>
    <path class="ink" d="M-40 20V-30"/>
    <path class="mark ink" d="M-40 -30h16v10h-16z"/>
    <path class="glow" d="M-40 -30h4v5h-4zM-32 -30h4v5h-4zM-36 -25h4v5h-4zM-28 -25h4v5h-4z"/>
    <g transform="translate(10 0)">
      <path class="roof ink" d="M-34 10h68l-7 10h-54z"/>
      <path class="wall ink" d="M-27 10V0h48v10z"/>
      ${windowsRow(-23, 3, 6, 7.5)}
      <path class="wall ink" d="M-21 0V-8h34V0z"/>
      ${windowsRow(-17, -6, 3, 9, 4, 3)}
      <path class="roof ink" d="M-16 -8v-24h5v24zM-8 -8v-24h5v24z"/>
      <path class="ink" d="M-18 -32h9M-10 -32h9"/>
      <path class="smoke" d="M-13.5 -35c-5-4 5-7 0-11s5-6 0-9M-5.5 -35c-5-4 5-7 0-11s5-6 0-9"/>
      <circle class="wall ink" cx="28" cy="5" r="8"/>
      <path class="ink" d="M20 5h16M28 -3v16M22.3 -.7l11.4 11.4M33.7 -.7l-11.4 11.4"/>
    </g>`,

  // The saloon by the landing: a false front, a balcony rail, swinging
  // doors, and a hitching post outside.
  saloon: () => `
    <path class="ground" d="M-42 18h84"/>
    ${footShadow(-2, 36)}
    <path class="wall ink" d="M-30 18V-6h56v24z"/>
    ${siding(-30, 26, -3, 18, 3.5)}
    <path class="wall ink" d="M-34 -6V-27h64v21z"/>
    ${siding(-34, 30, -14, -6, 2.7)}
    <path class="roof ink" d="M-36 -27h68v-3h-68z"/>
    <rect class="mark ink" x="-25" y="-23" width="46" height="9"/>
    <path class="ink" d="M-19 -18.5h34"/>
    <path class="roof ink" d="M-35 -6h66v3h-66z"/>${eaves(-30, 26, -3, 3)}
    <path class="ink" d="M-33 -3v-7M-21 -3v-7M-9 -3v-7M3 -3v-7M15 -3v-7M27 -3v-7M-33 -10h60"/>
    <rect class="glow" x="-26" y="3" width="8" height="8"/>
    <rect class="glow" x="14" y="3" width="8" height="8"/>
    <path class="roof ink" d="M-8 17v-10h7v10zM1 17v-10h7v10z"/>
    <path class="ink" d="M32 18v-11M42 18v-11M30 9h14"/>`,

  // The boatyard: the shed, a boat half planked on her
  // trestles at the head of the slipway (the ribs still bare along her
  // sheer), and a derrick with its hook out over her to lift the boilers in.
  boatyard: () => `
    <path class="shallows" d="M-46 16h92v8h-92z"/>
    <path class="ground" d="M-44 16h30"/>
    ${footShadow(-25, 17, 16)}
    <path class="wall ink" d="M-40 16V-6h30v22z"/>
    ${siding(-40, -10, -6, 16, 3.6)}${eaves(-40, -10, -6)}
    <path class="roof ink" d="M-43 -6L-25 -20L-7 -6z"/>
    ${shingles(-43, -7, -6, -25, -20)}${gableShade(-7, -6, -25, -20)}
    <rect class="glow" x="-35" y="0" width="6" height="6"/>
    <path class="roof ink" d="M-24 16v-12h9v12z"/>
    <path class="ink" d="M-1 13V-34"/>
    <path class="ink" d="M-1 -32L30 -20"/>
    <path class="fine" d="M-1 -24L30 -20M-1 -34l-14 13"/>
    <path class="roof ink" d="M-9 13.5L46 19.5v3.4L-9 16.9z"/>
    <path class="fine" d="M-2 14.3v3.4M6 15.2v3.4M14 16.1v3.4M22 17v3.4M30 17.8v3.4M38 18.7v3.4"/>
    <path class="ink" d="M2 15.4l3 -6.4l3 7.1M23 17.7l3 -8.7l3 9.4"/>
    <path class="ink" d="M1 9h9M22 9h9"/>
    <path class="wall ink" d="M-6 -1q21 2.6 44 -4l-7 14q-15 2.4 -31 0z"/>
    <path class="roof ink" d="M-4.3 3.3q19.8 2.2 40.6 -3.2l-5.3 8.9q-15 2.4 -31 0z"/>
    ${shingles(-4.3, 31.3, 9, 13, 3.6, 1)}
    <path class="shade" d="M-2 6.6q17 2 32.6 -1l-1.6 3.4q-15 2.4 -31 0z"/>
    <path class="ink" d="M6 .3v3.5M12 .7v3.5M18 .8v3.4M24 .4v3.3M30 -.6v3"/>
    <path class="ink" d="M30 -20v12"/>
    <path class="ink" d="M30 -8a2 2 0 1 0 2 2"/>
    <path class="mark ink" d="M-1 -34l9 2.6-9 2.6z"/>`,

  // The bait and tackle shop: a shack at the end of a pier, a carved fish
  // hung out for a sign, and a rod leaning on the rail with its line in.
  tackle: () => `
    <path class="shallows" d="M-46 16h92v8h-92z"/>
    <path class="ink" d="M-30 24V12M-14 24V12M2 24V12M18 24V12M34 24V12"/>
    <path class="roof ink" d="M-36 12h74v-3h-74z"/>
    <path class="wall ink" d="M-28 9V-12h32V9z"/>
    <path class="roof ink" d="M-32 -12L-12 -27L8 -12z"/>
    <rect class="glow" x="-23" y="-6" width="7" height="7"/>
    <path class="roof ink" d="M-8 9v-12h8v12z"/>
    <path class="ink" d="M4 -9h12M12 -9v3"/>
    <path class="mark ink" d="M5 -2q7 -5 13 0q-6 5 -13 0zM18 -2l5 -4v8z"/>
    <path class="ink" d="M26 9L44 -30"/>
    <path class="ink" d="M44 -30q5 22 -1 46"/>`,

  // A general store on stilts where two rivers meet: a porch, barrels, a
  // board over the door and a flag to find it by.
  tradingpost: () => `
    <path class="shallows" d="M-46 16h92v8h-92z"/>
    <path class="ink" d="M-32 24V11M-16 24V11M0 24V11M16 24V11M32 24V11"/>
    <path class="roof ink" d="M-38 11h76v-3h-76z"/>
    <path class="wall ink" d="M-31 8V-15h50V8z"/>
    ${siding(-31, 19, -15, 8, 3.6)}${eaves(-31, 19, -15)}
    <path class="roof ink" d="M-35 -15L-6 -32L23 -15z"/>
    ${shingles(-35, 23, -15, -6, -32, 3)}${gableShade(23, -15, -6, -32)}
    <rect class="mark ink" x="-24" y="-11" width="36" height="7"/>
    <path class="ink" d="M-19 -7.5h26"/>
    <rect class="glow" x="-26" y="-1" width="7" height="7"/>
    <path class="ink" d="M-26 2.5h7"/>
    <path class="roof ink" d="M-9 8v-11h8v11z"/>
    <rect class="glow" x="6" y="-1" width="7" height="7"/>
    <path class="ink" d="M6 2.5h7"/>
    <ellipse class="wall ink" cx="27" cy="3" rx="4.2" ry="5"/>
    <ellipse class="wall ink" cx="35" cy="3" rx="4.2" ry="5"/>
    <path class="ink" d="M23 1h8M31 1h8"/>
    <path class="ink" d="M-40 8V-24"/>
    <path class="mark ink" d="M-40 -24l12 3.5-12 3.5z"/>`,

  /* ---- the Gulf ---- */
  // Salt Harbour: the customs house on the quay, its seal in the gable, its
  // flag, and the duty waiting outside: a crate and a cask.
  customs: () => `
    ${footShadow(0, 40)}
    <path class="ground" d="M-46 18h92"/>
    <path class="wall ink" d="M-30 16V-6h60v22z"/>
    ${courses(-30, 30, -6, 16, 4.4, 9)}${eaves(-30, 30, -6, 3)}
    <path class="roof ink" d="M-34 -6L0 -22L34 -6z"/>
    ${gableShade(34, -6, 0, -22)}
    <path class="fine" d="M-23 -8.6L0 -19.2L23 -8.6z"/>
    <circle class="glow ink" cx="0" cy="-12.6" r="2.6"/>
    <path class="ink" d="M-24 16V-3M-15 16V-3M15 16V-3M24 16V-3"/>
    <path class="shade" d="M-22.4 16V-3h-1.6v19zM-13.4 16V-3h-1.6v19zM16.6 16V-3h-1.6v19zM25.6 16V-3h-1.6v19z"/>
    <path class="ink" d="M-26 -3h13M13 -3h13"/>
    <rect class="glow" x="-11.5" y="1" width="5" height="8"/>${panes(-11.5, 1, 5, 8)}
    <rect class="glow" x="6.5" y="1" width="5" height="8"/>${panes(6.5, 1, 5, 8)}
    <path class="glow ink" d="M-4 16V4a4 4 0 0 1 8 0v12z"/>
    <path class="fine" d="M0 0v16M-4 4h8"/>
    <path class="roof ink" d="M-33 16h66v2h-66z"/>
    <path class="ink" d="M0 -22v-15"/>
    <path class="mark ink" d="M0 -37l12 3-12 3z"/>
    <rect class="wall ink" x="35" y="9" width="9" height="9"/>
    <path class="fine" d="M35 9l9 9M44 9l-9 9"/>
    <ellipse class="wall ink" cx="-39" cy="12.5" rx="3.6" ry="5.5"/>
    <path class="fine" d="M-42.3 10.4h6.6M-42.3 14.6h6.6"/>`,

  // Placer Gulch: a canvas tent with a lamp inside, the headframe over the
  // shaft with its wheel and rope, and a sluice on its trestle.
  diggings: () => `
    ${footShadow(-24, 17)}
    <path class="ground" d="M-46 18h92"/>
    <path class="fine" d="M-31 4.5L-43 18M-17 4.5L-5 18"/>
    <path class="wall ink" d="M-38 18L-24 -6L-10 18z"/>
    <path class="shade" d="M-24 -6L-10 18h-9z"/>
    <path class="glow ink" d="M-24 3l-5 15h10z"/>
    <path class="ink" d="M-24 -6v-3.5"/>
    <path class="mark ink" d="M-7 18c.4-4.6 6.6-4.6 7 0z"/>
    <path class="roof ink" d="M2.5 18v-3.5h11V18z"/>
    <path class="fine" d="M8 -26.5V14.5M1.6 8L12.6 -2M14.4 8L3.4 -2M3.4 -2L11 -12M12.6 -2L5 -12"/>
    <path class="ink" d="M0 18L6.5 -24M16 18L9.5 -24M1.6 8h12.8M3.4 -2h9.2M5 -12h6"/>
    <path class="roof ink" d="M3 -24h10v-2.6h-10z"/>
    <circle class="wall ink" cx="8" cy="-30.4" r="3.8"/>
    <path class="fine" d="M8 -34.2v7.6M4.2 -30.4h7.6"/>
    <path class="ink" d="M22 4.6v13.4M32 8v10M41 11v7"/>
    <path class="fine" d="M22 17L32 9.5M32 17L41 12"/>
    <path class="wall ink" d="M18 0L45 9v3.6L18 3.6z"/>
    <path class="fine" d="M24 2.3v3.2M30 4.3v3.2M36 6.3v3.2M42 8.3v3.2"/>
    <path class="shade" d="M18 2.4L45 11.4v1.2L18 3.6z"/>`,

  // Cypress Bayou: a house on stilts over the water, a lantern on its porch,
  // a ladder up from the pirogue tied below.
  stilts: () => `
    <path class="ground" d="M-46 18h92" opacity=".5"/>
    <path class="fine" d="M-24 4L-10 14M-10 4L-24 14M8 4L22 14M22 4L8 14"/>
    <path class="ink" d="M-24 18V1M-10 18V1M8 18V1M22 18V1"/>
    <path class="roof ink" d="M-31 -1h64v2.4h-64z"/>
    <path class="wall ink" d="M-27 -1V-18h50v17z"/>
    ${siding(-27, 23, -18, -1, 3.4)}${eaves(-27, 23, -18)}
    <path class="roof ink" d="M-32 -17L-2 -33L28 -17z"/>
    ${shingles(-32, 28, -17, -2, -33, 3)}${gableShade(28, -17, -2, -33)}
    <rect class="glow" x="-20" y="-13" width="7" height="7"/>${panes(-20, -13, 7, 7)}
    <rect class="glow" x="9" y="-13" width="7" height="7"/>${panes(9, -13, 7, 7)}
    <path class="roof ink" d="M-6 -1v-11h7v11z"/>
    <path class="ink" d="M33 -1v-7M23 -8h10M28 -8v7"/>
    <path class="ink" d="M26 -17h6v2.4"/>
    <circle class="glow ink" cx="32" cy="-12" r="2.5"/>
    <path class="ink" d="M39 18L35 1.4M44 18L40 1.4"/>
    <path class="fine" d="M38.1 14h5M37.1 10h5M36.2 6h5"/>
    <path class="wall ink" d="M-44 13.6q15 3 31 0l-3.4 4q-12 1.8-24.2 0z"/>
    <path class="shade" d="M-42.4 15.6q13.6 2.4 27.7 0l-1.7 2q-12 1.8-24.2 0z"/>`,

  // Bethel: a white chapel with its steeple and bell, and the hall beside it.
  chapel: () => `
    ${footShadow(4, 36)}
    <path class="ground" d="M-46 18h92"/>
    <path class="wall ink" d="M6 18V2h30v16z"/>
    ${siding(6, 36, 2, 18, 3.6)}${eaves(6, 36, 2, 2.2)}
    <path class="roof ink" d="M3 2L21 -8L39 2z"/>
    ${shingles(3, 39, 2, 21, -8)}${gableShade(39, 2, 21, -8)}
    <rect class="glow" x="12" y="6" width="5" height="7"/>${panes(12, 6, 5, 7)}
    <rect class="glow" x="25" y="6" width="5" height="7"/>${panes(25, 6, 5, 7)}
    <path class="wall ink" d="M-22 18V-6h28v24z"/>
    ${siding(-22, 6, -6, 18, 3.6)}${eaves(-22, 6, -6)}
    <path class="roof ink" d="M-25 -5L-8 -19L9 -5z"/>
    ${gableShade(9, -5, -8, -19)}
    <path class="wall ink" d="M-14 -13V-31h12v18z"/>
    <path class="shade" d="M-8 -31h6v18h-6z"/>
    <path class="roof ink" d="M-12 -19v-8a4 4 0 0 1 8 0v8z"/>
    <path class="glow ink" d="M-10 -22.6q0-3 2-3t2 3z"/>
    <path class="ink" d="M-8 -22.6v1.6"/>
    <path class="roof ink" d="M-16.5 -31L-8 -46L.5 -31z"/>
    ${gableShade(0.5, -31, -8, -46)}
    <path class="ink" d="M-8 -46v-7M-11 -50h6"/>
    <path class="glow ink" d="M-12 18V9q0-5 4-6.5q4 1.5 4 6.5v9z"/>
    <path class="fine" d="M-8 2.5v15.5"/>
    <path class="glow" d="M-19 12V5q0-2.5 1.5-3.5q1.5 1 1.5 3.5v7zM0 12V5q0-2.5 1.5-3.5q1.5 1 1.5 3.5v7z"/>
    <path class="ink" d="M-14 18v1.5h12V18"/>
    <path class="ink" d="M-46 12h20M-44 18v-8M-39 18v-8M-34 18v-8M-29 18v-8"/>`,

  // Sweetwater: a false-fronted saloon with its awning, the stockyard fence
  // and its gate, and a windmill turning over the trough.
  corral: () => `
    ${footShadow(-23, 16)}
    <path class="ground" d="M-46 18h92"/>
    <path class="wall ink" d="M-36 18V-4h24v22z"/>
    ${siding(-36, -12, -4, 18, 3.6)}
    <path class="wall ink" d="M-38 -4V-16h28v12z"/>
    <path class="roof ink" d="M-39.5 -16h31v-2.4h-31z"/>
    <rect class="mark ink" x="-33" y="-13" width="18" height="6" rx="1"/>
    <path class="fine" d="M-30 -10h12"/>
    <path class="roof ink" d="M-39 2h30l-2-4h-26z"/>
    <path class="shade" d="M-36 2h24v2.4h-24z"/>
    <path class="ink" d="M-38 18V2M-10 18V2"/>
    <rect class="glow" x="-33" y="6" width="6" height="7"/>${panes(-33, 6, 6, 7)}
    <path class="roof ink" d="M-23 18V7h7v11z"/>
    <path class="fine" d="M-19.5 7v11"/>
    <path class="ink" d="M-6 18V7M4 18V7M14 18V7M24 18V7M-6 9.5h30M-6 14h30"/>
    <path class="fine" d="M4 9.5L14 14M14 9.5L4 14"/>
    <path class="wall ink" d="M27 18v-4h12v4z"/>
    <path class="fine" d="M28.4 18L31.5 -4L37.6 18M35.6 18L32.5 -4L26.4 18"/>
    <path class="ink" d="M26 18L31 -20M38 18L33 -20M27.3 8h9.4M28.7 -3h6.6"/>
    <path class="mark ink" d="M39.5 -22h3.5l2.5-2.6v5.2L43 -22z"/>
    <circle class="wall ink" cx="32" cy="-22" r="7.6"/>
    <path class="ink" d="M32 -29.6v15.2M24.4 -22h15.2M26.6 -27.4l10.8 10.8M37.4 -27.4l-10.8 10.8"/>
    <circle class="glow ink" cx="32" cy="-22" r="1.6"/>`,

  // Timber Falls: the sawmill and its wheel, the flume that feeds it, the
  // logs waiting and the boards stacked to dry.
  sawmill: () => `
    ${footShadow(-12, 24)}
    <path class="ground" d="M-46 18h92"/>
    <path class="ink" d="M-44 -9.5L4 -3M-44 -6.5L4 0"/>
    <path class="ink" d="M-40 -6v24M-33 -5v6"/>
    <path class="fine" d="M-40 6l-6 12M-40 6l6 12"/>
    <path class="wall ink" d="M-30 18V-4h34v22z"/>
    ${boards(-30, 4, -4, 18, 4.25)}${eaves(-30, 4, -4)}
    <path class="roof ink" d="M-34 -3L-13 -18L8 -3z"/>
    ${shingles(-34, 8, -3, -13, -18, 3)}${gableShade(8, -3, -13, -18)}
    <path class="roof ink" d="M-25 18V5h13v13z"/>
    <circle class="glow ink" cx="-18.5" cy="12" r="4.2"/>
    <path class="fine" d="M-18.5 7.8v8.4M-22.7 12h8.4"/>
    <rect class="glow" x="-7" y="3" width="6" height="6"/>${panes(-7, 3, 6, 6)}
    <circle class="wall ink" cx="16" cy="6" r="11.5"/>
    <circle class="ink" cx="16" cy="6" r="8.4"/>
    <path class="ink" d="M16 -5.5v23M4.5 6h23M7.9 -2.1l16.2 16.2M7.9 14.1l16.2 -16.2"/>
    <circle class="roof ink" cx="16" cy="6" r="1.8"/>
    <path class="shade" d="M16 -5.5a11.5 11.5 0 0 1 0 23z"/>
    <circle class="wall ink" cx="33" cy="15" r="3"/><circle class="wall ink" cx="39.5" cy="15" r="3"/>
    <circle class="wall ink" cx="36.2" cy="9.6" r="3"/>
    <path class="fine" d="M33 13.8v2.4M39.5 13.8v2.4M36.2 8.4v2.4"/>
    <path class="mark ink" d="M-46 18h7v-2.5h-7zM-45 15.5h7V13h-7z"/>`,

  // Copperhead: the smelter under its banded brick stack, the furnace mouth
  // lit, an ore cart on the rails, and a row of company houses.
  smelter: () => `
    ${footShadow(-12, 22)}
    <path class="ground" d="M-46 18h92"/>
    <path class="wall ink" d="M-3 18V-36h8v54z"/>
    <path class="shade" d="M1 -36h4v54h-4z"/>
    <path class="roof ink" d="M-4.2 -36h10.4v-2.6h-10.4z"/>
    <path class="fine" d="M-3 -28h8M-3 -19h8M-3 -10h8"/>
    <path class="smoke" d="M1 -41q-6 -5 0 -10q6 -5 0 -10M3.5 -42q5 -3 3 -8"/>
    <path class="wall ink" d="M-30 18V-2h30v20z"/>
    ${courses(-30, 0, -2, 18, 4, 7.5)}${eaves(-30, 0, -2)}
    <path class="roof ink" d="M-32 -2h34l-5 -7h-24z"/>
    <path class="roof ink" d="M-22 -9v-4h14v4z"/>
    <path class="fine" d="M-19 -13v4M-15 -13v4M-11 -13v4"/>
    <path class="glow ink" d="M-23 18V9a5 5 0 0 1 10 0v9z"/>
    <path class="mark" d="M-21 18v-7.5a3 3 0 0 1 6 0V18z" opacity=".7"/>
    <rect class="glow" x="-9" y="4" width="5" height="5"/>${panes(-9, 4, 5, 5)}
    <path class="shade" d="M-46 18q4 -9 10 -7q4 1.5 6 7z"/>
    <path class="ink" d="M-46 18q4 -9 10 -7q4 1.5 6 7"/>
    <path class="mark ink" d="M7 11h9l-1.5 5h-6z"/>
    <circle class="ink" cx="9.5" cy="17" r="1"/><circle class="ink" cx="13.5" cy="17" r="1"/>
    <path class="wall ink" d="M20 18V7h10v11zM32 18V7h10v11z"/>
    <path class="roof ink" d="M18.5 7.5L25 1l6.5 6.5zM30.5 7.5L37 1l6.5 6.5z"/>
    ${gableShade(31.5, 7.5, 25, 1)}${gableShade(43.5, 7.5, 37, 1)}
    <rect class="glow" x="23" y="10" width="4" height="4"/><rect class="glow" x="35" y="10" width="4" height="4"/>
    <path class="fine" d="M20 12.5h3M27 12.5h3M32 12.5h3M39 12.5h3"/>`,

  // Lafitte's Landing: a long warehouse on pilings, its doors barred and its
  // hoist out over the water, with a boat with no name tied up.
  warehouse: () => `
    <path class="ground" d="M-46 18h92" opacity=".5"/>
    <path class="fine" d="M-34 7L-18 16M-18 7L-34 16M-2 7L14 16M14 7L-2 16"/>
    <path class="ink" d="M-34 18V4M-18 18V4M-2 18V4M14 18V4M28 18V4"/>
    <path class="roof ink" d="M-40 3h72v2.4h-72z"/>
    <path class="wall ink" d="M-38 3V-14h68V3z"/>
    ${boards(-38, 30, -14, 3, 4.25)}${eaves(-38, 30, -14, 2.6)}
    <path class="roof ink" d="M-41 -13L-4 -27L33 -13z"/>
    ${shingles(-41, 33, -13, -4, -27, 3)}${gableShade(33, -13, -4, -27)}
    <path class="roof ink" d="M-28 3V-9h11V3zM6 3V-9h11V3z"/>
    <path class="fine" d="M-28 -9L-17 3M-17 -9L-28 3M6 -9L17 3M17 -9L6 3"/>
    <path class="ink" d="M-30 -3h15M4 -3h15"/>
    <rect class="glow" x="-8" y="-9" width="6" height="5"/>${panes(-8, -9, 6, 5)}
    <path class="ink" d="M30 -17h10v8"/>
    <path class="fine" d="M30 -11L38 -17"/>
    <rect class="wall ink" x="37" y="-9" width="6" height="5"/>
    <path class="ink" d="M39 18V-4"/>
    <path class="sail ink" d="M39 -3l5 12h-5z"/>
    <path class="wall ink" d="M24 13.6q11 3 22 0l-2.6 4q-8.4 1.8-16.8 0z"/>
    <path class="shade" d="M25.3 15.6q9.7 2.4 19.4 0l-1.3 2q-8.4 1.8-16.8 0z"/>`,

  // Eagle Rock: the grand lodge on its rock, every window lit, a fire going,
  // pines beside it and a flag on the gable.
  lodge: () => `
    <path class="ground" d="M-46 18h92"/>
    <path class="roof ink" d="M-42 6l5 -15l5 15zM36 6l4.5 -13l4.5 13z"/>
    <path class="roof ink" d="M-40.5 -1l3.5 -11l3.5 11zM37.2 0l3.3 -10l3.3 10z"/>
    <path class="ink" d="M-37 6v3M40.5 6v3"/>
    <path class="wall ink" d="M-46 18L-36 7h72L46 18z"/>
    <path class="fine" d="M-36 7l5 6l-7 5M-12 7l-4 5l6 6M10 7l5 7l-4 4M30 7l-3 5l8 6M-31 13h15M15 14h12"/>
    <path class="shade" d="M10 7h26L46 18H11l4 -4z"/>
    <path class="wall ink" d="M19 -18v-14h7v20z"/>
    <path class="fine" d="M19 -27h7M19 -22h7M22.5 -32v5M22.5 -22v5"/>
    <path class="smoke" d="M22.5 -35c-3-3 3-5 0-8s3-5 0-7"/>
    <path class="wall ink" d="M-32 7V-13h64V7z"/>
    ${siding(-32, 32, -13, 7, 3.3)}${eaves(-32, 32, -13, 3)}
    <path class="roof ink" d="M-36 -12L0 -31L36 -12z"/>
    ${shingles(-36, 36, -12, 0, -31, 4)}${gableShade(36, -12, 0, -31)}
    <path class="glow ink" d="M-4 -17l4 -5l4 5z"/>
    <rect class="glow" x="-27" y="-8" width="6" height="7"/>${panes(-27, -8, 6, 7)}
    <rect class="glow" x="-16" y="-8" width="6" height="7"/>${panes(-16, -8, 6, 7)}
    <rect class="glow" x="10" y="-8" width="6" height="7"/>${panes(10, -8, 6, 7)}
    <rect class="glow" x="21" y="-8" width="6" height="7"/>${panes(21, -8, 6, 7)}
    <path class="glow ink" d="M-4.5 7V-4a4.5 4.5 0 0 1 9 0V7z"/>
    <path class="fine" d="M0 -8.5V7"/>
    <path class="roof ink" d="M-35 1.5h70v2h-70z"/>
    <path class="ink" d="M-33 7V3.5M-8 7V3.5M8 7V3.5M33 7V3.5"/>
    <path class="ink" d="M0 -31v-11"/><path class="mark ink" d="M0 -42l9 3 -9 3z"/>`,

  // Pelican Point: the wharf on its piles, the net loft over it, nets drying
  // on the rack, and a pelican on the post.
  wharf: () => `
    <path class="ground" d="M-46 18h92" opacity=".5"/>
    <path class="fine" d="M-34 10L-18 17M-18 10L-34 17M-2 10L14 17M14 10L-2 17"/>
    <path class="ink" d="M-34 9v9M-18 9v9M-2 9v9M14 9v9M30 9v9"/>
    <path class="roof ink" d="M-42 7h84v2.4h-84z"/>
    <path class="wall ink" d="M-28 7V-12h30V7z"/>
    ${siding(-28, 2, -12, 7, 3.6)}${eaves(-28, 2, -12)}
    <path class="roof ink" d="M-32 -11L-13 -25L6 -11z"/>
    ${shingles(-32, 6, -11, -13, -25, 3)}${gableShade(6, -11, -13, -25)}
    <rect class="glow" x="-22" y="-7" width="7" height="7"/>${panes(-22, -7, 7, 7)}
    <path class="roof ink" d="M-9 7V-4h7V7z"/>
    <path class="ink" d="M8 7V-6M22 7V-6M7 -6h16"/>
    <path class="fine" d="M9 -6q3 9 6 0q3 9 6 0M10.5 -2.5h3M16.5 -2.5h3M9.6 -4.4h4.8M15.6 -4.4h4.8"/>
    <ellipse class="wall ink" cx="-37" cy="3" rx="3" ry="4"/>
    <path class="fine" d="M-39.7 1.4h5.4M-39.7 4.6h5.4"/>
    <path class="ink" d="M34 18V-3"/>
    <path class="wall ink" d="M28 -6.5q-1 -5 5 -5.5q5.5 -.4 6.5 4q-1.5 4.5 -6.5 4.5q-3.5 0 -5 -3z"/>
    <path class="fine" d="M30.5 -7.5q3 2.5 6.5 .5"/>
    <path class="wall ink" d="M37 -10.5q-1.5 -3 .2 -5.2a2.5 2.5 0 1 1 3.3 2.2q-.6 1.6 -1 4.5z"/>
    <path class="mark ink" d="M40.6 -16.2L47 -7.5q-4.5 1 -6.7 -6z"/>
    <circle class="ink" cx="39.2" cy="-16.6" r=".4"/>`,

  // Smugglers' Cove: a cave mouth in the cliff, lanterns hung over the table
  // inside, a fire on the beach and a boat pulled up beside it.
  cove: () => `
    <path class="ground" d="M-46 18h92"/>
    <path class="wall ink" d="M-44 18L-38 -12L-27 -17L-16 -30L10 -32L21 -22L35 -17L44 18z"/>
    <path class="shade" d="M10 -32L21 -22L35 -17L44 18H19V0q0 -15 -9 -17z"/>
    <path class="fine" d="M-38 -12l10 4l8 -9M-16 -30l6 8l14 -2l6 -8M21 -22l-6 5M35 -17l-9 6l4 12M-41 4l8 -3l4 6M-36 12l7 2M28 8l8 3M-27 -17l2 9"/>
    <path class="roof ink" d="M-18 18V2q0 -17 18 -17q18 0 18 17v16z"/>
    <path class="fine" d="M-9 -12.5l1.5 4l1.5 -5M3 -14.8l1.5 5l1.5 -4.6M10 -12l1 3l1.2 -2"/>
    <path class="ink" d="M-3 -14.6v8"/>
    <path class="glow ink" d="M-5.4 -1.2l.8 -5.4h3.2l.8 5.4z"/>
    <path class="glow" d="M-12 18L-5 1h4L8 18z" opacity=".16"/>
    <path class="wall ink" d="M-11 10h15v2h-15z"/>
    <path class="ink" d="M-8.5 12v6M1.5 12v6"/>
    <path class="mark ink" d="M-1.5 10V6.5h1.6V10z"/>
    <rect class="glow" x="-7.5" y="8.2" width="3.6" height="1.8"/>
    <ellipse class="wall ink" cx="11.5" cy="13.5" rx="3.2" ry="4.5"/>
    <path class="fine" d="M8.6 11.8h5.8M8.6 15.2h5.8"/>
    <path class="smoke" d="M33 6q-4 -5 0 -9q3 -4 0 -7"/>
    <path class="mark ink" d="M29.5 17q-1 -5 3.5 -9q4.5 4 3.5 9z"/>
    <path class="glow" d="M31.5 17q0 -3 1.5 -4.6q1.5 1.6 1.5 4.6z"/>
    <path class="ink" d="M27.5 18l11 -2M38.5 18l-11 -2"/>
    <path class="wall ink" d="M-45 13q8 2.4 17 -.6l-2.5 5.6h-12z"/>
    <path class="fine" d="M-43.6 15.3q7 1.6 14.2 -.6"/>`,

  // Lighthouse Point: the tower on its rock and its beam, the gallery round
  // the lamp, and the keeper's cottage with a fire in.
  lighthouse: () => `
    <path class="ground" d="M-42 18h84"/>
    <path class="glow" d="M6 -32L42 -44V-18z" opacity=".55"/>
    <path class="glow" d="M-6 -32L-26 -37V-25z" opacity=".25"/>
    <path class="wall ink" d="M-9.5 16l3.5-38h12l3.5 38z"/>
    <path class="mark ink" d="M-8.3 2h16.6l-.7-8H-7.6zM-6.7 -14h13.4l-.6-6.5h-12.2z"/>
    <path class="shade" d="M2 -22h4l3.5 38H2z"/>
    <path class="roof ink" d="M-3 16V9a3 3 0 0 1 6 0v7z"/>
    <rect class="glow" x="-1.5" y="-11" width="3" height="4"/>
    <path class="roof ink" d="M-10 -22h20v-2.6h-20z"/>
    <path class="ink" d="M-10 -24.6v-4M10 -24.6v-4M-10 -28.6h20M-5 -28.6v4M5 -28.6v4"/>
    <rect class="glow ink" x="-5" y="-33.5" width="10" height="9"/>
    <path class="fine" d="M-1.7 -33.5v9M1.7 -33.5v9"/>
    <path class="roof ink" d="M-7 -33.5q7 -9 14 0z"/>
    <path class="ink" d="M0 -38v-3.5"/><circle class="ink" cx="0" cy="-42.3" r=".8"/>
    <path class="wall ink" d="M-24 18l4 -4l5 1.5l4 -3.5h23l5 2.5l4 3.5z"/>
    <path class="fine" d="M-20 14l3 4M-11 12l-2 6M12 12l3 6"/>
    <path class="wall ink" d="M17 18V6h20v12z"/>
    ${siding(17, 37, 6, 18, 3.4)}${eaves(17, 37, 6, 2)}
    <path class="roof ink" d="M31 0v-7h4v10z"/>
    <path class="smoke" d="M33 -9c-2.5-2.5 2.5-4 0-6.5"/>
    <path class="roof ink" d="M15 6.5L27 -3L39 6.5z"/>
    ${shingles(15, 39, 6.5, 27, -3)}${gableShade(39, 6.5, 27, -3)}
    <rect class="glow" x="20" y="9.5" width="5" height="5"/>${panes(20, 9.5, 5, 5)}
    <path class="roof ink" d="M29 18V10h5v8z"/>`,

  // The Pearl Banks: a buying schooner at anchor over the beds, her sails
  // loosed to dry and the divers' boat alongside.
  pearler: () => `
    <path class="ink" d="M36 9L46 -1M-10 9v-48M14 9v-41"/>
    <path class="fine" d="M-10 -38L44 0.5M14 -31L36 9"/>
    <path class="wall ink" d="M-9 -35l21 31h-21z"/>
    <path class="fine" d="M-9 -24h7.5M-9 -14h14.2M-3 -4V-26"/>
    <path class="shade" d="M2 -18.8L12 -4H2z"/>
    <path class="wall ink" d="M15 -29l17 25h-17z"/>
    <path class="fine" d="M15 -19h6.8M15 -10h13"/>
    <path class="shade" d="M24 -15.8L32 -4h-8z"/>
    <path class="wall ink" d="M-12 -34l-24 30h24z"/>
    <path class="fine" d="M-12 -22h-9.6M-12 -12h-17.6M-18 -4v-22.5"/>
    <path class="ink" d="M-10 -4h23M14 -4h19"/>
    <path class="mark ink" d="M-10 -39l9 2-9 2z"/>
    <path class="hull ink" d="M-42 7q40 3.5 82 0l-9 13h-62z"/>
    <path class="fine" d="M-39.5 10.8q38 3 76.5 0M-36.5 14.6q35 2.4 70.5 0"/>
    <path class="shade" d="M-36.5 14.6q35 2.4 70.5 0l-3 5.4h-62z"/>
    ${windowsRow(-24, 10.5, 6, 8.5, 2.6, 2.4)}
    <path class="ink" d="M-42 7l-5 -5"/>
    <path class="fine" d="M-38 9v12"/>
    <path class="wall ink" d="M35 17.6q5 1.4 10.5 -.6l-1.4 3.4h-7.7z"/>`,

  // Hurricane Key: a stone fort behind the reef, a gun at the wall, a black
  // flag over the tower, and a palm.
  fort: () => `
    ${footShadow(-12, 28)}
    <path class="ground" d="M-46 18h92"/>
    <path class="wall ink" d="M-26 18V-3h36v21z"/>
    ${courses(-26, 10, -3, 18, 4.2, 8)}
    <path class="wall ink" d="M-26 -3v-5h6v5M-15 -3v-5h6v5M-4 -3v-5h6v5M7 -3v-5h3v5"/>
    <path class="shade" d="M3 -3h7v21H3z"/>
    <path class="wall ink" d="M-40 18V-12h14v30z"/>
    ${courses(-40, -26, -12, 18, 4.2, 7)}
    <path class="wall ink" d="M-41.5 -12v-5.5h4.5v3h3.5v-3h4.5v3h3.5v-3h1v5.5z"/>
    <path class="shade" d="M-31 -12h5v30h-5z"/>
    <rect class="glow" x="-34.5" y="-5" width="3" height="6"/>
    <path class="roof ink" d="M-13 18V9a5 5 0 0 1 10 0v9z"/>
    <path class="glow" d="M-11 18V9.5a3 3 0 0 1 6 0V18z" opacity=".8"/>
    <path class="fine" d="M-8 6.5V18M-11 12h6"/>
    <rect class="glow" x="-21.5" y="3" width="3" height="5"/><rect class="glow" x="3" y="3" width="3" height="5"/>
    <path class="roof ink" d="M10 -5.5h9v2.6h-9z"/>
    <path class="ink" d="M-33 -17.5v-18"/>
    <path class="roof ink" d="M-33 -35.5l12 3-12 3z"/>
    <path class="ink" d="M26 18q.5-15 5 -29"/>
    <path class="fine" d="M24.8 12h3M25.3 6h3M26.3 0h3M27.8 -6h3"/>
    <path class="roof ink" d="M31 -11q-12-3-17 6q8-6 17-6zM31 -11q12-3 15 7q-7-7-15-7zM31 -11q-6-10-15-10q9 2 15 10zM31 -11q6-10 14-9q-9 1-14 9zM31 -11q-1 -9 -6 -13q3 5 6 13z"/>
    <circle class="mark ink" cx="30" cy="-9.5" r="1.3"/><circle class="mark ink" cx="32.5" cy="-9" r="1.3"/>
    <path class="wall ink" d="M36 18q1 -4 4 -4t4 4zM14 18q.5 -2.5 3 -2.5t3 2.5z"/>`,

  // The Admiralty: the great house at the end of the sea lanes: a colonnade
  // up its steps, two wings, the dome and the ensign over it.
  admiralty: () => `
    ${footShadow(0, 44)}
    <path class="ground" d="M-46 18h92"/>
    <path class="wall ink" d="M-42 16V0h84v16z"/>
    ${courses(-42, 42, 0, 16, 4, 10)}${eaves(-42, 42, 0, 2.4)}
    <rect class="glow" x="-38" y="5" width="4" height="7"/>${panes(-38, 5, 4, 7)}
    <rect class="glow" x="-30" y="5" width="4" height="7"/>${panes(-30, 5, 4, 7)}
    <rect class="glow" x="-22" y="5" width="4" height="7"/>${panes(-22, 5, 4, 7)}
    <rect class="glow" x="18" y="5" width="4" height="7"/>${panes(18, 5, 4, 7)}
    <rect class="glow" x="26" y="5" width="4" height="7"/>${panes(26, 5, 4, 7)}
    <rect class="glow" x="34" y="5" width="4" height="7"/>${panes(34, 5, 4, 7)}
    <path class="roof ink" d="M-45 0h90l-3-3.5h-84z"/>
    <path class="fine" d="M-40 -5.5h24M16 -5.5h24M-36 -3.5v-2M-30 -3.5v-2M-24 -3.5v-2M-18 -3.5v-2M18 -3.5v-2M24 -3.5v-2M30 -3.5v-2M36 -3.5v-2"/>
    <path class="wall ink" d="M-15 16V-4h30v20z"/>
    <path class="glow ink" d="M-3.5 16V7a3.5 3.5 0 0 1 7 0v9z"/>
    <path class="fine" d="M0 3.5V16"/>
    <path class="ink" d="M-12 16V-3M-6.5 16V-3M6.5 16V-3M12 16V-3"/>
    <path class="shade" d="M-10.6 16V-3H-12v19zM-5.1 16V-3h-1.4v19zM7.9 16V-3H6.5v19zM13.4 16V-3H12v19z"/>
    <path class="roof ink" d="M-17 -4L0 -12L17 -4z"/>
    ${gableShade(17, -4, 0, -12)}
    <path class="roof ink" d="M-18 16h36v2h-36z"/>
    <path class="fine" d="M-16 17h32"/>
    <path class="wall ink" d="M-11 -9v-6h22v6"/>
    <path class="fine" d="M-7 -15v5M-3 -15v4M3 -15v4M7 -15v5"/>
    <path class="roof ink" d="M-10 -15a10 10 0 0 1 20 0z"/>
    <path class="shade" d="M0 -25a10 10 0 0 1 10 10H3q0 -6 -3 -10z"/>
    <path class="wall ink" d="M-2 -25v-4h4v4"/>
    <path class="ink" d="M0 -29v-14"/>
    <path class="mark ink" d="M0 -43l14 3.5-14 3.5z"/>`,

  flagship: () => `
    <path class="roof ink" d="M-44 8h88l-11 12h-66z"/>
    <path class="fine" d="M-41.2 11h82.4M-38.5 14h77M-35.7 17h71.4"/><path class="shade" d="M-38.5 14h77l-5.5 6h-66z"/>
    <path class="wall ink" d="M-35 8V-2h68v10z"/>${eaves(-35, 33, -2, 2)}
    ${windowsRow(-31, 1, 8, 8)}
    <path class="ink" d="M-38 -2h74"/>
    <path class="wall ink" d="M-28 -2v-8h54v8z"/>${eaves(-28, 26, -10, 1.6)}
    ${windowsRow(-24, -8, 6, 8, 4, 3)}
    <path class="ink" d="M-31 -10h60"/>
    <path class="fine" d="M-31 -10v-3h60v3M-25 -13v3M-19 -13v3M-1 -13v3M11 -13v3M17 -13v3M23 -13v3"/>
    <path class="wall ink" d="M-7 -10v-8h14v8z"/>
    <path class="roof ink" d="M-9 -18h18l-2 -2.6h-14z"/>
    <rect class="glow" x="-4" y="-16" width="8" height="3.5"/>
    <path class="fine" d="M-1.3 -16v3.5M1.3 -16v3.5"/>
    <path class="roof ink" d="M-23 -10v-28h6v28zM-13 -10v-28h6v28z"/>
    <path class="shade" d="M-20 -38h3v28h-3zM-10 -38h3v28h-3z"/>
    <path class="mark" d="M-23 -34h6v3h-6zM-13 -34h6v3h-6z"/>
    <path class="ink" d="M-24 -38l2-3 2 3 2-3 2 3M-14 -38l2-3 2 3 2-3 2 3"/>
    <path class="smoke" d="M-20 -44c-4-4 4-6 0-10M-10 -44c-4-4 4-6 0-10"/>
    <path class="fine" d="M-17 -30L21 -38M-7 -30L21 -34"/>
    <path class="ink" d="M21 -10v-32"/>
    <path class="mark ink" d="M21 -42l15 3.5-15 3.5z"/>
    <path class="glow ink" d="M21 -33l10 2.5-10 2.5z"/>
    <path class="roof ink" d="M-3 8a10 10 0 0 1 20 0z"/>
    <path class="fine" d="M7 -2v10M0 1l7 7l7 -7M-1.7 5.5h17.4"/>
    <circle class="glow ink" cx="-40" cy="4" r="1.6"/>`,
};

/* ------------------------------------------------------------------ *
 * The player's boat, which grows as the climb does
 * ------------------------------------------------------------------ */

export const BOAT_ART = {
  // A clinker rowboat: a sheer that rises to the bow, a square stern, and
  // the oars shipped inside her, blades up over the gunwale: nothing of
  // her reaches past her own length, so a scene cropped at her stern does
  // not leave an oar on its own in the water.
  rowboat: () => `
    <path class="ink" d="M-11 -5.6L9 -8.2M-9 -4.2L11 -6.6"/>
    <path class="hull ink" d="M9 -8.2l5 -.8l.2 2.4l-5 .4zM11 -6.6l4.6 -.6l.2 2.2l-4.6 .4z"/>
    <path class="hull ink" d="M-15 -2q15 2 31 -2.5l-4 8.5q-11 2.2-23 0z"/>
    <path class="fine" d="M-13.6 1q13.6 1.8 28.1 -2.1"/>
    <path class="shade" d="M-12 3.2q12 1.8 25 -1.2l-1 2q-11 2.2-23 0z"/>`,
  skiff: () => `
    <path class="hull ink" d="M-17 -1q17 2 35 -3l-5 9.5q-12 2.4-26 0z"/>
    <path class="fine" d="M-15.5 2.2q15.5 1.8 31.4 -2.4"/>
    <path class="shade" d="M-13.6 4.6q13 2 26.4 -.8l-.8 1.7q-12 2.4-26 0z"/>
    <path class="ink" d="M-2 0v-22"/>
    <path class="sail ink" d="M-1 -21l15 20h-15z"/>
    <path class="sail ink" d="M-3 -17l-9 16h9z"/>`,
  launch: () => `
    <path class="hull ink" d="M-19 0q19 2 39 -2.5l-6 9.5q-13 2.4-28 0z"/>
    <path class="fine" d="M-17.5 3.4q17.5 1.8 35.6 -2.4"/>
    <path class="shade" d="M-15.5 5.6q14 2 28.5 -.6l-.9 1.5q-13 2.4-28 0z"/>
    <path class="deck ink" d="M-9 1v-8h15v8z"/>
    <rect class="glow" x="-6" y="-5" width="4" height="3"/>
    <path class="deck ink" d="M9 1v-12h4v12z"/>
    <path class="smoke" d="M11 -14c-3-3 3-5 0-8"/>`,
  sternwheeler: () => `
    <path class="hull ink" d="M-22 1h40l-6 8h-30z"/>
    <path class="fine" d="M-19.7 4h35.4"/><path class="shade" d="M-17.7 6.6h31.4l-1.7 2.4h-28z"/>
    <path class="deck ink" d="M-17 1v-7h32v7z"/>
    ${windowsRow(-14, -4, 4, 7, 3, 3)}
    <path class="deck ink" d="M-10 -6v-5h16v5z"/>
    <path class="deck ink" d="M-12 -11v-12h4v12zM-5 -11v-12h4v12z"/>
    <circle class="deck ink" cx="21" cy="1" r="6"/>
    <path class="ink" d="M15 1h12M21 -5v12"/>`,
  flagship: () => `
    <path class="hull ink" d="M-26 1h52l-7 9h-38z"/>
    <path class="fine" d="M-23.7 4h47.4"/><path class="shade" d="M-21.4 7h42.8l-2.3 3h-38z"/>
    <path class="deck ink" d="M-20 1v-7h40v7z"/>
    ${windowsRow(-17, -4, 5, 7.5, 3, 3)}
    <path class="deck ink" d="M-14 -6v-6h28v6z"/>
    <path class="deck ink" d="M-12 -12v-14h4v14zM-5 -12v-14h4v14z"/>
    <path class="ink" d="M14 -12v-18"/>
    <path class="mark ink" d="M14 -30l10 2.5-10 2.5z"/>`,
};

/** Your boat: the drawing for its kind, in the brass the yard sends it out in. */
export function yourBoat(key = 'rowboat') {
  return `<g class="you">${(BOAT_ART[key] || BOAT_ART.rowboat)()}</g>`;
}

/** A boat drawn on its own, for the side panel and the boatyard. */
export function boatSvg(key, { width = 120 } = {}) {
  return `<svg class="boat-art" viewBox="-34 -36 68 50" width="${width}" aria-hidden="true">`
    + `<path class="water" d="M-34 6h68v8h-68z"/><path class="ripple" d="M-28 9q3 -2.5 6 0t6 0M12 11q3 -2.5 6 0t6 0"/>`
    + `${yourBoat(key)}</svg>`;
}

/**
 * A gradient stop's colour, read off the room and written on the stop as
 * well as left to the stylesheet. Some browsers paint a stop whose colour
 * only comes from a stylesheet rule as solid black; the attribute is what
 * they fall back to. Outside a browser there is no room to read, and the
 * stylesheet alone decides.
 */
function skyStop(token) {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return '';
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return /^[#a-z0-9(),.\s%-]+$/i.test(value) ? ` stop-color="${value}"` : '';
}

/**
 * A place, drawn as a scene: sky in the room's hour, the far bank, the water,
 * and the landmark standing on it, with your boat tied up if you are there.
 * Drawn 600 wide and cropped to the screen, so a phone sees the middle and a
 * wide screen the whole reach.
 */
export function sceneSvg({ id, landmark, orbLeft = false, boat = null, arriving = false, scale = 1.7, sea = false }) {
  const stars = Array.from({ length: 40 }, (_, i) => {
    const x = (i * 149 + 37) % 600;
    const y = (i * 53 + 11) % 74 + 4;
    return `<circle class="star" cx="${x}" cy="${y}" r="${i % 5 === 0 ? 1.3 : 0.8}"/>`;
  }).join('');
  const trees = Array.from({ length: 16 }, (_, i) => {
    const x = (i * 83 + 12) % 600;
    const y = 104 + ((i * 7) % 6) + (x > 250 && x < 350 ? 40 : 0);
    return y > 120 ? '' : `<circle class="far-tree" cx="${x}" cy="${y}" r="${4 + (i % 3)}"/>`;
  }).join('');
  const boatArt = boat
    ? `<g class="scene-boat${arriving ? ' arriving' : ''}"><g transform="translate(400 146) scale(1.6)"><g class="bob">${yourBoat(boat)}</g></g></g>`
    : '';
  return `<svg class="scene-art" viewBox="0 0 600 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sky-top"${skyStop('--sky-1')}/><stop offset="1" class="sky-low"${skyStop('--sky-2')}/></linearGradient></defs>
    <rect width="600" height="132" fill="url(#sky-${id})"/>
    <g class="stars">${stars}</g>
    <circle class="orb" cx="${orbLeft ? 190 : 430}" cy="42" r="14"/>
    ${sea
    // At sea: no far bank, only the horizon and a few islands on it.
    ? '<path class="far-bank" d="M0 124H600V134H0Z"/><path class="far-bank" d="M40 124q22-14 48 0zM470 124q30-18 64 0zM520 124q10-8 22 0z"/>'
    : `<path class="far-bank" d="M0 116C50 104 90 112 140 106S230 96 280 104S380 112 430 102S530 108 600 104V134H0Z"/>${trees}`}
    <rect class="scene-water" x="0" y="128" width="600" height="42"/>
    <path class="scene-ripple" d="M40 146q6-4 12 0t12 0M150 158q6-4 12 0t12 0M250 150q6-4 12 0t12 0M470 162q6-4 12 0t12 0M90 164q6-4 12 0t12 0M530 148q6-4 12 0t12 0"/>
    <g class="scene-landmark" transform="translate(292 114) scale(${scale})">${(LANDMARKS[landmark] || LANDMARKS.landing)()}</g>
    ${boatArt}
  </svg>`;
}

/** A landmark drawn on its own, for the scene at a stop. */
export function landmarkSvg(key, { width = 240 } = {}) {
  const art = (LANDMARKS[key] || LANDMARKS.landing)();
  return `<svg class="landmark-art" viewBox="-48 -50 96 78" width="${width}" aria-hidden="true">${art}</svg>`;
}
