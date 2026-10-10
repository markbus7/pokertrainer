/**
 * Fog over the chart: the country you have not been to yet.
 *
 * The whole river used to be on the first screen, every stop and every bend
 * of it, so there was nothing left to find. Now the chart is under fog except
 * where you have been and the next stop down, and the fog lifts as the boat
 * goes further. The places that are not tables — the school, the Trading Post,
 * the boatyard — are always clear, because they are where you go between
 * tables, not somewhere to discover; a town off the river clears once you
 * have heard of it.
 *
 * It is one layer laid over the drawing: a sheet of fog with holes cut in it,
 * soft at the edges. A hole that has just been earned opens as you watch.
 * Like the rest of the chart it carries no colour of its own; river.css paints
 * it from the room's map tokens.
 */

const f1 = (n) => Math.round(n * 10) / 10;

/** A fixed scatter of cloud, the same every time the chart is drawn. */
function puffs(W, H, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const out = [];
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const rx = 50 + rnd() * 70;
    const ry = rx * (0.45 + rnd() * 0.2);
    out.push(`<ellipse class="fog-puff" cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}"/>`);
  }
  return out.join('');
}

/**
 * The fog, as SVG: its defs and the layer itself, to be laid over the chart
 * and under its border.
 *
 * @param {object} o
 * @param {string} o.id       unique on the page: the mask and gradient are named from it
 * @param {number} o.W
 * @param {number} o.H
 * @param {Array<{x:number, y:number, r:number, fresh?:boolean}>} o.holes
 *   where the chart is clear; a fresh one opens from nothing as the chart is shown
 */
export function fogLayer({ id, W, H, holes }) {
  const circles = holes.map((h) => (h.fresh
    ? `<circle class="fog-hole fresh" cx="${f1(h.x)}" cy="${f1(h.y)}" r="0" data-r="${f1(h.r)}" fill="url(#${id}-hole)">`
      + `<animate attributeName="r" from="0" to="${f1(h.r)}" dur="2.6s" begin="0.5s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0 0.2 1"/></circle>`
    : `<circle class="fog-hole" cx="${f1(h.x)}" cy="${f1(h.y)}" r="${f1(h.r)}" fill="url(#${id}-hole)"/>`)).join('');
  return `<defs>
      <radialGradient id="${id}-hole">
        <stop offset="58%" stop-color="black" stop-opacity="1"/><stop offset="100%" stop-color="black" stop-opacity="0"/>
      </radialGradient>
      <mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
        ${circles}
      </mask>
    </defs>
    <g class="fog" mask="url(#${id}-mask)" aria-hidden="true">
      <rect class="fog-base" x="0" y="0" width="${W}" height="${H}"/>
      <g class="fog-drift">${puffs(W, H, W * 7 + H)}</g>
    </g>`;
}

/**
 * Open every fresh hole at once, for a reader who has asked for less motion:
 * the chart is shown as it now is, without the fog drawing back.
 */
export function settleFog(root) {
  root.querySelectorAll('.fog-hole.fresh').forEach((c) => {
    c.querySelectorAll('animate').forEach((a) => a.remove());
    c.setAttribute('r', c.getAttribute('data-r'));
  });
}
