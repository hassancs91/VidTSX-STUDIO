import { Button } from '@shared/components';
import type { BuildBudget, TsxJobIpc } from '@shared/ipc/types';
import { BUDGET_CHOICES, budgetHint } from '../services/build-job-request';

interface Props {
  prompt: string;
  onPromptChange: (value: string) => void;
  budget: BuildBudget;
  onBudgetChange: (value: BuildBudget) => void;
  onApply: () => void;
  /** A provider is picked: an edit can start. */
  canApply: boolean;
  /** The open project's edit in flight, if any: the box is busy until it ends. */
  job: TsxJobIpc | null;
  onCancel: () => void;
  /** A builder edit: bring its progress back to the centre. */
  onShowProgress?: () => void;
}

/**
 * The Creator's later messages (P3 part 3): a change to the open version, run
 * as a builder edit at the picked budget. While an edit of this project runs,
 * the box shows where it is, a way back to its progress, and Cancel.
 */
export function EditComposer({ prompt, onPromptChange, budget, onBudgetChange, onApply, canApply, job, onCancel, onShowProgress }: Props) {
  const busy = job !== null;
  const status = !job
    ? ''
    : job.status === 'queued'
      ? 'Queued: one build runs at a time'
      : job.progress.label;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !busy && canApply && prompt.trim()) onApply();
  };

  return (
    <div className="shrink-0 p-3 flex flex-col gap-2" style={{ borderTop: '0.5px solid var(--color-border)' }} data-edit-composer>
      <span className="text-[11px] text-text-muted font-medium">Edit</span>
      <textarea
        className="bg-app-base text-text-primary rounded-[6px] px-3 py-2 resize-none focus:outline-none w-full"
        style={{ fontSize: 11, border: '0.5px solid var(--color-border-input)', height: 56, fontFamily: 'inherit' }}
        placeholder="Describe a change to this version…"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-input)'; }}
        disabled={busy}
        data-edit-prompt
      />
      {busy ? (
        <div className="flex items-center gap-2 min-w-0" data-edit-status>
          <span className="text-[10px] text-text-secondary truncate" title={status}>{status}</span>
          {onShowProgress && (
            <button onClick={onShowProgress} className="shrink-0 text-[10px] text-accent hover:underline cursor-pointer" data-edit-show>
              Show progress
            </button>
          )}
          <button
            onClick={onCancel}
            className="ml-auto shrink-0 px-3 py-1 rounded-[6px] text-[11px] font-medium transition-colors cursor-pointer text-red-400 hover:text-white hover:bg-red-500/80"
            style={{ border: '1px solid rgba(239,68,68,0.4)' }}
            data-edit-cancel
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex rounded-[6px] overflow-hidden shrink-0" style={{ border: '0.5px solid var(--color-border)' }} title={budgetHint(budget)}>
            {BUDGET_CHOICES.map((choice, i) => (
              <button
                key={choice.value}
                onClick={() => onBudgetChange(choice.value)}
                className={`px-[6px] py-[3px] text-[10px] transition-colors duration-150 cursor-pointer ${
                  budget === choice.value ? 'bg-accent text-white' : 'bg-app-base text-text-muted hover:bg-app-hover'
                }`}
                style={{ borderRight: i < BUDGET_CHOICES.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}
                data-edit-budget={choice.value}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <span className="text-[9px] text-text-dim truncate">{budgetHint(budget)}</span>
          <Button variant="primary" className="ml-auto shrink-0" onClick={onApply} disabled={!prompt.trim() || !canApply} data-edit-apply>
            Apply
          </Button>
        </div>
      )}
      {busy && job.status !== 'queued' && (
        <div className="h-[3px] rounded-full bg-app-base overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-[width] duration-500" style={{ width: `${job.progress.percent}%` }} />
        </div>
      )}
    </div>
  );
}
