import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioMediaAsset, StudioProject, StudioTrack } from '../../../shared/types/studio';
import { pickPosterSource, posterSignature } from './project-poster-pick';

function asset(id: string, kind: StudioMediaAsset['kind'] = 'video'): StudioMediaAsset {
  return { id, kind, path: `C:/media/${id}.mp4`, probe: { duration: 100, hasAudio: true } };
}

function clip(partial: Partial<StudioClip> & Pick<StudioClip, 'id'>): StudioClip {
  return { kind: 'video', timelineStart: 0, duration: 10, ...partial };
}

function project(tracks: StudioTrack[], assets: StudioMediaAsset[]): StudioProject {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'P',
    createdAt: '',
    updatedAt: '',
    settings: { width: 1920, height: 1080, fps: 30, agent: {} },
    assets,
    timeline: { tracks },
    proposals: [],
    shots: [],
  };
}

describe('pickPosterSource (W6)', () => {
  it('takes the clip under 10 % of the timeline on the top-most video track', () => {
    const p = project(
      [
        { id: 'ov', kind: 'overlay', name: 'Overlay', clips: [clip({ id: 'o', kind: 'tsx', timelineStart: 0, duration: 5 })] },
        {
          id: 'v1',
          kind: 'video',
          name: 'V1',
          clips: [
            clip({ id: 'a', assetId: 'x', timelineStart: 0, duration: 20, sourceIn: 5 }),
            clip({ id: 'b', assetId: 'y', timelineStart: 20, duration: 40, sourceIn: 0 }),
          ],
        },
      ],
      [asset('x'), asset('y')],
    );
    // Timeline is 60 s → the point is 6 s → clip a, 6 s in, source 5 + 6.
    const pick = pickPosterSource(p);
    expect(pick?.asset.id).toBe('x');
    expect(pick?.sourceTime).toBeCloseTo(11, 5);
  });

  it('applies the clip speed to the source offset', () => {
    const p = project(
      [{ id: 'v1', kind: 'video', name: 'V1', clips: [clip({ id: 'a', assetId: 'x', duration: 50, sourceIn: 2, speed: 2 })] }],
      [asset('x')],
    );
    // 50 s timeline → 5 s in at 2× → 2 + 10.
    expect(pickPosterSource(p)?.sourceTime).toBeCloseTo(12, 5);
  });

  it('falls back to the earliest clip at 10 % of its own length when nothing covers the point', () => {
    const p = project(
      [
        {
          id: 'v1',
          kind: 'video',
          name: 'V1',
          clips: [
            // 0–30 s empty on V1; the clip covers 30–40 s; an audio clip on A1
            // stretches the timeline to 100 s, so the 10 % point (10 s) is bare.
            clip({ id: 'late', assetId: 'x', timelineStart: 30, duration: 10, sourceIn: 3 }),
          ],
        },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [clip({ id: 'm', kind: 'audio', assetId: 'song', duration: 100 })] },
      ],
      [asset('x'), asset('song', 'audio')],
    );
    expect(pickPosterSource(p)?.sourceTime).toBeCloseTo(4, 5);
  });

  it('returns null for an audio-only project and for an empty one', () => {
    const audioOnly = project(
      [
        { id: 'v1', kind: 'video', name: 'V1', clips: [] },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [clip({ id: 'm', kind: 'audio', assetId: 'song', duration: 30 })] },
      ],
      [asset('song', 'audio')],
    );
    expect(pickPosterSource(audioOnly)).toBeNull();
    expect(pickPosterSource(project([{ id: 'v1', kind: 'video', name: 'V1', clips: [] }], []))).toBeNull();
  });

  it('ignores a video clip whose asset is gone', () => {
    const p = project(
      [{ id: 'v1', kind: 'video', name: 'V1', clips: [clip({ id: 'a', assetId: 'missing', duration: 10 })] }],
      [],
    );
    expect(pickPosterSource(p)).toBeNull();
  });

  it('signature changes with the source file and the time, and is "none" without a source', () => {
    const src = { asset: asset('x'), sourceTime: 1.5 };
    expect(posterSignature(null, null)).toBe('none');
    expect(posterSignature(src, null)).toBe('none');
    expect(posterSignature(src, 'C:/a.mp4')).toBe('C:/a.mp4|1.500');
    expect(posterSignature({ ...src, sourceTime: 2 }, 'C:/a.mp4')).not.toBe(posterSignature(src, 'C:/a.mp4'));
  });
});
