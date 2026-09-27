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

  // Not stops: the places you study. Drawn in the same hand so the school
  // and the pilot house sit on the same river as the tables.
  school: () => `
    <path class="ground" d="M-42 18h84"/>
    <path class="wall ink" d="M-30 18V-5h48v23z"/>
    <path class="roof ink" d="M-34 -4L-6 -23L22 -4z"/>
    <path class="wall ink" d="M-11 -18v-12h10v12"/>
    <path class="roof ink" d="M-13.5 -30L-6 -41L1.5 -30z"/>
    <circle class="glow ink" cx="-6" cy="-24" r="2.4"/>
    <rect class="glow" x="-25" y="-1" width="7" height="8"/>
    <rect class="glow" x="6" y="-1" width="7" height="8"/>
    <path class="ink" d="M-25 3h7M6 3h7"/>
    <path class="roof ink" d="M-10 18v-13h8v13z"/>
    <path class="ink" d="M-13 18h14"/>
    <path class="ink" d="M26 18V-22"/>
    <path class="mark ink" d="M26 -22l12 3.5-12 3.5z"/>
    <path class="ink" d="M-42 11h9M-42 15h9M-40 18v-9M-35 18v-9M30 11h12M30 15h12M33 18v-9M39 18v-9"/>`,

  pilothouse: () => `
    <path class="roof ink" d="M-44 12h88l-9 9h-70z"/>
    <path class="wall ink" d="M-36 12V2h72v10z"/>
    ${windowsRow(-32, 5, 9, 7.8)}
    <path class="wall ink" d="M-26 2V-6h52v8z"/>
    <path class="roof ink" d="M-30 -6v-24h5v24zM-21 -6v-24h5v24z"/>
    <path class="ink" d="M-32 -30h9M-23 -30h9"/>
    <path class="smoke" d="M-27.5 -33c-4-4 4-6 0-10M-18.5 -33c-4-4 4-6 0-10"/>
    <path class="wall ink" d="M-2 -6v-20h26v20z"/>
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
    <path class="wall ink" d="M-30 18V-6h56v24z"/>
    <path class="wall ink" d="M-34 -6V-27h64v21z"/>
    <path class="roof ink" d="M-36 -27h68v-3h-68z"/>
    <rect class="mark ink" x="-25" y="-23" width="46" height="9"/>
    <path class="ink" d="M-19 -18.5h34"/>
    <path class="roof ink" d="M-35 -6h66v3h-66z"/>
    <path class="ink" d="M-33 -3v-7M-21 -3v-7M-9 -3v-7M3 -3v-7M15 -3v-7M27 -3v-7M-33 -10h60"/>
    <rect class="glow" x="-26" y="3" width="8" height="8"/>
    <rect class="glow" x="14" y="3" width="8" height="8"/>
    <path class="roof ink" d="M-8 17v-10h7v10zM1 17v-10h7v10z"/>
    <path class="ink" d="M32 18v-11M42 18v-11M30 9h14"/>`,

  // A general store on stilts where two rivers meet: a porch, barrels, a
  // board over the door and a flag to find it by.
  tradingpost: () => `
    <path class="shallows" d="M-46 16h92v8h-92z"/>
    <path class="ink" d="M-32 24V11M-16 24V11M0 24V11M16 24V11M32 24V11"/>
    <path class="roof ink" d="M-38 11h76v-3h-76z"/>
    <path class="wall ink" d="M-31 8V-15h50V8z"/>
    <path class="roof ink" d="M-35 -15L-6 -32L23 -15z"/>
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

/**
 * A place, drawn as a scene: sky in the room's hour, the far bank, the water,
 * and the landmark standing on it, with your boat tied up if you are there.
 * Drawn 600 wide and cropped to the screen, so a phone sees the middle and a
 * wide screen the whole reach.
 */
export function sceneSvg({ id, landmark, orbLeft = false, boat = null, arriving = false, scale = 1.7 }) {
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
    ? `<g class="scene-boat${arriving ? ' arriving' : ''}"><g transform="translate(400 146) scale(1.6)"><g class="bob"><g class="you">${(BOAT_ART[boat] || BOAT_ART.rowboat)()}</g></g></g></g>`
    : '';
  return `<svg class="scene-art" viewBox="0 0 600 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sky-top"/><stop offset="1" class="sky-low"/></linearGradient></defs>
    <rect width="600" height="132" fill="url(#sky-${id})"/>
    <g class="stars">${stars}</g>
    <circle class="orb" cx="${orbLeft ? 190 : 430}" cy="42" r="14"/>
    <path class="far-bank" d="M0 116C50 104 90 112 140 106S230 96 280 104S380 112 430 102S530 108 600 104V134H0Z"/>
    ${trees}
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
