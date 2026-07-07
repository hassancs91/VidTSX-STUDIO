import { useEffect, useCallback } from 'react';
import { Button } from '@shared/components';
import { useToast } from '@renderer/contexts/ToastContext';
import type { GalleryImage } from '../types';

const CopyIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

interface ImageLightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onSaveAs: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onUseAsInput: (image: GalleryImage) => void;
}

export function ImageLightbox({ images, currentIndex, onNavigate, onClose, onSaveAs, onCopy, onDelete, onUseAsInput }: ImageLightboxProps) {
  const image = images[currentIndex];
  const total = images.length;
  const hasPrev = total > 1;
  const hasNext = total > 1;
  const { showToast } = useToast();

  const handleCopyPrompt = useCallback(async () => {
    if (!image) return;
    try {
      await navigator.clipboard.writeText(image.prompt);
      showToast('Prompt copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy prompt', 'error');
    }
  }, [image, showToast]);

  const goNext = useCallback(() => {
    if (total > 1) onNavigate((currentIndex + 1) % total);
  }, [currentIndex, total, onNavigate]);

  const goPrev = useCallback(() => {
    if (total > 1) onNavigate((currentIndex - 1 + total) % total);
  }, [currentIndex, total, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (!image) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleDelete = () => {
    onDelete(image.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Prev arrow */}
      {hasPrev && (
        <button
          type="button"
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors z-10"
          onClick={goPrev}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {hasNext && (
        <button
          type="button"
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors z-10"
          onClick={goNext}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      <div className="flex flex-col items-center max-w-[90vw] max-h-[90vh] gap-3">
        {/* Image */}
        <img
          src={image.thumbnailUrl}
          alt={image.prompt}
          className="max-w-full max-h-[70vh] rounded-lg object-contain"
        />

        {/* Info */}
        <div className="text-center max-w-[600px]">
          <div className="flex items-start justify-center gap-1.5 mb-1">
            <div className="text-[12px] text-white/80 line-clamp-2 text-left">{image.prompt}</div>
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
            {image.model} · {image.width != null && image.height != null ? `${image.width}×${image.height}` : 'Unknown size'} · {(image.durationMs / 1000).toFixed(1)}s
            {total > 1 && <span> · {currentIndex + 1} / {total}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => onUseAsInput(image)}>
            Use as Input
          </Button>
          <Button variant="secondary" onClick={() => onSaveAs(image.id)}>
            Save As
          </Button>
          <Button variant="secondary" onClick={() => onCopy(image.id)}>
            Copy
          </Button>
          <Button variant="secondary" onClick={handleDelete}>
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
