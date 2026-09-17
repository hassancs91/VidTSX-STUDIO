import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, ReferenceImageLibrary, VideoModelFields } from '@shared/components';
import type { VideoModelInfoIpc, VideoProviderInfo } from '@shared/ipc/types';
import { ReferenceMediaPicker } from './ReferenceMediaPicker';
import {
  availableModes,
  clampAspectRatio,
  clampDuration,
  clampMode,
  clampResolution,
  estimatedCostUsd,
  isCostRateApproximate,
} from '@shared/video/model-constraints';
import type { VideoGenerationSettings, VideoPanelMode } from '../types';

const MODE_LABELS: Record<VideoPanelMode, string> = {
  generate: 'Generate',
  frames: 'Frames',
  reference: 'Reference',
};

interface VideoControlPanelProps {
  providers: VideoProviderInfo[];
  selectedProvider: string | null;
  onProviderChange: (providerId: string) => void;
  models: VideoModelInfoIpc[];
  modelsLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  onGenerate: (settings: VideoGenerationSettings) => void;
}

export function VideoControlPanel({
  providers,
  selectedProvider,
  onProviderChange,
  models,
  modelsLoading,
  isSubmitting,
  error,
  onGenerate,
}: VideoControlPanelProps) {
  const [modelId, setModelId] = useState('');
  const [mode, setMode] = useState<VideoPanelMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState<string | undefined>();
  const [generateAudio, setGenerateAudio] = useState(true);
  const [firstFrame, setFirstFrame] = useState<string[]>([]);
  const [lastFrame, setLastFrame] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceVideoPaths, setReferenceVideoPaths] = useState<string[]>([]);
  const [referenceAudioPaths, setReferenceAudioPaths] = useState<string[]>([]);

  const model = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);

  // Re-point at a usable model whenever the list changes (provider switch, a
  // catalog edit), then re-clamp every field to what that model publishes —
  // the panel must never offer a value the model would have to be corrected on.
  useEffect(() => {
    if (models.length === 0) {
      setModelId('');
      return;
    }
    const next = models.find((m) => m.id === modelId) ?? models[0];
    if (next.id !== modelId) setModelId(next.id);
    setMode((prev) => clampMode(next, prev));
    setDurationSeconds((prev) => clampDuration(next, prev));
    setAspectRatio((prev) => clampAspectRatio(next, prev));
    setResolution((prev) => clampResolution(next, prev));
    if (!next.supports.audio) setGenerateAudio(false);
  }, [models, modelId]);

  const modes = model ? availableModes(model) : (['generate'] as VideoPanelMode[]);
  const refLimits = model?.supports.references;
  const cost = model ? estimatedCostUsd(model, resolution, durationSeconds) : null;
  const costApprox = model ? isCostRateApproximate(model, resolution) : false;

  const usingReferences =
    referenceImages.length > 0 ||
    referenceVideoPaths.length > 0 ||
    referenceAudioPaths.length > 0;

  const canGenerate =
    Boolean(prompt.trim()) &&
    Boolean(model) &&
    Boolean(selectedProvider) &&
    !isSubmitting &&
    (mode === 'generate' ||
      (mode === 'frames' && firstFrame.length > 0) ||
      (mode === 'reference' && usingReferences));

  const handleGenerate = useCallback(() => {
    if (!model || !canGenerate || !selectedProvider) return;
    onGenerate({
      mode,
      providerId: selectedProvider,
      model: model.id,
      prompt: prompt.trim(),
      durationSeconds,
      aspectRatio,
      ...(resolution ? { resolution } : {}),
      generateAudio,
      ...(mode === 'frames' && firstFrame[0] ? { firstFrame: firstFrame[0] } : {}),
      ...(mode === 'frames' && lastFrame[0] ? { lastFrame: lastFrame[0] } : {}),
      ...(mode === 'reference'
        ? { referenceImages, referenceVideoPaths, referenceAudioPaths }
        : {}),
    });
  }, [
    model,
    canGenerate,
    selectedProvider,
    mode,
    prompt,
    durationSeconds,
    aspectRatio,
    resolution,
    generateAudio,
    firstFrame,
    lastFrame,
    referenceImages,
    referenceVideoPaths,
    referenceAudioPaths,
    onGenerate,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
  };

  if (providers.length === 0) {
    return (
      <div
        className="flex flex-col h-full shrink-0 bg-app-surface overflow-auto p-3"
        style={{ borderRight: '0.5px solid var(--color-border)' }}
      >
        <div className="text-[11px] text-text-dim">
          No video providers configured. Add a Fal.ai or BytePlus ModelArk key in AI &rarr;
          Providers, or download a local video model in AI &rarr; Video, then come back here.
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full shrink-0 bg-app-surface overflow-auto"
      style={{ borderRight: '0.5px solid var(--color-border)' }}
    >
      <div className="p-3 flex flex-col gap-3 flex-1">
        {/* Mode tabs — only the routes this model actually has */}
        <div className="flex gap-1">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
                mode === m
                  ? 'bg-accent/20 text-accent-light border border-accent'
                  : 'bg-app-base text-text-muted border border-border hover:border-text-dim'
              }`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Prompt */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Prompt</div>
          <textarea
            className="w-full h-[100px] bg-app-base border border-border rounded-lg px-2.5 py-2 text-[12px] text-text-primary outline-none focus:border-accent resize-none placeholder:text-text-dim"
            placeholder={
              mode === 'frames'
                ? 'Describe the motion between your frames...'
                : mode === 'reference'
                  ? 'Describe the shot, naming inputs as @Image1, @Video1, @Audio1...'
                  : 'Describe the video you want to create...'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Provider */}
        {providers.length > 1 && (
          <div>
            <div className="text-[10px] text-text-dim mb-1">Provider</div>
            <select
              className="w-full bg-app-base border border-border rounded px-2 py-1.5 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
              value={selectedProvider ?? ''}
              onChange={(e) => onProviderChange(e.target.value)}
              disabled={isSubmitting}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Model */}
        <div>
          <div className="text-[10px] text-text-dim mb-1">Model</div>
          <select
            className="w-full bg-app-base border border-border rounded px-2 py-1.5 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={modelsLoading || models.length === 0}
          >
            {models.length > 0 ? (
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.tagline ? `${m.name} — ${m.tagline}` : m.name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                {modelsLoading ? 'Loading models…' : 'No models available'}
              </option>
            )}
          </select>
        </div>

        {/* Frames — the image-to-video route */}
        {mode === 'frames' && model?.supports.firstFrame && (
          <ReferenceImageLibrary
            selection="local"
            singleSelect
            label="First Frame"
            onEnabledImagesChange={setFirstFrame}
          />
        )}
        {mode === 'frames' && model?.supports.lastFrame && (
          <ReferenceImageLibrary
            selection="local"
            singleSelect
            label="Last Frame"
            onEnabledImagesChange={setLastFrame}
          />
        )}

        {/* References — the reference-to-video route */}
        {mode === 'reference' && refLimits && refLimits.images > 0 && (
          <ReferenceImageLibrary
            selection="local"
            label={`Reference Images (max ${refLimits.images})`}
            onEnabledImagesChange={setReferenceImages}
          />
        )}
        {mode === 'reference' && refLimits && (
          <ReferenceMediaPicker
            kind="video"
            label="Reference Videos"
            limit={refLimits.videos}
            hint="Uploaded to the provider before the job starts"
            paths={referenceVideoPaths}
            onChange={setReferenceVideoPaths}
            disabled={isSubmitting}
          />
        )}
        {mode === 'reference' && refLimits && (
          <ReferenceMediaPicker
            kind="audio"
            label="Reference Audio"
            limit={refLimits.audios}
            paths={referenceAudioPaths}
            onChange={setReferenceAudioPaths}
            disabled={isSubmitting}
          />
        )}
        {mode === 'reference' && refLimits?.videos === 0 && (
          <div className="text-[10px] text-text-dim">
            This provider cannot host reference videos — add a Fal.ai key to use them.
          </div>
        )}

        {/* Duration / aspect / resolution / audio, constrained by the model */}
        {model && (
          <VideoModelFields
            model={model}
            durationSeconds={durationSeconds}
            onDurationChange={setDurationSeconds}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            resolution={resolution}
            onResolutionChange={setResolution}
            generateAudio={generateAudio}
            onGenerateAudioChange={setGenerateAudio}
            disabled={isSubmitting}
          />
        )}

        {error && (
          <div className="text-[11px] text-accent-red bg-accent-red/10 rounded px-2 py-1.5">
            {error}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full"
        >
          {isSubmitting ? 'Submitting…' : 'Generate Video'}
        </Button>
        <div className="text-[9px] text-text-dim mt-1.5 text-center">
          {cost !== null
            ? `Ctrl+Enter · ~$${cost.toFixed(2)} estimated${costApprox ? ' at list rate' : ''}`
            : 'Ctrl+Enter to generate'}
        </div>
      </div>
    </div>
  );
}
