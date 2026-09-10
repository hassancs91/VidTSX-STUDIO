import { Play, Square, Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { isRunActive, type RunState } from '../hooks/useFlowRun';

interface Props {
  runState: RunState;
  onRun: () => void;
  onCancel: () => void;
  onResume: () => void;
}

function StatusBadge({ runState }: { runState: RunState }) {
  if (runState.status === 'idle') return null;
  if (isRunActive(runState.status)) {
    const doneCount = Object.values(runState.nodes).filter((s) => s.status === 'done').length;
    const totalCount = Object.values(runState.nodes).length;
    return (
      <span className="flex items-center gap-1 text-[11px] text-text-muted" data-run-status={runState.status}>
        <Loader2 size={11} strokeWidth={1.8} className="animate-spin text-accent" />
        {runState.status === 'queued' ? 'Starting' : runState.status === 'paused' ? 'Paused' : 'Running'}{' '}
        {doneCount}/{totalCount}
      </span>
    );
  }
  if (runState.status === 'success') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-400" data-run-status="success">
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
        data-run-status="error"
      >
        <AlertCircle size={11} strokeWidth={1.8} />
        {runState.error ?? 'Error'}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-text-muted" data-run-status="cancelled">
      Cancelled
    </span>
  );
}

const SECONDARY =
  'flex items-center gap-1.5 px-3 py-1 rounded-md bg-app-surface text-text-secondary hover:bg-app-hover text-[11px] font-medium';

export function RunControls({ runState, onRun, onCancel, onResume }: Props) {
  const active = isRunActive(runState.status);

  return (
    <div className="flex items-center gap-2">
      <StatusBadge runState={runState} />
      {active ? (
        <button onClick={onCancel} className={SECONDARY} style={{ border: '0.5px solid var(--color-border)' }}>
          <Square size={11} strokeWidth={2} />
          Cancel
        </button>
      ) : (
        <>
          {runState.resumable && (
            <button
              onClick={onResume}
              className={SECONDARY}
              style={{ border: '0.5px solid var(--color-border)' }}
              title="Rerun from the first step that did not finish"
              data-run-resume
            >
              <RotateCcw size={11} strokeWidth={2} />
              Resume
            </button>
          )}
          <button
            onClick={onRun}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent text-white hover:opacity-90 text-[11px] font-medium"
            data-run-start
          >
            <Play size={11} strokeWidth={2} fill="currentColor" />
            Run
          </button>
        </>
      )}
    </div>
  );
}
