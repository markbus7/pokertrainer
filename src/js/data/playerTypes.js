/**
 * What kind of player you are.
 *
 * Every player on the river is one of six styles, and the drills teach you to
 * name them from two numbers: how many hands they play (VPIP) and how often
 * they raise when they do. The same two numbers name you. This is the list of
 * what they can say, written to the reader rather than about an opponent —
 * what it means, what it is good for, what it leaks — and which of the
 * river's regulars plays the same way, so there is a face to it.
 *
 * The boundaries are the ones a 6-max HUD reads by: under 15% of hands is a
 * nit; 15–28% is a tight game; 28–45% a loose one; past 45% wild. Raising at
 * least half the hands you play is aggressive; less is passive. They are
 * checked against the bots (see REGULARS): each of the river's six styles
 * lands in its own box.
 */

/**
 * Where the river's six regulars actually sit, measured: 3,000 hands of the
 * six bots at one table (tools/measure-styles.mjs), VPIP and PFR as shares of
 * every hand dealt. The style map draws them, so the reader can see who they
 * play like; rerun the tool after changing a bot.
 */
export const REGULARS = [
  { key: 'rock', name: 'Rocky', vpip: 0.085, pfr: 0.058 },
  { key: 'tag', name: 'Tessa', vpip: 0.206, pfr: 0.176 },
  { key: 'pro', name: 'Nova', vpip: 0.235, pfr: 0.21 },
  { key: 'lag', name: 'Leo', vpip: 0.304, pfr: 0.268 },
  { key: 'maniac', name: 'Max', vpip: 0.505, pfr: 0.492 },
  { key: 'station', name: 'Stan', vpip: 0.486, pfr: 0.043 },
];

/** The lines the map is cut along. */
export const BOUNDS = { nit: 0.15, tight: 0.28, loose: 0.45, aggressive: 0.5 };

/**
 * The types. `like` is the regular who plays the same way. `next` is the
 * chapter that moves you on from here.
 */
export const PLAYER_TYPES = {
  rookie: {
    key: 'rookie',
    tag: '?',
    name: 'Still finding out',
    epithet: 'the Newcomer',
    like: null,
    you: 'Thirty hands at a full table and there is a style to read. Until then, nobody at the table knows what you are — including you.',
    good: 'Nobody has a read on you yet.',
    watch: 'Play your hands, not your mood: the first habits are the ones that stick.',
    next: 'preflop',
  },
  nit: {
    key: 'nit',
    tag: 'NIT',
    name: 'The Nit',
    epithet: 'the Patient',
    like: 'rock',
    you: 'You play very few hands, and when you play, you mean it. It is the safest way to sit at a table and the slowest way to win at one.',
    good: 'You almost never start a hand behind. Your bets get respect.',
    watch: 'The table notices. When you raise, everybody folds, and when you have the nuts nobody pays you. The blinds are eating you.',
    next: 'position',
  },
  rock: {
    key: 'rock',
    tag: 'T-P',
    name: 'Tight and passive',
    epithet: 'the Wall',
    // None of the river's six plays tight and passive: Rocky raises what little he plays.
    like: null,
    you: 'You pick your hands well, but then you call with them. A tight player who checks and calls lets everybody else decide how big the pot is.',
    good: 'Your starting hands are sound, and you rarely get bluffed off them.',
    watch: 'Calling wins only at showdown; raising wins when they fold too. Raise the hands you play.',
    next: 'cbet',
  },
  tag: {
    key: 'tag',
    tag: 'TAG',
    name: 'Tight-aggressive',
    epithet: 'the Hunter',
    like: 'tag',
    you: 'You play few hands and play them hard: the standard winning style at a small-stakes table. Good players start here.',
    good: 'You take the initiative, so you win pots without a showdown, and you are rarely dominated.',
    watch: 'Strong regulars can steal from you when you give up. Defend your blinds, and keep firing on the boards that suit you.',
    next: 'mdf',
  },
  reg: {
    key: 'reg',
    tag: 'REG',
    name: 'Solid regular',
    epithet: 'the Professional',
    like: 'pro',
    you: 'Tight, aggressive, and making sound decisions across hundreds of hands: you play the charts and you play them well. This is what a winning regular looks like.',
    good: 'There is no single leak in your game for anybody to attack.',
    watch: 'The edges left are small: table selection, thin value, and adapting to who is in front of you.',
    next: 'exploit',
  },
  lag: {
    key: 'lag',
    tag: 'LAG',
    name: 'Loose-aggressive',
    epithet: 'the Pirate',
    like: 'lag',
    you: 'You play a lot of hands and you play them fast. In good hands it is the most profitable style there is; in the wrong spots, the most expensive.',
    good: 'You are hard to read and hard to play against. You win a lot of small pots.',
    watch: 'Out of position and against calling stations, aggression burns money. Tighten up from the early seats.',
    next: 'position',
  },
  station: {
    key: 'station',
    tag: 'STA',
    name: 'Calling station',
    epithet: 'the Curious',
    like: 'station',
    you: 'You play a lot of hands and you call with them. It is the most common way to lose money at poker, and the easiest one to fix.',
    good: 'Nobody bluffs you off a hand.',
    watch: 'Every call needs the price: if the equity is not there, curiosity is the most expensive thing at the table.',
    next: 'pot-odds',
  },
  maniac: {
    key: 'maniac',
    tag: 'MAN',
    name: 'Maniac',
    epithet: 'the Storm',
    like: 'maniac',
    you: 'You raise almost everything. It wins pots against timid players and a fortune for anybody patient enough to wait for a hand.',
    good: 'Nobody at the table wants to play a pot with you.',
    watch: 'Good players simply wait and call you down. Fold the bottom half of your hands, and bluff the players who can fold.',
    next: 'preflop',
  },
};

/**
 * Name the player from their numbers.
 *
 * @param {{vpip:number|null, pfr:number|null, hands:number}} style
 * @param {{sound?:number|null, winRate?:number|null, hands?:number}} [form]
 *        sound decisions and results, which decide whether a tight-aggressive
 *        player is a solid regular yet
 * @returns {object} one of PLAYER_TYPES
 */
export function playerType(style, form = {}) {
  if (!style || style.vpip === null || style.vpip === undefined || style.pfr === null || style.pfr === undefined) {
    return PLAYER_TYPES.rookie;
  }
  const { vpip, pfr } = style;
  const raising = vpip > 0 ? pfr / vpip : 0;
  const aggressive = raising >= BOUNDS.aggressive;
  if (vpip < BOUNDS.nit) return PLAYER_TYPES.nit;
  if (vpip < BOUNDS.tight) {
    if (!aggressive) return PLAYER_TYPES.rock;
    const solid = (form.sound ?? 0) >= 0.9 && (form.hands ?? 0) >= 300 && (form.winRate ?? -1) >= 0;
    return solid ? PLAYER_TYPES.reg : PLAYER_TYPES.tag;
  }
  if (vpip < BOUNDS.loose) return aggressive ? PLAYER_TYPES.lag : PLAYER_TYPES.station;
  return aggressive ? PLAYER_TYPES.maniac : PLAYER_TYPES.station;
}

/**
 * Where a winning 6-max regular sits on each number, for the gauges: the
 * band, and the scale it is drawn on.
 */
export const HEALTHY = {
  vpip: { lo: 0.2, hi: 0.28, max: 0.6, pct: true },
  pfr: { lo: 0.15, hi: 0.24, max: 0.5, pct: true },
  threeBet: { lo: 0.05, hi: 0.11, max: 0.25, pct: true },
  af: { lo: 2, hi: 4, max: 6, pct: false },
  wtsd: { lo: 0.22, hi: 0.3, max: 0.5, pct: true },
  wsd: { lo: 0.48, hi: 0.58, max: 1, pct: true },
};
