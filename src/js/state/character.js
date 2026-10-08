/**
 * Who you are at the table, worked out once for every screen that shows it:
 * the Character screen, the card on the river, the figure's clothes and the
 * cup of tea in its hand.
 *
 * Read only. Everything here comes from the save — the lifetime of hands
 * (state/lifetime.js), the rank, the last few sittings, the river's records —
 * so a screen can call it on every render and nothing drifts.
 */

import {
  styleNumbers, styleFromReports, cashResults, soundRate, LIFE_SAMPLE,
} from './lifetime.js';
import { reportsOf } from './sessionReport.js';
import { playerType } from '../data/playerTypes.js';
import { tierFor, formFor, propsFor } from '../data/looks.js';
import { VENUES } from '../data/venues.js';

/**
 * What the river knows about you.
 *
 * `read` is the VPIP and PFR your type is named from: your lifetime at full
 * cash tables once there are enough hands there, and until then Silas's notes
 * on your last sittings at the stops — so a save from before the lifetime was
 * kept has a style on the first visit rather than thirty hands later.
 */
export function whoYouAre(profile) {
  const life = profile.lifetime;
  const style = styleNumbers(life);
  const notes = style.vpip === null
    ? styleFromReports(reportsOf(profile).filter((r) => r && r.place && r.place.table))
    : null;
  const read = style.vpip !== null
    ? { vpip: style.vpip, pfr: style.pfr, hands: style.hands, source: 'life' }
    : notes ? { ...notes, source: 'notes' } : null;
  const cash = cashResults(life);
  const sound = soundRate(life);
  const type = playerType(read, { sound, hands: cash.hands, winRate: cash.winRate });
  const level = profile.level;
  const sessions = Array.isArray(profile.data.sessions) ? profile.data.sessions : [];
  const recent = sessions.slice(-3).reduce((s, x) => s + (x && Number.isFinite(x.profitBb) ? x.profitBb : 0), 0);
  const regattas = Object.values(profile.career.regattas || {});
  return {
    life,
    style,
    read,
    // How far there is still to go before the style is read from your own hands.
    toRead: Math.max(0, LIFE_SAMPLE.style - life.style.hands),
    cash,
    sound,
    type,
    level,
    rank: profile.rank,
    tier: tierFor(level),
    form: formFor(sessions),
    recentBb: Math.round(recent * 10) / 10,
    props: propsFor(type.key),
    look: profile.look,
    trophy: regattas.some((r) => r && r.wins > 0),
  };
}

/**
 * The river's own records, for the "on the river" plaques: what you have
 * taken, won, caught and been paid. Plain numbers, zero for anything never done.
 */
export function riverRecords(profile) {
  const career = profile.career;
  const n = (x) => (Number.isFinite(x) && x > 0 ? Math.round(x) : 0);
  const duels = Object.values(career.duels || {});
  const regattas = Object.values(career.regattas || {});
  const contracts = profile.data.contracts && typeof profile.data.contracts === 'object' ? profile.data.contracts : {};
  const daily = profile.data.daily && typeof profile.data.daily === 'object' ? profile.data.daily : {};
  return {
    keepsakes: VENUES.filter((v) => career.beaten.includes(v.key)).length,
    stops: VENUES.length,
    duelWins: duels.reduce((s, d) => s + n(d && d.wins), 0),
    stars: duels.reduce((s, d) => s + n(d && d.stars), 0),
    starsOf: VENUES.length * 3,
    regattas: regattas.reduce((s, r) => s + n(r && r.entered), 0),
    regattaWins: regattas.reduce((s, r) => s + n(r && r.wins), 0),
    species: Object.keys(profile.catchBook || {}).length,
    contracts: n(contracts.done),
    dailyBest: n(daily.best),
    pearls: n(profile.economy.earned),
    rivalMet: n(profile.data.rival && profile.data.rival.met),
    busted: n(career.busted),
    rooms: VENUES.filter((v) => profile.owns(`room:${v.key}`)).length,
    roomIncome: Object.values(profile.data.roomIncome && typeof profile.data.roomIncome === 'object' ? profile.data.roomIncome : {})
      .reduce((sum, x) => sum + (Number.isFinite(x) && x > 0 ? x : 0), 0),
  };
}
