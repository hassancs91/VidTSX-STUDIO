import { useState, useRef, useEffect } from 'react';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { PrototyperChatMessage } from '../types';
import type { ThinkingLevel } from '../hooks/usePrototyperChat';
import { ChatMessageBubble } from './ChatMessage';

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toFixed(1)}s`;
}

function getStatusMessage(elapsedMs: number, thinkingLevel: ThinkingLevel): string {
  if (thinkingLevel === 'off') return 'Generating...';

  const seconds = elapsedMs / 1000;
  if (seconds < 5) return 'Thinking...';
  if (seconds < 15) return 'Reasoning through the problem...';
  if (seconds < 30) return 'Generating code...';
  if (seconds < 60) return 'Still working... building your prototype...';
  return 'Almost there... finalizing...';
}

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Med',
  high: 'High',
  xhigh: 'X-Hi',
  max: 'Max',
};

interface ChatPanelProps {
  chatHistory: PrototyperChatMessage[];
  loading: boolean;
  error: string | null;
  providers: LlmProviderConfig[];
  selectedProvider: string;
  onProviderChange: (id: string) => void;
  thinkingLevel: ThinkingLevel;
  onThinkingChange: (level: ThinkingLevel) => void;
  onSend: (text: string) => void;
  onNewChat: () => void;
}

export function ChatPanel({
  chatHistory,
  loading,
  error,
  providers,
  selectedProvider,
  onProviderChange,
  thinkingLevel,
  onThinkingChange,
  onSend,
  onNewChat,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) {
      return;
    }
    setElapsed(0);
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 100);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const thinkingLevels: ThinkingLevel[] = ['off', 'low', 'medium', 'high', 'xhigh', 'max'];

  return (
    <div
      className="flex flex-col h-full"
      style={{ borderRight: '0.5px solid var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[12px] font-medium text-text-primary">Chat</span>
        <button
          onClick={onNewChat}
          className="text-[11px] text-text-muted hover:text-text-primary px-2 py-0.5 rounded hover:bg-app-hover transition-colors"
        >
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-text-dim text-[13px] mb-1">Describe what you want to build</div>
            <div className="text-text-dim text-[11px]">
              e.g. "A 3D rotating cube with Three.js"
            </div>
          </div>
        )}
        {chatHistory.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div
              className="px-3 py-2 rounded-[12px] rounded-bl-[4px] text-[13px] text-text-muted"
              style={{ backgroundColor: 'var(--color-app-elevated)' }}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  {getStatusMessage(elapsed, thinkingLevel)}
                  <span className="text-[11px] text-text-dim font-mono">{formatElapsed(elapsed)}</span>
                </div>
                {thinkingLevel !== 'off' && (
                  <div className="text-[10px] text-text-dim ml-5">
                    Thinking: {THINKING_LABELS[thinkingLevel]}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="px-3 py-2 mb-3 rounded-[8px] text-[12px] text-red-400 bg-red-500/10">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-3 py-2"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        {/* Controls row */}
        <div className="flex items-center gap-2 mb-2">
          <select
            value={selectedProvider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="text-[11px] px-2 py-1 rounded-[6px] bg-app-elevated text-text-primary border-0 outline-none cursor-pointer"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-0.5 ml-auto">
            <span className="text-[10px] text-text-dim mr-1">Think:</span>
            {thinkingLevels.map((level) => (
              <button
                key={level}
                onClick={() => onThinkingChange(level)}
                className={`text-[10px] px-1.5 py-0.5 rounded-[4px] transition-colors ${
                  thinkingLevel === level
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:bg-app-hover'
                }`}
              >
                {THINKING_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea + send */}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want..."
            rows={3}
            disabled={loading}
            className="flex-1 resize-none rounded-[8px] px-3 py-2 text-[13px] text-text-primary bg-app-elevated outline-none placeholder:text-text-dim"
            style={{ border: '0.5px solid var(--color-border)' }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="self-end px-3 py-2 rounded-[8px] text-[12px] font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Send
          </button>
        </div>
        <div className="text-[10px] text-text-dim mt-1">Ctrl+Enter to send</div>
      </div>
    </div>
  );
}
