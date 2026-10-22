import { Button } from '@shared/components';
import type { SyncVerdictKind } from '@shared/studio/sync-verdict';
import type { SyncCheckState } from '../types';
import { summarizeSyncCheck, syncCheckProgressText } from '../services/sync-check';

interface SyncCheckPanelProps {
  state: SyncCheckState;
  onCancel: () => void;
  onDismiss: () => void;
  onOpenReport: (path: string) => void;
}

const toneColors: Record<SyncVerdictKind, string> = {
  pass: 'var(--color-accent-green)',
  fail: 'var(--color-accent-red)',
  inconclusive: 'var(--color-accent-amber)',
};

function fileName(p: string): string {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

/** The queue row's "Check A/V" progress and verdict (T8, END_TO_END_PLAN A6). */
export function SyncCheckPanel({ state, onCancel, onDismiss, onOpenReport }: SyncCheckPanelProps) {
  if (state.status === 'idle') return null;

  return (
    <div className="px-3 pb-2.5 pt-0" style={{ marginLeft: 76 }} data-sync-check-panel={state.status}>
      {state.status === 'running' && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-secondary" data-sync-check-progress>
            {syncCheckProgressText(state.done, state.total)}
          </span>
          <button
            onClick={onCancel}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
            data-sync-check-cancel
          >
            Cancel
          </button>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-2">
          <div
            className="flex-1 text-[11px] text-accent-red p-2 rounded"
            style={{ backgroundColor: 'rgba(240, 149, 149, 0.1)' }}
            data-sync-check-error
          >
            {state.message}
          </div>
          <button
            onClick={onDismiss}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            Hide
          </button>
        </div>
      )}

      {state.status === 'result' && (() => {
        const summary = summarizeSyncCheck(state.verdict, state.probes, state.elapsedMs);
        const color = toneColors[summary.tone];
        return (
          <div className="flex flex-col gap-1" data-sync-check-verdict={summary.tone}>
            <div className="flex items-center gap-2">
              <span
                className="px-1.5 rounded text-[9px] font-semibold uppercase shrink-0"
                style={{ color, border: `0.5px solid ${color}` }}
              >
                {summary.label}
              </span>
              <span className="text-[11px] text-text-primary truncate" title={summary.message}>
                {summary.message}
              </span>
              <button
                onClick={onDismiss}
                className="ml-auto text-[11px] text-text-muted hover:text-text-secondary transition-colors shrink-0"
              >
                Hide
              </button>
            </div>
            <div className="text-[10px] text-text-dim" data-sync-check-details>
              {summary.details}
            </div>
            {state.reportPath && (
              <div className="flex items-center gap-2 text-[10px] text-text-muted">
                <span>Report</span>
                <span className="font-mono truncate" title={state.reportPath} data-sync-check-report={state.reportPath}>
                  {fileName(state.reportPath)}
                </span>
                <Button variant="secondary" onClick={() => onOpenReport(state.reportPath ?? '')}>
                  Open report
                </Button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
