import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderHistoryEntry } from '@shared/ipc/types';

function normalize(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

interface RenderHistoryState {
  renderedPaths: Set<string>;
  entries: RenderHistoryEntry[];
  reload: () => void;
}

export function useRenderHistory(): RenderHistoryState {
  const [renderedPaths, setRenderedPaths] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<RenderHistoryEntry[]>([]);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    const { entries: loaded } = await window.api.renderHistoryLoad();
    if (cancelledRef.current) return;
    const existing = loaded.filter((e) => e.exists);
    setEntries(existing);
    setRenderedPaths(new Set(existing.map((e) => normalize(e.filePath))));
  }, []);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  useEffect(() => {
    cancelledRef.current = false;
    void load();

    const unsubscribe = window.api.onRenderComplete((event) => {
      if (event.success) {
        setTimeout(() => void load(), 50);
      }
    });

    return () => {
      cancelledRef.current = true;
      unsubscribe();
    };
  }, [load]);

  return { renderedPaths, entries, reload };
}
