// Analysis tracks in the editor (docs/studio/FILTER_PACKS_DESIGN.md
// "Analysis tracks" → F4/F5, "As built (masks track)" → M2–M4): applying a
// tracked filter auto-queues its asset's `faceTrack` / `subjectMask` job;
// progress ticks and the ready tracks live here — environmental state like
// `missingAssetIds`, never the document (the cache on disk is the truth,
// and the job re-answers "ready" on the next open). The Player gets the
// tracks keyed by asset id; the chips, the Inspector (with its Cancel) and
// the export refusal read the states. The request/cancel rules are the pure
// state machine in services/analysis-requests.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioFilterInfo, StudioMediaJobEvent } from '@shared/ipc/types';
import type { AnalysisTracks } from '@shared/studio/face-track';
import type { StudioMediaAsset, StudioTimeline } from '../types';
import { needKey, needSignature, trackNeeds, type AnalysisKind, type AnalysisState, type TrackNeed } from '../services/analysis-status';
import { eventKey, nextAnalysisState, parseNeedKey, planAnalysisRequests } from '../services/analysis-requests';
import { readFaceTrack, readMaskTrack } from '../services/analysis-io';

export interface AnalysisTracksState {
  /** Per asset id, for the composition; undefined while nothing has landed. */
  tracks: Readonly<Record<string, AnalysisTracks>> | undefined;
  /** Per (kind, asset): analyzing (with percent), ready (with coverage), error or canceled. */
  stateOf: (kind: AnalysisKind, assetId: string) => AnalysisState | undefined;
  /** Stop a running analysis; the filter stays applied and the clip plays plain. */
  cancel: (kind: AnalysisKind, assetId: string) => void;
}

const TRACK_SLOT: Record<AnalysisKind, keyof AnalysisTracks> = { faceTrack: 'faces', subjectMask: 'masks' };

export function useAnalysisTracks(
  projectId: string,
  timeline: StudioTimeline,
  assets: readonly StudioMediaAsset[],
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
  fps: number,
): AnalysisTracksState {
  const [states, setStates] = useState<Map<string, AnalysisState>>(new Map());
  const [tracks, setTracks] = useState<Record<string, AnalysisTracks>>({});
  /** Key → the need signature a request went out for (see analysis-requests.ts). */
  const guards = useRef(new Map<string, string>());

  const needs = useMemo(() => trackNeeds(timeline, assets, installed), [timeline, assets, installed]);
  const needsRef = useRef(needs);
  needsRef.current = needs;

  const setState = useCallback((key: string, state: AnalysisState | null) => {
    setStates((prev) => {
      const next = new Map(prev);
      if (state) next.set(key, state);
      else next.delete(key);
      return next;
    });
  }, []);

  const setTrack = useCallback((kind: AnalysisKind, assetId: string, value: AnalysisTracks[keyof AnalysisTracks] | null) => {
    setTracks((prev) => {
      if (!value && !prev[assetId]?.[TRACK_SLOT[kind]]) return prev;
      const current = { ...prev[assetId] };
      if (value) Object.assign(current, { [TRACK_SLOT[kind]]: value });
      else delete current[TRACK_SLOT[kind]];
      const next = { ...prev };
      if (Object.keys(current).length > 0) next[assetId] = current;
      else delete next[assetId];
      return next;
    });
  }, []);

  const loadTrack = useCallback(
    async (kind: AnalysisKind, assetId: string, relPath: string) => {
      // A track that fails to read is a track that is not there: the clip plays plain.
      const value = kind === 'faceTrack' ? await readFaceTrack(projectId, relPath) : await readMaskTrack(projectId, assetId, relPath);
      if (value) setTrack(kind, assetId, value);
    },
    [projectId, setTrack],
  );

  const applyEvent = useCallback(
    (event: StudioMediaJobEvent) => {
      if (event.projectId !== projectId || (event.kind !== 'faceTrack' && event.kind !== 'subjectMask')) return;
      const key = eventKey(event);
      const { state, keepGuard } = nextAnalysisState(event, needsRef.current.has(key));
      if (!keepGuard) guards.current.delete(key);
      setState(key, state);
      if (event.status === 'ready' && event.analysis && event.relPath) void loadTrack(event.kind, event.assetId, event.relPath);
    },
    [projectId, setState, loadTrack],
  );

  useEffect(() => window.api.onStudioMediaJobEvent(applyEvent), [applyEvent]);

  // Faces read the proxy, so a video waits for it to settle (ready, or
  // failed — then the original is read); masks read the original (the
  // proxy's compression leaks into the matte — mask-track-job.ts) and an
  // image has no proxy: both go at once.
  const canStart = useCallback(
    (need: TrackNeed) => {
      const asset = assets.find((a) => a.id === need.assetId);
      if (!asset) return false;
      if (asset.kind !== 'video' || need.kind === 'subjectMask') return true;
      return asset.proxy?.status === 'ready' || asset.proxy?.status === 'error';
    },
    [assets],
  );

  useEffect(() => {
    if (!projectId) return;
    const plan = planAnalysisRequests(needs, states, guards.current, canStart);
    for (const { kind, assetId } of plan.cancel) void window.api.studioAnalysisCancel({ projectId, assetId, kind });
    for (const key of plan.forget) {
      guards.current.delete(key);
      const { kind, assetId } = parseNeedKey(key);
      setState(key, null);
      setTrack(kind, assetId, null);
    }
    for (const need of plan.request) {
      const key = needKey(need.kind, need.assetId);
      const asset = assets.find((a) => a.id === need.assetId);
      if (!asset) continue;
      guards.current.set(key, needSignature(need));
      void window.api
        .studioAnalysisRequest({
          projectId,
          assetId: need.assetId,
          kind: need.kind,
          assetKind: need.assetKind,
          sourcePath: asset.path,
          ...(need.kind === 'faceTrack' && asset.kind === 'video' && asset.proxy?.status === 'ready' ? { proxyRelPath: asset.proxy.path } : {}),
          spans: need.spans,
          fps,
        })
        .then((res) => {
          // The need went away while the request was in flight: the cancel
          // sent then can beat the job into main's queue — stop it now.
          if (!needsRef.current.has(key)) {
            if (res.success && !res.ready) void window.api.studioAnalysisCancel({ projectId, assetId: need.assetId, kind: need.kind });
            return;
          }
          if (!res.success) setState(key, { status: 'error', error: res.error ?? 'could not start' });
          else if (res.ready) applyEvent(res.ready);
          // Queued: "analyzing 0 %" until the first tick, unless a tick beat the reply.
          else setStates((prev) => (prev.has(key) ? prev : new Map(prev).set(key, { status: 'analyzing', percent: 0 })));
        });
    }
  }, [projectId, needs, states, assets, fps, canStart, setState, setTrack, applyEvent]);

  const stateOf = useCallback((kind: AnalysisKind, assetId: string) => states.get(needKey(kind, assetId)), [states]);
  const cancel = useCallback(
    (kind: AnalysisKind, assetId: string) => {
      void window.api.studioAnalysisCancel({ projectId, assetId, kind });
    },
    [projectId],
  );
  const trackMap = useMemo(() => (Object.keys(tracks).length > 0 ? tracks : undefined), [tracks]);
  return { tracks: trackMap, stateOf, cancel };
}
