/**
 * How much to bet.
 *
 * The coach graded whether you bet, and hardly ever how much: a 3-bet to twice
 * the open and one to four times it were the same "correct" to it. And the box
 * under the buttons starts every decision at half the pot — a fine flop bet, a
 * poor 3-bet — so a reader who bets "what it shows" was being taught the box's
 * size, not poker's.
 *
 * So every bet and raise is sized against the kind of spot it is, by the rules
 * of thumb a beginner can carry to any table:
 *
 *   opening            2.5 big blinds (3 from the small blind), the same with every hand
 *   over limpers       3 big blinds + 1 for each limper, one more from the blinds
 *   3-bet              3x their raise in position, 4x out of it, +1x for each caller
 *   4-bet              about 2.2-2.5x the 3-bet
 *   raising a bet      about 3x their bet
 *   flop, dry board    a third of the pot, with everything
 *   flop, wet board    three quarters with strong hands and draws, a third with medium ones
 *   turn               half to three quarters with strong hands and draws, a third with medium ones
 *   river              three quarters with strong hands and bluffs alike, a third with medium ones
 *
 * A size near its rule is right; one well off it is said, as close; one far off
 * it is a mistake. With a short stack all-in is the right size, because any
 * real bet would commit the stack anyway.
 *
 * The rules that turn on the hand you hold (after the flop) are graded with
 * your equity, but never advised with it: before you act, Silas says the rule
 * for each kind of hand, and which kind yours is stays your question.
 */

import { describeTexture } from './board.js';
import { breakEvenBluffFrequency } from './odds.js';

/** Who acts when after the flop, first to last. The button is always last. */
const ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN'];
const acts = (position) => {
  const i = ORDER.indexOf(position);
  return i < 0 ? 4 : i;
};

const chips = (n) => String(Math.round(n));
const one = (x) => (Math.round(x * 10) / 10).toString();
const pct = (x) => `${Math.round(x * 100)}%`;

/**
 * The spot a bet or raise is sized in, read off the table at the moment it is
 * your turn. Plain numbers and flags only: it is kept with the hand, so the
 * Log can grade the size again when you replay it.
 */
export function sizingContextOf(table, hero) {
  const street = table.street;
  let raises = 0;
  let limpers = 0;
  let callers = 0;
  let lastRaiser = null;
  const limpedBy = [];
  for (const h of table.history) {
    if (h.street !== street) continue;
    if (h.type === 'bet' || h.type === 'raise') {
      raises++;
      callers = 0;
      lastRaiser = h.player;
    } else if (h.type === 'call') {
      if (raises === 0) {
        limpers++;
        limpedBy.push(h.player);
      } else callers++;
    }
  }
  const raiser = lastRaiser && lastRaiser !== hero.id ? table.player(lastRaiser) : null;
  const others = table.contestants.filter((p) => p !== hero);
  const after = (p) => Boolean(p) && acts(hero.position) > acts(p.position);
  // Before the flop, position is what you will have after it: against the
  // raiser if there is one, otherwise against the limpers — and the small
  // blind is out of position against everyone.
  const inPosition = street === 'preflop'
    ? (raiser ? after(raiser)
      : hero.position !== 'SB' && limpedBy.every((id) => id === hero.id || after(table.player(id))))
    : others.every(after);
  const legal = table.legalActions(hero).find((a) => a.type === 'bet' || a.type === 'raise');
  const texture = table.board.length >= 3 ? describeTexture(table.board) : null;
  return {
    street,
    bb: table.bigBlind,
    pot: table.totalPot,
    currentBet: table.currentBet,
    toCall: Math.max(0, table.currentBet - hero.committed),
    stack: hero.stack,
    allInTo: hero.committed + hero.stack,
    effective: table.effectiveStack(hero),
    minTo: legal ? legal.min : null,
    maxTo: legal ? legal.max : null,
    raises,
    limpers,
    // A blind completing is half a limp: it never adds a big blind to a raise.
    // Heads-up the button posts the small blind, so its limp is one too.
    blindLimps: limpedBy.filter((id) => {
      const p = table.player(id);
      if (!p || id === hero.id) return false;
      return p.position === 'SB' || (p.position === 'BTN' && table.players.filter((x) => !x.sittingOut).length === 2);
    }).length,
    callers,
    inPosition,
    position: hero.position || null,
    opponents: others.length,
    wet: texture ? texture.wet : false,
    tags: texture ? texture.tags.join(', ') : '',
    potLimit: Boolean(table.variant && table.variant.betting === 'pot-limit'),
  };
}

/**
 * What kind of hand you are betting, the way the sizing rules ask it: strong,
 * medium, a draw, or weak (a bluff). From the equity the coach measured at
 * your turn, and the outs, which only make a draw before the river.
 */
export function handClass(spot) {
  const equity = Number.isFinite(spot.equity) ? spot.equity : 0.5;
  const outs = Number.isFinite(spot.outs) ? spot.outs : (spot.sizing && spot.sizing.outs) || 0;
  if (spot.street !== 'river' && outs >= 8 && equity < 0.65) return 'draw';
  if (equity >= 0.65) return 'strong';
  if (equity <= 0.35) return 'weak';
  return 'medium';
}

/* ------------------------------------------------------------------ *
 * The rules
 * ------------------------------------------------------------------ */

/** After the flop, as shares of the pot: [low, high, target] by street, board and hand. */
const BETS = {
  flop: {
    dry: { strong: [0.25, 0.6, 1 / 3], draw: [0.25, 0.6, 1 / 3], medium: [0.2, 0.55, 1 / 3], weak: [0.25, 0.6, 1 / 3] },
    wet: { strong: [0.55, 1, 0.75], draw: [0.5, 1, 0.75], medium: [0.2, 0.55, 1 / 3], weak: [0.5, 1, 0.75] },
  },
  turn: { strong: [0.5, 1.1, 2 / 3], draw: [0.5, 1, 2 / 3], medium: [0.2, 0.55, 1 / 3], weak: [0.5, 1, 2 / 3] },
  river: { strong: [0.5, 1.25, 0.75], medium: [0.2, 0.6, 1 / 3], weak: [0.5, 1, 0.75] },
};

/** How far off a postflop bet has to be, by hand, before it is a mistake rather than close. */
const BET_MISTAKE = {
  strong: { small: 0.2, big: 3 },
  draw: { small: 0, big: 2 },
  medium: { small: 0, big: 1.5 },
  weak: { small: 0, big: 2 },
};

/**
 * The rule for this spot: what is measured (big blinds, times the bet faced,
 * or share of the pot), the range that is right, the size Silas would make,
 * and how far off is a mistake. `cls` is the hand class; without one, the
 * postflop rules that depend on it give only their sentence.
 */
function planFor(ctx, cls) {
  const effBb = ctx.effective / ctx.bb;
  if (ctx.street === 'preflop') {
    // Pot-limit games open to the pot; these rules are for no-limit.
    if (ctx.potLimit) return null;
    if (ctx.raises === 0 && ctx.limpers === 0) {
      const sb = ctx.position === 'SB';
      return {
        kind: 'open', unit: 'bb',
        low: 2, high: sb ? 4 : 3.5, target: effBb <= 25 && effBb > 12 ? 2 : sb ? 3 : 2.5,
        smallBad: 0, bigBad: 6,
        allInOk: effBb <= 25, allInTarget: effBb <= 12, short: effBb <= 25, shoveOnly: effBb <= 12,
      };
    }
    if (ctx.raises === 0) {
      const target = (ctx.inPosition ? 3 : 4) + ctx.limpers - (ctx.blindLimps || 0);
      return {
        kind: 'iso', unit: 'bb', low: target - 0.75, high: target + 2, target,
        smallBad: 0.6 * target, bigBad: 2 * target, allInOk: effBb <= 25, allInTarget: effBb <= 12,
      };
    }
    if (ctx.raises === 1) {
      const target = (ctx.inPosition ? 3 : 4) + ctx.callers;
      const low = (ctx.inPosition ? 2.6 : 3.2) + ctx.callers;
      const high = (ctx.inPosition ? 4 : 5) + ctx.callers;
      return {
        kind: '3bet', unit: 'x', low, high, target,
        smallBad: low - 0.7, bigBad: high + 2.5, allInOk: effBb <= 30, allInTarget: effBb <= 25,
      };
    }
    if (ctx.raises === 2) {
      return {
        kind: '4bet', unit: 'x', low: 2, high: 3.2, target: ctx.inPosition ? 2.3 : 2.5,
        smallBad: 0, bigBad: Infinity, allInOk: effBb <= 50, allInTarget: effBb <= 40,
      };
    }
    // A 5-bet is all-in or nothing: there is no size to teach.
    return null;
  }
  if (ctx.currentBet > 0) {
    return {
      kind: 'raise', unit: 'x', low: 2.5, high: 4, target: 3,
      smallBad: 0, bigBad: Infinity, allInOk: ctx.stack <= 1.5 * (ctx.pot + ctx.toCall),
    };
  }
  const street = ctx.street;
  const table = street === 'flop' ? BETS.flop[ctx.wet ? 'wet' : 'dry'] : BETS[street];
  if (!table) return null;
  if (!cls) {
    // The dry flop is the one bet whose size does not depend on the hand.
    const dry = street === 'flop' && !ctx.wet;
    return { kind: street, unit: 'pot', target: dry ? 1 / 3 : null, ruleOnly: true };
  }
  const row = table[cls] || table.medium;
  const high = street === 'river' && cls === 'strong' && ctx.equity >= 0.9 ? 2 : row[1];
  return {
    kind: street, unit: 'pot', low: row[0], high, target: row[2],
    smallBad: BET_MISTAKE[cls].small, bigBad: BET_MISTAKE[cls].big,
    allInOk: ctx.stack <= 1.25 * ctx.pot,
  };
}

/** The only limp is the small blind completing: blind against blind, or heads-up. */
const blindOnly = (ctx) => ctx.limpers === 1 && ctx.blindLimps === 1;

/** A measure in its unit, as chips to raise or bet to. */
function toChips(ctx, unit, x) {
  if (unit === 'bb') return x * ctx.bb;
  if (unit === 'x') return x * ctx.currentBet;
  return ctx.currentBet + x * (ctx.pot + ctx.toCall);
}

/** The chips you bet or raised to, in the plan's unit. */
function measure(ctx, unit, amount) {
  if (unit === 'bb') return amount / ctx.bb;
  if (unit === 'x') return amount / Math.max(1, ctx.currentBet);
  return (amount - ctx.currentBet) / Math.max(1, ctx.pot + ctx.toCall);
}

const legalClamp = (ctx, n) => {
  let x = Math.round(n);
  if (Number.isFinite(ctx.minTo) && ctx.minTo !== null) x = Math.max(ctx.minTo, x);
  if (Number.isFinite(ctx.maxTo) && ctx.maxTo !== null) x = Math.min(ctx.maxTo, x);
  return x;
};

/** The size Silas would make here, in chips — all-in when that is the size. */
function targetChips(ctx, plan) {
  if (plan.target === null || plan.target === undefined) return null;
  const allIn = ctx.maxTo !== null && ctx.maxTo === ctx.allInTo ? ctx.allInTo : null;
  if (allIn !== null && plan.allInTarget) return allIn;
  const raw = toChips(ctx, plan.unit, plan.target);
  // A normal raise that would put in close to half the stack commits it: then
  // all-in is the size, and the rule says so.
  if (allIn !== null && plan.unit === 'x' && plan.allInOk && raw >= 0.45 * ctx.allInTo) return allIn;
  return legalClamp(ctx, raw);
}

/* ------------------------------------------------------------------ *
 * Before you act: the rule, and Silas's size
 * ------------------------------------------------------------------ */

const RULES = {
  open: 'Opening: raise to 2.5 big blinds — {target} — the same size with every hand you open.',
  openSb: 'Opening from the small blind: 3 big blinds — {target} — the same size with every hand.',
  openShort: 'Short stack, {stack} big blinds: raise to 2 big blinds — {target} — or all-in. Nothing in between.',
  openShove: 'Short stack, {stack} big blinds: all-in or fold.',
  isoIp: 'Over limpers: 3 big blinds plus 1 for each limper — {target} here.',
  isoOop: 'Over limpers, from the blinds: 4 big blinds plus 1 for each limper — {target} here.',
  isoSb: 'Raising a limp from the small blind: about 3 big blinds, 4 out of position — {target}.',
  threeIp: '3-bet in position: about 3 times their raise, plus once more for each caller — {target}.',
  threeOop: '3-bet out of position: about 4 times their raise, plus once more for each caller — {target}.',
  four: '4-bet: about 2.2 to 2.5 times their 3-bet — {target}.',
  shove: 'With {stack} big blinds, the raise here is all-in.',
  raise: 'Raising a bet: about 3 times their bet — {target}.',
  raiseShove: 'Raising with a short stack: all-in.',
  flopDry: 'Dry flop: a third of the pot — {target} — with everything you bet.',
  flopWet: 'Wet flop: ¾ pot with a strong hand or a strong draw; ⅓ pot, or a check, with a medium hand.',
  turn: 'Turn: ½ to ¾ pot with a strong hand or a strong draw; ⅓ pot, or a check, with a medium hand.',
  river: 'River: ¾ pot with strong hands and with bluffs alike; ⅓ pot, or a check, with a medium hand.',
};
export const SIZE_RULES = RULES;

/**
 * What Silas says about the size before you act: the rule for this kind of
 * spot, and — where the size does not depend on the hand you hold — the
 * amount, in chips, for a button of its own. Null where there is nothing to
 * bet or raise, or no size to teach.
 */
export function sizeAdvice(ctx) {
  if (!ctx || ctx.minTo === null || ctx.minTo === undefined) return null;
  if (ctx.minTo === ctx.maxTo) return null;
  const plan = planFor(ctx, null);
  if (!plan) return null;
  const target = targetChips(ctx, plan);
  const allIn = target !== null && target === ctx.allInTo;
  const stack = one(ctx.effective / ctx.bb);
  const params = { target: target === null ? '' : chips(target), stack };
  let rule;
  switch (plan.kind) {
    case 'open':
      rule = allIn ? RULES.openShove : plan.short ? RULES.openShort : ctx.position === 'SB' ? RULES.openSb : RULES.open;
      break;
    case 'iso':
      rule = allIn ? RULES.shove : blindOnly(ctx) ? RULES.isoSb : ctx.inPosition ? RULES.isoIp : RULES.isoOop;
      break;
    case '3bet': rule = allIn ? RULES.shove : ctx.inPosition ? RULES.threeIp : RULES.threeOop; break;
    case '4bet': rule = allIn ? RULES.shove : RULES.four; break;
    case 'raise': rule = allIn ? RULES.raiseShove : RULES.raise; break;
    case 'flop': rule = ctx.wet ? RULES.flopWet : RULES.flopDry; break;
    case 'turn': rule = RULES.turn; break;
    default: rule = RULES.river;
  }
  return { kind: plan.kind, rule, params, target, allIn };
}

/* ------------------------------------------------------------------ *
 * After you act: was the size right
 * ------------------------------------------------------------------ */

/**
 * The size of a bet or raise, graded. Null for anything that is not a bet or
 * a raise, for a spot with only one legal size, or where there is no size to
 * teach (a 5-bet, a pot-limit open).
 *
 * @param {object} spot  the coach's spot: `sizing` (from sizingContextOf),
 *   `action`, `amount` (the total raised or bet to), `equity`, `outs`, `street`
 * @returns {null | {kind:'size', sizeKind:string, verdict:'right'|'small'|'big',
 *   level:'good'|'ok'|'bad', id:string, head:string, body:string,
 *   better:string|null, params:object, target:number|null}}
 */
export function judgeSize(spot) {
  const ctx = spot && spot.sizing;
  if (!ctx || (spot.action !== 'bet' && spot.action !== 'raise')) return null;
  const amount = Math.round(Number(spot.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (ctx.minTo !== null && ctx.minTo !== undefined && ctx.minTo === ctx.maxTo) return null;
  const cls = ctx.street === 'preflop' || ctx.currentBet > 0 ? null : handClass({ ...spot, street: ctx.street });
  const plan = planFor({ ...ctx, equity: spot.equity }, cls || 'medium');
  if (!plan || plan.ruleOnly) return null;

  const allIn = amount >= ctx.allInTo;
  const target = targetChips(ctx, plan);
  const x = measure(ctx, plan.unit, amount);
  const params = {
    size: chips(amount),
    target: target === null ? '' : chips(target),
    bb: one(amount / ctx.bb),
    times: one(amount / Math.max(1, ctx.currentBet)),
    pct: pct(x),
    stack: plan.unit === 'pot' || plan.kind === 'raise' ? chips(ctx.stack) : one(ctx.effective / ctx.bb),
    pot: chips(ctx.pot),
    tags: ctx.tags,
    mult: one(plan.target),
    folds: pct(breakEvenBluffFrequency(Math.max(1, amount - ctx.currentBet), Math.max(1, ctx.pot))),
  };
  const base = { kind: 'size', sizeKind: plan.kind, cls, params, target };

  // With a short stack, all-in is a size, and the right one.
  if (allIn && plan.allInOk) {
    if (cls === 'medium') return null;
    return { ...base, verdict: 'right', level: 'good', id: `size-${plan.kind}-shove`, ...SHOVE[plan.unit === 'pot' || plan.kind === 'raise' ? 'post' : 'pre'], better: null };
  }

  // The range in chips, inside what was legal: in a small pot the rule can ask
  // for less than the minimum raise, and the minimum is then the right size.
  const lowC = legalClamp(ctx, toChips(ctx, plan.unit, plan.low));
  const highC = Math.max(lowC, legalClamp(ctx, toChips(ctx, plan.unit, plan.high)));
  const small = amount < Math.floor(lowC + 1e-9);
  const big = amount > Math.ceil(highC - 1e-9);

  // Short stack: an open that is not all-in, when only all-in will do, or one
  // that is neither small nor all-in.
  if (plan.kind === 'open' && plan.shoveOnly && !allIn) {
    return { ...base, verdict: 'small', level: 'ok', id: 'size-open-shove-only', ...TEXT.openShoveOnly, better: 'All-in' };
  }
  if (plan.kind === 'open' && plan.short && !allIn && amount / ctx.bb > plan.high) {
    return { ...base, verdict: 'big', level: 'ok', id: 'size-open-short', ...TEXT.openShort, better: 'Raise to about {target}, or all-in' };
  }
  if (!small && !big) {
    return { ...base, verdict: 'right', level: 'good', id: `size-${plan.kind}-right`, ...rightText(plan, ctx, cls), better: null };
  }
  const verdict = small ? 'small' : 'big';
  const bad = small ? x < plan.smallBad : x > plan.bigBad;
  const text = wrongText(plan, { ...ctx, allIn }, cls, verdict, bad);
  return {
    ...base, verdict, level: bad ? 'bad' : 'ok', id: `size-${plan.kind}-${verdict}`, ...text,
    better: text.better || (target === ctx.allInTo ? 'All-in' : plan.unit === 'pot' ? 'Bet about {target}' : 'Raise to about {target}'),
  };
}

/* ------------------------------------------------------------------ *
 * What is said
 * ------------------------------------------------------------------ */

const SHOVE = {
  pre: {
    head: 'All-in is the size with a short stack',
    body: 'With {stack} big blinds there is no room to raise and then fold. All-in makes them decide for their whole stack.',
  },
  post: {
    head: 'All-in is the size here',
    body: 'With {stack} behind and {pot} in the pot, any real bet commits you anyway. All-in is the size.',
  },
};

const TEXT = {
  openShoveOnly: {
    head: 'All-in or fold with a short stack',
    body: 'With {stack} big blinds, a raise that is called leaves too little to play after the flop, and one that is '
      + 're-raised has to fold or call off the rest anyway. All-in, or fold.',
  },
  openShort: {
    head: 'Raise small, or all-in',
    body: 'With {stack} big blinds, a raise to {bb} big blinds puts a big part of your stack in and still leaves you a '
      + 'decision when they re-raise. Raise to about 2 big blinds, or move all-in.',
  },
};

function rightText(plan, ctx, cls) {
  switch (plan.kind) {
    case 'open':
      return {
        head: 'Standard opening size',
        body: 'About 2.5 big blinds is the usual open, 3 from the small blind: it risks little to win the blinds, and '
          + 'it is the same size with every hand you open, so it tells nobody what you hold.',
      };
    case 'iso':
      if (blindOnly(ctx)) {
        return {
          head: 'Right size against the limp',
          body: 'About 3 big blinds against a limp from the small blind, one more when you will be out of position '
            + 'after the flop: a call is not cheap for them.',
        };
      }
      return {
        head: 'Right size over the limpers',
        body: 'About 3 big blinds plus 1 for every limper, one more from the blinds: big enough that they cannot all '
          + 'call cheaply, so you play the pot against one of them, with the lead.',
      };
    case '3bet':
      return {
        head: 'Right size for a 3-bet',
        body: 'About 3 times their raise when you will have position after the flop, 4 times when you will not, and '
          + 'once more for every caller: calling is expensive for them, and you have not risked more than the hand needs.',
      };
    case '4bet':
      return {
        head: 'Right size for a 4-bet',
        body: 'A 4-bet is a little over twice the 3-bet, 2.2 to 2.5 times: big enough to make them decide now, and '
          + 'small enough to let go if they move all-in.',
      };
    case 'raise':
      return {
        head: 'Right raise size',
        body: 'About 3 times their bet: big enough to charge their draws and build the pot, without risking more than '
          + 'the hand is worth.',
      };
    default:
      break;
  }
  if (cls === 'medium') {
    return {
      head: 'Right size for a medium hand',
      body: 'A medium hand bets small: worse hands can still call it, and it costs little when you are behind.',
    };
  }
  if (plan.kind === 'flop') {
    return ctx.wet
      ? {
        head: 'Right size for this board',
        body: 'A wet board gives them draws. A big bet, about three quarters of the pot, makes every one of them pay to '
          + 'chase.',
      }
      : {
        head: 'Right size for this board',
        body: 'On a dry board a third of the pot does the job: it folds the hands that missed, which is most of them, '
          + 'and costs little when it does not work.',
      };
  }
  if (cls === 'draw') {
    return {
      head: 'Good size for a draw',
      body: 'Betting a strong draw big makes them fold now, or pay to see whether you hit: both are good for you.',
    };
  }
  if (cls === 'weak') {
    return {
      head: 'Good bluff size',
      body: 'A bluff uses the same size as your strong hands, so they cannot tell which is which. At {pct} of the pot '
        + 'it has to work {folds} of the time.',
    };
  }
  return {
    head: 'Good value size',
    body: 'A strong hand wants a big pot: half to three quarters of it on the turn, about three quarters on the river. '
      + 'The hands you beat still call that.',
  };
}

function wrongText(plan, ctx, cls, verdict, bad) {
  const small = verdict === 'small';
  switch (plan.kind) {
    case 'open':
      return {
        head: bad ? 'Far too big an open' : 'Bigger than an open needs',
        body: 'You opened to {bb} big blinds. 2.5 wins the blinds just as often and risks much less, and a big open only '
          + 'gets called by the hands that beat you.',
      };
    case 'iso':
      if (blindOnly(ctx)) {
        return small
          ? {
            head: 'Too small against the limp',
            body: 'A raise to {bb} big blinds gives the small blind a cheap call. About {mult} big blinds, {target}, '
              + 'makes them pay to see a flop.',
          }
          : {
            head: 'Bigger than it needs to be against the limp',
            body: 'A raise to {bb} big blinds risks a lot to win the 2 big blinds in the pot. About {mult}, {target}, '
              + 'does the job.',
          };
      }
      return small
        ? {
          head: 'Too small over the limpers',
          body: 'A raise to {bb} big blinds gives every limper a cheap call, and you end up in a big pot against several '
            + 'players. Raise to about 3 big blinds plus 1 for each limper: {target}.',
        }
        : {
          head: 'Bigger than it needs to be over the limpers',
          body: 'A raise to {bb} big blinds risks a lot to win the little the limpers put in. About 3 big blinds plus 1 '
            + 'for each limper does the job: {target}.',
        };
    case '3bet':
      if (small) {
        return ctx.inPosition
          ? {
            head: 'Too small for a 3-bet',
            body: 'Your 3-bet to {size} is only {times} times their raise: they get a cheap call with almost anything. '
              + 'In position, make it about 3 times: {target}.',
          }
          : {
            head: 'Too small for a 3-bet',
            body: 'Your 3-bet to {size} is only {times} times their raise, and you will play the rest of the hand out of '
              + 'position. Out of position, make it about 4 times: {target}, so calling is not cheap for them.',
          };
      }
      return {
        head: bad ? 'Far too big a 3-bet' : 'Bigger than a 3-bet needs',
        body: '{size} is {times} times their raise. Against that, only the hands that beat you continue. About {mult} '
          + 'times, {target}, does the same job and keeps their worse hands in.',
      };
    case '4bet':
      return small
        ? {
          head: 'Small for a 4-bet',
          body: 'Your 4-bet to {size} is only {times} times their 3-bet: they can call, or re-raise, cheaply. Make it '
            + 'about {target}.',
        }
        : ctx.allIn
          ? {
            head: 'A 4-bet all-in risks too much',
            body: 'All-in as a 4-bet risks your whole stack, {stack} big blinds, to win {pot}: only the hands that beat '
              + 'you call. 4-bet to about {target} instead.',
          }
          : {
          head: 'A 4-bet that commits you',
          body: 'A 4-bet to {size} puts most of your stack in without going all-in. Either 4-bet to about {target}, or '
            + 'move all-in.',
          better: 'Raise to about {target}, or all-in',
        };
    case 'raise':
      return small
        ? {
          head: 'A small raise',
          body: 'A raise to {size} is only {times} times their bet: they can call, or re-raise, cheaply. Raise to about '
            + '3 times their bet: {target}.',
        }
        : {
          head: 'Bigger than the raise needs',
          body: 'A raise to {size} is {times} times their bet. About 3 times, {target}, puts the same pressure on them '
            + 'and risks less.',
        };
    default:
      break;
  }
  // Bets after the flop: what is wrong depends on what you are betting.
  if (small) {
    if (cls === 'strong' && plan.kind === 'flop' && ctx.wet) {
      return {
        head: 'Too small for this board',
        body: 'A {tags} board is full of draws. At {pct} of the pot you are charging them almost nothing to draw out. '
          + 'Bet about three quarters: {target}.',
      };
    }
    if (cls === 'strong') {
      return {
        head: 'Too small for a strong hand',
        body: 'At {pct} of the pot you leave money behind: the worse hands that call this would mostly call a bigger '
          + 'bet too. Bet about {target}.',
      };
    }
    if (cls === 'draw') {
      return {
        head: 'Small for a draw',
        body: 'A small bet with a draw neither folds them out nor builds the pot you want when you hit. Bet about '
          + '{target}, or check.',
      };
    }
    if (cls === 'weak') {
      return {
        head: 'Too small to work as a bluff',
        body: 'A bet of {pct} of the pot is a cheap call for anything with a pair. A bluff has to be big enough to fold '
          + 'their medium hands: about {target}.',
      };
    }
    return {
      head: 'A very small bet',
      body: 'At {pct} of the pot this bet does very little: it neither folds out better hands nor gets much from worse '
        + 'ones. Bet about a third, {target}, or check.',
    };
  }
  if (plan.kind === 'flop' && !ctx.wet && !bad) {
    return {
      head: 'Bigger than it needs to be',
      body: 'On a dry board a third of the pot folds the same hands a big bet does, and costs less when it fails. Bet '
        + 'about {target}.',
    };
  }
  if (cls === 'medium') {
    return {
      head: 'Too big for a medium hand',
      body: 'A bet of {pct} of the pot with a medium hand folds out the worse hands that would have paid you, and gets '
        + 'called by the better ones. Bet small, {target}, or check.',
    };
  }
  if (cls === 'weak') {
    return {
      head: 'An expensive bluff',
      body: 'This bluff risks {size} to win {pot}: it has to work {folds} of the time. About {target} needs far fewer '
        + 'folds.',
    };
  }
  if (cls === 'draw') {
    return {
      head: 'Big for a draw',
      body: 'At {pct} of the pot you risk a lot with a hand that is not made yet. About {target} still makes them pay.',
    };
  }
  return {
    head: 'Bigger than worse hands will pay',
    body: 'At {pct} of the pot the hands you beat mostly fold, and the ones that call are the ones that beat you. About '
      + '{target} gets paid more often.',
  };
}

/** The kinds of size, in the order a hand meets them, with their names. */
export const SIZE_KINDS = [
  { key: 'open', name: 'Opening raises' },
  { key: 'iso', name: 'Raises over limpers' },
  { key: '3bet', name: '3-bets' },
  { key: '4bet', name: '4-bets' },
  { key: 'flop', name: 'Flop bets' },
  { key: 'turn', name: 'Turn bets' },
  { key: 'river', name: 'River bets' },
  { key: 'raise', name: 'Raises after the flop' },
];

/** The rules above on one card, spot by spot, for the reference at the table. */
export const SIZE_SHEET = [
  ['Opening', '2.5 big blinds, 3 from the small blind'],
  ['Over limpers', '3 big blinds + 1 for each limper, one more from the blinds'],
  ['3-bet', '3× their raise in position, 4× out of position, +1× for each caller'],
  ['4-bet', '2.2 to 2.5× their 3-bet'],
  ['Short stack, under 25 big blinds', 'raise small, or all-in'],
  ['Flop, dry board', '⅓ pot with everything'],
  ['Flop, wet board', '¾ pot with strong hands and draws, ⅓ with medium ones'],
  ['On the turn', '½ to ¾ pot with strong hands and draws, ⅓ with medium ones'],
  ['On the river', '¾ pot with strong hands and bluffs alike, ⅓ with medium ones'],
  ['Raising a bet', 'about 3× their bet'],
];
