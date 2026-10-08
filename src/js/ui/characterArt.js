/**
 * You, drawn head to toe.
 *
 * The people on the river are busts in a cameo; the reader is the one person
 * drawn whole, because the reader is the one who changes. The figure is built
 * in layers — legs, body, arms, head, hat — and what each layer wears comes
 * from how far you have got:
 *
 *   tier 0  Deckhand              (Fish, Minnow)     a cap, rolled sleeves, braces, patched trousers
 *   tier 1  Card-room grinder     (Nit, Grinder)     a green visor, sleeve garters, a waistcoat
 *   tier 2  Riverboat regular     (Regular, Crusher) a bowler, a tailored jacket, a watch chain
 *   tier 3  Riverboat shark       (Shark, Pro)       a flat-brimmed hat, a long frock coat, rings
 *   tier 4  Legend of the river   (Elite, GTO Master) a top hat, velvet and gold, smoked glasses
 *
 * What is in the hands comes from how you play (a nit nurses a cup of tea; a
 * tight-aggressive player holds the cards close; a maniac flips a chip), the
 * face from how the last sittings went, and the colours, hair and skin are
 * the reader's own choice. Nothing here is bought: the look is earned, the way
 * the keepsakes are.
 *
 * Every shape is drawn here, on one 200 x 360 grid, in fixed colours like the
 * portraits: a picture of somebody is the same picture in every room. The
 * choices themselves, and which rank wears what, are in data/looks.js.
 */

import { SKINS, HAIR_COLOURS, COLOURS, DEFAULT_LOOK, sanitizeLook } from '../data/looks.js';

const INK = '#2a1d16';
let uid = 0;

/* ---- the parts --------------------------------------------------------- */

const line = (d, colour, width) => `<path d="${d}" stroke="${colour}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The arms, as stroked limbs: shoulder, elbow, wrist. */
const POSES = {
  left: { s: [69, 110], e: [60, 154], w: [58, 197] },
  side: { s: [131, 110], e: [140, 154], w: [142, 197] },
  chest: { s: [131, 110], e: [147, 150], w: [125, 156] },
  cup: { s: [131, 110], e: [145, 152], w: [131, 172] },
  flick: { s: [131, 110], e: [143, 148], w: [148, 122] },
};

function arm(pose, { sleeve, skin, rolled = false, cuff = null, garter = null }) {
  const { s, e, w } = pose;
  const upper = `M${s[0]} ${s[1]}L${e[0]} ${e[1]}`;
  const fore = `M${e[0]} ${e[1]}L${w[0]} ${w[1]}`;
  let out = '';
  if (rolled) {
    out += line(fore, skin[1], 13) + line(upper, sleeve, 17);
    // The roll of the sleeve at the elbow.
    out += line(`M${e[0] - 5} ${e[1]}L${e[0] + 5} ${e[1]}`, sleeve, 7);
  } else {
    out += line(upper, sleeve, 17) + line(fore, sleeve, 15);
    if (cuff) {
      const cx = e[0] + (w[0] - e[0]) * 0.86;
      const cy = e[1] + (w[1] - e[1]) * 0.86;
      out += line(`M${cx} ${cy}L${w[0] + (w[0] - e[0]) * 0.02} ${w[1] + (w[1] - e[1]) * 0.02}`, cuff, 13);
    }
  }
  if (garter) {
    // A band round the sleeve, square-ended so it reads as a band.
    const at = (k) => `${s[0] + (e[0] - s[0]) * k} ${s[1] + (e[1] - s[1]) * k}`;
    out += `<path d="M${at(0.58)}L${at(0.67)}" stroke="${garter}" stroke-width="18" stroke-linecap="butt"/>`;
  }
  // The hand, with a thumb.
  out += `<circle cx="${w[0]}" cy="${w[1] + 3}" r="8" fill="${skin[0]}"/>`
    + `<ellipse cx="${w[0] - 4}" cy="${w[1] + 1}" rx="3" ry="4.4" fill="${skin[1]}" opacity=".55"/>`;
  return out;
}

function legs(trousers, { patch = false, stripe = null } = {}) {
  let out = `<path d="M73 184H127L128 214H72Z" fill="${trousers}"/>`
    + `<path d="M73 196C72 240 76 292 79 331H97C97 292 98 246 100 210Z" fill="${trousers}"/>`
    + `<path d="M127 196C128 240 124 292 121 331H103C103 292 102 246 100 210Z" fill="${trousers}"/>`
    // A shade down the inside of each leg, so they read as two.
    + `<path d="M93 214C93 260 94 300 95 331H97C97 292 98 246 100 210Z" fill="#000" opacity=".16"/>`
    + `<path d="M121 220C121 262 119 300 118 331H121C124 292 128 240 127 196Z" fill="#000" opacity=".12"/>`;
  if (patch) {
    out += '<path d="M80 262h12v13H80z" fill="#8a6a44" transform="rotate(-6 86 268)"/>'
      + '<path d="M80 262h12v13H80z" stroke="#e9dcc0" stroke-width=".8" stroke-dasharray="1.6 1.6" fill="none" transform="rotate(-6 86 268)"/>';
  }
  if (stripe) out += `<path d="M86 214V331M114 214V331" stroke="${stripe}" stroke-width="1.2" opacity=".5"/>`;
  return out;
}

function shoes(colour, { shine = false, boots = false } = {}) {
  const top = boots ? 314 : 324;
  let out = `<path d="M79 ${top}H97L98 340Q98 346 91 346H69Q64 346 65 341Q67 333 79 332Z" fill="${colour}"/>`
    + `<path d="M121 ${top}H103L102 340Q102 346 109 346H131Q136 346 135 341Q133 333 121 332Z" fill="${colour}"/>`;
  if (shine) out += '<path d="M71 337q5-3 10-3M129 337q-5-3-10-3" stroke="#fff" stroke-width="1.4" opacity=".55" fill="none" stroke-linecap="round"/>';
  if (boots) out += '<path d="M79 321h18M103 321h18" stroke="#000" stroke-width="1.2" opacity=".35"/>';
  return out;
}

const torso = (fill) => `<path d="M64 104Q100 92 136 104L131 190H69Z" fill="${fill}"/>`;

function waistcoat(fill, { buttons = '#d9b44a', brocade = false } = {}) {
  let out = `<path d="M69 108L85 101L100 134L115 101L131 108L128 190H72Z" fill="${fill}"/>`
    + '<path d="M72 186L100 196L128 186" stroke="#000" stroke-width="1" opacity=".25" fill="none"/>';
  if (brocade) {
    for (let y = 146; y < 186; y += 12) {
      for (const x of [80, 92, 108, 120]) out += `<path d="M${x} ${y - 3}l3 3-3 3-3-3z" fill="#e0b64a" opacity=".55"/>`;
    }
  }
  for (let y = 142; y <= 178; y += 12) out += `<circle cx="100" cy="${y}" r="2" fill="${buttons}"/>`;
  return out;
}

const neckAndCollar = (skin, collar) => `<path d="M93 78V98Q100 104 107 98V78Z" fill="${skin[1]}"/>`
  + (collar ? `<path d="M90 97L100 110L110 97L106 95L100 103L94 95Z" fill="${collar}"/>` : '');

/* ---- the head ---------------------------------------------------------- */

function face(skin, form, { glasses = false } = {}) {
  const brow = '#2a1d16';
  const brows = form === 'cold'
    ? `<path d="M85 53q6 1 12 4M115 53q-6 1-12 4" stroke="${brow}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
    : form === 'hot'
      ? `<path d="M85 52q6-4 12-1M103 51q6-3 12 1" stroke="${brow}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
      : `<path d="M85 54q6-3 12-1M103 53q6-2 12 1" stroke="${brow}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const eyes = glasses
    ? '<circle cx="91.5" cy="61" r="6.2" fill="#1b1d24" stroke="#d9b44a" stroke-width="1.6"/>'
      + '<circle cx="108.5" cy="61" r="6.2" fill="#1b1d24" stroke="#d9b44a" stroke-width="1.6"/>'
      + '<path d="M97.7 60.4q2.3-1.6 4.6 0M85.3 60l-6-2M114.7 60l6-2" stroke="#d9b44a" stroke-width="1.4" fill="none"/>'
      + '<path d="M88 58.5l3-2.5M105 58.5l3-2.5" stroke="#fff" stroke-width="1.2" opacity=".55" stroke-linecap="round"/>'
    : `<ellipse cx="92" cy="61" rx="2.3" ry="2.8" fill="${INK}"/><ellipse cx="108" cy="61" rx="2.3" ry="2.8" fill="${INK}"/>`
      + '<circle cx="92.8" cy="60.1" r=".75" fill="#fff" opacity=".85"/><circle cx="108.8" cy="60.1" r=".75" fill="#fff" opacity=".85"/>';
  const nose = `<path d="M100.5 63q-3.4 6.6.8 7.6" stroke="${skin[1]}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  const mouth = form === 'hot'
    ? '<path d="M90.5 75q9.5 9 19 0z" fill="#6e2a24" stroke="#5a211c" stroke-width="1"/><path d="M92 75.6h16" stroke="#fbf6ee" stroke-width="1.6"/>'
    : form === 'cold'
      ? '<path d="M92.5 79q7.5-3.6 15 0" stroke="#7a3b30" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      : '<path d="M92 76.5q7 4 16-1" stroke="#7a3b30" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
  const cheeks = form === 'hot' ? '<circle cx="85" cy="70" r="3.6" fill="#e07a6a" opacity=".22"/><circle cx="115" cy="70" r="3.6" fill="#e07a6a" opacity=".22"/>' : '';
  return brows + eyes + nose + mouth + cheeks;
}

function beardShape(kind, colour) {
  if (kind === 'stubble') {
    return `<path d="M80 66Q81 92 100 94Q119 92 120 66Q116 84 100 86Q84 84 80 66Z" fill="${colour}" opacity=".28"/>`;
  }
  const tache = `<path d="M89.5 73q5.5-4.5 10.5-.6q5-3.9 10.5.6q-4.5 4.4-10.5 1.6q-6 2.8-10.5-1.6z" fill="${colour}"/>`;
  if (kind === 'moustache') return tache;
  if (kind === 'beard') {
    return `<path d="M79 64Q78 96 100 100Q122 96 121 64Q119 79 112 81Q106 79 100 80Q94 79 88 81Q81 79 79 64Z" fill="${colour}"/>`
      + `<path d="M93 80q7 4 14 0" stroke="#6e2a24" stroke-width="1.6" fill="none" stroke-linecap="round"/>${tache}`;
  }
  return '';
}

function hairBack(kind, colour) {
  if (kind === 'long') return `<path d="M77 56C70 96 74 116 84 122H116C126 116 130 96 123 56Z" fill="${colour}"/>`;
  if (kind === 'bun') return `<circle cx="100" cy="35" r="9.5" fill="${colour}"/>`;
  if (kind === 'curly') {
    return `<path d="M77 66C68 58 72 44 79 41C77 31 90 25 97 29C103 23 116 26 118 34C127 34 132 46 125 54C131 62 126 72 121 70Z" fill="${colour}"/>`;
  }
  return '';
}

function hairFront(kind, colour, hatted) {
  if (kind === 'bald') return '';
  if (kind === 'curly') {
    return `<path d="M79 58C76 44 86 36 96 38C104 33 118 40 121 56C114 48 108 46 100 47C91 46 84 50 79 58Z" fill="${colour}"/>`
      + (hatted ? '' : `<circle cx="84" cy="44" r="5" fill="${colour}"/><circle cx="96" cy="38" r="5.5" fill="${colour}"/><circle cx="109" cy="39" r="5.5" fill="${colour}"/><circle cx="118" cy="47" r="4.5" fill="${colour}"/>`);
  }
  let out = `<path d="M79 58C78 36 122 34 121 58C116 46 108 42 100 42C90 42 83 47 79 58Z" fill="${colour}"/>`;
  if (kind === 'long') {
    out += `<path d="M79 56C77 72 78 86 81 96L85 66Z" fill="${colour}"/><path d="M121 56C123 72 122 86 119 96L115 66Z" fill="${colour}"/>`;
  }
  return out;
}

const HATS = {
  cap: (accent) => '<path d="M77 51C75 30 125 28 124 47C111 42 90 43 77 51Z" fill="#6b5237"/>'
    + '<path d="M84 48C98 43 117 43 131 50C123 55 104 54 84 48Z" fill="#574229"/>'
    + '<path d="M82 40q16-8 36-3" stroke="#806546" stroke-width="1.2" fill="none"/>'
    + `<circle cx="100" cy="31.5" r="2" fill="${accent}"/>`,
  visor: () => '<path d="M78 50Q100 42 122 50V56Q100 48 78 56Z" fill="#1e4a32"/>'
    + '<path d="M80 55Q100 47 120 55L130 64Q100 55 70 64Z" fill="#2f8a5a" opacity=".78"/>'
    + '<path d="M72 63Q100 54 128 63" stroke="#16351f" stroke-width="1.4" fill="none"/>',
  bowler: (accent) => '<path d="M80 47C79 21 121 21 120 47Z" fill="#1d1b1f"/>'
    + `<path d="M80.4 41H119.6V46.5H80.4Z" fill="${accent}"/>`
    + '<ellipse cx="100" cy="47.5" rx="28" ry="4.6" fill="#141217"/>'
    + '<path d="M88 27q8-5 18-2" stroke="#fff" stroke-width="1.4" opacity=".22" fill="none" stroke-linecap="round"/>',
  gambler: (accent) => '<path d="M82 45L84 23Q100 17 116 23L118 45Z" fill="#17161a"/>'
    + '<path d="M92 21q8 5 16 0" stroke="#000" stroke-width="1.4" opacity=".5" fill="none"/>'
    + `<path d="M82.6 38H117.4V44.5H82.6Z" fill="${accent}"/>`
    + '<ellipse cx="100" cy="46" rx="39" ry="5.8" fill="#0f0e12"/>'
    + '<path d="M64 45q36-5 72 0" stroke="#fff" stroke-width=".9" opacity=".18" fill="none"/>',
  tophat: () => '<path d="M84 45V9Q100 4 116 9V45Z" fill="#141317"/>'
    + '<path d="M84 33H116V40H84Z" fill="#c9a24a"/>'
    + '<path d="M88 12V31" stroke="#fff" stroke-width="2.4" opacity=".14" stroke-linecap="round"/>'
    + '<ellipse cx="100" cy="46" rx="30" ry="5.2" fill="#0d0c10"/>'
    + '<path d="M70 45q30 5 60 0" stroke="#c9a24a" stroke-width=".9" opacity=".55" fill="none"/>',
};

/* ---- what is in the hands ---------------------------------------------- */

function card(x, y, rot, label, suit, red) {
  const ink = red ? '#b3262a' : '#1b1a1f';
  return `<g transform="rotate(${rot} ${x} ${y})">`
    + `<rect x="${x - 7}" y="${y - 10}" width="14" height="20" rx="2" fill="#fbf6ee" stroke="#2a1d16" stroke-width=".7"/>`
    + `<text x="${x - 4.6}" y="${y - 2.6}" font-size="6.6" font-family="Georgia, serif" font-weight="700" fill="${ink}">${label}</text>`
    + `<text x="${x - 1}" y="${y + 7.4}" font-size="8" font-family="Georgia, serif" fill="${ink}">${suit}</text>`
    + '</g>';
}

function chips(x, y, n, colours) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const cy = y - i * 3.2;
    const c = colours[i % colours.length];
    out += `<ellipse cx="${x}" cy="${cy + 1.4}" rx="8.6" ry="3.2" fill="#000" opacity=".25"/>`
      + `<ellipse cx="${x}" cy="${cy}" rx="8.6" ry="3.2" fill="${c}"/>`
      + `<path d="M${x - 6} ${cy}h2.4M${x + 3.6} ${cy}h2.4" stroke="#fbf6ee" stroke-width="1.1"/>`;
  }
  return out;
}

const teacup = (x, y) => `<path d="M${x - 10} ${y - 6}h17v4q0 9-8.5 9t-8.5-9z" fill="#f4efe6" stroke="#a8916a" stroke-width=".9"/>`
  + `<path d="M${x + 7} ${y - 3}q6 0 5 5t-6 3" stroke="#a8916a" stroke-width="1.6" fill="none"/>`
  + `<path d="M${x - 9} ${y - 5}h15" stroke="#9c6a3a" stroke-width="2.2"/>`
  + `<path d="M${x - 6} ${y - 11}q-2-3 0-5M${x - 1} ${y - 12}q-2-3 0-5" stroke="#d9d4cc" stroke-width="1" fill="none" opacity=".8"/>`;

/* ---- the whole figure -------------------------------------------------- */

/**
 * @param {object} opts
 * @param {number} opts.tier     0-4 (tierFor(level), data/looks.js)
 * @param {string} [opts.form]   'hot' | 'steady' | 'cold'
 * @param {object} [opts.look]   from sanitizeLook
 * @param {string} [opts.props]  from propsFor(type)
 * @param {boolean} [opts.trophy]  a Regatta won: the cup at your feet
 * @param {number} [opts.width]
 * @param {string} [opts.label]  an accessible description
 * @param {boolean} [opts.stage] the shadow underfoot and, for the last two looks, the glow; off for a silhouette
 * @returns {string} SVG markup
 */
export function characterSvg({ tier = 0, form = 'steady', look = DEFAULT_LOOK, props = 'none', trophy = false, width = 200, label = '', stage = true } = {}) {
  const t = Math.max(0, Math.min(4, Math.floor(tier)));
  const L = sanitizeLook(look);
  const skin = SKINS[L.skin];
  const hairColour = HAIR_COLOURS[L.hairColour];
  const accent = COLOURS[L.colour];
  const id = `ch${++uid}`;
  const height = Math.round((width * 360) / 200);

  // The outfit for the tier.
  const outfit = [
    { trousers: '#6e5236', shoes: '#3b2a1c', shirt: '#e9e2d0', hat: 'cap', boots: true },
    { trousers: '#3d3a36', shoes: '#1b1a1d', shirt: '#d7dfe4', hat: 'visor', vest: '#5a4632' },
    { trousers: '#2b3245', shoes: '#141317', shirt: '#f1ece0', hat: 'bowler', vest: accent, jacket: '#2b3245' },
    { trousers: '#1f1e22', shoes: '#0f0e12', shirt: '#f1ece0', hat: 'gambler', vest: accent, coat: '#232328' },
    { trousers: '#141317', shoes: '#0b0a0d', shirt: '#f6f1e6', hat: 'tophat', vest: accent, coat: '#16151a', trim: '#c9a24a' },
  ][t];

  // Which arm does what.
  const rightPose = props === 'tea' ? POSES.cup
    : props === 'cards' || props === 'showcards' ? POSES.chest
      : props === 'chips' ? POSES.flick : POSES.side;
  const sleeve = outfit.coat || outfit.jacket || outfit.shirt;
  const armStyle = {
    sleeve,
    skin,
    rolled: t === 0,
    cuff: t >= 2 ? outfit.shirt : null,
    garter: t === 1 ? accent : null,
  };

  let back = '';
  // The stage: a shadow underfoot, and from the shark up, a glow.
  if (stage) back += `<ellipse cx="100" cy="344" rx="58" ry="8" fill="#000" opacity=".28"/>`;
  if (stage && t >= 3) {
    back += `<defs><radialGradient id="${id}g" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${t === 4 ? '#f2c14e' : '#fff3c8'}" stop-opacity="${t === 4 ? '.45' : '.18'}"/><stop offset="100%" stop-color="#f2c14e" stop-opacity="0"/></radialGradient></defs>`
      + `<ellipse cx="100" cy="170" rx="98" ry="170" fill="url(#${id}g)"/>`;
  }
  if (stage && t === 4) {
    const spark = (x, y, s) => `<path d="M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z" fill="#f2d27a"/>`;
    back += spark(28, 90, 7) + spark(172, 70, 5) + spark(166, 214, 6) + spark(36, 238, 4.5);
  }

  let body = '';
  body += hairBack(L.hair, hairColour);
  body += legs(outfit.trousers, { patch: t === 0, stripe: t === 2 ? '#3e4862' : null });
  body += shoes(outfit.shoes, { shine: t >= 2, boots: outfit.boots });

  // A long coat hangs behind the legs, to the knee.
  if (outfit.coat) {
    body += `<path d="M64 106L60 268Q80 274 97 262L96 190Z" fill="${outfit.coat}"/>`
      + `<path d="M136 106L140 268Q120 274 103 262L104 190Z" fill="${outfit.coat}"/>`;
    if (outfit.trim) body += `<path d="M60 268Q80 274 97 262M140 268Q120 274 103 262" stroke="${outfit.trim}" stroke-width="1.8" fill="none"/>`;
  }

  body += torso(outfit.shirt);
  if (t === 1) {
    // A striped shirt under the waistcoat.
    body += '<path d="M78 104V188M88 101V188M112 101V188M122 104V188" stroke="#9fb0bd" stroke-width="1.6" opacity=".7"/>';
  }
  if (t === 0) {
    // Braces over a plain shirt, open at the neck.
    body += '<path d="M82 101L87 188M118 101L113 188" stroke="#6b4a2b" stroke-width="4.4" stroke-linecap="round"/>'
      + '<circle cx="87" cy="180" r="2" fill="#c9a24a"/><circle cx="113" cy="180" r="2" fill="#c9a24a"/>';
  }
  if (outfit.vest) body += waistcoat(outfit.vest, { brocade: t === 4 });
  if (t >= 2) {
    // A watch chain across the waistcoat.
    body += '<path d="M101 158Q113 168 124 157" stroke="#e0b64a" stroke-width="1.4" fill="none"/><circle cx="124.5" cy="157" r="2.4" fill="#e0b64a"/>';
  }

  // The jacket or the coat over it, open at the front.
  const over = outfit.coat || outfit.jacket;
  if (over) {
    body += `<path d="M64 104L86 99L96 142L94 192H66Z" fill="${over}"/>`
      + `<path d="M136 104L114 99L104 142L106 192H134Z" fill="${over}"/>`
      // Lapels.
      + `<path d="M86 99L96 142L90 118L80 108Z" fill="#000" opacity=".25"/><path d="M114 99L104 142L110 118L120 108Z" fill="#000" opacity=".25"/>`;
    if (outfit.trim) {
      body += `<path d="M86 99L96 142L94 192M114 99L104 142L106 192" stroke="${outfit.trim}" stroke-width="1.8" fill="none"/>`
        + `<circle cx="92" cy="166" r="2.2" fill="${outfit.trim}"/><circle cx="108" cy="166" r="2.2" fill="${outfit.trim}"/>`;
    }
  }

  // Neck, collar and what is at the throat.
  body += neckAndCollar(skin, t >= 1 ? outfit.shirt : null);
  if (t === 0) {
    // Open at the neck, with a kerchief knotted round it in your colour.
    body += `<path d="M94 97L100 107L106 97" fill="${skin[1]}"/>`
      + `<path d="M89 95Q100 103 111 95L108 101Q100 107 92 101Z" fill="${accent}"/>`
      + `<path d="M97 101L100 112L104 101Z" fill="${accent}"/><circle cx="100" cy="102" r="2.6" fill="${accent}" stroke="#000" stroke-opacity=".2"/>`;
  }
  if (t === 1) body += `<path d="M98 103L103 103L106 127L101 133L96 126Z" fill="${accent}" transform="rotate(8 101 115)"/>`;
  if (t === 2) body += '<path d="M98 103H102L104 130L100 135L96 130Z" fill="#1d1b1f"/>';
  if (t === 3) {
    body += '<path d="M98 105L96 136M102 105L104 136" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>'
      + '<circle cx="100" cy="106" r="3.6" fill="#c9ccd2" stroke="#6b6f78" stroke-width=".8"/>';
  }
  if (t === 4) {
    body += '<path d="M92 100Q100 113 108 100Q105 120 100 123Q95 120 92 100Z" fill="#f6f1e6"/>'
      + '<circle cx="100" cy="112" r="2.4" fill="#d9b44a"/>';
  }

  // The arms, and what the hands are holding.
  body += arm(POSES.left, armStyle);
  body += arm(rightPose, armStyle);
  if (t >= 3) {
    // Rings.
    body += `<circle cx="${POSES.left.w[0] + 4}" cy="${POSES.left.w[1] + 6}" r="1.8" fill="#e0b64a"/>`;
  }
  const chipColours = t >= 4 ? ['#d9b44a', '#1d1b1f'] : t >= 2 ? ['#8e2b2b', '#f4efe6', '#22406b'] : ['#8e2b2b', '#f4efe6'];
  if (props === 'tea') body += teacup(rightPose.w[0] - 2, rightPose.w[1] - 1);
  if (props === 'cards') {
    const [x, y] = rightPose.w;
    const reveal = t >= 3;
    body += card(x - 6, y - 14, -14, reveal ? 'A' : '', reveal ? '♠' : '', false)
      + card(x + 4, y - 15, 10, reveal ? 'K' : '', reveal ? '♠' : '', false);
    if (!reveal) {
      // Face down: the backs.
      body += `<g transform="rotate(-14 ${x - 6} ${y - 14})"><rect x="${x - 11}" y="${y - 21}" width="10" height="14" rx="1.2" fill="#8e2b2b"/></g>`
        + `<g transform="rotate(10 ${x + 4} ${y - 15})"><rect x="${x - 1}" y="${y - 22}" width="10" height="14" rx="1.2" fill="#8e2b2b"/></g>`;
    }
  }
  if (props === 'showcards') {
    const [x, y] = rightPose.w;
    body += card(x - 6, y - 14, -14, '7', '♥', true) + card(x + 4, y - 15, 10, '2', '♣', false);
  }
  if (props === 'chips') {
    // A chip in the air over the flicking hand, and a stack in the other.
    const [x, y] = POSES.flick.w;
    body += `<ellipse cx="${x + 2}" cy="${y - 20}" rx="5" ry="6.8" fill="${chipColours[0]}" stroke="#fbf6ee" stroke-width="1.4"/>`
      + `<path d="M${x - 6} ${y - 12}q4-4 8-4" stroke="#fbf6ee" stroke-width=".9" opacity=".6" fill="none"/>`;
  }
  if (props !== 'none' && props !== 'tea' && t >= 1) {
    body += chips(POSES.left.w[0], POSES.left.w[1] + 2, props === 'chips' ? 6 : 3 + Math.min(t, 3), chipColours);
  }

  // The head: tilted with the form.
  const tilt = form === 'cold' ? 'rotate(4 100 84)' : form === 'hot' ? 'translate(0 -1.5) rotate(-2 100 84)' : '';
  let head = `<ellipse cx="78.5" cy="64" rx="4" ry="6.4" fill="${skin[1]}"/><ellipse cx="121.5" cy="64" rx="4" ry="6.4" fill="${skin[1]}"/>`
    + `<ellipse cx="100" cy="62" rx="21" ry="24" fill="${skin[0]}"/>`
    + `<path d="M100 38A21 24 0 0 1 100 86A15 24 0 0 0 100 38Z" fill="${skin[1]}" opacity=".4"/>`;
  head += beardShape(L.beard, hairColour);
  head += face(skin, form, { glasses: t === 4 });
  head += hairFront(L.hair, hairColour, true);
  head += HATS[outfit.hat](accent);
  body += `<g transform="${tilt}">${head}</g>`;

  if (trophy) {
    body += '<path d="M148 316h20v4q0 14-10 15t-10-15z" fill="#d9b44a" stroke="#8a6a1e" stroke-width="1"/>'
      + '<path d="M148 320q-6 0-5 5t6 4M168 320q6 0 5 5t-6 4" stroke="#8a6a1e" stroke-width="1.6" fill="none"/>'
      + '<path d="M155 335h6v5h5v5h-16v-5h5z" fill="#b8902e"/>'
      + '<path d="M152 320q2 6 1 10" stroke="#fff" stroke-width="1.4" opacity=".5" fill="none"/>';
  }

  const said = String(label).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg class="character" viewBox="0 0 200 360" width="${width}" height="${height}" role="img"${label ? ` aria-label="${said}"` : ' aria-hidden="true"'}>`
    + back + body + '</svg>';
}

/**
 * Head and shoulders only, for small places (the top bar, a dock): the same
 * figure, framed by its viewBox.
 */
export function bustSvg(opts = {}, size = 40) {
  return characterSvg({ ...opts, stage: false })
    .replace('viewBox="0 0 200 360"', 'viewBox="45 4 110 110"')
    .replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
}
