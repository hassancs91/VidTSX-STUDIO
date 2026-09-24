// Importing transition packages in the renderer (TRANSITION_PACKS_DESIGN.md
// P5): the double-click claim, and the signal that the installed set changed.

import { useEffect, useState } from 'react';

/** Fired after an install; every `useTransitionList` re-scans on it. */
export const TRANSITIONS_CHANGED_EVENT = 'vidtsx:transitions-changed';

export function announceTransitionsChanged(): void {
  window.dispatchEvent(new Event(TRANSITIONS_CHANGED_EVENT));
}

/**
 * A double-clicked `.vidtsxpack` / `.vidtsxtransition`. Main parks the path
 * and pushes a nudge (App puts the Studio screen on); this claims on mount AND
 * on the nudge, because the app can start straight into any screen.
 */
export function usePendingTransitionPackage(): [string | null, (filePath: string | null) => void] {
  const [filePath, setFilePath] = useState<string | null>(null);
  useEffect(() => {
    const claim = async (): Promise<void> => {
      const result = await window.api.studioTransitionPackagePending();
      if (result.filePath) setFilePath(result.filePath);
    };
    void claim();
    return window.api.onStudioTransitionPackageOpenFile(() => void claim());
  }, []);
  return [filePath, setFilePath];
}
