// The agent asked to remember something (agents plan §1.10).
//
// The review gate, and the ONE place §1.10's scope line lives: "Remember for:
// this agent / all agents", defaulting to this agent. The agent never chooses
// that — it proposes text, the user chooses reach — which is why an agent
// cannot quietly write itself into Studio's memory.
//
// Rejecting is as easy as accepting, and nothing is pre-selected beyond the
// narrow default. Accept, edit-then-accept, reject: the same three doors the
// Studio proposal card offers.

import { useState } from 'react';
import { Brain } from 'lucide-react';
import type { AgentMemoryProposal, AgentMemoryScope } from '@shared/types/agents';
import { MEMORY_TEXT_LIMITS } from '@shared/types/studio-memory';

const KIND_LABEL: Record<AgentMemoryProposal['kind'], string> = {
  rule: 'Rule',
  vocabulary: 'Name or spelling',
  profile: 'About you',
};

interface Props {
  proposal: AgentMemoryProposal;
  agentName: string;
  error?: string | null;
  onResolve: (input: {
    proposalId: string;
    action: 'accept' | 'reject';
    scope?: AgentMemoryScope;
    edited?: { text: string; aliases?: string[] };
  }) => void;
}

export function MemoryProposalCard({ proposal, agentName, error, onResolve }: Props) {
  const [text, setText] = useState(proposal.text);
  const [scope, setScope] = useState<AgentMemoryScope>('agent');

  const trimmed = text.trim();
  const edited = trimmed !== proposal.text;

  const accept = (): void =>
    onResolve({
      proposalId: proposal.id,
      action: 'accept',
      scope,
      ...(edited
        ? {
            edited: {
              text: trimmed,
              ...(proposal.aliases ? { aliases: proposal.aliases } : {}),
            },
          }
        : {}),
    });

  return (
    <div
      className="rounded-[8px] bg-app-surface p-2.5"
      style={{ border: '0.5px solid var(--color-accent)' }}
      data-memory-proposal={proposal.id}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Brain size={12} strokeWidth={1.75} className="text-accent-light" />
        <span className="text-[11px] font-medium text-text-primary">Remember this?</span>
        <span className="text-[9px] text-text-dim">{KIND_LABEL[proposal.kind]}</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MEMORY_TEXT_LIMITS[proposal.kind]}
        rows={proposal.kind === 'profile' ? 3 : 2}
        className="w-full resize-none rounded-[6px] bg-app-base px-2 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent leading-snug"
        style={{ border: '0.5px solid var(--color-border-input)' }}
        data-memory-proposal-text
      />

      {proposal.aliases && proposal.aliases.length > 0 ? (
        <div className="text-[10px] text-text-dim mt-1">not: {proposal.aliases.join(', ')}</div>
      ) : null}

      <div className="mt-2">
        <div className="text-[10px] text-text-muted mb-1">Remember for:</div>
        <div className="flex items-center gap-1">
          {(['agent', 'all'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              data-memory-proposal-scope={value}
              className={`px-2 py-[3px] rounded-[5px] text-[10px] transition-colors ${
                scope === value ? 'bg-app-active text-accent-light' : 'text-text-muted hover:bg-app-hover'
              }`}
              style={{
                border: `0.5px solid ${scope === value ? 'var(--color-accent)' : 'var(--color-border-hover)'}`,
              }}
            >
              {value === 'agent' ? `${agentName} only` : 'All agents'}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="text-[10px] text-accent-red leading-snug mt-2" data-memory-proposal-error>
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-1.5 mt-2">
        <button
          onClick={() => onResolve({ proposalId: proposal.id, action: 'reject' })}
          className="rounded-[6px] px-2.5 py-1 text-[10px] text-text-secondary hover:bg-app-hover"
          style={{ border: '0.5px solid var(--color-border-hover)' }}
        >
          No thanks
        </button>
        <button
          onClick={accept}
          disabled={trimmed.length === 0}
          data-memory-proposal-accept
          className="rounded-[6px] bg-accent px-2.5 py-1 text-[10px] text-white hover:opacity-90 disabled:opacity-40"
        >
          {edited ? 'Save edited' : 'Remember it'}
        </button>
      </div>
    </div>
  );
}
