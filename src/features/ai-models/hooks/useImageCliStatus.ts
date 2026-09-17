import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageCliProviderStatus } from '@shared/ipc/types';

export interface ImageCliStatusState {
  /** null until the first probe answers. */
  status: ImageCliProviderStatus | null;
  loading: boolean;
  /** Fresh probe (the "Check again" button). */
  refresh: () => Promise<void>;
}

/**
 * Detection + auth status for one CLI-bridge image provider ('gemini-cli'
 * for the Antigravity CLI, 'codex-cli' for OpenAI Codex). Probes on mount
 * and on window focus — the describe-availability precedent: the user
 * installs / signs in in a terminal, comes back, and the row updates. When
 * the CLI becomes ready, broadcasts the provider-change event so the Image
 * Studio provider list picks it up without a remount.
 */
export function useImageCliStatus(providerId: string): ImageCliStatusState {
  const [status, setStatus] = useState<ImageCliProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const wasReady = useRef<boolean | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      try {
        const result = await window.api.imageCliStatus({ force });
        const found = result.success ? (result.statuses.find((s) => s.id === providerId) ?? null) : null;
        setStatus(found);
        const ready = !!found && found.installed && found.authenticated;
        if (ready && wasReady.current === false) {
          window.dispatchEvent(new CustomEvent('vidtsx:image-providers-changed'));
        }
        wasReady.current = ready;
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
      }
    },
    [providerId],
  );

  useEffect(() => {
    void load(false);
    const onFocus = () => void load(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load(true);
  }, [load]);

  return { status, loading, refresh };
}
