import { describe, expect, it, vi } from 'vitest';

vi.mock('../ffmpeg-bin', () => ({ getFfmpegBinary: async () => 'ffmpeg', runFfmpeg: async () => undefined }));

import type { StudioProject } from '../../../../shared/types/studio';
import { cutFramesOf, sourceReferenceOf, summaryLine, windowsWithin, type ExportVerifyReport } from './verify';

function project(clips: Array<{ start: number; duration: number; sourceIn?: number; assetId?: string; kind?: string; speed?: number }>, hasAudio = true): StudioProject {
  return {
    assets: [{ id: 'a', path: 'C:/raw/cam.MP4', probe: { hasAudio } }],
    timeline: {
      tracks: [
        { id: 'v', kind: 'video', name: 'V1', clips: clips.map((c, i) => ({ id: `c${i}`, kind: c.kind ?? 'video', assetId: c.assetId ?? 'a', timelineStart: c.start, duration: c.duration, sourceIn: c.sourceIn, speed: c.speed })) },
        { id: 'a', kind: 'audio', name: 'A1', clips: [] },
      ],
    },
  } as unknown as StudioProject;
}

describe('verification helpers (D5/D6)', () => {
  it('lists the cut frames of the video tracks, never frame 0', () => {
    expect(cutFramesOf(project([{ start: 0, duration: 15 }, { start: 15, duration: 15, sourceIn: 15 }]), 30)).toEqual([450]);
    expect(cutFramesOf(project([{ start: 0, duration: 30 }]), 30)).toEqual([]);
  });

  it('picks the first video clip with a camera file as the audio reference', () => {
    const ref = sourceReferenceOf(project([{ start: 2, duration: 5, sourceIn: 7 }, { start: 0, duration: 2, sourceIn: 0 }]));
    expect(ref).toEqual({ assetPath: 'C:/raw/cam.MP4', clipStart: 0, sourceIn: 0, duration: 2 });
    expect(sourceReferenceOf(project([{ start: 0, duration: 5 }], false))).toBeNull();
    expect(sourceReferenceOf(project([{ start: 0, duration: 5, speed: 2 }]))).toBeNull();
  });

  it('places windows clear of both ends of a span', () => {
    expect(windowsWithin(0, 30)).toEqual([0.5, 14.3, 28.5]);
    expect(windowsWithin(15, 15)).toEqual([15.5, 21.8, 28.5]);
    expect(windowsWithin(0, 1.5)).toEqual([]);
  });

  it('summarises the report in one line', () => {
    const report = {
      referenceEngine: 'remotion',
      frames: [{ frame: 1 }, { frame: 899 }],
      summary: { maxPctOver24: 0, maxMeanAbsDiff: 1.2, maxAbsLagMs: 0, sourceMaxAbsLagMs: 0 },
    } as unknown as ExportVerifyReport;
    expect(summaryLine(report)).toBe('Verified against "remotion": 2 frames, max 0 % of pixels over 24, max mean 1.2/255; audio vs reference 0 ms, vs camera 0 ms.');
  });
});
