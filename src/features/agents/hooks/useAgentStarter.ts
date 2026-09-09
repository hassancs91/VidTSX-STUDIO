// Which session is open, and how a new one begins (agents plan §1.8, §1.9).
//
// The rule that shapes this hook: **the starter runs BEFORE the session
// exists.** `AGENT_SESSION_CREATE` already takes `starter`, so the answers are
// written together with the session in one call — no patch channel — and a user
// who backs out of the questions leaves no empty session folder behind. It also
// lets the answers NAME the session, which matters more than a label: §1.11
// fixes the library folder from the title at creation and never moves it.
//
// Everything here is orchestration the workspace would otherwise carry inline.

import { useCallback, useEffect, useState } from 'react';
import type { StarterAnswers } from '@shared/types/agents';
import { renderOpening, type StarterTree } from '@shared/agents/starter';
import { isEmptyStarterAnswers, starterTitle } from '../services/starter-cards';
import type { useAgentSessions } from './useAgentSessions';
import type { useAgentProviders } from './useAgentProviders';

/** Text dropped into the chat box, never sent. The token lets the same text be
 *  prefilled twice — one quick start, edited, clicked again. */
export interface ChatPrefill {
  text: string;
  token: number;
}

interface Input {
  starterTree: StarterTree | undefined;
  sessions: ReturnType<typeof useAgentSessions>;
  providers: ReturnType<typeof useAgentProviders>;
  /** W4: the library default brand, once known — the picker's initial value. */
  defaultBrandId?: string | undefined;
}

export function useAgentStarter({ starterTree, sessions, providers, defaultBrandId }: Input) {
  const { sessions: rows, loaded: sessionsLoaded, create } = sessions;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<ChatPrefill | null>(null);
  /** The brand the NEXT session is created with (W4). `undefined` = the
   *  user has not touched the picker, so main applies the library default. */
  const [pickedBrandId, setPickedBrandId] = useState<string | null | undefined>(undefined);
  const starterBrandId = pickedBrandId === undefined ? (defaultBrandId ?? null) : pickedBrandId;

  // Open the most recent session, or begin one — but only once a provider
  // exists (§1.8), so a machine with none never accumulates empty sessions.
  useEffect(() => {
    if (!providers.loaded || !providers.usable || !sessionsLoaded || sessionId || starterOpen) {
      return;
    }
    if (rows.length > 0) {
      setSessionId(rows[0].id);
      return;
    }
    // §1.9: a new session with a starter asks its questions first. Without one
    // there is nothing to ask, so the session is created straight away.
    if (starterTree) {
      setStarterOpen(true);
      return;
    }
    void create({
      ...(providers.providerId ? { providerId: providers.providerId } : {}),
      ...(providers.model ? { model: providers.model } : {}),
    }).then(
      (session) => {
        if (session) setSessionId(session.id);
      },
    );
  }, [
    providers.loaded,
    providers.usable,
    providers.providerId,
    providers.model,
    sessionsLoaded,
    rows,
    sessionId,
    starterOpen,
    starterTree,
    create,
  ]);

  const startSession = useCallback(
    async (starter?: StarterAnswers): Promise<string | null> => {
      setCreating(true);
      try {
        const title = starter ? starterTitle(starter) : undefined;
        const session = await create({
          ...(providers.providerId ? { providerId: providers.providerId } : {}),
          ...(providers.model ? { model: providers.model } : {}),
          ...(starter && !isEmptyStarterAnswers(starter) ? { starter } : {}),
          ...(title ? { title } : {}),
          ...(pickedBrandId !== undefined ? { brandId: pickedBrandId } : {}),
        });
        setStarterOpen(false);
        if (!session) return null;
        setSessionId(session.id);
        return session.id;
      } finally {
        setCreating(false);
      }
    },
    [create, providers.providerId, providers.model, pickedBrandId],
  );

  /** New session / Start over (§1.7): with a starter, that means the tree again. */
  const newSession = useCallback(async () => {
    setPrefill(null);
    if (starterTree) {
      setSessionId(null);
      setStarterOpen(true);
      return;
    }
    await startSession();
  }, [starterTree, startSession]);

  /** The tree finished, or the user pressed "Skip and chat" partway through.
   *  Either way the answers so far reach the prompt, and the rendered `opening`
   *  PREFILLS the box rather than being sent. */
  const finishStarter = useCallback(
    async (answers: StarterAnswers) => {
      const created = await startSession(answers);
      if (!created || !starterTree) return;
      const opening = renderOpening(starterTree, answers);
      if (opening) setPrefill({ text: opening, token: Date.now() });
    },
    [startSession, starterTree],
  );

  /** A quick start is its own brief, so it carries no starter answers. */
  const useQuickStart = useCallback(
    async (prompt: string) => {
      if (!sessionId) {
        const created = await startSession();
        if (!created) return;
      }
      setPrefill({ text: prompt, token: Date.now() });
    },
    [sessionId, startSession],
  );

  return {
    sessionId,
    setSessionId,
    starterOpen,
    creating,
    prefill,
    newSession,
    finishStarter,
    useQuickStart,
    /** W4: the starter's brand picker value and setter. */
    starterBrandId,
    setStarterBrandId: setPickedBrandId,
  };
}
