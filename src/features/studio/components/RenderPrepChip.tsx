import { Loader2 } from 'lucide-react';
import { useJobProgress, useRenderQueue } from '@features/render-queue';

interface Props {
  /** Only this project's exports light the chip (compositionId is `studio-<id>`). */
  projectId: string;
}

/**
 * Toolbar chip shown from the moment a Studio export is queued until frames
 * actually start rendering. Bundling used to freeze the whole UI (it ran on
 * the main-process event loop), so there was nothing to show; now that it runs
 * in a utility process this is the visible "Preparing render…" state, with the
 * bundler's percent while it compiles. Disappears once frame progress flows —
 * the render queue screen owns the per-frame progress display.
 */
export function RenderPrepChip({ projectId }: Props) {
  const { activeJob } = useRenderQueue();
  const isOurs = activeJob?.compositionId === `studio-${projectId}`;
  const progress = useJobProgress(isOurs ? activeJob?.id : undefined);

  if (!activeJob || !isOurs) return null;
  const phase = progress?.phase;
  // Frames flowing (or nothing reported yet after the optimistic flip with an
  // old cached bundle) — the queue screen takes over.
  if (phase === 'rendering' && (progress?.framesRendered ?? 0) > 0) return null;

  const percent =
    phase === 'bundling' && progress ? ` ${Math.round(progress.percent)}%` : '';

  return (
    <span
      className="flex items-center gap-1.5 text-[10px] px-[7px] py-[2px] rounded-[5px] bg-app-active text-text-muted"
      style={{ border: '0.5px solid var(--color-border)' }}
      title="The export is being prepared — progress lives in the render queue"
    >
      <Loader2 size={10} strokeWidth={2} className="animate-spin" />
      Preparing render…{percent}
    </span>
  );
}
