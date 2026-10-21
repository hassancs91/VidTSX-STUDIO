import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioMediaAsset, StudioProject } from '../../../../shared/types/studio';
import { exportDiskSources } from './disk-sources';

function asset(id: string, kind: StudioMediaAsset['kind'], filePath: string, hasAudio = true): StudioMediaAsset {
  return { id, kind, path: filePath, probe: { duration: 600, hasAudio } } as StudioMediaAsset;
}

function clip(kind: StudioClip['kind'], timelineStart: number, duration: number, assetId?: string): StudioClip {
  return { id: `${kind}-${timelineStart}`, kind, assetId, timelineStart, duration } as StudioClip;
}

function project(assets: StudioMediaAsset[], clips: StudioClip[]): Pick<StudioProject, 'assets' | 'timeline'> {
  return { assets, timeline: { tracks: [{ id: 't', kind: 'video', name: 'V1', clips }] } } as Pick<StudioProject, 'assets' | 'timeline'>;
}

describe('exportDiskSources', () => {
  it('counts each file once with the picture seconds of every clip that shows it', () => {
    const p = project(
      [asset('cam', 'video', 'D:\\raw\\cam.mp4'), asset('vo', 'audio', 'D:\\raw\\vo.wav'), asset('logo', 'image', 'D:\\logo.png')],
      [clip('video', 0, 10, 'cam'), clip('video', 12, 5, 'cam'), clip('audio', 0, 30, 'vo'), clip('image', 0, 3, 'logo')],
    );
    expect(exportDiskSources(p, {})).toEqual({
      files: [
        { path: 'D:\\raw\\cam.mp4', durationSeconds: 600, videoSeconds: 15 },
        { path: 'D:\\raw\\vo.wav', durationSeconds: 600, videoSeconds: 0 },
      ],
      longestShotRunSeconds: 0,
    });
  });

  it('reads the proxy for the picture and the original for its sound', () => {
    const p = project(
      [asset('cam', 'video', 'D:\\raw\\cam.mp4'), asset('screen', 'video', 'D:\\raw\\screen.mp4', false)],
      [clip('video', 0, 10, 'cam'), clip('video', 10, 10, 'screen')],
    );
    const sources = exportDiskSources(p, { sourcePaths: { cam: 'C:\\p\\cam.proxy.mp4', screen: 'C:\\p\\screen.proxy.mp4' } });
    expect(sources.files).toEqual([
      { path: 'C:\\p\\cam.proxy.mp4', durationSeconds: 600, videoSeconds: 10 },
      { path: 'D:\\raw\\cam.mp4', durationSeconds: 600, videoSeconds: 0 },
      { path: 'C:\\p\\screen.proxy.mp4', durationSeconds: 600, videoSeconds: 10 },
    ]);
  });

  it('finds the longest contiguous run of shots', () => {
    const p = project([], [clip('tsx', 0, 4), clip('tsx', 4, 3), clip('tsx', 10, 5), clip('tsx', 11, 2)]);
    expect(exportDiskSources(p, {}).longestShotRunSeconds).toBe(7);
  });

  it('copes with a document without a timeline', () => {
    expect(exportDiskSources({} as Pick<StudioProject, 'assets' | 'timeline'>, {})).toEqual({ files: [], longestShotRunSeconds: 0 });
  });
});
