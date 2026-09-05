import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ErrorBanner, ProgressBar } from '@shared/components';
import type { ThreeDRuntimeInfo } from '../hooks/useThreeDRuntime';
import { clampQuality, overallPercent, qualityOptions, randomSeed, STAGE_LABELS } from '../services/threed-request';
import type { GenerationError, GenerationJob, GenerationSettings, Quality, Sd3dSource } from '../types';
import { ImageStudioPickerDialog, type PickedImage } from './ImageStudioPickerDialog';

export interface SourceDraft {
  source: Sd3dSource;
  label: string;
  /** Data URL / file URL for the thumbnail. */
  previewUrl: string;
}

interface ControlPanelProps {
  runtime: ThreeDRuntimeInfo;
  job: GenerationJob | null;
  error: GenerationError | null;
  onGenerate: (settings: GenerationSettings) => void;
  onCancel: () => void;
  onDismissError: () => void;
  /** Regenerate from the lightbox pre-fills the panel. */
  prefill: { draft: SourceDraft; quality: Quality; removeBackground: boolean; seed: number | null } | null;
  onPrefillConsumed: () => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Input → settings → Generate (plan §5 step 3): image drop-zone with a file picker and a
 * "From Image Studio" picker, quality capped by VRAM, background-removal toggle (on by
 * default), seed, CPU override on a GPU runtime, staged progress with cancel, ErrorBanner.
 */
export function ControlPanel({ runtime, job, error, onGenerate, onCancel, onDismissError, prefill, onPrefillConsumed }: ControlPanelProps) {
  const [draft, setDraft] = useState<SourceDraft | null>(null);
  const [quality, setQuality] = useState<Quality>('256');
  const [removeBackground, setRemoveBackground] = useState(true);
  const [seed, setSeed] = useState<number | null>(null);
  const [forceCpu, setForceCpu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => qualityOptions(runtime.vramGB, runtime.variant), [runtime.vramGB, runtime.variant]);
  useEffect(() => {
    setQuality((q) => clampQuality(q, options));
  }, [options]);

  useEffect(() => {
    if (!prefill) return;
    setDraft(prefill.draft);
    setQuality(clampQuality(prefill.quality, options));
    setRemoveBackground(prefill.removeBackground);
    setSeed(prefill.seed);
    onPrefillConsumed();
  }, [prefill, options, onPrefillConsumed]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.split(',')[1] ?? '';
    if (!base64) return;
    setDraft({ source: { kind: 'base64', base64, fileName: file.name, contentType: file.type }, label: file.name, previewUrl: dataUrl });
  }, []);

  const handlePick = useCallback((img: PickedImage) => {
    setShowPicker(false);
    setDraft({ source: { kind: 'image-studio', id: img.id }, label: img.prompt.slice(0, 60) || img.fileName, previewUrl: img.url });
  }, []);

  const busy = job !== null;
  const canGenerate = draft !== null && !busy;
  const gpu = runtime.variant === 'cu126';
  const estimate = runtime.variant === null ? null : gpu && !forceCpu ? '~35 s on the GPU' : 'about a minute on the CPU';

  const generate = () => {
    if (!draft) return;
    onGenerate({ source: draft.source, sourceLabel: draft.label, quality, removeBackground, seed, device: forceCpu ? 'cpu' : 'auto' });
  };

  return (
    <div className="h-full flex flex-col bg-app-surface" style={{ borderRight: '0.5px solid var(--color-border)' }}>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Source image */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Object photo</div>
          <div
            className="relative flex flex-col items-center justify-center border border-dashed border-border rounded-lg min-h-[150px] cursor-pointer hover:border-text-dim hover:bg-app-base/50 transition-colors overflow-hidden"
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); void handleFiles(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            data-testid="threed-dropzone"
          >
            {draft ? (
              <>
                <img src={draft.previewUrl} alt={draft.label} className="max-h-[220px] w-full object-contain bg-app-deep" />
                <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/60 text-[10px] text-white/80 truncate">{draft.label}</div>
              </>
            ) : (
              <>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mb-1">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <span className="text-[10px] text-text-dim">Drop a photo or click to choose</span>
                <span className="text-[9px] text-text-dim/70 mt-0.5">One object, centred, plain background works best</span>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ''; }} />
          <div className="flex items-center gap-2 mt-1.5">
            <button type="button" onClick={() => setShowPicker(true)} className="text-[10px] text-accent-light hover:underline underline-offset-2">From Image Studio…</button>
            {draft && <button type="button" onClick={() => setDraft(null)} className="text-[10px] text-text-dim hover:text-text-secondary">Clear</button>}
          </div>
        </div>

        {/* Quality */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Quality (mesh resolution)</div>
          <div className="flex gap-1">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={!o.enabled}
                title={o.reason}
                onClick={() => setQuality(o.value)}
                className={`flex-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${quality === o.value ? 'bg-accent/20 text-accent-light border-accent' : 'bg-app-base text-text-muted border-border hover:border-text-dim'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <label className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer">
          <input type="checkbox" checked={removeBackground} onChange={(e) => setRemoveBackground(e.target.checked)} className="accent-[var(--color-accent)]" />
          Remove background first
          <span className="text-[9px] text-text-dim">(off for images that are already cut out)</span>
        </label>
        {gpu && (
          <label className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer">
            <input type="checkbox" checked={forceCpu} onChange={(e) => setForceCpu(e.target.checked)} className="accent-[var(--color-accent)]" />
            Use the CPU instead of the GPU
          </label>
        )}

        {/* Seed */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Seed</div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              value={seed ?? ''}
              placeholder="random"
              onChange={(e) => setSeed(e.target.value === '' ? null : Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
              className="h-[26px] w-[120px] px-2 rounded text-[11px] bg-app-base border border-border text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
            <button type="button" onClick={() => setSeed(randomSeed())} className="text-[10px] text-text-dim hover:text-text-secondary">New seed</button>
          </div>
        </div>

        {/* Runtime line */}
        <div className="text-[10px] text-text-dim">
          {runtime.state === 'installed'
            ? `AI runtime: ${gpu ? `GPU (${runtime.gpuName ?? 'CUDA'})` : 'CPU'} · ${estimate}`
            : runtime.state === 'unknown'
              ? 'Checking the AI runtime…'
              : 'AI runtime not installed — the first Generate offers to download it.'}
        </div>
      </div>

      {/* Footer: generate / progress / error */}
      <div className="p-3 space-y-2" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        {job ? (
          <div data-testid="threed-status">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium text-text-primary truncate">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5 align-middle" />
                {STAGE_LABELS[job.stage]}
                {job.stage === 'shape' && job.pct !== undefined ? ` · ${Math.round(job.pct)}%` : ''}
              </span>
              <button type="button" onClick={onCancel} className="text-[10px] text-text-dim hover:text-accent-red shrink-0">Cancel</button>
            </div>
            <ProgressBar value={job.stage === 'installing-runtime' || job.stage === 'downloading-model' ? (job.pct ?? 0) : overallPercent(job.stage, job.pct)} />
            <div className="mt-1 text-[10px] text-text-dim truncate" title={job.label}>
              {job.message ?? job.label} · {Math.round((Date.now() - job.startedAt) / 1000)}s
            </div>
          </div>
        ) : (
          <Button variant="primary" onClick={generate} disabled={!canGenerate} className="w-full" title={!draft ? 'Add a photo first' : undefined}>
            Generate 3D model
          </Button>
        )}
        {error && <ErrorBanner message={error.message} details={error.details} onDismiss={onDismissError} />}
      </div>

      {showPicker && <ImageStudioPickerDialog onPick={handlePick} onCancel={() => setShowPicker(false)} />}
    </div>
  );
}
