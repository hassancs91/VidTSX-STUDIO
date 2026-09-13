import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioShot, StudioTimeline } from '../types';
import {
  describeAssetUsage,
  describeShotUsage,
  isAssetUsed,
  NO_USAGE,
  usageByAsset,
  usageByShot,
} from './asset-usage';

function clip(id: string, extra: Partial<StudioClip>): StudioClip {
  return { id, kind: 'video', timelineStart: 0, duration: 1, sourceIn: 0, ...extra };
}

function timeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          clip('c1', { assetId: 'raw' }),
          clip('c2', { assetId: 'raw', timelineStart: 1 }),
          clip('c3', { assetId: 'broll', timelineStart: 2 }),
        ],
      },
      {
        id: 'ov',
        kind: 'overlay',
        name: 'Shots',
        clips: [
          clip('t1', { kind: 'tsx', tsx: { shotId: 'title', mode: 'overlay' } }),
          clip('t2', { kind: 'tsx', tsx: { shotId: 'title', mode: 'overlay' }, timelineStart: 5 }),
          clip('t3', { kind: 'tsx', tsx: { shotId: 'card', mode: 'overlay' }, timelineStart: 9 }),
        ],
      },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [clip('m1', { kind: 'audio', assetId: 'raw' })] },
    ],
  };
}

const shots: StudioShot[] = [
  {
    id: 'card',
    name: 'Card',
    kind: 'title',
    createdAt: '',
    activeVersion: 1,
    status: 'ready',
    assetRefs: { page: 'book', tile: 'door', page2: 'book' },
  },
  { id: 'title', name: 'Title', kind: 'title', createdAt: '', activeVersion: 1, status: 'ready' },
];

describe('usageByAsset', () => {
  it('counts clips per track in track order and shots via assetRefs (deduped per shot)', () => {
    const u = usageByAsset(timeline(), shots);
    expect(u.get('raw')).toEqual({
      clips: 3,
      tracks: [
        { trackId: 'v1', name: 'V1', count: 2 },
        { trackId: 'a1', name: 'A1', count: 1 },
      ],
      shots: 0,
    });
    expect(u.get('broll')?.clips).toBe(1);
    expect(u.get('book')).toEqual({ clips: 0, tracks: [], shots: 1 });
    expect(u.get('door')?.shots).toBe(1);
    expect(u.has('unused')).toBe(false);
    expect(isAssetUsed(NO_USAGE)).toBe(false);
    expect(isAssetUsed(u.get('book')!)).toBe(true);
  });
});

describe('usageByShot', () => {
  it('counts tsx clips per shot', () => {
    const u = usageByShot(timeline());
    expect(u.get('title')).toBe(2);
    expect(u.get('card')).toBe(1);
    expect(u.has('other')).toBe(false);
  });
});

describe('describe*', () => {
  it('phrases clips, tracks and shots', () => {
    expect(describeAssetUsage({ clips: 297, tracks: [{ trackId: 'v1', name: 'V1', count: 297 }], shots: 2 })).toBe(
      'Used by 297 clips on V1 and 2 shots.',
    );
    expect(
      describeAssetUsage({
        clips: 3,
        tracks: [
          { trackId: 'v1', name: 'V1', count: 2 },
          { trackId: 'a1', name: 'A1', count: 1 },
        ],
        shots: 0,
      }),
    ).toBe('Used by 3 clips on V1 and A1.');
    expect(describeAssetUsage({ clips: 1, tracks: [{ trackId: 'v1', name: 'V1', count: 1 }], shots: 1 })).toBe(
      'Used by 1 clip on V1 and 1 shot.',
    );
    expect(describeAssetUsage({ clips: 0, tracks: [], shots: 1 })).toBe('Used by 1 shot.');
    expect(describeAssetUsage(NO_USAGE)).toBe('');
    expect(describeShotUsage(3)).toBe('Used by 3 clips on the timeline.');
    expect(describeShotUsage(0)).toBe('');
  });
});
