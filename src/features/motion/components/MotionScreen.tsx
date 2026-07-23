import { useState, useCallback, useRef, useEffect } from 'react';
import { useMotionGenerator } from '../hooks/useMotionGenerator';
import { useMotionProject } from '../hooks/useMotionProject';
import { TsxJobsProvider, useTsxJobs } from '../contexts/TsxJobsContext';
import type { TsxJobIpc } from '../../../shared/ipc/types';
import { useToast } from '@renderer/contexts/ToastContext';
import { MotionInputPanel } from './MotionInputPanel';
import { MotionPreviewPanel } from './MotionPreviewPanel';
import { MotionLibraryPanel } from './MotionLibraryPanel';
import { MotionJobsStrip } from './MotionJobsStrip';

export function MotionScreen() {
  return (
    <TsxJobsProvider>
      <MotionScreenContent />
    </TsxJobsProvider>
  );
}

function MotionScreenContent() {
  const generator = useMotionGenerator();
  const projectManager = useMotionProject();
  const { jobs, startJob, cancelJob } = useTsxJobs();
  const { showToast } = useToast();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [libraryWidth, setLibraryWidth] = useState(250);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [inputWidth, setInputWidth] = useState(280);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const resizingRef = useRef(false);
  const projectManagerRef = useRef(projectManager);
  projectManagerRef.current = projectManager;

  const clearSaveMessage = () => {
    setSaveMessage(null);
  };

  // The busy job for the currently open project (edit/fix in flight) drives
  // the preview panel's progress overlay and blocks conflicting actions.
  const openFolderPath = projectManager.project?.folderPath ?? null;
  const openProjectJob = openFolderPath
    ? jobs.find((j) =>
        (j.kind === 'edit' || j.kind === 'fix')
        && j.targetFolderPath === openFolderPath
        && !['done', 'error', 'cancelled'].includes(j.status)) ?? null
    : null;

  // Job completion side-effects: refresh the library, open or offer the
  // result. A completing job never steals the center panel — it only
  // auto-opens when no project is open at all.
  const jobStatusesRef = useRef(new Map<string, string>());
  useEffect(() => {
    for (const job of jobs) {
      const prev = jobStatusesRef.current.get(job.id);
      if (prev === job.status) continue;
      jobStatusesRef.current.set(job.id, job.status);
      // First sighting (initial list load / freshly queued) — no side effects
      if (prev === undefined) continue;

      const pm = projectManagerRef.current;
      if (job.status === 'done' && job.versionPath && job.folderPath) {
        const versionPath = job.versionPath;
        const folderPath = job.folderPath;
        void pm.refreshLibrary();
        if (job.kind === 'generate') {
          if (!pm.project) {
            void pm.loadVersion(versionPath, folderPath);
          } else {
            showToast('New generation ready', 'success', {
              label: 'Open',
              onClick: () => { void projectManagerRef.current.loadVersion(versionPath, folderPath); },
            });
          }
        } else {
          const label = pm.project?.folderPath === folderPath
            ? 'New version ready'
            : `New version saved in ${folderPath.split(/[\\/]/).pop()}`;
          showToast(label, 'success', {
            label: 'Open',
            onClick: () => { void projectManagerRef.current.loadVersion(versionPath, folderPath); },
          });
        }
      } else if (job.status === 'error') {
        showToast(`Generation failed: ${job.error ?? 'Unknown error'}`, 'error');
      }
    }
  }, [jobs, showToast]);

  const handleGenerate = useCallback(async () => {
    clearSaveMessage();
    const request = generator.buildGenerateJob();
    if (!request) return;
    const { error } = await startJob(request);
    if (error) showToast(error, 'error');
  }, [generator, startJob, showToast]);

  const handleRegenerate = useCallback(async () => {
    clearSaveMessage();
    const project = projectManager.project;
    if (!project) return;
    const request = generator.buildEditJob(project.currentContent, project.folderPath);
    if (!request) return;
    const { error } = await startJob(request);
    if (error) showToast(error, 'error');
    else generator.setEditPrompt('');
  }, [generator, projectManager, startJob, showToast]);

  const handleFix = useCallback(async (
    errorMessage: string,
    errorLocation?: { line: number; column: number; file: string },
  ) => {
    clearSaveMessage();
    const project = projectManager.project;
    if (!project) return;
    const request = generator.buildFixJob(project.currentContent, project.folderPath, errorMessage, errorLocation);
    if (!request) return;
    const { error } = await startJob(request);
    if (error) showToast(error, 'error');
  }, [generator, projectManager, startJob, showToast]);

  const handleCancelOpenProjectJob = useCallback(() => {
    if (openProjectJob) void cancelJob(openProjectJob.id);
  }, [openProjectJob, cancelJob]);

  const handleOpenJob = useCallback((job: TsxJobIpc) => {
    if (job.versionPath && job.folderPath) {
      void projectManager.loadVersion(job.versionPath, job.folderPath);
    }
  }, [projectManager]);

  const handleOverwrite = useCallback(async (editedContent: string) => {
    clearSaveMessage();
    if (!projectManager.project || !editedContent) return;
    const success = await projectManager.overwriteVersion(editedContent);
    if (success) {
      setSaveMessage('Overwritten');
    }
  }, [projectManager]);

  const handleSaveNewVersion = useCallback(async (editedContent: string) => {
    clearSaveMessage();
    if (!projectManager.project || !editedContent) return;
    // The editor auto-saves into the current version file, so restore the
    // original before the edits become a new version. The caller cancels any
    // pending auto-save first, so nothing re-writes the file after this.
    const originalContent = projectManager.project.currentContent;
    if (originalContent && originalContent !== editedContent) {
      await window.api.fileWrite({ path: projectManager.project.currentVersion, content: originalContent });
    }
    const path = await projectManager.saveNewVersion(editedContent);
    if (path) {
      setSaveMessage('Saved as new version');
    }
  }, [projectManager]);

  const handleLoadVersion = useCallback(async (filePath: string, folderPath: string) => {
    clearSaveMessage();
    await projectManager.loadVersion(filePath, folderPath);
  }, [projectManager]);

  const handleCreateFolder = useCallback(async (name: string) => {
    await projectManager.createFolder(name);
  }, [projectManager]);

  const handleRenameFolder = useCallback(async (folderPath: string, newName: string) => {
    await projectManager.renameFolder(folderPath, newName);
  }, [projectManager]);

  const handleDeleteFolder = useCallback(async (folderPath: string) => {
    await projectManager.deleteFolder(folderPath);
  }, [projectManager]);

  const handleMoveProject = useCallback(async (projectPath: string, targetFolderPath: string) => {
    await projectManager.moveProject(projectPath, targetFolderPath);
  }, [projectManager]);

  const handleMoveProjectToRoot = useCallback(async (projectPath: string) => {
    await projectManager.moveProjectToRoot(projectPath);
  }, [projectManager]);

  const handleImportProject = useCallback(async (parentFolder?: string) => {
    clearSaveMessage();
    await projectManager.importProject(parentFolder);
  }, [projectManager]);

  const handleCreateEmpty = useCallback(async (parentFolder?: string) => {
    clearSaveMessage();
    await projectManager.createEmptyProject(parentFolder);
  }, [projectManager]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = libraryWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(420, Math.max(220, startWidth + delta));
      setLibraryWidth(newWidth);
    };

    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [libraryWidth]);

  const handleInputResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = inputWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(480, Math.max(280, startWidth + delta));
      setInputWidth(newWidth);
    };

    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [inputWidth]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">
          Creator
        </span>
        {projectManager.project && (
          <span className="text-[10px] text-text-dim">
            {projectManager.project.name} / {projectManager.project.currentVersion.split(/[/\\]/).pop()}
          </span>
        )}
      </div>

      {/* Generation jobs strip (hidden when no jobs) */}
      <MotionJobsStrip onOpenJob={handleOpenJob} />

      {/* 3-column layout: Input | Preview+Code | Library */}
      <div className="flex-1 flex min-h-0">
        {/* Input panel with resize handle + collapse */}
        <div className="flex shrink-0" style={{ width: inputCollapsed ? 24 : inputWidth, borderRight: '0.5px solid var(--color-border)' }}>
          {inputCollapsed ? (
            <button
              onClick={() => setInputCollapsed(false)}
              className="w-full flex items-center justify-center bg-app-surface text-text-dim hover:text-text-primary transition-colors cursor-pointer"
              title="Show panel"
            >
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 2L6.5 5L3.5 8" />
              </svg>
            </button>
          ) : (
            <>
              <div className="flex-1 min-w-0 flex flex-col">
                <MotionInputPanel
                  prompt={generator.prompt}
                  onPromptChange={generator.setPrompt}
                  providers={generator.providers}
                  selectedProvider={generator.selectedProvider}
                  onProviderChange={generator.setSelectedProvider}
                  thinkingLevel={generator.thinkingLevel}
                  onThinkingLevelChange={generator.setThinkingLevel}
                  loopCount={generator.loopCount}
                  onLoopCountChange={generator.setLoopCount}
                  fps={generator.fps}
                  onFpsChange={generator.setFps}
                  aspectRatio={generator.aspectRatio}
                  onAspectRatioChange={generator.setAspectRatio}
                  duration={generator.duration}
                  onDurationChange={generator.setDuration}
                  autoDuration={generator.autoDuration}
                  onAutoDurationChange={generator.setAutoDuration}
                  colorPalette={generator.colorPalette}
                  onColorPaletteChange={generator.setColorPalette}
                  optimize={generator.optimize}
                  onOptimizeChange={generator.setOptimize}
                  referenceImages={generator.referenceImages}
                  onReferenceImagesChange={generator.setReferenceImages}
                  onGenerate={handleGenerate}
                  onCancel={() => {}}
                  loading={false}
                  progress={null}
                  hasProject={projectManager.project !== null}
                  onCollapse={() => setInputCollapsed(true)}
                />
              </div>
              {/* Resize handle */}
              <div
                className="w-[4px] shrink-0 cursor-col-resize hover:bg-accent/30 transition-colors"
                onMouseDown={handleInputResizeStart}
              />
            </>
          )}
        </div>
        <MotionPreviewPanel
          project={projectManager.project}
          output={null}
          error={projectManager.error}
          loading={openProjectJob !== null}
          progress={openProjectJob
            ? { step: 'generate', stepLabel: openProjectJob.progress.label, percent: openProjectJob.progress.percent }
            : null}
          editPrompt={generator.editPrompt}
          onEditPromptChange={generator.setEditPrompt}
          onRegenerate={handleRegenerate}
          onFix={handleFix}
          onCancel={handleCancelOpenProjectJob}
          onOverwrite={handleOverwrite}
          onSaveNewVersion={handleSaveNewVersion}
          saving={projectManager.loading}
          saveMessage={saveMessage}
        />
        {/* Library panel with resize handle + collapse */}
        <div className="flex shrink-0" style={{ width: libraryCollapsed ? 24 : libraryWidth, borderLeft: '0.5px solid var(--color-border)' }}>
          {/* Resize handle */}
          {!libraryCollapsed && (
            <div
              className="w-[4px] shrink-0 cursor-col-resize hover:bg-accent/30 transition-colors"
              onMouseDown={handleResizeStart}
            />
          )}
          {libraryCollapsed ? (
            <button
              onClick={() => setLibraryCollapsed(false)}
              className="w-full flex items-center justify-center bg-app-surface text-text-dim hover:text-text-primary transition-colors cursor-pointer"
              title="Show library"
            >
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 2L3.5 5L6.5 8" />
              </svg>
            </button>
          ) : (
            <div className="flex-1 min-w-0 flex flex-col">
              <MotionLibraryPanel
                library={projectManager.library}
                project={projectManager.project}
                onLoadVersion={handleLoadVersion}
                onRenameProject={projectManager.renameProject}
                onRenameVersion={projectManager.renameVersion}
                onDeleteProject={projectManager.deleteProject}
                onDeleteVersion={projectManager.deleteVersion}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onMoveProject={handleMoveProject}
                onMoveProjectToRoot={handleMoveProjectToRoot}
                onImportProject={handleImportProject}
                onCreateEmpty={handleCreateEmpty}
                onCollapse={() => setLibraryCollapsed(true)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
