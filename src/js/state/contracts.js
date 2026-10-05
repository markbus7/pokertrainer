/**
 * Silas's contracts.
 *
 * The tables pay for playing; they do not say what to play *better*. Silas
 * does: after a sitting he writes down where you gave chips away, and the
 * drills know which chapters have gone cold. A contract is that note turned
 * into a job — "make eight sound pot-odds decisions at a real table" — with a
 * purse for doing it. Three are posted at a time, they are drawn from your own
 * weakest skills first, and finishing one posts the next.
 *
 * It is the bridge between the two halves of the game. A drill tells you a
 * skill is weak; a contract sends you to a table to use it.
 *
 * Kinds:
 *   sound — make N sound decisions of one skill at a real table
 *   clean — play N hands in a row without a mistake or asking for help
 *   fish  — land a species you have not caught, from the Catch Book
 *
 * Free of the DOM, so it can be tested. State lives in profile.data.contracts:
 * { active: Contract[], issued, done }.
 */

import { ownsLesson } from './economy.js';
import { reportsOf, strongestAndWeakest } from './sessionReport.js';
import { SPECIES, WATERS } from '../data/fish.js';
import { moduleMeta } from '../data/curriculum.js';

export const SLOTS = 3;

/** The skills a decision at a table can be named for, in teaching order. */
export const TABLE_SKILLS = ['pot-odds', 'preflop', 'position', 'outs', 'cbet', 'mdf', 'bluffing', 'spr', 'exploit'];

/** What a contract pays. Decisions already pay a pearl each; this is the bonus for doing them on purpose. */
export const rewardFor = (kind, need) => {
  if (kind === 'sound') return 12 + need * 4;
  if (kind === 'clean') return 20 + need * 8;
  return 40;
};

const hash = (n) => {
  let h = (n + 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Skills you can be set, weakest first. Weakness is how the recent drill
 * answers went, pulled down further for the skill Silas named as the weakest
 * in your last sitting. A skill with too few answers to judge counts as
 * middling, so the chapters you have never drilled are not all that is ever
 * posted.
 */
export function weakestSkills(profile) {
  const last = reportsOf(profile).slice(-1)[0];
  const named = last ? (strongestAndWeakest(last).weakest || {}).skill : null;
  return TABLE_SKILLS
    .filter((id) => ownsLesson(profile, id))
    .map((id) => {
      const stats = profile.drillStats(id);
      const recent = stats.recent || '';
      const score = recent.length >= 3 ? [...recent].filter((c) => c === '1').length / recent.length : 0.5;
      return { id, score: score - (id === named ? 0.3 : 0) };
    })
    .sort((a, b) => a.score - b.score)
    .map((s) => s.id);
}

/** The reader's save: always an object with a list in it. */
export function contractsOf(profile) {
  const d = profile.data;
  if (!d.contracts || typeof d.contracts !== 'object') d.contracts = {};
  const c = d.contracts;
  if (!Array.isArray(c.active)) c.active = [];
  c.active = c.active.filter((x) => x && typeof x.kind === 'string' && Number.isFinite(x.need) && x.need > 0)
    .map((x) => ({ ...x, have: Math.max(0, Math.min(x.need, Number(x.have) || 0)) }));
  if (!Number.isFinite(c.issued) || c.issued < 0) c.issued = 0;
  if (!Number.isFinite(c.done) || c.done < 0) c.done = 0;
  return c;
}

/** A fish worth setting: one you have not caught, in water your boat has reached. */
function uncaught(profile, reach) {
  const book = profile.catchBook || {};
  return SPECIES.filter((s) => {
    const water = WATERS.find((w) => w.key === s.water);
    // A fish whose spot is taught in a chapter you do not own is not a job you can be set.
    const known = !s.module || ownsLesson(profile, s.module);
    return !book[s.key] && s.water !== 'legend' && water && water.from <= reach && known;
  });
}

/**
 * Post the next contract for a slot, from the weakest skills first. Never a
 * duplicate of one already posted.
 */
export function nextContract(profile, { reach = 0, active = [], n = 0 } = {}) {
  const taken = (kind, skill) => active.some((c) => c.kind === kind && (c.skill || null) === (skill || null));
  const skills = weakestSkills(profile).filter((id) => !taken('sound', id));
  const roll = hash(n);
  const wantsFish = roll % 3 === 0;
  const fish = uncaught(profile, reach).filter((s) => !active.some((c) => c.kind === 'fish' && c.key === s.key));

  if (!active.some((c) => c.kind === 'sound') || (!wantsFish && skills.length)) {
    if (skills.length) {
      const skill = skills[0];
      const need = 6 + (roll % 3) * 2;
      return { id: `c${n}`, kind: 'sound', skill, need, have: 0, reward: rewardFor('sound', need) };
    }
  }
  if (wantsFish && fish.length) {
    const s = fish[roll % fish.length];
    return { id: `c${n}`, kind: 'fish', key: s.key, need: 1, have: 0, reward: rewardFor('fish', 1) };
  }
  if (!taken('clean', null)) {
    const need = 3 + (roll % 3);
    return { id: `c${n}`, kind: 'clean', need, have: 0, reward: rewardFor('clean', need) };
  }
  if (skills.length) {
    const need = 8;
    return { id: `c${n}`, kind: 'sound', skill: skills[0], need, have: 0, reward: rewardFor('sound', need) };
  }
  return null;
}

/** Fill the board up to its slots. Returns the contracts. */
export function ensureContracts(profile, { reach = 0 } = {}) {
  const c = contractsOf(profile);
  let guard = 0;
  while (c.active.length < SLOTS && guard++ < SLOTS * 3) {
    const next = nextContract(profile, { reach, active: c.active, n: c.issued });
    c.issued += 1;
    if (next) c.active.push(next);
  }
  profile.save();
  return c.active;
}

/**
 * A thing happened at a table. Move whichever contracts it counts toward,
 * and return the ones it finished (already taken off the board, the purse
 * not yet paid — that is the caller's, because paying is also a toast).
 *
 * @param {object} profile
 * @param {{type:'decision', skill:string, level:string, helped:boolean}
 *        |{type:'hand', clean:boolean}
 *        |{type:'catch', key:string}} event
 */
export function noteEvent(profile, event) {
  const c = contractsOf(profile);
  const finished = [];
  for (const k of c.active) {
    if (event.type === 'decision' && k.kind === 'sound' && k.skill === event.skill && event.level !== 'bad' && !event.helped) k.have += 1;
    else if (event.type === 'hand' && k.kind === 'clean') k.have = event.clean ? k.have + 1 : 0;
    else if (event.type === 'catch' && k.kind === 'fish' && k.key === event.key) k.have += 1;
    if (k.have >= k.need) finished.push(k);
  }
  if (finished.length) {
    c.active = c.active.filter((k) => !finished.includes(k));
    c.done += finished.length;
  }
  profile.save();
  return finished;
}

/**
 * How a contract reads: a sentence key and its parameters, the names in them
 * left for t() to translate, the way the road's goals are.
 */
export function contractText(k) {
  if (k.kind === 'sound') {
    const meta = moduleMeta(k.skill);
    return { text: 'Make {n} sound {skill} decisions at a real table', params: { n: k.need, skill: meta ? meta.name : k.skill } };
  }
  if (k.kind === 'clean') return { text: 'Play {n} hands in a row at a real table without a mistake', params: { n: k.need } };
  return { text: 'Land a {fish}', params: { fish: (SPECIES.find((s) => s.key === k.key) || {}).name || k.key } };
}
