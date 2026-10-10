import { describe, expect, it, vi } from 'vitest';
import { BuildProgress, type BuildCounters } from './build-progress';
import type { BuildProgressEvent } from './types';

function setup(listener?: (event: BuildProgressEvent) => void) {
  const counters: BuildCounters = {
    round: 1,
    roundsMax: 3,
    checks: 2,
    turns: 5,
    tokens: { input: 10, output: 900, cacheRead: 40_000, cacheCreation: 3000 },
  };
  const events: BuildProgressEvent[] = [];
  const progress = new BuildProgress(Date.now() - 4000, () => counters, listener ?? ((e) => events.push(e)));
  return { counters, events, progress };
}

describe('BuildProgress', () => {
  it('stamps every event with the counters, phase and elapsed time at that moment', () => {
    const { counters, events, progress } = setup();
    progress.emit({ type: 'check', n: 2, ok: true, errors: [] });
    counters.tokens.output = 1500;
    expect(events[0]).toMatchObject({
      type: 'check',
      n: 2,
      status: { phase: 'preparing', round: 1, roundsMax: 3, checks: 2, turns: 5, tokens: { output: 900 } },
    });
    expect(events[0].status.elapsedMs).toBeGreaterThanOrEqual(4000);
  });

  it('emits a phase event only when the phase changes', () => {
    const { events, progress } = setup();
    progress.setPhase('working');
    progress.setPhase('working');
    progress.setPhase('rendering');
    expect(events.map((e) => [e.type, e.status.phase])).toEqual([
      ['phase', 'working'],
      ['phase', 'rendering'],
    ]);
    expect(progress.phase).toBe('rendering');
  });

  it('a throwing listener does not reach the run', () => {
    const listener = vi.fn(() => {
      throw new Error('UI bug');
    });
    const { progress } = setup(listener);
    expect(() => progress.setPhase('working')).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
