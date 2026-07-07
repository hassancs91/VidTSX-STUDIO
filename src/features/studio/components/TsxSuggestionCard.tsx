import type { TsxSuggestion, TsxSuggestionCategory } from '@shared/ipc/types';
import type { PipelineProgress } from '@shared/tsx-engine';
import { useSmoothProgress } from '@shared/hooks/useSmoothProgress';
import type { SlotRuntimeStatus } from '../hooks/useTsxSlots';

interface TsxSuggestionCardProps {
  suggestion: TsxSuggestion;
  onGenerate: (suggestion: TsxSuggestion) => void;
  slotStatus?: SlotRuntimeStatus;
  slotError?: string | null;
  // Live pipeline progress while `slotStatus === 'generating'`. The card
  // shows the same compact bar + Cancel link the SlotEditor uses, so users
  // get feedback from the suggestions list without opening the editor.
  slotProgress?: PipelineProgress | null;
  onCancel?: () => void;
}

const CATEGORY_COLORS: Record<TsxSuggestionCategory, string> = {
  'text-overlay': '#7F77DD',
  'lower-third': '#5DCAA5',
  'highlight': '#EF9F27',
  'callout': '#F09595',
  'data-visual': '#85B7EB',
  'custom': '#9CA3AF',
};

const CATEGORY_LABELS: Record<TsxSuggestionCategory, string> = {
  'text-overlay': 'Text',
  'lower-third': 'Lower Third',
  'highlight': 'Highlight',
  'callout': 'Callout',
  'data-visual': 'Data',
  'custom': 'Custom',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TsxSuggestionCard({
  suggestion,
  onGenerate,
  slotStatus,
  slotError,
  slotProgress,
  onCancel,
}: TsxSuggestionCardProps) {
  const color = CATEGORY_COLORS[suggestion.category] ?? CATEGORY_COLORS.custom;
  const label = CATEGORY_LABELS[suggestion.category] ?? 'Custom';
  const duration = (suggestion.endTime - suggestion.startTime).toFixed(1);
  const isQueued = slotStatus === 'queued';
  const isWorking = slotStatus === 'generating' || slotStatus === 'transpiling';
  const isReady = slotStatus === 'ready';

  // Same smoothing curve as the SlotEditor — only fed during the
  // generation stage; transpile is fast and shows an indeterminate label.
  const liveProgress: PipelineProgress | null =
    slotStatus === 'generating' ? slotProgress ?? null : null;
  const smoothPercent = useSmoothProgress(liveProgress, 'generate');
  const progressLabel = liveProgress?.stepLabel
    ?? (slotStatus === 'transpiling' ? 'Loading component…' : '');

  return (
    <div
      className="flex flex-col gap-[6px] p-[10px] rounded-[6px]"
      style={{
        backgroundColor: 'var(--color-app-active)',
        borderLeft: isReady ? '3px solid #5DCAA5' : undefined,
      }}
    >
      {/* Top row: badge + timing */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[6px]">
          <span
            className="px-[6px] py-[1px] rounded-[3px] text-[9px] font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {label}
          </span>
          <span className="text-text-dim text-[10px]">
            {formatTime(suggestion.startTime)} → {formatTime(suggestion.endTime)}
          </span>
        </div>
        <span className="text-text-ghost text-[9px]">{duration}s</span>
      </div>

      {/* Title */}
      <span className="text-text-primary text-[11px] font-medium leading-tight">
        {suggestion.title}
      </span>

      {/* Description */}
      <span className="text-text-dim text-[10px] leading-snug">
        {suggestion.description}
      </span>

      {/* Slot error */}
      {slotStatus === 'error' && slotError && (
        <span className="text-[9px]" style={{ color: 'var(--color-status-error)' }}>
          {slotError}
        </span>
      )}

      {/* Generate / status button */}
      <div className="flex items-center justify-between mt-[2px]">
        {isReady && (
          <div className="flex items-center gap-[4px]">
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
              <circle cx={5} cy={5} r={4} fill="#5DCAA5" />
              <path d="M3 5L4.5 6.5L7 3.5" stroke="white" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[9px]" style={{ color: '#5DCAA5' }}>Generated</span>
          </div>
        )}
        {!isReady && <div />}

        <button
          onClick={() => onGenerate(suggestion)}
          disabled={isWorking || isQueued}
          className="flex items-center gap-[4px] px-[10px] h-[22px] rounded-[4px] text-[10px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {isWorking && (
            <div
              className="w-[8px] h-[8px] rounded-full border-[1px] border-t-transparent animate-spin"
              style={{ borderColor: 'white', borderTopColor: 'transparent' }}
            />
          )}
          {isQueued
            ? 'Queued'
            : isWorking
              ? slotStatus === 'generating' ? 'Generating...' : 'Loading...'
              : isReady
                ? 'Regenerate'
                : 'Generate'}
        </button>
      </div>

      {/* Queued line — slot is waiting for its turn. Compact single line with
          a cancel link that just dequeues (won't abort active generation). */}
      {isQueued && (
        <div className="flex items-center justify-between gap-[6px] mt-[2px]">
          <span className="text-text-ghost text-[9px]">
            Waiting in queue…
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-text-ghost hover:text-status-error text-[9px] font-medium transition-colors"
              title="Remove from queue"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Live progress bar — bar on its own row so % width resolves against
          a known container, matching the working Motion pattern. */}
      {isWorking && (
        <div className="flex flex-col gap-[3px] mt-[2px]">
          <div className="h-[3px] rounded-full bg-app-base overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${smoothPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-[6px]">
            <span className="text-text-ghost text-[9px]">
              {progressLabel || 'Generating…'}
            </span>
            <div className="flex items-center gap-[8px]">
              <span className="text-text-ghost text-[9px] tabular-nums">
                {Math.round(smoothPercent)}%
              </span>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-text-ghost hover:text-status-error text-[9px] font-medium transition-colors"
                  title="Cancel generation"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
