import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Scissors, Send, Sparkles, Square, Wrench } from 'lucide-react';
import type { AgentChatMessage, UseStudioAgentResult } from '../hooks/useStudioAgent';

interface Props {
  agent: UseStudioAgentResult;
}

/** The Assistant tab: chat with the editing agent. Cut proposals it creates
 *  land on the timeline + Inspector review flow — never applied directly. */
export function AgentPanel({ agent }: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, busy, send, cancel, clear } = agent;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    void send(text);
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-2.5">
        {messages.length === 0 ? <EmptyState /> : messages.map((m) => <MessageRow key={m.id} message={m} />)}
      </div>

      <div className="p-2.5 shrink-0" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <div
          className="rounded-[8px] bg-app-base px-2 py-1.5 focus-within:ring-1 focus-within:ring-accent-blue/40"
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
            rows={2}
            placeholder="Describe an edit… e.g. “do an editorial pass — cut retakes and fillers”"
            className="w-full resize-none bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none leading-snug"
          />
          <div className="flex items-center justify-end gap-1 pt-1">
            {messages.length > 0 && !busy && (
              <IconAction title="Clear conversation" onClick={clear}>
                <RotateCcw size={12} strokeWidth={1.75} />
              </IconAction>
            )}
            {busy ? (
              <IconAction title="Stop the assistant" onClick={cancel} accent>
                <Square size={12} strokeWidth={1.75} />
              </IconAction>
            ) : (
              <IconAction title="Send (Enter)" onClick={submit} accent disabled={draft.trim().length === 0}>
                <Send size={12} strokeWidth={1.75} />
              </IconAction>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center px-3">
      <Sparkles size={26} strokeWidth={1.25} className="text-text-ghost" />
      <div className="text-[12px] font-medium text-text-secondary">Editing assistant</div>
      <div className="text-[11px] text-text-dim leading-snug max-w-[220px]">
        Ask for an editorial pass over a transcribed clip — retakes, false starts, and filler words
        come back as a cut proposal you review on the timeline before anything applies.
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: AgentChatMessage }) {
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
        <div key={i} className="flex items-center gap-1 text-[10px] text-text-muted">
          <Wrench size={10} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">
            {call.tool === 'get_transcript' ? 'Reading transcript' : call.tool === 'propose_cuts' ? 'Proposing cuts' : call.tool}
            {call.detail ? ` — ${call.detail}` : ''}
          </span>
        </div>
      ))}
      {message.proposalNote && (
        <div className="flex items-center gap-1.5 rounded-[6px] bg-accent-blue/10 px-2 py-1 text-[10px] text-accent-blue">
          <Scissors size={11} strokeWidth={1.75} className="shrink-0" />
          <span>{message.proposalNote}</span>
        </div>
      )}
      {(message.text || message.pending) && (
        <div
          className={`text-[11px] whitespace-pre-wrap leading-snug ${
            message.error ? 'text-red-400' : 'text-text-secondary'
          }`}
        >
          {message.text || <span className="text-text-ghost">Thinking…</span>}
          {message.pending && message.text ? <span className="animate-pulse"> ▍</span> : null}
        </div>
      )}
    </div>
  );
}

function IconAction({
  title,
  onClick,
  children,
  accent,
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center w-[22px] h-[22px] rounded-[5px] transition-colors disabled:opacity-40 ${
        accent
          ? 'text-accent-blue hover:bg-accent-blue/15'
          : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
