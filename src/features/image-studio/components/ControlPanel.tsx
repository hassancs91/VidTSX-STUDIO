import { useState, useCallback, useEffect } from 'react';
import { Button } from '@shared/components';
import { useToast } from '@renderer/contexts/ToastContext';
import type { GenerationSettings, AspectRatioPreset, ImageMode } from '../types';
import { ASPECT_RATIO_KEYS } from '../services/aspect-ratios';
import { STYLE_PRESETS as DEFAULT_STYLE_PRESETS, CONTENT_PRESETS as DEFAULT_CONTENT_PRESETS } from '../services/style-presets';
import { ImageInput } from './ImageInput';
import { ReferenceImageLibrary } from './ReferenceImageLibrary';
import { BulkControlPanel } from './BulkControlPanel';
import type { ImageModelInfoIpc, ContentPresetSetting, StylePresetSetting } from '../../../shared/ipc/types';
import type { ImageStudioEntry } from '../../../shared/ipc/types';

const NUM_OPTIONS = [1, 2, 3, 4] as const;

const MODES: { id: ImageMode; label: string }[] = [
  { id: 'generate', label: 'Generate' },
  { id: 'edit', label: 'Edit' },
  { id: 'reference', label: 'Reference' },
  { id: 'bulk', label: 'Bulk' },
];

interface EnabledProvider {
  id: string;
  name: string;
}

interface ControlPanelProps {
  models: ImageModelInfoIpc[];
  modelsLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  inputImages: string[];
  onGenerate: (settings: GenerationSettings) => void;
  onInputImagesChange: (images: string[]) => void;
  onImageSaved: (entry: ImageStudioEntry) => void;
  contentPresets?: ContentPresetSetting[];
  stylePresets?: StylePresetSetting[];
  activeFolderId?: string | null;
  providers?: EnabledProvider[];
  activeProvider?: string | null;
  onProviderChange?: (providerId: string) => void;
  pendingUseAsInput?: { id: string; base64: string; contentType: string } | null;
  onConsumePendingUseAsInput?: () => void;
}

export function ControlPanel({
  models,
  modelsLoading,
  isGenerating,
  error,
  inputImages,
  onGenerate,
  onInputImagesChange,
  onImageSaved,
  contentPresets = DEFAULT_CONTENT_PRESETS,
  stylePresets = DEFAULT_STYLE_PRESETS,
  activeFolderId,
  providers = [],
  activeProvider,
  onProviderChange,
  pendingUseAsInput = null,
  onConsumePendingUseAsInput,
}: ControlPanelProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<ImageMode>('generate');
  const [pendingBulkImport, setPendingBulkImport] = useState<{ prompts: string[]; aspectRatio?: AspectRatioPreset } | null>(null);

  // Listen for bulk-import events from other screens (e.g. Thumbnail Generator)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompts: string[]; aspectRatio?: AspectRatioPreset }>).detail;
      if (detail.prompts?.length > 0) {
        setPendingBulkImport({ prompts: detail.prompts, aspectRatio: detail.aspectRatio });
        setMode('bulk');
      }
    };
    window.addEventListener('vidtsx:bulk-import', handler);
    return () => window.removeEventListener('vidtsx:bulk-import', handler);
  }, []);

  // When a gallery image is flagged for "use as input", switch to Edit mode.
  // ReferenceImageLibrary handles enabling the entry once it mounts.
  useEffect(() => {
    if (pendingUseAsInput && mode !== 'edit' && mode !== 'reference') {
      setMode('edit');
    }
  }, [pendingUseAsInput, mode]);

  const [prompt, setPrompt] = useState('');
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

  const applyContentPreset = (presetId: string | undefined) => {
    if (presetId === contentPreset) return;
    if (contentPreset) {
      const oldPreset = contentPresets.find((p) => p.id === contentPreset);
      if (oldPreset) setPrompt((p) => p.replace(`, ${oldPreset.promptSuffix}`, ''));
    }
    if (presetId) {
      const newPreset = contentPresets.find((p) => p.id === presetId);
      if (newPreset) {
        setPrompt((p) => `${p}, ${newPreset.promptSuffix}`);
        setAspectRatio(newPreset.aspectRatio as AspectRatioPreset);
      }
    }
    setContentPreset(presetId);
  };

  const applyStylePreset = (presetId: string | undefined) => {
    if (presetId === stylePreset) return;
    if (stylePreset) {
      const oldPreset = stylePresets.find((p) => p.id === stylePreset);
      if (oldPreset) setPrompt((p) => p.replace(`, ${oldPreset.promptSuffix}`, ''));
    }
    if (presetId) {
      const newPreset = stylePresets.find((p) => p.id === presetId);
      if (newPreset) setPrompt((p) => `${p}, ${newPreset.promptSuffix}`);
    }
    setStylePreset(presetId);
  };

  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;
    onGenerate({
      mode,
      prompt: prompt.trim(),
      model,
      aspectRatio,
      numImages,
      sourceImage: mode === 'edit' ? inputImages[0] : undefined,
      referenceImages: mode === 'reference' ? inputImages : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleGenerate();
    }
  };

  const handleAspectRatioChange = (ratio: AspectRatioPreset) => {
    setAspectRatio(ratio);
    if (contentPreset) {
      const preset = contentPresets.find((p) => p.id === contentPreset);
      if (preset && preset.aspectRatio !== ratio) setContentPreset(undefined);
    }
  };

  const handleAddImages = useCallback((base64Images: string[]) => {
    if (mode === 'edit') {
      onInputImagesChange(base64Images.slice(0, 1));
    } else {
      onInputImagesChange([...inputImages, ...base64Images]);
    }
  }, [mode, inputImages, onInputImagesChange]);

  const handleRemoveImage = useCallback((index: number) => {
    onInputImagesChange(inputImages.filter((_, i) => i !== index));
  }, [inputImages, onInputImagesChange]);

  const handleModeChange = (newMode: ImageMode) => {
    setMode(newMode);
    if (newMode === 'generate') onInputImagesChange([]);
  };

  const canGenerate = prompt.trim() && !isGenerating && (
    mode === 'generate' ||
    (mode === 'edit' && inputImages.length > 0) ||
    (mode === 'reference' && inputImages.length > 0)
  );

  return (
    <div
      className="flex flex-col h-full shrink-0 bg-app-surface overflow-auto"
      style={{ borderRight: '0.5px solid var(--color-border)' }}
    >
      <div className="p-3 flex flex-col gap-3 flex-1">
        {/* Mode tabs — always visible */}
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
                mode === m.id
                  ? 'bg-accent/20 text-accent-light border border-accent'
                  : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
              }`}
              onClick={() => handleModeChange(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Bulk mode renders its own panel */}
        {mode === 'bulk' ? (
          <BulkControlPanel
            models={models}
            modelsLoading={modelsLoading}
            onImageSaved={onImageSaved}
            contentPresets={contentPresets}
            stylePresets={stylePresets}
            activeFolderId={activeFolderId}
            providers={providers}
            activeProvider={activeProvider}
            onProviderChange={onProviderChange}
            pendingImport={pendingBulkImport}
            onImportConsumed={() => setPendingBulkImport(null)}
          />
        ) : (
          <>
            {/* Content presets */}
            <div>
              <div className="text-[10px] text-text-dim mb-1">Preset</div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    !contentPreset ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                  }`}
                  onClick={() => applyContentPreset(undefined)}
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
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <div className="text-[10px] text-text-dim mb-1">Prompt</div>
              <textarea
                className="w-full h-[100px] bg-app-base border border-border rounded-lg px-2.5 py-2 text-[12px] text-text-primary outline-none focus:border-accent resize-none placeholder:text-text-dim"
                placeholder={
                  mode === 'edit'
                    ? 'Describe how to transform the image...'
                    : mode === 'reference'
                    ? 'Describe what to create from references...'
                    : 'Describe the image you want to create...'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* Style presets */}
            <div>
              <div className="text-[10px] text-text-dim mb-1">Style</div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    !stylePreset ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                  }`}
                  onClick={() => applyStylePreset(undefined)}
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
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image input (edit mode) */}
            {mode === 'edit' && (
              <ReferenceImageLibrary
                onEnabledImagesChange={onInputImagesChange}
                singleSelect
                label="Source Image"
                pendingEnable={pendingUseAsInput}
                onConsumePendingEnable={onConsumePendingUseAsInput}
              />
            )}

            {/* Reference image library (reference mode) */}
            {mode === 'reference' && (
              <ReferenceImageLibrary
                onEnabledImagesChange={onInputImagesChange}
                pendingEnable={pendingUseAsInput}
                onConsumePendingEnable={onConsumePendingUseAsInput}
              />
            )}

            {/* Provider */}
            {providers.length > 1 && (
              <div>
                <div className="text-[10px] text-text-dim mb-1">Provider</div>
                <select
                  className="w-full bg-app-base border border-border rounded px-2 py-1.5 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
                  value={activeProvider || ''}
                  onChange={(e) => onProviderChange?.(e.target.value)}
                  disabled={isGenerating}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Model */}
            <div>
              <div className="text-[10px] text-text-dim mb-1">Model</div>
              <select
                className="w-full bg-app-base border border-border rounded px-2 py-1.5 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={modelsLoading}
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
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Images */}
            <div>
              <div className="text-[10px] text-text-dim mb-1">Images</div>
              <div className="flex gap-1">
                {NUM_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors ${
                      numImages === n ? 'bg-accent/20 text-accent-light border border-accent' : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
                    }`}
                    onClick={() => setNumImages(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-[11px] text-accent-red bg-accent-red/10 rounded px-2 py-1.5">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Generate button — hidden in bulk mode, BulkControlPanel has its own */}
      {mode !== 'bulk' && (
        <div className="p-3 border-t border-border">
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full"
          >
            {isGenerating ? 'Generating...' : mode === 'edit' ? 'Edit Image' : mode === 'reference' ? 'Generate from References' : 'Generate'}
          </Button>
          <div className="text-[9px] text-text-dim mt-1.5 text-center">
            Ctrl+Enter to generate
          </div>
        </div>
      )}
    </div>
  );
}
