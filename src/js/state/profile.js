/**
 * Your career. XP, ranks, unlocks and per-skill mastery, persisted locally.
 *
 * Ranks are gated on breadth, not only on volume. XP alone made every level
 * reachable by repeating one drill for long enough, which would have unlocked
 * the whole curriculum — ICM included — for somebody who had only ever
 * practised pot odds. XP still measures how much work you have put in; the
 * mastery requirements alongside it measure how widely.
 *
 * Hands played sits alongside them because every other requirement could be
 * met without ever playing a hand. Skills are proved at the table now — a
 * decision there counts toward mastery the same as a drill answer — so the
 * ladder asks for both: that you can do it, and that you have done it where
 * nobody tells you which skill the spot is testing.
 */

import {
  masteryTier, bestTier, tierRank, EVIDENCE_BAR, MASTERY_WINDOW, legacyTier, seedWindow,
} from './mastery.js';
import { MODULE_META } from '../data/curriculum.js';
import { DEFAULT_THEME } from '../data/themes.js';
import { STAKES } from './stats.js';

const STORAGE_KEY = 'poker-trainer.profile.v1';

/** How many recent unaided attempts at one hand, in one checkpoint, to remember. */
const RANGE_HAND_WINDOW = 5;

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
    requires: { lessons: 2, solid: 2, hands: 50 },
  },
  {
    level: 4, xp: 2300, name: 'Grinder', emoji: '⚙️',
    blurb: 'Putting in volume and making fewer mistakes.',
    requires: { lessons: 3, solid: 3, mastered: 1, hands: 150 },
  },
  {
    level: 5, xp: 4200, name: 'Regular', emoji: '📊',
    blurb: 'You hold your own in any small-stakes game.',
    requires: { lessons: 5, solid: 5, mastered: 2, hands: 400 },
  },
  {
    level: 6, xp: 7000, name: 'Crusher', emoji: '💪',
    blurb: 'Beating the games you play, consistently.',
    requires: { lessons: 6, solid: 6, mastered: 3, hands: 800 },
  },
  {
    level: 7, xp: 11000, name: 'Shark', emoji: '🦈',
    blurb: 'Hunting weak players and finding thin value.',
    requires: { lessons: 8, solid: 8, mastered: 5, hands: 1500 },
  },
  {
    level: 8, xp: 17000, name: 'Pro', emoji: '🎩',
    blurb: 'Poker pays your bills. Game selection is second nature.',
    requires: { lessons: 10, solid: 10, mastered: 7, hands: 2500 },
  },
  {
    level: 9, xp: 26000, name: 'Elite', emoji: '👑',
    blurb: 'You beat other winning players.',
    requires: { lessons: 12, solid: 12, mastered: 9, hands: 4000 },
  },
  {
    level: 10, xp: 40000, name: 'GTO Master', emoji: '🧠',
    blurb: 'Balanced, unexploitable, and ruthless when they are not.',
    requires: { lessons: 12, solid: 12, mastered: 12, hands: 6000 },
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
  const tiers = MODULE_META.map((m) => bestTier(profile, m.id));
  const solid = tiers.filter((t) => t === 'solid' || t === 'mastered').length;
  const mastered = tiers.filter((t) => t === 'mastered').length;
  const lessons = MODULE_META.filter((m) => profile.hasCompletedWalkthrough(m.id)).length;
  const req = rank.requires || {};

  const rows = [{ key: 'xp', label: 'Total XP', have: profile.xp, need: rank.xp }];
  if (req.lessons) rows.push({ key: 'lessons', label: 'Guided lessons finished', have: lessons, need: req.lessons });
  if (req.solid) rows.push({ key: 'solid', label: 'Skills at Solid or better', have: solid, need: req.solid });
  if (req.mastered) rows.push({ key: 'mastered', label: 'Skills Mastered', have: mastered, need: req.mastered });
  // Hands played, because the other three can all be earned without ever
  // sitting down. A ladder that a reader can climb by answering questions is
  // a ladder for readers.
  if (req.hands) rows.push({ key: 'hands', label: 'Hands played', have: profile.data.handsPlayed || 0, need: req.hands });
  return rows.map((r) => ({ ...r, met: r.have >= r.need }));
}

export const meetsRank = (profile, rank) => requirementRows(profile, rank).every((r) => r.met);

/**
 * Modules whose current form sits below the tier the rank is counting.
 *
 * Ranks count the best reading so a bad week cannot take one back, which
 * leaves a row able to read "2 of 2 Solid" while neither is solid today. That
 * is a claim about now made out of the past, so the screen says how many.
 */
export function slippedModules(profile) {
  return MODULE_META.filter((m) => tierRank(masteryTier(profile, m.id)) < tierRank(bestTier(profile, m.id)));
}

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
  practice: {},      // 'module:kind' -> { attempts, correct, tags }
  bankroll: 200,
  // Where you are in the building, and what it has cost you to get there.
  // The climb is money: `venue` is the room you last sat in, `best` the
  // furthest door that has opened, and `beaten` the rooms whose regular you
  // have taken a stack off.
  career: { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [] },
  // The range ladder: per checkpoint, which rung of support you are on
  // and whether you have cleared the unaided one.
  ranges: {},
  stakeKey: 'nl2',
  handsPlayed: 0,
  lifetimeProfitBb: 0,
  sessions: [],
  // lang and theme both live in settings so they travel with the cloud
  // sync: pick Dutch and Daylight on the iPad and the iPhone matches,
  // without setting either twice.
  settings: {
    sound: true, music: true, coach: true, fourColour: false, autoMuck: true,
    lang: 'en', theme: DEFAULT_THEME,
  },
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
    this.carryForwardTiers();
    this.migrateThreeBetCall();
  }

  /**
   * A save written before tiers were judged on recent form has totals but no
   * log of how the answers went, so its window reads as empty. Read the old
   * rule once and bank what it had already awarded: nobody is demoted for
   * upgrading, and the window takes over as soon as it is full.
   */
  carryForwardTiers() {
    for (const [id, stats] of Object.entries(this.data.drills || {})) {
      if (stats.recent != null) continue;
      stats.earned = legacyTier(stats, (this.data.walkthroughs || []).includes(id));
      stats.best = stats.earned;
      stats.recent = seedWindow(stats.attempts || 0, stats.correct || 0);
    }
  }

  /**
   * "Facing a raise" used to be a binary three-bet-or-fold decision; it is
   * now three-bet/call/fold, a different question with a different answer
   * for every hand in the middle. Progress and weak-hand history recorded
   * against the old binary version do not mean anything against the new
   * one, so it resets exactly once — this flag is what keeps it from
   * resetting again on every later load, including for a checkpoint a
   * player only starts after this shipped, which never needed resetting
   * at all.
   */
  migrateThreeBetCall() {
    if (this.data.threebetCallMigrated) return;
    if (this.data.ranges.threebet) {
      delete this.data.ranges.threebet;
      this.save();
    }
    this.data.threebetCallMigrated = true;
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
    // The window the tiers are judged on. Stored as a string of 1s and 0s
    // because it is written on every answer and lives in localStorage: 30
    // characters, newest last.
    stats.recent = ((stats.recent || '') + (wasCorrect ? '1' : '0')).slice(-MASTERY_WINDOW);
    this.data.drills[module] = stats;
    // The high-water reading, kept beside the live one because it cannot be
    // recovered from a window that has already forgotten.
    stats.best = bestTier(this, module);
    this.noteRankReached();
    this.save();
    return stats;
  }

  /**
   * One hands-on exercise or lesson check, with why it went wrong.
   *
   * Kept apart from drill stats on purpose: these are a different kind of
   * evidence. A drill records that an answer was wrong; an exercise can
   * record *what the misreading was*, which is the thing that says whether
   * the lesson or the reader is at fault.
   */
  recordPractice(module, kind, correct, tags = null) {
    if (!this.data.practice) this.data.practice = {};
    const key = `${module}:${kind}`;
    const entry = this.data.practice[key] || { attempts: 0, correct: 0, tags: {} };
    entry.attempts++;
    if (correct) entry.correct++;
    if (tags) {
      for (const [tag, n] of Object.entries(tags)) {
        if (tag === 'unclassified') continue;
        entry.tags[tag] = (entry.tags[tag] || 0) + n;
      }
    }
    this.data.practice[key] = entry;
    this.save();
    return entry;
  }

  /** Every recorded exercise, newest key order irrelevant — the report sorts. */
  practiceStats() {
    return Object.entries(this.data.practice || {}).map(([key, value]) => {
      const [module, kind] = key.split(':');
      return { module, kind, ...value };
    });
  }

  /** 0..1 accuracy, or null when there is not enough data to judge. */
  accuracy(module) {
    const s = this.drillStats(module);
    // null means "not enough answers to say", and every screen that shows a
    // score honours it. The bar lives in mastery.js so there is one of it.
    return s.attempts >= EVIDENCE_BAR ? s.correct / s.attempts : null;
  }

  /* ---- the career ------------------------------------------------- */

  get career() {
    if (!this.data.career) this.data.career = { venue: 'nl2', best: 'nl2', busted: 0, staked: 0, beaten: [] };
    if (!this.data.career.beaten) this.data.career.beaten = [];
    return this.data.career;
  }

  /**
   * Tie up at a stop. Records the furthest one reached, which only ever
   * moves downriver: heading back up to a cheaper table does not undo the
   * climb. Worked out here from the stakes' own order rather than trusted to
   * the caller, since the screen that once did it passed the stop you were
   * leaving instead of the furthest one, and a trip upriver quietly lowered
   * the mark (and would have taken the boat with it).
   */
  enterVenue(key) {
    const c = this.career;
    const order = (k) => STAKES.findIndex((s) => s.key === k);
    c.venue = key;
    if (order(key) > order(c.best)) c.best = key;
    this.save();
    return c;
  }

  /**
   * Broke. The house puts you back in for a token amount.
   *
   * Not charity and not hidden: it is counted, and the career screen says how
   * many times it has happened. A bankroll that quietly refills teaches that
   * going broke costs nothing, which is the opposite of the lesson.
   */
  stakedByTheHouse(amount) {
    const c = this.career;
    c.busted++;
    c.staked += amount;
    this.data.bankroll = amount;
    c.venue = 'nl2';
    this.save();
    return c;
  }

  /** You took the room regular's stack. */
  noteResidentBeaten(key) {
    const c = this.career;
    if (c.beaten.includes(key)) return false;
    c.beaten.push(key);
    this.save();
    return true;
  }

  /* ---- the range ladder --------------------------------------------- */

  get ranges() {
    if (!this.data.ranges) this.data.ranges = {};
    return this.data.ranges;
  }

  rangeProgress(key) {
    return this.ranges[key] || { stage: 0, cleared: false, runs: 0, peeks: 0 };
  }

  /**
   * How much of a boundary has actually been asked, unaided, for one
   * checkpoint — regardless of whether it was answered right or wrong.
   * recordRangeHand already writes a key for every unaided attempt, so this
   * reads what is already there rather than tracking anything new.
   */
  rangeCoverage(key, pool) {
    if (!pool.length) return { seen: 0, unseen: 0, total: 0, complete: true };
    const hands = (this.ranges[key] || {}).hands || {};
    const seen = pool.filter((h) => h in hands).length;
    return { seen, unseen: pool.length - seen, total: pool.length, complete: seen === pool.length };
  }

  /**
   * Record one run at a checkpoint.
   *
   * A run is only credited with answers given unaided: peeking at the chart on
   * the rung where peeking is allowed is the point of that rung, but it cannot
   * count toward passing it, or the support never comes off.
   *
   * Clearing needs the boundary covered as well as the count passed — fifteen
   * hands is a sample, and a good sample of the wrong fifteen would say
   * "cleared" about a boundary that is only half known. `covered` is the
   * caller's to compute, because it depends on the chart, which this class
   * does not know about.
   *
   * Progress never goes backwards on a bad run. Losing a rung you have already
   * cleared would make the ladder punish the practice it is asking for, and a
   * reader who has shown they know under-the-gun does not un-know it.
   */
  noteRangeRun(key, { right = 0, asked = 0, peeks = 0, stage = 0, pass = 12, covered = true } = {}) {
    const before = this.rangeProgress(key);
    const passed = right >= pass;
    const next = {
      stage: passed ? Math.max(before.stage, stage + 1) : before.stage,
      cleared: before.cleared || (passed && stage >= 2 && covered),
      runs: (before.runs || 0) + 1,
      peeks: (before.peeks || 0) + peeks,
      best: Math.max(before.best || 0, right),
      lastAsked: asked,
      // recordRangeHand has already written this run's misses in here by the
      // time a run finishes — dropping it on every rung completed was
      // exactly that: the weak-hand list going empty the moment you reached
      // the summary screen that was supposed to be built from it.
      hands: before.hands,
    };
    this.ranges[key] = next;
    this.save();
    return { passed, advanced: next.stage > before.stage, cleared: next.cleared && !before.cleared };
  }

  /**
   * "Cleared" used to mean nothing more than one good run of the blind
   * rung; it now means the whole boundary has been seen. A badge earned
   * under the old bar does not mean anything under the new one, so every
   * checkpoint is checked against it exactly once. Stage and hand history
   * are untouched — only a cleared flag that was not actually earned yet
   * comes back off, the same way a bad run never took one away either.
   */
  migrateEdgeCoverage(poolsByCheckpoint) {
    if (this.data.edgeCoverageMigrated) return;
    for (const [key, pool] of Object.entries(poolsByCheckpoint)) {
      const entry = this.ranges[key];
      if (entry && entry.cleared && !this.rangeCoverage(key, pool).complete) {
        this.ranges[key] = { ...entry, cleared: false };
      }
    }
    this.data.edgeCoverageMigrated = true;
    this.save();
  }

  /** How much of the ladder is behind you, for the one line that says so. */
  rangesCleared(keys) {
    return keys.filter((k) => this.rangeProgress(k).cleared).length;
  }

  /**
   * Record how one specific hand went, unaided, at one checkpoint.
   *
   * Only unaided attempts are worth recording here — a peeked answer or one
   * read straight off an open chart proves nothing about whether the hand is
   * actually known, the same standard "credited" already holds the ladder
   * itself to. A short window rather than a lifetime tally, so a hand missed
   * three times last month and nailed five times since stops being flagged:
   * the same "a window forgets" reasoning mastery.js already uses for a whole
   * module, here at the scale of one hand in one chart.
   */
  recordRangeHand(checkpointKey, hand, correct) {
    const entry = this.ranges[checkpointKey] || { stage: 0, cleared: false, runs: 0, peeks: 0 };
    const hands = { ...(entry.hands || {}) };
    hands[hand] = ((hands[hand] || '') + (correct ? '1' : '0')).slice(-RANGE_HAND_WINDOW);
    this.ranges[checkpointKey] = { ...entry, hands };
    this.save();
  }

  /**
   * The hands worth drilling again, worst first, across whichever
   * checkpoints are asked for.
   *
   * Only hands with at least one real miss in the window qualify — a hand
   * nobody has gotten wrong is not a weak spot, it is simply untested, and
   * surfacing it here would turn "practise what you are bad at" into
   * "practise at random again", which is already what the ladder itself
   * does. Ties go to whichever has fewer attempts recorded, so a hand seen
   * once and missed once outranks one seen five times and missed once at the
   * same share — the fresher miss is the one still worth confirming.
   *
   * `needed` is how many more unaided rights, in a row, clear the hand from
   * this list — not always the window size: a hand already a few rights
   * into recovering from its last miss needs fewer, and the count is exact
   * because it is read off the same window recordRangeHand writes, not
   * re-derived from the rounded wrongShare above it. `recent` is that same
   * window, oldest first, as booleans rather than the '0'/'1' string it is
   * stored as — the shape of the miss, not just its share.
   */
  weakRangeHands(checkpointKeys, limit = 15) {
    const rows = [];
    for (const key of checkpointKeys) {
      const hands = (this.ranges[key] || {}).hands || {};
      for (const [hand, recent] of Object.entries(hands)) {
        const wrong = [...recent].filter((c) => c === '0').length;
        if (!wrong) continue;
        const streak = recent.length - 1 - recent.lastIndexOf('0');
        rows.push({
          checkpointKey: key,
          hand,
          wrongShare: wrong / recent.length,
          attempts: recent.length,
          needed: RANGE_HAND_WINDOW - streak,
          recent: [...recent].map((c) => c === '1'),
        });
      }
    }
    rows.sort((a, b) => b.wrongShare - a.wrongShare || a.attempts - b.attempts);
    return rows.slice(0, limit);
  }

  /** Guided lessons are tracked apart from drills so they cannot skew accuracy. */
  hasCompletedWalkthrough(id) { return (this.data.walkthroughs || []).includes(id); }

  markWalkthroughComplete(id) {
    if (!this.data.walkthroughs) this.data.walkthroughs = [];
    if (this.data.walkthroughs.includes(id)) return false;
    this.data.walkthroughs.push(id);
    // The lesson is the last thing Mastered waits on, so finishing it can
    // raise the high-water tier with no drill answer involved.
    const stats = this.data.drills[id];
    if (stats) stats.best = bestTier(this, id);
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
