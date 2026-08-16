import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryDescribeJobEvent } from '@shared/ipc/types';
import type { LibraryDescribeAvailability, LibraryPrefs } from '@shared/types/asset-library';

/** Per-asset state while a batch runs; absent = not part of this batch. */
export type DescribeItemState =
  | { status: 'queued' | 'describing' }
  | { status: 'ready'; description: string }
  | { status: 'failed'; error: string };

export interface DescribeBatchState {
  running: boolean;
  done: number;
  total: number;
  /** Set when a batch finished — cleared on the next start. */
  summary: { succeeded: number; failed: number; canceled: boolean } | null;
}

const IDLE_BATCH: DescribeBatchState = { running: false, done: 0, total: 0, summary: null };

interface UseLibraryDescribeResult {
  availability: LibraryDescribeAvailability | null;
  prefs: LibraryPrefs | null;
  batch: DescribeBatchState;
  itemState: Map<string, DescribeItemState>;
  /** True until the first availability probe answers. */
  loading: boolean;
  /** Re-probe — the screen never unmounts, so this is the only way back. */
  refreshAvailability: () => Promise<void>;
  grantConsent: () => Promise<void>;
  dismissNote: () => Promise<void>;
  setAutoDescribeOnImport: (enabled: boolean) => Promise<void>;
  /** Returns an error string, or null when the batch started. */
  startBatch: (relPaths: string[]) => Promise<string | null>;
  cancelBatch: () => Promise<void>;
}

/**
 * AI descriptions in the Assets screen (ASSET_LIBRARY_DESIGN.md L2):
 * availability, the one-time consent, and the batch job's event stream.
 *
 * Availability is asked for once per mount and re-asked after consent — the
 * unavailable answer is a first-class state here, not an error (L2 Rev 3):
 * with no provider the UI shows a dismissible note and manual descriptions
 * carry on working exactly as they did before.
 *
 * `onDescribed` fires per successful item so the caller can fold the new
 * description into the index it already holds, instead of re-scanning the
 * whole library once per asset.
 */
export function useLibraryDescribe(
  onDescribed?: (relPath: string, description: string) => void,
): UseLibraryDescribeResult {
  const [availability, setAvailability] = useState<LibraryDescribeAvailability | null>(null);
  const [prefs, setPrefs] = useState<LibraryPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<DescribeBatchState>(IDLE_BATCH);
  const [itemState, setItemState] = useState<Map<string, DescribeItemState>>(new Map());
  const describedRef = useRef(onDescribed);
  describedRef.current = onDescribed;

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.libraryDescribeAvailability();
      if (res.success && res.availability) {
        setAvailability(res.availability);
        setPrefs(res.prefs ?? null);
      }
    } catch {
      // Leave the last-known answer; describing simply stays unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  // Probed on mount — but the Assets screen never unmounts (every visited
  // screen stays mounted), so a provider configured later in Settings would
  // otherwise leave this stale until a restart. Re-probe when the window
  // regains focus, and let the caller re-probe on Refresh.
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // The batch stream. Subscribed for the screen's lifetime so a batch
  // started before navigating away still lands its results.
  useEffect(() => {
    const setItem = (relPath: string, state: DescribeItemState) =>
      setItemState((prev) => new Map(prev).set(relPath, state));

    const unsubscribe = window.api.onLibraryDescribeEvent((event: LibraryDescribeJobEvent) => {
      if (event.status === 'batch-done' || event.status === 'batch-canceled') {
        setBatch({
          running: false,
          done: event.done,
          total: event.total,
          summary: {
            succeeded: event.succeeded ?? 0,
            failed: event.failed ?? 0,
            canceled: event.status === 'batch-canceled',
          },
        });
        return;
      }
      setBatch((prev) => ({ ...prev, running: true, done: event.done, total: event.total }));
      if (event.status === 'ready') {
        const description = event.description ?? '';
        setItem(event.relPath, { status: 'ready', description });
        describedRef.current?.(event.relPath, description);
      } else if (event.status === 'failed') {
        setItem(event.relPath, { status: 'failed', error: event.error ?? 'Describe failed' });
      } else {
        setItem(event.relPath, { status: event.status });
      }
    });
    return unsubscribe;
  }, []);

  const grantConsent = useCallback(async () => {
    const res = await window.api.libraryPrefsSet({ grantDescribeConsent: true });
    if (res.success && res.prefs) setPrefs(res.prefs);
  }, []);

  const dismissNote = useCallback(async () => {
    const res = await window.api.libraryPrefsSet({ noProviderNoteDismissed: true });
    if (res.success && res.prefs) setPrefs(res.prefs);
  }, []);

  const setAutoDescribeOnImport = useCallback(async (enabled: boolean) => {
    const res = await window.api.libraryPrefsSet({ autoDescribeOnImport: enabled });
    if (res.success && res.prefs) setPrefs(res.prefs);
  }, []);

  const startBatch = useCallback(async (relPaths: string[]): Promise<string | null> => {
    setItemState(new Map());
    setBatch({ running: true, done: 0, total: relPaths.length, summary: null });
    try {
      const res = await window.api.libraryDescribeStart({ relPaths });
      if (!res.success) {
        setBatch(IDLE_BATCH);
        return res.error ?? 'Could not start the describe batch';
      }
      setBatch({ running: true, done: 0, total: res.total ?? relPaths.length, summary: null });
      return null;
    } catch (err) {
      setBatch(IDLE_BATCH);
      return err instanceof Error ? err.message : String(err);
    }
  }, []);

  const cancelBatch = useCallback(async () => {
    await window.api.libraryDescribeCancel();
  }, []);

  return {
    availability,
    prefs,
    batch,
    itemState,
    loading,
    refreshAvailability: refresh,
    grantConsent,
    dismissNote,
    setAutoDescribeOnImport,
    startBatch,
    cancelBatch,
  };
}
