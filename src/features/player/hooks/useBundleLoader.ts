import { useState, useCallback, useEffect, useRef } from 'react';
import type { CompositionMetadata } from '@shared/ipc/types';

export type BundleStatus = 'idle' | 'loading' | 'success' | 'error';

export interface BundleState {
  status: BundleStatus;
  progress: number;
  serveUrl: string | null;
  compositions: CompositionMetadata[];
  selectedComposition: CompositionMetadata | null;
  error: string | null;
  cached: boolean;
}

const initialState: BundleState = {
  status: 'idle',
  progress: 0,
  serveUrl: null,
  compositions: [],
  selectedComposition: null,
  error: null,
  cached: false,
};

export function useBundleLoader() {
  const [state, setState] = useState<BundleState>(initialState);
  const currentFileRef = useRef<string | null>(null);

  // Listen for progress events
  useEffect(() => {
    const unsubscribe = window.api.onBundleProgress((data) => {
      if (data.filePath === currentFileRef.current) {
        setState((prev) => ({ ...prev, progress: data.percent }));
      }
    });
    return unsubscribe;
  }, []);

  const loadBundle = useCallback(async (filePath: string) => {
    // Only bundle .tsx files
    if (!filePath.endsWith('.tsx')) {
      setState({
        ...initialState,
        status: 'error',
        error: 'Only .tsx files can be previewed',
      });
      return;
    }

    currentFileRef.current = filePath;

    setState({
      status: 'loading',
      progress: 0,
      serveUrl: null,
      compositions: [],
      selectedComposition: null,
      error: null,
      cached: false,
    });

    try {
      const result = await window.api.bundleCreate({ filePath });

      // Check if this is still the current file (user might have switched)
      if (filePath !== currentFileRef.current) {
        return;
      }

      if (result.success && result.serveUrl) {
        const compositions = result.compositions ?? [];
        setState({
          status: 'success',
          progress: 100,
          serveUrl: result.serveUrl,
          compositions,
          selectedComposition: compositions[0] ?? null,
          error: null,
          cached: result.cached ?? false,
        });
      } else {
        setState({
          status: 'error',
          progress: 0,
          serveUrl: null,
          compositions: [],
          selectedComposition: null,
          error: result.error ?? 'Failed to bundle composition',
          cached: false,
        });
      }
    } catch (err) {
      // Check if this is still the current file
      if (filePath !== currentFileRef.current) {
        return;
      }

      setState({
        status: 'error',
        progress: 0,
        serveUrl: null,
        compositions: [],
        selectedComposition: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        cached: false,
      });
    }
  }, []);

  const selectComposition = useCallback((compositionId: string) => {
    setState((prev) => ({
      ...prev,
      selectedComposition: prev.compositions.find((c) => c.id === compositionId) ?? null,
    }));
  }, []);

  const reset = useCallback(() => {
    currentFileRef.current = null;
    setState(initialState);
  }, []);

  return {
    ...state,
    loadBundle,
    selectComposition,
    reset,
  };
}
