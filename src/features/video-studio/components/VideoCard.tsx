import { useRef, useState } from 'react';
import { Workflow } from 'lucide-react';
import { RunFlowMenu } from '@renderer/components/flows/RunFlowMenu';
import { fileUrlToPath } from '@shared/flows/flow-handoff';
import type { GalleryVideo } from '../types';

const DownloadIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const MoveOutIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
    <path d="M15 12H3" />
    <path d="M21 3v18" />
  </svg>
);

const PlayIcon = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth={1}>
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

const CheckIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function ActionButton({
  onClick,
  children,
  title,
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      className="flex items-center justify-center w-[28px] h-[28px] rounded-md bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors"
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const s = Math.round(seconds);
  return `${s}s`;
}

interface VideoCardProps {
  video: GalleryVideo;
  onView: (video: GalleryVideo) => void;
  onSaveAs: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveToRoot?: (id: string) => void;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (id: string, additive: boolean) => void;
}

export function VideoCard({
  video,
  onView,
  onSaveAs,
  onDelete,
  onMoveToRoot,
  selected = false,
  selectionMode = false,
  onToggleSelect,
}: VideoCardProps) {
  const [hovered, setHovered] = useState(false);
  // W8 Stage 6 (flows plan §1.8): "Run a flow on this" — the flows that take a video.
  const [flowMenu, setFlowMenu] = useState(false);
  const videoEl = useRef<HTMLVideoElement | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/video-id', video.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(video.id, e.shiftKey);
      return;
    }
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && onToggleSelect) {
      onToggleSelect(video.id, e.shiftKey);
      return;
    }
    onView(video);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect) onToggleSelect(video.id, e.shiftKey);
  };

  const handleMouseEnter = () => {
    setHovered(true);
    const el = videoEl.current;
    if (el && !selectionMode) {
      el.currentTime = 0;
      el.play().catch(() => {
        // Browser may block autoplay; ignore.
      });
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    const el = videoEl.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  };

  const showCheckbox = selectionMode || selected;

  return (
    <div
      className={`relative rounded-lg overflow-hidden cursor-pointer group bg-app-deep ${
        selected ? 'ring-2 ring-accent ring-offset-0' : ''
      }`}
      style={{ aspectRatio: '16 / 9' }}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* Thumbnail (still image) — fades out when hover-preview plays */}
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt={video.prompt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
            hovered && !selectionMode ? 'opacity-0' : 'opacity-100'
          } ${selected ? 'opacity-80' : ''}`}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-text-dim/50">
          <PlayIcon />
        </div>
      )}

      {/* Hover preview video (muted, looped) */}
      <video
        ref={videoEl}
        src={video.videoUrl}
        muted
        loop
        playsInline
        preload="none"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
          hovered && !selectionMode ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Center play indicator (when not hovered) */}
      {!hovered && video.thumbnailUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80">
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <PlayIcon />
          </div>
        </div>
      )}

      {/* Duration badge — bottom-left */}
      {video.durationSeconds != null && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white pointer-events-none">
          {formatDuration(video.durationSeconds)}
        </div>
      )}

      {/* Selection checkbox */}
      <button
        type="button"
        onClick={handleCheckboxClick}
        title={selected ? 'Deselect' : 'Select'}
        className={`absolute top-2 left-2 z-20 w-[20px] h-[20px] rounded-full flex items-center justify-center transition-all ${
          selected
            ? 'bg-accent text-white opacity-100'
            : 'bg-black/50 border border-white/40 text-transparent hover:bg-black/70'
        } ${showCheckbox ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        {selected && <CheckIcon />}
      </button>

      {/* Hover overlay with action buttons + prompt */}
      <div
        className={`absolute inset-0 bg-black/40 flex flex-col justify-end p-2 gap-1.5 pointer-events-none transition-opacity ${
          selectionMode ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="flex justify-end gap-1 flex-wrap pointer-events-auto relative">
          <ActionButton title="Run a flow on this" onClick={(e) => { e.stopPropagation(); setFlowMenu((v) => !v); }}>
            <Workflow size={14} strokeWidth={2} />
          </ActionButton>
          {flowMenu && (
            <div
              className="absolute right-0 bottom-full mb-1 min-w-[200px] py-1 rounded-md bg-app-surface shadow-lg z-30 text-left"
              style={{ border: '0.5px solid var(--color-border)' }}
              onClick={(e) => e.stopPropagation()}
              data-video-run-flow
            >
              <div className="px-3 py-1 text-[10px] text-text-dim">Run a flow on this</div>
              <RunFlowMenu kind="video" value={fileUrlToPath(video.videoUrl)} variant="list" onDone={() => setFlowMenu(false)} />
            </div>
          )}
          <ActionButton title="Save As" onClick={(e) => { e.stopPropagation(); onSaveAs(video.id); }}>
            <DownloadIcon />
          </ActionButton>
          {onMoveToRoot && (
            <ActionButton title="Move to Root" onClick={(e) => { e.stopPropagation(); onMoveToRoot(video.id); }}>
              <MoveOutIcon />
            </ActionButton>
          )}
          <ActionButton title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}>
            <TrashIcon />
          </ActionButton>
        </div>
        <div className="pointer-events-none">
          <div className="text-[10px] text-white/70 truncate">{video.prompt}</div>
          <div className="text-[9px] text-white/50">
            {video.model}
            {video.aspectRatio && <> · {video.aspectRatio}</>}
            {video.durationSeconds != null && <> · {formatDuration(video.durationSeconds)}</>}
          </div>
        </div>
      </div>
    </div>
  );
}
