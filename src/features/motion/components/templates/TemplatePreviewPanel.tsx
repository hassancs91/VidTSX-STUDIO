import { useState, useCallback, useEffect } from 'react';
import { Button, RenderSettingsModal, SkeletonLoader, type RenderSettings } from '@shared/components';
import { IsolatedPreview, useComponentLoader, setupVirtualModuleGlobals } from '@features/player';
import { useRenderQueue } from '@features/render-queue';
import { useToast } from '@renderer/contexts/ToastContext';
import {
  DEFAULT_OVERLAY_BACKDROP,
  TEMPLATE_BACKDROPS,
  TEMPLATE_BACKDROP_LABELS,
  isTemplateBackdrop,
  type TemplateBackdrop,
} from '@shared/templates/backdrops';
import type { TemplateSession } from '../../hooks/useTemplateSession';
import { useRenderedOutputs } from '../../hooks/useRenderedOutputs';
import { RenderedOutputView } from '../RenderedOutputView';

type Tab = 'preview' | 'rendered';

const TABS: { id: Tab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'rendered', label: 'Rendered' },
];

/** An overlay renders with alpha: its dialog starts where that is possible. */
const OVERLAY_RENDER_START = { codec: 'vp9', transparent: true } as const;
const BACKDROP_STORAGE_KEY = 'vidtsx.templateBackdrop';

function loadBackdrop(): TemplateBackdrop {
  try {
    const stored = localStorage.getItem(BACKDROP_STORAGE_KEY);
    if (isTemplateBackdrop(stored)) return stored;
  } catch {
    // Storage unavailable — the default is fine.
  }
  return DEFAULT_OVERLAY_BACKDROP;
}

interface TemplatePreviewPanelProps {
  session: TemplateSession;
}

/**
 * The Creator's centre column in Templates mode. It previews the STAGED entry
 * with the form's values as input props, and renders that same file with those
 * same props — unlike the Creator's props panel, which is preview-only, here
 * the form is the whole point and must reach the output.
 */
export function TemplatePreviewPanel({ session }: TemplatePreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [globalsReady, setGlobalsReady] = useState(false);
  const { state: loaderState, loadComponent, reset: resetLoader } = useComponentLoader();
  const { addJob } = useRenderQueue();
  const { showToast } = useToast();
  const { template, entryPath, inputProps, format } = session;
  const rendered = useRenderedOutputs(entryPath);
  const overlay = template?.manifest.overlay === true;
  // Preview-only stand-in footage under an overlay; remembered across templates.
  const [backdrop, setBackdrop] = useState<TemplateBackdrop>(loadBackdrop);
  const changeBackdrop = useCallback((next: TemplateBackdrop) => {
    setBackdrop(next);
    try {
      localStorage.setItem(BACKDROP_STORAGE_KEY, next);
    } catch {
      // Not remembered — harmless.
    }
  }, []);

  // Idempotent — the Creator's own preview panel may already have run it.
  useEffect(() => {
    let cancelled = false;
    void setupVirtualModuleGlobals().then(() => {
      if (!cancelled) setGlobalsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // One staged file per format: a new path means a new canvas to load.
  useEffect(() => {
    if (!globalsReady) return;
    if (entryPath) loadComponent(entryPath);
    else resetLoader();
  }, [globalsReady, entryPath, loadComponent, resetLoader]);

  useEffect(() => {
    setActiveTab('preview');
  }, [template?.manifest.id]);

  const canRender = template !== null && entryPath !== null && loaderState.status === 'success' && loaderState.config !== null;

  const handleRenderConfirm = useCallback(async (settings: RenderSettings) => {
    if (!entryPath || loaderState.status !== 'success' || !loaderState.config) return;
    try {
      await addJob({
        filePath: entryPath,
        fileName: entryPath.split(/[/\\]/).pop() || 'composition.tsx',
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
        // A snapshot: the job renders what the form held when Render was pressed.
        inputProps: { ...inputProps },
      });
      showToast('Added to render queue', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add to render queue', 'error');
    }
  }, [entryPath, loaderState, inputProps, addJob, showToast]);

  const error = session.error ?? (loaderState.status === 'error' ? loaderState.error : null);

  return (
    <div className="flex-1 flex flex-col min-w-0" data-template-preview>
      <div
        className="flex items-center h-[36px] px-2 gap-1 shrink-0 bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {TABS.map((tab) => {
          const hasVideo = tab.id === 'rendered' && rendered.src !== null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-[6px] text-[11px] transition-colors duration-150 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-app-active text-accent-light'
                  : tab.id === 'rendered' && !hasVideo
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
          {overlay && activeTab === 'preview' && (
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim" title="Stand-in footage behind the overlay — preview only, never rendered">
              Backdrop
              <select
                value={backdrop}
                onChange={(e) => { if (isTemplateBackdrop(e.target.value)) changeBackdrop(e.target.value); }}
                data-template-backdrop
                className="h-[22px] bg-app-base text-text-secondary rounded-[5px] px-1.5 outline-none text-[10px] cursor-pointer"
                style={{ border: '0.5px solid var(--color-border-input)' }}
              >
                {TEMPLATE_BACKDROPS.map((b) => (
                  <option key={b} value={b}>{TEMPLATE_BACKDROP_LABELS[b]}</option>
                ))}
              </select>
            </label>
          )}
          {loaderState.config && template && (
            <span className="text-[10px] text-text-dim">
              {loaderState.config.width}×{loaderState.config.height} · {(loaderState.config.durationInFrames / loaderState.config.fps).toFixed(1)}s
            </span>
          )}
          {canRender && (
            <Button variant="primary" size="sm" onClick={() => setIsRenderModalOpen(true)}>
              Render
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'preview' && (
          <div className="flex-1 min-h-0 m-2 bg-app-player rounded-lg overflow-hidden">
            {!template ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-[12px] text-text-dim">Pick a template to preview it</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full p-4">
                <span className="text-[11px] text-accent-red text-center whitespace-pre-wrap">{error}</span>
              </div>
            ) : loaderState.status === 'success' && loaderState.moduleUrl && loaderState.config ? (
              <IsolatedPreview
                moduleUrl={loaderState.moduleUrl}
                config={loaderState.config}
                inputProps={inputProps}
                backdrop={overlay ? backdrop : 'none'}
                className="h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full p-6">
                <SkeletonLoader variant="loading" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'rendered' && (
          <RenderedOutputView
            outputs={rendered}
            emptyText={
              format
                ? `No ${format.label} render yet. Use the Render button to make one.`
                : 'No render yet. Use the Render button to make one.'
            }
          />
        )}
      </div>

      {loaderState.config && (
        <RenderSettingsModal
          isOpen={isRenderModalOpen}
          onClose={() => setIsRenderModalOpen(false)}
          onRender={handleRenderConfirm}
          compositionConfig={{
            width: loaderState.config.width,
            height: loaderState.config.height,
            fps: loaderState.config.fps,
          }}
          initial={overlay ? OVERLAY_RENDER_START : undefined}
        />
      )}
    </div>
  );
}
