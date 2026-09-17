import { useState, useEffect, useCallback, useRef } from 'react';
import type { VideoJobProgressEvent } from '@shared/ipc/types';
import type { VideoJobView, VideoJobSeed } from '../types';

const TERMINAL: ReadonlySet<VideoJobView['status']> = new Set(['completed', 'failed', 'cancelled']);

interface UseVideoJobsOptions {
  /** Called once per job that finishes successfully (refresh the gallery). */
  onCompleted?: () => void;
}

/**
 * The in-flight job cards. Jobs are submitted here and then driven entirely by
 * the `video:job-progress` push — the renderer never polls. A finished job
 * drops its card (the clip is in the gallery by then); a failed or cancelled
 * one stays until dismissed so its error can be read.
 */
export function useVideoJobs({ onCompleted }: UseVideoJobsOptions = {}) {
  const [jobs, setJobs] = useState<VideoJobView[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const completedRef = useRef(onCompleted);
  completedRef.current = onCompleted;

  const track = useCallback((jobId: string, seed: VideoJobSeed) => {
    setJobs((prev) => [
      { jobId, status: 'pending', submittedAt: Date.now(), ...seed },
      ...prev.filter((j) => j.jobId !== jobId),
    ]);
  }, []);

  const dismiss = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
  }, []);

  const cancel = useCallback(async (jobId: string) => {
    // Mark it straight away so the card stops offering Cancel twice; the push
    // that follows carries the authoritative status either way.
    setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, cancelling: true } : j)));
    const result = await window.api.videoCancel({ jobId });
    if (!result.success) {
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === jobId
            ? { ...j, cancelling: false, error: result.error || 'Cancel failed' }
            : j,
        ),
      );
    }
    return result.success;
  }, []);

  // Subscribe once; the push covers every state change of every job.
  useEffect(() => {
    const unsubscribe = window.api.onVideoJobProgress((event: VideoJobProgressEvent) => {
      setJobs((prev) => {
        const index = prev.findIndex((j) => j.jobId === event.jobId);
        // A job this panel did not submit (Flows, an agent) has no card here.
        if (index === -1) return prev;
        if (event.status === 'completed') {
          completedRef.current?.();
          return prev.filter((j) => j.jobId !== event.jobId);
        }
        const next = [...prev];
        next[index] = {
          ...next[index],
          status: event.status,
          ...(event.progress ? { progress: event.progress } : {}),
          ...(event.error ? { error: event.error } : {}),
          ...(event.blocked ? { blocked: event.blocked } : {}),
          ...(TERMINAL.has(event.status) ? { cancelling: false } : {}),
        };
        return next;
      });
    });
    return unsubscribe;
  }, []);

  // One timer for every card, and only while something is running.
  const hasActive = jobs.some((j) => !TERMINAL.has(j.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasActive]);

  return { jobs, now, track, cancel, dismiss };
}
