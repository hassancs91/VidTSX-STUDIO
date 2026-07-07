import { Play, Square, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { RunState } from '../hooks/useFlowRun';

interface Props {
  runState: RunState;
  onRun: () => void;
  onCancel: () => void;
}

function StatusBadge({ runState }: { runState: RunState }) {
  if (runState.status === 'idle') return null;
  if (runState.status === 'running') {
    const doneCount = Object.values(runState.nodes).filter((s) => s.status === 'done').length;
    const totalCount = Object.values(runState.nodes).length;
    return (
      <span className="flex items-center gap-1 text-[11px] text-text-muted">
        <Loader2 size={11} strokeWidth={1.8} className="animate-spin text-accent" />
        Running {doneCount}/{totalCount}
      </span>
    );
  }
  if (runState.status === 'success') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
        <CheckCircle2 size={11} strokeWidth={1.8} />
        Complete
      </span>
    );
  }
  if (runState.status === 'error') {
    return (
      <span
        className="flex items-center gap-1 text-[11px] text-accent-red max-w-[260px] truncate"
        title={runState.error ?? undefined}
      >
        <AlertCircle size={11} strokeWidth={1.8} />
        {runState.error ?? 'Error'}
      </span>
    );
  }
  if (runState.status === 'cancelled') {
    return <span className="text-[11px] text-text-muted">Cancelled</span>;
  }
  return null;
}

export function RunControls({ runState, onRun, onCancel }: Props) {
  const isRunning = runState.status === 'running';

  return (
    <div className="flex items-center gap-2">
      <StatusBadge runState={runState} />
      {isRunning ? (
        <button
          onClick={onCancel}
          className="
            flex items-center gap-1.5 px-3 py-1 rounded-md
            bg-app-surface text-text-secondary hover:bg-app-hover
            text-[11px] font-medium
          "
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          <Square size={11} strokeWidth={2} />
          Cancel
        </button>
      ) : (
        <button
          onClick={onRun}
          className="
            flex items-center gap-1.5 px-3 py-1 rounded-md
            bg-accent text-white hover:opacity-90
            text-[11px] font-medium
          "
        >
          <Play size={11} strokeWidth={2} fill="currentColor" />
          Run
        </button>
      )}
    </div>
  );
}
