/**
 * The odd jobs on each town's notice board (data/townJobs.js), read against a
 * profile: how far through the job you are, and the count going up as you
 * play.
 *
 * A job counts sound decisions of its kind at its own town's tables — any of
 * the three in the lobby, not a town off the river and not the practice table
 * — the same way Silas's contracts count them anywhere: made well and without
 * asking for help. It pays once, when it is done, more for the towns further
 * down the river. State lives in profile.data.jobs: stop key -> { have, paid }.
 *
 * Free of the DOM so it can be tested.
 */

import { JOBS, jobAt } from '../data/townJobs.js';
import { venueFor } from '../data/venues.js';
import { handPearls } from './economy.js';

/** What a job pays: a little for each decision it asks for, more downriver. */
export const jobPearls = (job) => (10 + job.need * 3) * handPearls(venueFor(job.stop).index);

/** Where you are with a stop's job, repaired as it is read. */
export function jobRecord(profile, stopKey) {
  const job = jobAt(stopKey);
  if (!job) return null;
  const all = profile.data.jobs && typeof profile.data.jobs === 'object' ? profile.data.jobs : {};
  const r = all[stopKey] && typeof all[stopKey] === 'object' ? all[stopKey] : {};
  const have = Number.isFinite(r.have) ? Math.max(0, Math.min(job.need, Math.floor(r.have))) : 0;
  return { job, have, need: job.need, done: have >= job.need, paid: r.paid === true, pearls: jobPearls(job) };
}

/**
 * A decision was made at a stop's table. Counts toward that stop's job if it
 * is the job's kind and was made well, and pays the job when it is done.
 *
 * @param {{stop:string, skill:string, level:string, helped:boolean}} d
 * @returns {null | {job:object, pearls:number}}  the job, if this finished it
 */
export function noteJobDecision(profile, { stop, skill, level, helped }) {
  const r = jobRecord(profile, stop);
  if (!r || r.done || r.job.skill !== skill || level === 'bad' || helped) return null;
  if (!profile.data.jobs || typeof profile.data.jobs !== 'object') profile.data.jobs = {};
  const have = r.have + 1;
  const done = have >= r.need;
  profile.data.jobs[stop] = { have, paid: done };
  const pearls = done ? profile.earnPearls(r.pearls) : 0;
  profile.save();
  return done ? { job: r.job, pearls } : null;
}

/** Every stop has one. */
export const JOB_STOPS = JOBS.map((j) => j.stop);
