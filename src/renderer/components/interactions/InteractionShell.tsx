// The frame every interaction card shares: the question, the note when it was
// asked before a restart, and the footer. Split out so each card is only its
// own control — a form is fields, a pick is candidates, an approve is rows —
// and so the three never drift apart visually.
//
// UI_SPEC: panel surface, 8px radius, 0.5px borders, 11px labels, purple
// primary / outline secondary buttons.

import type { ReactNode } from 'react';
import { HelpCircle, History } from 'lucide-react';

interface Props {
  /** The payload kind, published on the root as `data-interaction-card` so a
   *  caller (or a UI driver) can scope to the card. It matters: the filmstrip
   *  shows the same document titles the candidates do, so an unscoped
   *  text match finds the thumbnail. */
  kind: string;
  title: string;
  /** One line under the title — what the card wants the user to do. */
  hint?: string;
  restored?: boolean;
  busy?: boolean;
  /** Disabled until the card has a valid answer. */
  canSend: boolean;
  sendLabel?: string;
  /** Why Send is disabled, shown in the footer rather than as a mystery. */
  blockedReason?: string;
  onSend: () => void;
  onCancel: () => void;
  /** Wider for a side-by-side pick; the default suits text. */
  wide?: boolean;
  children: ReactNode;
}

export function InteractionShell({
  kind,
  title,
  hint,
  restored,
  busy,
  canSend,
  sendLabel = 'Send answer',
  blockedReason,
  onSend,
  onCancel,
  wide,
  children,
}: Props) {
  return (
    <div
      className={`flex flex-col w-full ${wide ? 'max-w-[720px]' : 'max-w-[440px]'} max-h-full rounded-[8px] bg-app-surface`}
      style={{ border: '0.5px solid var(--color-accent)' }}
      data-interaction-card={kind}
    >
      <div className="shrink-0 px-3.5 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <HelpCircle size={14} strokeWidth={1.75} className="shrink-0 mt-[1px] text-accent-light" />
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-text-primary leading-snug">{title}</div>
            {hint ? (
              <div className="text-[10px] text-text-dim leading-snug mt-0.5">{hint}</div>
            ) : null}
          </div>
        </div>
        {restored ? (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-text-dim">
            <History size={10} strokeWidth={1.75} />
            <span>Asked in an earlier run — your answer still reaches the agent.</span>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3.5">{children}</div>

      <div className="flex items-center justify-between gap-2 shrink-0 px-3.5 py-2.5 mt-2">
        <span className="text-[10px] text-text-dim leading-snug min-w-0 truncate">
          {busy ? 'Sending…' : (blockedReason ?? '')}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-[6px] px-2.5 py-1 text-[11px] text-text-secondary hover:bg-app-hover disabled:opacity-40"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            Skip and chat
          </button>
          <button
            onClick={onSend}
            disabled={!canSend || busy}
            className="rounded-[6px] bg-accent px-2.5 py-1 text-[11px] text-white hover:opacity-90 disabled:opacity-40"
          >
            {sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
