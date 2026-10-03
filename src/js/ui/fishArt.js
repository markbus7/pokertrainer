/**
 * The fish in the Catch Book, drawn as ink on the page.
 *
 * Each species is described by a handful of words in data/fish.js — how
 * long, how deep, which tail, which fin on its back, what is on its sides —
 * and drawn from them here, the way an old naturalist's plate is a body,
 * fins and a pattern. One drawing routine keeps the thirteen in one hand.
 *
 * Like the river, nothing here carries a colour: shapes are `fish-body`,
 * `fish-fin`, `fish-mark` and `fish-line`, and river.css inks them from the
 * page. A fish not yet caught is drawn as its shadow only.
 */

const f1 = (n) => Math.round(n * 10) / 10;

let uid = 0;

/** A small deterministic scatter, so a fish's spots are the same every time. */
function scatter(seedText, n) {
  let s = [...seedText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: n }, () => [next(), next()]);
}

/**
 * @param {object} species  an entry of SPECIES
 * @param {{width?: number, caught?: boolean}} [opts]
 * @returns {string} an <svg> element as markup
 */
export function fishSvg(species, { width = 120, caught = true } = {}) {
  const s = species.shape;
  const W = 110;
  const H = 54;
  const cy = 27;
  const L = s.len;
  const D = s.depth;
  const nose = (W - L) / 2 - 4;
  const tail = nose + L;
  const neck = s.tail === 'eel' ? 1 : Math.max(2, D * 0.17);

  // Half the body's depth a fraction f of the way from nose to tail: it
  // swells to its deepest about a third of the way back, then narrows to the
  // root of the tail.
  const half = (f) => (f < 0.35
    ? (D / 2) * Math.sin((f / 0.35) * (Math.PI / 2)) ** 0.8
    : neck + (D / 2 - neck) * Math.cos(((f - 0.35) / 0.65) * (Math.PI / 2)));
  const at = (f) => nose + L * f;
  const top = (f) => cy - half(f);
  const bottom = (f) => cy + half(f) * 0.92;

  const steps = 26;
  const upper = Array.from({ length: steps + 1 }, (_, i) => [at(i / steps), top(i / steps)]);
  const lower = Array.from({ length: steps + 1 }, (_, i) => [at(1 - i / steps), bottom(1 - i / steps)]);
  const body = `M${[...upper, ...lower].map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`;

  const tb = tail;
  const tails = {
    fork: `M${f1(tb)} ${f1(cy - neck)}L${f1(tb + 13)} ${f1(cy - neck - 10)}L${f1(tb + 8)} ${cy}L${f1(tb + 13)} ${f1(cy + neck + 10)}L${f1(tb)} ${f1(cy + neck)}Z`,
    square: `M${f1(tb)} ${f1(cy - neck)}L${f1(tb + 11)} ${f1(cy - neck - 7)}L${f1(tb + 11)} ${f1(cy + neck + 7)}L${f1(tb)} ${f1(cy + neck)}Z`,
    round: `M${f1(tb)} ${f1(cy - neck)}C${f1(tb + 15)} ${f1(cy - neck - 9)} ${f1(tb + 15)} ${f1(cy + neck + 9)} ${f1(tb)} ${f1(cy + neck)}Z`,
    eel: `M${f1(tb)} ${f1(cy - neck)}L${f1(tb + 7)} ${cy}L${f1(tb)} ${f1(cy + neck)}Z`,
    shark: `M${f1(tb)} ${f1(cy - neck)}L${f1(tb + 16)} ${f1(cy - neck - 12)}L${f1(tb + 6)} ${cy}L${f1(tb + 9)} ${f1(cy + neck + 5)}L${f1(tb)} ${f1(cy + neck)}Z`,
  };

  // The fin on the back, as a run of points along the top of the body.
  const finAlong = (f0, f1_, rise, spikes = 0) => {
    const pts = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const f = f0 + ((f1_ - f0) * i) / n;
      const lift = Math.sin((i / n) * Math.PI) ** 0.6 * rise;
      const spike = spikes && i % 2 === 1 ? rise * 0.35 : 0;
      pts.push([at(f), top(f) - lift - spike]);
    }
    const back = [[at(f1_), top(f1_) + 1], [at(f0), top(f0) + 1]];
    return `M${[...pts, ...back].map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`;
  };
  const dorsals = {
    spiny: finAlong(0.28, 0.62, D * 0.32, 1),
    small: finAlong(0.4, 0.55, D * 0.35),
    long: finAlong(0.25, 0.78, D * 0.22),
    back: finAlong(0.66, 0.82, D * 0.45),
    ribbon: finAlong(0.3, 1, 3),
  };
  const belly = (f0, f1_, drop) => {
    const x0 = at(f0);
    const x1 = at(f1_);
    return `M${f1(x0)} ${f1(bottom(f0) - 1)}L${f1((x0 + x1) / 2 + 2)} ${f1(bottom((f0 + f1_) / 2) + drop)}L${f1(x1)} ${f1(bottom(f1_) - 1)}Z`;
  };
  const fins = [
    dorsals[s.dorsal] || '',
    s.dorsal === 'ribbon' ? '' : belly(0.68, 0.8, D * 0.3),
    s.adipose ? finAlong(0.84, 0.88, 3) : '',
  ].filter(Boolean);
  const pectoral = `M${f1(at(0.24))} ${f1(cy + 1)}L${f1(at(0.24) + 10)} ${f1(cy + half(0.3) * 0.7 + 3)}L${f1(at(0.24) + 6)} ${f1(cy + 1)}Z`;

  const snoutLen = s.snout === 'long' ? 12 : s.snout === 'duck' ? 6 : 0;
  const snout = snoutLen
    ? `M${f1(nose + 1)} ${f1(cy - 1.8)}L${f1(nose - snoutLen)} ${f1(cy - 0.6)}L${f1(nose - snoutLen)} ${f1(cy + 0.6)}L${f1(nose + 1)} ${f1(cy + 1.8)}Z`
    : '';

  // The plate is cropped to the fish, so a minnow and a sturgeon both fill
  // their card rather than sitting small in a frame sized for the biggest.
  const vx = f1(nose - snoutLen - (s.whiskers ? 11 : s.barbels ? 6 : 3));
  const reachTop = D / 2 + D * 0.45 + (s.crown ? 9 : 2);
  const reachBottom = Math.max(D / 2 + D * 0.32, neck + 12) + (s.whiskers ? 6 : 2);
  const vy = f1(cy - Math.max(reachTop, neck + 13));
  const vw = f1(tail + 18 - vx);
  const vh = f1(cy + reachBottom - vy);
  const box = `viewBox="${vx} ${vy} ${vw} ${vh}" width="${width}" height="${f1((width * vh) / vw)}"`;

  const shadow = `<path class="fish-body" d="${body}"/><path class="fish-fin" d="${tails[s.tail] || tails.fork}"/>`
    + fins.map((d) => `<path class="fish-fin" d="${d}"/>`).join('')
    + (snout ? `<path class="fish-body" d="${snout}"/>` : '');

  if (!caught) {
    return `<svg class="fish-art unknown" ${box} aria-hidden="true">${shadow}</svg>`;
  }

  const clip = `fish-clip-${species.key}-${++uid}`;
  const marks = [];
  switch (s.pattern) {
    case 'bars':
      for (const f of [0.32, 0.46, 0.6, 0.74]) marks.push(`<rect class="fish-mark" x="${f1(at(f))}" y="0" width="${f1(L * 0.05)}" height="${H}"/>`);
      break;
    case 'stripe':
      marks.push(`<path class="fish-line" d="M${f1(at(0.2))} ${f1(cy - 0.5)}L${f1(at(0.98))} ${f1(cy - 0.5)}"/>`);
      break;
    case 'spots':
      for (const [a, b] of scatter(species.key, 16)) {
        const f = 0.2 + a * 0.72;
        marks.push(`<circle class="fish-mark" cx="${f1(at(f))}" cy="${f1(top(f) + (bottom(f) - top(f)) * (0.15 + b * 0.55))}" r="${f1(0.9 + b * 0.8)}"/>`);
      }
      break;
    case 'scales':
      for (let col = 0; col < 9; col++) {
        for (let row = -2; row <= 2; row++) {
          const x = at(0.24 + col * 0.075);
          const y = cy + row * 4 + (col % 2) * 2;
          marks.push(`<path class="fish-line thin" d="M${f1(x)} ${f1(y - 2)}a2.4 2.4 0 0 1 0 4.4"/>`);
        }
      }
      break;
    case 'mottled':
      for (const [a, b] of scatter(species.key, 9)) {
        const f = 0.22 + a * 0.68;
        marks.push(`<ellipse class="fish-mark soft" cx="${f1(at(f))}" cy="${f1(top(f) + (bottom(f) - top(f)) * (0.1 + b * 0.5))}" rx="${f1(2 + b * 2.5)}" ry="${f1(1.4 + a * 1.4)}"/>`);
      }
      break;
    case 'scutes':
      for (let i = 0; i < 9; i++) {
        const f = 0.2 + i * 0.08;
        const x = at(f);
        for (const y of [top(f) + 2.2, cy]) marks.push(`<path class="fish-mark" d="M${f1(x - 1.6)} ${f1(y)}L${f1(x)} ${f1(y - 1.6)}L${f1(x + 1.6)} ${f1(y)}L${f1(x)} ${f1(y + 1.6)}Z"/>`);
      }
      break;
    default:
      break;
  }

  const eyeX = at(0.09);
  const eyeY = cy - half(0.09) * 0.35;
  const gill = `M${f1(at(0.2))} ${f1(top(0.2) + 2)}Q${f1(at(0.24))} ${cy} ${f1(at(0.2))} ${f1(bottom(0.2) - 2)}`;
  const mouthLen = s.jaw === 'big' ? 6 : 3;
  const mouth = `M${f1(nose - snoutLen + 0.5)} ${f1(cy + 1.2)}l${mouthLen} ${f1(0.8)}`;
  const whiskers = [];
  if (s.barbels) whiskers.push(`M${f1(nose + 1)} ${f1(cy + 1.5)}q-2 4 -5 6`);
  if (s.whiskers) whiskers.push(`M${f1(nose + 1)} ${f1(cy)}q-6 -2 -9 -9`, `M${f1(nose + 1)} ${f1(cy + 2)}q-7 3 -10 11`);
  const crown = s.crown
    ? `<path class="fish-crown" d="M${f1(eyeX - 4)} ${f1(top(0.09) - 2)}l1 -5 2 3 1.6 -4 1.6 4 2 -3 1 5z"/>`
    : '';

  return `<svg class="fish-art${s.crown ? ' golden' : ''}" ${box} aria-hidden="true">`
    + `<defs><clipPath id="${clip}"><path d="${body}"/></clipPath></defs>`
    + shadow
    + `<g clip-path="url(#${clip})">${marks.join('')}</g>`
    + `<path class="fish-fin" d="${pectoral}"/>`
    + `<path class="fish-line" d="${gill}"/>`
    + `<path class="fish-line" d="${mouth}"/>`
    + whiskers.map((d) => `<path class="fish-line" d="${d}"/>`).join('')
    + `<circle class="fish-eye" cx="${f1(eyeX)}" cy="${f1(eyeY)}" r="${s.eye === 'big' ? 2.3 : 1.6}"/>`
    + `<circle class="fish-pupil" cx="${f1(eyeX + 0.3)}" cy="${f1(eyeY)}" r="${s.eye === 'big' ? 1.2 : 0.8}"/>`
    + crown
    + '</svg>';
}
