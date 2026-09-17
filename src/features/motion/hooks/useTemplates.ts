import { useCallback, useEffect, useState } from 'react';
import type { TemplateIpc } from '@shared/ipc/types';

export interface UseTemplatesResult {
  templates: TemplateIpc[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** The installed templates (built-in + user). Loads once `enabled` — the first time Templates mode opens. */
export function useTemplates(enabled: boolean): UseTemplatesResult {
  const [templates, setTemplates] = useState<TemplateIpc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.templatesList();
      setTemplates(res.templates);
      setError(res.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { templates, loading, error, refresh };
}
