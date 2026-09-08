// A question the agent is waiting on — the STAGE-3 placeholder.
//
// Stage 4 owns interactions: `form`, `pick` (with compare mode for images) and
// `approve` cards, in a registry under `src/renderer/components/interactions/`.
// Until then a session can still END UP with a pending question — `ask_user`
// ships and the tool works — so this card exists to make that state legible and
// escapable rather than a dead end. It shows what was asked and lets the user
// dismiss it, which sends the cancelled reply the broker already understands.

import { HelpCircle } from 'lucide-react';
import type { InteractionRequest } from '@shared/types/agents';

interface Props {
  request: InteractionRequest;
  onDismiss: () => void;
}

function questionLines(request: InteractionRequest): string[] {
  const { payload } = request;
  switch (payload.kind) {
    case 'form':
      return payload.fields.map((f) => f.label);
    case 'pick':
      return payload.candidates.map((c) => c.label);
    case 'approve':
      return payload.items.map((i) => i.label);
  }
}

export function PendingQuestionCard({ request, onDismiss }: Props) {
  return (
    <div
      className="w-full max-w-[420px] rounded-[8px] bg-app-surface p-4"
      style={{ border: '0.5px solid var(--color-accent)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle size={14} strokeWidth={1.75} className="text-accent-light" />
        <span className="text-[12px] font-medium text-text-primary">{request.payload.title}</span>
      </div>
      <div className="space-y-0.5 mb-3">
        {questionLines(request).map((line, i) => (
          <div key={i} className="text-[11px] text-text-secondary leading-snug">
            · {line}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-text-dim leading-snug mb-3">
        Answer it in the chat box — the agent reads your next message as the reply. Interactive
        cards arrive in the next release.
      </div>
      <button
        onClick={onDismiss}
        className="rounded-[6px] px-2.5 py-1 text-[11px] text-text-secondary hover:bg-app-hover"
        style={{ border: '0.5px solid var(--color-border-hover)' }}
      >
        Dismiss and keep chatting
      </button>
    </div>
  );
}
