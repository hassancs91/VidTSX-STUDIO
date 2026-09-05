import { useState, useEffect, useCallback } from 'react';
import type { SystemInfoGetResponse } from '../../../shared/ipc/types';

/**
 * System tab hardware / engine snapshot. The PyTorch wheel download that used to live
 * here was replaced by the downloadable AI runtime (useAiRuntime + AiRuntimeRow).
 */
export function useSystemInfo() {
  const [data, setData] = useState<SystemInfoGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setData(await window.api.systemInfoGet());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
