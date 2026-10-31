import { useCallback, useEffect, useState } from 'react';
import type { DecisionsEvent, DecisionsSettingsSetRequest, DecisionsStatusResponse } from '@shared/ipc/types';
import { applyDecisionsPatch, loadDecisionsStatus } from '@shared/decisions-client';

export interface DecisionsSettings {
  status: DecisionsStatusResponse | null;
  error: string | null;
  saving: boolean;
  /** Sends exactly this patch (mode, hosted order or OpenRouter model); main validates it. */
  apply: (patch: DecisionsSettingsSetRequest) => Promise<void>;
}

/**
 * The Settings › General "Decisions" row's state (DECISION_MODELS_DESIGN.md §8), over the preload API only: `decisions:status`, its push
 * (`decisions:event` — a key or settings change) and `decisions:settings:set`. Has-key booleans only; no key ever reaches the renderer.
 */
export function useDecisionsSettings(): DecisionsSettings {
  const [status, setStatus] = useState<DecisionsStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const read = await loadDecisionsStatus(window.api);
      if (!live) return;
      if (read.status) setStatus(read.status);
      setError(read.error);
    })();
    const off = window.api.onDecisionsEvent((event: DecisionsEvent) => {
      if (event.type === 'status') setStatus(event.status);
    });
    return () => {
      live = false;
      off();
    };
  }, []);

  const apply = useCallback(async (patch: DecisionsSettingsSetRequest) => {
    setSaving(true);
    const read = await applyDecisionsPatch(window.api, patch);
    if (read.status) setStatus(read.status);
    setError(read.error);
    setSaving(false);
  }, []);

  return { status, error, saving, apply };
}
