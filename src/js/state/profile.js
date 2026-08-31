/**
 * Your career. XP, ranks, unlocks and per-skill mastery, persisted locally.
 *
 * Ranks are gated on breadth, not only on volume. XP alone made every level
 * reachable by repeating one drill for long enough, which would have unlocked
 * the whole curriculum — ICM included — for somebody who had only ever
 * practised pot odds. XP still measures how much work you have put in; the
 * mastery requirements alongside it measure how widely.
 */

import { masteryTier } from './mastery.js';
import { MODULE_META } from '../data/curriculum.js';

const STORAGE_KEY = 'poker-trainer.profile.v1';

export const RANKS = [
  {
    level: 1, xp: 0, name: 'Fish', emoji: '🐟',
    blurb: 'Everyone starts here. Learn what beats what.',
    requires: {},
  },
  {
    level: 2, xp: 400, name: 'Minnow', emoji: '🐠',
    blurb: 'You know the hands. Now learn which ones to play.',
    requires: { lessons: 1, solid: 1 },
  },
  {
    level: 3, xp: 1100, name: 'Nit', emoji: '🪨',
    blurb: 'Tight and safe. Solid foundations, but too many folds.',
    requires: { lessons: 2, solid: 2 },
  },
  {
    level: 4, xp: 2300, name: 'Grinder', emoji: '⚙️',
    blurb: 'Putting in volume and making fewer mistakes.',
    requires: { lessons: 3, solid: 3, mastered: 1 },
  },
  {
    level: 5, xp: 4200, name: 'Regular', emoji: '📊',
    blurb: 'You hold your own in any small-stakes game.',
    requires: { lessons: 5, solid: 5, mastered: 2 },
  },
  {
    level: 6, xp: 7000, name: 'Crusher', emoji: '💪',
    blurb: 'Beating the games you play, consistently.',
    requires: { lessons: 6, solid: 6, mastered: 3 },
  },
  {
    level: 7, xp: 11000, name: 'Shark', emoji: '🦈',
    blurb: 'Hunting weak players and finding thin value.',
    requires: { lessons: 8, solid: 8, mastered: 5 },
  },
  {
    level: 8, xp: 17000, name: 'Pro', emoji: '🎩',
    blurb: 'Poker pays your bills. Game selection is second nature.',
    requires: { lessons: 10, solid: 10, mastered: 7 },
  },
  {
    level: 9, xp: 26000, name: 'Elite', emoji: '👑',
    blurb: 'You beat other winning players.',
    requires: { lessons: 12, solid: 12, mastered: 9 },
  },
  {
    level: 10, xp: 40000, name: 'GTO Master', emoji: '🧠',
    blurb: 'Balanced, unexploitable, and ruthless when they are not.',
    requires: { lessons: 12, solid: 12, mastered: 12 },
  },
];

export const MAX_LEVEL = RANKS.length;

export function rankForXp(xp) {
  let current = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.xp) current = rank;
  return current;
}

/**
 * How far along each of a rank's requirements you are.
 *
 * Returned rather than just a yes/no, because "what exactly is missing" is
 * the only useful thing to show somebody who has not got there yet.
 */
export function requirementRows(profile, rank) {
  const tiers = MODULE_META.map((m) => masteryTier(profile, m.id));
  const solid = tiers.filter((t) => t === 'solid' || t === 'mastered').length;
  const mastered = tiers.filter((t) => t === 'mastered').length;
  const lessons = MODULE_META.filter((m) => profile.hasCompletedWalkthrough(m.id)).length;
  const req = rank.requires || {};

  const rows = [{ key: 'xp', label: 'Total XP', have: profile.xp, need: rank.xp }];
  if (req.lessons) rows.push({ key: 'lessons', label: 'Guided lessons finished', have: lessons, need: req.lessons });
  if (req.solid) rows.push({ key: 'solid', label: 'Skills at Solid or better', have: solid, need: req.solid });
  if (req.mastered) rows.push({ key: 'mastered', label: 'Skills Mastered', have: mastered, need: req.mastered });
  return rows.map((r) => ({ ...r, met: r.have >= r.need }));
}

export const meetsRank = (profile, rank) => requirementRows(profile, rank).every((r) => r.met);

/**
 * The rank you currently meet the requirements for — recomputed every time,
 * never stored. An earlier version held a floor so that adding requirements
 * could not demote anyone, but a rank that survives losing the thing it
 * measured is a decoration rather than a rank. It can go down, and the Ranks
 * screen says exactly which requirement slipped.
 */
export function rankForProfile(profile) {
  let earned = RANKS[0];
  for (const rank of RANKS) if (meetsRank(profile, rank)) earned = rank;
  return earned;
}

/** What the old XP-only rule would have said — kept only to explain a drop. */
export const legacyRankForProfile = (profile) => rankForXp(profile.data.xp || 0);

export function nextRankFor(profile) {
  const current = rankForProfile(profile);
  return RANKS.find((r) => r.level > current.level) || null;
}

export function nextRank(xp) {
  return RANKS.find((r) => r.xp > xp) || null;
}

/** 0..1 progress toward the next rank. */
export function rankProgress(xp) {
  const current = rankForXp(xp);
  const next = nextRank(xp);
  if (!next) return 1;
  return (xp - current.xp) / (next.xp - current.xp);
}

const emptyProfile = () => ({
  xp: 0,
  createdAt: Date.now(),
  drills: {},          // module -> { attempts, correct, streak, bestStreak }
  walkthroughs: [],    // module ids whose guided lesson has been completed
  achievements: [],
  rankHistory: {},   // level -> first time it was reached
  bankroll: 200,
  stakeKey: 'nl2',
  handsPlayed: 0,
  lifetimeProfitBb: 0,
  sessions: [],
  settings: { sound: true, coach: true, fourColour: false, autoMuck: true },
});

/** localStorage in the browser, a plain object under test. */
function createStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('__pt_probe', '1');
      localStorage.removeItem('__pt_probe');
      return localStorage;
    }
  } catch {
    /* Private browsing, blocked storage: fall through to memory. */
  }
  const memory = new Map();
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  };
}

export class Profile {
  constructor(data = {}, storage = createStorage()) {
    this.storage = storage;
    this.data = { ...emptyProfile(), ...data };
    this.data.settings = { ...emptyProfile().settings, ...(data.settings || {}) };
    this.listeners = new Set();

  }

  static load(storage = createStorage()) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) return new Profile(JSON.parse(raw), storage);
    } catch {
      /* Corrupt save: start clean rather than crash into a blank screen. */
    }
    return new Profile({}, storage);
  }

  save() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* Storage full or unavailable — the session still works, it just
         will not be there tomorrow. */
    }
    this.emit();
    return this;
  }

  reset() {
    this.data = emptyProfile();
    return this.save();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  get xp() { return this.data.xp; }
  get rank() { return rankForProfile(this); }
  get level() { return this.rank.level; }
  get nextRank() { return nextRankFor(this); }

  /** 0..1 toward the next rank: the least-complete requirement is the honest
   *  figure, since the bar is only finished when every row is. */
  get progress() {
    const next = nextRankFor(this);
    if (!next) return 1;
    const rows = requirementRows(this, next);
    return Math.min(...rows.map((r) => (r.need <= 0 ? 1 : Math.min(1, r.have / r.need))));
  }

  /**
   * Stamps the date a rank is first reached. This is a record of what
   * happened, not a guarantee — losing the skills behind a rank still costs
   * you the rank; the date just says you were there once.
   */
  noteRankReached() {
    if (!this.data.rankHistory) this.data.rankHistory = {};
    const level = this.rank.level;
    if (level > 1 && !this.data.rankHistory[level]) {
      this.data.rankHistory[level] = Date.now();
      return true;
    }
    return false;
  }

  /** When a rank was first reached, or null if it was before this was kept. */
  rankReachedAt(level) {
    const at = (this.data.rankHistory || {})[level];
    return at ? new Date(at) : null;
  }
  get settings() { return this.data.settings; }

  /** @returns {{levelsGained:number, rank:object}} */
  addXp(amount) {
    const before = this.level;
    this.data.xp = Math.max(0, this.data.xp + Math.round(amount));
    this.noteRankReached();
    const after = this.level;
    this.save();
    return { levelsGained: after - before, rank: this.rank, xp: this.data.xp };
  }

  drillStats(module) {
    return this.data.drills[module] || { attempts: 0, correct: 0, streak: 0, bestStreak: 0 };
  }

  recordDrill(module, wasCorrect) {
    const stats = { ...this.drillStats(module) };
    stats.attempts++;
    if (wasCorrect) {
      stats.correct++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
      stats.streak = 0;
    }
    this.data.drills[module] = stats;
    this.noteRankReached();
    this.save();
    return stats;
  }

  /** 0..1 accuracy, or null when there is not enough data to judge. */
  accuracy(module) {
    const s = this.drillStats(module);
    return s.attempts >= 5 ? s.correct / s.attempts : null;
  }

  /** Guided lessons are tracked apart from drills so they cannot skew accuracy. */
  hasCompletedWalkthrough(id) { return (this.data.walkthroughs || []).includes(id); }

  markWalkthroughComplete(id) {
    if (!this.data.walkthroughs) this.data.walkthroughs = [];
    if (this.data.walkthroughs.includes(id)) return false;
    this.data.walkthroughs.push(id);
    this.noteRankReached();
    this.save();
    return true;
  }

  hasAchievement(id) { return this.data.achievements.includes(id); }

  unlockAchievement(id) {
    if (this.hasAchievement(id)) return false;
    this.data.achievements.push(id);
    this.save();
    return true;
  }

  recordSession(session) {
    this.data.sessions.push(session);
    if (this.data.sessions.length > 200) this.data.sessions.shift();
    this.data.handsPlayed += session.hands || 0;
    this.data.lifetimeProfitBb += session.profitBb || 0;
    this.save();
  }

  setBankroll(amount, stakeKey) {
    this.data.bankroll = Math.max(0, Math.round(amount * 100) / 100);
    if (stakeKey) this.data.stakeKey = stakeKey;
    this.save();
  }

  updateSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
    return this.data.settings;
  }
}
