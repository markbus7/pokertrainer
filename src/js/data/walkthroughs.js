/**
 * Guided lessons: each concept taught in ordered steps, with a comprehension
 * check after every step.
 *
 * Two rules this content follows, because bullet-point lessons broke both:
 *
 *  1. Derive, never assert. A formula handed over with no reasoning is a
 *     thing to memorise and misapply, not a thing to understand.
 *  2. Every wrong answer gets its own explanation. "Wrong, the answer is B"
 *     teaches nothing; naming the specific misunderstanding does.
 *
 * THE POT CONVENTION, used everywhere in this trainer:
 *   "The pot" means everything in the middle when it is your turn to act,
 *   INCLUDING the bet you are currently facing. Where a spot is described as
 *   "the pot is X and they bet Y", both numbers are always stated, so there
 *   is never anything to infer.
 */

export const WALKTHROUGHS = {
  /* ================================================================== *
   * POT ODDS
   * ================================================================== */
  'pot-odds': {
    intro: 'By the end of this you will be able to look at any bet and say out loud, in about three seconds, exactly how often you need to win for calling to be worth it.',
    steps: [
      {
        title: 'What question are we actually asking?',
        body: [
          'Someone bets. You can call or fold. Pot odds answer one specific question, and it is not the one most people think:',
          '**How often would I need to win for calling to be worth it?**',
          'Notice what that is not. It is not "do I have the best hand" — nobody knows that. It is not "will I win this pot" — nobody knows that either. It is purely about the *price* you are being offered.',
          'A friend offers you a bet on a coin flip: put in €1, and if you win they pay you €3. You do not need to see the future to know that is a good deal. You win half the time, and you are being paid three-to-one. The price is good, so you take it.',
          'Poker is exactly this. Pot odds are the price. Your hand is the coin.',
          'One word to pin down before going further, because it is about to appear everywhere. **Equity** is your share of the pot — how often your hand wins if this exact situation were played out again and again. A hand that wins three times in four has 75% equity.',
          'So equity describes your **cards**. Pot odds describe the **money**. They are two separate things, and every decision in this module is just comparing one against the other.',
        ],
        check: {
          question: 'What do pot odds tell you?',
          options: [
            {
              key: 'a',
              label: 'Whether you currently have the best hand',
              why: 'Pot odds say nothing about your cards — you could work them out before even looking at your hand. They describe the price the pot is offering, not what you are holding.',
            },
            {
              key: 'b',
              label: 'How often you need to win for a call to break even',
              why: 'Exactly. It is a threshold: the minimum win rate that makes calling worthwhile. What you do with that number comes next.',
            },
            {
              key: 'c',
              label: 'How much money you will win from this hand',
              why: 'Nothing can tell you that in advance. Pot odds give you a break-even threshold, not a prediction of the result.',
            },
          ],
          answer: 'b',
        },
      },

      {
        title: 'The two numbers that matter',
        body: [
          'Only two things go into this. Get these straight and the rest is arithmetic.',
          '**What you risk:** the amount you have to call. That is all. If you fold instead, you lose nothing extra — money you already put in earlier in the hand is gone either way, so it plays no part in this decision.',
          '**What you win:** everything already in the pot. Their bet is part of that. The moment they pushed those chips forward, the chips stopped being theirs — if you win the pot, you collect them.',
          'A note on wording, because you will meet it elsewhere: players often say chips are \u201cin the middle\u201d, meaning simply that they are in the pot — the chips get pushed to the centre of the table. This trainer says \u201cin the pot\u201d throughout, to keep it unambiguous.',
          'So: **you risk your call, to win the pot.**',
        ],
        visual: {
          type: 'stack',
          segments: [
            { label: 'Already in the pot (you win this)', value: 150, tone: 'gold' },
            { label: 'Your call (you risk this)', value: 50, tone: 'blue' },
          ],
          caption: 'Risking 50 to win 150.',
        },
        check: {
          question: 'The pot was 100. Your opponent bets 50. It is now your turn. How big is the pot right now?',
          options: [
            {
              key: 'a',
              label: '100',
              why: 'That was the pot before they bet. Their 50 has been pushed in as well now, and if you win the hand you collect that too.',
            },
            {
              key: 'b',
              label: '150',
              why: 'Right — the original 100 plus their 50. This is what "the pot" means throughout this trainer: every chip already bet when it is your turn, including the bet you are facing.',
            },
            {
              key: 'c',
              label: '200',
              why: 'That would be the pot after you also call. Right now only their bet has gone in; yours has not.',
            },
            {
              key: 'd',
              label: '50',
              why: 'That is only their bet. The 100 that was already there is still in the pot, and you win that too.',
            },
          ],
          answer: 'b',
        },
      },

      {
        title: 'Working out the break-even point',
        body: [
          'Keep the spot from the last step: the pot was **100**, your opponent bet **50**, so the pot is now **150** — and it costs you **50** to try to win it.',
          'Imagine playing this identical spot 100 times. Say you win it W times out of the 100.',
          'Each time you win, you gain **150**. Each time you lose, you drop the **50** you called.',
          'Break-even is where those cancel out exactly:',
          '`W × 150  =  (100 − W) × 50`',
          '`150W = 5000 − 50W`',
          '`200W = 5000`',
          '`W = 25`',
          'You need to win **25 out of 100** — that is **25%**. Win more often than that and calling makes money over time. Less often and it loses money, no matter how the individual hand happens to turn out.',
        ],
        check: {
          question: 'In that calculation, you needed to win 25 times out of 100. What happens if your hand actually wins 40% of the time here?',
          options: [
            {
              key: 'a',
              label: 'Calling is profitable — you win more often than the price requires',
              why: 'Correct. You need 25%, you have 40%, so the extra 15% is your edge. Repeated over many hands, that edge is your profit.',
            },
            {
              key: 'b',
              label: 'You should fold — 40% is still less than half',
              why: 'A common trap. You do not need to win *most* of the time, only more often than the price demands. You are risking 50 to win 150, so even winning well under half the time is profitable.',
            },
            {
              key: 'c',
              label: 'It makes no difference — poker is luck',
              why: 'Any single hand is luck. But this is a threshold you meet or miss on every decision, and across thousands of hands the ones where you had the better of the price are exactly where profit comes from.',
            },
          ],
          answer: 'a',
        },
      },

      {
        title: 'The shortcut: your share of the final pot',
        body: [
          'That algebra works, but nobody is solving equations at the table. Here is the fast way to see the same thing.',
          'Same spot: the pot was 100, they bet 50, so the pot is now 150, and your call is 50. Once you call, the **final pot** is 150 + 50 = **200**.',
          'Of that 200, exactly **50 is your money**. And 50 out of 200 is **25%**.',
          'That is the same 25% we got from the algebra — and it is not a coincidence or an approximation. It is the identical calculation, seen from a different angle:',
          '**The fraction of the final pot made up of your own money is exactly how often you need to win.**',
          'It is fair to ask why your own call belongs in that total at all. The reason is the thing most explanations skip: **when you win, you win your own money back too.**',
          'You are not paying 50 for a shot at their 150. You are paying 50 for a shot at the whole **200** — and 50 of that 200 is the chip you just pushed in.',
          'So treat it as buying a ticket. The ticket costs **50**. The prize is **200**. How often does that ticket have to win to be worth buying? One time in four, because 50 is a quarter of 200.',
          'Both ways of looking at it give the same answer, always. Risk 50 to *gain* 150, or pay 50 to *collect* 200 — either way, 25%.',
          'Which gives the formula, and now you know where it comes from rather than just having to trust it:',
          '`required equity  =  your call  ÷  (the pot + your call)`',
        ],
        visual: {
          type: 'stack',
          segments: [
            { label: 'Their money in the final pot', value: 150, tone: 'gold' },
            { label: 'Your money', value: 50, tone: 'blue' },
          ],
          caption: 'Your 50 is a quarter of the 200 final pot — so you need to win a quarter of the time.',
        },
        check: {
          question: 'There is 60 in the pot and your opponent bets 20. What equity do you need to call?',
          options: [
            {
              key: 'a',
              label: '20%',
              why: 'Right. Their bet takes the pot to 80, you call 20, so the final pot is 100 — and your 20 is a fifth of it.',
            },
            {
              key: 'b',
              label: '25%',
              why: 'This compares your 20 against the 80 the pot had reached. But the final pot also contains your own call: 60 + 20 + 20 = 100, so your share is 20 ÷ 100 = 20%.',
            },
            {
              key: 'c',
              label: '33%',
              why: 'That is the figure for a pot-sized bet. Here they bet only 20 into 60 — a third of the pot — so the price is much better than that: 20 ÷ 100 = 20%.',
            },
            {
              key: 'd',
              label: '12%',
              why: 'The denominator has gone too big. It is the final pot, 100 — not the pot plus anything further. 20 ÷ 100 = 20%.',
            },
          ],
          answer: 'a',
        },
      },

      {
        title: 'The five numbers worth memorising',
        body: [
          'In practice you will face the same handful of bet sizes over and over. Learn these and you will almost never need to calculate at the table.',
          'Each row is: they bet this fraction of the pot, so you need this much equity to call.',
          'Look at the direction of that list. **The bigger the bet, the more equity you need.** This is why an overbet is not automatically a stronger play — it demands more, both from you when you call and from them when they bluff.',
          'Take the first row as the worked example, because it is the one that catches people out. The pot is 100 and they bet 25. That takes the pot to **125**, you call **25**, so the final pot is **150** — and your share is 25 ÷ 150 = **17%**.',
        ],
        visual: {
          type: 'table',
          headers: ['They bet', 'You need'],
          rows: [
            ['Quarter pot', '17%'],
            ['Half pot', '25%'],
            ['Three-quarter pot', '30%'],
            ['Full pot', '33%'],
            ['Double the pot', '40%'],
          ],
          caption: 'These do not scale in a straight line, which is worth knowing before you try to guess a row. A quarter-pot bet is half the size of a half-pot bet, but it asks for 17% — not half of 25%. The reason is that **both numbers move at once**: a smaller bet also makes a smaller final pot. In symbols, a bet of B into a pot of P needs B ÷ (P + 2B), and however enormous the bet gets that can only creep towards 50% without ever reaching it — a 1000 overbet into 100 still only asks for 48%.',
        },
        check: {
          question: 'The pot is 80 and your opponent bets 80 — a full pot-sized bet. What equity do you need to call?',
          options: [
            {
              key: 'a',
              label: '50%',
              why: 'A natural guess, since they bet an amount equal to the pot — but you are still getting a discount. You call 80 to win 160, so the final pot is 240 and your share is 80 ÷ 240 = 33%.',
            },
            {
              key: 'b',
              label: '33%',
              why: 'Right. You call 80 into a pot of 160, so the final pot is 240 and your 80 is a third of it. A pot-sized bet always asks for 33%, whatever the actual numbers are.',
            },
            {
              key: 'c',
              label: '25%',
              why: 'That is the number for a half-pot bet. This one is a full pot-sized bet, which asks for more: 80 ÷ 240 = 33%.',
            },
            {
              key: 'd',
              label: '80%',
              why: 'This looks like the bet size rather than an equity figure. The question is what fraction of the final pot is your money: 80 out of 240, which is 33%.',
            },
          ],
          answer: 'b',
        },
      },

      {
        title: 'Putting it to work',
        body: [
          'Pot odds give you one half of the decision — what you **need**, which comes from the money. The other half is your equity: what you actually **have**, which comes from your cards and you get by counting outs.',
          'Then the decision is simply:',
          '**Have ≥ Need → call.   Have < Need → fold.**',
          'A worked example. You hold a flush draw on the flop: nine cards complete it, which is roughly **36%** by the river. There is 100 in the pot and your opponent bets 50.',
          'You need: the pot is now 150 and your call is 50, so the final pot is 200 and your share is 50 ÷ 200 = **25%**.',
          'You have: **36%**.',
          '36 is comfortably more than 25, so this is a clear call — and it stays a clear call even on the times the draw misses and you lose the pot. The price was right; that is what you control.',
          'Say it out loud every time, in this order: *"I call 50 to win 150, so I need 25%. I have about 36%. Call."* Most losing calls in small-stakes poker are ones where nobody ever ran that sentence.',
        ],
        visual: {
          type: 'gauge',
          need: 0.25,
          have: 0.36,
          needLabel: 'Need (price)',
          haveLabel: 'Have (flush draw)',
        },
        check: {
          question: 'You have a gutshot straight draw — about 16% to hit by the river. The pot is 90 and your opponent bets 90. Call or fold?',
          options: [
            {
              key: 'a',
              label: 'Call — a straight would win a big pot',
              why: 'How much you would win *if* it hits is already accounted for: it is exactly what the pot odds measure. This is a pot-sized bet, so you need 33%, and you have about 16%. Less than half of what the price demands.',
            },
            {
              key: 'b',
              label: 'Fold — you have 16% but need 33%',
              why: 'Right. A pot-sized bet demands 33% and a gutshot delivers about 16%, so the call loses money every time you make it. Folding here is not weakness; it is the profitable play.',
            },
            {
              key: 'c',
              label: 'Call — you are getting 2-to-1 on your money',
              why: 'The odds are read correctly (2-to-1 does mean you need 33%), but the comparison is the wrong way round: you need 33% and only have 16%, so the price is worse than your chances, not better.',
            },
          ],
          answer: 'b',
        },
      },
    ],
    recap: [
      '**Equity** is how often your hand wins — a fact about your cards. **Required equity** is the threshold it has to beat — a fact about the money.',
      '**The pot** = every chip already bet when it is your turn, including the bet you are facing.',
      '**Required equity** = your call ÷ (the pot + your call) — that is, your share of the final pot.',
      'Half pot → 25%. Full pot → 33%. Bigger bets always demand more.',
      'Compare what you **need** against what you **have**, and call when have ≥ need.',
      'Say the sentence out loud before every call: "I call X to win Y, so I need Z%."',
    ],
  },

  /* ================================================================== *
   * HAND RANKINGS
   * ================================================================== */
  'hand-rankings': {
    intro: 'The goal here is not to recite the list. It is to look at five cards and know instantly what you have, without pausing.',
    steps: [
      {
        title: 'The order is not arbitrary — it is rarity',
        body: [
          'Hands are ranked by how hard they are to make. That is the whole logic, and once you see the numbers you never have to memorise the order again.',
          'Out of all 2,598,960 possible five-card hands, here is how many produce each result. The rarer it is, the more it beats.',
          'This answers the question most beginners get stuck on: **why does a flush beat a straight?** Because there are 10,200 straights and only 5,108 flushes. Flushes are roughly twice as hard to make, so they win.',
        ],
        visual: {
          type: 'table',
          headers: ['Hand', 'How many exist', 'Roughly'],
          rows: [
            ['Straight flush', '40', '1 in 65,000'],
            ['Four of a kind', '624', '1 in 4,000'],
            ['Full house', '3,744', '1 in 700'],
            ['Flush', '5,108', '1 in 500'],
            ['Straight', '10,200', '1 in 255'],
            ['Three of a kind', '54,912', '1 in 47'],
            ['Two pair', '123,552', '1 in 21'],
            ['One pair', '1,098,240', '1 in 2.4'],
            ['High card', '1,302,540', '1 in 2'],
          ],
        },
        check: {
          question: 'Why does a full house beat a flush?',
          options: [
            {
              key: 'a',
              label: 'Because full houses are rarer — 3,744 of them against 5,108 flushes',
              why: 'Exactly the right reasoning. Every ranking in poker comes straight from these counts; nothing about it is a convention you have to take on faith.',
            },
            {
              key: 'b',
              label: 'Because it uses three of a kind, and three beats two',
              why: 'It gives the right answer for the wrong reason, which will mislead you elsewhere — three of a kind on its own loses to both a straight and a flush. Rarity is what decides, and full houses are rarer than flushes.',
            },
            {
              key: 'c',
              label: 'Because a full house uses all five cards',
              why: 'So does a flush — all five cards share a suit. The deciding factor is rarity: 3,744 full houses against 5,108 flushes.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'The ace plays high and low — but never wraps',
        body: [
          'The ace is the only card that works at both ends of a straight.',
          '**A-K-Q-J-10** is the best straight, called Broadway.',
          '**A-2-3-4-5** is also a straight, called the wheel. Here the ace acts as a 1, which makes this the *lowest* straight — it loses to 6-5-4-3-2.',
          'But the ace does not connect the two ends together. **Q-K-A-2-3 is nothing at all.** A straight has to be five ranks in an unbroken run, and the sequence stops dead at the ace.',
          'This trips people up at showdown more than any other rule, and the mistake always costs a pot.',
        ],
        check: {
          question: 'You hold A-2 and the board is K-Q-3-4-5. What is your best hand?',
          options: [
            {
              key: 'a',
              label: 'A straight, five high — using A-2-3-4-5',
              why: 'Correct. The ace plays low here to make the wheel. It is the weakest possible straight, but a straight all the same.',
            },
            {
              key: 'b',
              label: 'A straight, ace high — using 2-3-4-5-A',
              why: 'Those are the right five cards but the wrong reading of them. When the ace plays low it counts as a 1, so the top of this straight is the five, not the ace. That matters: it loses to any other straight.',
            },
            {
              key: 'c',
              label: 'Nothing — an ace cannot play low',
              why: 'It can. A-2-3-4-5 is a legitimate straight, known as the wheel. What an ace cannot do is wrap around the top, which is why Q-K-A-2-3 is nothing.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'You always play the best five cards available',
        body: [
          'In Hold’em you have seven cards to choose from: your two plus the five on the board. Your hand is whichever **five** of those seven make the strongest combination.',
          'You are never obliged to use your own cards. If the board is A-K-Q-J-10 and you hold 7-2, your hand is that Broadway straight — the exact same hand as everyone else still in.',
          'That is what "playing the board" means, and when it happens the pot is split between everyone left.',
          'Equally, you might use just one of your cards, or both, whichever produces the best five.',
        ],
        check: {
          question: 'The board reads 9-9-9-9-2 and you hold A-K. Your opponent holds 7-3. What happens?',
          options: [
            {
              key: 'a',
              label: 'You win — your ace outkicks their seven',
              why: 'Right. Both of you use the four nines, and the fifth card is the best remaining one available: your ace beats their seven. Your two cards did not go to waste after all.',
            },
            {
              key: 'b',
              label: 'The pot is split — you both have four nines',
              why: 'Close, and this is the trap. A hand is five cards, not four, so the fifth card still has to come from somewhere. You contribute an ace and they contribute a seven, so you win.',
            },
            {
              key: 'c',
              label: 'You win with a full house',
              why: 'There is no full house here — that needs three of one rank and a pair of another, and the board gives four nines plus a lone two. Your hand is four nines with an ace kicker.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Kickers settle the close ones',
        body: [
          'When two players make the same hand, the tie is broken by the next highest card — the **kicker**. This is where a surprising amount of money changes hands.',
          'The classic disaster: the board is A-8-4-2-7 and you hold A-5. You have a pair of aces and feel good about it. Your opponent holds A-K — the same pair of aces, but their king plays as the kicker against your five. You lose.',
          'This is why **A-K is so much stronger than A-5**, and why "any ace" is a losing habit. When you hit the ace, the times you win are small and the times you lose are large — you get paid a little by weaker aces and stacked by better ones.',
          'The general shape: being *dominated* means sharing your best card with an opponent who has a better second card. Avoiding domination is most of good preflop play.',
        ],
        check: {
          question: 'Board: Q-9-6-3-2. You hold Q-7. Your opponent holds Q-J. Who wins?',
          options: [
            {
              key: 'a',
              label: 'Your opponent — same pair of queens, but their jack outkicks your seven',
              why: 'Right, and this is exactly the situation to avoid. Both of you paired the queen; the hand comes down to the second card, and theirs is better.',
            },
            {
              key: 'b',
              label: 'Split pot — you both have a pair of queens',
              why: 'The pair is only part of the hand. Five cards play, so after Q-Q the next card matters: their jack beats your seven, and they take the whole pot.',
            },
            {
              key: 'c',
              label: 'You win — your seven pairs nothing but your queen is higher',
              why: 'Your queens are identical, not higher — you both use the same queen from the board plus one in hand. The jack against the seven decides it, in their favour.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'The ranking order comes from rarity — flushes beat straights because there are half as many of them.',
      'A-2-3-4-5 is the lowest straight; Q-K-A-2-3 is not a straight at all.',
      'Your hand is the best five of your seven cards, even if that means playing the board.',
      'Equal hands are settled by the kicker — which is why A-K is a different hand from A-5.',
    ],
  },

  /* ================================================================== *
   * OUTS & EQUITY
   * ================================================================== */
  outs: {
    intro: 'Pot odds tell you what you need. Outs tell you what you have. This is the other half of every drawing decision.',
    steps: [
      {
        title: 'An out is a card that rescues you',
        body: [
          'You are behind. There are cards still to come. An **out** is any card that would put you in front.',
          'The method is mechanical: work out what beats you now, then count the specific cards that change that.',
          'Say you hold two hearts and there are two more hearts on the flop. Any further heart completes your flush. There are 13 hearts in a deck and you can see four of them, so **nine hearts are still unseen**. Nine outs.',
          'One thing to be precise about, because it is the part people quietly worry about: you count **unseen** cards, not "cards left in the deck". Some of those nine hearts may well be sitting in an opponent\u2019s hand right now.',
          'It genuinely does not matter. From where you sit, every card you cannot see is equally likely to be the next one turned over — a heart in someone\u2019s hand and a heart in the deck are the same thing to you, because you have no way to tell them apart. That is why the count works.',
          'That is all counting outs is — how many unseen cards win the hand for you.',
        ],
        check: {
          question: 'You hold two hearts, and two more hearts are on the flop. How many hearts are still unseen?',
          options: [
            {
              key: 'a',
              label: '9',
              why: 'Right. Thirteen hearts in a deck, four of them in plain sight, so nine are unseen. This is the single most common draw in poker and the number worth knowing cold.',
            },
            {
              key: 'b',
              label: '11',
              why: 'That subtracts only your two hole cards. The two hearts on the flop are face up as well, so four are accounted for: 13 − 4 = 9.',
            },
            {
              key: 'c',
              label: '13',
              why: 'That is every heart in the deck, before taking away the four you can already see. Nine are left unseen.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'The counts worth memorising',
        body: [
          'A handful of draws come up constantly. Learn these and you will rarely have to count from scratch.',
          'The two big ones are the **flush draw at nine** and the **open-ended straight draw at eight** — four cards at each end of your run.',
          'A **gutshot** has only one rank that fills it, so four cards: half of an open-ended draw, and it shows in how rarely it is worth calling.',
          'And the monster: a flush draw *and* an open-ended straight draw at once gives roughly **15 outs**, which is actually a favourite against many made hands.',
        ],
        visual: {
          type: 'table',
          headers: ['Draw', 'Outs', 'Example'],
          rows: [
            ['Flush draw', '9', 'Two hearts in hand, two on board'],
            ['Open-ended straight', '8', '9-8 on a 7-6-2 board'],
            ['Gutshot straight', '4', '9-8 on a 6-5-2 board (needs a 7)'],
            ['Two overcards', '6', 'A-K on a 7-4-2 board'],
            ['Flush + open-ended', '15', 'The best draw in poker'],
          ],
        },
        check: {
          question: 'You hold 9-8 and the board is 7-6-2. How many outs do you have to a straight?',
          options: [
            {
              key: 'a',
              label: '8 — any ten or any five completes it',
              why: 'Right. Four tens make 10-9-8-7-6 and four fives make 9-8-7-6-5. Open at both ends, so eight cards, which is why it is called an open-ended draw.',
            },
            {
              key: 'b',
              label: '4 — only a ten completes it',
              why: 'A ten works, but so does a five: 9-8-7-6-5 is equally a straight. Your run is open at both ends, giving eight outs rather than four.',
            },
            {
              key: 'c',
              label: '2 — one ten and one five',
              why: 'There are four of each rank in a deck, not one. Four tens plus four fives is eight cards.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'The rule of 4 and 2',
        body: [
          'Once you have counted your outs, you need to turn that into a percentage. The shortcut is simple enough to do instantly:',
          '**On the flop** (two cards still to come): multiply your outs by **4**.',
          '**On the turn** (one card to come): multiply your outs by **2**.',
          'So a nine-out flush draw is roughly 9 × 4 = **36%** on the flop, and 9 × 2 = **18%** on the turn.',
          'Where does the 2 come from? Count the unseen cards. On the flop you can see your own two plus the three on the board, so 52 − 5 = **47** are unseen, and one of those 47 is about **2%**. On the turn there is one more card showing, so 52 − 6 = **46** unseen — still about 2% each.',
          'So an out is worth roughly 2% for every card still to come. One card left, multiply by 2. Two cards left, multiply by 4.',
          'Two cards to come is not simply twice one card, though, and it is worth seeing why. Adding the two chances together counts the times you hit on **both** cards twice over — once in each half of the sum — so plain addition overshoots.',
          'With nine outs, adding honestly gives 38.7%, and that double-counted overlap is worth about 3%. Take it off and you land on the true **35%**.',
          'Here is the neat part. Rounding each out down from 2.1% to a flat 2% shaves off almost exactly that overlap, which is why the crude 9 × 4 = **36%** sits so close to the real 35%. The shortcut works because two errors cancel.',
          'They stop cancelling when you have a lot of outs, because the overlap grows faster than the rounding saves. At fifteen outs the overlap is nearly 10%, so 15 × 4 = 60% overshoots the true **54%**.',
          'The rule of 2 has the opposite, smaller problem: it **runs a little low**. One card in 46 is 2.2%, not 2.0%, and with only one card to come there is no overlap for that rounding to cancel out. Nine outs on the turn is really about **20%**, not the 18% the shortcut gives.',
          'Neither drift is ever big enough to change what you should do, which is the entire point of a shortcut.',
        ],
        check: {
          question: 'You have an open-ended straight draw on the flop. Roughly what is your equity?',
          options: [
            {
              key: 'a',
              label: 'About 32% — that is 8 outs × 4',
              why: 'Right. Eight outs with two cards to come, so multiply by 4. The exact figure is 31.5%, which is close enough that the shortcut never changes your decision.',
            },
            {
              key: 'b',
              label: 'About 16% — that is 8 outs × 2',
              why: 'That is the rule for the *turn*, when only one card remains. On the flop two cards are still coming, so you double it: 8 × 4 = 32%.',
            },
            {
              key: 'c',
              label: 'About 50% — a straight draw is a coin flip',
              why: 'Draws feel closer to even than they are. Eight outs twice over is about 32%, so you will miss this draw roughly two times in three.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Not every out is clean',
        body: [
          'The count you make is the optimistic version. Some of those cards win you the hand — and some hand it to your opponent instead.',
          'Say you are drawing to a straight, but the board has two cards of one suit. The card that completes your straight might also complete somebody’s flush. It looked like an out; it was actually a trap.',
          'The habit is to **discount** the doubtful ones. If you count eight outs but two of them also bring in an obvious flush, treat it as six.',
          'This is also why the trainer’s outs drills sometimes give a number lower than you expect — they count only the cards that genuinely leave you in front, which is the number that actually matters.',
        ],
        check: {
          question: 'You have an open-ended straight draw (8 outs), but two of those cards would also complete a flush for your opponent. How should you count it?',
          options: [
            {
              key: 'a',
              label: 'About 6 outs — discount the two that could lose',
              why: 'Right. Cards that complete your hand and a better one at the same time are not outs at all. Being slightly pessimistic here keeps you out of the pots that are most expensive to be wrong in.',
            },
            {
              key: 'b',
              label: 'Still 8 — they complete your straight either way',
              why: 'They complete your straight, but that is not the test. An out has to leave you *winning*, and a straight that loses to a flush has cost you money rather than saved it.',
            },
            {
              key: 'c',
              label: '10 — the flush cards give you extra ways to win',
              why: 'Those cards make the flush for your opponent, not for you. They belong on the other side of the ledger, which is why the count comes down to about six.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'An out is an unseen card that puts you in front — count them, do not estimate.',
      'Flush draw = 9. Open-ended straight = 8. Gutshot = 4. Both draws together = 15.',
      'Flop: outs × 4. Turn: outs × 2. That works because an out is ~2% per card to come (47 unseen on the flop, 46 on the turn).',
      'The shortcut runs a little high on the flop and a little low on the turn — never enough to change a decision.',
      'Discount outs that would also complete a better hand for someone else.',
    ],
  },

  /* ================================================================== *
   * PREFLOP RANGES
   * ================================================================== */
  preflop: {
    intro: 'More money is lost before the flop than anywhere else, by playing hands that were never going to be profitable. This is also the only street you can genuinely memorise.',
    steps: [
      {
        title: 'Why position decides how many hands you play',
        body: [
          'The single biggest factor in whether a hand is playable is not the cards. It is **how many people still get to act behind you**.',
          'Open from the first seat and five players remain who might wake up with something better. Open from the button and only two do — and both of them will be out of position for the whole hand.',
          'So the further from the button you sit, the tighter you have to be. This is not caution; it is arithmetic. The same hand is profitable in one seat and loses money in another.',
          'These are the baseline opening ranges this trainer grades you against.',
        ],
        visual: {
          type: 'table',
          headers: ['Seat', 'Players behind', 'Open this often'],
          rows: [
            ['Under the gun', '5', '~18%'],
            ['Hijack', '4', '~23%'],
            ['Cutoff', '3', '~30%'],
            ['Button', '2', '~47%'],
            ['Small blind', '1', '~41%'],
          ],
        },
        check: {
          question: 'You hold K-9 suited. It is a clear fold under the gun but a clear raise on the button. Why?',
          options: [
            {
              key: 'a',
              label: 'Five players can still wake up behind you under the gun; only two can on the button',
              why: 'Exactly. The hand has not changed — the risk of running into something better has. Fewer players behind means fewer ways to be beaten, so more hands become profitable.',
            },
            {
              key: 'b',
              label: 'K-9 suited is a stronger hand on the button',
              why: 'The hand is identical in both seats. What changes is how many opponents are left to act and whether you will have position on them afterwards.',
            },
            {
              key: 'c',
              label: 'The blinds are closer, so you win more',
              why: 'Stealing the blinds is part of it, but the main reason is simpler: with only two players left to act, the chance that someone behind holds a better hand is far lower.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Raise or fold — almost never limp',
        body: [
          'Just calling the big blind ("limping") is the most common beginner habit and one of the most expensive.',
          'Three things go wrong at once. You **give up the initiative**, so whoever bets first after the flop takes control. You **invite everyone in cheaply**, which is the opposite of what you want with a hand you have doubts about. And you **cap your range** — good players know a limp means you do not have a premium, and attack accordingly.',
          'A raise does the reverse: it can win the pot immediately, it builds a pot when you are strong, and it makes your hand hard to read because your strong and speculative hands arrive the same way.',
          'The rule is blunt and it is right: **if a hand is worth playing, it is worth raising. If it is not worth raising, fold it.**',
        ],
        check: {
          question: 'You are on the button with 7-6 suited and everyone has folded to you. What is your play?',
          options: [
            {
              key: 'a',
              label: 'Raise',
              why: 'Right. Suited connectors are well inside a button opening range, and raising gives you two ways to win: they fold now, or you play a pot in position with a hand that flops well.',
            },
            {
              key: 'b',
              label: 'Limp — it is a speculative hand, so keep it cheap',
              why: 'The intuition is understandable but backwards. Limping invites the blinds in cheaply, which is the worst outcome for a hand that wants either to win now or to play against one opponent. Raise or fold.',
            },
            {
              key: 'c',
              label: 'Fold — 7-6 suited is too weak',
              why: 'Far too tight for the button, where you should be opening roughly half your hands. Suited connectors flop straights and flushes, and you will have position for the rest of the hand.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Domination is what actually costs you',
        body: [
          'The hands that lose the most money are not the obviously bad ones. Nobody goes broke with 7-2. The expensive hands are the ones that look strong and are **dominated**.',
          'Domination means sharing your best card with an opponent who holds a better second card. A-J against A-K, K-10 against K-Q.',
          'What makes it so costly is that domination hits precisely when you think you are winning. You flop an ace with A-J, feel delighted, and then pay off someone with A-K over three streets.',
          'This is the real reason to fold decent-looking hands against early-position raisers. Against a range of roughly the top 18% of hands, A-J is not a hand that wins — it is a hand that finds out it was second best after putting in a lot of money.',
        ],
        check: {
          question: 'An extremely tight player raises from under the gun. You hold A-J offsuit. What is the problem with calling?',
          options: [
            {
              key: 'a',
              label: 'Most of their range dominates you — A-K, A-Q, and every big pair',
              why: 'Right. When you flop an ace you are usually behind a better ace, and when you miss you have nothing. You get paid a little by worse and stacked by better.',
            },
            {
              key: 'b',
              label: 'A-J is a weak hand',
              why: 'A-J is genuinely strong in the abstract — it is a comfortable open from late position. The problem is entirely about *this* opponent: their raising range is narrow and most of it beats you.',
            },
            {
              key: 'c',
              label: 'You will be out of position',
              why: 'A real cost, and worth weighing, but not the main one here. Even in position A-J struggles against a top-5% range because so much of that range shares your ace with a better kicker.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'How wide you open is set by how many players act after you, not by optimism.',
      'Raise or fold. Limping surrenders initiative and tells opponents you are weak.',
      'Domination — sharing your top card with a better kicker — is where the money goes.',
      'Fold good-looking hands like A-J against tight early-position raises.',
    ],
  },

  /* ================================================================== *
   * POSITION
   * ================================================================== */
  position: {
    intro: 'Position is worth more than cards. If you take one idea from this trainer into a real game, make it this one.',
    steps: [
      {
        title: 'Position means information',
        body: [
          'Acting last is an information advantage, and it applies on **every single street**.',
          'When you act after your opponent, you have already seen what they did. Their check, their bet, their sizing — all of it is information you get for free, and they had to act without any of it.',
          'That is the entire mechanism. It sounds small written down and it is enormous in practice: the same hand, played from the same stack, wins money in position and loses money out of position.',
          'Which is why the button is the most profitable seat at the table and the blinds are the two losing seats — for everybody, including professionals.',
        ],
        check: {
          question: 'What is the actual advantage of acting last?',
          options: [
            {
              key: 'a',
              label: 'You see what your opponent does before you have to decide',
              why: 'Exactly. Every decision you make is better informed than theirs, on every street, for the whole hand. That compounds into a large edge over time.',
            },
            {
              key: 'b',
              label: 'You get to bet more',
              why: 'You can bet the same amounts from any seat. What changes is the quality of your information when you choose.',
            },
            {
              key: 'c',
              label: 'You get better cards on the button',
              why: 'Cards are dealt at random, so every seat gets the same hands in the long run. The button is profitable because of when you act, not what you are dealt.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'What position lets you actually do',
        body: [
          'Three concrete abilities, all of which are unavailable out of position:',
          '**Take a free card.** With a draw, you can check behind and see the next card for nothing. Out of position you must either bet or check and risk facing a bet.',
          '**Control the pot size.** You decide whether the pot grows, because you always act with full information about the street so far.',
          '**Bluff far more accurately.** You bluff after seeing weakness rather than guessing at it, which makes the bluffs much likelier to work.',
          'Out of position you get none of this. You act first with less information, every street, all hand.',
        ],
        check: {
          question: 'You have a flush draw on the flop and your opponent checks to you in position. What can you do that you could not do out of position?',
          options: [
            {
              key: 'a',
              label: 'Check behind and see the turn for free',
              why: 'Right. Out of position you would have to act first and might face a bet you cannot profitably call. In position, checking guarantees you see the next card at no cost.',
            },
            {
              key: 'b',
              label: 'Bet larger than you otherwise could',
              why: 'Bet sizing does not depend on position — you could make the same bet from either seat. The free card is what position uniquely buys you.',
            },
            {
              key: 'c',
              label: 'See their cards',
              why: 'You never see their cards until showdown. What you see is their *action*, which is information enough to make better decisions than they can.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Defending the big blind — wide, but not endlessly',
        body: [
          'The big blind is a special case, and the reason is a discount.',
          'You have already posted one big blind. If someone raises to 2.5, calling costs you only **1.5 more** to play for a pot that already holds around 4. That price is far better than anyone else at the table is getting.',
          'So you defend the big blind much wider than any other seat — hands you would never dream of playing from early position become correct calls here.',
          'But there is a hard limit, and it is position again: you will be **out of position for the rest of the hand, every street**. That is why the range still stops somewhere, and why you defend far wider against a button raise (a wide, weak range) than against an under-the-gun raise (a narrow, strong one).',
        ],
        check: {
          question: 'Why do you defend your big blind wider against a button raise than against an under-the-gun raise?',
          options: [
            {
              key: 'a',
              label: 'The button raises a much wider, weaker range, so your hand needs less strength to be ahead of it',
              why: 'Right. Against a button opening roughly half their hands, a modest holding is genuinely fine. Against an under-the-gun range of about 18%, that same hand is usually beaten.',
            },
            {
              key: 'b',
              label: 'The button raise is cheaper to call',
              why: 'The raise size is typically the same from either seat, so the price you get is identical. What differs is the strength of the range you are up against.',
            },
            {
              key: 'c',
              label: 'You have position on the button after the flop',
              why: 'The opposite is true — you are in the big blind, so you will act first against them on every street. You defend wider purely because their range is weaker.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'Acting last means acting on information your opponent did not have.',
      'In position you can take free cards, control the pot, and bluff far more accurately.',
      'The button is the best seat; the blinds lose money for everyone.',
      'Defend the big blind wide because of the discount — wider still against late-position raises.',
    ],
  },

  /* ================================================================== *
   * BANKROLL
   * ================================================================== */
  bankroll: {
    intro: 'This module is about the business side. It is the least glamorous part of poker and the reason most winning players still go broke.',
    steps: [
      {
        title: 'Variance is much larger than it feels',
        body: [
          'Poker results swing enormously in the short term, and almost everyone underestimates by how much.',
          'A genuinely winning player — someone beating their game for a solid 5bb/100 — will still have losing stretches of **20,000 hands or more**. Not because they played badly. Because that is simply what the maths does.',
          'The standard deviation in no-limit hold’em is roughly **100bb per 100 hands**, which is around twenty times a good win rate. Over any short sample, luck is the loudest signal by far.',
          'The practical consequence: **you cannot judge your play by your results** over anything less than tens of thousands of hands. Judge the decisions instead. That is what the coach in this trainer is for.',
        ],
        check: {
          question: 'You are a genuine 5bb/100 winner. Over 10,000 hands, roughly what are the chances you actually lose money?',
          options: [
            {
              key: 'a',
              label: 'About 30% — losing stretches that long are entirely normal',
              why: 'Right, and this is the number that stops people panicking. Nearly a third of the time, a real winner shows a loss over 10,000 hands. It says nothing about whether they are good.',
            },
            {
              key: 'b',
              label: 'Almost zero — 10,000 hands is a big sample',
              why: 'It feels big and it is not. With a standard deviation around twenty times the win rate, 10,000 hands is still mostly noise.',
            },
            {
              key: 'c',
              label: 'About 5%',
              why: 'Too optimistic by a wide margin. The real figure is close to 30%, which is why bankroll rules exist at all.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Why 30 to 50 buy-ins',
        body: [
          'The rule for no-limit cash games is to keep **30 to 50 buy-ins** for the stake you play. At NL10, where a buy-in is $10, that is $300 to $500.',
          'The number is not superstition — it comes directly from the variance above. Since normal downswings run to 20 buy-ins or more, a roll of 10 buy-ins means a completely ordinary bad run ends your poker.',
          'This is the trap that catches good players: **the edge is real, but it needs time to show up**, and going broke removes your access to that time.',
          'Move down when your roll drops below the threshold. It is not a demotion, it is what keeps you in the game — and the trainer’s Bankroll Challenge enforces exactly this.',
        ],
        check: {
          question: 'You have $200 and want to play NL25 ($25 buy-ins). Should you?',
          options: [
            {
              key: 'a',
              label: 'No — that is only 8 buy-ins, so a normal downswing busts you',
              why: 'Right. You want at least 30 buy-ins, meaning $750 for NL25. With eight, an ordinary bad stretch — nothing unusual — takes the lot. Play NL5 and build up.',
            },
            {
              key: 'b',
              label: 'Yes — if you are a winning player the edge will show',
              why: 'The edge is real but it needs thousands of hands to appear, and eight buy-ins does not survive that long. Being right about your skill does not protect you from variance.',
            },
            {
              key: 'c',
              label: 'Yes, but only play very tight',
              why: 'Tightening up cannot shrink variance nearly enough to make eight buy-ins safe, and it forfeits much of your edge. The answer is to move down, not to play scared.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Rake, and where the money really goes',
        body: [
          'The house takes a cut of most pots — typically **5%, capped** at a few big blinds. It is easy to ignore and it is often the difference between a winning player and a losing one.',
          'Because of the cap, **small pots are raked hardest in percentage terms**. A tiny pot loses the full 5%; a large one loses much less proportionally.',
          'This quietly punishes loose-passive poker. Limping into lots of small pots means paying maximum rake over and over on the pots you win, and the edges in those spots are thin to begin with.',
          'And the highest-value habit of all is **game selection**. One loose player at your table is worth more than any strategy adjustment you can make — most of your profit comes from the worst player in the game, so find a table with one.',
        ],
        check: {
          question: 'Two tables have a free seat. One has six competent regulars. The other has five regulars and one player seeing 68% of flops. Which do you join?',
          options: [
            {
              key: 'a',
              label: 'The table with the loose player',
              why: 'Right, and it is not close. A player entering 68% of pots is where the money at that table comes from. Table selection is the highest-value habit in online poker.',
            },
            {
              key: 'b',
              label: 'The table of regulars — tougher games make you better',
              why: 'You may learn something, but you will pay for the lesson. Against competent opponents your edge is small and the rake may eat all of it.',
            },
            {
              key: 'c',
              label: 'It makes no difference if you play well',
              why: 'It makes an enormous difference. Your win rate comes largely from opponents’ mistakes, so a table with someone making a lot of them is worth several times one where nobody is.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'Variance dwarfs skill in the short run — a 5bb/100 winner loses over 10,000 hands about 30% of the time.',
      'Keep 30 to 50 buy-ins, because normal downswings run past 20.',
      'Rake hits small pots hardest, which is why loose-passive play loses twice over.',
      'Game selection beats strategy: find the table with the weak player.',
    ],
  },

  /* ================================================================== *
   * CONTINUATION BETTING
   * ================================================================== */
  cbet: {
    intro: 'You raised before the flop, so you have the stronger range. A continuation bet turns that story into chips — on the right boards.',
    steps: [
      {
        title: 'Why a continuation bet works at all',
        body: [
          'You raised preflop. That means your range is made of strong hands, and your opponent — who merely called — has a weaker one. That difference is called a **range advantage**, and it survives onto the flop.',
          'The other half is much simpler: **most hands miss most flops**. A player holding two unpaired cards fails to make even a pair roughly two times in three.',
          'So when you bet the flop, you are betting into someone who probably has nothing, holding a range they know is stronger than theirs. That is why it works so often that it has its own name.',
          'It also means the bet does not need to be large. If they have missed, a small bet folds them out just as reliably as a big one — and costs you far less on the times they have not.',
        ],
        check: {
          question: 'Why does a continuation bet succeed so often?',
          options: [
            {
              key: 'a',
              label: 'Your range is stronger and they have usually missed the flop',
              why: 'Both halves matter. The range advantage means your story is credible; the miss rate means they usually have nothing to continue with.',
            },
            {
              key: 'b',
              label: 'Because betting always looks strong',
              why: 'Against a thinking opponent it does not — they know you bet this flop with your whole range. What makes it work is the genuine range advantage plus how often they have missed.',
            },
            {
              key: 'c',
              label: 'Because you usually have a strong hand when you bet',
              why: 'You usually do not, and that is fine. The bet is profitable because *they* usually have nothing, not because you always do.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Dry boards and wet boards',
        body: [
          'Which flop you are on changes everything, and it comes down to one question: **how many hands can continue against you?**',
          'A **dry** board — say A-7-2 rainbow, no flush draw, no straight draw — connects with almost nothing. Your opponent either hit an ace or gave up. Here you can bet small with your entire range, because there is very little that can call.',
          'A **wet** board — say 9-8-7 with two of a suit — connects with everything. Straights, straight draws, flush draws, pairs. Your opponent has plenty to continue with, so a bluff runs into a call far more often.',
          'The rule that follows: **bet dry boards often and cheaply. Slow down on wet boards unless you actually have something.**',
        ],
        check: {
          question: 'You raised preflop and the big blind called. The flop is 9-8-7 with two hearts, and you hold A-K with no heart. They check. What now?',
          options: [
            {
              key: 'a',
              label: 'Check — this board hits their range hard and you have nothing',
              why: 'Right. Straights, two pair, and every draw are in their calling range, and ace-high has no fold equity against that. Betting here just loses chips slowly.',
            },
            {
              key: 'b',
              label: 'Bet small — you have the range advantage',
              why: 'The range advantage does not survive this flop. A 9-8-7 board favours the hands they called with, not the hands you raised with, and far too much of their range will continue.',
            },
            {
              key: 'c',
              label: 'Bet large to fold out the draws',
              why: 'Draws on this board are strong enough to call, and some will raise. You would be building a big pot with ace-high while giving the worst of it to a range full of made hands.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'The two questions before any bet',
        body: [
          'Before every bet you make, on any street, ask exactly two questions:',
          '**1. Will a worse hand call me?** If yes, betting makes money — that is value.',
          '**2. Will a better hand fold?** If yes, betting makes money — that is a bluff.',
          'If the answer to both is no, **the bet cannot make money** and you should check. This one habit removes a large share of the bets that lose people money, because it catches the bets made out of momentum rather than reason.',
          'It also explains the awkward middle: hands too weak to be called by worse but too strong to bluff with. Those hands want to check and see a showdown, not fire a third barrel.',
        ],
        check: {
          question: 'On the river you hold middle pair. Better hands will never fold, and worse hands will never call. Should you bet?',
          options: [
            {
              key: 'a',
              label: 'No — the bet cannot win money either way, so check',
              why: 'Right. Both tests fail, so betting only loses when called and gains nothing when not. Checking lets you win the pot when your middle pair is good.',
            },
            {
              key: 'b',
              label: 'Yes — betting gives you a chance to win it now',
              why: 'The premise rules that out: better hands never fold, so there is no fold equity to win. All the bet does is lose money against the hands that beat you.',
            },
            {
              key: 'c',
              label: 'Yes — a small bet for thin value',
              why: 'Thin value needs worse hands to call, and by assumption none will. With no caller worse than you, there is no value in the bet.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'A continuation bet works because your range is stronger and they usually missed.',
      'Bet dry, disconnected boards small and often; slow down on wet, connected ones.',
      'Before betting, ask: will worse call, or will better fold? If neither, check.',
    ],
  },

  /* ================================================================== *
   * DEFENCE FREQUENCY
   * ================================================================== */
  mdf: {
    intro: 'Folding too much is its own leak, and it is invisible — nothing on screen tells you it is happening.',
    steps: [
      {
        title: 'The problem with folding too often',
        body: [
          'Suppose you fold to every river bet unless you have a very strong hand. It feels disciplined. It is actually catastrophic, and here is the arithmetic that shows why.',
          'Your opponent bets 100 into a 100 pot with absolutely nothing. If you fold more than half the time, that bluff makes money **with any two cards**.',
          'Which means that against an over-folder, an opponent does not need to think, read you, or hold anything at all. They can simply bet every single time and print money.',
          'So there is a minimum amount you have to continue with, purely to stop that. It is called **minimum defence frequency**, and it exists to make bluffing unprofitable rather than to win any particular pot.',
        ],
        check: {
          question: 'Why is folding too often a genuine leak, even though each individual fold saves you money?',
          options: [
            {
              key: 'a',
              label: 'It lets opponents profitably bluff with any two cards',
              why: 'Right. Each fold looks cheap in isolation, but together they hand your opponent a bet that always works. The cost is spread across every pot rather than showing up in one.',
            },
            {
              key: 'b',
              label: 'Because you miss out on winning big pots',
              why: 'That is a side effect rather than the mechanism. The real problem is that over-folding makes betting automatically profitable for them, regardless of their cards.',
            },
            {
              key: 'c',
              label: 'It is not a leak — folding is always safe',
              why: 'Folding is safe in each single hand and expensive across many. If you fold too often, every opponent who notices can bet relentlessly with nothing.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Working out the number',
        body: [
          'Your opponent bets **B** into a pot of **P**. For their bluff to break even, it has to work often enough to pay for itself: they risk B to win P, so they need it to succeed `B ÷ (P + B)` of the time.',
          'Which means you have to continue the rest of the time. That is the formula:',
          '`minimum defence frequency  =  P ÷ (P + B)`',
          'Against a **pot-sized** bet: 100 ÷ 200 = **50%** — you must continue with half your range.',
          'Against a **half-pot** bet: 100 ÷ 150 = **67%** — you must continue with two thirds.',
          'Notice the direction, and that it is the mirror image of pot odds: **smaller bets require you to defend more**, because they are cheaper bluffs and so need to work less often.',
        ],
        visual: {
          type: 'table',
          headers: ['They bet', 'You must continue with'],
          rows: [
            ['Quarter pot', '80%'],
            ['Half pot', '67%'],
            ['Three-quarter pot', '57%'],
            ['Full pot', '50%'],
            ['Double pot', '33%'],
          ],
        },
        check: {
          question: 'Your opponent bets a quarter of the pot. Do you need to defend more or less often than against a pot-sized bet?',
          options: [
            {
              key: 'a',
              label: 'More — a small bet is a cheap bluff, so it needs to work less often',
              why: 'Right. Risking a quarter pot to win the pot only needs to work 20% of the time, so you have to continue 80% of the time to stop it being free money.',
            },
            {
              key: 'b',
              label: 'Less — a small bet is less of a threat',
              why: 'Backwards. Because it is cheap, it needs to succeed far less often to profit, so you must defend more, not less.',
            },
            {
              key: 'c',
              label: 'The same — defence frequency does not depend on bet size',
              why: 'It depends on it directly: MDF is pot ÷ (pot + bet), so it moves every time the bet size does.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'When to ignore it entirely',
        body: [
          'This is the part people miss, and it matters more than the formula.',
          'MDF makes you **unexploitable**, not **maximally profitable**. It is the right answer against a good opponent who is genuinely balancing their bluffs.',
          'Against real small-stakes players, it is often exactly wrong:',
          '**Against someone who never bluffs**, ignore MDF and over-fold heavily. If they only bet with strong hands, defending "enough" just donates money.',
          '**Against a maniac who always bluffs**, defend far wider than MDF says. The formula is a floor for safety, not a ceiling on profit.',
          'The general principle for all of poker: **theory is the fallback when you have no read. A read always beats the formula.**',
        ],
        check: {
          question: 'Rocky, the nit, has never bluffed once. He bets the river. MDF says you should defend 50% of your range. What do you do?',
          options: [
            {
              key: 'a',
              label: 'Fold nearly everything — MDF does not apply to someone who never bluffs',
              why: 'Right. MDF protects you against a balanced opponent. Rocky is not balanced, and defending 50% against a range with no bluffs in it loses money on purpose.',
            },
            {
              key: 'b',
              label: 'Defend exactly 50% — MDF is the correct play',
              why: 'MDF makes you unexploitable, but he is not trying to exploit you. Against a range containing no bluffs, every bluff-catcher you call with is simply losing.',
            },
            {
              key: 'c',
              label: 'Defend more than 50% to avoid being run over',
              why: 'Rocky is not running you over — he is only betting real hands. Widening against a value-only range is the most expensive possible response.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'Fold too often and any two cards can profitably bluff you.',
      'MDF = pot ÷ (pot + bet). Pot-sized bet → defend 50%. Half pot → 67%.',
      'Smaller bets demand more defence, because they are cheaper bluffs.',
      'Against players who never bluff, over-fold. A read always beats the formula.',
    ],
  },

  /* ================================================================== *
   * BLUFFING & BALANCE
   * ================================================================== */
  bluffing: {
    intro: 'A bluff is not a hope or a mood. It is a price, and the price is calculable.',
    steps: [
      {
        title: 'How often does a bluff have to work?',
        body: [
          'You bet **B** into a pot of **P** with a hand that cannot win at showdown. You risk B to win P, so break-even is:',
          '`break-even fold frequency  =  B ÷ (P + B)`',
          'Bet **half pot**: 50 ÷ 150 = it must work **33%** of the time.',
          'Bet **pot**: 100 ÷ 200 = it must work **50%** of the time.',
          'Bet **double pot**: 200 ÷ 300 = it must work **67%** of the time.',
          'This is the answer to "should I just bet bigger?" — a bigger bluff wins more when it works and needs to work considerably more often. Neither size is automatically better; it depends entirely on how often *this* opponent folds.',
        ],
        check: {
          question: 'You bluff half the pot. How often does your opponent need to fold for it to break even?',
          options: [
            {
              key: 'a',
              label: 'About 33%',
              why: 'Right — you risk 50 to win 100, so 50 ÷ 150 = 33%. Fold more often than a third of the time and the bluff is profitable.',
            },
            {
              key: 'b',
              label: '50%',
              why: 'That is the figure for a *pot-sized* bluff. A half-pot bluff risks less, so it needs to work less often: 33%.',
            },
            {
              key: 'c',
              label: '25%',
              why: '25% is what a caller needs against a half-pot bet — the pot-odds figure. The bluffer’s break-even is different: 50 ÷ 150 = 33%.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Bluff with hands that can still win',
        body: [
          'Given the choice between bluffing with total air and bluffing with a flush draw, take the draw every time — and the reason is not subtle.',
          'A bluff with no equity wins **only** when they fold. A bluff with a draw wins when they fold **and** when they call and you hit. That is two ways to win instead of one, at the same price.',
          'This is called a **semi-bluff**, and it is the single most profitable kind of aggression in poker.',
          'It also picks your bluffing hands for you. Bluff with draws, backdoor draws, and overcards — hands with a future. Give up with the hands that have neither showdown value nor a way to improve.',
        ],
        check: {
          question: 'You are choosing a hand to bluff the flop with. Which is better: total air, or a flush draw?',
          options: [
            {
              key: 'a',
              label: 'The flush draw — it wins when they fold, and also when they call and you hit',
              why: 'Right. Same bet, same fold equity, plus roughly a 36% chance of winning anyway when called. That extra way to win is free.',
            },
            {
              key: 'b',
              label: 'Total air — you want to bluff when you cannot win any other way',
              why: 'A common instinct and it is backwards. If they call, air has no chance at all, while the draw still wins about a third of the time. Bluff the hands with a future.',
            },
            {
              key: 'c',
              label: 'They are equivalent — a bluff only wins when they fold',
              why: 'True for air, false for a draw. The draw keeps winning after a call, which is precisely what makes semi-bluffing so profitable.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Balance, and when to abandon it',
        body: [
          'Against a strong opponent you want your bluffs and value bets to arrive in a ratio that leaves them no good answer. At a **pot-sized** bet that is roughly **one bluff for every two value hands** — about a third of your betting range.',
          'Get that ratio right and it does not matter what they do: calling and folding are equally break-even for them. That is what balance means.',
          'But balance is a **defensive** goal. It stops good players exploiting you; it does not extract maximum money from bad ones.',
          'Against weak opponents, throw it away. **Value bet more and bluff less** against a station. **Bluff more** against someone who folds too much. Balance is what you fall back on when you have no read — never a reason to ignore one you have.',
        ],
        check: {
          question: 'You are playing against Stan, the calling station, who almost never folds. How should you adjust your bluffing?',
          options: [
            {
              key: 'a',
              label: 'Stop bluffing almost entirely and value bet much wider',
              why: 'Right. A bluff needs folds to make money, and he does not fold — so bluffs become pure losses. Every chip instead goes into betting real hands, thinner and larger than normal.',
            },
            {
              key: 'b',
              label: 'Keep your bluff-to-value ratio balanced',
              why: 'Balance protects you from being exploited, but he is not exploiting anyone — he is calling too much. Staying balanced against him leaves a lot of money on the table.',
            },
            {
              key: 'c',
              label: 'Bluff bigger so he finally folds',
              why: 'Sizing up against someone who cannot fold just loses more per bluff. The adjustment is to bluff less, not louder.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'Break-even bluff frequency = bet ÷ (pot + bet). Half pot needs 33%, pot needs 50%.',
      'Bigger bluffs win more but must work more often — neither size is automatically right.',
      'Prefer semi-bluffs: hands that also win when called.',
      'Balance is the fallback with no read. With a read, exploit instead.',
    ],
  },

  /* ================================================================== *
   * STACK DEPTH (SPR)
   * ================================================================== */
  spr: {
    intro: 'Stack-to-pot ratio decides whether top pair is a monster or a bluff catcher — and it is settled before the flop is even dealt.',
    steps: [
      {
        title: 'What SPR is',
        body: [
          '**SPR = the effective stack ÷ the pot, measured on the flop.**',
          'The "effective" stack is the smaller of the two remaining stacks, because you can never win more than the shorter one.',
          'If the pot is 20 on the flop and the effective stack is 200, your SPR is 10. If the pot is 60 and the stack is 180, your SPR is 3.',
          'The reason it matters: SPR tells you **how much of a commitment one pair represents**. The same hand, on the same board, is a routine all-in at one SPR and a fold at another.',
        ],
        check: {
          question: 'The flop pot is 40. You have 500 behind and your opponent has 120. What is the SPR?',
          options: [
            {
              key: 'a',
              label: '3 — use the shorter stack, 120 ÷ 40',
              why: 'Right. The effective stack is 120, since that is the most that can go in. Your extra 380 has no effect on this hand.',
            },
            {
              key: 'b',
              label: '12.5 — 500 ÷ 40',
              why: 'That uses your own stack, but you cannot win more than your opponent has. The effective stack is their 120, giving an SPR of 3.',
            },
            {
              key: 'c',
              label: '15.5 — both stacks combined, divided by the pot',
              why: 'Stacks are not added together — only the smaller one can actually go in. 120 ÷ 40 = 3.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Low SPR means committed',
        body: [
          'At an SPR of **3 or less**, top pair is usually a hand you get all-in with, and you should plan for that before you bet.',
          'The reason is that there simply are not enough chips left for meaningful fold decisions. One bet and one raise puts the stacks in, so agonising on the turn is a decision you already made preflop.',
          'At an SPR of **6 or more**, the situation reverses completely. There is enough money behind for several streets of betting, and **one pair is just one pair**. Getting stacks in with top pair here means you are usually up against two pair or better.',
          'The practical shortcut: **low SPR, commit with top pair. High SPR, keep the pot small unless you improve.**',
        ],
        check: {
          question: 'You have top pair on the flop with an SPR of 12. Your opponent raises your bet and then bets big on the turn. What does that suggest?',
          options: [
            {
              key: 'a',
              label: 'You are likely beaten — at this depth, stacks go in with much better than one pair',
              why: 'Right. With 12 times the pot behind, an opponent committing that much is rarely doing it with a worse pair. Deep stacks mean big money implies big hands.',
            },
            {
              key: 'b',
              label: 'Call it down — top pair is a strong hand',
              why: 'Top pair is strong at a low SPR, where stacks go in easily. At an SPR of 12 you have to beat far more than one pair to justify a big pot.',
            },
            {
              key: 'c',
              label: 'Raise — you have to find out where you stand',
              why: 'Raising to "find out" builds a large pot with a medium hand, which is the most expensive way to get information. At this depth, one pair wants a small pot.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'You choose your SPR before the flop',
        body: [
          'The part that turns SPR from trivia into a tool: **you set it yourself, preflop, by how big you build the pot.**',
          'A big 3-bet creates a **small SPR**, which suits big pairs — you want to get stacks in with aces, and a low SPR makes that automatic.',
          'Just calling keeps the SPR **high**, which suits suited connectors and small pairs — hands that want to see a cheap flop and win a huge pot on the times they smash it.',
          'So the preflop sizing question is really: *what kind of postflop hand do I want to be playing?* Big pairs want low SPR. Speculative hands want high SPR.',
        ],
        check: {
          question: 'You hold pocket aces. Do you want a high or a low SPR?',
          options: [
            {
              key: 'a',
              label: 'Low — you want the stacks in while you are almost certainly ahead',
              why: 'Right. Aces are at their best right now and get worse as more cards come. A low SPR gets the money in before that happens, which is why you raise and re-raise them.',
            },
            {
              key: 'b',
              label: 'High — so you can win a huge pot',
              why: 'A deep stack sounds appealing but it works against aces. More streets means more chances for opponents to outdraw you and more difficult decisions on bad boards.',
            },
            {
              key: 'c',
              label: 'It makes no difference — aces are the best hand either way',
              why: 'They are the best hand preflop and get progressively less dominant as cards come. Controlling SPR is exactly how you convert that early advantage into chips.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'SPR = effective (smaller) stack ÷ flop pot.',
      'SPR 3 or less: top pair is committed. SPR 6 or more: one pair is just one pair.',
      'You set the SPR with your preflop sizing.',
      'Big pairs want a low SPR; speculative hands want a high one.',
    ],
  },

  /* ================================================================== *
   * READING PLAYERS
   * ================================================================== */
  exploit: {
    intro: 'Theory keeps you from being beaten. Exploitation is how you actually make money. This is where most of your win rate comes from.',
    steps: [
      {
        title: 'Name the leak, then attack it',
        body: [
          'Balanced play is a defensive stance — it guarantees nobody can exploit you, and it makes very little from opponents who are playing badly.',
          'Almost every player at small stakes has one large, obvious leak. Your job is to **name it in a sentence**, then do the thing that punishes it.',
          'There are only a handful of leaks worth knowing, and every one of them has an opposite:',
          'Someone folds too much → **bluff them relentlessly**. Someone calls too much → **never bluff, value bet wider**. Someone bluffs too much → **call them down lighter**. Someone plays too many hands → **wait and punish with strong ones**.',
          'That is the entire skill. Notice the pattern, apply the opposite.',
        ],
        check: {
          question: 'What is the general principle of exploitative play?',
          options: [
            {
              key: 'a',
              label: 'Find what an opponent does too much of, and do the opposite',
              why: 'Right — that is the whole method. Every leak is an imbalance, and the profit comes from leaning the other way, harder than theory would suggest.',
            },
            {
              key: 'b',
              label: 'Play a perfectly balanced strategy at all times',
              why: 'Balance protects you but extracts nothing extra from bad players. Against someone with an obvious leak, staying balanced deliberately leaves money behind.',
            },
            {
              key: 'c',
              label: 'Play the same way against everyone so you are unpredictable',
              why: 'Unpredictability matters against strong opponents. Against weak ones, adapting to their specific mistake is worth far more than disguising your own play.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'The calling station and the nit',
        body: [
          'These two are opposites, and they are the most common types you will meet.',
          '**The calling station (Stan)** cannot fold. He came to see cards. Against him: **never bluff — not once**. Instead, value bet thinner and larger than feels comfortable. Hands you would normally check for pocket change become three-street value bets, because he pays every time.',
          '**The nit (Rocky)** folds far too much and never bluffs. Against him: **steal his blinds relentlessly**, because your cards barely matter when he folds most of them. And when he finally raises, **believe him and fold** — even with a good hand. His raising range is roughly the top 5% of hands and you are almost certainly beaten.',
          'Notice the symmetry: against the station you stop bluffing and start value betting; against the nit you bluff constantly and stop paying off.',
        ],
        check: {
          question: 'You have missed your draw completely on the river against Stan, the calling station. What do you do?',
          options: [
            {
              key: 'a',
              label: 'Check and give up',
              why: 'Right. A bluff needs a fold and he does not fold. Checking loses nothing; bluffing turns a hand worth zero into a hand that costs you a bet.',
            },
            {
              key: 'b',
              label: 'Bluff — it is the only way to win the pot',
              why: 'It is the only way in theory and it does not work in practice. Against someone who calls everything, this bluff loses money nearly every time you try it.',
            },
            {
              key: 'c',
              label: 'Bluff large — a big bet might finally make him fold',
              why: 'Sizing up against a station just loses more. His defining trait is that he calls anyway, so a bigger bluff is a bigger loss.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'The maniac, and reading a story',
        body: [
          '**The maniac (Max)** raises and bluffs constantly. The correct response is the opposite of instinct: **tighten your opening range, stop bluffing entirely, and call him down much wider than normal.** You do not need to fight him — just wait with a real hand and let him bet into it.',
          'Beyond player types, watch **betting patterns**, which tell you a story even from unknown opponents.',
          'The most reliable one in all of poker: a player bets the flop, bets the turn, then **checks the river**. That is almost always a busted draw. They were betting to make you fold, they ran out of steam, and now they want a cheap showdown.',
          'When you see that check, **bet**. Their checking range is full of hands that have to fold, and it costs them nothing to hand you the pot.',
        ],
        check: {
          question: 'Leo bets the flop and bets the turn, then checks the river. What is he most likely holding?',
          options: [
            {
              key: 'a',
              label: 'A busted draw — he was bluffing and gave up',
              why: 'Right, and this is one of the most reliable patterns in poker. He fired twice to make you fold, missed, and checking is him surrendering. Bet, and he almost has to fold.',
            },
            {
              key: 'b',
              label: 'A monster — he is trapping you',
              why: 'Possible, but rare. Someone with a huge hand who has already bet twice usually wants a third bet, not a check that risks a free showdown.',
            },
            {
              key: 'c',
              label: 'A medium hand hoping to see a cheap showdown',
              why: 'That does happen, but a player who bet aggressively on two streets and then stopped is far more often a bluff that ran out than a medium hand slowing down.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'Name the leak in one sentence, then do the opposite of it.',
      'Station: never bluff, value bet wide and large. Nit: steal constantly, fold when he raises.',
      'Maniac: tighten up, stop bluffing, call him down lighter.',
      'Bet, bet, then check almost always means a busted draw — attack it.',
    ],
  },

  /* ================================================================== *
   * TOURNAMENT ICM
   * ================================================================== */
  icm: {
    intro: 'In tournaments, the chips you win are worth less than the chips you lose. That one sentence changes how every late-stage hand should be played.',
    steps: [
      {
        title: 'Why chips stop being money',
        body: [
          'In a cash game, a chip is a euro. Win 100 chips and you have won 100 euros — the relationship is exactly one to one.',
          'In a tournament it is not. You cannot cash out chips; you can only convert them into a **finishing position**, and the prizes for those positions are fixed.',
          'Consider three players left with equal stacks and prizes of 500 / 300 / 200. Each player holds a third of the chips, and each is worth `(500 + 300 + 200) ÷ 3 = 333`.',
          'Now double your stack by knocking one out. You went from a third of the chips to two thirds — **twice the chips** — but you cannot win more than 500. Your prize equity has gone up by far less than double.',
          'Chips you win are worth less than the chips you risk. That asymmetry is what ICM measures.',
        ],
        check: {
          question: 'You double your chip stack late in a tournament. What happens to the money you expect to win?',
          options: [
            {
              key: 'a',
              label: 'It goes up, but by much less than double',
              why: 'Right. The prize pool is capped, so each additional chip is worth less than the one before. This diminishing return is the whole basis of ICM.',
            },
            {
              key: 'b',
              label: 'It doubles too',
              why: 'That is true in a cash game, where chips are money. In a tournament you cannot win more than first prize, so doubling your stack adds much less than double the equity.',
            },
            {
              key: 'c',
              label: 'It stays the same',
              why: 'More chips are definitely better — they improve your finishing position. They simply do not improve it in proportion to the chips gained.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'The bubble, where it bites hardest',
        body: [
          'The **bubble** is the point where one more elimination puts everyone else in the money. It is where ICM pressure peaks.',
          'Here is the consequence that catches people out: **a call that is clearly correct for chips can be clearly wrong for money.**',
          'Suppose you can call an all-in with 55% equity. In a cash game that is an instant call — you are a favourite. On the bubble it can be a large mistake, because busting costs you a guaranteed prize you were about to lock up, while winning only slightly improves a prize you might have got anyway.',
          'Losing costs more than winning gains. So on the bubble you **fold hands you would happily get in with** at any other stage.',
        ],
        check: {
          question: 'It is the bubble. You can call an all-in with 55% equity — you are a favourite. Should you?',
          options: [
            {
              key: 'a',
              label: 'Often not — busting costs a guaranteed payout that winning does not make up for',
              why: 'Right, and it is the most counter-intuitive idea in tournament poker. Being a favourite in chips is not the same as being a favourite in money once a pay jump is at stake.',
            },
            {
              key: 'b',
              label: 'Yes — you are a favourite, so it is always correct',
              why: 'That reasoning is exactly right for a cash game and wrong here. The chips you would win are worth less than the chips you would lose, so 55% is not enough.',
            },
            {
              key: 'c',
              label: 'Yes — you need chips to win the tournament',
              why: 'True eventually, but not at the cost of a near-certain payout. The bubble is the one moment where survival is worth more than accumulation.',
            },
          ],
          answer: 'a',
        },
      },
      {
        title: 'Playing the two sides of the pressure',
        body: [
          'ICM pressure is not symmetric, and both sides of it are exploitable.',
          '**If you have a big stack**, you have enormous leverage. Everyone else risks a pay jump by playing back at you, while you risk relatively little. **Attack constantly** — the bubble is when a big stack should be at its most aggressive.',
          '**If you have a short stack**, prefer **shoving over calling**. Moving all-in gives you two ways to win: they fold, or you win the hand. Calling only gives you the second. That extra fold equity is worth more than the slightly better hand you would have waited for.',
          'And once the bubble bursts, ICM pressure drops sharply. Play opens back up, and the very tight folds that were correct a hand ago stop being correct.',
        ],
        check: {
          question: 'You are the big stack on the bubble. How should you play?',
          options: [
            {
              key: 'a',
              label: 'Aggressively — everyone else risks a pay jump by fighting back',
              why: 'Right. They cannot afford to play back without risking a guaranteed payout, and you can. A big stack on the bubble should be relentless.',
            },
            {
              key: 'b',
              label: 'Cautiously — protect your lead until the money',
              why: 'This is the most common big-stack mistake. Sitting back throws away the one moment when your stack gives you maximum leverage, and lets short stacks survive for free.',
            },
            {
              key: 'c',
              label: 'The same as always — your stack should not change your strategy',
              why: 'Stack size changes everything on a bubble. The pressure falls on the players who can bust, and you are not one of them.',
            },
          ],
          answer: 'a',
        },
      },
    ],
    recap: [
      'Tournament chips convert into finishing positions, not cash — so their value diminishes.',
      'Doubling your stack raises your prize equity by far less than double.',
      'On the bubble, calls that are correct for chips can be wrong for money.',
      'Big stack: attack constantly. Short stack: shove rather than call.',
    ],
  },
};
