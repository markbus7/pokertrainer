/**
 * The range ladder: how a chart stops being something you look at and starts
 * being something you know.
 *
 * The reader's ask was precise. A drill that asks nothing but the preflop
 * chart decision; the chart allowed while drilling; checkpoints rather than an
 * endless stream; and an end condition that is "I know it at the table without
 * looking". Three of those are structure. The fourth is the whole problem, and
 * a drill that simply lets you keep the chart open never reaches it — you get
 * very good at reading a grid.
 *
 * So the support is designed to be taken away. Each checkpoint is walked three
 * times: once with the chart on screen, once with it behind a button that
 * records every peek and refuses to credit a peeked answer, and once with no
 * chart and a clock. Clearing the third rung is the only thing that means
 * anything, and it means the thing the reader actually asked for.
 *
 * Two decisions worth stating because they are not obvious:
 *
 * Questions are drawn from the EDGE of the range, not uniformly. A third of
 * the 169-hand grid is a real decision — measured per position: 32-36% of
 * cells have a neighbour that disagrees with them. Sampling uniformly spends
 * two thirds of every session confirming that aces are a raise and 72o is a
 * fold, which is time not spent on the boundary where every mistake lives.
 *
 * Limping is always on the answer list and never correct in an unopened pot.
 * Leaving it off would make the question easier than the table, where the
 * option is right there and calling feels safe.
 */

import { CHARTS, POSITION_INFO } from './ranges.js';
import { handGrid } from '../core/cards.js';

/** Support levels, in the order they are removed. */
export const STAGES = [
  {
    key: 'chart',
    name: 'With the chart open',
    blurb: 'The chart is on screen. Find the hand and read the answer off it.',
    showsChart: true,
    seconds: 0,
  },
  {
    key: 'peek',
    name: 'Chart on request',
    blurb: 'The chart is behind a button. Peeking is allowed and is not counted — this rung is about how much you already know.',
    showsChart: false,
    canPeek: true,
    seconds: 0,
  },
  {
    key: 'blind',
    name: 'From memory, on the clock',
    blurb: 'No chart, twelve seconds a hand. This is the rung that matters: it is the speed the table asks for.',
    showsChart: false,
    seconds: 12,
  },
];

export const stageAt = (index) => STAGES[Math.min(index, STAGES.length - 1)];

/** A checkpoint is passed at PASS of ASKED, counting only unaided answers. */
export const ASKED = 15;
export const PASS = 12;

export const CHECKPOINTS = [
  { key: 'open:UTG', kind: 'open', seat: 'UTG', name: 'Opening from under the gun' },
  { key: 'open:HJ', kind: 'open', seat: 'HJ', name: 'Opening from the hijack' },
  { key: 'open:CO', kind: 'open', seat: 'CO', name: 'Opening from the cutoff' },
  { key: 'open:BTN', kind: 'open', seat: 'BTN', name: 'Opening from the button' },
  { key: 'open:SB', kind: 'open', seat: 'SB', name: 'Opening from the small blind' },
  { key: 'defend:BB', kind: 'defend', seat: 'BB', name: 'Defending the big blind' },
  { key: 'threebet', kind: 'threebet', name: 'Three-betting a raise' },
  {
    key: 'exam',
    kind: 'exam',
    name: 'The exam',
    only: 'blind',
    blurb: 'Every position, every spot, no chart. Pass this and you know them.',
  },
];

export const checkpointFor = (key) => CHECKPOINTS.find((c) => c.key === key) || CHECKPOINTS[0];

/**
 * The hands where the range has an edge.
 *
 * A hand is on the boundary when a neighbour in the grid — one rank either way
 * on either card — disagrees about whether it plays. Those are the cells a
 * reader gets wrong, and the ones worth asking about.
 */
export function edgeHands(range) {
  const grid = handGrid();
  const edge = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const key = grid[r][c];
      const mine = range.has(key);
      let differs = false;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr > 12 || nc > 12) continue;
        if (range.has(grid[nr][nc]) !== mine) differs = true;
      }
      if (differs) edge.push(key);
    }
  }
  return edge;
}

/** Everything in the grid, flat. */
export const allHands = () => handGrid().flat();

export const seatName = (seat) => (POSITION_INFO[seat] ? POSITION_INFO[seat].name : seat);

/** The chart a checkpoint is testing, for the on-screen grid. */
export function chartFor(checkpoint, raiser = 'CO') {
  if (checkpoint.kind === 'open') return { kind: 'rfi', set: CHARTS.rfi[checkpoint.seat] };
  if (checkpoint.kind === 'defend') {
    return { kind: 'defend', set: CHARTS.bbDefend[raiser], three: CHARTS.threeBet.BB };
  }
  return { kind: 'threebet', three: CHARTS.threeBet[raiser] };
}
