/**
 * Your career. XP, ranks, unlocks and per-skill mastery, persisted locally.
 *
 * Progression is deliberately skill-gated: ICM does not unlock until you can
 * count outs, because a student who guesses at equity cannot use ICM anyway.
 */

const STORAGE_KEY = 'poker-trainer.profile.v1';

export const RANKS = [
  { level: 1, xp: 0, name: 'Fish', emoji: '🐟', blurb: 'Everyone starts here. Learn what beats what.' },
  { level: 2, xp: 400, name: 'Minnow', emoji: '🐠', blurb: 'You know the hands. Now learn which ones to play.' },
  { level: 3, xp: 1100, name: 'Nit', emoji: '🪨', blurb: 'Tight and safe. Solid foundations, but too many folds.' },
  { level: 4, xp: 2300, name: 'Grinder', emoji: '⚙️', blurb: 'Putting in volume and making fewer mistakes.' },
  { level: 5, xp: 4200, name: 'Regular', emoji: '📊', blurb: 'You hold your own in any small-stakes game.' },
  { level: 6, xp: 7000, name: 'Crusher', emoji: '💪', blurb: 'Beating the games you play, consistently.' },
  { level: 7, xp: 11000, name: 'Shark', emoji: '🦈', blurb: 'Hunting weak players and finding thin value.' },
  { level: 8, xp: 17000, name: 'Pro', emoji: '🎩', blurb: 'Poker pays your bills. Game selection is second nature.' },
  { level: 9, xp: 26000, name: 'Elite', emoji: '👑', blurb: 'You beat other winning players.' },
  { level: 10, xp: 40000, name: 'GTO Master', emoji: '🧠', blurb: 'Balanced, unexploitable, and ruthless when they are not.' },
];

export const MAX_LEVEL = RANKS.length;

export function rankForXp(xp) {
  let current = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.xp) current = rank;
  return current;
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
  achievements: [],
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
  get rank() { return rankForXp(this.data.xp); }
  get level() { return this.rank.level; }
  get progress() { return rankProgress(this.data.xp); }
  get settings() { return this.data.settings; }

  /** @returns {{levelsGained:number, rank:object}} */
  addXp(amount) {
    const before = this.level;
    this.data.xp = Math.max(0, this.data.xp + Math.round(amount));
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
    this.save();
    return stats;
  }

  /** 0..1 accuracy, or null when there is not enough data to judge. */
  accuracy(module) {
    const s = this.drillStats(module);
    return s.attempts >= 5 ? s.correct / s.attempts : null;
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
