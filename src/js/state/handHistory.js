/**
 * The hands worth going back to.
 *
 * Playing a hand badly and then never seeing it again is how a leak survives
 * a thousand hands. This records every hand you play, keeps the ones with
 * something to learn from, and can rebuild any of them frame by frame so you
 * can watch the spot again and see exactly where it went wrong.
 *
 * Two kinds are kept, and telling them apart is most of the value:
 *
 *  - **Mistakes.** A decision the coach graded bad, ranked by what it cost in
 *    chips rather than by how the hand ended. Folding the winner for two
 *    chips and calling off eighty are not the same error.
 *  - **Coolers.** Hands where you lost a lot and did nothing wrong. These are
 *    kept deliberately. The most expensive habit in poker is judging a
 *    decision by its result, and the cure is seeing, in your own hands, that
 *    losing and misplaying are different things.
 *
 * Frames are rebuilt from the action list rather than stored, so a hand costs
 * a couple of kilobytes instead of a snapshot per step.
 *
 * Stored in their own key rather than in the profile: the profile is pushed
 * to your gist on every change, and hand histories would multiply the size of
 * every one of those pushes. These stay on the device that played them.
 */

import { judgeSpot } from '../core/coach.js';

const STORAGE_KEY = 'poker-trainer.hands.v1';

/** Kept per bucket. Mistakes are the point; a few coolers make that visible. */
export const MISTAKE_CAP = 40;
export const COOLER_CAP = 10;

/** A loss this big with no bad decision in it is worth showing as a cooler. */
export const COOLER_BB = 25;

/* ------------------------------------------------------------------ *
 * Recording a live hand
 * ------------------------------------------------------------------ */

/**
 * Wraps a Table for the length of one hand. It performs the actions itself
 * rather than watching for them, which is the only way to be sure the
 * recording and the table cannot drift apart.
 */
export class HandRecorder {
  /** @param {object} table a started Table @param {string} heroId */
  constructor(table, heroId, meta = {}) {
    this.heroId = heroId;
    this.meta = meta;
    this.steps = [];
    this.decisions = [];
    this.board = [];
    this.street = 'preflop';

    // Stacks before the blinds came out, so the replay opens on the hand as
    // it was dealt rather than mid-post.
    this.seats = table.players
      .filter((p) => !p.sittingOut)
      .map((p) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        position: p.position,
        profileKey: p.profile || null,
        isHero: p.id === heroId,
        stack: p.stack + p.committed,
        hole: p.hole.slice(),
      }));

    this.posts = table.history
      .filter((h) => h.type === 'ante' || h.type === 'small blind' || h.type === 'big blind')
      .map((h) => ({ id: h.player, amount: h.amount, label: h.type }));

    this.start = {
      variant: table.variant.key || 'holdem',
      bigBlind: table.bigBlind,
      smallBlind: table.smallBlind,
      ante: table.ante,
      button: table.button,
      seatCount: table.players.length,
      handNumber: table.handNumber,
    };
  }

  /**
   * Take one action and record it. `coach` is what was known at the moment of
   * the decision — present for the hero, absent for the bots.
   */
  act(table, action, coach = null) {
    const player = table.actor;
    if (!player) return table;

    const toCall = Math.max(0, table.currentBet - player.committed);
    const step = {
      kind: 'action',
      id: player.id,
      street: table.street,
      action: action.type,
      pot: table.totalPot,
      toCall,
    };
    if (coach) {
      step.decision = this.decisions.length;
      this.decisions.push({
        step: this.steps.length,
        street: table.street,
        action: action.type,
        equity: coach.equity,
        needed: coach.needed,
        toCall,
        pot: table.totalPot,
        amount: action.amount ?? null,
        currentBet: table.currentBet,
        opponents: coach.opponents,
        spr: Number.isFinite(coach.spr) ? coach.spr : null,
      });
    }

    // Measured against totalCommitted rather than the stack: the last action
    // of a hand runs the showdown inside act(), and the winner's stack has
    // already grown by the pot before this line is reached.
    const committedBefore = player.committed;
    const paidBefore = player.totalCommitted;
    table.act(action);

    step.paid = player.totalCommitted - paidBefore;
    step.to = committedBefore + step.paid;
    step.allIn = player.allIn;
    this.steps.push(step);
    this.syncBoard(table);
    return table;
  }

  /** New cards on the table become their own step, so the replay can pause on them. */
  syncBoard(table) {
    if (table.board.length <= this.board.length) return;
    this.board = table.board.slice();
    this.street = table.street;
    this.steps.push({ kind: 'street', street: table.street, board: this.board.slice() });
  }

  /**
   * Close the hand. Returns a stored-shape record, or null if the recording
   * cannot be trusted — see matchesTable. A replay that quietly disagrees
   * with the hand you played is worse than no replay at all.
   */
  finish(table) {
    const result = table.result;
    if (!result) return null;
    this.syncBoard(table);

    const hand = {
      id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: Date.now(),
      source: this.meta.source || 'play',
      stake: this.meta.stake || null,
      ...this.start,
      heroId: this.heroId,
      seats: this.seats,
      posts: this.posts,
      steps: this.steps,
      decisions: this.decisions,
      board: table.board.slice(),
      result: {
        reason: result.reason,
        net: result.net[this.heroId] || 0,
        potTotal: result.pots.reduce((s, p) => s + p.amount, 0),
        winners: Object.entries(result.payouts).filter(([, v]) => v > 0).map(([id]) => id),
        // The score rather than its description: the wording is
        // language-dependent, and a hand saved in Dutch should not still read
        // Dutch after switching the app back to English.
        showdown: result.showdown.map((s) => ({ id: s.id, score: s.score })),
      },
    };

    return matchesTable(hand, table) ? hand : null;
  }
}

/**
 * Does the replay end where the real hand ended?
 *
 * Rebuilding the final frame from the action list and comparing it against
 * the table catches the one failure that would otherwise be invisible: an
 * action taken behind the recorder's back, or a rebuild that has drifted away
 * from what the engine does.
 *
 * The action count is what catches a dropped action: a fold costs nothing and
 * changes no stack, so counting chips alone would wave it through. The chips
 * and the folded flags are what catch the rebuild itself going wrong, which
 * no count would notice. Both are exercised by the tests.
 */
const ACTIONS = new Set(['fold', 'check', 'call', 'bet', 'raise']);

export function matchesTable(hand, table) {
  const final = frameAt(hand, hand.steps.length);
  if (final.board.length !== table.board.length) return false;
  const played = table.history.filter((h) => ACTIONS.has(h.type)).length;
  if (hand.steps.filter((s) => s.kind === 'action').length !== played) return false;
  return final.players.every((p) => {
    const real = table.player(p.id);
    const seat = hand.seats.find((s) => s.id === p.id);
    if (!real || !seat) return false;
    if (real.folded !== p.folded) return false;
    return Math.abs((seat.stack - p.stack) - real.totalCommitted) < 0.5;
  });
}

/* ------------------------------------------------------------------ *
 * Rebuilding a hand, frame by frame
 * ------------------------------------------------------------------ */

/**
 * The table as it stood after `index` steps. `index` 0 is the hand as dealt,
 * with the blinds out and nobody having acted.
 *
 * Rebuilt rather than stored: a snapshot per step would be most of the size
 * of the record, and this is a few lines of arithmetic the engine already
 * defines the shape of.
 */
export function frameAt(hand, index) {
  const players = hand.seats.map((s) => ({
    ...s,
    stack: s.stack,
    committed: 0,
    folded: false,
    allIn: false,
    lastAction: null,
  }));
  const find = (id) => players.find((p) => p.id === id);
  let pot = 0;
  // A hand from the table starts before the flop with nothing showing. A Lab
  // spot starts mid-hand with a board and a pot already there, so it says so.
  let street = hand.openStreet || 'preflop';
  let board = (hand.openBoard || []).slice();

  for (const post of hand.posts) {
    const p = find(post.id);
    if (!p) continue;
    p.stack -= post.amount;
    if (post.label === 'ante') pot += post.amount;
    else p.committed += post.amount;
    if (p.stack <= 0) p.allIn = true;
  }

  const steps = hand.steps.slice(0, Math.max(0, index));
  for (const step of steps) {
    if (step.kind === 'street') {
      for (const p of players) { pot += p.committed; p.committed = 0; p.lastAction = null; }
      street = step.street;
      board = step.board.slice();
      continue;
    }
    const p = find(step.id);
    if (!p) continue;
    p.stack -= step.paid || 0;
    p.committed = step.to ?? p.committed + (step.paid || 0);
    p.allIn = !!step.allIn;
    if (step.action === 'fold') { p.folded = true; p.lastAction = 'Fold'; }
    else p.lastAction = labelFor(step, p);
  }

  const next = hand.steps[index];
  return {
    street,
    board,
    players,
    pot: pot + players.reduce((s, p) => s + p.committed, 0),
    actingId: next && next.kind === 'action' ? next.id : null,
    button: hand.button,
    over: index >= hand.steps.length,
  };
}

function labelFor(step, player) {
  switch (step.action) {
    case 'check': return 'Check';
    case 'call': return player.allIn ? `All-in ${step.paid}` : `Call ${step.paid}`;
    case 'bet': return player.allIn ? `All-in ${step.to}` : `Bet ${step.to}`;
    case 'raise': return player.allIn ? `All-in ${step.to}` : `Raise to ${step.to}`;
    default: return null;
  }
}

/** Every frame of a hand, for stepping through it. */
export const frameCount = (hand) => hand.steps.length + 1;

/* ------------------------------------------------------------------ *
 * What was wrong with it
 * ------------------------------------------------------------------ */

/**
 * Grade a stored hand. Derived on read rather than saved, so that improving
 * the coaching improves every hand you have already played instead of only
 * the ones from here on.
 */
export function reviewOf(hand) {
  const verdicts = (hand.decisions || []).map((d) => ({ ...judgeSpot(d), decision: d }));
  const bb = hand.bigBlind || 1;
  const mistakes = verdicts.filter((v) => v.level === 'bad');
  // A priced mistake outranks an unpriced one however small it is. A range
  // error is real but costs over a career rather than in this pot, so it must
  // not be allowed to sort above a call that burned eighty chips — and
  // inventing a number for it so the sort works would be worse.
  const worst = mistakes.reduce((best, v) => {
    if (!best) return v;
    const priced = v.costKnown !== false;
    const bestPriced = best.costKnown !== false;
    if (priced !== bestPriced) return priced ? v : best;
    return v.cost > best.cost ? v : best;
  }, null);
  const lostBb = -(hand.result.net || 0) / bb;

  if (worst) {
    return {
      kind: 'mistake',
      verdicts,
      worst,
      worstIndex: verdicts.indexOf(worst),
      costBb: worst.cost / bb,
      costKnown: worst.costKnown !== false,
      lostBb,
      headline: worst.head,
      street: worst.decision.street,
      mistakeCount: mistakes.length,
    };
  }
  if (lostBb >= COOLER_BB) {
    return {
      kind: 'cooler',
      verdicts,
      worst: null,
      worstIndex: -1,
      costBb: 0,
      costKnown: true,
      lostBb,
      headline: 'Lost, but played right',
      street: hand.result.reason === 'showdown' ? 'river' : 'preflop',
      mistakeCount: 0,
    };
  }
  return {
    kind: 'clean',
    verdicts,
    worst: null,
    worstIndex: -1,
    costBb: 0,
    costKnown: true,
    lostBb,
    headline: 'Nothing to fix',
    street: null,
    mistakeCount: 0,
  };
}

/** Should this hand be kept at all? */
export const worthKeeping = (hand) => reviewOf(hand).kind !== 'clean';

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

function createStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('__pt_probe', '1');
      localStorage.removeItem('__pt_probe');
      return localStorage;
    }
  } catch {
    /* Private browsing: fall through to memory, so a session still works. */
  }
  const memory = new Map();
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  };
}

let store = createStorage();

/** Test hook: swap in a fresh in-memory store. */
export function _useStorage(next) { store = next || createStorage(); }

export function loadHands() {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((h) => h && Array.isArray(h.steps)) : [];
  } catch {
    return [];
  }
}

function writeHands(hands) {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(hands));
  } catch {
    /* Quota: drop the oldest half rather than lose the lot. */
    try { store.setItem(STORAGE_KEY, JSON.stringify(hands.slice(Math.floor(hands.length / 2)))); } catch { /* give up */ }
  }
  return hands;
}

/**
 * Keep a hand if it has something to teach. Each bucket is capped separately
 * so a run of mistakes cannot push out every cooler, and a run of coolers
 * cannot bury the mistakes — the two answer different questions.
 *
 * @returns {object|null} the stored hand, or null if it was not worth keeping
 */
export function keepHand(hand) {
  if (!hand) return null;
  const review = reviewOf(hand);
  if (review.kind === 'clean') return null;

  const hands = [...loadHands(), { ...hand, kind: review.kind }];
  writeHands(prune(hands));
  return hand;
}

/** Newest first within each bucket, oldest dropped when a bucket is full. */
export function prune(hands) {
  const keptOf = (kind, cap) => hands.filter((h) => (h.kind || reviewOf(h).kind) === kind).slice(-cap);
  const keep = new Set([...keptOf('mistake', MISTAKE_CAP), ...keptOf('cooler', COOLER_CAP)]);
  return hands.filter((h) => keep.has(h));
}

export function removeHand(id) {
  writeHands(loadHands().filter((h) => h.id !== id));
}

export function clearHands() { writeHands([]); }

export function findHand(id) {
  return loadHands().find((h) => h.id === id) || null;
}

/** Newest first, which is the order you want to review in. */
export function recentHands() {
  return loadHands().slice().reverse();
}

/** How the review list summarises itself. */
export function handSummary() {
  const hands = loadHands();
  const reviews = hands.map(reviewOf);
  const mistakes = reviews.filter((r) => r.kind === 'mistake');
  return {
    total: hands.length,
    mistakes: mistakes.length,
    coolers: reviews.filter((r) => r.kind === 'cooler').length,
    costBb: mistakes.reduce((s, r) => s + r.costBb, 0),
  };
}

/* ------------------------------------------------------------------ *
 * The Lab
 * ------------------------------------------------------------------ */

/**
 * A Lab "make the call" spot, in the same shape as a hand from the table, so
 * it replays on the same felt and is graded by the same judge.
 *
 * The pot has no betting history behind it — the spot simply starts with one
 * — so it is modelled as both players having posted half of it. That is a
 * fiction, but it is the one that makes the felt show the right numbers, and
 * the decision it leads to is the real one.
 */
export function handFromLabSpot(spot, given) {
  const t = spot.table;
  const half = Math.round(t.pot / 2);
  const stack = Math.max(t.bet * 4, t.pot * 2);
  const bigBlind = Math.max(1, Math.round(t.pot / 20));

  const hand = {
    id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    source: 'lab',
    stake: null,
    variant: 'holdem',
    bigBlind,
    smallBlind: bigBlind / 2,
    ante: 0,
    button: 3,
    // Two players on a four-seat frame, so they sit opposite each other the
    // way a heads-up table looks. Seats 1 and 2 are simply empty.
    seatCount: 4,
    handNumber: null,
    // The Lab shows you their hand — that is what makes it a counting
    // exercise rather than a guess — so the replay shows it too.
    revealAll: true,
    heroId: 'hero',
    seats: [
      { id: 'hero', name: 'You', seat: 0, position: 'BB', profileKey: null, isHero: true, stack, hole: t.hole.slice() },
      { id: 'villain', name: 'Them', seat: 3, position: 'BTN', profileKey: null, isHero: false, stack, hole: t.villain.slice() },
    ],
    posts: [
      { id: 'hero', amount: half, label: 'ante' },
      { id: 'villain', amount: t.pot - half, label: 'ante' },
    ],
    openStreet: 'flop',
    openBoard: t.board.slice(),
    steps: [
      { kind: 'action', id: 'villain', street: 'flop', action: 'bet', pot: t.pot, toCall: 0, paid: t.bet, to: t.bet, allIn: false },
      {
        kind: 'action', id: 'hero', street: 'flop', action: given,
        pot: t.potNow, toCall: t.bet, decision: 0,
        paid: given === 'call' ? t.bet : 0,
        to: given === 'call' ? t.bet : 0,
        allIn: false,
      },
    ],
    decisions: [{
      step: 1,
      street: 'flop',
      action: given,
      equity: spot.equity,
      needed: spot.need,
      toCall: t.bet,
      pot: t.potNow,
      amount: null,
      currentBet: t.bet,
      opponents: 1,
      spr: null,
    }],
    board: t.board.slice(),
    result: {
      reason: 'review',
      // A Lab spot is a decision, not a hand that was played out — there are
      // no chips won or lost, and pretending otherwise would put a fictional
      // number into your review list.
      net: 0,
      potTotal: t.potNow,
      winners: [],
      showdown: [],
    },
  };
  return hand;
}
