// The Agents screen: the gallery, or one agent's workspace (agents plan §1.7).
//
// Both halves stay in one screen component because the app mounts every visited
// screen once and keeps it mounted (docs/ui-automation-cdp.md) — so "open an
// agent" is state here, not navigation, and going back does not re-scan.

import { useCallback, useEffect, useState } from 'react';
import type { InstalledAgent } from '@shared/types/agents';
import { AgentGallery } from './AgentGallery';
import { AgentWorkspace } from './AgentWorkspace';

export function AgentsScreen() {
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [agent, setAgent] = useState<InstalledAgent | null>(null);

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

  return (
    <div className="h-full">
      {openAgentId && agent ? (
        <AgentWorkspace agent={agent} onBack={back} />
      ) : (
        <AgentGallery onOpenAgent={setOpenAgentId} />
      )}
    </div>
  );
}
