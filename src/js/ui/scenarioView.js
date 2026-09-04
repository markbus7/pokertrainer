/** Renders the situation attached to a drill question. */

import { el, fmt } from './dom.js';
import { cardRow } from './cardView.js';
import { POSITION_INFO } from '../data/ranges.js';
import { t } from '../i18n/index.js';

export function scenarioView(scenario, settings = {}) {
  if (!scenario) return null;
  const four = !!settings.fourColour;
  const parts = [];

  const villainIsProfile = scenario.villain && !Array.isArray(scenario.villain);
  if (villainIsProfile) {
    parts.push(el('div.row', { style: { gap: '10px' } },
      el('span', { style: { fontSize: '1.6rem' } }, scenario.villain.emoji),
      el('div',
        el('div', { style: { fontWeight: '650' } }, `${scenario.villain.name} — ${scenario.villain.style}`),
        el('div.faint', scenario.villain.tell),
      ),
    ));
  }

  if (scenario.position) {
    const info = POSITION_INFO[scenario.position];
    parts.push(el('div.row',
      el('span.badge.gold', scenario.positionName || (info ? info.name : scenario.position)),
      scenario.raiser ? el('span.badge', `${scenario.raiser} raised`) : null,
    ));
  }

  if (scenario.hole) {
    parts.push(labelled('Your hand', cardRow(scenario.hole, { size: 'lg', fourColour: four })));
  }

  if (scenario.compare) {
    parts.push(el('div.row', { style: { gap: '24px' } },
      scenario.compare.map((hand, i) => labelled(
        i === 0 ? t('Hand A') : t('Hand B'),
        cardRow(hand, { size: 'lg', fourColour: four }),
      )),
    ));
  }

  if (scenario.board) {
    parts.push(labelled('Board', cardRow(scenario.board, { size: 'lg', fourColour: four })));
  }

  if (Array.isArray(scenario.hands)) {
    parts.push(el('div.row', { style: { gap: '28px' } },
      scenario.hands.map((h) => labelled(h.label, cardRow(h.cards, { size: 'lg', fourColour: four }))),
    ));
  }

  if (scenario.revealVillain && Array.isArray(scenario.villain)) {
    parts.push(labelled('Their hand', cardRow(scenario.villain, { size: 'lg', fourColour: four })));
  }

  const numbers = [];
  if (scenario.pot != null) numbers.push(['Pot', fmt.chips(scenario.pot)]);
  if (scenario.toCall != null) numbers.push(['To call', fmt.chips(scenario.toCall)]);
  if (scenario.betSize != null) numbers.push(['Your bet', fmt.chips(scenario.betSize)]);
  if (scenario.effectiveStack != null) numbers.push(['Effective stack', fmt.chips(scenario.effectiveStack)]);
  if (scenario.bankroll != null) numbers.push(['Bankroll', fmt.money(scenario.bankroll)]);
  if (scenario.stake) numbers.push(['Stake', scenario.stake]);
  if (scenario.winRate != null) numbers.push(['Win rate', `${scenario.winRate}bb/100`]);
  if (scenario.bankrollBb != null) numbers.push(['Bankroll', `${fmt.chips(scenario.bankrollBb)}bb`]);
  if (typeof scenario.hands === 'number') numbers.push(['Hands', fmt.chips(scenario.hands)]);
  if (scenario.potBb != null) numbers.push(['Pot', `${scenario.potBb}bb`]);

  if (numbers.length) {
    parts.push(el('div.row', { style: { gap: '18px', marginTop: '4px' } },
      numbers.map(([k, v]) => el('div',
        el('div.faint', { style: { fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' } }, k),
        el('div.mono', { style: { fontSize: '1.1rem', fontWeight: '700' } }, v),
      )),
    ));
  }

  if (scenario.stacks) {
    parts.push(el('div',
      el('div.faint', { style: { marginBottom: '6px' } }, `Prizes: ${scenario.payouts.join(' / ')}`),
      el('div.row', { style: { gap: '18px' } },
        scenario.stacks.map((s) => el('div',
          el('div.faint', s.label),
          el('div.mono', { style: { fontWeight: '700' } }, fmt.chips(s.chips)),
        )),
      ),
    ));
  }

  if (scenario.texture) {
    parts.push(el('div.faint', `Texture: ${scenario.texture.join(', ')}`));
  }

  if (!parts.length) return null;
  return el('div.panel', { style: { background: 'var(--bg-raised)', display: 'grid', gap: '14px' } }, parts);
}

function labelled(label, node) {
  return el('div',
    el('div.faint', { style: { fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' } }, label),
    node,
  );
}
