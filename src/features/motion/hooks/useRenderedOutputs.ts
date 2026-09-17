import { useEffect, useMemo, useState } from 'react';
import { useRenderHistory } from '@features/render-queue';
import type { RenderHistoryEntry } from '@shared/ipc/types';

export interface RenderedOutputs {
  /** Finished renders of the file, newest first. */
  jobs: RenderHistoryEntry[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  selected: RenderHistoryEntry | null;
  /** `file://` url of the selected render; null when there is none. */
  src: string | null;
}

/** The render history of ONE source file — what the Rendered tab plays back. */
export function useRenderedOutputs(filePath: string | null): RenderedOutputs {
  const { entries } = useRenderHistory();

  const jobs = useMemo(() => {
    if (!filePath) return [];
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return entries
      .filter((e) => e.filePath.replace(/\\/g, '/').toLowerCase() === normalized)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  }, [entries, filePath]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when the file changes or a new render completes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filePath, jobs.length]);

  const selected = jobs[selectedIndex] ?? null;

  const src = useMemo(() => {
    if (!selected) return null;
    const normalized = selected.outputPath.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
  }, [selected]);

  return { jobs, selectedIndex, setSelectedIndex, selected, src };
}
