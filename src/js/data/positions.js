/**
 * The seats, in words: what each position at the table is called, and the one
 * thing to know about playing from it. The table shows yours under the felt;
 * the hint is there for the first stops on the river, while the names are new.
 */

export const POSITION_INFO = {
  UTG: { name: 'Under the gun', hint: 'First to act before the flop, with everyone still to come: play only your strongest hands.' },
  'UTG+1': { name: 'Under the gun +1', hint: 'Still early, most of the table behind you: play tight.' },
  'UTG+2': { name: 'Under the gun +2', hint: 'Early: play tight.' },
  MP: { name: 'Middle position', hint: 'Halfway round: a few more hands than under the gun, still careful.' },
  HJ: { name: 'Hijack', hint: 'Two before the button: you can start opening more hands.' },
  CO: { name: 'Cutoff', hint: 'One before the button: open plenty, and try to steal the blinds.' },
  BTN: { name: 'Button', hint: 'The best seat: you act last after the flop. Open the most hands here.' },
  SB: { name: 'Small blind', hint: 'Half a blind already in, but you act first after the flop: careful.' },
  BB: { name: 'Big blind', hint: 'A blind already in: you get a good price to call, but you play out of position.' },
};

/** How many stops along the river the hints keep showing. */
export const SEAT_HINT_STOPS = 3;

export const positionInfo = (pos) => POSITION_INFO[pos] || null;
