import { Clapperboard, Plus, X } from 'lucide-react';
import type { StudioShot } from '../types';
import type { ShotJobProgress } from '../hooks/useShotJobs';
import { describeShotUsage } from '../services/asset-usage';
import type { PoolDensity } from './DensityToggle';

const SHOT_KIND_STYLE: Record<string, string> = {
  cutaway: 'bg-accent/20 text-accent-light',
  overlay: 'bg-accent-blue/15 text-accent-blue',
  title: 'bg-amber-500/15 text-amber-500',
};

interface Props {
  shot: StudioShot;
  density: PoolDensity;
  progress: ShotJobProgress | null;
  /** Clips playing the shot (feedback item 6). */
  used: number;
  onAdd: () => void;
  onRemove: () => void;
}

function statusLine(shot: StudioShot, progress: ShotJobProgress | null, generating: boolean): string {
  if (generating) {
    return `${progress?.message ?? 'Generating…'}${progress?.percent !== undefined ? ` ${progress.percent}%` : ''}`;
  }
  if (shot.status === 'error') return 'failed — see Inspector';
  const seconds = shot.config ? ` · ${(shot.config.durationInFrames / shot.config.fps).toFixed(1)} s` : '';
  return `v${shot.activeVersion}${seconds}`;
}

/**
 * One TSX shot in the Shots tab: a row (list density) or a small tile (grid,
 * video-10 feedback item 5). Double-click or + adds it at the playhead; the X
 * asks first when the shot is on the timeline.
 */
export function ShotCard({ shot, density, progress, used, onAdd, onRemove }: Props) {
  const generating = shot.status === 'generating' || progress?.status === 'generating';
  const status = statusLine(shot, progress, generating);
  const kindChip = (
    <span
      className={`text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full shrink-0 ${SHOT_KIND_STYLE[shot.kind] ?? ''}`}
    >
      {shot.kind}
    </span>
  );
  const usageBadge = used > 0 && (
    <span
      data-usage-badge={shot.id}
      title={describeShotUsage(used)}
      className="shrink-0 px-1 py-px rounded-[3px] bg-accent/15 text-[8px] font-medium text-accent-light"
    >
      {used} clip{used === 1 ? '' : 's'}
    </span>
  );
  const actions = (
    <>
      {shot.status === 'ready' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          title="Add to the timeline at the playhead"
          aria-label={`Add shot ${shot.name} to the timeline`}
          className="flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/40 text-text-muted hover:text-accent-light opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <Plus size={12} strokeWidth={2} />
        </button>
      )}
      {!generating && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={
            used > 0
              ? 'Remove the shot and its clips — asks first, the shot is on the timeline (files stay on disk)'
              : 'Remove the shot and its clips (files stay on disk)'
          }
          className="flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/40 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <X size={11} strokeWidth={1.75} />
        </button>
      )}
    </>
  );
  const shared = {
    'data-shot-card': shot.id,
    style: {
      border:
        shot.status === 'error' ? '0.5px solid var(--color-accent-red, #e5484d)' : '0.5px solid var(--color-border)',
    },
    title: shot.status === 'error' ? (shot.error ?? 'Generation failed') : `${shot.prompt ?? shot.name}\n\nDouble-click to add at the playhead`,
    onDoubleClick: () => {
      if (shot.status === 'ready') onAdd();
    },
  };

  if (density === 'grid') {
    return (
      <div {...shared} className="group relative min-w-0 rounded-[5px] overflow-hidden bg-app-surface">
        <div className="relative aspect-video bg-app-base flex items-center justify-center">
          <Clapperboard size={16} strokeWidth={1.25} className="text-text-ghost" />
          <span className="absolute bottom-[3px] left-[3px]">{kindChip}</span>
          {used > 0 && <span className="absolute top-[3px] left-[3px]">{usageBadge}</span>}
          <span className="absolute top-[3px] right-[3px] flex items-center gap-[3px]">{actions}</span>
          {generating && (
            <span className="absolute inset-x-0 bottom-0 px-1 py-px bg-black/70 text-[8px] text-accent-light truncate">
              {status}
            </span>
          )}
        </div>
        <div className="px-1 py-[3px] min-w-0">
          <div className="text-[9px] leading-tight text-text-primary truncate">{shot.name}</div>
          {!generating && <div className="text-[8px] leading-tight text-text-muted truncate">{status}</div>}
        </div>
      </div>
    );
  }

  return (
    <div {...shared} className="group relative flex items-center gap-2 px-2 py-[6px] rounded-[6px] bg-app-surface">
      <Clapperboard size={14} strokeWidth={1.5} className="text-text-ghost shrink-0" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] text-text-primary truncate">{shot.name}</span>
          {usageBadge}
        </span>
        <span className="text-[9px] text-text-muted truncate">{status}</span>
      </div>
      {kindChip}
      {actions}
    </div>
  );
}
