import { useCallback, useState } from 'react';
import type { LibraryOrganizeMove, LibraryOrganizeSkip } from '@shared/ipc/types';
import { useOpenProject } from '@renderer/contexts/OpenProjectContext';

export interface OrganizePlanState {
  moves: LibraryOrganizeMove[];
  /** Excluded before review — "in use, close the project to move". */
  skipped: LibraryOrganizeSkip[];
  discarded: number;
  /** Per-move accept/reject, keyed by relPath. Everything starts accepted. */
  accepted: Set<string>;
}

export interface OrganizeApplyOutcome {
  moved: number;
  failures: Array<{ relPath: string; error: string }>;
  refused: string[];
}

interface UseLibraryOrganizeResult {
  plan: OrganizePlanState | null;
  suggesting: boolean;
  applying: boolean;
  error: string | null;
  /** The project the organize pass is treating as open, for the UI copy. */
  openProjectId: string | null;
  suggest: () => Promise<void>;
  toggle: (relPath: string) => void;
  setAllAccepted: (accepted: boolean) => void;
  /** Applies the accepted moves; returns the outcome, or null on failure. */
  apply: () => Promise<OrganizeApplyOutcome | null>;
  close: () => void;
}

/**
 * The organize review gate (ASSET_LIBRARY_DESIGN.md L7). Bulk file changes
 * get the same treatment as bulk timeline changes: nothing touches disk
 * until the user accepts it, per item.
 *
 * The open Studio project id rides along on both calls. Main is what
 * actually enforces the skip — it re-checks at apply time, because the user
 * can open a project between reviewing a plan and accepting it.
 */
export function useLibraryOrganize(onApplied?: () => void): UseLibraryOrganizeResult {
  const { openProjectId } = useOpenProject();
  const [plan, setPlan] = useState<OrganizePlanState | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    setError(null);
    try {
      const res = await window.api.libraryOrganizeSuggest({
        ...(openProjectId ? { openProjectId } : {}),
      });
      if (!res.success) {
        setError(res.error ?? 'The organize pass failed');
        return;
      }
      const moves = res.moves ?? [];
      setPlan({
        moves,
        skipped: res.skipped ?? [],
        discarded: res.discarded ?? 0,
        accepted: new Set(moves.map((m) => m.relPath)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSuggesting(false);
    }
  }, [openProjectId]);

  const toggle = useCallback((relPath: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const accepted = new Set(prev.accepted);
      if (accepted.has(relPath)) accepted.delete(relPath);
      else accepted.add(relPath);
      return { ...prev, accepted };
    });
  }, []);

  const setAllAccepted = useCallback((accept: boolean) => {
    setPlan((prev) =>
      prev ? { ...prev, accepted: new Set(accept ? prev.moves.map((m) => m.relPath) : []) } : prev,
    );
  }, []);

  const apply = useCallback(async (): Promise<OrganizeApplyOutcome | null> => {
    if (!plan) return null;
    const moves = plan.moves.filter((m) => plan.accepted.has(m.relPath));
    setApplying(true);
    setError(null);
    try {
      const res = await window.api.libraryOrganizeApply({
        moves,
        ...(openProjectId ? { openProjectId } : {}),
      });
      if (!res.success) {
        setError(res.error ?? 'Applying the moves failed');
        return null;
      }
      setPlan(null);
      onApplied?.();
      return {
        moved: res.moved ?? 0,
        failures: res.failures ?? [],
        refused: res.refused ?? [],
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setApplying(false);
    }
  }, [plan, openProjectId, onApplied]);

  const close = useCallback(() => {
    setPlan(null);
    setError(null);
  }, []);

  return {
    plan,
    suggesting,
    applying,
    error,
    openProjectId,
    suggest,
    toggle,
    setAllAccepted,
    apply,
    close,
  };
}
