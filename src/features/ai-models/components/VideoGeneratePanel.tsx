import { useMemo, useState } from 'react';
import { Button, ErrorBanner, ProgressBar } from '@shared/components';
import type { InstalledModelIpc } from '@shared/ipc/types';
import { useVideoGenerate } from '../hooks/useVideoGenerate';

interface VideoGeneratePanelProps {
  /** Installed models with no blocking issues (companions present). */
  readyModels: InstalledModelIpc[];
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

/**
 * Prompt → local video generation panel (sd-cli vid_gen). Model capabilities
 * come through the scan: txt2img = t2v, img2img = i2v. I2V-only models require
 * an input image; t2v+i2v models take one optionally.
 */
export function VideoGeneratePanel({ readyModels }: VideoGeneratePanelProps) {
  const gen = useVideoGenerate();
  const [modelId, setModelId] = useState(readyModels[0]?.id ?? '');
  const [prompt, setPrompt] = useState('');
  const [initImagePath, setInitImagePath] = useState<string | null>(null);

  const selected = useMemo(
    () => readyModels.find((m) => m.id === modelId) ?? readyModels[0],
    [readyModels, modelId],
  );
  const supportsI2v = Boolean(selected?.capabilities.img2img);
  const requiresImage = supportsI2v && !selected?.capabilities.txt2img;
  const canGenerate =
    !gen.generating && Boolean(selected) && prompt.trim().length > 0 && (!requiresImage || initImagePath);

  const pickImage = async () => {
    const picked = await window.api.dialogOpen({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (!picked.canceled && picked.filePaths.length > 0) {
      setInitImagePath(picked.filePaths[0]);
    }
  };

  const handleGenerate = () => {
    if (!selected) return;
    void gen.generate(selected.id, prompt.trim(), {
      initImagePath: initImagePath ?? undefined,
    });
  };

  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      <div className="px-3 h-[32px] flex items-center text-[10px] font-medium text-text-dim uppercase tracking-wider" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        Generate video
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <select
            value={selected?.id ?? ''}
            onChange={(e) => setModelId(e.target.value)}
            className="bg-app-base border border-border rounded px-2 h-[26px] text-[11px] text-text-secondary outline-none focus:border-accent min-w-[220px]"
          >
            {readyModels.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {supportsI2v && (
            <button
              onClick={pickImage}
              className="px-2 h-[26px] rounded text-[10px] font-medium text-text-muted hover:text-accent-light hover:bg-app-hover border border-border"
              title={requiresImage ? 'This model requires an input image' : 'Optional first frame (image-to-video)'}
            >
              {initImagePath ? `Image: …${initImagePath.slice(-24)}` : requiresImage ? 'Pick input image (required)' : 'Input image (optional)'}
            </button>
          )}
          {initImagePath && (
            <button onClick={() => setInitImagePath(null)} className="text-[10px] text-text-dim hover:text-accent-red">✕</button>
          )}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video… (uses the model's default size, frames, and fps)"
          rows={2}
          className="bg-app-base border border-border rounded px-2 py-1.5 text-[11px] text-text-secondary placeholder:text-text-dim outline-none focus:border-accent resize-y"
        />

        <div className="flex items-center gap-2">
          {gen.generating ? (
            <>
              <div className="flex-1">
                <ProgressBar value={gen.progress?.percent ?? 0} color="purple" />
              </div>
              <span className="text-[10px] text-text-dim whitespace-nowrap">
                {gen.progress && gen.progress.totalSteps > 0
                  ? `Step ${gen.progress.step}/${gen.progress.totalSteps}`
                  : 'Loading model…'}
              </span>
              <Button variant="secondary" size="sm" onClick={gen.cancel}>Cancel</Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={handleGenerate} disabled={!canGenerate}>
              Generate
            </Button>
          )}
          {gen.autoOffload && gen.generating && (
            <span className="text-[10px] text-accent-amber">CPU offload auto-enabled (model larger than VRAM)</span>
          )}
        </div>

        {gen.error && (
          <ErrorBanner message={gen.error.message} details={gen.error.details} onDismiss={gen.clearError} />
        )}

        {gen.result && (
          <div className="flex flex-col gap-1.5">
            <video
              src={gen.result.videoUrl}
              controls
              autoPlay
              loop
              className="w-full max-h-[360px] rounded bg-black"
            />
            <div className="flex items-center justify-between text-[10px] text-text-dim font-mono">
              <span>
                {gen.result.width}×{gen.result.height} · {gen.result.frames} frames @ {gen.result.fps} fps
                {gen.result.seed >= 0 ? ` · seed ${gen.result.seed}` : ''} · {formatDuration(gen.result.durationMs)}
              </span>
              <span className="truncate max-w-[45%]" title={gen.result.outputPath}>{gen.result.outputPath}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
