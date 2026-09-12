/**
 * The table. Play real hands against the bots while a coach checks every
 * decision you make against the actual equity and the price you were offered.
 */

import { el, mount, toast, fmt } from './dom.js';
import { icon } from './icons.js';
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
import { sizingContext, potFraction, clampRaise, sizingOffers } from '../core/betSizing.js';
import { evaluateHand, describeScore, shortCategoryName, categoryOf, CAT } from '../core/evaluator.js';
import { judgeSpot } from '../core/coach.js';
import { conceptOf, isUnlocked } from '../core/spotConcept.js';
import { moduleMeta, MODULE_META } from '../data/curriculum.js';
import { lessonTable } from '../data/lessonTables.js';
import {
  snapshotOf, autopilotAction, playUntilMySpot, captureRange, tableReadRange,
} from '../core/lessonRunner.js';
import { READ_BANDS, nearestBand, marginFor } from '../core/handRead.js';
import { emptyMemory, watch, adaptationNote } from '../engine/adapt.js';
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
  // Only claim to be a lesson if there is one. Asking for a module that has
  // no table used to put its name and icon above an ordinary six-handed cash
  // game — a header promising a lesson that was not there.
  const lessonMeta = lesson && params.lesson ? moduleMeta(params.lesson) : null;

  if (params.lesson && !lesson) {
    const meta = moduleMeta(params.lesson);
    return el('div.screen', el('div.panel',
      el('h1', meta ? icon(meta.icon, { size: 22 }) : null, meta ? t(meta.name) : t('No table for that')),
      el('p.muted', meta && params.lesson === 'icm'
        ? t('ICM is a tournament idea and this is a cash table, so there is no honest way to '
          + 'play it here. The lesson and its drill still teach it.')
        : meta && params.lesson === 'bankroll'
          ? t('Which table to sit at is the whole subject, so the Bankroll Challenge is this '
            + 'lesson — climbing the stakes with a real roll is the exercise.')
          : t('That is not a lesson this game can deal.')),
      el('div.row',
        meta
          ? el('button.btn.primary', { onclick: () => go('walkthrough', { module: params.lesson }) },
            t('Read the lesson'))
          : null,
        params.lesson === 'bankroll'
          ? el('button.btn.ghost', { onclick: () => go('grind') }, t('Open the Bankroll Challenge'))
          : null,
        el('button.btn.ghost', { onclick: () => go('home') }, t('Back')),
      ),
    ));
  }
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

  // Who is watching, and how awake they are. Both live on the table because
  // that is what botAction and the hand-reading engine are handed, and one of
  // them reading a different answer than the other is the bug this whole
  // feature would otherwise be made of.
  table.readerLevel = profile.level;

  const stats = new SessionStats();
  stats.bigBlind = bigBlind;

  const session = {
    cancelled: false,
    timer: null,
    snapshot: null,
    verdict: null,
    raiseAmount: 0,
    raiseKey: null,
    handStarted: false,
    buyInsUsed: grind ? 1 : 0,
    logLines: [],
    // Decisions graded across the whole session, not the current hand.
    // The chips you won are the one number at a table you do not control;
    // this is the one you do.
    decisions: { right: 0, total: 0 },
    recorder: null,
    savedHand: null,
    // Who took the lead on each street, so a flop decision knows whether it
    // is a continuation bet. The engine's lastAggressor is reset per street,
    // and "were you the preflop raiser" is a question about the street before.
    aggressor: {},
    opener: null,
    learned: [],
    // The read the reader has been asked for on this decision, if the spot
    // qualifies. Cleared the moment the hand moves on.
    read: null,
    // What this table has seen of the reader's own game, for the opponents
    // who are paying attention. One memory rather than one each: six players
    // watching the same six decisions would reach the same conclusion, and
    // six copies of it is six chances to drift.
    readerMemory: emptyMemory(),
    // At most one per street. Two streets are two different bets with two
    // different ranges, and a flop read should not crowd out the river one.
    // Within a street it must not ask twice: the range this models is the
    // hand they bet with, and after a raise and a call it is a different,
    // much narrower set, so asking again would model the wrong action.
    readAsked: {},
    // Set when the reader asks the coach to do the sum for them. Reset every
    // decision, so asking once does not silence the coach for the whole hand.
    peeked: false,
    // A lesson is a fixed run of spots with a report at the end, not an
    // endless table: without a last hand there is no moment where anyone
    // says how it went.
    run: lesson ? startRun(params.lesson) : null,
  };
  // The same object, not a copy: the opponents read what the reader does.
  table.readerMemory = session.readerMemory;
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
          ? t(lessonMeta.name)
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
    session.readAsked = {};
    session.peeked = false;
    session.savedHand = null;
    session.aggressor = {};
    session.opener = null;
    session.ranges = {};
    session.learned = [];
    session.namedThisHand = false;
    session.playedByReader = false;
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
        session.read = readPrompt();
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
    session.readAsked = {};
    session.savedHand = null;
    session.aggressor = {};
    session.opener = null;
    session.ranges = {};
    session.learned = [];
    session.namedThisHand = false;
    session.playedByReader = false;
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
      session.read = readPrompt();

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
      // What they would have bet with, taken while they are still the one
      // deciding — after they pay, the same question returns "check".
      captureRange(table, actor, action, session, rng);
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
    rng, aggressor: session.aggressor, opener: session.opener, ranges: session.ranges,
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
    session.decisions.total++;
    if (right) session.decisions.right++;
    // Getting it right at a table is worth more than getting it right in a
    // drill, and getting it wrong still teaches — so it is never zero.
    profile.addXp(right ? 12 : 4);
  }


  /**
   * Ask for the read before the decision, on the spots where it is the
   * decision.
   *
   * The table already built the opponent's range and priced the hero against
   * it — silently, behind the reader, who was then graded on a call they had
   * no way of reasoning about. The range is the answer to a question nobody
   * was ever asked. So ask it: on a river, heads up, facing a bet from a
   * player with a style, what does that bet represent?
   */
  function readPrompt() {
    if (session.readAsked[table.street]) return null;
    const live = table.contestants.filter((p) => !p.isHero).length;
    const toCall = Math.max(0, table.currentBet - hero.committed);
    const range = tableReadRange(table, hero, live, toCall);
    if (!range) return null;
    const air = range.share.air * 100;
    const band = nearestBand(air, marginFor(table.board));
    if (band === null) return null;      // two defensible answers: do not ask
    const villain = table.contestants.find((p) => !p.isHero && p.profile);
    return {
      range, air, band, villain, street: table.street,
      name: range.profile.name, style: range.profile.style,
    };
  }

  function answerRead(picked) {
    const prompt = session.read;
    if (!prompt || prompt.picked != null) return;
    prompt.picked = picked;
    session.readAsked[table.street] = true;
    const right = picked === prompt.band;
    // A read is evidence about reading players, and it is better evidence
    // than a drill answer: nobody offered it as a question with a module
    // name attached.
    profile.recordDrill('exploit', right);
    review(profile, 'exploit', right);
    session.learned.push({ id: 'exploit', name: moduleMeta('exploit').name, right });
    profile.addXp(right ? 10 : 3);
    draw();
  }

  function heroAct(action) {
    if (session.cancelled || table.handOver || !table.actor || !table.actor.isHero) return;
    session.read = null;
    session.playedByReader = true;
    const snap = session.snapshot || takeSnapshot();
    // Facing a bet and folding is the one pattern an observant opponent can
    // price. Read off the snapshot, which says what was in front of the
    // reader at the moment they chose.
    watch(session.readerMemory, { facingBet: snap.toCall > 0, action: action.type });
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

    // Finding ten spots takes over a hundred hands, and the reader was handed
    // about ten of them. Counting the rest would advance the rank, the hands
    // tile and the achievements on hands somebody else played — which is the
    // same fault as a percentage with no sample behind it, in another costume.
    // (The flag for this existed as `actedThisHand` and was deleted last
    // version as dead state; nothing read it because the thing that needed to
    // had not been written yet.)
    if (!lesson || session.playedByReader) {
      profile.data.handsPlayed++;
      profile.save();
    }

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
      session.playedByReader = true;
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

    // A new decision starts on half pot rather than on whatever the last one
    // was left at: a number carried over from a smaller pot two streets ago
    // is the other way a sizing control looks broken. Re-renders of the same
    // decision keep what the reader chose.
    if (raiseSpec) {
      const decision = `${table.handNumber}/${table.street}/${table.currentBet}/${table.totalPot}/${raiseSpec.min}`;
      const stale = session.raiseAmount < raiseSpec.min || session.raiseAmount > raiseSpec.max;
      if (stale || session.raiseKey !== decision) {
        session.raiseAmount = potFraction(sizingContext(table, hero, raiseSpec), 0.5);
        session.raiseKey = decision;
      }
    }

    // One raise amount, four ways to set it, and every readout follows it.
    // Keeping the primary button's label in this list is the point: it is the
    // one that says out loud what pressing it will do.
    const followers = [];
    const setAmount = (value, { keepTyping = false } = {}) => {
      if (!raiseSpec) return;
      session.raiseAmount = clampRaise(raiseSpec, value);
      for (const follow of followers) follow(session.raiseAmount, keepTyping);
    };

    const raiseButton = raiseSpec
      ? el('button.btn.primary', {
          onclick: () => heroAct({ type: raiseSpec.type, amount: session.raiseAmount }),
        })
      : null;
    if (raiseButton) {
      followers.push((amount) => {
        raiseButton.textContent = raiseSpec.type === 'bet'
          ? t('Bet {amount}', { amount: fmt.chips(amount) })
          : t('Raise to {amount}', { amount: fmt.chips(amount) });
      });
    }

    let sizingRows = null;
    if (raiseSpec) {
      const ctx = sizingContext(table, hero, raiseSpec);

      // Typable, because on a touch screen aiming a slider at one chip in two
      // hundred is not a skill worth practising. Clamping waits for blur: a
      // reader typing "12" should not have the "1" snapped up to the minimum
      // raise under their thumb.
      const field = el('input.raise-input', {
        type: 'text',
        inputmode: 'numeric',
        'aria-label': 'Raise size',
        value: String(session.raiseAmount),
        oninput: (e) => {
          const typed = e.target.value.replace(/[^0-9]/g, '');
          if (e.target.value !== typed) e.target.value = typed;
          if (typed === '') return;
          setAmount(Number(typed), { keepTyping: true });
        },
        onchange: () => setAmount(session.raiseAmount),
        onblur: () => setAmount(session.raiseAmount),
        onfocus: (e) => e.target.select(),
      });
      followers.push((amount, keepTyping) => {
        if (!keepTyping) field.value = String(amount);
      });

      const slider = el('input.raise-slider', {
        type: 'range',
        min: String(raiseSpec.min),
        max: String(raiseSpec.max),
        value: String(session.raiseAmount),
        step: '1',
        'aria-label': 'Raise size',
        oninput: (e) => setAmount(Number(e.target.value)),
      });
      followers.push((amount) => { slider.value = String(amount); });

      const step = (by, label) => el('button.btn.sm.ghost.step-btn', {
        'aria-label': label,
        onclick: () => setAmount(session.raiseAmount + by),
      }, by > 0 ? '+1' : '−1');

      const offers = sizingOffers(ctx);
      const presets = offers.map((offer) => {
        const button = el('button.btn.sm.ghost.size-btn', {
          onclick: () => setAmount(offer.amount),
        },
          el('span.size-name', offer.label),
          el('span.size-chips', fmt.chips(offer.amount)),
        );
        // The amount is on the button because in a small pot several
        // fractions land on the same legal minimum, and a button that looks
        // dead is worse than one that shows you why.
        followers.push((amount) => {
          button.classList.toggle('is-active', amount === offer.amount);
        });
        return button;
      });

      sizingRows = el('div.sizing',
        el('div.sizing-row.size-presets', presets),
        el('div.sizing-row.size-tune',
          step(-1, 'One chip less'),
          field,
          step(1, 'One chip more'),
          slider,
        ),
      );
    }

    // Paint every follower once so the bar opens consistent with itself.
    if (raiseSpec) setAmount(session.raiseAmount);

    // Until the read is given, the buttons are not the question. Answering
    // takes one tap and only happens on spots where the whole decision is
    // what their bet means — a river, heads up, facing a bet.
    const read = session.read;
    if (read && read.picked == null) {
      mount(actionHost, el('div.action-bar',
        el('div.read-ask',
          el('div.read-head', t('Before you act: {name} ({style}) has bet.', { name: read.name, style: t(read.style) })),
          el('div.faint', t('Of every hand they would bet here, roughly what share is air?')),
          el('div.read-bands', READ_BANDS.map((band) => el('button.btn.sm', {
            onclick: () => answerRead(band),
          }, `${band}%`))),
        ),
      ));
      return null;
    }

    mount(actionHost, el('div.action-bar',
      read ? el('div.read-said',
        read.picked === read.band
          ? t('✓ Read: {air} of their bets here are air. Now play it.', { air: `${Math.round(read.air)}%` })
          : t('✗ You said {said}; it is {air} air. Now play it.',
            { said: `${read.picked}%`, air: `${Math.round(read.air)}%` })) : null,
      sizingRows,
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
        raiseButton,
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

    // Somebody at this table has changed how they play, because of how you
    // play. Saying so is the whole point: an opponent who adjusts silently is
    // not a lesson, it is a table that got harder for no visible reason.
    const adjusted = table.contestants
      .filter((p) => !p.isHero && p.profile)
      .map((p) => adaptationNote(getProfile(p.profile), session.readerMemory, table.readerLevel))
      .filter(Boolean);

    mount(coachHost,
      el('h3', icon('coach', { size: 18 }), t('Coach')),
      adjusted.length
        ? el('div.notice', { style: { marginBottom: '10px' } },
          el('div', { style: { fontWeight: '600' } }, t('They have noticed how you play')),
          el('div.faint', { style: { marginTop: '4px' } },
            t('You have folded to {pct} of the bets you faced. {names} {verb} accordingly — '
              + 'bluffing you {direction}.', {
              pct: fmt.pct(adjusted[0].foldRate),
              names: adjusted.map((a) => a.name).join(', '),
              verb: adjusted.length > 1 ? t('have adjusted') : t('has adjusted'),
              direction: adjusted[0].harder ? t('more often') : t('less often'),
            })),
        )
        : null,
      spot
        ? el('div.spot-tag',
            el('span.spot-icon', icon(spotMeta ? spotMeta.icon : 'target', { size: 18 })),
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
            el('h3', icon('target', { size: 18 }), t('What this hand asked you')),
            el('div.stack-sm', session.learned.map((entry) => el('div.learned-row',
              el(`span.${entry.right ? 'right' : 'wrong'}`, entry.right ? '✓' : '✗'),
              el('span', t(entry.name)),
            ))))
        : null,

      // On a lesson table most of the hands were played by the autopilot
      // while it searched for your spot, so a VPIP or a win rate built from
      // them describes the autopilot and not you. The run is what you did.
      lesson ? el('div',
        el('h3', { style: { marginTop: '18px' } }, icon('charts', { size: 18 }), t('This run')),
        metric('Spots', `${session.run ? session.run.spots.length : 0} / ${RUN_LENGTH}`),
        metric('Right', String(session.run
          ? session.run.spots.filter((sp) => sp.level !== 'bad').length : 0)),
        metric('Hands dealt to find them', String(summary.hands)),
      ) : null,
      lesson ? null : el('h3', { style: { marginTop: '18px' } }, icon('charts', { size: 18 }), t('This session')),
      // Hands and result are facts about what happened. Everything below them
      // is a rate estimated from those hands, and a rate needs a sample: VPIP
      // after one hand is 0% or 100%, and bb/100 after one hand is four
      // thousand. Below the bar each says how far off it is instead.
      lesson ? null : metric('Hands', String(summary.hands)),
      // Decision quality first, and the chips second. A session is far too
      // short for the result to say anything: the whole point of the Bankroll
      // lesson is that a winning player loses over ten thousand hands about a
      // third of the time. How often you chose well is measurable now.
      lesson || !session.decisions.total ? null : metric('Decisions right',
        `${session.decisions.right}/${session.decisions.total} · ${
          Math.round((session.decisions.right / session.decisions.total) * 100)}%`,
        session.decisions.right / session.decisions.total >= 0.8 ? 'good' : ''),
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

      // The two numbers above measure different things, and a session is
      // only ever long enough for one of them to mean anything. Saying so
      // where they disagree is the point: losing with good decisions is the
      // normal way a winning session looks from the inside, and winning with
      // bad ones is the reading that actually costs money later.
      lesson ? null : divergenceNote(session.decisions, summary),

      el('h3', { style: { marginTop: '18px' } }, icon('clipboard', { size: 18 }), t('Hand log')),
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

/**
 * Where the chips and the choices disagree.
 *
 * Returns nothing until there are enough graded decisions to say anything,
 * and nothing when the two agree — a note that fires every session is
 * wallpaper.
 */
function divergenceNote(decisions, summary) {
  if (decisions.total < 12) return null;
  const rate = decisions.right / decisions.total;
  const lost = summary.profitBb < -8;
  const won = summary.profitBb > 8;

  if (lost && rate >= 0.8) {
    return el('div.notice', { style: { marginTop: '14px' } },
      t('You lost chips and chose well — {pct} of your decisions were right. Over a session this short the '
        + 'result is mostly the cards. This is what a winning session looks like from the inside about a third '
        + 'of the time.', { pct: fmt.pct(rate, 0) }));
  }
  if (won && rate < 0.65) {
    return el('div.notice.warn', { style: { marginTop: '14px' } },
      t('You won chips with {pct} of your decisions right. Getting paid for the wrong choice is the expensive '
        + 'kind of session, because nothing about it tells you to stop.', { pct: fmt.pct(rate, 0) }));
  }
  return null;
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
