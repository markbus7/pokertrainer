/**
 * Drill registry. The UI asks for a module and a difficulty; this decides
 * which generator to run and guarantees a usable question comes back.
 */

import { makeRng, randInt, shuffle } from '../core/rng.js';
import { MODULE_META, moduleMeta, unlockedModules } from '../data/curriculum.js';
import {
  handRankingDrill, nameThatHandDrill, outsDrill, ruleOfFourDrill,
  potOddsDrill, callOrFoldDrill,
} from './fundamentals.js';
import {
  openingDrill, facingRaiseDrill, positionDrill, blindDefenceDrill, handStrengthDrill,
} from './preflop.js';
import {
  cbetDrill, mdfDrill, bluffMathDrill, balanceDrill, bluffCatchDrill, sprDrill,
} from './postflop.js';
import {
  exploitDrill, icmDrill, bankrollDrill, varianceDrill, rakeDrill,
  gameSelectionDrill, winRateDrill,
} from './advanced.js';

const GENERATORS = {
  'hand-rankings': [handRankingDrill, nameThatHandDrill],
  'pot-odds': [potOddsDrill, callOrFoldDrill],
  outs: [outsDrill, ruleOfFourDrill],
  preflop: [openingDrill, facingRaiseDrill, handStrengthDrill],
  position: [positionDrill, blindDefenceDrill],
  cbet: [cbetDrill],
  mdf: [mdfDrill],
  bluffing: [bluffMathDrill, balanceDrill],
  spr: [sprDrill],
  exploit: [bluffCatchDrill, exploitDrill],
  icm: [icmDrill],
  bankroll: [bankrollDrill, varianceDrill, rakeDrill, gameSelectionDrill, winRateDrill],
};

export const DRILL_MODULE_IDS = Object.keys(GENERATORS);

/**
 * A question from a module. Generators may decline a spot (returning null)
 * when the randomly dealt situation is too close to grade fairly, so this
 * retries across the module's generators before giving up.
 */
export function generateQuestion(moduleId, rng = makeRng(), difficulty = 3) {
  const generators = GENERATORS[moduleId];
  if (!generators) throw new Error(`Unknown drill module: ${moduleId}`);
  for (let attemptNo = 0; attemptNo < 40; attemptNo++) {
    const gen = generators[randInt(rng, generators.length)];
    const question = gen(rng, difficulty);
    if (question && question.options && question.options.length >= 2) {
      const meta = moduleMeta(moduleId);
      return { ...question, module: moduleId, moduleName: meta ? meta.name : moduleId, icon: meta ? meta.icon : '🎲' };
    }
  }
  throw new Error(`Could not generate a question for ${moduleId}`);
}

/** Difficulty scales with your rank, so drills keep pace with you. */
export function difficultyForLevel(level) {
  return Math.max(1, Math.min(6, Math.ceil(level / 1.8)));
}

/**
 * The Gauntlet: a mixed run across everything you have unlocked.
 * This is the mode that actually proves you have learned something, because
 * you do not know which skill each question will test.
 */
export function generateGauntlet(rng, level, count = 10) {
  const modules = unlockedModules(level).map((m) => m.id).filter((id) => GENERATORS[id]);
  if (!modules.length) return [];
  const difficulty = difficultyForLevel(level);
  const questions = [];
  const bag = [];
  for (let i = 0; i < count; i++) {
    if (!bag.length) bag.push(...shuffle(rng, [...modules]));
    const moduleId = bag.pop();
    try {
      questions.push(generateQuestion(moduleId, rng, difficulty));
    } catch {
      i--; // that module could not produce a spot; try another
      if (questions.length + bag.length === 0) break;
    }
  }
  return questions;
}

export { MODULE_META, moduleMeta, unlockedModules };
