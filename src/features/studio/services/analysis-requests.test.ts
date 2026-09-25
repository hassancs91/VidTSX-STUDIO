import { describe, expect, it } from 'vitest';
import type { StudioMediaJobEvent } from '@shared/ipc/types';
import { needKey, needSignature, type AnalysisState, type TrackNeed } from './analysis-status';
import { eventKey, nextAnalysisState, parseNeedKey, planAnalysisRequests } from './analysis-requests';

const need = (kind: TrackNeed['kind'], assetId: string, spans: [number, number][] = [[0, 5]]): TrackNeed => ({ kind, assetId, assetKind: 'video', spans });
const needsOf = (...list: TrackNeed[]) => new Map(list.map((n) => [needKey(n.kind, n.assetId), n]));
const always = () => true;
const event = (status: StudioMediaJobEvent['status'], extra: Partial<StudioMediaJobEvent> = {}): StudioMediaJobEvent => ({
  projectId: 'p', assetId: 'talk', kind: 'subjectMask', status, ...extra,
});

describe('the request plan', () => {
  const mask = need('subjectMask', 'talk');
  const key = needKey('subjectMask', 'talk');

  it('asks for a new need once, and not again while its request is out', () => {
    expect(planAnalysisRequests(needsOf(mask), new Map(), new Map(), always).request).toEqual([mask]);
    const guards = new Map([[key, needSignature(mask)]]);
    expect(planAnalysisRequests(needsOf(mask), new Map(), guards, always).request).toEqual([]);
  });

  it('waits for a proxy, a running job, or a covering track', () => {
    expect(planAnalysisRequests(needsOf(mask), new Map(), new Map(), () => false).request).toEqual([]);
    const analyzing = new Map<string, AnalysisState>([[key, { status: 'analyzing', percent: 40 }]]);
    expect(planAnalysisRequests(needsOf(mask), analyzing, new Map(), always).request).toEqual([]);
    const ready = new Map<string, AnalysisState>([[key, { status: 'ready', spans: [[0, 5]], fps: 24, ep: 'dml' }]]);
    expect(planAnalysisRequests(needsOf(mask), ready, new Map(), always).request).toEqual([]);
    // Extended past the track: a new request.
    expect(planAnalysisRequests(needsOf(need('subjectMask', 'talk', [[0, 9]])), ready, new Map(), always).request.length).toBe(1);
  });

  it('never re-asks after an error or a cancel — until the need itself changes', () => {
    const guards = new Map([[key, needSignature(mask)]]);
    for (const state of [{ status: 'error', error: 'x' }, { status: 'canceled' }] as AnalysisState[]) {
      const states = new Map([[key, state]]);
      expect(planAnalysisRequests(needsOf(mask), states, guards, always).request).toEqual([]);
      expect(planAnalysisRequests(needsOf(need('subjectMask', 'talk', [[0, 8]])), states, guards, always).request.length).toBe(1);
    }
  });

  it('cancels a live job whose last tracked filter was removed, and forgets its key', () => {
    const guards = new Map([[key, needSignature(mask)]]);
    const analyzing = new Map<string, AnalysisState>([[key, { status: 'analyzing', percent: 40 }]]);
    expect(planAnalysisRequests(new Map(), analyzing, guards, always)).toEqual({ request: [], cancel: [{ kind: 'subjectMask', assetId: 'talk' }], forget: [key] });
    // Requested but no tick yet: still cancelled (the job may be queued).
    expect(planAnalysisRequests(new Map(), new Map(), guards, always).cancel).toEqual([{ kind: 'subjectMask', assetId: 'talk' }]);
    // Settled states are only forgotten.
    const ready = new Map<string, AnalysisState>([[key, { status: 'ready', spans: [[0, 5]], fps: 24, ep: 'dml' }]]);
    expect(planAnalysisRequests(new Map(), ready, new Map(), always)).toEqual({ request: [], cancel: [], forget: [key] });
    const canceled = new Map<string, AnalysisState>([[key, { status: 'canceled' }]]);
    expect(planAnalysisRequests(new Map(), canceled, guards, always).cancel).toEqual([]);
  });

  it('keeps the two kinds of one asset apart', () => {
    const face = need('faceTrack', 'talk');
    const analyzingFace = new Map<string, AnalysisState>([[needKey('faceTrack', 'talk'), { status: 'analyzing', percent: 5 }]]);
    const plan = planAnalysisRequests(needsOf(face, mask), analyzingFace, new Map([[needKey('faceTrack', 'talk'), needSignature(face)]]), always);
    expect(plan.request).toEqual([mask]);
    expect(parseNeedKey(needKey('subjectMask', 'a|b'))).toEqual({ kind: 'subjectMask', assetId: 'a|b' });
  });
});

describe('job events', () => {
  it('moves the state and says whether the guard stays', () => {
    expect(eventKey(event('generating'))).toBe('subjectMask|talk');
    expect(nextAnalysisState(event('generating', { percent: 43, message: 'Analyzing subject…' }), true)).toEqual({
      state: { status: 'analyzing', percent: 43, message: 'Analyzing subject…' }, keepGuard: true,
    });
    expect(nextAnalysisState(event('ready', { analysis: { ep: 'dml', spans: [[0, 5]], frames: 120, fps: 24 } }), true)).toEqual({
      state: { status: 'ready', spans: [[0, 5]], fps: 24, ep: 'dml' }, keepGuard: false,
    });
    expect(nextAnalysisState(event('error', { error: 'boom' }), true)).toEqual({ state: { status: 'error', error: 'boom' }, keepGuard: true });
  });

  it('a Cancel the user asked for sticks; one for a need already gone just clears', () => {
    expect(nextAnalysisState(event('canceled'), true)).toEqual({ state: { status: 'canceled' }, keepGuard: true });
    expect(nextAnalysisState(event('canceled'), false)).toEqual({ state: null, keepGuard: false });
  });
});
