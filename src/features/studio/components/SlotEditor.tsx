import { useEffect, useState } from 'react';
import type { LlmImageIpc, TsxSuggestionCategory } from '@shared/ipc/types';
import { ReferenceImagePicker } from '@shared/components/ReferenceImagePicker';
import { useSmoothProgress } from '@shared/hooks/useSmoothProgress';
import type { PipelineProgress } from '@shared/tsx-engine';
import type { SlotRuntime, SlotRuntimeStatus } from '../hooks/useTsxSlots';

interface SlotEditorProps {
  runtime: SlotRuntime;
  // Project's resolved brand markdown — surfaced as an info chip so the user
  // can see what style is steering the next generation.
  activeBrandName: string | null;
  // Called on prompt blur and on image-list change.
  onUpdate: (patch: { customPrompt?: string; referenceImages?: LlmImageIpc[] }) => void;
  // Generate (or re-generate). Triggers the full pipeline using the slot's
  // current prompt + images.
  onGenerate: () => void;
  // Abort the active LLM call. Shown next to the progress bar while busy
  // so the user can recover from a stalled provider without restarting.
  onCancelGeneration: () => void;
  // Dismiss this slot — only valid while pending. The parent should clear
  // selection after this returns.
  onDismiss: () => void;
  // Remove this slot from the timeline entirely (also works after generation).
  onDelete: () => void;
  onBack: () => void;
}

function statusLabel(status: SlotRuntimeStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'queued':
      return 'Queued';
    case 'generating':
      return 'Generating…';
    case 'transpiling':
      return 'Transpiling…';
    case 'ready':
      return 'Ready';
    case 'error':
      return 'Error';
  }
}

function statusColor(status: SlotRuntimeStatus): string {
  switch (status) {
    case 'ready':
      return 'var(--color-status-success, #10b981)';
    case 'error':
      return 'var(--color-status-error, #ef4444)';
    case 'generating':
    case 'transpiling':
      return 'var(--color-accent-light)';
    case 'queued':
      return 'var(--color-accent-light)';
    case 'pending':
    default:
      return 'var(--color-text-dim)';
  }
}

function categoryLabel(category: TsxSuggestionCategory): string {
  return category.replace(/-/g, ' ');
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

export function SlotEditor({
  runtime,
  activeBrandName,
  onUpdate,
  onGenerate,
  onCancelGeneration,
  onDismiss,
  onBack,
  onDelete,
}: SlotEditorProps) {
  const slot = runtime.slot;
  // `queued` blocks the Generate button (it's already on its way) but still
  // shows the Cancel link so the user can dequeue without aborting active work.
  const isQueued = runtime.status === 'queued';
  const isBusy =
    isQueued ||
    runtime.status === 'generating' ||
    runtime.status === 'transpiling';
  const promptInitial = slot.customPrompt ?? slot.originalPrompt ?? '';
  const [promptDraft, setPromptDraft] = useState(promptInitial);
  const images = slot.referenceImages ?? [];

  // Smoothly interpolated progress percent. Only the `generating` stage feeds
  // real pipeline progress; `transpiling` is fast and shown as indeterminate.
  const liveProgress: PipelineProgress | null =
    runtime.status === 'generating' ? runtime.progress : null;
  const smoothPercent = useSmoothProgress(liveProgress, 'generate');
  const progressLabel = liveProgress?.stepLabel
    ?? (runtime.status === 'transpiling' ? 'Loading component…' : '');

  // Sync local draft when the caller swaps to a different slot.
  useEffect(() => {
    setPromptDraft(slot.customPrompt ?? slot.originalPrompt ?? '');
  }, [slot.id, slot.customPrompt, slot.originalPrompt]);

  const flushPrompt = () => {
    if (promptDraft !== (slot.customPrompt ?? slot.originalPrompt ?? '')) {
      onUpdate({ customPrompt: promptDraft });
    }
  };

  const resetPrompt = () => {
    setPromptDraft(slot.originalPrompt ?? '');
    onUpdate({ customPrompt: '' });
  };

  const handleImagesChange = (next: LlmImageIpc[]) => {
    onUpdate({ referenceImages: next });
  };

  const handleGenerateClick = () => {
    // Flush any pending prompt edit first so the run sees the latest text.
    if (promptDraft !== (slot.customPrompt ?? slot.originalPrompt ?? '')) {
      onUpdate({ customPrompt: promptDraft });
    }
    onGenerate();
  };

  const generateLabel =
    runtime.status === 'pending'
      ? 'Generate TSX'
      : runtime.status === 'queued'
      ? 'Queued — waiting for slot'
      : runtime.status === 'ready' || runtime.status === 'error'
      ? 'Re-generate'
      : statusLabel(runtime.status);

  return (
    <div className="flex flex-col gap-[10px] p-[12px] overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-[6px] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-text-muted hover:bg-app-hover transition-colors"
          title="Back to suggestions"
        >
          <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3L4.5 7L8.5 11" />
          </svg>
        </button>
        <span className="text-text-muted text-[10px] uppercase tracking-wider">
          Edit Slot
        </span>
        <span
          className="text-[9px] font-semibold uppercase tracking-wider px-[6px] py-[1px] rounded-[3px]"
          style={{ color: statusColor(runtime.status), border: `0.5px solid ${statusColor(runtime.status)}` }}
        >
          {statusLabel(runtime.status)}
        </span>
      </div>

      {/* Title + meta */}
      <div className="shrink-0">
        <div className="text-text-primary text-[13px] font-medium">{slot.title}</div>
        <div className="text-text-ghost text-[10px] mt-[2px]">
          {categoryLabel(slot.category)} · {formatTime(slot.startTime)} →{' '}
          {formatTime(slot.endTime)}
        </div>
      </div>

      {slot.description && (
        <div className="text-text-dim text-[11px] leading-relaxed shrink-0">
          {slot.description}
        </div>
      )}

      {/* Brand chip (info only; brand applies automatically via project binding) */}
      {activeBrandName && (
        <div
          className="shrink-0 flex items-center gap-[6px] rounded-[4px] px-[8px] py-[4px] text-[10px]"
          style={{
            backgroundColor: 'var(--color-app-base)',
            border: '0.5px solid var(--color-border)',
          }}
        >
          <span className="text-text-ghost uppercase tracking-wider">Brand</span>
          <span className="text-text-primary">{activeBrandName}</span>
        </div>
      )}

      {/* Prompt editor */}
      <div className="flex flex-col gap-[4px] shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-[10px] uppercase tracking-wider">
            Prompt
          </span>
          {slot.originalPrompt && slot.customPrompt && slot.customPrompt !== slot.originalPrompt && (
            <button
              onClick={resetPrompt}
              className="text-text-ghost text-[10px] hover:text-text-primary transition-colors"
              title="Restore the AI's original prompt"
            >
              Reset to original
            </button>
          )}
        </div>
        <textarea
          value={promptDraft}
          onChange={(e) => setPromptDraft(e.target.value)}
          onBlur={flushPrompt}
          disabled={isBusy}
          rows={8}
          className="w-full resize-none rounded-[6px] px-[10px] py-[8px] text-[11px] text-text-primary placeholder:text-text-ghost outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 font-mono leading-relaxed"
          style={{
            backgroundColor: 'var(--color-app-base)',
            border: '0.5px solid var(--color-border)',
          }}
          spellCheck={false}
        />
        <span className="text-text-ghost text-[10px]">
          Saved on blur. Edits override the AI's original prompt for this slot.
        </span>
      </div>

      {/* Reference images */}
      <div className="shrink-0">
        <ReferenceImagePicker
          images={images}
          onChange={handleImagesChange}
          disabled={isBusy}
        />
      </div>

      {/* Generate button + live progress + cancel */}
      <div className="flex flex-col gap-[6px] shrink-0">
        <button
          onClick={handleGenerateClick}
          disabled={isBusy || promptDraft.trim().length === 0}
          className="flex items-center justify-center gap-[6px] h-[32px] rounded-[6px] text-[11px] font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {isBusy && (
            <div
              className="w-[12px] h-[12px] rounded-full border-[1.5px] border-t-transparent animate-spin"
              style={{ borderColor: 'white', borderTopColor: 'transparent' }}
            />
          )}
          {generateLabel}
        </button>

        {isQueued && (
          <div className="flex items-center justify-between gap-[8px]">
            <span className="text-text-ghost text-[10px]">
              Queued — will start when current generation finishes
            </span>
            <button
              onClick={onCancelGeneration}
              className="text-text-ghost hover:text-status-error text-[10px] font-medium transition-colors"
              title="Remove from queue"
            >
              Cancel
            </button>
          </div>
        )}

        {!isQueued &&
          (runtime.status === 'generating' || runtime.status === 'transpiling') && (
            <div className="flex flex-col gap-[4px]">
              {/* Bar gets its own row so % width resolves against a known
                  container width — the prior flex-1 layout was suppressing the
                  fill in some flex contexts. Mirrors the working Motion pattern. */}
              <div className="h-[3px] rounded-full bg-app-base overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${smoothPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-[6px]">
                <span className="text-text-ghost text-[10px]">
                  {progressLabel || 'Generating…'}
                </span>
                <div className="flex items-center gap-[8px]">
                  <span className="text-text-ghost text-[10px] tabular-nums">
                    {Math.round(smoothPercent)}%
                  </span>
                  <button
                    onClick={onCancelGeneration}
                    className="text-text-ghost hover:text-status-error text-[10px] font-medium transition-colors"
                    title="Cancel generation"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Error display */}
      {runtime.status === 'error' && runtime.error && (
        <div
          className="px-[10px] py-[8px] rounded-[6px] text-[10px] shrink-0"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-status-error)',
          }}
        >
          {runtime.error}
        </div>
      )}

      <div className="flex-1" />

      {/* Footer actions — dismiss while pending, delete after generation */}
      <div className="flex items-center justify-end gap-[6px] shrink-0">
        {runtime.status === 'pending' ? (
          <button
            onClick={onDismiss}
            className="flex items-center gap-[4px] px-[10px] h-[26px] rounded-[4px] text-[10px] font-medium transition-colors"
            style={{
              color: 'var(--color-text-muted)',
              border: '0.5px solid var(--color-border)',
            }}
            title="Dismiss this idea — removes the placeholder without generating"
          >
            Dismiss
          </button>
        ) : (
          <button
            onClick={onDelete}
            disabled={isBusy}
            className="flex items-center gap-[4px] px-[10px] h-[26px] rounded-[4px] text-[10px] font-medium transition-colors disabled:opacity-50"
            style={{
              color: 'var(--color-status-error)',
              border: '0.5px solid var(--color-border)',
            }}
          >
            Delete slot
          </button>
        )}
      </div>
    </div>
  );
}
