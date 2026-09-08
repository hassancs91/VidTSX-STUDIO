import { useCallback, useState } from 'react';
import type { StudioMemory } from '@shared/types/studio-memory';
import type { MemorySaveRequest } from '@shared/ipc/types';

export interface UseAgentMemoryResult {
  memories: StudioMemory[];
  loading: boolean;
  /** Store-level failure (cap hit, bad text, unreadable file) — shown in the
   *  dialog, cleared on the next successful mutation. */
  error: string | null;
  refresh: () => Promise<void>;
  /** Returns true on success so forms can close; on failure the error is set
   *  and the form stays open. */
  save: (input: MemorySaveRequest) => Promise<boolean>;
  toggleActive: (memory: StudioMemory) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

/** Memory dialog state (G5): list, save, toggle, delete over the memory IPC
 *  surface. The agent reads the store fresh every turn in main, so a
 *  mutation here steers the very next assistant turn with no extra wiring. */
export function useAgentMemory(): UseAgentMemoryResult {
  const [memories, setMemories] = useState<StudioMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.memoryList();
      if (res.success && res.memories) {
        setMemories(res.memories);
      } else {
        setError(res.error ?? 'Failed to load memories');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (input: MemorySaveRequest): Promise<boolean> => {
    const res = await window.api.memorySave(input);
    if (!res.success || !res.memory) {
      setError(res.error ?? 'Failed to save the memory');
      return false;
    }
    const saved = res.memory;
    setError(null);
    setMemories((prev) =>
      prev.some((m) => m.id === saved.id)
        ? prev.map((m) => (m.id === saved.id ? saved : m))
        : [...prev, saved],
    );
    return true;
  }, []);

  const toggleActive = useCallback(async (memory: StudioMemory) => {
    const res = await window.api.memorySetActive({ id: memory.id, active: !memory.active });
    if (!res.success || !res.memory) {
      setError(res.error ?? 'Failed to update the memory');
      return;
    }
    const saved = res.memory;
    setError(null);
    setMemories((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await window.api.memoryDelete({ id });
    if (!res.success) {
      setError(res.error ?? 'Failed to delete the memory');
      return;
    }
    setError(null);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { memories, loading, error, refresh, save, toggleActive, remove, clearError };
}
