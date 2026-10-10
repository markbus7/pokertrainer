/**
 * The backwaters: towns off the river.
 *
 * The river was a line. Thirteen tables in a row, the road saying which one
 * was next, nothing to choose and nothing to find — the reader's word was
 * that the map was easily played out. So there is country off the main water
 * now: a mining camp up a wagon road, a fishing village deep in the bayou, a
 * chapel town up the Black River. None of them is on the road and none of them
 * is needed to finish; each is worth the trip for what it teaches.
 *
 * Every one is a single kind of player, turned all the way up — the whole town
 * plays like that — so the lesson lands the way it does not at a table with
 * one of everything:
 *
 *   Placer Gulch   calling stations   value bet everything, never bluff
 *   Cypress Bayou  maniacs            tighten up and call them down
 *   Bethel         rocks              steal their blinds, fold to their bets
 *
 * They are found, not listed. Each starts as uncharted water on the chart, and
 * somebody at the stop it leaves the river from tells you what is up there
 * once you have played a little at their table. A town plays at that stop's
 * stakes, with its seat price, and has three things to do in it; do all three
 * and the town gives you something to remember it by.
 *
 * Only the shape lives here: state/backwaters.js reads it against a profile.
 */

/**
 * @typedef {object} Local
 * @property {string} key    portrait key
 * @property {string} name
 * @property {string} short
 * @property {string} title
 * @property {string} plays  the style they play (a key into the bot profiles)
 */

/**
 * @typedef {object} Backwater
 * @property {string} key
 * @property {string} name
 * @property {string} where      one line under the name
 * @property {string} junction   the stop it leaves the river from: its stakes and seat price
 * @property {'water'|'road'} way  how you get there, which is how the chart draws it
 * @property {string} landmark   the drawing (ui/riverArt.js)
 * @property {string[]} lineup   the five others at the table, the local first
 * @property {Array<string|null>} folk  their names, seat for seat (the local's is their own)
 * @property {Local} local
 * @property {{hands:number, up:number, sound:number, soundHands:number}} goals
 * @property {{key:string, name:string}} trophy
 */

/** @type {Backwater[]} */
export const BACKWATERS = [
  {
    key: 'gulch',
    name: 'Placer Gulch',
    where: 'A mining camp in the hills, up the wagon road from Fisher\'s Rest',
    junction: 'nl5',
    way: 'road',
    landmark: 'diggings',
    lineup: ['station', 'station', 'station', 'tag', 'station'],
    folk: [null, 'Dusty', 'Hank', 'Clara', 'Sourdough'],
    local: {
      key: 'ike',
      name: 'Big Ike Mulvaney',
      short: 'Ike',
      title: 'Struck it rich on Gold Creek',
      plays: 'station',
    },
    colour: 'Every man in the Gulch has a poke of gold dust and has never folded a hand in his life.',
    rumour: 'You want easy money? Go up the wagon road to Placer Gulch. The miners there have more gold dust than sense, and not one of them knows how to fold. Bet your good hands and they will pay you for every one.',
    arrival: 'The road climbs out of the river mist into the hills. Placer Gulch is a street of tents and a sluice, and a saloon with a plank for a bar. A big man with a gold tooth waves you over to the only table: "Sit down, friend, sit down. We do not get many strangers. We do not get many folds, either."',
    hello: 'Pull up a chair! I never fold a hand that might be good, and they all might be good.',
    read: 'Calls with any pair, any draw, any two cards that look friendly. He has not folded since the strike.',
    beat: 'Never bluff him: he will call. Bet every good hand, on every street, and bet it big. Thin value is the whole game here.',
    beaten: 'Well, I will be. You took the whole poke. Here, take a nugget to remember the Gulch by. I will dig up another.',
    goals: { hands: 50, up: 40, sound: 0.75, soundHands: 30 },
    trophy: { key: 'nugget', name: 'Big Ike\'s gold nugget' },
  },
  {
    key: 'bayou',
    name: 'Cypress Bayou',
    where: 'A fishing village on stilts, down the creek below the Racing Chute',
    junction: 'nl50',
    way: 'water',
    landmark: 'stilts',
    lineup: ['maniac', 'maniac', 'lag', 'station', 'maniac'],
    folk: [null, 'Boudreaux', 'Celestine', 'Gaston', 'Ti-Jean'],
    local: {
      key: 'odile',
      name: 'Mama Odile',
      short: 'Odile',
      title: 'Reads the cards, and bets them all',
      plays: 'maniac',
    },
    colour: 'They bet every hand in the bayou. The cards, Mama Odile says, told them to.',
    rumour: 'Below the chute a creek runs off into the cypress, and at the end of it is a village on stilts. Mama Odile keeps the game there. Every one of them bets every hand, raises every raise, and bluffs like the cards owe them. Sit tight, wait for a hand, and let them pay you.',
    arrival: 'The creek closes in under the cypress and the light goes green. Lanterns hang from the stilts, and somewhere a fiddle is playing. On the porch of the biggest house a woman in a red headscarf is turning over cards. "I saw you coming," she says. "The cards say you will lose. Sit down and find out."',
    hello: 'The cards say raise. The cards always say raise.',
    read: 'Bets and raises with anything, every street, and so does the rest of the village. Most of what they bet is nothing at all.',
    beat: 'Play fewer hands, not more. When you have a good one, check and call, and let them do the betting for you. Call down lighter than feels safe: their bets mean very little.',
    beaten: 'The cards were wrong about you. Here: a gator\'s tooth, for luck. You will not need it, I think.',
    goals: { hands: 70, up: 50, sound: 0.7, soundHands: 30 },
    trophy: { key: 'tooth', name: 'Mama Odile\'s gator tooth' },
  },
  {
    key: 'bethel',
    name: 'Bethel',
    where: 'A chapel town up the Black River, where nobody drinks and nobody gambles much',
    junction: 'nl100',
    way: 'water',
    landmark: 'chapel',
    lineup: ['rock', 'rock', 'tag', 'rock', 'rock'],
    folk: [null, 'Sister Ruth', 'Elder Hayes', 'Miss Pratt', 'Brother Caleb'],
    local: {
      key: 'pruitt',
      name: 'Deacon Amos Pruitt',
      short: 'Pruitt',
      title: 'Keeps the chapel, and the Saturday game',
      plays: 'rock',
    },
    colour: 'In Bethel they play one hand an hour, and when they bet, they have it.',
    rumour: 'Up the Black River there is a chapel town called Bethel. They play cards after service on Saturday, very quietly, and nobody plays a hand without aces or kings. Brother Josiah preaches there when he is not on the river. Take their blinds, and when one of them bets, believe him.',
    arrival: 'Bethel is a white chapel, a general store and a dozen tidy houses, and the Black River slows down to go past it. The Saturday game is in the chapel hall, under a sign that says NO SPIRITS. A thin man in a black coat sets out the chips in perfect stacks. "We play for small stakes and in good order," he says. "And we do not hurry."',
    hello: 'Patience, friend. The good hands come to those who wait.',
    read: 'Folds nearly everything, and so does all of Bethel. When one of them raises, they have a big pair or better.',
    beat: 'Steal their blinds: raise from late position with almost anything, and they will fold. But when one of them bets or raises, fold anything that is not very strong. They are not bluffing.',
    beaten: 'You took our blinds all evening, and I prayed for you the whole time. Take the hymnal. Perhaps it will teach you patience.',
    goals: { hands: 80, up: 30, sound: 0.8, soundHands: 30 },
    trophy: { key: 'hymnal', name: 'The Deacon\'s hymnal' },
  },
];

export const BACKWATER_KEYS = BACKWATERS.map((b) => b.key);
export const backwaterFor = (key) => BACKWATERS.find((b) => b.key === key) || null;

/** The hands a stop's table must have dealt you before its regulars tell you about the backwater. */
export const RUMOUR_HANDS = 10;
