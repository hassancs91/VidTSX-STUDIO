import { createContext, useContext, useState, useEffect, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { RenderQueueJob, RenderPhase } from '@shared/ipc/types';
import type { AddJobOptions } from '../types';
import { generateOutputPath, generateJobId } from '../services/queue-manager';

interface ProgressData {
  percent: number;
  phase: RenderPhase;
  framesRendered?: number;
  totalFrames?: number;
  message?: string;
}

interface RenderQueueContextValue {
  jobs: RenderQueueJob[];
  activeJob: RenderQueueJob | null;
  activeCount: number;
  addJob: (options: AddJobOptions) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  clearCompleted: () => void;
  openFile: (outputPath: string) => Promise<void>;
  openFolder: (outputPath: string) => Promise<void>;
  // Progress subscription (ref-based, no re-renders on progress ticks)
  subscribeProgress: (callback: () => void) => () => void;
  getJobProgress: (jobId: string) => ProgressData | null;
}

const RenderQueueContext = createContext<RenderQueueContextValue | null>(null);

interface RenderQueueProviderProps {
  children: ReactNode;
}

export function RenderQueueProvider({ children }: RenderQueueProviderProps) {
  const [jobs, setJobs] = useState<RenderQueueJob[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videosDirRef = useRef<string | null>(null);

  // Progress stored in a ref — no React state, no re-renders
  const progressMapRef = useRef<Map<string, ProgressData>>(new Map());
  const progressListenersRef = useRef<Set<() => void>>(new Set());

  const subscribeProgress = useCallback((callback: () => void) => {
    progressListenersRef.current.add(callback);
    return () => { progressListenersRef.current.delete(callback); };
  }, []);

  const getJobProgress = useCallback((jobId: string): ProgressData | null => {
    return progressMapRef.current.get(jobId) ?? null;
  }, []);

  const notifyProgressListeners = useCallback(() => {
    progressListenersRef.current.forEach((fn) => fn());
  }, []);

  // Computed values
  const activeJob = jobs.find((j) => j.status === 'rendering') ?? null;
  const activeCount = jobs.filter((j) => j.status === 'queued' || j.status === 'rendering').length;

  // Debounced save function
  const saveQueue = useCallback((jobsToSave: RenderQueueJob[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      await window.api.renderQueueSave({ jobs: jobsToSave });
    }, 500);
  }, []);

  // Load queue on mount
  useEffect(() => {
    const loadQueue = async () => {
      const { jobs: loadedJobs } = await window.api.renderQueueLoad();
      setJobs(loadedJobs);
      setIsLoaded(true);
    };
    loadQueue();
  }, []);

  // Save queue whenever it changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      saveQueue(jobs);
    }
  }, [jobs, isLoaded, saveQueue]);

  // Start next queued job when needed
  const startNextJob = useCallback(async (currentJobs: RenderQueueJob[]) => {
    const hasActiveJob = currentJobs.some((j) => j.status === 'rendering');
    if (hasActiveJob) return;

    const nextJob = currentJobs.find((j) => j.status === 'queued');
    if (!nextJob) return;

    // Optimistically mark as rendering so UI updates immediately
    // (renderStart triggers bundling which blocks main process for seconds).
    // Stamp startedAt so the details panel can compute elapsed time + avg FPS
    // from actual render start, not from when the job was queued.
    const startedAt = Date.now();
    setJobs((prev) =>
      prev.map((j) =>
        j.id === nextJob.id ? { ...j, status: 'rendering' as const, startedAt } : j
      )
    );

    // Start the render (renderStart bundles if needed). Returns a jobId and
    // emits on the shared RENDER_PROGRESS / RENDER_COMPLETE events.
    const result = await window.api.renderStart({
      filePath: nextJob.filePath,
      bundleUrl: nextJob.bundleUrl,
      compositionId: nextJob.compositionId,
      outputPath: nextJob.outputPath,
      codec: nextJob.codec,
      width: nextJob.width,
      height: nextJob.height,
      fps: nextJob.fps,
      crf: nextJob.crf,
      muted: nextJob.muted,
      scale: nextJob.scale,
      everyNthFrame: nextJob.everyNthFrame,
      numberOfGifLoops: nextJob.numberOfGifLoops,
      inputProps: nextJob.inputProps,
      transparent: nextJob.transparent,
      cpuUsage: nextJob.cpuUsage,
      gpuBackend: nextJob.gpuBackend,
      hardwareAcceleration: nextJob.hardwareAcceleration,
      exportEngine: nextJob.exportEngine,
      verifyAgainstEngine: nextJob.verifyAgainstEngine,
    });

    if (result.success && result.jobId) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === nextJob.id
            ? { ...j, id: result.jobId! }
            : j
        )
      );
    } else {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === nextJob.id
            ? { ...j, status: 'error' as const, error: result.error || 'Failed to start render' }
            : j
        )
      );
    }
  }, []);

  // Listen for render events
  useEffect(() => {
    // Progress goes to ref only — no setJobs, no React re-renders
    const unsubscribeProgress = window.api.onRenderProgress((event) => {
      // A finishing/verifying tick without frame counts keeps the last ones:
      // the row persists whatever the final tick held.
      const prev = progressMapRef.current.get(event.jobId);
      progressMapRef.current.set(event.jobId, {
        percent: event.percent,
        phase: event.phase,
        framesRendered: event.framesRendered ?? prev?.framesRendered,
        totalFrames: event.totalFrames ?? prev?.totalFrames,
        message: event.message,
      });
      notifyProgressListeners();
    });

    // Encoder resolution event fires once per render when ffmpeg args are
    // ready. Stash on the job so the details panel can show NVENC vs CPU etc.
    const unsubscribeEncoder = window.api.onRenderEncoderResolved((event) => {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === event.jobId
            ? {
                ...job,
                encoderName: event.encoderName,
                encoderHardwareAccelerated: event.hardwareAccelerated,
              }
            : job
        )
      );
    });

    // Completion updates jobs state (status change)
    const unsubscribeComplete = window.api.onRenderComplete((event) => {
      // The last progress tick is what the row persists: the frame count and
      // percent were only ever in this ref, so rows used to save framesRendered 0.
      const last = progressMapRef.current.get(event.jobId);
      progressMapRef.current.delete(event.jobId);

      setJobs((prev) => {
        const updated = prev.map((job) => {
          if (job.id !== event.jobId) return job;
          const totalFrames = last?.totalFrames ?? job.totalFrames;
          const framesRendered = event.success ? totalFrames : (last?.framesRendered ?? job.framesRendered);
          // A job the user cancelled stays cancelled: the export's own
          // "Cancelled" completion must not turn it into an error.
          const status = job.status === 'cancelled' ? job.status : event.success ? ('done' as const) : ('error' as const);
          return {
            ...job,
            status,
            progress: event.success ? 100 : (last?.percent ?? job.progress),
            framesRendered,
            totalFrames,
            fileSize: event.fileSize,
            error: status === 'cancelled' ? job.error : event.error,
            message: event.message,
            reportPath: event.reportPath,
            completedAt: job.completedAt ?? Date.now(),
          };
        });

        // Append successful render to the persistent history file
        if (event.success) {
          const finished = updated.find((j) => j.id === event.jobId);
          if (finished?.filePath && finished?.outputPath) {
            window.api.renderHistoryAppend({
              entry: {
                filePath: finished.filePath,
                outputPath: finished.outputPath,
                completedAt: finished.completedAt ?? Date.now(),
                fileName: finished.fileName,
                codec: finished.codec,
                width: finished.width,
                height: finished.height,
                scale: finished.scale,
                fileSize: finished.fileSize,
              },
            }).catch(() => {});
          }
        }

        // Start next job after state update
        setTimeout(() => startNextJob(updated), 100);

        return updated;
      });
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeEncoder();
    };
  }, [startNextJob, notifyProgressListeners]);

  // Add a new job to the queue
  const addJob = useCallback(async (options: AddJobOptions) => {
    if (!videosDirRef.current) {
      const { path: dir } = await window.api.renderGetVideosDir();
      videosDirRef.current = dir;
    }
    // A caller may name the file (agent renders file into the library, §1.11);
    // otherwise the queue picks a timestamped name in the videos folder.
    const outputPath =
      options.outputPath ??
      generateOutputPath(options.compositionId, videosDirRef.current, options.codec);

    const newJob: RenderQueueJob = {
      id: options.id ?? generateJobId(),
      fileName: options.fileName,
      filePath: options.filePath,
      bundleUrl: options.bundleUrl,
      compositionId: options.compositionId,
      outputPath,
      codec: options.codec,
      width: options.width,
      height: options.height,
      fps: options.fps,
      crf: options.crf,
      muted: options.muted,
      scale: options.scale,
      everyNthFrame: options.everyNthFrame,
      numberOfGifLoops: options.numberOfGifLoops,
      inputProps: options.inputProps,
      transparent: options.transparent,
      cpuUsage: options.cpuUsage,
      gpuBackend: options.gpuBackend,
      hardwareAcceleration: options.hardwareAcceleration,
      exportEngine: options.exportEngine,
      verifyAgainstEngine: options.verifyAgainstEngine,
      status: 'queued',
      progress: 0,
      framesRendered: 0,
      totalFrames: 0,
      createdAt: Date.now(),
    };

    setJobs((prev) => {
      const updated = [...prev, newJob];
      // Start the job if no other job is active
      setTimeout(() => startNextJob(updated), 100);
      return updated;
    });
  }, [startNextJob]);

  // Cancel a job
  const cancelJob = useCallback(async (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    if (job.status === 'rendering') {
      await window.api.renderCancel({ jobId: id });
    }

    const last = progressMapRef.current.get(id);
    progressMapRef.current.delete(id);

    setJobs((prev) => {
      const updated = prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status: 'cancelled' as const,
              progress: last?.percent ?? j.progress,
              framesRendered: last?.framesRendered ?? j.framesRendered,
              totalFrames: last?.totalFrames ?? j.totalFrames,
              completedAt: Date.now(),
            }
          : j
      );
      // Start next job after cancellation
      setTimeout(() => startNextJob(updated), 100);
      return updated;
    });
  }, [jobs, startNextJob]);

  // Retry a failed job in place (same row, fresh output path)
  const retryJob = useCallback(async (id: string) => {
    if (!videosDirRef.current) {
      const { path: dir } = await window.api.renderGetVideosDir();
      videosDirRef.current = dir;
    }
    const dir = videosDirRef.current;

    setJobs((prev) => {
      const target = prev.find((j) => j.id === id);
      if (!target || target.status !== 'error') return prev;

      const newOutputPath = generateOutputPath(target.compositionId, dir, target.codec);

      const updated = prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status: 'queued' as const,
              progress: 0,
              framesRendered: 0,
              totalFrames: 0,
              error: undefined,
              startedAt: undefined,
              completedAt: undefined,
              outputPath: newOutputPath,
            }
          : j
      );
      setTimeout(() => startNextJob(updated), 100);
      return updated;
    });
  }, [startNextJob]);

  // Clear completed jobs. Persist immediately instead of via the debounced
  // save — a pending debounce is dropped on unmount/quit, which would bring
  // the cleared jobs back on next launch.
  const clearCompleted = useCallback(() => {
    const updated = jobs.filter((j) => j.status === 'queued' || j.status === 'rendering');
    setJobs(updated);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    void window.api.renderQueueSave({ jobs: updated });
  }, [jobs]);

  // Open rendered file
  const openFile = useCallback(async (outputPath: string) => {
    await window.api.renderOpenFile({ filePath: outputPath });
  }, []);

  // Open folder containing rendered file
  const openFolder = useCallback(async (outputPath: string) => {
    await window.api.renderOpenFolder({ filePath: outputPath });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const value: RenderQueueContextValue = {
    jobs,
    activeJob,
    activeCount,
    addJob,
    cancelJob,
    retryJob,
    clearCompleted,
    openFile,
    openFolder,
    subscribeProgress,
    getJobProgress,
  };

  return (
    <RenderQueueContext.Provider value={value}>
      {children}
    </RenderQueueContext.Provider>
  );
}

export function useRenderQueueContext(): RenderQueueContextValue {
  const context = useContext(RenderQueueContext);
  if (!context) {
    throw new Error('useRenderQueueContext must be used within a RenderQueueProvider');
  }
  return context;
}

/**
 * Subscribe to real-time progress for a specific job.
 * Uses useSyncExternalStore — only re-renders this component, not the whole tree.
 */
export function useJobProgress(jobId: string | undefined): ProgressData | null {
  const { subscribeProgress, getJobProgress } = useRenderQueueContext();

  return useSyncExternalStore(
    subscribeProgress,
    () => (jobId ? getJobProgress(jobId) : null),
  );
}
