import type { ReactNode } from 'react';
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
import { MotionBrandField } from './MotionBrandField';
import { MotionModeToggle, type MotionInputMode } from './MotionModeToggle';
import { MotionSegmented } from './MotionSegmented';

const FPS_CHOICES = FPS_OPTIONS.map((n) => ({ value: n, label: String(n) }));
const RATIO_CHOICES = ASPECT_RATIO_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

interface MotionInputPanelProps {
  /** W7: `Prompt` is the one-shot generator; `Agent` embeds TSX Composer. */
  mode: MotionInputMode;
  onModeChange: (mode: MotionInputMode) => void;
  /** The Agent mode chat, mounted by the screen; hidden in prompt mode so a
   *  run in flight keeps its view. */
  agentPanel?: ReactNode;
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
  mode,
  onModeChange,
  agentPanel,
  prompt,
  onPromptChange,
  providers,
  selectedProvider,
  onProviderChange,
  model,
  onModelChange,
  thinkingLevel,
  onThinkingLevelChange,
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
  onCollapse,
}: MotionInputPanelProps) {
  const smoothPercent = useSmoothProgress(progress);
  const picker = useModelPicker(selectedProvider);
  const showThinking = llmModelSupportsThinking(picker.providerId, model || undefined);
  const agentMode = mode === 'agent';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !loading && prompt.trim()) {
      onGenerate();
    }
  };

  const brandField = (
    <MotionBrandField
      brands={brands}
      selectedBrandId={selectedBrandId}
      onChange={onBrandChange}
      disabled={loading}
    />
  );

  return (
    <div
      className={`flex flex-col shrink-0 bg-app-surface h-full ${agentMode ? 'overflow-hidden' : 'overflow-y-auto'}`}
    >
      {/* Mode (W7) + collapse */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <MotionModeToggle mode={mode} onChange={onModeChange} disabled={loading} />
        <div className="flex-1" />
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

      {/* Prompt */}
      {!agentMode && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <label className="text-[11px] text-text-muted font-medium">What do you want to create?</label>
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
      )}

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

      {agentMode ? (
        brandField
      ) : (
        <>
          <MotionSegmented label="FPS" options={FPS_CHOICES} value={fps} onChange={onFpsChange} disabled={loading} />
          <MotionSegmented
            label="Aspect Ratio"
            options={RATIO_CHOICES}
            value={aspectRatio}
            onChange={onAspectRatioChange}
            disabled={loading}
          />

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

          {brandField}

          {/* Thinking — hidden on a model the catalog marks as non-thinking (W1) */}
          <MotionSegmented
            label="Thinking"
            options={THINKING_UI_OPTIONS}
            value={thinkingLevel}
            onChange={onThinkingLevelChange}
            disabled={loading}
            className={showThinking ? '' : 'hidden'}
          />

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
                  <div className="h-full bg-accent rounded-full" style={{ width: `${smoothPercent}%` }} />
                </div>
                <div className="text-[9px] text-text-dim text-center">{Math.round(smoothPercent)}%</div>
              </div>
            ) : (
              <div className="text-[9px] text-text-dim mt-1 text-center">Ctrl+Enter</div>
            )}
          </div>
        </>
      )}

      {/* The Agent mode chat fills the rest. It stays MOUNTED in prompt mode
          (hidden) so a run in flight keeps its view; the agent chooses frame,
          fps and length from the conversation (AGENT.md), so those pickers
          belong to prompt mode only. */}
      <div
        className={`flex-1 min-h-0 flex flex-col ${agentMode ? '' : 'hidden'}`}
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        {agentPanel}
      </div>
    </div>
  );
}
