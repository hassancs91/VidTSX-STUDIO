import { useState, useCallback } from 'react';
import { useModerationTester, type ModerationHistoryEntry } from '../hooks/useModerationTester';

// ─── Icons ────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 3L4.5 7L8.5 11" />
  </svg>
);

const ShieldIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5L2.5 4v4c0 3.5 2.5 5.5 5.5 6.5 3-1 5.5-3 5.5-6.5V4L8 1.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7.5L6 10.5L11 4" />
  </svg>
);

const XIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3L11 11M11 3L3 11" />
  </svg>
);

// ─── Sub-components ──────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-app-base">
      <span className="text-[9px] text-text-dim uppercase">{label}</span>
      <span className="text-[11px] text-text-secondary font-mono">{value}</span>
    </div>
  );
}

function MatchRow({ match }: { match: { term: string; category: string; language: string; severity: string } }) {
  const severityColor =
    match.severity === 'high' ? 'text-red-400' :
    match.severity === 'medium' ? 'text-yellow-400' :
    'text-text-dim';

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 text-[11px] text-text-primary font-mono">{match.term}</td>
      <td className="px-3 py-2 text-[11px] text-text-secondary">{match.category}</td>
      <td className="px-3 py-2 text-[11px] text-text-secondary uppercase">{match.language}</td>
      <td className={`px-3 py-2 text-[11px] font-medium ${severityColor}`}>{match.severity}</td>
    </tr>
  );
}

function HistoryItem({ entry }: { entry: ModerationHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <div
      className="bg-app-surface rounded-[6px] border border-border overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-app-hover transition-colors"
      >
        <div className={`shrink-0 ${entry.result.flagged ? 'text-red-400' : 'text-accent-green'}`}>
          {entry.result.flagged ? <XIcon /> : <CheckIcon />}
        </div>
        <span className="text-[11px] text-text-primary truncate flex-1">{entry.text}</span>
        <span className="text-[9px] text-text-dim shrink-0">{time}</span>
        {entry.result.flagged && (
          <span className="text-[9px] text-red-400 shrink-0">
            {entry.result.matches.length} match{entry.result.matches.length !== 1 ? 'es' : ''}
          </span>
        )}
      </button>
      {expanded && entry.result.flagged && entry.result.matches.length > 0 && (
        <div className="border-t border-border">
          <table className="w-full">
            <thead>
              <tr className="text-[9px] text-text-dim uppercase">
                <th className="text-left px-3 py-1.5 font-normal">Term</th>
                <th className="text-left px-3 py-1.5 font-normal">Category</th>
                <th className="text-left px-3 py-1.5 font-normal">Lang</th>
                <th className="text-left px-3 py-1.5 font-normal">Severity</th>
              </tr>
            </thead>
            <tbody>
              {entry.result.matches.map((m, i) => (
                <MatchRow key={i} match={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────

interface ModerationTesterScreenProps {
  onBack: () => void;
}

export function ModerationTesterScreen({ onBack }: ModerationTesterScreenProps) {
  const { checking, lastResult, history, error, check, clearHistory, clearError } = useModerationTester();
  const [input, setInput] = useState('');

  const handleSubmit = useCallback(() => {
    if (input.trim() && !checking) {
      check(input.trim());
    }
  }, [input, checking, check]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors mr-3"
        >
          <BackIcon />
          Tools
        </button>
        <div className="flex items-center gap-1.5 text-text-secondary">
          <ShieldIcon />
          <span className="text-[13px] font-medium">Moderation Tester</span>
        </div>
        {lastResult && (
          <div className="flex items-center gap-2 ml-auto">
            <StatBadge label="Terms" value={String(lastResult.termCount)} />
            <StatBadge label="Languages" value={String(lastResult.languages.length)} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Input area */}
        <div className="p-4 shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <div className="flex flex-col gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a prompt to test moderation... (Enter to check, Shift+Enter for newline)"
              className="w-full h-[80px] px-3 py-2 rounded-[6px] bg-app-base border border-border text-[12px] text-text-primary placeholder-text-dim resize-none focus:outline-none focus:border-accent transition-colors"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || checking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-accent text-white text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShieldIcon />
                {checking ? 'Checking...' : 'Check'}
              </button>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="px-3 py-1.5 rounded-[6px] bg-app-surface border border-border text-[11px] text-text-muted hover:text-text-primary transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 rounded-[6px] bg-red-500/10 border border-red-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-red-400">{error}</span>
                <button onClick={clearError} className="text-red-400 hover:text-red-300">
                  <XIcon />
                </button>
              </div>
            </div>
          )}

          {/* Last result banner */}
          {lastResult && !error && (
            <div
              className={`mt-3 px-3 py-2 rounded-[6px] border ${
                lastResult.flagged
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={lastResult.flagged ? 'text-red-400' : 'text-emerald-400'}>
                  {lastResult.flagged ? <XIcon /> : <CheckIcon />}
                </div>
                <span className={`text-[12px] font-medium ${lastResult.flagged ? 'text-red-400' : 'text-emerald-400'}`}>
                  {lastResult.flagged
                    ? `Flagged — ${lastResult.matches.length} match${lastResult.matches.length !== 1 ? 'es' : ''} in ${lastResult.categories.join(', ')}`
                    : 'Clean — no prohibited content detected'}
                </span>
              </div>

              {/* Match details */}
              {lastResult.flagged && lastResult.matches.length > 0 && (
                <div className="mt-2 rounded-[4px] bg-app-base/50 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[9px] text-text-dim uppercase">
                        <th className="text-left px-3 py-1.5 font-normal">Term</th>
                        <th className="text-left px-3 py-1.5 font-normal">Category</th>
                        <th className="text-left px-3 py-1.5 font-normal">Lang</th>
                        <th className="text-left px-3 py-1.5 font-normal">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastResult.matches.map((m, i) => (
                        <MatchRow key={i} match={m} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-dim">
              <ShieldIcon />
              <p className="mt-2 text-[12px]">Enter a prompt above to test the moderation engine</p>
              <p className="text-[10px] mt-1">Checks for nudity, sexual, and pornographic content across 20 languages</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1">
                History ({history.length})
              </div>
              {history.map((entry, i) => (
                <HistoryItem key={entry.timestamp + '-' + i} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
