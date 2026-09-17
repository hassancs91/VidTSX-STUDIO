import { Button, ProgressBar, StatusBadge } from '@shared/components';

export type LocalRuntimeState =
  | 'checking'
  | 'installed'
  | 'missing'
  | 'installing'
  | 'update-available'
  | 'broken';

interface LocalRuntimeChipProps {
  /** `data-local-runtime` hook (sd-cli · whisper-cpp · ai-runtime). */
  id: string;
  /** "sd-cli", "whisper.cpp", "AI runtime". */
  name: string;
  /** What it powers — the name's tooltip. */
  description?: string;
  state: LocalRuntimeState;
  /** After the badge: a version, a size, "manage on Overview". */
  detail?: string;
  /** Install / Update / Repair. Omit to show no button. */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /** 0–100 while installing; null = indeterminate (extracting, verifying). */
  progress?: number | null;
  /** Phase copy under the bar ("Downloading… 42% · 3.1 MB/s", "Extracting…"). */
  progressLabel?: string;
  error?: string | null;
}

const BADGE: Record<LocalRuntimeState, { tone: 'success' | 'warn' | 'error' | 'neutral' | 'accent'; label: string }> = {
  checking: { tone: 'neutral', label: 'Checking…' },
  installed: { tone: 'success', label: 'Installed' },
  missing: { tone: 'warn', label: 'Not installed' },
  installing: { tone: 'accent', label: 'Installing' },
  'update-available': { tone: 'warn', label: 'Update available' },
  broken: { tone: 'error', label: 'Needs repair' },
};

/**
 * The first chip of a local-model status strip (docs/ai-models-redesign.md
 * §3.3): the runtime the section depends on, its state, and an inline Install
 * with the download bar — the old full-width setup cards folded into one
 * line. The full runtime table with Update / Remove lives on Overview.
 */
export function LocalRuntimeChip({
  id,
  name,
  description,
  state,
  detail,
  actionLabel,
  onAction,
  actionDisabled,
  progress,
  progressLabel,
  error,
}: LocalRuntimeChipProps) {
  const badge = BADGE[state];
  const showAction = Boolean(actionLabel && onAction) && state !== 'installing' && state !== 'checking';

  return (
    <div className="min-w-0" data-local-runtime={id} data-runtime-state={state}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-text-muted">Runtime</span>
        <span className="text-[12px] font-medium text-text-secondary" title={description}>
          {name}
        </span>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        {detail && <span className="text-[10px] text-text-dim">{detail}</span>}
        {showAction && (
          <Button
            variant={state === 'installed' ? 'secondary' : 'primary'}
            size="sm"
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionLabel}
          </Button>
        )}
      </div>

      {state === 'installing' && (
        <div className="mt-1.5 w-[280px] max-w-full">
          <ProgressBar value={Math.max(progress ?? 0, 0)} />
          {progressLabel && <div className="mt-1 text-[10px] text-text-dim">{progressLabel}</div>}
        </div>
      )}

      {error && <div className="mt-1 text-[11px] text-accent-red">{error}</div>}
    </div>
  );
}
