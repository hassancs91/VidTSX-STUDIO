import { describe, it, expect } from 'vitest';
import { openProgress, type OpenProgressInput } from './open-stages';

const base: OpenProgressInput = {
  documentLoaded: false,
  timelineReady: false,
  shots: { synced: false, total: 0, settled: 0, failed: 0 },
  framePainted: false,
};
const states = (input: OpenProgressInput) => openProgress(input).stages.map((s) => `${s.id}:${s.state}`);

describe('openProgress', () => {
  it('walks read → timeline → shots → frame, one active stage at a time', () => {
    expect(states(base)).toEqual(['read:active', 'timeline:pending', 'shots:pending', 'frame:pending']);
    expect(states({ ...base, documentLoaded: true })).toEqual(['read:done', 'timeline:active', 'shots:pending', 'frame:pending']);

    const loading = { ...base, documentLoaded: true, timelineReady: true, shots: { synced: true, total: 62, settled: 12, failed: 0 } };
    const view = openProgress(loading);
    expect(states(loading)).toEqual(['read:done', 'timeline:done', 'shots:active', 'frame:pending']);
    expect(view.stages[2]!.detail).toBe('12 of 62');
    expect(view.done).toBe(false);

    const settled = { ...loading, shots: { synced: true, total: 62, settled: 62, failed: 2 } };
    expect(states(settled)).toEqual(['read:done', 'timeline:done', 'shots:done', 'frame:active']);
    expect(openProgress(settled).stages[2]!.detail).toBe('62 of 62 · 2 failed');

    const painted = openProgress({ ...settled, framePainted: true });
    expect(painted.done).toBe(true);
    expect(painted.fraction).toBe(1);
  });

  it('never calls "0 of 0" done before the loader has synced', () => {
    const unsynced = { ...base, documentLoaded: true, timelineReady: true, framePainted: true };
    expect(openProgress(unsynced).done).toBe(false);
    const noShots = { ...unsynced, shots: { synced: true, total: 0, settled: 0, failed: 0 } };
    expect(openProgress(noShots).done).toBe(true);
    expect(openProgress(noShots).stages[2]!.detail).toBeUndefined();
  });

  it('a painted frame cannot finish the open while shots are still loading', () => {
    const early = {
      ...base,
      documentLoaded: true,
      timelineReady: true,
      framePainted: true,
      shots: { synced: true, total: 4, settled: 3, failed: 0 },
    };
    expect(states(early)).toEqual(['read:done', 'timeline:done', 'shots:active', 'frame:pending']);
  });

  it('moves the bar forward monotonically as shots settle', () => {
    const at = (settled: number) =>
      openProgress({ ...base, documentLoaded: true, timelineReady: true, shots: { synced: true, total: 10, settled, failed: 0 } }).fraction;
    const values = [0, 3, 7, 10].map(at);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(values[3]).toBeCloseTo(0.9);
  });
});
