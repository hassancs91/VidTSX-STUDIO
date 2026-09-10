// "Ask the builder" (flows plan §1.6, W8 Stage 4): the Flow Builder agent in
// a side panel on the canvas — the shared `AgentChat` in its embedded form
// (W7: `hidePickers`, the `interactionCard` slot), on one session per open
// flow. The session is created with the starter answer prefilled with the
// flow's name and id, so the agent knows what it is editing without the user
// saying so; a proposal it makes reaches the canvas through
// `useFlowProposal` on the session id this panel hands up. The Flows feature
// imports only shared renderer pieces here — nothing from `features/agents`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentChat } from '@renderer/components/agents/AgentChat';
import { getInteractionCard } from '@renderer/components/interactions/registry';
import { MemoryDialog } from '@renderer/components/memory/MemoryDialog';
import { useAgentProviders } from '@renderer/hooks/agents/useAgentProviders';
import { useAgentRun } from '@renderer/hooks/agents/useAgentRun';
import { useAgentSessions } from '@renderer/hooks/agents/useAgentSessions';
import type { InstalledAgent } from '@shared/types/agents';

export const FLOW_BUILDER_AGENT_ID = 'vidtsx/flow-builder';

interface Props {
  flowId: string;
  flowName: string;
  /** The builder session the canvas listens to for proposals (null until one exists). */
  onSession: (sessionId: string | null) => void;
  onClose: () => void;
}

function sessionTitle(flowId: string): string {
  return `Builder: ${flowId}`;
}

export function BuilderPanel({ flowId, flowName, onSession, onClose }: Props) {
  const agentId = FLOW_BUILDER_AGENT_ID;
  const [agent, setAgent] = useState<InstalledAgent | null>(null);
  const [agentMissing, setAgentMissing] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const sessions = useAgentSessions(agentId);
  const providers = useAgentProviders();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const creating = useRef(false);
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  useEffect(() => {
    onSessionRef.current(sessionId);
  }, [sessionId]);

  useEffect(() => {
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
  }, [agentId]);

  const run = useAgentRun({
    agentId,
    sessionId,
    ...(providers.providerId ? { providerId: providers.providerId } : {}),
    model: providers.model,
  });

  const { create } = sessions;
  const newSession = useCallback(async (): Promise<void> => {
    if (creating.current || !providers.providerId) return;
    creating.current = true;
    try {
      const session = await create({
        providerId: providers.providerId,
        title: sessionTitle(flowId),
        starter: { flow: { text: `${flowName || 'Untitled flow'} (id ${flowId})` } },
      });
      if (session) setSessionId(session.id);
    } finally {
      creating.current = false;
    }
  }, [create, providers.providerId, flowId, flowName]);

  // One session per flow: reopen the newest one for this flow, else begin one.
  useEffect(() => {
    if (!sessions.loaded || sessionId || !providers.providerId || agentMissing) return;
    const existing = sessions.sessions.find((s) => s.title === sessionTitle(flowId));
    if (existing) {
      setSessionId(existing.id);
      return;
    }
    void newSession();
  }, [sessions.loaded, sessions.sessions, sessionId, providers.providerId, agentMissing, flowId, newSession]);

  const name = agent?.manifest.name ?? 'Flow Builder';
  const request = run.pendingInteraction;
  const InteractionCard = request ? getInteractionCard(request.payload.kind) : null;
  const interactionCard =
    request && InteractionCard ? (
      <InteractionCard
        request={request}
        busy={run.busy}
        restored={run.interactionRestored}
        onAnswer={(values) => void run.answer({ requestId: request.id, status: 'answered', values })}
        onCancel={() => void run.answer({ requestId: request.id, status: 'cancelled' })}
      />
    ) : null;

  let body: React.ReactNode;
  if (agentMissing) {
    body = <Notice>The Flow Builder agent is not installed with this build.</Notice>;
  } else if (providers.loaded && !providers.usable) {
    body = <Notice>Configure an AI provider on the AI page to talk to {name}.</Notice>;
  } else {
    body = (
      <AgentChat
        agentName={name}
        agentDescription={agent?.manifest.description ?? 'Describe the flow you want; it lands on the canvas as a proposal.'}
        messages={run.messages}
        busy={run.busy}
        waitingForAnswer={run.pendingInteraction !== null}
        {...(run.toolsAvailable !== undefined ? { toolsAvailable: run.toolsAvailable } : {})}
        providers={providers.providers}
        providerId={providers.providerId}
        onProviderChange={providers.setProviderId}
        model={providers.model}
        onModelChange={providers.setModel}
        hidePickers
        onSend={(text) => void run.send(text)}
        onCancel={run.cancel}
        onNewSession={() => {
          setSessionId(null);
          void newSession();
        }}
        onOpenMemory={() => setMemoryOpen(true)}
        {...(interactionCard ? { interactionCard } : {})}
        {...(sessionId === null ? { composerHint: 'Starting a session…' } : {})}
        quickStarts={agent?.manifest.starter?.quickStarts ?? []}
        onQuickStart={(prompt) => void run.send(prompt)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0" data-builder-panel={sessionId ?? 'none'}>
      <div className="flex items-center gap-2 px-3 h-[32px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="text-[11px] font-medium text-text-secondary">Ask the builder</span>
        <span className="flex-1" />
        <button onClick={onClose} className="text-[11px] text-text-muted hover:text-text-primary" data-builder-close>
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{body}</div>
      <MemoryDialog isOpen={memoryOpen} onClose={() => setMemoryOpen(false)} agentScope={{ agentId, agentName: name }} />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center px-4 text-center text-[11px] text-text-dim leading-snug">{children}</div>;
}
