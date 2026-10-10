/**
 * Odd jobs: somebody in every town with a job for a card player.
 *
 * What these pin: every stop has one job, for a skill a table decision can be
 * filed under; it counts only sound, unhelped decisions of its own kind, at
 * its own town; it pays once when done, more downriver; a broken record reads
 * as an empty one; and the road's goals send you to the right door.
 */

import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import { JOBS, jobAt } from '../src/js/data/townJobs.js';
import { jobRecord, noteJobDecision, jobPearls } from '../src/js/state/townJobs.js';
import { VENUES } from '../src/js/data/venues.js';
import { conceptOf } from '../src/js/core/spotConcept.js';
import { moduleMeta } from '../src/js/data/curriculum.js';
import { journeyState } from '../src/js/state/journey.js';
import { NL } from '../src/js/i18n/nl.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const fresh = (data = {}) => new Profile(data, memory());

// Every id a decision at a table can be filed under: worked out from the coach itself.
const SKILLS = new Set(['preflop', 'position', 'pot-odds', 'outs', 'spr', 'exploit', 'mdf', 'cbet', 'bluffing', 'icm']);

describe('odd jobs: one in every town', () => {
  it('has a job at every stop, for a skill the table can count', () => {
    equal(JOBS.length, VENUES.length);
    for (const v of VENUES) {
      const job = jobAt(v.key);
      assert(job, `${v.name} has no job on its board`);
      assert(SKILLS.has(job.skill), `${v.name}'s job asks for ${job.skill}, which no decision is filed under`);
      assert(moduleMeta(job.skill), `${v.name}'s job names a skill with no chapter`);
      assert(job.need > 0 && job.who && job.says, `${v.name}'s job is not written out`);
    }
    assert(conceptOf({ street: 'flop', wasAggressor: true, equity: 0.5 }).id === 'cbet', 'the coach no longer names a continuation bet');
  });

  it('pays more for the jobs further down the river', () => {
    for (let i = 1; i < JOBS.length; i++) assert(jobPearls(JOBS[i]) >= jobPearls(JOBS[i - 1]), `${JOBS[i].stop} pays less than the stop before`);
  });
});

describe('odd jobs: counted at the table', () => {
  it('counts sound, unhelped decisions of its kind, at its own town only', () => {
    const p = fresh();
    const job = jobAt('nl25');
    const d = (over) => noteJobDecision(p, { stop: 'nl25', skill: job.skill, level: 'good', helped: false, ...over });
    d({ skill: 'bluffing' });
    d({ level: 'bad' });
    d({ helped: true });
    noteJobDecision(p, { stop: 'nl10', skill: job.skill, level: 'good', helped: false });
    equal(jobRecord(p, 'nl25').have, 0, 'a decision that should not count did');
    d({ level: 'ok' });
    equal(jobRecord(p, 'nl25').have, 1, 'a close decision is still sound');
  });

  it('pays once, the moment it is done', () => {
    const p = fresh();
    const job = jobAt('nl2');
    const before = p.pearls;
    let paid = null;
    for (let i = 0; i < job.need; i++) paid = noteJobDecision(p, { stop: 'nl2', skill: job.skill, level: 'good', helped: false }) || paid;
    assert(paid, 'finishing the job paid nothing');
    equal(p.pearls - before, jobPearls(job));
    const r = jobRecord(p, 'nl2');
    assert(r.done && r.paid);
    equal(noteJobDecision(p, { stop: 'nl2', skill: job.skill, level: 'good', helped: false }), null, 'a finished job paid again');
    equal(p.pearls - before, jobPearls(job));
  });

  it('reads a broken record as an empty one', () => {
    const p = fresh({ jobs: { nl5: { have: 'lots', paid: 'yes' }, nl10: { have: 999 } } });
    equal(jobRecord(p, 'nl5').have, 0);
    equal(jobRecord(p, 'nl5').paid, false);
    equal(jobRecord(p, 'nl10').have, jobAt('nl10').need, 'a count past the need is not capped');
  });
});

describe('odd jobs: the road knows the doors', () => {
  it('sends play and take to the card room, stars to the owner and the Regatta to its hall', () => {
    const goals = journeyState(fresh()).chapters[2].goals;
    const to = (kind) => goals.find((g) => g.kind === kind).to.params.place;
    equal(to('play'), 'room');
    equal(to('take'), 'room');
    equal(to('stars'), 'owner');
    equal(to('regatta'), 'regatta');
  });
});

describe('odd jobs: in Dutch', () => {
  it('has every word', () => {
    for (const job of JOBS) for (const text of [job.who, job.says]) assert(NL[text], `no Dutch for "${text}"`);
    for (const text of ['Wanted', 'Make {n} sound {skill} decisions at the tables here', 'The notice board', 'The deed office', 'On the street', 'Job done for {who}']) {
      assert(NL[text], `no Dutch for "${text}"`);
    }
  });
});
