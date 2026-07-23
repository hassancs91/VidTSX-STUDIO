import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { TsxJobIpc, TsxJobStartRequest } from '../../../shared/ipc/types';

const ACTIVE_STATUSES = new Set(['queued', 'planning', 'generating', 'verifying', 'fixing', 'naming', 'saving']);

export function isJobActive(job: TsxJobIpc): boolean {
  return ACTIVE_STATUSES.has(job.status);
}

export function isJobFinished(job: TsxJobIpc): boolean {
  return job.status === 'done' || job.status === 'error' || job.status === 'cancelled';
}

interface TsxJobsContextValue {
  jobs: TsxJobIpc[];
  activeJobs: TsxJobIpc[];
  /** Engine concurrency cap (1-4). */
  maxConcurrent: number;
  setMaxConcurrent: (value: number) => Promise<void>;
  startJob: (request: TsxJobStartRequest) => Promise<{ jobId?: string; error?: string }>;
  cancelJob: (jobId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  /** Subscribe to a job's live stream text (see useJobStream). */
  subscribeStream: (jobId: string, listener: () => void) => () => void;
  getStreamText: (jobId: string) => string;
}

const TsxJobsContext = createContext<TsxJobsContextValue | null>(null);

interface StreamStore {
  text: Map<string, string>;
  listeners: Map<string, Set<() => void>>;
}

export function TsxJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TsxJobIpc[]>([]);
  const [maxConcurrent, setMaxConcurrentState] = useState(4);
  // Stream chunks live in a ref-backed store so ~8 updates/sec per job don't
  // re-render the whole tree — only useJobStream subscribers.
  const streamRef = useRef<StreamStore>({ text: new Map(), listeners: new Map() });

  useEffect(() => {
    let disposed = false;
    window.api.tsxJobList()
      .then((result) => { if (!disposed) setJobs(result.jobs); })
      .catch(() => {});
    window.api.tsxJobConfigure({})
      .then((result) => { if (!disposed) setMaxConcurrentState(result.maxConcurrent); })
      .catch(() => {});

    const unsubscribe = window.api.onTsxJobEvent(({ job }) => {
      if (isJobFinished(job)) {
        // Free the stream buffer once the job settles
        streamRef.current.text.delete(job.id);
        streamRef.current.listeners.get(job.id)?.forEach((listener) => listener());
      }
      setJobs((prev) => {
        const index = prev.findIndex((j) => j.id === job.id);
        if (index === -1) return [...prev, job];
        const next = prev.slice();
        next[index] = job;
        return next;
      });
    });

    const unsubscribeStream = window.api.onTsxJobStream(({ jobId, chunk }) => {
      const store = streamRef.current;
      store.text.set(jobId, (store.text.get(jobId) ?? '') + chunk);
      store.listeners.get(jobId)?.forEach((listener) => listener());
    });

    return () => {
      disposed = true;
      unsubscribe();
      unsubscribeStream();
    };
  }, []);

  const subscribeStream = useCallback((jobId: string, listener: () => void) => {
    const store = streamRef.current;
    if (!store.listeners.has(jobId)) store.listeners.set(jobId, new Set());
    store.listeners.get(jobId)!.add(listener);
    return () => {
      store.listeners.get(jobId)?.delete(listener);
    };
  }, []);

  const getStreamText = useCallback((jobId: string) => {
    return streamRef.current.text.get(jobId) ?? '';
  }, []);

  const setMaxConcurrent = useCallback(async (value: number) => {
    setMaxConcurrentState(value);
    try {
      const result = await window.api.tsxJobConfigure({ maxConcurrent: value });
      setMaxConcurrentState(result.maxConcurrent);
    } catch {
      // Keep the optimistic value; the engine clamps on its side anyway
    }
  }, []);

  const startJob = useCallback(async (request: TsxJobStartRequest) => {
    try {
      const result = await window.api.tsxJobStart(request);
      return result.success ? { jobId: result.jobId } : { error: result.error ?? 'Failed to start job' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to start job' };
    }
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await window.api.tsxJobCancel({ jobId });
    } catch {
      // The job event stream is the source of truth; ignore invoke errors
    }
  }, []);

  const clearCompleted = useCallback(async () => {
    try {
      await window.api.tsxJobClearCompleted();
      setJobs((prev) => prev.filter((j) => !isJobFinished(j)));
    } catch {
      // Ignore
    }
  }, []);

  const activeJobs = useMemo(() => jobs.filter(isJobActive), [jobs]);

  const value = useMemo(
    () => ({ jobs, activeJobs, maxConcurrent, setMaxConcurrent, startJob, cancelJob, clearCompleted, subscribeStream, getStreamText }),
    [jobs, activeJobs, maxConcurrent, setMaxConcurrent, startJob, cancelJob, clearCompleted, subscribeStream, getStreamText],
  );

  return <TsxJobsContext.Provider value={value}>{children}</TsxJobsContext.Provider>;
}

export function useTsxJobs(): TsxJobsContextValue {
  const context = useContext(TsxJobsContext);
  if (!context) throw new Error('useTsxJobs must be used within TsxJobsProvider');
  return context;
}

/** Live streamed LLM text for a job — re-renders only the subscribing component. */
export function useJobStream(jobId: string | null): string {
  const { subscribeStream, getStreamText } = useTsxJobs();
  const subscribe = useCallback(
    (listener: () => void) => (jobId ? subscribeStream(jobId, listener) : () => {}),
    [jobId, subscribeStream],
  );
  const getSnapshot = useCallback(
    () => (jobId ? getStreamText(jobId) : ''),
    [jobId, getStreamText],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}
