import { describe, it, assert, equal } from './harness.js';
import { Profile } from '../src/js/state/profile.js';
import {
  CATALOGUE, COMPANIONS, LESSON_PRICES, EARN, handPearls, decisionPearls, itemByKey, itemState,
  purchase, ownsLesson, ownedModules, nextPurchase, missingFor,
  currentBoat, crewAboard, crewAshore, toggleCrew, strongbox, somethingToBuy, boatBerths, boatBonus, UPGRADES,
  seatBounty, bountyPaid,
} from '../src/js/state/economy.js';
import { MODULE_META } from '../src/js/data/curriculum.js';
import { buildReport, strongestAndWeakest, keepReport, reportsOf, KEEP_REPORTS } from '../src/js/state/sessionReport.js';
import { SessionStats } from '../src/js/state/stats.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const fresh = (data = {}) => new Profile(data, memory());

describe('economy: a new purse owns the first chapter and nothing else', () => {
  it('starts with no pearls and only Hand Rankings', () => {
    const p = fresh();
    equal(p.pearls, 0);
    assert(ownsLesson(p, 'hand-rankings'), 'the first chapter is not free');
    for (const m of MODULE_META.filter((x) => x.id !== 'hand-rankings')) {
      assert(!ownsLesson(p, m.id), `${m.id} is owned before anything was bought`);
    }
    equal(ownedModules(p).map((m) => m.id).join(','), 'hand-rankings');
  });

  it('prices every chapter but the first, and lists each one on the shelf once', () => {
    for (const m of MODULE_META) assert(m.id in LESSON_PRICES, `${m.id} has no price`);
    const keys = CATALOGUE.map((i) => i.key);
    equal(new Set(keys).size, keys.length, 'the same thing is on the shelf twice');
    assert(!keys.includes('lesson:hand-rankings'), 'the free chapter is for sale');
  });
});

describe('economy: a save from before pearls loses what can be bought and keeps what was earned', () => {
  it('re-locks chapters but keeps XP, lessons finished, drills, charts progress and the bankroll', () => {
    const old = {
      xp: 2400,
      walkthroughs: ['hand-rankings', 'pot-odds'],
      drills: { 'pot-odds': { attempts: 30, correct: 27, streak: 3, bestStreak: 9, recent: '1'.repeat(30) } },
      ranges: { 'open:BTN': { stage: 2, cleared: false, runs: 3, peeks: 0 } },
      bankroll: 740,
      handsPlayed: 300,
    };
    const p = fresh(old);
    equal(p.xp, 2400);
    equal(p.data.walkthroughs.length, 2);
    equal(p.drillStats('pot-odds').attempts, 30);
    equal(p.rangeProgress('open:BTN').stage, 2);
    equal(p.data.bankroll, 740);
    equal(p.pearls, 0);
    assert(!ownsLesson(p, 'pot-odds'), 'a chapter from before survived the change');
  });

  it('does the reset once: a bought chapter survives a reload', () => {
    const store = memory();
    const p = new Profile({}, store);
    p.earnPearls(100);
    assert(purchase(p, 'lesson:pot-odds').ok);
    const again = Profile.load(store);
    assert(ownsLesson(again, 'pot-odds'), 'the purchase was undone on reload');
    equal(again.pearls, 40);
  });
});

describe('economy: buying', () => {
  it('refuses on credit, refuses twice, and refuses what the rank does not allow', () => {
    const p = fresh();
    equal(purchase(p, 'lesson:pot-odds').reason, 'short');
    p.earnPearls(500);
    assert(purchase(p, 'lesson:pot-odds').ok);
    equal(purchase(p, 'lesson:pot-odds').reason, 'owned');
    // Outs opens at rank 2; a new profile is rank 1.
    equal(purchase(p, 'lesson:outs').reason, 'locked');
    equal(p.pearls, 500 - LESSON_PRICES['pot-odds']);
  });

  it('asks for the chapter before its charts, and for the lesson finished before its companion', () => {
    const p = fresh();
    p.earnPearls(1000);
    equal(purchase(p, 'chart:open:BTN').reason, 'locked');
    const owl = itemByKey('pet:owl');
    const missing = missingFor(p, owl);
    equal(missing.length, 1);
    equal(missing[0].key, 'lesson');
    p.markWalkthroughComplete('pot-odds');
    assert(itemState(p, owl).ready, 'finishing the lesson did not put the owl within reach');
    assert(purchase(p, 'pet:owl').ok);
  });

  it('gives every companion a chapter it depends on, or a count of them', () => {
    for (const c of COMPANIONS) {
      const needs = c.needs || {};
      assert(needs.lesson || needs.lessons, `${c.key} can be bought without learning anything`);
      if (needs.lesson) assert(MODULE_META.some((m) => m.id === needs.lesson), `${c.key} needs a lesson that does not exist`);
    }
  });

  it('names the cheapest chapter the rank already allows as the next thing to play for', () => {
    const p = fresh();
    equal(nextPurchase(p).item.key, 'lesson:pot-odds');
    p.earnPearls(60);
    purchase(p, 'lesson:pot-odds');
    // Nothing else is open at rank 1.
    equal(nextPurchase(p), null);
  });
});

describe('economy: what the tables pay', () => {
  it('pays more per hand further down the river', () => {
    equal(handPearls(null), 1);
    equal(handPearls(0), 1);
    assert(handPearls(7) > handPearls(0), 'the delta pays no more than the landing');
    for (let i = 1; i < 8; i++) assert(handPearls(i) >= handPearls(i - 1), `stop ${i} pays less than the one before it`);
  });

  it('pays for sound decisions only, never for a preflop fold or a decision somebody helped with', () => {
    equal(decisionPearls({ level: 'good', street: 'flop', action: 'call' }), EARN.sound);
    equal(decisionPearls({ level: 'bad', street: 'flop', action: 'call' }), 0);
    equal(decisionPearls({ level: 'ok', street: 'river', action: 'call' }), 0);
    equal(decisionPearls({ level: 'good', street: 'preflop', action: 'fold' }), 0);
    equal(decisionPearls({ level: 'good', street: 'preflop', action: 'raise' }), EARN.sound);
    equal(decisionPearls({ level: 'good', street: 'turn', action: 'bet', helped: true }), 0);
  });

  it('never lets the purse go below zero or take a negative payment', () => {
    const p = fresh();
    equal(p.earnPearls(-5), 0);
    equal(p.pearls, 0);
    assert(!p.buy('lesson:outs', -10), 'a negative price was accepted');
  });
});

describe('the session report: Silas\'s notes on one sitting', () => {
  const stats = new SessionStats();
  const graded = [
    { skill: 'pot-odds', level: 'good', street: 'flop', action: 'call', helped: false, head: 'A', costBb: 0 },
    { skill: 'pot-odds', level: 'good', street: 'turn', action: 'call', helped: false, head: 'B', costBb: 0 },
    { skill: 'pot-odds', level: 'bad', street: 'river', action: 'call', helped: false, head: 'Called without the odds', costBb: 6.5 },
    { skill: 'preflop', level: 'bad', street: 'preflop', action: 'call', helped: false, head: 'Limping gives the pot away', costBb: 0 },
    { skill: 'preflop', level: 'bad', street: 'preflop', action: 'raise', helped: false, head: 'Outside the range', costBb: 0 },
    { skill: 'preflop', level: 'good', street: 'preflop', action: 'raise', helped: true, head: 'helped', costBb: 0 },
  ];
  const report = buildReport({
    place: { kind: 'practice', key: 'practice', name: 'Silas\'s practice table' },
    stats,
    graded,
    pearls: { hands: 12, decisions: 2, bonus: 0 },
  });

  it('leaves helped decisions out of the judgement, and counts them apart', () => {
    equal(report.decisions.total, 5);
    equal(report.decisions.helped, 1);
    equal(report.decisions.sound, 2);
    equal(report.decisions.bySkill.preflop.total, 2);
  });

  it('names the strongest and weakest skill, and puts the costliest mistake first', () => {
    const { strongest, weakest } = strongestAndWeakest(report);
    equal(strongest.skill, 'pot-odds');
    equal(weakest.skill, 'preflop');
    equal(report.worst[0].head, 'Called without the odds');
    equal(report.pearls.total, 14);
  });

  it('keeps only the most recent sittings', () => {
    const p = fresh();
    for (let i = 0; i < KEEP_REPORTS + 5; i++) keepReport(p, { ...report, at: i });
    equal(reportsOf(p).length, KEEP_REPORTS);
    equal(reportsOf(p)[0].at, 5);
  });
});

describe('economy: boats are bought at the boatyard, and carry the crew', () => {
  const at = (best, extra = {}) => fresh({
    bankroll: 900,
    career: { venue: best, best, busted: 0, staked: 0, beaten: [] },
    economy: { version: 3, pearls: 0, earned: 0, spent: 0, owned: ['lesson:hand-rankings'], boat: 'rowboat', crew: [], ...extra },
  });

  it('starts everybody in the borrowed rowboat, with one berth and no strongbox', () => {
    const p = fresh();
    const boat = currentBoat(p);
    equal(boat.key, 'rowboat');
    equal(boat.berths, 1);
    equal(boat.bonus, 0);
  });

  it('only sells a boat to somebody who has taken theirs that far down the river', () => {
    const p = at('nl2', { pearls: 2000 });
    const skiff = itemState(p, itemByKey('boat:skiff'));
    assert(skiff.missing.some((m) => m.key === 'reach'), 'the skiff is sold at Mud Landing');
    equal(purchase(p, 'boat:skiff').reason, 'locked');
    const q = at('nl5', { pearls: 2000 });
    equal(purchase(q, 'boat:skiff').ok, true, 'the skiff is not sold at Fisher\'s Rest');
    equal(purchase(q, 'boat:launch').reason, 'locked', 'the launch is sold before the Ferry');
  });

  it('pays for a boat in pearls and never touches the bankroll', () => {
    const p = at('nl5', { pearls: 200 });
    equal(purchase(p, 'boat:skiff').ok, true);
    equal(p.pearls, 50);
    equal(p.data.bankroll, 900, 'the boat came out of the bankroll');
    equal(currentBoat(p).key, 'skiff', 'a boat just bought is not the one you sail');
  });

  it('never takes more companions to the table than the boat has berths', () => {
    const p = at('nl10', { pearls: 1000, owned: ['lesson:hand-rankings', 'pet:owl', 'pet:cat', 'pet:raccoon'], crew: ['owl', 'cat', 'raccoon'] });
    equal(crewAboard(p).map((c) => c.key).join(','), 'owl', 'a rowboat carried more than one');
    equal(crewAshore(p).length, 2);
    // Bringing one aboard a full boat swaps out whoever has been aboard longest.
    toggleCrew(p, 'cat');
    equal(crewAboard(p).map((c) => c.key).join(','), 'cat');
    // A bigger boat takes the ones waiting at the landing aboard.
    equal(purchase(p, 'boat:launch').ok, true);
    equal(crewAboard(p).length, 3);
    equal(crewAshore(p).length, 0);
  });

  it('boards a companion bought while there is a berth free', () => {
    const p = at('nl5', { pearls: 500 });
    p.data.walkthroughs = ['pot-odds'];
    equal(purchase(p, 'pet:owl').ok, true);
    equal(crewAboard(p).map((c) => c.key).join(','), 'owl');
  });

  it('pays the strongbox share in full over many hands, a fraction at a time', () => {
    let carry = 0;
    let extra = 0;
    for (let i = 0; i < 100; i++) {
      const r = strongbox(carry, 1, 0.1);
      carry = r.carry;
      extra += r.extra;
    }
    equal(extra, 10, 'a tenth of a pearl a hand for a hundred hands is ten pearls');
    equal(strongbox(0, 3, 0).extra, 0, 'the rowboat has no strongbox');
    equal(strongbox(0.9, 1, 0.2).extra, 1);
  });

  it('sells only fittings that do something at the table', () => {
    for (const u of UPGRADES) assert(u.berths > 0 || u.bonus > 0, `${u.name} does nothing at the table`);
    const p = at('nl5', { pearls: 700, owned: ['lesson:hand-rankings', 'pet:owl', 'pet:cat'], crew: ['owl'] });
    equal(boatBerths(p), 1);
    equal(crewAshore(p).length, 1);
    // A spare cabin is one more companion at the table, on any boat.
    equal(purchase(p, 'up:cabin').ok, true);
    equal(boatBerths(p), 2);
    equal(crewAboard(p).length, 2, 'the cabin went unused with a companion waiting ashore');
    // A heavier strongbox is a tenth more on top of the boat's own share.
    equal(boatBonus(p), 0);
    equal(purchase(p, 'up:strongbox').ok, true);
    equal(Math.round(boatBonus(p) * 100), 10);
    equal(purchase(p, 'boat:skiff').ok, true);
    equal(boatBerths(p), 3, 'the cabin did not come along to the new boat');
    equal(Math.round(boatBonus(p) * 100), 20, 'the heavier box did not add to the skiff\'s own');
  });

  it('pays back what paint, flags and the lantern cost, now they are gone', () => {
    const p = fresh({
      career: { venue: 'nl5', best: 'nl5', busted: 0, staked: 0, beaten: [] },
      economy: {
        version: 2, pearls: 10, earned: 300, spent: 290, boat: 'rowboat', crew: [], paint: 'paint-red', flag: 'flag-pearl', lantern: true,
        owned: ['lesson:hand-rankings', 'fit:paint-red', 'fit:flag-pearl', 'fit:lantern'],
      },
    });
    equal(p.pearls, 190, 'sixty for the paint, seventy for the flag and fifty for the lantern should be back');
    equal(p.economy.spent, 110);
    assert(!p.economy.owned.some((k) => k.startsWith('fit:')), 'a retired fitting is still owned');
    assert(!('paint' in p.economy) && !('flag' in p.economy) && !('lantern' in p.economy), 'the old dressing is still on the save');
  });

  it('keeps the boat a save had earned before the boatyard, and hands over the flagship for the river', () => {
    const old = fresh({
      career: { venue: 'nl25', best: 'nl50', busted: 0, staked: 0, beaten: ['nl2'] },
      economy: { version: 1, pearls: 40, earned: 40, spent: 0, owned: ['lesson:hand-rankings', 'pet:owl', 'pet:cat', 'pet:raccoon'] },
    });
    equal(currentBoat(old).key, 'launch', 'a save that reached the Belle lost its launch');
    equal(crewAboard(old).length, 3);
    equal(old.pearls, 40, 'the purse changed in the move to the boatyard');
    const ancient = fresh({ career: { venue: 'nl10', best: 'nl10', busted: 0, staked: 0, beaten: [] } });
    equal(currentBoat(ancient).key, 'skiff', 'a save from before pearls lost its skiff');
    const p = at('nl500');
    p.noteResidentBeaten('nl500');
    equal(currentBoat(p).key, 'flagship', 'beating the Commodore did not hand over his flagship');
  });

  it('lights a shop up only for what it sells', () => {
    const p = at('nl5', { pearls: 120 });
    assert(somethingToBuy(p, 'boatyard'), 'a hundred and twenty pearls buys a spare cabin, and the boatyard does not say so');
    assert(somethingToBuy(p, 'tradingpost'), 'a hundred and twenty pearls buys Pot Odds, and the Trading Post does not say so');
    const poor = at('nl5', { pearls: 10 });
    assert(!somethingToBuy(poor, 'boatyard') && !somethingToBuy(poor, 'tradingpost'), 'a shop lights up for a purse that cannot pay');
  });
});

describe('economy: every player carries a bounty, paid on how the hand was played', () => {
  it('puts more on players further down the river, and the most on the owner', () => {
    equal(seatBounty(null), 5, 'a regular at the practice table');
    equal(seatBounty(0), 5);
    equal(seatBounty(7), 15);
    equal(seatBounty(0, true), 25);
    equal(seatBounty(7, true), 50);
    for (let i = 1; i < 8; i++) {
      assert(seatBounty(i) >= seatBounty(i - 1) && seatBounty(i, true) >= seatBounty(i - 1, true), `stop ${i} carries less than the one before`);
      assert(seatBounty(i, true) > seatBounty(i), `the owner at stop ${i} carries no more than a regular`);
    }
  });

  it('pays all of it for a hand played right, half for one mistake, nothing for two', () => {
    equal(bountyPaid(20, 0), 20);
    equal(bountyPaid(20, 1), 10);
    equal(bountyPaid(5, 1), 3, 'half of an odd bounty rounds up');
    equal(bountyPaid(20, 2), 0);
    equal(bountyPaid(20, 4), 0);
    equal(bountyPaid(0, 0), 0, 'a bounty already taken pays nothing');
  });
});
