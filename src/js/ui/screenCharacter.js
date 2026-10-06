/**
 * Your character: who you are at the table.
 *
 * Everything else in the game is about somebody — the owner of a table, a
 * fish, a chapter. This is the one screen about the reader: drawn head to
 * toe in the clothes their rank has earned, named for the way they actually
 * play, with the numbers a HUD would show about them, the hands they love,
 * the hands that cost them, and the best things that have happened to them on
 * the river.
 *
 * The figure changes as the reader does. The outfit follows the rank (a
 * deckhand's braces at the start, a legend's velvet at the end), what is in
 * the hands follows the style, and the face follows the last few sittings.
 * The rest — skin, hair, a beard, a colour, a name — is theirs to choose, and
 * free.
 *
 * Every number waits for enough hands to mean something, the same bars the
 * rest of the game uses: a style read from twelve hands is a guess, and the
 * screen says how many more it needs rather than guessing.
 */

import { el, fmt, mount } from './dom.js';
import { icon } from './icons.js';
import { t, getLang } from '../i18n/index.js';
import { roomSign, svgNode } from './place.js';
import { portraitSvg } from './portraits.js';
import { characterSvg } from './characterArt.js';
import {
  TIERS, SKINS, HAIRS, HAIR_COLOURS, BEARDS, COLOURS, LOOK_LABELS, NAME_MAX, PROPS_TEXT, FORM_TEXT,
} from '../data/looks.js';
import { PLAYER_TYPES, REGULARS, BOUNDS, HEALTHY } from '../data/playerTypes.js';
import { startingHands, seats as seatRecords, rivals, handRatings, mistakesWith, LIFE_SAMPLE } from '../state/lifetime.js';
import { findHand } from '../state/handHistory.js';
import { whoYouAre, riverRecords } from '../state/character.js';
import { RANKS } from '../state/profile.js';
import { moduleMeta } from '../data/curriculum.js';
import { describeScore, CAT_NAMES } from '../core/evaluator.js';
import { RANK_CHARS, RANK_PLURALS, RANK_NAMES } from '../core/cards.js';
import { VENUES } from '../data/venues.js';
import { PROFILES, WANDERER_PROFILES } from '../engine/bots.js';
import { RIVAL } from '../data/rival.js';
import { SPECIES } from '../data/fish.js';

const pct = (x) => fmt.pct(x);
const bb = (x) => `${x >= 0 ? '+' : '-'}${Math.abs(x).toFixed(1)} bb`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderCharacter(ctx) {
  const { profile, go } = ctx;
  const me = whoYouAre(profile);
  const rating = ratingPanel(me, go);
  return el('div.screen.character',
    roomSign({ glyph: 'person', kicker: t('Who you are at the table'), title: t('Your character') }),
    heroPanel(profile, me, go),
    typePanel(me, go),
    numbersPanel(me),
    resultsPanel(me),
    handsPanel(me, rating.open),
    rating.node,
    famePanel(me),
    tablePanel(me),
    riverPanel(profile),
  );
}

/* ---- the figure ---------------------------------------------------------- */

/** What you are called: your name if you gave one, and the epithet your play has earned. */
export const nameFor = (me) => (me.look.name || t('You'));

/** The figure, as the reader is now. */
export function figureFor(me, { width = 220 } = {}) {
  const tier = TIERS[me.tier];
  const holding = PROPS_TEXT[me.props] ? `, ${t(PROPS_TEXT[me.props])}` : '';
  return characterSvg({
    tier: me.tier,
    form: me.form,
    look: me.look,
    props: me.props,
    trophy: me.trophy,
    width,
    label: `${nameFor(me)}: ${t(tier.name)}${holding}`,
  });
}

function heroPanel(profile, me, go) {
  const tier = TIERS[me.tier];
  const nextTier = TIERS[me.tier + 1] || null;
  const nextRank = nextTier ? RANKS[nextTier.from - 1] : null;
  const ranksToGo = nextTier ? nextTier.from - me.level : 0;
  const form = FORM_TEXT[me.form];

  const stage = el('div.char-stage');
  const plateName = el('div.char-plate-name', nameFor(me));
  const heading = el('h2.char-name');
  const looks = el('div.char-evolution-wrap');
  // Drawn again, in place, whenever the reader changes how they look.
  const draw = () => {
    stage.replaceChildren(svgNode(figureFor(me), 'char-figure'));
    plateName.textContent = nameFor(me);
    heading.textContent = t('{name}, {epithet}', { name: nameFor(me), epithet: t(me.type.epithet) });
    looks.replaceChildren(evolution(me));
  };
  draw();

  return el('section.panel.paper.char-hero',
    el('div.char-stage-wrap',
      stage,
      el('div.char-plate', plateName, el('div.char-plate-epithet', t(me.type.epithet))),
    ),
    el('div.char-id',
      el('div.page-kicker', t('Your character')),
      heading,
      el('div.char-look',
        el('span.char-look-name', t(tier.name)),
        el('span.faint', ` · ${t(tier.blurb)}`),
      ),
      el('div.char-facts',
        el('button.char-fact', { onclick: () => go('levels'), title: t('Your Papers: what the next rank asks for') },
          el('span.char-fact-emoji', { 'aria-hidden': 'true' }, me.rank.emoji),
          el('span',
            el('span.char-fact-k', t('Rank')),
            el('span.char-fact-v', t(me.rank.name)),
            el('span.char-fact-sub', t('Level {level} of {total}', { level: me.level, total: RANKS.length })),
          ),
          icon('arrowRight', { size: 14, className: 'door-arrow' }),
        ),
        el('div.char-fact',
          el('span.char-fact-tag', { 'aria-hidden': 'true' }, me.type.tag),
          el('span',
            el('span.char-fact-k', t('Plays like')),
            el('span.char-fact-v', t(me.type.name)),
            el('span.char-fact-sub', me.read ? t('{vpip} of hands played', { vpip: pct(me.read.vpip) }) : t('Not read yet')),
          ),
        ),
        el(`div.char-fact.form-${me.form}`,
          icon(me.form === 'hot' ? 'spark' : me.form === 'cold' ? 'cold' : 'check', { size: 18, className: 'char-fact-icon' }),
          el('span',
            el('span.char-fact-k', t('Form')),
            el('span.char-fact-v', t(form.name)),
            el('span.char-fact-sub', t(form.blurb, { bb: `${Math.abs(me.recentBb).toFixed(1)} bb` })),
          ),
        ),
      ),
      looks,
      nextTier
        ? el('p.char-next',
          icon('ladder', { size: 16 }),
          el('span', ranksToGo === 1
            ? t('One rank to go: at {rank} you dress as a {look}. {blurb}', { rank: t(nextRank.name), look: t(nextTier.name).toLowerCase(), blurb: t(nextTier.blurb) })
            : t('{n} ranks to go: at {rank} you dress as a {look}. {blurb}', { n: ranksToGo, rank: t(nextRank.name), look: t(nextTier.name).toLowerCase(), blurb: t(nextTier.blurb) })))
        : el('p.char-next', icon('star', { size: 16 }), el('span', t('The last look there is. Nobody on the river dresses better.'))),
      lookEditor(profile, me, () => {
        me.look = profile.look;
        draw();
      }),
    ),
  );
}

/** The five looks of a career, the ones still to come in silhouette. */
function evolution(me) {
  return el('div.char-evolution', { role: 'list', 'aria-label': t('The looks a career wears') },
    TIERS.map((tier) => {
      const state = tier.tier < me.tier ? 'worn' : tier.tier === me.tier ? 'now' : 'ahead';
      const rank = RANKS[tier.from - 1];
      return el(`div.evo.${state}`, {
        role: 'listitem',
        title: state === 'ahead'
          ? t('{look}, from {rank}', { look: t(tier.name), rank: t(rank.name) })
          : t(tier.name),
      },
        svgNode(characterSvg({ tier: tier.tier, look: me.look, form: 'steady', props: 'none', width: 46, stage: false }), 'evo-figure'),
        el('span.evo-name', t(tier.name)),
        el('span.evo-from', state === 'ahead' ? t('from {rank}', { rank: t(rank.name) }) : state === 'now' ? t('You now') : t('Worn')),
      );
    }),
  );
}

/** How you look: everything that is not earned is yours to choose. */
function lookEditor(profile, me, redraw) {
  const rows = [];
  const choice = (field, options, swatch) => {
    const buttons = options.map((value) => el(`button.look-option${swatch ? '.swatch' : ''}`, {
      type: 'button',
      'aria-pressed': me.look[field] === value ? 'true' : 'false',
      'aria-label': t(LOOK_LABELS[field][value]),
      title: t(LOOK_LABELS[field][value]),
      style: swatch ? { background: swatch(value) } : null,
      onclick: (e) => {
        profile.setLook({ [field]: value });
        for (const b of buttons) b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false');
        redraw();
      },
    }, swatch ? null : t(LOOK_LABELS[field][value])));
    return buttons;
  };
  const row = (label, buttons) => {
    rows.push(el('div.look-row', el('span.look-label', t(label)), el('div.look-options', buttons)));
  };
  const nameInput = el('input.look-name', {
    type: 'text',
    maxLength: NAME_MAX,
    value: me.look.name,
    placeholder: t('You'),
    'aria-label': t('Your name'),
    autocomplete: 'off',
    spellcheck: false,
    onchange: (e) => { profile.setLook({ name: e.target.value }); redraw(); },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });
  rows.push(el('div.look-row', el('span.look-label', t('Name')), nameInput));
  row('Skin', choice('skin', Object.keys(SKINS), (k) => SKINS[k][0]));
  row('Hair', choice('hair', HAIRS));
  row('Hair colour', choice('hairColour', Object.keys(HAIR_COLOURS), (k) => HAIR_COLOURS[k]));
  row('Face', choice('beard', BEARDS));
  row('Your colour', choice('colour', Object.keys(COLOURS), (k) => COLOURS[k]));
  return el('details.char-editor',
    el('summary', icon('person', { size: 16 }), ' ', t('Change how you look')),
    el('div.look-rows', rows),
    el('p.faint.look-note', t('The clothes come with the rank, and what is in your hands with the way you play. The rest is yours, and free.')),
  );
}

/* ---- the kind of player you are ---------------------------------------- */

function typePanel(me, go) {
  const type = me.type;
  const like = type.like ? REGULARS.find((r) => r.key === type.like) : null;
  const next = moduleMeta(type.next);
  const source = me.read && me.read.source === 'life'
    ? t('Read from {n} hands at full tables.', { n: fmt.chips(me.read.hands) })
    : me.read
      ? t('Read from Silas\'s notes on your last sittings at the stops, until you have {n} more hands at a full table.', { n: me.toRead })
      : null;
  return el('section.panel.paper.char-type',
    el('div.panel-title', el('h2', t('The kind of player you are'))),
    el('div.type-head',
      el('div.type-seal', { 'aria-hidden': 'true' }, type.tag),
      el('div',
        el('h3.type-name', t(type.name)),
        like
          ? el('div.type-like',
            svgNode(portraitSvg(like.key, { size: 34 }), 'type-like-face'),
            el('span', t('Plays like {name} at the river\'s tables.', { name: like.name })),
          )
          : null,
      ),
    ),
    el('div.type-body',
      el('div.type-words',
        el('p.type-you', t(type.you)),
        el('div.type-two',
          el('div.type-good', el('div.type-k', icon('check', { size: 15 }), ' ', t('What it wins')), el('p', t(type.good))),
          el('div.type-watch', el('div.type-k', icon('warn', { size: 15 }), ' ', t('What it costs')), el('p', t(type.watch))),
        ),
        me.read ? null : rookieBar(me),
        source ? el('p.faint.type-source', source) : null,
        next
          ? el('button.btn.ghost.type-next', { onclick: () => go('learn', { module: next.id }) },
            icon(next.icon, { size: 16 }), el('span', t('The chapter for it: {module}', { module: t(next.name) })))
          : null,
      ),
      styleMap(me),
    ),
  );
}

function rookieBar(me) {
  const have = me.life.style.hands;
  return el('div.rookie-bar',
    el('div.spread',
      el('span', t('Hands at a full table')),
      el('span.mono', `${have} / ${LIFE_SAMPLE.style}`),
    ),
    el('div.bar', el('span', { style: { width: `${Math.round((have / LIFE_SAMPLE.style) * 100)}%` } })),
  );
}

/**
 * The style map: how many hands you play across, how many of those you raise
 * up, with the river's six regulars on it for company and the lines a HUD
 * reads by drawn in. You are the one dot in colour.
 */
function styleMap(me) {
  // Drawn for the width it will be shown at, so the names on a phone are
  // the same size as the names on a desk rather than shrunk to fit.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600;
  const W = narrow ? 360 : 540;
  const H = narrow ? 300 : 336;
  const L = narrow ? 44 : 52;
  const R = W - (narrow ? 14 : 20);
  const T = 16;
  const B = H - 52;
  const you = me.read;
  const xmax = Math.max(0.6, you ? Math.ceil((you.vpip + 0.05) * 10) / 10 : 0.6);
  const x = (v) => L + (Math.min(v, xmax) / xmax) * (R - L);
  const y = (v) => B - Math.max(0, Math.min(1, v)) * (B - T);
  const share = (p) => (p.vpip > 0 ? p.pfr / p.vpip : 0);
  const typeOf = (p) => {
    if (p.vpip < BOUNDS.nit) return PLAYER_TYPES.nit;
    const agg = share(p) >= BOUNDS.aggressive;
    if (p.vpip < BOUNDS.tight) return agg ? PLAYER_TYPES.tag : PLAYER_TYPES.rock;
    if (p.vpip < BOUNDS.loose) return agg ? PLAYER_TYPES.lag : PLAYER_TYPES.station;
    return agg ? PLAYER_TYPES.maniac : PLAYER_TYPES.station;
  };
  const tipFor = (name, p) => t('{name}: plays {vpip} of hands, raises {share} of those', {
    name, vpip: pct(p.vpip), share: pct(share(p)),
  });

  let svg = `<svg class="style-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Style map: hands played across, share of them raised up'))}">`;
  // Where winners sit: the tight-aggressive box, lightly inked.
  svg += `<rect class="sm-zone" x="${x(BOUNDS.nit)}" y="${T}" width="${x(BOUNDS.tight) - x(BOUNDS.nit)}" height="${y(BOUNDS.aggressive) - T}"/>`;
  // The frame and the lines a HUD reads by.
  svg += `<path class="sm-grid" d="M${L} ${y(BOUNDS.aggressive)}H${R}${[BOUNDS.nit, BOUNDS.tight, BOUNDS.loose].filter((v) => v < xmax).map((v) => `M${x(v)} ${T}V${B}`).join('')}"/>`;
  svg += `<path class="sm-axis" d="M${L} ${T}V${B}H${R}"/>`;
  // Ticks.
  const xTicks = [0, BOUNDS.nit, BOUNDS.tight, BOUNDS.loose, 0.6, xmax].filter((v, i, a) => v <= xmax && a.indexOf(v) === i);
  for (const v of xTicks) svg += `<text class="sm-tick" x="${x(v)}" y="${B + 16}" text-anchor="middle">${Math.round(v * 100)}%</text>`;
  for (const v of [0, 0.5, 1]) svg += `<text class="sm-tick" x="${L - 7}" y="${y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`;
  svg += `<text class="sm-axis-title" x="${(L + R) / 2}" y="${H - 6}" text-anchor="middle">${esc(t('Hands you play (VPIP) →'))}</text>`;
  svg += `<text class="sm-axis-title" transform="translate(14 ${(T + B) / 2}) rotate(-90)" text-anchor="middle">${esc(t('Of those, raised →'))}</text>`;
  // Every label is placed so it sits on no dot and no other label: the dots
  // first, as things to keep clear of; then your name, then the regulars',
  // each on the first side of its dot with space (or the least crowded one);
  // and last the regions' names, which move inward off anything in their
  // way, or stay off the map if there is no room for them.
  const boxes = [];
  const overlap = (a) => boxes.reduce((sum, b) => sum
    + Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)), 0);
  const textBox = (text, px, py, anchor, size) => {
    const w = String(text).length * size * 0.56;
    return { x: anchor === 'middle' ? px - w / 2 : anchor === 'end' ? px - w : px, y: py - size * 0.8, w, h: size };
  };
  const marks = [
    ...REGULARS.map((p) => ({ p, name: p.name, you: false })),
    ...(you ? [{ p: you, name: t('You'), you: true }] : []),
  ].map((m) => ({ ...m, cx: x(m.p.vpip), cy: y(share(m.p)) }));
  for (const m of marks) {
    const r = m.you ? 11 : 6;
    boxes.push({ x: m.cx - r, y: m.cy - r, w: 2 * r, h: 2 * r });
  }
  const place = (m, size, sides) => {
    const options = sides
      .map(([dx, dy, anchor]) => ({ px: m.cx + dx, py: m.cy + dy, anchor, box: textBox(m.name, m.cx + dx, m.cy + dy, anchor, size) }))
      .filter((c) => c.box.x >= L - 4 && c.box.x + c.box.w <= W - 2 && c.box.y >= 0 && c.box.y + c.box.h <= B)
      .map((c) => ({ ...c, cost: overlap(c.box) }));
    const pick = options.find((c) => c.cost === 0)
      || options.slice().sort((a, b) => a.cost - b.cost)[0]
      || { px: m.cx + sides[0][0], py: m.cy + sides[0][1], anchor: sides[0][2] };
    if (pick.box) boxes.push(pick.box);
    return pick;
  };
  const youMark = marks.find((m) => m.you);
  const youAt = youMark ? place(youMark, 13, [[0, -16, 'middle'], [0, 27, 'middle'], [15, 5, 'start'], [-15, 5, 'end']]) : null;
  const regularAt = new Map(marks.filter((m) => !m.you).map((m) => [m, place(m, 13, [
    [9, 4, 'start'], [-9, 4, 'end'], [0, -10, 'middle'], [0, 19, 'middle'],
    [7, -7, 'start'], [-7, -7, 'end'], [7, 15, 'start'], [-7, 15, 'end'],
  ])]));
  const regions = [
    ['Nit', 0, BOUNDS.nit, 'top'],
    ['Tight-aggressive', BOUNDS.nit, BOUNDS.tight, 'top'],
    ['Tight and passive', BOUNDS.nit, BOUNDS.tight, 'bottom'],
    ['Loose-aggressive', BOUNDS.tight, Math.min(BOUNDS.loose, xmax), 'top'],
    ['Maniac', BOUNDS.loose, xmax, 'top'],
    ['Calling station', BOUNDS.tight, xmax, 'bottom'],
  ].filter(([, from, to]) => to > from);
  for (const [label, from, to, edge] of regions) {
    const text = t(label);
    const cx = (x(from) + x(to)) / 2;
    for (const step of [0, 14, 28]) {
      const cy = edge === 'top' ? T + 14 + step : B - 8 - step;
      const box = textBox(text, cx, cy, 'middle', 11);
      if (overlap(box) > 0) continue;
      boxes.push(box);
      svg += `<text class="sm-region" x="${cx}" y="${cy}" text-anchor="middle">${esc(text)}</text>`;
      break;
    }
  }
  for (const [m, at] of regularAt) {
    svg += `<g class="sm-mark sm-regular" tabindex="0" data-tip="${esc(tipFor(m.name, m.p))} · ${esc(t(typeOf(m.p).name))}">`
      + `<circle class="hit" cx="${m.cx}" cy="${m.cy}" r="13"/>`
      + `<circle class="dot" cx="${m.cx}" cy="${m.cy}" r="5"/>`
      + `<text class="sm-label" x="${at.px}" y="${at.py}" text-anchor="${at.anchor}">${esc(m.name)}</text>`
      + '</g>';
  }
  if (youMark) {
    const { cx, cy } = youMark;
    svg += `<g class="sm-mark sm-you" tabindex="0" data-tip="${esc(tipFor(t('You'), you))}">`
      + `<circle class="hit" cx="${cx}" cy="${cy}" r="14"/>`
      + `<circle class="ring" cx="${cx}" cy="${cy}" r="10.5"/>`
      + `<circle class="dot" cx="${cx}" cy="${cy}" r="7.5"/>`
      + `<text class="sm-label sm-you-label" x="${youAt.px}" y="${youAt.py}" text-anchor="${youAt.anchor}">${esc(t('You'))}</text>`
      + '</g>';
  }
  svg += '</svg>';

  const rows = [
    ...(you ? [{ name: t('You'), p: you }] : []),
    ...REGULARS.map((p) => ({ name: p.name, p })),
  ];
  return el('figure.char-chart.style-map-figure',
    el('figcaption.chart-head',
      el('span.chart-title', t('Where you sit among the regulars')),
      // Two kinds of dot, so a key; until yours is on it, the title says it all.
      you
        ? el('span.chart-legend',
          el('span.lg-key.lg-you', { 'aria-hidden': 'true' }), el('span', t('You')),
          el('span.lg-key.lg-them', { 'aria-hidden': 'true' }), el('span', t('The river\'s regulars')),
        )
        : null,
    ),
    withTips(el('div.chart-box', svgNode(svg, 'chart-svg'))),
    you ? null : el('p.faint.chart-note', t('Your dot goes on the map after {n} hands at a full table.', { n: LIFE_SAMPLE.style })),
    el('details.chart-table',
      el('summary', t('The numbers as a table')),
      el('table.data-table',
        el('thead', el('tr', el('th', t('Player')), el('th', 'VPIP'), el('th', 'PFR'), el('th', t('Raised')), el('th', t('Style')))),
        el('tbody', rows.map(({ name, p }) => el('tr',
          el('td', name), el('td.num', pct(p.vpip)), el('td.num', pct(p.pfr)), el('td.num', pct(share(p))), el('td', t(typeOf(p).name)),
        ))),
      ),
    ),
  );
}

/**
 * One tooltip per chart: whatever carries a data-tip says it on hover or on
 * focus, above the mark, kept inside the chart's box.
 */
function withTips(box) {
  const tip = el('div.chart-tip', { role: 'tooltip', hidden: true });
  box.append(tip);
  const show = (mark) => {
    tip.textContent = mark.getAttribute('data-tip');
    tip.hidden = false;
    const frame = box.getBoundingClientRect();
    const r = mark.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const cx = Math.max(half + 2, Math.min(frame.width - half - 2, r.left + r.width / 2 - frame.left));
    tip.style.left = `${Math.round(cx)}px`;
    tip.style.top = `${Math.round(r.top - frame.top)}px`;
  };
  const markOf = (node) => (node && node.closest ? node.closest('[data-tip]') : null);
  box.addEventListener('pointerover', (e) => { const m = markOf(e.target); if (m) show(m); });
  box.addEventListener('pointerout', (e) => { if (!markOf(e.relatedTarget)) tip.hidden = true; });
  box.addEventListener('focusin', (e) => { const m = markOf(e.target); if (m) show(m); });
  box.addEventListener('focusout', () => { tip.hidden = true; });
  return box;
}

/* ---- your numbers ------------------------------------------------------ */

const GAUGES = [
  {
    key: 'vpip',
    name: 'Hands you play',
    short: 'VPIP',
    what: 'Of every hand dealt, how often you put money in before the flop.',
    high: 'More than a winning regular: fold the bottom of your range, above all from the early seats.',
    low: 'Tighter than a winning regular: there are hands to open from the late seats.',
    needs: (s) => ({ n: LIFE_SAMPLE.style - s.hands, what: 'more hands at a full table' }),
  },
  {
    key: 'pfr',
    name: 'Hands you raise',
    short: 'PFR',
    what: 'Of every hand dealt, how often you raise before the flop.',
    high: 'You raise a lot. Make sure the hands can stand the three-bets that come back.',
    low: 'Raise more of the hands you play: a call lets somebody else take the lead.',
    needs: (s) => ({ n: LIFE_SAMPLE.style - s.hands, what: 'more hands at a full table' }),
  },
  {
    key: 'threeBet',
    name: 'Re-raises',
    short: '3-bet',
    what: 'When somebody has raised before you, how often you raise again.',
    high: 'You re-raise a lot. Expect to be four-bet, and have a plan when you are.',
    low: 'Re-raise your best hands, and a few that block them, instead of calling.',
    needs: (s) => ({ n: LIFE_SAMPLE.aggression - s.threeBetChances, what: 'more chances to re-raise' }),
  },
  {
    key: 'af',
    name: 'Aggression',
    short: 'AF',
    what: 'After the flop: your bets and raises for every call.',
    high: 'You bet and raise a lot after the flop. Pick bluffs that can still improve.',
    low: 'Calling is the weakest move in poker: bet and raise more of the hands you continue with.',
    needs: (s) => ({ n: LIFE_SAMPLE.aggression - s.calls, what: 'more calls after the flop' }),
  },
  {
    key: 'wtsd',
    name: 'Went to showdown',
    short: 'WTSD',
    what: 'Of the flops you saw, how often you were still there when the cards were turned over.',
    high: 'You see a lot of showdowns. Fold more of the hands that can only catch a bluff.',
    low: 'You give up a lot before the river. Some of those hands were winning.',
    needs: (s) => ({ n: LIFE_SAMPLE.flops - s.sawFlop, what: 'more flops seen' }),
  },
  {
    key: 'wsd',
    name: 'Won at showdown',
    short: 'W$SD',
    what: 'Of your showdowns, how many you won.',
    high: 'You win most of your showdowns: there may be calls you are not making.',
    low: 'You lose more showdowns than you win. You are calling with too little.',
    needs: (s) => ({ n: LIFE_SAMPLE.showdown - s.showdowns, what: 'more showdowns' }),
  },
];

function numbersPanel(me) {
  const s = me.life.style;
  return el('section.panel.paper.char-numbers',
    el('div.panel-title',
      el('h2', t('Your numbers')),
      el('span.faint', t('Full Hold\'em cash tables · {n} hands', { n: fmt.chips(s.hands) })),
    ),
    el('p.faint', t('The six numbers a HUD shows about a player, about you. The shaded band is where a winning regular sits.')),
    el('div.cgs', GAUGES.map((g) => gauge(g, me.style[g.key], s))),
  );
}

function gauge(g, value, s) {
  const h = HEALTHY[g.key];
  const show = (v) => (h.pct ? pct(v) : v.toFixed(1));
  const at = (v) => `${Math.max(0, Math.min(100, (v / h.max) * 100)).toFixed(1)}%`;
  // Judged on the number as printed: 19.7% shows as 20%, and 20% is in a 20–28% band.
  const shown = value === null ? null : h.pct ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10;
  const verdict = shown === null ? null : shown < h.lo ? 'low' : shown > h.hi ? 'high' : 'in';
  const need = value === null ? g.needs(s) : null;
  return el(`div.cg${verdict ? `.is-${verdict}` : '.is-none'}`,
    el('div.cg-head',
      // The short name is poker notation, the same in every language; the dot before it is CSS.
      el('span.cg-name', t(g.name), el('span.cg-short', g.short)),
      el('span.cg-value.mono', value === null ? '—' : show(value)),
    ),
    el('div.cg-track', {
      role: 'img',
      'aria-label': value === null
        ? t('{name}: not enough hands yet', { name: t(g.name) })
        : t('{name}: {value}; a winning regular sits between {lo} and {hi}', { name: t(g.name), value: show(value), lo: show(h.lo), hi: show(h.hi) }),
    },
      el('span.cg-band', { style: { left: at(h.lo), width: `calc(${at(h.hi)} - ${at(h.lo)})` } }),
      value === null ? null : el('span.cg-mark', { style: { left: at(value) } }),
    ),
    el('div.cg-foot',
      el('span.faint', t('Winning range {lo}–{hi}', { lo: show(h.lo), hi: show(h.hi) })),
      verdict === 'in' ? el('span.cg-verdict.ok', icon('check', { size: 14 }), ' ', t('In the range')) : null,
      verdict === 'high' ? el('span.cg-verdict', '▲ ', t('Above it')) : null,
      verdict === 'low' ? el('span.cg-verdict', '▼ ', t('Below it')) : null,
    ),
    el('p.cg-say', value === null
      ? t('{n} {what} before this means anything.', { n: Math.max(1, need.n), what: t(need.what) })
      : verdict === 'in' ? t(g.what) : t(verdict === 'high' ? g.high : g.low)),
  );
}

/* ---- results ------------------------------------------------------------ */

function plaque(label, value, sub = null) {
  return el('div.stat', el('div.label', t(label)), el('div.value', value), sub ? el('div.sub', sub) : null);
}

function resultsPanel(me) {
  const life = me.life;
  const cash = me.cash;
  return el('section.panel.paper.char-results',
    el('div.panel-title', el('h2', t('How it has gone'))),
    el('div.grid.cols-3.char-plaques',
      plaque('Hands played', fmt.chips(life.hands), t('at real tables, every kind')),
      plaque('Cash result', cash.hands ? bb(cash.netBb) : '—',
        cash.winRate === null
          ? t('{n} more cash hands for a win rate', { n: LIFE_SAMPLE.winRate - cash.hands })
          : t('{rate} bb a hundred hands', { rate: `${cash.winRate >= 0 ? '+' : '-'}${Math.abs(cash.winRate).toFixed(1)}` })),
      plaque('Pots won', life.hands ? pct(life.won / life.hands) : '—', t('{n} of {total}', { n: fmt.chips(life.won), total: fmt.chips(life.hands) })),
      plaque('Showdowns won', life.showdowns >= LIFE_SAMPLE.showdown ? pct(life.showdownsWon / life.showdowns) : '—',
        t('{n} of {total}', { n: fmt.chips(life.showdownsWon), total: fmt.chips(life.showdowns) })),
      plaque('Sound decisions', me.sound === null ? '—' : pct(me.sound),
        me.sound === null
          ? t('{n} more graded decisions', { n: 20 - life.decisions })
          : t('{n} of {total} at the tables', { n: fmt.chips(life.sound), total: fmt.chips(life.decisions) })),
      plaque('Won without a showdown', fmt.chips(life.noShowdownWins), t('pots they folded to you')),
    ),
  );
}

/* ---- your hands -------------------------------------------------------- */

const RANK_ORDER = [...RANK_CHARS].reverse();
const rankValue = (c) => RANK_CHARS.indexOf(c) + 2;

/** "AKs" in words: "Ace-King suited", "Pocket Aces". */
export function handWords(key) {
  const hi = rankValue(key[0]);
  const lo = rankValue(key[1]);
  if (key.length === 2) return t('Pocket {ranks}', { ranks: t(RANK_PLURALS[hi]) });
  return t(key[2] === 's' ? '{high}-{low} suited' : '{high}-{low} offsuit', { high: t(RANK_NAMES[hi]), low: t(RANK_NAMES[lo]) });
}

/** Two little cards for a hand: the same suit for suited, two for the rest. */
function miniCards(key) {
  const suits = key.length === 3 && key[2] === 's' ? ['♠', '♠'] : ['♠', '♥'];
  const face = (r) => (r === 'T' ? '10' : r);
  return el('span.mini-cards', { 'aria-hidden': 'true' },
    [key[0], key[1]].map((r, i) => el(`span.mini-card${suits[i] === '♥' ? '.red' : ''}`, el('b', face(r)), el('i', suits[i]))));
}

function handCard(kicker, row, line, open) {
  return el(row ? 'button.hand-pick.is-button' : 'div.hand-pick', row ? { type: 'button', onclick: () => open(row.key) } : null,
    el('div.page-kicker', t(kicker)),
    row ? miniCards(row.key) : el('span.mini-cards.empty', '?'),
    el('div',
      el('div.hand-pick-name', row ? handWords(row.key) : t('Not yet')),
      el('div.faint.hand-pick-line', row ? line(row) : t('Play a few more hands.')),
    ),
  );
}

function handsPanel(me, open) {
  const { rows, favourite, best, worst } = startingHands(me.life);
  return el('section.panel.paper.char-hands',
    el('div.panel-title', el('h2', t('Your hands'))),
    el('div.hands-body',
      el('div.hand-picks',
      handCard('Your favourite', favourite, (r) => t('Played {n} times, won {w}', { n: r.played, w: r.won }), open),
      handCard('Your money-maker', best, (r) => t('{bb} at cash tables, over {n} hands played', { bb: bb(r.netBb), n: r.played }), open),
      handCard('The one that costs you', worst, (r) => t('{bb} at cash tables, over {n} hands played', { bb: bb(r.netBb), n: r.played }), open),
      ),
      handGrid(rows, open),
    ),
  );
}

/* ---- your hand rating -------------------------------------------------- */

const DID = { fold: 'You folded', check: 'You checked', call: 'You called', bet: 'You bet', raise: 'You raised' };

/**
 * Every decision you make at a real table is graded, and kept with the hand
 * you held: so the hands you keep getting wrong can be named, and the ones you
 * play best — and a tap on any of them says what the mistakes were, why each
 * one was a mistake, and what was right instead.
 */
function ratingPanel(me, go) {
  const { rows, worst, best } = handRatings(me.life);
  const total = rows.reduce((sum, r) => sum + r.decisions, 0);
  const detail = el('div.hand-detail', { hidden: true, tabIndex: -1 });
  const open = (key) => {
    mount(detail, handDetail(me, key, go, () => { detail.hidden = true; }));
    detail.hidden = false;
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    detail.focus({ preventScroll: true });
  };
  const rateRow = (r, kind) => el('button.rate-row', { type: 'button', onclick: () => open(r.key) },
    miniCards(r.key),
    el('span.rate-name', el('b', r.key), el('span.faint', handWords(r.key))),
    kind === 'worst'
      ? el('span.rate-score.is-bad', icon('cross', { size: 14 }), ' ',
        r.mistakes === 1 ? t('1 mistake in {d}', { d: r.decisions }) : t('{n} mistakes in {d}', { n: r.mistakes, d: r.decisions }))
      : el('span.rate-score.is-good', icon('check', { size: 14 }), ' ', t('{n} of {d} right', { n: r.sound, d: r.decisions })),
    icon('arrowRight', { size: 14, className: 'door-arrow' }),
  );
  const node = el('section.panel.paper.char-rating',
    el('div.panel-title',
      el('h2', t('Your hand rating')),
      el('span.faint', t('{n} decisions graded at real tables', { n: fmt.chips(total) })),
    ),
    el('p.faint', t('Every decision at a real table is graded and kept with the hand you held. Tap a hand to see each mistake, why it was one, and what was right.')),
    total
      ? el('div.rate-cols',
        el('div.rate-col',
          el('h3.rate-title', icon('warn', { size: 16 }), ' ', t('Where you go wrong')),
          worst.length ? worst.map((r) => rateRow(r, 'worst')) : el('p.faint', t('No mistakes yet. Keep it that way.'))),
        el('div.rate-col',
          el('h3.rate-title', icon('check', { size: 16 }), ' ', t('Where you play best')),
          best.length
            ? best.map((r) => rateRow(r, 'best'))
            : el('p.faint', t('A hand you play makes this list after {n} decisions with it.', { n: LIFE_SAMPLE.rating }))),
      )
      : el('p', t('Nothing graded yet. Play at a real table — the free table, a stop, a duel or a Regatta — and every decision lands here, under the hand you held.')),
    detail,
  );
  return { node, open };
}

/** One hand, opened: how it has gone, and each mistake made with it. */
function handDetail(me, key, go, close) {
  const [dealt, played, won, netBb] = me.life.starting[key] || [0, 0, 0, 0];
  const [decisions, sound, mistakes] = me.life.decided[key] || [0, 0, 0, 0];
  const list = mistakesWith(me.life, key);
  // The same mistake made four times is one lesson, not four: grouped, with
  // how often, the latest time it happened, and the latest hand you can replay.
  const groups = [];
  const byKind = new Map();
  for (const m of list) {
    const kind = m.id || m.head;
    let g = byKind.get(kind);
    if (!g) {
      g = { latest: m, count: 0, cost: 0, replay: null };
      byKind.set(kind, g);
      groups.push(g);
    }
    g.count += 1;
    g.cost += m.costBb || 0;
    if (!g.replay && m.handId && findHand(m.handId)) g.replay = m.handId;
  }
  groups.sort((a, b) => b.count - a.count);
  const shown = groups.slice(0, 8);
  return el('div.hand-detail-inner',
    el('div.hand-detail-head',
      miniCards(key),
      el('div.hand-detail-title',
        el('h3', `${handWords(key)} · ${key}`),
        el('div.faint', [
          t('Dealt {n}', { n: dealt }),
          t('played {n}', { n: played }),
          t('won {n}', { n: won }),
          netBb ? bb(netBb) : null,
          decisions ? t('{n} of {d} decisions right', { n: sound, d: decisions }) : null,
        ].filter(Boolean).join(' · ')),
      ),
      el('button.btn.sm.ghost', { type: 'button', onclick: close }, t('Close')),
    ),
    shown.length
      ? el('ol.mistake-list', shown.map((g) => mistakeItem(g, go)))
      : el('p.mistake-none', icon('check', { size: 16 }), ' ', decisions
        ? t('No mistakes with {hand}: every decision with it was right.', { hand: key })
        : t('No decisions graded with {hand} yet.', { hand: key })),
    groups.length > shown.length ? el('p.faint', t('And {n} other kinds of mistake.', { n: groups.length - shown.length })) : null,
    mistakes > list.length ? el('p.faint', t('The oldest mistakes are not kept in full, only counted.')) : null,
  );
}

/**
 * One kind of mistake with a hand: what you did and when (the latest time),
 * what it is called and how often, why it was one, and what was right.
 */
function mistakeItem({ latest: m, count, cost, replay }, go) {
  return el('li.mistake',
    el('div.mistake-when',
      // The street, as every table says it: in English, in every language.
      el('b.mistake-street', m.street),
      m.action && DID[m.action] ? ` · ${t(DID[m.action])}` : '',
      m.where || m.at
        ? el('span.faint', ` · ${count > 1 ? `${t('last time')}: ` : ''}${[m.where ? placeName(m.where) : null, dateOf(m.at)].filter(Boolean).join(' · ')}`)
        : null,
    ),
    el('div.mistake-head', t(m.head, m.params), count > 1 ? el('span.mistake-count', t('{n} times', { n: count })) : null),
    m.body ? el('p.mistake-why', t(m.body, m.params)) : null,
    el('div.mistake-foot',
      m.better ? el('span.mistake-better', t('Instead:'), ' ', el('b', t(m.better, m.params))) : null,
      cost ? el('span.faint', count > 1 ? t('Cost about {bb} in all', { bb: `${cost.toFixed(1)} bb` }) : t('Cost about {bb}', { bb: `${cost.toFixed(1)} bb` })) : null,
      replay ? el('button.btn.sm.ghost', { type: 'button', onclick: () => go('review', { hand: replay }) }, icon('review', { size: 14 }), ' ', t('Replay the hand')) : null,
    ),
  );
}

/** How often you play each hand when it is dealt: all 169, in one grid. */
function handGrid(rows, open) {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const dealtAny = rows.some((r) => r.dealt > 0);
  const cells = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const a = RANK_ORDER[i];
      const b = RANK_ORDER[j];
      const key = i === j ? a + b : i < j ? `${a}${b}s` : `${b}${a}o`;
      const r = byKey[key];
      const share = r && r.dealt ? r.played / r.dealt : null;
      // Never played is the page itself, outlined; then four steps of brass,
      // a quarter of the time each, to always.
      const step = share === null ? 'none' : share === 0 ? 's0' : `s${Math.min(4, Math.ceil(share * 4))}`;
      cells.push(el(`div.hg-cell.${step}${i === j ? '.pair' : ''}`, {
        dataset: { key },
        'data-tip': r && r.dealt
          ? t('{hand}: dealt {d}, played {p} ({share}), won {w}', { hand: key, d: r.dealt, p: r.played, share: pct(share), w: r.won })
          : t('{hand}: not dealt yet', { hand: key }),
      }, key));
    }
  }
  const sorted = rows.filter((r) => r.dealt > 0).sort((p, q) => q.dealt - p.dealt || q.played - p.played);
  return el('figure.char-chart.hand-grid-figure',
    el('figcaption.chart-head',
      el('span.chart-title', t('How often you play each hand when you are dealt it')),
      el('span.ramp-legend', { 'aria-hidden': 'true' },
        el('span.ramp-end', t('Never')),
        ['s0', 's1', 's2', 's3', 's4'].map((step) => el(`span.ramp-step.${step}`)),
        el('span.ramp-end', t('Always')),
        el('span.ramp-step.none'), el('span.ramp-end', t('Not dealt yet')),
      ),
    ),
    withTips(el('div.chart-box', el('div.hand-grid', {
      role: 'img',
      'aria-label': t('All 169 starting hands, shaded by how often you play them'),
      // Any square opens that hand's rating: how it has gone, and the mistakes.
      onclick: (e) => { const cell = e.target.closest('.hg-cell'); if (cell && cell.dataset.key) open(cell.dataset.key); },
    }, cells))),
    el('p.faint.chart-note', t('Tap a square to see how you play that hand.')),
    dealtAny ? null : el('p.faint.chart-note', t('Every hand you are dealt at a real table fills in its square.')),
    sorted.length
      ? el('details.chart-table',
        el('summary', t('The numbers as a table')),
        el('table.data-table',
          el('thead', el('tr', el('th', t('Hand')), el('th', t('Dealt')), el('th', t('Played')), el('th', t('Won')), el('th', t('Cash result')))),
          el('tbody', sorted.map((r) => el('tr',
            el('td', r.key), el('td.num', r.dealt), el('td.num', r.played), el('td.num', r.won), el('td.num', bb(r.netBb)),
          ))),
        ),
      )
      : null,
  );
}

/* ---- the hall of fame -------------------------------------------------- */

const placeName = (where) => {
  if (where === 'practice') return t('Silas\'s practice table');
  if (where === 'bubble') return t('The bubble');
  const v = VENUES.find((x) => x.key === where);
  return v ? t(v.name) : t('the river');
};
// Dated in the language the screen is in, not the browser's.
const dateOf = (at) => (Number.isFinite(at)
  ? new Date(at).toLocaleDateString(getLang() === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '');

function record(label, value, line) {
  return el('div.fame-row',
    el('div.fame-label', t(label)),
    el('div.fame-value', value),
    line ? el('div.faint.fame-line', line) : null,
  );
}

function fame(me) {
  const life = me.life;
  const where = (r) => [placeName(r.where), dateOf(r.at)].filter(Boolean).join(' · ');
  return [
    record('Best hand ever made',
      life.bestHand ? describeScore(life.bestHand.score) : '—',
      life.bestHand ? [life.bestHand.key ? t('with {hand}', { hand: life.bestHand.key }) : null, where(life.bestHand)].filter(Boolean).join(' · ') : t('Made at a showdown, at a real table.')),
    record('Biggest pot won',
      life.biggestPot ? `${fmt.chips(life.biggestPot.bb)} bb` : '—',
      life.biggestPot
        ? [life.biggestPot.made !== null && life.biggestPot.made !== undefined ? describeScore(life.biggestPot.made) : t('no showdown'), life.biggestPot.key, where(life.biggestPot)].filter(Boolean).join(' · ')
        : t('At a cash table.')),
    record('Biggest bluff',
      life.biggestBluff ? `${fmt.chips(life.biggestBluff.bb)} bb` : '—',
      life.biggestBluff
        ? [t('they folded to your nothing'), life.biggestBluff.key, where(life.biggestBluff)].filter(Boolean).join(' · ')
        : t('A pot won with nothing at all, and nobody saw.')),
    record('Longest winning run', life.streak.best ? t('{n} hands', { n: life.streak.best }) : '—', t('Pots in a row, without losing one you played.')),
    record('Royal flushes', String(life.royals), life.royals ? t('The best hand in poker.') : t('One in 650,000 hands. Keep playing.')),
    record('All in', fmt.chips(life.allIns), t('times you put every chip in the middle')),
  ];
}

function funFacts(me) {
  const life = me.life;
  const facts = [];
  const row = (key) => life.starting[key];
  const aa = row('AA');
  if (aa && aa[0]) facts.push(t('Pocket Aces: dealt {d} times, won {w}.', { d: aa[0], w: aa[2] }));
  const junk = row('72o');
  if (junk && junk[0]) facts.push(junk[1]
    ? t('Seven-deuce, the worst hand in poker: dealt {d} times, and you played it {p}.', { d: junk[0], p: junk[1] })
    : t('Seven-deuce, the worst hand in poker: dealt {d} times, and folded every time.', { d: junk[0] }));
  if (life.hands >= LIFE_SAMPLE.style) facts.push(t('You fold {share} of the hands you are dealt.', { share: pct(life.folds / life.hands) }));
  if (life.bluffs) facts.push(life.bluffs === 1 ? t('One pot won holding nothing at all.') : t('{n} pots won holding nothing at all.', { n: life.bluffs }));
  const common = life.made.reduce((best, n, i) => (n > (life.made[best] || 0) ? i : best), 0);
  if (life.showdowns >= LIFE_SAMPLE.showdown) facts.push(t('The hand you show down most: {hand}.', { hand: t(CAT_NAMES[common]) }));
  return facts;
}

function madeBars(me) {
  const made = me.life.made;
  const total = made.reduce((s, n) => s + n, 0);
  if (!total) return null;
  const top = Math.max(...made);
  return el('figure.char-chart.made-figure',
    el('figcaption.chart-head', el('span.chart-title', t('What you have shown down'))),
    el('div.made-bars', CAT_NAMES.map((name, i) => el('div.made-row',
      el('span.made-name', t(name)),
      el('span.made-track', el('span.made-bar', { style: { width: `${top ? (made[i] / top) * 100 : 0}%` } })),
      el('span.made-n.mono', made[i] ? `${made[i]} · ${pct(made[i] / total)}` : '0'),
    ))),
  );
}

function famePanel(me) {
  const facts = funFacts(me);
  return el('section.panel.paper.char-fame',
    el('div.panel-title', el('h2', t('The hall of fame'))),
    el('div.fame', fame(me)),
    madeBars(me),
    facts.length
      ? el('div.fun-facts',
        el('div.page-kicker', t('Odds and ends')),
        el('ul', facts.map((f) => el('li', f))),
      )
      : null,
  );
}

/* ---- at the table: seats and people ----------------------------------- */

/** Who a row of the "against" table is: a face, a name and what they are. */
function opponentOf(who) {
  if (who === RIVAL.key) return { face: RIVAL.key, name: RIVAL.short, what: t('the Rival') };
  const w = WANDERER_PROFILES[who];
  if (w) return { face: who, name: w.name, what: t(w.style) };
  const p = PROFILES[who] || PROFILES.tag;
  return { face: p.key, name: t(p.style), what: t('players like {name}', { name: p.name }) };
}

function personCard(kicker, row, line) {
  if (!row) return null;
  const o = opponentOf(row.who);
  return el('div.person-pick',
    svgNode(portraitSvg(o.face, { size: 52 }), 'person-face'),
    el('div',
      el('div.page-kicker', t(kicker)),
      el('div.person-name', o.name, el('span.faint', ` · ${o.what}`)),
      el('div.faint', line(row)),
    ),
  );
}

function tablePanel(me) {
  const s = seatRecords(me.life);
  const r = rivals(me.life);
  const perHand = (row) => `${row.perHand >= 0 ? '+' : '-'}${Math.abs(row.perHand).toFixed(2)} bb`;
  const empty = !s.best && !r.victim && !r.nemesis;
  return el('section.panel.paper.char-table',
    el('div.panel-title', el('h2', t('At the table'))),
    empty
      ? el('p.faint', t('Your best seat, your worst, and who you take chips from: after {n} hands in each seat at a full cash table.', { n: LIFE_SAMPLE.seat }))
      : null,
    s.best
      ? el('div.seat-picks',
        el('div.seat-pick',
          el('div.page-kicker', t('Your best seat')),
          el('div.seat-pick-name', s.best.seat),
          el('div.faint', t('{bb} a hand over {n} hands', { bb: perHand(s.best), n: s.best.hands })),
        ),
        el('div.seat-pick',
          el('div.page-kicker', t('Your worst seat')),
          el('div.seat-pick-name', s.worst.seat),
          el('div.faint', t('{bb} a hand over {n} hands', { bb: perHand(s.worst), n: s.worst.hands })),
        ),
      )
      : null,
    el('div.person-picks',
      personCard('Your favourite victim', r.victim, (row) => t('You have won {bb} from them over {n} hands.', { bb: `${fmt.chips(row.net)} bb`, n: row.hands })),
      personCard('Your nemesis', r.nemesis, (row) => t('They have taken {bb} from you over {n} hands.', { bb: `${fmt.chips(-row.net)} bb`, n: row.hands })),
    ),
  );
}

/* ---- on the river ------------------------------------------------------- */

function riverPanel(profile) {
  const r = riverRecords(profile);
  return el('section.panel.paper.char-river',
    el('div.panel-title', el('h2', t('On the river'))),
    el('div.grid.cols-4.char-plaques',
      plaque('Keepsakes', `${r.keepsakes} / ${r.stops}`, t('tables taken from their owners')),
      plaque('Duel stars', `${r.stars} / ${r.starsOf}`, t('{n} duels won', { n: r.duelWins })),
      plaque('Regattas won', String(r.regattaWins), t('{n} entered', { n: r.regattas })),
      plaque('Fish caught', `${r.species} / ${SPECIES.length}`, t('kinds in the Catch Book')),
      plaque('Contracts done', String(r.contracts), t('jobs for Silas')),
      plaque('Daily puzzle', t('{n} days', { n: r.dailyBest }), t('your best run')),
      plaque('Pearls earned', fmt.chips(r.pearls), t('all told')),
      plaque('Nights with Nell', String(r.rivalMet), t('sittings with the Rival')),
    ),
  );
}
