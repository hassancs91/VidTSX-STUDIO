import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Modal, RenderSettingsModal, SkeletonLoader, type RenderSettings } from '@shared/components';
import { IsolatedPreview, useComponentLoader, setupVirtualModuleGlobals } from '@features/player';
import { CodeEditor, useCodeEditor } from '@features/editor';
import { useRenderQueue, useRenderHistory, getFormatLabel, formatResolution, formatFileSize } from '@features/render-queue';
import { useToast } from '@renderer/contexts/ToastContext';
import type { MotionProject } from '../types';
import type { PipelineStepLog, PipelineProgress, PipelineMode } from '@shared/tsx-engine';
import type { RenderHistoryEntry } from '@shared/ipc/types';
import { useSmoothProgress } from '../hooks/useSmoothProgress';
import { GifPlayer } from './GifPlayer';

function describeRenderedEntry(entry: RenderHistoryEntry): string {
  const scale = entry.scale ?? 1;
  const codec = (entry.codec ?? 'h264') as 'h264';
  const parts = [getFormatLabel(codec)];
  if (typeof entry.width === 'number' && typeof entry.height === 'number') {
    parts.push(formatResolution(Math.round(entry.width * scale), Math.round(entry.height * scale)));
  }
  if (entry.fileSize) parts.push(formatFileSize(entry.fileSize));
  return parts.join(' · ');
}

function RenderIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <path d="M5.5 5.5L9 7L5.5 8.5V5.5Z" fill="currentColor" />
    </svg>
  );
}

let globalsInitialized = false;

type Tab = 'preview' | 'code' | 'debug' | 'rendered';

type SavedDebug = {
  model: string;
  durationMs: number;
  timestamp?: string;
  prompt?: string;
  turns: string[];
  steps?: PipelineStepLog[];
  plan?: string;
  mode?: PipelineMode;
  libraries?: string[];
  verified?: boolean;
  transpileValid?: boolean;
  fixAttempts?: number;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};

interface MotionPreviewPanelProps {
  project: MotionProject | null;
  output: {
    text: string;
    model: string;
    durationMs: number;
    debugLog?: string[];
    steps?: PipelineStepLog[];
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  } | null;
  error: string | null;
  loading: boolean;
  progress: PipelineProgress | null;
  editPrompt: string;
  onEditPromptChange: (value: string) => void;
  onRegenerate: () => void;
  onFix: (errorMessage: string, errorLocation?: { line: number; column: number; file: string }) => void;
  onCancel: () => void;
  onOverwrite: () => void;
  onSaveNewVersion: () => void;
  saving: boolean;
  saveMessage: string | null;
}

export function MotionPreviewPanel({
  project,
  output,
  error,
  loading,
  progress,
  editPrompt,
  onEditPromptChange,
  onRegenerate,
  onFix,
  onCancel,
  onOverwrite,
  onSaveNewVersion,
  saving,
  saveMessage,
}: MotionPreviewPanelProps) {
  const smoothPercent = useSmoothProgress(progress, 'edit');
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [globalsReady, setGlobalsReady] = useState(globalsInitialized);
  const { state: loaderState, loadComponent, reset: resetLoader } = useComponentLoader();
  const handleAfterSave = useCallback(() => {
    if (project?.currentVersion) {
      loadComponent(project.currentVersion);
    }
  }, [project?.currentVersion, loadComponent]);
  const codeEditor = useCodeEditor({ filePath: project?.currentVersion ?? null, onAfterSave: handleAfterSave });
  const { addJob, openFolder, openFile } = useRenderQueue();
  const { entries: historyEntries } = useRenderHistory();
  const { showToast } = useToast();

  const [savedDebug, setSavedDebug] = useState<SavedDebug | null>(null);

  // Load saved debug log from disk when version changes
  useEffect(() => {
    if (!project?.currentVersion) {
      setSavedDebug(null);
      return;
    }
    const debugPath = project.currentVersion.replace(/\.tsx$/, '.debug.json');
    window.api.fileRead({ path: debugPath }).then((result) => {
      if (!result.error && result.content) {
        try {
          setSavedDebug(JSON.parse(result.content));
        } catch {
          setSavedDebug(null);
        }
      } else {
        setSavedDebug(null);
      }
    }).catch(() => setSavedDebug(null));
  }, [project?.currentVersion]);

  // Use output.steps for structured view, or fall back to flat debugLog/saved debug
  const debugSteps = output?.steps ?? savedDebug?.steps ?? [];
  const debugTurns = (output?.debugLog ?? savedDebug?.turns ?? []).filter((t) => t.trim());
  const debugModel = output?.model ?? savedDebug?.model;
  const debugDuration = output?.durationMs ?? savedDebug?.durationMs;
  const hasStructuredDebug = debugSteps.length > 0;

  const renderedJobs = useMemo(() => {
    if (!project?.currentVersion) return [];
    const normalized = project.currentVersion.replace(/\\/g, '/').toLowerCase();
    return historyEntries
      .filter((e) => e.filePath.replace(/\\/g, '/').toLowerCase() === normalized)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  }, [historyEntries, project?.currentVersion]);

  const [selectedRenderedIndex, setSelectedRenderedIndex] = useState(0);

  // Reset selection when version changes or new renders complete
  useEffect(() => {
    setSelectedRenderedIndex(0);
  }, [project?.currentVersion, renderedJobs.length]);

  const selectedRenderedJob = renderedJobs[selectedRenderedIndex] ?? null;

  const renderedVideoSrc = useMemo(() => {
    if (!selectedRenderedJob) return null;
    const normalized = selectedRenderedJob.outputPath.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
  }, [selectedRenderedJob]);

  const canRender = loaderState.status === 'success' && loaderState.config !== null && project !== null;

  const handleRenderConfirm = useCallback(async (settings: RenderSettings) => {
    if (!project || loaderState.status !== 'success' || !loaderState.config) return;

    try {
      await addJob({
        filePath: project.currentVersion,
        fileName: project.currentVersion.split(/[/\\]/).pop() || 'composition.tsx',
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
  }, [project, loaderState, addJob, showToast]);

  // Initialize virtual module globals for Remotion player
  useEffect(() => {
    if (!globalsInitialized) {
      globalsInitialized = true;
      setupVirtualModuleGlobals().then(() => {
        setGlobalsReady(true);
      });
    }
  }, []);

  // Reset player when generation starts to show skeleton loader
  useEffect(() => {
    if (loading) {
      resetLoader();
    }
  }, [loading, resetLoader]);

  // Load component when project version changes (only after globals are ready)
  useEffect(() => {
    if (globalsReady && project?.currentVersion) {
      loadComponent(project.currentVersion);
    }
  }, [globalsReady, project?.currentVersion, project?.currentContent, loadComponent]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'code', label: 'Code' },
    { id: 'debug', label: 'Debug' },
    { id: 'rendered', label: 'Rendered' },
  ];

  const hasContent = project !== null;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab bar */}
      <div
        className="flex items-center h-[36px] px-2 gap-1 shrink-0 bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {tabs.map((tab) => {
          const isRenderedTab = tab.id === 'rendered';
          const hasVideo = isRenderedTab && renderedVideoSrc !== null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-[6px] text-[11px] transition-colors duration-150 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-app-active text-accent-light'
                  : isRenderedTab && !hasVideo
                    ? 'text-text-dim'
                    : 'text-text-muted hover:bg-app-hover'
              }`}
            >
              {tab.label}
              {hasVideo && activeTab !== tab.id && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent-green inline-block" />
              )}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {output && (
            <span className="text-[10px] text-text-dim">
              {output.model} — {output.durationMs}ms
            </span>
          )}
          {canRender && (
            <Button variant="primary" size="sm" onClick={() => setIsRenderModalOpen(true)}>
              <span className="flex items-center gap-1">
                <RenderIcon />
                Render
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 relative flex flex-col">
          {!hasContent && !loading && (
            <div className="flex items-center justify-center h-full">
              <span className="text-[12px] text-text-dim">
                Enter a prompt and click Generate to start
              </span>
            </div>
          )}

          {loading && (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <SkeletonLoader variant="generating" />
            </div>
          )}

          {error && (
            <div className="absolute top-2 left-2 right-2 z-10 bg-app-surface rounded-[6px] px-3 py-2 border border-border">
              <span className="text-[11px] text-accent-red">{error}</span>
            </div>
          )}

          {/* Preview tab */}
          {activeTab === 'preview' && hasContent && !loading && (
            <div className="flex-1 min-h-0 bg-app-player rounded-lg overflow-hidden m-2">
              {!globalsReady && (
                <div className="flex items-center justify-center h-full">
                  <div
                    className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
                    role="status"
                  />
                </div>
              )}
              {globalsReady && loaderState.status === 'loading' && (
                <div className="flex items-center justify-center h-full p-6">
                  <SkeletonLoader variant="loading" />
                </div>
              )}
              {globalsReady && loaderState.status === 'error' && (
                <div className="flex flex-col items-center justify-center h-full p-4 gap-3">
                  <span className="text-[11px] text-accent-red text-center whitespace-pre-wrap">
                    {loaderState.error}
                  </span>
                  {project && loaderState.error && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onFix(loaderState.error!, loaderState.errorLocation)}
                      disabled={loading}
                    >
                      {loading ? 'Fixing...' : 'Fix with AI'}
                    </Button>
                  )}
                </div>
              )}
              {globalsReady && loaderState.status === 'success' && loaderState.moduleUrl && loaderState.config && (
                <IsolatedPreview
                  moduleUrl={loaderState.moduleUrl}
                  config={loaderState.config}
                  className="h-full"
                />
              )}
            </div>
          )}

          {/* Code tab */}
          {activeTab === 'code' && hasContent && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <CodeEditor
                  filePath={project!.currentVersion}
                  content={codeEditor.content}
                  onChange={codeEditor.setContent}
                  onSave={codeEditor.save}
                  className="h-full"
                />
              </div>
              <div
                className="shrink-0 px-3 py-2 flex items-center gap-2"
                style={{ borderTop: '0.5px solid var(--color-border)' }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowOverwriteConfirm(true)}
                  disabled={saving || loading}
                >
                  Overwrite
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onSaveNewVersion}
                  disabled={saving || loading}
                >
                  Save as new version
                </Button>
                {saveMessage && (
                  <span className="text-[10px] text-accent-green ml-auto">{saveMessage}</span>
                )}
              </div>
            </div>
          )}

          {/* Debug tab */}
          {activeTab === 'debug' && (
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {hasStructuredDebug ? (
                <div className="flex flex-col gap-3">
                  {(debugModel || debugDuration) && (
                    <div className="text-[10px] text-text-dim">
                      {debugModel && <span>{debugModel}</span>}
                      {debugModel && debugDuration ? ' — ' : ''}
                      {debugDuration && <span>{debugDuration}ms total</span>}
                    </div>
                  )}
                  {debugSteps.map((stepLog, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: stepLog.step === 'plan' ? 'var(--color-accent-dim, rgba(99,102,241,0.15))' :
                              stepLog.step === 'generate' ? 'rgba(34,197,94,0.15)' :
                              stepLog.step === 'verify' ? 'rgba(234,179,8,0.15)' :
                              stepLog.step === 'fix' ? 'rgba(239,68,68,0.15)' :
                              'rgba(148,163,184,0.15)',
                            color: stepLog.step === 'plan' ? 'var(--color-accent)' :
                              stepLog.step === 'generate' ? 'rgb(34,197,94)' :
                              stepLog.step === 'verify' ? 'rgb(234,179,8)' :
                              stepLog.step === 'fix' ? 'rgb(239,68,68)' :
                              'rgb(148,163,184)',
                          }}
                        >
                          {stepLog.label}
                        </span>
                        {stepLog.durationMs > 0 && (
                          <span className="text-[9px] text-text-dim">{stepLog.durationMs}ms</span>
                        )}
                      </div>
                      <pre
                        className="text-[11px] text-text-secondary bg-app-base rounded-[6px] p-3 whitespace-pre-wrap break-words overflow-x-auto"
                        style={{ border: '0.5px solid var(--color-border)' }}
                      >
                        {stepLog.output}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : debugTurns.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {(debugModel || debugDuration) && (
                    <div className="text-[10px] text-text-dim">
                      {debugModel && <span>{debugModel}</span>}
                      {debugModel && debugDuration ? ' — ' : ''}
                      {debugDuration && <span>{debugDuration}ms</span>}
                    </div>
                  )}
                  {debugTurns.map((turnText, i) => (
                    <div key={i}>
                      {debugTurns.length > 1 && (
                        <div className="text-[10px] text-text-dim mb-1 font-medium">
                          Turn {i + 1} of {debugTurns.length}
                        </div>
                      )}
                      <pre
                        className="text-[11px] text-text-secondary bg-app-base rounded-[6px] p-3 whitespace-pre-wrap break-words overflow-x-auto"
                        style={{ border: '0.5px solid var(--color-border)' }}
                      >
                        {turnText}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[12px] text-text-dim">
                    No debug output available. Generate a composition first.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Rendered tab */}
          {activeTab === 'rendered' && (
            <div className="flex-1 min-h-0 flex flex-col m-2">
              {renderedVideoSrc && selectedRenderedJob ? (
                <>
                  {/* Info bar with dropdown + open folder */}
                  <div
                    className="shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-t-lg bg-app-surface"
                    style={{ borderBottom: '0.5px solid var(--color-border)' }}
                  >
                    {renderedJobs.length > 1 ? (
                      <select
                        value={selectedRenderedIndex}
                        onChange={(e) => setSelectedRenderedIndex(Number(e.target.value))}
                        className="bg-app-base text-text-secondary text-[10px] rounded px-2 py-1 border-none outline-none cursor-pointer"
                        style={{ border: '0.5px solid var(--color-border)' }}
                      >
                        {renderedJobs.map((job, i) => (
                          <option key={i} value={i}>{describeRenderedEntry(job)}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-text-muted">
                        {describeRenderedEntry(selectedRenderedJob)}
                      </span>
                    )}
                    <button
                      onClick={() => openFolder(selectedRenderedJob.outputPath)}
                      className="ml-auto text-text-dim hover:text-text-primary transition-colors cursor-pointer p-1 rounded hover:bg-app-hover"
                      title="Open file location"
                    >
                      <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9Z" />
                      </svg>
                    </button>
                  </div>
                  {/* Player area */}
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-app-player rounded-b-lg overflow-hidden">
                    {selectedRenderedJob.codec === 'gif' ? (
                      <GifPlayer
                        key={renderedVideoSrc}
                        src={renderedVideoSrc}
                        className="w-full h-full"
                      />
                    ) : selectedRenderedJob.codec === 'prores' ? (
                      <div className="flex flex-col items-center justify-center text-center px-6 py-8 max-w-[420px]">
                        <svg
                          width={48}
                          height={48}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-text-dim mb-3"
                        >
                          <rect x="2" y="6" width="20" height="12" rx="2" />
                          <path d="M10 10l4 2-4 2v-4z" fill="currentColor" />
                        </svg>
                        <div className="text-[13px] font-medium text-text-primary mb-2">
                          ProRes preview not available in-app
                        </div>
                        <div className="text-[11px] text-text-dim mb-4 leading-relaxed">
                          ProRes 4444 is a pro editor codec — your render is good and ready
                          to use, but the in-app player can't decode it (only its audio
                          track). Open it in your video editor (CapCut, Premiere, etc.)
                          where transparency and quality will look correct.
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            onClick={() => openFile(selectedRenderedJob.outputPath)}
                          >
                            Open in editor
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => openFolder(selectedRenderedJob.outputPath)}
                          >
                            Show in folder
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <video
                        key={renderedVideoSrc}
                        src={renderedVideoSrc}
                        controls
                        autoPlay={false}
                        className="max-w-full max-h-full"
                        style={{ objectFit: 'contain' }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-app-player rounded-lg">
                  <span className="text-[12px] text-text-dim">
                    No rendered video available. Use the Render button to render this version.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit prompt area */}
        {hasContent && (
          <div
            className="shrink-0 p-3 flex flex-col gap-2"
            style={{ borderTop: '0.5px solid var(--color-border)' }}
          >
            <span className="text-[11px] text-text-muted font-medium">Edit</span>
            <textarea
              className="bg-app-base text-text-primary rounded-[6px] px-3 py-2 resize-none focus:outline-none w-full"
              style={{
                fontSize: 11,
                border: '0.5px solid var(--color-border-input)',
                height: 56,
                fontFamily: 'inherit',
              }}
              placeholder="Describe changes to apply to this composition..."
              value={editPrompt}
              onChange={(e) => onEditPromptChange(e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-input)'; }}
              disabled={loading}
            />
            <div className="flex items-center gap-2">
              {loading ? (
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer text-red-400 hover:text-white hover:bg-red-500/80"
                  style={{ border: '1px solid rgba(239,68,68,0.4)' }}
                >
                  {progress ? `${progress.stepLabel} — Cancel` : 'Cancel'}
                </button>
              ) : (
                <Button
                  variant="primary"
                  onClick={onRegenerate}
                  disabled={!editPrompt.trim()}
                >
                  Apply
                </Button>
              )}
            </div>
            {loading && progress && (
              <div className="mt-0.5 flex flex-col gap-1">
                <div className="h-[3px] rounded-full bg-app-base overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${smoothPercent}%` }}
                  />
                </div>
                <div className="text-[9px] text-text-dim text-center">
                  {Math.round(smoothPercent)}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Render settings modal */}
      {canRender && loaderState.config && (
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

      {/* Overwrite confirmation modal */}
      <Modal
        isOpen={showOverwriteConfirm}
        onClose={() => setShowOverwriteConfirm(false)}
        title="Overwrite Version"
      >
        <p className="text-[12px] text-text-secondary mb-4">
          Replace the current version <strong>{project?.currentVersion.split(/[/\\]/).pop()}</strong> with the new generated code? This cannot be undone.
        </p>
        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowOverwriteConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => { setShowOverwriteConfirm(false); onOverwrite(); }}
            className="!bg-accent-amber hover:!opacity-90"
          >
            Overwrite
          </Button>
        </div>
      </Modal>
    </div>
  );
}
