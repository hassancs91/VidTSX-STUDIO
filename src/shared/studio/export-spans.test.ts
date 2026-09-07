// Span planner (docs/export-engines-plan.md Stage 2) on the two T1 reference
// documents and the edges Stage 2 draws: one video track, pure cuts only —
// plus Stage 3's first widening (gain-only clips: video copied, gain carried
// into the one audio pass).
import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioProject, StudioTrack } from '../types/studio';
import { copiedPercent, copyBlocker, planExportAudio, planExportSpans, type AudioSegment } from './export-spans';

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
      fps: 30,
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
    const overlay: StudioTrack = { id: 'o1', kind: 'overlay', name: 'O1', clips: [{ ...clip('t', 4, 2, 0), transform: { scale: 0.5 } }] };
    const plan = planExportSpans(project([overlay, video([clip('a', 0, 10, 20)])]));
    expect(plan.spans).toEqual([
      { kind: 'copy', from: 0, frames: 120, assetId: ASSET, assetPath: DJI, sourceFrame: 600, firstFrameCeil: true },
      { kind: 'browser', from: 120, frames: 60, reason: 'overlay' },
      { kind: 'copy', from: 180, frames: 120, assetId: ASSET, assetPath: DJI, sourceFrame: 780, firstFrameCeil: false },
    ]);
    // A tsx overlay whose shot the document cannot render is dropped by the serializer — it paints nothing, so nothing is touched (slice 3: the planner reads the serialization).
    const ghost: StudioTrack = { id: 'o1', kind: 'overlay', name: 'O1', clips: [{ id: 't', kind: 'tsx', timelineStart: 4, duration: 2, tsx: { shotId: 's', mode: 'overlay' } }] };
    expect(planExportSpans(project([ghost, video([clip('a', 0, 10, 20)])])).copiedFrames).toBe(300);
  });

  it('merges adjacent browser pieces into one span', () => {
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0, { speed: 0.5 }), clip('b', 5, 5, 20, { transform: { opacity: 0.5 } })])]));
    expect(plan.spans).toEqual([{ kind: 'browser', from: 0, frames: 300, reason: 'slow motion' }]);
    expect(plan.copiedFrames).toBe(0);
    expect(plan.reason).toBe('slow motion');
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

  it('a fade blocks neither the picture nor the one-pass audio (slice 3: the picture never fades); slow motion still blocks the picture (slice 4)', () => {
    expect(copyBlocker(clip('a', 0, 5, 0, { fadeOutSec: 1 }), T5.assets[0], T5.settings)).toBeNull();
    expect(copyBlocker(clip('a', 0, 5, 0, { speed: 0.5 }), T5.assets[0], T5.settings)).toBe('slow motion');
    expect(copyBlocker(clip('a', 0, 5, 0, { speed: 0 }), T5.assets[0], T5.settings)).toBe('speed');
    expect(planExportSpans(project([video([clip('a', 0, 5, 0, { speed: 0.5 })])])).copiedFrames).toBe(0);
    const faded = project([video([clip('clip_t1_cut_a', 0, 15, 0, { fadeOutSec: 0.5 }), clip('clip_t1_cut_b', 15, 15, 15, { gain: 0.5, fadeInSec: 1, fadeOutSec: 2 })]), audioTrack]);
    expect(planExportSpans(faded).spans).toEqual(planExportSpans(T5_CUT).spans);
  });

  it('a sped clip is copied on the scaled time line (slice 4): the span carries the rate, its source position is trimBefore + offset × rate', () => {
    // The speed seed: clip B at 1.5× from source 15 s — the same two spans as the T1 cut, the second at rate 1.5.
    const sped = project([video([clip('clip_t1_cut_a', 0, 15, 0), clip('clip_t1_cut_b', 15, 15, 15, { speed: 1.5 })]), audioTrack]);
    expect(copyBlocker(sped.timeline.tracks[0].clips[1], sped.assets[0], sped.settings)).toBeNull();
    expect(planExportSpans(sped).spans).toEqual([
      { kind: 'copy', from: 0, frames: 450, assetId: ASSET, assetPath: DJI, sourceFrame: 0, firstFrameCeil: false },
      { kind: 'copy', from: 450, frames: 450, assetId: ASSET, assetPath: DJI, sourceFrame: 450, rate: 1.5, firstFrameCeil: false },
    ]);
    expect(copiedPercent(planExportSpans(sped))).toBe(100);
    // Split by an overlay: the piece after it resumes at trimBefore + offset × rate — a fractional composition frame.
    const overlay: StudioTrack = { id: 'o1', kind: 'overlay', name: 'O1', clips: [{ ...clip('t', 4, 2, 0), transform: { scale: 0.5 } }] };
    const split = planExportSpans(project([overlay, video([clip('a', 0, 10, 20, { speed: 1.5 })])]));
    expect(split.spans).toEqual([
      { kind: 'copy', from: 0, frames: 120, assetId: ASSET, assetPath: DJI, sourceFrame: 600, rate: 1.5, firstFrameCeil: true },
      { kind: 'browser', from: 120, frames: 60, reason: 'overlay' },
      { kind: 'copy', from: 180, frames: 120, assetId: ASSET, assetPath: DJI, sourceFrame: 600 + 180 * 1.5, rate: 1.5, firstFrameCeil: false },
    ]);
    expect(planExportSpans(project([video([clip('a', 0, 10, 20, { speed: 1.25 })])])).spans[0]).toMatchObject({ rate: 1.25, sourceFrame: 600 });
    // The source-end bound scales with the rate: 10 s at 2× consumes 20 s of source.
    const asset = T5.assets[0];
    expect(copyBlocker(clip('a', 0, 10, 119.022233, { speed: 2 }), asset, T5.settings)).toBeNull(); // ends exactly at the source end
    expect(copyBlocker(clip('a', 0, 10, 119.05, { speed: 2 }), asset, T5.settings)).toBeNull(); // overruns by 28 ms < half a slot (33 ms at 2×)
    expect(copyBlocker(clip('a', 0, 10, 119.06, { speed: 2 }), asset, T5.settings)).toBe('runs past the source end');
    expect(copyBlocker(clip('a', 0, 10, 130, { speed: 2 }), asset, T5.settings)).toBe('runs past the source end');
    // A rate of exactly 1 is no rate.
    expect(planExportSpans(project([video([clip('a', 0, 10, 20, { speed: 1 })])])).spans[0]).not.toHaveProperty('rate');
  });

  it('a transition sends only its window to the browser; the rest of both clips is copied from the serializer\'s geometry (slice 3)', () => {
    // 1 s crossfade at 5 s: 15 frames of handle each side (the serializer's computeAdjustment), so the
    // leading clip runs to 165 and the trailing one starts at 135 from source frame 585.
    const plan = planExportSpans(project([video([clip('a', 0, 5, 0, { transitionOut: { kind: 'crossfade', duration: 1 } }), clip('b', 5, 5, 20), clip('c', 10, 5, 40)])]));
    expect(plan.spans.map((s) => [s.kind, s.from, s.frames, s.kind === 'copy' ? s.sourceFrame : (s as { reason?: string }).reason])).toEqual([
      ['copy', 0, 135, 0],
      ['browser', 135, 30, 'transition'],
      ['copy', 165, 135, 615],
      ['copy', 300, 150, 1200],
    ]);
    expect(plan.copiedFrames).toBe(420);
    // Dip-to-black: no handles, the window is half a second either side of the cut.
    const dip = planExportSpans(project([video([clip('a', 0, 5, 0, { transitionOut: { kind: 'dip-to-black', duration: 1 } }), clip('b', 5, 5, 20)])]));
    expect(dip.spans.map((s) => [s.kind, s.from, s.frames])).toEqual([
      ['copy', 0, 135],
      ['browser', 135, 30],
      ['copy', 165, 135],
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
    expect(copyBlocker(clip('a', 0, 5, 0, { fadeInSec: 0.5 }), asset, settings)).toBeNull(); // slice 3: a fade is audio-only
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

  it('a static gain, a fade, two clips at once and a playback rate (slice 4) are planned', () => {
    expect(planExportAudio(project([video([clip('a', 0, 2, 0, { gain: 0.8 })])]))?.segments).toEqual([{ kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 2, gain: 0.8 }]);
    // A sped clip: the segment carries the rate; sourceIn is the source instant, duration the timeline length.
    expect(planExportAudio(project([video([clip('a', 0, 2, 5, { speed: 1.5 })])]))?.segments).toEqual([{ kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 5, duration: 2, rate: 1.5 }]);
    // A fade-out over the last 6 frames: one asset over the whole clip, its curve the composition's linear ramp.
    const out = planExportAudio(project([video([clip('a', 0, 2, 0, { fadeOutSec: 0.2 })])]));
    expect(out?.fps).toBe(30);
    const seg = out?.segments[0] as Extract<AudioSegment, { kind: 'source' }>;
    expect([seg.sourceIn, seg.duration, seg.gain, seg.volumes?.length]).toEqual([0, 2, undefined, 60]);
    expect(seg.volumes?.slice(53)).toEqual([1, 1, 1 - 1 / 6, 1 - 2 / 6, 1 - 3 / 6, 1 - 4 / 6, 1 - 5 / 6]);
    // A fade-in on an audio-track clip: frame 0 is at volume 0 and Remotion registers no asset for it —
    // the asset starts one frame late, at source frame 1, and the chain opens with one frame of silence.
    const inn = planExportAudio(project([video([clip('a', 0, 2, 0)]), { ...audioTrack, clips: [{ ...clip('m', 0, 2, 0, { fadeInSec: 0.1 }), kind: 'audio' }] }]));
    const chain = inn?.chains?.[0] as AudioSegment[];
    expect(chain[0]).toEqual({ kind: 'silence', duration: 1 / 30 });
    const m = chain[1] as Extract<AudioSegment, { kind: 'source' }>;
    expect([m.sourceIn, m.duration, m.volumes?.length]).toEqual([1 / 30, 59 / 30, 59]);
    expect(m.volumes?.slice(0, 3)).toEqual([1 / 3, 2 / 3, 1]);
    // Overlapping clips on ONE track sound together, as two lanes summed by the pass.
    const two = planExportAudio(project([video([clip('a', 0, 2, 0), clip('b', 1, 2, 0)])]));
    expect(two?.segments).toEqual([{ kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 2 }, { kind: 'silence', duration: 1 }]);
    expect(two?.chains).toEqual([[{ kind: 'silence', duration: 1 }, { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 2 }]]);
  });

  it('plans the speed seed (slice 4): clip B at 1.5× and the music clip at 1.5× with its gain, on the source time line', () => {
    const music = { id: 'mus', kind: 'audio' as const, path: 'C:\\raw\\music-40s.wav', probe: { duration: 40, hasAudio: true, codec: 'pcm_s16le' } };
    const p = project(
      [video([clip('a', 0, 15, 0), clip('b', 15, 15, 15, { speed: 1.5 })]), { ...audioTrack, clips: [{ ...clip('m', 2, 10, 2, { gain: 0.5, speed: 1.5 }), kind: 'audio', assetId: 'mus' }] }],
      { assets: [T5.assets[0], music] },
    );
    const plan = planExportAudio(p);
    expect(plan?.segments).toEqual([
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 0, duration: 15 },
      { kind: 'source', assetId: ASSET, assetPath: DJI, sourceIn: 15, duration: 15, rate: 1.5 },
    ]);
    expect(plan?.chains).toEqual([[
      { kind: 'silence', duration: 2 },
      { kind: 'source', assetId: 'mus', assetPath: 'C:\\raw\\music-40s.wav', sourceIn: 2, duration: 10, gain: 0.5, rate: 1.5 },
      { kind: 'silence', duration: 18 },
    ]]);
    // A sped clip with a fade-in: the asset starts one frame late, at the source instant of frame 1 = (trimBefore + 1 × rate)/fps,
    // and the curve keeps one value per composition frame (each 1/fps of post-tempo audio).
    const faded = planExportAudio(project([video([clip('a', 0, 15, 0), clip('b', 15, 15, 15, { speed: 2, gain: 0.5, fadeInSec: 1 })])]));
    expect(faded?.segments[1]).toEqual({ kind: 'silence', duration: 1 / 30 });
    const b = faded?.segments[2] as Extract<AudioSegment, { kind: 'source' }>;
    expect([b.sourceIn, b.duration, b.rate, b.volumes?.length, b.gain]).toEqual([(450 + 2) / 30, 449 / 30, 2, 449, undefined]);
    expect(b.volumes?.[0]).toBeCloseTo(0.5 / 30, 12);
    expect(b.volumes?.[29]).toBe(0.5);
  });

  it('plans the T1 fade seed: a fade-out curve on A, a one-frame-late curve at gain 0.5 on B (slice 3)', () => {
    const faded = project([video([clip('clip_t1_cut_a', 0, 15, 0, { fadeOutSec: 0.5 }), clip('clip_t1_cut_b', 15, 15, 15, { gain: 0.5, fadeInSec: 1, fadeOutSec: 2 })]), audioTrack]);
    const plan = planExportAudio(faded);
    expect(plan?.chains).toBeUndefined();
    expect(plan?.segments.map((s) => s.kind)).toEqual(['source', 'silence', 'source']);
    const [a, gap, b] = plan?.segments as [Extract<AudioSegment, { kind: 'source' }>, AudioSegment, Extract<AudioSegment, { kind: 'source' }>];
    expect([a.sourceIn, a.duration, a.volumes?.length]).toEqual([0, 15, 450]);
    expect(a.volumes?.[434]).toBe(1);
    expect(a.volumes?.[435]).toBe(1);
    expect(a.volumes?.[436]).toBeCloseTo(14 / 15, 12);
    expect(a.volumes?.[449]).toBeCloseTo(1 / 15, 12);
    expect(gap).toEqual({ kind: 'silence', duration: 1 / 30 });
    expect([b.sourceIn, b.duration, b.volumes?.length, b.gain]).toEqual([451 / 30, 449 / 30, 449, undefined]);
    expect(b.volumes?.[0]).toBeCloseTo(0.5 / 30, 12);
    expect(b.volumes?.[29]).toBe(0.5);
    expect(b.volumes?.[388]).toBe(0.5);
    expect(b.volumes?.[448]).toBeCloseTo(0.5 / 60, 12);
  });

  it('plans a crossfade as two lanes with the equal-power curves on the serializer\'s extended clips (slice 3)', () => {
    const x = project([video([clip('clip_t1_cut_a', 0, 15, 0, { transitionOut: { kind: 'crossfade', duration: 1 } }), clip('clip_t1_cut_b', 15, 15, 15)]), audioTrack]);
    const plan = planExportAudio(x);
    const a = plan?.segments[0] as Extract<AudioSegment, { kind: 'source' }>;
    // A runs 465 frames (15 handle frames past the cut), cos over its last 30.
    expect([a.sourceIn, a.duration, a.volumes?.length]).toEqual([0, 15.5, 465]);
    expect(a.volumes?.[435]).toBe(1);
    expect(a.volumes?.[450]).toBeCloseTo(Math.cos(Math.PI / 4), 12);
    expect(a.volumes?.[464]).toBeCloseTo(Math.cos((29 / 30) * (Math.PI / 2)), 12);
    expect(plan?.segments[1]).toEqual({ kind: 'silence', duration: 14.5 });
    // B starts at 435 from source frame 435, sin over its first 30 — frame 0 (sin 0 = 0) unregistered.
    const lane = plan?.chains?.[0] as AudioSegment[];
    expect(lane[0]).toEqual({ kind: 'silence', duration: 436 / 30 });
    const b = lane[1] as Extract<AudioSegment, { kind: 'source' }>;
    expect([b.sourceIn, b.duration, b.volumes?.length]).toEqual([436 / 30, 464 / 30, 464]);
    expect(b.volumes?.[0]).toBeCloseTo(Math.sin((1 / 30) * (Math.PI / 2)), 12);
    expect(b.volumes?.[29]).toBe(1);
    expect(lane).toHaveLength(2);
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
