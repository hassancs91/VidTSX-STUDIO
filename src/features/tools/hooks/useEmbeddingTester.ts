import { useState, useEffect, useCallback } from 'react';
import type { EmbeddingModelIpc } from '../../../shared/ipc/types';

export interface EmbedResultEntry {
  text: string;
  embedding: number[];
  dimensions: number;
}

export function useEmbeddingTester() {
  const [models, setModels] = useState<EmbeddingModelIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [results, setResults] = useState<EmbedResultEntry[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load downloaded models on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await window.api.embeddingModelsList();
        const downloaded = res.models.filter((m) => m.downloaded);
        setModels(downloaded);
        if (downloaded.length > 0 && !selectedModelId) {
          setSelectedModelId(downloaded[0].id);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadModel = useCallback(async (modelId: string) => {
    setModelLoading(true);
    setError(null);
    try {
      // Unload previous model if different
      if (activeModelId && activeModelId !== modelId) {
        await window.api.embeddingUnloadModel();
      }
      const res = await window.api.embeddingLoadModel({ modelId });
      if (!res.success) {
        setError(res.error || 'Failed to load model');
        return false;
      }
      setActiveModelId(modelId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
      return false;
    } finally {
      setModelLoading(false);
    }
  }, [activeModelId]);

  const embed = useCallback(async (texts: string[]) => {
    if (!selectedModelId) return;
    setError(null);
    setEmbedding(true);
    setResults([]);
    setLatencyMs(null);

    try {
      // Auto-load model if needed
      if (activeModelId !== selectedModelId) {
        const loaded = await loadModel(selectedModelId);
        if (!loaded) {
          setEmbedding(false);
          return;
        }
      }

      const start = performance.now();
      const res = await window.api.embeddingEmbed({ texts, normalize: true });
      const elapsed = Math.round(performance.now() - start);

      if (!res.success || !res.embeddings) {
        setError(res.error || 'Embedding failed');
        setEmbedding(false);
        return;
      }

      setLatencyMs(elapsed);
      setResults(
        texts.map((text, i) => ({
          text,
          embedding: res.embeddings![i],
          dimensions: res.dimensions!,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Embedding failed');
    } finally {
      setEmbedding(false);
    }
  }, [selectedModelId, activeModelId, loadModel]);

  const unloadModel = useCallback(async () => {
    try {
      await window.api.embeddingUnloadModel();
      setActiveModelId(null);
    } catch {
      // ignore
    }
  }, []);

  return {
    models,
    loading,
    selectedModelId,
    setSelectedModelId,
    activeModelId,
    modelLoading,
    embedding,
    results,
    latencyMs,
    error,
    embed,
    loadModel,
    unloadModel,
    clearError: () => setError(null),
    clearResults: () => { setResults([]); setLatencyMs(null); },
  };
}
