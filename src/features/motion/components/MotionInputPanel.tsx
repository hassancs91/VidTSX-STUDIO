import { Button } from '@shared/components';
import { ProviderSelect } from '@renderer/components/ProviderSelect';
import { ModelSelect } from '@renderer/components/ModelSelect';
import { useModelPicker } from '@renderer/hooks/useModelPicker';
import { llmModelSupportsThinking } from '@shared/presets/llm-models';
import { THINKING_UI_OPTIONS } from '@shared/tsx-engine';
import type { ThinkingLevel } from '../hooks/useMotionGenerator';
import type { LlmProviderConfig, LlmImageIpc } from '../../../shared/ipc/types';
import type { StudioBrand } from '@shared/types/asset-library';
import type { PipelineProgress } from '@shared/tsx-engine';
import type { AspectRatio } from '../types';
import { FPS_OPTIONS, ASPECT_RATIO_OPTIONS, DURATION_RANGE } from '../types';
import { useSmoothProgress } from '../hooks/useSmoothProgress';
import { MotionReferenceImagePicker } from './MotionReferenceImagePicker';

const LOOP_OPTIONS = [1, 2, 3, 4, 5];

interface MotionInputPanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  providers: LlmProviderConfig[];
  selectedProvider: string;
  onProviderChange: (value: string) => void;
  /** Model on the provider; '' = its default. */
  model: string;
  onModelChange: (value: string) => void;
  thinkingLevel: ThinkingLevel;
  onThinkingLevelChange: (value: ThinkingLevel) => void;
  loopCount: number;
  onLoopCountChange: (value: number) => void;
  fps: number;
  onFpsChange: (value: number) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (value: AspectRatio) => void;
  duration: number;
  onDurationChange: (value: number) => void;
  autoDuration: boolean;
  onAutoDurationChange: (value: boolean) => void;
  brands: StudioBrand[];
  selectedBrandId: string;
  onBrandChange: (brandId: string) => void;
  optimize: boolean;
  onOptimizeChange: (value: boolean) => void;
  referenceImages: LlmImageIpc[];
  onReferenceImagesChange: (images: LlmImageIpc[]) => void;
  onGenerate: () => void;
  onCancel: () => void;
  loading: boolean;
  progress: PipelineProgress | null;
  hasProject: boolean;
  onCollapse?: () => void;
}

export function MotionInputPanel({
  prompt,
  onPromptChange,
  providers,
  selectedProvider,
  onProviderChange,
  model,
  onModelChange,
  thinkingLevel,
  onThinkingLevelChange,
  loopCount,
  onLoopCountChange,
  fps,
  onFpsChange,
  aspectRatio,
  onAspectRatioChange,
  duration,
  onDurationChange,
  autoDuration,
  onAutoDurationChange,
  brands,
  selectedBrandId,
  onBrandChange,
  optimize,
  onOptimizeChange,
  referenceImages,
  onReferenceImagesChange,
  onGenerate,
  onCancel,
  loading,
  progress,
  hasProject,
  onCollapse,
}: MotionInputPanelProps) {
  const smoothPercent = useSmoothProgress(progress);
  const picker = useModelPicker(selectedProvider);
  const showThinking = llmModelSupportsThinking(picker.providerId, model || undefined);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !loading && prompt.trim()) {
      onGenerate();
    }
  };

  return (
    <div
      className="flex flex-col shrink-0 bg-app-surface overflow-y-auto h-full"
    >
      {/* Prompt */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center">
          <label className="text-[11px] text-text-muted font-medium flex-1">What do you want to create?</label>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="shrink-0 text-text-dim hover:text-text-primary transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover"
              title="Collapse panel"
            >
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 2L3.5 5L6.5 8" />
              </svg>
            </button>
          )}
        </div>
        <textarea
          className="bg-app-base text-text-primary rounded-[6px] px-3 py-2 resize-none focus:outline-none"
          style={{
            fontSize: 12,
            border: '0.5px solid var(--color-border-input)',
            minHeight: 120,
            fontFamily: 'inherit',
          }}
          placeholder="Describe the motion/animation you want to create..."
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-input)'; }}
          disabled={loading}
        />
      </div>

      {/* Provider */}
      <div className="px-3 pb-2 flex flex-col gap-1">
        <label className="text-[10px] text-text-dim">Provider</label>
        <ProviderSelect
          providers={providers}
          value={selectedProvider}
          onChange={(next) => {
            onProviderChange(next);
            onModelChange('');
          }}
          disabled={loading}
        />
      </div>

      {/* Model (W1) */}
      <div className="px-3 pb-2 flex flex-col gap-1">
        <label className="text-[10px] text-text-dim">Model</label>
        <ModelSelect
          models={picker.models}
          defaultModel={picker.defaultModel}
          value={model}
          onChange={onModelChange}
          disabled={loading}
        />
      </div>

      {/* FPS */}
      <div className="px-3 pb-3 flex flex-col gap-1">
        <label className="text-[10px] text-text-dim">FPS</label>
        <div
          className="flex rounded-[6px] overflow-hidden"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {FPS_OPTIONS.map((n, i) => (
            <button
              key={n}
              onClick={() => onFpsChange(n)}
              disabled={loading}
              className={`flex-1 px-[6px] py-[4px] text-[10px] transition-colors duration-150 cursor-pointer ${
                fps === n
                  ? 'bg-accent text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{
                borderRight: i !== FPS_OPTIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="px-3 pb-3 flex flex-col gap-1">
        <label className="text-[10px] text-text-dim">Aspect Ratio</label>
        <div
          className="flex rounded-[6px] overflow-hidden"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {ASPECT_RATIO_OPTIONS.map((option, i) => (
            <button
              key={option.value}
              onClick={() => onAspectRatioChange(option.value)}
              disabled={loading}
              className={`flex-1 px-[6px] py-[4px] text-[10px] transition-colors duration-150 cursor-pointer ${
                aspectRatio === option.value
                  ? 'bg-accent text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{
                borderRight: i !== ASPECT_RATIO_OPTIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="px-3 pb-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-text-dim">
            Duration <span className="text-text-dim">{autoDuration ? '(AI decides)' : `(${duration}s)`}</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoDuration}
              onChange={(e) => onAutoDurationChange(e.target.checked)}
              disabled={loading}
              className="accent-accent cursor-pointer"
            />
            <span className="text-[9px] text-text-dim">Auto</span>
          </label>
        </div>
        <input
          type="range"
          min={DURATION_RANGE.min}
          max={DURATION_RANGE.max}
          value={duration}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          disabled={loading || autoDuration}
          className="w-full accent-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ height: 18 }}
        />
        <div className="flex justify-between text-[9px] text-text-dim">
          <span>{DURATION_RANGE.min}s</span>
          <span>{DURATION_RANGE.max}s</span>
        </div>
      </div>

      {/* Brand (optional styling) */}
      <div className="px-3 pb-3 flex flex-col gap-1">
        <label className="text-[10px] text-text-dim">Brand <span className="text-text-dim">(optional)</span></label>
        <select
          className="bg-app-base border border-border rounded-[6px] px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer w-full"
          value={selectedBrandId}
          onChange={(e) => onBrandChange(e.target.value)}
          disabled={loading}
        >
          <option value="">None</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        {(() => {
          const brand = brands.find((b) => b.id === selectedBrandId);
          if (!brand) {
            return brands.length === 0 ? (
              <span className="text-[9px] text-text-dim">Create brands in Assets to reuse your colors and fonts.</span>
            ) : null;
          }
          const swatches = [
            brand.palette.primary,
            brand.palette.secondary,
            brand.palette.background,
            brand.palette.text,
            brand.palette.accent,
          ];
          return (
            <div className="flex gap-1 mt-1">
              {swatches.map((color, i) => (
                <div
                  key={i}
                  className="flex-1 h-[14px] rounded-[3px]"
                  style={{ backgroundColor: color, border: '0.5px solid var(--color-border)' }}
                  title={color}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Thinking — hidden on a model the catalog marks as non-thinking (W1) */}
      <div className={`px-3 pb-3 flex flex-col gap-1 ${showThinking ? '' : 'hidden'}`}>
        <label className="text-[10px] text-text-dim">Thinking</label>
        <div
          className="flex rounded-[6px] overflow-hidden"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {THINKING_UI_OPTIONS.map((level, idx) => (
            <button
              key={level.value}
              onClick={() => onThinkingLevelChange(level.value)}
              disabled={loading}
              className={`flex-1 px-[6px] py-[4px] text-[10px] transition-colors duration-150 cursor-pointer ${
                thinkingLevel === level.value
                  ? 'bg-accent text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{
                borderRight: idx < THINKING_UI_OPTIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none',
              }}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* MVP: Loops hidden — fixed at 1. Re-enable when multi-loop support is ready. */}

      {/* Optimize */}
      <div className="px-3 pb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={optimize}
            onChange={(e) => onOptimizeChange(e.target.checked)}
            disabled={loading}
            className="accent-accent cursor-pointer"
          />
          <span className="text-[11px] text-text-muted">Optimize</span>
          <span className="text-[9px] text-text-dim">(plan before generating)</span>
        </label>
      </div>

      {/* Reference Images */}
      <div className="px-3 pb-3">
        <MotionReferenceImagePicker
          images={referenceImages}
          onChange={onReferenceImagesChange}
          disabled={loading}
        />
      </div>

      {/* Generate / Cancel */}
      <div className="px-3 pb-3">
        {loading ? (
          <button
            onClick={onCancel}
            className="w-full px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer text-red-400 hover:text-white hover:bg-red-500/80"
            style={{ border: '1px solid rgba(239,68,68,0.4)' }}
          >
            {progress ? progress.stepLabel + ' — Cancel' : 'Cancel'}
          </button>
        ) : (
          <Button
            variant="primary"
            onClick={onGenerate}
            disabled={!prompt.trim() || !selectedProvider}
            className="w-full"
          >
            Generate
          </Button>
        )}
        {loading && progress ? (
          <div className="mt-1.5 flex flex-col gap-1">
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
        ) : (
          <div className="text-[9px] text-text-dim mt-1 text-center">
            Ctrl+Enter
          </div>
        )}
      </div>

    </div>
  );
}
