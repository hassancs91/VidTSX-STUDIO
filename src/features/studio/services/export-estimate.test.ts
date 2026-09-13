import { describe, expect, it } from 'vitest';
import type { StudioMediaAsset, StudioProject, StudioTrack } from '@shared/types/studio';
import { COPY_REALTIME, HEAVY_BROWSER_FPS, estimateExport, formatEstimate, heavyFootageOf, measuredExportRate, type MeasuredExportJob } from './export-estimate';

const DJI: StudioMediaAsset = {
  id: 'dji',
  kind: 'video',
  path: 'D:\\raw\\DJI_20260902161804_0323_D.MP4',
  probe: { duration: 627.5, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' },
};
const PHONE: StudioMediaAsset = {
  id: 'phone',
  kind: 'video',
  path: 'D:\\raw\\clip.mp4',
  probe: { duration: 20, width: 1920, height: 1080, fps: 30, hasAudio: true, codec: 'h264' },
};
const PORTRAIT_4K: StudioMediaAsset = {
  id: 'portrait',
  kind: 'video',
  path: '/raw/portrait.mov',
  probe: { duration: 20, width: 2160, height: 3840, fps: 24, hasAudio: false, codec: 'h264' },
};

function project(tracks: StudioTrack[], assets: StudioMediaAsset[]): StudioProject {
  return {
    schemaVersion: 1,
    id: 't',
    name: 't',
    createdAt: '',
    updatedAt: '',
    settings: { width: 1920, height: 1080, fps: 30, agent: {} },
    assets,
    timeline: { tracks },
    proposals: [],
    shots: [],
  };
}

const video = (assetIds: string[]): StudioTrack => ({
  id: 'v1',
  kind: 'video',
  name: 'V1',
  clips: assetIds.map((assetId, i) => ({ id: `c${i}`, kind: 'video', assetId, timelineStart: i * 5, duration: 5, sourceIn: 0, origin: { by: 'user' } })),
});

describe('heavyFootageOf', () => {
  it('names the 4K HEVC 60 fps camera file with every reason, in the words the notice shows', () => {
    expect(heavyFootageOf(project([video(['dji', 'phone'])], [DJI, PHONE]))).toEqual([
      { assetId: 'dji', fileName: 'DJI_20260902161804_0323_D.MP4', reasons: ['4K', 'HEVC', '60 fps'] },
    ]);
  });

  it('counts only assets a video clip on the timeline plays', () => {
    expect(heavyFootageOf(project([video(['phone'])], [DJI, PHONE]))).toEqual([]);
  });

  it('reads a portrait 4K file as 4K and a POSIX path to its basename', () => {
    expect(heavyFootageOf(project([video(['portrait'])], [PORTRAIT_4K]))).toEqual([{ assetId: 'portrait', fileName: 'portrait.mov', reasons: ['4K'] }]);
  });
});

describe('estimateExport', () => {
  it('rates every frame at the measured browser speed for Standard, and the copied share at copy speed for Fast', () => {
    const e = estimateExport({ totalFrames: 4909, copiedFrames: 3000 }, 30);
    expect(e.standardSeconds).toBeCloseTo(4909 / HEAVY_BROWSER_FPS, 6);
    expect(e.fastSeconds).toBeCloseTo(1909 / HEAVY_BROWSER_FPS + 3000 / 30 / COPY_REALTIME, 6);
  });

  it('a timeline that copies nothing estimates the same for both engines', () => {
    const e = estimateExport({ totalFrames: 600, copiedFrames: 0 }, 30);
    expect(e.fastSeconds).toBe(e.standardSeconds);
  });
});

describe('measuredExportRate (Phase 2)', () => {
  const job = (over: Partial<MeasuredExportJob>): MeasuredExportJob => ({
    compositionId: 'studio-p1', status: 'done', exportEngine: 'passthrough', exportSource: 'proxy', totalFrames: 4909, startedAt: 1_000_000, completedAt: 1_000_000 + 4909 * 250, ...over,
  });

  it('reads the newest finished export of the same project, engine and source', () => {
    const older = job({ startedAt: 0, completedAt: 4909 * 500 });
    const newer = job({ startedAt: 2_000_000, completedAt: 2_000_000 + 4909 * 250 });
    expect(measuredExportRate([older, newer], 'studio-p1', 'passthrough', 'proxy')).toEqual({ secondsPerFrame: 0.25, completedAt: newer.completedAt });
  });

  it('ignores other projects, engines, sources, unfinished or too-short jobs; an absent source is the originals', () => {
    expect(measuredExportRate([job({ compositionId: 'studio-p2' })], 'studio-p1', 'passthrough', 'proxy')).toBeNull();
    expect(measuredExportRate([job({ exportEngine: 'remotion' })], 'studio-p1', 'passthrough', 'proxy')).toBeNull();
    expect(measuredExportRate([job({ exportSource: undefined })], 'studio-p1', 'passthrough', 'proxy')).toBeNull();
    expect(measuredExportRate([job({ exportSource: undefined })], 'studio-p1', 'passthrough', 'original')).not.toBeNull();
    expect(measuredExportRate([job({ status: 'cancelled' })], 'studio-p1', 'passthrough', 'proxy')).toBeNull();
    expect(measuredExportRate([job({ totalFrames: 10, completedAt: 1_000_000 + 2500 })], 'studio-p1', 'passthrough', 'proxy')).toBeNull();
    expect(measuredExportRate([job({ startedAt: undefined })], 'studio-p1', 'passthrough', 'proxy')).toBeNull();
    // A dev verify run rendered a second export after the first: not a measurement of one export.
    expect(measuredExportRate([job({ verifyAgainstEngine: 'remotion' })], 'studio-p1', 'passthrough', 'proxy')).toBeNull();
  });
});

describe('formatEstimate', () => {
  it('rounds to what a person would say', () => {
    expect(formatEstimate(20)).toBe('under a minute');
    expect(formatEstimate(70)).toBe('about a minute');
    expect(formatEstimate(45 * 60)).toBe('about 45 min');
    expect(formatEstimate(6136)).toBe('about 1.5 h');
    expect(formatEstimate(7 * 3600 + 200)).toBe('about 7 h');
    expect(formatEstimate(Number.NaN)).toBe('unknown');
  });
});
