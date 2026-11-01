import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioMediaAsset, StudioShot } from '../types';
import { clipDisplayLabel } from './clip-label';

const assets = new Map<string, StudioMediaAsset>([
  ['a1', { id: 'a1', path: 'D:\\footage\\DJI_0323.MP4' } as StudioMediaAsset],
  ['a2', { id: 'a2', path: '/music/bed.mp3' } as StudioMediaAsset],
]);
const shots = new Map<string, StudioShot>([
  ['s1', { id: 's1', name: 'Pricing chart' } as StudioShot],
  ['s2', { id: 's2', name: '' } as StudioShot],
]);

function clip(extra: Partial<StudioClip>): StudioClip {
  return { id: 'c', kind: 'video', timelineStart: 0, duration: 2, ...extra };
}

describe('clipDisplayLabel', () => {
  it('prefers the clip label', () => {
    expect(clipDisplayLabel(clip({ label: 'Intro', assetId: 'a1' }), assets, shots)).toBe('Intro');
  });

  it("uses the source file's name, for either slash", () => {
    expect(clipDisplayLabel(clip({ assetId: 'a1' }), assets, shots)).toBe('DJI_0323.MP4');
    expect(clipDisplayLabel(clip({ kind: 'audio', assetId: 'a2' }), assets, shots)).toBe('bed.mp3');
  });

  it("names a shot clip after its shot, not 'tsx'", () => {
    const shotClip = clip({ kind: 'tsx', tsx: { shotId: 's1', mode: 'overlay' } });
    expect(clipDisplayLabel(shotClip, assets, shots)).toBe('Pricing chart');
  });

  it('falls back to a readable kind name when nothing else is known', () => {
    expect(clipDisplayLabel(clip({ kind: 'tsx', tsx: { shotId: 'gone', mode: 'cutaway' } }), assets, shots)).toBe('Shot');
    expect(clipDisplayLabel(clip({ kind: 'tsx', tsx: { shotId: 's2', mode: 'cutaway' } }), assets, shots)).toBe('Shot');
    expect(clipDisplayLabel(clip({ kind: 'caption' }), assets, shots)).toBe('Captions');
    expect(clipDisplayLabel(clip({ kind: 'sfx', assetId: 'missing' }), assets, shots)).toBe('Sound effect');
  });
});
