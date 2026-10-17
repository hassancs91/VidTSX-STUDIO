import { describe, expect, it } from 'vitest';
import { applyBuildEvent, buildProgressLabel, buildProgressPercent, initialBuildSnapshot, statusForPhase } from './build-job-snapshot';
import type { BuildProgressDetail, BuildProgressEvent, BuildProgressStatus } from '../tsx-builder/types';

// Event → snapshot: the counters follow every event, the sticky details
// (caps, last check, latest stills, seam, stopping) stay, and the job's
// coarse status, label and percent come from the phase and the rounds.

const status = (over: Partial<BuildProgressStatus> = {}): BuildProgressStatus => ({
  phase: 'working',
  round: 0,
  roundsMax: 6,
  checks: 0,
  turns: 0,
  tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
  elapsedMs: 0,
  ...over,
});

const event = (detail: BuildProgressDetail, over: Partial<BuildProgressStatus> = {}): BuildProgressEvent =>
  ({ ...detail, status: status(over) }) as BuildProgressEvent;

const CAPS = { turns: 200, minutes: 60, outputTokens: 250_000 };

describe('initialBuildSnapshot', () => {
  it('starts from the request: budget, format, edit, zeros', () => {
    expect(initialBuildSnapshot({ budget: 'craft', format: { width: 1080, height: 1350, fps: 30 } })).toEqual({
      budget: 'craft',
      format: { width: 1080, height: 1350, fps: 30 },
      edit: false,
      phase: 'preparing',
      round: 0,
      roundsMax: 0,
      checks: 0,
      turns: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      elapsedMs: 0,
      stills: [],
    });
    expect(initialBuildSnapshot({ budget: 'standard', editOf: { folderPath: 'C:/p' } }).edit).toBe(true);
  });
});

describe('applyBuildEvent', () => {
  const start = initialBuildSnapshot({ budget: 'craft', format: { width: 1080, height: 1350, fps: 30 } });

  it('copies the counters from every event and leaves the previous snapshot untouched', () => {
    const { build } = applyBuildEvent(
      start,
      event({ type: 'turn', turn: 3, outputTokens: 400 }, { round: 2, checks: 4, turns: 3, tokens: { input: 10, output: 900, cacheRead: 5000, cacheCreation: 200 }, elapsedMs: 61_000 }),
    );
    expect(build).toMatchObject({ phase: 'working', round: 2, roundsMax: 6, checks: 4, turns: 3, elapsedMs: 61_000 });
    expect(build.tokens).toEqual({ input: 10, output: 900, cacheRead: 5000, cacheCreation: 200 });
    expect(start.turns).toBe(0);
    expect(start.tokens.output).toBe(0);
  });

  it('keeps caps and edit from start, the last check, the seam and the stopping reason', () => {
    let { build } = applyBuildEvent(start, event({ type: 'start', budget: 'craft', caps: CAPS, roundsMin: 4, edit: true }, { phase: 'preparing' }));
    expect(build).toMatchObject({ caps: CAPS, edit: true, phase: 'preparing' });

    ({ build } = applyBuildEvent(build, event({ type: 'check', n: 2, ok: false, errors: ['TS1005'] }, { phase: 'checking', checks: 2 })));
    expect(build.lastCheck).toEqual({ n: 2, ok: false, errors: ['TS1005'] });
    expect(build.caps).toEqual(CAPS);

    ({ build } = applyBuildEvent(build, event({ type: 'seam', jump: true, wrap: 0.72, neighbours: 0.05 }, { checks: 2 })));
    expect(build.seam).toEqual({ jump: true, wrap: 0.72, neighbours: 0.05 });
    expect(build.lastCheck?.n).toBe(2);

    ({ build } = applyBuildEvent(build, event({ type: 'stopping', reason: 'cap-time' }, { phase: 'rendering', checks: 2 })));
    expect(build.stopping).toBe('cap-time');
    expect(build.seam?.jump).toBe(true);
  });

  it('keeps only the latest look: one record per still, one per sheet', () => {
    let { build } = applyBuildEvent(
      start,
      event({ type: 'stills', size: 'model', frames: [0, 120, 239], paths: ['/r/a.jpg', '/r/b.jpg', '/r/c.jpg'] }, { phase: 'rendering', round: 1 }),
    );
    expect(build.stills).toEqual([
      { round: 1, frame: 0, size: 'model', path: '/r/a.jpg' },
      { round: 1, frame: 120, size: 'model', path: '/r/b.jpg' },
      { round: 1, frame: 239, size: 'model', path: '/r/c.jpg' },
    ]);

    ({ build } = applyBuildEvent(build, event({ type: 'stills', size: 'sheet', frames: [0, 30, 60, 90], paths: ['/r/sheet.png'] }, { round: 2 })));
    expect(build.stills).toEqual([{ round: 2, frame: 0, size: 'sheet', frames: [0, 30, 60, 90], path: '/r/sheet.png' }]);

    ({ build } = applyBuildEvent(build, event({ type: 'stills', size: 'phone', frames: [120], paths: ['/r/phone.jpg'] }, { round: 2 })));
    expect(build.stills).toEqual([{ round: 2, frame: 120, size: 'phone', path: '/r/phone.jpg' }]);
  });

  it('adds the files the builder brought in, and counts generated images with their cost', () => {
    let { build } = applyBuildEvent(start, event({ type: 'asset', source: 'library', files: ['logo.svg'] }));
    expect(build.assetsAdded).toEqual(['logo.svg']);
    expect(build.images).toBeUndefined();
    ({ build } = applyBuildEvent(build, event({ type: 'asset', source: 'generated', files: ['backdrop.png'], costUsd: 0.04 })));
    ({ build } = applyBuildEvent(build, event({ type: 'asset', source: 'generated', files: ['sky.png'], costUsd: 0.04 })));
    expect(build.assetsAdded).toEqual(['logo.svg', 'backdrop.png', 'sky.png']);
    expect(build.images).toEqual({ count: 2, costUsd: 0.08 });
  });

  it('derives the job status from the phase, and none once the run is over', () => {
    expect(applyBuildEvent(start, event({ type: 'phase' }, { phase: 'rendering' })).status).toBe('generating');
    expect(applyBuildEvent(start, event({ type: 'phase' }, { phase: 'saving' })).status).toBe('saving');
    const done = applyBuildEvent(start, event({ type: 'done', stopReason: 'finished', ok: true, version: 1 }, { phase: 'done', round: 6 }));
    expect(done.status).toBeUndefined();
    expect(done.build).toMatchObject({ phase: 'done', stopReason: 'finished' });
    expect(done.progress).toEqual({ step: 'done', label: 'Complete', percent: 100 });
    expect(statusForPhase('checking')).toBe('generating');
    expect(statusForPhase('done')).toBeUndefined();
  });
});

describe('progress label and percent', () => {
  const base = initialBuildSnapshot({ budget: 'standard' });

  it('say the round and the phase, and move with the rounds', () => {
    expect(buildProgressLabel({ ...base, phase: 'preparing' })).toBe('Preparing');
    // Before the first look no round is named (it read "Round 0/1 · Designing and writing").
    expect(buildProgressLabel({ ...base, phase: 'working', round: 0, roundsMax: 1 })).toBe('Designing and writing');
    expect(buildProgressLabel({ ...base, phase: 'checking', round: 0, roundsMax: 3, stopping: 'cancelled' })).toBe('Checking · stopping (cancelled)');
    expect(buildProgressLabel({ ...base, phase: 'rendering', round: 1, roundsMax: 1 })).toBe('Round 1/1 · Rendering frames');
    expect(buildProgressLabel({ ...base, phase: 'rendering', round: 2, roundsMax: 3 })).toBe('Round 2/3 · Rendering frames');
    expect(buildProgressLabel({ ...base, phase: 'working', round: 1, roundsMax: 3, stopping: 'cap-tokens' })).toBe('Round 1/3 · Designing and writing · stopping (cap)');
    expect(buildProgressLabel({ ...base, phase: 'checking', round: 1, roundsMax: 3, stopping: 'cancelled' })).toBe('Round 1/3 · Checking · stopping (cancelled)');
    expect(buildProgressPercent({ ...base, phase: 'preparing' })).toBe(5);
    expect(buildProgressPercent({ ...base, phase: 'working', round: 1, roundsMax: 4 })).toBe(26);
    expect(buildProgressPercent({ ...base, phase: 'rendering', round: 4, roundsMax: 4 })).toBe(90);
    expect(buildProgressPercent({ ...base, phase: 'saving', round: 4, roundsMax: 4 })).toBe(98);
    expect(buildProgressPercent({ ...base, phase: 'done' })).toBe(100);
  });
});
