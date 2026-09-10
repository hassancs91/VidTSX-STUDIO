import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Package, Trash2 } from 'lucide-react';
import type { StudioProjectSummary } from '@shared/ipc/types';
import { ProjectPoster, type PosterPalette } from '@shared/components/ProjectPoster';
import { formatDate } from '../services/format-time';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Per-project cache footer: size readout + Open in Explorer + two-step Clear.
 * Lives on the browser card (never in the editor) so a clear can only happen
 * while the project is closed — reopening regenerates proxies/waveforms;
 * transcripts come back on an explicit re-run (verified 2026-08-13 sweep).
 */
function CacheRow({ projectId }: { projectId: string }) {
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    const res = await window.api.studioCacheInfo({ projectId });
    if (res.success && res.sizeBytes !== undefined) setSizeBytes(res.sizeBytes);
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await window.api.studioCacheClear({ projectId });
      if (res.success) await refresh();
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  };

  return (
    <div
      data-cache-row={projectId}
      className="flex items-center gap-1.5 mt-1 text-[9px] text-text-dim"
      onClick={(e) => e.stopPropagation()}
    >
      <span data-cache-size={projectId} className="cursor-default">
        Cache {sizeBytes === null ? '…' : formatBytes(sizeBytes)}
      </span>
      <span className="flex-1" />
      {confirming ? (
        <>
          <button
            data-cache-clear-confirm={projectId}
            onClick={() => void handleClear()}
            disabled={clearing}
            title="Proxies and waveforms rebuild when the project opens; transcripts need an explicit re-run"
            className="text-accent-red hover:underline disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Really clear?'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={clearing}
            className="text-text-muted hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            data-cache-open={projectId}
            onClick={() => void window.api.studioCacheOpen({ projectId })}
            title="Open the cache folder (proxies, waveforms, transcripts, thumbnails) in Explorer"
            className="flex items-center gap-0.5 text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <FolderOpen size={10} strokeWidth={1.5} />
            Open
          </button>
          <button
            data-cache-clear={projectId}
            onClick={() => setConfirming(true)}
            title="Delete all derived files — everything regenerates (transcripts need a re-run)"
            className="text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

interface Props {
  project: StudioProjectSummary;
  /** Data URL of `cache/poster.jpg`, or null for the placeholder (W6). */
  posterSrc: string | null;
  /** The project brand's palette for the placeholder; absent = UI_SPEC accent. */
  palette: PosterPalette | null;
  onOpen: () => void;
  onDelete: () => void;
  onExport: () => void;
}

/** One browser card: the poster (orientation preserved), name, meta, cache
 *  row, and the hover actions (export as package, delete). */
export function ProjectCard({ project, posterSrc, palette, onOpen, onDelete, onExport }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="group relative flex flex-col rounded-[8px] bg-app-deep hover:bg-app-hover transition-colors cursor-pointer overflow-hidden"
      style={{ border: '0.5px solid var(--color-border)' }}
      onClick={onOpen}
      data-project-card={project.id}
    >
      <div className="h-[110px] flex items-center justify-center bg-app-surface px-2">
        <ProjectPoster
          src={posterSrc}
          width={project.width}
          height={project.height}
          name={project.name}
          palette={palette}
        />
      </div>
      <div className="px-2.5 py-2">
        <div className="text-[12px] font-medium text-text-primary truncate">{project.name}</div>
        <div className="text-[10px] text-text-muted mt-0.5">
          {project.width}×{project.height} · {project.fps} fps · {project.assetCount} asset
          {project.assetCount === 1 ? '' : 's'} · {formatDate(project.updatedAt)}
        </div>
        <CacheRow projectId={project.id} />
      </div>

      <div
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {confirming ? (
          <div className="flex items-center gap-1 bg-app-base rounded-[6px] px-1.5 py-1" style={{ border: '0.5px solid var(--color-border)' }}>
            <button
              onClick={onDelete}
              className="text-[10px] text-accent-red hover:underline"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-[10px] text-text-muted hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={onExport}
              data-export-package={project.id}
              title="Export as a .vidtsx package — one file carrying the timeline, shots, transcripts and media"
              className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] bg-app-base text-text-muted hover:text-text-secondary transition-colors"
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              <Package size={12} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setConfirming(true)}
              title="Delete project"
              className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] bg-app-base text-text-muted hover:text-accent-red transition-colors"
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
