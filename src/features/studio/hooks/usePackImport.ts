// Importing pack packages in the renderer (TRANSITION_PACKS_DESIGN.md P5,
// FILTER_PACKS_DESIGN.md P5): the double-click claim, and the signals that
// an installed set changed — one per list, so each tab re-scans its own.

import { useEffect, useState } from 'react';
import type { PackItemType } from '@shared/studio/pack-package';
import { FILTERS_CHANGED_EVENT } from './useFilters';

/** Fired after an install; every `useTransitionList` re-scans on it. */
export const TRANSITIONS_CHANGED_EVENT = 'vidtsx:transitions-changed';

export function announceTransitionsChanged(): void {
  window.dispatchEvent(new Event(TRANSITIONS_CHANGED_EVENT));
}

export function announceFiltersChanged(): void {
  window.dispatchEvent(new Event(FILTERS_CHANGED_EVENT));
}

/** Tell the lists an install touched. */
export function announcePacksChanged(types: readonly PackItemType[]): void {
  if (types.includes('transition')) announceTransitionsChanged();
  if (types.includes('filter')) announceFiltersChanged();
}

/**
 * A double-clicked `.vidtsxpack` / `.vidtsxtransition` / `.vidtsxfilter`.
 * Main parks the path and pushes a nudge (App puts the Studio screen on); this
 * claims on mount AND on the nudge, because the app can start straight into
 * any screen.
 */
export function usePendingPackPackage(): [string | null, (filePath: string | null) => void] {
  const [filePath, setFilePath] = useState<string | null>(null);
  useEffect(() => {
    const claim = async (): Promise<void> => {
      const result = await window.api.studioPackPackagePending();
      if (result.filePath) setFilePath(result.filePath);
    };
    void claim();
    return window.api.onStudioPackPackageOpenFile(() => void claim());
  }, []);
  return [filePath, setFilePath];
}
