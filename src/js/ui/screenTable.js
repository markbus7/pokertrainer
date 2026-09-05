/**
 * The table. Play real hands against the bots while a coach checks every
 * decision you make against the actual equity and the price you were offered.
 */

import { el, mount, toast, fmt } from './dom.js';
import { t } from '../i18n/index.js';
import { renderFelt } from './feltView.js';
import { createTable, STREETS } from '../engine/table.js';
import { botAction, getProfile, pickOpponents } from '../engine/bots.js';
import { VARIANTS, VARIANT_KEYS } from '../engine/variants.js';
import { equityVsField, outsToImprove } from '../core/equity.js';
import { requiredEquity, potOddsRatio, spr } from '../core/odds.js';
import { evaluateHand, describeScore, categoryOf, CAT } from '../core/evaluator.js';
import { judgeSpot } from '../core/coach.js';
import { conceptOf } from '../core/spotConcept.js';
import { moduleMeta } from '../data/curriculum.js';
import { review } from '../state/spacing.js';
import { SessionStats, leakReport, stakeFor, bankrollAdvice } from '../state/stats.js';
import { HandRecorder, keepHand } from '../state/handHistory.js';
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
      el('p.muted', t('A {stake} buy-in costs {cost} and you have {have}.',
        { stake: stake.name, cost: fmt.money(stake.buyIn), have: fmt.money(profile.data.bankroll) })),
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
    recorder: null,
    savedHand: null,
    // Who took the lead on each street, so a flop decision knows whether it
    // is a continuation bet. The engine's lastAggressor is reset per street,
    // and "were you the preflop raiser" is a question about the street before.
    aggressor: {},
    opener: null,
    learned: [],
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
    session.recorder = new HandRecorder(table, HERO_ID, {
      source: grind ? 'grind' : 'play',
      stake: grind ? stake.key : null,
    });
    session.handStarted = true;
    session.verdict = null;
    session.snapshot = null;
    session.savedHand = null;
    session.aggressor = {};
    session.opener = null;
    session.learned = [];
    log(t('— Hand #{n} —', { n: table.handNumber }), true);
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
      const label = describeAction(action, table, actor, actor.name);
      if (action.type === 'bet' || action.type === 'raise') {
        session.aggressor[table.street] = actor.id;
        if (table.street === 'preflop' && !session.opener) session.opener = actor.position;
      }
      session.recorder.act(table, action);
      log(label);
      draw();
      step();
    }, BOT_DELAY);
    return null;
  }

  /**
   * What the coach knows at the moment it becomes your turn.
   *
   * This carries the whole spot rather than just the price, because the price
   * is only the right question in some of them. The seat, the board and what
   * you are holding are what say which skill the decision is really about.
   */
  function takeSnapshot() {
    const live = table.contestants.filter((p) => !p.isHero).length;
    const toCall = Math.max(0, table.currentBet - hero.committed);
    const pot = table.totalPot;
    const equity = equityVsField(hero.hole, table.board, Math.max(1, live), table.variant, rng, 900);
    const previous = STREETS[Math.max(0, STREETS.indexOf(table.street) - 1)];
    return {
      equity,
      toCall,
      pot,
      needed: toCall > 0 ? requiredEquity(toCall, pot) : 0,
      opponents: live,
      spr: spr(table.effectiveStack(hero), pot),
      street: table.street,
      // Everything the coach needs to name the skill this spot is asking.
      hole: hero.hole.slice(),
      board: table.board.slice(),
      position: hero.position,
      bigBlind: table.bigBlind,
      effectiveStack: table.effectiveStack(hero),
      currentBet: table.currentBet,
      // First in means nobody has voluntarily put money in yet — not merely
      // that nobody has raised. A limper leaves currentBet at the big blind,
      // and treating that as first in would ask the opening chart about a
      // seat it has no opinion on.
      firstIn: table.street === 'preflop' && !table.history.some((h) => h.street === 'preflop'
        && (h.type === 'call' || h.type === 'bet' || h.type === 'raise')),
      raiser: session.opener,
      wasAggressor: session.aggressor[previous] === HERO_ID,
      madeCategory: table.board.length
        ? categoryOf(evaluateHand(hero.hole, table.board, table.variant))
        : CAT.HIGH_CARD,
      outs: table.board.length >= 3 ? outsToImprove(hero.hole, table.board, table.variant) : 0,
    };
  }

  /**
   * One decision, recorded against the skill it exercised.
   *
   * Playing used to feed nothing: a hand was worth a few XP and counted
   * toward no skill, so the ladder could only be climbed by answering
   * multiple-choice questions. A decision at a table is better evidence than
   * a drill answer — nobody told you which skill it was — so it counts the
   * same way, under the name the coach gave it.
   */
  function recordLearning(verdict) {
    const id = verdict.concept.id;
    const right = verdict.level !== 'bad';
    profile.recordDrill(id, right);
    review(profile, id, right);
    const meta = moduleMeta(id);
    session.learned.push({ id, name: meta ? meta.name : id, right });
    // Getting it right at a table is worth more than getting it right in a
    // drill, and getting it wrong still teaches — so it is never zero.
    profile.addXp(right ? 12 : 4);
  }

  function heroAct(action) {
    if (session.cancelled || table.handOver || !table.actor || !table.actor.isHero) return;
    const snap = session.snapshot || takeSnapshot();
    const verdict = judgeSpot({ ...snap, action: action.type, amount: action.amount });
    session.verdict = verdict;
    recordLearning(verdict);
    if (action.type === 'bet' || action.type === 'raise') session.aggressor[table.street] = HERO_ID;
    stats.recordDecision({ kind: action.type, verdict: verdict.level, street: table.street });
    stats.recordAction(table.street, action.type, { facingRaise: snap.toCall > table.bigBlind });
    if (table.street !== 'preflop') stats.markStreet(table.street);

    const label = describeAction(action, table, hero, null);
    session.recorder.act(table, action, snap);
    log(label);
    draw();
    step();
  }

  function endHand() {
    const result = table.result;
    if (!result || !session.handStarted) return;
    session.handStarted = false;
    // Kept only if there is something to learn from it — a mistake, or a big
    // loss that was nobody's fault. keepHand decides; see state/handHistory.
    session.savedHand = keepHand(session.recorder.finish(table));

    const net = result.net[HERO_ID] || 0;
    const showdown = result.reason === 'showdown';
    const won = (result.payouts[HERO_ID] || 0) > 0;
    stats.markStreet(table.street);
    stats.endHand({ net, showdown, won, potSize: result.pots.reduce((s, p) => s + p.amount, 0) });

    if (showdown) {
      for (const s of result.showdown) {
        const hand = describeScore(s.score, table.variant.shortDeck);
        log(s.id === HERO_ID
          ? t('You show {hand}', { hand })
          : t('{name} shows {hand}', { name: s.name, hand }));
      }
    }
    const winners = Object.entries(result.payouts).filter(([, v]) => v > 0)
      .map(([id]) => table.player(id).name);
    const potTotal = result.pots.reduce((s, p) => s + p.amount, 0);
    log(winners.length > 1
      ? t('{names} split the {pot} pot', { names: winners.join(` ${t('and')} `), pot: fmt.chips(potTotal) })
      : winners[0] === 'You'
        ? t('You take the {pot} pot', { pot: fmt.chips(potTotal) })
        : t('{name} takes the {pot} pot', { name: winners[0], pot: fmt.chips(potTotal) }), true);

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
        title: t('Cashed out {money}', { money: fmt.money(cashOut) }),
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
            el('p.muted', t('You lost that buy-in. Bankroll: {money}.',
              { money: fmt.money(profile.data.bankroll) })),
            el('div.row',
              profile.data.bankroll >= stake.buyIn
                ? el('button.btn.primary', {
                    onclick: () => {
                      profile.setBankroll(profile.data.bankroll - stake.buyIn);
                      hero.stack = startingStack;
                      session.buyInsUsed++;
                      startHand();
                    },
                  }, t('Rebuy {money}', { money: fmt.money(stake.buyIn) }))
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
    mount(feltHost, renderFelt({
      players: table.players.map((p) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        position: p.position,
        stack: p.stack,
        committed: p.committed,
        folded: p.folded,
        sittingOut: p.sittingOut,
        lastAction: p.lastAction,
        hole: p.hole,
        isHero: p.isHero,
        emoji: !p.isHero && p.profile ? getProfile(p.profile).emoji : null,
        wonPot: table.handOver && p.wonThisHand > 0,
      })),
      heroSeat: hero.seat,
      seatCount: table.players.length,
      button: table.button,
      board: table.board,
      pot: table.handOver && table.result
        ? table.result.pots.reduce((sum, p) => sum + p.amount, 0)
        : table.totalPot,
      street: table.handOver ? 'showdown' : table.street,
      actingId: table.actor && !table.handOver ? table.actor.id : null,
      reveal: table.handOver && !!table.result && table.result.reason === 'showdown',
      fourColour: profile.settings.fourColour,
      potLabel: table.handOver ? 'final pot' : 'pot',
    }));
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
                // Straight from the hand you just misplayed into the replay of
                // it: this is the moment the spot is still in your head.
                session.savedHand
                  ? el('button.btn.lg.ghost', {
                      onclick: () => go('review', { hand: session.savedHand.id }),
                    }, 'Review this hand')
                  : null,
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
              t('Call {amount}', { amount: fmt.chips(callSpec.amount) }))
          : null,
        raiseSpec
          ? el('button.btn.primary', {
              onclick: () => heroAct({ type: raiseSpec.type, amount: session.raiseAmount }),
            }, raiseSpec.type === 'bet'
              ? t('Bet {amount}', { amount: fmt.chips(session.raiseAmount) })
              : t('Raise to {amount}', { amount: fmt.chips(session.raiseAmount) }))
          : null,
      ),
    ));
    return null;
  }

  function drawCoach() {
    const snap = session.snapshot;
    const summary = stats.summary();
    const isHeroTurn = table.actor && table.actor.isHero && !table.handOver;

    // Naming the skill before you act is the whole point of playing to learn:
    // at a table nobody tells you which chapter the spot belongs to, and
    // working that out is most of the job. It says what kind of question this
    // is, never what the answer is.
    const spot = isHeroTurn && snap ? conceptOf(snap) : null;
    const spotMeta = spot ? moduleMeta(spot.id) : null;

    mount(coachHost,
      el('h3', '🧭 Coach'),
      spot
        ? el('div.spot-tag',
            el('span.spot-icon', spotMeta ? spotMeta.icon : '🎯'),
            el('div',
              el('div.spot-name', spotMeta ? t(spotMeta.name) : spot.id),
              el('div.spot-why', t(spot.why)),
            ),
          )
        : null,
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
            el('div', t(session.verdict.body, session.verdict.params)),
            session.verdict.better
              ? el('div.verdict-better', t('Instead:'), ' ', t(session.verdict.better, session.verdict.params))
              : null,
            // Straight from the mistake into the chapter that explains it —
            // the moment you want the theory is the moment it cost you.
            session.verdict.level === 'bad' && moduleMeta(session.verdict.concept.id)
              ? el('button.btn.sm.ghost.block', { style: { marginTop: '10px' },
                onclick: () => go('walkthrough', { module: session.verdict.concept.id }) },
              t('Teach me {skill}', { skill: t(moduleMeta(session.verdict.concept.id).name) }))
              : null,
          )
        : null,

      session.learned.length
        ? el('div', { style: { marginTop: '16px' } },
            el('h3', t('🎓 What this hand asked you')),
            el('div.stack-sm', session.learned.map((entry) => el('div.learned-row',
              el(`span.${entry.right ? 'right' : 'wrong'}`, entry.right ? '✓' : '✗'),
              el('span', t(entry.name)),
            ))))
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

/* ---------------- helpers ---------------- */

/**
 * One line of the hand log. `name` is null for the hero, which takes the
 * second person: gluing a name onto a third-person verb produced "You calls
 * 108" for as long as this log has existed.
 */
function describeAction(action, table, player, name) {
  const you = name === null;
  const amount = fmt.chips(Math.min(table.currentBet - player.committed, player.stack));
  switch (action.type) {
    case 'fold': return you ? t('You fold') : t('{name} folds', { name });
    case 'check': return you ? t('You check') : t('{name} checks', { name });
    case 'call': return you
      ? t('You call {amount}', { amount })
      : t('{name} calls {amount}', { name, amount });
    case 'bet': return you
      ? t('You bet {amount}', { amount: fmt.chips(action.amount) })
      : t('{name} bets {amount}', { name, amount: fmt.chips(action.amount) });
    case 'raise': return you
      ? t('You raise to {amount}', { amount: fmt.chips(action.amount) })
      : t('{name} raises to {amount}', { name, amount: fmt.chips(action.amount) });
    default: return action.type;
  }
}

function resultHeadline(result, table) {
  const winners = Object.entries(result.payouts).filter(([, v]) => v > 0).map(([id]) => table.player(id));
  if (winners.some((w) => w.isHero)) {
    const show = result.showdown.find((s) => s.id === HERO_ID);
    return show
      ? t('You win with {hand}', { hand: describeScore(show.score, table.variant.shortDeck) })
      : t('You win the pot');
  }
  const names = winners.map((w) => w.name).join(' and ');
  const theirs = result.showdown.find((s) => winners.some((w) => w.id === s.id));
  return theirs
    ? t('{names} wins with {hand}',
      { names, hand: describeScore(theirs.score, table.variant.shortDeck) })
    : t('{names} wins the pot', { names });
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
