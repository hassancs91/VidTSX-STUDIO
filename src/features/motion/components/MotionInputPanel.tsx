import type { ReactNode } from 'react';
import { Button } from '@shared/components';
import { ProviderSelect } from '@renderer/components/ProviderSelect';
import { ModelSelect } from '@renderer/components/ModelSelect';
import { useModelPicker } from '@renderer/hooks/useModelPicker';
import type { LlmProviderConfig, LlmImageIpc } from '../../../shared/ipc/types';
import type { StudioBrand } from '@shared/types/asset-library';
import type { BuildBudget } from '@shared/ipc/types';
import type { AspectRatio } from '../types';
import { FPS_OPTIONS, ASPECT_RATIO_OPTIONS } from '../types';
import { BUDGET_CHOICES, budgetHint } from '../services/build-job-request';
import { MotionReferenceImagePicker } from './MotionReferenceImagePicker';
import { MotionBrandField } from './MotionBrandField';
import { MotionModeToggle, type MotionInputMode } from './MotionModeToggle';
import { MotionSegmented } from './MotionSegmented';
import { MotionDurationField } from './MotionDurationField';
import { MotionCheckField } from './MotionCheckField';

const FPS_CHOICES = FPS_OPTIONS.map((n) => ({ value: n, label: String(n) }));
const RATIO_CHOICES = ASPECT_RATIO_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

interface MotionInputPanelProps {
  /** `Prompt` starts a build (P3 part 2); `Templates` fills one in. */
  mode: MotionInputMode;
  onModeChange: (mode: MotionInputMode) => void;
  /** Templates mode: the gallery or the open template's form. It needs no
   *  provider, model or prompt, so it takes the whole column. */
  templatesPanel?: ReactNode;
  prompt: string;
  onPromptChange: (value: string) => void;
  providers: LlmProviderConfig[];
  selectedProvider: string;
  onProviderChange: (value: string) => void;
  /** Model on the provider; '' = its default. */
  model: string;
  onModelChange: (value: string) => void;
  budget: BuildBudget;
  onBudgetChange: (value: BuildBudget) => void;
  /** Seamless loop: the last frame flows into frame 0. */
  seamlessLoop: boolean;
  onSeamlessLoopChange: (value: boolean) => void;
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
  referenceImages: LlmImageIpc[];
  onReferenceImagesChange: (images: LlmImageIpc[]) => void;
  onGenerate: () => void;
  onCollapse?: () => void;
}

export function MotionInputPanel({
  mode,
  onModeChange,
  templatesPanel,
  prompt,
  onPromptChange,
  providers,
  selectedProvider,
  onProviderChange,
  model,
  onModelChange,
  budget,
  onBudgetChange,
  seamlessLoop,
  onSeamlessLoopChange,
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
  referenceImages,
  onReferenceImagesChange,
  onGenerate,
  onCollapse,
}: MotionInputPanelProps) {
  const picker = useModelPicker(selectedProvider);
  const templatesMode = mode === 'templates';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && prompt.trim()) {
      onGenerate();
    }
  };

  return (
    <div
      className={`flex flex-col shrink-0 bg-app-surface h-full ${templatesMode ? 'overflow-hidden' : 'overflow-y-auto'}`}
    >
      {/* Mode + collapse */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <MotionModeToggle mode={mode} onChange={onModeChange} />
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
      {!templatesMode && (
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
          />
        </div>
      )}

      {/* Provider + Model (W1) — a template is filled in, not generated */}
      {!templatesMode && (
        <>
          <div className="px-3 pb-2 flex flex-col gap-1">
            <label className="text-[10px] text-text-dim">Provider</label>
            <ProviderSelect
              providers={providers}
              value={selectedProvider}
              onChange={(next) => {
                onProviderChange(next);
                onModelChange('');
              }}
            />
          </div>

          <div className="px-3 pb-2 flex flex-col gap-1">
            <label className="text-[10px] text-text-dim">Model</label>
            <ModelSelect
              models={picker.models}
              defaultModel={picker.defaultModel}
              value={model}
              onChange={onModelChange}
            />
          </div>
        </>
      )}

      {!templatesMode && (
        <>
          <MotionSegmented label="Budget" options={BUDGET_CHOICES} value={budget} onChange={onBudgetChange} hint={budgetHint(budget)} />
          <MotionSegmented label="FPS" options={FPS_CHOICES} value={fps} onChange={onFpsChange} />
          <MotionSegmented label="Aspect Ratio" options={RATIO_CHOICES} value={aspectRatio} onChange={onAspectRatioChange} />
          <MotionDurationField
            duration={duration}
            onDurationChange={onDurationChange}
            autoDuration={autoDuration}
            onAutoDurationChange={onAutoDurationChange}
          />
          <MotionCheckField
            name="loop"
            label="Loop"
            hint="(the last frame flows into the first)"
            checked={seamlessLoop}
            onChange={onSeamlessLoopChange}
          />

          <MotionBrandField brands={brands} selectedBrandId={selectedBrandId} onChange={onBrandChange} />

          {/* Reference Images */}
          <div className="px-3 pb-3">
            <MotionReferenceImagePicker images={referenceImages} onChange={onReferenceImagesChange} />
          </div>

          <div className="px-3 pb-3">
            <Button
              variant="primary"
              onClick={onGenerate}
              disabled={!prompt.trim() || !selectedProvider}
              className="w-full"
              data-motion-build
            >
              Build
            </Button>
            <div className="text-[9px] text-text-dim mt-1 text-center">Ctrl+Enter</div>
          </div>
        </>
      )}

      {templatesMode && <div className="flex-1 min-h-0 flex flex-col">{templatesPanel}</div>}
    </div>
  );
}
