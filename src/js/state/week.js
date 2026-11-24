/**
 * Your week, as Silas sees it.
 *
 * A sitting's notes say how one table went, and the character page says how
 * your whole career has gone. Neither answers the question a player asks on
 * a Sunday: did I get better this week? This reads the sittings of the last
 * seven days against the seven before them (profile.data.reports, the last
 * KEEP_REPORTS sittings), and picks one thing to work on next.
 */

const DAY = 24 * 60 * 60 * 1000;
export const WEEK = 7 * DAY;

/** Decisions a week needs before its share is compared with another's. */
export const WEEK_SAMPLE = 10;
/** Decisions of one skill, in each week, before it is called better or weak. */
export const SKILL_WEEK = 4;

/** The sittings, decisions and skills of the reports in [from, to). */
function tally(reports, from, to) {
  const out = { sittings: 0, hands: 0, decisions: 0, sound: 0, profitBb: 0, skills: {}, mistakes: {} };
  for (const r of reports) {
    if (!r || !Number.isFinite(r.at) || r.at < from || r.at >= to) continue;
    out.sittings += 1;
    out.hands += Number.isFinite(r.hands) ? r.hands : 0;
    out.profitBb += Number.isFinite(r.profitBb) ? r.profitBb : 0;
    const d = r.decisions || {};
    out.decisions += Number.isFinite(d.total) ? d.total : 0;
    out.sound += Number.isFinite(d.sound) ? d.sound : 0;
    for (const [skill, s] of Object.entries(d.bySkill || {})) {
      if (!s || !Number.isFinite(s.total) || !Number.isFinite(s.right)) continue;
      const row = out.skills[skill] || (out.skills[skill] = { right: 0, total: 0 });
      row.right += s.right;
      row.total += s.total;
    }
    for (const w of Array.isArray(r.worst) ? r.worst : []) {
      if (!w || typeof w.head !== 'string') continue;
      out.mistakes[w.head] = (out.mistakes[w.head] || 0) + 1;
    }
  }
  out.share = out.decisions ? out.sound / out.decisions : 0;
  out.profitBb = Math.round(out.profitBb * 10) / 10;
  return out;
}

const shareOf = (row) => row.right / row.total;

/**
 * This week against the one before.
 * @returns {{ready:boolean, sittings:number, hands:number, decisions:number, sound:number, share:number,
 *   profitBb:number, change:number|null, better:{skill,from,to}|null, weakest:{skill,share,right,total}|null,
 *   repeated:{head:string, times:number}|null}}
 */
export function weekReview(reports, now = Date.now()) {
  const list = Array.isArray(reports) ? reports : [];
  const week = tally(list, now - WEEK, now + 1);
  const before = tally(list, now - 2 * WEEK, now - WEEK);

  const change = week.decisions >= WEEK_SAMPLE && before.decisions >= WEEK_SAMPLE ? week.share - before.share : null;

  // The skill that came on most, by at least ten points, judged on enough of both weeks.
  let better = null;
  for (const [skill, row] of Object.entries(week.skills)) {
    const was = before.skills[skill];
    if (!was || row.total < SKILL_WEEK || was.total < SKILL_WEEK) continue;
    const rise = shareOf(row) - shareOf(was);
    if (rise >= 0.1 && (!better || rise > better.to - better.from)) better = { skill, from: shareOf(was), to: shareOf(row) };
  }

  // The weakest skill of the week, which is the job for the next one.
  let weakest = null;
  for (const [skill, row] of Object.entries(week.skills)) {
    if (row.total < SKILL_WEEK || shareOf(row) >= 1) continue;
    const share = shareOf(row);
    if (!weakest || share < weakest.share || (share === weakest.share && row.total > weakest.total)) {
      weakest = { skill, share, right: row.right, total: row.total };
    }
  }
  if (better && weakest && better.skill === weakest.skill) weakest = null;

  // A mistake among the costliest of two sittings or more is a habit, not a hand.
  const [head, times] = Object.entries(week.mistakes).sort((a, b) => b[1] - a[1])[0] || [];
  const repeated = times >= 2 ? { head, times } : null;

  return {
    ready: week.sittings > 0,
    sittings: week.sittings,
    hands: week.hands,
    decisions: week.decisions,
    sound: week.sound,
    share: week.share,
    profitBb: week.profitBb,
    change,
    better,
    weakest,
    repeated,
  };
}

/* ------------------------------------------------------------------ *
 * The job for next week, kept
 *
 * Naming the weakest skill as the job for next week is only advice until
 * somebody looks again. So the job is written down when it is set (the skill
 * and the share it stood at), and the week after is read against it: put
 * right once that skill comes in at fifteen points better than it was, or
 * at four in five, from enough decisions to say so. A job done pays a few
 * pearls, once; a week gone by without it is said plainly, and a new job is
 * set from the new week.
 * ------------------------------------------------------------------ */

/** How much better a skill has to be to call the job done, and the share that is done whatever it was. */
export const GOAL_RISE = 0.15;
export const GOAL_ENOUGH = 0.8;
/** What a job done pays, once. */
export const GOAL_PEARLS = 25;

/** The job as kept on the profile, read back as numbers whatever was stored, or null. */
export function goalOf(profile) {
  const g = profile.data.weekGoal;
  if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
  if (typeof g.skill !== 'string' || !g.skill || g.skill.length > 40) return null;
  if (!Number.isFinite(g.set) || !Number.isFinite(g.from)) return null;
  return {
    skill: g.skill,
    from: Math.min(1, Math.max(0, g.from)),
    set: g.set,
    done: Number.isFinite(g.done) && g.done > 0 ? g.done : 0,
    met: Boolean(g.met),
  };
}

/** The share a job has to reach. */
export const goalTarget = (goal) => Math.min(GOAL_ENOUGH, goal.from + GOAL_RISE);

/**
 * How a job stands: the skill's decisions since it was set (to a week after),
 * and whether it is done, still open, or the week ran out.
 * @returns {{state:'met'|'open'|'missed', right:number, total:number, share:number|null, target:number}}
 */
export function goalProgress(reports, goal, now = Date.now()) {
  const until = goal.set + WEEK;
  const row = tally(Array.isArray(reports) ? reports : [], goal.set, Math.min(now, until) + 1).skills[goal.skill] || { right: 0, total: 0 };
  const share = row.total ? row.right / row.total : null;
  const target = goalTarget(goal);
  const state = row.total >= SKILL_WEEK && share >= target ? 'met' : now >= until ? 'missed' : 'open';
  return { state, right: row.right, total: row.total, share, target };
}

/**
 * Read the kept job against the sittings, settle it when it is done or its
 * week has run out, and set the next one from this week's weakest skill.
 * Pays the pearls for a job done, once.
 * @returns {{goal:object|null, progress:object|null, settled:'met'|'missed'|null, pearls:number, fresh:boolean}}
 */
export function keepGoal(profile, reports, now = Date.now()) {
  let goal = goalOf(profile);
  let progress = null;
  let settled = null;
  let pearls = 0;
  if (goal && !goal.done) {
    progress = goalProgress(reports, goal, now);
    if (progress.state !== 'open') {
      settled = progress.state;
      goal = { ...goal, done: now, met: settled === 'met' };
      profile.data.weekGoal = goal;
      profile.save();
      if (settled === 'met') pearls = profile.earnPearls(GOAL_PEARLS);
    }
  }
  // A new job once the last one is settled: this week's weakest skill.
  let fresh = false;
  if (!goal || goal.done) {
    const w = weekReview(reports, now);
    if (w.weakest) {
      const next = { skill: w.weakest.skill, from: w.weakest.share, set: now, done: 0, met: false };
      // The one just settled stays readable for this answer.
      profile.data.weekGoal = next;
      profile.save();
      fresh = true;
      return { goal: next, progress: settled ? progress : null, settled, pearls, fresh, last: settled ? goal : null };
    }
  }
  return { goal, progress, settled, pearls, fresh, last: settled ? goal : null };
}
