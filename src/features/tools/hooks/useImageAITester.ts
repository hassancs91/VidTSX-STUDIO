import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SdImageModelIpc,
  SdImageDownloadProgressEvent,
  SdImageGenerateProgressEvent,
  SdImageGenerateCompleteEvent,
  SdImageGenerateErrorEvent,
} from '../../../shared/ipc/types';

interface GenerationState {
  generating: boolean;
  requestId: string | null;
  step: number;
  totalSteps: number;
  percent: number;
  imageBase64: string | null;
  width: number | null;
  height: number | null;
  seed: number | null;
  durationMs: number | null;
  error: string | null;
  /** Set when the VRAM preflight auto-enabled CPU offload for this run. */
  notice: string | null;
}

const INITIAL_GENERATION: GenerationState = {
  generating: false,
  requestId: null,
  step: 0,
  totalSteps: 0,
  percent: 0,
  imageBase64: null,
  width: null,
  height: null,
  seed: null,
  durationMs: null,
  error: null,
  notice: null,
};

export function useImageAITester() {
  const [models, setModels] = useState<SdImageModelIpc[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sdCliInstalled, setSdCliInstalled] = useState(false);
  const [generation, setGeneration] = useState<GenerationState>(INITIAL_GENERATION);

  const unsubProgressRef = useRef<(() => void) | null>(null);
  const unsubCompleteRef = useRef<(() => void) | null>(null);
  const unsubErrorRef = useRef<(() => void) | null>(null);

  // Load models on mount
  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const [statusResult, modelsResult] = await Promise.all([
        window.api.sdImageStatus(),
        window.api.sdImageModelsList(),
      ]);
      setSdCliInstalled(statusResult.sdCliInstalled);

      const downloaded = modelsResult.models.filter((m: SdImageModelIpc) => m.downloaded);
      setModels(downloaded);

      // Auto-select active model or first downloaded
      if (statusResult.activeModelId && downloaded.some((m: SdImageModelIpc) => m.id === statusResult.activeModelId)) {
        setSelectedModelId(statusResult.activeModelId);
      } else if (downloaded.length > 0) {
        setSelectedModelId(downloaded[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Subscribe to generation events
  useEffect(() => {
    unsubProgressRef.current = window.api.onSdImageGenerateProgress(
      (event: SdImageGenerateProgressEvent) => {
        setGeneration((prev) => ({
          ...prev,
          step: event.step,
          totalSteps: event.totalSteps,
          percent: event.percent,
        }));
      },
    );

    unsubCompleteRef.current = window.api.onSdImageGenerateComplete(
      (event: SdImageGenerateCompleteEvent) => {
        setGeneration((prev) => ({
          ...prev,
          generating: false,
          percent: 100,
          imageBase64: event.result.imageBase64,
          width: event.result.width,
          height: event.result.height,
          seed: event.result.seed,
          durationMs: event.result.durationMs,
          error: null,
        }));
      },
    );

    unsubErrorRef.current = window.api.onSdImageGenerateError(
      (event: SdImageGenerateErrorEvent) => {
        setGeneration((prev) => ({
          ...prev,
          generating: false,
          error: event.error,
        }));
      },
    );

    return () => {
      unsubProgressRef.current?.();
      unsubCompleteRef.current?.();
      unsubErrorRef.current?.();
    };
  }, []);

  const generate = useCallback(
    async (params: {
      prompt: string;
      negativePrompt?: string;
      width?: number;
      height?: number;
      steps?: number;
      cfgScale?: number;
      sampler?: string;
      seed?: number;
      schedule?: string;
      offloadToCpu?: boolean;
      clipOnCpu?: boolean;
      vaeOnCpu?: boolean;
      threads?: number;
      batchCount?: number;
    }) => {
      if (generation.generating || !selectedModelId) return;

      setGeneration({
        ...INITIAL_GENERATION,
        generating: true,
      });

      try {
        // Set active model first
        await window.api.sdImageSetActiveModel({ modelId: selectedModelId });

        const result = await window.api.sdImageGenerate({
          operation: 'txt2img',
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          width: params.width,
          height: params.height,
          steps: params.steps,
          cfgScale: params.cfgScale,
          sampler: params.sampler,
          seed: params.seed,
          modelId: selectedModelId,
          schedule: params.schedule || undefined,
          offloadToCpu: params.offloadToCpu,
          clipOnCpu: params.clipOnCpu,
          vaeOnCpu: params.vaeOnCpu,
          threads: params.threads,
          batchCount: params.batchCount,
        });

        if (!result.success) {
          setGeneration((prev) => ({
            ...prev,
            generating: false,
            error: result.error || 'Generation failed',
          }));
        } else if (result.autoOffloadEnabled) {
          setGeneration((prev) => ({
            ...prev,
            notice: 'CPU offload auto-enabled — this model is larger than your GPU VRAM (slower, but avoids an out-of-memory crash).',
          }));
        }
        // On success, the complete/error events handle updating state
      } catch (err) {
        setGeneration((prev) => ({
          ...prev,
          generating: false,
          error: err instanceof Error ? err.message : 'Generation failed',
        }));
      }
    },
    [generation.generating, selectedModelId],
  );

  const cancel = useCallback(async () => {
    if (generation.requestId) {
      await window.api.sdImageCancel({ requestId: generation.requestId });
    }
    await window.api.sdImageCancelAll();
    setGeneration((prev) => ({
      ...prev,
      generating: false,
      error: 'Cancelled',
    }));
  }, [generation.requestId]);

  return {
    models,
    selectedModelId,
    setSelectedModelId,
    loading,
    sdCliInstalled,
    generation,
    generate,
    cancel,
    reload: loadModels,
  };
}
