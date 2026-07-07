import { useState, useEffect, useRef, useCallback } from "react";
import { Panel, Button } from "@shared/components";
import { IsolatedPreview, useComponentLoader, setupVirtualModuleGlobals } from "@features/player";
import { CodeEditor, ResizableDivider, useCodeEditor, configureMonacoOffline } from "@features/editor";
import { useRenderQueue } from "@features/render-queue";
import { useToast } from "@renderer/contexts/ToastContext";
import { FileTree } from "./FileTree";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { NewFolderModal } from "./NewFolderModal";
import { RenderSettingsModal, type RenderSettings } from "@shared/components/RenderSettingsModal";
import { useFileTree } from "../hooks/useFileTree";
import { useSelectedFile } from "../contexts/SelectedFileContext";
import type { FileNode } from "../types";

// Configure Monaco once on module load
configureMonacoOffline();

const ImportIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 1V10" />
    <path d="M3.5 6.5L7 10L10.5 6.5" />
    <path d="M2 12.5H12" />
  </svg>
);

const FolderPlusIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 3.5V11C1.5 11.55 1.95 12 2.5 12H11.5C12.05 12 12.5 11.55 12.5 11V5C12.5 4.45 12.05 4 11.5 4H7L5.5 2.5H2.5C1.95 2.5 1.5 2.95 1.5 3.5Z" />
    <path d="M7 6.5V9.5" />
    <path d="M5.5 8H8.5" />
  </svg>
);

const RenderIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
    <path d="M5.5 5.5L9 7L5.5 8.5V5.5Z" fill="currentColor" />
  </svg>
);

function looksLikeTsx(text: string): boolean {
  const hasImportExport = /import\s|export\s/.test(text);
  const hasJsx = /<\w+/.test(text);
  return hasImportExport && hasJsx;
}

// Initialize virtual module globals once
let globalsInitialized = false;

// View mode type
type ViewMode = 'visual' | 'code';

export function WorkspaceScreen() {
  const { nodes, loading, error, importFiles, createFolder, renameItem, deleteItem, moveItem, refresh } =
    useFileTree();
  const { selectedFile, setSelectedFile } = useSelectedFile();
  const { addJob } = useRenderQueue();
  const { showToast } = useToast();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [globalsReady, setGlobalsReady] = useState(globalsInitialized);
  const [codeHeight, setCodeHeight] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('visual'); // Default to visual
  const dragCounterRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use the new native component loader
  const { state: loaderState, loadComponent } = useComponentLoader();

  // Use the code editor hook for the selected file
  const {
    state: editorState,
    content,
    setContent,
    save,
  } = useCodeEditor({
    filePath: selectedFile?.path ?? null,
    autoSaveDelay: 500,
  });

  // Initialize virtual module globals on mount
  useEffect(() => {
    if (!globalsInitialized) {
      globalsInitialized = true;
      setupVirtualModuleGlobals().then(() => {
        setGlobalsReady(true);
      });
    }
  }, []);

  const handleSelectFile = (file: FileNode) => {
    setSelectedFile(file);
    // Trigger transpilation when a file is selected
    loadComponent(file.path);
  };

  const handleNewFolder = () => {
    setIsCreatingFolder(true);
  };

  const handleCreateFolder = async (name: string) => {
    await createFolder(name);
    setIsCreatingFolder(false);
  };

  // Handle save and re-transpile
  const handleSave = useCallback(async () => {
    await save();
    // Re-transpile after save
    if (selectedFile?.path) {
      // Small delay to ensure file is written
      setTimeout(() => {
        loadComponent(selectedFile.path);
      }, 100);
    }
  }, [save, selectedFile?.path, loadComponent]);

  // Handle render button click — open settings modal
  const handleRender = useCallback(() => {
    if (!selectedFile || loaderState.status !== 'success' || !loaderState.config) {
      showToast('No file loaded or composition not ready', 'error');
      return;
    }
    setIsRenderModalOpen(true);
  }, [selectedFile, loaderState, showToast]);

  // Handle render confirm from settings modal
  const handleRenderConfirm = useCallback(async (settings: RenderSettings) => {
    if (!selectedFile || loaderState.status !== 'success' || !loaderState.config) {
      return;
    }

    try {
      await addJob({
        filePath: selectedFile.path,
        fileName: selectedFile.name,
        compositionId: loaderState.config.id,
        codec: settings.codec,
        width: loaderState.config.width,
        height: loaderState.config.height,
        fps: settings.fps,
        crf: settings.crf,
        muted: settings.muted,
        scale: settings.scale,
        everyNthFrame: settings.everyNthFrame,
        numberOfGifLoops: settings.numberOfGifLoops,
        transparent: settings.transparent,
        cpuUsage: settings.cpuUsage,
        gpuBackend: settings.gpuBackend,
        hardwareAcceleration: settings.hardwareAcceleration,
      });

      showToast('Added to render queue', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add to render queue';
      showToast(message, 'error');
    }
  }, [selectedFile, loaderState, addJob, showToast]);

  // Handle divider resize
  const handleResize = useCallback((deltaY: number) => {
    setCodeHeight((prev) => {
      const containerHeight = containerRef.current?.clientHeight ?? 600;
      const minCodeHeight = 150;
      const minPreviewHeight = 150;
      const maxCodeHeight = containerHeight - minPreviewHeight - 6; // 6px for divider

      const currentHeight = prev ?? containerHeight * 0.55;
      const newHeight = currentHeight + deltaY;

      return Math.max(minCodeHeight, Math.min(maxCodeHeight, newHeight));
    });
  }, []);

  const handleResizeEnd = useCallback(() => {
    // Could persist the resize value here if needed
  }, []);

  // Drag and drop handling with counter-based approach
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer?.files ?? []);
      const tsxFiles: string[] = [];

      for (const file of files) {
        if (file.name.endsWith(".tsx")) {
          // Electron adds path property to File objects
          const filePath = (file as unknown as { path?: string }).path;
          if (filePath) {
            tsxFiles.push(filePath);
          }
        }
      }

      if (tsxFiles.length > 0) {
        await window.api.fileImport({ sourcePaths: tsxFiles });
        refresh();
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [refresh]);

  // Clipboard paste handling (Ctrl+V)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        // Don't intercept if focus is in an input
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }

        const { text } = await window.api.clipboardReadText();

        if (text && looksLikeTsx(text)) {
          e.preventDefault();
          const { path: projectsDir } = await window.api.fileGetProjectsDir();

          // Generate unique filename
          let counter = 1;
          let fileName = `untitled-${counter}.tsx`;

          while (true) {
            const fullPath = projectsDir + "/" + fileName;
            const readResult = await window.api.fileRead({ path: fullPath });
            if (readResult.error) {
              // File doesn't exist, we can use this name
              break;
            }
            counter++;
            fileName = `untitled-${counter}.tsx`;
          }

          const fullPath = projectsDir + "/" + fileName;
          await window.api.fileWrite({ path: fullPath, content: text });
          refresh();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refresh]);

  // Calculate heights for code-visual layout
  const containerHeight = containerRef.current?.clientHeight ?? 600;
  const actualCodeHeight = codeHeight ?? containerHeight * 0.55;

  // Render preview based on loader state (used within code-visual layout)
  const renderPreview = () => {
    if (!globalsReady) {
      return (
        <div className="flex items-center justify-center h-full">
          <div
            className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
            role="status"
          />
        </div>
      );
    }

    if (loaderState.status === 'loading') {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div
              className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"
              role="status"
            />
            <p className="text-text-dim text-[10px]">Transpiling...</p>
          </div>
        </div>
      );
    }

    if (loaderState.status === 'error') {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="text-center max-w-full">
            <div className="text-accent-red text-[11px] font-medium mb-1">
              Preview Error
            </div>
            <div className="text-text-dim text-[10px] font-mono whitespace-pre-wrap overflow-auto max-h-20">
              {loaderState.error}
            </div>
            {loaderState.errorLocation && (
              <div className="text-text-dim text-[9px] mt-1 opacity-70">
                Line {loaderState.errorLocation.line}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (loaderState.status === 'success' && loaderState.moduleUrl && loaderState.config) {
      return (
        <IsolatedPreview
          moduleUrl={loaderState.moduleUrl}
          config={loaderState.config}
          className="h-full"
        />
      );
    }

    // Idle state
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-dim text-[11px]">Edit code to see preview</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative">
      <DropZoneOverlay visible={isDragging} />

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={isCreatingFolder}
        onClose={() => setIsCreatingFolder(false)}
        onCreate={handleCreateFolder}
      />

      {/* Render Settings Modal */}
      {loaderState.status === 'success' && loaderState.config && (
        <RenderSettingsModal
          isOpen={isRenderModalOpen}
          onClose={() => setIsRenderModalOpen(false)}
          onRender={handleRenderConfirm}
          compositionConfig={{
            width: loaderState.config.width,
            height: loaderState.config.height,
            fps: loaderState.config.fps,
          }}
        />
      )}

      {/* Toolbar */}
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: "0.5px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-text-secondary">Files</span>
          {/* Show file info when a file is selected */}
          {selectedFile && (
            <>
              <span className="text-text-muted">/</span>
              <span className="text-[13px] text-text-primary">{editorState.fileName}</span>
              {/* Show line count and saving indicator only in code mode */}
              {viewMode === 'code' && (
                <>
                  <span className="text-[11px] text-text-dim">{editorState.lineCount} lines</span>
                  {editorState.isSaving && (
                    <span className="flex items-center gap-1 text-[11px] text-text-dim">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      Saving...
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle - only show when file is selected */}
          {selectedFile && (
            <div className="flex rounded overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
              <button
                onClick={() => setViewMode('visual')}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'visual'
                    ? 'bg-accent text-white'
                    : 'bg-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Visual
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'code'
                    ? 'bg-accent text-white'
                    : 'bg-transparent text-text-secondary hover:text-text-primary'
                }`}
                style={{ borderLeft: '0.5px solid var(--color-border)' }}
              >
                Code
              </button>
            </div>
          )}
          <Button variant="secondary" onClick={handleNewFolder}>
            <span className="flex items-center gap-1.5">
              <FolderPlusIcon />
              New folder
            </span>
          </Button>
          <Button variant="secondary" onClick={importFiles}>
            <span className="flex items-center gap-1.5">
              <ImportIcon />
              Import TSX
            </span>
          </Button>
          {/* Render button - only show when file is selected */}
          {selectedFile && (
            <Button variant="primary" onClick={handleRender}>
              <span className="flex items-center gap-1.5">
                <RenderIcon />
                Render
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-3 p-3 overflow-hidden">
        <Panel header="Project files" className="w-[200px] shrink-0 flex flex-col">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-[100px] text-text-dim text-[11px]">
                Loading...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-[100px] text-accent-red text-[11px] px-2 text-center">
                {error}
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[100px] text-text-dim text-[11px] px-2 text-center">
                <p>No files yet</p>
                <p className="mt-1">Click "Import TSX" to add files</p>
              </div>
            ) : (
              <FileTree
                nodes={nodes}
                selectedId={selectedFile?.id ?? null}
                onSelectFile={handleSelectFile}
                onRename={renameItem}
                onDelete={deleteItem}
                onCreateSubfolder={createFolder}
                onMove={moveItem}
              />
            )}
          </div>
        </Panel>

        {/* Code-Visual View */}
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
          {selectedFile ? (
            viewMode === 'visual' ? (
              /* Visual mode: Full height video preview */
              <div className="flex-1 min-h-0 bg-app-player rounded-lg overflow-hidden">
                {renderPreview()}
              </div>
            ) : (
              /* Code mode: Split view */
              <>
                {/* Code editor area */}
                <div
                  className="shrink-0 rounded-lg overflow-hidden"
                  style={{
                    height: actualCodeHeight,
                    border: '0.5px solid var(--color-border)',
                  }}
                >
                  <CodeEditor
                    filePath={selectedFile.path}
                    content={content}
                    onChange={setContent}
                    onSave={handleSave}
                    className="h-full"
                  />
                </div>

                {/* Resizable divider */}
                <ResizableDivider
                  onResize={handleResize}
                  onResizeEnd={handleResizeEnd}
                />

                {/* Video preview area */}
                <div className="flex-1 min-h-0 bg-app-player rounded-lg overflow-hidden">
                  {renderPreview()}
                </div>
              </>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center bg-app-player rounded-lg">
              <p className="text-text-dim" style={{ fontSize: 12 }}>
                Select a file to preview
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
