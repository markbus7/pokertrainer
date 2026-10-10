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
 * @property {string} [region]   which of the regions round the river it is in (ui/worldMap.js)
 * @property {boolean} [road]    a city on the road: its three goals are part of its stop's chapter,
 *   it is on the chart from the start, and nobody has to tell you about it
 */

/** @type {Backwater[]} */
export const BACKWATERS = [
  {
    key: 'gulch',
    name: 'Placer Gulch',
    region: 'diggings',
    where: 'A mining camp in the Diggings, down the wagon road from Fisher\'s Rest',
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
    region: 'bayou',
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
    region: 'high',
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

  /* ---- The regions' cities, on the road: one or two in every region ---- */
  {
    key: 'sweetwater',
    name: 'Sweetwater',
    road: true,
    region: 'prairie',
    where: 'A cattle town on the prairie, at the end of the drovers\' trail',
    junction: 'nl5',
    way: 'road',
    landmark: 'corral',
    lineup: ['lag', 'lag', 'station', 'lag', 'tag'],
    folk: [null, 'Curly', 'Mrs. Abernathy', 'Tex', 'Whit'],
    local: { key: 'dawson', name: 'Hank Dawson', short: 'Hank', title: 'Trail boss, paid off and spending it', plays: 'lag' },
    colour: 'Drovers three months on the trail, paid off this morning, and every one of them raising.',
    arrival: 'The road runs west out of the river woods and the prairie opens up, flat and gold to the edge of the sky. Sweetwater is a street of false fronts, a stockyard and a saloon with a piano nobody can play. The drovers are in from the trail with three months\' wages, and the loudest of them waves a fistful of notes at you: "Sit down, river rat. We are raising tonight."',
    hello: 'Three months of dust and beans, and now I have money. Raise!',
    read: 'Raises with a wide range and keeps betting when the flop misses him. So do the rest of the drovers, but not all of them.',
    beat: 'Play fewer hands than they do, and pick the good ones before the flop. When you have a real hand, let them keep raising into it.',
    beaten: 'Took my wages and my pride, both. Here, take my spurs: I will not be riding anywhere for a while.',
    goals: { hands: 50, up: 40, sound: 0.75, soundHands: 30 },
    trophy: { key: 'spurs', name: 'Hank Dawson\'s spurs' },
  },
  {
    key: 'timber',
    name: 'Timber Falls',
    road: true,
    region: 'high',
    where: 'A lumber camp on Silver Lake, high in the hills, at the head of Silver Creek',
    junction: 'nl10',
    way: 'water',
    landmark: 'sawmill',
    lineup: ['tag', 'tag', 'rock', 'tag', 'station'],
    folk: [null, 'Big Ole', 'Jean-Paul', 'Sven', 'Little Pete'],
    local: { key: 'mae', name: 'Mae Lindqvist', short: 'Mae', title: 'Runs the sawmill and the bunkhouse game', plays: 'tag' },
    colour: 'Careful working men who play a few hands well. Where you sit decides what you can play.',
    arrival: 'Silver Creek climbs through the pines until the hills open round a long cold lake. Timber Falls is a sawmill, a log flume and a bunkhouse, and the whine of the saw stops at six. A broad woman with sawdust in her hair counts out chips at the bunkhouse table. "We play straight up here," she says. "Mind your seat."',
    hello: 'Mind your seat at this table. The button is worth more than the cards.',
    read: 'Plays solid hands, and more of them from the button than from the front. So does nearly everyone in the bunkhouse.',
    beat: 'Play your position: open more from late, fold more from early, and when they open from the front, believe them.',
    beaten: 'You played the seat better than I did. Take my axe; you have earned a place in the bunkhouse.',
    goals: { hands: 60, up: 35, sound: 0.78, soundHands: 30 },
    trophy: { key: 'axe', name: 'Mae\'s felling axe' },
  },
  {
    key: 'copperhead',
    name: 'Copperhead',
    road: true,
    region: 'diggings',
    where: 'A copper town in the Diggings, up Gold Creek, with a smelter that never sleeps',
    junction: 'nl25',
    way: 'water',
    landmark: 'smelter',
    lineup: ['maniac', 'lag', 'station', 'maniac', 'tag'],
    folk: [null, 'Dynamite Joe', 'Widow Pike', 'Cornish Harry', 'Ah Sing'],
    local: { key: 'jessup', name: 'Colonel Jessup', short: 'Jessup', title: 'Owns the mine, the smelter and the town', plays: 'maniac' },
    colour: 'Miners who bet like they blast: all of it, all at once. They do not fold to a bet on the flop.',
    arrival: 'Up Gold Creek the hills go bare and red, and the smoke of the smelter hangs over everything. Copperhead is company houses, a company store, and a company saloon where the Colonel keeps a table for himself. He does not look up from his cards. "Bet or get out of my town," he says.',
    hello: 'Bet or get out of my town.',
    read: 'Bets every flop whether he hit it or not, and so do half his miners. They call a continuation bet with anything.',
    beat: 'Do not bet the flop just because you raised before it: with nothing, check and give up. With a good hand, check and let them bet it for you.',
    beaten: 'Nobody has taken that much out of Copperhead since the strike. Take a piece of the first ore; it is worth more than you think.',
    goals: { hands: 70, up: 45, sound: 0.72, soundHands: 30 },
    trophy: { key: 'ore', name: 'The Colonel\'s first ore' },
  },
  {
    key: 'lafitte',
    name: 'Lafitte\'s Landing',
    road: true,
    region: 'bayou',
    where: 'A smugglers\' landing on Bayou Noir, deep in the Bayou, where nobody asks questions',
    junction: 'nl50',
    way: 'water',
    landmark: 'warehouse',
    lineup: ['lag', 'pro', 'lag', 'station', 'tag'],
    folk: [null, 'Le Grand', 'Fifi', 'Old Moreau', 'Baptiste'],
    local: { key: 'celine', name: 'Céline Lafitte', short: 'Céline', title: 'Runs the landing, and everything that comes through it', plays: 'lag' },
    colour: 'Smugglers who bet at every pot they can, because most people fold. Fold too much and they take it all.',
    arrival: 'Bayou Noir winds south through the cypress until the water goes black and still. At the end of it a long warehouse sits on pilings, and boats with no names are tied along its front. Inside, a woman in a man\'s coat is dealing to a table of hard faces. "We do not get visitors," she says. "We get customers. Which are you?"',
    hello: 'Everybody folds to me eventually. Shall we see how long you last?',
    read: 'Bets and raises into every pot, and most of the time she has very little. The landing plays the same way: they push until you give up.',
    beat: 'Do not fold every hand that is not strong: defend with the hands that beat a bluff, and call her down when the price is right.',
    beaten: 'You did not fold. Most people fold. Take my compass; you will want to find your way back.',
    goals: { hands: 80, up: 40, sound: 0.75, soundHands: 30 },
    trophy: { key: 'compass', name: 'Céline\'s brass compass' },
  },
  {
    key: 'eagle',
    name: 'Eagle Rock',
    road: true,
    region: 'high',
    where: 'A mountain resort up the Black River, where the rich come to take the air',
    junction: 'nl100',
    way: 'water',
    landmark: 'lodge',
    lineup: ['pro', 'tag', 'pro', 'station', 'tag'],
    folk: [null, 'Mr. Vandermeer', 'Dr. Holloway', 'Lord Ashcombe', 'Mrs. Carrow'],
    local: { key: 'sterling', name: 'Mr. Sterling', short: 'Sterling', title: 'Owns the lodge, and plays in its card room', plays: 'pro' },
    colour: 'Good players, all of them, and one rich tourist who is not. The money at this table is in one seat.',
    arrival: 'The Black River climbs into the High Country between walls of pine, until a grand lodge appears on a rock above the water with every window lit. Eagle Rock\'s card room has a fire, a view and a table of quiet men who play very well. And Lord Ashcombe, who does not. "Welcome," says the owner, in a velvet jacket. "Do take a seat. We all came for the air."',
    hello: 'Welcome to Eagle Rock. We all came for the air, of course.',
    read: 'Plays a careful, strong game, and so do his regulars. They do not pay you off and they do not bluff much. The tourist plays every hand badly.',
    beat: 'Do not fight the regulars. Play the tourist: get into pots with him, bet your value into him, and stay out of the regulars\' way.',
    beaten: 'You found the soft seat and you never left it. Take the lodge\'s silver eagle. You know where the money is.',
    goals: { hands: 90, up: 30, sound: 0.8, soundHands: 30 },
    trophy: { key: 'eagle', name: 'The lodge\'s silver eagle' },
  },
  {
    key: 'pelican',
    name: 'Pelican Point',
    road: true,
    region: 'coast',
    where: 'A fishing port on the Coast, north of the delta, where the boats come in at dawn',
    junction: 'nl200',
    way: 'water',
    landmark: 'wharf',
    lineup: ['tag', 'station', 'maniac', 'rock', 'station'],
    folk: [null, 'Salty Ben', 'Mrs. Gull', 'One-Eye Jack', 'The Reverend'],
    local: { key: 'barnacle', name: 'Captain Barnacle', short: 'Barnacle', title: 'Oldest skipper on the Coast', plays: 'tag' },
    colour: 'A fishing table with a bit of everybody at it. The pots get big quickly, and the stacks behind them do not.',
    arrival: 'North of the delta the river country ends in dunes and a long grey beach, and Pelican Point is where the fishing boats come in. The card game is in the net loft over the wharf, and it smells of tar and salt. An old skipper with a white beard shuffles with hands like rope. "Sit down, sit down," he says. "The tide waits for nobody, and neither does this pot."',
    hello: 'The tide waits for nobody, and neither does this pot.',
    read: 'Plays solidly, but the table is a mix: a wild one, a careful one, two who call. Pots grow big fast, and then the stacks are short behind them.',
    beat: 'Think about the stacks, not just your cards: when the pot is big and the stack is small, you are committed, so decide before you put the first chip in.',
    beaten: 'You read the tide better than I do, and I have read it fifty years. Take my sextant, and do not lose it in the drink.',
    goals: { hands: 100, up: 30, sound: 0.78, soundHands: 30 },
    trophy: { key: 'sextant', name: 'Captain Barnacle\'s sextant' },
  },

  /* ---- More backwaters, found by rumour ---- */
  {
    key: 'fort',
    name: 'Fort Ransom',
    region: 'prairie',
    where: 'An army fort on the prairie, west along the old road from Mud Landing',
    junction: 'nl2',
    way: 'road',
    landmark: 'fort',
    lineup: ['maniac', 'station', 'maniac', 'station', 'lag'],
    folk: [null, 'Private Doyle', 'Corporal Haynes', 'Private Kowalski', 'The Bugler'],
    local: { key: 'mcgraw', name: 'Sergeant McGraw', short: 'McGraw', title: 'Paymaster, and he has just paid himself', plays: 'maniac' },
    colour: 'It is payday at the fort, and the soldiers have never had money before. They bet it all, and call it all.',
    rumour: 'Payday at Fort Ransom, out west along the old road. The soldiers will bet a month\'s pay on two cards, and call you with less. Go and help them with it.',
    arrival: 'The old road runs west out of Mud Landing across open prairie, until a log stockade rises out of the grass with the flag snapping over it. Inside, it is payday, and the mess hall has become a card room. A sergeant with a red face and a fat purse kicks out a chair for you. "Civilian! Sit. We are all rich today."',
    hello: 'Payday! We are all rich today, and I intend to stay that way.',
    read: 'Bets his whole pay on anything, and the privates call him with less. Nobody at this table folds once the money is in.',
    beat: 'Wait for a good hand, then bet it hard, and do not try to bluff soldiers who never fold.',
    beaten: 'At ease, civilian. You have taken the whole payroll. Take the regiment\'s badge, and tell nobody where you got it.',
    goals: { hands: 40, up: 50, sound: 0.75, soundHands: 30 },
    trophy: { key: 'badge', name: 'The regiment\'s badge' },
  },
  {
    key: 'cove',
    name: 'Smugglers\' Cove',
    region: 'coast',
    where: 'A hidden cove on an island off the Coast, where the boats with no lights come in',
    junction: 'nl500',
    way: 'water',
    landmark: 'cove',
    lineup: ['lag', 'pro', 'maniac', 'lag', 'tag'],
    folk: [null, 'The Dutchman', 'Rosa', 'Gentleman Jim', 'Mute Tom'],
    local: { key: 'kidd', name: 'Mother Kidd', short: 'Kidd', title: 'Keeps the cove, and its secrets', plays: 'lag' },
    colour: 'The hardest game on the Coast: every one of them aggressive, and every one of them good at it.',
    rumour: 'Out past the delta there is an island, and on the island there is a cove where boats with no lights come in at night. Mother Kidd keeps a game there that would frighten the Barge. If you are as good as you think you are, go and find out.',
    arrival: 'The boat slides past the delta\'s mouths and out to sea, and the island rises dark against the stars. The cove is invisible until you are inside it: a sand beach, a fire, and a table in a cave mouth with lanterns hung over it. A grey-haired woman with a pipe deals without looking at her hands. "Nobody comes here by accident," she says.',
    hello: 'Nobody comes here by accident. Sit, and let us see what brought you.',
    read: 'Raises and re-raises with a wide range, and the whole cove plays that way. They are good, and they do not give up a pot easily.',
    beat: 'Tighten up and pick your spots. When you play back, do it with hands that can stand a re-raise, and do not be the one who folds every time.',
    beaten: 'Nobody beats the cove. And yet. Take my spyglass, and keep your mouth shut about this island.',
    goals: { hands: 60, up: 30, sound: 0.8, soundHands: 30 },
    trophy: { key: 'skull', name: 'Mother Kidd\'s carved skull' },
  },
];

export const BACKWATER_KEYS = BACKWATERS.map((b) => b.key);
export const backwaterFor = (key) => BACKWATERS.find((b) => b.key === key) || null;
/** The cities on the road, and the towns you have to be told about. */
export const ROAD_TOWNS = BACKWATERS.filter((b) => b.road);
export const roadTownAt = (stopKey) => ROAD_TOWNS.find((b) => b.junction === stopKey) || null;

/** The hands a stop's table must have dealt you before its regulars tell you about the backwater. */
export const RUMOUR_HANDS = 10;
