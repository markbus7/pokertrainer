/**
 * Your seat at a table, kept when you look away.
 *
 * A cash table is paid for: the buy-in leaves the bankroll when you sit down
 * and only comes back when you cash out. Looking at something else — the
 * ledger, your character, a hand in the Log — used to end the table without
 * cashing out, and the chips went with it. Now the table waits where you left
 * it (ui/screenTable.js keeps it in memory), and this record keeps the chips
 * in the save, so a closed tab or a reload does not lose them either.
 *
 * The record holds the chips behind you, never the ones in the pot: it is
 * written after every action of yours, so getting up in the middle of a hand
 * is folding it, the way it is at any card room. What you had already put in
 * is lost; what you had behind comes back.
 *
 * A Regatta's entry is recorded too. A tournament cannot be taken back up
 * where it stopped, so one interrupted by a closed tab is settled the way the
 * Withdraw button settles it: the entry back if no card was dealt, a try with
 * no place if one was.
 */

const num = (x, min = 0) => (Number.isFinite(x) && x >= min ? x : null);

/** The seat in the save, checked: a record that can be acted on, or null. */
export function seatOf(profile) {
  const s = profile.data.seat;
  if (!s || typeof s !== 'object') return null;
  if (s.mode === 'grind') {
    const chips = num(s.chips);
    const bigBlind = num(s.bigBlind, 0.0001);
    const buyIn = num(s.buyIn, 0.0001);
    if (chips === null || bigBlind === null || buyIn === null || typeof s.venue !== 'string' || typeof s.table !== 'string') return null;
    return {
      mode: 'grind',
      venue: s.venue,
      table: s.table,
      chips,
      bigBlind,
      buyIn,
      buyInsUsed: Math.max(1, Math.round(num(s.buyInsUsed, 1) ?? 1)),
      at: num(s.at) ?? 0,
    };
  }
  if (s.mode === 'regatta') {
    const entry = num(s.entry);
    if (entry === null || typeof s.venue !== 'string') return null;
    return { mode: 'regatta', venue: s.venue, entry, dealt: Math.round(num(s.dealt) ?? 0), at: num(s.at) ?? 0 };
  }
  return null;
}

/** Chips at a cash table, in money: a hundred big blinds is one buy-in. */
export const chipsValue = (chips, bigBlind, buyIn) => Math.round(((chips / (bigBlind * 100)) * buyIn) * 100) / 100;

/** What a kept cash seat is worth if it cashed out now. */
export const seatValue = (seat) => (seat && seat.mode === 'grind' ? chipsValue(seat.chips, seat.bigBlind, seat.buyIn) : 0);

/** Keep the seat. The caller saves. */
export function keepSeat(profile, record) {
  profile.data.seat = { ...record, at: Date.now() };
}

export function clearSeat(profile) {
  if (profile.data.seat) delete profile.data.seat;
}

/**
 * The target that takes a table from its owner: get up with twice the buy-in.
 * Returned as what you have, what you need, and whether it is reached.
 */
export function doublingTarget(chips, bigBlind, buyIn) {
  const have = chipsValue(chips, bigBlind, buyIn);
  const need = Math.round(buyIn * 2 * 100) / 100;
  return { have, need, reached: have >= need, share: Math.max(0, Math.min(1, have / need)) };
}
