/**
 * The Bankroll Challenge: climb the online stakes ladder from NL2 to NL500
 * without going broke. This is the mode that teaches the actual business of
 * playing poker for money.
 */

import { el, fmt, toast, sparkline } from './dom.js';
import { STAKES, stakeFor, bankrollAdvice } from '../state/stats.js';
import { checkAchievements } from '../state/achievements.js';

export function renderGrind(ctx) {
  const { profile, go } = ctx;
  const bankroll = profile.data.bankroll;
  const current = stakeFor(profile.data.stakeKey);
  const advice = bankrollAdvice(bankroll, current.key);
  const sessions = profile.data.sessions.filter((s) => s.stake !== 'practice');

  const curve = [];
  let running = 0;
  for (const s of sessions) { running += s.profitBb || 0; curve.push(running); }

  const sit = (stake) => {
    if (bankroll < stake.buyIn) {
      return toast({ icon: '🚫', title: 'Not enough for a buy-in', desc: `${stake.name} costs ${fmt.money(stake.buyIn)}.` });
    }
    const direction = STAKES.indexOf(stake) > STAKES.indexOf(current) ? 'up'
      : STAKES.indexOf(stake) < STAKES.indexOf(current) ? 'down' : 'same';
    profile.setBankroll(bankroll, stake.key);
    if (direction !== 'same') {
      checkAchievements(profile, { type: 'stakeChange', direction, stakeKey: stake.key })
        .forEach((a) => toast({ icon: a.icon, title: a.name, desc: a.description }));
    }
    return go('play', { mode: 'grind' });
  };

  return el('div.screen',
    el('div.panel',
      el('div.spread',
        el('div',
          el('h1', { style: { margin: 0 } }, '💰 Bankroll Challenge'),
          el('div.muted', 'Start at NL2 with $200. Beat each level, build a proper roll, and move up. Bust and you move back down — exactly like the real thing.'),
        ),
        el('div', { style: { textAlign: 'right' } },
          el('div.mono', { style: { fontSize: '2rem', fontWeight: '700', color: 'var(--gold)' } }, fmt.money(bankroll)),
          el('div.faint', 'bankroll'),
        ),
      ),
      el(`div.notice${advice.ok ? '' : '.warn'}`, { style: { marginTop: '14px' } },
        el('strong', advice.ok ? '✅ ' : '⚠️ '),
        advice.message,
        advice.suggestion ? el('span', ` ${advice.suggestion}`) : null,
      ),
    ),

    sessions.length >= 2
      ? el('div.panel',
          el('div.panel-title', el('h3', 'Your results'), el('span.faint', `${sessions.length} sessions`)),
          sparkline(curve, { color: running >= 0 ? '#3ecf8e' : '#f2555a' }),
          el('div.spread', { style: { marginTop: '8px' } },
            el('span.faint', `${fmt.chips(sessions.reduce((s, x) => s + (x.hands || 0), 0))} hands`),
            el('span.faint', `Lifetime ${fmt.bb(running)}`),
          ),
        )
      : null,

    el('div.panel',
      el('div.panel-title', el('h2', 'The stakes ladder')),
      el('div.grid.cols-2',
        STAKES.map((stake) => {
          const rolled = bankroll >= stake.minBankroll;
          const affordable = bankroll >= stake.buyIn;
          const isCurrent = stake.key === current.key;
          const buyIns = bankroll / stake.buyIn;
          return el('div.panel', {
            style: {
              background: 'var(--bg-raised)',
              borderColor: isCurrent ? 'var(--gold)' : rolled ? 'var(--border-bright)' : 'var(--border)',
              opacity: affordable ? '1' : '0.5',
            },
          },
            el('div.spread',
              el('div.row',
                el('h3', { style: { margin: 0 } }, stake.name),
                isCurrent ? el('span.badge.gold', 'current') : null,
                rolled ? el('span.badge.green', 'rolled') : el('span.badge.red', `needs ${fmt.money(stake.minBankroll)}`),
              ),
              el('span.faint.mono', `${fmt.money(stake.buyIn)} buy-in`),
            ),
            el('div.faint', { style: { margin: '8px 0 12px' } }, stake.blurb),
            el('div.spread',
              el('span.faint', affordable ? `${buyIns.toFixed(0)} buy-ins deep` : 'cannot afford a buy-in'),
              el('button.btn.sm', {
                disabled: !affordable,
                class: rolled ? 'primary' : '',
                onclick: () => sit(stake),
              }, rolled ? 'Sit down' : 'Take a shot'),
            ),
          );
        }),
      ),
    ),

    el('div.panel',
      el('h3', 'Playing poker for money — the honest version'),
      el('ul.lesson-points',
        el('li', el('span', 'A good small-stakes win rate is 3-8bb/100. At NL10 that is roughly $3-8 an hour for a full-time grinder playing multiple tables.')),
        el('li', el('span', 'Standard deviation is around 100bb/100. Over 10,000 hands a 5bb/100 winner still loses money about 30% of the time.')),
        el('li', el('span', 'Keep 30-50 buy-ins for the stake you play. Below that, a normal downswing busts you even though your edge is real.')),
        el('li', el('span', 'Rake takes 5% of most pots. It is the reason marginal spots that look break-even are actually losing.')),
        el('li', el('span', 'Real-money online poker is legal in some places and not in others, and the money at risk is genuinely yours. Treat the bankroll rules as the floor, not the target.')),
      ),
    ),
  );
}
