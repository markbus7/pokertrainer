/**
 * The table. Play real hands against the bots while a coach checks every
 * decision you make against the actual equity and the price you were offered.
 */

import { el, mount, toast, fmt } from './dom.js';
import { icon } from './icons.js';
import { rangeGridFor, priceSheet, sizeSheet } from './reference.js';
import { t, getLang } from '../i18n/index.js';

/**
 * What a metric says when the sample cannot support a number yet. Reads the
 * same everywhere: a dash, and how much further there is to go.
 */
const shortfall = (have, need) => t('— {n} more hands', { n: need - have });
import { renderFelt } from './feltView.js';
import { createTable, STREETS } from '../engine/table.js';
import { botAction, getProfile, pickOpponents, profileAt } from '../engine/bots.js';
import { VENUES, venueFor } from '../data/venues.js';
import { VARIANTS, VARIANT_KEYS } from '../engine/variants.js';
import { equityVsField, outsToImprove } from '../core/equity.js';
import { requiredEquity, potOddsRatio, spr } from '../core/odds.js';
import { sizingContext, potFraction, clampRaise, sizingOffers } from '../core/betSizing.js';
import { evaluateHand, describeScore, shortCategoryName, categoryOf, standardScore, CAT } from '../core/evaluator.js';
import { judgeSpot, overall } from '../core/coach.js';
import { sizingContextOf, sizeAdvice } from '../core/sizing.js';
import { conceptOf } from '../core/spotConcept.js';
import { moduleMeta, MODULE_META } from '../data/curriculum.js';
import { lessonTable } from '../data/lessonTables.js';
import {
  snapshotOf, autopilotAction, playUntilMySpot, captureRange, tableReadRange,
} from '../core/lessonRunner.js';
import { READ_BANDS, nearestBand, marginFor } from '../core/handRead.js';
import { emptyMemory, watch, adaptationNote, ADAPT_FULL } from '../engine/adapt.js';
import { lobbyFor, chosenRank } from '../state/lobby.js';
import { seatOf, keepSeat, clearSeat, chipsValue, doublingTarget } from '../state/seat.js';
import { remember as rivalRemembers, readOn as rivalRead } from '../state/rival.js';
import { RIVAL } from '../data/rival.js';
import { wandererFor } from '../data/wanderers.js';
import { ensureContracts, noteEvent as noteContract, contractText } from '../state/contracts.js';
import { furthestStop, seatInPearls, payRoomCut, companionByKey } from '../state/economy.js';
import { facingOf, mistakesHere } from '../state/lifetime.js';
import {
  startRun, recordSpot, runComplete, scoreRun, saveRun, watchFor, runHistory, RUN_LENGTH,
} from '../state/lessonRuns.js';
import { review } from '../state/spacing.js';
import { cardsToString, handKey } from '../core/cards.js';
import { shuffle } from '../core/rng.js';
import { SessionStats, leakReport, stakeFor, bankrollAdvice, SAMPLE } from '../state/stats.js';
import { HandRecorder, keepHand } from '../state/handHistory.js';
import { checkAchievements } from '../state/achievements.js';
import { IDK, dontKnowButton } from './dontKnow.js';
import { bossFor, MENTOR } from '../data/characters.js';
import { svgNode, lampNode } from './place.js';
import { silasFigure, moodFor, RULES } from './guide.js';
import { fishSvg } from './fishArt.js';
import { autoDealEnabled, autoDealDelay, autoDealReady, countdown } from '../state/autoDeal.js';
import { takeTable, duelStatus } from '../state/journey.js';
import { DUEL_LEVELS, MIN_DECISIONS, STAR_SHARE, blindsFor, duelStars, starPearls, duelOver, soundShare } from '../state/match.js';
import { storyFor } from '../data/story.js';
import {
  FIELD, START_STACK, LEVELS as REGATTA_LEVELS, blindsFor as regattaBlinds, payouts as regattaPayouts, prizeFor, placesFor, placePearls, ordinal,
  BUBBLE, BUBBLE_START_HAND, bubbleStacks,
} from '../state/regatta.js';
import { bites, landed, weighIn, speciesOf } from '../data/fish.js';
import { portraitSvg } from './portraits.js';
import * as audio from '../audio/engine.js';
import {
  ownsLesson, LESSON_PRICES, crewAboard, boatBonus, strongbox, decisionPearls, handPearls, EARN,
  seatBounty, bountyPaid, tableShare, scalePearls, playedThrough,
} from '../state/economy.js';
import { lockedChapter } from './screenDrill.js';
import { helpDrawer, companionTitle } from './companions.js';
import { pearl, pearlPop, pearls as pearlsNode } from './shop.js';
import { buildReport, keepReport } from '../state/sessionReport.js';

const BOT_DELAY = 620;

/**
 * How many hands a lesson table will deal looking for the reader's own spot.
 * Measured over twelve fresh sessions per lesson, every one finds its spot;
 * the slowest are the flop draw at 57 hands and the river bluff at 52, so
 * this is roughly double the worst case seen.
 */
const MAX_SEARCH = 120;
const HERO_ID = 'hero';

/**
 * The chart and the price, at the table, without leaving it.
 *
 * The reader's note: "in het echt online zou ik de chart er ook bij kunnen
 * halen maar dan gaat het te langzaam, daarom wil ik het hier gewoon leren".
 * That is exactly the right reason to put it here and exactly the right reason
 * not to charge for it. This is a reference, not an answer — the thing being
 * memorised, with a whole ladder elsewhere built to take it away on purpose.
 * Charging for it here as well would be charging twice for the same lesson.
 *
 * What it shows follows the spot rather than making you pick: preflop it opens
 * on the chart for the seat you are actually in, and once there is a board the
 * chart has nothing left to say, so it opens on the price.
 */
function referenceDrawer(session, hero, table, draw) {
  const preflop = table.street === 'preflop';
  const facing = table.currentBet > table.bigBlind && table.lastAggressor && table.lastAggressor !== hero;
  const seat = hero.position || 'BTN';
  const raiser = facing && table.lastAggressor ? table.lastAggressor.position : null;
  const mine = hero.hole.length === 2 ? handKey(hero.hole) : null;

  const tabs = [
    preflop ? { key: 'chart', label: 'Chart' } : null,
    { key: 'price', label: 'The price' },
    { key: 'sizes', label: 'Bet sizes' },
  ].filter(Boolean);

  if (!session.sheet) {
    return el('button.btn.sm.ghost.block', {
      style: { marginTop: '10px' },
      onclick: () => { session.sheet = preflop ? 'chart' : 'price'; draw(); },
    }, icon('charts', { size: 15 }), t('Open the reference'));
  }

  const open = tabs.some((tab) => tab.key === session.sheet) ? session.sheet : tabs[0].key;
  return el('div.reference-drawer',
    el('div.reference-head',
      el('div.reference-tabs', tabs.map((tab) => el(`button.reference-tab${tab.key === open ? '.active' : ''}`, {
        onclick: () => { session.sheet = tab.key; draw(); },
      }, t(tab.label)))),
      el('button.reference-close', {
        onclick: () => { session.sheet = null; draw(); },
        'aria-label': t('Close'),
      }, '×'),
    ),
    open === 'chart' && table.players.length < 6
      ? el('div.faint', t('These charts are drawn for six players. With fewer at the table everybody plays more hands, so read them as the tight end of the range.'))
      : null,
    open === 'chart'
      ? rangeGridFor({ seat, raiser, hand: mine })
      : open === 'sizes' ? sizeSheet() : priceSheet(),
    el('div.faint', t('Yours to look at. It costs you nothing — the range trainer is where it '
      + 'gets taken away on purpose.')),
  );
}

/** The spot, in words, for the cat: what was in front of you, and on which street. */
const SPOT_TEXT = { first: 'first in', raised: 'facing a raise', limped: 'after a limp', bet: 'facing a bet', checked: 'checked to you' };
const STREET_TEXT = { flop: 'on the flop', turn: 'on the turn', river: 'on the river' };
const SEAT_TEXT = { UTG: 'under the gun', HJ: 'in the hijack', CO: 'in the cutoff', BTN: 'on the button', SB: 'in the small blind', BB: 'in the big blind' };

/**
 * What the hand came to for you, in words. Nothing won and nothing lost is a
 * thing that happens every time you fold without having put a chip in, and
 * "you won 0 chips" is not what happened.
 */
export function resultLine(net) {
  if (net > 0) return t('You won {n} chips this hand.', { n: fmt.chips(net) });
  if (net < 0) return t('You lost {n} chips this hand.', { n: fmt.chips(-net) });
  return t('No chips won or lost this hand.');
}

/** Silas's earlier verdicts: how many are kept, and how many are shown under the current one. */
const SAID_KEPT = 8;
const SAID_SHOWN = 4;
const SAID_MARK = { good: '✓', ok: '≈', bad: '✗', skip: '–' };
const DID = { fold: 'You folded', check: 'You checked', call: 'You called', bet: 'You bet', raise: 'You raised' };

/** How many chairs the practice table can be dealt for. */
const TABLE_SIZES = [6, 3, 2];

/**
 * The table you are sitting at, while you look at something else.
 *
 * Leaving the table screen used to end the table: a look at the ledger, at
 * your character or at a hand in the Log, and the chips you had bought in with
 * were gone, and the next seat cost another buy-in. Now the table waits. It is
 * kept here, paused where it was — mid-hand if that is where you left it — and
 * the rail says so on every other screen, with the way back and the way to
 * get up. One table at a time: sitting down somewhere else while chips or a
 * match ride on this one asks you to deal with it first.
 *
 * A lesson table is still a page of its chapter and ends when you leave it.
 */
let live = null;

/**
 * The table waiting for you, for the rail: where it is, what it holds, and the
 * two things you can do from anywhere — go back, or get up.
 */
export function waitingTable() {
  if (!live || live.closed || live.finished()) return null;
  return {
    mode: live.mode,
    place: live.place(),
    money: live.money(),
    back: live.back,
    getUp: live.getUp,
    getUpLabel: live.getUpLabel,
  };
}

/** Which table a route asks for, so the one you left can be told from a new one. */
function tableKey(params, profile) {
  if (params.lesson) return null;
  if (params.mode === 'grind') {
    const kept = seatOf(profile);
    const venueKey = params.at && VENUES.some((v) => v.key === params.at) ? params.at
      : params.resume === '1' && kept && kept.mode === 'grind' ? kept.venue : profile.career.venue;
    const tables = lobbyFor(venueFor(venueKey), profile.sittings).tables;
    const seatId = (tables.find((x) => x.id === params.table) || tables[0]).id;
    return `grind:${venueKey}:${seatId}`;
  }
  if (params.mode === 'duel') return `duel:${params.at}`;
  if (params.mode === 'regatta') return params.bubble === '1' ? 'bubble' : `regatta:${params.at}`;
  // "Play for pearls" asks for no table in particular: the practice table that
  // is waiting is the one meant, whatever game and size it was dealing.
  if (!params.variant && !params.seats && live && !live.closed && live.mode === 'free') return live.key;
  const variant = params.variant && VARIANTS[params.variant] ? params.variant : 'holdem';
  const size = TABLE_SIZES.includes(Number(params.seats)) ? Number(params.seats) : 6;
  return `free:${variant}:${size}`;
}

/** You are already sitting somewhere else: go back to it, or get up from it first. */
function seatedElsewhere({ place, back, getUp, getUpLabel, money }) {
  return el('div.screen', el('div.panel.seated-elsewhere',
    el('h1', t('You are still at {place}', { place })),
    el('p.muted', money === null || money === undefined
      ? t('One table at a time. Go back to it, or get up from it first.')
      : t('Your {money} is still on that table. One table at a time: go back to it, or cash out first.', { money: fmt.money(money) })),
    el('div.row',
      el('button.btn.primary', { onclick: back }, t('Back to the table')),
      el('button.btn.ghost', { onclick: getUp }, t(getUpLabel)),
    ),
  ));
}

export function renderTable(ctx, params = {}) {
  // The table you got up from a moment ago is still there: pick it back up.
  const key = tableKey(params, ctx.profile);
  if (key && live && !live.closed) {
    if (live.finished()) {
      // A match that is over is not picked back up: asking for its table again
      // — a rematch, another bubble — is asking for a new one.
      live.discard();
    } else if (live.key === key) {
      return live.resume(ctx);
    } else if (live.holds()) {
      return seatedElsewhere({ place: live.place(), back: live.back, getUp: live.getUp, getUpLabel: live.getUpLabel, money: live.money() });
    } else {
      // A practice table holds nothing: it is let go.
      live.discard();
    }
  }
  // A cash seat kept in the save with no table in memory — the page was closed,
  // or reloaded — is taken back up with the chips it had.
  const kept = seatOf(ctx.profile);
  const keptKey = kept && kept.mode === 'grind' ? `grind:${kept.venue}:${kept.table}` : null;
  if (keptKey && !params.lesson && key !== keptKey) {
    const keptVenue = venueFor(kept.venue);
    const keptTable = lobbyFor(keptVenue, ctx.profile.sittings).tables.find((x) => x.id === kept.table);
    return seatedElsewhere({
      place: keptTable && !keptTable.owner ? `${t(keptVenue.name)} · ${t(keptTable.name)}` : t(keptVenue.name),
      money: chipsValue(kept.chips, kept.bigBlind, kept.buyIn),
      back: () => ctx.go('play', { mode: 'grind', table: kept.table, resume: '1' }),
      getUp: () => ctx.go('play', { mode: 'grind', table: kept.table, resume: '1', cashout: '1' }),
      getUpLabel: 'Cash out',
    });
  }
  const resuming = Boolean(keptKey && key === keptKey);
  const grind = params.mode === 'grind';
  const { profile, rng, go } = ctx;
  // A duel: you against the owner of a stop's table, to the last chip, with the
  // blinds climbing until somebody has them all. Only once the city's lessons
  // and hands are done — an owner will not duel a stranger.
  const duelStop = params.mode === 'duel' ? VENUES.find((v) => v.key === params.at) || null : null;
  const duel = Boolean(duelStop);
  if (params.mode === 'duel' && (!duel || !duelStatus(ctx.profile, duelStop.index).ready)) {
    return el('div.screen', el('div.panel',
      el('h1', t('Not yet')),
      el('p.muted', t('The owner of this table will not duel a stranger. Finish the lessons and the hands for this city first.')),
      el('button.btn.primary', { onclick: () => go(duel ? 'stop' : 'home', duel ? { at: duelStop.key } : {}) }, t('Back')),
    ));
  }
  // A regatta: a six-player tournament at a stop, to the last chip, with the top
  // three paid. The entry comes out of the bankroll and the prize goes back in.
  // The bubble is the ICM chapter's table: a Regatta already down to four with three paid,
  // for practice — nothing entered, nothing paid.
  const bubble = params.mode === 'regatta' && params.bubble === '1';
  const regattaStop = params.mode === 'regatta'
    ? VENUES.find((v) => v.key === params.at) || (bubble ? venueFor(ctx.profile.career.venue) : null)
    : null;
  const regatta = Boolean(regattaStop);
  // What a seat in this tournament costs, and the size of the field.
  const entryFee = bubble ? 0 : regatta ? regattaStop.entry : 0;
  const prizeEntry = bubble ? BUBBLE.entry : entryFee;
  const fieldSize = bubble ? BUBBLE.field : FIELD;
  if (params.mode === 'regatta' && !regatta) return el('div.screen', el('div.panel', el('h1', t('Not yet')), el('button.btn.primary', { onclick: () => go('home') }, t('Back'))));
  // A seat or an entry can be paid in pearls: what they fetch where the boat is moored.
  const payPearls = params.pay === 'pearls' && !resuming && (params.mode === 'grind' || (regatta && !bubble));
  const pearlPrice = payPearls ? seatInPearls((regatta ? regattaStop : venueFor(ctx.profile.career.venue)).index) : 0;
  if (payPearls && ctx.profile.pearls < pearlPrice) {
    return el('div.screen', el('div.panel',
      el('h1', t('Not enough pearls')),
      el('p.muted', t('A seat here is {n} pearls and you have {have}.', { n: fmt.chips(pearlPrice), have: fmt.chips(ctx.profile.pearls) })),
      el('button.btn.primary', { onclick: () => go('stop', { at: regatta ? regattaStop.key : ctx.profile.career.venue }) }, t('Back')),
    ));
  }
  if (regatta && !bubble && !payPearls && ctx.profile.data.bankroll < regattaStop.entry) {
    return el('div.screen', el('div.panel',
      el('h1', t('Not enough bankroll')),
      el('p.muted', t('The entry is {cost} and you have {have}.', { cost: fmt.money(regattaStop.entry), have: fmt.money(ctx.profile.data.bankroll) })),
      el('button.btn.primary', { onclick: () => go('stop', { at: regattaStop.key }) }, t('Back')),
    ));
  }
  // Both a duel and a regatta run on a blind clock and end with somebody holding
  // the chips; what they share is here, and what they do not is under their own name.
  const match = duel || regatta;
  const variantKey = !match && params.variant && VARIANTS[params.variant] ? params.variant : 'holdem';
  const stake = stakeFor(resuming ? kept.venue : profile.data.stakeKey);

  const bigBlind = regatta ? REGATTA_LEVELS[bubble ? BUBBLE.levelIndex : 0][1] : 2;
  const startingStack = regatta ? START_STACK : bigBlind * 100;
  // Taking a kept seat back up costs nothing: it was paid for when you first sat down.
  const buyInCost = grind && !resuming && !payPearls ? stake.buyIn : 0;

  if (grind && profile.data.bankroll < buyInCost) {
    return el('div.screen', el('div.panel',
      el('h1', 'Not enough bankroll'),
      el('p.muted', t('A {stake} buy-in costs {cost} and you have {have}.',
        { stake: stake.name, cost: fmt.money(stake.buyIn), have: fmt.money(profile.data.bankroll) })),
      el('button.btn.primary', { onclick: () => go('home') }, 'Choose a lower stake'),
    ));
  }

  // A lesson gets a table cut down to it: fewer seats where the seats are
  // not the point, and a hand that ends once its question is answered.
  const lesson = params.lesson ? lessonTable(params.lesson) : null;
  // Only claim to be a lesson if there is one. Asking for a module that has
  // no table used to put its name and icon above an ordinary six-handed cash
  // game — a header promising a lesson that was not there.
  const lessonMeta = lesson && params.lesson ? moduleMeta(params.lesson) : null;

  // A lesson table is part of the chapter, so it is only dealt to somebody
  // who owns the chapter.
  if (params.lesson && moduleMeta(params.lesson) && !ownsLesson(profile, params.lesson)) {
    return lockedChapter(ctx, moduleMeta(params.lesson));
  }

  if (params.lesson && !lesson) {
    const meta = moduleMeta(params.lesson);
    return el('div.screen', el('div.panel',
      el('h1', meta ? icon(meta.icon, { size: 22 }) : null, meta ? t(meta.name) : t('No table for that')),
      el('p.muted', meta && params.lesson === 'icm'
        ? t('ICM is a tournament idea, so it is played at a tournament table: the bubble, with four left and three paid.')
        : meta && params.lesson === 'bankroll'
          ? t('Which table to sit at is the whole subject, so the river is this '
            + 'lesson — climbing the stakes with a real roll is the exercise.')
          : t('That is not a lesson this game can deal.')),
      el('div.row',
        meta && params.lesson === 'icm'
          ? el('button.btn.primary', { onclick: () => go('play', { mode: 'regatta', bubble: '1', at: profile.career.venue }) }, t('▶ Play the bubble'))
          : null,
        meta
          ? el(`button.btn${params.lesson === 'icm' ? '.ghost' : '.primary'}`, { onclick: () => go('walkthrough', { module: params.lesson }) },
            t('Read the lesson'))
          : null,
        el('button.btn.ghost', { onclick: () => go('home') }, t('Back')),
      ),
    ));
  }
  // Free play can be dealt for fewer: you against one, or against two. The
  // stops are full tables with somebody who owns them, and a lesson is cut to
  // whatever it teaches.
  const seats = duel ? 2 : regatta ? fieldSize : lesson ? lesson.seats : (!grind && TABLE_SIZES.includes(Number(params.seats)) ? Number(params.seats) : 6);

  // Free play is the table. Silas at your shoulder, grading every decision
  // out loud, is a choice the reader makes with the switch in the header —
  // except at a lesson table, where the teaching is the point of sitting.
  const liveCoach = () => Boolean(lesson) || Boolean(profile.settings.liveCoach);
  // Which opponents you can read by their label: all of them with Silas
  // talking, and with the hound — who reads people for a living — on your side.
  const showTags = () => liveCoach() || crewAboard(profile).some((c) => c.key === 'hound');

  // At a stop, the person who owns its table is sitting at it — at the owner's
  // table, one of three the lobby offers. They play the style the stop was
  // built around: the boss is a face and a voice on one of the engine's six
  // players, not a seventh, so their seat takes that style's place and name.
  const room = duel ? duelStop : regatta ? regattaStop : grind ? venueFor(resuming ? kept.venue : profile.career.venue) : null;
  const boss = room ? bossFor(room.boss) : null;
  // Which of the stop's tables this is. The same lobby the stop screen showed:
  // it is made from the stop and the count of sittings, not from a die.
  const lobby = grind || (regatta && !bubble) ? lobbyFor(room, profile.sittings) : null;
  const seat = lobby ? (regatta ? lobby.tables[0] : lobby.tables.find((x) => x.id === params.table) || lobby.tables[0]) : null;
  const ownerHere = duel || !seat || seat.owner;
  const opponents = duel ? [room.resident] : seat ? seat.styles.slice() : pickOpponents(seats - 1, rng);
  const bubbleDeal = bubble ? bubbleStacks(rng) : null;
  const story = duel ? storyFor(room.key) : null;
  // The bubble is practice against whoever is about: nobody owns it.
  const bossIndex = boss && ownerHere && !bubble ? 0 : -1;
  const bossId = bossIndex >= 0 ? `bot${bossIndex}` : null;
  // The Rival, if she is at this table: one seat, and a memory that is hers
  // and lasts between sittings.
  const rivalIndex = seat && seat.rivalSeat !== undefined ? seat.rivalSeat : -1;
  const rivalId = rivalIndex >= 0 ? `bot${rivalIndex}` : null;
  const rivalMemory = rivalId ? profile.rival.memory : null;
  const firstMeeting = rivalId && !resuming ? profile.noteRivalMet() : false;
  // A stranger passing through, if one is at this table.
  const wandererIndex = seat && seat.wandererSeat !== undefined ? seat.wandererSeat : -1;
  const wanderer = wandererIndex >= 0 ? wandererFor(seat.styles[wandererIndex]) : null;
  const wandererId = wanderer ? `bot${wandererIndex}` : null;
  // Whose face each seat wears: the boss's own, the Rival's, or the style's regular.
  const faces = Object.fromEntries(opponents.map((key, i) => [`bot${i}`, i === bossIndex ? boss.key : i === rivalIndex ? RIVAL.key : i === wandererIndex ? wanderer.key : key]));
  const table = createTable({
    variant: variantKey,
    smallBlind: bigBlind / 2,
    bigBlind,
    rng,
    lastStreet: lesson ? lesson.lastStreet : 'river',
    players: [
      { id: HERO_ID, name: 'You', stack: bubble ? bubbleDeal[0] : resuming ? kept.chips : startingStack, isHero: true },
      ...opponents.map((key, i) => {
        const p = getProfile(key);
        return {
          id: `bot${i}`,
          name: i === bossIndex ? boss.short : i === rivalIndex ? RIVAL.short : i === wandererIndex ? wanderer.short : p.name,
          stack: bubble ? bubbleDeal[i + 1] : startingStack,
          profile: key,
          memory: i === rivalIndex ? rivalMemory : null,
        };
      }),
    ],
  });

  // Short stacks in a tournament shove or fold; the ordinary bot has nothing to say at ten big blinds.
  table.pushFold = regatta;

  // Who is watching, and how awake they are. Both live on the table because
  // that is what botAction and the hand-reading engine are handed, and one of
  // them reading a different answer than the other is the bug this whole
  // feature would otherwise be made of.
  // In a duel the owner is paying attention: they read you as a player three
  // ranks above the one you are.
  table.readerLevel = duel ? Math.min(10, profile.level + 3) : profile.level;

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
    buyInsUsed: grind ? (resuming ? kept.buyInsUsed : 1) : 0,
    // Of those, how many were paid in pearls, and what they cost: the money in
    // and out of a sitting stays money, and a refund goes back the way it came.
    pearlSeats: grind ? (resuming ? kept.pearlSeats || 0 : payPearls ? 1 : 0) : 0,
    pearlsSpent: grind && payPearls && !resuming ? pearlPrice : 0,
    entryPearls: regatta && !bubble && payPearls ? pearlPrice : 0,
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
    // The reference drawer: which tab, and whether it is open. It survives
    // the hand so it can be left up the way a chart on your desk would be.
    sheet: null,
    // A lesson is a fixed run of spots with a report at the end, not an
    // endless table: without a last hand there is no moment where anyone
    // says how it went.
    run: lesson ? startRun(params.lesson) : null,
    // A duel: hands dealt, the blind level, and how it ended (null while it runs).
    matchHands: bubble ? BUBBLE_START_HAND : 0,
    // Hands dealt in this match, whatever hand number its clock started from.
    dealt: 0,
    matchLevel: -1,
    matchOver: null,
    // A regatta: who had gone out and where they finished, and how many were alive at the deal.
    finished: {},
    aliveAtStart: 0,
    // Whether the Rival has said hello this sitting.
    rivalGreeted: false,
    wandererGreeted: false,
    // The countdown to the next hand, when the table deals itself:
    // { total, started, timer } while it runs, null otherwise.
    autoDeal: null,
    // What somebody at the table is saying, and for how long.
    speech: null,
    speechTimer: null,
    // Cards on the board already announced with a sound.
    boardHeard: 0,
    // Hands dealt silently while a lesson looks for its spot make no noise.
    quiet: false,
    // Help, asked for on this decision only: whether the drawer is open, which
    // companion it opened on, and whether this decision has been helped at
    // all — which costs it its pearl and its credit.
    helpOpen: false,
    helpFocus: null,
    helped: false,
    // Silas's notes: every decision as graded, whether or not he said so.
    graded: [],
    // What Silas said about your last few decisions, newest first: the next
    // verdict replaces the box before there is time to read it, so the ones
    // before it stay underneath.
    said: [],
    pearls: { hands: 0, decisions: 0, bonus: 0, boat: 0, bounty: 0, catches: 0 },
    // The Catch Book: fish hooked this hand, waiting on how it ends.
    hooked: [],
    // The pearls each opponent carries, taken once by knocking them out.
    bounties: {},
    stacksAtStart: {},
    // What the boat's strongbox still owes, a fraction of a pearl at a time.
    boatCarry: 0,
    // The same for a short-handed table's half share.
    shareCarry: 0,
    savedHandIds: [],
    showLog: false,
  };
  // The same object, not a copy: the opponents read what the reader does.
  table.readerMemory = session.readerMemory;
  if (grind && !resuming) {
    if (payPearls) profile.spendPearls(pearlPrice);
    else profile.setBankroll(profile.data.bankroll - buyInCost);
  }
  // The entry is paid before the first card, and the prize comes back at the end.
  if (regatta && !bubble) {
    if (payPearls) {
      profile.spendPearls(pearlPrice);
      profile.setBankroll(profile.data.bankroll, room.key);
    } else profile.setBankroll(profile.data.bankroll - room.entry, room.key);
  }
  // What the entry cost in money: nothing, when it was paid in pearls.
  const moneyEntry = regatta && !bubble && !session.entryPearls ? room.entry : 0;

  const hero = table.player(HERO_ID);

  /**
   * What is on this table, in the save: the chips behind you at a cash table
   * (never the ones in the pot, so getting up mid-hand folds it), or the entry
   * paid for a Regatta. Written after everything you do, so a closed tab costs
   * no more than getting up would.
   */
  function keepTheSeat() {
    if (session.cancelled) return;
    if (grind) {
      keepSeat(profile, {
        mode: 'grind', venue: room.key, table: seat.id, chips: hero.stack, bigBlind, buyIn: stake.buyIn, buyInsUsed: session.buyInsUsed,
        pearlSeats: session.pearlSeats,
      });
      profile.save();
    } else if (regatta && !bubble && !session.matchOver) {
      keepSeat(profile, { mode: 'regatta', venue: room.key, entry: room.entry, dealt: session.dealt, pearls: session.entryPearls });
      profile.save();
    }
  }
  keepTheSeat();
  // A lesson table is a chapter, and a duel is a fight for the table: neither
  // pays pearls by the hand, and nobody at them carries a bounty.
  const pays = !lesson && !match;
  if (pays) {
    for (const p of table.players) {
      if (p.isHero) continue;
      // A stranger passing through carries a purse twice an owner's: they are not staying.
      const owner = p.id === bossId || p.id === rivalId || p.id === wandererId;
      session.bounties[p.id] = seatBounty(room ? room.index : null, owner) * (p.id === wandererId ? 2 : 1);
    }
  }
  const feltHost = el('div');
  const actionHost = el('div');
  // Silas's notebook, beside the table: paper, so everything he writes in it
  // takes the book's ink.
  const coachHost = el('div.coach.paper');
  const lessonNoteHost = el('div');
  const matchHost = el('div');
  const leaveLabel = duel ? 'Forfeit' : bubble ? 'Leave' : regatta ? 'Withdraw' : grind ? 'Cash out' : 'Leave table';
  const leaveButton = el('button.btn.sm.ghost', { onclick: () => leave() }, leaveLabel);
  // At the owner's table, until it is yours: what taking it asks, and how close you are.
  const canTake = grind && ownerHere && !profile.career.beaten.includes(room.key);
  const takeHost = el('div.take-host');
  // Under the felt: the help button, your companions, what this sitting has
  // paid so far — and the drawer they open.
  const trayHost = el('div.tray-host');
  const helpHost = el('div.help-host');
  const coachToggle = el('button.btn.sm.ghost.coach-toggle', { onclick: () => setLiveCoach(!profile.settings.liveCoach) });
  // Free play: Silas stands beside the felt, quiet about your decisions,
  // with one of his rules. A tap for another. Only where there is room.
  let ruleAt = Math.floor(Math.random() * RULES.length);
  const standHost = el('aside.silas-stand', { 'aria-label': t('Silas, your guide') });
  const drawStand = () => mount(standHost,
    el('div.stand-bubble', t(RULES[ruleAt % RULES.length])),
    el('button.stand-figure', {
      type: 'button',
      title: t('Another word'),
      'aria-label': t('Another word from Silas'),
      onclick: () => { ruleAt += 1; drawStand(); },
    }, svgNode(silasFigure(118), 'guide-figure')),
  );
  drawStand();
  const wrap = el(`div.table-wrap${liveCoach() ? '.with-coach' : '.free-play'}`,
    // Silas stands in the table's own column, so a short screen that puts
    // the buttons beside the felt puts him with them.
    el('div.table-main', el('div.saloon-stage', lampNode(), feltHost), actionHost, trayHost, helpHost, liveCoach() ? null : standHost),
    liveCoach() ? coachHost : null);
  // The sign over the table, built again if the language changed while the
  // table waited: everything else on it is drawn fresh each time anyway.
  const tableHead = () => el('div.spread.table-head',
    duel
      ? el('div.row',
        el('h1.sign.table-place', { style: { margin: 0 } }, t('{name}\'s duel', { name: boss.short })),
        el('span.scene-stake', t(room.name)),
        el('span.table-owner', t('Heads-up, to the last chip')),
      )
    : bubble
      ? el('div.row',
        el('h1.sign.table-place', { style: { margin: 0 } }, t('The bubble')),
        el('span.scene-stake', t('Practice')),
        el('span.table-owner', t('Four left, three are paid. Nothing is entered and nothing is won.')),
      )
    : regatta
      ? el('div.row',
        el('h1.sign.table-place', { style: { margin: 0 } }, t('Regatta at {place}', { place: t(room.name) })),
        el('span.scene-stake', room.label),
        el('span.table-owner', t('Six players, the top three are paid')),
      )
    : grind
      ? el('div.row',
        el('h1.sign.table-place', { style: { margin: 0 } }, t(room.name)),
        el('span.scene-stake', room.label),
        el('span.table-owner', ownerHere ? t('{name}\'s table', { name: boss.short }) : t(seat.name)),
      )
      : el('div.row',
        el('h1.sign.table-place', { style: { margin: 0 } }, lessonMeta ? t(lessonMeta.name) : t('Silas\'s practice table')),
        el('span.scene-stake', lesson ? t('Lesson table') : VARIANTS[variantKey].short,
          !lesson && seats < 6 ? el('span.size-suffix', ` · ${t(SIZE_NAMES[seats])}`) : null),
        lesson ? null : el('span.table-owner', t('No money on it — just hands.')),
      ),
    el('div.row',
      canTake ? takeHost : null,
      !grind && !lesson && !match ? variantSwitcher(variantKey, seats, go) : null,
      !grind && !lesson && !match ? sizeSwitcher(variantKey, seats, go) : null,
      lesson ? null : coachToggle,
      lesson
        ? el('button.btn.sm.ghost', { onclick: () => go('walkthrough', { module: params.lesson }) },
          t('Read the lesson'))
        : null,
      leaveButton,
    ),
  );
  let head = tableHead();
  let headLang = getLang();
  const root = el('div.screen',
    head,
    // What has been taken away, and why. A table with two seats and a hand
    // that stops on the flop is not the game — saying so is the difference
    // between a simplification and a lie.
    lesson ? lessonNoteHost : null,
    match ? matchHost : null,
    wrap,
  );
  root.classList.add('saloon');

  /** Silas out loud, or free play: flipped in place, mid-session. */
  function setLiveCoach(on) {
    profile.updateSettings({ liveCoach: on });
    wrap.classList.toggle('free-play', !on);
    wrap.classList.toggle('with-coach', on);
    if (on && !coachHost.isConnected) wrap.appendChild(coachHost);
    if (!on && coachHost.isConnected) coachHost.remove();
    if (on && standHost.isConnected) standHost.remove();
    if (!on && !standHost.isConnected) wrap.querySelector('.table-main').appendChild(standHost);
    draw();
  }
  function drawCoachToggle() {
    const on = Boolean(profile.settings.liveCoach);
    mount(coachToggle, icon(on ? 'coach' : 'help', { size: 14 }), ' ',
      on ? t('Silas: at my shoulder') : t('Silas: quiet'));
    coachToggle.title = on
      ? t('Silas grades every decision as you make it. Click for free play.')
      : t('Free play: Silas says nothing unless you ask, and leaves notes for when you get up.');
  }

  /** Look away: the table stops where it is, and waits. */
  function park() {
    if (session.cancelled) return;
    session.parked = true;
    stopCountdown();
    clearTimeout(session.timer);
    clearTimeout(session.speechTimer);
    session.speech = null;
  }

  /** End it for good: a lesson left, or a practice table let go for another. */
  function discard() {
    park();
    session.cancelled = true;
    if (live && live.key === key) live = null;
  }

  /** Back to the table: everything as it was, and the hand carries on. */
  function resume(next) {
    next.onLeave = park;
    session.parked = false;
    if (headLang !== getLang()) {
      headLang = getLang();
      mount(leaveButton, leaveLabel);
      const fresh = tableHead();
      head.replaceWith(fresh);
      head = fresh;
    }
    draw();
    if (session.matchOver) return root;
    if (session.handStarted && !table.handOver) step();
    else if (table.handOver && table.result && !session.handStarted) armAutoDeal(table.result);
    return root;
  }

  // The way back to exactly this table, from anywhere: the stop it is at and
  // the seat in its lobby, and none of the one-off flags that brought you here.
  const backParams = Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'resume' && k !== 'cashout' && k !== 'pay'));
  if (grind) Object.assign(backParams, { at: room.key, table: seat.id });

  ctx.onLeave = lesson ? discard : park;
  if (!lesson) {
    live = {
      key,
      mode: grind ? 'grind' : duel ? 'duel' : bubble ? 'bubble' : regatta ? 'regatta' : 'free',
      closed: false,
      // Money or a match rides on it: sitting down elsewhere waits until it is dealt with.
      holds: () => !session.matchOver && (grind || duel || (regatta && !bubble)),
      finished: () => Boolean(session.matchOver),
      place: () => (grind
        ? (ownerHere ? t(room.name) : `${t(room.name)} · ${t(seat.name)}`)
        : duel ? t('{name}\'s duel', { name: boss.short })
          : regatta ? (bubble ? t('The bubble') : t('Regatta at {place}', { place: t(room.name) }))
            : t('Silas\'s practice table')),
      money: () => (grind ? chipsValue(hero.stack, bigBlind, stake.buyIn) : null),
      back: () => go('play', backParams),
      getUp: () => leave(),
      getUpLabel: leaveLabel,
      resume,
      discard,
    };
  }

  /* ---------------- sound and voices ---------------- */

  const sound = (name) => { if (!session.quiet) audio.sfx(name); };

  /** The sound of an action landing: cards thrown away, a knock, chips. */
  function actionSound(action, player) {
    if (player && player.allIn && action.type !== 'fold' && action.type !== 'check') return sound('allin');
    sound({ fold: 'fold', check: 'check', call: 'chip', bet: 'chips', raise: 'chips' }[action.type]);
  }

  /** New cards on the board get dealt out loud: three at once, or one. */
  function boardSound() {
    const n = table.board.length;
    if (n <= session.boardHeard) return;
    const fresh = n - session.boardHeard;
    session.boardHeard = n;
    sound(fresh >= 3 ? 'flop' : 'card');
  }

  /** Somebody says something, by their seat, for a few seconds. */
  function say(id, text, ms = 3800) {
    if (!id || !text || session.quiet) return;
    const line = { id, text };
    session.speech = line;
    clearTimeout(session.speechTimer);
    session.speechTimer = setTimeout(() => {
      if (session.speech !== line) return;
      session.speech = null;
      if (!session.cancelled) drawFelt();
    }, ms);
  }

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  /* ---------------- flow ---------------- */

  function log(line, isStreet = false) {
    session.logLines.push({ line, isStreet });
    if (session.logLines.length > 120) session.logLines.shift();
  }

  /**
   * The Rival says hello over the first hand of a sitting. The very first
   * time the two of you meet it is a scene, not a line.
   */
  function greetTheRival() {
    session.rivalGreeted = true;
    if (firstMeeting) {
      toast({ icon: '🧢', title: t('{name} sits down', { name: RIVAL.name }), desc: t(RIVAL.intro), duration: 11000 });
    }
    say(rivalId, t(pick(RIVAL.hello)), 4200);
  }

  /**
   * The stranger says hello — after the Rival, if she is here too, so the two
   * do not talk over each other. The first time a kind of stranger is met it
   * is a scene.
   */
  function greetTheWanderer() {
    session.wandererGreeted = true;
    const key = `wanderer-${wanderer.key}`;
    if (!profile.seenScene(key)) {
      profile.markScene(key);
      toast({ icon: '🎩', title: t('{name} sits down', { name: wanderer.name }), desc: t(wanderer.intro), duration: 11000 });
    }
    setTimeout(() => { if (!session.cancelled) say(wandererId, t(pick(wanderer.hello)), 4200); }, rivalId ? 4500 : 0);
  }

  /**
   * The blind clock: each hand of a duel is dealt at the blinds its place in
   * the match calls for, and the first hand of a new level says so out loud.
   */
  function advanceBlinds() {
    const b = (regatta ? regattaBlinds : blindsFor)(session.matchHands);
    table.smallBlind = b.small;
    table.bigBlind = b.big;
    stats.bigBlind = b.big;
    if (b.level !== session.matchLevel) {
      if (session.matchLevel >= 0) {
        log(t('The blinds go up: {small} / {big}', { small: b.small, big: b.big }), true);
        sound('chips');
      }
      session.matchLevel = b.level;
    }
    session.matchHands++;
    session.dealt++;
    // The owner's opening line, once, over the first hand.
    if (duel && session.dealt === 1) say(bossId, t(story.challenge), 5200);
    if (regatta && !bubble && session.dealt === 1 && bossId) say(bossId, t(boss.hello), 5200);
  }

  function startHand() {
    if (session.cancelled) return;
    stopCountdown();
    // A lesson is not a bankroll test. Busting out of one would end the
    // teaching over a variance run, so the seat is simply refilled.
    if (lesson && hero.stack <= 0) hero.stack = startingStack;
    if (hero.stack <= 0) { draw(); return null; }
    if (table.players.filter((p) => p.stack > 0).length < 2) return topUpBots();

    if (match) advanceBlinds();
    session.aliveAtStart = table.players.filter((p) => p.stack > 0).length;
    if (rivalId && !session.rivalGreeted) greetTheRival();
    if (wandererId && !session.wandererGreeted) greetTheWanderer();
    table.startHand();
    stats.startHand();
    // The blinds are in: what is behind you now is what the seat holds.
    keepTheSeat();
    // Who had chips when the cards were dealt, so a bust is counted once.
    session.stacksAtStart = Object.fromEntries(table.players.map((p) => [p.id, p.stack + p.committed]));
    session.recorder = new HandRecorder(table, HERO_ID, {
      source: grind ? 'grind' : 'play',
      stake: grind ? stake.key : null,
    });
    session.handStarted = true;
    session.acts = { bets: 0, raises: 0, calls: 0, folds: 0 };
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
    session.hooked = [];
    log(t('— Hand #{n} —', { n: table.handNumber }), true);
    session.boardHeard = 0;
    sound('shuffle');
    setTimeout(() => { if (!session.cancelled) sound('deal'); }, 380);
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
    session.quiet = true;
    try {
      return searchQuietly();
    } finally {
      session.quiet = false;
      session.boardHeard = table.board.length;
    }
  }

  function searchQuietly() {
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
    session.hooked = [];
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
      const auto = autopilotAction(table, actor, lesson, rng);
      applyHeroAuto(auto);
      actionSound(auto, actor);
      boardSound();
      draw();
      step();
    }, Math.round(BOT_DELAY / 2));
    return null;
  }

  function step() {
    if (session.cancelled || session.parked) return;
    if (table.handOver) return endHand();

    const actor = table.actor;
    if (!actor) return endHand();

    if (actor.isHero) {
      session.snapshot = takeSnapshot();
      // Asking for a read before the buttons is the coach talking. In free
      // play nobody stops you to ask.
      session.read = liveCoach() ? readPrompt() : null;

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
      session.helped = false;
      session.helpOpen = false;
      session.helpFocus = null;
      sound('nudge');
      draw();
      return null;
    }

    session.timer = setTimeout(() => {
      if (session.cancelled || session.parked || table.handOver) return;
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
      actionSound(action, actor);
      boardSound();
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
  const takeSnapshot = () => {
    const snap = snapshotOf(table, hero, {
      rng, aggressor: session.aggressor, opener: session.opener, ranges: session.ranges,
      // A lesson table is cut to its lesson and teaches the chart's own spots at
      // whatever size it is; free play is graded for the table it was dealt; a
      // tournament table is however many are left in it.
      seats: lesson ? 6 : regatta ? Math.max(2, table.players.filter((p) => p.stack + p.committed > 0).length) : seats,
    });
    if (regatta) snap.tournament = tournamentOf();
    return snap;
  };

  /**
   * The tournament as the coach needs it to count the prizes: every seat still
   * in, what each has behind and has posted, who raised, who is left to act
   * after the reader, and what each place pays.
   */
  function tournamentOf() {
    const inPlay = table.players.filter((p) => p.stack + p.committed > 0);
    const at = (p) => inPlay.indexOf(p);
    const raiser = table.lastAggressor && table.lastAggressor !== hero ? at(table.lastAggressor) : -1;
    const n = table.players.length;
    const behind = [];
    for (let k = 1; k < n; k++) {
      const p = table.players[(hero.seat + k) % n];
      if (!p.folded && !p.sittingOut && at(p) >= 0) behind.push(at(p));
    }
    return {
      stacks: inPlay.map((p) => p.stack),
      committed: inPlay.map((p) => p.committed),
      hero: at(hero),
      villain: raiser >= 0 ? raiser : null,
      payouts: regattaPayouts(prizeEntry),
      profiles: inPlay.map((p) => (p.isHero ? null : profileAt(table, p))),
      behind,
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
  function recordLearning(verdict, helped = false) {
    const id = verdict.concept.id;
    const right = verdict.level !== 'bad';
    const meta = moduleMeta(id);
    session.learned.push({ id, name: meta ? meta.name : id, right, helped });
    session.decisions.total++;
    if (right) session.decisions.right++;
    // A decision made with help still happened, and still shows in the hand
    // — but it is not evidence of what you know, the same rule every drill
    // applies to an answer read off the chart.
    if (helped) return;
    profile.recordDrill(id, right);
    review(profile, id, right);
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
    // The Rival counts too, and what she counts is kept.
    if (rivalMemory) rivalRemembers(rivalMemory, { facingBet: snap.toCall > 0, action: action.type });
    const verdict = judgeSpot({ ...snap, action: action.type, amount: action.amount });
    // A size taken from Silas's button is his: right, and not counted as yours.
    if (verdict.size) verdict.size.helped = Boolean(session.silasPicked && action.amount === session.silasTarget);
    // What the decision counts as: the worse of the action and its size.
    const said = overall(verdict);
    session.verdict = verdict;
    session.said.unshift({ verdict, street: table.street, action: action.type, hand: table.handNumber });
    if (session.said.length > SAID_KEPT) session.said.length = SAID_KEPT;
    const helped = session.helped || session.peeked;
    // The skill is the action's: a size has no chapter to be marked against.
    recordLearning(verdict, helped);
    // Into Silas's notes, said out loud or not; and the pearl, if it earned one.
    session.graded.push({
      skill: verdict.concept.id,
      level: said.level,
      street: table.street,
      action: action.type,
      helped,
      head: said.head,
      costBb: said.cost ? said.cost / table.bigBlind : 0,
      hand: table.handNumber,
      handId: null,
      // What was said, kept whole for your character's hand rating: why it was
      // wrong, and what was right instead.
      id: said.id || null,
      body: said.body || null,
      better: said.better || null,
      params: said.params || {},
      // How much, apart from whether: for your character's bet sizes.
      size: verdict.size ? { kind: verdict.size.sizeKind, verdict: verdict.size.verdict, helped: verdict.size.helped } : null,
      // The spot, for the cat to know it again.
      position: snap.position || null,
      facing: facingOf(snap, table.street),
    });
    // Silas's contracts count sound decisions at a real table, for the skill they name.
    if (pays) payContracts(noteContract(profile, { type: 'decision', skill: verdict.concept.id, level: said.level, helped }));
    // The Catch Book: a spot played right hooks the fish that lives in it.
    // Some only come in if the hand ends the right way; endHand says.
    if (pays) {
      const caughtHere = bites({
        street: table.street, action: action.type, concept: verdict.concept.id, level: said.level,
        helped, position: snap.position, firstIn: snap.firstIn, toCall: snap.toCall, seats: lesson ? 6 : seats,
      }, room ? room.index : null);
      for (const key of caughtHere) session.hooked.push({ key, pot: snap.pot });
    }
    const earned = !pays ? 0 : paidForTable(decisionPearls({ level: said.level, street: table.street, action: action.type, helped }));
    if (earned) {
      session.pearls.decisions += earned;
      const extra = fromTheStrongbox(earned);
      profile.earnPearls(earned + extra);
      pearlPop(earned + extra, trayHost);
    }
    session.helpOpen = false;
    session.helpFocus = null;
    // Only the lesson's own spots count toward the run. A hand where the
    // autopilot handed you a decision that belongs to another module would
    // otherwise be marked against a lesson that never asked it.
    if (session.run && !runComplete(session.run)) {
      recordSpot(session.run, verdict);
      if (runComplete(session.run)) finishRun();
    }
    if (action.type === 'bet' || action.type === 'raise') session.aggressor[table.street] = HERO_ID;
    stats.recordDecision({ kind: action.type, verdict: said.level, street: table.street });
    stats.recordAction(table.street, action.type, { facingRaise: snap.toCall > table.bigBlind });
    if (table.street !== 'preflop') stats.markStreet(table.street);
    // For your career's aggression: bets, raises and calls after the flop, the
    // way a HUD counts them, and every fold.
    if (session.acts) {
      if (action.type === 'fold') session.acts.folds++;
      else if (table.street !== 'preflop' && session.acts[`${action.type}s`] !== undefined) session.acts[`${action.type}s`]++;
    }

    const label = describeAction(action, table, hero, null);
    session.recorder.act(table, action, snap);
    // What you put in is in the pot: if you get up now, it stays there.
    keepTheSeat();
    log(label);
    actionSound(action, hero);
    boardSound();
    draw();
    step();
  }

  function endHand() {
    const result = table.result;
    if (!result || !session.handStarted) return;
    session.handStarted = false;
    // Kept only if there is something to learn from it — a mistake, or a big
    // loss that was nobody's fault. keepHand decides; see state/handHistory.
    // A tournament hand is graded with the prizes counted, which a saved hand cannot be asked again
    // (the log re-grades from what it kept, and would grade a shove on chips). So it is not kept.
    session.savedHand = regatta ? null : keepHand(session.recorder.finish(table));

    const net = result.net[HERO_ID] || 0;
    const showdown = result.reason === 'showdown';
    const won = (result.payouts[HERO_ID] || 0) > 0;
    // Still in at the end: you saw every street the hand reached. A hand you
    // folded has already marked the streets you acted on, and no more — it
    // used to mark the flop for a hand you folded before it, because the
    // others went on to see one.
    if (!hero.folded) stats.markStreet(table.street);
    // What the hand was, before the sitting's numbers fold it into their totals.
    const thisHand = { ...stats.currentHand };
    // Going to showdown means being in it. The table's reason says only that
    // somebody was: a hand you folded and two others took to the river used to
    // count as one of yours, and Silas could tell a player who folds nearly
    // everything that they went to showdown far too often.
    const heroInShowdown = showdown && result.showdown.some((s) => s.id === HERO_ID);
    stats.endHand({ net, showdown: heroInShowdown, won, potSize: result.pots.reduce((s, p) => s + p.amount, 0) });

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
    // Your career (the Character screen): every hand at a real table. Saved with the count below.
    if (!lesson) noteForTheRecord(result, thisHand, { net, showdown, won, potTotal });
    if (!lesson || session.playedByReader) {
      profile.data.handsPlayed++;
      profile.save();
    }
    keepTheSeat();
    // Doubled at the owner's table: say so once, while the button is right there.
    if (canTake && !session.saidDoubled && doublingTarget(hero.stack, bigBlind, stake.buyIn).reached) {
      session.saidDoubled = true;
      toast({
        icon: '🏆',
        title: t('You have doubled your buy-in'),
        desc: t('Cash out now and {place} is yours: {name} hands over the table.', { place: t(room.name), name: boss.short }),
        duration: 9000,
      });
    }
    // The road asks for hands at this stop's own table.
    if (grind || regatta) profile.noteHandAt(room.key);
    // A pearl for the hand — more at the stops further down the river. A
    // lesson table pays in XP only: it is a chapter, not a game.
    if (pays) {
      // A hand you folded before the flop was not played through: folding is
      // the default, and a table that paid for it paid the most for the least.
      const mine = session.graded.filter((d) => d.hand === table.handNumber);
      const played = playedThrough(mine);
      // A hand folded before the flop neither counts toward a run of clean hands nor breaks it.
      if (played) payContracts(noteContract(profile, { type: 'hand', clean: mine.every((d) => d.level !== 'bad' && !d.helped) }));
      const paid = played ? paidForTable(handPearls(room ? room.index : null)) : 0;
      session.pearls.hands += paid;
      const extra = fromTheStrongbox(paid);
      profile.earnPearls(paid + extra);
      pearlPop(paid + extra, trayHost);
      collectBounties(result);
      landFish(landed(session.hooked.map((h) => h.key), { heroWon: won, showdown }), potTotal);
    }
    // The notes point at the replay of any hand that was kept.
    if (session.savedHand) {
      session.savedHandIds.push(session.savedHand.id);
      for (const d of session.graded) if (d.hand === table.handNumber) d.handId = session.savedHand.id;
    }

    // The river runs out loud if everybody was all in before it was dealt.
    boardSound();
    if (won) sound('win');
    else if (heroInShowdown) sound('lose');

    // The owner of the table has something to say about big pots.
    if (bossId) {
      const bossWon = (result.payouts[bossId] || 0) > 0;
      const bossShowed = showdown && result.showdown.some((s) => s.id === bossId);
      if (bossWon && (bossShowed || potTotal >= table.bigBlind * 20)) say(bossId, t(pick(boss.brag)));
      else if (bossShowed && won) say(bossId, t(pick(boss.sore)));
    }

    if (wandererId && !session.speech) {
      const wonIt = (result.payouts[wandererId] || 0) > 0;
      const showed = showdown && result.showdown.some((s) => s.id === wandererId);
      if (wonIt && (showed || potTotal >= table.bigBlind * 20) && Math.random() < 0.5) say(wandererId, t(pick(wanderer.brag)));
      else if (showed && won && Math.random() < 0.5) say(wandererId, t(pick(wanderer.sore)));
    }
    // The Rival has her own opinion of a big pot, said less often than the owner's.
    if (rivalId && !session.speech) {
      const rivalWon = (result.payouts[rivalId] || 0) > 0;
      const rivalShowed = showdown && result.showdown.some((s) => s.id === rivalId);
      if (rivalWon && (rivalShowed || potTotal >= table.bigBlind * 20) && Math.random() < 0.5) say(rivalId, t(pick(RIVAL.brag)));
      else if (rivalShowed && won && Math.random() < 0.5) say(rivalId, t(pick(RIVAL.sore)));
    }

    const heroShow = result.showdown.find((s) => s.id === HERO_ID);
    const events = {
      type: 'hand',
      // A duel starts with the stacks to double and ends with them: not a session you doubled in.
      doubledUp: !match && hero.stack >= startingStack * 2,
      bustedOpponent: table.players.some((p) => !p.isHero && p.stack === 0),
      madeRoyal: heroShow && categoryOf(heroShow.score) === CAT.STRAIGHT_FLUSH && (heroShow.score & 0xf0000) >> 16 === 14,
      madeQuads: heroShow && categoryOf(heroShow.score) === CAT.QUADS,
      heroCall: won && showdown && session.verdict && session.verdict.kind === 'call',
    };
    checkAchievements(profile, events).forEach((a) => toast({ icon: a.icon, title: a.name, desc: a.description }));

    if (duel) {
      const over = duelOver(hero.stack, table.player(bossId).stack);
      if (over.over) finishDuel(over.won);
    }
    if (regatta) tallyRegatta();
    // Armed before the draw, so the bar is drawn with its countdown running.
    armAutoDeal(result);
    draw();

  }

  /**
   * What a hand says about you, for the Character screen (state/lifetime.js).
   *
   * Where the chips went is shared out by who they came from: a pot you won
   * was paid for by the players who lost chips in it, each in proportion to
   * what they lost, and a pot you lost went to its winners the same way. That
   * is what "your favourite victim" means: whose chips ended up in your stack.
   *
   * The style numbers (VPIP and the rest) only count at a full Hold'em cash
   * table — five or more dealt in — since short-handed, Omaha and tournament
   * poker are different games where every number reads differently.
   */
  function noteForTheRecord(result, h, { net, showdown, won, potTotal }) {
    const bb = table.bigBlind;
    const mode = duel ? 'duel' : regatta ? 'regatta' : 'cash';
    const heroShow = showdown ? result.showdown.find((s) => s.id === HERO_ID) : null;
    let made = null;
    if (heroShow) {
      const score = standardScore(heroShow.score, table.variant.shortDeck);
      const cat = categoryOf(score);
      made = { score, cat, royal: cat === CAT.STRAIGHT_FLUSH && ((score >> 16) & 15) === 14 };
    }
    // Won without a showdown, holding nothing: the bluff that worked.
    let bluff = false;
    if (won && !showdown && table.board.length >= 3) {
      const mine = evaluateHand(hero.hole, table.board, table.variant);
      bluff = categoryOf(standardScore(mine, table.variant.shortDeck)) === CAT.HIGH_CARD;
    }
    const who = (p) => (p.id === rivalId ? RIVAL.key : typeof p.profile === 'string' ? p.profile : getProfile(p.profile).key);
    const others = table.players.filter((p) => !p.isHero && (result.net[p.id] || 0) !== 0);
    const counter = others.filter((p) => (net > 0 ? result.net[p.id] < 0 : result.net[p.id] > 0));
    const total = counter.reduce((s, p) => s + Math.abs(result.net[p.id]), 0);
    const opponents = net === 0 || !total ? [] : counter.map((p) => ({
      who: who(p),
      // Positive: they took chips off you. Negative: you took them off them.
      netBb: (-net * (Math.abs(result.net[p.id]) / total)) / bb,
    }));
    const mine = session.graded.filter((d) => d.hand === table.handNumber);
    const { decisions, sound } = soundShare(mine);
    const handId = session.savedHand ? session.savedHand.id : null;
    const acts = session.acts || { bets: 0, raises: 0, calls: 0, folds: 0 };
    profile.noteLifetimeHand({
      mode,
      full: mode === 'cash' && variantKey === 'holdem' && seats >= 6 && session.aliveAtStart >= 5,
      key: hero.hole.length === 2 ? handKey(hero.hole) : null,
      position: hero.position,
      vpip: Boolean(h.voluntary),
      pfr: Boolean(h.raisedPreflop),
      threeBet: Boolean(h.threeBet),
      threeBetChance: Boolean(h.threeBetChance),
      sawFlop: Boolean(h.sawFlop),
      showdown: Boolean(heroShow),
      won,
      netBb: net / bb,
      potBb: potTotal / bb,
      bets: acts.bets,
      raises: acts.raises,
      calls: acts.calls,
      folds: acts.folds,
      allIn: Boolean(hero.allIn),
      made,
      bluff,
      decisions,
      sound,
      graded: mine.map((d) => ({ ...d, handId })),
      opponents,
      at: Date.now(),
      where: bubble ? 'bubble' : room ? room.key : 'practice',
    });
  }

  /**
   * Take the bounty off anybody you knocked out this hand: a player who sat
   * down with chips, has none now, and was in a pot you won. It pays on how
   * you played the hand, not on the card that fell — all of it with every
   * decision sound, half with one mistake or one helped decision, nothing
   * with two. Either way the bounty is gone: they are bust, and whoever
   * busted them — you or another seat — took it off them.
   */
  function collectBounties(result) {
    const heroWon = (result.payouts[HERO_ID] || 0) > 0;
    const mine = session.graded.filter((d) => d.hand === table.handNumber);
    const mistakes = mine.filter((d) => d.level === 'bad' || d.helped).length;
    for (const p of table.players) {
      const bounty = session.bounties[p.id] || 0;
      if (p.isHero || !bounty || p.stack > 0 || !(session.stacksAtStart[p.id] > 0)) continue;
      session.bounties[p.id] = 0;
      const shared = heroWon && result.pots.some((pot) => pot.eligible.includes(p.id) && pot.eligible.includes(HERO_ID));
      if (!shared) continue;
      // The legend of the Catch Book: an owner knocked out by a clean hand.
      if (p.id === bossId && mistakes === 0) session.hooked.push({ key: 'pike', pot: 0 });
      const paid = bountyPaid(bounty, mistakes);
      if (paid) {
        session.pearls.bounty += profile.earnPearls(paid);
        pearlPop(paid, trayHost);
      }
      const line = mistakes === 0
        ? t('You knocked {name} out and took the bounty: {n} pearls.', { name: p.name, n: paid })
        : mistakes === 1
          ? t('You knocked {name} out, but one decision in that hand was a mistake: half the bounty, {n} pearls.', { name: p.name, n: paid })
          : t('You knocked {name} out, but with {n} mistakes in that hand. No bounty for a lucky card.', { name: p.name, n: mistakes });
      log(line, true);
      toast({ icon: paid ? pearl(22) : '⚠️', title: paid ? t('Bounty: {n} pearls', { n: paid }) : t('No bounty'), desc: line });
    }
  }

  /**
   * Silas's contracts that this finished: the purse, a line in the log, a toast,
   * and the board filled up again.
   */
  function payContracts(finished) {
    if (!finished.length) return;
    for (const k of finished) {
      const paid = profile.earnPearls(k.reward);
      session.pearls.bonus += paid;
      pearlPop(paid, trayHost);
      const line = contractText(k);
      const text = t(line.text, Object.fromEntries(Object.entries(line.params).map(([n, v]) => [n, typeof v === 'string' ? t(v) : v])));
      log(t('Contract done: {text}', { text }), true);
      toast({ icon: '📜', title: t('Silas\'s contract: done'), desc: `${text} — ${t('{n} pearls', { n: paid })}` });
    }
    ensureContracts(profile, { reach: furthestStop(profile) });
  }

  /**
   * Bring in what the hand landed: into the Catch Book, weighed by the pot
   * it came out of — the pot as it stood when you made the decision, or for
   * a fish only the ending lands (a bluff, a hero call, the pike) the pot
   * you won. The first of a kind pays its water's pearls and says so
   * out loud; a new record says so too; an ordinary catch is a line in the
   * log, because a minnow for every good fold would be a toast every hand.
   */
  function landFish(keys, finalPot) {
    const where = room ? room.name : 'The Saloon';
    for (const key of keys) {
      const species = speciesOf(key);
      const atDecision = Math.max(0, ...session.hooked.filter((h) => h.key === key).map((h) => h.pot || 0));
      const lb = weighIn(species.land || species.special ? finalPot : atDecision, bigBlind);
      const got = profile.landCatch(key, { weight: lb, where });
      if (!got) continue;
      if (got.first) payContracts(noteContract(profile, { type: 'catch', key }));
      const fish = t(species.name);
      const weight = lb.toFixed(1);
      if (got.reward) {
        session.pearls.catches += got.reward;
        pearlPop(got.reward, trayHost);
      }
      log(got.first
        ? t('New in the Catch Book: a {fish}, {lb} lb.', { fish, lb: weight })
        : got.record
          ? t('A record {fish}: {lb} lb.', { fish, lb: weight })
          : t('Caught a {fish}, {lb} lb.', { fish, lb: weight }), true);
      // A record is news when it is a real step up; a few ounces is a line in the log.
      const bigRecord = got.record && lb - got.previous >= 1;
      if (got.first || bigRecord) {
        toast({
          icon: svgNode(fishSvg(species, { width: 44 }), 'toast-fish'),
          title: got.first ? t('New catch: {fish}', { fish }) : t('Record catch: {fish}', { fish }),
          desc: got.first
            ? t('{lb} lb, and {n} pearls for the first of its kind. It is in the Catch Book.', { lb: weight, n: got.reward })
            : t('{lb} lb, the biggest you have landed.', { lb: weight }),
        });
      }
    }
    session.hooked = [];
  }

  /**
   * What this table pays for something a full table would pay `amount` for:
   * a short-handed table pays half, carrying the fraction so half a pearl a
   * hand is paid in full over two hands rather than rounded away each time.
   */
  function paidForTable(amount) {
    const { paid, carry } = scalePearls(session.shareCarry, amount, tableShare(seats));
    session.shareCarry = carry;
    return paid;
  }

  /**
   * The strongbox's share of what the table just paid — a tenth of a pearl
   * on a skiff, a fifth on a launch, more with a heavier box fitted — carried
   * over until it adds up to a whole one.
   */
  function fromTheStrongbox(amount) {
    const { extra, carry } = strongbox(session.boatCarry, amount, boatBonus(profile));
    session.boatCarry = carry;
    session.pearls.boat += extra;
    return extra;
  }

  /** Silas's notes on the sitting, written the moment you get up. */
  function writeReport(cash = null) {
    if (lesson || !stats.hands) return null;
    const report = buildReport({
      place: bubble
        ? { kind: 'practice', key: 'bubble', name: 'The bubble' }
        : regatta || duel
          ? { kind: 'stop', key: room.key, name: room.name, label: room.label }
          : grind
            ? { kind: 'stop', key: room.key, name: room.name, label: room.label, table: seat.id }
            : { kind: 'practice', key: 'practice', name: 'Silas\'s practice table' },
      stats,
      graded: session.graded,
      pearls: session.pearls,
      savedHands: session.savedHandIds,
      cash,
      choice: grind ? chosenRank(lobby.tables, seat.id) : null,
    });
    return keepReport(profile, report);
  }

  function leave() {
    // Getting up: the table is not waiting any more, and the seat is given up.
    if (live && live.key === key) { live.closed = true; live = null; }
    if (grind || (regatta && !bubble)) clearSeat(profile);
    session.cancelled = true;
    stopCountdown();
    clearTimeout(session.timer);
    if (duel) {
      // Getting up before the end is losing it: a try, and no stars.
      if (!session.matchOver && session.dealt) profile.noteDuel(room.key, { won: false, stars: 0 });
      const m = session.matchOver;
      const notes = writeReport();
      go('stop', { at: room.key, ...(m ? { after: m.took.first ? 'took' : m.won ? 'up' : 'down' } : {}), ...(notes === null ? {} : { notes }), ...(m && m.took.purse ? { purse: m.took.purse } : {}) });
      return;
    }
    if (bubble) {
      // Practice: nothing was entered, so there is nothing to give up or get back.
      const notes = writeReport();
      go(notes === null ? 'learn' : 'report', notes === null ? { module: 'icm' } : { i: notes });
      return;
    }
    if (regatta) {
      // Getting up before the end gives up the entry: a try at no place, no prize. Before a
      // card is dealt, nothing has been played and the entry comes back.
      if (!session.matchOver) {
        if (session.dealt) profile.noteRegatta(room.key, { place: null, entry: moneyEntry, prize: 0 });
        else if (session.entryPearls) profile.refundPearls(session.entryPearls);
        else profile.setBankroll(profile.data.bankroll + room.entry, room.key);
      }
      const m = session.matchOver;
      const notes = writeReport();
      go('stop', { at: room.key, ...(m && m.place === 1 ? { after: 'up' } : m ? { after: m.prize > room.entry ? 'up' : 'down' } : {}), ...(notes === null ? {} : { notes }) });
      return;
    }
    if (grind) {
      const cashOut = (hero.stack / (bigBlind * 100)) * stake.buyIn;
      profile.setBankroll(profile.data.bankroll + cashOut);
      // The house's cut, when the house is yours.
      const cut = payRoomCut(profile, room.key, stats.hands, stake.bb);
      if (cut > 0) {
        toast({
          icon: '🏛',
          title: t('Your card room\'s cut: {money}', { money: fmt.money(cut) }),
          desc: t('{n} hands dealt at your room at {place}.', { n: stats.hands, place: t(room.name) }),
        });
      }
      profile.recordSession({
        hands: stats.hands,
        profitBb: stats.profitBb,
        stake: stake.key,
        endedAt: Date.now(),
      });
      const advice = bankrollAdvice(profile.data.bankroll, stake.key);
      toast({
        icon: stats.profitBb >= 0 ? 'chip' : 'warn',
        title: t('Cashed out {money}', { money: fmt.money(cashOut) }),
        desc: `${stats.hands} hands, ${fmt.bb(stats.profitBb)}. ${advice.message}`,
      });

      // You take a table by leaving it with a buy-in of its money. A stake
      // you merely sat at is a number; a table you took is somewhere you
      // have been, and its owner gives you something to remember it by.
      const spent = (session.buyInsUsed - session.pearlSeats) * stake.buyIn;
      const worth = session.buyInsUsed * stake.buyIn;
      // Doubling the buy-in takes the table, and the owner's purse with it.
      // Only at the owner's table: a side game has nobody to take it from.
      const doubled = cashOut - stake.buyIn >= stake.buyIn;
      const { first: took, purse } = doubled && ownerHere
        ? takeTable(profile, room.index)
        : { first: false, purse: 0 };
      if (doubled && !ownerHere && !profile.career.beaten.includes(room.key)) {
        toast({
          icon: '🪑',
          title: t('Doubled up at {table}', { table: t(seat.name) }),
          desc: t('Nobody owns a side game, so there is no table to take. {name}\'s table is the one that is yours to win.', { name: boss.short }),
        });
      }
      profile.noteSitting();
      // Taking somebody's table is the biggest thing the river pays for.
      if (took) session.pearls.bonus += profile.earnPearls(EARN.tableTaken);
      const after = took ? 'took' : cashOut > worth ? 'up' : cashOut < worth ? 'down' : 'even';
      const notes = writeReport({ spent, back: cashOut, pearls: session.pearlsSpent });
      go('stop', { at: room.key, after, ...(notes === null ? {} : { notes }), ...(purse ? { purse } : {}) });
      return;
    } else if (stats.hands) {
      profile.recordSession({ hands: stats.hands, profitBb: stats.profitBb, stake: 'practice', endedAt: Date.now() });
    }
    const notes = writeReport();
    if (notes !== null) go('report', { i: notes });
    else go('home');
  }

  /* ---------------- duel ---------------- */

  /**
   * The match is over: score it, pay what it pays, take the table if it is
   * the first win, and let the owner have a last word. Everything about how
   * it went is kept on session.matchOver for the panel to draw.
   */
  function finishDuel(won) {
    const { decisions, sound: soundCount, share } = soundShare(session.graded);
    const stars = duelStars({ won, decisions, sound: soundCount });
    const record = profile.noteDuel(room.key, { won, stars });
    const pearlsForStars = won ? starPearls(room.index, record.before, record.after) : 0;
    const took = won ? takeTable(profile, room.index) : { first: false, purse: 0 };
    const tableBonus = took.first ? EARN.tableTaken : 0;
    if (pearlsForStars + tableBonus) {
      session.pearls.bonus += profile.earnPearls(pearlsForStars + tableBonus);
      pearlPop(pearlsForStars + tableBonus, trayHost);
    }
    session.matchOver = {
      won, stars, decisions, sound: soundCount, share, record, pearlsForStars, tableBonus, took,
      handsDealt: session.matchHands,
      best: record.after,
    };
    say(bossId, t(won ? boss.beaten : story.loss), 6000);
    sound(won ? 'win' : 'lose');
    if (won) toast({ icon: '🏆', title: took.first ? t('You took {place}', { place: t(room.name) }) : t('You beat {name}', { name: boss.short }), desc: t('{n} of 3 stars', { n: stars }) });
  }

  /** What the blinds are, and how long they stay there; in a regatta, who is left and what is paid. */
  function drawMatch() {
    if (!match) return;
    const clock = regatta ? regattaBlinds : blindsFor;
    const levels = regatta ? REGATTA_LEVELS.length : DUEL_LEVELS.length;
    const idx = session.handStarted ? session.matchHands - 1 : session.matchHands;
    const b = clock(Math.max(0, idx));
    const left = b.left - (session.handStarted ? 1 : 0);
    leaveButton.textContent = session.matchOver || bubble ? t('Leave') : regatta ? t('Withdraw') : t('Forfeit');
    const alive = table.players.filter((p) => p.stack > 0).length;
    const prizes = regatta ? regattaPayouts(prizeEntry) : null;
    mount(matchHost, el('div.match-banner',
      el('span.match-blinds', icon('chip', { size: 14 }), t('Blinds {small} / {big}', { small: b.small, big: b.big })),
      el('span.match-level', t('Level {n} of {total}', { n: b.level + 1, total: levels })),
      regatta
        ? el('span.match-field', { title: t('Prizes: {first} / {second} / {third}', { first: fmt.money(prizes[0]), second: fmt.money(prizes[1]), third: fmt.money(prizes[2]) }) },
          icon('anchor', { size: 14 }), t('{n} of {total} left', { n: alive, total: fieldSize }),
          !session.matchOver && alive <= 3 ? el('span.match-money', ` · ${t('in the money')}`) : null)
        : null,
      el('span.match-clock', session.matchOver
        ? t('Over')
        : b.last
          ? t('Last level: the blinds stop here')
          : left <= 0 ? t('The blinds go up after this hand') : t('Blinds go up in {n} hands', { n: left })),
    ));
  }

  /**
   * After a regatta hand: who is out, and where they finished. Several players
   * going out on one hand are placed by who started it with fewer chips. It is
   * over when the reader is out, or the last one standing.
   */
  function tallyRegatta() {
    const out = table.players.filter((p) => p.stack <= 0 && session.stacksAtStart[p.id] > 0 && !session.finished[p.id])
      .map((p) => ({ id: p.id, stack: session.stacksAtStart[p.id] }));
    for (const { id, place } of placesFor(session.aliveAtStart, out)) {
      session.finished[id] = place;
      if (id !== HERO_ID) {
        const who = table.player(id).name;
        log(t('{name} is out in {place}', { name: who, place: t(ordinal(place)) }), true);
        toast({ icon: '⚓', title: t('{name} is out', { name: who }), desc: t('Finished {place}', { place: t(ordinal(place)) }) });
      }
    }
    if (bubble) {
      // The bubble is over when somebody goes out, which is the whole of what it is for.
      const heroOut = hero.stack <= 0;
      const burst = table.players.filter((p) => p.stack > 0).length < BUBBLE.field;
      if (heroOut || burst || session.dealt >= BUBBLE.maxHands) return finishBubble({ heroOut, burst });
      return null;
    }
    if (hero.stack <= 0) return finishRegatta(session.finished[HERO_ID]);
    if (table.players.filter((p) => p.stack > 0).length === 1) {
      session.finished[HERO_ID] = 1;
      return finishRegatta(1);
    }
    return null;
  }

  /** The bubble is over: somebody went out, or nobody did in a long time. */
  function finishBubble({ heroOut, burst }) {
    const { decisions, sound: soundCount, share } = soundShare(session.graded);
    session.matchOver = { bubble: true, heroOut, burst, place: heroOut ? session.finished[HERO_ID] : null, decisions, sound: soundCount, share };
    sound(heroOut ? 'lose' : 'win');
    return null;
  }

  /** Where it ended: the prize into the bankroll, the record, the pearls for a better finish than before. */
  function finishRegatta(place) {
    const prize = prizeFor(place, room.entry);
    if (prize) profile.setBankroll(profile.data.bankroll + prize, room.key);
    // Settled: the entry is spent or paid back with a prize, and nothing is kept for a closed tab to settle.
    clearSeat(profile);
    const { bestBefore } = profile.noteRegatta(room.key, { place, entry: moneyEntry, prize });
    const pearlsEarned = placePearls(room.index, bestBefore, place);
    if (pearlsEarned) {
      session.pearls.bonus += profile.earnPearls(pearlsEarned);
      pearlPop(pearlsEarned, trayHost);
    }
    const { decisions, sound: soundCount, share } = soundShare(session.graded);
    session.matchOver = { place, prize, pearlsEarned, decisions, sound: soundCount, share, net: Math.round((prize - moneyEntry) * 100) / 100 };
    sound(place <= 3 ? 'win' : 'lose');
    if (place <= 3) {
      toast({ icon: place === 1 ? '🏆' : '🥈', title: t('You finished {place}', { place: t(ordinal(place)) }), desc: t('{money} paid', { money: fmt.money(prize) }) });
    }
    return null;
  }

  /** The end of the bubble: how it went, and how the decisions did with the prizes counted. */
  function drawBubbleResult() {
    const m = session.matchOver;
    const pct = m.decisions ? Math.round(m.share * 100) : 0;
    mount(actionHost, el('div.action-bar.duel-result.regatta-result.bubble-result',
      el('h3', m.heroOut
        ? t('You went out on the bubble')
        : m.burst ? t('The bubble burst, and you are in the money')
          : t('Nobody went out in {n} hands. The bubble held.', { n: session.dealt })),
      m.heroOut ? el('p.faint', t('Fourth place pays nothing. What this is for is whether each shove and each call was right once the prizes were counted.')) : null,
      m.decisions
        ? el('p.muted', t('{sound} of {n} decisions were right with the prizes counted, {pct}%.', { sound: m.sound, n: m.decisions, pct }))
        : el('p.muted', t('You were not asked anything this time: the blinds did the work.')),
      el('p.faint', t('Short stacks are not about the chips you can win but the chips you cannot afford to lose. Look at what each decision was worth in Silas\'s notes.')),
      el('div.row',
        el('button.btn.primary.lg', { onclick: () => go('play', { mode: 'regatta', bubble: '1', at: room.key }) },
          icon('repeat', { size: 16 }), t('Another bubble')),
        el('button.btn.ghost', { onclick: () => leave() }, t('Silas\'s notes on it')),
        el('button.btn.ghost', { onclick: () => { session.cancelled = true; go('learn', { module: 'icm' }); } }, t('Back to the lesson')),
      ),
    ));
  }

  /** Where a regatta ended, in words and money, and the way to go again. */
  function drawRegattaResult() {
    if (session.matchOver.bubble) return drawBubbleResult();
    const m = session.matchOver;
    const result = table.result;
    const prizes = regattaPayouts(room.entry);
    const canAgain = profile.data.bankroll >= room.entry;
    mount(actionHost, el('div.action-bar.duel-result.regatta-result',
      el('h3', m.place === 1
        ? t('You won the Regatta')
        : m.place <= 3 ? t('You finished {place}, in the money', { place: t(ordinal(m.place)) })
          : t('You finished {place} of {total}', { place: t(ordinal(m.place)), total: FIELD })),
      result ? el('div.faint', resultHeadline(result, table)) : null,
      el('div.regatta-money',
        el(`span.regatta-net.${m.net >= 0 ? 'up' : 'down'}`, `${m.net >= 0 ? '+' : '−'}${fmt.money(Math.abs(m.net))}`),
        el('span.faint', session.entryPearls
          ? (m.prize
            ? t('{prize} paid on an entry of {n} pearls', { prize: fmt.money(m.prize), n: fmt.chips(session.entryPearls) })
            : t('Nothing paid outside the top three. The entry was {n} pearls.', { n: fmt.chips(session.entryPearls) }))
          : m.prize
            ? t('{prize} paid on a {entry} entry', { prize: fmt.money(m.prize), entry: fmt.money(room.entry) })
            : t('Nothing paid outside the top three. The entry was {entry}.', { entry: fmt.money(room.entry) }))),
      el('p.faint', t('Prizes: {first} / {second} / {third}', { first: fmt.money(prizes[0]), second: fmt.money(prizes[1]), third: fmt.money(prizes[2]) })),
      m.pearlsEarned ? el('p.duel-pearls', t('Paid:'), ' ', pearlsNode(m.pearlsEarned)) : null,
      el('div.row',
        el('button.btn.primary.lg', { disabled: !canAgain, onclick: () => go('play', { mode: 'regatta', at: room.key }) },
          icon('repeat', { size: 16 }), canAgain ? t('Enter again — {money}', { money: fmt.money(room.entry) }) : t('Not enough for another entry')),
        profile.pearls >= seatInPearls(room.index)
          ? el('button.btn.ghost', { onclick: () => go('play', { mode: 'regatta', at: room.key, pay: 'pearls' }) },
            pearl(), ' ', t('Pay in pearls: {n}', { n: fmt.chips(seatInPearls(room.index)) }))
          : null,
        el('button.btn.ghost', { onclick: () => leave() }, t('Back to {place}', { place: t(room.name) })),
      ),
    ));
  }

  /** The end of a duel: the stars, what they were for, and where to go next. */
  function drawDuelResult() {
    const m = session.matchOver;
    const result = table.result;
    const star = (n) => el('span', { class: `duel-star${n <= m.stars ? ' on' : ''}`, 'aria-hidden': 'true' }, icon('star', { size: 26 }));
    const pct = m.decisions ? Math.round(m.share * 100) : 0;
    const why = !m.won
      ? t('Lost the stack. The stars are for winning, and a rematch is always open.')
      : m.decisions < MIN_DECISIONS
        ? t('Only {n} decisions to judge, which is too few for more than the first star.', { n: m.decisions })
        : t('{sound} of {n} decisions sound, {pct}%. Two stars take {two}%, three take {three}%, and a decision made with help does not count.',
          { sound: m.sound, n: m.decisions, pct, two: Math.round(STAR_SHARE.two * 100), three: Math.round(STAR_SHARE.three * 100) });
    mount(actionHost, el('div.action-bar.duel-result',
      el('h3', m.won
        ? (m.took.first ? t('You took the table') : t('You won the duel'))
        : t('{name} won the duel', { name: boss.short })),
      result ? el('div.faint', resultHeadline(result, table)) : null,
      el('div.duel-stars', { role: 'img', 'aria-label': t('{n} of 3 stars', { n: m.stars }) }, [1, 2, 3].map(star)),
      el('p.muted', why),
      m.pearlsForStars || m.tableBonus
        ? el('p.duel-pearls', t('Paid:'), ' ', pearlsNode(m.pearlsForStars + m.tableBonus),
          m.took.purse > 0 ? el('span', ` · ${t('and a purse of {money}', { money: fmt.money(m.took.purse) })}`) : null)
        : null,
      el('div.row',
        el('button.btn.primary.lg', { onclick: () => go('play', { mode: 'duel', at: room.key }) },
          icon('repeat', { size: 16 }), m.won && m.best < 3 ? t('Go for another star') : t('Rematch')),
        el('button.btn.ghost', { onclick: () => leave() }, t('Back to {place}', { place: t(room.name) })),
      ),
    ));
  }

  /* ---------------- auto-deal ---------------- */

  /**
   * The next hand, dealt for you. At a table you are playing, the result
   * gets a moment on screen — longer after a showdown, longer again with
   * Silas giving his verdicts — and then the cards come out, the way a dealer
   * would. The button still deals at once; the switch is kept in the profile
   * so a table is the way you left it, and lives next to the button because
   * the moment you want it off is the moment it is counting down.
   *
   * The first hand of a sitting is always yours to ask for, and so is the
   * one after a bust: sitting down, and buying back in, are decisions.
   */
  function stopCountdown() {
    if (session.autoDeal) clearInterval(session.autoDeal.timer);
    session.autoDeal = null;
  }

  function armAutoDeal(result) {
    stopCountdown();
    if (session.matchOver) return;
    const ready = autoDealReady({
      on: autoDealEnabled(profile.settings),
      lesson: Boolean(lesson),
      cancelled: session.cancelled,
      heroBust: hero.stack <= 0,
    });
    if (!ready) return;
    const total = autoDealDelay({ showdown: result.reason === 'showdown', coaching: liveCoach() });
    session.autoDeal = { total, started: Date.now(), timer: setInterval(autoDealTick, 200) };
  }

  function autoDealTick() {
    const wait = session.autoDeal;
    if (!wait) return;
    if (session.cancelled || session.parked) { stopCountdown(); return; }
    // Nobody is watching a hidden tab, so the result is kept for when they
    // are back: the count starts again from the top instead of dealing a hand
    // into a page that is not on screen.
    if (typeof document !== 'undefined' && document.hidden) { wait.started = Date.now(); return; }
    const now = countdown(wait);
    if (now.left <= 0) { startHand(); return; }
    paintCountdown(now);
  }

  /** Move the bar and the number on what is already on screen. */
  function paintCountdown(now) {
    const fill = actionHost.querySelector('.deal-fill');
    if (fill) fill.style.transform = `scaleX(${now.progress.toFixed(3)})`;
    const note = actionHost.querySelector('.auto-deal-count');
    if (note) note.textContent = t('Next hand in {n}s', { n: now.seconds });
  }

  /** The switch. Turned on between hands, it starts counting at once. */
  function setAutoDeal(on) {
    profile.updateSettings({ autoDeal: on });
    if (!on) stopCountdown();
    else if (table.result && table.handOver && !session.handStarted) armAutoDeal(table.result);
    sound('click');
    drawActions();
  }

  /** The switch, and — while it counts — what it is counting down to. */
  function autoDealRow() {
    if (lesson) return null;
    const on = autoDealEnabled(profile.settings);
    const wait = session.autoDeal;
    return el('div.auto-deal-row',
      el(`button.auto-deal-chip${on ? '.on' : ''}`, {
        role: 'switch',
        'aria-checked': on ? 'true' : 'false',
        title: on
          ? 'Auto-deal is on: the next hand is dealt for you. Click to deal each hand yourself.'
          : 'Auto-deal is off: press the button for each hand. Click to have the next hand dealt for you.',
        onclick: () => setAutoDeal(!on),
      }, icon('repeat', { size: 13 }), on ? t('Auto-deal: on') : t('Auto-deal: off')),
      wait ? el('span.auto-deal-count', t('Next hand in {n}s', { n: countdown(wait).seconds })) : null,
    );
  }

  /** The deal button: while the table counts down, it fills as it goes. */
  function dealNextButton() {
    const wait = session.autoDeal;
    return el(`button.btn.primary.lg.deal-button${wait ? '.counting' : ''}`, { onclick: startHand },
      wait ? el('span.deal-fill', { style: { transform: `scaleX(${countdown(wait).progress.toFixed(3)})` } }) : null,
      el('span.deal-label', 'Deal next hand'),
    );
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
                      keepTheSeat();
                      sound('chips');
                      startHand();
                    },
                  }, t('Rebuy {money}', { money: fmt.money(stake.buyIn) }))
                : profile.pearls >= seatInPearls(room.index)
                  ? null
                  : el('div.notice.warn', 'Your bankroll cannot cover another buy-in at this stake. Move down.'),
              profile.pearls >= seatInPearls(room.index)
                ? el('button.btn.ghost', {
                    onclick: () => {
                      const price = seatInPearls(room.index);
                      if (!profile.spendPearls(price)) return;
                      hero.stack = startingStack;
                      session.buyInsUsed++;
                      session.pearlSeats++;
                      session.pearlsSpent += price;
                      keepTheSeat();
                      sound('chips');
                      startHand();
                    },
                  }, pearl(), ' ', t('Rebuy in pearls: {n}', { n: fmt.chips(seatInPearls(room.index)) }))
                : null,
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

  /**
   * Taking the table, counted out: cash out with twice what you sat down with
   * and it is yours. Read between hands, from the chips behind you — in the
   * middle of a hand what is in the pot is nobody's yet.
   */
  function drawTake() {
    if (!canTake) return;
    if (!session.handStarted || table.handOver) session.behind = hero.stack;
    const target = doublingTarget(session.behind ?? hero.stack, bigBlind, stake.buyIn);
    leaveButton.classList.toggle('primary', target.reached);
    leaveButton.classList.toggle('ghost', !target.reached);
    mount(takeHost, el(`div.take-meter${target.reached ? '.reached' : ''}`, {
      title: t('Sit down with {buyin}, get up with {need} or more by cashing out, and {name} hands the table over.',
        { buyin: fmt.money(stake.buyIn), need: fmt.money(target.need), name: boss.short }),
    },
      el('span.take-line', target.reached
        ? t('Doubled! Cash out to take the table')
        : t('Take the table: cash out with {need}', { need: fmt.money(target.need) })),
      el('span.take-bar', el('span', { style: { width: `${Math.round(target.share * 100)}%` } })),
      el('span.take-sub', t('You have {have}', { have: fmt.money(target.have) })),
    ));
  }

  function draw() {
    drawTake();
    drawLessonNote();
    drawMatch();
    drawFelt();
    drawActions();
    if (liveCoach()) drawCoach();
    drawTray();
    drawHelp();
    if (!lesson) drawCoachToggle();
  }

  /**
   * What this opponent has noticed about the reader, if it has changed how
   * they play. The Rival goes by her own memory and is always awake; everyone
   * else shares the table's, and wakes with the reader's rank.
   */
  function noticeOf(p) {
    if (!p.profile) return null;
    const note = adaptationNote(getProfile(p.profile), p.memory || session.readerMemory, p.memory ? ADAPT_FULL : table.readerLevel);
    return note && p.id === rivalId ? { ...note, name: RIVAL.short } : note;
  }

  const isHeroTurn = () => Boolean(table.actor && table.actor.isHero && !table.handOver && session.handStarted);

  /** Open help on this decision — from the button, or from one companion. */
  function openHelp(focus = null) {
    if (!isHeroTurn() || !session.snapshot) return;
    session.helped = true;
    session.helpOpen = true;
    session.helpFocus = focus;
    sound('page');
    draw();
  }

  /**
   * The tray under the felt: the help button, your companions, and what this
   * sitting has paid so far. The hand log folds away here in free play,
   * where there is no coach panel for it to live in.
   */
  /** The mistakes you made before in the spot in front of you now: the same hand, street, seat and what was in front of you. */
  function pastHere() {
    const snap = session.snapshot;
    if (!snap || hero.hole.length !== 2) return [];
    return mistakesHere(profile.lifetime, {
      key: handKey(hero.hole), street: table.street, position: snap.position, facing: facingOf(snap, table.street),
    });
  }

  /**
   * The cat remembers. When a hand you went wrong with comes back in the same
   * seat and the same spot, she says so before you act: think twice. Free —
   * it says you were wrong here once, not what is right now. Asking her what
   * is right is help, and costs the decision its pearl like any help.
   */
  function catWarning(owned, yourTurn) {
    if (lesson || !yourTurn || session.helped || !owned.some((c) => c.key === 'cat')) return null;
    const here = `${table.handNumber}:${table.street}`;
    if (session.catHushed === here) return null;
    const past = pastHere();
    if (!past.length) return null;
    const snap = session.snapshot;
    const latest = past[0];
    const cat = companionByKey('cat');
    const params = {
      hand: handKey(hero.hole),
      seat: SEAT_TEXT[snap.position] ? t(SEAT_TEXT[snap.position]) : snap.position,
      spot: t(SPOT_TEXT[facingOf(snap, table.street)]),
      street: t(STREET_TEXT[table.street] || ''),
      head: t(latest.head, latest.params),
    };
    return el('div.cat-warn', { role: 'status' },
      svgNode(portraitSvg('cat', { size: 40 }), 'cat-face'),
      el('div.cat-says',
        el('strong', cat.name),
        el('p', table.street === 'preflop'
          ? t('Careful. {hand} {seat}, {spot}: you went wrong here before — “{head}”.', params)
          : t('Careful. {hand} {street}, {spot}: you went wrong here before — “{head}”.', params)),
        el('p.faint', past.length > 1 ? t('{n} times now. Think twice.', { n: past.length }) : t('Think twice.')),
      ),
      el('div.cat-actions',
        el('button.btn.sm', {
          type: 'button',
          title: t('Help with this decision. It costs the decision its pearl.'),
          onclick: () => openHelp('cat'),
        }, t('What was right?')),
        el('button.cat-hush', {
          type: 'button', title: t('Close'), 'aria-label': t('Close'),
          onclick: () => { session.catHushed = here; draw(); },
        }, '×'),
      ),
    );
  }

  function drawTray() {
    const owned = crewAboard(profile);
    const yourTurn = isHeroTurn();
    const total = session.pearls.hands + session.pearls.decisions + session.pearls.bonus + session.pearls.boat + session.pearls.bounty
      + session.pearls.catches;
    mount(trayHost, catWarning(owned, yourTurn), el('div.companion-tray',
      el(`button.btn.help-btn${session.helped ? '.used' : ''}`, {
        disabled: !yourTurn,
        onclick: () => openHelp(null),
        title: t('Help with this decision. It costs the decision its pearl.'),
      }, icon('help', { size: 18 }), ' ', t('Help')),
      el('div.tray-pets',
        owned.map((c) => el('button.tray-pet', {
          disabled: !yourTurn,
          title: companionTitle(c.key),
          'aria-label': companionTitle(c.key),
          onclick: () => openHelp(c.key),
        }, svgNode(portraitSvg(c.key, { size: 38 }), 'tray-face'))),
        owned.length ? null : el('button.tray-pet.empty', {
          title: t('Companions aboard your boat sit here'),
          onclick: () => go('boatyard'),
        }, icon('paw', { size: 16 })),
      ),
      lesson ? null : el('span.tray-pearls', { title: t('Pearls this sitting') }, pearlsNode(total)),
      liveCoach() ? null : el('button.btn.sm.ghost.tray-log', {
        onclick: () => { session.showLog = !session.showLog; draw(); },
      }, icon('clipboard', { size: 14 }), ' ', session.showLog ? t('Hide the log') : t('Hand log')),
    ));
    if (!liveCoach() && session.showLog) {
      trayHost.appendChild(el('div.log.tray-log-body', session.logLines.slice().reverse().map((l) =>
        el(`div${l.isStreet ? '.street-line' : ''}`, l.line))));
    }
  }

  /** The drawer, for as long as this decision is open. */
  function drawHelp() {
    if (!session.helpOpen || !isHeroTurn() || !session.snapshot) return mount(helpHost);
    const snap = session.snapshot;
    const spot = lesson && lesson.coachNote ? { id: params.lesson, why: lesson.coachNote } : conceptOf(snap);
    return mount(helpHost, helpDrawer({
      owned: crewAboard(profile),
      snap,
      spot,
      handText: hero.hole.length && table.board.length
        ? describeScore(evaluateHand(hero.hole, table.board, table.variant), table.variant.shortDeck)
        : t('{hand}, before the flop', { hand: hero.hole.length === 2 ? handKey(hero.hole) : cardsToString(hero.hole) }),
      opponents: table.contestants.filter((p) => !p.isHero).map((p) => {
        const profileOf = p.profile ? getProfile(p.profile) : null;
        const isBoss = p.id === bossId;
        return {
          name: p.name,
          style: profileOf ? profileOf.style : '',
          read: isBoss ? boss.read : profileOf ? profileOf.counter : '',
          adjusted: profileOf ? Boolean(noticeOf(p)) : false,
        };
      }),
      bestAction: () => bestAction(snap),
      pastHere: pastHere(),
      focus: session.helpFocus,
      onClose: () => { session.helpOpen = false; draw(); },
    }));
  }

  /**
   * What Silas would do: every legal action graded the way the coach grades
   * the one you pick, and the best of them. Ties go to the quieter action —
   * a check before a bet, a call before a raise — since the grader calls them
   * equal and the quieter one risks less.
   */
  function bestAction(snap) {
    const legal = table.legalActions(hero);
    const raiseSpec = legal.find((a) => a.type === 'raise' || a.type === 'bet');
    const candidates = [];
    for (const a of legal) {
      if (a.type === 'check') candidates.push({ type: 'check', label: t('check') });
      if (a.type === 'call') candidates.push({ type: 'call', label: t('call {amount}', { amount: fmt.chips(snap.toCall) }) });
    }
    if (raiseSpec) {
      const context = sizingContext(table, hero, raiseSpec);
      // Silas's own size first, where the spot has one: the sizes graded below
      // would otherwise offer a 3-bet to a third of the pot as "best".
      const advised = sizeAdvice(snap.sizing || sizingContextOf(table, hero));
      const silas = advised && advised.target !== null ? [advised.target] : [];
      const amounts = [...silas, ...[0.33, 0.75].map((f) => clampRaise(raiseSpec, potFraction(context, f)))];
      for (const amount of amounts) {
        const label = raiseSpec.type === 'bet'
          ? t('bet {amount}', { amount: fmt.chips(amount) })
          : t('raise to {amount}', { amount: fmt.chips(amount) });
        if (!candidates.some((c) => c.amount === amount)) candidates.push({ type: raiseSpec.type, amount, label });
      }
    }
    if (legal.some((a) => a.type === 'fold') && snap.toCall > 0) candidates.push({ type: 'fold', label: t('fold') });
    const rank = { good: 2, ok: 1, bad: 0 };
    let best = null;
    for (const c of candidates) {
      const verdict = overall(judgeSpot({ ...snap, action: c.type, amount: c.amount }));
      if (!best || rank[verdict.level] > rank[best.verdict.level]) best = { ...c, verdict };
    }
    return best;
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
        tag: !p.isHero && p.profile && showTags() ? getProfile(p.profile).tag : null,
        wonPot: table.handOver && p.wonThisHand > 0,
        portrait: faces[p.id] || null,
        boss: p.id === bossId,
        bounty: session.bounties[p.id] || 0,
        speech: session.speech && session.speech.id === p.id ? session.speech.text : null,
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
      bigBlind: table.bigBlind,
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
      const skipped = choice === IDK;
      const right = !skipped && choice === correct;
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
      feedback.appendChild(el(`div.feedback.${skipped ? 'skip' : right ? 'correct' : 'wrong'}`,
        el('div.verdict', skipped
          ? t("You said you didn't know — here it is.")
          : right ? t('✓ Correct') : t('✗ Not quite — you said {said}', { said: t(choice) })),
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
      dontKnowButton(() => pick(IDK)),
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
    if (session.matchOver) return regatta ? drawRegattaResult() : drawDuelResult();
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
                el('div.faint', resultLine(result.net[HERO_ID])),
                autoDealRow(),
              ),
              el('div.row',
                // Straight from the hand you just misplayed into the replay of
                // it: this is the moment the spot is still in your head.
                // In free play the verdict is Silas's to give when you get up,
                // and a button that only appears after a mistake would give it
                // away hand by hand.
                session.savedHand && liveCoach()
                  ? el('button.btn.lg.ghost', {
                      onclick: () => go('review', { hand: session.savedHand.id }),
                    }, 'Review this hand')
                  : null,
                dealNextButton(),
              ),
            )
          : el('div.spread',
              el('div',
                el('div.muted', 'Ready when you are.'),
                autoDealRow(),
              ),
              el('button.btn.primary.lg', { onclick: startHand }, 'Deal me in'),
            ),
      ));
    }

    const actor = table.actor;
    if (!actor || !actor.isHero) {
      return mount(actionHost, el('div.action-bar',
        el('div.muted', actor ? t('{name} is thinking…', { name: actor.name }) : 'Dealing…'),
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
        session.silasPicked = false;
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
          session.silasPicked = false;
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
        oninput: (e) => { session.silasPicked = false; setAmount(Number(e.target.value)); },
      });
      followers.push((amount) => { slider.value = String(amount); });

      const step = (by, label) => el('button.btn.sm.ghost.step-btn', {
        'aria-label': label,
        onclick: () => { session.silasPicked = false; setAmount(session.raiseAmount + by); },
      }, by > 0 ? '+1' : '−1');

      const offers = sizingOffers(ctx);
      const presets = offers.map((offer) => {
        const button = el('button.btn.sm.ghost.size-btn', {
          onclick: () => { session.silasPicked = false; setAmount(offer.amount); },
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

      // Silas's size, when he is at your shoulder and the size does not turn on
      // the hand you hold: the rule is on the button, and in his panel.
      const advice = liveCoach() ? sizeAdvice(sizingContextOf(table, hero)) : null;
      session.silasTarget = advice && advice.target !== null ? advice.target : null;
      if (session.silasTarget !== null) {
        const target = session.silasTarget;
        const silas = el('button.btn.sm.ghost.size-btn.size-silas', {
          title: t(advice.rule, advice.params),
          'aria-label': t('Silas\'s size: {amount}', { amount: fmt.chips(target) }),
          onclick: () => { session.silasPicked = true; setAmount(target); },
        },
          el('span.size-name', icon('coach', { size: 12 }), ' Silas'),
          el('span.size-chips', fmt.chips(target)),
        );
        followers.push((amount) => { silas.classList.toggle('is-active', amount === target && session.silasPicked); });
        presets.unshift(silas);
      }

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
          dontKnowButton(() => answerRead(IDK)),
        ),
      ));
      return null;
    }

    mount(actionHost, el('div.action-bar',
      read ? el(`div.read-said${read.picked === IDK ? '.skip' : ''}`,
        read.picked === read.band
          ? t('✓ Read: {air} of their bets here are air. Now play it.', { air: `${Math.round(read.air)}%` })
          : read.picked === IDK
            ? t("You said you didn't know. At the table that is a fold, not a guess. It is {air} air. Now play it.",
              { air: `${Math.round(read.air)}%` })
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

  /**
   * Before you act, when you can bet or raise: Silas's rule for the size here.
   * It names the rule for each kind of hand and leaves which kind yours is to you.
   */
  function sizeRule(snap) {
    const advice = snap && snap.sizing ? sizeAdvice(snap.sizing) : null;
    if (!advice) return null;
    return el('div.size-advice',
      icon('chip', { size: 15 }),
      el('span', el('b', t('Size')), ' · ', t(advice.rule, advice.params)),
    );
  }

  /** How much you bet or raised, said on its own line under the verdict on the decision. */
  function sizeNote(size) {
    if (!size) return null;
    return el(`div.size-note.${size.level}`,
      el('div.size-note-head',
        el('span.size-mark', { 'aria-hidden': 'true' }, SAID_MARK[size.level] || '•'),
        el('span.size-label', t('Size')),
        el('b', t(size.head, size.params)),
      ),
      el('div', t(size.body, size.params)),
      size.better ? el('div.verdict-better', t('Instead:'), ' ', t(size.better, size.params)) : null,
      size.helped ? el('div.faint', t('Silas\'s size: it does not count as one of yours.')) : null,
    );
  }

  /**
   * The verdicts before the one in the box, short: the street, what you did,
   * and whether Silas agreed. Tap one for the why and what was right.
   */
  function saidBefore() {
    const before = session.said.filter((s) => s.verdict !== session.verdict).slice(0, SAID_SHOWN);
    if (!before.length) return null;
    return el('div.said-before',
      el('div.said-title', t('What Silas said before')),
      before.map(({ verdict: v, street, action, hand }) => el(`details.said-row.${overall(v).level}`,
        el('summary',
          el('span.said-mark', { 'aria-hidden': 'true' }, SAID_MARK[overall(v).level] || '•'),
          el('span.said-when',
            el('b.said-street', street),
            DID[action] ? ` · ${t(DID[action])}` : '',
            hand !== table.handNumber
              ? el('span.faint', ` · ${hand === table.handNumber - 1 ? t('previous hand') : t('earlier hand')}`)
              : null),
          el('span.said-head', t(overall(v).head, overall(v).params))),
        // What you did, then how much: the summary names the worse of the two.
        overall(v) !== v ? el('p.said-why', el('b', t(v.head, v.params))) : null,
        v.body ? el('p.said-why', t(v.body, v.params)) : null,
        v.better ? el('div.verdict-better', t('Instead:'), ' ', t(v.better, v.params)) : null,
        v.size
          ? el('p.said-why', el('b', t('Size'), ' · ', t(v.size.head, v.size.params)), ' — ', t(v.size.body, v.size.params))
          : null,
        v.size && v.size.better ? el('div.verdict-better', t('Instead:'), ' ', t(v.size.better, v.size.params)) : null,
      )));
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
      .map((p) => noticeOf(p))
      .filter(Boolean);

    mount(coachHost,
      // The coach is Silas: the same teacher as the school and the pilot
      // house, standing at your shoulder. His name and face, not a label.
      // Head to toe, and his face follows your last decision.
      el('h3.coach-head',
        svgNode(silasFigure(64, moodFor(session.verdict && session.verdict.level)), 'silas-stood'),
        el('span.coach-who',
          el('span.coach-name', MENTOR.short),
          el('span.coach-role', t(MENTOR.table)),
          session.verdict
            ? el(`span.coach-mood.${session.verdict.level}`, t(session.verdict.level === 'good' ? 'Pleased with that one.'
              : session.verdict.level === 'bad' ? 'Not happy with that one.' : 'Close enough.'))
            : null,
        ),
      ),
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
              spotMeta && !ownsLesson(profile, spot.id)
                ? el('div.faint', t('That chapter is on the shelf at the Trading Post — {n} pearls.',
                  { n: LESSON_PRICES[spot.id] }))
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
            sizeRule(snap),
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
            referenceDrawer(session, hero, table, draw),
          )
        : el('div.faint', table.handOver ? 'Hand complete. Review below, then deal again.' : 'Waiting for your turn…'),

      session.verdict
        ? el(`div.verdict-box.${session.verdict.level}`,
            el('div.head', session.verdict.head),
            el('div', t(session.verdict.body, session.verdict.params)),
            session.verdict.better
              ? el('div.verdict-better', t('Instead:'), ' ', t(session.verdict.better, session.verdict.params))
              : null,
            sizeNote(session.verdict.size),
            // Straight from the mistake into the chapter that explains it —
            // the moment you want the theory is the moment it cost you.
            session.verdict.level === 'bad' && moduleMeta(session.verdict.concept.id)
              ? el('button.btn.sm.ghost.block', { style: { marginTop: '10px' },
                onclick: () => go('walkthrough', { module: session.verdict.concept.id }) },
              t('Teach me {skill}', { skill: t(moduleMeta(session.verdict.concept.id).name) }))
              : null,
          )
        : null,

      saidBefore(),

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
        el('button.btn.sm.ghost.block', { onclick: () => showLeaks() }, t('Show my leaks')),
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

  // The owner of the table says hello when you sit down.
  if (bossId && !resuming) say(bossId, t(boss.hello), 6500);
  draw();
  // Picked back up only to cash out: the table is there long enough to get up from.
  if (resuming && params.cashout === '1') setTimeout(() => { if (!session.cancelled) leave(); }, 0);
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

function variantSwitcher(current, seats, go) {
  return el('div.row',
    VARIANT_KEYS.map((key) => el(`button.btn.sm${key === current ? '.primary' : '.ghost'}`, {
      onclick: () => go('play', { variant: key, seats }),
    }, VARIANTS[key].short)),
  );
}

const SIZE_NAMES = { 6: 'Full table', 3: '3 players', 2: 'Heads-up' };
// On a phone the three chips share a row with the variants, so they say less.
const SIZE_SHORT = { 6: '6', 3: '3', 2: 'HU' };
const SIZE_BLURBS = {
  6: 'Six players: the table the charts are drawn for.',
  3: 'You and two others. Everybody plays more hands, and the pot is rarely multiway for long.',
  2: 'You against one. The button is also the small blind, and acts first before the flop.',
};

/** How many are dealt in: a full table, you and two others, or you against one. */
function sizeSwitcher(variant, seats, go) {
  return el('div.row.size-switch', { role: 'group', 'aria-label': t('Players at the table') },
    TABLE_SIZES.map((n) => el(`button.btn.sm${n === seats ? '.primary' : '.ghost'}`, {
      title: SIZE_BLURBS[n],
      'aria-pressed': n === seats ? 'true' : 'false',
      'aria-label': t(SIZE_NAMES[n]),
      onclick: () => go('play', { variant, seats: n }),
    }, el('span.size-long', t(SIZE_NAMES[n])), el('span.size-short', SIZE_SHORT[n]))),
  );
}
