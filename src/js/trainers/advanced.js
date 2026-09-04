/**
 * Advanced drills: exploiting player types, tournament ICM, bankroll
 * management and game selection — the skills that separate a winning
 * player from someone who merely knows the rules.
 */

import { icmEquity, riskOfRuin, bankrollForRisk, bbPer100, rake } from '../core/odds.js';
import { randInt, shuffle } from '../core/rng.js';
import { PROFILES } from '../engine/bots.js';
import { STAKES, bankrollAdvice } from '../state/stats.js';
import { buildChoices, percentDistractors, pct } from './helpers.js';
import { t } from '../i18n/index.js';

/** Given a player type, choose the line that exploits them. */
export function exploitDrill(rng, difficulty = 5) {
  const scenarios = [
    {
      profile: 'station',
      question: 'You have top pair with a good kicker on the river against Stan, who has called every street. What is your play?',
      correct: 'Bet big for value',
      wrong: ['Check behind to avoid a raise', 'Bluff-shove to fold out better', 'Bet tiny to induce a raise'],
      explain: 'A calling station calls. Against someone who never folds, thin value bets are the whole strategy — and you should size them larger than normal, because he is not folding to that either.',
    },
    {
      profile: 'station',
      question: 'You missed your draw completely on the river against Stan. What is your play?',
      correct: 'Give up and check',
      wrong: ['Bluff half pot', 'Bluff the whole pot', 'Overbet to force a fold'],
      explain: 'Never bluff a calling station. His entire leak is that he cannot fold; a bluff turns your zero-equity hand into a guaranteed loss.',
    },
    {
      profile: 'rock',
      question: 'Rocky has folded 40 hands in a row. He raises from early position and you hold AJo on the button. What is your play?',
      correct: 'Fold',
      wrong: ['3-bet for value', 'Call and outplay him postflop', 'Shove all-in'],
      explain: 'A nit’s raising range is roughly the top 5% of hands. AJo is dominated by almost all of it. Folding a good-looking hand against a range this tight is exactly the discipline that separates winners from losers.',
    },
    {
      profile: 'rock',
      question: 'You are on the button. Rocky is in the big blind and has folded to every steal so far. You hold 96s. What is your play?',
      correct: 'Raise to steal the blinds',
      wrong: ['Fold, the hand is too weak', 'Limp to see a cheap flop', 'Call the big blind'],
      explain: 'Against a player who folds his blind too often, your cards barely matter. Every fold he makes is free money, and 96s still flops well when he does defend.',
    },
    {
      profile: 'maniac',
      question: 'Max has raised eight hands in a row. You pick up JJ in the big blind and he raises again. What is your play?',
      correct: '3-bet and be happy to get it in',
      wrong: ['Fold, he might have aces', 'Call and see a flop', 'Call and fold to a continuation bet'],
      explain: 'Against a range this wide, jacks are a monster. You do not need to hit a set — you are simply far ahead of the hands he is raising with. Let him pay you off.',
    },
    {
      profile: 'maniac',
      question: 'Max is betting every street with huge sizings. You hold second pair on the river. What is your play?',
      correct: 'Call — he bluffs far too often',
      wrong: ['Fold, the bet is too large', 'Raise to represent a monster', 'Fold and note the pattern'],
      explain: 'A maniac’s bluff frequency is far above what any bet size requires you to defend. Second pair is a fine bluff catcher against someone whose range is mostly air.',
    },
    {
      profile: 'lag',
      question: 'Leo has bet the flop and the turn, then checks the river. What does this usually mean?',
      correct: 'He gave up on a busted bluff',
      wrong: ['He is trapping with the nuts', 'He has a medium-strength hand', 'He wants a cheap showdown with top pair'],
      explain: 'An aggressive player who fires twice and then checks has almost always run out of steam with a missed draw. This is the moment to bet — his checking range is full of hands that must fold.',
    },
    {
      profile: 'tag',
      question: 'Tessa, a solid regular, 4-bets you after your 3-bet. You hold AQo. What is your play?',
      correct: 'Fold',
      wrong: ['5-bet shove', 'Call and hope to flop an ace', 'Call to keep her honest'],
      explain: 'A good regular’s 4-betting range is roughly QQ+ and AK. AQo is crushed by all of it. Against a balanced opponent you cannot manufacture an edge — you simply fold and wait.',
    },
  ];

  const spot = scenarios[randInt(rng, scenarios.length)];
  const villain = PROFILES[spot.profile];
  const { options, answer } = buildChoices(rng, t(spot.correct), spot.wrong.map((w) => t(w)));

  return {
    module: 'exploit',
    difficulty,
    scenario: { villain: { name: villain.name, style: t(villain.style), emoji: villain.emoji, tell: t(villain.tell) } },
    question: t(spot.question),
    options,
    answer,
    explanation: `${t(spot.explain)}\n\n${t('Remember: {counter}', { counter: t(villain.counter) })}`,
    xp: 20 + difficulty * 4,
  };
}

/**
 * ICM on the bubble. The whole answer is computed: fold equity versus the
 * ICM-weighted result of calling, so the drill can never teach a wrong number.
 */
export function icmDrill(rng, difficulty = 6) {
  const payouts = [500, 300, 200];
  const heroStack = (8 + randInt(rng, 14)) * 100;
  const shoverStack = (8 + randInt(rng, 14)) * 100;
  const thirdStack = (10 + randInt(rng, 25)) * 100;
  const bigBlind = 100;
  const shove = Math.min(heroStack, shoverStack);
  const equity = 0.35 + rng() * 0.3;   // hero's equity if they call

  // Folding is not free: you are in the big blind and give it up.
  const foldValue = icmEquity([heroStack - bigBlind, shoverStack + bigBlind, thirdStack], payouts)[0];

  const winStacks = [heroStack + shove, shoverStack - shove, thirdStack];
  const loseStacks = [heroStack - shove, shoverStack + shove, thirdStack];
  const callValue = equity * icmEquity(winStacks, payouts)[0]
    + (1 - equity) * icmEquity(loseStacks, payouts)[0];

  const shouldCall = callValue > foldValue;
  if (Math.abs(callValue - foldValue) < 4) return null;   // too close to grade

  const { options, answer } = buildChoices(rng, shouldCall ? t('Call') : t('Fold'), [t('Call'), t('Fold')]);
  const compare = shouldCall
    ? t('Folding leaves you worth about {fold} in prize money. Calling is worth {call} — more, so the call is '
      + 'correct.', { fold: foldValue.toFixed(0), call: callValue.toFixed(0) })
    : t('Folding leaves you worth about {fold} in prize money. Calling is worth {call} — less, so folding is '
      + 'correct.', { fold: foldValue.toFixed(0), call: callValue.toFixed(0) });

  return {
    module: 'icm',
    difficulty,
    scenario: {
      stacks: [
        { label: t('You'), chips: heroStack },
        { label: t('Shover'), chips: shoverStack },
        { label: t('Third player'), chips: thirdStack },
      ],
      payouts,
    },
    question: t('Three players left and the prizes are {payouts}. You are in the big blind ({bb}) and the other '
      + 'big stack shoves {shove} into you. You estimate {equity} equity if you call. Call or fold?',
      { payouts: payouts.join(' / '), bb: bigBlind, shove, equity: pct(equity) }),
    options,
    answer,
    explanation: `${compare} ${t('This is the ICM trap: with {equity} equity you would call instantly for chips, '
      + 'but chips are not money once there are pay jumps. Busting costs you a guaranteed ladder, while doubling '
      + 'up only improves your share of a prize you might have won anyway.', { equity: pct(equity) })}`,
    xp: 25 + difficulty * 4,
  };
}

/** Bankroll management: can you sit in this game? */
export function bankrollDrill(rng, difficulty = 3) {
  // Draw above the bottom rung, so that "move down" is always real advice.
  const stake = STAKES[1 + randInt(rng, 5)];
  const buyIns = [4, 8, 15, 22, 30, 45, 70][randInt(rng, 7)];
  const bankroll = Math.round(stake.buyIn * buyIns);
  const advice = bankrollAdvice(bankroll, stake.key);
  const sitDown = t('Yes — sit down at {stake}', { stake: stake.name });
  const correct = advice.ok ? sitDown : t('No — move down in stakes');
  const { options, answer } = buildChoices(rng, correct, [
    sitDown,
    t('No — move down in stakes'),
    t('Yes, but only with half a buy-in'),
  ]);

  return {
    module: 'bankroll',
    difficulty,
    scenario: { bankroll, stake: stake.name, buyIns },
    question: t('Your bankroll is ${bankroll} and you are thinking about playing {stake} (${buyIn} buy-in). '
      + 'Should you?', { bankroll: bankroll.toFixed(2), stake: stake.name, buyIn: stake.buyIn }),
    options,
    answer,
    explanation: `${t('{n} buy-ins. The standard rule for no-limit cash is 30 to 50 buy-ins, because a winning '
      + 'player still runs 20 buy-ins below expectation from time to time.', { n: buyIns })
    } ${advice.message}${advice.suggestion ? ` ${advice.suggestion}` : ''}`,
    xp: 12 + difficulty * 3,
  };
}

/** Variance and risk of ruin — why good players still go broke. */
export function varianceDrill(rng, difficulty = 5) {
  const winRate = [1, 2, 3, 5, 8][randInt(rng, 5)];
  const bankrollBb = [500, 1000, 2000, 3000, 5000][randInt(rng, 5)];
  const risk = riskOfRuin(bankrollBb, winRate, 100);
  const truePct = Math.max(1, Math.round(risk * 100));
  const about = (p) => t('About {pct}%', { pct: p });
  const { options, answer } = buildChoices(
    rng, about(truePct), percentDistractors(rng, truePct, 3, 20, 8).map(about),
  );

  return {
    module: 'bankroll',
    difficulty,
    scenario: { winRate, bankrollBb },
    question: t('You win at {rate}bb/100 with a standard deviation of 100bb/100, and your bankroll is {roll} big '
      + 'blinds. Roughly what is your risk of going broke?', { rate: winRate, roll: bankrollBb }),
    options,
    answer,
    explanation: t('Risk of ruin ≈ e^(−2 × {rate} × {roll} ÷ 100²) = {risk}. A bankroll of {safe}bb would bring '
      + 'that down to 5%. Notice how much harder a small edge has to work: halving your win rate does not double '
      + 'your risk, it squares the problem.',
      { rate: winRate, roll: bankrollBb, risk: pct(risk, 1), safe: Math.round(bankrollForRisk(winRate, 100, 0.05)) }),
    xp: 20 + difficulty * 3,
  };
}

/** Rake: the reason marginal winning spots are not actually winning. */
export function rakeDrill(rng, difficulty = 4) {
  const potBb = [10, 20, 40, 60, 100][randInt(rng, 5)];
  const taken = rake(potBb, { percent: 0.05, cap: 3, bigBlind: 1, sawFlop: true });
  const share = taken / potBb;
  const truePct = Math.round(share * 100);
  const { options, answer } = buildChoices(
    rng, `${truePct}%`, percentDistractors(rng, truePct, 3, 6, 2).map((p) => `${p}%`),
  );

  return {
    module: 'bankroll',
    difficulty,
    scenario: { potBb, rakeBb: taken },
    question: t('A pot reaches {pot} big blinds. The site takes 5% capped at 3bb. What fraction of the pot goes '
      + 'to the house?', { pot: potBb }),
    options,
    answer,
    explanation: `${t('The house takes {taken}bb, which is {share} of the pot.',
      { taken: taken.toFixed(2), share: pct(share, 1) })} ${
      share >= 0.049
        ? t('Small pots are raked hardest in percentage terms — this is exactly why limping and playing tiny pots '
          + 'out of position loses money even when you "break even" on the cards.')
        : t('The cap means big pots are raked far more gently. Winning players make their money in the pots that '
          + 'reach the cap.')
    }`,
    xp: 16 + difficulty * 3,
  };
}

/** Game selection: choosing the table is a bigger edge than playing it well. */
export function gameSelectionDrill(rng, difficulty = 4) {
  const tables = shuffle(rng, [
    { label: '3 players, all tight regulars, 18% average VPIP', score: 1, why: 'A short table of good regulars is the worst game on the site. Everyone is competent, the rake per hand is high, and there is no weak player to win from.' },
    { label: '6 players, one player seeing 68% of flops', score: 4, why: 'One very loose player is the single best indicator of a beatable table. Most of your profit comes from the worst player in the game.' },
    { label: '6 players, average VPIP 21%, no obvious weak spot', score: 2, why: 'A normal, competent table. You can beat it, but slowly.' },
    { label: '5 players, two seats waiting, average VPIP 24%', score: 3, why: 'Reasonable, but you have no read yet on who is weak.' },
  ]);
  const best = tables.reduce((a, b) => (b.score > a.score ? b : a));
  const { options, answer } = buildChoices(rng, t(best.label),
    tables.filter((table) => table !== best).map((table) => t(table.label)));

  return {
    module: 'bankroll',
    difficulty,
    scenario: null,
    question: t('Four tables have open seats. Which do you join?'),
    options,
    answer,
    explanation: `${t(best.why)}\n\n${t('Game selection is the highest-value habit in online poker. A mediocre '
      + 'player at a great table beats a great player at a bad one.')}`,
    xp: 18 + difficulty * 3,
  };
}

/** Win-rate arithmetic — turning bb/100 into actual money. */
export function winRateDrill(rng, difficulty = 4) {
  const stake = STAKES[1 + randInt(rng, 5)];
  const winRate = [2, 3, 5, 7][randInt(rng, 4)];
  const hands = [10000, 20000, 50000][randInt(rng, 3)];
  const profit = (winRate / 100) * hands * stake.bb;
  const rounded = Math.round(profit);
  const { options, answer } = buildChoices(rng, `$${rounded}`, [
    `$${Math.round(rounded * 2)}`, `$${Math.round(rounded / 2)}`, `$${Math.round(rounded * 10)}`,
  ]);

  return {
    module: 'bankroll',
    difficulty,
    scenario: { stake: stake.name, winRate, hands },
    question: t('You beat {stake} ({bb}/big blind) for {rate}bb/100 over {hands} hands. How much did you make?',
      { stake: stake.name, bb: stake.bb.toFixed(2), rate: winRate, hands: hands.toLocaleString('en-US') }),
    options,
    answer,
    explanation: t('{rate}bb/100 × {hands} hands = {bbWon}bb, and at ${bb} per big blind that is ${money}. Verify '
      + 'with the formula: {check}bb/100. This is the honest arithmetic of online poker — the edges are small, and '
      + 'volume is what turns them into money.',
      { rate: winRate, hands: hands.toLocaleString('en-US'), bbWon: ((winRate / 100) * hands).toFixed(0),
        bb: stake.bb.toFixed(2), money: rounded, check: bbPer100(profit / stake.bb, hands).toFixed(1) }),
    xp: 16 + difficulty * 3,
  };
}
