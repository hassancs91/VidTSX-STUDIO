// `approve` — accept or reject each item (agents plan §1.3), the shape the
// Studio review pattern already uses for cut plans and shot plans.
//
// Every item starts UNDECIDED rather than pre-accepted. Pre-accepting is what
// trains a reflex click-through, and the whole point of a review gate is that
// the user actually looked (AGENT_MEMORY_DESIGN M2 makes the same argument
// about memory proposals).

import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { InteractionShell } from './InteractionShell';
import { approveValues } from './values';
import type { InteractionCardProps } from './types';

type Verdict = 'approved' | 'rejected';

export function ApproveCard({
  request,
  previews,
  busy,
  restored,
  onAnswer,
  onCancel,
}: InteractionCardProps) {
  const items = request.payload.kind === 'approve' ? request.payload.items : [];
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  const decided = useMemo(
    () => items.filter((item) => verdicts[item.id] !== undefined).length,
    [items, verdicts],
  );

  const setAll = (verdict: Verdict): void => {
    setVerdicts(Object.fromEntries(items.map((item) => [item.id, verdict])));
  };

  const send = (): void => onAnswer(approveValues(items, verdicts));

  return (
    <InteractionShell
      kind="approve"
      title={request.payload.title}
      hint={`${decided} of ${items.length} decided`}
      {...(restored !== undefined ? { restored } : {})}
      {...(busy !== undefined ? { busy } : {})}
      canSend={decided === items.length && items.length > 0}
      {...(decided < items.length ? { blockedReason: 'Decide on every item' } : {})}
      sendLabel="Send decisions"
      onSend={send}
      onCancel={onCancel}
    >
      {items.length > 1 ? (
        <div className="flex items-center gap-1.5 mb-2">
          <button
            onClick={() => setAll('approved')}
            disabled={busy}
            className="rounded-[5px] px-2 py-[3px] text-[10px] text-text-secondary hover:bg-app-hover disabled:opacity-40"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            Accept all
          </button>
          <button
            onClick={() => setAll('rejected')}
            disabled={busy}
            className="rounded-[5px] px-2 py-[3px] text-[10px] text-text-secondary hover:bg-app-hover disabled:opacity-40"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            Reject all
          </button>
        </div>
      ) : null}

      <div className="space-y-1.5 pb-1">
        {items.map((item) => {
          const verdict = verdicts[item.id];
          const preview = item.artifactId ? previews?.[item.artifactId] : undefined;
          return (
            <div
              key={item.id}
              className="flex items-start gap-2 rounded-[6px] bg-app-base p-2"
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              {preview?.imageUrl ? (
                <img
                  src={preview.imageUrl}
                  alt={item.label}
                  className="shrink-0 w-[56px] h-[36px] object-cover rounded-[4px] bg-app-player"
                />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text-secondary leading-snug">{item.label}</div>
                {item.detail ? (
                  <div className="text-[10px] text-text-dim leading-snug mt-0.5">{item.detail}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <VerdictButton
                  active={verdict === 'approved'}
                  tone="accept"
                  title="Accept"
                  disabled={busy}
                  onClick={() => setVerdicts((v) => ({ ...v, [item.id]: 'approved' }))}
                />
                <VerdictButton
                  active={verdict === 'rejected'}
                  tone="reject"
                  title="Reject"
                  disabled={busy}
                  onClick={() => setVerdicts((v) => ({ ...v, [item.id]: 'rejected' }))}
                />
              </div>
            </div>
          );
        })}
      </div>
    </InteractionShell>
  );
}

function VerdictButton({
  active,
  tone,
  title,
  disabled,
  onClick,
}: {
  active: boolean;
  tone: 'accept' | 'reject';
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const colour = tone === 'accept' ? 'var(--color-accent-green)' : 'var(--color-accent-red)';
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center w-[20px] h-[20px] rounded-[5px] hover:bg-app-hover disabled:opacity-40"
      style={{
        border: `0.5px solid ${active ? colour : 'var(--color-border-hover)'}`,
        color: active ? colour : 'var(--color-text-dim)',
        background: active ? `color-mix(in srgb, ${colour} 12%, transparent)` : 'transparent',
      }}
    >
      {tone === 'accept' ? (
        <Check size={11} strokeWidth={2} />
      ) : (
        <X size={11} strokeWidth={2} />
      )}
    </button>
  );
}
