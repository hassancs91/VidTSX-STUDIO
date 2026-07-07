import { useState } from 'react';
import type { StudioCutPlan, StudioCutPlanFlag } from '@shared/ipc/types';

export type AutoCutTabPhase = 'reviewing' | 'applied';

export interface AutoCutTabProps {
  // Gating: auto-cut requires analysis to exist on the project. If
  // `hasAnalysis` is false, the tab nudges the user to the Analyze tab.
  hasAnalysis: boolean;

  // Run state
  isRunning: boolean;
  runError: string | null;
  onRun: () => void;

  // Cut plan + phase (null when no plan exists)
  plan: StudioCutPlan | null;
  phase: AutoCutTabPhase | null;
  workspaceDir: string | null;

  // Actions
  onApply: () => void;
  onDiscard: () => void;
  onBake: () => void;
  onRerun: () => void;

  // Review-phase preview toggle
  reviewPreviewMode: 'source' | 'cut';
  onChangeReviewPreviewMode: (next: 'source' | 'cut') => void;
}

const FLAG_LABELS: Record<StudioCutPlanFlag['type'], { label: string; color: string }> = {
  heavy_cut_warning: { label: 'Heavy cut', color: 'rgba(239,68,68,0.85)' },
  energy_dip: { label: 'Energy dip', color: 'rgba(234,179,8,0.85)' },
  filler_cluster: { label: 'Filler cluster', color: 'rgba(234,179,8,0.85)' },
  hallucination_suspect: { label: 'Hallucination', color: 'rgba(168,85,247,0.85)' },
  long_silence_intentional: { label: 'Long silence kept', color: 'rgba(99,102,241,0.85)' },
};

function formatSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}m${r > 0 ? ` ${r.toFixed(0)}s` : ''}`;
}

export function AutoCutTab({
  hasAnalysis,
  isRunning,
  runError,
  onRun,
  plan,
  phase,
  workspaceDir,
  onApply,
  onDiscard,
  onBake,
  onRerun,
  reviewPreviewMode,
  onChangeReviewPreviewMode,
}: AutoCutTabProps) {
  const [showFlags, setShowFlags] = useState(false);

  if (!hasAnalysis) {
    // Gated empty state — nudge user to the Analyze tab.
    return (
      <div className="flex flex-col items-center justify-center h-full px-[24px] gap-[10px] text-center">
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
          Auto-cut requires the analysis first. Open the{' '}
          <span className="text-text-muted">Analyze</span> tab and run it.
        </p>
      </div>
    );
  }

  const removedSeconds = plan
    ? plan.stats.sourceDuration - plan.stats.cutDuration
    : 0;

  const openNotes = () => {
    if (!workspaceDir) return;
    const sep = workspaceDir.includes('\\') ? '\\' : '/';
    void window.api.renderOpenFile({ filePath: `${workspaceDir}${sep}cuts.md` });
  };

  return (
    <div className="flex flex-col gap-[14px] p-[12px] overflow-auto h-full">
      <Section title="Run">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center justify-center gap-[6px] h-[30px] rounded-[6px] text-[11px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-accent)' }}
          title="Claude proposes cuts based on the cached analysis"
        >
          {isRunning ? (
            <>
              <div
                className="w-[10px] h-[10px] rounded-full border-[1.5px] border-t-transparent animate-spin"
                style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
              />
              Planning…
            </>
          ) : (
            <>
              <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="3" cy="10.5" r="2" />
                <circle cx="11" cy="10.5" r="2" />
                <path d="M4.4 9.1L12 1.5" />
                <path d="M9.6 9.1L2 1.5" />
              </svg>
              {plan ? 'Re-run auto-cut' : 'Auto-cut'}
            </>
          )}
        </button>
        {runError && (
          <div
            className="text-[10px] px-[8px] py-[6px] rounded-[4px] leading-snug"
            style={{
              color: 'var(--color-status-error, #ef4444)',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '0.5px solid rgba(239,68,68,0.3)',
            }}
          >
            {runError}
          </div>
        )}
      </Section>

      {plan && phase && (
        <>
          <Section
            title="Plan"
            right={
              <span
                className="px-[6px] py-[1px] rounded-[3px] text-[9px] font-medium uppercase tracking-wider"
                style={{
                  color: phase === 'reviewing' ? 'var(--color-accent-light)' : 'rgba(34,197,94,1)',
                  backgroundColor:
                    phase === 'reviewing'
                      ? 'rgba(99,102,241,0.16)'
                      : 'rgba(34,197,94,0.16)',
                }}
              >
                {phase}
              </span>
            }
          >
            <div
              className="flex flex-col gap-[4px] px-[8px] py-[6px] rounded-[4px]"
              style={{ backgroundColor: 'var(--color-app-active)' }}
            >
              <Stat label="Cuts" value={String(plan.cuts.length)} />
              <Stat
                label="Removed"
                value={`${plan.stats.removedPercent.toFixed(1)}% · ${formatSeconds(removedSeconds)}`}
              />
              <Stat
                label="Cut duration"
                value={formatSeconds(plan.stats.cutDuration)}
              />
            </div>

            {phase === 'reviewing' && (
              <div className="flex items-center gap-[6px]">
                <span className="text-text-dim text-[10px] uppercase tracking-wider shrink-0">
                  Preview
                </span>
                <div
                  className="flex rounded-[4px] overflow-hidden flex-1"
                  style={{
                    border: '0.5px solid var(--color-border)',
                    backgroundColor: 'var(--color-app-base)',
                  }}
                >
                  <ToggleBtn
                    active={reviewPreviewMode === 'source'}
                    onClick={() => onChangeReviewPreviewMode('source')}
                    title="Play full source — red regions audible"
                  >
                    Source
                  </ToggleBtn>
                  <ToggleBtn
                    active={reviewPreviewMode === 'cut'}
                    onClick={() => onChangeReviewPreviewMode('cut')}
                    title="Preview the cut version — jump over cuts"
                  >
                    Cut
                  </ToggleBtn>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-[6px]">
              {phase === 'reviewing' ? (
                <>
                  <button
                    onClick={onApply}
                    className="h-[28px] rounded-[6px] text-[11px] font-medium text-white transition-colors"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    Apply cuts
                  </button>
                  <button
                    onClick={onDiscard}
                    className="h-[24px] rounded-[4px] text-[10px] text-text-muted hover:text-status-error hover:bg-app-hover transition-colors"
                  >
                    Discard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onBake}
                    className="h-[28px] rounded-[6px] text-[11px] font-medium text-white transition-colors"
                    style={{ backgroundColor: 'rgba(34,197,94,0.9)' }}
                    title="Permanently remove hidden segments"
                  >
                    Bake &amp; lock
                  </button>
                  <button
                    onClick={onDiscard}
                    className="h-[24px] rounded-[4px] text-[10px] text-text-muted hover:text-status-error hover:bg-app-hover transition-colors"
                    title="Restore all hidden segments and clear the plan"
                  >
                    Restore all
                  </button>
                </>
              )}

              <div className="flex items-center gap-[4px]">
                {workspaceDir && (
                  <button
                    onClick={openNotes}
                    className="flex-1 h-[22px] rounded-[3px] text-[10px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
                    title="Open cuts.md in your editor"
                  >
                    View notes
                  </button>
                )}
                <button
                  onClick={onRerun}
                  className="flex-1 h-[22px] rounded-[3px] text-[10px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
                  title="Re-run the planner against the cached analysis"
                >
                  Re-run
                </button>
              </div>
            </div>
          </Section>

          {plan.flags.length > 0 && (
            <Section
              title={`Flags (${plan.flags.length})`}
              right={
                <button
                  onClick={() => setShowFlags((v) => !v)}
                  className="text-[10px] text-text-dim hover:text-text-primary transition-colors"
                >
                  {showFlags ? 'Hide' : 'Show'}
                </button>
              }
            >
              {showFlags &&
                plan.flags.map((f, i) => {
                  const def = FLAG_LABELS[f.type];
                  return (
                    <div
                      key={i}
                      className="flex flex-col gap-[2px] px-[8px] py-[6px] rounded-[4px]"
                      style={{ backgroundColor: 'var(--color-app-active)' }}
                    >
                      <div className="flex items-center gap-[6px]">
                        <span
                          className="px-[5px] py-[1px] rounded-[3px] text-white text-[9px] font-medium"
                          style={{ backgroundColor: def.color }}
                        >
                          {def.label}
                        </span>
                        <span className="text-text-dim font-mono text-[10px]">
                          {f.from.toFixed(1)}–{f.to.toFixed(1)}s
                        </span>
                      </div>
                      {f.note && (
                        <span className="text-text-muted text-[10px] leading-snug">
                          {f.note}
                        </span>
                      )}
                    </div>
                  );
                })}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center justify-between">
        <span className="text-text-muted text-[10px] uppercase tracking-wider">
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-text-dim">{label}</span>
      <span className="text-text-primary font-mono">{value}</span>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 h-[20px] text-[10px] transition-colors"
      style={{
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-dim)',
        backgroundColor: active ? 'var(--color-app-active)' : 'transparent',
        fontWeight: active ? 500 : 400,
      }}
      title={title}
    >
      {children}
    </button>
  );
}
