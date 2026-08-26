import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageCliProviderStatus } from '@shared/ipc/types';

export interface GeminiCliStatusState {
  /** null until the first probe answers. */
  status: ImageCliProviderStatus | null;
  loading: boolean;
  /** Fresh probe (the "Check again" button). */
  refresh: () => Promise<void>;
}

/**
 * Detection + auth status for the Antigravity CLI (Google subscription
 * images). Probes on mount and on window focus — the describe-availability
 * precedent: the user installs/signs in in a terminal, comes back, and the
 * card updates. When the CLI becomes ready, broadcasts the provider-change
 * event so the Image Studio provider list picks it up without a remount.
 */
export function useGeminiCliStatus(): GeminiCliStatusState {
  const [status, setStatus] = useState<ImageCliProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const wasReady = useRef<boolean | null>(null);

  const load = useCallback(async (force: boolean) => {
    try {
      const result = await window.api.imageCliStatus({ force });
      const gemini = result.success
        ? result.statuses.find((s) => s.id === 'gemini-cli') ?? null
        : null;
      setStatus(gemini);
      const ready = !!gemini && gemini.installed && gemini.authenticated;
      if (ready && wasReady.current === false) {
        window.dispatchEvent(new CustomEvent('vidtsx:image-providers-changed'));
      }
      wasReady.current = ready;
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
