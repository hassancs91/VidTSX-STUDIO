import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { GalleryVideo, GalleryFolder, VideoJobView } from '../types';
import { VideoJobCard } from './VideoJobCard';
import { VideoCard } from './VideoCard';
import { VideoLightbox } from './VideoLightbox';
import { FolderCard } from './FolderCard';
import { DeleteVideoDialog } from './DeleteVideoDialog';
import { BulkDeleteDialog } from './BulkDeleteDialog';

const BATCH_SIZE = 30;

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

interface VideoGalleryProps {
  videos: GalleryVideo[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  folders: GalleryFolder[];
  activeFolderId: string | null;
  onSaveAs: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void> | void;
  onFolderClick: (folderId: string) => void;
  onFolderRename: (id: string, name: string) => void;
  onFolderDelete: (id: string) => void;
  onMoveToFolder: (videoId: string, folderId: string) => void;
  onMoveToRoot?: (videoId: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, additive: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  /** In-flight (and just-failed) generations, newest first. */
  jobs?: VideoJobView[];
  /** Wall clock for the job cards' elapsed times. */
  jobsNow?: number;
  onCancelJob?: (jobId: string) => void;
  onDismissJob?: (jobId: string) => void;
}

export function VideoGallery({
  videos,
  loading,
  error,
  onRetry,
  folders,
  activeFolderId,
  onSaveAs,
  onDelete,
  onBulkDelete,
  onFolderClick,
  onFolderRename,
  onFolderDelete,
  onMoveToFolder,
  onMoveToRoot,
  jobs = [],
  jobsNow = 0,
  onCancelJob,
  onDismissJob,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
}: VideoGalleryProps) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [activeFolderId]);

  useEffect(() => {
    setVisibleCount((prev) =>
      videos.length < prev ? Math.max(BATCH_SIZE, Math.min(prev, videos.length || BATCH_SIZE)) : prev,
    );
  }, [videos.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (visibleCount >= videos.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, videos.length));
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, videos.length]);

  const visibleVideos = useMemo(() => videos.slice(0, visibleCount), [videos, visibleCount]);
  const hasMore = visibleCount < videos.length;
  const selectionCount = selectedIds.size;
  const selectionMode = selectionCount > 0;

  const handleView = useCallback(
    (video: GalleryVideo) => {
      const idx = videos.findIndex((v) => v.id === video.id);
      if (idx >= 0) setViewingIndex(idx);
    },
    [videos],
  );

  const requestDelete = useCallback((id: string) => {
    setDeletingVideoId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deletingVideoId) return;
    onDelete(deletingVideoId);
    setViewingIndex((prev) => {
      if (prev === null) return null;
      if (videos.length <= 1) return null;
      if (prev >= videos.length - 1) return prev - 1;
      return prev;
    });
    setDeletingVideoId(null);
  }, [deletingVideoId, onDelete, videos.length]);

  const cancelDelete = useCallback(() => {
    setDeletingVideoId(null);
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setShowBulkDelete(false);
    await onBulkDelete(ids);
    onClearSelection();
  }, [selectedIds, onBulkDelete, onClearSelection]);

  useEffect(() => {
    if (!selectionMode) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !showBulkDelete &&
        deletingVideoId === null &&
        viewingIndex === null
      ) {
        onClearSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectionMode, showBulkDelete, deletingVideoId, viewingIndex, onClearSelection]);

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
  const hasVideos = videos.length > 0;
  const hasJobs = jobs.length > 0;
  const isEmpty = !hasVideos && !showFolders && !hasJobs;
  const allVisibleSelected = videos.length > 0 && selectionCount === videos.length;

  return (
    <div className={isEmpty ? 'flex-1 min-h-0 flex flex-col p-4' : 'flex-1 min-h-0 overflow-auto p-4 relative'}>
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
            {allVisibleSelected ? 'Deselect all' : `Select all (${videos.length})`}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            className="h-[26px] px-2.5 rounded flex items-center gap-1.5 text-[11px] bg-red-600 text-white hover:bg-red-700 transition-colors"
            onClick={() => setShowBulkDelete(true)}
            title="Delete selected videos"
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
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </>
            )}
          </svg>
          <span className="text-[13px]">
            {activeFolderId ? 'This folder is empty' : 'No videos yet'}
          </span>
          <span className="text-[11px] mt-1">
            {activeFolderId
              ? 'Drag videos here, or generate one with the panel on the left'
              : 'Describe a shot in the panel on the left to generate your first clip.'}
          </span>
        </div>
      ) : (
        <div className="flex flex-row gap-4">
          <div className="flex-1 min-w-0">
            {showFolders && <SectionHeader label="Videos" count={videos.length} />}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '8px',
                alignContent: 'start',
              }}
            >
              {jobs.map((job) => (
                <VideoJobCard
                  key={job.jobId}
                  job={job}
                  now={jobsNow}
                  onCancel={(id) => onCancelJob?.(id)}
                  onDismiss={(id) => onDismissJob?.(id)}
                />
              ))}
              {visibleVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onView={handleView}
                  onSaveAs={onSaveAs}
                  onDelete={requestDelete}
                  onMoveToRoot={onMoveToRoot}
                  selected={selectedIds.has(video.id)}
                  selectionMode={selectionMode}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
            {!hasVideos && !hasJobs && (
              <div className="flex flex-col items-center justify-center py-10 text-text-dim">
                <span className="text-[13px]">No videos yet</span>
                <span className="text-[11px] mt-1">
                  Generate one with the panel on the left
                </span>
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
      )}

      {viewingIndex !== null && viewingIndex < videos.length && (
        <VideoLightbox
          videos={videos}
          currentIndex={viewingIndex}
          onNavigate={setViewingIndex}
          onClose={() => setViewingIndex(null)}
          onSaveAs={onSaveAs}
          onDelete={requestDelete}
        />
      )}

      {deletingVideoId && (() => {
        const v = videos.find((x) => x.id === deletingVideoId);
        return v ? (
          <DeleteVideoDialog
            promptText={v.prompt}
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
