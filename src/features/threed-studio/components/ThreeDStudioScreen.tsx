import { useCallback, useState } from 'react';
import { AiRuntimeInstallDialog } from '@renderer/components/AiRuntimeInstallDialog';
import { useToast } from '@renderer/contexts/ToastContext';
import type { ThreedStudioEntry } from '../../../shared/ipc/types';
import { useThreeDGallery } from '../hooks/useThreeDGallery';
import { useThreeDGeneration } from '../hooks/useThreeDGeneration';
import { useThreeDRuntime } from '../hooks/useThreeDRuntime';
import { randomSeed } from '../services/threed-request';
import type { GalleryModel, Quality } from '../types';
import { ControlPanel, type SourceDraft } from './ControlPanel';
import { ModelGallery } from './ModelGallery';

type Prefill = { draft: SourceDraft; quality: Quality; removeBackground: boolean; seed: number | null } | null;

/**
 * 3D Studio (plan §5): input → generate → gallery, copied from the Video Studio
 * skeleton, with the GLB viewer in the lightbox. Storage + generation live in main;
 * the hooks hold state; this screen only wires them.
 */
export function ThreeDStudioScreen() {
  const { showToast } = useToast();
  const runtime = useThreeDRuntime();
  const gallery = useThreeDGallery();
  const [prefill, setPrefill] = useState<Prefill>(null);

  const onModelSaved = useCallback((entry: ThreedStudioEntry) => gallery.addEntry(entry), [gallery]);
  const generation = useThreeDGeneration({
    onModelSaved,
    onDone: (_entry, seconds) => showToast(`3D model ready in ${seconds.toFixed(0)}s`, 'success'),
  });

  const handleSaveAs = useCallback(async (id: string) => {
    const res = await gallery.saveAs(id);
    if (res.success) showToast('Saved', 'success');
    else if (res.error && res.error !== 'Save cancelled') showToast(res.error, 'error');
  }, [gallery, showToast]);

  const handleSaveToLibrary = useCallback(async (id: string) => {
    const res = await gallery.saveToLibrary(id);
    if (res.success) showToast(`Saved to the asset library: ${res.relPath}`, 'success');
    else showToast(res.error ?? 'Could not save to the library', 'error');
  }, [gallery, showToast]);

  const handleRegenerate = useCallback((model: GalleryModel, newSeed: boolean) => {
    if (!model.inputUrl && !model.sourceImageId) {
      showToast('The input image of this model is no longer available', 'error');
      return;
    }
    // Prefer the original gallery image (full quality); fall back to the stored input.
    const draft: SourceDraft = model.sourceImageId
      ? { source: { kind: 'image-studio', id: model.sourceImageId }, label: model.sourceImageName, previewUrl: model.inputUrl ?? '' }
      : { source: { kind: 'base64', base64: '', fileName: model.sourceImageName }, label: model.sourceImageName, previewUrl: model.inputUrl ?? '' };
    if (draft.source.kind === 'base64') {
      // Read the stored input.png back through the renderer (file:// fetch) so the request carries real bytes.
      void fetch(model.inputUrl!).then((r) => r.blob()).then((blob) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      })).then((dataUrl) => {
        const base64 = dataUrl.split(',')[1] ?? '';
        setPrefill({ draft: { ...draft, source: { kind: 'base64', base64, fileName: `${model.sourceImageName}.png`, contentType: 'image/png' }, previewUrl: dataUrl }, quality: String(model.quality) as Quality, removeBackground: false, seed: newSeed ? randomSeed() : model.seed });
      }).catch(() => showToast('Could not read the stored input image', 'error'));
      return;
    }
    setPrefill({ draft, quality: String(model.quality) as Quality, removeBackground: model.removeBackground, seed: newSeed ? randomSeed() : model.seed });
  }, [showToast]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 h-[40px] px-3 bg-app-surface shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="text-[13px] font-medium text-text-secondary">3D Studio</span>
        <span className="text-[11px] text-text-dim">·</span>
        <span className="text-[11px] text-text-dim">{gallery.models.length}</span>
        <span className="text-[10px] text-text-dim ml-2">Image → 3D mesh (TripoSR, runs on your computer)</span>
        <div className="flex-1" />
        <button type="button" className="h-[26px] px-2.5 rounded text-[11px] text-text-secondary hover:text-text-primary hover:bg-app-hover transition-colors" onClick={() => void gallery.openFolder()} title="Open the models folder">
          Open folder
        </button>
        <button type="button" className="h-[26px] w-[26px] rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-app-hover transition-colors" onClick={() => void gallery.refresh()} title="Refresh">
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="shrink-0 h-full w-[300px]">
          <ControlPanel
            runtime={runtime}
            job={generation.job}
            error={generation.error}
            onGenerate={(s) => void generation.generate(s)}
            onCancel={() => void generation.cancel()}
            onDismissError={generation.clearError}
            prefill={prefill}
            onPrefillConsumed={() => setPrefill(null)}
          />
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <ModelGallery
            models={gallery.models}
            loading={gallery.loading}
            error={gallery.error}
            onRetry={() => void gallery.refresh()}
            onSaveAs={(id) => void handleSaveAs(id)}
            onSaveToLibrary={(id) => void handleSaveToLibrary(id)}
            onOpenFolder={(id) => void gallery.openFolder(id)}
            onRegenerate={handleRegenerate}
            onDelete={(id) => void gallery.removeEntry(id)}
            busy={generation.job !== null}
          />
        </div>
      </div>

      {generation.prompt && (
        <AiRuntimeInstallDialog
          title="Generate a 3D model"
          preflight={generation.prompt.preflight}
          note="TripoSR needs a 1.7 GB model download the first time."
          onConfirm={(v) => void generation.confirmInstall(v)}
          onCancel={generation.dismissPrompt}
        />
      )}
    </div>
  );
}
