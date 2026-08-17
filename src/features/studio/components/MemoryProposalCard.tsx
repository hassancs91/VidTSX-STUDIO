import { useState } from 'react';
import { Brain } from 'lucide-react';
import type { StudioMemory, StudioMemoryProposal } from '@shared/types/studio-memory';
import { MEMORY_TEXT_LIMITS } from '@shared/types/studio-memory';

const KIND_LABELS: Record<StudioMemoryProposal['kind'], string> = {
  rule: 'Rule',
  vocabulary: 'Spelling',
  profile: 'Profile',
};

interface Props {
  proposal: StudioMemoryProposal;
  /** ACTIVE memories of the same kind — shown so conflicts are visible
   *  before accepting (Rev 2: the list replaces the "replaces →" picker). */
  sameKindActive: StudioMemory[];
  error: string | null;
  resolving: boolean;
  onAccept: (edited?: { text: string; aliases?: string[] }) => void;
  onReject: () => void;
}

/** The pending-proposal card (G4): the agent asked to remember something and
 *  the user decides right where the correction happened. Accept, edit then
 *  accept, or reject — nothing is saved until they do. */
export function MemoryProposalCard({
  proposal,
  sameKindActive,
  error,
  resolving,
  onAccept,
  onReject,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(proposal.text);
  const [aliases, setAliases] = useState((proposal.aliases ?? []).join(', '));

  const acceptEdited = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const aliasList = aliases
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    onAccept({
      text: trimmed,
      ...(proposal.kind === 'vocabulary' ? { aliases: aliasList } : {}),
    });
  };

  return (
    <div
      className="rounded-[8px] bg-app-base p-2.5 space-y-1.5"
      style={{ border: '0.5px solid var(--color-accent-blue, #3b82f6)' }}
      data-memory-proposal={proposal.id}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-accent-blue">
        <Brain size={11} strokeWidth={1.75} className="shrink-0" />
        <span className="font-medium">Remember this?</span>
        <span className="text-text-ghost">· {KIND_LABELS[proposal.kind]}</span>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MEMORY_TEXT_LIMITS[proposal.kind]}
            rows={2}
            autoFocus
            className="w-full resize-none bg-app-surface text-[11px] text-text-primary rounded-[6px] px-2 py-1.5 outline-none leading-snug"
            style={{ border: '0.5px solid var(--color-border-input)' }}
          />
          {proposal.kind === 'vocabulary' && (
            <input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="Misspellings it corrects, comma-separated"
              className="w-full bg-app-surface text-[11px] text-text-primary placeholder:text-text-ghost rounded-[6px] px-2 py-1 outline-none"
              style={{ border: '0.5px solid var(--color-border-input)' }}
            />
          )}
        </div>
      ) : (
        <>
          <div className="text-[11px] text-text-primary leading-snug">{proposal.text}</div>
          {proposal.aliases && proposal.aliases.length > 0 && (
            <div className="text-[10px] text-text-dim">not: {proposal.aliases.join(', ')}</div>
          )}
        </>
      )}

      {!editing && sameKindActive.length > 0 && (
        <div className="text-[10px] text-text-dim leading-snug">
          <span className="text-text-muted">
            Already active ({KIND_LABELS[proposal.kind].toLowerCase()}s):
          </span>
          {sameKindActive.slice(0, 4).map((m) => (
            <div key={m.id} className="truncate">
              · {m.text}
            </div>
          ))}
          {sameKindActive.length > 4 && <div>…and {sameKindActive.length - 4} more</div>}
        </div>
      )}

      {error && (
        <div className="text-[10px] text-accent-red leading-snug" data-memory-proposal-error>
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-1 pt-0.5">
        {editing ? (
          <>
            <CardAction onClick={() => setEditing(false)} disabled={resolving}>
              Cancel
            </CardAction>
            <CardAction
              primary
              onClick={acceptEdited}
              disabled={resolving || !text.trim()}
              data-memory-proposal-save
            >
              Save to memory
            </CardAction>
          </>
        ) : (
          <>
            <CardAction onClick={onReject} disabled={resolving} data-memory-proposal-reject>
              No thanks
            </CardAction>
            <CardAction onClick={() => setEditing(true)} disabled={resolving}>
              Edit
            </CardAction>
            <CardAction
              primary
              onClick={() => onAccept()}
              disabled={resolving}
              data-memory-proposal-accept
            >
              Remember
            </CardAction>
          </>
        )}
      </div>
    </div>
  );
}

function CardAction({
  onClick,
  primary,
  disabled,
  children,
  ...rest
}: {
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
} & Record<`data-${string}`, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded-[5px] text-[10px] transition-colors disabled:opacity-40 ${
        primary
          ? 'bg-accent-blue/15 text-accent-blue font-medium hover:bg-accent-blue/25'
          : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
