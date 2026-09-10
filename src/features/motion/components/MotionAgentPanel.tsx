// Agent mode's chat, inside the Creator's input panel (W7). The shared
// `AgentChat` in its embedded form: no pickers of its own (the panel above it
// owns provider, model and brand), and the two cards a run can raise — an
// `ask_user` question and a `propose_memory` proposal — render under the
// conversation because there is no stage here to put them on.

import { useState } from 'react';
import { AgentChat } from '@renderer/components/agents/AgentChat';
import { MemoryProposalCard } from '@renderer/components/agents/MemoryProposalCard';
import { getInteractionCard } from '@renderer/components/interactions/registry';
import { MemoryDialog } from '@renderer/components/memory/MemoryDialog';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { useMotionAgent, type MotionAgentRestore } from '../hooks/useMotionAgent';

interface Props {
  enabled: boolean;
  providers: LlmProviderConfig[];
  providerId: string;
  model: string;
  brandId: string;
  onRestore: (values: MotionAgentRestore) => void;
  onVersion: (versionPath: string, folderPath: string) => void;
}

export function MotionAgentPanel({ enabled, providers, providerId, model, brandId, onRestore, onVersion }: Props) {
  const { agent, agentMissing, sessionId, run, memory, newSession } = useMotionAgent({
    enabled,
    providerId,
    model,
    brandId,
    onRestore,
    onVersion,
  });
  const [memoryOpen, setMemoryOpen] = useState(false);
  const name = agent?.manifest.name ?? 'TSX Composer';

  if (agentMissing) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 text-center text-[11px] text-text-dim leading-snug">
        The TSX Composer agent is not installed with this build, so Agent mode has nothing to run.
      </div>
    );
  }
  if (!providerId) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 text-center text-[11px] text-text-dim leading-snug">
        Pick an AI provider above to talk to {name}.
      </div>
    );
  }

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

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-motion-agent-panel>
      <AgentChat
        agentName={name}
        agentDescription={
          agent?.manifest.description ??
          'Describe the motion graphic you want; every version lands in the preview.'
        }
        messages={run.messages}
        busy={run.busy}
        waitingForAnswer={run.pendingInteraction !== null}
        {...(run.toolsAvailable !== undefined ? { toolsAvailable: run.toolsAvailable } : {})}
        providers={providers}
        providerId={providerId}
        onProviderChange={() => {}}
        model={model}
        onModelChange={() => {}}
        hidePickers
        onSend={(text) => void run.send(text)}
        onCancel={run.cancel}
        onNewSession={() => void newSession()}
        onOpenMemory={() => setMemoryOpen(true)}
        {...(interactionCard ? { interactionCard } : {})}
        {...(sessionId === null ? { composerHint: 'Starting a session…' } : {})}
        {...(memory.proposals[0]
          ? {
              memoryProposal: (
                <MemoryProposalCard
                  proposal={memory.proposals[0]}
                  agentName={name}
                  error={memory.error}
                  onResolve={(input) => void memory.resolve(input)}
                />
              ),
            }
          : {})}
      />
      <MemoryDialog
        isOpen={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        agentScope={{ agentId: agent?.manifest.id ?? 'vidtsx/tsx-composer', agentName: name }}
        {...(run.toolsAvailable !== undefined ? { canPropose: run.toolsAvailable } : {})}
      />
    </div>
  );
}
