import { useState, useCallback, useRef, useEffect } from 'react';
import { useMotionGenerator } from '../hooks/useMotionGenerator';
import { useMotionProject } from '../hooks/useMotionProject';
import { generateProjectName } from '@shared/tsx-engine';
import type { TsxPipelineResult } from '@shared/tsx-engine';
import { useToast } from '@renderer/contexts/ToastContext';
import { MotionInputPanel } from './MotionInputPanel';
import { MotionPreviewPanel } from './MotionPreviewPanel';
import { MotionLibraryPanel } from './MotionLibraryPanel';

export function MotionScreen() {
  const generator = useMotionGenerator();
  const projectManager = useMotionProject();
  const { showToast } = useToast();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [libraryWidth, setLibraryWidth] = useState(250);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [inputWidth, setInputWidth] = useState(280);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const resizingRef = useRef(false);
  const activeFolderRef = useRef<string | null>(null);
  useEffect(() => {
    activeFolderRef.current = projectManager.project?.folderPath ?? null;
  }, [projectManager.project?.folderPath]);

  const clearSaveMessage = () => {
    setSaveMessage(null);
  };

  const saveDebugLog = useCallback(async (versionPath: string, debug: TsxPipelineResult, prompt?: string) => {
    if (!debug.debugLog) return;
    const debugPath = versionPath.replace(/\.tsx$/, '.debug.json');
    const debugData = JSON.stringify({
      model: debug.model,
      durationMs: debug.durationMs,
      timestamp: new Date().toISOString(),
      prompt,
      turns: debug.debugLog,
      steps: debug.steps,
      plan: debug.plan,
      mode: debug.mode,
      libraries: debug.libraries,
      verified: debug.verified,
      transpileValid: debug.transpileValid,
      fixAttempts: debug.fixAttempts,
      usage: debug.usage,
    }, null, 2);
    await window.api.fileWrite({ path: debugPath, content: debugData });
  }, []);

  const handleGenerate = useCallback(async () => {
    clearSaveMessage();
    const activeAtStart = activeFolderRef.current;
    const promptSnapshot = generator.prompt.trim();
    const result = await generator.generate();
    if (result) {
      const name = await generateProjectName(generator.prompt, generator.selectedProvider);
      const activeNow = activeFolderRef.current;
      const userNavigatedAway = activeAtStart !== activeNow;
      const project = await projectManager.createProject(
        result.text,
        undefined,
        name,
        userNavigatedAway ? { setActive: false } : undefined,
      );
      if (project) {
        await saveDebugLog(project.currentVersion, result, promptSnapshot);
        if (userNavigatedAway) {
          showToast('New generation ready', 'success', {
            label: 'Open',
            onClick: () => {
              projectManager.loadVersion(project.currentVersion, project.folderPath);
            },
          });
        }
      }
    }
  }, [generator, projectManager, saveDebugLog, showToast]);

  const handleRegenerate = useCallback(async () => {
    clearSaveMessage();
    if (!projectManager.project) return;
    const promptSnapshot = generator.editPrompt.trim();
    const result = await generator.regenerate(projectManager.project.currentContent);
    if (result) {
      const path = await projectManager.saveNewVersion(result.text);
      if (path) {
        await saveDebugLog(path, result, promptSnapshot);
      }
      setSaveMessage('Saved as new version');
    }
  }, [generator, projectManager, saveDebugLog]);

  const handleFix = useCallback(async (
    errorMessage: string,
    errorLocation?: { line: number; column: number; file: string },
  ) => {
    clearSaveMessage();
    if (!projectManager.project) return;
    const result = await generator.fix(
      projectManager.project.currentContent,
      errorMessage,
      errorLocation,
    );
    if (result) {
      const path = await projectManager.saveNewVersion(result.text);
      if (path) {
        await saveDebugLog(path, result, `Fix: ${errorMessage}`);
      }
      setSaveMessage('Fixed and saved as new version');
    }
  }, [generator, projectManager, saveDebugLog]);

  const handleOverwrite = useCallback(async () => {
    clearSaveMessage();
    if (!projectManager.project) return;
    const fileResult = await window.api.fileRead({ path: projectManager.project.currentVersion });
    const content = fileResult.error ? null : fileResult.content;
    if (!content) return;
    const success = await projectManager.overwriteVersion(content);
    if (success) {
      setSaveMessage('Overwritten');
    }
  }, [projectManager]);

  const handleSaveNewVersion = useCallback(async () => {
    clearSaveMessage();
    if (!projectManager.project) return;
    // Read edited content from disk (auto-saved by code editor)
    const fileResult = await window.api.fileRead({ path: projectManager.project.currentVersion });
    const editedContent = fileResult.error ? null : fileResult.content;
    if (!editedContent) return;
    // Restore original version file before creating new version
    const originalContent = projectManager.project.currentContent;
    if (originalContent && originalContent !== editedContent) {
      await window.api.fileWrite({ path: projectManager.project.currentVersion, content: originalContent });
    }
    // Save edited content as new version
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
                  onCancel={generator.cancel}
                  loading={generator.loading}
                  progress={generator.progress}
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
          output={generator.output}
          error={generator.error || projectManager.error}
          loading={generator.loading}
          progress={generator.progress}
          editPrompt={generator.editPrompt}
          onEditPromptChange={generator.setEditPrompt}
          onRegenerate={handleRegenerate}
          onFix={handleFix}
          onCancel={generator.cancel}
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
