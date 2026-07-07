import { useState, useCallback } from 'react';
import { Button } from '@shared/components';
import { useLlmAITester } from '../hooks/useLlmAITester';

// ─── Icons ────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 3L4.5 7L8.5 11" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-app-base">
      <span className="text-[9px] text-text-dim uppercase">{label}</span>
      <span className="text-[11px] text-text-secondary font-mono">{value}</span>
    </div>
  );
}

// ─── Completion Tab ───────────────────────────────────────────────────

function CompletionTab({
  hook,
}: {
  hook: ReturnType<typeof useLlmAITester>;
}) {
  const [prompt, setPrompt] = useState('Write a short poem about programming.');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    hook.generate(prompt.trim(), { temperature, maxTokens });
  }, [prompt, temperature, maxTokens, hook.generate]);

  return (
    <div className="flex gap-6">
      {/* Left: Controls */}
      <div className="w-[340px] shrink-0 flex flex-col gap-3">
        {/* Model selection */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Model</div>
          <select
            className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
            value={hook.selectedModelId ?? ''}
            onChange={(e) => hook.setSelectedModelId(e.target.value)}
          >
            {hook.models.length === 0 ? (
              <option value="">No models downloaded</option>
            ) : (
              hook.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.parameterCount}, {m.quantization})
                </option>
              ))
            )}
          </select>
          {hook.selectedModelId && hook.activeModelId !== hook.selectedModelId && (
            <div className="text-[9px] text-text-dim mt-1">
              Model will be auto-loaded on generate
            </div>
          )}
          {hook.activeModelId === hook.selectedModelId && (
            <div className="flex items-center gap-1 mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-green" />
              <span className="text-[9px] text-accent-green">Loaded in memory</span>
            </div>
          )}
        </div>

        {/* Prompt */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Prompt</div>
          <textarea
            className="w-full bg-app-base border border-border rounded-[6px] px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-accent resize-none"
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-text-dim mb-1">Temperature</div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-[11px] text-text-secondary font-mono w-[32px] text-center">
                {temperature.toFixed(1)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-dim mb-1">Max tokens</div>
            <input
              type="number"
              min={32}
              max={8192}
              step={64}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 512)}
              className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Generate / Cancel */}
        <div className="flex items-center gap-3">
          {hook.generating ? (
            <Button variant="primary" onClick={hook.cancel}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!hook.selectedModelId || !prompt.trim() || hook.modelLoading}
            >
              {hook.modelLoading ? 'Loading model...' : 'Generate'}
            </Button>
          )}
          <span className="text-[10px] text-text-dim">Ctrl+Enter</span>
        </div>

        {/* Error */}
        {hook.error && (
          <div className="text-[11px] text-accent-red bg-accent-red/10 rounded-[6px] px-3 py-2">
            {hook.error}
          </div>
        )}
      </div>

      {/* Right: Output */}
      <div className="flex-1 min-w-0">
        {hook.streamedText ? (
          <div className="bg-app-surface rounded-[8px] p-3 border border-border">
            {/* Stats */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {hook.tokensGenerated > 0 && (
                <StatBadge label="Tokens" value={String(hook.tokensGenerated)} />
              )}
              {hook.tokensPerSecond > 0 && (
                <StatBadge label="Speed" value={`${hook.tokensPerSecond} t/s`} />
              )}
              {hook.stopReason && (
                <StatBadge label="Stop" value={hook.stopReason} />
              )}
              {hook.generating && (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                  </span>
                  <span className="text-[10px] text-accent-light">Generating...</span>
                </span>
              )}
            </div>

            {/* Text output */}
            <div className="text-[12px] text-text-primary whitespace-pre-wrap select-text cursor-text leading-relaxed font-mono bg-app-base rounded-[6px] p-3 max-h-[500px] overflow-auto">
              {hook.streamedText}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-[11px] text-text-dim text-center">
              {hook.generating
                ? hook.modelLoading
                  ? 'Loading model...'
                  : 'Generating...'
                : 'Output will appear here'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Tab ─────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function ChatTab({
  hook,
}: {
  hook: ReturnType<typeof useLlmAITester>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);

  const handleSend = useCallback(() => {
    if (!input.trim() || hook.generating) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    // Build full messages list with system prompt
    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (systemPrompt.trim()) {
      chatMessages.push({ role: 'system', content: systemPrompt.trim() });
    }
    chatMessages.push(...newMessages);

    hook.chat(chatMessages, { temperature, maxTokens });
  }, [input, messages, systemPrompt, temperature, maxTokens, hook]);

  // When generation completes, add assistant message
  const lastStopReason = hook.stopReason;
  const lastText = hook.streamedText;
  const prevGeneratingRef = useState(false);

  // Track when generation finishes to add assistant message
  if (prevGeneratingRef[0] && !hook.generating && lastText && lastStopReason) {
    prevGeneratingRef[1](false);
    // Add the completed assistant message
    setMessages((prev) => {
      // Avoid duplicates — only add if last message isn't this exact text
      if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === lastText) {
        return prev;
      }
      return [...prev, { role: 'assistant', content: lastText }];
    });
  }
  if (hook.generating && !prevGeneratingRef[0]) {
    prevGeneratingRef[1](true);
  }

  const handleClear = useCallback(() => {
    setMessages([]);
    window.api.localLlmSessionClear({});
  }, []);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top controls */}
      <div className="flex gap-3 items-end shrink-0">
        {/* Model */}
        <div className="w-[240px]">
          <div className="text-[10px] text-text-dim mb-1">Model</div>
          <select
            className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
            value={hook.selectedModelId ?? ''}
            onChange={(e) => hook.setSelectedModelId(e.target.value)}
          >
            {hook.models.length === 0 ? (
              <option value="">No models downloaded</option>
            ) : (
              hook.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.parameterCount})
                </option>
              ))
            )}
          </select>
        </div>

        {/* System prompt */}
        <div className="flex-1">
          <div className="text-[10px] text-text-dim mb-1">System prompt</div>
          <input
            type="text"
            className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="System prompt..."
          />
        </div>

        {/* Temp + Max tokens */}
        <div className="w-[80px]">
          <div className="text-[10px] text-text-dim mb-1">Temp</div>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
            className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
          />
        </div>
        <div className="w-[80px]">
          <div className="text-[10px] text-text-dim mb-1">Max tok</div>
          <input
            type="number"
            min={32}
            max={8192}
            step={64}
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || 512)}
            className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
          />
        </div>

        <Button variant="secondary" onClick={handleClear} disabled={hook.generating}>
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto bg-app-surface rounded-[8px] border border-border p-3 min-h-0">
        {messages.length === 0 && !hook.generating ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] text-text-dim">Send a message to start chatting</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-[8px] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap select-text cursor-text ${
                    msg.role === 'user'
                      ? 'bg-accent/15 text-text-primary'
                      : 'bg-app-base text-text-secondary'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Streaming response */}
            {hook.generating && hook.streamedText && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-[8px] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap bg-app-base text-text-secondary">
                  {hook.streamedText}
                  <span className="inline-block w-1.5 h-3 bg-accent ml-0.5 animate-pulse" />
                </div>
              </div>
            )}

            {/* Stats after completion */}
            {!hook.generating && hook.tokensPerSecond > 0 && messages.length > 0 && (
              <div className="flex items-center gap-2 justify-center">
                <StatBadge label="Tokens" value={String(hook.tokensGenerated)} />
                <StatBadge label="Speed" value={`${hook.tokensPerSecond} t/s`} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 shrink-0">
        <input
          type="text"
          className="flex-1 bg-app-base border border-border rounded-[6px] px-3 h-[36px] text-[12px] text-text-secondary outline-none focus:border-accent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={hook.generating}
        />
        {hook.generating ? (
          <Button variant="primary" onClick={hook.cancel}>Stop</Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!input.trim() || !hook.selectedModelId || hook.modelLoading}
          >
            {hook.modelLoading ? 'Loading...' : 'Send'}
          </Button>
        )}
      </div>

      {/* Error */}
      {hook.error && (
        <div className="text-[11px] text-accent-red bg-accent-red/10 rounded-[6px] px-3 py-2 shrink-0">
          {hook.error}
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

type TabId = 'completion' | 'chat';

export function LlmAITesterScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('completion');
  const hook = useLlmAITester();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] text-text-muted hover:text-text-secondary transition-colors"
        >
          <BackIcon />
          Tools
        </button>
        <div className="w-px h-4 bg-border" />
        <span className="text-[13px] font-medium text-text-secondary">LLM Tester</span>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-4">
          {([
            { id: 'completion' as const, label: 'Completion' },
            { id: 'chat' as const, label: 'Chat' },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 h-[26px] rounded-md text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-app-active text-accent-light'
                  : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Engine status */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${hook.available ? 'bg-accent-green' : 'bg-accent-red'}`} />
          <span className="text-[10px] text-text-dim">
            {hook.available ? 'Engine ready' : 'Engine unavailable'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {hook.loading ? (
          <div className="text-[12px] text-text-muted">Loading models...</div>
        ) : !hook.available ? (
          <div className="bg-app-surface rounded-[8px] p-4 border border-border text-center max-w-[600px]">
            <div className="text-[12px] text-text-secondary mb-1">node-llama-cpp engine not available</div>
            <div className="text-[10px] text-text-dim">Check that node-llama-cpp is installed correctly.</div>
          </div>
        ) : hook.models.length === 0 ? (
          <div className="bg-app-surface rounded-[8px] p-4 border border-border text-center max-w-[600px]">
            <div className="text-[12px] text-text-secondary mb-1">No models downloaded</div>
            <div className="text-[10px] text-text-dim">Download LLM models from Settings &rarr; Local Models first.</div>
          </div>
        ) : activeTab === 'completion' ? (
          <CompletionTab hook={hook} />
        ) : (
          <div className="h-full">
            <ChatTab hook={hook} />
          </div>
        )}
      </div>
    </div>
  );
}
