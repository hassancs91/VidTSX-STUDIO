// Usage grouped by agent (agents plan §9).
//
// `featureSource: 'agent'` says an installed agent made the request; it can
// never say WHICH, because every agent shares the one source. So the runner
// stamps `agentId` on each row and this reads it back.
//
// The table renders only when at least one agent has run. Two thirds of a
// Motion Post run's spend is its composition pipeline rather than its chat
// turns, so an agent that has done anything at all shows several rows here —
// and a user who has never opened an agent sees the AI page exactly as before.

import type { AiUsageAgentTotal } from '../../shared/types/ai-usage';

interface AiUsageByAgentProps {
  agents: AiUsageAgentTotal[];
  /** The agent the log below is filtered to, if any. */
  selected?: string | undefined;
  onSelect: (agentId: string | undefined) => void;
}

const GRID_COLS = '1fr 70px 80px 80px 90px 80px';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function AiUsageByAgent({ agents, selected, onSelect }: AiUsageByAgentProps) {
  if (agents.length === 0) return null;

  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      <div
        className="grid items-center px-3 h-[32px] text-[10px] font-medium text-text-dim uppercase tracking-wider gap-x-2"
        style={{ gridTemplateColumns: GRID_COLS, borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span>Agent</span>
        <span className="text-right">Requests</span>
        <span className="text-right">In Tokens</span>
        <span className="text-right">Out Tokens</span>
        <span className="text-right">Cache Read</span>
        <span className="text-right">Cost</span>
      </div>

      {agents.map((agent, index) => {
        const active = selected === agent.agentId;
        return (
          <button
            key={agent.agentId}
            type="button"
            data-usage-agent={agent.agentId}
            aria-pressed={active}
            onClick={() => onSelect(active ? undefined : agent.agentId)}
            title={active ? 'Show every source again' : `Show only ${agent.agentId} in the log below`}
            className={`w-full grid items-center px-3 gap-x-2 h-[36px] text-[11px] text-left transition-colors ${
              active ? 'bg-app-active' : 'hover:bg-app-hover'
            } ${index !== agents.length - 1 ? 'border-b border-border' : ''}`}
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span className={`truncate ${active ? 'text-accent-light' : 'text-text-secondary'}`}>
              {agent.agentId}
            </span>
            <span className="text-text-muted text-right">{agent.requests.toLocaleString()}</span>
            <span className="text-text-muted text-right">{formatTokens(agent.inputTokens)}</span>
            <span className="text-text-muted text-right">{formatTokens(agent.outputTokens)}</span>
            <span className="text-text-dim text-right">
              {formatTokens(agent.cacheReadInputTokens)}
            </span>
            <span className="text-text-muted text-right">${agent.costUsd.toFixed(2)}</span>
          </button>
        );
      })}
    </div>
  );
}
