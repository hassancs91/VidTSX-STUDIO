import { Check, Loader2 } from 'lucide-react';
import type { OpenProgress } from '../services/open-stages';

interface Props {
  progress: OpenProgress;
  /** Shown after a while so a hung module can never trap the user. */
  onSkip?: () => void;
}

/** The staged "opening a project" panel (video-10 feedback item 2): one row
 *  per stage plus a bar. Presentational — EditorShell draws it before the
 *  editor mounts, OpenProgressOverlay draws it over the editor while shots load. */
export function OpenProgressView({ progress, onSkip }: Props) {
  return (
    <div className="flex items-center justify-center h-full bg-app-base" data-open-progress>
      <div
        role="status"
        aria-live="polite"
        className="w-[260px] flex flex-col gap-3 p-4 rounded-[8px] bg-app-surface"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="text-[12px] font-medium text-text-secondary">Loading project…</div>
        <div className="h-[3px] rounded-full bg-app-active overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>
        <ul className="flex flex-col gap-1.5">
          {progress.stages.map((stage) => (
            <li
              key={stage.id}
              data-open-stage={stage.id}
              data-state={stage.state}
              className={`flex items-center gap-2 text-[11px] ${
                stage.state === 'pending' ? 'text-text-ghost' : stage.state === 'active' ? 'text-text-secondary' : 'text-text-muted'
              }`}
            >
              <span className="w-[12px] flex justify-center">
                {stage.state === 'done' ? (
                  <Check size={11} strokeWidth={2} className="text-accent" />
                ) : stage.state === 'active' ? (
                  <Loader2 size={11} strokeWidth={2} className="animate-spin" />
                ) : (
                  <span className="w-[4px] h-[4px] rounded-full bg-current" />
                )}
              </span>
              <span className="flex-1">{stage.label}</span>
              {stage.detail && <span className="tabular-nums text-text-dim">{stage.detail}</span>}
            </li>
          ))}
        </ul>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="self-start text-[10px] text-text-dim hover:text-text-secondary transition-colors"
          >
            Open without waiting
          </button>
        )}
      </div>
    </div>
  );
}
