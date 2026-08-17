import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import {
  MAX_ACTIVE_RULES,
  MEMORY_TEXT_LIMITS,
  type StudioMemory,
} from '@shared/types/studio-memory';
import { useAgentMemory } from '../hooks/useAgentMemory';
import { MemoryEntryForm } from './MemoryEntryForm';
import { formatDate } from '../services/format-time';

type Editing = { kind: 'rule' | 'vocabulary'; memory?: StudioMemory } | null;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** From the last agent turn: false = chat-only provider, so the agent
   *  cannot propose memories and the UI must say so plainly (M2) rather
   *  than silently never proposing. */
  canPropose?: boolean;
}

/** Management surface for agent memory (G5, design doc M6 Rev 2): browse by
 *  tier, add, edit, toggle active, delete — with provenance on every row.
 *  Nothing enters memory the user did not see and accept; this dialog is the
 *  manual door. The agent re-reads the store every turn, so changes here
 *  steer the very next assistant reply. */
export function MemoryDialog({ isOpen, onClose, canPropose }: Props) {
  const { memories, loading, error, refresh, save, toggleActive, remove, clearError } =
    useAgentMemory();
  const [editing, setEditing] = useState<Editing>(null);
  const [profileDraft, setProfileDraft] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEditing(null);
      setProfileDraft(null);
      clearError();
      void refresh();
    }
  }, [isOpen, refresh, clearError]);

  // Match the composed prompt block's order (tier → createdAt → id) so the
  // list the user reads is the list the agent reads.
  const byDate = (a: StudioMemory, b: StudioMemory) =>
    a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1;
  const rules = useMemo(
    () => memories.filter((m) => m.kind === 'rule').sort(byDate),
    [memories],
  );
  const vocabulary = useMemo(
    () => memories.filter((m) => m.kind === 'vocabulary').sort(byDate),
    [memories],
  );
  const profile = useMemo(() => memories.find((m) => m.kind === 'profile'), [memories]);

  const activeRules = rules.filter((m) => m.active).length;
  const atCap = activeRules >= MAX_ACTIVE_RULES;

  const removeWithConfirm = (memory: StudioMemory) => {
    const ok = window.confirm(
      'Delete this memory? Turning it off keeps the history; deleting is permanent.',
    );
    if (ok) void remove(memory.id);
  };

  const profileText = profileDraft ?? profile?.text ?? '';
  const profileDirty = profileDraft !== null && profileDraft.trim() !== (profile?.text ?? '');
  const saveProfile = async () => {
    if (await save({ kind: 'profile', text: profileText.trim() })) setProfileDraft(null);
  };

  const title = editing
    ? `${editing.memory ? 'Edit' : 'New'} ${editing.kind === 'rule' ? 'rule' : 'name'}`
    : 'Assistant memory';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="w-[540px] max-h-[70vh] overflow-y-auto flex flex-col gap-4" data-memory-dialog>
        {editing ? (
          <MemoryEntryForm
            kind={editing.kind}
            {...(editing.memory ? { memory: editing.memory } : {})}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <p className="text-[11px] text-text-dim leading-snug">
              The editing assistant reads everything active here on every turn. Nothing is
              remembered unless you add it yourself or accept a proposal — turning an entry
              off keeps it without steering the assistant.
              {canPropose === false && (
                <span className="text-text-muted">
                  {' '}
                  This project&rsquo;s AI provider can&rsquo;t propose memories — add them here
                  yourself.
                </span>
              )}
            </p>

            <TierSection
              title="Rules"
              detail={`${activeRules}/${MAX_ACTIVE_RULES} active`}
              actionLabel="Add rule"
              actionDisabled={atCap}
              onAction={() => setEditing({ kind: 'rule' })}
              {...(rules.length === 0
                ? { emptyText: 'Imperatives the assistant obeys — e.g. “Never use zoom transitions.”' }
                : {})}
            >
              {atCap && (
                <div className="text-[10px] text-amber-400 leading-snug" data-memory-cap-note>
                  You&rsquo;re at the {MAX_ACTIVE_RULES}-rule cap — turn a rule off to make room
                  for a new one.
                </div>
              )}
              {rules.map((m) => (
                <MemoryRow
                  key={m.id}
                  memory={m}
                  onToggle={() => void toggleActive(m)}
                  onEdit={() => setEditing({ kind: 'rule', memory: m })}
                  onDelete={() => removeWithConfirm(m)}
                />
              ))}
            </TierSection>

            <TierSection
              title="Names & spellings"
              detail={`${vocabulary.length}`}
              actionLabel="Add name"
              onAction={() => setEditing({ kind: 'vocabulary' })}
              {...(vocabulary.length === 0
                ? {
                    emptyText:
                      'Proper nouns and the misspellings to correct — e.g. “LearnWithHasan”, not “learn with Hassan.”',
                  }
                : {})}
            >
              {vocabulary.map((m) => (
                <MemoryRow
                  key={m.id}
                  memory={m}
                  onToggle={() => void toggleActive(m)}
                  onEdit={() => setEditing({ kind: 'vocabulary', memory: m })}
                  onDelete={() => removeWithConfirm(m)}
                />
              ))}
            </TierSection>

            <TierSection title="About you and your channel">
              <textarea
                value={profileText}
                onChange={(e) => setProfileDraft(e.target.value)}
                maxLength={MEMORY_TEXT_LIMITS.profile}
                rows={3}
                placeholder="Durable facts that set context — e.g. “AI coding tutorials for developers, 8–15 minutes, direct and practical.”"
                className="w-full resize-none bg-app-base text-[11px] text-text-primary placeholder:text-text-ghost rounded-[6px] px-2 py-1.5 outline-none leading-snug"
                style={{ border: '0.5px solid var(--color-border-input)' }}
                data-memory-profile
              />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-text-ghost">
                  {profile ? provenanceLabel(profile) : ''}
                </span>
                <div className="flex items-center gap-2">
                  {profile && (
                    <>
                      <ToggleButton memory={profile} onToggle={() => void toggleActive(profile)} />
                      <RowAction danger onClick={() => removeWithConfirm(profile)}>
                        Delete
                      </RowAction>
                    </>
                  )}
                  {profileDirty && (
                    <Button
                      variant="primary"
                      onClick={() => void saveProfile()}
                      disabled={!profileText.trim()}
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </TierSection>

            {loading && memories.length === 0 && (
              <div className="text-[11px] text-text-dim">Loading…</div>
            )}
          </>
        )}

        {error && (
          <div className="text-[10px] text-accent-red leading-snug" data-memory-error>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TierSection({
  title,
  detail,
  actionLabel,
  actionDisabled,
  onAction,
  emptyText,
  children,
}: {
  title: string;
  detail?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  emptyText?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">{title}</span>
          {detail && <span className="text-[9px] text-text-ghost">{detail}</span>}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            data-memory-add={actionLabel}
            className="px-2 py-0.5 rounded text-[10px] text-accent-blue hover:bg-accent-blue/15 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {emptyText && <div className="text-[10px] text-text-dim leading-snug">{emptyText}</div>}
      {children}
    </section>
  );
}

function provenanceLabel(memory: StudioMemory): string {
  const who = memory.source.by === 'user' ? 'Added by you' : 'Accepted from the assistant';
  return `${who} · ${formatDate(memory.createdAt)}`;
}

function MemoryRow({
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

function ToggleButton({ memory, onToggle }: { memory: StudioMemory; onToggle: () => void }) {
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

function RowAction({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
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
