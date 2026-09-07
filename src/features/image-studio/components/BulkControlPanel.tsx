import { useState, useRef, useEffect } from 'react';
import { Button } from '@shared/components';
import { useToast } from '@renderer/contexts/ToastContext';
import type { AspectRatioPreset } from '../types';
import { ASPECT_RATIO_KEYS } from '../services/aspect-ratios';
import { STYLE_PRESETS as DEFAULT_STYLE_PRESETS, CONTENT_PRESETS as DEFAULT_CONTENT_PRESETS } from '../services/style-presets';
import { parseBulkJson, validateBulkPrompts } from '../services/bulk-generation';
import { useBulkGeneration } from '../hooks/useBulkGeneration';
import { ReferenceImageLibrary } from '@shared/components/ReferenceImageLibrary';
import type { ImageModelInfoIpc, ContentPresetSetting, StylePresetSetting } from '../../../shared/ipc/types';
import type { ImageStudioEntry } from '../../../shared/ipc/types';

const NUM_OPTIONS = [1, 2, 3, 4] as const;
const CONCURRENCY_OPTIONS = [1, 2, 3] as const;

interface EnabledProvider {
  id: string;
  name: string;
}

interface BulkControlPanelProps {
  models: ImageModelInfoIpc[];
  modelsLoading: boolean;
  onImageSaved: (entry: ImageStudioEntry) => void;
  contentPresets?: ContentPresetSetting[];
  stylePresets?: StylePresetSetting[];
  activeFolderId?: string | null;
  providers?: EnabledProvider[];
  activeProvider?: string | null;
  onProviderChange?: (providerId: string) => void;
  pendingImport?: { prompts: string[]; aspectRatio?: AspectRatioPreset } | null;
  onImportConsumed?: () => void;
}

export function BulkControlPanel({
  models,
  modelsLoading,
  onImageSaved,
  contentPresets = DEFAULT_CONTENT_PRESETS,
  stylePresets = DEFAULT_STYLE_PRESETS,
  activeFolderId,
  providers = [],
  activeProvider,
  onProviderChange,
  pendingImport,
  onImportConsumed,
}: BulkControlPanelProps) {
  const { showToast } = useToast();
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [concurrency, setConcurrency] = useState(1);
  const [model, setModel] = useState(models[0]?.id || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('1:1');

  // Reset model when models list changes (e.g., after provider switch)
  useEffect(() => {
    if (models.length > 0 && !models.find((m) => m.id === model)) {
      setModel(models[0].id);
      showToast(`Model switched to ${models[0].name}`, 'info');
    }
  }, [models]); // eslint-disable-line react-hooks/exhaustive-deps
  const [numImages, setNumImages] = useState(1);
  const [contentPreset, setContentPreset] = useState<string | undefined>();
  const [stylePreset, setStylePreset] = useState<string | undefined>();
  const [importError, setImportError] = useState<string | null>(null);
  const [showJsonHelp, setShowJsonHelp] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consume pending import from other screens (e.g. Thumbnail Generator)
  useEffect(() => {
    if (pendingImport && pendingImport.prompts.length > 0) {
      setPrompts(pendingImport.prompts.slice(0, 50));
      if (pendingImport.aspectRatio && ASPECT_RATIO_KEYS.includes(pendingImport.aspectRatio)) {
        setAspectRatio(pendingImport.aspectRatio);
      }
      onImportConsumed?.();
    }
  }, [pendingImport]);

  const bulk = useBulkGeneration({
    onImageSaved,
    settings: { model, stylePreset, contentPreset, numImages, aspectRatio, referenceImages },
    prompts: prompts.filter((p) => p.trim().length > 0),
    concurrency,
    activeFolderId,
  });

  const addPrompt = () => {
    if (prompts.length < 50) {
      setPrompts((prev) => [...prev, '']);
    }
  };

  const removePrompt = (index: number) => {
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePrompt = (index: number, value: string) => {
    setPrompts((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  const handleImportJson = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseBulkJson(text);
      if (!result.success) {
        setImportError(result.error || 'Failed to parse JSON');
        return;
      }
      const { valid } = validateBulkPrompts(result.prompts);
      if (valid.length === 0) {
        setImportError('No valid prompts found');
        return;
      }
      setPrompts(valid);
    } catch {
      setImportError('Failed to read file');
    }
    e.target.value = '';
  };

  const handleGenerate = () => {
    const { valid } = validateBulkPrompts(prompts);
    if (valid.length === 0) {
      showToast('Add at least one non-empty prompt', 'info');
      return;
    }
    bulk.start();
  };

  const applyContentPreset = (presetId: string | undefined) => {
    if (presetId === contentPreset) return;
    if (contentPreset) {
      const old = contentPresets.find((p) => p.id === contentPreset);
      if (old) setPrompts((prev) => prev.map((p) => p.replace(`, ${old.promptSuffix}`, '')));
    }
    if (presetId) {
      const next = contentPresets.find((p) => p.id === presetId);
      if (next) {
        setAspectRatio(next.aspectRatio as AspectRatioPreset);
        setPrompts((prev) => prev.map((p) => `${p}, ${next.promptSuffix}`));
      }
    }
    setContentPreset(presetId);
  };

  const applyStylePreset = (presetId: string | undefined) => {
    if (presetId === stylePreset) return;
    if (stylePreset) {
      const old = stylePresets.find((p) => p.id === stylePreset);
      if (old) setPrompts((prev) => prev.map((p) => p.replace(`, ${old.promptSuffix}`, '')));
    }
    if (presetId) {
      const next = stylePresets.find((p) => p.id === presetId);
      if (next) setPrompts((prev) => prev.map((p) => `${p}, ${next.promptSuffix}`));
    }
    setStylePreset(presetId);
  };

  const handleAspectRatioChange = (ratio: AspectRatioPreset) => {
    setAspectRatio(ratio);
    if (contentPreset) {
      const preset = contentPresets.find((p) => p.id === contentPreset);
      if (preset && preset.aspectRatio !== ratio) setContentPreset(undefined);
    }
  };

  const { valid: validPrompts } = validateBulkPrompts(prompts);
  const canGenerate = validPrompts.length > 0 && !bulk.isRunning;
  const maxImages = validPrompts.length * numImages;

  return (
    <div className="flex flex-col h-full flex-1 overflow-auto">
      <div className="p-3 flex flex-col gap-3 flex-1">
        {/* Header row: concurrency + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-dim">Parallel:</span>
            {CONCURRENCY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  concurrency === n
                    ? 'bg-accent/20 text-accent-light border border-accent'
                    : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                }`}
                onClick={() => setConcurrency(n)}
                disabled={bulk.isRunning}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-1 items-center">
            <button
              type="button"
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-app-base text-text-muted border border-border hover:border-text-dim transition-colors"
              onClick={handleImportJson}
              disabled={bulk.isRunning}
            >
              Import
            </button>
            <button
              type="button"
              className="w-[18px] h-[18px] rounded-full text-[11px] text-text-dim hover:text-accent-light transition-colors flex items-center justify-center"
              onClick={() => setShowJsonHelp(true)}
              title="JSON format info"
            >
              ?
            </button>
            <button
              type="button"
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-app-base text-text-muted border border-border hover:border-text-dim transition-colors"
              onClick={addPrompt}
              disabled={bulk.isRunning || prompts.length >= 50}
            >
              + Add
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

        {showJsonHelp && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={(e) => { if (e.target === e.currentTarget) setShowJsonHelp(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowJsonHelp(false); }}
          >
            <div className="bg-app-surface border border-border rounded-lg p-4 max-w-[320px] w-full shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-text-primary">Import JSON Format</span>
                <button
                  type="button"
                  className="text-[14px] text-text-dim hover:text-text-primary"
                  onClick={() => setShowJsonHelp(false)}
                >
                  x
                </button>
              </div>
              <pre className="bg-app-base border border-border rounded px-3 py-2 text-[10px] text-text-secondary overflow-auto mb-2">{`[
  "A cat sitting on a rooftop at sunset",
  "A futuristic city with flying cars",
  "A watercolor painting of a forest"
]`}</pre>
              <div className="text-[10px] text-text-dim">
                A JSON array of prompt strings. Max 50 prompts.
              </div>
            </div>
          </div>
        )}

        {importError && (
          <div className="text-[11px] text-accent-red bg-accent-red/10 rounded px-2 py-1">{importError}</div>
        )}

        {/* Prompts list */}
        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-auto pr-1">
          {prompts.map((prompt, i) => (
            <div key={i} className="flex gap-1 items-start">
              <span className="text-[9px] text-text-dim mt-1.5 w-4 shrink-0">{i + 1}.</span>
              <textarea
                className="flex-1 min-h-[52px] bg-app-base border border-border rounded px-2 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent resize-none placeholder:text-text-dim"
                placeholder="Describe the image..."
                value={prompt}
                onChange={(e) => updatePrompt(i, e.target.value)}
                disabled={bulk.isRunning}
              />
              <button
                type="button"
                className="mt-1 w-[20px] h-[20px] rounded text-[12px] text-text-dim hover:text-accent-red flex items-center justify-center shrink-0"
                onClick={() => removePrompt(i)}
                disabled={bulk.isRunning || prompts.length === 1}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-app-base text-text-muted border border-border hover:border-text-dim transition-colors"
            onClick={() => { setPrompts(['']); bulk.resetJobs(); }}
            disabled={bulk.isRunning || (prompts.length === 1 && prompts[0].trim() === '')}
          >
            Clear all
          </button>
          <span className="text-[9px] text-text-dim">{validPrompts.length} prompt{validPrompts.length !== 1 ? 's' : ''} ready</span>
        </div>

        {/* Reference images */}
        <ReferenceImageLibrary onEnabledImagesChange={setReferenceImages} />

        {/* Shared settings */}
        {/* Content preset */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Preset</div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                !contentPreset ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
              }`}
              onClick={() => applyContentPreset(undefined)}
              disabled={bulk.isRunning}
            >
              None
            </button>
            {contentPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  contentPreset === preset.id ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                }`}
                onClick={() => applyContentPreset(preset.id)}
                disabled={bulk.isRunning}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style preset */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Style</div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                !stylePreset ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
              }`}
              onClick={() => applyStylePreset(undefined)}
              disabled={bulk.isRunning}
            >
              None
            </button>
            {stylePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  stylePreset === preset.id ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                }`}
                onClick={() => applyStylePreset(preset.id)}
                disabled={bulk.isRunning}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Provider */}
        {providers.length > 1 && (
          <div>
            <div className="text-[10px] text-text-dim mb-1">Provider</div>
            <select
              className="w-full bg-app-base border border-border rounded px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
              value={activeProvider || ''}
              onChange={(e) => onProviderChange?.(e.target.value)}
              disabled={bulk.isRunning}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Model + Images */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[10px] text-text-dim mb-1">Model</div>
            <select
              className="w-full bg-app-base border border-border rounded px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={modelsLoading || bulk.isRunning}
            >
              {models.length > 0 ? models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.credits ? `${m.name} · ${m.credits} cr` : m.name}
                </option>
              )) : (
                <option value="" disabled>No models available</option>
              )}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-text-dim mb-1">Images</div>
            <div className="flex gap-0.5">
              {NUM_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`w-[28px] h-[28px] rounded text-[11px] font-medium transition-colors ${
                    numImages === n ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                  }`}
                  onClick={() => setNumImages(n)}
                  disabled={bulk.isRunning}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Aspect Ratio */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Aspect Ratio</div>
          <div className="flex gap-1">
            {ASPECT_RATIO_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors ${
                  aspectRatio === key ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                }`}
                onClick={() => handleAspectRatioChange(key)}
                disabled={bulk.isRunning}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        {bulk.isRunning || bulk.jobs.some((j) => j.status !== 'pending') ? (
          <div>
            <div className="text-[10px] text-text-dim mb-1">
              Progress — {bulk.totalProgress.done}/{bulk.jobs.length} done
              {bulk.totalProgress.errors > 0 && (
                <span className="text-accent-red"> · {bulk.totalProgress.errors} failed</span>
              )}
              {' · '}{bulk.totalProgress.images}/{maxImages} images
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-app-base rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${bulk.totalProgress.percent}%` }}
              />
            </div>
            {/* Job log */}
            <div className="flex flex-col gap-0.5 max-h-[120px] overflow-auto pr-1">
              {bulk.jobs.map((job, i) => (
                <div key={job.id} className="text-[10px] flex items-center gap-1">
                  <span className="text-text-dim w-4 shrink-0">{i + 1}:</span>
                  <span className={`truncate flex-1 ${job.status === 'error' ? 'text-accent-red' : job.status === 'done' ? 'text-accent-green' : 'text-text-muted'}`}>
                    {job.prompt.slice(0, 30)}{job.prompt.length > 30 ? '...' : ''}
                  </span>
                  <span className="shrink-0">
                    {job.status === 'pending' && '○'}
                    {job.status === 'generating' && <span className="text-accent-amber">◐</span>}
                    {job.status === 'done' && `✓ ${job.images.length}`}
                    {job.status === 'error' && '✗'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Generate / Cancel button */}
      <div className="p-3 border-t border-border">
        {bulk.isRunning ? (
          <Button variant="secondary" onClick={bulk.cancel} className="w-full">
            Cancel ({bulk.totalProgress.percent}%)
          </Button>
        ) : (
          <Button variant="primary" onClick={handleGenerate} disabled={!canGenerate} className="w-full">
            Generate All ({validPrompts.length})
          </Button>
        )}
      </div>
    </div>
  );
}
