import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  LocalLlmModelIpc,
  LocalLlmTokenEvent,
  LocalLlmCompleteEvent,
  DownloadProgressEvent,
} from '../../shared/ipc/types';

export interface LlmDownloadStatus {
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: 'downloading' | 'paused' | 'queued';
  error: string | null;
}

interface GpuInfo {
  backend: string;
  deviceName?: string;
  vramMb?: number;
}

export function useLocalLlm() {
  const [models, setModels] = useState<LocalLlmModelIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
  /** Per-model download status, keyed by modelId */
  const [downloads, setDownloads] = useState<Record<string, LlmDownloadStatus>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [tokensPerSecond, setTokensPerSecond] = useState(0);

  const unsubDownloadRef = useRef<(() => void) | null>(null);
  const unsubTokenRef = useRef<(() => void) | null>(null);
  const unsubCompleteRef = useRef<(() => void) | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const resolveGenerationRef = useRef<((result: { text: string; tokensGenerated: number; tokensPerSecond: number; stopReason: string; sessionId?: string }) => void) | null>(null);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const [statusResult, modelsResult, downloadsResult] = await Promise.all([
        window.api.localLlmStatus(),
        window.api.localLlmModelsList(),
        window.api.downloadGetAll(),
      ]);
      setAvailable(statusResult.available);
      setActiveModelId(statusResult.activeModelId);
      setGpuInfo(statusResult.gpu);
      setModels(modelsResult.models);

      // Restore download status for any active LLM downloads
      const restored: Record<string, LlmDownloadStatus> = {};
      for (const d of downloadsResult.downloads) {
        if (d.metadata?.type !== 'llm-model') continue;
        if (d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled') continue;

        const modelId = d.metadata.modelId;
        if (!modelId) continue;

        const mappedStatus = (['downloading', 'paused', 'queued'] as const)
          .find((s) => s === d.status) ?? 'queued';

        restored[modelId] = {
          progress: d.percent,
          speedBps: d.speedBps,
          etaSeconds: d.etaSeconds,
          status: mappedStatus,
          error: null,
        };
      }
      if (Object.keys(restored).length > 0) {
        setDownloads(restored);
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

  // Subscribe to download manager progress (shared with audio)
  useEffect(() => {
    unsubDownloadRef.current = window.api.onDownloadProgress(
      (event: DownloadProgressEvent) => {
        if (event.metadata?.type !== 'llm-model') return;

        const modelId = event.metadata.modelId;
        if (!modelId) return;
        const status = event.status;

        if (status === 'completed') {
          setModels((prev) =>
            prev.map((m) => (m.id === modelId ? { ...m, downloaded: true } : m)),
          );
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          return;
        }

        if (status === 'failed' || status === 'cancelled') {
          if (status === 'failed') {
            setDownloadError(event.error || 'Download failed');
          }
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          return;
        }

        const mappedStatus = (['downloading', 'paused', 'queued'] as const)
          .find((s) => s === status) ?? 'queued';

        setDownloads((prev) => ({
          ...prev,
          [modelId]: {
            progress: event.percent >= 0 ? event.percent : (prev[modelId]?.progress ?? 0),
            speedBps: event.speedBps,
            etaSeconds: event.etaSeconds,
            status: mappedStatus,
            error: null,
          },
        }));
      },
    );
    return () => {
      unsubDownloadRef.current?.();
    };
  }, []);

  // Subscribe to token streaming
  useEffect(() => {
    unsubTokenRef.current = window.api.onLocalLlmToken(
      (event: LocalLlmTokenEvent) => {
        if (event.requestId === activeRequestIdRef.current) {
          setStreamedText(event.text);
        }
      },
    );
    return () => { unsubTokenRef.current?.(); };
  }, []);

  // Subscribe to generation complete
  useEffect(() => {
    unsubCompleteRef.current = window.api.onLocalLlmComplete(
      (event: LocalLlmCompleteEvent) => {
        if (event.requestId === activeRequestIdRef.current) {
          setGenerating(false);
          setTokensPerSecond(event.result.tokensPerSecond);
          setStreamedText(event.result.text);
          activeRequestIdRef.current = null;
          resolveGenerationRef.current?.(event.result);
          resolveGenerationRef.current = null;
        }
      },
    );
    return () => { unsubCompleteRef.current?.(); };
  }, []);

  const activeDownloadCount = Object.keys(downloads).length;

  const downloadModel = useCallback(
    async (modelId: string) => {
      if (downloads[modelId]) return; // already downloading

      setDownloads((prev) => ({
        ...prev,
        [modelId]: { progress: 0, speedBps: 0, etaSeconds: -1, status: 'queued', error: null },
      }));
      setDownloadError(null);

      try {
        const result = await window.api.localLlmModelDownload({ modelId });
        if (!result.success) {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          setDownloadError(result.error || 'Download failed');
        }
      } catch (err) {
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
        setDownloadError(err instanceof Error ? err.message : 'Download failed');
      }
    },
    [downloads],
  );

  const pauseDownload = useCallback(async (modelId: string) => {
    await window.api.downloadPause({ id: `llm-model-${modelId}` });
  }, []);

  const resumeDownload = useCallback(async (modelId: string) => {
    await window.api.downloadResume({ id: `llm-model-${modelId}` });
  }, []);

  const cancelDownload = useCallback(async (modelId: string) => {
    await window.api.downloadCancel({ id: `llm-model-${modelId}` });
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      const result = await window.api.localLlmModelDelete({ modelId });
      if (result.success) {
        setModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, downloaded: false } : m)),
        );
        if (activeModelId === modelId) {
          setActiveModelId(null);
        }
      }
    } catch {
      // ignore
    }
  }, [activeModelId]);

  const loadModel = useCallback(async (modelId: string) => {
    try {
      setModelLoading(true);
      const result = await window.api.localLlmLoadModel({ modelId });
      if (result.success) {
        setActiveModelId(modelId);
      }
      return result;
    } finally {
      setModelLoading(false);
    }
  }, []);

  const unloadModel = useCallback(async () => {
    try {
      const result = await window.api.localLlmUnloadModel();
      if (result.success) {
        setActiveModelId(null);
      }
      return result;
    } catch {
      return { success: false, error: 'Failed to unload model' };
    }
  }, []);

  const generate = useCallback(
    async (prompt: string, params?: {
      temperature?: number;
      topP?: number;
      topK?: number;
      maxTokens?: number;
      stream?: boolean;
    }) => {
      const shouldStream = params?.stream !== false;
      setGenerating(true);
      setStreamedText('');
      setTokensPerSecond(0);

      if (shouldStream) {
        const result = await window.api.localLlmGenerate({
          prompt,
          stream: true,
          temperature: params?.temperature,
          topP: params?.topP,
          topK: params?.topK,
          maxTokens: params?.maxTokens,
        });

        if (!result.success) {
          setGenerating(false);
          return result;
        }

        activeRequestIdRef.current = result.requestId ?? null;

        return new Promise<{ success: boolean; result?: { text: string; tokensGenerated: number; tokensPerSecond: number; stopReason: string } }>((resolve) => {
          resolveGenerationRef.current = (genResult) => {
            resolve({ success: true, result: genResult });
          };
        });
      }

      // Non-streaming
      try {
        const result = await window.api.localLlmGenerate({
          prompt,
          stream: false,
          temperature: params?.temperature,
          topP: params?.topP,
          topK: params?.topK,
          maxTokens: params?.maxTokens,
        });
        if (result.result) {
          setStreamedText(result.result.text);
          setTokensPerSecond(result.result.tokensPerSecond);
        }
        return result;
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  const chat = useCallback(
    async (
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      sessionId?: string,
      params?: { temperature?: number; maxTokens?: number; stream?: boolean },
    ) => {
      const shouldStream = params?.stream !== false;
      setGenerating(true);
      setStreamedText('');
      setTokensPerSecond(0);

      if (shouldStream) {
        const result = await window.api.localLlmChat({
          messages,
          sessionId,
          stream: true,
          temperature: params?.temperature,
          maxTokens: params?.maxTokens,
        });

        if (!result.success) {
          setGenerating(false);
          return result;
        }

        activeRequestIdRef.current = result.requestId ?? null;

        return new Promise<{ success: boolean; sessionId?: string; result?: { text: string; tokensGenerated: number; tokensPerSecond: number; stopReason: string; sessionId?: string } }>((resolve) => {
          resolveGenerationRef.current = (genResult) => {
            resolve({ success: true, sessionId: genResult.sessionId, result: genResult });
          };
        });
      }

      try {
        const result = await window.api.localLlmChat({
          messages,
          sessionId,
          stream: false,
          temperature: params?.temperature,
          maxTokens: params?.maxTokens,
        });
        if (result.result) {
          setStreamedText(result.result.text);
          setTokensPerSecond(result.result.tokensPerSecond);
        }
        return result;
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  const cancel = useCallback(async () => {
    await window.api.localLlmCancel();
  }, []);

  return {
    models,
    loading,
    available,
    activeModelId,
    gpuInfo,
    downloads,
    activeDownloadCount,
    downloadError,
    modelLoading,
    generating,
    streamedText,
    tokensPerSecond,
    downloadModel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteModel,
    loadModel,
    unloadModel,
    generate,
    chat,
    cancel,
    clearDownloadError: () => setDownloadError(null),
    reload: loadModels,
  };
}
