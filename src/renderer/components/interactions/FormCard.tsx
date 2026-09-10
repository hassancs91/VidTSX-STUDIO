// `form` — typed answers to one or more fields (agents plan §1.3).
//
// The starter tree (§1.9) asks its questions through the same card shape, so
// the user never sees a seam between "the questions the package ships" and
// "the questions the agent thought of".

import { useMemo, useState } from 'react';
import type { InteractionFormField } from '../../../shared/types/agents';
import { InteractionShell } from './InteractionShell';
import { formValues, missingRequiredFields } from './values';
import type { InteractionCardProps, InteractionValues } from './types';

/** Empty means "not answered", which is what `required` is checked against. */
type Draft = Record<string, string>;

function initialDraft(fields: InteractionFormField[], initial?: InteractionValues): Draft {
  const draft: Draft = {};
  for (const field of fields) draft[field.id] = initial?.[field.id]?.[0] ?? '';
  return draft;
}

export function FormCard({
  request,
  initialValues,
  busy,
  restored,
  onAnswer,
  onCancel,
  cancelLabel,
}: InteractionCardProps) {
  const fields = request.payload.kind === 'form' ? request.payload.fields : [];
  const [draft, setDraft] = useState<Draft>(() => initialDraft(fields, initialValues));

  const missing = useMemo(() => missingRequiredFields(fields, draft), [fields, draft]);

  const send = (): void => onAnswer(formValues(fields, draft));

  const answered = Object.values(draft).some((v) => v.trim().length > 0);

  return (
    <InteractionShell
      kind="form"
      title={request.payload.title}
      hint={fields.length > 1 ? `${fields.length} things to fill in` : undefined}
      {...(restored !== undefined ? { restored } : {})}
      {...(busy !== undefined ? { busy } : {})}
      canSend={missing.length === 0 && answered}
      {...(missing.length > 0
        ? { blockedReason: `${missing[0].label} is required` }
        : !answered
          ? { blockedReason: 'Fill in at least one field' }
          : {})}
      onSend={send}
      onCancel={onCancel}
      {...(cancelLabel !== undefined ? { cancelLabel } : {})}
    >
      <div className="space-y-2.5 pb-1">
        {fields.map((field) => (
          <label key={field.id} className="block">
            <span className="block text-[11px] text-text-muted mb-1 leading-snug">
              {field.label}
              {field.required ? <span className="text-accent-red"> *</span> : null}
            </span>
            {field.kind === 'select' ? (
              <select
                value={draft[field.id] ?? ''}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, [field.id]: e.target.value }))}
                className="w-full h-[26px] rounded-[6px] bg-app-base px-2 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
                style={{ border: '0.5px solid var(--color-border-input)' }}
              >
                <option value="">Choose…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.kind === 'multiline' ? (
              <textarea
                value={draft[field.id] ?? ''}
                disabled={busy}
                rows={3}
                placeholder={field.placeholder ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [field.id]: e.target.value }))}
                className="w-full resize-none rounded-[6px] bg-app-base px-2 py-1.5 text-[11px] text-text-secondary placeholder:text-text-ghost outline-none focus:border-accent leading-snug"
                style={{ border: '0.5px solid var(--color-border-input)' }}
              />
            ) : (
              <input
                type="text"
                value={draft[field.id] ?? ''}
                disabled={busy}
                placeholder={field.placeholder ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [field.id]: e.target.value }))}
                className="w-full h-[26px] rounded-[6px] bg-app-base px-2 text-[11px] text-text-secondary placeholder:text-text-ghost outline-none focus:border-accent"
                style={{ border: '0.5px solid var(--color-border-input)' }}
              />
            )}
          </label>
        ))}
      </div>
    </InteractionShell>
  );
}
