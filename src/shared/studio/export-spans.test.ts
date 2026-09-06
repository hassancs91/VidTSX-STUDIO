// Span planner (docs/export-engines-plan.md Stage 2) on the two T1 reference
// documents and the edges Stage 2 draws: one video track, pure cuts only.
import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioProject, StudioTrack } from '../types/studio';
import { copiedPercent, copyBlocker, planExportAudio, planExportSpans } from './export-spans';

const DJI = 'C:\\Users\\Malak\\Documents\\GitHub\\VidTSX-STUDIO\\raw\\DJI_20260813142309_0270_D.MP4';
const ASSET = 'c9ed8f79-f1c6-4c8f-92ce-7c92a4a1b106';

function project(tracks: StudioTrack[], extra: Partial<StudioProject> = {}): StudioProject {
  return {
    schemaVersion: 1,
    id: 't',
    name: 't',
    createdAt: '',
    updatedAt: '',
    settings: { width: 1920, height: 1080, fps: 30, agent: {} },
    assets: [
      { id: ASSET, kind: 'video', path: DJI, probe: { duration: 139.022233, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } },
    ],
    timeline: { tracks },
    proposals: [],
    shots: [],
    ...extra,
  };
}

const video = (clips: StudioClip[], extra: Partial<StudioTrack> = {}): StudioTrack => ({ id: 'v1', kind: 'video', name: 'V1', clips, ...extra });
const audioTrack: StudioTrack = { id: 'a1', kind: 'audio', name: 'A1', clips: [] };
const clip = (id: string, timelineStart: number, duration: number, sourceIn: number, extra: Partial<StudioClip> = {}): StudioClip => ({
  id, kind: 'video', assetId: ASSET, timelineStart, duration, sourceIn, origin: { by: 'user' }, ...extra,
});

/** `t5-1080p` ("T6 stress 3h" card): one 30 s clip from source 0. */
const T5 = project([video([clip('clip_t6_0000', 0, 30, 0)]), audioTrack]);
/** `t5-1080p-cut` ("T1 cut"): 0–15 s from source 0, 15–30 s from source 15. */
const T5_CUT = project([video([clip('clip_t1_cut_a', 0, 15, 0), clip('clip_t1_cut_b', 15, 15, 15)]), audioTrack]);

describe('planExportSpans on the T1 reference documents', () => {
  it('copies all 900 frames of t5-1080p as one span from source frame 0', () => {
    const plan = planExportSpans(T5);
    expect(plan.totalFrames).toBe(900);
    expect(plan.copiedFrames).toBe(900);
    expect(copiedPercent(plan)).toBe(100);
    expect(plan.spans).toEqual([
      { kind: 'copy', from: 0, frames: 900, assetId: ASSET, assetPath: DJI, sourceFrame: 0, firstFrameCeil: false },
    ]);
    expect(plan.reason).toBeUndefined();
  });

  it('copies t5-1080p-cut as two spans with the seek at frame 450 (source frame 450)', () => {
    const plan = planExportSpans(T5_CUT);
    expect(plan.spans).toEqual([
      { kind: 'copy', from: 0, frames: 450, assetId: ASSET, assetPath: DJI, sourceFrame: 0, firstFrameCeil: false },
      { kind: 'copy', from: 450, frames: 450, assetId: ASSET, assetPath: DJI, sourceFrame: 450, firstFrameCeil: false },
    ]);
    expect(copiedPercent(plan)).toBe(100);
  });

  it('plans the audio of both as plain source cuts covering the whole 30 s', () => {
    expect(planExportAudio(T5)).toEqual({
      duration: 30,
      segments: [{ kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 30 }],
    });
    expect(planExportAudio(T5_CUT)?.segments).toEqual([
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 15 },
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 15, duration: 15 },
    ]);
  });
});

describe('planExportSpans edges', () => {
  it('uses Remotion\'s whole-frame trimBefore for the source position', () => {
    // sourceIn 15.013 s → trimBefore round(450.39) = 450 frames, as serialize.ts does.
    const plan = planExportSpans(project([video([clip('a', 0, 10, 15.013)])]));
    expect(plan.spans[0]).toMatchObject({ kind: 'copy', sourceFrame: 450, firstFrameCeil: true });
  });

  it('marks the first frame ceil only when the composition opens mid-source (T1 leg 3)', () => {
    expect(planExportSpans(project([video([clip('a', 0, 10, 0)])])).spans[0]).toMatchObject({ firstFrameCeil: false });
    expect(planExportSpans(project([video([clip('a', 0, 10, 5)])])).spans[0]).toMatchObject({ firstFrameCeil: true });
    // A later clip never is: it is a cut inside the composition, which shows the nearest frame.
    expect(planExportSpans(T5_CUT).spans[1]).toMatchObject({ firstFrameCeil: false });
  });

  it('fills gaps with black and a range window\'s tail too', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 2, 0), clip('b', 3, 2, 10)])]), 200);
    expect(plan.spans.map((s) => [s.kind, s.from, s.frames])).toEqual([
      ['copy', 0, 60],
      ['black', 60, 30],
      ['copy', 90, 60],
      ['black', 150, 50],
    ]);
    expect(plan.totalFrames).toBe(200);
    expect(copiedPercent(plan)).toBe(60);
  });

  it('sends a touched clip to the browser and keeps the rest copied', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0), clip('b', 5, 5, 20, { transform: { scale: 1.2 } }), clip('c', 10, 5, 40)])]));
    expect(plan.spans.map((s) => [s.kind, s.from, s.frames])).toEqual([
      ['copy', 0, 150],
      ['browser', 150, 150],
      ['copy', 300, 150],
    ]);
    expect((plan.spans[1] as { reason: string }).reason).toBe('transform');
    expect(copiedPercent(plan)).toBe(67);
  });

  it('splits a copied clip around an overlay and resumes the source position after it', () => {
    const overlay: StudioTrack = { id: 'o1', kind: 'overlay', name: 'O1', clips: [{ id: 't', kind: 'tsx', timelineStart: 4, duration: 2, tsx: { shotId: 's', mode: 'overlay' } }] };
    const plan = planExportSpans(project([overlay, video([clip('a', 0, 10, 20)])]));
    expect(plan.spans).toEqual([
      { kind: 'copy', from: 0, frames: 120, assetId: ASSET, assetPath: DJI, sourceFrame: 600, firstFrameCeil: true },
      { kind: 'browser', from: 120, frames: 60, reason: 'overlay' },
      { kind: 'copy', from: 180, frames: 120, assetId: ASSET, assetPath: DJI, sourceFrame: 780, firstFrameCeil: false },
    ]);
  });

  it('merges adjacent browser pieces into one span', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0, { speed: 2 }), clip('b', 5, 5, 20, { gain: 0.5 })])]));
    expect(plan.spans).toEqual([{ kind: 'browser', from: 0, frames: 300, reason: 'speed' }]);
    expect(plan.copiedFrames).toBe(0);
    expect(plan.reason).toBe('speed');
  });

  it('a transition touches both clips at the boundary', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0, { transitionOut: { kind: 'crossfade', duration: 1 } }), clip('b', 5, 5, 20), clip('c', 10, 5, 40)])]));
    expect(plan.spans.map((s) => [s.kind, s.from, s.frames])).toEqual([
      ['browser', 0, 300],
      ['copy', 300, 150],
    ]);
  });

  it('renders everything in the browser for captions, a second video track, or no video track', () => {
    expect(planExportSpans(project([video([clip('a', 0, 5, 0)])], { captions: { enabled: true } as StudioProject['captions'] })).reason).toBe('captions');
    const two = project([video([clip('a', 0, 5, 0)]), video([clip('b', 0, 5, 0)], { id: 'v2' })]);
    expect(planExportSpans(two)).toMatchObject({ copiedFrames: 0, reason: 'more than one video track', spans: [{ kind: 'browser', from: 0, frames: 150 }] });
    expect(planExportSpans(project([audioTrack])).reason).toBe('no video track');
  });

  it('a hidden video track paints nothing (the serializer drops it)', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0)], { hidden: true }), video([clip('b', 0, 5, 0)], { id: 'v2' })]));
    expect(plan.spans).toEqual([{ kind: 'copy', from: 0, frames: 150, assetId: ASSET, assetPath: DJI, sourceFrame: 0, firstFrameCeil: false }]);
  });

  it('a clip whose asset is missing from the document is a gap, like the serializer', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0, { assetId: 'gone' })])]));
    expect(plan.spans).toEqual([{ kind: 'black', from: 0, frames: 150 }]);
  });
});

describe('copyBlocker', () => {
  const asset = T5.assets[0];
  const settings = T5.settings;
  it('names each Stage 2 disqualifier', () => {
    expect(copyBlocker(clip('a', 0, 5, 0), asset, settings)).toBeNull();
    expect(copyBlocker(clip('a', 0, 5, 0, { fadeInSec: 0.5 }), asset, settings)).toBe('fade');
    expect(copyBlocker(clip('a', 0, 5, 0, { transform: { x: 3 } }), asset, settings)).toBe('transform');
    expect(copyBlocker(clip('a', 0, 5, 0, { transform: { x: 0, scale: 1, opacity: 1 } }), asset, settings)).toBeNull();
    expect(copyBlocker(clip('a', 0, 5, 0, { transform: { opacity: 0.5 } }), asset, settings)).toBe('transform');
    expect(copyBlocker(clip('a', 0, 5, 0), { ...asset, probe: { ...asset.probe, width: 1440, height: 1080 } }, settings)).toBe('aspect ratio (letterboxed)');
    expect(copyBlocker(clip('a', 0, 5, 0), { ...asset, probe: { ...asset.probe, width: undefined } }, settings)).toBe('unknown source size');
    expect(copyBlocker(clip('a', 0, 10, 130), asset, settings)).toBe('runs past the source end');
    expect(copyBlocker(clip('a', 0, 4.022233, 135), asset, settings)).toBeNull(); // ends exactly at the source end
    expect(copyBlocker(clip('a', 0, 5, 0), undefined, settings)).toBe('missing asset');
    expect(copyBlocker({ ...clip('a', 0, 5, 0), kind: 'image' }, asset, settings)).toBe('image clip');
  });
});

describe('planExportAudio', () => {
  it('inserts silence for gaps, muted tracks and soundless sources, and pads the tail', () => {
    const silent = { ...T5.assets[0], id: 'q', probe: { ...T5.assets[0].probe, hasAudio: false } };
    const p = project([video([clip('a', 0, 2, 0), clip('b', 3, 2, 10, { assetId: 'q' }), clip('c', 5, 1, 30)])], { assets: [T5.assets[0], silent] });
    expect(planExportAudio(p, 240)?.segments).toEqual([
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 2 },
      { kind: 'silence', duration: 3 },
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 30, duration: 1 },
      { kind: 'silence', duration: 2 },
    ]);
    expect(planExportAudio(project([video([clip('a', 0, 2, 0)], { muted: true })]))?.segments).toEqual([{ kind: 'silence', duration: 2 }]);
  });

  it('refuses what only the browser mixes exactly (Stage 3)', () => {
    expect(planExportAudio(project([video([clip('a', 0, 2, 0, { gain: 0.8 })])]))).toBeNull();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0, { fadeOutSec: 0.2 })])]))).toBeNull();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0, { speed: 1.5 })])]))).toBeNull();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0)]), { ...audioTrack, clips: [{ ...clip('m', 0, 2, 0), kind: 'audio' }] }]))).toBeNull();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0)]), video([clip('b', 1, 2, 0)], { id: 'v2' })]))).toBeNull();
  });

  it('trims the audio to a range window that ends inside a clip', () => {
    expect(planExportAudio(project([video([clip('a', 0, 10, 5)])]), 90)?.segments).toEqual([
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 5, duration: 3 },
    ]);
  });
});
