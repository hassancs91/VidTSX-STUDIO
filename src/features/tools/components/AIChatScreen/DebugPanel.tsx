import type { AIChatMessage } from '../../hooks/useAIChat';
import { formatDuration, formatFileSize, formatTimestamp } from './utils/format';

export function DebugPanel({ message }: { message: AIChatMessage | null }) {
  if (!message) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[11px] text-text-dim">Click a message to inspect</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-auto p-3 h-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: message.role === 'user' ? 'var(--color-accent)' : 'rgba(34,197,94,0.15)',
              color: message.role === 'user' ? '#fff' : 'rgb(34,197,94)',
            }}
          >
            {message.role}
          </span>
          <span className="text-[9px] text-text-dim">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>

      {/* Metadata */}
      {message.role === 'assistant' && (
        <div
          className="rounded-[6px] p-2 flex flex-col gap-1 text-[10px]"
          style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
        >
          <div className="flex justify-between">
            <span className="text-text-dim">Model</span>
            <span className="text-text-secondary">{message.model ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Provider</span>
            <span className="text-text-secondary">{message.provider ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Duration</span>
            <span className="text-text-secondary">{message.durationMs != null ? formatDuration(message.durationMs) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Thinking</span>
            <span className="text-text-secondary">{message.thinkingLevel ?? 'off'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Content length</span>
            <span className="text-text-secondary">{message.content.length} chars</span>
          </div>
          {message.thinking && (
            <div className="flex justify-between">
              <span className="text-text-dim">Thinking length</span>
              <span className="text-text-secondary">{message.thinking.length} chars</span>
            </div>
          )}
        </div>
      )}

      {/* Attached images */}
      {message.images && message.images.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-dim font-medium">Attached Images ({message.images.length})</span>
          <div
            className="rounded-[6px] p-2 flex flex-col gap-1.5 text-[10px]"
            style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
          >
            {message.images.map((img, i) => (
              <div key={i} className="flex items-center gap-2">
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt={img.name}
                  className="rounded-[4px] h-[32px] w-[32px] object-cover shrink-0"
                  style={{ border: '0.5px solid var(--color-border)' }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-text-secondary truncate">{img.name}</span>
                  <div className="flex gap-2 text-text-dim">
                    <span>{img.mediaType.replace('image/', '')}</span>
                    <span>{formatFileSize(img.sizeBytes)}</span>
                    <span>{Math.round(img.data.length * 3 / 4 / 1024)}KB base64</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage stats */}
      {message.usage && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-dim font-medium">Usage Stats</span>
          <div
            className="rounded-[6px] p-2 flex flex-col gap-1 text-[10px]"
            style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
          >
            <div className="flex justify-between">
              <span className="text-text-dim">Input tokens</span>
              <span className="text-text-secondary">{message.usage.inputTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Output tokens</span>
              <span className="text-text-secondary">{message.usage.outputTokens.toLocaleString()}</span>
            </div>
            {message.usage.cacheReadInputTokens != null && (
              <div className="flex justify-between">
                <span className="text-text-dim">Cache read tokens</span>
                <span className="text-text-secondary">{message.usage.cacheReadInputTokens.toLocaleString()}</span>
              </div>
            )}
            {message.usage.costUsd != null && (
              <div className="flex justify-between">
                <span className="text-text-dim">Cost</span>
                <span className="text-green-400">${message.usage.costUsd.toFixed(4)}</span>
              </div>
            )}
            {message.usage.numTurns != null && message.usage.numTurns > 1 && (
              <div className="flex justify-between">
                <span className="text-text-dim">Reflection passes</span>
                <span className="text-text-secondary">{message.usage.numTurns}</span>
              </div>
            )}
            {message.usage.durationApiMs != null && (
              <div className="flex justify-between">
                <span className="text-text-dim">API time</span>
                <span className="text-text-secondary">{formatDuration(message.usage.durationApiMs)}</span>
              </div>
            )}
          </div>

          {/* Per-pass / per-turn timings */}
          {message.usage.turnTimings && message.usage.turnTimings.length > 1 && (() => {
            const isReflection = (message.usage!.numTurns ?? 1) > 1;
            return (
              <div
                className="rounded-[6px] p-2 flex flex-col gap-1 text-[10px] mt-1"
                style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
              >
                <span className="text-text-dim font-medium mb-0.5">
                  {isReflection ? 'Pass Timings' : 'Turn Timings'}
                </span>
                {message.usage!.turnTimings!.map((t) => (
                  <div key={t.turn} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-secondary">
                        {isReflection
                          ? (t.turn === 1 ? 'Generate' : `Reflect ${t.turn - 1}`)
                          : `Turn ${t.turn}`
                        }
                      </span>
                      {t.hasThinking && (
                        <span className="text-[8px] px-1 py-0 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--color-accent)' }}>
                          thinking{t.thinkingChars ? ` (${t.thinkingChars} chars)` : ''}
                        </span>
                      )}
                    </div>
                    <span className="text-text-dim">{formatDuration(t.durationMs)}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Per-model breakdown */}
          {message.usage.modelUsage && Object.keys(message.usage.modelUsage).length > 0 && (
            <div
              className="rounded-[6px] p-2 flex flex-col gap-1 text-[10px] mt-1"
              style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
            >
              <span className="text-text-dim font-medium mb-0.5">Model Breakdown</span>
              {Object.entries(message.usage.modelUsage).map(([model, mu]) => (
                <div key={model} className="flex flex-col gap-0.5">
                  <span className="text-text-secondary text-[9px]">{model}</span>
                  <div className="flex gap-3 pl-2">
                    <span className="text-text-dim">in: {mu.inputTokens.toLocaleString()}</span>
                    <span className="text-text-dim">out: {mu.outputTokens.toLocaleString()}</span>
                    {mu.cacheReadInputTokens != null && <span className="text-text-dim">cache: {mu.cacheReadInputTokens.toLocaleString()}</span>}
                    {mu.costUsd != null && <span className="text-green-400">${mu.costUsd.toFixed(4)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thinking output */}
      {message.thinking && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-dim font-medium">Thinking Output</span>
          <pre
            className="text-[10px] text-text-secondary leading-relaxed whitespace-pre-wrap break-words rounded-[6px] p-2 overflow-auto max-h-[300px]"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '0.5px solid rgba(99,102,241,0.2)' }}
          >
            {message.thinking}
          </pre>
        </div>
      )}

      {/* Raw content */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-text-dim font-medium">Raw Content</span>
        <pre
          className="text-[10px] text-text-secondary leading-relaxed whitespace-pre-wrap break-words rounded-[6px] p-2 overflow-auto max-h-[300px]"
          style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
        >
          {message.content}
        </pre>
      </div>

      {/* Engine debug log */}
      {message.debugLog && message.debugLog.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-dim font-medium">Engine Log</span>
          <div
            className="rounded-[6px] p-2 flex flex-col gap-0.5 overflow-auto max-h-[250px]"
            style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
          >
            {message.debugLog.map((log, i) => (
              <div
                key={i}
                className={`text-[10px] leading-relaxed ${log.startsWith('[engine]') ? 'text-yellow-500' : 'text-text-dim'}`}
                style={{ fontFamily: 'monospace' }}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
