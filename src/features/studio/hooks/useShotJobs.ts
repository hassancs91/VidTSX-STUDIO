// Folds STUDIO_SHOT_JOB_EVENT pushes into the open document. Generation
// completing is NOT a committed action (D9): registry changes enter through
// the non-committing `shots-adopt`, so a finishing shot never plants an undo
// step nor gets wiped by one. The ONE undoable thing here is an edit's
// version bump (`shot-set-version`) — a user-meaningful op.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { StudioShotJobEvent } from '@shared/ipc/types';
import type { StudioShot } from '../types';
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
}

/** Existing entry updated in place, or the event's snapshot appended. */
function foldShot(shots: StudioShot[], event: StudioShotJobEvent): StudioShot[] {
  const incoming = event.shot;
  if (!incoming) return shots;
  const index = shots.findIndex((s) => s.id === event.shotId);
  if (index < 0) return [...shots, incoming];
  const existing = shots[index];
  const merged: StudioShot =
    event.op === 'edit'
      ? {
          // Edits only refresh the config snapshot here — the version bump is
          // dispatched separately as the undoable step.
          ...existing,
          ...(incoming.config ? { config: incoming.config } : {}),
        }
      : {
          ...existing,
          status: incoming.status,
          activeVersion: incoming.activeVersion,
          ...(incoming.config ? { config: incoming.config } : {}),
          ...(incoming.error !== undefined ? { error: incoming.error } : {}),
        };
  if (event.op !== 'edit' && incoming.error === undefined) delete merged.error;
  return shots.map((s, i) => (i === index ? merged : s));
}

export function useShotJobs({ projectId, shots, dispatch, onReady, onError }: Options) {
  const [progress, setProgress] = useState<Map<string, ShotJobProgress>>(new Map());

  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    return window.api.onStudioShotJobEvent((event) => {
      if (event.projectId !== projectId) return;

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
        if (event.op === 'edit') {
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
