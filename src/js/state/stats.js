/**
 * Session tracking, the same stats a real online HUD shows — because
 * reading your own numbers is how you find your own leaks.
 */

import { bbPer100 } from '../core/odds.js';
import { t } from '../i18n/index.js';

export class SessionStats {
  constructor() { this.reset(); }

  reset() {
    this.hands = 0;
    this.vpipHands = 0;      // voluntarily put money in preflop
    this.pfrHands = 0;       // raised preflop
    this.threeBetHands = 0;
    this.threeBetChances = 0;
    this.bets = 0;
    this.raises = 0;
    this.calls = 0;
    this.folds = 0;
    this.wentToShowdown = 0;
    this.wonAtShowdown = 0;
    this.sawFlop = 0;
    this.wonHands = 0;
    this.profitChips = 0;
    this.bigBlind = 1;
    this.biggestPot = 0;
    this.history = [];       // per-hand net, for the graph
    this.decisions = [];     // coach verdicts, for the leak report
  }

  startHand() {
    this.currentHand = {
      voluntary: false, raisedPreflop: false, threeBet: false, threeBetChance: false,
      sawFlop: false, showdown: false, net: 0,
    };
  }

  recordAction(street, type, context = {}) {
    if (street === 'preflop') {
      if (type === 'call' || type === 'bet' || type === 'raise') this.currentHand.voluntary = true;
      if (type === 'raise' || type === 'bet') {
        this.currentHand.raisedPreflop = true;
        if (context.facingRaise) this.currentHand.threeBet = true;
      }
      if (context.facingRaise) this.currentHand.threeBetChance = true;
    }
    if (type === 'bet') this.bets++;
    else if (type === 'raise') this.raises++;
    else if (type === 'call') this.calls++;
    else if (type === 'fold') this.folds++;
  }

  markStreet(street) {
    if (street !== 'preflop') this.currentHand.sawFlop = true;
  }

  endHand({ net, showdown, won, potSize }) {
    const h = this.currentHand || {};
    this.hands++;
    if (h.voluntary) this.vpipHands++;
    if (h.raisedPreflop) this.pfrHands++;
    if (h.threeBet) this.threeBetHands++;
    if (h.threeBetChance) this.threeBetChances++;
    if (h.sawFlop) this.sawFlop++;
    if (showdown) {
      this.wentToShowdown++;
      if (won) this.wonAtShowdown++;
    }
    if (won) this.wonHands++;
    this.profitChips += net;
    this.biggestPot = Math.max(this.biggestPot, potSize || 0);
    this.history.push(this.profitChips / this.bigBlind);
    this.currentHand = null;
  }

  recordDecision(entry) {
    this.decisions.push(entry);
    if (this.decisions.length > 500) this.decisions.shift();
  }

  get vpip() { return this.hands ? this.vpipHands / this.hands : 0; }
  get pfr() { return this.hands ? this.pfrHands / this.hands : 0; }
  get threeBet() { return this.threeBetChances ? this.threeBetHands / this.threeBetChances : 0; }
  get aggressionFactor() { return this.calls > 0 ? (this.bets + this.raises) / this.calls : (this.bets + this.raises) || 0; }
  get wtsd() { return this.sawFlop ? this.wentToShowdown / this.sawFlop : 0; }
  get wsd() { return this.wentToShowdown ? this.wonAtShowdown / this.wentToShowdown : 0; }
  get profitBb() { return this.profitChips / this.bigBlind; }
  get winRate() { return bbPer100(this.profitBb, this.hands); }

  summary() {
    return {
      hands: this.hands,
      vpip: this.vpip,
      pfr: this.pfr,
      threeBet: this.threeBet,
      af: this.aggressionFactor,
      wtsd: this.wtsd,
      wsd: this.wsd,
      profitBb: this.profitBb,
      winRate: this.winRate,
      history: this.history.slice(),
    };
  }
}

/**
 * Turn a session into plain-English coaching. Thresholds are the ones a
 * winning 6-max reg actually sits at.
 */
export function leakReport(stats) {
  const leaks = [];
  const strengths = [];
  const { hands } = stats;
  if (hands < 20) {
    return {
      ready: false,
      leaks: [],
      strengths: [],
      message: `Play ${20 - hands} more hands and I can tell you what to fix.`,
    };
  }

  const vpip = stats.vpip;
  const pfr = stats.pfr;
  const gap = vpip - pfr;

  if (vpip > 0.34) {
    leaks.push({
      id: 'too-loose',
      title: 'You are playing too many hands',
      detail: `Your VPIP is ${(vpip * 100).toFixed(0)}%. Winning 6-max regulars sit around 22-27%. Every extra hand you open is played out of position with a weak holding.`,
      fix: 'Run the Preflop Ranges drill and fold your bottom 10% of opens for a session.',
    });
  } else if (vpip < 0.15) {
    leaks.push({
      id: 'too-tight',
      title: 'You are folding away your edge',
      detail: `Your VPIP is ${(vpip * 100).toFixed(0)}%. That is tight enough that observant opponents will simply steal your blinds.`,
      fix: 'Open more suited hands from the cutoff and button. Position is worth more than card strength.',
    });
  } else {
    strengths.push(`Hand selection is in a healthy band (VPIP ${(vpip * 100).toFixed(0)}%).`);
  }

  if (gap > 0.12 && hands >= 30) {
    leaks.push({
      id: 'passive-preflop',
      title: 'You call too much preflop',
      detail: `Your VPIP-PFR gap is ${(gap * 100).toFixed(0)} points. A big gap means you are limping and cold-calling instead of raising.`,
      fix: 'Raise or fold. Calling gives the pot to whoever bets first after the flop.',
    });
  } else if (hands >= 30) {
    strengths.push('You enter pots with a raise rather than a call.');
  }

  const af = stats.aggressionFactor;
  if (af < 1 && hands >= 30) {
    leaks.push({
      id: 'passive-postflop',
      title: 'You are too passive after the flop',
      detail: `Your aggression factor is ${af.toFixed(1)}. Below 1.0 means you are calling far more often than you bet or raise.`,
      fix: 'When you would call, ask whether raising folds out better hands or gets called by worse. If either is true, raise.',
    });
  } else if (af > 4 && hands >= 30) {
    leaks.push({
      id: 'over-aggressive',
      title: 'You are bluffing too much',
      detail: `Your aggression factor is ${af.toFixed(1)}. That is maniac territory; good opponents will simply call you down.`,
      fix: 'Bluff only with hands that can improve, and stop firing at players who never fold.',
    });
  } else if (hands >= 30) {
    strengths.push(`Aggression is well balanced (AF ${af.toFixed(1)}).`);
  }

  if (stats.wtsd > 0.35 && hands >= 40) {
    leaks.push({
      id: 'station',
      title: 'You go to showdown too often',
      detail: `You reach showdown ${(stats.wtsd * 100).toFixed(0)}% of the time you see a flop. Around 25% is normal.`,
      fix: 'Fold your bluff-catchers against players who never bluff. Curiosity is expensive.',
    });
  }

  const badCalls = stats.decisions.filter((d) => d.verdict === 'bad' && d.kind === 'call').length;
  if (badCalls >= 3) {
    leaks.push({
      id: 'ignoring-odds',
      title: 'You are calling without the odds',
      detail: `${badCalls} of your calls this session did not have the equity to break even.`,
      fix: 'Before every call, say the price out loud: "I am calling X to win Y, so I need Z%."',
    });
  }

  return {
    ready: true,
    leaks,
    strengths,
    message: leaks.length
      ? `${leaks.length} leak${leaks.length > 1 ? 's' : ''} to work on.`
      : 'No obvious leaks this session. Move up and find tougher opponents.',
  };
}

/** Online stakes ladder, with the bankroll rule for each rung. */
export const STAKES = [
  { key: 'nl2', name: 'NL2', bb: 0.02, buyIn: 2, minBankroll: 60, difficulty: 1, blurb: 'Micro stakes. Opponents call everything; value bet relentlessly.' },
  { key: 'nl5', name: 'NL5', bb: 0.05, buyIn: 5, minBankroll: 150, difficulty: 2, blurb: 'Still very loose. Bluffs rarely work; keep it simple.' },
  { key: 'nl10', name: 'NL10', bb: 0.10, buyIn: 10, minBankroll: 300, difficulty: 3, blurb: 'The first rung with real regulars. Position starts to matter.' },
  { key: 'nl25', name: 'NL25', bb: 0.25, buyIn: 25, minBankroll: 750, difficulty: 4, blurb: 'Regulars use HUDs. You need a real preflop game.' },
  { key: 'nl50', name: 'NL50', bb: 0.50, buyIn: 50, minBankroll: 1500, difficulty: 5, blurb: 'Table selection becomes the difference between winning and losing.' },
  { key: 'nl100', name: 'NL100', bb: 1.00, buyIn: 100, minBankroll: 3000, difficulty: 6, blurb: 'Most players never beat this. Balance is mandatory.' },
  { key: 'nl200', name: 'NL200', bb: 2.00, buyIn: 200, minBankroll: 6000, difficulty: 7, blurb: 'Serious money and serious opponents.' },
  { key: 'nl500', name: 'NL500', bb: 5.00, buyIn: 500, minBankroll: 15000, difficulty: 8, blurb: 'High stakes. Everyone here studies as hard as you do.' },
];

export function stakeFor(key) {
  return STAKES.find((s) => s.key === key) || STAKES[0];
}

/** Bankroll management verdict: can you sit in this game? */
export function bankrollAdvice(bankroll, stakeKey) {
  const stake = stakeFor(stakeKey);
  const buyIns = bankroll / stake.buyIn;
  if (bankroll < stake.minBankroll) {
    const drop = [...STAKES].reverse().find((s) => bankroll >= s.minBankroll);
    return {
      ok: false,
      buyIns,
      message: t('{n} buy-ins is not enough for {stake}. You want at least {want}.',
        { n: buyIns.toFixed(0), stake: stake.name, want: (stake.minBankroll / stake.buyIn).toFixed(0) }),
      suggestion: drop
        ? t('Move down to {stake} until you rebuild.', { stake: drop.name })
        : t('Rebuild at NL2 — there is no shame in it, and the games are the softest you will ever see.'),
    };
  }
  const next = STAKES[STAKES.indexOf(stake) + 1];
  if (next && bankroll >= next.minBankroll * 1.2) {
    return {
      ok: true,
      buyIns,
      message: t('{n} buy-ins deep.', { n: buyIns.toFixed(0) }),
      suggestion: t('You are rolled for {stake}. Take the shot.', { stake: next.name }),
    };
  }
  return {
    ok: true,
    buyIns,
    message: t('{n} buy-ins for {stake}. Comfortable.', { n: buyIns.toFixed(0), stake: stake.name }),
    suggestion: null,
  };
}
