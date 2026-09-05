import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AiRuntimeVariant,
  ImageStudioEntry,
  PythonModelPreflightIpc,
  RembgErrorEvent,
  RembgSource,
  RembgStage,
} from '../../../shared/ipc/types';

export interface RemoveBackgroundJob {
  requestId: string;
  stage: RembgStage;
  pct?: number;
  message?: string;
  /** What is being processed, for the status card. */
  label: string;
}

export interface RemoveBackgroundError {
  message: string;
  code?: string;
  details?: string;
}

/** The install question, kept with the source so "Install" can resume the click. */
export interface RemoveBackgroundPrompt {
  preflight: Extract<PythonModelPreflightIpc, { ready: false }>;
  source: RembgSource;
  label: string;
}

interface UseRemoveBackgroundOptions {
  onImageSaved: (entry: ImageStudioEntry) => void;
  onDone?: (entry: ImageStudioEntry, seconds: number) => void;
  activeFolderId?: string | null;
}

export const REMBG_STAGE_LABELS: Record<RembgStage, string> = {
  'installing-runtime': 'Installing the AI runtime',
  'downloading-model': 'Downloading the model',
  'preparing-runtime': 'Preparing runtime',
  'removing-background': 'Removing background',
  saving: 'Saving',
};

/**
 * Image Studio "Remove background" (plan §4 step 5): one job at a time, install prompt
 * on the first click when the runtime / model is missing, push events from main.
 * No business logic here beyond state — the service in main does the work.
 */
export function useRemoveBackground({ onImageSaved, onDone, activeFolderId }: UseRemoveBackgroundOptions) {
  const [job, setJob] = useState<RemoveBackgroundJob | null>(null);
  const [error, setError] = useState<RemoveBackgroundError | null>(null);
  const [prompt, setPrompt] = useState<RemoveBackgroundPrompt | null>(null);
  const jobRef = useRef<RemoveBackgroundJob | null>(null);
  const savedRef = useRef(onImageSaved);
  const doneRef = useRef(onDone);
  savedRef.current = onImageSaved;
  doneRef.current = onDone;

  const update = useCallback((next: RemoveBackgroundJob | null) => {
    jobRef.current = next;
    setJob(next);
  }, []);

  useEffect(() => {
    const unsubs = [
      window.api.onRembgProgress((e) => {
        const current = jobRef.current;
        if (!current || current.requestId !== e.requestId) return;
        update({ ...current, stage: e.stage, pct: e.pct, message: e.message });
      }),
      window.api.onRembgComplete((e) => {
        const current = jobRef.current;
        if (!current || current.requestId !== e.requestId) return;
        update(null);
        savedRef.current(e.entry);
        doneRef.current?.(e.entry, e.seconds);
      }),
      window.api.onRembgError((e: RembgErrorEvent) => {
        const current = jobRef.current;
        if (!current || current.requestId !== e.requestId) return;
        update(null);
        if (e.code !== 'cancelled') setError({ message: e.error, code: e.code, details: e.details });
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [update]);

  const run = useCallback(
    async (source: RembgSource, label: string, install?: { variant?: AiRuntimeVariant }) => {
      if (jobRef.current) return;
      setError(null);
      const res = await window.api.rembgRun({
        source,
        folderId: activeFolderId ?? null,
        installIfMissing: install !== undefined,
        runtimeVariant: install?.variant,
      });
      if (res.success && res.requestId) {
        update({ requestId: res.requestId, stage: install ? 'installing-runtime' : 'preparing-runtime', label });
        return;
      }
      if (res.notReady && !res.notReady.ready) {
        setPrompt({ preflight: res.notReady, source, label });
        return;
      }
      setError({ message: res.error ?? 'Background removal failed' });
    },
    [activeFolderId, update],
  );

  /** Remove the background of a gallery image or a dropped image (base64). */
  const start = useCallback((source: RembgSource, label: string) => run(source, label), [run]);

  /** The user said yes to the install dialog. */
  const confirmInstall = useCallback(
    async (variant?: AiRuntimeVariant) => {
      const p = prompt;
      if (!p) return;
      setPrompt(null);
      await run(p.source, p.label, { variant });
    },
    [prompt, run],
  );

  const dismissPrompt = useCallback(() => setPrompt(null), []);

  const cancel = useCallback(async () => {
    const current = jobRef.current;
    if (!current) return;
    await window.api.rembgCancel({ requestId: current.requestId });
    update(null);
  }, [update]);

  return {
    job,
    error,
    prompt,
    start,
    confirmInstall,
    dismissPrompt,
    cancel,
    clearError: () => setError(null),
  };
}
