// `pick` — choose one or several of a set (agents plan §1.3).
//
// COMPARE MODE is the point of putting this card on the STAGE rather than in
// the chat column: when every candidate names an artifact the host could
// resolve to a picture, they are laid out side by side at the size you would
// actually judge them at. With no pictures it falls back to a list, which is
// what a choice between two documents looks like.

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { InteractionCandidate } from '../../../shared/types/agents';
import { InteractionShell } from './InteractionShell';
import { pickValues } from './values';
import type { InteractionCardProps, InteractionPreview } from './types';

function hasEveryPicture(
  candidates: InteractionCandidate[],
  previews: Record<string, InteractionPreview> | undefined,
): boolean {
  if (!previews || candidates.length < 2) return false;
  return candidates.every((c) => c.artifactId && previews[c.artifactId]?.imageUrl);
}

export function PickCard({
  request,
  initialValues,
  previews,
  busy,
  restored,
  onAnswer,
  onCancel,
  cancelLabel,
}: InteractionCardProps) {
  const payload = request.payload.kind === 'pick' ? request.payload : null;
  const candidates = payload?.candidates ?? [];
  const many = payload?.select === 'many';
  // Seeded from `initialValues` so the starter's Back restores what was picked;
  // an id the payload no longer carries is dropped rather than sent back.
  const [chosen, setChosen] = useState<string[]>(() =>
    Object.keys(initialValues ?? {}).filter((id) => candidates.some((c) => c.id === id)),
  );

  const compare = hasEveryPicture(candidates, previews);

  const toggle = (id: string): void => {
    setChosen((current) => {
      if (!many) return [id];
      return current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    });
  };

  // Keyed by the candidate's OWN id, valued with the label the user read, so
  // the reply message names both (see `values.ts`).
  const send = (): void => onAnswer(pickValues(candidates, chosen));

  return (
    <InteractionShell
      kind="pick"
      title={request.payload.title}
      hint={many ? 'Choose any that apply' : 'Choose one'}
      wide={compare}
      {...(restored !== undefined ? { restored } : {})}
      {...(busy !== undefined ? { busy } : {})}
      canSend={chosen.length > 0}
      {...(chosen.length === 0 ? { blockedReason: 'Nothing chosen yet' } : {})}
      onSend={send}
      onCancel={onCancel}
      {...(cancelLabel !== undefined ? { cancelLabel } : {})}
    >
      <div className={compare ? 'grid grid-cols-2 gap-2 pb-1' : 'space-y-1.5 pb-1'}>
        {candidates.map((candidate) => {
          const selected = chosen.includes(candidate.id);
          const preview = candidate.artifactId ? previews?.[candidate.artifactId] : undefined;
          return (
            <button
              key={candidate.id}
              onClick={() => toggle(candidate.id)}
              disabled={busy}
              data-interaction-option={candidate.id}
              aria-pressed={selected}
              className={`relative w-full text-left rounded-[6px] p-2 transition-colors disabled:opacity-50 ${
                selected ? 'bg-app-active' : 'bg-app-base hover:bg-app-hover'
              }`}
              style={{
                border: `0.5px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              {preview?.imageUrl ? (
                <img
                  src={preview.imageUrl}
                  alt={candidate.label}
                  className="w-full aspect-video object-contain rounded-[4px] bg-app-player mb-1.5"
                />
              ) : null}
              <div className="flex items-start gap-1.5">
                <span
                  className={`flex items-center justify-center shrink-0 w-[13px] h-[13px] mt-[1px] ${
                    many ? 'rounded-[3px]' : 'rounded-full'
                  }`}
                  style={{
                    border: `0.5px solid ${selected ? 'var(--color-accent)' : 'var(--color-border-hover)'}`,
                    background: selected ? 'var(--color-accent)' : 'transparent',
                  }}
                >
                  {selected ? <Check size={9} strokeWidth={2.5} className="text-white" /> : null}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[11px] leading-snug ${selected ? 'text-accent-light' : 'text-text-secondary'}`}
                  >
                    {candidate.label}
                  </span>
                  {candidate.detail ? (
                    <span className="block text-[10px] text-text-dim leading-snug mt-0.5">
                      {candidate.detail}
                    </span>
                  ) : null}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </InteractionShell>
  );
}
