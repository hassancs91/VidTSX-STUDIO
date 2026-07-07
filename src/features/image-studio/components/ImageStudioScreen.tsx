import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useToast } from '@renderer/contexts/ToastContext';
import { useImageModels } from '../hooks/useImageModels';
import { useImageGallery } from '../hooks/useImageGallery';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { usePromptPresets } from '../hooks/usePromptPresets';
import { useActiveImageProvider } from '../hooks/useActiveImageProvider';
import { useImageSelection } from '../hooks/useImageSelection';
import { ControlPanel } from './ControlPanel';
import { ImageGallery } from './ImageGallery';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { CreateFolderDialog } from './CreateFolderDialog';
import { DeleteFolderDialog } from './DeleteFolderDialog';
import type { GalleryImage } from '../types';

function getAspectLabel(w: number | null, h: number | null): string {
  if (w == null || h == null || h === 0) return 'Unknown';
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return '1:1';
  if (Math.abs(r - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.05) return '9:16';
  if (Math.abs(r - 4 / 3) < 0.05) return '4:3';
  if (Math.abs(r - 3 / 2) < 0.05) return '3:2';
  return `${w}×${h}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ImageStudioScreen() {
  const { showToast } = useToast();
  const { models, loading: modelsLoading, error: modelsError, reload: reloadModels } = useImageModels();
  const {
    providers: enabledProviders,
    activeProvider,
    error: providerError,
    switchProvider,
  } = useActiveImageProvider();
  const {
    images,
    allImages,
    folders,
    activeFolderId,
    setActiveFolderId,
    loading: galleryLoading,
    error: galleryError,
    addEntry,
    removeEntry,
    removeEntries,
    saveAs,
    copyToClipboard,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
    refresh: refreshGallery,
  } = useImageGallery();
  const { contentPresets, stylePresets } = usePromptPresets();
  const [inputImages, setInputImages] = useState<string[]>([]);
  const [pendingUseAsInput, setPendingUseAsInput] = useState<
    { id: string; base64: string; contentType: string } | null
  >(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterAspect, setFilterAspect] = useState('');
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Folder dialog state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  // Resizable panel
  const MIN_PANEL = 280;
  const MAX_PANEL = 480;
  const [panelWidth, setPanelWidth] = useState(MIN_PANEL);
  const isDraggingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setPanelWidth((prev) => {
        const next = prev + e.movementX;
        return Math.max(MIN_PANEL, Math.min(MAX_PANEL, next));
      });
    };
    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onImageSaved = useCallback((entry: Parameters<typeof addEntry>[0]) => {
    addEntry(entry);
  }, [addEntry]);

  const { pending, isGenerating, error, generate } = useImageGeneration({
    onImageSaved,
    activeFolderId,
  });

  // Show toast for hook errors
  useEffect(() => {
    if (galleryError) showToast(galleryError, 'error');
  }, [galleryError, showToast]);

  useEffect(() => {
    if (modelsError) showToast(modelsError, 'error');
  }, [modelsError, showToast]);

  useEffect(() => {
    if (providerError) showToast(providerError, 'error');
  }, [providerError, showToast]);

  const handleConsumePendingUseAsInput = useCallback(() => {
    setPendingUseAsInput(null);
  }, []);

  const handleUseAsInput = useCallback(async (image: GalleryImage) => {
    try {
      const readResult = await window.api.imageStudioRead({ id: image.id });
      if (!readResult.success || !readResult.base64) {
        showToast('Failed to load image', 'error');
        return;
      }
      const saveResult = await window.api.refImageSave({
        base64: readResult.base64,
        originalName: image.fileName,
        contentType: image.contentType,
      });
      if (!saveResult.success || !saveResult.entry) {
        showToast(saveResult.error || 'Failed to save as reference', 'error');
        return;
      }
      setPendingUseAsInput({
        id: saveResult.entry.id,
        base64: readResult.base64,
        contentType: image.contentType,
      });
    } catch {
      showToast('Failed to load image', 'error');
    }
  }, [showToast]);

  // Derive unique models and aspect ratios from current view
  const uniqueModels = useMemo(() => {
    const set = new Set(images.map((img) => img.model));
    return Array.from(set).sort();
  }, [images]);

  const uniqueAspects = useMemo(() => {
    const set = new Set(images.map((img) => getAspectLabel(img.width, img.height)));
    return Array.from(set).sort();
  }, [images]);

  // Apply filters
  const filteredImages = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let result = images;

    if (query) {
      result = result.filter((img) => img.prompt.toLowerCase().includes(query));
    }
    if (filterModel) {
      result = result.filter((img) => img.model === filterModel);
    }
    if (filterAspect) {
      result = result.filter((img) => getAspectLabel(img.width, img.height) === filterAspect);
    }

    // Apply shuffle if seed > 0
    if (shuffleSeed > 0) {
      result = shuffleArray(result);
    }

    return result;
  }, [images, searchQuery, filterModel, filterAspect, shuffleSeed]);

  const hasFilters = searchQuery !== '' || filterModel !== '' || filterAspect !== '';

  const activeFolder = activeFolderId
    ? folders.find((f) => f.id === activeFolderId)
    : null;

  const deletingFolder = deletingFolderId
    ? folders.find((f) => f.id === deletingFolderId)
    : null;

  const handleCreateFolder = useCallback(async (name: string) => {
    await createFolder(name);
    setShowCreateFolder(false);
  }, [createFolder]);

  const handleDeleteFolder = useCallback(async (deleteImages: boolean) => {
    if (deletingFolderId) {
      await deleteFolder(deletingFolderId, deleteImages);
      setDeletingFolderId(null);
    }
  }, [deletingFolderId, deleteFolder]);

  const handleMoveToFolder = useCallback(async (imageId: string, folderId: string) => {
    await moveToFolder([imageId], folderId);
  }, [moveToFolder]);

  const handleMoveToRoot = useCallback(async (imageId: string) => {
    await moveToFolder([imageId], null);
  }, [moveToFolder]);

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    const { deleted, failed } = await removeEntries(ids);
    if (failed.length > 0) {
      showToast(
        `Deleted ${deleted.length} of ${ids.length} images (${failed.length} failed)`,
        'error'
      );
    } else if (deleted.length > 0) {
      showToast(`Deleted ${deleted.length} image${deleted.length !== 1 ? 's' : ''}`, 'success');
    }
  }, [removeEntries, showToast]);

  // Selection (lifted here so the toolbar can drive Select all)
  const {
    selectedIds,
    clear: clearSelection,
    selectAll,
    pruneToVisible,
    toggle: toggleSelection,
  } = useImageSelection();
  const filteredIdsKey = useMemo(() => filteredImages.map((i) => i.id).join(','), [filteredImages]);

  // Clear when navigating folders
  useEffect(() => {
    clearSelection();
  }, [activeFolderId, clearSelection]);

  // Drop ids that are no longer visible (filter changes, deletions, etc.)
  useEffect(() => {
    pruneToVisible(filteredIdsKey ? filteredIdsKey.split(',') : []);
  }, [filteredIdsKey, pruneToVisible]);

  const handleToggleSelect = useCallback(
    (id: string, additive: boolean) => {
      toggleSelection(id, additive, filteredImages.map((i) => i.id));
    },
    [toggleSelection, filteredImages]
  );

  const handleSelectAll = useCallback(() => {
    selectAll(filteredImages.map((i) => i.id));
  }, [selectAll, filteredImages]);

  const allFilteredSelected =
    filteredImages.length > 0 && selectedIds.size === filteredImages.length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0 gap-2"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {activeFolder ? (
          <FolderBreadcrumb
            folderName={activeFolder.name}
            onNavigateRoot={() => setActiveFolderId(null)}
          />
        ) : (
          <span className="text-[13px] font-medium text-text-secondary">
            Image Studio
          </span>
        )}
        {allImages.length > 0 && (
          <span className="text-[11px] text-text-dim">
            {filteredImages.length !== images.length
              ? `${filteredImages.length} / ${images.length}`
              : images.length}{' '}
            image{images.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search & filters */}
        <div className="flex items-center gap-1.5">
          {/* New Folder button */}
          {activeFolderId === null && (
            <button
              type="button"
              className="h-[26px] px-2 rounded flex items-center gap-1 text-[11px] bg-app-base border border-border text-text-secondary hover:border-accent hover:text-accent-light transition-colors"
              onClick={() => setShowCreateFolder(true)}
              title="New folder"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              Folder
            </button>
          )}

          {filteredImages.length > 0 && (
            <button
              type="button"
              className={`h-[26px] px-2 rounded flex items-center gap-1 text-[11px] border transition-colors ${
                allFilteredSelected
                  ? 'bg-accent/15 border-accent text-accent-light'
                  : 'bg-app-base border-border text-text-secondary hover:border-accent hover:text-accent-light'
              }`}
              onClick={allFilteredSelected ? clearSelection : handleSelectAll}
              title={allFilteredSelected ? 'Deselect all' : `Select all ${filteredImages.length} visible images`}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                {allFilteredSelected ? (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <polyline points="8 12 11 15 16 9" />
                  </>
                )}
              </svg>
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}

          {images.length > 0 && (
            <>
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-[26px] w-[160px] px-2 rounded text-[11px] bg-app-base border border-border text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
              />

              <select
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="h-[26px] px-1.5 rounded text-[11px] bg-app-base border border-border text-text-secondary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All models</option>
                {uniqueModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={filterAspect}
                onChange={(e) => setFilterAspect(e.target.value)}
                className="h-[26px] px-1.5 rounded text-[11px] bg-app-base border border-border text-text-secondary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All ratios</option>
                {uniqueAspects.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="h-[26px] px-2 rounded text-[11px] text-text-dim hover:text-text-primary transition-colors"
                  onClick={() => { setSearchQuery(''); setFilterModel(''); setFilterAspect(''); }}
                  title="Clear filters"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                className="h-[26px] w-[26px] rounded flex items-center justify-center bg-app-base border border-border text-text-secondary hover:border-accent hover:text-accent-light transition-colors"
                onClick={() => setShuffleSeed((s) => s + 1)}
                title="Shuffle images"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        <div className="shrink-0 h-full" style={{ width: panelWidth }}>
          <ControlPanel
            models={models}
            modelsLoading={modelsLoading}
            isGenerating={isGenerating}
            error={error}
            inputImages={inputImages}
            onGenerate={generate}
            onInputImagesChange={setInputImages}
            pendingUseAsInput={pendingUseAsInput}
            onConsumePendingUseAsInput={handleConsumePendingUseAsInput}
            onImageSaved={addEntry}
            contentPresets={contentPresets}
            stylePresets={stylePresets}
            activeFolderId={activeFolderId}
            providers={enabledProviders}
            activeProvider={activeProvider}
            onProviderChange={async (id) => {
              const ok = await switchProvider(id);
              if (ok) await reloadModels();
            }}
          />
        </div>
        {/* Resize handle */}
        <div
          className="w-[4px] shrink-0 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors"
          onMouseDown={handleResizeStart}
          style={{ borderRight: '0.5px solid var(--color-border)' }}
        />
        <ImageGallery
          images={filteredImages}
          pending={pending}
          loading={galleryLoading}
          error={galleryError}
          onRetry={refreshGallery}
          folders={folders}
          activeFolderId={activeFolderId}
          onSaveAs={saveAs}
          onCopy={copyToClipboard}
          onDelete={removeEntry}
          onBulkDelete={handleBulkDelete}
          onUseAsInput={handleUseAsInput}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          onFolderClick={setActiveFolderId}
          onFolderRename={renameFolder}
          onFolderDelete={setDeletingFolderId}
          onMoveToFolder={handleMoveToFolder}
          onMoveToRoot={activeFolderId ? handleMoveToRoot : undefined}
        />
      </div>

      {/* Dialogs */}
      {showCreateFolder && (
        <CreateFolderDialog
          onConfirm={handleCreateFolder}
          onCancel={() => setShowCreateFolder(false)}
        />
      )}
      {deletingFolder && (
        <DeleteFolderDialog
          folderName={deletingFolder.name}
          imageCount={deletingFolder.imageCount}
          onConfirm={handleDeleteFolder}
          onCancel={() => setDeletingFolderId(null)}
        />
      )}
    </div>
  );
}
