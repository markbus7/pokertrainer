/**
 * The table. Play real hands against the bots while a coach checks every
 * decision you make against the actual equity and the price you were offered.
 */

import { el, mount, toast, fmt } from './dom.js';
import { t } from '../i18n/index.js';

/**
 * What a metric says when the sample cannot support a number yet. Reads the
 * same everywhere: a dash, and how much further there is to go.
 */
const shortfall = (have, need) => t('— {n} more hands', { n: need - have });
import { renderFelt } from './feltView.js';
import { createTable, STREETS } from '../engine/table.js';
import { botAction, getProfile, pickOpponents } from '../engine/bots.js';
import { VARIANTS, VARIANT_KEYS } from '../engine/variants.js';
import { equityVsField, outsToImprove } from '../core/equity.js';
import { requiredEquity, potOddsRatio, spr } from '../core/odds.js';
import { evaluateHand, describeScore, shortCategoryName, categoryOf, CAT } from '../core/evaluator.js';
import { judgeSpot } from '../core/coach.js';
import { conceptOf, isUnlocked } from '../core/spotConcept.js';
import { moduleMeta, MODULE_META } from '../data/curriculum.js';
import { lessonTable } from '../data/lessonTables.js';
import { snapshotOf, autopilotAction, playUntilMySpot } from '../core/lessonRunner.js';
import {
  startRun, recordSpot, runComplete, scoreRun, saveRun, watchFor, runHistory, RUN_LENGTH,
} from '../state/lessonRuns.js';
import { review } from '../state/spacing.js';
import { cardsToString } from '../core/cards.js';
import { shuffle } from '../core/rng.js';
import { SessionStats, leakReport, stakeFor, bankrollAdvice, SAMPLE } from '../state/stats.js';
import { HandRecorder, keepHand } from '../state/handHistory.js';
import { checkAchievements } from '../state/achievements.js';

const BOT_DELAY = 620;
/**
 * How many hands a lesson table will deal looking for the reader's own spot.
 * Measured over twelve fresh sessions per lesson, every one finds its spot;
 * the slowest are the flop draw at 57 hands and the river bluff at 52, so
 * this is roughly double the worst case seen.
 */
const MAX_SEARCH = 120;
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

  // A lesson gets a table cut down to it: fewer seats where the seats are
  // not the point, and a hand that ends once its question is answered.
  const lesson = params.lesson ? lessonTable(params.lesson) : null;
  const lessonMeta = params.lesson ? moduleMeta(params.lesson) : null;
  const seats = lesson ? lesson.seats : 6;

  const opponents = pickOpponents(seats - 1, rng);
  const table = createTable({
    variant: variantKey,
    smallBlind: bigBlind / 2,
    bigBlind,
    rng,
    lastStreet: lesson ? lesson.lastStreet : 'river',
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
    // Set when the reader asks the coach to do the sum for them. Reset every
    // decision, so asking once does not silence the coach for the whole hand.
    peeked: false,
    // A lesson is a fixed run of spots with a report at the end, not an
    // endless table: without a last hand there is no moment where anyone
    // says how it went.
    run: lesson ? startRun(params.lesson) : null,
  };
  if (grind) profile.setBankroll(profile.data.bankroll - buyInCost);

  const hero = table.player(HERO_ID);
  const feltHost = el('div');
  const actionHost = el('div');
  const coachHost = el('div.coach');
  const lessonNoteHost = el('div');
  const root = el('div.screen',
    el('div.spread', { style: { marginBottom: '14px' } },
      el('div.row',
        el('h1', { style: { margin: 0 } }, lessonMeta
          ? `${lessonMeta.icon} ${t(lessonMeta.name)}`
          : grind ? `${stake.name} — Bankroll Challenge` : VARIANTS[variantKey].name),
        el('span.badge.gold', lesson ? t('Lesson table') : VARIANTS[variantKey].short),
      ),
      el('div.row',
        !grind && !lesson ? variantSwitcher(variantKey, go) : null,
        lesson
          ? el('button.btn.sm.ghost', { onclick: () => go('walkthrough', { module: params.lesson }) },
            t('Read the lesson'))
          : null,
        el('button.btn.sm.ghost', { onclick: () => leave() }, grind ? 'Cash out' : 'Leave table'),
      ),
    ),
    // What has been taken away, and why. A table with two seats and a hand
    // that stops on the flop is not the game — saying so is the difference
    // between a simplification and a lie.
    lesson ? lessonNoteHost : null,
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
    // A lesson is not a bankroll test. Busting out of one would end the
    // teaching over a variance run, so the seat is simply refilled.
    if (lesson && hero.stack <= 0) hero.stack = startingStack;
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
    session.peeked = false;
    session.savedHand = null;
    session.aggressor = {};
    session.opener = null;
    session.learned = [];
    session.namedThisHand = false;
    log(t('— Hand #{n} —', { n: table.handNumber }), true);
    draw();
    if (lesson && (lesson.concept || lesson.ask)) return searchForMySpot();
    step();
    return null;
  }

  /**
   * Deal until the reader's own spot arrives, without making them watch.
   *
   * Measured over 300 hands per lesson: a continuation-bet spot turns up once
   * in twenty hands and a river bluff once in forty. Animating those at bot
   * speed would be forty seconds of watching poker happen next to you before
   * the lesson asked anything. So the hands that are not yours are played
   * synchronously and silently, and the first one that is yours stops the
   * loop with the felt exactly as it stands.
   */
  /**
   * Record an action the autopilot took for the hero.
   *
   * Tracking who took the lead matters as much here as it does for a bot: a
   * continuation bet is *by definition* a bet by the player who raised before
   * the flop, so an autopilot raise that went unrecorded made the cbet spot
   * unreachable. The lesson dealt hand after hand looking for something it
   * had made impossible.
   */
  function applyHeroAuto(action) {
    if (action.type === 'bet' || action.type === 'raise') {
      session.aggressor[table.street] = HERO_ID;
      if (table.street === 'preflop' && !session.opener) session.opener = hero.position;
    }
    session.recorder.act(table, action);
    log(t('Played for you: {action}', { action: describeAction(action, table, hero, t('You')) }));
  }

  /**
   * Whether this decision belongs to the reader.
   *
   * A lesson that asks you to read your hand has no concept tag to wait for:
   * its moment is the river, five cards down. Folding 54o before the flop is
   * correct poker and useless to a hand-reading lesson, so those decisions
   * are played too — the reader is handed the one spot the lesson is about.
   */
  function isMySpot(snap) {
    if (lesson.ask === 'name-hand') return table.board.length === 5;
    return !lesson.concept || conceptOf(snap).id === lesson.concept;
  }

  function searchForMySpot() {
    for (let dealt = 0; dealt < MAX_SEARCH; dealt++) {
      const { found, snapshot } = playUntilMySpot(table, {
        lesson,
        rng,
        isMine: isMySpot,
        state: session,
        // The recorder performs the action as well as recording it, so it is
        // the one thing allowed to touch the table here.
        apply: (action) => session.recorder.act(table, action),
        onAuto: (action) => log(t('Played for you: {action}',
          { action: describeAction(action, table, hero, t('You')) })),
        onBot: (action, actor) => log(describeAction(action, table, actor, actor.name)),
      });
      if (found) {
        session.snapshot = snapshot;
        session.peeked = false;
        draw();
        return null;
      }
      // This hand had nothing to ask. Settle it and deal another.
      endHand();
      if (session.cancelled) return null;
      if (dealt < MAX_SEARCH - 1) startNextSearchHand();
    }
    draw();
    return null;
  }

  /** The bookkeeping half of startHand, without re-entering the search. */
  function startNextSearchHand() {
    if (lesson && hero.stack <= 0) hero.stack = startingStack;
    if (table.players.filter((p) => p.stack > 0).length < 2) {
      for (const p of table.players) if (!p.isHero) p.stack = startingStack;
    }
    table.startHand();
    stats.startHand();
    session.recorder = new HandRecorder(table, HERO_ID, { source: 'play', stake: null });
    session.handStarted = true;
    session.verdict = null;
    session.snapshot = null;
    session.savedHand = null;
    session.aggressor = {};
    session.opener = null;
    session.learned = [];
    session.namedThisHand = false;
    log(t('— Hand #{n} —', { n: table.handNumber }), true);
  }

  function topUpBots() {
    for (const p of table.players) {
      if (!p.isHero && p.stack < table.bigBlind * 20) p.stack = startingStack;
    }
    return startHand();
  }

  /**
   * Play the hero soundly through a decision this lesson is not about.
   *
   * It uses the same bot that runs a solid regular, so the parts you have not
   * been taught are played correctly rather than randomly — and it says so in
   * the log, because a hand where chips moved without you is a hand you are
   * owed an explanation for.
   */
  function autoplayHero() {
    session.timer = setTimeout(() => {
      if (session.cancelled || table.handOver) return;
      const actor = table.actor;
      if (!actor || !actor.isHero) return;
      applyHeroAuto(autopilotAction(table, actor, lesson, rng));
      draw();
      step();
    }, Math.round(BOT_DELAY / 2));
    return null;
  }

  function step() {
    if (session.cancelled) return;
    if (table.handOver) return endHand();

    const actor = table.actor;
    if (!actor) return endHand();

    if (actor.isHero) {
      session.snapshot = takeSnapshot();

      // In a lesson, the hero is played for them through every decision the
      // lesson has not taught yet, and handed back the moment its own spot
      // arrives. That is what makes this poker rather than a questionnaire:
      // you are never asked about a street you have not reached in the
      // curriculum, and you never sit out the one you have.
      if (lesson && (lesson.concept || lesson.ask) && !isMySpot(session.snapshot)) {
        return autoplayHero();
      }

      // A new decision is a new chance to work it out yourself.
      session.peeked = false;
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
  const takeSnapshot = () => snapshotOf(table, hero, {
    rng, aggressor: session.aggressor, opener: session.opener,
  });


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
    // Only the lesson's own spots count toward the run. A hand where the
    // autopilot handed you a decision that belongs to another module would
    // otherwise be marked against a lesson that never asked it.
    if (session.run && !runComplete(session.run)) {
      recordSpot(session.run, verdict);
      if (runComplete(session.run)) finishRun();
    }
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

  /**
   * The lesson's own header: what it simplified, how far through the run you
   * are, and — the part that makes it a lesson rather than a table — what
   * caught you out last time.
   */
  function drawLessonNote() {
    if (!lesson) return;
    const done = session.run ? session.run.spots.length : 0;
    const right = session.run ? session.run.spots.filter((sp) => sp.level !== 'bad').length : 0;
    const warning = session.runOver ? null : watchFor(profile, params.lesson);
    mount(lessonNoteHost, el('div.panel.lesson-note',
      el('div.spread',
        el('div', t(lesson.simplified)),
        el('span.badge.gold', t('Spot {n} of {total}', { n: Math.min(done + 1, RUN_LENGTH), total: RUN_LENGTH })),
      ),
      lesson.concept
        ? el('div.faint', t('Everything this lesson has not covered is played for you. '
          + 'You act when it is a {skill} decision.', { skill: t(lessonMeta.name) }))
        : null,
      done ? el('div.faint', t('{right} of {done} right so far.', { right, done })) : null,
      warning ? el('div.lesson-warning', warning) : null,
    ));
  }

  function draw() {
    drawLessonNote();
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

  /**
   * "What have you actually got?" asked at the table rather than on a
   * worksheet.
   *
   * Hand Rankings is not a betting decision, so there is no concept tag to
   * wait for — the lesson is reading your own hand, and the moment that
   * matters is the river with five cards down and money still to be decided.
   * The question goes in front of the action buttons: you say what you have,
   * and only then do you get to act on it.
   */
  function nameYourHand() {
    const score = evaluateHand(hero.hole, table.board, table.variant);
    const correct = shortCategoryName(score, table.variant.shortDeck);
    const all = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
      'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
    const options = shuffle(rng, [correct, ...shuffle(rng, all.filter((n) => n !== correct)).slice(0, 3)]);

    const feedback = el('div');
    const buttons = [];
    const pick = (choice) => {
      if (session.namedThisHand) return;
      session.namedThisHand = true;
      const right = choice === correct;
      // Reading your hand is this lesson's spot, so it is what the run marks.
      if (session.run && !runComplete(session.run)) {
        recordSpot(session.run, { id: right ? 'read-right' : 'misread-hand', level: right ? 'good' : 'bad' });
        if (runComplete(session.run)) finishRun();
      }
      profile.recordDrill('hand-rankings', right);
      review(profile, 'hand-rankings', right);
      profile.save();
      for (const b of buttons) {
        b.disabled = true;
        if (b.dataset.key === correct) b.classList.add('correct');
        else if (b.dataset.key === choice) b.classList.add('wrong');
      }
      feedback.appendChild(el(`div.feedback.${right ? 'correct' : 'wrong'}`,
        el('div.verdict', right ? t('✓ Correct') : t('✗ Not quite — you said {said}', { said: t(choice) })),
        el('div', t('{hand} — using {hole} with {board}.', {
          hand: describeScore(score, table.variant.shortDeck),
          hole: cardsToString(hero.hole),
          board: cardsToString(table.board),
        }))));
      setTimeout(() => { if (!session.cancelled) draw(); }, 1600);
    };

    return el('div.action-bar',
      el('div.practice-question', t('What is your best five-card hand?')),
      el('div.practice-options', options.map((label) => {
        const b = el('button.btn.practice-option', {
          dataset: { key: label }, onclick: () => pick(label),
        }, t(label));
        buttons.push(b);
        return b;
      })),
      feedback,
    );
  }

  /**
   * The end of a run: how it went, what to fix, and what will be remembered.
   *
   * This is the difference between a lesson and a table. Ten spots, marked,
   * with each mistake named and given one thing to do about it — and the
   * mistakes filed so the next run can open by warning you about them.
   */
  function drawRunReport() {
    const score = session.runScore;
    const passed = score.right + score.ok >= Math.ceil(score.total * 0.7);
    const history = runHistory(profile, params.lesson);

    return mount(actionHost, el('div.action-bar.run-report',
      el('div.spread',
        el('h3', { style: { margin: 0 } }, passed
          ? t('✓ {right} of {total} — that is a pass', { right: score.right + score.ok, total: score.total })
          : t('{right} of {total} — worth another run', { right: score.right + score.ok, total: score.total })),
        el('span.badge', t('run {n}', { n: history.runs })),
      ),
      score.mistakes.length
        ? el('div.stack-sm', { style: { marginTop: '12px' } },
            el('div.faint', t('What went wrong, most often first:')),
            score.mistakes.map((m) => el('div.run-mistake',
              el('div.run-mistake-head', `${m.count}× ${t(m.label)}`),
              m.fix ? el('div.faint', t(m.fix)) : null,
            )),
            el('div.faint', { style: { marginTop: '8px' } },
              t('Remembered for next time — the next run opens by warning you about it.')))
        : el('div', { style: { marginTop: '10px' } },
            t('No mistakes to name. Play a run of something else, or come back when this one has gone cold.')),
      el('div.row', { style: { marginTop: '14px' } },
        el('button.btn.primary', { onclick: () => startNewRun() }, t('Another {n} spots', { n: RUN_LENGTH })),
        el('button.btn.ghost', { onclick: () => go('walkthrough', { module: params.lesson }) },
          t('Back to the lesson')),
      ),
    ));
  }

  /** File the run and switch the table over to its report. */
  function finishRun() {
    session.runScore = saveRun(profile, session.run);
    session.runOver = true;
  }

  /** Wipe the scorecard and deal again. */
  function startNewRun() {
    session.run = startRun(params.lesson);
    session.runOver = false;
    session.runScore = null;
    startHand();
  }

  function drawActions() {
    if (hero.stack <= 0 && !session.handStarted) return drawBust();
    if (session.runOver) return drawRunReport();

    // Read your hand before you are allowed to bet it.
    if (lesson && lesson.ask === 'name-hand' && !session.namedThisHand
      && table.actor && table.actor.isHero && table.board.length === 5 && !table.handOver) {
      return mount(actionHost, nameYourHand());
    }

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
    // A lesson with its own framing says that instead of naming whichever
    // module the decision technically belongs to.
    const spot = isHeroTurn && snap
      ? (lesson && lesson.coachNote
        ? { id: params.lesson, why: lesson.coachNote }
        : conceptOf(snap))
      : null;
    const spotMeta = spot ? moduleMeta(spot.id) : null;

    mount(coachHost,
      el('h3', '🧭 Coach'),
      spot
        ? el('div.spot-tag',
            el('span.spot-icon', spotMeta ? spotMeta.icon : '🎯'),
            el('div',
              el('div.spot-name', spotMeta ? t(spotMeta.name) : spot.id),
              el('div.spot-why', t(spot.why)),
              // Pointing at a chapter the reader cannot open is worse than
              // useless unless it says so. A quarter of the spots at level
              // two land here.
              spotMeta && !isUnlocked(spot.id, profile.level, MODULE_META)
                ? el('div.faint', t('You unlock this one at level {n}.', { n: spotMeta.unlockLevel }))
                : null,
            ),
          )
        : null,
      // Before you act the coach names the skill and repeats the facts on the
      // felt. It does not do the sum. Showing "your equity 41%" in green
      // against "needed 30%" is the answer written out — the comment above
      // has always said it never gives that away, and the code did exactly
      // that. The numbers are worth seeing; they are worth seeing *after*.
      isHeroTurn && snap
        ? el('div',
            metric('Pot / to call', `${fmt.chips(snap.pot)} / ${fmt.chips(snap.toCall)}`),
            metric('Opponents', String(snap.opponents)),
            // Naming the hand in the coach panel would answer the question
            // the lesson is about to ask, two inches above the buttons.
            el('div.faint', { style: { marginTop: '10px' } },
              lesson && lesson.ask === 'name-hand' && !session.namedThisHand
                ? t('You tell me.')
                : hero.hole.length && table.board.length
                  ? describeScore(evaluateHand(hero.hole, table.board, table.variant), table.variant.shortDeck)
                  : 'Preflop'),
            session.peeked
              ? el('div', { style: { marginTop: '10px' } },
                  metric('Your equity', fmt.pct(snap.equity, 1)),
                  snap.toCall > 0 ? metric('Equity needed', fmt.pct(snap.needed, 1)) : null,
                  snap.toCall > 0
                    ? metric('Pot odds', `${potOddsRatio(snap.toCall, snap.pot).toFixed(1)} : 1`)
                    : null,
                  metric('SPR', Number.isFinite(snap.spr) ? snap.spr.toFixed(1) : '∞'),
                  el('div.faint', t('Asked for. This one will not count as solved on your own.')))
              : el('button.btn.sm.ghost.block', { style: { marginTop: '10px' },
                onclick: () => { session.peeked = true; draw(); } },
              t('I am stuck — show me the numbers')),
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

      // On a lesson table most of the hands were played by the autopilot
      // while it searched for your spot, so a VPIP or a win rate built from
      // them describes the autopilot and not you. The run is what you did.
      lesson ? el('div',
        el('h3', { style: { marginTop: '18px' } }, t('📊 This run')),
        metric('Spots', `${session.run ? session.run.spots.length : 0} / ${RUN_LENGTH}`),
        metric('Right', String(session.run
          ? session.run.spots.filter((sp) => sp.level !== 'bad').length : 0)),
        metric('Hands dealt to find them', String(summary.hands)),
      ) : null,
      lesson ? null : el('h3', { style: { marginTop: '18px' } }, '📊 This session'),
      // Hands and result are facts about what happened. Everything below them
      // is a rate estimated from those hands, and a rate needs a sample: VPIP
      // after one hand is 0% or 100%, and bb/100 after one hand is four
      // thousand. Below the bar each says how far off it is instead.
      lesson ? null : metric('Hands', String(summary.hands)),
      lesson ? null : metric('Result', fmt.bb(summary.profitBb), summary.profitBb >= 0 ? 'good' : 'bad'),
      lesson ? null : summary.hands >= SAMPLE.winRate
        ? metric('Win rate', t('{n}bb/100 — still rough at {hands} hands',
          { n: summary.winRate.toFixed(1), hands: summary.hands }),
        summary.winRate >= 0 ? 'good' : 'bad')
        : metric('Win rate', shortfall(summary.hands, SAMPLE.winRate)),
      lesson ? null : summary.hands >= SAMPLE.playStyle
        ? metric('VPIP / PFR', `${fmt.pct(summary.vpip)} / ${fmt.pct(summary.pfr)}`)
        : metric('VPIP / PFR', shortfall(summary.hands, SAMPLE.playStyle)),
      lesson ? null : summary.hands >= SAMPLE.playStyle && summary.af !== null
        ? metric('Aggression', summary.af.toFixed(1))
        : metric('Aggression', summary.af === null
          ? t('no calls yet')
          : shortfall(summary.hands, SAMPLE.playStyle)),

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
  // The label is chrome and goes through t(); the value is already formatted
  // by the caller, who knows whether it is a number or a sentence.
  return el('div.coach-metric', el('span.k', t(k)), el(`span.v${tone ? `.${tone}` : ''}`, v));
}

function variantSwitcher(current, go) {
  return el('div.row',
    VARIANT_KEYS.map((key) => el(`button.btn.sm${key === current ? '.primary' : '.ghost'}`, {
      onclick: () => go('play', { variant: key }),
    }, VARIANTS[key].short)),
  );
}
