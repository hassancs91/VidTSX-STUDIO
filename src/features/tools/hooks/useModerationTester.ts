import { useState, useCallback } from 'react';
import type { ModerationCheckResponse } from '../../../shared/ipc/types';

export interface ModerationHistoryEntry {
  text: string;
  result: ModerationCheckResponse;
  timestamp: number;
}

export function useModerationTester() {
  const [checking, setChecking] = useState(false);
  const [lastResult, setLastResult] = useState<ModerationCheckResponse | null>(null);
  const [history, setHistory] = useState<ModerationHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setChecking(true);
    setError(null);

    try {
      const result = await window.api.moderationCheck({ text });
      setLastResult(result);
      setHistory((prev) => [
        { text, result, timestamp: Date.now() },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation check failed');
    } finally {
      setChecking(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setLastResult(null);
  }, []);

  return {
    checking,
    lastResult,
    history,
    error,
    check,
    clearHistory,
    clearError: () => setError(null),
  };
}
