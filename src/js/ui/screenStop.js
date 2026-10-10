/**
 * A stop on the river: the place, the person who owns its table, and the
 * way to a seat.
 *
 * This is where the teaching sits next to the game. Before you sit down with
 * somebody you are told how they play and what beats it — the same read and
 * counter the drills teach for their style — and pointed at the one lesson
 * that covers it. Then you sit down and find out whether you listened.
 */

import { el, fmt, toast } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { VENUES, venueFor, GRUBSTAKE } from '../data/venues.js';
import { bossFor } from '../data/characters.js';
import { getProfile } from '../engine/bots.js';
import { moduleMeta } from '../data/curriculum.js';
import { sceneSvg } from './riverArt.js';
import { portraitSvg } from './portraits.js';
import { riverState } from './screenRiver.js';
import { svgNode, typedText } from './place.js';
import * as audio from '../audio/engine.js';
import { reportsOf } from '../state/sessionReport.js';
import { EARN, seatInPearls, ROOM_CUT, roomKey, ownsRoom, roomsOwned, roomIncome } from '../state/economy.js';
import { buyControl } from './shop.js';
import { pearls, pearl } from './shop.js';
import { MENTOR } from '../data/characters.js';
import { gatedBy, duelStatus } from '../state/journey.js';
import { starPearls, LEVEL_HANDS, STAR_SHARE } from '../state/match.js';
import { START_STACK, LEVEL_HANDS as REGATTA_LEVEL_HANDS, payouts as regattaPayouts } from '../state/regatta.js';
import { storyFor } from '../data/story.js';
import { lobbyFor, RIVAL_FROM } from '../state/lobby.js';
import { readOn as rivalRead } from '../state/rival.js';
import { RIVAL, RIVAL_NOTES } from '../data/rival.js';
import { wandererFor } from '../data/wanderers.js';
import { roadList, opensLine, goalText } from './roadView.js';
import { BACKWATERS } from '../data/backwaters.js';
import { rumourAt, hear, heard as heardOf, townGoals } from '../state/backwaters.js';

/** The place itself: sky, the far bank, the water, and the stop drawn big. */
function scene(venue, state, arrived) {
  const here = venue.index === state.here.index && !state.town;
  const art = sceneSvg({
    id: venue.key,
    landmark: venue.landmark,
    orbLeft: venue.index % 2 === 1,
    boat: here ? state.boat.key : null,
    arriving: arrived,
    sea: venue.act === 2,
  });
  return el('div.scene',
    svgNode(art, 'scene-art-wrap'),
    el('div.scene-title',
      el('div.scene-where', t(venue.where)),
      el('h1.sign', t(venue.name)),
      el('span.scene-stake', venue.label),
    ),
  );
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * What the boss says when you walk up: hello, or — coming back from their
 * table — something about how it went. Up on the night, they are sore about
 * it; down, they let you know.
 */
function lineFor(boss, taken, after) {
  if (after === 'took') return boss.beaten;
  if (after === 'up') return pick(boss.sore);
  if (after === 'down') return pick(boss.brag);
  return taken ? boss.beaten : boss.hello;
}

/** The boss, in their own words. */
function bossBlock(venue, state, after) {
  const boss = bossFor(venue.boss);
  const style = getProfile(boss.plays);
  const taken = state.beaten.has(venue.index);
  const line = lineFor(boss, taken, after);
  return el('div.boss',
    el('div.boss-figure',
      svgNode(portraitSvg(boss.key, { size: 132 }), 'boss-portrait'),
      el('div.boss-plate',
        el('div.boss-name.sign', boss.name),
        el('div.boss-title', t(boss.title)),
      ),
    ),
    el('div.boss-talk',
      el('div.bubble.paper', el('p.said', typedText(`“${t(line)}”`))),
      el('div.boss-notes',
        el('div.note',
          el('div.note-head', el('span.style-tag', style.tag), t('How {name} plays', { name: boss.short })),
          el('p', t(boss.read)),
        ),
        el('div.note',
          el('div.note-head', icon('target', { size: 15 }), t('How to beat {name}', { name: boss.short })),
          el('p', t(boss.beat)),
        ),
      ),
    ),
  );
}

/** Seat price, stakes, and what your purse can do about them. */
function tableBlock(venue, state, profile, go) {
  const boss = bossFor(venue.boss);
  // Up a backwater, the boat is at the town: the stop it left from is a trip away.
  const here = venue.index === state.here.index && !state.town;
  const canReach = state.bankroll >= venue.stake.minBankroll;
  // A seat is paid in money, or in pearls at what they fetch here.
  const canSit = state.bankroll >= venue.entry || profile.pearls >= seatInPearls(venue.index);
  const lesson = moduleMeta(boss.lesson);

  const facts = el('div.here-facts',
    el('span.fact', el('span.k', t('Stakes')), el('span.v', venue.label)),
    el('span.fact', el('span.k', t('Blinds')), el('span.v', `${fmt.money(venue.stake.bb / 2)} / ${fmt.money(venue.stake.bb)}`)),
    el('span.fact', el('span.k', t('Seat')), el('span.v', fmt.money(venue.entry))),
  );

  const study = lesson
    ? el('button.btn.ghost', { onclick: () => go('learn', { module: boss.lesson }) },
      icon(lesson.icon, { size: 16 }), t('Study first: {module}', { module: t(lesson.name) }))
    : null;

  let action;
  if (here && canSit) {
    action = el('div.stop-actions.lobby-wrap',
      lobbyCards(venue, state, profile, go),
      study,
    );
  } else if (here) {
    // Broke: the house puts you back in, and it is written down.
    action = el('div.stop-actions',
      el('p.muted', t('A seat at {room} is {money} and you have {have}.',
        { room: t(venue.name), money: fmt.money(venue.entry), have: fmt.money(state.bankroll) })),
      el('button.btn.primary.plank', {
        onclick: () => {
          profile.stakedByTheHouse(GRUBSTAKE);
          toast({
            icon: 'chip',
            title: t('The house stakes you'),
            desc: t('{money} and a seat at the cheapest game. It is counted.', { money: fmt.money(GRUBSTAKE) }),
          });
          go('stop', { at: VENUES[0].key });
        },
      }, t('Take {money} from the house', { money: fmt.money(GRUBSTAKE) })),
      el('button.btn.ghost', { onclick: () => go('train') }, t('Go and study instead')),
    );
  } else if (venue.index > state.road.current) {
    // The road: the city before this one is not finished, whatever the purse says.
    const gate = gatedBy(venue.index);
    action = el('div.stop-actions.shut',
      el('div.stop-need', icon('lock', { size: 16 }),
        t('The road to {place} opens when {gate} is finished.', { place: t(venue.name), gate: t(gate.name) })),
      el('button.btn.primary.plank', { onclick: () => go('stop', { at: gate.key }) },
        t('See what is left at {place}', { place: t(gate.name) })),
    );
  } else if (canReach) {
    const down = venue.index > state.here.index;
    const back = venue.index === state.here.index;
    action = el('div.stop-actions',
      el('button.btn.primary.plank.lg', {
        onclick: () => {
          audio.sfx('whistle');
          const from = state.here.index;
          profile.enterVenue(venue.key);
          // The trip itself happens on the map: the boat steams down (or
          // back up) the river from here to there, then ties up.
          go('home', { sail: `${from}-${venue.index}` });
        },
      }, back ? t('Back to {place}', { place: t(venue.name) })
        : down ? t('Steam down to {place}', { place: t(venue.name) }) : t('Head back up to {place}', { place: t(venue.name) })),
      study,
    );
  } else {
    const pct = Math.max(2, Math.min(100, Math.round((state.bankroll / venue.stake.minBankroll) * 100)));
    action = el('div.stop-actions.shut',
      el('div.stop-need',
        icon('lock', { size: 16 }),
        t('This stop takes a purse of {money}. You have {have}.',
          { money: fmt.money(venue.stake.minBankroll), have: fmt.money(state.bankroll) })),
      el('div.bar', el('span', { style: { width: `${pct}%` } })),
      el('p.faint', t('{n} seats\' worth, because a bad night at a table should cost you a night, not the river.',
        { n: Math.round(venue.stake.minBankroll / venue.entry) })),
      study,
    );
  }

  return el('div.panel.table-block',
    el('div.panel-title', el('h3', icon('chip', { size: 16 }), t('The table'))),
    facts,
    action,
  );
}

/** The first time you tie up at a stop, a few lines about what is there. */
function arrivalCard(venue) {
  const story = storyFor(venue.key);
  if (!story) return null;
  return el('div.panel.paper.story-card',
    el('div.story-kicker', icon('anchor', { size: 14 }), venue.act === 2 ? t('The Gulf, {place}', { place: t(venue.name) }) : t('The river, {place}', { place: t(venue.name) })),
    el('p.story-text', typedText(t(story.arrival))),
  );
}

/** Three stars, filled up to `n`. */
export function starRow(n, { size = 18 } = {}) {
  return el('span.star-row', { role: 'img', 'aria-label': t('{n} of 3 stars', { n }) },
    [1, 2, 3].map((i) => el(`span.star${i <= n ? '.on' : ''}`, icon('star', { size }))));
}

/**
 * The duel with the owner of this table: heads-up, to the last chip, with the
 * blinds rising. Before the city's goals are done it says what is left;
 * after, it is the way to take the table — and then the way to earn the
 * stars the rematch is for.
 */
function duelBlock(venue, state, profile, go) {
  const boss = bossFor(venue.boss);
  const duel = duelStatus(profile, venue.index);
  if (!duel.open) return null;
  const record = duel.record;

  const rules = el('p.faint', t(
    'Just the two of you, {chips} chips each, the blinds rising every {n} hands until one of you has them all. It costs nothing to sit down.',
    { chips: 200, n: LEVEL_HANDS }));

  if (!duel.ready) {
    return el('div.panel.duel-block.shut',
      el('div.panel-title', el('h3', icon('cards', { size: 16 }), t('Duel {name}', { name: boss.short }))),
      el('p.muted', t('{name} will not duel a stranger. Do these first:', { name: boss.short })),
      el('ul.duel-missing', duel.missing.map((g) => el('li', icon('lock', { size: 12 }), goalText(g)))),
    );
  }

  const nextStar = Math.min(3, record.stars + 1);
  const worth = record.stars >= 3 ? 0 : starPearls(venue.index, record.stars, nextStar);
  return el('div.panel.duel-block',
    el('div.panel-title', el('h3', icon('cards', { size: 16 }), t('Duel {name}', { name: boss.short })),
      record.tries ? starRow(record.stars) : null),
    rules,
    !duel.taken
      ? el('p.muted', t('Win it and the table is yours: the keepsake, the purse and the pearls.'))
      : record.stars < 3
        ? el('p.muted', t('A rematch for the next star pays {n} pearls. Stars are for how well you play, not just for winning: {two}% of your decisions sound for two, {three}% for three.',
          { n: worth, two: Math.round(STAR_SHARE.two * 100), three: Math.round(STAR_SHARE.three * 100) }))
        : el('p.muted', t('Three stars. There is nothing more to win from {name}, but {name} will always play you again.', { name: boss.short })),
    record.tries
      ? el('div.faint', t('{wins} won of {tries} played.', { wins: record.wins, tries: record.tries }))
      : null,
    el('div.stop-actions',
      el('button.btn.primary.plank', { onclick: () => { audio.sfx('chips'); go('play', { mode: 'duel', at: venue.key }); } },
        icon('cards', { size: 16 }), duel.taken ? t('Rematch {name}', { name: boss.short }) : t('Challenge {name}', { name: boss.short })),
    ),
  );
}

/** A face and a name, small: who is in a seat at a table in the lobby. */
export function lobbyFace(name, portrait, { rival = false, owner = false, wanderer = false } = {}) {
  return el(`span.lobby-face${rival ? '.rival' : ''}${owner ? '.owner' : ''}${wanderer ? '.wanderer' : ''}`, { title: name },
    svgNode(portraitSvg(portrait, { size: 34 }), 'lobby-portrait'),
    el('span.lobby-name', name));
}

/**
 * One table in the lobby: who is at it, the three numbers a lobby shows, and
 * the way to sit down. What the numbers mean is Silas's to teach and the
 * reader's to work out — nobody tells them which table is the soft one.
 */
function lobbyCard(table, venue, lobby, { state, profile, go }) {
  const boss = bossFor(venue.boss);
  const faces = table.styles.map((key, i) => {
    if (table.owner && i === 0) return lobbyFace(boss.short, boss.key, { owner: true });
    if (table.rivalSeat === i) return lobbyFace(RIVAL.short, RIVAL.key, { rival: true });
    if (table.wandererSeat === i) return lobbyFace(wandererFor(key).short, key, { wanderer: true });
    return lobbyFace(getProfile(key).name, key);
  });
  return el(`article.lobby-card${table.owner ? '.owner' : ''}`,
    el('div.lobby-card-head',
      el('h4', t(table.name)),
      table.owner
        ? el('span.lobby-tag.owner', t('Owner: {name}', { name: boss.short }))
        : el('span.lobby-tag', t('No owner')),
      lobby.rival === table.id ? el('span.lobby-tag.rival', t('{name} is here', { name: RIVAL.short })) : null,
      lobby.wanderer && lobby.wanderer.table === table.id
        ? el('span.lobby-tag.wanderer', t('{name} is here', { name: wandererFor(lobby.wanderer.key).short })) : null,
    ),
    el('div.lobby-faces', faces),
    el('div.lobby-stats',
      el('span.lobby-stat', { title: t('Players who see the flop, out of every hundred hands dealt') },
        el('span.k', t('See the flop')), el('span.v', `${table.stats.flop}%`)),
      el('span.lobby-stat', { title: t('How many pots are raised before the flop') },
        el('span.k', t('Raised pots')), el('span.v', `${table.stats.raised}%`)),
      el('span.lobby-stat', { title: t('The average pot, in big blinds') },
        el('span.k', t('Average pot')), el('span.v', t('{n} bb', { n: table.stats.pot }))),
    ),
    table.owner
      ? el('p.faint.lobby-note', t('Sit down for {buyin} and cash out with {target} or more, double what you sat down with, or beat {name} in a duel, and the table is yours.',
        { buyin: fmt.money(venue.entry), target: fmt.money(venue.entry * 2), name: boss.short }))
      : el('p.faint.lobby-note', t('Nobody owns this game, so there is no table to take. A place to build your roll.')),
    el('div.lobby-pay',
      el(`button.btn${table.owner ? '.primary.plank' : '.ghost'}`, {
        disabled: state.bankroll < venue.entry,
        onclick: () => {
          audio.sfx('chips');
          profile.setBankroll(state.bankroll, venue.key);
          go('play', { mode: 'grind', table: table.id });
        },
      }, t('Take a seat — {money}', { money: fmt.money(venue.entry) })),
      payInPearls(profile, venue, () => {
        profile.setBankroll(state.bankroll, venue.key);
        go('play', { mode: 'grind', table: table.id, pay: 'pearls' });
      }),
    ),
  );
}

/**
 * The same seat, or the same entry, paid in pearls: what they fetch where
 * the boat is moored, so it is the same money either way. Shut, and saying
 * how many you have, when the purse is short.
 */
export function payInPearls(profile, venue, onPay) {
  const price = seatInPearls(venue.index);
  const short = profile.pearls < price;
  return el('button.btn.sm.ghost.pay-pearls', {
    disabled: short,
    title: short
      ? t('{n} pearls, and you have {have}', { n: fmt.chips(price), have: fmt.chips(profile.pearls) })
      : t('Pay in pearls instead of money: what {n} pearls fetch here is a seat', { n: fmt.chips(price) }),
    onclick: () => { audio.sfx('chips'); onPay(); },
  }, pearl(), ' ', t('Pay in pearls: {n}', { n: fmt.chips(price) }));
}

/** The three tables at a stop. */
function lobbyCards(venue, state, profile, go) {
  const lobby = lobbyFor(venue, profile.sittings);
  return el('div.lobby',
    el('p.lobby-hint', t('Three games are running. The numbers are what a lobby shows: pick the game, then take the seat.')),
    el('div.lobby-grid', lobby.tables.map((table) => lobbyCard(table, venue, lobby, { state, profile, go }))),
  );
}

/**
 * Nell, on the stop's screen: whether she is here, and what she has made of
 * you so far. Her tally is the same one the tables' regulars keep, but she
 * keeps it between sittings, and says so.
 */
function rivalBlock(venue, profile) {
  if (venue.index < RIVAL_FROM) return null;
  const lobby = lobbyFor(venue, profile.sittings);
  const here = lobby.tables.find((x) => x.id === lobby.rival);
  const { met, memory } = profile.rival;
  if (!met && !here) return null;
  const read = rivalRead(memory);
  const pct = read.pct;
  return el('div.panel.rival-block',
    el('div.rival-head',
      svgNode(portraitSvg(RIVAL.key, { size: 64 }), 'rival-portrait'),
      el('div',
        el('div.here-kicker', t(RIVAL.title)),
        el('h3.rival-name', RIVAL.name),
        el('div.faint', here
          ? t('She is at {table} today.', { table: t(here.name) })
          : met ? t('She is not at this stop today.') : ''),
      ),
    ),
    met
      ? el('p.rival-read', t(RIVAL_NOTES[read.kind], { n: read.n, pct: pct == null ? 0 : pct }))
      : el('p.rival-read.faint', t('Somebody is sitting at {table} who is not a regular. Sit down and find out.', { table: t(here.name) })),
    el('p.faint', t(RIVAL_NOTES.explain)),
  );
}

/**
 * A stranger who is passing through, if one is: who they are, where they are
 * sitting, how they play and how to beat it. They are gone in a few sittings.
 */
function wandererBlock(venue, profile) {
  const lobby = lobbyFor(venue, profile.sittings);
  if (!lobby.wanderer) return null;
  const w = wandererFor(lobby.wanderer.key);
  const at = lobby.tables.find((x) => x.id === lobby.wanderer.table);
  const style = getProfile(w.key);
  return el('div.panel.wanderer-block',
    el('div.rival-head',
      svgNode(portraitSvg(w.key, { size: 64 }), 'rival-portrait'),
      el('div',
        el('div.here-kicker', t('Passing through')),
        el('h3.rival-name', t(w.name)),
        el('div.faint', `${t(w.title)} · ${t('at {table}', { table: t(at.name) })}`),
      ),
    ),
    el('p.rival-read', el('span.style-tag', style.tag), ' ', t(w.read)),
    el('p.faint', el('strong', t('How to beat {name}', { name: w.short })), ': ', t(w.beat)),
    el('p.faint', t('A stranger carries a purse twice an owner\'s, and they will not be here for long.')),
  );
}

/**
 * The Regatta at this stop: a six-player tournament, the top three paid. The
 * entry is a seat's price and the pool is paid back in full, so a player no
 * better than the field breaks even. Only from where the boat is moored, the
 * way a seat is.
 */
function regattaBlock(venue, state, profile, go) {
  if (venue.index < 1 || venue.index !== state.here.index || state.town) return null;
  const record = profile.regattaRecord(venue.key);
  const prizes = regattaPayouts(venue.entry);
  const canEnter = state.bankroll >= venue.entry;
  const enterInPearls = payInPearls(profile, venue, () => go('play', { mode: 'regatta', at: venue.key, pay: 'pearls' }));
  return el('div.panel.regatta-block',
    el('div.panel-title', el('h3', icon('anchor', { size: 16 }), t('The Regatta')),
      record.wins ? el('span.regatta-trophies', { title: t('Won {n}', { n: record.wins }) }, '🏆'.repeat(Math.min(record.wins, 5))) : null),
    el('p.faint', t('Six players, {chips} chips each, the blinds climbing every {n} hands until one has everything. The top three are paid, and the whole pool is paid back: nobody takes a rake.',
      { chips: START_STACK, n: REGATTA_LEVEL_HANDS })),
    el('div.here-facts',
      el('span.fact', el('span.k', t('Entry')), el('span.v', fmt.money(venue.entry))),
      el('span.fact', el('span.k', t('First')), el('span.v', fmt.money(prizes[0]))),
      el('span.fact', el('span.k', t('Second')), el('span.v', fmt.money(prizes[1]))),
      el('span.fact', el('span.k', t('Third')), el('span.v', fmt.money(prizes[2]))),
    ),
    el('p.muted', t('With a prize list, a chip you lose is worth more to you than a chip you win, and the short stack is where it is decided: shove or fold.')),
    record.entered
      ? el('div.faint', t('{n} entered, {wins} won, {cashes} in the money. Net {net}.',
        { n: record.entered, wins: record.wins, cashes: record.cashes, net: `${record.net >= 0 ? '+' : '−'}${fmt.money(Math.abs(record.net))}` }))
      : null,
    el('div.stop-actions',
      el('button.btn.primary.plank', {
        disabled: !canEnter,
        onclick: () => { audio.sfx('chips'); go('play', { mode: 'regatta', at: venue.key }); },
      }, icon('anchor', { size: 16 }), t('Enter the Regatta — {money}', { money: fmt.money(venue.entry) })),
      enterInPearls,
      canEnter ? null : el('span.faint', t('The entry is {cost} and you have {have}.', { cost: fmt.money(venue.entry), have: fmt.money(state.bankroll) })),
    ),
  );
}

/**
 * The card room the table stands in: for sale once the table is yours, and
 * then paying you the house's cut on every hand you are dealt at it.
 */
function roomBlock(venue, profile, go) {
  const owned = ownsRoom(profile, venue.key);
  const per100 = Math.round(100 * ROOM_CUT * venue.stake.bb * 100) / 100;
  const count = roomsOwned(profile);
  return el(`div.panel.room-block${owned ? '.owned' : ''}`,
    el('div.panel-title', el('h3', icon('anchor', { size: 16 }), ' ', t('The card room')),
      el('span.faint', t('{n} of {total} card rooms are yours', { n: count, total: VENUES.length }))),
    owned
      ? el('p', t('{place} is your room. The house\'s cut is yours: {cut} for every hundred hands you are dealt at its tables. It has paid you {money} so far.',
        { place: t(venue.name), cut: fmt.money(per100), money: fmt.money(roomIncome(profile, venue.key)) }))
      : el('p.muted', t('Buy the house the table stands in, and the house\'s cut is yours: {cut} for every hundred hands you are dealt at its tables, paid when you cash out. Own all {total}, and every table there is pays you.',
        { cut: fmt.money(per100), total: VENUES.length })),
    count === VENUES.length ? el('p.room-crown', t('Every card room on the river and the sea is yours.')) : null,
    el('div.stop-actions', buyControl(profile, roomKey(venue.key), {
      go, label: t('Buy the room'), onBought: () => go('stop', { at: venue.key, bought: Date.now() }),
    })),
  );
}

/**
 * The backwater that leaves the river here. Before you know of it, once you
 * have played a little at this table, the owner tells you what is up there;
 * after, the way to it.
 */
function backwaterBlock(venue, profile, go) {
  const town = BACKWATERS.find((b) => b.junction === venue.key);
  if (!town) return null;
  const rumour = rumourAt(profile, venue.key);
  const boss = bossFor(venue.boss);
  if (rumour) {
    return el('div.panel.paper.rumour-card',
      el('div.rumour-head',
        svgNode(portraitSvg(boss.key, { size: 56 }), 'rumour-portrait'),
        el('div',
          el('div.story-kicker', icon('river', { size: 14 }), t('{name} leans over', { name: boss.short })),
          el('p.story-text', `“${t(town.rumour)}”`),
        ),
      ),
      el('div.stop-actions',
        el('button.btn.primary.plank', {
          onclick: () => {
            audio.sfx('click');
            hear(profile, town.key);
            toast({ icon: '🗺', title: t('{place} is on your chart', { place: t(town.name) }), desc: t(town.where) });
            go('town', { at: town.key });
          },
        }, icon('river', { size: 16 }), t('Mark {place} on your chart', { place: t(town.name) })),
      ),
    );
  }
  if (!heardOf(profile, town.key)) return null;
  const done = townGoals(profile, town).filter((g) => g.done).length;
  return el('button.panel.stop-notes.backwater-link', { onclick: () => go('town', { at: town.key }) },
    svgNode(portraitSvg(town.local.key, { size: 48 }), 'stop-notes-face'),
    el('span.stop-notes-text',
      el('span.stop-notes-title', town.way === 'water' ? t('Up the creek: {place}', { place: t(town.name) }) : t('Up the wagon road: {place}', { place: t(town.name) })),
      el('span.faint', t('{name}\'s game, at these stakes. {n} of 3 done.', { name: town.local.short, n: done })),
    ),
    icon('arrowRight', { size: 16, className: 'door-arrow' }),
  );
}

/** What you took from this table, if you took it. */
function keepsakeBlock(venue, state) {
  if (!state.beaten.has(venue.index)) return null;
  const boss = bossFor(venue.boss);
  return el('div.panel.keepsake-block',
    el('span.keepsake.have.big', icon(`k-${boss.keepsake.key}`, { size: 30 })),
    el('div',
      el('div.here-kicker', t('Taken from {name}', { name: boss.short })),
      el('div.boat-name', t(boss.keepsake.name)),
    ),
  );
}

/**
 * The moment a table is taken: the boss's last word, and what they hand
 * over. Shown once, on the way back from the table, with the brass.
 */
function tookIt(venue, close, purse = 0) {
  const boss = bossFor(venue.boss);
  return el('div.took-scrim', { onclick: close },
    el('div.took.paper', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': t('You took {room}', { room: t(venue.name) }),
      onclick: (e) => e.stopPropagation(),
    },
      el('div.took-kicker', t('You took the table at')),
      el('h2.sign', t(venue.name)),
      svgNode(portraitSvg(boss.key, { size: 112 }), 'took-portrait'),
      el('p.said', `“${t(boss.beaten)}”`),
      el('div.took-keepsake',
        el('span.keepsake.have.big', icon(`k-${boss.keepsake.key}`, { size: 34 })),
        el('div.boat-name', t(boss.keepsake.name)),
      ),
      el('div.took-pearls', pearls(EARN.tableTaken), el('span', t('in pearls, for taking the table'))),
      purse > 0 && VENUES[venue.index + 1]
        ? el('p.took-purse', t('{boss} hands over a purse: {money}, enough for a seat at {next}.',
          { boss: boss.short, money: fmt.money(purse), next: t(VENUES[venue.index + 1].name) }))
        : null,
      el('button.btn.primary.plank', { onclick: close }, t('Hang it in the boat')),
    ),
  );
}

/** What to do here, from the road: the same list the map shows. */
function roadBlock(venue, state, go) {
  const chapter = state.road.chapters[venue.index];
  const locked = venue.index > state.road.current;
  const next = state.road.next && state.road.next.chapter === venue.index ? state.road.next : null;
  return el('div.panel.page.paper.road-panel.road-stop',
    el('div.panel-title', el('h3', icon('river', { size: 16 }), t('What to do at {place}', { place: t(venue.name) }))),
    el('div.faint.road-sub', chapter.complete
      ? t('Finished.')
      : locked
        ? t('Opens when {place} is finished.', { place: t(gatedBy(venue.index).name) })
        : t('{done} of {total} done. Any order, but the first undone one is the best place to start.', { done: chapter.done, total: chapter.total })),
    roadList(chapter, { next, go, interactive: !locked }),
    !chapter.complete ? el('p.faint.road-opens', opensLine(chapter)) : null,
  );
}

/** The next stops up and down the river. */
function neighbours(venue, go) {
  const up = VENUES[venue.index - 1];
  const down = VENUES[venue.index + 1];
  return el('div.river-nav',
    up ? el('button.btn.ghost.sm', { onclick: () => go('stop', { at: up.key }) },
      icon('arrowLeft', { size: 14 }), t('Upriver: {place}', { place: t(up.name) })) : el('span'),
    el('button.btn.ghost.sm', { onclick: () => go('home') }, icon('river', { size: 14 }), t('The map')),
    down ? el('button.btn.ghost.sm', { onclick: () => go('stop', { at: down.key }) },
      t('Downriver: {place}', { place: t(down.name) }), icon('arrowRight', { size: 14 })) : el('span'),
  );
}

/**
 * Straight after cashing out: what the sitting paid in pearls, and Silas's
 * notes, folded, one tap away. The boss has had their say above; this is
 * the quieter voice.
 */
export function notesCard(report, index, go) {
  return el('button.panel.stop-notes', { onclick: () => go('report', { i: index }) },
    svgNode(portraitSvg(MENTOR.key, { size: 48 }), 'stop-notes-face'),
    el('span.stop-notes-text',
      el('span.stop-notes-title', t('Silas has notes on that session')),
      el('span.faint', t('{hands} hands. Open them when you are ready.', { hands: report.hands })),
    ),
    el('span.stop-notes-pearls', pearls(report.pearls.total)),
    icon('arrowRight', { size: 16, className: 'door-arrow' }),
  );
}

export function renderStop(ctx, params = {}) {
  const { profile, go } = ctx;
  const venue = venueFor(params.at || profile.career.venue);
  const state = riverState(profile);
  const arrived = params.arrived === '1' && venue.index === state.here.index;
  const after = ['took', 'up', 'down', 'even'].includes(params.after) ? params.after : null;

  if (arrived) {
    // The whistle blew as you cast off; the bell is you tying up.
    setTimeout(() => audio.sfx('bell'), 1400);
  }

  const reports = reportsOf(profile);
  const notesIndex = params.notes != null && reports[Number(params.notes)] ? Number(params.notes) : null;

  // Where you are, the first time: what the place is like. Marked read as it
  // is shown, so it is told once and left on the page for this visit.
  const arrivalKey = `arrive-${venue.key}`;
  const showArrival = venue.index === state.here.index && !state.town && !after && !profile.seenScene(arrivalKey);
  if (showArrival) profile.markScene(arrivalKey);

  const screen = el('div.screen.stop-screen',
    scene(venue, state, arrived),
    showArrival ? arrivalCard(venue) : null,
    bossBlock(venue, state, after),
    notesIndex !== null ? notesCard(reports[notesIndex], notesIndex, go) : null,
    el('div.stop-grid',
      tableBlock(venue, state, profile, go),
      keepsakeBlock(venue, state),
    ),
    rivalBlock(venue, profile),
    wandererBlock(venue, profile),
    duelBlock(venue, state, profile, go),
    roomBlock(venue, profile, go),
    regattaBlock(venue, state, profile, go),
    backwaterBlock(venue, profile, go),
    roadBlock(venue, state, go),
    neighbours(venue, go),
  );

  if (after === 'took') {
    // Hung off the page rather than the screen, so nothing the screen is
    // doing (its entrance animation makes a stacking context) can put the
    // dock or the rail above it.
    const close = () => {
      overlay.remove();
      // Once is the celebration; a reload should not throw it again.
      history.replaceState(null, '', `#stop?at=${venue.key}`);
    };
    const overlay = tookIt(venue, close, Number(params.purse) || 0);
    document.body.appendChild(overlay);
    ctx.onLeave = () => overlay.remove();
    setTimeout(() => audio.sfx('fanfare'), 300);
  }
  return screen;
}
