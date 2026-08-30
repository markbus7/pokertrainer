/** Shared lesson visuals, used by both the guided lessons and the Lab. */

import { el, richText, fmt } from './dom.js';

export function renderVisual(visual) {
  switch (visual.type) {
    case 'stack': return renderStack(visual);
    case 'table': return renderTable(visual);
    case 'gauge': return renderGauge(visual);
    default: return null;
  }
}

/** A proportional bar: shows at a glance what share of the pot is your money. */
export function renderStack({ segments, caption }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return el('div.visual',
    el('div.stack-bar',
      segments.map((seg) => el(`div.stack-seg.${seg.tone || 'gold'}`, {
        style: { width: `${(seg.value / total) * 100}%` },
      }, el('span', fmt.chips(seg.value)))),
    ),
    el('div.stack-legend',
      segments.map((seg) => el('span.stack-key',
        el('span', { class: `swatch ${seg.tone || 'gold'}` }),
        seg.label,
      )),
    ),
    caption ? el('div.visual-caption', richText(caption)) : null,
  );
}

export function renderTable({ headers, rows, caption }) {
  return el('div.visual',
    el('div', { style: { overflowX: 'auto' } },
      el('table.lesson-table',
        el('thead', el('tr', headers.map((h) => el('th', h)))),
        el('tbody', rows.map((row) => el('tr', row.map((cell) => el('td', cell))))),
      ),
    ),
    caption ? el('div.visual-caption', richText(caption)) : null,
  );
}

/** Side-by-side comparison of what the price demands against what you hold. */
export function renderGauge({ need, have, needLabel = 'Need', haveLabel = 'Have' }) {
  const scale = Math.max(need, have, 0.5);
  const row = (label, value, tone) => el('div.gauge-row',
    el('div.gauge-label', label),
    el('div.gauge-track',
      el(`div.gauge-fill.${tone}`, { style: { width: `${(value / scale) * 100}%` } }),
    ),
    el('div.gauge-value', fmt.pct(value)),
  );
  return el('div.visual',
    row(needLabel, need, 'need'),
    row(haveLabel, have, 'have'),
    el('div.visual-caption',
      have >= need
        ? richText(`You have **${fmt.pct(have)}** and need **${fmt.pct(need)}** — call.`)
        : richText(`You have **${fmt.pct(have)}** but need **${fmt.pct(need)}** — fold.`)),
  );
}

/** The pot-versus-your-call bar the pot odds material leans on. */
export function potShareVisual(potNow, call, caption) {
  return renderStack({
    segments: [
      { label: 'Already in the pot (you win this)', value: potNow, tone: 'gold' },
      { label: 'Your call (you risk this)', value: call, tone: 'blue' },
    ],
    caption: caption
      || `Your ${call} is ${fmt.pct(call / (potNow + call), 1)} of the ${potNow + call} final pot — so you need to win that often.`,
  });
}
