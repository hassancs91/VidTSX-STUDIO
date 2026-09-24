import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioMediaAsset, StudioTimeline } from '../types';
import { clipDisplayName, describeJoin, joinStatuses, transitionName } from './join-status';
import { isJoin, joinTarget, setTransition } from './transition-ops';

const FPS = 30;

/** Sources: `whole` is exactly 4 s (no handles when used whole), `long` is 20 s. */
const SOURCES: Record<string, number> = { whole: 4, long: 20 };
const sourceDurationOf = (assetId: string) => SOURCES[assetId];

function asset(id: string, path: string): StudioMediaAsset {
  return { id, kind: 'video', path, probe: { duration: SOURCES[id] ?? 1, hasAudio: true } };
}
const ASSETS = new Map([
  ['whole', asset('whole', 'C:\\media\\intro.mp4')],
  ['long', asset('long', 'C:/media/beach.mp4')],
]);

const video = (id: string, assetId: string, start: number, sourceIn: number): StudioClip => ({
  id,
  kind: 'video',
  assetId,
  timelineStart: start,
  duration: 4,
  sourceIn,
});

function timeline(a: StudioClip, b: StudioClip, locked = false): StudioTimeline {
  return { tracks: [{ id: 'v1', kind: 'video', name: 'V1', locked, clips: [a, b] }] };
}

/** a → b at 4 s, trimmed so both sides have source to spare. */
const trimmed = () => timeline(video('a', 'long', 0, 2), video('b', 'long', 4, 10));
/** Two whole 4 s clips back to back — no handles on either side. */
const whole = () => timeline(video('a', 'whole', 0, 0), video('b', 'whole', 4, 0));

const INSTALLED = new Map([['core/push-left', 'Push left']]);

describe('joinStatuses', () => {
  it('reports the name and the full length when both clips have handles', () => {
    const t = setTransition(trimmed(), 'a', 'core/push-left', 0.7);
    const status = joinStatuses(t, FPS, sourceDurationOf, INSTALLED).get('a');
    expect(status).toMatchObject({ kind: 'core/push-left', name: 'Push left', seconds: 0.7 });
    expect(status?.playsSeconds).toBeCloseTo(0.7, 1);
    expect(status?.short).toBe(false);
    expect(status?.warning).toBeUndefined();
  });

  it('warns "hard-cut" for two whole clips — the transition serializes to nothing', () => {
    const t = setTransition(whole(), 'a', 'core/push-left', 0.7);
    const status = joinStatuses(t, FPS, sourceDurationOf, INSTALLED).get('a');
    expect(status?.playsSeconds).toBe(0);
    expect(status?.short).toBe(false);
    expect(status?.warning).toBe('hard-cut');
  });

  it('reports a shortened length when only one side has handles', () => {
    const t = setTransition(timeline(video('a', 'whole', 0, 0), video('b', 'long', 4, 10)), 'a', 'crossfade', 1);
    const status = joinStatuses(t, FPS, sourceDurationOf, INSTALLED).get('a');
    expect(status?.playsSeconds).toBeGreaterThan(0);
    expect(status?.playsSeconds).toBeLessThan(1);
    expect(status?.short).toBe(true);
    expect(status?.warning).toBeUndefined();
  });

  it('never warns a dip — it needs no handles', () => {
    const t = setTransition(whole(), 'a', 'dip-to-black', 1);
    const status = joinStatuses(t, FPS, sourceDurationOf, INSTALLED).get('a');
    expect(status?.name).toBe('Dip to black');
    expect(status?.playsSeconds).toBeCloseTo(1, 5);
    expect(status?.warning).toBeUndefined();
  });

  it('warns "not-installed" for an unknown pack kind, but not while the list is loading', () => {
    const t = setTransition(trimmed(), 'a', 'gone/whoosh', 0.7);
    const known = joinStatuses(t, FPS, sourceDurationOf, INSTALLED).get('a');
    expect(known).toMatchObject({ name: 'gone/whoosh', warning: 'not-installed' });
    expect(joinStatuses(t, FPS, sourceDurationOf, null).get('a')?.warning).toBeUndefined();
  });

  it('prefers "hard-cut" over "not-installed" — the cut is what actually plays', () => {
    const t = setTransition(whole(), 'a', 'gone/whoosh', 0.7);
    expect(joinStatuses(t, FPS, sourceDurationOf, INSTALLED).get('a')?.warning).toBe('hard-cut');
  });

  it('skips joins without a transition', () => {
    expect(joinStatuses(trimmed(), FPS, sourceDurationOf, INSTALLED).size).toBe(0);
  });
});

describe('transitionName', () => {
  it('names natives, installed kinds, and falls back to the id', () => {
    expect(transitionName('crossfade', null)).toBe('Crossfade');
    expect(transitionName('core/push-left', INSTALLED)).toBe('Push left');
    expect(transitionName('core/push-left', null)).toBe('core/push-left');
  });
});

describe('joinTarget / isJoin', () => {
  it('uses the selected join first', () => {
    expect(joinTarget(trimmed(), 'a', ['b'])).toBe('a');
  });

  it('counts a single selected clip with a contiguous next clip as its out-join', () => {
    expect(joinTarget(trimmed(), null, ['a'])).toBe('a');
    expect(joinTarget(trimmed(), null, ['b'])).toBeNull(); // b ends the track
    expect(joinTarget(trimmed(), null, ['a', 'b'])).toBeNull(); // multi-select is no target
  });

  it('ignores a stale join and locked tracks', () => {
    expect(joinTarget(trimmed(), 'gone', ['a'])).toBe('a');
    expect(isJoin(timeline(video('a', 'long', 0, 2), video('b', 'long', 4, 10), true), 'a')).toBe(false);
    expect(isJoin(timeline(video('a', 'long', 0, 2), video('b', 'long', 5, 10)), 'a')).toBe(false);
  });
});

describe('describeJoin', () => {
  it('names both sides, the cut, the max length and the status', () => {
    const t = setTransition(timeline(video('a', 'whole', 0, 0), video('b', 'long', 4, 10)), 'a', 'crossfade', 0.5);
    const statuses = joinStatuses(t, FPS, sourceDurationOf, INSTALLED);
    expect(describeJoin(t, 'a', statuses, ASSETS)).toMatchObject({
      leadId: 'a',
      leadLabel: 'intro.mp4',
      trailLabel: 'beach.mp4',
      at: 4,
      pictureJoin: true,
      maxSeconds: 4,
      status: { kind: 'crossfade' },
    });
  });

  it('is null without a target, and flags a sound-only join', () => {
    expect(describeJoin(trimmed(), null, new Map(), ASSETS)).toBeNull();
    const audio: StudioTimeline = {
      tracks: [
        {
          id: 'a1',
          kind: 'audio',
          name: 'A1',
          clips: [
            { id: 'x', kind: 'audio', assetId: 'long', timelineStart: 0, duration: 2, sourceIn: 0 },
            { id: 'y', kind: 'audio', assetId: 'long', timelineStart: 2, duration: 3, sourceIn: 5 },
          ],
        },
      ],
    };
    expect(describeJoin(audio, 'x', new Map(), ASSETS)).toMatchObject({ pictureJoin: false, maxSeconds: 2, status: null });
  });

  it('prefers a clip label over the file name', () => {
    expect(clipDisplayName({ ...video('a', 'long', 0, 0), label: 'Opening' }, ASSETS)).toBe('Opening');
    expect(clipDisplayName({ id: 't', kind: 'tsx', timelineStart: 0, duration: 1 }, ASSETS)).toBe('tsx');
  });
});
