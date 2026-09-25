import { describe, expect, it } from 'vitest';
import type { StudioFilterInfo } from '@shared/ipc/types';
import type { StudioTimeline } from '../types';
import { needKey, type AnalysisKind, type AnalysisState } from './analysis-status';
import { effectName, effectStatuses } from './filter-status';

const info = (kind: string, name: string, category: 'filter' | 'effect'): StudioFilterInfo => ({
  kind, name, packId: 'core', packName: 'Core', category, animated: false, defaultIntensity: 1,
  parameters: [], presets: [], heavy: false, requires: [], version: '1.0.0',
});
const INSTALLED = new Map([['core/noir', info('core/noir', 'Noir', 'filter')], ['core/vhs', info('core/vhs', 'VHS Club', 'effect')]]);

const timeline: StudioTimeline = {
  tracks: [{
    id: 'v1', kind: 'video', name: 'V1',
    clips: [
      { id: 'a', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, effects: [{ kind: 'core/noir' }, { kind: 'core/vhs', disabled: true }] },
      { id: 'b', kind: 'video', assetId: 'x', timelineStart: 4, duration: 4, effects: [{ kind: 'gone/thing' }, { kind: 'core/noir' }] },
      { id: 'c', kind: 'video', assetId: 'x', timelineStart: 8, duration: 4 },
      { id: 'd', kind: 'video', assetId: 'x', timelineStart: 12, duration: 4, effects: [{ kind: 'core/noir', disabled: true }] },
    ],
  }],
};

describe('effectStatuses', () => {
  it('names entries from the installed list, labels the live ones and warns on a missing pack', () => {
    const statuses = effectStatuses(timeline, INSTALLED);
    expect([...statuses.keys()]).toEqual(['a', 'b', 'd']);
    expect(statuses.get('a')).toEqual({
      entries: [
        { kind: 'core/noir', name: 'Noir', category: 'filter', disabled: false, installed: true },
        { kind: 'core/vhs', name: 'VHS Club', category: 'effect', disabled: true, installed: true },
      ],
      label: 'Noir',
    });
    expect(statuses.get('b')).toMatchObject({ label: 'gone/thing + Noir', warning: 'not-installed' });
    expect(statuses.get('b')?.entries[0]).toEqual({ kind: 'gone/thing', name: 'gone/thing', disabled: false, installed: false });
    expect(statuses.get('d')).toEqual({ entries: [{ kind: 'core/noir', name: 'Noir', category: 'filter', disabled: true, installed: true }], label: 'off' });
  });

  it('never warns while the list is loading', () => {
    const statuses = effectStatuses(timeline, null);
    expect(statuses.get('b')?.warning).toBeUndefined();
    expect(statuses.get('b')?.entries[0].installed).toBe(true);
    expect(effectName('core/noir', null)).toBe('core/noir');
    expect(effectName('core/noir', INSTALLED)).toBe('Noir');
  });
});

describe('effectStatuses — analysis', () => {
  const tracked = (kind: string, requires: string[]): StudioFilterInfo => ({ ...info(kind, kind, 'effect'), requires });
  const installed = new Map([
    ['v/aura', tracked('v/aura', ['subjectMask'])],
    ['v/puppy', tracked('v/puppy', ['faceTrack'])],
    ['v/both', tracked('v/both', ['faceTrack', 'subjectMask'])],
  ]);
  const tl: StudioTimeline = {
    tracks: [{
      id: 'v1', kind: 'video', name: 'V1',
      clips: [
        { id: 'aura', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, effects: [{ kind: 'v/aura' }] },
        { id: 'both', kind: 'video', assetId: 'y', timelineStart: 4, duration: 4, effects: [{ kind: 'v/both' }] },
      ],
    }],
  };
  const of = (m: Record<string, AnalysisState>) => (kind: AnalysisKind, assetId: string) => m[needKey(kind, assetId)];
  const ready: AnalysisState = { status: 'ready', spans: [[0, 10]], fps: 24, ep: 'dml' };

  it('reads "Analyzing subject… 43%" while the mask runs, and nothing once it covers the clip', () => {
    const running = effectStatuses(tl, installed, of({ [needKey('subjectMask', 'x')]: { status: 'analyzing', percent: 43.4 } }));
    expect(running.get('aura')?.analysis).toEqual({ kind: 'subjectMask', percent: 43, message: 'Analyzing subject… 43%' });
    const done = effectStatuses(tl, installed, of({ [needKey('subjectMask', 'x')]: ready }));
    expect(done.get('aura')?.analysis).toBeUndefined();
    expect(done.get('aura')?.warning).toBeUndefined();
  });

  it('warns on a canceled or failed track', () => {
    expect(effectStatuses(tl, installed, of({ [needKey('subjectMask', 'x')]: { status: 'canceled' } })).get('aura')?.warning).toBe('analysis-canceled');
    expect(effectStatuses(tl, installed, of({ [needKey('subjectMask', 'x')]: { status: 'error', error: 'x' } })).get('aura')?.warning).toBe('analysis-failed');
  });

  it('lets the first kind that is not ready speak for a clip that needs both', () => {
    const facesPending = effectStatuses(tl, installed, of({ [needKey('subjectMask', 'y')]: ready }));
    expect(facesPending.get('both')?.analysis).toMatchObject({ kind: 'faceTrack', message: 'Analyzing faces…' });
    const maskPending = effectStatuses(tl, installed, of({ [needKey('faceTrack', 'y')]: ready, [needKey('subjectMask', 'y')]: { status: 'analyzing', percent: 7 } }));
    expect(maskPending.get('both')?.analysis).toMatchObject({ kind: 'subjectMask', percent: 7 });
  });
});
