# ♠ Poker Trainer

A browser-based poker trainer that takes you from "what beats what" to beating
real online games. It is three things in one: a set of drills that grade you
against actual poker math, a playable table with AI opponents who each have a
distinct exploitable leak, and a coach that checks every decision you make.

No build step, no dependencies, no accounts. Clone it and play.

```bash
npm start          # then open http://localhost:8000
```

(Or `python3 -m http.server 8000`. Browsers block JavaScript modules loaded
directly from disk, so opening `index.html` by double-clicking will not work —
the page will tell you this if you try.)

---

## What's in it

### 🎓 Seventeen training modules, gated by rank

Each module has a short lesson and an endless supply of generated drills.
Difficulty scales with your rank, and later modules unlock as you level up —
ICM does not appear until you can count outs, because a player who guesses at
equity cannot use ICM anyway.

| Module | Unlocks | What it teaches |
| --- | --- | --- |
| Hand Rankings | Level 1 | Reading your own hand instantly, kickers, the wheel |
| Pot Odds | Level 1 | The price the pot is offering, and when to pay it |
| Outs & Equity | Level 2 | Counting outs, the rule of 2 and 4, discounted outs |
| Preflop Ranges | Level 2 | Opening ranges by position, 3-betting, dominated hands |
| Position | Level 3 | Why the button prints money and the blinds lose it |
| Bankroll & The Business | Level 3 | Buy-ins, variance, rake, game selection, real win rates |
| Continuation Betting | Level 4 | Board texture, range advantage, when to give up |
| Defence Frequency | Level 5 | MDF, and when to ignore it |
| Bluffing & Balance | Level 5 | Break-even bluff frequency, bluff-to-value ratios |
| Reading Players | Level 5 | Naming an opponent's leak and attacking it |
| Stack Depth | Level 6 | SPR, and planning a hand before you enter it |
| Tournament ICM | Level 7 | Why chips stop being money on the bubble |
| Value Betting | The Gulf | Betting when worse calls, thin value, sizing for the caller |
| Turn & River | The Gulf | Which turns to barrel, pot control, river bluffs and bluff-catching |
| 3-Bet Pots | The Gulf | Low stack-to-pot ratios, call / 4-bet / fold, out of position |
| Multiway Pots | The Gulf | Why bluffs fail three ways, tighter value, draws to the nuts |
| Push or Fold | The Gulf | Short-stack shoving and calling ranges by stack and seat |

The last five are the Gulf's: they open once the river is won (see below).

**Every drill answer is computed from the engine, not hand-authored.** When a
drill says you have 34.7% equity, that number came from the same evaluator that
settles the pot at showdown. The explanations cannot drift away from the math.

### 🃏 A real table

Six seats, three variants, and a full betting engine — blinds and antes,
min-raise rules, short all-ins that do not reopen the action, side pots,
uncalled-bet returns, and odd chips going to the first seat left of the button.

- **No-Limit Hold'em**
- **Pot-Limit Omaha** — four cards, and you must use exactly two
- **Short Deck (6+)** — twos through fives removed, flushes beat full houses,
  and A-6-7-8-9 is a straight

### 🧭 A coach that grades every decision

While you play, the coach shows your live equity, the equity the price demands,
pot odds, and SPR. The moment you act, it tells you whether that was right:

> **Called without the odds** — You needed 39.1% but had only 21.2%. Over a
> career, calls like this are the single biggest leak in small-stakes poker.

The next decision replaces that verdict, often before there is time to read
it, so the last few stay underneath under **What Silas said before**: the
street, what you did, a ✓, ≈ or ✗ for whether he agreed, and the verdict.
Tap one to read why again and what was right.

He grades how much as well as whether. Every bet and raise is sized against
the spot: an open is about 2.5 big blinds, a raise over limpers 3 plus 1 for
each limper, a 3-bet 3 times the raise in position and 4 times out of it, a
dry flop a third of the pot, a wet one three quarters with a strong hand and a
third with a medium one. A size well off the rule is said under the verdict,
with the size that was right, and counts as the mistake it is. With Silas at
your shoulder his panel gives the rule before you act, and the sizing buttons
get one of his own wherever the size does not depend on what you hold; taking
it is right, and not counted as yours. The reference has every rule on one
card (**Bet sizes**), the Log grades the size of a hand you replay, and your
character page keeps the habit: how often each kind of bet and raise is the
right size, and which way the rest miss.

At the end of a session it produces a **leak report** from your own stats —
VPIP, PFR, aggression factor, WTSD — naming what you are doing wrong and what
to do instead.

### 🐈 Help, and the cat who remembers

In free play nobody talks you through a hand: **Help** is a button, and
asking costs that decision its pearl (it still teaches, it just does not
count as solved on your own). The companions aboard your boat add to it —
the owl does the sum, the raccoon counts outs, the turtle knows the stacks,
the hound reads the table, the parrot says what Silas would do.

The cat remembers. Every mistake is kept with the seat you were in and what
was in front of you (first in, a raise, a limp, a bet, checked to you). With
her aboard, when a hand you went wrong with comes back in the very same
spot, she speaks up before you act — *"Careful. AJo on the button, facing a
raise: you went wrong here before — 'Too strong to just call'. 2 times now.
Think twice."* That is free: it says you were wrong here, not what is right.
Tap **What was right?** and she tells you — what was right instead, and the
chart for your seat with your hand ringed — and that is help like any other.

### ⚓ Your snags

A snag is a spot before the flop you went wrong in at a real table: the same
hand, in the same seat, with the same thing in front of you (first in, a
raise, a limp). Your character page lists them, the most often first, with
what went wrong last time and a streak of three dots. **Sail your snags**
deals them again on purpose — your hand, your seat, the raise from the seat
that raised — and asks what you do, graded against the chart. Right three
times in a row and a snag comes off the list, for 15 pearls; wrong, and its
streak starts again. A cleared snag stays off until you go wrong in it at a
table again. Practice never adds one, so it cannot be farmed. Silas points
you there when you have some, and *Where do I keep going wrong?* is one of
the things you can ask him.

### 🦈 Opponents with real leaks

Six profiles, each statistically distinct and each beatable a different way:

| | Style | The leak | How you beat it |
| --- | --- | --- | --- |
| 🪨 Rocky | The Nit | Has never bluffed in his life | Steal relentlessly, fold when he raises |
| 🎯 Tessa | Tight-Aggressive | Gives up when she misses | Attack the double check |
| 🔥 Leo | Loose-Aggressive | Bets far too often for his range | Widen your calls, let him bluff into you |
| 🚉 Stan | Calling Station | Cannot fold, ever | Never bluff; value bet thin and large |
| 💥 Max | The Maniac | Raises everything | Tighten up and wait to snap him off |
| 🧊 Nova | Solid Regular | No obvious leak | Play your own game and take value elsewhere |

Learning to *name* the player type in front of you is most of what separates a
winning player from a losing one, so the trainer makes that explicit.

### 🛶 The Long River

The stakes ladder is a river, around 1890. Eight stops run from Mud Landing
(NL2) down to the Commodore's flagship at the delta (NL500), and every stop is
a real stake with somebody who owns its table — a dockhand who never folds, a
ferryman who only plays aces, a steamboat captain who raises everything. Each
of them plays one of the six styles above, tells you how they play and how to
beat them before you sit down, and points you at the lesson that teaches it.

You go down it a city at a time. Each stop has a short list of things to do —
the lessons it teaches, hands at its own table, and the table itself — which
can be done in any order, and the next stop opens when the list is done. The
map says what to do next and points at the place to do it; the stops further on
are shut, and say which one opens them.

Seats are paid out of a simulated bankroll, and a stop only lets you in while
your purse can stand its stakes — 30 buy-ins, the way a serious player manages
a roll. Take a table (leave it with double your buy-in) and its owner hands
over a keepsake and a purse for the next stop; your boat grows as you get
further down the river. Bust and the house stakes you back in, and writes it
down.

Every owner will also play you heads-up for the table, once the city's lessons
and hands are done: two hundred chips each, the blinds rising every eight
hands until somebody has them all. A duel is scored for how you played it, not
just for winning it — one star for the win, a second when 92% of your decisions
were sound, a third at 97%, and a decision you asked for help on does not
count. Each star pays pearls the first time you earn it, so a
rematch is worth playing for the star you do not have. The first win takes the
table. A short scene tells you what each stop is like the first time you tie
up there.

Every stop runs three games, and a lobby that shows a few numbers for each:
how many players see the flop, how many pots are raised, how big the average
pot is, and who is sitting there. One is the owner's table, where the table is
taken; the other two are side games with nobody in charge, good for building a
roll. Which game to sit in is the cheapest edge in poker, and nobody tells you
which is soft — Silas says afterwards how your choice ranked. From the second
city on, Nell Corbin, another drifter in a borrowed boat, sits at one of the
three some visits. She keeps count of how often you fold to a bet, and unlike
the tables' regulars she remembers between sittings: fold too much and she
bluffs you more, call too much and she stops. Her card on the stop's screen says
what she has made of you so far.

Silas posts three contracts on the map, drawn from the skills you are weakest
at — "make eight sound pot-odds decisions at a real table", "play four hands in
a row without a mistake", "land a fish you have not caught" — each with a purse,
and posts the next as you finish them. It is the bridge between a drill that
says a skill is weak and a table where you use it. Today's question is three
questions from the chapters you own, the same for everybody on the same day;
it counts once, and a streak of days in a row pays a little more each time.
Now and then a stranger passes through — a cattle buyer who pays to see every
card, a riverboat gambler who has not checked since Natchez, a preacher who bets
only when it is over — and sits at a side game for three sittings. Each is an
extreme of one of the styles, with a purse on them worth twice an owner's.

From the second city on there is a Regatta at every stop: a six-player
tournament, 1,500 chips each, the blinds climbing every six hands until one
player has everything. The entry is a seat's price, it comes out of the bankroll
before the first card, and the whole pool is paid back to the top three (half,
three tenths, a fifth) with no rake, so a player no better than the field breaks
even. Players who go out are placed, a finish in the money pays pearls the first
time it is reached, and a win is a trophy at that stop. With a prize list a chip
you lose is worth more than a chip you win, and most of it is decided with a
short stack, where the bots shove or fold the way a short stack does.

The prize list changes what a decision is worth, and the coach knows it. A short
stack in a Regatta is shove or fold, graded not on chips but on prize equity
(the Malmuth-Harville model): for each of the two plays it works out what the
stacks that could result are worth in prize money, weighted by how often each
happens, and the better one is the answer, with the gap as what a mistake
cost. A call that is right when the winner takes all can be wrong with three
paid, and the verdict says so. The ICM chapter has a table of its own now: the
bubble, four left and three paid, dealt straight away with a short stack, for
practice — nothing is entered and nothing is won.

A table waits for you. Looking at something else — the Ledger, your character,
a hand in the Log — pauses it where it is, mid-hand if that is where you were,
and a bar under the top rail says where you are sitting and what is on the
table, with **Back to the table** and **Cash out**. The chips are kept in the
save after every action of yours, so a closed tab or a reload does not lose
them either: the seat is offered back, and taking it costs nothing. Getting up
in the middle of a hand folds it, as it would at any card room. One table at a
time. A Regatta cut short by a closed tab is settled the way Withdraw settles it.

Taking a table from its owner means sitting down at their table for the price of
a seat and cashing out with at least twice that — sit down with $2 at Mud
Landing, get up with $4 or more. The owner's table shows how close you are, and
says so when you have it.

Pearls are what the tables pay for hands you play through and decisions you
get right — folding before the flop is the default and pays nothing, and a
table with fewer than six players pays half. The practice table can be dealt
for a full table, three players or heads-up.

Pearls keep their worth once the shelves are bought. Delphine at the Trading
Post buys them for money, at what they fetch where your boat is moored, and
every seat and Regatta entry on the river can be paid in them. A seat costs
2,500 pearls at the first two stops and 2,500 more every two stops after, so a
thousand pearls fetch $0.80 at Mud Landing and $50 at the Delta Crown: the
further down the river, the more a pearl is worth, and keeping some for the far
end pays. Measured, an hour's pearls is worth about a third of what an hour of
faultless play wins at the same stop — enough to matter, never enough to
replace playing well. Nothing sells pearls back: they are only earned at the
tables. Your character page says what your purse would fetch where you are,
and at the far end — the Admiralty, once there is a Gulf.

And then there are the card rooms: the far end of the purse. Once a stop's
table is yours, the house it stands in is for sale — 3,000 pearls at Mud
Landing up to 45,000 at the Delta Crown, about 150,000 for all eight, and 60,000 to 170,000 in the Gulf. A room
you own pays you the house's cut, 2% of a big blind for every hand you are
dealt at its cash tables, paid when you cash out, and your character page
counts the rooms you own and what they have paid. Own all thirteen, and every
table there is pays you.

The river is drawn in the hour of the day you pick (night, bayou, dusk or
daylight), the people have faces, and everything you hear — chips, cards, the
ship's bell, a steam whistle and a ragtime piano — is synthesised in the
browser, with separate switches for effects and music in the ledger.

### 🌊 The Gulf: the second act

Take the delta and the river is won — and past it the Gulf opens: five more
ports at sea, on a chart of their own, from NL1000 to NL25K. The home screen
gets a switch between **The Long River** and **The Gulf**, and opens on the
one your boat is in. Each port teaches one of the chapters a river winner is
still missing, and its table is full of exactly that spot:

| Port | Stakes | Owner | Chapter |
| --- | --- | --- | --- |
| Salt Harbour | NL1000 | Josiah Quint, harbourmaster — calls everything | Value Betting |
| Lighthouse Point | NL2000 | Molly Fenn, lighthouse keeper — waits for the late streets | Turn & River |
| The Pearl Banks | NL5000 | Isabel Valdés, pearl buyer — re-raises every other open | 3-Bet Pots |
| Hurricane Key | NL10K | Black Jack Teague, privateer — drags everybody into the pot | Multiway Pots |
| The Admiralty | NL25K | Admiral Hargreave — and a duel where the blinds climb until the stacks are short | Push or Fold |

The road runs on through them like the river: each port has its chapter, its
hands (220 at Salt Harbour up to 300 at the Admiralty) and its table to take,
with a scene the first time you tie up, a keepsake from each owner, Regattas,
duels and a card room to buy. The Gulf's chapters are on Delphine's shelf once
the delta is yours, with a guided lesson and drills each — four from a bank of
worked spots, and push or fold generated from the same shoving shares the bots
use. The top rank now asks for every one of the seventeen chapters mastered.

### 🎩 Your character

The chip on the top bar is you: your face as your figure wears it, your rank
and your XP, under the words *Your character*. Tap it for a page about you,
drawn head to toe, with a row of links along the top to the parts people come
looking for: your money decisions, your bet sizes, your hands, your results
and the river.
The figure is dressed by your rank, a new look every two ranks: a deckhand in a
borrowed shirt, braces and a cap; a card-room grinder in a green visor and
sleeve garters; a riverboat regular in a bowler and a tailored waistcoat; a
riverboat shark in a long coat and a flat-brimmed hat; and at the top, a legend
of the river in velvet, gold and smoked glasses. The looks still to come wait in
silhouette. What is in the hands follows how you play (a nit nurses a cup of
tea, a maniac flips a chip), the face follows your last three sittings, and a
Regatta won puts the cup at your feet. Skin, hair, a beard, the colour you wear
and the name on your plate are yours to choose, and free.

Every hand you play at a real table is kept, so the page can say what kind of
player you are: nit, tight and passive, tight-aggressive, solid regular,
loose-aggressive, calling station or maniac — named from your VPIP and how much
of it you raise, over thirty hands or more at a full Hold'em cash table, and
placed on a map beside the river's six regulars (each of whom lands in a box of
its own). Then the six numbers a HUD would show about you, against the band a
winning regular sits in; your results; your favourite hand, the one that makes
you money and the one that costs you; a 13×13 grid of how often you play each
hand when you are dealt it; your best hand ever, biggest pot, biggest bluff and
longest winning run; your best and worst seat, your favourite victim and your
nemesis; and what you have done on the river. Nothing is named from too few
hands: each number says how many more it needs. It is in the Ledger too, and on
the river beside your boat.

Every decision you make at a real table is graded and kept with the hand you
held, so the page has a hand rating: the hands you make the most mistakes with,
and the ones you play best (of the hands you actually play — folding 9-3 every
time is right, but it is not playing it well). Tap any of them, or any square of
the grid, and that hand opens beside the list, without the page moving, so you
can tap one after another: how often it is dealt and played, what it has won,
how many of your decisions with it were right, what you do well with it, and
the mistakes, grouped by kind — what you did and on which street, why it was a
mistake, what was right instead, what it cost, and the hand itself to replay
if the Log kept it. On a phone the hand opens in a sheet over the bottom of
the screen.

**Your money decisions** is where the money is made and where it leaks. Every
fold, check, call, bet and raise at a real table is graded against the price
and your equity, and counted by what you did: how many of your calls were
right, how many were mistakes and what they cost in big blinds, and the same
for every other action. Beside it, the kinds of mistake that cost you the most
(calling without the price, too strong to just call…) and the ones you repeat
the most, with how often. Your bet sizes follow: how often each kind of bet is
the right size, and whether you go too small or too big.

### 🧓 Silas at your side

Away from the table Silas stands in a dock along the bottom of every screen,
head to toe — long coat, wide hat, white whiskers, a cup of tea — always in
view and never over anything: the page keeps the room he stands in, so its
end is always above him. He has one thing to say at a time, with a button to
the place it is about: the next step on the road, the mistake that costs you
the most, a kind of bet you size too small or too big, today's three
questions, what your pearls fetch, or one of the rules he has played by for
thirty years. What a screen is about comes first (your leak on your
character, your pearls at the Trading Post). Tap what he says for another
word; every so often he says another by himself.

Tap him, or **Ask Silas**, and you can talk to him. Pick a question — *How am
I doing? What should I do next? Where am I losing money? Am I betting the
right size? What kind of player am I? What are my pearls worth? Teach me
something* — and he answers from your own numbers, with a button to where it
is. Or type one: any word from the tables (pot odds, equity, a 3-bet, VPIP…)
and he explains it from the almanac; a question about your game in your own
words and he answers it, in English or Dutch. On a phone the dock is lower
and the questions scroll in a row. At the
table, with live coaching on he stands head to toe at
the top of his notebook, and his face follows your last decision — pleased
with a good one, concerned by a mistake. In free play he stands with the
table, saying one of his rules and nothing about your decisions: beside the
felt on a big screen, under the buttons in the column beside the felt on a
laptop, and nowhere on a phone, where the buttons need the room.

### 📋 Interactive range charts

The full 13×13 grid for every opening position and every 3-betting position,
with value hands and bluffs colour-coded. These are the same ranges the drills
grade you against and the same ones the Solid Regular bot plays.

---

## Is the poker actually correct?

That was the priority, so it is tested rather than asserted:

```bash
npm test           # 116 unit tests
npm run test:e2e   # drives the real UI in a browser (needs Playwright)
```

- The hand evaluator is checked against the **published frequencies of all
  2,598,960 five-card hands** — 40 straight flushes, 624 quads, 5,108 flushes,
  and so on, exactly. The seven-card path is verified against brute force over
  all 21 five-card subsets.
- Equity matches published matchups: AA vs KK at 82.3%, AKs vs QQ at 46.3%,
  88 vs AKo at 54.2%.
- The starting-hand table was generated by simulation and lands on the known
  values (AA 85.5%, KK 82.6%, 32o 32.4% — the worst hand in poker).
- The table engine **conserves chips across 400 random hands** in all three
  variants, with random legal actions and random stack depths, including every
  side-pot and all-in edge case that produces.
- The bots are verified to be statistically distinct from one another, and to
  never attempt an illegal action across 300 bot-only hands.

The preflop charts are solid, teachable baselines rather than solver output.
Real solver ranges shift with sizing, stack depth and opponent tendencies — but
a player who follows these consistently already beats most small-stakes games.
The app says so where it matters rather than overclaiming.

---

## Project layout

```
index.html              app shell
src/css/                design system, table styling, the river's look
src/fonts/              Rye, Old Standard TT, IBM Plex (SIL OFL, licences inside)
src/js/
  core/                 cards, evaluator, equity, odds, seedable RNG
  engine/               table state machine, variants, AI opponents
  data/                 preflop charts, generated hand strengths, curriculum
  state/                progression, session stats, achievements
  trainers/             drill generators, one file per theme
  ui/                   screens and DOM helpers, the map and portraits
  audio/                synthesised sound effects and the piano's tunes
tests/                  unit tests + browser end-to-end test
tools/                  dev server, hand-strength generator
```

Everything is vanilla ES modules. There is no framework and nothing to install.

Which build you are running is written under the ♠ in the top bar of every
screen (for example `v4.0.0`), and the Ledger and the Cabin page carry it too,
with the build date and an update check. The number is stamped from
`package.json` by `npm run stamp`, so bump the version there, stamp, and the
screen follows. If it is older than the release you expect, the browser is
showing a cached copy: reload it, or on an iPad close the tab and open it again.

To regenerate the starting-hand table:

```bash
node tools/generate-strength.js 60000
```

---

## A note on playing for real money

This trainer teaches the game with simulated money, and the river models the
economics honestly — including the parts that are not encouraging:

- A realistic small-stakes win rate is **3–8bb/100**. At NL10 that is a few
  dollars an hour. Anyone promising more is selling something.
- Standard deviation is around **100bb/100**. A genuine 5bb/100 winner still
  loses money over a 10,000-hand stretch about 30% of the time.
- **Rake** takes roughly 5% of most pots and is the reason marginal spots that
  look break-even are actually losing.
- Most players who deposit lose their deposit.

Online real-money poker is legal in some places and restricted or illegal in
others, and the rules depend on where you live. If you do play for money, treat
the bankroll rules here as a floor rather than a target, only play with money
you can afford to lose, and stop if it stops being a game.
