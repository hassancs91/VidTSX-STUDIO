import { useEffect, useCallback } from 'react';
import { Button } from '@shared/components';
import { useToast } from '@renderer/contexts/ToastContext';
import type { GalleryVideo } from '../types';

const CopyIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

interface VideoLightboxProps {
  videos: GalleryVideo[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onSaveAs: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  return `${Math.round(seconds)}s`;
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function VideoLightbox({
  videos,
  currentIndex,
  onNavigate,
  onClose,
  onSaveAs,
  onDelete,
}: VideoLightboxProps) {
  const video = videos[currentIndex];
  const total = videos.length;
  const hasMultiple = total > 1;
  const { showToast } = useToast();

  const handleCopyPrompt = useCallback(async () => {
    if (!video) return;
    try {
      await navigator.clipboard.writeText(video.prompt);
      showToast('Prompt copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy prompt', 'error');
    }
  }, [video, showToast]);

  const goNext = useCallback(() => {
    if (total > 1) onNavigate((currentIndex + 1) % total);
  }, [currentIndex, total, onNavigate]);

  const goPrev = useCallback(() => {
    if (total > 1) onNavigate((currentIndex - 1 + total) % total);
  }, [currentIndex, total, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Arrow keys would interfere with the <video> scrubbing; require Shift+Arrow.
      if (e.shiftKey && e.key === 'ArrowRight') goNext();
      if (e.shiftKey && e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (!video) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {hasMultiple && (
        <button
          type="button"
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors z-10"
          onClick={goPrev}
          title="Previous (Shift+←)"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {hasMultiple && (
        <button
          type="button"
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors z-10"
          onClick={goNext}
          title="Next (Shift+→)"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      <div className="flex flex-col items-center max-w-[90vw] max-h-[90vh] gap-3">
        <video
          // The key forces React to remount the element when we navigate, otherwise
          // the previous video's currentTime/state leaks into the next render.
          key={video.id}
          src={video.videoUrl}
          controls
          autoPlay
          className="max-w-full max-h-[70vh] rounded-lg bg-black"
        />

        <div className="text-center max-w-[700px]">
          <div className="flex items-start justify-center gap-1.5 mb-1">
            <div className="text-[12px] text-white/80 line-clamp-2 text-left">{video.prompt}</div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              title="Copy prompt"
              className="shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <CopyIcon />
            </button>
          </div>
          <div className="text-[10px] text-white/50">
            {video.model}
            {video.aspectRatio && <> · {video.aspectRatio}</>}
            {video.durationSeconds != null && <> · {formatDuration(video.durationSeconds)}</>}
            {video.sizeBytes != null && <> · {formatSize(video.sizeBytes)}</>}
            {video.creditsConsumed != null && <> · {video.creditsConsumed} cr</>}
            {hasMultiple && <span> · {currentIndex + 1} / {total}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => onSaveAs(video.id)}>
            Save As
          </Button>
          <Button variant="secondary" onClick={() => onDelete(video.id)}>
            Delete
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
