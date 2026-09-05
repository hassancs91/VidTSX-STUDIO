import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiRuntimeVariant, PythonModelPreflightIpc, ThreedStudioEntry } from '../../../shared/ipc/types';
import { buildSd3dRequest } from '../services/threed-request';
import type { GenerationError, GenerationJob, GenerationSettings } from '../types';

export interface InstallPrompt {
  preflight: Extract<PythonModelPreflightIpc, { ready: false }>;
  settings: GenerationSettings;
}

interface Options {
  onModelSaved: (entry: ThreedStudioEntry) => void;
  onDone?: (entry: ThreedStudioEntry, seconds: number) => void;
}

/**
 * One image → 3D job at a time (the engine serialises anyway): install prompt on the
 * first run without runtime / model, push events from main, cancel at any stage.
 */
export function useThreeDGeneration({ onModelSaved, onDone }: Options) {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [error, setError] = useState<GenerationError | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const jobRef = useRef<GenerationJob | null>(null);
  const savedRef = useRef(onModelSaved);
  const doneRef = useRef(onDone);
  savedRef.current = onModelSaved;
  doneRef.current = onDone;

  const update = useCallback((next: GenerationJob | null) => {
    jobRef.current = next;
    setJob(next);
  }, []);

  useEffect(() => {
    const unsubs = [
      window.api.onSd3dGenerateProgress((e) => {
        const current = jobRef.current;
        if (!current || current.requestId !== e.requestId) return;
        update({ ...current, stage: e.stage, pct: e.pct, message: e.message });
      }),
      window.api.onSd3dGenerateComplete((e) => {
        const current = jobRef.current;
        if (!current || current.requestId !== e.requestId) return;
        update(null);
        savedRef.current(e.entry);
        doneRef.current?.(e.entry, e.seconds);
      }),
      window.api.onSd3dGenerateError((e) => {
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
    async (settings: GenerationSettings, install?: { variant?: AiRuntimeVariant }) => {
      if (jobRef.current) return;
      setError(null);
      const res = await window.api.sd3dGenerate(buildSd3dRequest(settings, install));
      if (res.success && res.requestId) {
        update({ requestId: res.requestId, stage: install ? 'installing-runtime' : 'preparing-runtime', label: settings.sourceLabel, startedAt: Date.now() });
        return;
      }
      if (res.notReady && !res.notReady.ready) {
        setPrompt({ preflight: res.notReady, settings });
        return;
      }
      setError({ message: res.error ?? '3D generation failed' });
    },
    [update],
  );

  const generate = useCallback((settings: GenerationSettings) => run(settings), [run]);

  const confirmInstall = useCallback(
    async (variant?: AiRuntimeVariant) => {
      const p = prompt;
      if (!p) return;
      setPrompt(null);
      await run(p.settings, { variant });
    },
    [prompt, run],
  );

  const cancel = useCallback(async () => {
    const current = jobRef.current;
    if (!current) return;
    await window.api.sd3dCancel({ requestId: current.requestId });
    update(null);
  }, [update]);

  return { job, error, prompt, generate, confirmInstall, dismissPrompt: () => setPrompt(null), cancel, clearError: () => setError(null) };
}
