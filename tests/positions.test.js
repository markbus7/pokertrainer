/**
 * The seats in words: every position a table of two to nine can deal you has
 * a name and a hint, and both are in Dutch.
 */

import { describe, it, assert } from './harness.js';
import { POSITION_INFO, positionInfo } from '../src/js/data/positions.js';
import { NL } from '../src/js/i18n/nl.js';

describe('positions', () => {
  it('names every seat a table deals', () => {
    for (const pos of ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO']) assert(positionInfo(pos), `no words for ${pos}`);
    assert(positionInfo('nowhere') === null);
  });
  it('is all in Dutch', () => {
    for (const { name, hint } of Object.values(POSITION_INFO)) {
      assert(NL[name], `no Dutch for ${name}`);
      assert(NL[hint], `no Dutch for ${hint}`);
    }
  });
});
