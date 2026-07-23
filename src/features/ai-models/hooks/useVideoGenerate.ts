import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SdVideoGenerateCompleteEvent,
  SdVideoGenerateErrorEvent,
  SdVideoGenerateProgressEvent,
  SdVideoResultIpc,
} from '@shared/ipc/types';

export interface VideoGenerateError {
  message: string;
  details?: string;
}

export interface VideoGenerateOptions {
  negativePrompt?: string;
  initImagePath?: string;
  frames?: number;
  width?: number;
  height?: number;
}

/** Build a renderer-playable URL for a generated file (Video Studio pattern). */
function toFileUrl(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

/**
 * Drives one local video generation at a time via the sdvideo engine.
 * The result is exposed as a file:// URL for a `<video>` element (base64 is
 * impractical for video).
 */
export function useVideoGenerate() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ step: number; totalSteps: number; percent: number } | null>(null);
  const [result, setResult] = useState<(SdVideoResultIpc & { videoUrl: string }) | null>(null);
  const [error, setError] = useState<VideoGenerateError | null>(null);
  const [autoOffload, setAutoOffload] = useState(false);

  const activeRequestIdRef = useRef<string | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    unsubsRef.current = [
      window.api.onSdVideoGenerateProgress((event: SdVideoGenerateProgressEvent) => {
        if (event.requestId !== activeRequestIdRef.current) return;
        setProgress({ step: event.step, totalSteps: event.totalSteps, percent: event.percent });
      }),
      window.api.onSdVideoGenerateComplete((event: SdVideoGenerateCompleteEvent) => {
        if (event.requestId !== activeRequestIdRef.current) return;
        activeRequestIdRef.current = null;
        setGenerating(false);
        setProgress(null);
        setResult({ ...event.result, videoUrl: toFileUrl(event.result.outputPath) });
      }),
      window.api.onSdVideoGenerateError((event: SdVideoGenerateErrorEvent) => {
        if (event.requestId !== activeRequestIdRef.current) return;
        activeRequestIdRef.current = null;
        setGenerating(false);
        setProgress(null);
        setError({ message: event.error, details: event.details });
      }),
    ];
    return () => {
      for (const unsub of unsubsRef.current) unsub();
    };
  }, []);

  const generate = useCallback(
    async (modelId: string, prompt: string, options?: VideoGenerateOptions) => {
      if (generating) return;
      setGenerating(true);
      setProgress(null);
      setResult(null);
      setError(null);
      setAutoOffload(false);

      const response = await window.api.sdVideoGenerate({
        modelId,
        prompt,
        negativePrompt: options?.negativePrompt || undefined,
        initImagePath: options?.initImagePath || undefined,
        frames: options?.frames,
        width: options?.width,
        height: options?.height,
      });

      if (!response.success || !response.requestId) {
        setGenerating(false);
        setError({ message: response.error || 'Generation failed' });
        return;
      }

      activeRequestIdRef.current = response.requestId;
      setAutoOffload(Boolean(response.autoOffloadEnabled));
    },
    [generating],
  );

  const cancel = useCallback(async () => {
    const requestId = activeRequestIdRef.current;
    if (!requestId) return;
    await window.api.sdVideoCancel({ requestId });
    activeRequestIdRef.current = null;
    setGenerating(false);
    setProgress(null);
  }, []);

  return {
    generating,
    progress,
    result,
    error,
    autoOffload,
    generate,
    cancel,
    clearError: () => setError(null),
    clearResult: () => setResult(null),
  };
}
