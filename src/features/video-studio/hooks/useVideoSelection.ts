import { useCallback, useState } from 'react';

export function useVideoSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setLastSelectedId(ids[ids.length - 1] ?? null);
  }, []);

  const pruneToVisible = useCallback((visibleIds: string[]) => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, []);

  const toggle = useCallback(
    (id: string, additive: boolean, orderedIds: string[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (additive && lastSelectedId && lastSelectedId !== id) {
          const a = orderedIds.indexOf(lastSelectedId);
          const b = orderedIds.indexOf(id);
          if (a >= 0 && b >= 0) {
            const [start, end] = a < b ? [a, b] : [b, a];
            for (let i = start; i <= end; i++) next.add(orderedIds[i]);
            return next;
          }
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastSelectedId(id);
    },
    [lastSelectedId],
  );

  return { selectedIds, clear, selectAll, pruneToVisible, toggle };
}
