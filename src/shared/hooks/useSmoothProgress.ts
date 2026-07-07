import { useEffect, useRef, useState } from 'react';
import type { PipelineProgress, PipelineStep } from '@shared/tsx-engine';

type Phase = 'plan' | 'generate' | 'finish';
type Variant = 'generate' | 'edit';

interface PhaseCurve {
  start: number;
  end: number;
  tau: number; // seconds — larger = slower approach to `end`
}

const PHASE_CURVES: Record<Variant, Record<Phase, PhaseCurve>> = {
  generate: {
    plan: { start: 0, end: 15, tau: 10 },
    generate: { start: 15, end: 65, tau: 55 },
    finish: { start: 65, end: 99, tau: 25 },
  },
  edit: {
    plan: { start: 0, end: 0, tau: 1 },
    generate: { start: 0, end: 75, tau: 30 },
    finish: { start: 75, end: 99, tau: 15 },
  },
};

function phaseOf(step: PipelineStep): Phase {
  if (step === 'plan') return 'plan';
  if (step === 'generate') return 'generate';
  return 'finish'; // verify | transpile | fix
}

/**
 * Smoothly interpolates a progress percentage between step boundaries while the
 * underlying pipeline emits only discrete updates. Uses an exponential decay
 * curve per phase so the bar eases toward (but never quite reaches) each phase's
 * end boundary, then snaps to 100 on pipeline completion.
 */
export function useSmoothProgress(progress: PipelineProgress | null, variant: Variant = 'generate'): number {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase | null>(null);
  const startedAtRef = useRef(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const cancelRaf = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // No active progress — reset to 0 and stop.
    if (!progress) {
      cancelRaf();
      phaseRef.current = null;
      setDisplay(0);
      return;
    }

    // Pipeline emitted terminal 100 — snap and stop.
    if (progress.percent >= 100) {
      cancelRaf();
      phaseRef.current = null;
      setDisplay(100);
      return;
    }

    const phase = phaseOf(progress.step);
    const curve = PHASE_CURVES[variant][phase];

    // Phase changed — reset the tween origin.
    if (phaseRef.current !== phase) {
      phaseRef.current = phase;
      startedAtRef.current = performance.now();
      fromRef.current = curve.start;
      // Seed the display at the phase start so there's no backward jump.
      setDisplay((prev) => (prev < curve.start ? curve.start : prev));
    }

    cancelRaf();

    const tick = () => {
      const elapsedSec = (performance.now() - startedAtRef.current) / 1000;
      const { end, tau } = curve;
      const from = fromRef.current;
      const eased = end - (end - from) * Math.exp(-elapsedSec / tau);
      // Clamp just below `end` so we never visually hit the next phase's start.
      const clamped = Math.min(eased, end - 0.1);
      setDisplay(clamped);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return cancelRaf;
  }, [progress, variant]);

  return display;
}
