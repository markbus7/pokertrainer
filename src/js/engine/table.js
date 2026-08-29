/**
 * The table: a full betting state machine for No-Limit and Pot-Limit games.
 *
 * Handles blinds and antes, min-raise rules, short all-ins that do not reopen
 * the action, side pots, uncalled-bet returns, odd-chip assignment and
 * showdown. Every hand records a history so it can be replayed and reviewed.
 */

import { makeDeck, cardsToString } from '../core/cards.js';
import { evaluateHand, describeScore } from '../core/evaluator.js';
import { makeRng, shuffle } from '../core/rng.js';
import { getVariant, positionNames } from './variants.js';

export const STREETS = ['preflop', 'flop', 'turn', 'river'];
const BOARD_CARDS = { preflop: 0, flop: 3, turn: 4, river: 5 };

let nextTableId = 1;

export class Table {
  constructor(config = {}) {
    this.id = nextTableId++;
    this.variant = getVariant(config.variant || 'holdem');
    this.smallBlind = config.smallBlind ?? 1;
    this.bigBlind = config.bigBlind ?? 2;
    this.ante = config.ante ?? 0;
    this.rng = config.rng || makeRng();
    this.handNumber = 0;
    this.button = config.button ?? 0;

    this.players = (config.players || []).map((p, i) => ({
      id: p.id ?? `p${i}`,
      name: p.name ?? `Player ${i + 1}`,
      stack: p.stack ?? 200,
      isHero: !!p.isHero,
      profile: p.profile || null,
      seat: i,
      hole: [],
      committed: 0,
      totalCommitted: 0,
      folded: false,
      allIn: false,
      acted: false,
      sittingOut: false,
      position: '',
      lastAction: null,
      wonThisHand: 0,
    }));

    if (this.players.length < 2) throw new Error('A table needs at least two players');
    this.street = 'idle';
    this.board = [];
    this.pot = 0;
    this.history = [];
    this.result = null;
  }

  /* ---------------- queries ---------------- */

  get activePlayers() { return this.players.filter((p) => !p.folded && !p.sittingOut); }
  get contestants() { return this.players.filter((p) => !p.folded && !p.sittingOut); }
  /** Players who can still put chips in. */
  get bettable() { return this.players.filter((p) => !p.folded && !p.allIn && !p.sittingOut); }
  get actor() { return this.actingIndex >= 0 ? this.players[this.actingIndex] : null; }
  get totalPot() { return this.pot + this.players.reduce((s, p) => s + p.committed, 0); }
  get handOver() { return this.street === 'complete'; }

  player(id) { return this.players.find((p) => p.id === id); }

  /** Effective stack between the actor and the deepest opponent still in. */
  effectiveStack(player) {
    const others = this.contestants.filter((p) => p !== player);
    if (!others.length) return player.stack;
    return Math.min(player.stack + player.committed, Math.max(...others.map((o) => o.stack + o.committed)));
  }

  /* ---------------- hand lifecycle ---------------- */

  startHand() {
    const seated = this.players.filter((p) => p.stack > 0);
    if (seated.length < 2) throw new Error('Not enough players with chips');

    this.handNumber++;
    this.deck = shuffle(this.rng, makeDeck(this.variant.shortDeck));
    this.board = [];
    this.pot = 0;
    this.street = 'preflop';
    this.result = null;
    this.history = [];
    this.lastAggressor = null;

    for (const p of this.players) {
      p.hole = [];
      p.committed = 0;
      p.totalCommitted = 0;
      p.folded = p.stack <= 0;
      p.sittingOut = p.stack <= 0;
      p.allIn = false;
      p.acted = false;
      p.lastAction = null;
      p.wonThisHand = 0;
    }

    // Move the button to the next player with chips.
    if (this.handNumber > 1) {
      do { this.button = (this.button + 1) % this.players.length; }
      while (this.players[this.button].sittingOut);
    }
    this.assignPositions();

    const live = this.players.filter((p) => !p.sittingOut);
    const heads = live.length === 2;
    const sbIndex = heads ? this.button : this.nextOccupied(this.button);
    const bbIndex = this.nextOccupied(sbIndex);

    if (this.ante > 0) {
      for (const p of live) this.commit(p, Math.min(this.ante, p.stack), 'ante');
      // Antes belong to the pot, not to this street's betting.
      this.pot += this.players.reduce((s, p) => s + p.committed, 0);
      for (const p of this.players) p.committed = 0;
    }

    this.commit(this.players[sbIndex], Math.min(this.smallBlind, this.players[sbIndex].stack), 'small blind');
    this.commit(this.players[bbIndex], Math.min(this.bigBlind, this.players[bbIndex].stack), 'big blind');

    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;
    this.bbIndex = bbIndex;

    for (let i = 0; i < this.variant.holeCards; i++) {
      for (const p of live) p.hole.push(this.deck.pop());
    }

    this.log('deal', { street: 'preflop' });
    this.actingIndex = heads ? sbIndex : this.nextOccupied(bbIndex);
    // Blinds are forced, not voluntary: they still owe an action.
    for (const p of live) p.acted = false;
    this.settleIfNoActionPossible();
    return this;
  }

  assignPositions() {
    const live = this.players.filter((p) => !p.sittingOut);
    const names = positionNames(live.length);
    let idx = this.button;
    for (let i = 0; i < live.length; i++) {
      while (this.players[idx].sittingOut) idx = (idx + 1) % this.players.length;
      this.players[idx].position = names[i];
      idx = (idx + 1) % this.players.length;
    }
  }

  nextOccupied(from) {
    let i = (from + 1) % this.players.length;
    let guard = 0;
    while (this.players[i].sittingOut && guard++ < this.players.length) {
      i = (i + 1) % this.players.length;
    }
    return i;
  }

  /** Next player who still has a decision to make, or -1. */
  nextToAct(from) {
    for (let step = 1; step <= this.players.length; step++) {
      const i = (from + step) % this.players.length;
      const p = this.players[i];
      if (!p.folded && !p.allIn && !p.sittingOut) return i;
    }
    return -1;
  }

  commit(player, amount, label) {
    const chips = Math.max(0, Math.min(amount, player.stack));
    player.stack -= chips;
    player.committed += chips;
    player.totalCommitted += chips;
    if (player.stack === 0) player.allIn = true;
    if (label) this.log(label, { player: player.id, amount: chips });
    return chips;
  }

  log(type, data = {}) {
    this.history.push({ type, street: this.street, handNumber: this.handNumber, ...data });
  }

  /* ---------------- legal actions ---------------- */

  legalActions(player = this.actor) {
    if (!player || this.handOver) return [];
    const toCall = Math.max(0, this.currentBet - player.committed);
    const actions = [];

    if (toCall === 0) {
      actions.push({ type: 'check' });
    } else {
      actions.push({ type: 'fold' });
      actions.push({ type: 'call', amount: Math.min(toCall, player.stack) });
    }

    // Raise rights: you may raise only if you have not yet acted since the
    // last full raise. A short all-in does not reopen the betting for anyone
    // who has already put in a full call.
    const maxTotal = player.committed + player.stack;
    if (maxTotal > this.currentBet && !player.acted) {
      const minTotal = Math.min(this.currentBet + this.minRaise, maxTotal);
      const capped = this.variant.betting === 'pot-limit'
        ? Math.min(maxTotal, this.potLimitMax(player))
        : maxTotal;
      if (capped >= minTotal) {
        actions.push({
          type: this.currentBet === 0 ? 'bet' : 'raise',
          min: minTotal,
          max: capped,
          allIn: capped === maxTotal,
        });
      } else if (maxTotal > this.currentBet) {
        // Short stack: the only raise available is all-in.
        actions.push({ type: this.currentBet === 0 ? 'bet' : 'raise', min: maxTotal, max: maxTotal, allIn: true });
      }
    }
    return actions;
  }

  /** Pot-limit cap: call first, then bet the pot that call creates. */
  potLimitMax(player) {
    const toCall = Math.max(0, this.currentBet - player.committed);
    const potAfterCall = this.totalPot + toCall;
    return this.currentBet + potAfterCall;
  }

  /* ---------------- acting ---------------- */

  /**
   * @param {{type:string, amount?:number}} action
   * `amount` on bet/raise is the TOTAL this player will have committed on
   * this street, matching how poker sites report raises ("raise to 30").
   */
  act(action) {
    const player = this.actor;
    if (!player) throw new Error('Nobody is to act');
    if (this.handOver) throw new Error('Hand is already complete');

    const legal = this.legalActions(player);
    const match = legal.find((a) => a.type === action.type);
    if (!match) {
      throw new Error(`Illegal action ${action.type}; legal: ${legal.map((a) => a.type).join(', ')}`);
    }

    const toCall = Math.max(0, this.currentBet - player.committed);

    switch (action.type) {
      case 'fold':
        player.folded = true;
        player.lastAction = 'Fold';
        this.log('fold', { player: player.id });
        break;

      case 'check':
        player.acted = true;
        player.lastAction = 'Check';
        this.log('check', { player: player.id });
        break;

      case 'call': {
        const paid = this.commit(player, toCall);
        player.acted = true;
        player.lastAction = player.allIn ? `All-in ${paid}` : `Call ${paid}`;
        this.log('call', { player: player.id, amount: paid });
        break;
      }

      case 'bet':
      case 'raise': {
        let total = Math.round(action.amount ?? match.min);
        total = Math.max(match.min, Math.min(total, match.max));
        const raiseIncrement = total - this.currentBet;
        const paid = this.commit(player, total - player.committed);

        // A raise smaller than a full min-raise (only possible all-in) does
        // not reopen betting for players who already acted.
        const fullRaise = raiseIncrement >= this.minRaise;
        if (fullRaise) this.minRaise = raiseIncrement;
        this.currentBet = Math.max(this.currentBet, player.committed);

        if (fullRaise) {
          for (const other of this.players) {
            if (other !== player && !other.folded && !other.allIn) other.acted = false;
          }
        }
        player.acted = true;
        this.lastAggressor = player;
        player.lastAction = player.allIn ? `All-in ${player.committed}` : `${action.type === 'bet' ? 'Bet' : 'Raise to'} ${player.committed}`;
        this.log(action.type, { player: player.id, amount: paid, to: player.committed, allIn: player.allIn });
        break;
      }
      default:
        throw new Error(`Unknown action ${action.type}`);
    }

    this.advance();
    return this;
  }

  /** Move to the next actor, next street, or showdown. */
  advance() {
    if (this.contestants.length === 1) return this.finish('fold');

    if (this.bettingRoundComplete()) {
      this.collectBets();
      if (this.street === 'river') return this.finish('showdown');
      this.nextStreet();
      return this;
    }

    const next = this.nextToAct(this.actingIndex);
    if (next === -1) {
      this.collectBets();
      return this.runOutAndShowdown();
    }
    this.actingIndex = next;
    return this;
  }

  bettingRoundComplete() {
    const canAct = this.bettable;
    if (canAct.length === 0) return true;
    // One player left who can act, and everyone else is all-in or folded:
    // they only owe an action if they still face a bet.
    for (const p of canAct) {
      if (!p.acted) return false;
      if (p.committed !== this.currentBet) return false;
    }
    return true;
  }

  /** Nobody can bet any more (everyone all-in): deal the rest and show down. */
  settleIfNoActionPossible() {
    if (this.bettable.length <= 1 && this.contestants.length > 1) {
      const someoneOwesMoney = this.bettable.some((p) => p.committed < this.currentBet);
      if (!someoneOwesMoney) {
        this.collectBets();
        this.runOutAndShowdown();
      }
    }
    return this;
  }

  collectBets() {
    for (const p of this.players) {
      this.pot += p.committed;
      p.committed = 0;
    }
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    for (const p of this.players) p.acted = false;
  }

  nextStreet() {
    const idx = STREETS.indexOf(this.street);
    this.street = STREETS[idx + 1];
    const need = BOARD_CARDS[this.street] - this.board.length;
    this.deck.pop(); // burn card, as dealt live
    for (let i = 0; i < need; i++) this.board.push(this.deck.pop());
    this.log('board', { cards: cardsToString(this.board) });

    for (const p of this.players) { p.acted = false; p.lastAction = null; }
    this.lastAggressor = null;

    const first = this.nextToAct(this.button);
    if (first === -1 || this.bettable.length <= 1) return this.runOutAndShowdown();
    this.actingIndex = first;
    return this;
  }

  /** Everyone is all-in: deal the remaining board and settle. */
  runOutAndShowdown() {
    while (this.board.length < 5 && this.contestants.length > 1) {
      this.deck.pop();
      this.board.push(this.deck.pop());
    }
    this.street = 'river';
    this.log('runout', { cards: cardsToString(this.board) });
    return this.finish('showdown');
  }

  /* ---------------- settlement ---------------- */

  /**
   * Split the pot into main and side pots.
   * Folded players' chips still count toward the pot they were in; they are
   * simply not eligible to win it.
   */
  buildPots() {
    const levels = [...new Set(this.players.filter((p) => p.totalCommitted > 0).map((p) => p.totalCommitted))]
      .sort((a, b) => a - b);
    const pots = [];
    let previous = 0;
    for (const level of levels) {
      let amount = 0;
      for (const p of this.players) {
        amount += Math.max(0, Math.min(p.totalCommitted, level) - previous);
      }
      const eligible = this.players.filter((p) => !p.folded && p.totalCommitted >= level);
      if (amount > 0) pots.push({ amount, eligible });
      previous = level;
    }
    // Merge adjacent pots contested by exactly the same players.
    const merged = [];
    for (const pot of pots) {
      const last = merged[merged.length - 1];
      const sameField = last && last.eligible.length === pot.eligible.length
        && last.eligible.every((p, i) => p === pot.eligible[i]);
      if (sameField) last.amount += pot.amount;
      else merged.push(pot);
    }
    return merged;
  }

  finish(reason) {
    this.collectBets();
    const pots = this.buildPots();
    const payouts = new Map(this.players.map((p) => [p.id, 0]));
    const showdown = [];

    const scores = new Map();
    if (reason === 'showdown') {
      for (const p of this.contestants) {
        const score = evaluateHand(p.hole, this.board, this.variant);
        scores.set(p.id, score);
        showdown.push({
          id: p.id,
          name: p.name,
          hole: p.hole.slice(),
          score,
          description: describeScore(score, this.variant.shortDeck),
        });
      }
    }

    for (const pot of pots) {
      let winners;
      if (reason === 'fold' || pot.eligible.length === 1) {
        winners = pot.eligible.length ? [pot.eligible[0]] : [];
      } else {
        const best = Math.max(...pot.eligible.map((p) => scores.get(p.id) ?? -1));
        winners = pot.eligible.filter((p) => scores.get(p.id) === best);
      }
      if (!winners.length) continue;

      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      // Odd chips go to the first winner left of the button.
      const ordered = this.orderFromButton(winners);
      for (const w of ordered) {
        let take = share;
        if (remainder > 0) { take += 1; remainder -= 1; }
        payouts.set(w.id, payouts.get(w.id) + take);
      }
    }

    for (const p of this.players) {
      const won = payouts.get(p.id) || 0;
      p.stack += won;
      p.wonThisHand = won;
    }

    this.street = 'complete';
    this.pot = 0;
    showdown.sort((a, b) => b.score - a.score);

    this.result = {
      reason,
      board: this.board.slice(),
      pots: pots.map((pot) => ({ amount: pot.amount, eligible: pot.eligible.map((p) => p.id) })),
      payouts: Object.fromEntries(payouts),
      showdown,
      net: Object.fromEntries(this.players.map((p) => [p.id, (payouts.get(p.id) || 0) - p.totalCommitted])),
      handNumber: this.handNumber,
    };
    this.log('result', { reason, payouts: this.result.payouts });
    return this;
  }

  orderFromButton(players) {
    const order = [];
    for (let step = 1; step <= this.players.length; step++) {
      const i = (this.button + step) % this.players.length;
      const found = players.find((p) => p.seat === i);
      if (found) order.push(found);
    }
    return order.length === players.length ? order : players;
  }

  /** Snapshot for the UI / bots — never hands out other players' cards. */
  view(forPlayerId = null) {
    return {
      handNumber: this.handNumber,
      street: this.street,
      board: this.board.slice(),
      pot: this.totalPot,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      bigBlind: this.bigBlind,
      variant: this.variant,
      actingId: this.actor ? this.actor.id : null,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        stack: p.stack,
        committed: p.committed,
        totalCommitted: p.totalCommitted,
        folded: p.folded,
        allIn: p.allIn,
        sittingOut: p.sittingOut,
        position: p.position,
        isHero: p.isHero,
        lastAction: p.lastAction,
        hole: p.id === forPlayerId || this.handOver ? p.hole.slice() : null,
      })),
      result: this.result,
    };
  }
}

export function createTable(config) {
  return new Table(config);
}
