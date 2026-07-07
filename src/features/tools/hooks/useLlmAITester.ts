import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  LocalLlmModelIpc,
  LocalLlmTokenEvent,
  LocalLlmCompleteEvent,
} from '../../../shared/ipc/types';

export function useLlmAITester() {
  const [models, setModels] = useState<LocalLlmModelIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [tokensGenerated, setTokensGenerated] = useState(0);
  const [tokensPerSecond, setTokensPerSecond] = useState(0);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRequestIdRef = useRef<string | null>(null);
  const unsubTokenRef = useRef<(() => void) | null>(null);
  const unsubCompleteRef = useRef<(() => void) | null>(null);

  // Load models and status
  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const [status, modelsList] = await Promise.all([
        window.api.localLlmStatus(),
        window.api.localLlmModelsList(),
      ]);
      setAvailable(status.available);
      setActiveModelId(status.activeModelId);

      const downloaded = modelsList.models.filter((m) => m.downloaded);
      setModels(downloaded);

      // Auto-select active model or first downloaded
      if (status.activeModelId && downloaded.some((m) => m.id === status.activeModelId)) {
        setSelectedModelId(status.activeModelId);
      } else if (downloaded.length > 0 && !selectedModelId) {
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

  // Subscribe to completion
  useEffect(() => {
    unsubCompleteRef.current = window.api.onLocalLlmComplete(
      (event: LocalLlmCompleteEvent) => {
        if (event.requestId === activeRequestIdRef.current) {
          setGenerating(false);
          setStreamedText(event.result.text);
          setTokensGenerated(event.result.tokensGenerated);
          setTokensPerSecond(event.result.tokensPerSecond);
          setStopReason(event.result.stopReason);
          activeRequestIdRef.current = null;
        }
      },
    );
    return () => { unsubCompleteRef.current?.(); };
  }, []);

  // Load model into memory
  const loadModel = useCallback(async (modelId: string) => {
    try {
      setModelLoading(true);
      setError(null);
      const result = await window.api.localLlmLoadModel({ modelId });
      if (result.success) {
        setActiveModelId(modelId);
      } else {
        setError(result.error ?? 'Failed to load model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setModelLoading(false);
    }
  }, []);

  // Generate completion (streaming)
  const generate = useCallback(async (
    prompt: string,
    params?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
    },
  ) => {
    if (!selectedModelId) return;

    // Auto-load model if not active
    if (activeModelId !== selectedModelId) {
      setModelLoading(true);
      setError(null);
      try {
        const loadResult = await window.api.localLlmLoadModel({ modelId: selectedModelId });
        if (!loadResult.success) {
          setError(loadResult.error ?? 'Failed to load model');
          setModelLoading(false);
          return;
        }
        setActiveModelId(selectedModelId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setModelLoading(false);
        return;
      } finally {
        setModelLoading(false);
      }
    }

    setGenerating(true);
    setStreamedText('');
    setTokensGenerated(0);
    setTokensPerSecond(0);
    setStopReason(null);
    setError(null);

    try {
      const result = await window.api.localLlmGenerate({
        prompt,
        stream: true,
        temperature: params?.temperature,
        maxTokens: params?.maxTokens,
        topP: params?.topP,
        topK: params?.topK,
      });

      if (!result.success) {
        setGenerating(false);
        setError(result.error ?? 'Generation failed');
        return;
      }

      activeRequestIdRef.current = result.requestId ?? null;
    } catch (err) {
      setGenerating(false);
      setError(err instanceof Error ? err.message : 'Generation failed');
    }
  }, [selectedModelId, activeModelId]);

  // Chat (streaming)
  const chat = useCallback(async (
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    params?: {
      temperature?: number;
      maxTokens?: number;
    },
  ) => {
    if (!selectedModelId) return;

    // Auto-load model if not active
    if (activeModelId !== selectedModelId) {
      setModelLoading(true);
      setError(null);
      try {
        const loadResult = await window.api.localLlmLoadModel({ modelId: selectedModelId });
        if (!loadResult.success) {
          setError(loadResult.error ?? 'Failed to load model');
          setModelLoading(false);
          return;
        }
        setActiveModelId(selectedModelId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setModelLoading(false);
        return;
      } finally {
        setModelLoading(false);
      }
    }

    setGenerating(true);
    setStreamedText('');
    setTokensGenerated(0);
    setTokensPerSecond(0);
    setStopReason(null);
    setError(null);

    try {
      const result = await window.api.localLlmChat({
        messages,
        stream: true,
        temperature: params?.temperature,
        maxTokens: params?.maxTokens,
      });

      if (!result.success) {
        setGenerating(false);
        setError(result.error ?? 'Chat failed');
        return;
      }

      activeRequestIdRef.current = result.requestId ?? null;
    } catch (err) {
      setGenerating(false);
      setError(err instanceof Error ? err.message : 'Chat failed');
    }
  }, [selectedModelId, activeModelId]);

  const cancel = useCallback(async () => {
    await window.api.localLlmCancel();
  }, []);

  return {
    models,
    loading,
    available,
    activeModelId,
    selectedModelId,
    setSelectedModelId,
    modelLoading,
    generating,
    streamedText,
    tokensGenerated,
    tokensPerSecond,
    stopReason,
    error,
    loadModel,
    generate,
    chat,
    cancel,
  };
}
