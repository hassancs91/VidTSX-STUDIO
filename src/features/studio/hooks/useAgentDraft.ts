import { useCallback, useEffect, useState } from 'react';
import { readAgentDraft, writeAgentDraft } from '../services/agent-draft-store';

/**
 * The assistant composer's draft, kept across panel unmounts and reloads
 * (see `agent-draft-store.ts`). Reads the stored text on mount and on a
 * project change; every edit writes through, and `clear()` (on send) removes
 * the entry.
 */
export function useAgentDraft(projectId: string): {
  draft: string;
  setDraft: (text: string) => void;
  clear: () => void;
} {
  const [draft, setDraftState] = useState(() => readAgentDraft(projectId));

  useEffect(() => {
    setDraftState(readAgentDraft(projectId));
  }, [projectId]);

  const setDraft = useCallback(
    (text: string) => {
      setDraftState(text);
      writeAgentDraft(projectId, text);
    },
    [projectId],
  );

  const clear = useCallback(() => setDraft(''), [setDraft]);

  return { draft, setDraft, clear };
}
