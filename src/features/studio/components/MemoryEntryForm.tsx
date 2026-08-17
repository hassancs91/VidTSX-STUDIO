import { useState } from 'react';
import { TextInput } from '@shared/components/TextInput';
import { Button } from '@shared/components/Button';
import { MEMORY_TEXT_LIMITS, type StudioMemory } from '@shared/types/studio-memory';
import type { MemorySaveRequest } from '@shared/ipc/types';

interface Props {
  kind: 'rule' | 'vocabulary';
  /** Present = edit; absent = create. */
  memory?: StudioMemory;
  onSave: (input: MemorySaveRequest) => Promise<boolean>;
  onCancel: () => void;
}

/** Create/edit form for the two list tiers. Profile is a singleton free-text
 *  box edited inline in the dialog (QM1), so it never comes through here. */
export function MemoryEntryForm({ kind, memory, onSave, onCancel }: Props) {
  const [text, setText] = useState(memory?.text ?? '');
  const [aliases, setAliases] = useState((memory?.aliases ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const aliasList = aliases
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      const ok = await onSave({
        ...(memory ? { id: memory.id } : {}),
        kind,
        text: trimmed,
        ...(kind === 'vocabulary' ? { aliases: aliasList } : {}),
      });
      if (ok) onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-memory-form={kind}>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {kind === 'rule' ? 'Rule' : 'Correct spelling'}
        </span>
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MEMORY_TEXT_LIMITS[kind]}
          placeholder={
            kind === 'rule'
              ? 'e.g. Cut filler tight — no breathing room between sentences'
              : 'e.g. LearnWithHasan'
          }
          autoFocus
          required
        />
        {kind === 'rule' && (
          <span className="text-[10px] text-text-dim leading-snug">
            An imperative the assistant obeys on every project. Keep it one sentence.
          </span>
        )}
      </label>

      {kind === 'vocabulary' && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            Misspellings it corrects (comma-separated, optional)
          </span>
          <TextInput
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="e.g. learn with Hassan, LearnWithHassan"
          />
        </label>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!text.trim() || submitting}>
          {submitting ? 'Saving…' : memory ? 'Save' : 'Add'}
        </Button>
      </div>
    </form>
  );
}
