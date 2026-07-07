import { useState, useCallback, useEffect, useMemo } from 'react';
import { useVideoGallery } from '../hooks/useVideoGallery';
import { useVideoSelection } from '../hooks/useVideoSelection';
import { VideoGallery } from './VideoGallery';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { CreateFolderDialog } from './CreateFolderDialog';
import { DeleteFolderDialog } from './DeleteFolderDialog';

const FolderPlusIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

export function VideoStudioScreen() {
  const {
    videos,
    folders,
    activeFolderId,
    setActiveFolderId,
    loading,
    error,
    removeEntry,
    removeEntries,
    saveAs,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
    refresh,
  } = useVideoGallery();

  const { selectedIds, clear, selectAll, pruneToVisible, toggle } = useVideoSelection();

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderPendingDelete, setFolderPendingDelete] = useState<string | null>(null);

  const visibleIds = useMemo(() => videos.map((v) => v.id), [videos]);

  // Drop hidden ids from the selection whenever the visible set changes (folder
  // switch, batched delete, etc).
  useEffect(() => {
    pruneToVisible(visibleIds);
  }, [visibleIds, pruneToVisible]);

  const handleToggle = useCallback(
    (id: string, additive: boolean) => {
      toggle(id, additive, visibleIds);
    },
    [toggle, visibleIds],
  );

  const handleSelectAll = useCallback(() => {
    selectAll(visibleIds);
  }, [selectAll, visibleIds]);

  const handleSaveAs = useCallback(
    (id: string) => {
      void saveAs(id);
    },
    [saveAs],
  );

  const handleDelete = useCallback(
    (id: string) => {
      void removeEntry(id);
    },
    [removeEntry],
  );

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      await removeEntries(ids);
    },
    [removeEntries],
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      setActiveFolderId(folderId);
      clear();
    },
    [setActiveFolderId, clear],
  );

  const handleNavigateRoot = useCallback(() => {
    setActiveFolderId(null);
    clear();
  }, [setActiveFolderId, clear]);

  const handleFolderRename = useCallback(
    (id: string, name: string) => {
      void renameFolder(id, name);
    },
    [renameFolder],
  );

  const handleFolderDeleteRequest = useCallback((id: string) => {
    setFolderPendingDelete(id);
  }, []);

  const handleFolderDeleteConfirm = useCallback(
    (deleteVideos: boolean) => {
      if (!folderPendingDelete) return;
      void deleteFolder(folderPendingDelete, deleteVideos);
      setFolderPendingDelete(null);
    },
    [deleteFolder, folderPendingDelete],
  );

  const handleMoveToFolder = useCallback(
    (videoId: string, folderId: string) => {
      void moveToFolder([videoId], folderId);
    },
    [moveToFolder],
  );

  const handleMoveToRoot = useCallback(
    (videoId: string) => {
      void moveToFolder([videoId], null);
    },
    [moveToFolder],
  );

  const handleCreateFolderConfirm = useCallback(
    (name: string) => {
      void createFolder(name);
      setShowCreateFolder(false);
    },
    [createFolder],
  );

  const activeFolder = activeFolderId ? folders.find((f) => f.id === activeFolderId) : null;
  const folderToDelete = folderPendingDelete
    ? folders.find((f) => f.id === folderPendingDelete)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {activeFolder ? (
          <FolderBreadcrumb
            folderName={activeFolder.name}
            onNavigateRoot={handleNavigateRoot}
          />
        ) : (
          <span className="text-[13px] font-medium text-text-secondary">Videos</span>
        )}
        <span className="text-[11px] text-text-dim">·</span>
        <span className="text-[11px] text-text-dim">{videos.length}</span>

        <div className="flex-1" />

        {/* New Folder — only at root */}
        {activeFolderId === null && (
          <button
            type="button"
            className="h-[26px] px-2.5 rounded flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-text-primary hover:bg-app-hover transition-colors"
            onClick={() => setShowCreateFolder(true)}
            title="New folder"
          >
            <FolderPlusIcon />
            New Folder
          </button>
        )}

        {/* Refresh */}
        <button
          type="button"
          className="h-[26px] w-[26px] rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-app-hover transition-colors"
          onClick={() => void refresh()}
          title="Refresh"
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        <VideoGallery
          videos={videos}
          loading={loading}
          error={error}
          onRetry={refresh}
          folders={folders}
          activeFolderId={activeFolderId}
          onSaveAs={handleSaveAs}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onFolderClick={handleFolderClick}
          onFolderRename={handleFolderRename}
          onFolderDelete={handleFolderDeleteRequest}
          onMoveToFolder={handleMoveToFolder}
          onMoveToRoot={activeFolderId !== null ? handleMoveToRoot : undefined}
          selectedIds={selectedIds}
          onToggleSelect={handleToggle}
          onSelectAll={handleSelectAll}
          onClearSelection={clear}
        />
      </div>

      {showCreateFolder && (
        <CreateFolderDialog
          onConfirm={handleCreateFolderConfirm}
          onCancel={() => setShowCreateFolder(false)}
        />
      )}

      {folderToDelete && (
        <DeleteFolderDialog
          folderName={folderToDelete.name}
          videoCount={folderToDelete.videoCount}
          onConfirm={handleFolderDeleteConfirm}
          onCancel={() => setFolderPendingDelete(null)}
        />
      )}
    </div>
  );
}
