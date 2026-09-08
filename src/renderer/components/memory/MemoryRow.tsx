// One memory row and its controls, split out of `MemoryDialog` when the dialog
// moved here (agents plan §1.10) — the dialog was already at the ~300-line
// house limit and gained a scope control.
//
// Provenance is on every row on purpose: the standing rule is that nothing
// enters memory the user did not see and accept, so the UI must always be able
// to answer "where did this come from" (AGENT_MEMORY_DESIGN M1).

import type { ReactNode } from 'react';
import type { StudioMemory } from '@shared/types/studio-memory';

/** Short human date ("Aug 7, 2026"). Inlined rather than imported from
 *  `features/studio` — this file is shared, and a shared component must not
 *  reach into a feature. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function provenanceLabel(memory: StudioMemory): string {
  const who =
    memory.source.by === 'user'
      ? 'Added by you'
      : memory.source.agentId
        ? 'Accepted from an agent'
        : 'Accepted from the assistant';
  const scope = memory.agentId ? ' · this agent only' : '';
  return `${who}${scope} · ${formatDate(memory.createdAt)}`;
}

export function MemoryRow({
  memory,
  onToggle,
  onEdit,
  onDelete,
}: {
  memory: StudioMemory;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-start gap-2 p-2 rounded-[6px] bg-app-base"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-memory-row={memory.id}
    >
      <div className="flex-1 min-w-0">
        <div
          className={`text-[11px] leading-snug ${memory.active ? 'text-text-primary' : 'text-text-dim'}`}
        >
          {memory.text}
        </div>
        {memory.aliases && memory.aliases.length > 0 && (
          <div className="text-[10px] text-text-dim truncate">not: {memory.aliases.join(', ')}</div>
        )}
        <div className="text-[9px] text-text-ghost mt-0.5">{provenanceLabel(memory)}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <ToggleButton memory={memory} onToggle={onToggle} />
        <RowAction onClick={onEdit}>Edit</RowAction>
        <RowAction danger onClick={onDelete}>
          Delete
        </RowAction>
      </div>
    </div>
  );
}

export function ToggleButton({
  memory,
  onToggle,
}: {
  memory: StudioMemory;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-memory-toggle={memory.active ? 'on' : 'off'}
      title={
        memory.active
          ? 'On — the assistant follows this. Click to turn off without deleting.'
          : 'Off — kept, but the assistant ignores it. Click to turn back on.'
      }
      className={`px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wide transition-colors ${
        memory.active
          ? 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25'
          : 'bg-app-hover text-text-muted hover:text-text-secondary'
      }`}
    >
      {memory.active ? 'On' : 'Off'}
    </button>
  );
}

export function RowAction({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded text-[10px] hover:bg-app-hover ${
        danger ? 'text-accent-red' : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
