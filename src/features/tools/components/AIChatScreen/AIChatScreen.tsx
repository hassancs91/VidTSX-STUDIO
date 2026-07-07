import { useState, useRef, useEffect, useCallback } from 'react';
import { useAIChat } from '../../hooks/useAIChat';
import type { AIChatMessage } from '../../hooks/useAIChat';
import type { ThinkingLevel } from '@shared/tsx-engine';
import { MessageBubble } from './MessageBubble';
import { DebugPanel } from './DebugPanel';
import { THINKING_LEVELS, AGENT_TOOLS } from './constants';
import { formatDuration, formatFileSize, getLoadingLabel } from './utils/format';

interface AIChatScreenProps {
  onBack: () => void;
}

export function AIChatScreen({ onBack }: AIChatScreenProps) {
  const chat = useAIChat();
  const [input, setInput] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      chat.addImage(files[i]);
    }
    e.target.value = '';
  }, [chat.addImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        chat.addImage(files[i]);
      }
    }
  }, [chat.addImage]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) chat.addImage(file);
      }
    }
  }, [chat.addImage]);

  const selectedMessage = chat.messages.find((m) => m.id === selectedMsgId) ?? null;

  // Auto-select latest assistant message in debug mode
  useEffect(() => {
    if (!showDebug) return;
    const lastAssistant = [...chat.messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) setSelectedMsgId(lastAssistant.id);
  }, [chat.messages.length, showDebug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages.length, chat.loading]);

  useEffect(() => {
    if (chat.loading) {
      setElapsed(0);
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [chat.loading]);

  const handleSend = () => {
    if (!input.trim() || chat.loading) return;
    chat.send(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !chat.loading && input.trim()) {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0 gap-2"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button onClick={onBack} className="text-text-dim hover:text-text-primary transition-colors cursor-pointer">
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8L10 13" />
          </svg>
        </button>
        <span className="text-[13px] font-medium text-text-secondary flex-1">AI Chat</span>

        <select
          className="bg-app-base border border-border rounded-[4px] px-1.5 py-0.5 text-[10px] text-text-secondary outline-none cursor-pointer"
          value={chat.selectedProvider}
          onChange={(e) => chat.setSelectedProvider(e.target.value)}
          disabled={chat.loading}
        >
          {chat.providers.length === 0 ? (
            <option value="">No providers</option>
          ) : (
            chat.providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))
          )}
        </select>

        <div className="flex rounded-[4px] overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
          {THINKING_LEVELS.map((level, idx) => (
            <button
              key={level.value}
              onClick={() => chat.setThinkingLevel(level.value)}
              disabled={chat.loading}
              className={`px-[6px] py-[2px] text-[9px] transition-colors cursor-pointer ${
                chat.thinkingLevel === level.value
                  ? 'bg-accent text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{ borderRight: idx < THINKING_LEVELS.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}
            >
              {level.label}
            </button>
          ))}
        </div>

        {/* Loops */}
        <div className="flex rounded-[4px] overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
          {[1, 2, 3, 4, 5].map((n, i) => (
            <button
              key={n}
              onClick={() => chat.setLoopCount(n)}
              disabled={chat.loading}
              className={`px-[5px] py-[2px] text-[9px] transition-colors cursor-pointer ${
                chat.loopCount === n
                  ? 'bg-accent text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{ borderRight: i !== 4 ? '0.5px solid var(--color-border)' : 'none' }}
              title={n === 1 ? 'No reflection' : `${n - 1} reflection pass${n > 2 ? 'es' : ''}`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Agent Tools */}
        <div className="flex rounded-[4px] overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
          {AGENT_TOOLS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => chat.toggleTool(t.id)}
              disabled={chat.loading}
              className={`px-[5px] py-[2px] text-[9px] transition-colors cursor-pointer ${
                chat.enabledTools.includes(t.id)
                  ? 'bg-orange-500 text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{ borderRight: i !== AGENT_TOOLS.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Skills */}
        {chat.availableSkills.length > 0 && (
          <div className="flex rounded-[4px] overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
            {chat.availableSkills.map((s, i) => (
              <button
                key={s.id}
                onClick={() => chat.toggleSkill(s.id)}
                disabled={chat.loading}
                className={`px-[5px] py-[2px] text-[9px] transition-colors cursor-pointer ${
                  chat.enabledSkills.includes(s.id)
                    ? 'bg-purple-500 text-white'
                    : 'bg-app-base text-text-muted hover:bg-app-hover'
                }`}
                style={{ borderRight: i !== chat.availableSkills.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}
                title={s.description}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowSystem(!showSystem)}
          className={`text-[9px] px-1.5 py-0.5 rounded-[4px] cursor-pointer transition-colors ${
            showSystem ? 'bg-accent text-white' : 'text-text-dim hover:text-text-muted'
          }`}
          style={!showSystem ? { border: '0.5px solid var(--color-border)' } : {}}
          title="System prompt"
        >
          SYS
        </button>

        <button
          onClick={() => setShowDebug(!showDebug)}
          className={`text-[9px] px-1.5 py-0.5 rounded-[4px] cursor-pointer transition-colors ${
            showDebug ? 'bg-yellow-500 text-white' : 'text-text-dim hover:text-text-muted'
          }`}
          style={!showDebug ? { border: '0.5px solid var(--color-border)' } : {}}
          title="Debug panel"
        >
          DEBUG
        </button>

        <button
          onClick={chat.clear}
          disabled={chat.loading || chat.messages.length === 0}
          className="text-[9px] text-text-dim hover:text-text-muted cursor-pointer px-1.5 py-0.5 rounded-[4px] disabled:opacity-30"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          Clear
        </button>
      </div>

      {/* System prompt area */}
      {showSystem && (
        <div className="px-3 py-2 bg-app-surface" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <textarea
            className="w-full bg-app-base text-text-primary rounded-[6px] px-2 py-1.5 text-[11px] resize-none focus:outline-none"
            style={{ border: '0.5px solid var(--color-border-input)', minHeight: 50, fontFamily: 'inherit' }}
            placeholder="System prompt (optional)..."
            value={chat.systemPrompt}
            onChange={(e) => chat.setSystemPrompt(e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-input)'; }}
          />
        </div>
      )}

      {/* Main content: chat + optional debug panel */}
      <div className="flex-1 flex min-h-0">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-auto p-3">
            {chat.messages.length === 0 && !chat.loading && (
              <div className="flex items-center justify-center h-full">
                <span className="text-[12px] text-text-dim">Send a message to test the AI engine</span>
              </div>
            )}
            {chat.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                selected={showDebug && msg.id === selectedMsgId}
                onSelect={() => showDebug && setSelectedMsgId(msg.id)}
              />
            ))}
            {chat.loading && (
              <div className="flex justify-start mb-3">
                <div
                  className="px-3 py-2 rounded-[12px] rounded-bl-[4px] text-[12px] text-text-dim flex flex-col gap-1"
                  style={{ backgroundColor: 'var(--color-app-elevated)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-[6px] h-[6px] rounded-full bg-accent animate-pulse" />
                    <span>{getLoadingLabel(elapsed, chat.thinkingLevel, chat.loopCount)}</span>
                    {elapsed > 0 && <span className="text-text-dim">{formatDuration(elapsed)}</span>}
                  </div>
                  {(chat.thinkingLevel !== 'off' || chat.loopCount > 1 || chat.enabledTools.length > 0) && (
                    <div className="flex gap-1.5 mt-0.5 flex-wrap">
                      {chat.thinkingLevel !== 'off' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--color-accent)' }}>
                          thinking: {chat.thinkingLevel}
                        </span>
                      )}
                      {chat.loopCount > 1 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)' }}>
                          reflect: {chat.loopCount - 1}x
                        </span>
                      )}
                      {chat.enabledTools.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: 'rgb(249,115,22)' }}>
                          tools: {chat.enabledTools.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {chat.error && (
              <div className="text-[11px] text-red-400 px-2 py-1 mb-2">{chat.error}</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className="px-3 py-2 bg-app-surface"
            style={{ borderTop: '0.5px solid var(--color-border)' }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Pending image thumbnails */}
            {chat.pendingImages.length > 0 && (
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {chat.pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={`data:${img.mediaType};base64,${img.data}`}
                      alt={img.name}
                      className="rounded-[6px] h-[48px] w-[48px] object-cover"
                      style={{ border: '1px solid var(--color-border)' }}
                    />
                    <button
                      onClick={() => chat.removeImage(i)}
                      className="absolute -top-1 -right-1 w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      x
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 text-[7px] text-center text-white bg-black/50 rounded-b-[6px] truncate px-0.5">
                      {formatFileSize(img.sizeBytes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={chat.loading}
                className="shrink-0 p-2 rounded-[8px] text-text-dim hover:text-text-primary hover:bg-app-hover transition-colors cursor-pointer disabled:opacity-30"
                title="Attach image (or paste/drop)"
              >
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <circle cx="5.5" cy="5.5" r="1" />
                  <path d="M14 10L10.5 7L4 14" />
                </svg>
              </button>
              <textarea
                className="flex-1 bg-app-base text-text-primary rounded-[8px] px-3 py-2 text-[12px] resize-none focus:outline-none"
                style={{ border: '0.5px solid var(--color-border-input)', minHeight: 38, maxHeight: 120, fontFamily: 'inherit' }}
                placeholder={chat.pendingImages.length > 0 ? 'Describe what to do with the image(s)...' : 'Type a message... (Ctrl+Enter to send)'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-input)'; }}
                disabled={chat.loading}
              />
              {chat.loading ? (
                <button
                  onClick={chat.cancel}
                  className="shrink-0 px-3 py-2 rounded-[8px] text-[11px] font-medium text-red-400 hover:text-white hover:bg-red-500/80 transition-colors cursor-pointer"
                  style={{ border: '1px solid rgba(239,68,68,0.4)' }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || !chat.selectedProvider}
                  className="shrink-0 px-3 py-2 rounded-[8px] text-[11px] font-medium bg-accent text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-30"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Debug panel */}
        {showDebug && (
          <div
            className="w-[340px] shrink-0 bg-app-surface overflow-hidden flex flex-col"
            style={{ borderLeft: '0.5px solid var(--color-border)' }}
          >
            <div className="px-3 py-2 text-[10px] text-text-dim font-medium shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
              Debug Inspector
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <DebugPanel message={selectedMessage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
