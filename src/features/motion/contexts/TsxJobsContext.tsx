import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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
  startJob: (request: TsxJobStartRequest) => Promise<{ jobId?: string; error?: string }>;
  cancelJob: (jobId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
}

const TsxJobsContext = createContext<TsxJobsContextValue | null>(null);

export function TsxJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TsxJobIpc[]>([]);

  useEffect(() => {
    let disposed = false;
    window.api.tsxJobList()
      .then((result) => { if (!disposed) setJobs(result.jobs); })
      .catch(() => {});

    const unsubscribe = window.api.onTsxJobEvent(({ job }) => {
      setJobs((prev) => {
        const index = prev.findIndex((j) => j.id === job.id);
        if (index === -1) return [...prev, job];
        const next = prev.slice();
        next[index] = job;
        return next;
      });
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
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
    () => ({ jobs, activeJobs, startJob, cancelJob, clearCompleted }),
    [jobs, activeJobs, startJob, cancelJob, clearCompleted],
  );

  return <TsxJobsContext.Provider value={value}>{children}</TsxJobsContext.Provider>;
}

export function useTsxJobs(): TsxJobsContextValue {
  const context = useContext(TsxJobsContext);
  if (!context) throw new Error('useTsxJobs must be used within TsxJobsProvider');
  return context;
}
