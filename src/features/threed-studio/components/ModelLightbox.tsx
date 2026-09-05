import { useCallback, useEffect } from 'react';
import { Button } from '@shared/components';
import type { GalleryModel } from '../types';
import { GlbViewer } from './GlbViewer';
import { formatSeconds } from './ModelCard';

interface ModelLightboxProps {
  models: GalleryModel[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onSaveAs: (id: string) => void;
  onSaveToLibrary: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onRegenerate: (model: GalleryModel, newSeed: boolean) => void;
  onDelete: (id: string) => void;
  /** Disable Regenerate while a job runs. */
  busy: boolean;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/** Full-size viewer with orbit controls; Shift+arrows navigate (arrows alone orbit the camera). */
export function ModelLightbox({ models, currentIndex, onNavigate, onClose, onSaveAs, onSaveToLibrary, onOpenFolder, onRegenerate, onDelete, busy }: ModelLightboxProps) {
  const model = models[currentIndex];
  const total = models.length;
  const hasMultiple = total > 1;

  const goNext = useCallback(() => { if (total > 1) onNavigate((currentIndex + 1) % total); }, [currentIndex, total, onNavigate]);
  const goPrev = useCallback(() => { if (total > 1) onNavigate((currentIndex - 1 + total) % total); }, [currentIndex, total, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.shiftKey && e.key === 'ArrowRight') goNext();
      if (e.shiftKey && e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (!model) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {hasMultiple && (
        <button type="button" className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white z-10" onClick={goPrev} title="Previous (Shift+←)">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      )}
      {hasMultiple && (
        <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white z-10" onClick={goNext} title="Next (Shift+→)">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      )}

      <div className="flex flex-col items-center max-w-[90vw] max-h-[92vh] gap-3">
        <div className="flex gap-3 items-stretch">
          <GlbViewer key={model.id} url={model.meshUrl} controls className="w-[min(70vw,760px)] h-[min(62vh,560px)] rounded-lg overflow-hidden" />
          {model.inputUrl && (
            <div className="flex flex-col gap-1 w-[140px] shrink-0">
              <img src={model.inputUrl} alt="Input" className="w-[140px] h-[140px] object-contain rounded bg-black/40 border border-white/10" />
              <span className="text-[9px] text-white/50 text-center">input (cut out)</span>
              {model.previewUrl && (
                <>
                  <img src={model.previewUrl} alt="Preview" className="w-[140px] h-[140px] object-contain rounded bg-black/40 border border-white/10" />
                  <span className="text-[9px] text-white/50 text-center">NeRF view 0</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="text-center max-w-[700px]">
          <div className="text-[12px] text-white/80 truncate">{model.name}</div>
          <div className="text-[10px] text-white/50">
            TripoSR · {model.quality}³{model.seed != null ? ` · seed ${model.seed}` : ''}
            {model.vertices != null && <> · {model.vertices.toLocaleString()} verts / {model.faces?.toLocaleString()} faces</>}
            {' · '}{formatSize(model.sizeBytes)}
            {model.seconds != null && <> · {formatSeconds(model.seconds)} on {model.device?.startsWith('cuda') ? 'GPU' : 'CPU'}</>}
            {hasMultiple && <span> · {currentIndex + 1} / {total}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Button variant="primary" onClick={() => onSaveToLibrary(model.id)}>Save to asset library</Button>
          <Button variant="secondary" onClick={() => onSaveAs(model.id)}>Save As</Button>
          <Button variant="secondary" onClick={() => onOpenFolder(model.id)}>Open folder</Button>
          <Button variant="secondary" onClick={() => onRegenerate(model, false)} disabled={busy} title="Same image, same seed and settings">Regenerate</Button>
          <Button variant="secondary" onClick={() => onRegenerate(model, true)} disabled={busy} title="Same image, new seed">New seed</Button>
          <Button variant="secondary" onClick={() => onDelete(model.id)}>Delete</Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
