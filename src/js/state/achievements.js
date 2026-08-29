/** Achievements: small, concrete goals that mark real progress. */

export const ACHIEVEMENTS = [
  { id: 'first-blood', name: 'First Blood', icon: '🩸', description: 'Answer your first drill correctly.' },
  { id: 'streak-10', name: 'On a Heater', icon: '🔥', description: 'Get 10 drill answers right in a row.' },
  { id: 'streak-25', name: 'Ice Cold', icon: '🧊', description: 'Get 25 drill answers right in a row.' },
  { id: 'module-master', name: 'Module Master', icon: '🎓', description: 'Reach 90% accuracy in a module over at least 20 attempts.' },
  { id: 'all-modules', name: 'Well Rounded', icon: '🧭', description: 'Attempt every unlocked training module.' },
  { id: 'gauntlet-perfect', name: 'Flawless', icon: '💎', description: 'Complete a Gauntlet run without a single mistake.' },
  { id: 'first-hand', name: 'Sat Down', icon: '🪑', description: 'Play your first hand at the table.' },
  { id: 'hundred-hands', name: 'Grinder', icon: '⚙️', description: 'Play 100 hands.' },
  { id: 'thousand-hands', name: 'Volume', icon: '🏭', description: 'Play 1,000 hands.' },
  { id: 'stack-double', name: 'Double Up', icon: '📈', description: 'Double your starting stack in a single session.' },
  { id: 'felt-a-bot', name: 'Predator', icon: '🦈', description: 'Bust an opponent.' },
  { id: 'royal', name: 'Once in a Lifetime', icon: '👑', description: 'Make a royal flush.' },
  { id: 'quads', name: 'Four of a Kind', icon: '🍀', description: 'Make four of a kind.' },
  { id: 'hero-call', name: 'Hero Call', icon: '🕵️', description: 'Win a pot by calling a river bluff.' },
  { id: 'move-up', name: 'Moving Up', icon: '🪜', description: 'Move up a stake with a proper bankroll.' },
  { id: 'nl100', name: 'Six Figures of Hands', icon: '💵', description: 'Reach NL100 in the bankroll challenge.' },
  { id: 'discipline', name: 'Discipline', icon: '🧘', description: 'Move down in stakes when your bankroll says you should.' },
  { id: 'level-5', name: 'Regular', icon: '📊', description: 'Reach the Regular rank.' },
  { id: 'level-8', name: 'Turning Pro', icon: '🎩', description: 'Reach the Pro rank.' },
  { id: 'level-10', name: 'Mastery', icon: '🧠', description: 'Reach GTO Master.' },
];

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id) || null;

/**
 * Check every achievement against the current profile and an event.
 * @returns {Array} newly unlocked achievements
 */
export function checkAchievements(profile, event = {}) {
  const unlocked = [];
  const grant = (id) => { if (profile.unlockAchievement(id)) unlocked.push(achievementById(id)); };

  const drills = profile.data.drills;
  const totalCorrect = Object.values(drills).reduce((s, d) => s + d.correct, 0);
  const bestStreak = Math.max(0, ...Object.values(drills).map((d) => d.bestStreak));

  if (totalCorrect >= 1) grant('first-blood');
  if (bestStreak >= 10) grant('streak-10');
  if (bestStreak >= 25) grant('streak-25');
  if (Object.values(drills).some((d) => d.attempts >= 20 && d.correct / d.attempts >= 0.9)) grant('module-master');

  if (event.type === 'gauntlet' && event.correct === event.total && event.total >= 8) grant('gauntlet-perfect');
  if (event.type === 'allModulesTried') grant('all-modules');

  const hands = profile.data.handsPlayed;
  if (hands >= 1) grant('first-hand');
  if (hands >= 100) grant('hundred-hands');
  if (hands >= 1000) grant('thousand-hands');

  if (event.type === 'hand') {
    if (event.doubledUp) grant('stack-double');
    if (event.bustedOpponent) grant('felt-a-bot');
    if (event.madeRoyal) grant('royal');
    if (event.madeQuads) grant('quads');
    if (event.heroCall) grant('hero-call');
  }
  if (event.type === 'stakeChange') {
    if (event.direction === 'up') grant('move-up');
    if (event.direction === 'down') grant('discipline');
    if (event.stakeKey === 'nl100' || event.stakeKey === 'nl200' || event.stakeKey === 'nl500') grant('nl100');
  }

  const level = profile.level;
  if (level >= 5) grant('level-5');
  if (level >= 8) grant('level-8');
  if (level >= 10) grant('level-10');

  return unlocked;
}
