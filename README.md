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

### 🎓 Twelve training modules, gated by rank

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

At the end of a session it produces a **leak report** from your own stats —
VPIP, PFR, aggression factor, WTSD — naming what you are doing wrong and what
to do instead.

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

### 💰 The Bankroll Challenge

Climb the online stakes ladder from NL2 to NL500 on a simulated bankroll. Buy
in, play, cash out. Bust and you move down. Bankroll rules are enforced the way
a serious player enforces them — 30 to 50 buy-ins per stake — and the game will
tell you when you are taking a shot you cannot afford.

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
src/css/                design system, table styling
src/js/
  core/                 cards, evaluator, equity, odds, seedable RNG
  engine/               table state machine, variants, AI opponents
  data/                 preflop charts, generated hand strengths, curriculum
  state/                progression, session stats, achievements
  trainers/             drill generators, one file per theme
  ui/                   screens and DOM helpers
tests/                  unit tests + browser end-to-end test
tools/                  dev server, hand-strength generator
```

Everything is vanilla ES modules. There is no framework and nothing to install.

To regenerate the starting-hand table:

```bash
node tools/generate-strength.js 60000
```

---

## A note on playing for real money

This trainer teaches the game with simulated money, and the Bankroll Challenge
models the economics honestly — including the parts that are not encouraging:

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
