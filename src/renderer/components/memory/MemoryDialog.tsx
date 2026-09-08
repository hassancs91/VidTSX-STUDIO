// The memory management surface (G5, AGENT_MEMORY_DESIGN M6 Rev 2), moved out
// of `features/studio/components/` so the Agents feature can open the SAME
// dialog (agents plan §1.10) without importing across features. Studio's
// AgentPanel changed one import line and behaves exactly as before: with no
// `agentScope` prop this shows the app-wide set, which is every entry that
// existed before agents.
//
// Nothing enters memory that the user did not see and accept; this dialog is
// the manual door. The agent re-reads the store every turn, so a change here
// steers the very next reply.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import {
  MAX_ACTIVE_RULES,
  MEMORY_TEXT_LIMITS,
  type StudioMemory,
} from '@shared/types/studio-memory';
import type { AgentMemoryScope } from '@shared/types/agents';
import { useAgentMemory } from './useAgentMemory';
import { MemoryEntryForm } from './MemoryEntryForm';
import { MemoryRow, RowAction, ToggleButton, provenanceLabel } from './MemoryRow';

type Editing = { kind: 'rule' | 'vocabulary'; memory?: StudioMemory } | null;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Set by the Agents workspace (§1.10). It does two things at once, and that
   * is deliberate: it is the scope you are LOOKING at and the scope anything
   * you add lands in. "All agents" is the app-wide set Studio also reads.
   */
  agentScope?: { agentId: string; agentName: string };
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
export function MemoryDialog({ isOpen, onClose, canPropose, agentScope }: Props) {
  const { memories: allMemories, loading, error, refresh, save, toggleActive, remove, clearError } =
    useAgentMemory();
  const [editing, setEditing] = useState<Editing>(null);
  const [profileDraft, setProfileDraft] = useState<string | null>(null);
  const [scope, setScope] = useState<AgentMemoryScope>('agent');

  // With no agent scope this is every entry, which is exactly Studio's view.
  const memories = useMemo(() => {
    if (!agentScope) return allMemories.filter((m) => m.agentId === undefined);
    return scope === 'agent'
      ? allMemories.filter((m) => m.agentId === agentScope.agentId)
      : allMemories.filter((m) => m.agentId === undefined);
  }, [allMemories, agentScope, scope]);

  /** Stamped onto anything added or edited while an agent scope is showing. */
  const saveInScope = useCallback(
    (input: Parameters<typeof save>[0]) =>
      save(
        agentScope && scope === 'agent' ? { ...input, agentId: agentScope.agentId } : input,
      ),
    [save, agentScope, scope],
  );

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
    if (await saveInScope({ kind: 'profile', text: profileText.trim() })) setProfileDraft(null);
  };

  const title = editing
    ? `${editing.memory ? 'Edit' : 'New'} ${editing.kind === 'rule' ? 'rule' : 'name'}`
    : agentScope
      ? `${agentScope.agentName} memory`
      : 'Assistant memory';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="w-[540px] max-h-[70vh] overflow-y-auto flex flex-col gap-4" data-memory-dialog>
        {editing ? (
          <MemoryEntryForm
            kind={editing.kind}
            {...(editing.memory ? { memory: editing.memory } : {})}
            onSave={saveInScope}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            {agentScope ? (
              <ScopeTabs
                agentName={agentScope.agentName}
                scope={scope}
                onChange={setScope}
              />
            ) : null}

            <p className="text-[11px] text-text-dim leading-snug">
              {agentScope
                ? scope === 'agent'
                  ? `Only ${agentScope.agentName} reads these. Studio and other agents never see them.`
                  : 'Every agent reads these, and so does the Studio assistant.'
                : 'The editing assistant reads everything active here on every turn.'}{' '}
              Nothing is remembered unless you add it yourself or accept a proposal — turning an
              entry off keeps it without steering the assistant.
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

/** §1.10's scope line, as the dialog's own two-way switch. */
function ScopeTabs({
  agentName,
  scope,
  onChange,
}: {
  agentName: string;
  scope: AgentMemoryScope;
  onChange: (scope: AgentMemoryScope) => void;
}) {
  return (
    <div className="flex items-center gap-1" data-memory-scope={scope}>
      {(['agent', 'all'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          data-memory-scope-tab={value}
          className={`px-2 py-[3px] rounded-[5px] text-[10px] transition-colors ${
            scope === value
              ? 'bg-app-active text-accent-light'
              : 'text-text-muted hover:bg-app-hover'
          }`}
          style={{
            border: `0.5px solid ${scope === value ? 'var(--color-accent)' : 'var(--color-border-hover)'}`,
          }}
        >
          {value === 'agent' ? agentName : 'All agents'}
        </button>
      ))}
    </div>
  );
}
