import { describe, expect, it } from 'vitest';
import type { StudioMediaAsset, StudioProject, StudioTrack } from '../types/studio';
import { defaultExportSource, exportFileSuffix, isExportSource, proxySourceAvailability } from './export-source';

const video = (id: string, proxy?: 'ready' | 'pending'): StudioMediaAsset => ({
  id,
  kind: 'video',
  path: `D:\\raw\\${id}.MP4`,
  probe: { duration: 60, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' },
  ...(proxy ? { proxy: { path: `proxies/${id}.mp4`, status: proxy } } : {}),
});

function project(tracks: StudioTrack[], assets: StudioMediaAsset[]): StudioProject {
  return { schemaVersion: 1, id: 't', name: 't', createdAt: '', updatedAt: '', settings: { width: 1920, height: 1080, fps: 30, agent: {} }, assets, timeline: { tracks }, proposals: [], shots: [] };
}
const lane = (assetIds: string[]): StudioTrack => ({
  id: 'v1', kind: 'video', name: 'V1',
  clips: assetIds.map((assetId, i) => ({ id: `c${i}`, kind: 'video', assetId, timelineStart: i * 5, duration: 5, sourceIn: 0, origin: { by: 'user' } })),
});

describe('proxySourceAvailability', () => {
  it('is available only when every timeline video asset has a ready proxy', () => {
    expect(proxySourceAvailability(project([lane(['a', 'b'])], [video('a', 'ready'), video('b', 'ready')]))).toEqual({ available: true, missing: [], videoAssets: 2 });
    expect(proxySourceAvailability(project([lane(['a', 'b'])], [video('a', 'ready'), video('b', 'pending')]))).toEqual({ available: false, missing: ['b.MP4'], videoAssets: 2 });
    expect(proxySourceAvailability(project([lane(['a'])], [video('a')]))).toMatchObject({ available: false, missing: ['a.MP4'] });
  });

  it('ignores assets that are not on the timeline, and offers nothing for a timeline without video', () => {
    expect(proxySourceAvailability(project([lane(['a'])], [video('a', 'ready'), video('unused')]))).toMatchObject({ available: true, missing: [] });
    expect(proxySourceAvailability(project([lane([])], [video('a', 'ready')]))).toEqual({ available: false, missing: [], videoAssets: 0 });
  });
});

describe('defaultExportSource', () => {
  it('drafts from proxies at or under 540p, originals above, never when unavailable', () => {
    expect(defaultExportSource(960, 540, true)).toBe('proxy');
    expect(defaultExportSource(640, 360, true)).toBe('proxy');
    expect(defaultExportSource(1280, 720, true)).toBe('original');
    expect(defaultExportSource(540, 960, true)).toBe('proxy');
    expect(defaultExportSource(960, 540, false)).toBe('original');
  });
});

describe('exportFileSuffix', () => {
  it('names the size and the draft, nothing for a full export from originals', () => {
    expect(exportFileSuffix('original', 'original')).toBe('');
    expect(exportFileSuffix(undefined, undefined)).toBe('');
    expect(exportFileSuffix('720p', 'original')).toBe('_720p');
    expect(exportFileSuffix('540p', 'proxy')).toBe('_540p-draft');
    expect(exportFileSuffix('original', 'proxy')).toBe('_draft');
    expect(isExportSource('proxy')).toBe(true);
    expect(isExportSource('proxies')).toBe(false);
  });
});
