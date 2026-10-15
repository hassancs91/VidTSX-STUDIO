import { describe, expect, it } from 'vitest';
import { footageAt } from './shot-footage';
import { foldShot, withoutCancelledNew } from '../hooks/useShotJobs';
import type { StudioShot, StudioTimeline } from '../types';

const timeline = {
  tracks: [
    {
      id: 'v1',
      kind: 'video',
      name: 'Video',
      clips: [
        { id: 'a', kind: 'video', assetId: 'talk', timelineStart: 0, duration: 10, sourceIn: 5 },
        { id: 'b', kind: 'video', assetId: 'talk', timelineStart: 10, duration: 4, sourceIn: 30, speed: 2 },
      ],
    },
    { id: 'o1', kind: 'overlay', name: 'Overlay', clips: [{ id: 't', kind: 'tsx', timelineStart: 2, duration: 3 }] },
  ],
} as unknown as StudioTimeline;

describe('footageAt', () => {
  it('names the master clip under a second and its source second, speed included', () => {
    expect(footageAt(timeline, 3)).toEqual({ assetId: 'talk', sourceSeconds: 8 });
    expect(footageAt(timeline, 11)).toEqual({ assetId: 'talk', sourceSeconds: 32 });
  });

  it('is nothing past the footage, or in a project with no video', () => {
    expect(footageAt(timeline, 20)).toBeUndefined();
    expect(footageAt({ tracks: [] } as unknown as StudioTimeline, 0)).toBeUndefined();
  });
});

const shot = (over: Partial<StudioShot> = {}): StudioShot =>
  ({ id: 's1', name: 'Badge', kind: 'overlay', createdAt: 'x', activeVersion: 1, status: 'ready', ...over }) as StudioShot;

describe('the shot registry on builder events (P3 part 5)', () => {
  it('a cancelled new shot leaves the registry; a cancelled retake or edit leaves it as it was', () => {
    const shots = [shot(), shot({ id: 's2' })];
    expect(withoutCancelledNew(shots, { projectId: 'p', shotId: 's1', op: 'generate', status: 'canceled' })).toEqual([shot({ id: 's2' })]);
    expect(withoutCancelledNew(shots, { projectId: 'p', shotId: 's1', op: 'regenerate', status: 'canceled' })).toBe(shots);
    expect(withoutCancelledNew(shots, { projectId: 'p', shotId: 's1', op: 'edit', status: 'canceled' })).toBe(shots);
  });

  it('an edit adds the media keys its version registered and keeps the older ones', () => {
    const shots = [shot({ assetRefs: { logo: 'a1' } })];
    const folded = foldShot(shots, {
      projectId: 'p',
      shotId: 's1',
      op: 'edit',
      status: 'ready',
      shot: shot({ activeVersion: 2, assetRefs: { logo: 'a1', chart: 'a2' } }),
    });
    expect(folded[0].assetRefs).toEqual({ logo: 'a1', chart: 'a2' });
    // The version bump is the undoable step, dispatched apart.
    expect(folded[0].activeVersion).toBe(1);
  });
});
