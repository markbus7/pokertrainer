import { lookupTerm, TERMS } from '../data/glossary.js';
import { t, getLang } from '../i18n/index.js';

/** Minimal DOM helpers — enough to build the whole UI without a framework. */

/**
 * el('div.panel', { onclick }, children)
 * Tag string supports `tag.class1.class2#id`.
 */
export function el(spec, props = null, ...children) {
  const [head, ...classes] = String(spec).split('.');
  const [tag, id] = head.split('#');
  const node = document.createElement(tag || 'div');
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(' ');

  if (props && (typeof props !== 'object' || Array.isArray(props) || props instanceof Node)) {
    children.unshift(props);
    props = null;
  }

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = `${node.className} ${value}`.trim();
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = t(value);
    else if (key === 'title' || key === 'placeholder' || key === 'aria-label') node.setAttribute(key, t(value));
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node && key !== 'list') node[key] = value;
    else node.setAttribute(key, value);
  }

  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(4)) {
    if (child == null || child === false || child === true) continue;
    // Text children are translated here rather than at 1,100 call sites.
    // This is safe because t() only substitutes strings the table actually
    // has an entry for: a card rank, a player name or a formatted number is
    // never a key, so it passes through untouched.
    node.appendChild(child instanceof Node ? child : document.createTextNode(t(String(child))));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  append(node, children);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** A toast in the corner: level-ups, achievements, table events. */
export function toast({ icon = '✨', title, desc = '', duration = 4200 }) {
  const host = $('#toasts');
  if (!host) return;
  const node = el('div.toast',
    el('div.icon', icon),
    el('div', el('div.title', title), desc ? el('div.desc', desc) : null),
  );
  host.appendChild(node);
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 260);
  }, duration);
}

/**
 * Renders the small amount of inline markup lesson prose uses: **bold** for
 * the load-bearing terms, `code` for formulas, *italics* for emphasis, and
 * [[term]] for a glossary word. Deliberately not a general markdown parser —
 * this is all the content needs.
 *
 * A glossary term renders as a tappable word that reveals its definition in
 * place. Tap rather than hover, because the people hitting unfamiliar jargon
 * are as likely to be on a tablet as a desktop.
 */
export function richText(text) {
  // Translate the whole string once, here, then parse. Doing it inside the
  // parser would hit every recursive call, so an emphasised fragment lifted
  // out of a Dutch sentence would be looked up again as if it were English.
  //
  // The context travels with the parse so that auto-linking is decided per
  // rendered block rather than per fragment: one chip per term, a handful per
  // sentence, however deeply the emphasis nests.
  return parseRich(t(text), { linked: new Set(), budget: AUTO_LINK_BUDGET });
}

/**
 * How many words in one block may explain themselves without the block
 * turning into a page of links. Three is enough for the longest explanation
 * the generators write and few enough that the eye still reads prose.
 */
const AUTO_LINK_BUDGET = 3;

function parseRich(text, ctx) {
  const frag = document.createDocumentFragment();
  for (const part of String(text).split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)) {
    if (!part) continue;
    // Bold and italic recurse, so a marked term nested inside emphasis —
    // **[[combo|combinations]]** — still renders as a term rather than as
    // literal brackets. Without this the outer marker swallows the inner one.
    if (part.startsWith('[[') && part.endsWith(']]')) {
      // A hand-written chip spends budget too, so a paragraph the author
      // already marked up does not then collect three more of its own. The
      // author's choices come first because they are already in the text.
      const [name] = part.slice(2, -2).split('|');
      if (ctx) {
        ctx.linked.add(String(name).trim().toLowerCase());
        ctx.budget--;
      }
      frag.appendChild(termChip(part.slice(2, -2)));
    } else if (part.startsWith('**') && part.endsWith('**')) frag.appendChild(el('strong', parseRich(part.slice(2, -2), ctx)));
    else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) frag.appendChild(el('em', parseRich(part.slice(1, -1), ctx)));
    else if (part.startsWith('`') && part.endsWith('`')) frag.appendChild(el('code.inline-code', part.slice(1, -1)));
    else frag.appendChild(autoLink(part, ctx));
  }
  return frag;
}

/**
 * Jargon that explains itself wherever it appears, not only where somebody
 * remembered to type [[brackets]].
 *
 * The glossary was built on hand-written markup, which meant it worked in the
 * twelve lessons and nowhere else: of 720 sentences the generators can write,
 * 464 mention a term and not one carried the markup. So a reader met "flush
 * draw" in a question with no way to ask what it meant — which is exactly
 * where they most need to.
 */
function autoLink(text, ctx) {
  const frag = document.createDocumentFragment();
  if (!ctx || ctx.budget <= 0) {
    frag.appendChild(document.createTextNode(text));
    return frag;
  }

  // Collect first, choose second. Taking matches in the order they appear
  // would spend the budget on whatever happened to come first in the
  // sentence, and that is almost always the plainest word: "there is 60 in
  // the pot and you have a gutshot" would explain *pot* and not *gutshot*.
  // Longer names are the more specialised ones, so they win the chips.
  const found = [];
  const claimed = new Set();
  for (const match of text.matchAll(autoLinkPattern())) {
    const entry = lookupTerm(match[0]);
    if (!entry) continue;
    const id = entry.term.toLowerCase();
    if (ctx.linked.has(id) || claimed.has(id)) continue;
    claimed.add(id);
    found.push({ entry, id, word: match[0], at: match.index });
  }
  const chosen = found
    .slice()
    .sort((a, b) => b.entry.term.length - a.entry.term.length)
    .slice(0, ctx.budget)
    .sort((a, b) => a.at - b.at);

  let last = 0;
  for (const hit of chosen) {
    ctx.linked.add(hit.id);
    ctx.budget--;
    if (hit.at > last) frag.appendChild(document.createTextNode(text.slice(last, hit.at)));
    // The chip shows the word as written — "Flush draw" mid-question stays
    // capitalised, "outs" stays plural — and explains the entry behind it.
    frag.appendChild(termChip(`${hit.entry.term}|${hit.word}`));
    last = hit.at + hit.word.length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

/**
 * One alternation of every term, longest first so that "open-ended straight
 * draw" wins over "open". Rebuilt when the language changes, because a term
 * that is translated has to be recognised in its Dutch form too — most of the
 * jargon is deliberately kept in English, so most entries match either way.
 */
let patternCache = null;
let patternLang = null;
function autoLinkPattern() {
  const lang = getLang();
  if (patternCache && patternLang === lang) return patternCache;

  const words = new Set();
  for (const entry of Object.values(TERMS)) {
    for (const form of [entry.term, t(entry.term)]) {
      // Terms this short collide with ordinary words far more often than they
      // help — "out" inside "without", "nut" inside "nuts of the deck".
      if (!form || form.length < 3) continue;
      const low = form.toLowerCase();
      words.add(low);
      // The generators write "two overcards" and "nine outs"; the glossary
      // keys the singular. lookupTerm already forgives the plural, but the
      // word has to be matched before it can be looked up.
      if (!low.endsWith('s')) words.add(`${low}s`);
    }
  }
  const escaped = [...words]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
  patternCache = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');
  patternLang = lang;
  return patternCache;
}

/**
 * A glossary word. `[[gutshot]]` shows "gutshot"; `[[gutshot|four outs]]`
 * shows "four outs" and still explains gutshot, so the prose reads naturally.
 */
function termChip(spec) {
  const [name, display] = spec.split('|');
  const entry = lookupTerm(name);
  if (!entry) return document.createTextNode(display || name);

  const button = el('button.term', { type: 'button' }, display || name);
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const host = button.closest('p, li, div');
    if (!host) return;
    const existing = host.nextElementSibling;
    if (existing && existing.classList.contains('term-def') && existing.dataset.term === name) {
      existing.remove();
      button.classList.remove('open');
      return;
    }
    if (existing && existing.classList.contains('term-def')) existing.remove();
    const box = el('div.term-def', { dataset: { term: name } },
      el('div.term-def-head', entry.term),
      el('div', entry.full),
    );
    host.after(box);
    button.classList.add('open');
  });
  return button;
}

export const fmt = {
  pct: (x, digits = 0) => `${(x * 100).toFixed(digits)}%`,
  chips: (n) => Math.round(n).toLocaleString('en-US'),
  money: (n) => `$${n.toFixed(2)}`,
  bb: (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}bb`,
  signed: (n) => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('en-US')}`,
};

/** Tiny inline sparkline for session graphs. */
export function sparkline(values, { width = 300, height = 90, color = '#3ecf8e' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'sparkline');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  if (values.length < 2) return svg;

  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i) => (i / (values.length - 1)) * width;
  const y = (v) => height - ((v - min) / span) * (height - 8) - 4;

  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zeroY = y(0);

  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axis.setAttribute('x1', 0); axis.setAttribute('x2', width);
  axis.setAttribute('y1', zeroY); axis.setAttribute('y2', zeroY);
  axis.setAttribute('stroke', '#2a3644');
  axis.setAttribute('stroke-dasharray', '3 3');
  svg.appendChild(axis);

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', `${path} L${width},${zeroY} L0,${zeroY} Z`);
  area.setAttribute('fill', color);
  area.setAttribute('opacity', '0.13');
  svg.appendChild(area);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', path);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);

  return svg;
}
