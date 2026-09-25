import { describe, expect, it } from 'vitest';
import type { StudioFilterInfo } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioTimeline } from '../types';
import {
  analysisLabel,
  clipNeedsFaceTrack,
  clipSourceSpan,
  exportAnalysisBlockers,
  faceTrackNeeds,
  needSignature,
  stateCovers,
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
    ],
  }],
};

describe('faceTrackNeeds', () => {
  it('needs a track only for live tracked entries, padded, clamped to the asset and merged', () => {
    expect(clipNeedsFaceTrack(timeline.tracks[0].clips[0], INSTALLED)).toBe(true);
    expect(clipNeedsFaceTrack(timeline.tracks[0].clips[2], INSTALLED)).toBe(false); // disabled
    expect(clipNeedsFaceTrack(timeline.tracks[0].clips[5], INSTALLED)).toBe(false); // noir only
    expect(clipNeedsFaceTrack(timeline.tracks[0].clips[0], null)).toBe(false); // list not loaded yet
    expect(clipSourceSpan(timeline.tracks[0].clips[1])).toEqual([10, 14]); // speed 2 covers twice the source

    const needs = faceTrackNeeds(timeline, ASSETS, INSTALLED);
    expect([...needs.keys()]).toEqual(['talk', 'short', 'still']);
    expect(needs.get('talk')!.spans).toEqual([[1.5, 6.5], [9.5, 14.5]]);
    expect(needs.get('short')!.spans).toEqual([[0, 2]]); // clamped to the 2 s asset
    expect(needs.get('still')).toEqual({ assetId: 'still', assetKind: 'image', spans: [[0, 0]] });
    expect(needSignature(needs.get('talk')!)).toBe('video|1.500-6.500,9.500-14.500');
  });
});

describe('stateCovers / analysisLabel', () => {
  const ready = (spans: [number, number][]): AnalysisState => ({ status: 'ready', spans, fps: 30, ep: 'dml' });
  it('is covered only by a ready state whose spans reach the need', () => {
    const need = { assetId: 'talk', assetKind: 'video' as const, spans: [[1.5, 6.5]] as [number, number][] };
    expect(stateCovers(ready([[0, 7]]), need)).toBe(true);
    expect(stateCovers(ready([[0, 6.49]]), need)).toBe(true); // within a frame
    expect(stateCovers(ready([[0, 5]]), need)).toBe(false);
    expect(stateCovers({ status: 'analyzing', percent: 50 }, need)).toBe(false);
    expect(stateCovers(undefined, need)).toBe(false);
    expect(stateCovers(ready([[0, 0]]), { assetId: 'still', assetKind: 'image', spans: [[0, 0]] })).toBe(true);
  });

  it('words the chip', () => {
    expect(analysisLabel(undefined)).toBe('Analyzing faces…');
    expect(analysisLabel({ status: 'analyzing', percent: 43 })).toBe('Analyzing faces… 43%');
    expect(analysisLabel({ status: 'analyzing', percent: 12, message: 'Downloading face models (yunet-2023mar.onnx)… 12%' })).toBe('Downloading face models (yunet-2023mar.onnx)… 12%');
    expect(analysisLabel({ status: 'error', error: 'ffmpeg exited' })).toBe('Face analysis failed: ffmpeg exited');
    expect(analysisLabel({ status: 'ready', spans: [], fps: 30, ep: 'cpu' })).toBe('Faces analyzed');
  });
});

describe('exportAnalysisBlockers', () => {
  const label = (clip: { id: string }) => `clip ${clip.id}`;
  it('blocks on every clip whose track is not complete, and passes when all are', () => {
    const states = new Map<string, AnalysisState>([
      ['talk', { status: 'analyzing', percent: 43 }],
      ['short', { status: 'error', error: 'no proxy' }],
    ]);
    const blockers = exportAnalysisBlockers(timeline, ASSETS, INSTALLED, (id) => states.get(id), label);
    expect(blockers.map((b) => b.clipId)).toEqual(['a', 'b', 'd', 'e']);
    expect(blockers[0]).toEqual({ clipId: 'a', label: 'clip a', reason: 'Analyzing faces… 43% — export when it reaches 100%' });
    expect(blockers[2].reason).toBe('Face analysis failed: no proxy');
    expect(blockers[3].reason).toBe('face analysis has not finished for it');

    const done = new Map<string, AnalysisState>([
      ['talk', { status: 'ready', spans: [[0, 39.4]], fps: 30, ep: 'dml' }],
      ['short', { status: 'ready', spans: [[0, 2]], fps: 30, ep: 'cpu' }],
      ['still', { status: 'ready', spans: [[0, 0]], fps: 1, ep: 'dml' }],
    ]);
    expect(exportAnalysisBlockers(timeline, ASSETS, INSTALLED, (id) => done.get(id), label)).toEqual([]);
  });

  it('checks each clip against its own span, not the asset union', () => {
    const partial = new Map<string, AnalysisState>([['talk', { status: 'ready', spans: [[0, 8]], fps: 30, ep: 'dml' }]]);
    const blockers = exportAnalysisBlockers(timeline, ASSETS, INSTALLED, (id) => partial.get(id), label);
    // clip a (2–6 s) is covered; clip b (10–14 s) is not.
    expect(blockers.map((b) => b.clipId)).toEqual(['b', 'd', 'e']);
  });

  it('never blocks a timeline without tracked filters, or while the pack list is loading', () => {
    expect(exportAnalysisBlockers(timeline, ASSETS, new Map([['core/noir', info('core/noir')]]), () => undefined, label)).toEqual([]);
    expect(exportAnalysisBlockers(timeline, ASSETS, null, () => undefined, label)).toEqual([]);
  });
});
