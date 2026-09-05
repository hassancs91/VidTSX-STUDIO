import { useCallback, useState } from 'react';
import type { GalleryModel } from '../types';
import { ModelCard } from './ModelCard';
import { ModelLightbox } from './ModelLightbox';
import { DeleteModelDialog } from './DeleteModelDialog';

interface ModelGalleryProps {
  models: GalleryModel[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSaveAs: (id: string) => void;
  onSaveToLibrary: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onRegenerate: (model: GalleryModel, newSeed: boolean) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}

export function ModelGallery({ models, loading, error, onRetry, onSaveAs, onSaveToLibrary, onOpenFolder, onRegenerate, onDelete, busy }: ModelGalleryProps) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleView = useCallback((model: GalleryModel) => {
    const idx = models.findIndex((m) => m.id === model.id);
    if (idx >= 0) setViewingIndex(idx);
  }, [models]);

  const confirmDelete = useCallback(() => {
    if (!deletingId) return;
    onDelete(deletingId);
    setViewingIndex((prev) => {
      if (prev === null) return null;
      if (models.length <= 1) return null;
      return prev >= models.length - 1 ? prev - 1 : prev;
    });
    setDeletingId(null);
  }, [deletingId, onDelete, models.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
        <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-text-dim">Loading models...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-dim gap-2">
        <span className="text-[13px]">{error}</span>
        {onRetry && <button type="button" className="px-3 py-1 rounded text-[11px] bg-app-base border border-border text-text-secondary hover:border-accent" onClick={onRetry}>Retry</button>}
      </div>
    );
  }

  return (
    <div className={models.length === 0 ? 'flex-1 min-h-0 flex flex-col p-4' : 'flex-1 min-h-0 overflow-auto p-4'}>
      {models.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-text-dim">
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span className="text-[13px]">No 3D models yet</span>
          <span className="text-[11px] mt-1">Drop a photo of an object on the left and click Generate</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', alignContent: 'start' }}>
          {models.map((m) => (
            <ModelCard key={m.id} model={m} onView={handleView} onSaveAs={onSaveAs} onSaveToLibrary={onSaveToLibrary} onDelete={setDeletingId} />
          ))}
        </div>
      )}

      {viewingIndex !== null && viewingIndex < models.length && (
        <ModelLightbox
          models={models}
          currentIndex={viewingIndex}
          onNavigate={setViewingIndex}
          onClose={() => setViewingIndex(null)}
          onSaveAs={onSaveAs}
          onSaveToLibrary={onSaveToLibrary}
          onOpenFolder={onOpenFolder}
          onRegenerate={(m, s) => { setViewingIndex(null); onRegenerate(m, s); }}
          onDelete={setDeletingId}
          busy={busy}
        />
      )}

      {deletingId && (() => {
        const m = models.find((x) => x.id === deletingId);
        return m ? <DeleteModelDialog name={m.name} onConfirm={confirmDelete} onCancel={() => setDeletingId(null)} /> : null;
      })()}
    </div>
  );
}
