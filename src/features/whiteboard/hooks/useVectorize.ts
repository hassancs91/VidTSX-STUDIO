import { useCallback, useRef, useState } from 'react';
import {
  vectorizeRaster,
  type VectorizeConfig,
  type VectorizeResult,
} from '../services/vectorizer';

export type VectorizeStatus =
  | { status: 'idle' }
  | { status: 'tracing' }
  | { status: 'ready'; result: VectorizeResult }
  | { status: 'error'; error: string };

export interface UseVectorize {
  status: VectorizeStatus['status'];
  result?: VectorizeResult;
  error?: string;
  vectorize: (bytes: Uint8Array, config?: VectorizeConfig) => Promise<void>;
  reset: () => void;
}

/**
 * Per-instance state machine wrapping `vectorizeRaster`. No module-level
 * state — the modal owns the lifecycle. Concurrent traces (e.g. user drags
 * the threshold while a previous trace is still resolving) are de-duped by
 * a request token: only the most recent call's result is committed.
 */
export function useVectorize(): UseVectorize {
  const [state, setState] = useState<VectorizeStatus>({ status: 'idle' });
  const tokenRef = useRef(0);

  const vectorize = useCallback(
    async (bytes: Uint8Array, config?: VectorizeConfig) => {
      const token = ++tokenRef.current;
      setState({ status: 'tracing' });
      try {
        const result = await vectorizeRaster(bytes, config);
        if (token !== tokenRef.current) return;
        setState({ status: 'ready', result });
      } catch (err) {
        if (token !== tokenRef.current) return;
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    []
  );

  const reset = useCallback(() => {
    tokenRef.current++;
    setState({ status: 'idle' });
  }, []);

  if (state.status === 'ready') {
    return { status: 'ready', result: state.result, vectorize, reset };
  }
  if (state.status === 'error') {
    return { status: 'error', error: state.error, vectorize, reset };
  }
  return { status: state.status, vectorize, reset };
}
