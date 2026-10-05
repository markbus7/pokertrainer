/**
 * Silas's notes on a sitting: what you earned, and — folded shut until you
 * open it — what he saw.
 *
 * At the table he says nothing unless asked. This is where the silence is
 * paid back: how many of your decisions were sound, the skill that held up
 * and the one that leaked, the hands that cost the most, how you played by
 * the numbers, and what to study or buy next. It is folded because the
 * reader asked for it that way — the result first, the analysis when you
 * want it — and because a verdict you chose to open is one you read.
 */

import { el, fmt, mount } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { moduleMeta } from '../data/curriculum.js';
import { reportsOf, rankedSkills, strongestAndWeakest } from '../state/sessionReport.js';
import { ownsLesson, COMPANIONS } from '../state/economy.js';
import { silasSays } from './place.js';
import { buyControl, pearls } from './shop.js';

const when = (at) => new Date(at).toLocaleString(undefined, {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export function renderReport(ctx) {
  const { profile, go, params } = ctx;
  const reports = reportsOf(profile);
  if (!reports.length) {
    return el('div.screen.report',
      el('div.panel.page.paper',
        el('h2', t('No notes yet')),
        el('p.muted', t('Sit down at a table and play a few hands. When you get up, Silas\'s notes on the session are waiting here.')),
        el('button.btn.primary', { onclick: () => go('play') }, t('Play for pearls')),
      ),
    );
  }
  const index = params.i != null && reports[Number(params.i)] ? Number(params.i) : reports.length - 1;
  const report = reports[index];
  const notesHost = el('div.notes-host');
  const opened = params.open === '1';

  const openNotes = () => {
    mount(notesHost, notes(report, profile, go));
    notesHost.classList.add('open');
  };

  const root = el('div.screen.report',
    el('div.panel.book-bar.report-head',
      el('div.spread',
        el('div.row',
          el('span.module-glyph', icon(report.place.kind === 'stop' ? 'river' : 'cards', { size: 20 })),
          el('div',
            el('div.book-title', t(report.place.name)),
            el('div.faint', `${when(report.at)} · ${t('{n} hands', { n: report.hands })}`),
          ),
        ),
        el('div.report-result',
          el('span.faint', t('Result')),
          el(`span.report-bb.${report.profitBb >= 0 ? 'up' : 'down'}`, fmt.bb(report.profitBb)),
        ),
      ),
    ),

    /* ---- what the purse took home ---- */
    el('div.panel.page.paper.report-pearls',
      el('div.report-pearl-total',
        pearls(report.pearls.total, { className: 'big' }),
        el('span', t('earned at this table')),
      ),
      el('div.report-pearl-parts',
        part(t('Hands played'), report.pearls.hands),
        part(t('Sound decisions'), report.pearls.decisions),
        report.pearls.bonus ? part(t('Taking the table'), report.pearls.bonus) : null,
        report.pearls.bounty ? part(t('Bounties'), report.pearls.bounty) : null,
        report.pearls.catches ? part(t('The Catch Book'), report.pearls.catches) : null,
        report.pearls.boat ? part(t('Your boat\'s strongbox'), report.pearls.boat) : null,
      ),
      el('div.faint', t('A pearl for every hand you played through, one more for every sound decision you made without asking.')),
    ),

    /* ---- the notes, folded ---- */
    notesHost,
    opened
      ? null
      : el('button.notes-envelope', {
        onclick: (e) => { e.currentTarget.remove(); openNotes(); },
      },
        el('span.envelope-seal', icon('notes', { size: 22 })),
        el('span.envelope-text',
          el('span.envelope-title', t('Silas\'s notes on this session')),
          el('span.envelope-sub', report.decisions.total
            ? t('{n} decisions looked at. Open them when you are ready.', { n: report.decisions.total })
            : t('Nothing to judge this time — you did not act in any hand.')),
        ),
        icon('arrowRight', { size: 18, className: 'door-arrow' }),
      ),

    el('div.row.report-foot',
      el('button.btn.primary', { onclick: () => go(report.place.kind === 'stop' ? 'home' : 'play') },
        report.place.kind === 'stop' ? t('Back to the river') : t('Play again')),
      el('button.btn.ghost', { onclick: () => go('store') }, t('The Trading Post')),
      reports.length > 1 ? earlierList(reports, index, go) : null,
    ),
  );
  if (opened) openNotes();
  return root;
}

function part(label, n) {
  return el('span.report-part', el('span.faint', label), pearls(n));
}

/** The analysis, as Silas writes it. */
/**
 * Silas on the table that was chosen. The same hands win more where the
 * players call too much, and which table that was is something the lobby
 * showed in numbers; saying how the choice ranked is how it is learned.
 */
function choiceLine({ rank, of, best }) {
  if (best) return t('You sat at the softest of the {n} tables. That is worth more than any one hand you played.', { n: of });
  if (rank === of) return t('You sat at the toughest of the {n} tables. Same hands, same skill, and a thinner game: look at how many players see the flop before you sit down.', { n: of });
  return t('You sat at the second softest of the {n} tables. Look for the one where more players see the flop and fewer raise.', { n: of });
}

function notes(report, profile, go) {
  const { total, sound, helped } = report.decisions;
  const share = total ? sound / total : 0;
  const line = !total ? t('You did not make a decision I could grade. Sit in a few pots next time.')
    : total < 5 ? t('Only {total} decisions to go on — too few to say much. Sit longer next time and I can tell you more.', { total })
    : share >= 0.85 ? t('Clean play. {sound} of {total} decisions were sound — that is how a table gets taken.', { sound, total })
      : share >= 0.65 ? t('Mostly sound: {sound} of {total}. The leaks below are where the rest went.', { sound, total })
        : t('{sound} of {total} decisions were sound. There is work here — start with the weakest skill below.', { sound, total });
  const { strongest, weakest } = strongestAndWeakest(report);
  const rows = rankedSkills(report);
  const allRows = Object.entries(report.decisions.bySkill)
    .map(([skill, s]) => ({ skill, ...s, share: s.right / s.total }))
    .sort((a, b) => a.share - b.share);

  return el('div.panel.page.paper.notes',
    el('div.page-kicker', t('Silas\'s notes')),
    silasSays(line, { typed: false, size: 56 }),

    report.choice ? el('p.notes-choice', icon('chip', { size: 15 }), ' ', choiceLine(report.choice)) : null,

    strongest || weakest
      ? el('div.notes-pair',
        strongest ? skillCard('strong', strongest, profile, go) : null,
        weakest ? skillCard('weak', weakest, profile, go) : null,
      )
      : null,

    allRows.length
      ? el('div.notes-section',
        el('h3', icon('target', { size: 18 }), t('Every skill you were tested on')),
        el('div.notes-skills', allRows.map((r) => {
          const meta = moduleMeta(r.skill);
          return el('div.notes-skill',
            el('span.notes-skill-name', meta ? icon(meta.icon, { size: 15 }) : null, ' ', meta ? t(meta.name) : r.skill),
            el('span.notes-bar', el(`span.${r.share >= 0.75 ? 'good' : r.share >= 0.5 ? 'mid' : 'bad'}`, { style: { width: `${Math.round(r.share * 100)}%` } })),
            el('span.notes-count', `${r.right}/${r.total}`),
          );
        })),
        rows.length < allRows.length
          ? el('div.faint', t('One decision is not enough to call a skill strong or weak, so those are listed but not judged.'))
          : null,
      )
      : null,

    report.worst.length
      ? el('div.notes-section',
        el('h3', icon('warn', { size: 18 }), t('What cost you most')),
        el('div.stack-sm', report.worst.map((w) => {
          const meta = moduleMeta(w.skill);
          return el('div.notes-mistake',
            el('div',
              el('div.notes-mistake-head', t(w.head)),
              el('div.faint', [meta ? t(meta.name) : w.skill, t(w.street),
                w.costBb ? t('about {n}bb', { n: w.costBb.toFixed(1) }) : t('a range mistake — it costs over many hands')].join(' · ')),
            ),
            w.handId ? el('button.btn.sm.ghost', { onclick: () => go('review', { hand: w.handId }) }, t('Replay')) : null,
          );
        })),
      )
      : null,

    report.style
      ? el('div.notes-section',
        el('h3', icon('charts', { size: 18 }), t('How you played, by the numbers')),
        el('div.notes-style',
          styleTile('VPIP', fmt.pct(report.style.vpip), t('hands you paid to play')),
          styleTile('PFR', fmt.pct(report.style.pfr), t('hands you raised before the flop')),
          styleTile(t('Aggression'), report.style.af == null ? '—' : report.style.af.toFixed(1), t('bets and raises per call')),
        ),
      )
      : el('div.faint.notes-section', t('Play {n} hands in one sitting and the notes will read your style as well.', { n: 30 })),

    report.leaks.length
      ? el('div.notes-section',
        el('h3', icon('cold', { size: 18 }), t('Leaks')),
        el('ul.lesson-points', report.leaks.map((l) => el('li', el('span', el('strong', t(l.title)), ' — ', t(l.fix))))),
      )
      : null,

    helped
      ? el('div.faint.notes-section', helped === 1
        ? t('One decision was made with help. It is not counted above and earned no pearl — which is only fair.')
        : t('{n} decisions were made with help. They are not counted above and earned no pearls — which is only fair.', { n: helped }))
      : null,
  );
}

/**
 * The strongest or weakest skill, with what to do about it: the chapter if
 * you own it, the shelf if you do not, and the companion who helps with it
 * when there is one and you have earned the right to buy it.
 */
function skillCard(tone, row, profile, go) {
  const meta = moduleMeta(row.skill);
  const name = meta ? t(meta.name) : row.skill;
  const owned = meta ? ownsLesson(profile, row.skill) : false;
  const companion = COMPANIONS.find((c) => c.needs && c.needs.lesson === row.skill);
  return el(`div.notes-card.${tone}`,
    el('div.notes-card-kicker', tone === 'strong' ? t('Held up best') : t('Leaked most')),
    el('div.notes-card-name', meta ? icon(meta.icon, { size: 18 }) : null, ' ', name),
    el('div.faint', t('{right} of {total} sound', { right: row.right, total: row.total })),
    tone === 'weak' && meta
      ? el('div.notes-card-do',
        owned
          ? el('button.btn.sm.primary', { onclick: () => go('learn', { module: row.skill }) }, t('Study {module}', { module: name }))
          : buyControl(profile, `lesson:${row.skill}`, { go, onBought: () => go('learn', { module: row.skill }) }),
        companion && !profile.owns(`pet:${companion.key}`) && profile.hasCompletedWalkthrough(row.skill)
          ? el('div.faint', t('{name} the {kind} helps with exactly this, at the Trading Post.', { name: companion.name, kind: t(companion.kind).toLowerCase() }))
          : null,
      )
      : null,
  );
}

function styleTile(label, value, sub) {
  return el('div.stat', el('div.label', label), el('div.value', value), el('div.sub', sub));
}

/** The other sittings, newest first, for comparing one with the last. */
function earlierList(reports, current, go) {
  const select = el('select.report-pick', {
    onchange: (e) => go('report', { i: e.target.value, open: '1' }),
    'aria-label': t('Earlier sessions'),
  },
    reports.map((r, i) => ({ r, i })).reverse().map(({ r, i }) => el('option', {
      value: String(i), selected: i === current ? 'selected' : null,
    }, `${when(r.at)} — ${t(r.place.name)}`)),
  );
  return el('label.report-pick-wrap', el('span.faint', t('Earlier sessions')), select);
}

