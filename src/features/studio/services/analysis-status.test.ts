import { describe, expect, it } from 'vitest';
import type { StudioFilterInfo } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioTimeline } from '../types';
import {
  analysisKindsOf,
  analysisLabel,
  clipSourceSpan,
  clipTrackKinds,
  exportAnalysisBlockers,
  needKey,
  needSignature,
  stateCovers,
  trackNeeds,
  type AnalysisKind,
  type AnalysisState,
} from './analysis-status';

const info = (kind: string, requires: string[] = []): StudioFilterInfo => ({
  kind, name: kind, packId: 'p', packName: 'P', category: 'effect', animated: true, defaultIntensity: 1,
  parameters: [], presets: [], heavy: false, requires, version: '1.0.0',
});
const INSTALLED = new Map([
  ['core/noir', info('core/noir')],
  ['faces/puppy', info('faces/puppy', ['faceTrack'])],
  ['faces/kitty', info('faces/kitty', ['faceTrack'])],
  ['vol/aura', info('vol/aura', ['subjectMask'])],
  ['vol/pop', { ...info('vol/pop', ['subjectMask']), category: 'filter' as const }],
]);

const asset = (id: string, kind: 'video' | 'image', duration: number): StudioMediaAsset => ({
  id, kind, path: `C:/media/${id}.mp4`, probe: { duration, hasAudio: kind === 'video' },
});
const ASSETS = [asset('talk', 'video', 39.4), asset('short', 'video', 2), asset('still', 'image', 0)];

const timeline: StudioTimeline = {
  tracks: [{
    id: 'v1', kind: 'video', name: 'V1',
    clips: [
      { id: 'a', kind: 'video', assetId: 'talk', timelineStart: 0, duration: 4, sourceIn: 2, effects: [{ kind: 'faces/puppy' }] },
      { id: 'b', kind: 'video', assetId: 'talk', timelineStart: 4, duration: 2, sourceIn: 10, speed: 2, effects: [{ kind: 'core/noir' }, { kind: 'faces/kitty' }] },
      { id: 'c', kind: 'video', assetId: 'talk', timelineStart: 6, duration: 4, sourceIn: 20, effects: [{ kind: 'faces/puppy', disabled: true }] },
      { id: 'd', kind: 'video', assetId: 'short', timelineStart: 10, duration: 2, effects: [{ kind: 'faces/puppy' }] },
      { id: 'e', kind: 'image', assetId: 'still', timelineStart: 12, duration: 3, effects: [{ kind: 'faces/kitty' }] },
      { id: 'f', kind: 'video', assetId: 'talk', timelineStart: 15, duration: 1, sourceIn: 30, effects: [{ kind: 'core/noir' }] },
      // Both tracks on one clip: a subject filter in the filter slot + a face effect.
      { id: 'g', kind: 'video', assetId: 'talk', timelineStart: 16, duration: 2, sourceIn: 35, effects: [{ kind: 'vol/pop' }, { kind: 'faces/puppy' }] },
      { id: 'h', kind: 'video', assetId: 'short', timelineStart: 18, duration: 1, effects: [{ kind: 'vol/aura' }] },
    ],
  }],
};
const clips = timeline.tracks[0].clips;

describe('trackNeeds', () => {
  it('names the kinds a clip needs from its LIVE entries, faces first', () => {
    expect(clipTrackKinds(clips[0], INSTALLED)).toEqual(['faceTrack']);
    expect(clipTrackKinds(clips[2], INSTALLED)).toEqual([]); // disabled
    expect(clipTrackKinds(clips[5], INSTALLED)).toEqual([]); // noir only
    expect(clipTrackKinds(clips[6], INSTALLED)).toEqual(['faceTrack', 'subjectMask']);
    expect(clipTrackKinds(clips[7], INSTALLED)).toEqual(['subjectMask']);
    expect(clipTrackKinds(clips[0], null)).toEqual([]); // list not loaded yet
    expect(analysisKindsOf(INSTALLED.get('vol/aura'))).toEqual(['subjectMask']);
    expect(analysisKindsOf(undefined)).toEqual([]);
    expect(clipSourceSpan(clips[1])).toEqual([10, 14]); // speed 2 covers twice the source
  });

  it('keys one need per (kind, asset), padded, clamped to the asset and merged', () => {
    const needs = trackNeeds(timeline, ASSETS, INSTALLED);
    expect([...needs.keys()]).toEqual(['faceTrack|talk', 'faceTrack|short', 'faceTrack|still', 'subjectMask|talk', 'subjectMask|short']);
    expect(needs.get(needKey('faceTrack', 'talk'))!.spans).toEqual([[1.5, 6.5], [9.5, 14.5], [34.5, 37.5]]);
    expect(needs.get(needKey('subjectMask', 'talk'))).toEqual({ kind: 'subjectMask', assetId: 'talk', assetKind: 'video', spans: [[34.5, 37.5]] });
    expect(needs.get(needKey('subjectMask', 'short'))!.spans).toEqual([[0, 1.5]]);
    expect(needs.get(needKey('faceTrack', 'short'))!.spans).toEqual([[0, 2]]); // clamped to the 2 s asset
    expect(needs.get(needKey('faceTrack', 'still'))).toEqual({ kind: 'faceTrack', assetId: 'still', assetKind: 'image', spans: [[0, 0]] });
    expect(needSignature(needs.get(needKey('faceTrack', 'talk'))!)).toBe('video|1.500-6.500,9.500-14.500,34.500-37.500');
  });
});

describe('stateCovers / analysisLabel', () => {
  const ready = (spans: [number, number][]): AnalysisState => ({ status: 'ready', spans, fps: 30, ep: 'dml' });
  it('is covered only by a ready state whose spans reach the need', () => {
    const need = { assetKind: 'video' as const, spans: [[1.5, 6.5]] as [number, number][] };
    expect(stateCovers(ready([[0, 7]]), need)).toBe(true);
    expect(stateCovers(ready([[0, 6.49]]), need)).toBe(true); // within a frame
    expect(stateCovers(ready([[0, 5]]), need)).toBe(false);
    expect(stateCovers({ status: 'analyzing', percent: 50 }, need)).toBe(false);
    expect(stateCovers({ status: 'canceled' }, need)).toBe(false);
    expect(stateCovers(undefined, need)).toBe(false);
    expect(stateCovers(ready([[0, 0]]), { assetKind: 'image', spans: [[0, 0]] })).toBe(true);
  });

  it('words the chip for each kind', () => {
    expect(analysisLabel('faceTrack', undefined)).toBe('Analyzing faces…');
    expect(analysisLabel('faceTrack', { status: 'analyzing', percent: 43 })).toBe('Analyzing faces… 43%');
    expect(analysisLabel('subjectMask', { status: 'analyzing', percent: 43 })).toBe('Analyzing subject… 43%');
    expect(analysisLabel('subjectMask', { status: 'analyzing', percent: 12, message: 'Downloading subject model (modnet.onnx)… 12%' })).toBe('Downloading subject model (modnet.onnx)… 12%');
    expect(analysisLabel('faceTrack', { status: 'error', error: 'ffmpeg exited' })).toBe('Face analysis failed: ffmpeg exited');
    expect(analysisLabel('subjectMask', { status: 'canceled' })).toBe('Subject analysis canceled');
    expect(analysisLabel('faceTrack', { status: 'ready', spans: [], fps: 30, ep: 'cpu' })).toBe('Faces analyzed');
    expect(analysisLabel('subjectMask', { status: 'ready', spans: [], fps: 30, ep: 'cpu' })).toBe('Subject analyzed');
  });
});

describe('exportAnalysisBlockers', () => {
  const label = (clip: { id: string }) => `clip ${clip.id}`;
  const lookup = (m: Map<string, AnalysisState>) => (kind: AnalysisKind, id: string) => m.get(needKey(kind, id));
  const allReady = (): Map<string, AnalysisState> =>
    new Map<string, AnalysisState>([
      [needKey('faceTrack', 'talk'), { status: 'ready', spans: [[0, 39.4]], fps: 30, ep: 'dml' }],
      [needKey('faceTrack', 'short'), { status: 'ready', spans: [[0, 2]], fps: 30, ep: 'cpu' }],
      [needKey('faceTrack', 'still'), { status: 'ready', spans: [[0, 0]], fps: 1, ep: 'dml' }],
      [needKey('subjectMask', 'talk'), { status: 'ready', spans: [[34, 38]], fps: 30, ep: 'dml' }],
      [needKey('subjectMask', 'short'), { status: 'ready', spans: [[0, 2]], fps: 30, ep: 'dml' }],
    ]);

  it('blocks per (clip, kind) whose track is not complete, and passes when all are', () => {
    const states = allReady();
    states.set(needKey('faceTrack', 'talk'), { status: 'analyzing', percent: 43 });
    states.set(needKey('subjectMask', 'short'), { status: 'canceled' });
    states.set(needKey('faceTrack', 'short'), { status: 'error', error: 'no proxy' });
    const blockers = exportAnalysisBlockers(timeline, ASSETS, INSTALLED, lookup(states), label);
    expect(blockers.map((b) => `${b.clipId}:${b.kind}`)).toEqual(['a:faceTrack', 'b:faceTrack', 'd:faceTrack', 'g:faceTrack', 'h:subjectMask']);
    expect(blockers[0]).toEqual({ clipId: 'a', kind: 'faceTrack', label: 'clip a', reason: 'Analyzing faces… 43% — export when it reaches 100%' });
    expect(blockers[2].reason).toBe('Face analysis failed: no proxy');
    expect(blockers[4].reason).toBe('Subject analysis canceled — re-apply the filter to analyse it');
    expect(exportAnalysisBlockers(timeline, ASSETS, INSTALLED, lookup(allReady()), label)).toEqual([]);
  });

  it('checks each clip against its own span, not the asset union', () => {
    const states = allReady();
    states.set(needKey('subjectMask', 'talk'), { status: 'ready', spans: [[34, 36]], fps: 30, ep: 'dml' });
    states.delete(needKey('faceTrack', 'still'));
    const blockers = exportAnalysisBlockers(timeline, ASSETS, INSTALLED, lookup(states), label);
    // clip g (35–37 s) is not covered by the subject track ending at 36.
    expect(blockers.map((b) => `${b.clipId}:${b.kind}`)).toEqual(['e:faceTrack', 'g:subjectMask']);
    expect(blockers[0].reason).toBe('face analysis has not finished for it');
  });

  it('never blocks a timeline without tracked filters, or while the pack list is loading', () => {
    expect(exportAnalysisBlockers(timeline, ASSETS, new Map([['core/noir', info('core/noir')]]), () => undefined, label)).toEqual([]);
    expect(exportAnalysisBlockers(timeline, ASSETS, null, () => undefined, label)).toEqual([]);
  });
});
