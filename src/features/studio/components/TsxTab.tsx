import { useState } from 'react';
import type { LlmImageIpc, TsxSuggestion } from '@shared/ipc/types';
import type { TsxAnalysisStatus } from '../hooks/useTsxAnalysis';
import type { SlotRuntime, SlotRuntimeStatus } from '../hooks/useTsxSlots';
import { TsxSuggestionCard } from './TsxSuggestionCard';
import { SlotEditor } from './SlotEditor';

// Edit = generate suggestions + TSX from the analyzed video (current flow).
// Generate = build slots from a prompt (full-video authoring) — coming soon.
type TsxMode = 'generate' | 'edit';

interface TsxTabProps {
  // Edit mode derives suggestions from the analysis transcript (captions are
  // preferred upstream when present, but not required). True once the project
  // has been analyzed.
  hasAnalysis: boolean;
  status: TsxAnalysisStatus;
  suggestions: TsxSuggestion[];
  error: string | null;
  userPrompt: string;
  onUserPromptChange: (value: string) => void;
  onAnalyze: () => void;
  onGenerateSlot: (suggestion: TsxSuggestion) => Promise<void>;
  getSlotStatus: (
    suggestionId: string
  ) => {
    slotId: string;
    status: SlotRuntimeStatus;
    error: string | null;
    progress: import('@shared/tsx-engine').PipelineProgress | null;
  } | null;
  // When a slot is selected on the timeline, the tab swaps to the editor view
  // for that slot. Null = show the suggestions list.
  selectedSlotRuntime: SlotRuntime | null;
  selectedSlotBrandName: string | null;
  onUpdateSlotEditor: (
    slotId: string,
    patch: { customPrompt?: string; referenceImages?: LlmImageIpc[] }
  ) => void;
  onGenerateFromSlot: (slotId: string) => void;
  // Per-slot cancel. If the slot is queued → dequeue. If running → abort.
  onCancelSlotGeneration: (slotId: string) => void;
  // Enqueue every pending slot at once. Drives the "Generate all" button.
  onGenerateAllPending: () => void;
  onDismissPendingSlot: (slotId: string) => void;
  onDeleteSlot: (slotId: string) => void;
  onClearSlotSelection: () => void;
}

export function TsxTab({
  hasAnalysis,
  status,
  suggestions,
  error,
  userPrompt,
  onUserPromptChange,
  onAnalyze,
  onGenerateSlot,
  getSlotStatus,
  selectedSlotRuntime,
  selectedSlotBrandName,
  onUpdateSlotEditor,
  onGenerateFromSlot,
  onCancelSlotGeneration,
  onGenerateAllPending,
  onDismissPendingSlot,
  onDeleteSlot,
  onClearSlotSelection,
}: TsxTabProps) {
  // When a TSX slot is selected on the timeline, the whole tab swaps to the
  // focused slot editor. This is the heart of the new flow: click a placeholder
  // on the timeline → edit prompt + images → Generate.
  // Default to Edit — the working flow. Generate is a coming-soon placeholder.
  const [mode, setMode] = useState<TsxMode>('edit');

  if (selectedSlotRuntime) {
    return (
      <SlotEditor
        runtime={selectedSlotRuntime}
        activeBrandName={selectedSlotBrandName}
        onUpdate={(patch) => onUpdateSlotEditor(selectedSlotRuntime.slot.id, patch)}
        onGenerate={() => onGenerateFromSlot(selectedSlotRuntime.slot.id)}
        onCancelGeneration={() => onCancelSlotGeneration(selectedSlotRuntime.slot.id)}
        onDismiss={() => onDismissPendingSlot(selectedSlotRuntime.slot.id)}
        onDelete={() => onDeleteSlot(selectedSlotRuntime.slot.id)}
        onBack={onClearSlotSelection}
      />
    );
  }
  const isAnalyzing = status === 'analyzing';

  return (
    <div className="flex flex-col gap-[12px] p-[12px] overflow-auto h-full">
      {/* Mode toggle: Generate (coming soon) vs Edit (current). */}
      <div
        className="flex shrink-0 rounded-[6px] p-[2px] gap-[2px]"
        style={{ backgroundColor: 'var(--color-app-base)' }}
      >
        <ModeButton
          label="Generate"
          badge="Soon"
          active={mode === 'generate'}
          onClick={() => setMode('generate')}
        />
        <ModeButton label="Edit" active={mode === 'edit'} onClick={() => setMode('edit')} />
      </div>

      {mode === 'generate' && (
        <div className="flex flex-col items-center justify-center text-center gap-[8px] py-[28px] px-[12px]">
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="text-text-ghost">
            <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
          </svg>
          <span className="text-text-primary text-[12px] font-medium">Generate from a prompt</span>
          <span className="text-text-ghost text-[10px] leading-snug max-w-[220px]">
            Describe a video and let Claude author the full timeline — multiple TSX slots
            generated from scratch, no source footage needed. Coming soon.
          </span>
        </div>
      )}

      {mode === 'edit' && (
        <>
      {/* Section header */}
      <span className="text-text-muted text-[10px] uppercase tracking-wider">
        AI Analysis
      </span>

      {/* Gated state — TSX Edit needs the analysis transcript first. */}
      {!hasAnalysis && (
        <div className="flex flex-col items-center justify-center gap-[8px] py-[24px] text-center">
          <div
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--color-app-active)',
              color: 'var(--color-text-dim)',
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 2" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <span className="text-text-muted text-[11px] font-medium">
            Run Analyze first
          </span>
          <p className="text-text-ghost text-[10px] leading-snug">
            TSX Edit requires the analysis first. Open the{' '}
            <span className="text-text-muted">Analyze</span> tab and run it.
          </p>
        </div>
      )}

      {/* Prompt + Analyze once the project has been analyzed */}
      {hasAnalysis && (
        <>
          {/* User prompt */}
          <textarea
            value={userPrompt}
            onChange={(e) => onUserPromptChange(e.target.value)}
            placeholder="Describe your video style or focus (e.g., 'tech tutorial, clean minimal style')..."
            rows={3}
            disabled={isAnalyzing}
            className="w-full shrink-0 min-h-[60px] resize-y rounded-[6px] px-[10px] py-[8px] text-[11px] leading-snug text-text-primary placeholder:text-text-ghost outline-none disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-app-hover)',
              border: '0.5px solid var(--color-border)',
            }}
          />

          {/* Analyze button */}
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="flex items-center justify-center gap-[6px] h-[30px] rounded-[6px] text-[11px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {isAnalyzing && (
              <div
                className="w-[12px] h-[12px] rounded-full border-[1.5px] border-t-transparent animate-spin"
                style={{ borderColor: 'white', borderTopColor: 'transparent' }}
              />
            )}
            {isAnalyzing
              ? 'Analyzing...'
              : suggestions.length > 0
                ? 'Re-analyze'
                : 'Analyze'}
          </button>

          {/* Loading state */}
          {isAnalyzing && (
            <div className="flex flex-col items-center gap-[8px] py-[16px]">
              <span className="text-text-dim text-[10px]">
                Analyzing transcript and suggesting animations...
              </span>
            </div>
          )}

          {/* Error */}
          {error && status !== 'analyzing' && (
            <div
              className="px-[10px] py-[8px] rounded-[6px] text-[10px]"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-status-error)',
              }}
            >
              {error}
            </div>
          )}

          {/* Results */}
          {suggestions.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-[8px]">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">
                  Suggestions ({suggestions.length})
                </span>
                {/* "Generate all" enqueues every pending slot. Disabled when
                    none remain in 'pending' (nothing to start). */}
                {suggestions.some((s) => getSlotStatus(s.id)?.status === 'pending' || !getSlotStatus(s.id)) && (
                  <button
                    onClick={onGenerateAllPending}
                    className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                    title="Queue every pending slot for generation"
                  >
                    Generate all
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-[8px]">
                {suggestions.map((suggestion) => {
                  const slotInfo = getSlotStatus(suggestion.id);
                  return (
                    <TsxSuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onGenerate={onGenerateSlot}
                      slotStatus={slotInfo?.status}
                      slotError={slotInfo?.error}
                      slotProgress={slotInfo?.progress}
                      onCancel={
                        slotInfo
                          ? () => onCancelSlotGeneration(slotInfo.slotId)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Done with no suggestions */}
          {status === 'done' && suggestions.length === 0 && !error && (
            <div className="flex items-center justify-center py-[16px]">
              <span className="text-text-ghost text-[10px]">
                No suggestions generated. Try adding a video description above.
              </span>
            </div>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}

function ModeButton({
  label,
  active,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-[5px] h-[24px] rounded-[5px] text-[11px] font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-app-surface)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-dim)',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.3)' : undefined,
      }}
    >
      {label}
      {badge && (
        <span
          className="text-[8px] font-semibold uppercase tracking-wider px-[4px] py-[1px] rounded-[3px]"
          style={{
            color: 'var(--color-accent-light)',
            backgroundColor: 'rgba(127,119,221,0.18)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
