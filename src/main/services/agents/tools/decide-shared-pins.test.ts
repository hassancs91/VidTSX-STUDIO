// Pins between part (d)'s main-side decide modules and part (f)'s renderer helpers (they cannot import main, so the shared pieces are
// pinned here): the `p` port is record-only (D-r22 (2)), the tester bands at the tool's default threshold, and the tool's band function is
// the shared one.
import { describe, expect, it } from 'vitest';
import { decisionOutcome as sharedOutcome } from '../../../../shared/decisions-outcome';
import { DECISIONS_TESTER_THRESHOLD } from '../../../../shared/decisions-tester-form';
import { decisionOutcome } from './decide-outcome';
import { DECIDE_OUTPUTS, DEFAULT_DECIDE_THRESHOLD } from './decide-run';

describe('decide — the pins part (f) relies on', () => {
  it('files `p` in the run record without drawing it; band and answer stay drawn, band first', () => {
    expect(DECIDE_OUTPUTS.map((o) => [o.id, o.recordOnly === true])).toEqual([
      ['band', false],
      ['answer', false],
      ['p', true],
    ]);
  });

  it('the developer tester bands at the tool’s default threshold', () => {
    expect(DECISIONS_TESTER_THRESHOLD).toBe(DEFAULT_DECIDE_THRESHOLD);
  });

  it('the tool’s band function IS the shared one', () => {
    expect(decisionOutcome).toBe(sharedOutcome);
  });
});
