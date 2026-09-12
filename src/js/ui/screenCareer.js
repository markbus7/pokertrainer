/**
 * The front door.
 *
 * What used to be here was a grid of training modules — a course with a
 * progress bar, which is what the reader meant when they said it was not a
 * game. A game has somewhere to be. So this is the building: the room you are
 * in, the regular who sits in it, the money in your pocket, and the door that
 * opens when there is enough of it.
 *
 * The lessons have not gone anywhere. They are what you go and read when the
 * room takes your money, which is the order those two things belong in.
 */

import { el, mount, fmt, toast } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { VENUES, venueFor, nextDoor, roomYouCanAfford, GRUBSTAKE } from '../data/venues.js';
import { getProfile } from '../engine/bots.js';
import { nextUp, moduleMeta } from '../data/curriculum.js';

export function renderCareer(ctx) {
  const { profile, go } = ctx;
  const bankroll = profile.data.bankroll;
  const career = profile.career;
  const here = venueFor(career.venue);
  const resident = getProfile(here.resident);
  const door = nextDoor(bankroll, here.key);
  const broke = bankroll < here.entry;

  const sitDown = () => {
    if (bankroll < here.entry) {
      return toast({
        icon: '✗',
        title: t('Not enough for a seat'),
        desc: t('A seat at {room} costs {money}.', { room: t(here.name), money: fmt.money(here.entry) }),
      });
    }
    profile.setBankroll(bankroll, here.key);
    return go('play', { mode: 'grind' });
  };

  const takeStake = () => {
    profile.stakedByTheHouse(GRUBSTAKE);
    toast({
      icon: 'chip',
      title: t('The house stakes you'),
      desc: t('{money} and a seat at the cheapest game. It is counted.', { money: fmt.money(GRUBSTAKE) }),
    });
    go('home');
  };

  return el('div.screen',
    /* ---- where you are ------------------------------------------ */
    el('div.panel.room',
      el('div.room-head',
        el('div',
          el('div.room-where', t(here.where)),
          el('h1', t(here.name)),
          el('div.room-colour', t(here.colour)),
        ),
        el('div.room-money',
          el('div.pocket', fmt.money(bankroll)),
          el('div.pocket-label', t('in your pocket')),
        ),
      ),

      el('div.room-strip',
        el('div.chip-fact', el('span.k', t('Seat')), el('span.v', fmt.money(here.entry))),
        el('div.chip-fact', el('span.k', t('Stakes')), el('span.v', here.label)),
        el('div.chip-fact', el('span.k', t('Blinds')),
          el('span.v', `${fmt.money(here.stake.bb / 2)} / ${fmt.money(here.stake.bb)}`)),
      ),

      /* The regular. A room you have to beat somebody in is a room you
         remember; a stake you merely afford is a number. */
      el('div.resident',
        el('span.style-tag.lg', resident.tag),
        el('div.resident-text',
          el('div.resident-name',
            t('{name} is here most nights.', { name: resident.name }),
            career.beaten.includes(here.key)
              ? el('span.badge.green', t('✓ taken down'))
              : null),
          el('div.faint', t(resident.tell)),
        ),
      ),

      broke
        ? el('div.notice.broke',
          el('div', { style: { fontWeight: '600' } }, t('You cannot afford a seat here.')),
          el('div.faint', { style: { margin: '4px 0 10px' } },
            t('A seat at {room} is {money} and you have {have}.',
              { room: t(here.name), money: fmt.money(here.entry), have: fmt.money(bankroll) })),
          el('div.row',
            el('button.btn.primary', { onclick: takeStake },
              t('Take {money} from the house', { money: fmt.money(GRUBSTAKE) })),
            el('button.btn.ghost', { onclick: () => go('train') }, t('Go and study instead')),
          ))
        : el('div.sit-row',
          el('button.btn.primary.lg', { onclick: sitDown },
            t('Sit down — {money}', { money: fmt.money(here.entry) })),
          el('button.btn.ghost', { onclick: () => go('train') }, t('Study first')),
        ),
    ),

    /* ---- the door ahead ------------------------------------------ */
    door
      ? el('div.panel.door-panel',
        el('div.spread',
          el('div',
            el('div.faint', t('Next door')),
            el('div.door-name', t(door.venue.name), el('span.faint', ` · ${door.venue.label}`)),
          ),
          el('div.door-need',
            door.open
              ? el('span.badge.gold', t('open'))
              : el('span.mono', t('{money} to go', { money: fmt.money(door.needed) })),
          ),
        ),
        el('div.bar', { style: { marginTop: '10px' } },
          el('span', {
            style: {
              width: `${Math.max(2, Math.min(100, Math.round((bankroll / door.venue.stake.minBankroll) * 100)))}%`,
            },
          })),
        door.open
          ? el('button.btn.block', { style: { marginTop: '12px' },
            onclick: () => { profile.enterVenue(door.venue.key, door.venue.index, here.index); go('home'); } },
          t('Walk into {room}', { room: t(door.venue.name) }))
          : null,
      )
      : null,

    /* ---- the building -------------------------------------------- */
    el('div.panel',
      el('div.panel-title', el('h3', icon('ladder', { size: 16 }), t('The building'))),
      el('div.rooms', VENUES.map((v) => roomRow(v, profile, here, go))),
    ),

    /* ---- what it has cost ---------------------------------------- */
    career.busted
      ? el('div.faint.ledger',
        career.busted === 1
          ? t('Gone broke once. The house has staked you {money}.', { money: fmt.money(career.staked) })
          : t('Gone broke {n} times. The house has staked you {money} in total.',
            { n: career.busted, money: fmt.money(career.staked) }))
      : null,

    studyNudge(profile, go),
  );
}

function roomRow(venue, profile, here, go) {
  const bankroll = profile.data.bankroll;
  const affordable = bankroll >= venue.stake.minBankroll;
  const current = venue.key === here.key;
  const beaten = profile.career.beaten.includes(venue.key);
  const resident = getProfile(venue.resident);

  return el(`button.room-row${current ? '.here' : ''}${affordable ? '' : '.shut'}`, {
    disabled: !affordable,
    onclick: () => { profile.enterVenue(venue.key, venue.index, here.index); go('home'); },
  },
    el('span.room-stake', venue.label),
    el('span.room-name', t(venue.name)),
    el('span.style-tag', resident.tag),
    el('span.room-gate',
      current ? t('you are here')
        : affordable ? t('open')
          : t('needs {money}', { money: fmt.money(venue.stake.minBankroll) })),
    beaten ? icon('check', { size: 15, className: 'room-beaten' }) : null,
  );
}

/**
 * One line pointing at the thing that would most improve the next session.
 * The training is still here; it just stopped being the front door.
 */
function studyNudge(profile, go) {
  const plan = nextUp(profile);
  if (!plan) return null;
  const meta = moduleMeta(plan.module.id);
  return el('button.study-line', { onclick: () => go('learn', { module: plan.module.id }) },
    icon(meta.icon, { size: 16 }),
    el('span', t('Between sessions: {module}', { module: t(plan.module.name) })),
    icon('arrowRight', { size: 14, className: 'door-arrow' }),
  );
}
