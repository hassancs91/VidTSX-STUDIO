import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { GalleryImage, PendingGeneration, GalleryFolder } from '../types';
import { ImageCard } from './ImageCard';
import { ImageSkeleton } from './ImageSkeleton';
import { ImageLightbox } from './ImageLightbox';
import { FolderCard } from './FolderCard';
import { DeleteImageDialog } from './DeleteImageDialog';
import { BulkDeleteDialog } from './BulkDeleteDialog';

const BATCH_SIZE = 60;

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
        {label}
      </span>
      <span className="text-[10px] text-text-dim/70">·</span>
      <span className="text-[10px] text-text-dim">{count}</span>
    </div>
  );
}

interface ImageGalleryProps {
  images: GalleryImage[];
  pending: PendingGeneration[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  folders: GalleryFolder[];
  activeFolderId: string | null;
  onSaveAs: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void> | void;
  onUseAsInput: (image: GalleryImage) => void;
  onFolderClick: (folderId: string) => void;
  onFolderRename: (id: string, name: string) => void;
  onFolderDelete: (id: string) => void;
  onMoveToFolder: (imageId: string, folderId: string) => void;
  onMoveToRoot?: (imageId: string) => void;
  // Selection (lifted to parent so the toolbar can drive it)
  selectedIds: Set<string>;
  onToggleSelect: (id: string, additive: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function ImageGallery({
  images,
  pending,
  loading,
  error,
  onRetry,
  folders,
  activeFolderId,
  onSaveAs,
  onCopy,
  onDelete,
  onBulkDelete,
  onUseAsInput,
  onFolderClick,
  onFolderRename,
  onFolderDelete,
  onMoveToFolder,
  onMoveToRoot,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
}: ImageGalleryProps) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Reset pagination when folder changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [activeFolderId]);

  useEffect(() => {
    setVisibleCount((prev) => (images.length < prev ? Math.max(BATCH_SIZE, Math.min(prev, images.length || BATCH_SIZE)) : prev));
  }, [images.length]);

  // Infinite-scroll sentinel: grow visibleCount as the bottom sentinel nears the viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (visibleCount >= images.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, images.length));
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, images.length]);

  const visibleImages = useMemo(() => images.slice(0, visibleCount), [images, visibleCount]);
  const hasMore = visibleCount < images.length;
  const selectionCount = selectedIds.size;
  const selectionMode = selectionCount > 0;

  const handleView = useCallback((image: GalleryImage) => {
    const idx = images.findIndex((img) => img.id === image.id);
    if (idx >= 0) setViewingIndex(idx);
  }, [images]);

  const requestDelete = useCallback((id: string) => {
    setDeletingImageId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deletingImageId) return;
    onDelete(deletingImageId);
    setViewingIndex((prev) => {
      if (prev === null) return null;
      if (images.length <= 1) return null;
      if (prev >= images.length - 1) return prev - 1;
      return prev;
    });
    setDeletingImageId(null);
  }, [deletingImageId, onDelete, images.length]);

  const cancelDelete = useCallback(() => {
    setDeletingImageId(null);
  }, []);

  const handleUseAsInput = useCallback((image: GalleryImage) => {
    onUseAsInput(image);
    setViewingIndex(null);
  }, [onUseAsInput]);

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setShowBulkDelete(false);
    await onBulkDelete(ids);
    onClearSelection();
  }, [selectedIds, onBulkDelete, onClearSelection]);

  // Esc clears selection (when bulk dialog isn't open)
  useEffect(() => {
    if (!selectionMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showBulkDelete && deletingImageId === null && viewingIndex === null) {
        onClearSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectionMode, showBulkDelete, deletingImageId, viewingIndex, onClearSelection]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
        <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-text-dim">Loading gallery...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-dim gap-2">
        <span className="text-[13px]">{error}</span>
        {onRetry && (
          <button
            type="button"
            className="px-3 py-1 rounded text-[11px] bg-app-base border border-border text-text-secondary hover:border-accent transition-colors"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const showFolders = activeFolderId === null && folders.length > 0;
  const hasImages = pending.length > 0 || images.length > 0;
  const isEmpty = !hasImages && !showFolders;
  const allVisibleSelected = images.length > 0 && selectionCount === images.length;

  return (
    <div className={isEmpty ? 'flex-1 min-h-0 flex flex-col p-4' : 'flex-1 min-h-0 overflow-auto p-4 relative'}>
      {/* Sticky bulk action bar */}
      {selectionMode && (
        <div
          className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 px-4 py-2 bg-app-surface flex items-center gap-2"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <button
            type="button"
            className="h-[26px] w-[26px] rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-app-base transition-colors"
            onClick={onClearSelection}
            title="Clear selection (Esc)"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className="text-[12px] font-medium text-text-primary">
            {selectionCount} selected
          </span>
          <button
            type="button"
            className="text-[11px] text-text-dim hover:text-accent-light transition-colors"
            onClick={allVisibleSelected ? onClearSelection : onSelectAll}
          >
            {allVisibleSelected ? 'Deselect all' : `Select all (${images.length})`}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            className="h-[26px] px-2.5 rounded flex items-center gap-1.5 text-[11px] bg-red-600 text-white hover:bg-red-700 transition-colors"
            onClick={() => setShowBulkDelete(true)}
            title="Delete selected images"
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete {selectionCount}
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center flex-1 text-text-dim">
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
            {activeFolderId ? (
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            ) : (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </>
            )}
          </svg>
          <span className="text-[13px]">
            {activeFolderId ? 'This folder is empty' : 'Generate your first image'}
          </span>
          <span className="text-[11px] mt-1">
            {activeFolderId ? 'Generate images or drag them here' : 'Enter a prompt and click Generate'}
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-row gap-4">
            {/* Images column */}
            <div className="flex-1 min-w-0">
              {showFolders && <SectionHeader label="Images" count={images.length} />}
              <div
                style={{
                  columnWidth: '180px',
                  columnCount: 'auto',
                  columnGap: '8px',
                }}
              >
                {pending.map((item) => (
                  <div key={item.tempId} style={{ breakInside: 'avoid', marginBottom: '8px' }}>
                    <ImageSkeleton item={item} />
                  </div>
                ))}
                {visibleImages.map((image) => (
                  <div key={image.id} style={{ breakInside: 'avoid', marginBottom: '8px' }}>
                    <ImageCard
                      image={image}
                      onView={handleView}
                      onSaveAs={onSaveAs}
                      onCopy={onCopy}
                      onDelete={requestDelete}
                      onUseAsInput={onUseAsInput}
                      onMoveToRoot={onMoveToRoot}
                      selected={selectedIds.has(image.id)}
                      selectionMode={selectionMode}
                      onToggleSelect={onToggleSelect}
                    />
                  </div>
                ))}
              </div>
              {!hasImages && (
                <div className="flex flex-col items-center justify-center py-10 text-text-dim">
                  <span className="text-[13px]">No images yet</span>
                  <span className="text-[11px] mt-1">Enter a prompt and click Generate</span>
                </div>
              )}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="w-full flex items-center justify-center py-4 text-[11px] text-text-dim"
                >
                  <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin mr-2" />
                  Loading more…
                </div>
              )}
            </div>

            {/* Vertical separator + Folders column */}
            {showFolders && (
              <>
                <div
                  className="self-stretch shrink-0"
                  style={{ width: 0, borderLeft: '0.5px solid var(--color-border)' }}
                />
                <div className="shrink-0" style={{ width: 300 }}>
                  <SectionHeader label="Folders" count={folders.length} />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px',
                      alignContent: 'start',
                    }}
                  >
                    {folders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        onClick={onFolderClick}
                        onRename={onFolderRename}
                        onDelete={onFolderDelete}
                        onDrop={onMoveToFolder}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {viewingIndex !== null && viewingIndex < images.length && (
        <ImageLightbox
          images={images}
          currentIndex={viewingIndex}
          onNavigate={setViewingIndex}
          onClose={() => setViewingIndex(null)}
          onSaveAs={onSaveAs}
          onCopy={onCopy}
          onDelete={requestDelete}
          onUseAsInput={handleUseAsInput}
        />
      )}

      {deletingImageId && (() => {
        const img = images.find((i) => i.id === deletingImageId);
        return img ? (
          <DeleteImageDialog
            promptText={img.prompt}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        ) : null;
      })()}

      {showBulkDelete && (
        <BulkDeleteDialog
          count={selectionCount}
          onConfirm={handleConfirmBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}
    </div>
  );
}
