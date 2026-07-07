import { useEffect, useRef, useState } from 'react';

interface ProgressStage<S extends string> {
  id: S;
  label: string;
  // Relative share of the overall bar. Used to derive each stage's ceiling so
  // the displayed percent can ease toward (but never past) the stage boundary
  // while the underlying pipeline is stuck on a single coarse value (e.g. the
  // long cloud-transcription poll, which reports only pending/running/done).
  // Defaults to 1 (equal weighting) when omitted.
  weight?: number;
}

interface AutoCutProgressProps<S extends string> {
  title: string;
  stages: ProgressStage<S>[];
  progress: { stage: S; percent: number; message: string } | null;
  onCancel: () => void;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Eases the displayed percent toward the active stage's ceiling using an
 * exponential-decay curve, so the bar keeps inching forward even when the
 * pipeline emits no new progress (the cloud-transcription poll can sit on one
 * value for a minute). Re-anchors at the real reported percent whenever the
 * active stage changes, and always snaps up to the reported percent if it
 * overtakes the eased value — so it never moves backward or overruns a stage.
 */
function useEasedPercent(
  reportedPercent: number,
  activeIndex: number,
  ceiling: number,
  tauSec: number
): number {
  const [display, setDisplay] = useState(reportedPercent);
  const rafRef = useRef<number | null>(null);
  const stageRef = useRef<number>(-1);
  const anchorRef = useRef({ from: reportedPercent, startedAt: 0 });

  useEffect(() => {
    const cancel = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // Re-anchor the easing origin when the active stage changes.
    if (stageRef.current !== activeIndex) {
      stageRef.current = activeIndex;
      anchorRef.current = { from: reportedPercent, startedAt: performance.now() };
      setDisplay((prev) => Math.max(prev, reportedPercent));
    }

    cancel();
    // Ease toward a target partway between the real reported value and the
    // stage ceiling — never all the way to the ceiling. A stage with no finer
    // signal (e.g. the cloud-transcription poll, which can sit for minutes)
    // would otherwise creep to ~100% of its share and read as "almost done"
    // while it's barely started. Settling around the midpoint keeps the bar
    // honestly "in progress, not finishing" until a real update arrives.
    const { from, startedAt } = anchorRef.current;
    const target = from + (ceiling - from) * 0.5;
    const cap = Math.max(0, ceiling - 0.4);
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const eased = target - (target - from) * Math.exp(-elapsed / tauSec);
      setDisplay(clamp(Math.max(reportedPercent, eased), 0, cap));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return cancel;
  }, [reportedPercent, activeIndex, ceiling, tauSec]);

  return display;
}

// Generic lock-overlay with a labelled stage list + progress bar. Used by both
// the mechanical Analyze pipeline and the Auto-cut planner.
export function AutoCutProgress<S extends string>({
  title,
  stages,
  progress,
  onCancel,
}: AutoCutProgressProps<S>) {
  const reportedPercent = progress?.percent ?? 0;
  const activeStage = progress?.stage ?? stages[0]?.id;
  const activeIndex = stages.findIndex((s) => s.id === activeStage);

  // Derive the active stage's ceiling + an easing time-constant from the stage
  // weights, so the bar advances smoothly through a stage that's stuck on one
  // coarse value (heavier stage → it eases more slowly toward its ceiling).
  const weights = stages.map((s) => s.weight ?? 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
  let acc = 0;
  const ceilings = weights.map((w) => {
    acc += w;
    return (acc / totalWeight) * 100;
  });
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const ceiling = ceilings[safeIndex] ?? 100;
  const activeShare = (weights[safeIndex] / totalWeight) * 100;
  const tauSec = clamp(activeShare * 0.4, 4, 35);

  const easedPercent = useEasedPercent(reportedPercent, safeIndex, ceiling, tauSec);
  const percent = Math.round(easedPercent);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="flex flex-col gap-[14px] p-[20px] rounded-[10px] min-w-[360px] max-w-[480px]"
        style={{
          backgroundColor: 'var(--color-app-surface)',
          border: '0.5px solid var(--color-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-text-primary text-[13px] font-medium">{title}</span>
          <span className="text-text-dim text-[11px] font-mono">{percent}%</span>
        </div>

        {/* Progress bar */}
        <div
          className="h-[6px] rounded-[3px] overflow-hidden"
          style={{ backgroundColor: 'var(--color-app-active)' }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${percent}%`,
              backgroundColor: 'var(--color-accent)',
            }}
          />
        </div>

        {/* Stage list */}
        <div className="flex flex-col gap-[6px]">
          {stages.map((stage, idx) => {
            const state =
              idx < activeIndex ? 'done' : idx === activeIndex ? 'active' : 'pending';
            return (
              <div
                key={stage.id}
                className="flex items-center gap-[8px] text-[11px]"
                style={{
                  color:
                    state === 'done'
                      ? 'var(--color-text-muted)'
                      : state === 'active'
                        ? 'var(--color-accent-light)'
                        : 'var(--color-text-dim)',
                  opacity: state === 'pending' ? 0.5 : 1,
                }}
              >
                <span className="inline-flex items-center justify-center w-[14px] h-[14px]">
                  {state === 'done' ? (
                    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6L5 9L10 3" />
                    </svg>
                  ) : state === 'active' ? (
                    <div
                      className="w-[10px] h-[10px] rounded-full border-[1.5px] border-t-transparent animate-spin"
                      style={{
                        borderColor: 'currentColor',
                        borderTopColor: 'transparent',
                      }}
                    />
                  ) : (
                    <div
                      className="w-[8px] h-[8px] rounded-full"
                      style={{ border: '1px solid currentColor' }}
                    />
                  )}
                </span>
                <span>{stage.label}</span>
                {state === 'active' && progress?.message && (
                  <span className="text-text-dim text-[10px] truncate">
                    {progress.message}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-[4px]">
          <button
            onClick={onCancel}
            className="px-[10px] h-[24px] rounded-[4px] text-[11px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Pre-baked stage lists for the two callers. Weights mirror the backend stage
// weights in main/services/auto-cut/analyze.ts so each stage's eased ceiling
// lands on the real boundary (extract=5, transcribe=75, silences=5, prosody=15).
export const ANALYZE_STAGES = [
  { id: 'extract-audio', label: 'Extract audio', weight: 5 },
  { id: 'transcribe', label: 'Transcribe', weight: 75 },
  { id: 'silences', label: 'Detect silences', weight: 5 },
  { id: 'prosody', label: 'Measure delivery', weight: 15 },
] as const;

export const AUTO_CUT_STAGES = [{ id: 'plan', label: 'Plan cuts' }] as const;
