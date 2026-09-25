// Analysis tracks in the editor (docs/studio/FILTER_PACKS_DESIGN.md
// "Analysis tracks" → F4/F5): applying a tracked filter auto-queues its
// asset's `faceTrack` job; progress ticks and the ready track live here —
// environmental state like `missingAssetIds`, never the document (the cache
// on disk is the truth, and the job re-answers "ready" on the next open).
// The Player gets the tracks keyed by asset id; the chips and the export
// refusal read the states.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioFilterInfo, StudioMediaJobEvent } from '@shared/ipc/types';
import { parseFaceTrack, type AnalysisTracks } from '@shared/studio/face-track';
import type { StudioMediaAsset, StudioTimeline } from '../types';
import { faceTrackNeeds, needSignature, stateCovers, type AnalysisState } from '../services/analysis-status';

export interface AnalysisTracksState {
  /** Per asset id, for the composition; undefined while nothing has landed. */
  tracks: Readonly<Record<string, AnalysisTracks>> | undefined;
  /** Per asset id: analyzing (with percent), ready (with coverage) or error. */
  states: ReadonlyMap<string, AnalysisState>;
  stateOf: (assetId: string) => AnalysisState | undefined;
}

export function useAnalysisTracks(
  projectId: string,
  timeline: StudioTimeline,
  assets: readonly StudioMediaAsset[],
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
  fps: number,
): AnalysisTracksState {
  const [states, setStates] = useState<Map<string, AnalysisState>>(new Map());
  const [tracks, setTracks] = useState<Record<string, AnalysisTracks>>({});
  /** Asset id → the need signature a request went out for (cleared when the job settles). */
  const requested = useRef(new Map<string, string>());

  const needs = useMemo(() => faceTrackNeeds(timeline, assets, installed), [timeline, assets, installed]);

  const setState = useCallback((assetId: string, state: AnalysisState | null) => {
    setStates((prev) => {
      const next = new Map(prev);
      if (state) next.set(assetId, state);
      else next.delete(assetId);
      return next;
    });
  }, []);

  const loadTrack = useCallback(
    async (assetId: string, relPath: string) => {
      try {
        const res = await window.api.studioCacheRead({ projectId, relPath });
        if (!res.success || !res.data) return;
        const track = parseFaceTrack(JSON.parse(atob(res.data)) as unknown);
        if (!track) return;
        setTracks((prev) => ({ ...prev, [assetId]: { ...prev[assetId], faces: track } }));
      } catch {
        // A track that fails to read is a track that is not there: the clip plays plain.
      }
    },
    [projectId],
  );

  const applyEvent = useCallback(
    (event: StudioMediaJobEvent) => {
      if (event.projectId !== projectId || event.kind !== 'faceTrack') return;
      if (event.status === 'generating') {
        setState(event.assetId, { status: 'analyzing', percent: event.percent ?? 0, ...(event.message ? { message: event.message } : {}) });
        return;
      }
      if (event.status === 'ready' && event.analysis) {
        requested.current.delete(event.assetId);
        setState(event.assetId, { status: 'ready', spans: event.analysis.spans, fps: event.analysis.fps, ep: event.analysis.ep });
        if (event.relPath) void loadTrack(event.assetId, event.relPath);
      } else if (event.status === 'error') {
        // The request guard STAYS: a failed job is not re-asked until the
        // need itself changes (a retry loop met live on 2026-09-24 when a
        // bad size pin failed every download's integrity check).
        setState(event.assetId, { status: 'error', error: event.error ?? 'unknown error' });
      } else {
        requested.current.delete(event.assetId);
        setState(event.assetId, null);
      }
    },
    [projectId, setState, loadTrack],
  );

  useEffect(() => window.api.onStudioMediaJobEvent(applyEvent), [applyEvent]);

  // Queue what the timeline needs and the cache does not yet cover. A video
  // waits for its proxy to settle (ready, or failed — then the original is
  // read); a request that came back ready is applied at once. After an
  // error nothing is re-asked until the need itself changes.
  useEffect(() => {
    if (!projectId) return;
    for (const need of needs.values()) {
      const asset = assets.find((a) => a.id === need.assetId);
      if (!asset) continue;
      if (asset.kind === 'video' && asset.proxy?.status !== 'ready' && asset.proxy?.status !== 'error') continue;
      const state = states.get(need.assetId);
      if (stateCovers(state, need) || state?.status === 'analyzing') continue;
      const signature = needSignature(need);
      if (requested.current.get(need.assetId) === signature) continue;
      requested.current.set(need.assetId, signature);
      void window.api
        .studioAnalysisRequest({
          projectId,
          assetId: need.assetId,
          kind: 'faceTrack',
          assetKind: need.assetKind,
          sourcePath: asset.path,
          ...(asset.kind === 'video' && asset.proxy?.status === 'ready' ? { proxyRelPath: asset.proxy.path } : {}),
          spans: need.spans,
          fps,
        })
        .then((res) => {
          if (!res.success) {
            setState(need.assetId, { status: 'error', error: res.error ?? 'could not start' });
          } else if (res.ready) {
            applyEvent(res.ready);
          } else if (!states.get(need.assetId)) {
            setState(need.assetId, { status: 'analyzing', percent: 0 });
          }
        });
    }
  }, [projectId, needs, assets, states, fps, setState, applyEvent]);

  const stateOf = useCallback((assetId: string) => states.get(assetId), [states]);
  const trackMap = useMemo(() => (Object.keys(tracks).length > 0 ? tracks : undefined), [tracks]);
  return { tracks: trackMap, states, stateOf };
}
