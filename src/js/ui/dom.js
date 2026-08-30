import { lookupTerm } from '../data/glossary.js';

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
    else if (key === 'text') node.textContent = value;
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
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
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
  const frag = document.createDocumentFragment();
  for (const part of String(text).split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)) {
    if (!part) continue;
    // Bold and italic recurse, so a marked term nested inside emphasis —
    // **[[combo|combinations]]** — still renders as a term rather than as
    // literal brackets. Without this the outer marker swallows the inner one.
    if (part.startsWith('[[') && part.endsWith(']]')) frag.appendChild(termChip(part.slice(2, -2)));
    else if (part.startsWith('**') && part.endsWith('**')) frag.appendChild(el('strong', richText(part.slice(2, -2))));
    else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) frag.appendChild(el('em', richText(part.slice(1, -1))));
    else if (part.startsWith('`') && part.endsWith('`')) frag.appendChild(el('code.inline-code', part.slice(1, -1)));
    else frag.appendChild(document.createTextNode(part));
  }
  return frag;
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
