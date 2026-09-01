/**
 * Dutch. Keys are the exact English source strings.
 *
 * ONE DELIBERATE RULE: poker vocabulary stays English. A Dutch player at a
 * real table, and every online room, says "pot odds", "outs", "flush draw",
 * "raise", "fold", "all-in" — so translating those to "potkansen" or
 * "uitkomsten" would teach words nobody uses and make the vocabulary
 * useless where it is meant to be spent. The explanation around the term is
 * Dutch; the term itself is not.
 */

export const NL = {
  /* ---------------------------------------------------------------- *
   * Navigation and common chrome
   * ---------------------------------------------------------------- */
  'Train': 'Leren',
  'Play': 'Spelen',
  'Lab': 'Lab',
  'Gauntlet': 'Gauntlet',
  'Bankroll': 'Bankroll',
  'Charts': 'Charts',
  'Glossary': 'Woordenlijst',
  'Progress': 'Voortgang',
  'Language': 'Taal',

  'Dashboard': 'Overzicht',
  'Lesson': 'Les',
  'Guided lesson': 'Begeleide les',
  'Drill': 'Oefening',
  'The Lab': 'Het Lab',
  'Table': 'Tafel',
  'Ranks': 'Rangen',

  'Back to dashboard': 'Terug naar overzicht',
  'Something went wrong': 'Er ging iets mis',
  'That screen failed to load. The error is in the console.':
    'Dat scherm kon niet laden. De fout staat in de console.',
  'Next question →': 'Volgende vraag →',
  'Next →': 'Volgende →',
  '← Previous': '← Vorige',
  'Exit lesson': 'Les afsluiten',
  'Teach me this': 'Leer me dit',
  'Start drilling': 'Begin met oefenen',
  'End session': 'Sessie beëindigen',
  'Keep practising': 'Blijf oefenen',
  'Go to the lessons': 'Naar de lessen',
  'See every skill': 'Bekijk alle vaardigheden',
  'Check for updates': 'Controleer op updates',
  'Reset progress': 'Voortgang wissen',
  'Correct': 'Goed',
  'Not quite': 'Net niet',
  'Check yourself': 'Test jezelf',
  'not started': 'nog niet begonnen',
  'Locked': 'Vergrendeld',
  'Next': 'Volgende',
  '✓ Earned': '✓ Behaald',
  'Reached before': 'Eerder behaald',

  /* ---------------------------------------------------------------- *
   * Curriculum: module names and taglines
   *
   * The module names stay recognisably English where the term is the one
   * used at a real table — "Pot Odds", "Preflop Ranges" — because that is
   * the vocabulary this is teaching you to use.
   * ---------------------------------------------------------------- */
  'Hand Rankings': 'Handvolgorde',
  'What beats what, instantly.': 'Wat wint van wat, meteen.',
  'Pot Odds': 'Pot Odds',
  'The price the pot is offering you.': 'De prijs die de pot je biedt.',
  'Outs & Equity': 'Outs & Equity',
  'Counting the cards that save you.': 'De kaarten tellen die je redden.',
  'Preflop Ranges': 'Preflop Ranges',
  'The only street you can memorise.': 'De enige street die je uit je hoofd kunt leren.',
  'Position': 'Positie',
  'Acting last is worth more than good cards.': 'Als laatste handelen is meer waard dan goede kaarten.',
  'Continuation Betting': 'Continuation Betting',
  'Keeping the lead after the flop.': 'De leiding houden na de flop.',
  'Defence Frequency': 'Verdedigingsfrequentie',
  'Folding too much is its own leak.': 'Te veel folden is op zichzelf al een lek.',
  'Bluffing & Balance': 'Bluffen & Balans',
  'Making your bluffs pay for themselves.': 'Je bluffs zichzelf laten terugverdienen.',
  'Stack Depth': 'Stackdiepte',
  'Plan the hand before you enter it.': 'Plan de hand voordat je meedoet.',
  'Reading Players': 'Spelers Lezen',
  'Where the real money is.': 'Waar het echte geld zit.',
  'Tournament ICM': 'Toernooi ICM',
  'Chips are not money.': 'Chips zijn geen geld.',
  'Bankroll & The Business': 'Bankroll & De Zakelijke Kant',
  'How winning players stay solvent.': 'Hoe winnende spelers solvabel blijven.',
  /* ---------------------------------------------------------------- *
   * Glossary
   *
   * Term names stay English — "flush draw", "gutshot", "pot odds" are what
   * gets said at the table and typed in chat. What changes is everything
   * around them.
   * ---------------------------------------------------------------- */
  'A card that would put you in front.': 'Een kaart die je op voorsprong zet.',
  'Any card still to come that turns your losing hand into a winning one. If you hold two hearts and two more are on the board, every remaining heart is an out, because it completes your flush.':
    'Elke kaart die nog moet komen en je verliezende hand in een winnende verandert. Heb je twee harten en liggen er nog twee op het bord, dan is elke overgebleven hart een out, want die maakt je flush af.',
  'The cards that would put you in front.': 'De kaarten die je op voorsprong zetten.',
  'The count of cards still unseen that would win you the hand. Nine for a flush draw, eight for an open-ended straight draw, four for a gutshot. Multiply by 4 on the flop, or 2 on the turn, to turn that count into a rough percentage.':
    'Het aantal nog ongeziene kaarten waarmee je de hand wint. Negen bij een flush draw, acht bij een open-ended straight draw, vier bij een gutshot. Vermenigvuldig met 4 op de flop, of met 2 op de turn, om dat aantal in een ruw percentage om te zetten.',
  'Four to a flush — one more of that suit wins it.': 'Vier naar een flush — nog één van die kleur wint hem.',
  'You have four cards of the same suit and need a fifth. There are 13 of each suit, you can see four of them, so nine remain: nine outs. On the flop that is roughly 36% to get there by the river.':
    'Je hebt vier kaarten van dezelfde kleur en hebt een vijfde nodig. Er zijn er 13 van elke kleur, vier daarvan zie je, dus blijven er negen over: negen outs. Op de flop is dat ongeveer 36% om hem te maken tegen de river.',
  'A straight missing one card in the middle. Four outs.': 'Een straight waar één kaart in het midden aan ontbreekt. Vier outs.',
  'Also called an inside straight draw. You need one specific rank to fill a hole in the middle of your run — holding 9-8 on a 6-5 board, only a 7 completes 9-8-7-6-5. Four cards of that rank exist, so four outs, which is about 16% by the river. Half as good as an open-ended draw.':
    'Ook wel een inside straight draw genoemd. Je hebt één specifieke waarde nodig om een gat midden in je reeks te vullen — met 9-8 op een bord van 6-5 maakt alleen een 7 de 9-8-7-6-5 af. Van die waarde bestaan vier kaarten, dus vier outs, wat neerkomt op ongeveer 16% tegen de river. Half zo goed als een open-ended draw.',
  'Four in a row — either end completes it. Eight outs.': 'Vier op een rij — beide uiteinden maken hem af. Acht outs.',
  'You have four consecutive cards and a card at either end makes the straight. Holding 9-8 on a 7-6 board, any ten or any five gets there — four of each, so eight outs, about 32% by the river.':
    'Je hebt vier opeenvolgende kaarten en een kaart aan beide uiteinden maakt de straight. Met 9-8 op een bord van 7-6 helpt elke tien en elke vijf — vier van elk, dus acht outs, ongeveer 32% tegen de river.',
  'How often your hand wins. A fact about your cards.': 'Hoe vaak je hand wint. Een feit over je kaarten.',
  'Your share of the pot: how often this hand would win if the situation were played out again and again. A hand that wins three times in four has 75% equity. It describes your cards — which is what makes it comparable against the price the pot is offering.':
    'Jouw aandeel in de pot: hoe vaak deze hand zou winnen als de situatie keer op keer werd uitgespeeld. Een hand die drie van de vier keer wint heeft 75% equity. Het beschrijft je kaarten — en juist daardoor kun je het vergelijken met de prijs die de pot biedt.',
  'The price the pot is offering. A fact about the money.': 'De prijs die de pot biedt. Een feit over het geld.',
  'The equity you would need for a call to break even, worked out from the pot and the bet alone. Your call divided by the final pot. You can calculate it without ever looking at your cards.':
    'De equity die je nodig hebt om een call quitte te laten draaien, berekend uit alleen de pot en de bet. Jouw call gedeeld door de uiteindelijke pot. Je kunt het uitrekenen zonder ooit naar je kaarten te kijken.',
  'The pot': 'De pot',
  'Every chip already bet, including the bet you are facing.': 'Elke chip die al ingezet is, inclusief de bet waar je tegenover staat.',
  'All the chips wagered so far in the hand, sitting in the centre of the table. When it is your turn, it includes the bet you are currently facing — that money stopped being your opponent’s the moment they pushed it forward.':
    'Alle chips die tot nu toe in de hand zijn ingezet, midden op tafel. Als jij aan de beurt bent hoort daar ook de bet bij waar je tegenover staat — dat geld was niet langer van je tegenstander vanaf het moment dat hij het naar voren schoof.',
  'To be the first player to raise.': 'Als eerste speler raisen.',
  'Putting in the first raise when nobody before you has entered the pot. Your "opening range" is the set of hands you would do that with from a given seat — which gets wider the closer you sit to the button.':
    'De eerste raise plaatsen terwijl niemand vóór jou de pot is ingegaan. Je "opening range" is de verzameling handen waarmee je dat vanaf een bepaalde stoel doet — en die wordt ruimer naarmate je dichter bij de button zit.',
  'The re-raise: raising someone who already raised.': 'De her-raise: raisen tegen iemand die al geraised heeft.',
  'The big blind counts as the first bet, an open raise is the second, so re-raising is the third — hence 3-bet. A 3-betting range needs bluffs as well as strong hands, or observant opponents simply fold every time you do it.':
    'De big blind telt als de eerste bet, een open raise als de tweede, dus her-raisen is de derde — vandaar 3-bet. Een 3-bet range heeft naast sterke handen ook bluffs nodig, anders folden oplettende tegenstanders simpelweg elke keer dat je het doet.',
  'Both your cards are the same suit. Written "s".': 'Beide kaarten hebben dezelfde kleur. Geschreven als "s".',
  'Two cards of one suit, giving you a shot at a flush. Written with an s, so AKs is ace-king of the same suit. It is worth only two or three points of extra equity, but it is free, and it turns hands that would otherwise be folds into playable ones.':
    'Twee kaarten van dezelfde kleur, waarmee je kans maakt op een flush. Geschreven met een s, dus AKs is aas-heer van dezelfde kleur. Het levert maar twee of drie punten extra equity op, maar het is gratis, en het maakt speelbare handen van wat anders folds zouden zijn.',
  'Your two cards are different suits. Written "o".': 'Je twee kaarten hebben verschillende kleuren. Geschreven als "o".',
  'Two cards of different suits, so no flush is possible from them alone. Written with an o, so AKo is ace-king of mixed suits. There are three times as many offsuit combinations of a given pair of ranks as suited ones.':
    'Twee kaarten van verschillende kleuren, dus daar alleen kan geen flush uit komen. Geschreven met een o, dus AKo is aas-heer in gemengde kleuren. Van een gegeven paar waarden zijn er drie keer zoveel offsuit combinaties als suited.',
  'One specific two-card holding, of the 1,326 possible.': 'Eén specifieke tweekaartshand, van de 1.326 mogelijke.',
  'A single exact hand, like the ace of spades with the king of hearts. Any pair of ranks has 6 combos if paired, 4 if suited, and 12 if offsuit. Range percentages count combos, not grid squares, which is why an offsuit square is worth three times a suited one.':
    'Eén exacte hand, zoals schoppenaas met hartenheer. Elk paar waarden heeft 6 combos als het een pair is, 4 als suited en 12 als offsuit. Range-percentages tellen combos, geen vakjes in het raster — daarom is een offsuit vakje drie keer zoveel waard als een suited vakje.',
  'Just calling the big blind instead of raising.': 'Alleen de big blind callen in plaats van raisen.',
  'Entering the pot for the minimum rather than raising. It surrenders the initiative, invites everyone in cheaply, and tells observant opponents you do not hold a premium. Raise or fold instead.':
    'Voor het minimum de pot ingaan in plaats van raisen. Je geeft het initiatief weg, nodigt iedereen goedkoop uit, en vertelt oplettende tegenstanders dat je geen premiumhand hebt. Raise of fold in plaats daarvan.',
  'Betting because worse hands will call.': 'Betten omdat slechtere handen zullen callen.',
  'A bet made to be called, not to make anyone fold. The test is simple: will a hand worse than mine pay this off? If yes, betting makes money. It is the opposite of a bluff, and against players who call too much it is nearly your whole strategy.':
    'Een bet die bedoeld is om gecalld te worden, niet om iemand te laten folden. De toets is simpel: betaalt een hand die slechter is dan de mijne dit af? Zo ja, dan verdient betten geld. Het is het tegenovergestelde van een bluff, en tegen spelers die te veel callen is het bijna je hele strategie.',
  'The value that comes from your opponent folding.': 'De waarde die ontstaat doordat je tegenstander foldt.',
  'The part of a bet’s profit that comes from simply winning the pot uncontested. A hand with no chance of winning at showdown has value only through fold equity — which is why bluffing someone who never folds is worth nothing.':
    'Het deel van de winst van een bet dat komt doordat je de pot zonder tegenstand pakt. Een hand die bij showdown geen kans maakt heeft alleen waarde via fold equity — daarom levert bluffen tegen iemand die nooit foldt niets op.',
  'A card in your hand higher than any on the board.': 'Een kaart in je hand die hoger is dan alles op het bord.',
  'Holding A-K on a 7-4-2 board gives you two overcards: pairing either one would beat anything that has paired the board. Six cards do that (three aces, three kings), which is where the "two overcards is six outs" figure comes from.':
    'Met A-K op een bord van 7-4-2 heb je twee overcards: als je er één paart, versla je alles wat het bord gepaard heeft. Zes kaarten doen dat (drie azen, drie heren) — daar komt het getal "twee overcards is zes outs" vandaan.',
  'A board of all different suits — no flush possible yet.': 'Een bord met allemaal verschillende kleuren — nog geen flush mogelijk.',
  'Three community cards of three different suits, so nobody can have a flush and nobody can even be drawing to one with two cards. The opposite of a two-tone board, and part of what makes a flop "dry".':
    'Drie gemeenschappelijke kaarten in drie verschillende kleuren, dus niemand kan een flush hebben en niemand kan er met twee kaarten zelfs naartoe trekken. Het tegenovergestelde van een two-tone bord, en een deel van wat een flop "dry" maakt.',
  'A flop that connects with very few hands.': 'Een flop die met heel weinig handen aansluit.',
  'Disconnected, usually rainbow, with no obvious straight or flush draws — A-7-2 rainbow is the classic. Very little of your opponent’s range can continue against a bet, which is why you can bet a dry board small with almost any hand.':
    'Onsamenhangend, meestal rainbow, zonder duidelijke straight- of flushdraws — A-7-2 rainbow is het klassieke voorbeeld. Heel weinig van de range van je tegenstander kan door tegen een bet, en daarom kun je op een dry bord klein betten met bijna elke hand.',
  'A flop that connects with lots of hands.': 'Een flop die met veel handen aansluit.',
  'Coordinated and full of draws — 9-8-7 with two of a suit is about as wet as it gets. Straights, flush draws and pairs all continue against a bet, so bluffing into one runs into a call far more often.':
    'Samenhangend en vol draws — 9-8-7 met twee van een kleur is ongeveer zo nat als het wordt. Straights, flush draws en pairs gaan allemaal door tegen een bet, dus bluffen op zo’n bord loopt veel vaker tegen een call aan.',
  'The chips a player has in front of them.': 'De chips die een speler voor zich heeft liggen.',
  'Everything you can bet in this hand. The "effective stack" is the smaller of yours and your opponent’s, since neither of you can win more than the shorter one — that is the number that actually matters.':
    'Alles wat je in deze hand kunt inzetten. De "effective stack" is de kleinste van die van jou en die van je tegenstander, want geen van beiden kan meer winnen dan de kortste — dat is het getal dat er werkelijk toe doet.',
  'Acting after your opponents, on every street.': 'Na je tegenstanders handelen, op elke street.',
  'Where you sit relative to the players still in the hand. Being "in position" means acting last, so you see what everyone else does before you decide. It is worth more than good cards, which is why the button is the most profitable seat.':
    'Waar je zit ten opzichte van de spelers die nog in de hand zitten. "In position" zitten betekent als laatste handelen, dus je ziet wat alle anderen doen voordat jij beslist. Het is meer waard dan goede kaarten, en daarom is de button de meest winstgevende stoel.',
  'The tie-breaking card when two hands match.': 'De beslissende kaart als twee handen gelijk zijn.',
  'When two players make the same hand, the next highest card decides it. Both hold a pair of aces? The player with the king kicker beats the one with a five. This is why A-K is a very different hand from A-5.':
    'Als twee spelers dezelfde hand maken, beslist de eerstvolgende hoogste kaart. Allebei een paar azen? De speler met de heer als kicker verslaat die met een vijf. Daarom is A-K een heel andere hand dan A-5.',
  'A bluff with a hand that can still improve.': 'Een bluff met een hand die nog kan verbeteren.',
  'Betting with a hand that is probably behind but has outs. It wins two ways: they fold now, or they call and you hit. That extra way to win is free, which makes it far more profitable than bluffing with nothing.':
    'Betten met een hand die waarschijnlijk achterligt maar outs heeft. Je wint op twee manieren: ze folden nu, of ze callen en jij raakt. Die extra manier om te winnen is gratis, en dat maakt het veel winstgevender dan bluffen met niets.',
  'A hand that beats a bluff and nothing else.': 'Een hand die een bluff verslaat en verder niets.',
  'A hand too weak to beat any value bet, but good enough to beat a total bluff. Calling with one is a pure bet on how often your opponent is bluffing.':
    'Een hand die te zwak is om een value bet te verslaan, maar goed genoeg om een complete bluff te kloppen. Callen met zo’n hand is puur een weddenschap op hoe vaak je tegenstander bluft.',
  'All the hands someone could have here.': 'Alle handen die iemand hier kan hebben.',
  'Rather than guessing one specific hand, you think about the whole set of hands an opponent would play this way. Good players think in ranges, because you can never know the single hand.':
    'In plaats van naar één specifieke hand te gissen denk je aan de hele verzameling handen die een tegenstander zo zou spelen. Goede spelers denken in ranges, omdat je die ene hand nooit kunt weten.',
  'Betting the flop after you raised preflop.': 'De flop betten nadat je preflop geraised hebt.',
  'You raised before the flop, so you represent the stronger hand. Betting again on the flop continues that story — and works often because most hands miss most flops.':
    'Je hebt vóór de flop geraised, dus je vertegenwoordigt de sterkere hand. Op de flop opnieuw betten zet dat verhaal voort — en werkt vaak, omdat de meeste handen de meeste flops missen.',
  'A betting round: preflop, flop, turn, river.': 'Een inzetronde: preflop, flop, turn, river.',
  'Each stage of the hand. Preflop is before any shared cards, then the flop (three cards), the turn (a fourth), and the river (the fifth and last). Each has its own round of betting.':
    'Elke fase van de hand. Preflop is vóór er gemeenschappelijke kaarten liggen, dan de flop (drie kaarten), de turn (een vierde) en de river (de vijfde en laatste). Elke fase heeft zijn eigen inzetronde.',
  'Revealing hands at the end to see who wins.': 'Aan het eind de handen laten zien om te zien wie wint.',
  'If two or more players are still in after the last round of betting, they show their cards and the best five-card hand takes the pot.':
    'Als er na de laatste inzetronde nog twee of meer spelers in zitten, laten ze hun kaarten zien en pakt de beste vijfkaartshand de pot.',
  'Forced bets that start the action.': 'Verplichte inzetten die de actie op gang brengen.',
  'Two players post bets before any cards are dealt — the small blind and the big blind — so there is always something to play for. They rotate each hand, so everyone pays them equally over time.':
    'Twee spelers zetten in voordat er kaarten gedeeld zijn — de small blind en de big blind — zodat er altijd iets te spelen valt. Ze schuiven elke hand door, dus op den duur betaalt iedereen ze evenveel.',
  'Stack-to-pot ratio: the stack divided by the pot.': 'Stack-to-pot ratio: de stack gedeeld door de pot.',
  'The effective stack divided by the size of the pot on the flop. It decides how committed one pair is: at an SPR of 3 top pair usually gets all the chips in, at 10 it is just one pair.':
    'De effective stack gedeeld door de grootte van de pot op de flop. Het bepaalt hoe gecommitteerd één pair is: bij een SPR van 3 gaat top pair er meestal helemaal in, bij 10 is het gewoon één pair.',
  'The share of your range you must keep defending.': 'Het deel van je range dat je moet blijven verdedigen.',
  'Minimum defence frequency: pot divided by (pot + bet). Fold more often than this and your opponent can profitably bluff with any two cards. It is a floor for safety, not a rule to follow against someone who never bluffs.':
    'Minimum defence frequency: pot gedeeld door (pot + bet). Fold je vaker dan dit, dan kan je tegenstander winstgevend bluffen met twee willekeurige kaarten. Het is een ondergrens voor de veiligheid, geen regel om te volgen tegen iemand die nooit bluft.',
  'Converting tournament chips into real prize money.': 'Toernooichips omzetten in echt prijzengeld.',
  'The Independent Chip Model. In a tournament, chips only convert into a finishing position, and prizes are fixed — so the chips you win are worth less than the chips you risk. This is why correct-for-chips calls can be wrong for money.':
    'Het Independent Chip Model. In een toernooi vertalen chips zich alleen naar een eindklassering, en de prijzen liggen vast — dus de chips die je wint zijn minder waard dan de chips die je riskeert. Daarom kan een call die voor chips juist is, voor geld fout zijn.',
  'How often a player voluntarily puts money in preflop.': 'Hoe vaak een speler preflop vrijwillig geld inlegt.',
  'Voluntarily Put money In Pot — the share of hands a player chooses to play, ignoring blinds they were forced to post. A winning 6-max regular sits around 22-27%; anyone far above that is playing too many hands.':
    'Voluntarily Put money In Pot — het aandeel handen dat een speler kiest te spelen, blinds die hij verplicht moest posten niet meegerekend. Een winnende 6-max regular zit rond de 22-27%; wie daar ver boven zit speelt te veel handen.',
  'The cut the house takes from each pot.': 'Het deel dat het huis uit elke pot neemt.',
  'Typically 5% of the pot up to a cap of a few big blinds. Because of the cap, small pots are taxed hardest in percentage terms — which is why grinding lots of tiny pots loses money even when the cards break even.':
    'Meestal 5% van de pot tot een maximum van een paar big blinds. Door dat maximum worden kleine potten procentueel het zwaarst belast — en daarom verlies je geld met het grinden van veel kleine potjes, zelfs als de kaarten quitte draaien.',
  'Sharing your best card with a better kicker.': 'Je beste kaart delen terwijl de ander een betere kicker heeft.',
  'Holding A-J against A-K: you share the ace, but their second card beats yours. Dominated hands are expensive precisely because they look strong and lose big — you hit your ace, feel great, and pay off.':
    'Met A-J tegen A-K: je deelt de aas, maar hun tweede kaart verslaat de jouwe. Dominated handen zijn juist duur omdat ze er sterk uitzien en groot verliezen — je raakt je aas, voelt je geweldig, en betaalt af.',
  'The best possible hand on this board.': 'De best mogelijke hand op dit bord.',
  'The hand that cannot be beaten given the cards showing. "Second nuts" is the next best, and is where a great deal of money is lost.':
    'De hand die niet verslagen kan worden gegeven de kaarten die er liggen. "Second nuts" is de op één na beste, en daar gaat heel veel geld verloren.',
  'Win rate: big blinds won per 100 hands.': 'Winrate: gewonnen big blinds per 100 handen.',
  'The standard measure of how well someone is doing, independent of stake. A solid small-stakes win rate is 3-8bb/100. Anyone claiming much more over a real sample is either lucky or lying.':
    'De standaardmaat voor hoe goed iemand het doet, onafhankelijk van de inzet. Een solide smallstakes winrate is 3-8bb/100. Wie over een echte steekproef veel meer claimt heeft geluk of liegt.',
  /* ---------------------------------------------------------------- *
   * Curriculum: module summaries and key points
   * ---------------------------------------------------------------- */
  'Before anything else, reading your own hand has to be automatic. Hesitating at showdown costs money and gives away information.':
    'Voor alles geldt: je eigen hand lezen moet automatisch gaan. Twijfelen bij de showdown kost geld en geeft informatie weg.',
  'The order, worst to best: high card, one pair, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush.':
    'De volgorde, van slechtst naar best: high card, one pair, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush.',
  'A flush beats a straight because flushes are rarer — 5,108 five-card flushes against 10,200 straights.':
    'Een flush verslaat een straight omdat flushes zeldzamer zijn — 5.108 vijfkaarts flushes tegenover 10.200 straights.',
  'The ace plays both high and low, so A-2-3-4-5 is a straight (the "wheel"). But it does not wrap: Q-K-A-2-3 is nothing.':
    'De aas speelt zowel hoog als laag, dus A-2-3-4-5 is een straight (de "wheel"). Maar hij loopt niet rond: Q-K-A-2-3 is niets.',
  'You always play the best five cards available. Sometimes that means the board plays and the pot is chopped.':
    'Je speelt altijd de beste vijf kaarten die beschikbaar zijn. Soms betekent dat dat het bord speelt en de pot gedeeld wordt.',
  'Kickers decide ties. A-K on an ace-high board beats A-Q, and that single card is worth a lot of money over a career.':
    'Kickers beslissen gelijke spelen. A-K op een aas-hoog bord verslaat A-Q, en die ene kaart is over een carrière veel geld waard.',
  'Every call is a bet that you will win often enough to justify the price. Pot odds turn that from a feeling into arithmetic.':
    'Elke call is een weddenschap dat je vaak genoeg wint om de prijs te rechtvaardigen. Pot odds maken daar rekenwerk van in plaats van een gevoel.',
  'Required equity = your call ÷ (the pot + your call). Worked through: the pot is 75, they bet 25 taking it to 100, you call 25, so the final pot is 125 — and 25 ÷ 125 = 20%.':
    'Benodigde equity = jouw call ÷ (de pot + jouw call). Uitgewerkt: de pot is 75, zij betten 25 waardoor hij op 100 komt, jij callt 25, dus de uiteindelijke pot is 125 — en 25 ÷ 125 = 20%.',
  'A half-pot bet asks you to be right 25% of the time. A pot-sized bet asks for 33%. An overbet asks for more.':
    'Een halve-pot bet vraagt dat je 25% van de tijd gelijk hebt. Een pot-sized bet vraagt 33%. Een overbet vraagt meer.',
  'This is why big bets are not automatically better: they need to work more often to break even.':
    'Daarom zijn grote bets niet automatisch beter: ze moeten vaker werken om quitte te draaien.',
  'Say the price out loud before every call. "I call 25 to win 125, so I need 20%." Most losing calls never get counted.':
    'Zeg de prijs hardop voor elke call. "Ik call 25 om 125 te winnen, dus ik heb 20% nodig." De meeste verliezende calls worden nooit uitgerekend.',
  'Implied odds are the extra chips you expect to win later. They justify some calls — but only against opponents who actually pay you off.':
    'Implied odds zijn de extra chips die je later verwacht te winnen. Ze rechtvaardigen sommige calls — maar alleen tegen tegenstanders die je ook echt uitbetalen.',
  'An out is a card that turns a losing hand into a winning one. Counting them fast is the most useful skill at the table.':
    'Een out is een kaart die een verliezende hand in een winnende verandert. Ze snel tellen is de nuttigste vaardigheid aan tafel.',
  'Flush draw: 9 outs. Open-ended straight draw: 8. Gutshot: 4. Overcards: 6. Set to a full house: 10.':
    'Flush draw: 9 outs. Open-ended straight draw: 8. Gutshot: 4. Overcards: 6. Set naar een full house: 10.',
  'The rule of 4 and 2: multiply outs by 4 on the flop (two cards to come) or by 2 on the turn.':
    'De regel van 4 en 2: vermenigvuldig je outs met 4 op de flop (nog twee kaarten te komen) of met 2 op de turn.',
  'That shortcut drifts high with many outs. With 15 outs the rule says 60%; the truth is 54%. Close enough to act on.':
    'Die vuistregel loopt te hoog op bij veel outs. Bij 15 outs zegt de regel 60%; in werkelijkheid is het 54%. Dichtbij genoeg om op te handelen.',
  'Not every out is clean. A card that completes your straight may also complete their flush — discount it.':
    'Niet elke out is schoon. Een kaart die jouw straight afmaakt, kan ook hun flush afmaken — trek die af.',
  'Combine outs with pot odds and the decision makes itself: 9 outs is 36% on the flop, so any bet asking for less than that is a call.':
    'Combineer outs met pot odds en de beslissing maakt zichzelf: 9 outs is 36% op de flop, dus elke bet die minder dan dat vraagt is een call.',
  'Most money is lost before the flop, by playing hands that were never profitable. Preflop is solved enough to simply learn.':
    'Het meeste geld gaat vóór de flop verloren, door handen te spelen die nooit winstgevend waren. Preflop is voldoende uitgewerkt om gewoon te leren.',
  'Open roughly 18% of hands under the gun, 25% from the cutoff, and 45% on the button. Position, not optimism, sets the width.':
    'Open ongeveer 18% van je handen under the gun, 25% vanaf de cutoff en 45% op de button. Positie bepaalt de breedte, niet optimisme.',
  'Raise or fold. Limping caps your hand strength, builds no pot with your good hands, and invites everyone in behind you.':
    'Raise of fold. Limpen zet een plafond op je handsterkte, bouwt geen pot met je goede handen, en nodigt iedereen achter je uit.',
  'A 3-betting range needs bluffs as well as value. Suited aces are ideal: they block the hands that continue and still flop well.':
    'Een 3-bet range heeft naast value ook bluffs nodig. Suited azen zijn ideaal: ze blokken de handen die doorgaan en floppen alsnog goed.',
  'Fold the hands that are dominated. A-J looks strong until an early-position raiser turns it into A-Q, A-K and aces.':
    'Fold de handen die dominated zijn. A-J lijkt sterk tot een raiser uit vroege positie er A-Q, A-K en azen van maakt.',
  'Suited beats offsuit, and connected beats scattered. 76s outperforms K3o despite the lower cards.':
    'Suited verslaat offsuit, en aaneengesloten verslaat verspreid. 76s presteert beter dan K3o, ondanks de lagere kaarten.',
  'Position means information. Acting last on every street lets you control the pot size and bluff far more accurately.':
    'Positie betekent informatie. Als laatste handelen op elke street laat je de potgrootte sturen en veel nauwkeuriger bluffen.',
  'The button is the most profitable seat in poker, and the blinds are the two losing seats for everyone.':
    'De button is de meest winstgevende stoel in poker, en de blinds zijn voor iedereen de twee verliezende stoelen.',
  'In position you can check behind for a free card, value bet thinner, and fold without ever putting in a bet.':
    'In position kun je checken voor een gratis kaart, dunner value betten, en folden zonder ooit een bet te plaatsen.',
  'Out of position you must act first with less information, which is why your continuing range has to be tighter.':
    'Out of position moet je als eerste handelen met minder informatie, en daarom moet je doorspeelrange strakker zijn.',
  'Defend the big blind wide against late-position steals — you are getting a discount — but not so wide that you are playing trash out of position.':
    'Verdedig de big blind ruim tegen steals uit late positie — je krijgt korting — maar niet zo ruim dat je met rommel out of position speelt.',
  'When choosing between two marginal spots, take the one where you act last. It is worth several big blinds per hundred hands.':
    'Moet je kiezen tussen twee marginale spots, neem dan die waarin je als laatste handelt. Dat is meerdere big blinds per honderd handen waard.',
  'You raised preflop, so you represent the strongest range. A continuation bet turns that story into chips — on the right boards.':
    'Je hebt preflop geraised, dus je vertegenwoordigt de sterkste range. Een continuation bet zet dat verhaal om in chips — op de juiste borden.',
  'Dry, disconnected, high boards (A-7-2 rainbow) favour the raiser. Bet small with your entire range; they missed too.':
    'Droge, onsamenhangende, hoge borden (A-7-2 rainbow) zijn in het voordeel van de raiser. Bet klein met je hele range; zij hebben ook gemist.',
  'Wet, connected, low boards (9-8-7 two-tone) favour the caller. Check often — too many of their hands will continue.':
    'Natte, samenhangende, lage borden (9-8-7 two-tone) zijn in het voordeel van de caller. Check vaak — te veel van hun handen gaan door.',
  'Bet big when you are ahead on a board full of draws. Making a draw pay is how you get value from being in front.':
    'Bet groot als je voorligt op een bord vol draws. Een draw laten betalen is hoe je waarde haalt uit voorliggen.',
  'A bet that folds out only worse hands and gets called by only better ones is a bet that loses money.':
    'Een bet die alleen slechtere handen wegjaagt en alleen door betere gecalld wordt, is een bet die geld verliest.',
  'If you fire the flop and turn and then check the river, you have told the whole table you missed. Plan all three streets before the first one.':
    'Als je op de flop en turn bet en dan de river checkt, heb je de hele tafel verteld dat je gemist hebt. Plan alle drie de streets voordat je de eerste speelt.',
  'If you fold too often, any two cards can profitably bluff you. Minimum defence frequency puts a floor on how much you must continue.':
    'Als je te vaak foldt, kunnen twee willekeurige kaarten winstgevend tegen je bluffen. Minimum defence frequency legt een ondergrens onder hoeveel je moet doorspelen.',
  'MDF = pot ÷ (pot + bet). Against a pot-sized bet you must continue with half your range; against a half-pot bet, two thirds.':
    'MDF = pot ÷ (pot + bet). Tegen een pot-sized bet moet je met de helft van je range doorgaan; tegen een halve-pot bet met twee derde.',
  'This is a defensive guideline, not a law. It makes you unexploitable, not maximally profitable.':
    'Dit is een defensieve richtlijn, geen wet. Het maakt je onexploiteerbaar, niet maximaal winstgevend.',
  'Against someone who never bluffs, ignore MDF entirely and over-fold. Against a maniac, defend even wider than it says.':
    'Tegen iemand die nooit bluft negeer je MDF volledig en fold je te veel. Tegen een maniak verdedig je nog ruimer dan het voorschrijft.',
  'Defend with the hands that have the most equity and the best blockers, not simply the ones that feel strong.':
    'Verdedig met de handen die de meeste equity en de beste blockers hebben, niet simpelweg met de handen die sterk voelen.',
  'The mirror image: when you bluff, your bet must work often enough to pay for itself. Bet 100 into 100 and it must work half the time.':
    'Het spiegelbeeld: als jij bluft, moet je bet vaak genoeg werken om zichzelf terug te verdienen. Bet 100 in een pot van 100 en het moet de helft van de tijd werken.',
  'A bluff is not a hope; it is a price. Balance means your value hands and bluffs arrive in a ratio that gives opponents no good answer.':
    'Een bluff is geen hoop; het is een prijs. Balans betekent dat je valuehanden en bluffs in een verhouding komen waarop tegenstanders geen goed antwoord hebben.',
  'Break-even bluff frequency = bet ÷ (bet + pot). Bigger bluffs must work more often.':
    'Break-even bluffrequentie = bet ÷ (bet + pot). Grotere bluffs moeten vaker werken.',
  'At a pot-sized bet, a balanced range is one bluff for every two value hands — 33% bluffs.':
    'Bij een pot-sized bet is een gebalanceerde range één bluff op elke twee valuehanden — 33% bluffs.',
  'Bluff with hands that have equity when called: a flush draw that misses still wins when it hits.':
    'Bluff met handen die equity hebben als je gecalld wordt: een flush draw die mist, wint alsnog als hij binnenkomt.',
  'Bluff the boards where your range makes sense. If you would not have the nuts here, neither will your story.':
    'Bluff op de borden waar jouw range logisch is. Als jij hier de nuts niet zou hebben, heeft je verhaal ze ook niet.',
  'Against weak opponents, forget balance. Value bet more and bluff less — exploitation beats theory when the opponent is exploitable.':
    'Tegen zwakke tegenstanders vergeet je balans. Value bet meer en bluf minder — exploitatie verslaat theorie zodra de tegenstander exploiteerbaar is.',
  'Stack-to-pot ratio decides whether top pair is a monster or a bluff catcher, before a single postflop chip goes in.':
    'De stack-to-pot ratio bepaalt of top pair een monster of een bluff catcher is, nog voordat er één postflop chip in gaat.',
  'SPR = effective stack ÷ pot on the flop. It is set by how the preflop pot was built.':
    'SPR = effective stack ÷ pot op de flop. Hij wordt bepaald door hoe de preflop pot is opgebouwd.',
  'SPR of 3 or less: top pair is committed. Get the chips in and stop agonising.':
    'SPR van 3 of lager: top pair is committed. Zet de chips in en stop met piekeren.',
  'SPR of 6 or more: one pair is one pair. Keep the pot small unless you improve.':
    'SPR van 6 of hoger: één pair is één pair. Houd de pot klein tenzij je verbetert.',
  'You choose your SPR preflop. A bigger 3-bet creates a low SPR that suits big pairs; a call keeps it deep, which suits suited connectors.':
    'Je kiest je SPR preflop. Een grotere 3-bet maakt een lage SPR die goed past bij grote pairs; een call houdt hem diep, wat suited connectors past.',
  'The effective stack is the smaller of the two — you can never win more than the shorter stack.':
    'De effective stack is de kleinste van de twee — je kunt nooit meer winnen dan de kortste stack.',
  'Theory keeps you safe; exploitation makes you money. Every opponent has a leak, and your job is to name it and attack it.':
    'Theorie houdt je veilig; exploitatie levert je geld op. Elke tegenstander heeft een lek, en jouw taak is het te benoemen en aan te vallen.',
  'The calling station never folds: never bluff, and value bet thinner and larger than feels comfortable.':
    'De calling station foldt nooit: bluf nooit, en value bet dunner en groter dan comfortabel voelt.',
  'The nit folds too much: steal his blinds relentlessly and believe him when he finally raises.':
    'De nit foldt te veel: steel zijn blinds onophoudelijk en geloof hem als hij eindelijk raiset.',
  'The maniac bluffs too much: stop bluffing, widen your calling range, and let him bet into your good hands.':
    'De maniak bluft te veel: stop met bluffen, maak je callrange ruimer, en laat hem in je goede handen betten.',
  'The solid regular has no obvious leak: play a simple, well-balanced game and take your edge elsewhere at the table.':
    'De solide regular heeft geen duidelijk lek: speel een simpel, goed gebalanceerd spel en haal je voordeel elders aan tafel.',
  'Watch showdowns. Every hand a player shows down tells you what they will do with that hand class next time.':
    'Let op showdowns. Elke hand die een speler laat zien vertelt je wat hij de volgende keer met dat soort hand doet.',
  'In tournaments the chips you win are worth less than the chips you lose. ICM converts stacks into actual prize money.':
    'In toernooien zijn de chips die je wint minder waard dan de chips die je verliest. ICM zet stacks om in echt prijzengeld.',
  'Doubling your stack does not double your equity — the pay jumps are shared, so the marginal chip is worth less.':
    'Je stack verdubbelen verdubbelt je equity niet — de pay jumps worden gedeeld, dus de marginale chip is minder waard.',
  'On the bubble, calls that are clearly correct for chips become clearly wrong for money.':
    'Op de bubble worden calls die voor chips duidelijk juist zijn, voor geld duidelijk fout.',
  'The big stack has enormous leverage: everyone else risks a pay jump, so they should be attacking constantly.':
    'De big stack heeft enorme hefboomwerking: alle anderen riskeren een pay jump, dus hij hoort constant aan te vallen.',
  'The short stack should shove rather than call. Fold equity is worth more than a slightly better hand.':
    'De short stack moet shoven in plaats van callen. Fold equity is meer waard dan een iets betere hand.',
  'Once the bubble bursts, ICM pressure drops sharply and the game opens back up.':
    'Zodra de bubble knapt, valt de ICM-druk sterk weg en gaat het spel weer open.',
  'Poker is a job with a very noisy paycheque. Bankroll management is what keeps a winning player from going broke anyway.':
    'Poker is een baan met een heel rommelig salaris. Bankroll management is wat voorkomt dat een winnende speler toch failliet gaat.',
  'Keep 30 to 50 buy-ins for no-limit cash games. Winning players still run 20 buy-ins below expectation.':
    'Houd 30 tot 50 buy-ins aan voor no-limit cashgames. Winnende spelers lopen alsnog 20 buy-ins onder verwachting.',
  'A realistic win rate at small stakes is 3 to 8bb/100. Anyone promising more is selling something.':
    'Een realistische winrate op small stakes is 3 tot 8bb/100. Wie meer belooft, verkoopt iets.',
  'Standard deviation is around 100bb/100. Over 10,000 hands your result can swing 30 buy-ins in either direction and mean nothing.':
    'De standaarddeviatie ligt rond 100bb/100. Over 10.000 handen kan je resultaat 30 buy-ins beide kanten op schommelen en niets betekenen.',
  'Rake is the silent killer: 5% capped means small pots are taxed hardest, so tight aggressive play beats loose passive play twice over.':
    'Rake is de stille moordenaar: 5% met een maximum betekent dat kleine potten het zwaarst belast worden, dus tight agressief spel verslaat loose passief spel dubbel.',
  'Game selection outweighs skill. One loose player at the table is worth more than any strategy adjustment you can make.':
    'Tafelkeuze weegt zwaarder dan vaardigheid. Eén loose speler aan tafel is meer waard dan elke strategische aanpassing die je kunt maken.',
  /* ---------------------------------------------------------------- *
   * Lesson: Hand Rankings
   * ---------------------------------------------------------------- */
  'The goal here is not to recite the list. It is to look at five cards and know instantly what you have, without pausing.':
    'Het doel is hier niet om het lijstje op te dreunen. Het doel is naar vijf kaarten kijken en meteen weten wat je hebt, zonder te haperen.',
  'The order is not arbitrary — it is rarity': 'De volgorde is niet willekeurig — het is zeldzaamheid',
  'Hands are ranked by how hard they are to make. That is the whole logic, and once you see the numbers you never have to memorise the order again.':
    'Handen zijn gerangschikt naar hoe moeilijk ze te maken zijn. Dat is de hele logica, en zodra je de getallen ziet hoef je de volgorde nooit meer uit je hoofd te leren.',
  'Out of all 2,598,960 possible five-card hands, here is how many produce each result. The rarer it is, the more it beats.':
    'Van alle 2.598.960 mogelijke vijfkaartshanden zie je hier hoeveel er elk resultaat opleveren. Hoe zeldzamer, hoe meer hij verslaat.',
  'This answers the question most beginners get stuck on: **why does a flush beat a straight?** Because there are 10,200 straights and only 5,108 flushes. Flushes are roughly twice as hard to make, so they win.':
    'Dit beantwoordt de vraag waar de meeste beginners op vastlopen: **waarom verslaat een flush een straight?** Omdat er 10.200 straights zijn en maar 5.108 flushes. Flushes zijn ongeveer twee keer zo moeilijk te maken, dus ze winnen.',
  'Hand': 'Hand',
  'How many exist': 'Hoeveel er bestaan',
  'Roughly': 'Ongeveer',
  '1 in 65,000': '1 op 65.000',
  '1 in 4,000': '1 op 4.000',
  '1 in 700': '1 op 700',
  '1 in 500': '1 op 500',
  '1 in 255': '1 op 255',
  '1 in 47': '1 op 47',
  '1 in 21': '1 op 21',
  '1 in 2.4': '1 op 2,4',
  '1 in 2': '1 op 2',
  'Why does a full house beat a flush?': 'Waarom verslaat een full house een flush?',
  'Because full houses are rarer — 3,744 of them against 5,108 flushes':
    'Omdat full houses zeldzamer zijn — 3.744 daarvan tegenover 5.108 flushes',
  'Exactly the right reasoning. Every ranking in poker comes straight from these counts; nothing about it is a convention you have to take on faith.':
    'Precies de juiste redenering. Elke rangorde in poker komt rechtstreeks uit deze aantallen; niets eraan is een afspraak die je maar moet geloven.',
  'Because it uses three of a kind, and three beats two':
    'Omdat hij three of a kind gebruikt, en drie verslaat twee',
  'It gives the right answer for the wrong reason, which will mislead you elsewhere — three of a kind on its own loses to both a straight and a flush. Rarity is what decides, and full houses are rarer than flushes.':
    'Dit geeft het juiste antwoord om de verkeerde reden, wat je elders op het verkeerde been zet — three of a kind op zichzelf verliest van zowel een straight als een flush. Zeldzaamheid beslist, en full houses zijn zeldzamer dan flushes.',
  'Because a full house uses all five cards': 'Omdat een full house alle vijf kaarten gebruikt',
  'So does a flush — all five cards share a suit. The deciding factor is rarity: 3,744 full houses against 5,108 flushes.':
    'Dat doet een flush ook — alle vijf kaarten delen een kleur. De doorslaggevende factor is zeldzaamheid: 3.744 full houses tegenover 5.108 flushes.',
  'The ace plays high and low — but never wraps': 'De aas speelt hoog en laag — maar loopt nooit rond',
  'The ace is the only card that works at both ends of a straight.':
    'De aas is de enige kaart die aan beide uiteinden van een straight werkt.',
  '**A-K-Q-J-10** is the best straight, called Broadway.':
    '**A-K-Q-J-10** is de beste straight, Broadway genoemd.',
  '**A-2-3-4-5** is also a straight, called the wheel. Here the ace acts as a 1, which makes this the *lowest* straight — it loses to 6-5-4-3-2.':
    '**A-2-3-4-5** is ook een straight, de wheel genoemd. Hier telt de aas als een 1, wat dit de *laagste* straight maakt — hij verliest van 6-5-4-3-2.',
  'But the ace does not connect the two ends together. **Q-K-A-2-3 is nothing at all.** A straight has to be five ranks in an unbroken run, and the sequence stops dead at the ace.':
    'Maar de aas verbindt de twee uiteinden niet met elkaar. **Q-K-A-2-3 is helemaal niets.** Een straight moet vijf waarden in een ononderbroken reeks zijn, en de reeks stopt bij de aas.',
  'This trips people up at showdown more than any other rule, and the mistake always costs a pot.':
    'Hier gaan mensen bij de showdown vaker de mist in dan bij welke andere regel ook, en die fout kost altijd een pot.',
  'You hold A-2 and the board is K-Q-3-4-5. What is your best hand?':
    'Je hebt A-2 en het bord is K-Q-3-4-5. Wat is je beste hand?',
  'A straight, five high — using A-2-3-4-5': 'Een straight, vijf hoog — met A-2-3-4-5',
  'Correct. The ace plays low here to make the wheel. It is the weakest possible straight, but a straight all the same.':
    'Klopt. De aas speelt hier laag om de wheel te maken. Het is de zwakst mogelijke straight, maar het is er wel een.',
  'A straight, ace high — using 2-3-4-5-A': 'Een straight, aas hoog — met 2-3-4-5-A',
  'Those are the right five cards but the wrong reading of them. When the ace plays low it counts as a 1, so the top of this straight is the five, not the ace. That matters: it loses to any other straight.':
    'Dat zijn de juiste vijf kaarten maar de verkeerde lezing ervan. Als de aas laag speelt telt hij als een 1, dus de bovenkant van deze straight is de vijf, niet de aas. Dat maakt uit: hij verliest van elke andere straight.',
  'Nothing — an ace cannot play low': 'Niets — een aas kan niet laag spelen',
  'It can. A-2-3-4-5 is a legitimate straight, known as the wheel. What an ace cannot do is wrap around the top, which is why Q-K-A-2-3 is nothing.':
    'Dat kan hij wel. A-2-3-4-5 is een geldige straight, bekend als de wheel. Wat een aas niet kan, is bovenlangs rondlopen — daarom is Q-K-A-2-3 niets.',
  'You always play the best five cards available': 'Je speelt altijd de beste vijf beschikbare kaarten',
  'In Hold’em you have seven cards to choose from: your two plus the five on the board. Your hand is whichever **five** of those seven make the strongest combination.':
    'In Hold’em heb je zeven kaarten om uit te kiezen: jouw twee plus de vijf op het bord. Je hand is welke **vijf** van die zeven de sterkste combinatie maken.',
  'You are never obliged to use your own cards. If the board is A-K-Q-J-10 and you hold 7-2, your hand is that Broadway straight — the exact same hand as everyone else still in.':
    'Je bent nooit verplicht je eigen kaarten te gebruiken. Als het bord A-K-Q-J-10 is en jij hebt 7-2, dan is jouw hand die Broadway straight — precies dezelfde hand als iedereen die nog meedoet.',
  'That is what "playing the board" means, and when it happens the pot is split between everyone left.':
    'Dat is wat "het bord spelen" betekent, en als dat gebeurt wordt de pot gedeeld tussen iedereen die nog over is.',
  'Equally, you might use just one of your cards, or both, whichever produces the best five.':
    'Net zo goed kun je maar één van je kaarten gebruiken, of allebei — net wat de beste vijf oplevert.',
  'The board reads 9-9-9-9-2 and you hold A-K. Your opponent holds 7-3. What happens?':
    'Het bord is 9-9-9-9-2 en jij hebt A-K. Je tegenstander heeft 7-3. Wat gebeurt er?',
  'You win — your ace outkicks their seven': 'Jij wint — jouw aas verslaat hun zeven als kicker',
  'Right. Both of you use the four nines, and the fifth card is the best remaining one available: your ace beats their seven. Your two cards did not go to waste after all.':
    'Klopt. Jullie gebruiken allebei de vier negens, en de vijfde kaart is de beste die nog beschikbaar is: jouw aas verslaat hun zeven. Je twee kaarten waren toch niet voor niets.',
  'The pot is split — you both have four nines': 'De pot wordt gedeeld — jullie hebben allebei vier negens',
  'Close, and this is the trap. A hand is five cards, not four, so the fifth card still has to come from somewhere. You contribute an ace and they contribute a seven, so you win.':
    'Bijna, en dit is de valkuil. Een hand bestaat uit vijf kaarten, niet vier, dus die vijfde kaart moet ergens vandaan komen. Jij levert een aas en zij leveren een zeven, dus jij wint.',
  'You win with a full house': 'Jij wint met een full house',
  'There is no full house here — that needs three of one rank and a pair of another, and the board gives four nines plus a lone two. Your hand is four nines with an ace kicker.':
    'Er is hier geen full house — daarvoor heb je drie van één waarde en een paar van een andere nodig, en het bord geeft vier negens plus een losse twee. Je hand is vier negens met een aas als kicker.',
  'Kickers settle the close ones': 'Kickers beslissen de close gevallen',
  'When two players make the same hand, the tie is broken by the next highest card — the **kicker**. This is where a surprising amount of money changes hands.':
    'Als twee spelers dezelfde hand maken, beslist de eerstvolgende hoogste kaart — de **kicker**. Hier wisselt verrassend veel geld van eigenaar.',
  'The classic disaster: the board is A-8-4-2-7 and you hold A-5. You have a pair of aces and feel good about it. Your opponent holds A-K — the same pair of aces, but their king plays as the kicker against your five. You lose.':
    'De klassieke ramp: het bord is A-8-4-2-7 en jij hebt A-5. Je hebt een paar azen en voelt je er prima bij. Je tegenstander heeft A-K — hetzelfde paar azen, maar hun heer speelt als kicker tegen jouw vijf. Je verliest.',
  'This is why **A-K is so much stronger than A-5**, and why "any ace" is a losing habit. When you hit the ace, the times you win are small and the times you lose are large — you get paid a little by weaker aces and stacked by better ones.':
    'Daarom is **A-K zoveel sterker dan A-5**, en daarom is "elke aas spelen" een verliezende gewoonte. Als je de aas raakt, zijn de keren dat je wint klein en de keren dat je verliest groot — zwakkere azen betalen je een beetje, betere azen pakken je stack.',
  'The general shape: being *dominated* means sharing your best card with an opponent who has a better second card. Avoiding domination is most of good preflop play.':
    'De algemene vorm: *dominated* zijn betekent dat je je beste kaart deelt met een tegenstander die een betere tweede kaart heeft. Domination vermijden is het grootste deel van goed preflop spel.',
  'Board: Q-9-6-3-2. You hold Q-7. Your opponent holds Q-J. Who wins?':
    'Bord: Q-9-6-3-2. Jij hebt Q-7. Je tegenstander heeft Q-J. Wie wint?',
  'Your opponent — same pair of queens, but their jack outkicks your seven':
    'Je tegenstander — hetzelfde paar vrouwen, maar hun boer verslaat jouw zeven als kicker',
  'Right, and this is exactly the situation to avoid. Both of you paired the queen; the hand comes down to the second card, and theirs is better.':
    'Klopt, en dit is precies de situatie die je wilt vermijden. Jullie hebben allebei de vrouw gepaard; de hand komt neer op de tweede kaart, en die van hen is beter.',
  'Split pot — you both have a pair of queens': 'Gedeelde pot — jullie hebben allebei een paar vrouwen',
  'The pair is only part of the hand. Five cards play, so after Q-Q the next card matters: their jack beats your seven, and they take the whole pot.':
    'Het paar is maar een deel van de hand. Vijf kaarten spelen, dus na Q-Q telt de volgende kaart: hun boer verslaat jouw zeven, en zij pakken de hele pot.',
  'You win — your seven pairs nothing but your queen is higher':
    'Jij wint — je zeven paart niets maar je vrouw is hoger',
  'Your queens are identical, not higher — you both use the same queen from the board plus one in hand. The jack against the seven decides it, in their favour.':
    'Jullie vrouwen zijn identiek, niet hoger — jullie gebruiken allebei dezelfde vrouw van het bord plus één in de hand. De boer tegen de zeven beslist het, in hun voordeel.',
  'The ranking order comes from rarity — flushes beat straights because there are half as many of them.':
    'De rangorde komt voort uit zeldzaamheid — flushes verslaan straights omdat er half zoveel van zijn.',
  'A-2-3-4-5 is the lowest straight; Q-K-A-2-3 is not a straight at all.':
    'A-2-3-4-5 is de laagste straight; Q-K-A-2-3 is helemaal geen straight.',
  'Your hand is the best five of your seven cards, even if that means playing the board.':
    'Je hand is de beste vijf van je zeven kaarten, ook als dat betekent dat je het bord speelt.',
  'Equal hands are settled by the kicker — which is why A-K is a different hand from A-5.':
    'Gelijke handen worden beslist door de kicker — en daarom is A-K een andere hand dan A-5.',
  /* ---------------------------------------------------------------- *
   * Counters and progress text. The numbers are parameters, so one
   * entry covers every value the screen can show.
   * ---------------------------------------------------------------- */
  'Step {n} of {total}': 'Stap {n} van {total}',
  'Question {n} of {total} · {module}': 'Vraag {n} van {total} · {module}',
  'Question {n} of {total} · pass mark {pass}': 'Vraag {n} van {total} · voldoende vanaf {pass}',
  ' · pass mark was {pass}': ' · voldoende was vanaf {pass}',
  'Answer the check to continue — press 1-4 or click.':
    'Beantwoord de vraag om verder te gaan — druk op 1-4 of klik.',
  'Welcome to the table': 'Welkom aan tafel',
  'Start with Hand Rankings, then play a few hands. The coach explains every decision.':
    'Begin met Handvolgorde en speel dan een paar handen. De coach legt elke beslissing uit.',
  'Level {level} of {total}': 'Level {level} van {total}',
  /* ---------------------------------------------------------------- *
   * Lesson: Pot Odds
   * ---------------------------------------------------------------- */
  'By the end of this you will be able to look at any bet and say out loud, in about three seconds, exactly how often you need to win for calling to be worth it.':
    'Aan het eind hiervan kun je naar elke bet kijken en binnen ongeveer drie seconden hardop zeggen hoe vaak je moet winnen om callen de moeite waard te maken.',
  'What question are we actually asking?': 'Welke vraag stellen we eigenlijk?',
  'Someone bets. You can call or fold. Pot odds answer one specific question, and it is not the one most people think:':
    'Iemand bet. Jij kunt callen of folden. Pot odds beantwoorden één specifieke vraag, en niet die waar de meeste mensen aan denken:',
  '**How often would I need to win for calling to be worth it?**':
    '**Hoe vaak zou ik moeten winnen om callen de moeite waard te maken?**',
  'Notice what that is not. It is not "do I have the best hand" — nobody knows that. It is not "will I win this pot" — nobody knows that either. It is purely about the *price* you are being offered.':
    'Let op wat het níét is. Het is niet "heb ik de beste hand" — dat weet niemand. Het is ook niet "ga ik deze pot winnen" — dat weet ook niemand. Het gaat puur om de *prijs* die je geboden krijgt.',
  'A friend offers you a bet on a coin flip: put in €1, and if you win they pay you €3. You do not need to see the future to know that is a good deal. You win half the time, and you are being paid three-to-one. The price is good, so you take it.':
    'Een vriend biedt je een weddenschap op kop of munt: leg €1 in, en als je wint betaalt hij je €3. Je hoeft niet in de toekomst te kijken om te weten dat dat een goede deal is. Je wint de helft van de tijd, en je krijgt drie-tegen-één betaald. De prijs is goed, dus je neemt hem.',
  'Poker is exactly this. Pot odds are the price. Your hand is the coin.':
    'Poker is precies dit. Pot odds zijn de prijs. Je hand is de munt.',
  'One word to pin down before going further, because it is about to appear everywhere. **Equity** is your share of the pot — how often your hand wins if this exact situation were played out again and again. A hand that wins three times in four has 75% equity.':
    'Eén woord om vast te leggen voordat we verdergaan, want het duikt straks overal op. **Equity** is jouw aandeel in de pot — hoe vaak je hand wint als deze exacte situatie keer op keer wordt uitgespeeld. Een hand die drie van de vier keer wint heeft 75% equity.',
  'So equity describes your **cards**. Pot odds describe the **money**. They are two separate things, and every decision in this module is just comparing one against the other.':
    'Equity beschrijft dus je **kaarten**. Pot odds beschrijven het **geld**. Het zijn twee losse dingen, en elke beslissing in deze module is niets anders dan het een tegen het ander afzetten.',
  'What do pot odds tell you?': 'Wat vertellen pot odds je?',
  'Whether you currently have the best hand': 'Of je op dit moment de beste hand hebt',
  'Pot odds say nothing about your cards — you could work them out before even looking at your hand. They describe the price the pot is offering, not what you are holding.':
    'Pot odds zeggen niets over je kaarten — je zou ze kunnen uitrekenen voordat je zelfs naar je hand kijkt. Ze beschrijven de prijs die de pot biedt, niet wat je vasthoudt.',
  'How often you need to win for a call to break even':
    'Hoe vaak je moet winnen om een call quitte te laten draaien',
  'Exactly. It is a threshold: the minimum win rate that makes calling worthwhile. What you do with that number comes next.':
    'Precies. Het is een drempel: het minimale winstpercentage dat callen de moeite waard maakt. Wat je met dat getal doet komt hierna.',
  'How much money you will win from this hand': 'Hoeveel geld je met deze hand gaat winnen',
  'Nothing can tell you that in advance. Pot odds give you a break-even threshold, not a prediction of the result.':
    'Niets kan je dat vooraf vertellen. Pot odds geven je een break-even drempel, geen voorspelling van de uitkomst.',
  'The two numbers that matter': 'De twee getallen die ertoe doen',
  'Only two things go into this. Get these straight and the rest is arithmetic.':
    'Er gaan maar twee dingen in. Krijg die helder en de rest is rekenwerk.',
  '**What you risk:** the amount you have to call. That is all. If you fold instead, you lose nothing extra — money you already put in earlier in the hand is gone either way, so it plays no part in this decision.':
    '**Wat je riskeert:** het bedrag dat je moet callen. Meer niet. Fold je in plaats daarvan, dan verlies je niets extra — geld dat je eerder in de hand hebt ingelegd is hoe dan ook weg, dus dat speelt geen rol in deze beslissing.',
  '**What you win:** everything already in the pot. Their bet is part of that. The moment they pushed those chips forward, the chips stopped being theirs — if you win the pot, you collect them.':
    '**Wat je wint:** alles wat al in de pot zit. Hun bet hoort daarbij. Op het moment dat ze die chips naar voren schoven, waren die chips niet meer van hen — win jij de pot, dan pak jij ze.',
  'A note on wording, because you will meet it elsewhere: players often say chips are “in the middle”, meaning simply that they are in the pot — the chips get pushed to the centre of the table. This trainer says “in the pot” throughout, to keep it unambiguous.':
    'Een opmerking over woordkeuze, want je komt het elders tegen: spelers zeggen vaak dat chips "in the middle" liggen, wat simpelweg betekent dat ze in de pot zitten — de chips worden naar het midden van de tafel geschoven. Deze trainer zegt overal "in de pot", om het ondubbelzinnig te houden.',
  'So: **you risk your call, to win the pot.**': 'Dus: **je riskeert je call om de pot te winnen.**',
  'Risking 50 to win 150.': '50 riskeren om 150 te winnen.',
  'Already in the pot (you win this)': 'Zit al in de pot (dit win jij)',
  'Your call (you risk this)': 'Jouw call (dit riskeer je)',
  'The pot was 100. Your opponent bets 50. It is now your turn. How big is the pot right now?':
    'De pot was 100. Je tegenstander bet 50. Nu ben jij aan de beurt. Hoe groot is de pot op dit moment?',
  'That was the pot before they bet. Their 50 has been pushed in as well now, and if you win the hand you collect that too.':
    'Dat was de pot vóór hun bet. Hun 50 is er nu ook in geschoven, en als jij de hand wint pak je die ook.',
  'Right — the original 100 plus their 50. This is what "the pot" means throughout this trainer: every chip already bet when it is your turn, including the bet you are facing.':
    'Klopt — de oorspronkelijke 100 plus hun 50. Dit is wat "de pot" in deze trainer overal betekent: elke chip die al ingezet is op het moment dat jij aan de beurt bent, inclusief de bet waar je tegenover staat.',
  'That would be the pot after you also call. Right now only their bet has gone in; yours has not.':
    'Dat zou de pot zijn nadat jij ook callt. Op dit moment is alleen hun bet erin gegaan; die van jou nog niet.',
  'That is only their bet. The 100 that was already there is still in the pot, and you win that too.':
    'Dat is alleen hun bet. De 100 die er al lag zit nog steeds in de pot, en die win je ook.',
  'Working out the break-even point': 'Het break-even punt uitrekenen',
  'Keep the spot from the last step: the pot was **100**, your opponent bet **50**, so the pot is now **150** — and it costs you **50** to try to win it.':
    'Houd de situatie uit de vorige stap aan: de pot was **100**, je tegenstander bette **50**, dus de pot is nu **150** — en het kost je **50** om te proberen hem te winnen.',
  'Imagine playing this identical spot 100 times. Say you win it W times out of the 100.':
    'Stel je voor dat je deze identieke situatie 100 keer speelt. Zeg dat je hem W van de 100 keer wint.',
  'Each time you win, you gain **150**. Each time you lose, you drop the **50** you called.':
    'Elke keer dat je wint, verdien je **150**. Elke keer dat je verliest, ben je de **50** kwijt die je callde.',
  'Break-even is where those cancel out exactly:': 'Break-even is waar die elkaar precies opheffen:',
  'You need to win **25 out of 100** — that is **25%**. Win more often than that and calling makes money over time. Less often and it loses money, no matter how the individual hand happens to turn out.':
    'Je moet **25 van de 100** winnen — dat is **25%**. Win je vaker dan dat, dan verdient callen op termijn geld. Minder vaak en het verliest geld, hoe die ene hand ook toevallig afloopt.',
  'In that calculation, you needed to win 25 times out of 100. What happens if your hand actually wins 40% of the time here?':
    'In die berekening moest je 25 van de 100 keer winnen. Wat gebeurt er als je hand hier in werkelijkheid 40% van de tijd wint?',
  'Calling is profitable — you win more often than the price requires':
    'Callen is winstgevend — je wint vaker dan de prijs vraagt',
  'Correct. You need 25%, you have 40%, so the extra 15% is your edge. Repeated over many hands, that edge is your profit.':
    'Klopt. Je hebt 25% nodig, je hebt 40%, dus die extra 15% is je voordeel. Over veel handen herhaald is dat voordeel je winst.',
  'You should fold — 40% is still less than half': 'Je moet folden — 40% is nog steeds minder dan de helft',
  'A common trap. You do not need to win *most* of the time, only more often than the price demands. You are risking 50 to win 150, so even winning well under half the time is profitable.':
    'Een veelgemaakte denkfout. Je hoeft niet *meestal* te winnen, alleen vaker dan de prijs vraagt. Je riskeert 50 om 150 te winnen, dus zelfs ruim onder de helft winnen is winstgevend.',
  'It makes no difference — poker is luck': 'Het maakt niet uit — poker is geluk',
  'Any single hand is luck. But this is a threshold you meet or miss on every decision, and across thousands of hands the ones where you had the better of the price are exactly where profit comes from.':
    'Elke afzonderlijke hand is geluk. Maar dit is een drempel die je bij elke beslissing haalt of niet haalt, en over duizenden handen komt de winst precies uit die keren dat je de betere kant van de prijs had.',
  'The shortcut: your share of the final pot': 'De snelle weg: jouw aandeel in de uiteindelijke pot',
  'That algebra works, but nobody is solving equations at the table. Here is the fast way to see the same thing.':
    'Die algebra klopt, maar niemand lost aan tafel vergelijkingen op. Hier is de snelle manier om hetzelfde te zien.',
  'Same spot: the pot was 100, they bet 50, so the pot is now 150, and your call is 50. Once you call, the **final pot** is 150 + 50 = **200**.':
    'Dezelfde situatie: de pot was 100, zij betten 50, dus de pot is nu 150, en jouw call is 50. Zodra je callt is de **uiteindelijke pot** 150 + 50 = **200**.',
  'Of that 200, exactly **50 is your money**. And 50 out of 200 is **25%**.':
    'Van die 200 is precies **50 jouw geld**. En 50 van de 200 is **25%**.',
  'That is the same 25% we got from the algebra — and it is not a coincidence or an approximation. It is the identical calculation, seen from a different angle:':
    'Dat is dezelfde 25% die uit de algebra kwam — en dat is geen toeval en geen benadering. Het is exact dezelfde berekening, van een andere kant bekeken:',
  '**The fraction of the final pot made up of your own money is exactly how often you need to win.**':
    '**Het deel van de uiteindelijke pot dat uit jouw eigen geld bestaat, is precies hoe vaak je moet winnen.**',
  'It is fair to ask why your own call belongs in that total at all. The reason is the thing most explanations skip: **when you win, you win your own money back too.**':
    'Het is terecht om je af te vragen waarom je eigen call überhaupt in dat totaal hoort. De reden is wat de meeste uitleg overslaat: **als je wint, win je ook je eigen geld terug.**',
  'You are not paying 50 for a shot at their 150. You are paying 50 for a shot at the whole **200** — and 50 of that 200 is the chip you just pushed in.':
    'Je betaalt geen 50 voor een kans op hun 150. Je betaalt 50 voor een kans op de hele **200** — en 50 van die 200 is de chip die je er net in schoof.',
  'So treat it as buying a ticket. The ticket costs **50**. The prize is **200**. How often does that ticket have to win to be worth buying? One time in four, because 50 is a quarter of 200.':
    'Zie het dus als een lot kopen. Het lot kost **50**. De prijs is **200**. Hoe vaak moet dat lot winnen om het kopen waard te zijn? Eén op de vier keer, want 50 is een kwart van 200.',
  'Both ways of looking at it give the same answer, always. Risk 50 to *gain* 150, or pay 50 to *collect* 200 — either way, 25%.':
    'Beide manieren van kijken geven altijd hetzelfde antwoord. Riskeer 50 om 150 te *verdienen*, of betaal 50 om 200 te *innen* — hoe dan ook, 25%.',
  'Which gives the formula, and now you know where it comes from rather than just having to trust it:':
    'Dat geeft de formule, en nu weet je waar hij vandaan komt in plaats van hem maar te moeten geloven:',
  'Your 50 is a quarter of the 200 final pot — so you need to win a quarter of the time.':
    'Jouw 50 is een kwart van de uiteindelijke pot van 200 — dus je moet een kwart van de tijd winnen.',
  'Their money in the final pot': 'Hun geld in de uiteindelijke pot',
  'Your money': 'Jouw geld',
  'There is 60 in the pot and your opponent bets 20. What equity do you need to call?':
    'Er zit 60 in de pot en je tegenstander bet 20. Hoeveel equity heb je nodig om te callen?',
  'Right. Their bet takes the pot to 80, you call 20, so the final pot is 100 — and your 20 is a fifth of it.':
    'Klopt. Hun bet brengt de pot op 80, jij callt 20, dus de uiteindelijke pot is 100 — en jouw 20 is daar een vijfde van.',
  'This compares your 20 against the 80 the pot had reached. But the final pot also contains your own call: 60 + 20 + 20 = 100, so your share is 20 ÷ 100 = 20%.':
    'Dit zet je 20 af tegen de 80 die de pot had bereikt. Maar de uiteindelijke pot bevat ook je eigen call: 60 + 20 + 20 = 100, dus jouw aandeel is 20 ÷ 100 = 20%.',
  'That is the figure for a pot-sized bet. Here they bet only 20 into 60 — a third of the pot — so the price is much better than that: 20 ÷ 100 = 20%.':
    'Dat is het getal voor een pot-sized bet. Hier betten ze maar 20 in een pot van 60 — een derde van de pot — dus de prijs is veel beter: 20 ÷ 100 = 20%.',
  'The denominator has gone too big. It is the final pot, 100 — not the pot plus anything further. 20 ÷ 100 = 20%.':
    'De noemer is te groot geworden. Het is de uiteindelijke pot, 100 — niet de pot plus nog iets. 20 ÷ 100 = 20%.',
  /* ---- Pot Odds, continued: count in calls, the table, putting it to work ---- */
  'Doing it in your head: count in calls': 'Uit je hoofd: tel in calls',
  'The arithmetic above is right, but it is three steps: add their bet to the pot, add your call, then divide. At a table you want one step.':
    'Het rekenwerk hierboven klopt, maar het zijn drie stappen: tel hun bet bij de pot, tel je call erbij, en deel dan. Aan tafel wil je één stap.',
  'Here is the trick. **Stop counting chips and start counting your own call as the unit.**':
    'Hier is de truc. **Stop met chips tellen en ga je eigen call als eenheid tellen.**',
  'Ask one question: **how many times does their bet fit into the pot?** Call that number N.':
    'Stel één vraag: **hoe vaak past hun bet in de pot?** Noem dat getal N.',
  'Now count the final pot in calls. The pot is worth **N** calls. Their bet is **1** more. Your call is **1** more. So the final pot is **N + 2** calls — and you are putting in exactly one of them.':
    'Tel nu de uiteindelijke pot in calls. De pot is **N** calls waard. Hun bet is er **1** bij. Jouw call is er **1** bij. Dus de uiteindelijke pot is **N + 2** calls — en jij legt er precies één van in.',
  'That is the whole method: **you need 1 out of N + 2.**':
    'Dat is de hele methode: **je hebt 1 van de N + 2 nodig.**',
  'Work one through. The pot is 100 and they bet 50. Fifty goes into a hundred **twice**, so N = 2. Add 2 and you get 4. You are putting in one of four, so you need **25%**.':
    'Werk er één uit. De pot is 100 en ze betten 50. Vijftig past **twee keer** in honderd, dus N = 2. Tel er 2 bij en je komt op 4. Jij legt er één van de vier in, dus je hebt **25%** nodig.',
  'Another. The pot is 55 and they bet 55. It goes in **once**, so N = 1. Add 2 and you get 3. You need **one in three — 33%**. No addition anywhere.':
    'Nog een. De pot is 55 en ze betten 55. Het past er **één keer** in, dus N = 1. Tel er 2 bij en je komt op 3. Je hebt **één op drie — 33%** nodig. Nergens optellen.',
  'And a smaller one. The pot is 120 and they bet 40. Forty goes in **three** times, so N = 3, plus 2 is 5, and you need **one in five — 20%**.':
    'En een kleinere. De pot is 120 en ze betten 40. Veertig past er **drie** keer in, dus N = 3, plus 2 is 5, en je hebt **één op vijf — 20%** nodig.',
  'This is not a new rule, it is the same fraction with the chips divided out. You need bet ÷ (pot + two bets); divide the top and bottom by your own bet and the amounts vanish, leaving 1 ÷ (pot-in-calls + 2). Exactly the same answer, every time.':
    'Dit is geen nieuwe regel, het is dezelfde breuk met de chips eruit gedeeld. Je hebt bet ÷ (pot + twee bets) nodig; deel teller en noemer door je eigen bet en de bedragen verdwijnen, waardoor 1 ÷ (pot-in-calls + 2) overblijft. Elke keer precies hetzelfde antwoord.',
  'One consequence worth noticing: **the actual amounts never mattered.** A bet of 55 into 55 and a bet of 400 into 400 are the same problem, because the only thing you used was how the bet compares to the pot.':
    'Eén gevolg is het opmerken waard: **de werkelijke bedragen deden er nooit toe.** Een bet van 55 in een pot van 55 en een bet van 400 in een pot van 400 zijn hetzelfde probleem, want het enige wat je gebruikte was hoe de bet zich tot de pot verhoudt.',
  'The bigger their bet, the fewer times it fits, and the worse your price. The last row is the one that catches people: an overbet makes the bet *bigger* but the number of times it fits *smaller*.':
    'Hoe groter hun bet, hoe minder vaak hij past, en hoe slechter jouw prijs. De laatste rij is degene waar mensen over struikelen: een overbet maakt de bet *groter* maar het aantal keren dat hij past *kleiner*.',
  'They bet': 'Zij betten',
  'Fits into the pot': 'Past in de pot',
  'Plus 2': 'Plus 2',
  'So you need': 'Dus je hebt nodig',
  'a quarter of it': 'een kwart ervan',
  'a third of it': 'een derde ervan',
  'half of it': 'de helft ervan',
  'all of it': 'de hele pot',
  'twice the pot': 'twee keer de pot',
  '4 times': '4 keer',
  '3 times': '3 keer',
  '2 times': '2 keer',
  'once': 'één keer',
  'half a time': 'een halve keer',
  '1 in 6 — 17%': '1 op 6 — 17%',
  '1 in 5 — 20%': '1 op 5 — 20%',
  '1 in 4 — 25%': '1 op 4 — 25%',
  '1 in 3 — 33%': '1 op 3 — 33%',
  '1 in 2.5 — 40%': '1 op 2,5 — 40%',
  'The pot is 90 and your opponent bets 30. Counting in calls, what equity do you need?':
    'De pot is 90 en je tegenstander bet 30. Als je in calls telt, hoeveel equity heb je dan nodig?',
  'Right. Thirty goes into ninety three times, so N = 3. Add 2 for their bet and your call and you get 5 — you are putting in one of five, which is 20%.':
    'Klopt. Dertig past drie keer in negentig, dus N = 3. Tel er 2 bij voor hun bet en jouw call en je komt op 5 — jij legt er één van de vijf in, en dat is 20%.',
  'That is the answer when their bet is half the pot, where it fits twice. Here it fits three times, not two — 30 into 90 — so the price is better than half pot, not the same.':
    'Dat is het antwoord als hun bet de helft van de pot is, waar hij twee keer past. Hier past hij drie keer, niet twee — 30 in 90 — dus de prijs is beter dan halve pot, niet gelijk.',
  'That is the answer for a pot-sized bet, where their bet fits exactly once. They have bet a third of the pot here, which is much cheaper for you.':
    'Dat is het antwoord voor een pot-sized bet, waar hun bet precies één keer past. Ze hebben hier een derde van de pot gebet, wat voor jou veel goedkoper is.',
  'Close, but that is the quarter-pot answer: a quarter fits four times, giving 6. Thirty is a third of ninety, not a quarter, so it fits three times and you get 5.':
    'Bijna, maar dat is het antwoord voor een kwart pot: een kwart past vier keer, wat 6 geeft. Dertig is een derde van negentig, geen kwart, dus hij past drie keer en je komt op 5.',
  'The five numbers worth memorising': 'De vijf getallen die het waard zijn om te onthouden',
  'In practice you will face the same handful of bet sizes over and over. Learn these and you will almost never need to calculate at the table.':
    'In de praktijk krijg je steeds dezelfde handvol betgroottes voor je. Leer deze en je hoeft aan tafel bijna nooit meer te rekenen.',
  'Each row is: they bet this fraction of the pot, so you need this much equity to call.':
    'Elke rij is: zij betten dit deel van de pot, dus zoveel equity heb je nodig om te callen.',
  'Look at the direction of that list. **The bigger the bet, the more equity you need.** This is why an overbet is not automatically a stronger play — it demands more, both from you when you call and from them when they bluff.':
    'Kijk naar de richting van dat lijstje. **Hoe groter de bet, hoe meer equity je nodig hebt.** Daarom is een overbet niet automatisch een sterkere zet — hij eist meer, zowel van jou als je callt als van hen als ze bluffen.',
  'Take the first row as the worked example, because it is the one that catches people out. The pot is 100 and they bet 25. That takes the pot to **125**, you call **25**, so the final pot is **150** — and your share is 25 ÷ 150 = **17%**.':
    'Neem de eerste rij als uitgewerkt voorbeeld, want daar struikelen mensen over. De pot is 100 en ze betten 25. Dat brengt de pot op **125**, jij callt **25**, dus de uiteindelijke pot is **150** — en jouw aandeel is 25 ÷ 150 = **17%**.',
  'These do not scale in a straight line, which is worth knowing before you try to guess a row. A quarter-pot bet is half the size of a half-pot bet, but it asks for 17% — not half of 25%. The reason is that **both numbers move at once**: a smaller bet also makes a smaller final pot. In symbols, a bet of B into a pot of P needs B ÷ (P + 2B), and however enormous the bet gets that can only creep towards 50% without ever reaching it — a 1000 overbet into 100 still only asks for 48%.':
    'Deze schalen niet rechtlijnig, en dat is goed om te weten voordat je een rij probeert te gokken. Een kwart-pot bet is half zo groot als een halve-pot bet, maar vraagt 17% — niet de helft van 25%. De reden is dat **beide getallen tegelijk bewegen**: een kleinere bet maakt ook een kleinere uiteindelijke pot. In symbolen heeft een bet van B in een pot van P B ÷ (P + 2B) nodig, en hoe enorm de bet ook wordt, dat kan alleen naar 50% toe kruipen zonder het ooit te bereiken — een overbet van 1000 in een pot van 100 vraagt nog steeds maar 48%.',
  'You need': 'Je hebt nodig',
  'Quarter pot': 'Kwart pot',
  'Half pot': 'Halve pot',
  'Three-quarter pot': 'Driekwart pot',
  'Full pot': 'Hele pot',
  'Double the pot': 'Twee keer de pot',
  'The pot is 80 and your opponent bets 80 — a full pot-sized bet. What equity do you need to call?':
    'De pot is 80 en je tegenstander bet 80 — een volledige pot-sized bet. Hoeveel equity heb je nodig om te callen?',
  'A natural guess, since they bet an amount equal to the pot — but you are still getting a discount. You call 80 to win 160, so the final pot is 240 and your share is 80 ÷ 240 = 33%.':
    'Een logische gok, want ze betten een bedrag gelijk aan de pot — maar je krijgt nog steeds korting. Je callt 80 om 160 te winnen, dus de uiteindelijke pot is 240 en jouw aandeel is 80 ÷ 240 = 33%.',
  'Right. You call 80 into a pot of 160, so the final pot is 240 and your 80 is a third of it. A pot-sized bet always asks for 33%, whatever the actual numbers are.':
    'Klopt. Je callt 80 in een pot van 160, dus de uiteindelijke pot is 240 en jouw 80 is daar een derde van. Een pot-sized bet vraagt altijd 33%, wat de werkelijke getallen ook zijn.',
  'That is the number for a half-pot bet. This one is a full pot-sized bet, which asks for more: 80 ÷ 240 = 33%.':
    'Dat is het getal voor een halve-pot bet. Dit is een volledige pot-sized bet, die meer vraagt: 80 ÷ 240 = 33%.',
  'This looks like the bet size rather than an equity figure. The question is what fraction of the final pot is your money: 80 out of 240, which is 33%.':
    'Dit lijkt de betgrootte in plaats van een equitygetal. De vraag is welk deel van de uiteindelijke pot jouw geld is: 80 van de 240, en dat is 33%.',
  'Putting it to work': 'Het in de praktijk brengen',
  'Pot odds give you one half of the decision — what you **need**. The other half is your [[equity]]: what you actually **have**.':
    'Pot odds geven je de ene helft van de beslissing — wat je **nodig hebt**. De andere helft is je [[equity]]: wat je werkelijk **hebt**.',
  'Before the example, the thing that trips people up most: **these are two separate numbers, worked out from two separate things, and neither one ever turns into the other.**':
    'Vóór het voorbeeld het punt waar mensen het vaakst over struikelen: **dit zijn twee losse getallen, berekend uit twee losse dingen, en het een verandert nooit in het ander.**',
  'What you **need** comes from the **money** alone — the pot and the bet. You could work it out with your cards face down.':
    'Wat je **nodig hebt** komt alleen uit het **geld** — de pot en de bet. Je zou het kunnen uitrekenen met je kaarten omgekeerd op tafel.',
  'What you **have** comes from your **cards** alone — how many cards would complete your hand. You could work it out without knowing what the bet was.':
    'Wat je **hebt** komt alleen uit je **kaarten** — hoeveel kaarten je hand zouden afmaken. Je zou het kunnen uitrekenen zonder te weten hoe groot de bet was.',
  'They are both written as percentages, and that is the entire point: putting two different things on the same scale is what lets you compare them. Think of what you need as the price on a tag, and what you have as the money in your wallet. You are not converting one into the other — you are only checking which is bigger.':
    'Ze worden allebei als percentage geschreven, en dat is precies het punt: twee verschillende dingen op dezelfde schaal zetten is wat je in staat stelt ze te vergelijken. Zie wat je nodig hebt als de prijs op een label, en wat je hebt als het geld in je portemonnee. Je zet het een niet om in het ander — je kijkt alleen welke groter is.',
  'Then the decision is simply:': 'Dan is de beslissing simpelweg:',
  '**Have ≥ Need → call.   Have < Need → fold.**':
    '**Hebben ≥ Nodig → call.   Hebben < Nodig → fold.**',
  'A worked example. You hold a [[flush draw]] on the flop — four cards of one suit, needing a fifth. Nine cards complete it, which is roughly **36%** by the river. There is 100 in the pot and your opponent bets 50.':
    'Een uitgewerkt voorbeeld. Je hebt een [[flush draw]] op de flop — vier kaarten van één kleur, je hebt een vijfde nodig. Negen kaarten maken hem af, wat neerkomt op ongeveer **36%** tegen de river. Er zit 100 in de pot en je tegenstander bet 50.',
  'You **need** (from the money): the pot is now 150 and your call is 50, so the final pot is 200 and your share is 50 ÷ 200 = **25%**.':
    'Je **hebt nodig** (uit het geld): de pot is nu 150 en jouw call is 50, dus de uiteindelijke pot is 200 en jouw aandeel is 50 ÷ 200 = **25%**.',
  'You **have** (from the cards): **36%** — that is the chance one of your nine flush cards arrives on the turn or the river. In a clean drawing spot like this, hitting the flush and winning the pot are the same event, so the number can be used directly.':
    'Je **hebt** (uit de kaarten): **36%** — dat is de kans dat een van je negen flushkaarten op de turn of de river komt. In een schone drawsituatie als deze zijn de flush raken en de pot winnen dezelfde gebeurtenis, dus het getal kan direct gebruikt worden.',
  '36 is comfortably more than 25, so this is a clear call — and it stays a clear call even on the times the draw misses and you lose the pot. The price was right; that is what you control.':
    '36 is ruim meer dan 25, dus dit is een duidelijke call — en het blijft een duidelijke call, ook op de keren dat de draw mist en je de pot verliest. De prijs was goed; dat is wat jij in de hand hebt.',
  'Say it out loud every time, in this order: *"I call 50 to win 150, so I need 25%. I have about 36%. Call."* Most losing calls in small-stakes poker are ones where nobody ever ran that sentence.':
    'Zeg het elke keer hardop, in deze volgorde: *"Ik call 50 om 150 te winnen, dus ik heb 25% nodig. Ik heb ongeveer 36%. Call."* De meeste verliezende calls in smallstakes poker zijn de calls waarbij niemand die zin ooit heeft uitgesproken.',
  'Need (price)': 'Nodig (prijs)',
  'Have (flush draw)': 'Hebben (flush draw)',
  'You have an inside straight draw (a [[gutshot]]) — a straight missing one card in the middle, so only four cards complete it, about 16% to hit by the river. The pot is 90 and your opponent bets 90. Call or fold?':
    'Je hebt een inside straight draw (een [[gutshot]]) — een straight waar één kaart in het midden aan ontbreekt, dus maar vier kaarten maken hem af, ongeveer 16% om hem te raken tegen de river. De pot is 90 en je tegenstander bet 90. Call of fold?',
  'Call — a straight would win a big pot': 'Call — een straight zou een grote pot winnen',
  'How much you would win *if* it hits is already accounted for: it is exactly what the pot odds measure. This is a pot-sized bet, so you need 33%, and you have about 16%. Less than half of what the price demands.':
    'Hoeveel je zou winnen *als* hij binnenkomt is al verrekend: dat is precies wat de pot odds meten. Dit is een pot-sized bet, dus je hebt 33% nodig, en je hebt ongeveer 16%. Minder dan de helft van wat de prijs vraagt.',
  'Fold — you have 16% but need 33%': 'Fold — je hebt 16% maar hebt 33% nodig',
  'Right. A pot-sized bet demands 33% and a gutshot delivers about 16%, so the call loses money every time you make it. Folding here is not weakness; it is the profitable play.':
    'Klopt. Een pot-sized bet vraagt 33% en een gutshot levert ongeveer 16%, dus de call verliest geld elke keer dat je hem maakt. Folden is hier geen zwakte; het is de winstgevende zet.',
  'Call — you are getting 2-to-1 on your money': 'Call — je krijgt 2-tegen-1 op je geld',
  'The odds are read correctly (2-to-1 does mean you need 33%), but the comparison is the wrong way round: you need 33% and only have 16%, so the price is worse than your chances, not better.':
    'De odds zijn goed gelezen (2-tegen-1 betekent inderdaad dat je 33% nodig hebt), maar de vergelijking staat andersom: je hebt 33% nodig en maar 16%, dus de prijs is slechter dan je kansen, niet beter.',
  'Where the other number comes from': 'Waar het andere getal vandaan komt',
  'One thing to be straight about before you start drilling, because it is the obvious next question and this lesson has quietly been dodging it.':
    'Eén ding om eerlijk over te zijn voordat je gaat oefenen, want het is de voor de hand liggende volgende vraag en deze les is er stilletjes omheen gelopen.',
  'Everything above works out what you **need**. That half is finished — you can now price any bet.':
    'Alles hierboven rekent uit wat je **nodig hebt**. Die helft is klaar — je kunt nu elke bet van een prijs voorzien.',
  'What you **have** has been *handed to you* every time. In the flush draw example, “nine cards complete it, roughly 36%” arrived as a given. Nothing here taught you to find the nine, or to turn nine into 36%.':
    'Wat je **hebt** is je elke keer *aangereikt*. In het flush draw voorbeeld kwam "negen kaarten maken hem af, ongeveer 36%" als gegeven binnen. Niets hier heeft je geleerd die negen te vinden, of negen om te zetten in 36%.',
  'That is a separate skill, and it has its own name. The cards still to come that would turn your losing hand into a winning one are your [[outs]]. Nine hearts for a [[flush draw]]. Four cards for a [[gutshot]].':
    'Dat is een aparte vaardigheid, en die heeft een eigen naam. De kaarten die nog moeten komen en je verliezende hand in een winnende zouden veranderen zijn je [[outs]]. Negen harten voor een [[flush draw]]. Vier kaarten voor een [[gutshot]].',
  'Counting them from a real board, and converting the count into a percentage, is the **next module: Outs & Equity**. It is the other half of every calling decision you will ever make.':
    'Ze tellen vanaf een echt bord, en dat aantal omzetten in een percentage, is de **volgende module: Outs & Equity**. Het is de andere helft van elke callbeslissing die je ooit zult maken.',
  'So the honest state of play: after this lesson you can price a bet, but not yet read your own hand. The Pot Odds drills therefore *give* you your equity, so you can practise the comparison on its own. Once you finish Outs & Equity, you work out both halves yourself.':
    'De eerlijke stand van zaken: na deze les kun je een bet van een prijs voorzien, maar je eigen hand nog niet lezen. De Pot Odds oefeningen *geven* je daarom je equity, zodat je de vergelijking apart kunt oefenen. Zodra je Outs & Equity afrondt, reken je beide helften zelf uit.',
  'You hold two hearts, and two more hearts are on the flop. Nine hearts are still unseen. What is the name for those nine cards?':
    'Je hebt twee harten, en er liggen nog twee harten op de flop. Negen harten zijn nog ongezien. Hoe heten die negen kaarten?',
  'Your pot odds': 'Je pot odds',
  'Pot odds come from the money — the pot and the bet — and would be the same number if you were holding two blank cards. These nine cards are about your hand, not the price.':
    'Pot odds komen uit het geld — de pot en de bet — en zouden hetzelfde getal zijn als je twee blanco kaarten had. Deze negen kaarten gaan over je hand, niet over de prijs.',
  'Your outs': 'Je outs',
  'Right. Outs are the cards that would put you in front. Counting them is the first step to working out what you have, and it is exactly what the next module teaches.':
    'Klopt. Outs zijn de kaarten die je op voorsprong zouden zetten. Ze tellen is de eerste stap naar uitrekenen wat je hebt, en dat is precies wat de volgende module leert.',
  'Your equity': 'Je equity',
  'Very close, and the two are directly linked — but equity is the *percentage* those cards translate into (about 36% here). The nine cards themselves are the outs; the percentage is what you convert them into.':
    'Heel dichtbij, en de twee hangen direct samen — maar equity is het *percentage* waarin die kaarten zich vertalen (hier ongeveer 36%). De negen kaarten zelf zijn de outs; het percentage is waar je ze in omzet.',
  '**Equity** is how often your hand wins — a fact about your cards. **Required equity** is the threshold it has to beat — a fact about the money. Two separate numbers; neither turns into the other.':
    '**Equity** is hoe vaak je hand wint — een feit over je kaarten. **Benodigde equity** is de drempel die hij moet halen — een feit over het geld. Twee losse getallen; geen van beide verandert in het ander.',
  '**The pot** = every chip already bet when it is your turn, including the bet you are facing.':
    '**De pot** = elke chip die al ingezet is op het moment dat jij aan de beurt bent, inclusief de bet waar je tegenover staat.',
  '**Required equity** = your call ÷ (the pot + your call) — that is, your share of the final pot.':
    '**Benodigde equity** = jouw call ÷ (de pot + jouw call) — oftewel jouw aandeel in de uiteindelijke pot.',
  'Half pot → 25%. Full pot → 33%. Bigger bets always demand more.':
    'Halve pot → 25%. Hele pot → 33%. Grotere bets vragen altijd meer.',
  'Compare what you **need** against what you **have**, and call when have ≥ need.':
    'Zet wat je **nodig hebt** af tegen wat je **hebt**, en call als hebben ≥ nodig.',
  'Say the sentence out loud before every call: "I call X to win Y, so I need Z%."':
    'Zeg de zin hardop voor elke call: "Ik call X om Y te winnen, dus ik heb Z% nodig."',
  '`required equity  =  your call  ÷  (the pot + your call)`':
    '`benodigde equity  =  jouw call  ÷  (de pot + jouw call)`',
  /* ---------------------------------------------------------------- *
   * Lesson: Outs & Equity
   * ---------------------------------------------------------------- */
  'Pot odds tell you what you need. Outs tell you what you have. This is the other half of every drawing decision.':
    'Pot odds vertellen je wat je nodig hebt. Outs vertellen je wat je hebt. Dit is de andere helft van elke drawbeslissing.',
  'An out is a card that rescues you': 'Een out is een kaart die je redt',
  'You are behind. There are cards still to come. An **out** is any card that would put you in front.':
    'Je ligt achter. Er moeten nog kaarten komen. Een **out** is elke kaart die je op voorsprong zou zetten.',
  'The method is mechanical: work out what beats you now, then count the specific cards that change that.':
    'De methode is mechanisch: bepaal wat je nu verslaat, en tel dan de specifieke kaarten die dat veranderen.',
  'Say you hold two hearts and there are two more hearts on the flop. Any further heart completes your flush. There are 13 hearts in a deck and you can see four of them, so **nine hearts are still unseen**. Nine outs.':
    'Stel dat je twee harten hebt en er liggen nog twee harten op de flop. Elke volgende hart maakt je flush af. Er zitten 13 harten in een pak en vier daarvan zie je, dus **negen harten zijn nog ongezien**. Negen outs.',
  'One thing to be precise about, because it is the part people quietly worry about: you count **unseen** cards, not "cards left in the deck". Some of those nine hearts may well be sitting in an opponent’s hand right now.':
    'Eén ding om precies in te zijn, want hier zitten mensen stilletjes over te twijfelen: je telt **ongeziene** kaarten, niet "kaarten die nog in het pak zitten". Sommige van die negen harten zitten op dit moment misschien in de hand van een tegenstander.',
  'It genuinely does not matter. From where you sit, every card you cannot see is equally likely to be the next one turned over — a heart in someone’s hand and a heart in the deck are the same thing to you, because you have no way to tell them apart. That is why the count works.':
    'Dat maakt echt niet uit. Vanaf jouw stoel is elke kaart die je niet kunt zien even waarschijnlijk de volgende die omgedraaid wordt — een hart in iemands hand en een hart in het pak zijn voor jou hetzelfde, want je kunt ze op geen enkele manier uit elkaar houden. Daarom werkt de telling.',
  'That is all counting outs is — how many unseen cards win the hand for you.':
    'Meer is outs tellen niet — hoeveel ongeziene kaarten de hand voor je winnen.',
  'You hold two hearts, and two more hearts are on the flop. How many hearts are still unseen?':
    'Je hebt twee harten, en er liggen nog twee harten op de flop. Hoeveel harten zijn er nog ongezien?',
  'Right. Thirteen hearts in a deck, four of them in plain sight, so nine are unseen. This is the single most common draw in poker and the number worth knowing cold.':
    'Klopt. Dertien harten in een pak, vier daarvan liggen open, dus negen zijn ongezien. Dit is verreweg de meest voorkomende draw in poker en het getal dat je uit je hoofd moet kennen.',
  'That subtracts only your two hole cards. The two hearts on the flop are face up as well, so four are accounted for: 13 − 4 = 9.':
    'Dat trekt alleen je twee eigen kaarten af. De twee harten op de flop liggen ook open, dus vier zijn er bekend: 13 − 4 = 9.',
  'That is every heart in the deck, before taking away the four you can already see. Nine are left unseen.':
    'Dat is elk hart in het pak, vóór je de vier aftrekt die je al kunt zien. Er blijven er negen ongezien.',
  'The counts worth memorising': 'De aantallen die het waard zijn om te onthouden',
  'A handful of draws come up constantly. Learn these and you will rarely have to count from scratch.':
    'Een handvol draws komt voortdurend voorbij. Leer deze en je hoeft zelden nog vanaf nul te tellen.',
  'The two big ones are the [[flush draw|flush draw at nine]] and the [[open-ended straight draw|open-ended straight draw at eight]] — four cards at each end of your run.':
    'De twee grote zijn de [[flush draw|flush draw met negen]] en de [[open-ended straight draw|open-ended straight draw met acht]] — vier kaarten aan elk uiteinde van je reeks.',
  'An inside straight draw — a [[gutshot]] — has only one rank that fills it, so four cards: half of an open-ended draw, and it shows in how rarely it is worth calling.':
    'Een inside straight draw — een [[gutshot]] — heeft maar één waarde die hem vult, dus vier kaarten: de helft van een open-ended draw, en dat zie je terug in hoe zelden hij een call waard is.',
  'And the monster: a flush draw *and* an open-ended straight draw at once gives roughly **15 outs**, which is actually a favourite against many made hands.':
    'En het monster: een flush draw *en* een open-ended straight draw tegelijk geeft ongeveer **15 outs**, wat tegen veel gemaakte handen zelfs favoriet is.',
  'Draw': 'Draw',
  'Example': 'Voorbeeld',
  'Two hearts in hand, two on board': 'Twee harten in de hand, twee op het bord',
  'Open-ended straight': 'Open-ended straight',
  '9-8 on a 7-6-2 board': '9-8 op een bord van 7-6-2',
  'Gutshot straight': 'Gutshot straight',
  '9-8 on a 6-5-2 board (needs a 7)': '9-8 op een bord van 6-5-2 (heeft een 7 nodig)',
  'A-K on a 7-4-2 board': 'A-K op een bord van 7-4-2',
  'Flush + open-ended': 'Flush + open-ended',
  'The best draw in poker': 'De beste draw in poker',
  'You hold 9-8 and the board is 7-6-2. How many outs do you have to a straight?':
    'Je hebt 9-8 en het bord is 7-6-2. Hoeveel outs heb je naar een straight?',
  '8 — any ten or any five completes it': '8 — elke tien of elke vijf maakt hem af',
  'Right. Four tens make 10-9-8-7-6 and four fives make 9-8-7-6-5. Open at both ends, so eight cards, which is why it is called an open-ended draw.':
    'Klopt. Vier tienen maken 10-9-8-7-6 en vier vijven maken 9-8-7-6-5. Aan beide kanten open, dus acht kaarten — daarom heet het een open-ended draw.',
  '4 — only a ten completes it': '4 — alleen een tien maakt hem af',
  'A ten works, but so does a five: 9-8-7-6-5 is equally a straight. Your run is open at both ends, giving eight outs rather than four.':
    'Een tien werkt, maar een vijf ook: 9-8-7-6-5 is net zo goed een straight. Je reeks is aan beide kanten open, wat acht outs geeft in plaats van vier.',
  '2 — one ten and one five': '2 — één tien en één vijf',
  'There are four of each rank in a deck, not one. Four tens plus four fives is eight cards.':
    'Er zitten vier van elke waarde in een pak, niet één. Vier tienen plus vier vijven is acht kaarten.',
  'The rule of 4 and 2': 'De regel van 4 en 2',
  'Once you have counted your outs, you need to turn that into a percentage. The shortcut is simple enough to do instantly:':
    'Zodra je je outs geteld hebt, moet je dat omzetten in een percentage. De vuistregel is simpel genoeg om meteen te doen:',
  '**On the flop** (two cards still to come): multiply your outs by **4**.':
    '**Op de flop** (nog twee kaarten te komen): vermenigvuldig je outs met **4**.',
  '**On the turn** (one card to come): multiply your outs by **2**.':
    '**Op de turn** (nog één kaart te komen): vermenigvuldig je outs met **2**.',
  'So a nine-out flush draw is roughly 9 × 4 = **36%** on the flop, and 9 × 2 = **18%** on the turn.':
    'Een flush draw met negen outs is dus ongeveer 9 × 4 = **36%** op de flop, en 9 × 2 = **18%** op de turn.',
  'Where does the 2 come from? Count the unseen cards. On the flop you can see your own two plus the three on the board, so 52 − 5 = **47** are unseen, and one of those 47 is about **2%**. On the turn there is one more card showing, so 52 − 6 = **46** unseen — still about 2% each.':
    'Waar komt die 2 vandaan? Tel de ongeziene kaarten. Op de flop zie je je eigen twee plus de drie op het bord, dus 52 − 5 = **47** zijn ongezien, en één van die 47 is ongeveer **2%**. Op de turn ligt er nog een kaart open, dus 52 − 6 = **46** ongezien — nog steeds ongeveer 2% per stuk.',
  'So an out is worth roughly 2% for every card still to come. One card left, multiply by 2. Two cards left, multiply by 4.':
    'Een out is dus ongeveer 2% waard voor elke kaart die nog moet komen. Nog één kaart, vermenigvuldig met 2. Nog twee kaarten, vermenigvuldig met 4.',
  'Two cards to come is not simply twice one card, though, and it is worth seeing why. Adding the two chances together counts the times you hit on **both** cards twice over — once in each half of the sum — so plain addition overshoots.':
    'Twee kaarten te komen is echter niet simpelweg twee keer één kaart, en het is de moeite waard om te zien waarom. De twee kansen bij elkaar optellen telt de keren dat je op **beide** kaarten raakt dubbel — één keer in elke helft van de som — dus gewoon optellen schiet door.',
  'With nine outs, adding honestly gives 38.7%, and that double-counted overlap is worth about 3%. Take it off and you land on the true **35%**.':
    'Met negen outs geeft eerlijk optellen 38,7%, en die dubbel getelde overlap is ongeveer 3% waard. Trek die eraf en je komt uit op de echte **35%**.',
  'Here is the neat part. Rounding each out down from 2.1% to a flat 2% shaves off almost exactly that overlap, which is why the crude 9 × 4 = **36%** sits so close to the real 35%. The shortcut works because two errors cancel.':
    'Dit is het mooie. Elke out afronden van 2,1% naar een ronde 2% haalt er bijna precies die overlap af, en daarom zit de grove 9 × 4 = **36%** zo dicht bij de echte 35%. De vuistregel werkt doordat twee fouten elkaar opheffen.',
  'They stop cancelling when you have a lot of outs, because the overlap grows faster than the rounding saves. At fifteen outs the overlap is nearly 10%, so 15 × 4 = 60% overshoots the true **54%**.':
    'Ze heffen elkaar niet meer op als je veel outs hebt, omdat de overlap sneller groeit dan het afronden bespaart. Bij vijftien outs is de overlap bijna 10%, dus 15 × 4 = 60% schiet voorbij de echte **54%**.',
  'The rule of 2 has the opposite, smaller problem: it **runs a little low**. One card in 46 is 2.2%, not 2.0%, and with only one card to come there is no overlap for that rounding to cancel out. Nine outs on the turn is really about **20%**, not the 18% the shortcut gives.':
    'De regel van 2 heeft het omgekeerde, kleinere probleem: hij **valt iets te laag uit**. Eén kaart op 46 is 2,2%, niet 2,0%, en met nog maar één kaart te komen is er geen overlap die dat afronden kan opheffen. Negen outs op de turn is in werkelijkheid ongeveer **20%**, niet de 18% die de vuistregel geeft.',
  'Neither drift is ever big enough to change what you should do, which is the entire point of a shortcut.':
    'Geen van beide afwijkingen is ooit groot genoeg om te veranderen wat je zou moeten doen, en dat is precies het nut van een vuistregel.',
  'You have an open-ended straight draw on the flop. Roughly what is your equity?':
    'Je hebt een open-ended straight draw op de flop. Hoeveel equity heb je ongeveer?',
  'About 32% — that is 8 outs × 4': 'Ongeveer 32% — dat is 8 outs × 4',
  'Right. Eight outs with two cards to come, so multiply by 4. The exact figure is 31.5%, which is close enough that the shortcut never changes your decision.':
    'Klopt. Acht outs met nog twee kaarten te komen, dus vermenigvuldig met 4. Het exacte getal is 31,5%, en dat zit zo dichtbij dat de vuistregel je beslissing nooit verandert.',
  'About 16% — that is 8 outs × 2': 'Ongeveer 16% — dat is 8 outs × 2',
  'That is the rule for the *turn*, when only one card remains. On the flop two cards are still coming, so you double it: 8 × 4 = 32%.':
    'Dat is de regel voor de *turn*, wanneer er nog maar één kaart over is. Op de flop komen er nog twee kaarten, dus je verdubbelt het: 8 × 4 = 32%.',
  'About 50% — a straight draw is a coin flip': 'Ongeveer 50% — een straight draw is kop of munt',
  'Draws feel closer to even than they are. Eight outs twice over is about 32%, so you will miss this draw roughly two times in three.':
    'Draws voelen dichter bij fifty-fifty dan ze zijn. Acht outs twee keer is ongeveer 32%, dus je mist deze draw ruwweg twee van de drie keer.',
  'Not every out is clean': 'Niet elke out is schoon',
  'The count you make is the optimistic version. Some of those cards win you the hand — and some hand it to your opponent instead.':
    'De telling die je maakt is de optimistische versie. Sommige van die kaarten winnen de hand voor je — en sommige geven hem juist aan je tegenstander.',
  'Say you are drawing to a straight, but the board has two cards of one suit. The card that completes your straight might also complete somebody’s flush. It looked like an out; it was actually a trap.':
    'Stel dat je naar een straight trekt, maar het bord heeft twee kaarten van één kleur. De kaart die jouw straight afmaakt, maakt misschien ook iemands flush af. Het leek een out; het was een valstrik.',
  'The habit is to **discount** the doubtful ones. If you count eight outs but two of them also bring in an obvious flush, treat it as six.':
    'De gewoonte is om de twijfelachtige eraf te **trekken**. Tel je acht outs maar brengen er twee ook een voor de hand liggende flush binnen, reken dan met zes.',
  'This is also why the trainer’s outs drills sometimes give a number lower than you expect — they count only the cards that genuinely leave you in front, which is the number that actually matters.':
    'Daarom geven de outs-oefeningen in deze trainer soms ook een lager getal dan je verwacht — ze tellen alleen de kaarten die je echt op voorsprong laten staan, en dat is het getal dat er werkelijk toe doet.',
  'You have an open-ended straight draw (8 outs), but two of those cards would also complete a flush for your opponent. How should you count it?':
    'Je hebt een open-ended straight draw (8 outs), maar twee van die kaarten zouden ook een flush voor je tegenstander afmaken. Hoe tel je dat?',
  'About 6 outs — discount the two that could lose':
    'Ongeveer 6 outs — trek de twee eraf die kunnen verliezen',
  'Right. Cards that complete your hand and a better one at the same time are not outs at all. Being slightly pessimistic here keeps you out of the pots that are most expensive to be wrong in.':
    'Klopt. Kaarten die tegelijk jouw hand en een betere afmaken zijn helemaal geen outs. Hier iets pessimistisch zijn houdt je uit de potten waarin ongelijk hebben het duurst is.',
  'Still 8 — they complete your straight either way': 'Nog steeds 8 — ze maken je straight hoe dan ook af',
  'They complete your straight, but that is not the test. An out has to leave you *winning*, and a straight that loses to a flush has cost you money rather than saved it.':
    'Ze maken je straight af, maar dat is niet de toets. Een out moet je *winnend* achterlaten, en een straight die van een flush verliest heeft je geld gekost in plaats van bespaard.',
  '10 — the flush cards give you extra ways to win':
    '10 — de flushkaarten geven je extra manieren om te winnen',
  'Those cards make the flush for your opponent, not for you. They belong on the other side of the ledger, which is why the count comes down to about six.':
    'Die kaarten maken de flush voor je tegenstander, niet voor jou. Ze horen aan de andere kant van de streep, en daarom komt de telling uit op ongeveer zes.',
  'An out is an unseen card that puts you in front — count them, do not estimate.':
    'Een out is een ongeziene kaart die je op voorsprong zet — tel ze, schat ze niet.',
  'Flush draw = 9. Open-ended straight = 8. Gutshot = 4. Both draws together = 15.':
    'Flush draw = 9. Open-ended straight = 8. Gutshot = 4. Beide draws samen = 15.',
  'Flop: outs × 4. Turn: outs × 2. That works because an out is ~2% per card to come (47 unseen on the flop, 46 on the turn).':
    'Flop: outs × 4. Turn: outs × 2. Dat werkt omdat een out ongeveer 2% per nog te komen kaart waard is (47 ongezien op de flop, 46 op de turn).',
  'The shortcut runs a little high on the flop and a little low on the turn — never enough to change a decision.':
    'De vuistregel valt op de flop iets te hoog uit en op de turn iets te laag — nooit genoeg om een beslissing te veranderen.',
  'Discount outs that would also complete a better hand for someone else.':
    'Trek outs af die ook een betere hand voor iemand anders zouden afmaken.',
  'Two [[overcard|overcards]]': 'Twee [[overcard|overcards]]',
  /* ---------------------------------------------------------------- *
   * Lesson: Preflop Ranges
   * ---------------------------------------------------------------- */
  'More money is lost before the flop than anywhere else, by playing hands that were never going to be profitable. This is also the only street you can genuinely memorise.':
    'Er gaat vóór de flop meer geld verloren dan waar dan ook, door handen te spelen die nooit winstgevend gingen worden. Het is ook de enige street die je echt uit je hoofd kunt leren.',
  'Why position decides how many hands you play': 'Waarom positie bepaalt hoeveel handen je speelt',
  'The single biggest factor in whether a hand is playable is not the cards. It is **how many people still get to act behind you**.':
    'De grootste factor of een hand speelbaar is, zijn niet de kaarten. Het is **hoeveel mensen er na jou nog aan de beurt komen**.',
  'Open from the first seat and five players remain who might wake up with something better. Open from the button and only two do — and both of them will be out of position for the whole hand.':
    'Open je vanaf de eerste stoel, dan blijven er vijf spelers over die met iets beters wakker kunnen worden. Open je op de button, dan zijn dat er maar twee — en die zitten allebei de hele hand out of position.',
  'So the further from the button you sit, the tighter you have to be. This is not caution; it is arithmetic. The same hand is profitable in one seat and loses money in another.':
    'Hoe verder je van de button zit, hoe strakker je dus moet zijn. Dat is geen voorzichtigheid; het is rekenwerk. Dezelfde hand is winstgevend op de ene stoel en verliest geld op de andere.',
  'These are the baseline [[open|opening]] ranges this trainer grades you against.':
    'Dit zijn de basis [[open|opening]] ranges waarop deze trainer je beoordeelt.',
  'Look at the last row, because it breaks the pattern. The small blind has **fewer** players left to act than the button, yet it opens **tighter**, not wider. That is not a mistake in the table — it is the second half of the idea, and it comes next.':
    'Kijk naar de laatste rij, want die doorbreekt het patroon. De small blind heeft **minder** spelers achter zich dan de button, en opent toch **strakker**, niet ruimer. Dat is geen fout in de tabel — het is de tweede helft van het idee, en die komt hierna.',
  'Seat': 'Stoel',
  'Players behind': 'Spelers achter je',
  'Open this often': 'Zo vaak openen',
  'Under the gun': 'Under the gun',
  'Hijack': 'Hijack',
  'Cutoff': 'Cutoff',
  'Button': 'Button',
  'Small blind': 'Small blind',
  'You hold K-9 suited. It is a clear fold under the gun but a clear raise on the button. Why?':
    'Je hebt K-9 suited. Under the gun is dat een duidelijke fold, op de button een duidelijke raise. Waarom?',
  'Five players can still wake up behind you under the gun; only two can on the button':
    'Under the gun kunnen er nog vijf spelers achter je wakker worden; op de button maar twee',
  'Exactly. The hand has not changed — the risk of running into something better has. Fewer players behind means fewer ways to be beaten, so more hands become profitable.':
    'Precies. De hand is niet veranderd — het risico om tegen iets beters aan te lopen wel. Minder spelers achter je betekent minder manieren om verslagen te worden, dus worden meer handen winstgevend.',
  'K-9 suited is a stronger hand on the button': 'K-9 suited is een sterkere hand op de button',
  'The hand is identical in both seats. What changes is how many opponents are left to act and whether you will have position on them afterwards.':
    'De hand is op beide stoelen identiek. Wat verandert is hoeveel tegenstanders er nog aan de beurt komen en of je daarna positie op ze hebt.',
  'The blinds are closer, so you win more': 'De blinds zijn dichterbij, dus je wint meer',
  'Stealing the blinds is part of it, but the main reason is simpler: with only two players left to act, the chance that someone behind holds a better hand is far lower.':
    'De blinds stelen speelt mee, maar de hoofdreden is eenvoudiger: met nog maar twee spelers aan de beurt is de kans dat iemand achter je een betere hand heeft veel kleiner.',
  'The small blind puzzle: position is two things, not one':
    'De small blind puzzel: positie is twee dingen, niet één',
  'If the rule were only "fewer players behind means you can open wider", the small blind — with a single opponent left to act — should be the widest seat at the table. It is not. It opens tighter than the button.':
    'Als de regel alleen was "minder spelers achter je betekent ruimer openen", dan zou de small blind — met nog één tegenstander aan de beurt — de ruimste stoel aan tafel moeten zijn. Dat is hij niet. Hij opent strakker dan de button.',
  'The reason is that being in a good seat means **two separate advantages**, and the small blind gets one of them while losing the other.':
    'De reden is dat op een goede stoel zitten **twee losse voordelen** betekent, en de small blind krijgt er één terwijl hij de andere verliest.',
  '**Before the flop:** how many players can still wake up with a better hand. Fewer is better. The small blind wins here — only the big blind is left.':
    '**Vóór de flop:** hoeveel spelers er nog met een betere hand wakker kunnen worden. Minder is beter. De small blind wint hier — alleen de big blind is nog over.',
  '**After the flop:** whether you act last on every remaining street. Acting last is better, because you decide with information everyone else had to act without. The small blind loses here badly — it acts **first** on the flop, the turn and the river, every single time, for the rest of the hand.':
    '**Na de flop:** of je op elke resterende street als laatste handelt. Als laatste handelen is beter, want je beslist met informatie waar alle anderen het zonder moesten doen. De small blind verliest hier zwaar — hij handelt **als eerste** op de flop, de turn en de river, elke keer weer, de hele verdere hand.',
  'The button collects both advantages, which is why it is the widest opening seat in poker and the most profitable seat at the table. The small blind collects one and forfeits the other, which is why it sits between the cutoff and the button rather than above them.':
    'De button pakt beide voordelen, en daarom is het de ruimst openende stoel in poker en de meest winstgevende plek aan tafel. De small blind pakt er één en levert de andere in, en daarom zit hij tussen de cutoff en de button in plaats van erboven.',
  'This is also why you will hear that [[position]] is worth more than cards. It is not one edge you get once — it is an edge that repeats on every street of every hand you play.':
    'Daarom hoor je ook dat [[position|positie]] meer waard is dan kaarten. Het is geen voordeel dat je één keer krijgt — het is een voordeel dat zich herhaalt op elke street van elke hand die je speelt.',
  'The small blind has only one player left to act, yet opens tighter than the button. Why?':
    'De small blind heeft nog maar één speler aan de beurt en opent toch strakker dan de button. Waarom?',
  'It will act first on every street after the flop': 'Hij handelt na de flop op elke street als eerste',
  'Exactly. Few players behind is only half of what makes a seat good. The small blind wins that half and loses the other one, and acting first for the whole rest of the hand is the more expensive of the two.':
    'Precies. Weinig spelers achter je is maar de helft van wat een stoel goed maakt. De small blind wint die helft en verliest de andere, en de hele verdere hand als eerste handelen is de duurste van de twee.',
  'It has already put money in, so it needs a stronger hand':
    'Hij heeft al geld ingelegd, dus heeft hij een sterkere hand nodig',
  'Money already posted is gone either way and should not change what you play — that is the same sunk-cost trap as counting chips you put in earlier when working out pot odds. What actually costs the small blind is acting first on every later street.':
    'Geld dat al gepost is, is hoe dan ook weg en zou niet moeten veranderen wat je speelt — dat is dezelfde sunk-cost valkuil als chips meetellen die je eerder inlegde bij het uitrekenen van pot odds. Wat de small blind werkelijk kost, is op elke latere street als eerste handelen.',
  'The big blind gets to act last before the flop': 'De big blind handelt vóór de flop als laatste',
  'True, and it is a small factor, but it is not the main one. The decisive problem is after the flop: the small blind acts first on every remaining street, for the whole hand.':
    'Klopt, en het is een kleine factor, maar niet de belangrijkste. Het doorslaggevende probleem zit na de flop: de small blind handelt op elke resterende street als eerste, de hele hand lang.',
  'Reading the shorthand': 'De notatie lezen',
  'Ranges are written in a compact notation, and it is used everywhere — in the drills, on the Charts tab, and in every chart you will ever see elsewhere. It takes two minutes to learn and nothing else in this module makes sense without it.':
    'Ranges worden in een compacte notatie geschreven, en die wordt overal gebruikt — in de oefeningen, op het tabblad Charts, en in elke chart die je elders ooit zult zien. Het kost twee minuten om te leren en niets anders in deze module is zonder die notatie te begrijpen.',
  'Two letters are the ranks. A third letter says whether the suits match: **s** for [[suited]], **o** for [[offsuit]]. A pair needs no third letter, since two cards of the same rank can never share a suit.':
    'Twee letters zijn de waarden. Een derde letter zegt of de kleuren overeenkomen: **s** voor [[suited]], **o** voor [[offsuit]]. Een pair heeft geen derde letter nodig, want twee kaarten van dezelfde waarde kunnen nooit dezelfde kleur hebben.',
  'A **+** means "and everything better of this kind". So `22+` is every pair, and `A2s+` is every suited ace from A2s up to AKs.':
    'Een **+** betekent "en alles wat van dit soort beter is". Dus `22+` is elk pair, en `A2s+` is elke suited aas van A2s tot en met AKs.',
  'The last column is the one people skip, and it is the one that makes the percentages make sense. A single pair of ranks is not one hand — it is several **[[combo|combinations]]**, and the count depends on the suits.':
    'De laatste kolom is degene die mensen overslaan, en juist die maakt de percentages begrijpelijk. Eén paar waarden is niet één hand — het zijn meerdere **[[combo|combinaties]]**, en het aantal hangt af van de kleuren.',
  'There are **1,326** possible two-card hands in a 52-card deck, and that is what a range percentage counts. "Opening 18%" means about 238 of those 1,326 combinations — not 18% of the squares on a chart. An offsuit square is worth three suited squares, which is why a grid that looks mostly empty can still be a wide range.':
    'Er zijn **1.326** mogelijke tweekaartshanden in een pak van 52, en dat is wat een range-percentage telt. "18% openen" betekent ongeveer 238 van die 1.326 combinaties — niet 18% van de vakjes op een chart. Een offsuit vakje is drie suited vakjes waard, en daarom kan een raster dat er grotendeels leeg uitziet toch een ruime range zijn.',
  'Written': 'Geschreven',
  'Means': 'Betekent',
  'Combos': 'Combos',
  'a pair of aces': 'een paar azen',
  'ace-king, same suit': 'aas-heer, dezelfde kleur',
  'ace-king, different suits': 'aas-heer, verschillende kleuren',
  'every pair from 22 up': 'elk pair vanaf 22',
  'every suited ace': 'elke suited aas',
  'Which is more combinations: AKs or AKo?': 'Wat zijn meer combinaties: AKs of AKo?',
  'AKo — three times as many': 'AKo — drie keer zoveel',
  'Right. Suited AK needs both cards in the same suit, so there are only four. Offsuit AK can be any mismatched pair of suits: 4 × 3 = 12. This is why offsuit hands take up so much of a range by volume.':
    'Klopt. Suited AK heeft beide kaarten in dezelfde kleur nodig, dus er zijn er maar vier. Offsuit AK kan elke niet-overeenkomende combinatie van kleuren zijn: 4 × 3 = 12. Daarom nemen offsuit handen qua volume zoveel van een range in beslag.',
  'AKs — suited hands are stronger': 'AKs — suited handen zijn sterker',
  'Stronger, yes, but that is a different question from how many there are. Only four combinations of AK share a suit, against twelve that do not.':
    'Sterker, ja, maar dat is een andere vraag dan hoeveel er zijn. Maar vier combinaties van AK delen een kleur, tegenover twaalf die dat niet doen.',
  'They are the same — one square each on the chart':
    'Ze zijn gelijk — allebei één vakje op de chart',
  'One square each on the grid, but the squares are not equal weight. AKs is 4 combinations and AKo is 12, which is exactly why range percentages count combinations rather than squares.':
    'Allebei één vakje op het raster, maar de vakjes wegen niet even zwaar. AKs is 4 combinaties en AKo is er 12, en precies daarom tellen range-percentages combinaties in plaats van vakjes.',
  'Raise or fold — almost never limp': 'Raise of fold — bijna nooit limpen',
  'Just calling the big blind — [[limp|limping]] — is the most common beginner habit and one of the most expensive.':
    'Alleen de big blind callen — [[limp|limpen]] — is de meest voorkomende beginnersgewoonte en een van de duurste.',
  'Three things go wrong at once. You **give up the initiative**, so whoever bets first after the flop takes control. You **invite everyone in cheaply**, which is the opposite of what you want with a hand you have doubts about. And you **cap your range** — good players know a limp means you do not have a premium, and attack accordingly.':
    'Er gaan drie dingen tegelijk mis. Je **geeft het initiatief weg**, dus wie na de flop als eerste bet neemt de controle. Je **nodigt iedereen goedkoop uit**, wat het tegenovergestelde is van wat je wilt met een hand waar je aan twijfelt. En je **zet een plafond op je range** — goede spelers weten dat een limp betekent dat je geen premium hebt, en vallen daarop aan.',
  'A raise does the reverse: it can win the pot immediately, it builds a pot when you are strong, and it makes your hand hard to read because your strong and speculative hands arrive the same way.':
    'Een raise doet het omgekeerde: hij kan de pot meteen winnen, hij bouwt een pot als je sterk bent, en hij maakt je hand moeilijk te lezen omdat je sterke en speculatieve handen op dezelfde manier binnenkomen.',
  'The rule is blunt and it is right: **if a hand is worth playing, it is worth raising. If it is not worth raising, fold it.**':
    'De regel is bot en hij klopt: **is een hand het spelen waard, dan is hij het raisen waard. Is hij het raisen niet waard, fold hem dan.**',
  'You are on the button with 7-6 suited and everyone has folded to you. What is your play?':
    'Je zit op de button met 7-6 suited en iedereen heeft naar jou gefold. Wat doe je?',
  'Raise': 'Raise',
  'Right. Suited connectors are well inside a button opening range, and raising gives you two ways to win: they fold now, or you play a pot in position with a hand that flops well.':
    'Klopt. Suited connectors zitten ruim binnen een button opening range, en raisen geeft je twee manieren om te winnen: ze folden nu, of je speelt een pot in positie met een hand die goed flopt.',
  'Limp — it is a speculative hand, so keep it cheap':
    'Limp — het is een speculatieve hand, dus hou het goedkoop',
  'The intuition is understandable but backwards. Limping invites the blinds in cheaply, which is the worst outcome for a hand that wants either to win now or to play against one opponent. Raise or fold.':
    'De intuïtie is begrijpelijk maar omgekeerd. Limpen nodigt de blinds goedkoop uit, en dat is de slechtste uitkomst voor een hand die óf nu wil winnen óf tegen één tegenstander wil spelen. Raise of fold.',
  'Fold — 7-6 suited is too weak': 'Fold — 7-6 suited is te zwak',
  'Far too tight for the button, where you should be opening roughly half your hands. Suited connectors flop straights and flushes, and you will have position for the rest of the hand.':
    'Veel te strak voor de button, waar je ongeveer de helft van je handen zou moeten openen. Suited connectors floppen straights en flushes, en je hebt de rest van de hand positie.',
  'Domination is what actually costs you': 'Domination is wat je werkelijk geld kost',
  'The hands that lose the most money are not the obviously bad ones. Nobody goes broke with 7-2. The expensive hands are the ones that look strong and are [[dominated]].':
    'De handen die het meeste geld verliezen zijn niet de duidelijk slechte. Niemand gaat failliet met 7-2. De dure handen zijn de handen die er sterk uitzien en [[dominated]] zijn.',
  'Domination means sharing your best card with an opponent who holds a better second card. A-J against A-K, K-10 against K-Q.':
    'Domination betekent dat je je beste kaart deelt met een tegenstander die een betere tweede kaart heeft. A-J tegen A-K, K-10 tegen K-Q.',
  'What makes it so costly is that domination hits precisely when you think you are winning. You flop an ace with A-J, feel delighted, and then pay off someone with A-K over three streets.':
    'Wat het zo duur maakt, is dat domination juist toeslaat wanneer je denkt dat je wint. Je flopt een aas met A-J, bent dolblij, en betaalt vervolgens iemand met A-K over drie streets af.',
  'This is the real reason to fold decent-looking hands against early-position raisers. Against a range of roughly the top 18% of hands, A-J is not a hand that wins — it is a hand that finds out it was second best after putting in a lot of money.':
    'Dit is de echte reden om er redelijk uitziende handen te folden tegen raisers uit vroege positie. Tegen een range van ruwweg de beste 18% van de handen is A-J geen hand die wint — het is een hand die er na veel geld inleggen achter komt dat hij tweede was.',
  'An extremely tight player raises from under the gun. You hold A-J offsuit. What is the problem with calling?':
    'Een extreem tighte speler raiset under the gun. Jij hebt A-J offsuit. Wat is het probleem met callen?',
  'Most of their range dominates you — A-K, A-Q, and every big pair':
    'Het grootste deel van hun range domineert je — A-K, A-Q en elk groot pair',
  'Right. When you flop an ace you are usually behind a better ace, and when you miss you have nothing. You get paid a little by worse and stacked by better.':
    'Klopt. Als je een aas flopt lig je meestal achter een betere aas, en als je mist heb je niets. Slechtere handen betalen je een beetje, betere pakken je stack.',
  'A-J is a weak hand': 'A-J is een zwakke hand',
  'A-J is genuinely strong in the abstract — it is a comfortable open from late position. The problem is entirely about *this* opponent: their raising range is narrow and most of it beats you.':
    'A-J is op zichzelf echt sterk — het is een comfortabele open vanuit late positie. Het probleem gaat volledig over *deze* tegenstander: hun raise-range is smal en het grootste deel ervan verslaat je.',
  'You will be out of position': 'Je zit out of position',
  'A real cost, and worth weighing, but not the main one here. Even in position A-J struggles against a top-5% range because so much of that range shares your ace with a better kicker.':
    'Een reële kostenpost, en het overwegen waard, maar hier niet de belangrijkste. Zelfs in positie heeft A-J het moeilijk tegen een top-5% range, omdat zo’n groot deel van die range je aas deelt met een betere kicker.',
  'How wide you open is set by two things: how many players act after you, and whether you will act last after the flop. The button wins both, which is why it opens widest.':
    'Hoe ruim je opent wordt door twee dingen bepaald: hoeveel spelers na jou handelen, en of je na de flop als laatste handelt. De button wint allebei, en daarom opent hij het ruimst.',
  'Shorthand: **s** = suited, **o** = offsuit, no letter = a pair, **+** = "and better". A pair is 6 combos, suited 4, offsuit 12, out of 1,326 in total.':
    'Notatie: **s** = suited, **o** = offsuit, geen letter = een pair, **+** = "en beter". Een pair is 6 combos, suited 4, offsuit 12, van in totaal 1.326.',
  'Raise or fold. Limping surrenders initiative and tells opponents you are weak.':
    'Raise of fold. Limpen geeft het initiatief weg en vertelt tegenstanders dat je zwak bent.',
  'Domination — sharing your top card with a better kicker — is where the money goes.':
    'Domination — je hoogste kaart delen met een betere kicker — is waar het geld heen gaat.',
  'Fold good-looking hands like A-J against tight early-position raises.':
    'Fold goed ogende handen zoals A-J tegen tighte raises uit vroege positie.',
  /* ---------------------------------------------------------------- *
   * Lesson: Position
   * ---------------------------------------------------------------- */
  'Position is worth more than cards. If you take one idea from this trainer into a real game, make it this one.':
    'Positie is meer waard dan kaarten. Als je één idee uit deze trainer meeneemt naar een echt spel, maak het dan dit.',
  'Position means information': 'Positie betekent informatie',
  'Acting last is an information advantage, and it applies on **every single street**.':
    'Als laatste handelen is een informatievoordeel, en het geldt op **elke afzonderlijke street**.',
  'When you act after your opponent, you have already seen what they did. Their check, their bet, their sizing — all of it is information you get for free, and they had to act without any of it.':
    'Als jij na je tegenstander handelt, heb je al gezien wat hij deed. Zijn check, zijn bet, zijn betgrootte — dat is allemaal informatie die je gratis krijgt, en hij moest handelen zonder er iets van te weten.',
  'That is the entire mechanism. It sounds small written down and it is enormous in practice: the same hand, played from the same stack, wins money in position and loses money out of position.':
    'Dat is het hele mechanisme. Opgeschreven klinkt het klein en in de praktijk is het enorm: dezelfde hand, gespeeld vanaf dezelfde stack, wint geld in positie en verliest geld out of position.',
  'Which is why the button is the most profitable seat at the table and the blinds are the two losing seats — for everybody, including professionals.':
    'En daarom is de button de meest winstgevende stoel aan tafel en zijn de blinds de twee verliezende stoelen — voor iedereen, ook voor professionals.',
  'What is the actual advantage of acting last?': 'Wat is het werkelijke voordeel van als laatste handelen?',
  'You see what your opponent does before you have to decide':
    'Je ziet wat je tegenstander doet voordat jij moet beslissen',
  'Exactly. Every decision you make is better informed than theirs, on every street, for the whole hand. That compounds into a large edge over time.':
    'Precies. Elke beslissing die jij maakt is beter geïnformeerd dan die van hen, op elke street, de hele hand lang. Dat stapelt zich op tot een groot voordeel op termijn.',
  'You get to bet more': 'Je mag meer betten',
  'You can bet the same amounts from any seat. What changes is the quality of your information when you choose.':
    'Je kunt vanaf elke stoel dezelfde bedragen betten. Wat verandert is de kwaliteit van je informatie op het moment dat je kiest.',
  'You get better cards on the button': 'Je krijgt betere kaarten op de button',
  'Cards are dealt at random, so every seat gets the same hands in the long run. The button is profitable because of when you act, not what you are dealt.':
    'Kaarten worden willekeurig gedeeld, dus op de lange duur krijgt elke stoel dezelfde handen. De button is winstgevend door wanneer je handelt, niet door wat je krijgt.',
  'What position lets you actually do': 'Wat positie je werkelijk laat doen',
  'Three concrete abilities, all of which are unavailable out of position:':
    'Drie concrete mogelijkheden, die je out of position geen van alle hebt:',
  '**Take a free card.** With a draw, you can check behind and see the next card for nothing. Out of position you must either bet or check and risk facing a bet.':
    '**Een gratis kaart pakken.** Met een draw kun je achter checken en de volgende kaart voor niets zien. Out of position moet je óf betten óf checken en het risico lopen een bet voor je te krijgen.',
  '**Control the pot size.** You decide whether the pot grows, because you always act with full information about the street so far.':
    '**De potgrootte sturen.** Jij bepaalt of de pot groeit, omdat je altijd handelt met volledige informatie over de street tot dan toe.',
  '**Bluff far more accurately.** You bluff after seeing weakness rather than guessing at it, which makes the bluffs much likelier to work.':
    '**Veel nauwkeuriger bluffen.** Je bluft nadat je zwakte hebt gezien in plaats van ernaar te gissen, wat de bluffs veel vaker doet werken.',
  'Out of position you get none of this. You act first with less information, every street, all hand.':
    'Out of position krijg je hier niets van. Je handelt als eerste met minder informatie, elke street, de hele hand.',
  'You have a flush draw on the flop and your opponent checks to you in position. What can you do that you could not do out of position?':
    'Je hebt een flush draw op de flop en je tegenstander checkt naar je terwijl jij in positie zit. Wat kun je doen dat je out of position niet kon?',
  'Check behind and see the turn for free': 'Achter checken en de turn gratis zien',
  'Right. Out of position you would have to act first and might face a bet you cannot profitably call. In position, checking guarantees you see the next card at no cost.':
    'Klopt. Out of position zou je als eerste moeten handelen en mogelijk een bet voor je krijgen die je niet winstgevend kunt callen. In positie garandeert checken dat je de volgende kaart gratis ziet.',
  'Bet larger than you otherwise could': 'Groter betten dan je anders zou kunnen',
  'Bet sizing does not depend on position — you could make the same bet from either seat. The free card is what position uniquely buys you.':
    'Betgrootte hangt niet van positie af — je zou dezelfde bet vanaf beide stoelen kunnen maken. De gratis kaart is wat positie je als enige oplevert.',
  'See their cards': 'Hun kaarten zien',
  'You never see their cards until showdown. What you see is their *action*, which is information enough to make better decisions than they can.':
    'Je ziet hun kaarten pas bij de showdown. Wat je ziet is hun *actie*, en dat is informatie genoeg om betere beslissingen te maken dan zij kunnen.',
  'Defending the big blind — wide, but not endlessly':
    'De big blind verdedigen — ruim, maar niet eindeloos',
  'The big blind is a special case, and the reason is a discount.':
    'De big blind is een bijzonder geval, en de reden is korting.',
  'You have already posted one big blind. If someone raises to 2.5, calling costs you only **1.5 more** to play for a pot that already holds around 4. That price is far better than anyone else at the table is getting.':
    'Je hebt al één big blind gepost. Als iemand naar 2,5 raiset, kost callen je nog maar **1,5 extra** om te spelen voor een pot waar al ongeveer 4 in zit. Die prijs is veel beter dan wat iemand anders aan tafel krijgt.',
  'So you defend the big blind much wider than any other seat — hands you would never dream of playing from early position become correct calls here.':
    'Je verdedigt de big blind dus veel ruimer dan welke andere stoel ook — handen waar je vanuit vroege positie niet over zou peinzen worden hier juiste calls.',
  'But there is a hard limit, and it is position again: you will be **out of position for the rest of the hand, every street**. That is why the range still stops somewhere, and why you defend far wider against a button raise (a wide, weak range) than against an under-the-gun raise (a narrow, strong one).':
    'Maar er zit een harde grens aan, en dat is opnieuw positie: je zit **de rest van de hand out of position, elke street**. Daarom houdt de range toch ergens op, en daarom verdedig je veel ruimer tegen een button raise (een ruime, zwakke range) dan tegen een under-the-gun raise (een smalle, sterke).',
  'Why do you defend your big blind wider against a button raise than against an under-the-gun raise?':
    'Waarom verdedig je je big blind ruimer tegen een button raise dan tegen een under-the-gun raise?',
  'The button raises a much wider, weaker range, so your hand needs less strength to be ahead of it':
    'De button raiset een veel ruimere, zwakkere range, dus je hand hoeft minder sterk te zijn om ervoor te liggen',
  'Right. Against a button opening roughly half their hands, a modest holding is genuinely fine. Against an under-the-gun range of about 18%, that same hand is usually beaten.':
    'Klopt. Tegen een button die ongeveer de helft van zijn handen opent is een bescheiden hand echt prima. Tegen een under-the-gun range van ongeveer 18% is diezelfde hand meestal verslagen.',
  'The button raise is cheaper to call': 'De button raise is goedkoper om te callen',
  'The raise size is typically the same from either seat, so the price you get is identical. What differs is the strength of the range you are up against.':
    'De raisegrootte is vanaf beide stoelen doorgaans hetzelfde, dus de prijs die je krijgt is identiek. Wat verschilt is de sterkte van de range waar je tegenover staat.',
  'You have position on the button after the flop': 'Je hebt na de flop positie op de button',
  'The opposite is true — you are in the big blind, so you will act first against them on every street. You defend wider purely because their range is weaker.':
    'Het tegenovergestelde is waar — je zit in de big blind, dus je handelt op elke street als eerste tegen hen. Je verdedigt ruimer puur omdat hun range zwakker is.',
  'Acting last means acting on information your opponent did not have.':
    'Als laatste handelen betekent handelen op informatie die je tegenstander niet had.',
  'In position you can take free cards, control the pot, and bluff far more accurately.':
    'In positie kun je gratis kaarten pakken, de pot sturen en veel nauwkeuriger bluffen.',
  'The button is the best seat; the blinds lose money for everyone.':
    'De button is de beste stoel; de blinds verliezen voor iedereen geld.',
  'Defend the big blind wide because of the discount — wider still against late-position raises.':
    'Verdedig de big blind ruim vanwege de korting — en nog ruimer tegen raises uit late positie.',
  /* ---------------------------------------------------------------- *
   * Lesson: Bankroll & The Business
   * ---------------------------------------------------------------- */
  'This module is about the business side. It is the least glamorous part of poker and the reason most winning players still go broke.':
    'Deze module gaat over de zakelijke kant. Het is het minst glamoureuze deel van poker en de reden dat de meeste winnende spelers toch failliet gaan.',
  'Variance is much larger than it feels': 'Variantie is veel groter dan hij aanvoelt',
  'Poker results swing enormously in the short term, and almost everyone underestimates by how much.':
    'Pokerresultaten schommelen op korte termijn enorm, en bijna iedereen onderschat met hoeveel.',
  'A genuinely winning player — someone beating their game for a solid 5bb/100 — will still have losing stretches of **20,000 hands or more**. Not because they played badly. Because that is simply what the maths does.':
    'Een echt winnende speler — iemand die zijn spel met een solide 5bb/100 verslaat — heeft nog steeds verliesreeksen van **20.000 handen of meer**. Niet omdat hij slecht speelde. Gewoon omdat de wiskunde dat doet.',
  'The standard deviation in no-limit hold’em is roughly **100bb per 100 hands**, which is around twenty times a good win rate. Over any short sample, luck is the loudest signal by far.':
    'De standaarddeviatie in no-limit hold’em is ruwweg **100bb per 100 handen**, ongeveer twintig keer een goede winrate. Over elke korte steekproef is geluk verreweg het luidste signaal.',
  'The practical consequence: **you cannot judge your play by your results** over anything less than tens of thousands of hands. Judge the decisions instead. That is what the coach in this trainer is for.':
    'Het praktische gevolg: **je kunt je spel niet beoordelen op je resultaten** over minder dan tienduizenden handen. Beoordeel in plaats daarvan de beslissingen. Daar is de coach in deze trainer voor.',
  'You are a genuine 5bb/100 winner. Over 10,000 hands, roughly what are the chances you actually lose money?':
    'Je bent een echte winnaar met 5bb/100. Hoe groot is over 10.000 handen ongeveer de kans dat je daadwerkelijk geld verliest?',
  'About 30% — losing stretches that long are entirely normal':
    'Ongeveer 30% — verliesreeksen van die lengte zijn volkomen normaal',
  'Right, and this is the number that stops people panicking. Nearly a third of the time, a real winner shows a loss over 10,000 hands. It says nothing about whether they are good.':
    'Klopt, en dit is het getal dat mensen ervan weerhoudt in paniek te raken. Bijna een derde van de tijd staat een echte winnaar over 10.000 handen op verlies. Het zegt niets over of hij goed is.',
  'Almost zero — 10,000 hands is a big sample': 'Bijna nul — 10.000 handen is een grote steekproef',
  'It feels big and it is not. With a standard deviation around twenty times the win rate, 10,000 hands is still mostly noise.':
    'Het voelt groot en dat is het niet. Met een standaarddeviatie van ongeveer twintig keer de winrate is 10.000 handen nog steeds vooral ruis.',
  'About 5%': 'Ongeveer 5%',
  'Too optimistic by a wide margin. The real figure is close to 30%, which is why bankroll rules exist at all.':
    'Ruimschoots te optimistisch. Het werkelijke getal ligt dicht bij 30%, en daarom bestaan bankrollregels überhaupt.',
  'Why 30 to 50 buy-ins': 'Waarom 30 tot 50 buy-ins',
  'The rule for no-limit cash games is to keep **30 to 50 buy-ins** for the stake you play. At NL10, where a buy-in is $10, that is $300 to $500.':
    'De regel voor no-limit cashgames is **30 tot 50 buy-ins** aanhouden voor het niveau dat je speelt. Op NL10, waar een buy-in $10 is, is dat $300 tot $500.',
  'The number is not superstition — it comes directly from the variance above. Since normal downswings run to 20 buy-ins or more, a roll of 10 buy-ins means a completely ordinary bad run ends your poker.':
    'Het getal is geen bijgeloof — het komt rechtstreeks uit de variantie hierboven. Omdat normale downswings tot 20 buy-ins of meer oplopen, betekent een roll van 10 buy-ins dat een volstrekt gewone slechte reeks een eind maakt aan je poker.',
  'This is the trap that catches good players: **the edge is real, but it needs time to show up**, and going broke removes your access to that time.':
    'Dit is de val waar goede spelers in lopen: **het voordeel is echt, maar het heeft tijd nodig om zichtbaar te worden**, en failliet gaan neemt je toegang tot die tijd weg.',
  'Move down when your roll drops below the threshold. It is not a demotion, it is what keeps you in the game — and the trainer’s Bankroll Challenge enforces exactly this.':
    'Zak een niveau als je roll onder de drempel komt. Het is geen degradatie, het is wat je in het spel houdt — en de Bankroll Challenge in deze trainer dwingt precies dit af.',
  'You have $200 and want to play NL25 ($25 buy-ins). Should you?':
    'Je hebt $200 en wilt NL25 spelen (buy-ins van $25). Zou je dat doen?',
  'No — that is only 8 buy-ins, so a normal downswing busts you':
    'Nee — dat zijn maar 8 buy-ins, dus een normale downswing maakt je kapot',
  'Right. You want at least 30 buy-ins, meaning $750 for NL25. With eight, an ordinary bad stretch — nothing unusual — takes the lot. Play NL5 and build up.':
    'Klopt. Je wilt minstens 30 buy-ins, dus $750 voor NL25. Met acht neemt een gewone slechte reeks — niets bijzonders — alles mee. Speel NL5 en bouw op.',
  'Yes — if you are a winning player the edge will show':
    'Ja — als je een winnende speler bent komt het voordeel er wel uit',
  'The edge is real but it needs thousands of hands to appear, and eight buy-ins does not survive that long. Being right about your skill does not protect you from variance.':
    'Het voordeel is echt maar het heeft duizenden handen nodig om zichtbaar te worden, en acht buy-ins overleven dat niet. Gelijk hebben over je eigen niveau beschermt je niet tegen variantie.',
  'Yes, but only play very tight': 'Ja, maar speel alleen heel tight',
  'Tightening up cannot shrink variance nearly enough to make eight buy-ins safe, and it forfeits much of your edge. The answer is to move down, not to play scared.':
    'Strakker spelen kan de variantie bij lange na niet genoeg verkleinen om acht buy-ins veilig te maken, en het levert een groot deel van je voordeel in. Het antwoord is een niveau zakken, niet bang spelen.',
  'Rake, and where the money really goes': 'Rake, en waar het geld werkelijk heen gaat',
  'The house takes a cut of most pots — typically **5%, capped** at a few big blinds. It is easy to ignore and it is often the difference between a winning player and a losing one.':
    'Het huis neemt een deel van de meeste potten — doorgaans **5%, met een maximum** van een paar big blinds. Het is makkelijk te negeren en het is vaak het verschil tussen een winnende en een verliezende speler.',
  'Because of the cap, **small pots are raked hardest in percentage terms**. A tiny pot loses the full 5%; a large one loses much less proportionally.':
    'Door dat maximum worden **kleine potten procentueel het zwaarst geraked**. Een klein potje verliest de volle 5%; een grote pot verhoudingsgewijs veel minder.',
  'This quietly punishes loose-passive poker. Limping into lots of small pots means paying maximum rake over and over on the pots you win, and the edges in those spots are thin to begin with.':
    'Dit straft loose-passief poker stilletjes af. Veel kleine potten inlimpen betekent keer op keer maximale rake betalen over de potten die je wint, en de voordelen in die situaties zijn toch al dun.',
  'And the highest-value habit of all is **game selection**. One loose player at your table is worth more than any strategy adjustment you can make — most of your profit comes from the worst player in the game, so find a table with one.':
    'En de meest waardevolle gewoonte van allemaal is **tafelkeuze**. Eén loose speler aan je tafel is meer waard dan elke strategische aanpassing die je kunt maken — het grootste deel van je winst komt van de slechtste speler in het spel, dus zoek een tafel waar er een zit.',
  'Two tables have a free seat. One has six competent regulars. The other has five regulars and one player seeing 68% of flops. Which do you join?':
    'Twee tafels hebben een vrije stoel. Aan de ene zitten zes competente regulars. Aan de andere vijf regulars en één speler die 68% van de flops ziet. Bij welke schuif je aan?',
  'The table with the loose player': 'De tafel met de loose speler',
  'Right, and it is not close. A player entering 68% of pots is where the money at that table comes from. Table selection is the highest-value habit in online poker.':
    'Klopt, en het scheelt niet eens weinig. Een speler die 68% van de potten ingaat is waar het geld aan die tafel vandaan komt. Tafelkeuze is de meest waardevolle gewoonte in online poker.',
  'The table of regulars — tougher games make you better':
    'De tafel met regulars — zwaardere spellen maken je beter',
  'You may learn something, but you will pay for the lesson. Against competent opponents your edge is small and the rake may eat all of it.':
    'Je leert er misschien iets, maar je betaalt voor die les. Tegen competente tegenstanders is je voordeel klein en de rake kan het volledig opeten.',
  'It makes no difference if you play well': 'Het maakt niet uit als je goed speelt',
  'It makes an enormous difference. Your win rate comes largely from opponents’ mistakes, so a table with someone making a lot of them is worth several times one where nobody is.':
    'Het maakt enorm veel uit. Je winrate komt grotendeels uit de fouten van tegenstanders, dus een tafel met iemand die er veel maakt is een veelvoud waard van een tafel waar niemand dat doet.',
  'Variance dwarfs skill in the short run — a 5bb/100 winner loses over 10,000 hands about 30% of the time.':
    'Variantie overschaduwt vaardigheid op de korte termijn — een winnaar met 5bb/100 staat over 10.000 handen ongeveer 30% van de tijd op verlies.',
  'Keep 30 to 50 buy-ins, because normal downswings run past 20.':
    'Houd 30 tot 50 buy-ins aan, want normale downswings lopen voorbij de 20.',
  'Rake hits small pots hardest, which is why loose-passive play loses twice over.':
    'Rake raakt kleine potten het hardst, en daarom verliest loose-passief spel dubbel.',
  'Game selection beats strategy: find the table with the weak player.':
    'Tafelkeuze verslaat strategie: zoek de tafel met de zwakke speler.',
};
