// One agent, open (agents plan §1.7): sessions on the far left, the chat, and
// the artifact stage. The 38 % split mirrors Studio's panel/preview proportions.
//
// §1.8's rule is enforced at the top: with no usable LLM provider there is one
// empty state and NO session is created. That is deliberate — creating a
// session the user cannot run would leave an empty folder behind for every
// visit to this screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot } from 'lucide-react';
import type { AgentJobRequest, InstalledAgent } from '@shared/types/agents';
import { useToast } from '@renderer/contexts/ToastContext';
import { getInteractionCard } from '@renderer/components/interactions/registry';
import { MemoryDialog } from '@renderer/components/memory/MemoryDialog';
import { useAgentProviders } from '@renderer/hooks/agents/useAgentProviders';
import { useAgentRenderBridge } from '@renderer/hooks/agents/useAgentRenderBridge';
import { useAgentRun } from '@renderer/hooks/agents/useAgentRun';
import { useAgentSessions } from '@renderer/hooks/agents/useAgentSessions';
import { useAgentStarter } from '../hooks/useAgentStarter';
import { useArtifactActions } from '../hooks/useArtifactActions';
import { useArtifactViewerData } from '../hooks/useArtifactViewerData';
import { useAgentMemoryProposals } from '@renderer/hooks/agents/useAgentMemoryProposals';
import { useAgentBrandList } from '@renderer/hooks/agents/useAgentBrandList';
import { useInteractionPreviews } from '../hooks/useInteractionPreviews';
import { AgentChat } from '@renderer/components/agents/AgentChat';
import { BrandSelect } from '@renderer/components/agents/BrandSelect';
import { MemoryProposalCard } from '@renderer/components/agents/MemoryProposalCard';
import { SessionList } from './SessionList';
import { StarterFlow } from './StarterFlow';
import { ArtifactStage } from './stage/ArtifactStage';

interface Props {
  agent: InstalledAgent;
  onBack: () => void;
}

export function AgentWorkspace({ agent, onBack }: Props) {
  const agentId = agent.manifest.id;
  const enqueueRef = useRef<((request: AgentJobRequest) => Promise<void>) | null>(null);
  const { showToast } = useToast();
  const sessionStore = useAgentSessions(agentId);
  const { sessions, remove, rename, refresh } = sessionStore;

  const lastProvider = sessions[0]?.providerId;
  const providers = useAgentProviders(lastProvider, sessions[0]?.model);

  // Which session is open, and how a new one begins (§1.8, §1.9) — including
  // the rule that the starter runs BEFORE the session is created.
  const starterTree = agent.manifest.starter;
  // W4: the brand a session generates under — picked in the starter for a
  // new session, changed on the chat chip for an open one.
  const brandList = useAgentBrandList();
  const {
    sessionId,
    setSessionId,
    starterOpen,
    creating,
    prefill,
    newSession,
    finishStarter,
    useQuickStart,
    starterBrandId,
    setStarterBrandId,
  } = useAgentStarter({
    starterTree,
    sessions: sessionStore,
    providers,
    defaultBrandId: brandList.defaultBrandId,
  });

  const run = useAgentRun({
    agentId,
    sessionId,
    ...(providers.providerId ? { providerId: providers.providerId } : {}),
    model: providers.model,
    onJobRequest: (request) => void enqueueRef.current?.(request),
  });

  // W1: the choice sticks with the session — opening one restores the
  // provider and model it last ran on (a provider no longer usable is left
  // to the hook's own fallback).
  const openedSession = run.session;
  const { setProviderId, setModel } = providers;
  useEffect(() => {
    if (!openedSession) return;
    if (openedSession.providerId) setProviderId(openedSession.providerId);
    setModel(openedSession.model ?? '');
  }, [openedSession?.id, openedSession?.providerId, openedSession?.model, setProviderId, setModel]);
  // The bridge reads the run's artifacts and the run hands the bridge its job
  // requests, so one of the two directions has to be late-bound.
  const render = useAgentRenderBridge(agentId, sessionId, run.artifacts);
  enqueueRef.current = render.enqueue;
  const viewer = useArtifactViewerData(agentId, sessionId, run.selected);
  const actions = useArtifactActions(agentId, sessionId);
  const previews = useInteractionPreviews(agentId, sessionId, run.pendingInteraction, run.artifacts);
  const memory = useAgentMemoryProposals(agentId, sessionId);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const deleteSession = useCallback(
    async (id: string) => {
      await remove(id);
      if (id === sessionId) setSessionId(null);
    },
    [remove, sessionId],
  );

  const setSessionBrand = useCallback(
    async (brandId: string | null) => {
      if (!sessionId) return;
      const res = await window.api.agentSessionBrandSet({ agentId, sessionId, brandId });
      if (res.success) run.patchSession({ brandId: brandId ?? undefined });
      else showToast(res.error ?? 'Failed to set the session brand', 'error');
    },
    [agentId, sessionId, run, showToast],
  );

  // A finished turn can rename the session (first prompt becomes the title),
  // so the list is re-read whenever the agent stops working.
  useEffect(() => {
    if (!run.busy) void refresh();
  }, [run.busy, refresh]);

  const runAction = useCallback(
    async (action: Parameters<typeof actions.run>[1]) => {
      if (!run.selected) return;
      const result = await actions.run(run.selected.id, action);
      showToast(result.message, result.ok ? 'success' : 'error');
    },
    [actions, run.selected, showToast],
  );

  const liveJob = run.selected?.kind === 'job' ? render.liveJob(run.selected) : null;

  // A pending question renders through the SHARED registry (§1.3), so a wave-2
  // kind is one registry entry and no change here. `answer` sends it as the
  // next user message — the non-blocking form (§1.5) — and "Skip and chat"
  // sends the cancelled reply the broker already understands.
  const request = run.pendingInteraction;
  const InteractionCard = request ? getInteractionCard(request.payload.kind) : null;
  const pending =
    request && InteractionCard ? (
      <InteractionCard
        request={request}
        previews={previews}
        busy={run.busy}
        restored={run.interactionRestored}
        onAnswer={(values) =>
          void run.answer({ requestId: request.id, status: 'answered', values })
        }
        onCancel={() => void run.answer({ requestId: request.id, status: 'cancelled' })}
      />
    ) : null;

  // The starter renders in the SAME place a mid-run question does — over the
  // stage — so the two layers look like one conversation (§1.9's "no seam").
  const stageCard =
    starterOpen && starterTree ? (
      <StarterFlow
        tree={starterTree}
        busy={creating}
        onFinish={(a) => void finishStarter(a)}
        brandPicker={
          <BrandSelect
            brands={brandList.brands}
            brandId={starterBrandId}
            onChange={setStarterBrandId}
            disabled={creating || !brandList.loaded}
          />
        }
      />
    ) : (
      pending
    );

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 px-3 h-[40px] shrink-0 bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          title="All agents"
          className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] text-text-muted hover:bg-app-hover"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
        </button>
        <Bot size={14} strokeWidth={1.5} className="text-accent-light" />
        <span className="text-[13px] font-medium text-text-secondary">{agent.manifest.name}</span>
        <span className="text-[10px] text-text-dim">{agent.manifest.version}</span>
      </div>

      {!providers.loaded ? (
        <div className="flex-1 flex items-center justify-center text-[11px] text-text-dim">
          Checking providers…
        </div>
      ) : !providers.usable ? (
        <NoProviderState />
      ) : (
        <div className="flex flex-1 min-h-0">
          <div
            className="w-[180px] shrink-0 bg-app-deep"
            style={{ borderRight: '0.5px solid var(--color-border)' }}
          >
            <SessionList
              sessions={sessions}
              activeId={sessionId}
              onSelect={setSessionId}
              onCreate={() => void newSession()}
              onRename={(id, title) => void rename(id, title)}
              onDelete={(id) => void deleteSession(id)}
            />
          </div>

          <div
            className="w-[38%] min-w-[280px] shrink-0"
            style={{ borderRight: '0.5px solid var(--color-border)' }}
          >
            <AgentChat
              agentName={agent.manifest.name}
              agentDescription={agent.manifest.description}
              messages={run.messages}
              busy={run.busy}
              waitingForAnswer={run.pendingInteraction !== null}
              {...(run.toolsAvailable !== undefined ? { toolsAvailable: run.toolsAvailable } : {})}
              providers={providers.providers}
              providerId={providers.providerId}
              onProviderChange={(id) => {
                providers.setProviderId(id);
                providers.setModel('');
              }}
              model={providers.model}
              onModelChange={providers.setModel}
              {...(sessionId && run.session
                ? {
                    brandPicker: (
                      <BrandSelect
                        compact
                        brands={brandList.brands}
                        brandId={run.session.brandId ?? null}
                        onChange={(id) => void setSessionBrand(id)}
                        disabled={run.busy || !brandList.loaded}
                      />
                    ),
                  }
                : {})}
              onSend={(text) => void run.send(text)}
              {...(prefill ? { prefill } : {})}
              {...(starterTree?.quickStarts?.length
                ? { quickStarts: starterTree.quickStarts, onQuickStart: (p) => void useQuickStart(p) }
                : {})}
              {...(starterOpen
                ? { composerHint: 'Answer the questions, or Skip and chat' }
                : {})}
              onCancel={run.cancel}
              onNewSession={() => void newSession()}
              onOpenMemory={() => setMemoryOpen(true)}
              {...(memory.proposals[0]
                ? {
                    memoryProposal: (
                      <MemoryProposalCard
                        proposal={memory.proposals[0]}
                        agentName={agent.manifest.name}
                        error={memory.error}
                        onResolve={(input) => void memory.resolve(input)}
                      />
                    ),
                  }
                : {})}
            />
          </div>

          <div className="flex-1 min-w-0">
            <ArtifactStage
              artifacts={run.artifacts}
              selected={run.selected}
              resolved={viewer.resolved}
              resolving={viewer.loading}
              {...(viewer.error !== undefined ? { resolveError: viewer.error } : {})}
              {...(liveJob
                ? {
                    live: {
                      progress: liveJob.progress,
                      onCancel: () => render.cancel(liveJob.id),
                    },
                  }
                : {})}
              actionRunning={actions.running}
              studioProjectOpen={actions.studioProjectOpen}
              onSelect={run.select}
              onAction={(action) => void runAction(action)}
              {...(stageCard ? { interactionCard: stageCard } : {})}
            />
          </div>
        </div>
      )}

      <MemoryDialog
        isOpen={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        agentScope={{ agentId, agentName: agent.manifest.name }}
        {...(run.toolsAvailable !== undefined ? { canPropose: run.toolsAvailable } : {})}
      />
    </div>
  );
}

/** §1.8: no usable provider means no starter, no chat box, and no session. */
function NoProviderState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-center px-6">
      <Bot size={48} strokeWidth={1} className="text-text-ghost" />
      <div className="text-[14px] text-text-muted">Configure an AI provider to use agents</div>
      <div className="text-[12px] text-text-dim max-w-[340px] leading-snug">
        Agents run on your own provider key. Add one on the AI page, then come back.
      </div>
      <button
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('vidtsx:navigate', { detail: { screen: 'ai-models' } }),
          )
        }
        className="mt-1 rounded-[6px] bg-accent px-2.5 py-1 text-[11px] text-white"
      >
        Open the AI page
      </button>
    </div>
  );
}
