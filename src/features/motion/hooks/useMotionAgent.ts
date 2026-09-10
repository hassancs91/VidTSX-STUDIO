// The Creator's Agent mode (V1 completion plan §2.7, W7): one session of the
// built-in `vidtsx/tsx-composer`, bound to the panel's pickers and to the
// Motion project the main-process sink writes into.
//
// What is different from the Agents workspace, and why:
//
//   * There is no starter and no session list. Entering Agent mode reopens
//     the newest session that HAS the sink (`motionSink`), or creates one —
//     sessions started from the Agents page for the same agent are left
//     alone, because their compositions were never meant for the Creator.
//   * Brand, provider and model are the PANEL's. A new session is created
//     with them; opening an old one hands its own back (`onRestore`) so the
//     pickers show what the session actually generates under; after that a
//     brand change patches the open session (W4's `AGENT_SESSION_BRAND_SET`),
//     and provider + model travel per turn as the run hook already sends them.
//   * A composition the sink mirrored carries `payload.motion`; the newest one
//     is handed to the Creator to load, so the preview and the Render button
//     see agent output exactly as they see prompt-mode output.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentJobRequest, InstalledAgent } from '@shared/types/agents';
import { useAgentMemoryProposals } from '@renderer/hooks/agents/useAgentMemoryProposals';
import { useAgentRenderBridge } from '@renderer/hooks/agents/useAgentRenderBridge';
import { useAgentRun } from '@renderer/hooks/agents/useAgentRun';
import { useAgentSessions } from '@renderer/hooks/agents/useAgentSessions';

export const TSX_COMPOSER_AGENT_ID = 'vidtsx/tsx-composer';

export interface MotionAgentRestore {
  providerId?: string;
  model?: string;
  /** '' = no brand. */
  brandId: string;
}

interface Input {
  /** False until the user first opens Agent mode; nothing is created before. */
  enabled: boolean;
  providerId: string;
  /** '' = the provider default. */
  model: string;
  /** '' = no brand. */
  brandId: string;
  /** A session was opened: show what it runs under. */
  onRestore: (values: MotionAgentRestore) => void;
  /** A composition landed in the Motion project: load it in the preview. */
  onVersion: (versionPath: string, folderPath: string) => void;
}

export function useMotionAgent({ enabled, providerId, model, brandId, onRestore, onVersion }: Input) {
  const agentId = TSX_COMPOSER_AGENT_ID;
  const [agent, setAgent] = useState<InstalledAgent | null>(null);
  const [agentMissing, setAgentMissing] = useState(false);
  const sessions = useAgentSessions(enabled ? agentId : null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const creating = useRef(false);
  const enqueueRef = useRef<((request: AgentJobRequest) => Promise<void>) | null>(null);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const versionRef = useRef(onVersion);
  versionRef.current = onVersion;

  // The built-in's name and description, for the empty state.
  useEffect(() => {
    if (!enabled || agent) return;
    let disposed = false;
    void window.api.agentsList().then((res) => {
      if (disposed) return;
      const found = res.success ? res.agents?.find((a) => a.manifest.id === agentId) : undefined;
      setAgent(found ?? null);
      setAgentMissing(!found);
    });
    return () => {
      disposed = true;
    };
  }, [enabled, agent, agentId]);

  const run = useAgentRun({
    agentId,
    sessionId,
    ...(providerId ? { providerId } : {}),
    model,
    onJobRequest: (request) => void enqueueRef.current?.(request),
  });
  const render = useAgentRenderBridge(agentId, sessionId, run.artifacts);
  enqueueRef.current = render.enqueue;
  const memory = useAgentMemoryProposals(agentId, sessionId);

  const { create } = sessions;
  const newSession = useCallback(async (): Promise<string | null> => {
    if (creating.current || !providerId) return null;
    creating.current = true;
    try {
      const session = await create({
        providerId,
        ...(model ? { model } : {}),
        brandId: brandId || null,
        motionSink: true,
      });
      if (!session) return null;
      setSessionId(session.id);
      return session.id;
    } finally {
      creating.current = false;
    }
  }, [create, providerId, model, brandId]);

  // Reopen the newest sink session, or begin one — once the list is known and
  // a provider exists (the Agents workspace's §1.8 rule).
  useEffect(() => {
    if (!enabled || !sessions.loaded || sessionId || !providerId || agentMissing) return;
    const newest = sessions.sessions.find((s) => s.motionSink);
    if (newest) {
      setSessionId(newest.id);
      return;
    }
    void newSession();
  }, [enabled, sessions.loaded, sessions.sessions, sessionId, providerId, agentMissing, newSession]);

  // Opening a session hands its provider, model and brand to the panel once.
  const restoredFor = useRef<string | null>(null);
  const opened = run.session;
  useEffect(() => {
    if (!opened || opened.id !== sessionId || restoredFor.current === opened.id) return;
    restoredFor.current = opened.id;
    restoreRef.current({
      ...(opened.providerId ? { providerId: opened.providerId } : {}),
      model: opened.model ?? '',
      brandId: opened.brandId ?? '',
    });
  }, [opened, sessionId]);

  // After that, the panel's brand patches the open session (W4 pattern).
  const { patchSession } = run;
  useEffect(() => {
    if (!opened || opened.id !== sessionId || restoredFor.current !== opened.id) return;
    if ((opened.brandId ?? '') === brandId) return;
    void window.api
      .agentSessionBrandSet({ agentId, sessionId: opened.id, brandId: brandId || null })
      .then((res) => {
        if (res.success) patchSession({ brandId: brandId || undefined });
      });
  }, [brandId, opened, sessionId, agentId, patchSession]);

  // Compositions the sink mirrored: on open only the newest is loaded (the
  // user comes back to where they were); live, every new one is.
  const seen = useRef(new Set<string>());
  const seenSession = useRef<string | null>(null);
  useEffect(() => {
    if (seenSession.current !== sessionId) {
      seenSession.current = sessionId;
      seen.current = new Set();
    }
    const fresh = run.artifacts.filter(
      (a) => a.kind === 'composition' && a.payload.motion && !seen.current.has(a.id),
    );
    for (const a of fresh) seen.current.add(a.id);
    const newest = fresh[fresh.length - 1];
    if (newest && newest.kind === 'composition' && newest.payload.motion) {
      versionRef.current(newest.payload.motion.versionPath, newest.payload.motion.folderPath);
    }
  }, [run.artifacts, sessionId]);

  return { agent, agentMissing, sessionId, run, render, memory, newSession };
}
