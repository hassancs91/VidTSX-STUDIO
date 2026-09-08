// The chat message row, shared (agents plan §2, §6).
//
// A COPY of Studio's `AgentPanel` row, placed here so the agents feature and
// (later) Flows can use one row without importing Studio — decision 6 keeps
// `src/features/studio/` untouched, so Studio keeps its own file and may adopt
// this one whenever it chooses to. The two are expected to drift a little;
// that is the price of not making Studio a dependency.

import { Wrench } from 'lucide-react';

export interface ChatToolCall {
  tool: string;
  detail?: string;
}

export interface ChatRowMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls?: ChatToolCall[];
  /** Streaming — shows the cursor and the "Thinking…" placeholder. */
  pending?: boolean;
  error?: boolean;
  /** One-line note the row shows above the text (a queued job, a question). */
  note?: string;
}

interface Props {
  message: ChatRowMessage;
  /** Tool id → friendly label; unknown ids show their raw name. */
  toolLabels?: Record<string, string>;
}

export function AgentMessageRow({ message, toolLabels }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-[8px] bg-app-active px-2 py-1.5 text-[11px] text-text-primary whitespace-pre-wrap leading-snug"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {message.toolCalls?.map((call, i) => (
        <div key={`${call.tool}-${i}`} className="flex items-center gap-1 text-[10px] text-text-muted">
          <Wrench size={10} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">
            {toolLabels?.[call.tool] ?? call.tool}
            {call.detail ? ` — ${call.detail}` : ''}
          </span>
        </div>
      ))}
      {message.note ? (
        <div className="rounded-[6px] bg-accent-blue/10 px-2 py-1 text-[10px] text-accent-blue">
          {message.note}
        </div>
      ) : null}
      {message.text || message.pending ? (
        <div
          className={`text-[11px] whitespace-pre-wrap leading-snug ${
            message.error ? 'text-accent-red' : 'text-text-secondary'
          }`}
        >
          {message.text || <span className="text-text-ghost">Thinking…</span>}
          {message.pending && message.text ? <span className="animate-pulse"> ▍</span> : null}
        </div>
      ) : null}
    </div>
  );
}
