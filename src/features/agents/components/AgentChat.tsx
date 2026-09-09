// The left pane: the conversation (agents plan §1.7).
//
// The message row is the SHARED one under `src/renderer/components/agent-chat/`
// — a copy of Studio's, so Studio stays untouched (decision 6). Interactions
// are deliberately absent from this pane: a pending question renders as a card
// on the STAGE, and the chat shows only the one-line waiting state, because a
// pick between two images needs room the chat column does not have.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Brain, RotateCcw, Send, Square } from 'lucide-react';
import { AgentMessageRow } from '@renderer/components/agent-chat/AgentMessageRow';
import { ModelPickerChip } from '@renderer/components/ModelPickerChip';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { AgentChatRow } from '../types';
import { AGENT_TOOL_LABELS } from '../services/event-folding';
import { QuickStarts } from './QuickStarts';

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
  /** Model on the provider; '' = its default (W1). */
  model: string;
  onModelChange: (model: string) => void;
  /** W4: the session brand chip, rendered beside the model chip. */
  brandPicker?: ReactNode;
  onSend: (text: string) => void;
  onCancel: () => void;
  onNewSession: () => void;
  /** §1.10 — opens the shared MemoryDialog scoped to this agent. */
  onOpenMemory: () => void;
  /**
   * Text to drop into the box, NEVER sent (§1.9): the starter's rendered
   * `opening`, or a quick start. The token is what lets the same text be
   * prefilled twice — clicking one quick start, editing, clicking it again.
   */
  prefill?: { text: string; token: number };
  /** §1.9's one-click sample prompts, shown on the empty state. */
  quickStarts?: string[];
  onQuickStart?: (prompt: string) => void;
  /**
   * Set while the starter owns the screen: the box is disabled and says why,
   * because there is no session to send to until the starter is done with.
   */
  composerHint?: string;
  /** A pending `propose_memory` card, rendered under the conversation. */
  memoryProposal?: ReactNode;
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
  model,
  onModelChange,
  brandPicker,
  onSend,
  onCancel,
  onNewSession,
  onOpenMemory,
  memoryProposal,
  prefill,
  quickStarts,
  onQuickStart,
  composerHint,
}: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Prefill, never auto-send. The cursor lands at the end so the user can keep
  // typing where the starter left off.
  useEffect(() => {
    if (!prefill) return;
    setDraft(prefill.text);
    const box = boxRef.current;
    if (box) {
      box.focus();
      box.setSelectionRange(prefill.text.length, prefill.text.length);
    }
  }, [prefill]);

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
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <ModelPickerChip
            providers={providers}
            providerId={providerId}
            onProviderChange={onProviderChange}
            model={model}
            onModelChange={onModelChange}
            disabled={busy}
          />
          {brandPicker}
        </div>
        <button
          onClick={onOpenMemory}
          title="What this agent remembers"
          data-agent-memory-button
          className="flex items-center justify-center w-[20px] h-[20px] rounded-[5px] text-text-muted hover:bg-app-hover"
        >
          <Brain size={12} strokeWidth={1.75} />
        </button>
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
          <EmptyState name={agentName} description={agentDescription}>
            {quickStarts?.length && onQuickStart ? (
              <QuickStarts prompts={quickStarts} disabled={busy} onPick={onQuickStart} />
            ) : null}
          </EmptyState>
        ) : (
          messages.map((m) => (
            <AgentMessageRow key={m.id} message={m} toolLabels={AGENT_TOOL_LABELS} />
          ))
        )}
        {memoryProposal}
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
            ref={boxRef}
            value={draft}
            disabled={composerHint !== undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder={composerHint ?? `Tell ${agentName} what you want…`}
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

function EmptyState({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-3">
      <div className="text-[12px] font-medium text-text-secondary">{name}</div>
      <div className="text-[11px] text-text-dim leading-snug max-w-[240px]">{description}</div>
      {children}
    </div>
  );
}
