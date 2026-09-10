// The Agents screen: the gallery, or one agent's workspace (agents plan §1.7).
//
// Both halves stay in one screen component because the app mounts every visited
// screen once and keeps it mounted (docs/ui-automation-cdp.md) — so "open an
// agent" is state here, not navigation, and going back does not re-scan.

import { useCallback, useEffect, useState } from 'react';
import type { InstalledAgent } from '@shared/types/agents';
import { AgentGallery } from './AgentGallery';
import { AgentWorkspace } from './AgentWorkspace';

/** W6: which session a Home card asked for. The token makes the same
 *  session openable twice in a row. */
interface SessionLink {
  agentId: string;
  sessionId: string;
  token: number;
}

export function AgentsScreen() {
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [agent, setAgent] = useState<InstalledAgent | null>(null);
  const [link, setLink] = useState<SessionLink | null>(null);

  // W6: a Home "Continue" card lands in ITS session — `vidtsx:agents-open`
  // follows the `vidtsx:creator-open` precedent (navigate first, dispatch once
  // the screen is mounted). The agent id opens the workspace; the session id
  // travels down as a prop the workspace applies once the list has loaded.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ agentId?: string; sessionId?: string }>).detail;
      if (!detail?.agentId) return;
      setOpenAgentId(detail.agentId);
      if (detail.sessionId) {
        setLink({ agentId: detail.agentId, sessionId: detail.sessionId, token: Date.now() });
      }
    };
    window.addEventListener('vidtsx:agents-open', handler);
    return () => window.removeEventListener('vidtsx:agents-open', handler);
  }, []);

  // The workspace needs the whole record, and the gallery's list is its own
  // state — so the id is what travels, and this re-reads it. That also means a
  // reinstall while the workspace is open picks up the new manifest.
  useEffect(() => {
    if (!openAgentId) {
      setAgent(null);
      return;
    }
    let disposed = false;
    void window.api.agentsInspect({ agentId: openAgentId }).then((result) => {
      if (disposed) return;
      if (result.success && result.agent) setAgent(result.agent);
      else setOpenAgentId(null);
    });
    return () => {
      disposed = true;
    };
  }, [openAgentId]);

  const back = useCallback(() => setOpenAgentId(null), []);

  // A double-clicked `.vidtsxagent` (§1.6) has to reach the GALLERY, which is
  // what claims the parked path and opens the import dialog — and the gallery
  // is not mounted while an agent workspace is. Getting the user to the Agents
  // screen is therefore not enough on its own; this closes the workspace so the
  // page they land on is the one that can act on the file.
  useEffect(() => {
    return window.api.onAgentsPackageOpenFile(() => setOpenAgentId(null));
  }, []);

  return (
    <div className="h-full">
      {openAgentId && agent ? (
        // Keyed by agent so a deep link to ANOTHER agent's session remounts the
        // workspace — its open-session state must not leak across agents.
        <AgentWorkspace
          key={agent.manifest.id}
          agent={agent}
          onBack={back}
          {...(link && link.agentId === agent.manifest.id ? { openSession: link } : {})}
        />
      ) : (
        <AgentGallery onOpenAgent={setOpenAgentId} />
      )}
    </div>
  );
}
