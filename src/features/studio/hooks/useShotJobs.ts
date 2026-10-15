// Folds STUDIO_SHOT_JOB_EVENT pushes into the open document. Generation
// completing is NOT a committed action (D9): registry changes enter through
// the non-committing `shots-adopt`, so a finishing shot never plants an undo
// step nor gets wiped by one. The ONE undoable thing here is an edit's
// version bump (`shot-set-version`) — a user-meaningful op. A cancelled NEW
// shot leaves the registry the same way (P3 part 5): `shot-remove` is undoable
// and would plant a step; any other cancelled op leaves the shot as it was.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { StudioShotJobEvent } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioShot } from '../types';
import type { TimelineAction } from './useTimeline';

export interface ShotJobProgress {
  status: 'generating' | 'ready' | 'error';
  op: StudioShotJobEvent['op'];
  percent?: number;
  message?: string;
  error?: string;
}

interface Options {
  projectId: string;
  /** The reducer's LIVE registry — the document copy lags one write-back. */
  shots: StudioShot[];
  dispatch: Dispatch<TimelineAction>;
  /** A generate/regenerate run finished — pool inserts hook in here. */
  onReady?: (shot: StudioShot, op: StudioShotJobEvent['op']) => void;
  onError?: (message: string) => void;
  /** Library assets imported on use (D12) — the document owner merges them
   *  into project.assets, keyed by id so re-delivery is harmless. */
  onImportedAssets?: (assets: StudioMediaAsset[]) => void;
  /** A new shot's build was cancelled: it has left the registry. */
  onCancelledNew?: (shotId: string) => void;
}

/** Existing entry updated in place, or the event's snapshot appended. */
export function foldShot(shots: StudioShot[], event: StudioShotJobEvent): StudioShot[] {
  const incoming = event.shot;
  if (!incoming) return shots;
  const index = shots.findIndex((s) => s.id === event.shotId);
  if (index < 0) return [...shots, incoming];
  const existing = shots[index];
  const merged: StudioShot =
    event.op === 'edit' || event.op === 'refine'
      ? {
          // Edit/refine only refresh the config snapshot here — the version
          // bump is dispatched separately as the undoable step, and their
          // partial snapshots must never strip registry fields (assetRefs).
          // Media the new version registered ADDS keys (older versions keep theirs).
          ...existing,
          ...(incoming.config ? { config: incoming.config } : {}),
          ...(incoming.assetRefs ? { assetRefs: { ...existing.assetRefs, ...incoming.assetRefs } } : {}),
        }
      : {
          ...existing,
          status: incoming.status,
          activeVersion: incoming.activeVersion,
          ...(incoming.config ? { config: incoming.config } : {}),
          ...(incoming.assetRefs ? { assetRefs: incoming.assetRefs } : {}),
          ...(incoming.error !== undefined ? { error: incoming.error } : {}),
        };
  const partialSnapshot = event.op === 'edit' || event.op === 'refine';
  if (!partialSnapshot && incoming.error === undefined) delete merged.error;
  // Generate/regenerate snapshots are built fresh from the request — absent
  // assetRefs means the new version uses none (same rule as `error` above).
  if (!partialSnapshot && incoming.assetRefs === undefined) delete merged.assetRefs;
  return shots.map((s, i) => (i === index ? merged : s));
}

/** A cancelled NEW shot leaves the registry (P3 part 5); every other event leaves it as it is (same array). */
export function withoutCancelledNew(shots: StudioShot[], event: StudioShotJobEvent): StudioShot[] {
  if (event.status !== 'canceled' || event.op !== 'generate') return shots;
  const kept = shots.filter((s) => s.id !== event.shotId);
  return kept.length === shots.length ? shots : kept;
}

export function useShotJobs({
  projectId,
  shots,
  dispatch,
  onReady,
  onError,
  onImportedAssets,
  onCancelledNew,
}: Options) {
  const [progress, setProgress] = useState<Map<string, ShotJobProgress>>(new Map());

  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onImportedAssetsRef = useRef(onImportedAssets);
  onImportedAssetsRef.current = onImportedAssets;
  const onCancelledNewRef = useRef(onCancelledNew);
  onCancelledNewRef.current = onCancelledNew;

  useEffect(() => {
    return window.api.onStudioShotJobEvent((event) => {
      if (event.projectId !== projectId) return;

      // Adopt imported assets FIRST — the shot snapshot on this same event
      // already carries assetRefs pointing at their ids.
      if (event.importedAssets && event.importedAssets.length > 0) {
        onImportedAssetsRef.current?.(event.importedAssets);
      }

      setProgress((prev) => {
        const next = new Map(prev);
        if (event.status === 'generating') {
          next.set(event.shotId, {
            status: 'generating',
            op: event.op,
            ...(event.percent !== undefined ? { percent: event.percent } : {}),
            ...(event.message !== undefined ? { message: event.message } : {}),
          });
        } else {
          // ready or error: the registry entry carries the terminal state
          // (status/error fields) — the progress map only tracks live runs.
          next.delete(event.shotId);
        }
        return next;
      });

      if (event.status === 'canceled' && event.op === 'generate') {
        const kept = withoutCancelledNew(shotsRef.current, event);
        if (kept !== shotsRef.current) {
          shotsRef.current = kept;
          dispatch({ type: 'shots-adopt', shots: kept });
        }
        onCancelledNewRef.current?.(event.shotId);
      }

      if (event.shot) {
        const folded = foldShot(shotsRef.current, event);
        if (folded !== shotsRef.current) {
          // Keep the ref current immediately: a ready event can follow the
          // generating one before React re-renders this subscriber.
          shotsRef.current = folded;
          dispatch({ type: 'shots-adopt', shots: folded });
        }
      }

      if (event.status === 'ready' && event.shot) {
        if (event.op === 'edit' || event.op === 'refine') {
          dispatch({
            type: 'shot-set-version',
            shotId: event.shotId,
            version: event.shot.activeVersion,
          });
        } else {
          const shot = shotsRef.current.find((s) => s.id === event.shotId);
          if (shot) onReadyRef.current?.(shot, event.op);
        }
      } else if (event.status === 'error' && event.error) {
        onErrorRef.current?.(event.error);
      }
    });
  }, [projectId, dispatch]);

  const getShotProgress = useCallback(
    (shotId: string) => progress.get(shotId) ?? null,
    [progress],
  );

  return { getShotProgress, anyGenerating: progress.size > 0 };
}
