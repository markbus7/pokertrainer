/**
 * Equity: how often a hand wins, ties or loses by the river.
 *
 * Exact enumeration when the remaining board is small enough to walk
 * (turn and river spots), Monte Carlo otherwise. Every drill that quotes a
 * percentage goes through here, so the numbers a student learns are real.
 */

import { makeDeck, removeCards, RANK_CHARS, SUIT_SYMBOLS, SUIT_NAMES, RANK_NAMES, RANK_PLURALS, rankOf } from './cards.js';
import { evaluateHand, describeScore, shortCategoryName, categoryOf, kickersOf, CAT } from './evaluator.js';
import { makeRng, shuffle } from './rng.js';

const HOLDEM = { omaha: false, shortDeck: false };

/** Number of board cards each street still needs. */
export const cardsToCome = (boardLength) => Math.max(0, 5 - boardLength);

/**
 * Equity for a set of known hands.
 * @param {number[][]} hands  hole cards per player
 * @param {number[]}   board  0-5 community cards
 * @returns {{equity:number[], win:number[], tie:number[], iterations:number, exact:boolean}}
 */
export function handEquity(hands, board = [], options = {}) {
  const variant = options.variant || HOLDEM;
  const trials = options.trials || 8000;
  const rng = options.rng || makeRng();

  const dead = board.concat(...hands, ...(options.dead || []));
  const deck = removeCards(makeDeck(variant.shortDeck), dead);
  const need = cardsToCome(board.length);

  const win = new Array(hands.length).fill(0);
  const tie = new Array(hands.length).fill(0);
  const equity = new Array(hands.length).fill(0);
  let count = 0;

  const settle = (fullBoard) => {
    count++;
    let best = -1;
    let winners = 0;
    const scores = new Array(hands.length);
    for (let i = 0; i < hands.length; i++) {
      const s = evaluateHand(hands[i], fullBoard, variant);
      scores[i] = s;
      if (s > best) { best = s; winners = 1; } else if (s === best) winners++;
    }
    for (let i = 0; i < hands.length; i++) {
      if (scores[i] !== best) continue;
      if (winners === 1) { win[i]++; equity[i] += 1; } else { tie[i]++; equity[i] += 1 / winners; }
    }
  };

  // Exact enumeration is cheap for <= 2 cards to come; use it and say so.
  const exact = need === 0 || need === 1 || (need === 2 && deck.length <= 50);
  if (exact) {
    if (need === 0) {
      settle(board);
    } else if (need === 1) {
      for (let i = 0; i < deck.length; i++) settle(board.concat(deck[i]));
    } else {
      for (let i = 0; i < deck.length; i++) {
        for (let j = i + 1; j < deck.length; j++) settle(board.concat(deck[i], deck[j]));
      }
    }
  } else {
    const pool = deck.slice();
    for (let t = 0; t < trials; t++) {
      // Partial shuffle: only the cards we actually deal.
      for (let k = 0; k < need; k++) {
        const j = k + Math.floor(rng() * (pool.length - k));
        const tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
      }
      settle(board.concat(pool.slice(0, need)));
    }
  }

  return {
    equity: equity.map((e) => e / count),
    win: win.map((w) => w / count),
    tie: tie.map((t) => t / count),
    iterations: count,
    exact,
  };
}

/** Convenience: our equity as a single number, 0..1. */
export function equityVs(hero, villains, board = [], options = {}) {
  return handEquity([hero, ...villains], board, options).equity[0];
}

/**
 * Hero versus a *range* (array of two-card combos), which is what real
 * decisions are actually against.
 */
export function equityVsRange(hero, rangeCombos, board = [], options = {}) {
  const trials = options.trials || 6000;
  const rng = options.rng || makeRng();
  const variant = options.variant || HOLDEM;
  const blocked = new Set([...hero, ...board]);
  const live = rangeCombos.filter((c) => !c.some((card) => blocked.has(card)));
  if (!live.length) return { equity: 0.5, iterations: 0, live: 0 };

  const deck = removeCards(makeDeck(variant.shortDeck), [...hero, ...board]);
  const need = cardsToCome(board.length);
  let total = 0;
  let count = 0;

  for (let t = 0; t < trials; t++) {
    const villain = live[Math.floor(rng() * live.length)];
    const pool = deck.filter((c) => c !== villain[0] && c !== villain[1]);
    shuffle(rng, pool);
    const full = board.concat(pool.slice(0, need));
    const h = evaluateHand(hero, full, variant);
    const v = evaluateHand(villain, full, variant);
    total += h > v ? 1 : h === v ? 0.5 : 0;
    count++;
  }
  return { equity: total / count, iterations: count, live: live.length };
}

/**
 * Equity against `opponents` unknown hands. This is what a player can
 * actually estimate at the table — your own cards, the board, and a count of
 * how many opponents are still in. Used by both the bots and the coach, so
 * they always agree about how strong a hand is.
 */
export function equityVsField(hole, board, opponents, variant = HOLDEM, rng = makeRng(), trials = 400) {
  const used = new Set([...hole, ...board]);
  const deck = makeDeck(variant.shortDeck).filter((c) => !used.has(c));
  const need = cardsToCome(board.length);
  const holeCards = variant.holeCards || 2;
  const draw = opponents * holeCards + need;
  if (opponents < 1) return 1;
  if (draw > deck.length) return 0.5;

  let total = 0;
  for (let t = 0; t < trials; t++) {
    for (let k = 0; k < draw; k++) {
      const j = k + Math.floor(rng() * (deck.length - k));
      const tmp = deck[k]; deck[k] = deck[j]; deck[j] = tmp;
    }
    const offset = opponents * holeCards;
    const full = board.concat(deck.slice(offset, offset + need));
    const heroScore = evaluateHand(hole, full, variant);
    let best = heroScore;
    let ties = 1;
    for (let o = 0; o < opponents; o++) {
      const villain = deck.slice(o * holeCards, (o + 1) * holeCards);
      const score = evaluateHand(villain, full, variant);
      if (score > best) { best = score; ties = 1; } else if (score === best) ties++;
    }
    if (heroScore === best) total += 1 / ties;
  }
  return total / trials;
}

/**
 * Outs: cards that turn a losing hand into a winning one on the next street.
 * Counted by simulation against the actual opponent hand, which is how a
 * student should learn to see them — "which cards save me right now".
 */
export function countOuts(hero, villain, board) {
  if (board.length >= 5) return { outs: [], count: 0 };
  const deck = removeCards(makeDeck(), [...hero, ...villain, ...board]);
  const outs = [];
  const behindNow = evaluateHand(hero, board, HOLDEM) <= evaluateHand(villain, board, HOLDEM);
  for (const card of deck) {
    const next = board.concat(card);
    const h = evaluateHand(hero, next, HOLDEM);
    const v = evaluateHand(villain, next, HOLDEM);
    if (h > v) outs.push(card);
  }
  return { outs, count: outs.length, behindNow };
}

/** "8\u2660" rather than "8s" \u2014 readable in a sentence. */
export const cardToPretty = (card) => RANK_CHARS[card >> 2] + SUIT_SYMBOLS[card & 3];

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const countWord = (n) => COUNT_WORDS[n] || String(n);

/**
 * A hand named the way a player says it mid-sentence: "a pair of eights",
 * "trip sevens", "an ace-high flush". describeScore is Title Case and shaped
 * like a headline, which reads wrong inside prose.
 */
export function handPhrase(score) {
  const k = kickersOf(score);
  const one = (r) => RANK_NAMES[r].toLowerCase();
  const many = (r) => RANK_PLURALS[r].toLowerCase();
  const art = (word) => (/^[aeiou]/.test(word) ? 'an' : 'a');
  switch (categoryOf(score)) {
    case CAT.STRAIGHT_FLUSH: return k[0] === 14 ? 'a royal flush' : `${art(one(k[0]))} ${one(k[0])}-high straight flush`;
    case CAT.QUADS: return `four ${many(k[0])}`;
    case CAT.FULL_HOUSE: return `${many(k[0])} full of ${many(k[1])}`;
    case CAT.FLUSH: return `${art(one(k[0]))} ${one(k[0])}-high flush`;
    case CAT.STRAIGHT: return `${art(one(k[0]))} ${one(k[0])}-high straight`;
    case CAT.TRIPS: return `trip ${many(k[0])}`;
    case CAT.TWO_PAIR: return `two pair, ${many(k[0])} and ${many(k[1])}`;
    case CAT.PAIR: return `a pair of ${many(k[0])}`;
    default: return `${one(k[0])} high`;
  }
}

/** Fallback wording when a group's cards make the same category at different heights. */
const CATEGORY_PHRASES = {
  'High Card': 'high card', 'One Pair': 'a pair', 'Two Pair': 'two pair',
  'Three of a Kind': 'trips', 'Straight': 'a straight', 'Flush': 'a flush',
  'Full House': 'a full house', 'Four of a Kind': 'quads', 'Straight Flush': 'a straight flush',
};

/**
 * Which cards are your outs, and what each one actually makes.
 *
 * countOuts already knows the exact cards; quoting only the total asks a
 * student to take the number on trust, which is the one thing a trainer
 * should never do. This turns the same list into the sentence a coach would
 * say out loud: you have this, they have that, and here are the cards that
 * change it.
 */
export function describeOuts(hero, villain, board) {
  const { outs, count, behindNow } = countOuts(hero, villain, board);
  const heroNow = handPhrase(evaluateHand(hero, board, HOLDEM));
  const villainNow = handPhrase(evaluateHand(villain, board, HOLDEM));
  if (!count) {
    return { outs, count, behindNow, heroNow, villainNow, groups: [], sentence: 'No card on the turn puts you in front.' };
  }

  // Group by the category an out makes, so nine hearts read as one flush draw
  // rather than nine separate facts.
  const byCategory = new Map();
  for (const card of outs) {
    const score = evaluateHand(hero, board.concat(card), HOLDEM);
    const key = shortCategoryName(score);
    if (!byCategory.has(key)) byCategory.set(key, { cards: [], full: new Set(), said: new Set() });
    const g = byCategory.get(key);
    g.cards.push(card);
    g.full.add(describeScore(score));
    g.said.add(handPhrase(score));
  }

  const groups = [...byCategory.entries()]
    .map(([category, g]) => ({
      // "Pair of Eights" when every card in the group makes the same hand,
      // "Flush" when they differ only in how high it runs.
      label: g.full.size === 1 ? [...g.full][0] : category,
      // Nine hearts of differing height are still just "a flush" in prose.
      said: g.said.size === 1 ? [...g.said][0] : (CATEGORY_PHRASES[category] || category.toLowerCase()),
      cards: g.cards,
      text: g.cards.map(cardToPretty).join(' '),
    }))
    .sort((a, b) => b.cards.length - a.cards.length);

  // "the three eights" and "the nine hearts" are how a player says this out
  // loud; "nine cards" is the fallback when the group has no single shape.
  const namedCards = (cards) => {
    const ranks = [...new Set(cards.map(rankOf))];
    const suits = [...new Set(cards.map((c) => c & 3))];
    const n = countWord(cards.length);
    if (ranks.length === 1) return `the ${n} ${RANK_PLURALS[ranks[0]].toLowerCase()}`;
    if (suits.length === 1) return `the ${n} ${SUIT_NAMES[suits[0]]}`;
    if (ranks.length === 2) {
      const [a, b] = ranks.map((r) => RANK_PLURALS[r].toLowerCase());
      const ca = cards.filter((c) => rankOf(c) === ranks[0]).length;
      const cb = cards.length - ca;
      return `the ${countWord(ca)} ${a} and ${countWord(cb)} ${b}`;
    }
    return `${n} card${cards.length === 1 ? '' : 's'}`;
  };

  const phrase = (g) => `${namedCards(g.cards)} (${g.text}) give${
    g.cards.length === 1 ? 's' : ''} you ${g.said}`;

  const parts = groups.map(phrase);
  const list = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;

  return {
    outs,
    count,
    behindNow,
    heroNow,
    villainNow,
    groups,
    sentence: `You have ${heroNow}; they have ${villainNow}. ${
      list.charAt(0).toUpperCase()}${list.slice(1)} \u2014 that is ${count} out${count === 1 ? '' : 's'}.`,
  };
}

/**
 * The "rule of 2 and 4" a live player uses at the table, plus the true number
 * so a drill can show how good the shortcut actually is.
 */
export function ruleOfTwoAndFour(outs, street) {
  const multiplier = street === 'flop' ? 4 : 2;
  return outs * multiplier / 100;
}

export function exactOutsEquity(outs, street) {
  if (street === 'turn') return outs / 46;
  // Flop, two cards to come: 1 - P(miss both).
  return 1 - ((47 - outs) / 47) * ((46 - outs) / 46);
}
