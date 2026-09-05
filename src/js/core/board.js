/**
 * Reading a board: how coordinated it is, and what that means for betting.
 *
 * Lives in core rather than beside the drills because the coach at the table
 * needs the same reading the drills grade against — a continuation bet is
 * right or wrong for reasons about the board, and two different answers to
 * "is this board wet" would be two different games.
 */

export function describeTexture(board) {
  const ranks = board.map((c) => (c >> 2) + 2);
  const suits = board.map((c) => c & 3);
  const suitCounts = [0, 0, 0, 0];
  for (const s of suits) suitCounts[s]++;
  const maxSuit = Math.max(...suitCounts);
  const sorted = [...new Set(ranks)].sort((a, b) => b - a);
  const paired = ranks.length !== new Set(ranks).size;
  const connected = sorted.length >= 2 && (sorted[0] - sorted[sorted.length - 1]) <= 4;
  const highCard = Math.max(...ranks);

  const tags = [];
  if (maxSuit >= 3) tags.push('monotone');
  else if (maxSuit === 2) tags.push('two-tone');
  else tags.push('rainbow');
  if (paired) tags.push('paired');
  if (connected) tags.push('connected');
  if (highCard >= 13) tags.push('ace/king-high');
  else if (highCard <= 9) tags.push('low');

  const wet = (maxSuit >= 2 ? 1 : 0) + (connected ? 1 : 0) + (highCard <= 11 ? 1 : 0);
  return { tags, wet: wet >= 2, dry: wet === 0, paired, monotone: maxSuit >= 3, twoTone: maxSuit === 2, highCard };
}
