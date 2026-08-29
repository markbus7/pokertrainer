/**
 * The table. Play real hands against the bots while a coach checks every
 * decision you make against the actual equity and the price you were offered.
 */

import { el, mount, toast, fmt } from './dom.js';
import { cardEl, cardRow, hiddenCards } from './cardView.js';
import { createTable } from '../engine/table.js';
import { botAction, getProfile, pickOpponents } from '../engine/bots.js';
import { VARIANTS, VARIANT_KEYS } from '../engine/variants.js';
import { equityVsField } from '../core/equity.js';
import { requiredEquity, potOddsRatio, spr, breakEvenBluffFrequency } from '../core/odds.js';
import { evaluateHand, describeScore, categoryOf, CAT } from '../core/evaluator.js';
import { SessionStats, leakReport, stakeFor, bankrollAdvice } from '../state/stats.js';
import { checkAchievements } from '../state/achievements.js';

const BOT_DELAY = 620;
const HERO_ID = 'hero';

export function renderTable(ctx, params = {}) {
  const grind = params.mode === 'grind';
  const { profile, rng, go } = ctx;
  const variantKey = params.variant && VARIANTS[params.variant] ? params.variant : 'holdem';
  const stake = stakeFor(profile.data.stakeKey);

  const bigBlind = 2;
  const startingStack = bigBlind * 100;
  const buyInCost = grind ? stake.buyIn : 0;

  if (grind && profile.data.bankroll < buyInCost) {
    return el('div.screen', el('div.panel',
      el('h1', 'Not enough bankroll'),
      el('p.muted', `A ${stake.name} buy-in costs ${fmt.money(stake.buyIn)} and you have ${fmt.money(profile.data.bankroll)}.`),
      el('button.btn.primary', { onclick: () => go('grind') }, 'Choose a lower stake'),
    ));
  }

  const opponents = pickOpponents(5, rng);
  const table = createTable({
    variant: variantKey,
    smallBlind: bigBlind / 2,
    bigBlind,
    rng,
    players: [
      { id: HERO_ID, name: 'You', stack: startingStack, isHero: true },
      ...opponents.map((key, i) => {
        const p = getProfile(key);
        return { id: `bot${i}`, name: p.name, stack: startingStack, profile: key };
      }),
    ],
  });

  const stats = new SessionStats();
  stats.bigBlind = bigBlind;

  const session = {
    cancelled: false,
    timer: null,
    snapshot: null,
    verdict: null,
    raiseAmount: 0,
    handStarted: false,
    buyInsUsed: grind ? 1 : 0,
    logLines: [],
  };
  if (grind) profile.setBankroll(profile.data.bankroll - buyInCost);

  const hero = table.player(HERO_ID);
  const feltHost = el('div');
  const actionHost = el('div');
  const coachHost = el('div.coach');
  const root = el('div.screen',
    el('div.spread', { style: { marginBottom: '14px' } },
      el('div.row',
        el('h1', { style: { margin: 0 } }, grind ? `${stake.name} — Bankroll Challenge` : VARIANTS[variantKey].name),
        el('span.badge.gold', VARIANTS[variantKey].short),
      ),
      el('div.row',
        !grind ? variantSwitcher(variantKey, go) : null,
        el('button.btn.sm.ghost', { onclick: () => leave() }, grind ? 'Cash out' : 'Leave table'),
      ),
    ),
    el('div.table-wrap.with-coach', el('div', feltHost, actionHost), coachHost),
  );

  ctx.onLeave = () => { session.cancelled = true; clearTimeout(session.timer); };

  /* ---------------- flow ---------------- */

  function log(line, isStreet = false) {
    session.logLines.push({ line, isStreet });
    if (session.logLines.length > 120) session.logLines.shift();
  }

  function startHand() {
    if (session.cancelled) return;
    if (hero.stack <= 0) { draw(); return null; }
    if (table.players.filter((p) => p.stack > 0).length < 2) return topUpBots();

    table.startHand();
    stats.startHand();
    session.handStarted = true;
    session.verdict = null;
    session.snapshot = null;
    log(`— Hand #${table.handNumber} —`, true);
    draw();
    step();
    return null;
  }

  function topUpBots() {
    for (const p of table.players) {
      if (!p.isHero && p.stack < table.bigBlind * 20) p.stack = startingStack;
    }
    return startHand();
  }

  function step() {
    if (session.cancelled) return;
    if (table.handOver) return endHand();

    const actor = table.actor;
    if (!actor) return endHand();

    if (actor.isHero) {
      session.snapshot = takeSnapshot();
      draw();
      return null;
    }

    session.timer = setTimeout(() => {
      if (session.cancelled || table.handOver) return;
      const action = botAction(table, actor, rng);
      const label = describeAction(action, table, actor);
      table.act(action);
      log(`${actor.name} ${label}`);
      draw();
      step();
    }, BOT_DELAY);
    return null;
  }

  /** What the coach knows at the moment it becomes your turn. */
  function takeSnapshot() {
    const live = table.contestants.filter((p) => !p.isHero).length;
    const toCall = Math.max(0, table.currentBet - hero.committed);
    const pot = table.totalPot;
    const equity = equityVsField(hero.hole, table.board, Math.max(1, live), table.variant, rng, 900);
    return {
      equity,
      toCall,
      pot,
      needed: toCall > 0 ? requiredEquity(toCall, pot) : 0,
      opponents: live,
      spr: spr(table.effectiveStack(hero), pot),
      street: table.street,
    };
  }

  function heroAct(action) {
    if (session.cancelled || table.handOver || !table.actor || !table.actor.isHero) return;
    const snap = session.snapshot || takeSnapshot();
    const verdict = judge(action, snap, table);
    session.verdict = verdict;
    stats.recordDecision({ kind: action.type, verdict: verdict.level, street: table.street });
    stats.recordAction(table.street, action.type, { facingRaise: snap.toCall > table.bigBlind });
    if (table.street !== 'preflop') stats.markStreet(table.street);

    const label = describeAction(action, table, hero);
    table.act(action);
    log(`You ${label}`);
    draw();
    step();
  }

  function endHand() {
    const result = table.result;
    if (!result || !session.handStarted) return;
    session.handStarted = false;

    const net = result.net[HERO_ID] || 0;
    const showdown = result.reason === 'showdown';
    const won = (result.payouts[HERO_ID] || 0) > 0;
    stats.markStreet(table.street);
    stats.endHand({ net, showdown, won, potSize: result.pots.reduce((s, p) => s + p.amount, 0) });

    if (showdown) {
      for (const s of result.showdown) {
        log(`${s.name}${s.id === HERO_ID ? ' show' : ' shows'} ${describeScore(s.score, table.variant.shortDeck)}`);
      }
    }
    const winners = Object.entries(result.payouts).filter(([, v]) => v > 0)
      .map(([id]) => table.player(id).name);
    const potTotal = result.pots.reduce((s, p) => s + p.amount, 0);
    const verb = winners.length > 1 ? 'split' : winners[0] === 'You' ? 'take' : 'takes';
    log(`${winners.join(' and ')} ${verb} the ${fmt.chips(potTotal)} pot`, true);

    profile.data.handsPlayed++;
    profile.save();

    const heroShow = result.showdown.find((s) => s.id === HERO_ID);
    const events = {
      type: 'hand',
      doubledUp: hero.stack >= startingStack * 2,
      bustedOpponent: table.players.some((p) => !p.isHero && p.stack === 0),
      madeRoyal: heroShow && categoryOf(heroShow.score) === CAT.STRAIGHT_FLUSH && (heroShow.score & 0xf0000) >> 16 === 14,
      madeQuads: heroShow && categoryOf(heroShow.score) === CAT.QUADS,
      heroCall: won && showdown && session.verdict && session.verdict.kind === 'call',
    };
    checkAchievements(profile, events).forEach((a) => toast({ icon: a.icon, title: a.name, desc: a.description }));

    // Small XP for playing hands: volume is part of the job.
    profile.addXp(net > 0 ? 6 : 3);
    draw();
  }

  function leave() {
    session.cancelled = true;
    clearTimeout(session.timer);
    if (grind) {
      const cashOut = (hero.stack / (bigBlind * 100)) * stake.buyIn;
      profile.setBankroll(profile.data.bankroll + cashOut);
      profile.recordSession({
        hands: stats.hands,
        profitBb: stats.profitBb,
        stake: stake.key,
        endedAt: Date.now(),
      });
      const advice = bankrollAdvice(profile.data.bankroll, stake.key);
      toast({
        icon: stats.profitBb >= 0 ? '📈' : '📉',
        title: `Cashed out ${fmt.money(cashOut)}`,
        desc: `${stats.hands} hands, ${fmt.bb(stats.profitBb)}. ${advice.message}`,
      });
    } else if (stats.hands) {
      profile.recordSession({ hands: stats.hands, profitBb: stats.profitBb, stake: 'practice', endedAt: Date.now() });
    }
    go(grind ? 'grind' : 'home');
  }

  /** Mounts the rebuy panel only. Never calls draw(): drawActions routes here. */
  function drawBust() {
    return mount(actionHost, el('div.action-bar',
      el('h3', 'You are out of chips'),
      grind
        ? el('div.stack-sm',
            el('p.muted', `You lost that buy-in. Bankroll: ${fmt.money(profile.data.bankroll)}.`),
            el('div.row',
              profile.data.bankroll >= stake.buyIn
                ? el('button.btn.primary', {
                    onclick: () => {
                      profile.setBankroll(profile.data.bankroll - stake.buyIn);
                      hero.stack = startingStack;
                      session.buyInsUsed++;
                      startHand();
                    },
                  }, `Rebuy ${fmt.money(stake.buyIn)}`)
                : el('div.notice.warn', 'Your bankroll cannot cover another buy-in at this stake. Move down.'),
              el('button.btn.ghost', { onclick: leave }, 'Leave'),
            ),
          )
        : el('div.row',
            el('button.btn.primary', { onclick: () => { hero.stack = startingStack; startHand(); } }, 'Top up and keep playing'),
            el('button.btn.ghost', { onclick: leave }, 'Leave table'),
          ),
    ));
  }

  /* ---------------- rendering ---------------- */

  function draw() {
    drawFelt();
    drawActions();
    drawCoach();
  }

  function drawFelt() {
    const heroSeat = hero.seat;
    const count = table.players.length;
    const seats = table.players.map((p) => {
      const slot = (p.seat - heroSeat + count) % count;
      const isActing = table.actor === p && !table.handOver;
      const wonPot = table.handOver && p.wonThisHand > 0;
      const showCards = p.isHero || (table.handOver && !p.folded && table.result && table.result.reason === 'showdown');

      return el(`div.seat${p.isHero ? '.hero' : ''}${p.folded ? '.folded' : ''}${isActing ? '.acting' : ''}${wonPot ? '.winner' : ''}`,
        { dataset: { slot: String(slot) } },
        p.lastAction ? el(`div.seat-action.${actionTone(p.lastAction)}`, p.lastAction) : null,
        // A folded seat collapses its card area entirely, so the "Fold" tag
        // stays pinned to the name plate instead of floating in empty space.
        p.folded
          ? null
          : p.hole.length
            ? (showCards
                ? cardRow(p.hole, { size: p.isHero ? 'lg' : '', fourColour: profile.settings.fourColour, dealt: true })
                : hiddenCards(p.hole.length))
            : el('div.seat-cards'),
        el('div.seat-plate',
          el('div.seat-name',
            !p.isHero && p.profile ? el('span', getProfile(p.profile).emoji) : null,
            p.name,
          ),
          el('div.seat-stack', p.sittingOut ? 'sitting out' : fmt.chips(p.stack)),
          el('div.seat-pos', p.position),
        ),
        p.committed > 0 ? el('div.seat-bet', '🪙', fmt.chips(p.committed)) : null,
        p.seat === table.button ? el('div.dealer-button', 'D') : null,
      );
    });

    mount(feltHost, el('div.felt',
      seats,
      el('div.board-area',
        el('div.street-tag', table.handOver ? 'showdown' : table.street),
        el('div.board',
          table.board.length
            ? table.board.map((c) => cardEl(c, { size: 'lg', fourColour: profile.settings.fourColour, dealt: true }))
            : el('span.faint', 'waiting for the flop'),
        ),
        el('div.pot-chip', el('span.label', table.handOver ? 'final pot' : 'pot'),
          fmt.chips(table.handOver && table.result
            ? table.result.pots.reduce((sum, p) => sum + p.amount, 0)
            : table.totalPot)),
      ),
    ));
  }

  function drawActions() {
    if (hero.stack <= 0 && !session.handStarted) return drawBust();

    if (table.handOver || !session.handStarted) {
      const result = table.result;
      return mount(actionHost, el('div.action-bar',
        result
          ? el('div.spread',
              el('div',
                el('div', { style: { fontWeight: '650' } }, resultHeadline(result, table)),
                el('div.faint', `You ${result.net[HERO_ID] >= 0 ? 'won' : 'lost'} ${fmt.chips(Math.abs(result.net[HERO_ID]))} chips this hand.`),
              ),
              el('div.row',
                el('button.btn.primary.lg', { onclick: startHand }, 'Deal next hand'),
              ),
            )
          : el('div.spread',
              el('div.muted', 'Ready when you are.'),
              el('button.btn.primary.lg', { onclick: startHand }, 'Deal me in'),
            ),
      ));
    }

    const actor = table.actor;
    if (!actor || !actor.isHero) {
      return mount(actionHost, el('div.action-bar',
        el('div.muted', actor ? `${actor.name} is thinking…` : 'Dealing…'),
      ));
    }

    const legal = table.legalActions(hero);
    const raiseSpec = legal.find((a) => a.type === 'raise' || a.type === 'bet');
    const callSpec = legal.find((a) => a.type === 'call');
    const pot = table.totalPot;

    if (raiseSpec && (!session.raiseAmount || session.raiseAmount < raiseSpec.min || session.raiseAmount > raiseSpec.max)) {
      session.raiseAmount = Math.min(raiseSpec.max, Math.max(raiseSpec.min, Math.round(pot * 0.66)));
    }

    const amountLabel = el('span.raise-amount', fmt.chips(session.raiseAmount));
    const slider = raiseSpec
      ? el('input', {
          type: 'range',
          min: String(raiseSpec.min),
          max: String(raiseSpec.max),
          value: String(session.raiseAmount),
          step: '1',
          oninput: (e) => {
            session.raiseAmount = Number(e.target.value);
            amountLabel.textContent = fmt.chips(session.raiseAmount);
          },
        })
      : null;

    const setSize = (fraction) => {
      if (!raiseSpec) return;
      const target = fraction === 'allin'
        ? raiseSpec.max
        : Math.round(table.currentBet + pot * fraction);
      session.raiseAmount = Math.min(raiseSpec.max, Math.max(raiseSpec.min, target));
      if (slider) slider.value = String(session.raiseAmount);
      amountLabel.textContent = fmt.chips(session.raiseAmount);
    };

    mount(actionHost, el('div.action-bar',
      raiseSpec
        ? el('div.sizing-row',
            el('button.btn.sm.ghost', { onclick: () => setSize(0.33) }, '⅓ pot'),
            el('button.btn.sm.ghost', { onclick: () => setSize(0.5) }, '½ pot'),
            el('button.btn.sm.ghost', { onclick: () => setSize(0.75) }, '¾ pot'),
            el('button.btn.sm.ghost', { onclick: () => setSize(1) }, 'Pot'),
            el('button.btn.sm.ghost', { onclick: () => setSize('allin') }, 'All-in'),
            slider,
            amountLabel,
          )
        : null,
      el('div.action-buttons',
        legal.some((a) => a.type === 'fold')
          ? el('button.btn.danger', { onclick: () => heroAct({ type: 'fold' }) }, 'Fold')
          : null,
        legal.some((a) => a.type === 'check')
          ? el('button.btn', { onclick: () => heroAct({ type: 'check' }) }, 'Check')
          : null,
        callSpec
          ? el('button.btn.success', { onclick: () => heroAct({ type: 'call' }) },
              `Call ${fmt.chips(callSpec.amount)}`)
          : null,
        raiseSpec
          ? el('button.btn.primary', {
              onclick: () => heroAct({ type: raiseSpec.type, amount: session.raiseAmount }),
            }, `${raiseSpec.type === 'bet' ? 'Bet' : 'Raise to'} ${fmt.chips(session.raiseAmount)}`)
          : null,
      ),
    ));
    return null;
  }

  function drawCoach() {
    const snap = session.snapshot;
    const summary = stats.summary();
    const isHeroTurn = table.actor && table.actor.isHero && !table.handOver;

    mount(coachHost,
      el('h3', '🧭 Coach'),
      isHeroTurn && snap
        ? el('div',
            metric('Your equity', fmt.pct(snap.equity, 1), snap.equity >= snap.needed ? 'good' : 'bad'),
            snap.toCall > 0
              ? metric('Equity needed', fmt.pct(snap.needed, 1))
              : metric('Facing', 'no bet'),
            snap.toCall > 0
              ? metric('Pot odds', `${potOddsRatio(snap.toCall, snap.pot).toFixed(1)} : 1`)
              : null,
            metric('Pot / to call', `${fmt.chips(snap.pot)} / ${fmt.chips(snap.toCall)}`),
            metric('SPR', Number.isFinite(snap.spr) ? snap.spr.toFixed(1) : '∞'),
            metric('Opponents', String(snap.opponents)),
            el('div.faint', { style: { marginTop: '10px' } },
              hero.hole.length && table.board.length
                ? describeScore(evaluateHand(hero.hole, table.board, table.variant), table.variant.shortDeck)
                : 'Preflop'),
          )
        : el('div.faint', table.handOver ? 'Hand complete. Review below, then deal again.' : 'Waiting for your turn…'),

      session.verdict
        ? el(`div.verdict-box.${session.verdict.level}`,
            el('div.head', session.verdict.head),
            el('div', session.verdict.body),
          )
        : null,

      el('h3', { style: { marginTop: '18px' } }, '📊 This session'),
      metric('Hands', String(summary.hands)),
      metric('Result', fmt.bb(summary.profitBb), summary.profitBb >= 0 ? 'good' : 'bad'),
      summary.hands >= 10 ? metric('Win rate', `${summary.winRate.toFixed(1)}bb/100`, summary.winRate >= 0 ? 'good' : 'bad') : null,
      metric('VPIP / PFR', `${fmt.pct(summary.vpip)} / ${fmt.pct(summary.pfr)}`),
      metric('Aggression', summary.af.toFixed(1)),

      el('h3', { style: { marginTop: '18px' } }, '📜 Hand log'),
      el('div.log', session.logLines.slice().reverse().map((l) =>
        el(`div${l.isStreet ? '.street-line' : ''}`, l.line))),

      el('div', { style: { marginTop: '16px' } },
        el('button.btn.sm.ghost.block', { onclick: () => showLeaks() }, 'Show my leaks'),
      ),
    );
  }

  function showLeaks() {
    const report = leakReport(stats);
    if (!report.ready) return toast({ icon: '📋', title: 'Not enough hands yet', desc: report.message });
    if (!report.leaks.length) return toast({ icon: '✅', title: 'No obvious leaks', desc: report.message });
    for (const leak of report.leaks.slice(0, 3)) {
      toast({ icon: '⚠️', title: leak.title, desc: leak.fix, duration: 8000 });
    }
    return null;
  }

  draw();
  return root;
}

/* ---------------- coaching ---------------- */

/**
 * Grade a decision against the equity you actually had and the price you were
 * actually offered. This is the difference between playing and training.
 */
function judge(action, snap, table) {
  const { equity, needed, toCall, pot } = snap;
  const eq = (x) => fmt.pct(x, 1);

  if (action.type === 'fold') {
    if (toCall === 0) {
      return { kind: 'fold', level: 'bad', head: 'Never fold for free', body: 'You could have checked and seen the next card at no cost. Folding here gives up a pot you might still win.' };
    }
    if (equity > needed + 0.08) {
      return { kind: 'fold', level: 'bad', head: 'You folded the best of it', body: `You had ${eq(equity)} equity and only needed ${eq(needed)} to call profitably. That fold cost you about ${(equity * pot - (1 - equity) * toCall).toFixed(1)} chips.` };
    }
    if (equity > needed) {
      return { kind: 'fold', level: 'ok', head: 'Close fold', body: `You had ${eq(equity)} against ${eq(needed)} needed — a thin call. Folding is defensible against an opponent who never bluffs.` };
    }
    return { kind: 'fold', level: 'good', head: 'Good fold', body: `You needed ${eq(needed)} and had ${eq(equity)}. Folding saves money, and the folds are where most of a winning player's edge quietly comes from.` };
  }

  if (action.type === 'check') {
    if (equity > 0.7) {
      return { kind: 'check', level: 'ok', head: 'Missed value', body: `With ${eq(equity)} equity you are well ahead. Betting here gets called by worse hands — that is free money you left behind.` };
    }
    return { kind: 'check', level: 'good', head: 'Fine check', body: `With ${eq(equity)} equity, keeping the pot small is reasonable. Checking also protects the hands you check with on later streets.` };
  }

  if (action.type === 'call') {
    if (equity >= needed + 0.05) {
      return { kind: 'call', level: 'good', head: 'Correct call', body: `You needed ${eq(needed)} and had ${eq(equity)}. This call wins about ${(equity * pot - (1 - equity) * toCall).toFixed(1)} chips on average.` };
    }
    if (equity >= needed - 0.03) {
      return { kind: 'call', level: 'ok', head: 'Marginal call', body: `${eq(equity)} against ${eq(needed)} needed. Close to break-even — the right answer depends on what happens on later streets and on how much they pay you when you hit.` };
    }
    return { kind: 'call', level: 'bad', head: 'Called without the odds', body: `You needed ${eq(needed)} but had only ${eq(equity)}. Over a career, calls like this are the single biggest leak in small-stakes poker.` };
  }

  // bet / raise
  const betSize = Math.max(0, (action.amount || 0) - table.currentBet);
  const foldsNeeded = breakEvenBluffFrequency(betSize || 1, pot);
  if (equity >= 0.65) {
    return { kind: 'bet', level: 'good', head: 'Value bet', body: `${eq(equity)} equity — you are ahead, so betting builds the pot and charges their draws. Size it so worse hands can still call.` };
  }
  if (equity <= 0.35) {
    return { kind: 'bet', level: 'ok', head: 'Bluff', body: `With ${eq(equity)} equity this is a bluff. It needs to work ${fmt.pct(foldsNeeded)} of the time to break even. Against a player who folds too much that is a bargain; against a calling station it is a donation.` };
  }
  return { kind: 'bet', level: 'ok', head: 'Thin bet', body: `${eq(equity)} equity is the awkward middle. Ask the two questions: does a worse hand call, and does a better hand fold? If neither, checking is usually better.` };
}

/* ---------------- helpers ---------------- */

function describeAction(action, table, player) {
  switch (action.type) {
    case 'fold': return 'folds';
    case 'check': return 'checks';
    case 'call': return `calls ${fmt.chips(Math.min(table.currentBet - player.committed, player.stack))}`;
    case 'bet': return `bets ${fmt.chips(action.amount)}`;
    case 'raise': return `raises to ${fmt.chips(action.amount)}`;
    default: return action.type;
  }
}

function actionTone(label) {
  const l = label.toLowerCase();
  if (l.startsWith('fold')) return 'fold';
  if (l.startsWith('raise') || l.startsWith('bet') || l.startsWith('all-in')) return 'aggressive';
  return 'passive';
}

function resultHeadline(result, table) {
  const winners = Object.entries(result.payouts).filter(([, v]) => v > 0).map(([id]) => table.player(id));
  if (winners.some((w) => w.isHero)) {
    const show = result.showdown.find((s) => s.id === HERO_ID);
    return show ? `You win with ${describeScore(show.score, table.variant.shortDeck)}` : 'You win the pot';
  }
  const names = winners.map((w) => w.name).join(' and ');
  const theirs = result.showdown.find((s) => winners.some((w) => w.id === s.id));
  return theirs ? `${names} wins with ${describeScore(theirs.score, table.variant.shortDeck)}` : `${names} wins the pot`;
}

function metric(k, v, tone = '') {
  return el('div.coach-metric', el('span.k', k), el(`span.v${tone ? `.${tone}` : ''}`, v));
}

function variantSwitcher(current, go) {
  return el('div.row',
    VARIANT_KEYS.map((key) => el(`button.btn.sm${key === current ? '.primary' : '.ghost'}`, {
      onclick: () => go('play', { variant: key }),
    }, VARIANTS[key].short)),
  );
}
