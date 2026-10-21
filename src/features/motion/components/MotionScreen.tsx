import { useState, useCallback, useRef, useEffect } from 'react';
import { useMotionGenerator } from '../hooks/useMotionGenerator';
import { useMotionProject } from '../hooks/useMotionProject';
import { useCreatorJobs } from '../hooks/useCreatorJobs';
import { TsxJobsProvider, useTsxJobs } from '../contexts/TsxJobsContext';
import type { TsxJobIpc } from '../../../shared/ipc/types';
import { useToast } from '@renderer/contexts/ToastContext';
import { MotionInputPanel } from './MotionInputPanel';
import { BuildProgressPanel } from './BuildProgressPanel';
import type { MotionInputMode } from './MotionModeToggle';
import { MotionPreviewPanel } from './MotionPreviewPanel';
import { ProjectThread } from './ProjectThread';
import { EditComposer } from './EditComposer';
import { useProjectThread } from '../hooks/useProjectThread';
import { jobTitle } from '../services/creator-jobs';
import { versionNumberOf } from '../services/edit-job-request';
import { threadVersionPath } from '../services/project-thread';
import { MotionLibraryPanel } from './MotionLibraryPanel';
import { MotionJobsStrip } from './MotionJobsStrip';
import { useTemplateSession } from '../hooks/useTemplateSession';
import { TemplatesPanel } from './templates/TemplatesPanel';
import { TemplatePreviewPanel } from './templates/TemplatePreviewPanel';

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
  const { startJob, cancelJob } = useTsxJobs();
  const { showToast } = useToast();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [libraryWidth, setLibraryWidth] = useState(250);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [inputWidth, setInputWidth] = useState(280);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  // Prompt | Templates (the Agent tab left in P3 part 3, D4).
  const [inputMode, setInputMode] = useState<MotionInputMode>('prompt');
  // Templates (docs/templates-plan.md): the session lives here so the open
  // template and its form survive a trip to Prompt and back.
  const [templatesOpened, setTemplatesOpened] = useState(false);
  const templateSession = useTemplateSession();
  const templatesMode = inputMode === 'templates';
  const handleModeChange = useCallback((mode: MotionInputMode) => {
    setInputMode(mode);
    if (mode === 'templates') setTemplatesOpened(true);
  }, []);
  // Templates mode swaps the centre panel, so opening a PROJECT from anywhere —
  // the library, a finished job — has to leave it, or the project opens out of
  // sight.
  const leaveTemplatesMode = useCallback(() => {
    setInputMode((mode) => (mode === 'templates' ? 'prompt' : mode));
  }, []);
  // A double-clicked `.vidtsxtemplate` parks in main until this screen claims
  // it — on mount, whenever the screen becomes active, and on main's push —
  // then Templates mode opens and its panel runs the import.
  const [pendingTemplatePackage, setPendingTemplatePackage] = useState<string | null>(null);
  const takePendingTemplatePackage = useCallback(() => setPendingTemplatePackage(null), []);
  useEffect(() => {
    const claim = async (): Promise<void> => {
      const res = await window.api.templatesPendingPackage();
      if (!res.filePath) return;
      handleModeChange('templates');
      setPendingTemplatePackage(res.filePath);
    };
    void claim();
    const onActive = (event: Event) => {
      if ((event as CustomEvent<{ screen?: string }>).detail?.screen === 'creator') void claim();
    };
    window.addEventListener('vidtsx:screen-active', onActive);
    const offOpenFile = window.api.onTemplatesPackageOpenFile(() => void claim());
    return () => {
      window.removeEventListener('vidtsx:screen-active', onActive);
      offOpenFile();
    };
  }, [handleModeChange]);
  const resizingRef = useRef(false);
  const projectManagerRef = useRef(projectManager);
  projectManagerRef.current = projectManager;

  // Coalesce library rescans: simultaneous job completions trigger one scan.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLibraryRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void projectManagerRef.current.refreshLibrary();
    }, 200);
  }, []);
  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // Any path that changes the open version leaves Templates mode (see above).
  const openVersion = projectManager.project?.currentVersion ?? null;
  const lastOpenVersionRef = useRef(openVersion);
  useEffect(() => {
    if (openVersion === lastOpenVersionRef.current) return;
    lastOpenVersionRef.current = openVersion;
    if (openVersion) leaveTemplatesMode();
  }, [openVersion, leaveTemplatesMode]);

  const clearSaveMessage = () => {
    setSaveMessage(null);
  };

  // Which jobs show where, the watched build and what a finished job does
  // (open, toast) live in useCreatorJobs. A completing job never steals the
  // centre panel: it auto-opens when nothing is open, or when it is the build
  // the centre was showing.
  const openFolderPath = projectManager.project?.folderPath ?? null;
  const creatorJobs = useCreatorJobs({ projectManagerRef, openFolderPath, openVersion, scheduleLibraryRefresh });
  const { openProjectJob, centreBuild, watchBuild } = creatorJobs;
  const thread = useProjectThread(openFolderPath, creatorJobs.threadKey);

  const handleBuild = useCallback(async () => {
    clearSaveMessage();
    const request = generator.buildBuildJob();
    if (!request) return;
    const { jobId, error } = await startJob(request);
    if (error) showToast(error, 'error');
    else if (jobId) watchBuild(jobId);
  }, [generator, startJob, showToast, watchBuild]);

  const handleWatchJob = useCallback((job: TsxJobIpc) => {
    leaveTemplatesMode();
    watchBuild(job.id);
  }, [leaveTemplatesMode, watchBuild]);

  // Later messages (P3 part 3): the Edit box and "Fix with AI" are builder
  // edits of the open version. The centre shows the edit like a build; its
  // result opens when it ends, unless the user left its view.
  const handleApplyEdit = useCallback(async () => {
    clearSaveMessage();
    const project = projectManager.project;
    if (!project) return;
    const request = generator.buildEditJob({ folderPath: project.folderPath, versionPath: project.currentVersion });
    if (!request) return;
    const { jobId, error } = await startJob(request);
    if (error) showToast(error, 'error');
    else {
      generator.setEditPrompt('');
      if (jobId) watchBuild(jobId);
    }
  }, [generator, projectManager, startJob, showToast, watchBuild]);

  const handleFix = useCallback(async (
    errorMessage: string,
    errorLocation?: { line: number; column: number; file: string },
  ) => {
    clearSaveMessage();
    const project = projectManager.project;
    if (!project) return;
    // The lines around the error come from the file the preview failed on.
    const onDisk = await window.api.fileRead({ path: project.currentVersion }).catch(() => null);
    const request = generator.buildFixJob({
      target: { folderPath: project.folderPath, versionPath: project.currentVersion },
      code: onDisk?.content ?? project.currentContent,
      error: errorMessage,
      ...(errorLocation ? { location: errorLocation } : {}),
    });
    if (!request) return;
    const { jobId, error } = await startJob(request);
    if (error) showToast(error, 'error');
    else if (jobId) watchBuild(jobId);
  }, [generator, projectManager, startJob, showToast, watchBuild]);

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
    // Re-clicking the version that is already open changes nothing the
    // effects can see, so the library click leaves Templates mode and the
    // build view itself.
    leaveTemplatesMode();
    watchBuild(null);
    await projectManager.loadVersion(filePath, folderPath);
  }, [projectManager, leaveTemplatesMode, watchBuild]);

  const handleOpenThreadVersion = useCallback((version: number) => {
    const project = projectManager.project;
    if (!project) return;
    void handleLoadVersion(threadVersionPath(project.folderPath, version, project.versions), project.folderPath);
  }, [projectManager.project, handleLoadVersion]);

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
          TSX Creator
        </span>
        {templatesMode ? (
          templateSession.template && (
            <span className="text-[10px] text-text-dim">
              Template / {templateSession.template.manifest.name}
            </span>
          )
        ) : centreBuild ? (
          <span className="text-[10px] text-text-dim truncate max-w-[50%]" title={centreBuild.prompt}>
            {centreBuild.targetFolderPath ? 'Edit' : 'Build'} / {jobTitle(centreBuild)}
          </span>
        ) : projectManager.project && (
          <span className="text-[10px] text-text-dim">
            {projectManager.project.name} / {projectManager.project.currentVersion.split(/[/\\]/).pop()}
          </span>
        )}
      </div>

      {/* Generation jobs strip (hidden when no jobs) */}
      <MotionJobsStrip onOpenJob={handleOpenJob} onWatchJob={handleWatchJob} />

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
                  mode={inputMode}
                  onModeChange={handleModeChange}
                  templatesPanel={
                    <TemplatesPanel
                      enabled={templatesOpened}
                      session={templateSession}
                      pendingPackage={pendingTemplatePackage}
                      onPendingTaken={takePendingTemplatePackage}
                    />
                  }
                  prompt={generator.prompt}
                  onPromptChange={generator.setPrompt}
                  providers={generator.providers}
                  selectedProvider={generator.selectedProvider}
                  onProviderChange={generator.setSelectedProvider}
                  model={generator.model}
                  onModelChange={generator.setModel}
                  budget={generator.budget}
                  onBudgetChange={generator.setBudget}
                  seamlessLoop={generator.seamlessLoop}
                  onSeamlessLoopChange={generator.setSeamlessLoop}
                  fps={generator.fps}
                  onFpsChange={generator.setFps}
                  aspectRatio={generator.aspectRatio}
                  onAspectRatioChange={generator.setAspectRatio}
                  duration={generator.duration}
                  onDurationChange={generator.setDuration}
                  autoDuration={generator.autoDuration}
                  onAutoDurationChange={generator.setAutoDuration}
                  brands={generator.brands}
                  selectedBrandId={generator.selectedBrandId}
                  onBrandChange={generator.setSelectedBrandId}
                  referenceImages={generator.referenceImages}
                  onReferenceImagesChange={generator.setReferenceImages}
                  craft={generator.craft}
                  onGenerate={handleBuild}
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
        {templatesMode ? (
          <TemplatePreviewPanel session={templateSession} />
        ) : centreBuild ? (
          <BuildProgressPanel
            job={centreBuild}
            waiting={creatorJobs.centreBuildWaiting}
            onCancel={() => void cancelJob(centreBuild.id)}
            onClose={() => watchBuild(null)}
          />
        ) : (
          <MotionPreviewPanel
            project={projectManager.project}
            output={null}
            error={projectManager.error}
            loading={false}
            busy={openProjectJob !== null}
            onFix={handleFix}
            onOverwrite={handleOverwrite}
            onSaveNewVersion={handleSaveNewVersion}
            appendOnly={!!(projectManager.project && projectManager.studioProjectIdOf(projectManager.project.folderPath))}
            saving={projectManager.loading}
            saveMessage={saveMessage}
            footer={projectManager.project && (
              <>
                <ProjectThread
                  turns={thread}
                  currentVersion={versionNumberOf(projectManager.project.currentVersion)}
                  onOpenVersion={handleOpenThreadVersion}
                />
                <EditComposer
                  prompt={generator.editPrompt}
                  onPromptChange={generator.setEditPrompt}
                  budget={generator.editBudget}
                  onBudgetChange={generator.setEditBudget}
                  providerId={generator.selectedProvider}
                  model={generator.model}
                  onApply={() => void handleApplyEdit()}
                  canApply={Boolean(generator.selectedProvider)}
                  job={openProjectJob}
                  onCancel={handleCancelOpenProjectJob}
                  {...(openProjectJob?.kind === 'build' ? { onShowProgress: () => watchBuild(openProjectJob.id) } : {})}
                />
              </>
            )}
          />
        )}
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
                studioShotsRefreshKey={projectManager.studioShotsRefreshKey}
                library={projectManager.library}
                project={projectManager.project}
                pendingJobs={creatorJobs.pendingJobs}
                onOpenPendingJob={handleWatchJob}
                selectedPendingJobId={centreBuild?.id ?? null}
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
