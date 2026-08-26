import { useCallback, useEffect, useState } from 'react';
import type { ContentSafetyStatusResponse } from '@shared/ipc/types';

/**
 * Status + local blocked counters for the Content Safety page. Re-polls on
 * window focus (the screen stays mounted, and blocks can happen while the
 * user is elsewhere in the app).
 */
export function useContentSafetyStatus() {
  const [status, setStatus] = useState<ContentSafetyStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await window.api.contentSafetyStatus());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Content Safety status');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  return { status, error, refresh };
}
