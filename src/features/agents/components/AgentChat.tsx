// The left pane: the conversation (agents plan §1.7).
//
// The message row is the SHARED one under `src/renderer/components/agent-chat/`
// — a copy of Studio's, so Studio stays untouched (decision 6). Interactions
// are deliberately absent from this pane: a pending question renders as a card
// on the STAGE, and the chat shows only the one-line waiting state, because a
// pick between two images needs room the chat column does not have.

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, Send, Square } from 'lucide-react';
import { AgentMessageRow } from '@renderer/components/agent-chat/AgentMessageRow';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { AgentChatRow } from '../types';
import { AGENT_TOOL_LABELS } from '../services/event-folding';

interface Props {
  agentName: string;
  agentDescription: string;
  messages: AgentChatRow[];
  busy: boolean;
  waitingForAnswer: boolean;
  toolsAvailable?: boolean;
  providers: LlmProviderConfig[];
  providerId: string;
  onProviderChange: (id: string) => void;
  onSend: (text: string) => void;
  onCancel: () => void;
  onNewSession: () => void;
}

export function AgentChat({
  agentName,
  agentDescription,
  messages,
  busy,
  waitingForAnswer,
  toolsAvailable,
  providers,
  providerId,
  onProviderChange,
  onSend,
  onCancel,
  onNewSession,
}: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    onSend(text);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-2 px-2.5 h-[32px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <select
          value={providerId}
          onChange={(e) => onProviderChange(e.target.value)}
          disabled={busy}
          className="flex-1 min-w-0 h-[22px] rounded-[6px] bg-app-base px-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
          style={{ border: '0.5px solid var(--color-border-input)' }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={onNewSession}
          title="New session"
          className="flex items-center justify-center w-[20px] h-[20px] rounded-[5px] text-text-muted hover:bg-app-hover"
        >
          <RotateCcw size={12} strokeWidth={1.75} />
        </button>
      </div>

      {toolsAvailable === false ? (
        <div className="flex items-start gap-1.5 mx-2.5 mt-2 rounded-[6px] bg-amber-500/10 px-2 py-1.5 text-[10px] text-accent-amber leading-snug">
          <AlertTriangle size={11} strokeWidth={1.75} className="shrink-0 mt-[1px]" />
          <span>
            This provider cannot run tools, so {agentName} can only talk. Pick a Claude, MiniMax,
            OpenRouter, Z.AI or Kimi provider to let it work.
          </span>
        </div>
      ) : null}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-2.5">
        {messages.length === 0 ? (
          <EmptyState name={agentName} description={agentDescription} />
        ) : (
          messages.map((m) => (
            <AgentMessageRow key={m.id} message={m} toolLabels={AGENT_TOOL_LABELS} />
          ))
        )}
        {waitingForAnswer ? (
          <div className="rounded-[6px] bg-accent-blue/10 px-2 py-1.5 text-[10px] text-accent-blue leading-snug">
            Waiting for your choice — answer it on the right.
          </div>
        ) : null}
      </div>

      <div className="p-2.5 shrink-0" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <div
          className="rounded-[8px] bg-app-base px-2 py-1.5 focus-within:ring-1 focus-within:ring-accent/40"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder={`Tell ${agentName} what you want…`}
            className="w-full resize-none bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none leading-snug"
          />
          <div className="flex items-center justify-end pt-1">
            {busy ? (
              <button
                onClick={onCancel}
                title="Stop"
                className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] text-accent-blue hover:bg-accent-blue/15"
              >
                <Square size={12} strokeWidth={1.75} />
              </button>
            ) : (
              <button
                onClick={submit}
                title="Send (Enter)"
                disabled={draft.trim().length === 0}
                className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] text-accent-blue hover:bg-accent-blue/15 disabled:opacity-40"
              >
                <Send size={12} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-3">
      <div className="text-[12px] font-medium text-text-secondary">{name}</div>
      <div className="text-[11px] text-text-dim leading-snug max-w-[240px]">{description}</div>
    </div>
  );
}
