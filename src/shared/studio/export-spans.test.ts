// Span planner (docs/export-engines-plan.md Stage 2) on the two T1 reference
// documents and the edges Stage 2 draws: one video track, pure cuts only —
// plus Stage 3's first widening (gain-only clips: video copied, gain carried
// into the one audio pass).
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

  it('the first clip of a source file takes the ceil frame on its first frame; a same-file cut or a return to an opened file the nearest (Stage 3, measured)', () => {
    const DJI2 = 'C:\\Users\\Malak\\Documents\\GitHub\\VidTSX-STUDIO\\raw\\DJI_20260813142800_0272_D.MP4';
    const ASSET2 = '4f0c2c8e-1d3b-4b7a-9c6e-0272aaaa0272';
    const twoFiles = project([video([
      clip('a', 0, 3, 0),
      clip('b', 3, 3, 15, { assetId: ASSET2 }),
      clip('c', 6, 3, 30),
      clip('d', 9, 3, 60),
      clip('e', 12, 3, 40, { assetId: ASSET2, transform: { scale: 1.1 } }),
      clip('f', 15, 3, 60, { assetId: ASSET2 }),
    ])], {
      assets: [
        { id: ASSET, kind: 'video', path: DJI, probe: { duration: 139.022233, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } },
        { id: ASSET2, kind: 'video', path: DJI2, probe: { duration: 157.9745, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } },
      ],
    });
    expect(planExportSpans(twoFiles).spans).toEqual([
      { kind: 'copy', from: 0, frames: 90, assetId: ASSET, assetPath: DJI, sourceFrame: 0, firstFrameCeil: false },
      // The first clip of the second file: the browser opens it here → ceil (K 900 measured where nearest is 899).
      { kind: 'copy', from: 90, frames: 90, assetId: ASSET2, assetPath: DJI2, sourceFrame: 450, firstFrameCeil: true },
      // Back to the first file, still open in the browser → nearest (K 1798 measured).
      { kind: 'copy', from: 180, frames: 90, assetId: ASSET, assetPath: DJI, sourceFrame: 900, firstFrameCeil: false },
      // Same file as the previous span: a plain cut → nearest.
      { kind: 'copy', from: 270, frames: 90, assetId: ASSET, assetPath: DJI, sourceFrame: 1800, firstFrameCeil: false },
      { kind: 'browser', from: 360, frames: 90, reason: 'transform' },
      // The second file was opened by the rendered clip before this one → nearest.
      { kind: 'copy', from: 450, frames: 90, assetId: ASSET2, assetPath: DJI2, sourceFrame: 1800, firstFrameCeil: false },
    ]);
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
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0, { speed: 2 }), clip('b', 5, 5, 20, { fadeInSec: 0.5 })])]));
    expect(plan.spans).toEqual([{ kind: 'browser', from: 0, frames: 300, reason: 'speed' }]);
    expect(plan.copiedFrames).toBe(0);
    expect(plan.reason).toBe('speed');
  });

  it('a gain-only clip is still a pure cut of the picture (Stage 3): copied, its gain carried to the audio pass', () => {
    const gained = project([video([clip('clip_t1_cut_a', 0, 15, 0), clip('clip_t1_cut_b', 15, 15, 15, { gain: 0.5 })]), audioTrack]);
    expect(copyBlocker(gained.timeline.tracks[0].clips[1], gained.assets[0], gained.settings)).toBeNull();
    expect(planExportSpans(gained).spans).toEqual(planExportSpans(T5_CUT).spans);
    expect(planExportAudio(gained)?.segments).toEqual([
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 15 },
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 15, duration: 15, gain: 0.5 },
    ]);
    // Unity gain is no gain; a muted clip (gain 0) still copies its picture.
    expect(planExportAudio(project([video([clip('a', 0, 5, 0, { gain: 1 })])]))?.segments).toEqual([{ kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 5 }]);
    expect(planExportAudio(project([video([clip('a', 0, 5, 0, { gain: 0 })])]))?.segments).toEqual([{ kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 5, gain: 0 }]);
    expect(planExportSpans(project([video([clip('a', 0, 5, 0, { gain: 0 })])])).copiedFrames).toBe(150);
  });

  it('fades, speed and transitions still block both the picture and the one-pass audio', () => {
    expect(copyBlocker(clip('a', 0, 5, 0, { fadeOutSec: 1 }), T5.assets[0], T5.settings)).toBe('fade');
    expect(copyBlocker(clip('a', 0, 5, 0, { speed: 2 }), T5.assets[0], T5.settings)).toBe('speed');
    expect(planExportAudio(project([video([clip('a', 0, 5, 0, { gain: 0.5, fadeInSec: 1 })])]))).toBeNull();
  });

  it('a transition touches both clips at the boundary', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0, { transitionOut: { kind: 'crossfade', duration: 1 } }), clip('b', 5, 5, 20), clip('c', 10, 5, 40)])]));
    expect(plan.spans.map((s) => [s.kind, s.from, s.frames])).toEqual([
      ['browser', 0, 300],
      ['copy', 300, 150],
    ]);
  });

  it('renders everything in the browser for captions, or no video track', () => {
    expect(planExportSpans(project([video([clip('a', 0, 5, 0)])], { captions: { enabled: true } as StudioProject['captions'] })).reason).toBe('captions');
    expect(planExportSpans(project([audioTrack])).reason).toBe('no video track');
  });

  it('several video tracks: the topmost pure cut covering a piece is copied and hides what is below (Stage 3 slice 2)', () => {
    // The T1 cut as two tracks: V1 (top) 15–30 s from source 15 over V2 0–30 s from 0 — the same spans as t5-1080p-cut.
    const stacked = project([video([clip('top', 15, 15, 15)]), video([clip('base', 0, 30, 0)], { id: 'v2' })]);
    expect(planExportSpans(stacked).spans).toEqual([
      { kind: 'copy', from: 0, frames: 450, assetId: ASSET, assetPath: DJI, sourceFrame: 0, firstFrameCeil: false },
      { kind: 'copy', from: 450, frames: 450, assetId: ASSET, assetPath: DJI, sourceFrame: 450, firstFrameCeil: false },
    ]);
    // The upper clip in the middle: the base shows on both sides and resumes its source position.
    const middle = project([video([clip('top', 10, 10, 60)]), video([clip('base', 0, 30, 0)], { id: 'v2' })]);
    expect(planExportSpans(middle).spans.map((s) => [s.kind, s.from, s.frames, (s as { sourceFrame?: number }).sourceFrame])).toEqual([
      ['copy', 0, 300, 0],
      ['copy', 300, 300, 1800],
      ['copy', 600, 300, 600],
    ]);
    // An upper clip that only partly covers (transformed) sends ITS piece to the browser, the rest stays copied.
    const partly = project([video([clip('top', 10, 10, 60, { transform: { scale: 0.5 } })]), video([clip('base', 0, 30, 0)], { id: 'v2' })]);
    expect(planExportSpans(partly).spans.map((s) => [s.kind, s.from, s.frames])).toEqual([
      ['copy', 0, 300],
      ['browser', 300, 300],
      ['copy', 600, 300],
    ]);
    expect(planExportSpans(partly).spans[1]).toMatchObject({ reason: 'transform' });
    // A gap on every track is black; a dropped upper clip lets the lower one through.
    const gap = project([video([clip('top', 0, 5, 0)]), video([clip('base', 10, 5, 0)], { id: 'v2' })]);
    expect(planExportSpans(gap).spans.map((s) => [s.kind, s.from, s.frames])).toEqual([['copy', 0, 150], ['black', 150, 150], ['copy', 300, 150]]);
    const dropped = project([video([clip('top', 0, 5, 0, { assetId: 'gone' })]), video([clip('base', 0, 5, 0)], { id: 'v2' })]);
    expect(planExportSpans(dropped).spans).toEqual([{ kind: 'copy', from: 0, frames: 150, assetId: ASSET, assetPath: DJI, sourceFrame: 0, firstFrameCeil: false }]);
    // A covered clip has opened its file: when it comes back into view its first frame is the nearest, not the ceil.
    const other = { ...T5.assets[0], id: 'o', path: 'C:\\raw\\other.MP4' };
    const covered = project([video([clip('top', 0, 5, 0)]), video([clip('base', 0, 10, 20, { assetId: 'o' })], { id: 'v2' })], { assets: [T5.assets[0], other] });
    expect(planExportSpans(covered).spans[1]).toMatchObject({ kind: 'copy', from: 150, assetId: 'o', sourceFrame: 750, firstFrameCeil: false });
    // The dialog's share counts every copied piece.
    expect(copiedPercent(planExportSpans(partly))).toBe(67);
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
    expect(copyBlocker(clip('a', 0, 4.023, 135), asset, settings)).toBeNull(); // overruns by 0.8 ms (millisecond-rounded document)
    expect(copyBlocker(clip('a', 0, 4.04, 135), asset, settings)).toBe('runs past the source end'); // more than half a frame
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

  it('refuses what only the browser mixes exactly (fades, speed, two clips at once on one track); a static gain no longer does', () => {
    expect(planExportAudio(project([video([clip('a', 0, 2, 0, { gain: 0.8 })])]))?.segments).toEqual([{ kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 2, gain: 0.8 }]);
    expect(planExportAudio(project([video([clip('a', 0, 2, 0, { fadeOutSec: 0.2 })])]))).toBeNull();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0, { speed: 1.5 })])]))).toBeNull();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0)]), { ...audioTrack, clips: [{ ...clip('m', 0, 2, 0, { fadeInSec: 0.1 }), kind: 'audio' }] }]))).toBeNull();
    // Overlapping clips on ONE track (a document the timeline ops never write) — not modelled.
    expect(planExportAudio(project([video([clip('a', 0, 2, 0), clip('b', 1, 2, 0)])]))).toBeNull();
  });

  it('mixes an audio-track clip as a second chain with its own gain, covering the whole timeline (Stage 3 slice 2)', () => {
    const music = { id: 'mus', kind: 'audio' as const, path: 'C:\\raw\\music-40s.wav', probe: { duration: 40, hasAudio: true, codec: 'pcm_s16le' } };
    const p = project(
      [video([clip('a', 0, 15, 0), clip('b', 15, 15, 15)]), { ...audioTrack, clips: [{ ...clip('m', 5, 20, 2, { gain: 0.5 }), kind: 'audio', assetId: 'mus' }] }],
      { assets: [T5.assets[0], music] },
    );
    const plan = planExportAudio(p);
    expect(plan?.duration).toBe(30);
    expect(plan?.segments).toEqual([
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 15 },
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 15, duration: 15 },
    ]);
    expect(plan?.chains).toEqual([[
      { kind: 'silence', duration: 5 },
      { kind: 'source', assetId: 'mus', assetPath: 'C:\\raw\\music-40s.wav', sourceIn: 2, duration: 20, gain: 0.5 },
      { kind: 'silence', duration: 5 },
    ]]);
    // The picture is untouched by an audio track: both clips still copied.
    expect(planExportSpans(p).copiedFrames).toBe(900);
    // A muted audio track contributes no chain; a soundless track neither; a second video track with sound does.
    expect(planExportAudio(project([video([clip('a', 0, 2, 0)]), { ...audioTrack, muted: true, clips: [{ ...clip('m', 0, 2, 0), kind: 'audio' }] }]))?.chains).toBeUndefined();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0)]), audioTrack]))?.chains).toBeUndefined();
    expect(planExportAudio(project([video([clip('a', 0, 2, 0)]), video([clip('b', 1, 2, 0)], { id: 'v2' })]))?.chains).toEqual([[
      { kind: 'silence', duration: 1 },
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 2 },
    ]]);
    // Only sound on an audio track: it is the first chain, no `chains`.
    const only = planExportAudio(project([{ ...audioTrack, clips: [{ ...clip('m', 1, 2, 0), kind: 'audio' }] }]));
    expect(only?.chains).toBeUndefined();
    expect(only?.segments).toEqual([{ kind: 'silence', duration: 1 }, { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 2 }]);
    // A range window trims every chain alike.
    expect(planExportAudio(p, 300)?.chains).toEqual([[
      { kind: 'silence', duration: 5 },
      { kind: 'source', assetId: 'mus', assetPath: 'C:\\raw\\music-40s.wav', sourceIn: 2, duration: 5, gain: 0.5 },
    ]]);
  });

  it('trims the audio to a range window that ends inside a clip', () => {
    expect(planExportAudio(project([video([clip('a', 0, 10, 5)])]), 90)?.segments).toEqual([
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 5, duration: 3 },
    ]);
  });
});
