import { useEffect, useRef, useState } from 'react';
import { History, CheckCircle2, AlertCircle, Square, Loader2 } from 'lucide-react';
import type { FlowRunSummary, FlowRunStatus } from '@shared/ipc/types';

interface Props {
  runs: FlowRunSummary[];
  activeRunId: string | null;
  onSelect: (runId: string) => void;
  onClear?: () => void;
  disabled?: boolean;
}

const STATUS_LABEL: Record<FlowRunStatus, string> = {
  running: 'Running',
  success: 'Success',
  error: 'Error',
  cancelled: 'Cancelled',
};

function StatusIcon({ status }: { status: FlowRunStatus }) {
  if (status === 'success') return <CheckCircle2 size={11} strokeWidth={1.8} className="text-emerald-400" />;
  if (status === 'error') return <AlertCircle size={11} strokeWidth={1.8} className="text-accent-red" />;
  if (status === 'cancelled') return <Square size={11} strokeWidth={1.8} className="text-text-muted" />;
  return <Loader2 size={11} strokeWidth={1.8} className="animate-spin text-accent" />;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function formatDuration(start: number, finish: number | null): string | null {
  if (finish === null) return null;
  const ms = finish - start;
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  return `${s}s`;
}

export function RunHistoryDropdown({ runs, activeRunId, onSelect, onClear, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="
          flex items-center gap-1.5 px-2 py-1 rounded-md
          bg-app-surface text-text-secondary hover:bg-app-hover
          text-[11px] font-medium disabled:opacity-50
        "
        style={{ border: '0.5px solid var(--color-border)' }}
        title="Run history"
      >
        <History size={11} strokeWidth={2} />
        Runs
        {runs.length > 0 && (
          <span className="text-text-muted">({runs.length})</span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-[260px] max-h-[320px] overflow-y-auto bg-app-surface rounded-md shadow-lg z-50"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {runs.length === 0 ? (
            <div className="px-3 py-4 text-[11px] text-text-muted text-center">
              No runs yet
            </div>
          ) : (
            <ul>
              {runs.map((r) => {
                const duration = formatDuration(r.startedAt, r.finishedAt);
                const isActive = activeRunId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        onSelect(r.id);
                        setOpen(false);
                      }}
                      className={`
                        w-full text-left px-3 py-2 flex items-center gap-2
                        text-[11px] hover:bg-app-hover
                        ${isActive ? 'bg-app-hover' : ''}
                      `}
                    >
                      <StatusIcon status={r.status} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-text-secondary truncate">
                          {formatTime(r.startedAt)}
                        </span>
                        <span className="block text-text-muted text-[10px]">
                          {STATUS_LABEL[r.status]}
                          {duration ? ` · ${duration}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {onClear && activeRunId && (
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-[11px] text-text-muted hover:bg-app-hover hover:text-text-secondary"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
