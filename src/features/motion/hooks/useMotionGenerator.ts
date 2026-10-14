import { useState, useEffect, useCallback } from 'react';
import type { BuildBudget, LlmImageIpc, TsxJobStartRequest } from '../../../shared/ipc/types';
import type { StudioBrand } from '@shared/types/asset-library';
import type { ThinkingLevel } from '@shared/tsx-engine';
import { useProviderPicker } from '@renderer/hooks/useProviderPicker';
// The brand contract is shared with the agent mode's `generate_composition`
// (W7, decision 7): one block, both modes.
import { buildBrandInstructions } from '@shared/studio/brand-instructions';
import type { AspectRatio } from '../types';
import { buildJobRequest, DEFAULT_BUDGET } from '../services/build-job-request';

export type { ThinkingLevel } from '@shared/tsx-engine';

/**
 * Generation options state for the Creator screen. Since generations run as
 * jobs in the main process (TsxJobEngine), this hook no longer executes
 * anything — it holds the input state and builds TsxJobStartRequest payloads.
 * The first message is a `build` job (P3 part 2); edit and fix stay on the
 * pipeline until part 3.
 */
export function useMotionGenerator() {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const { providers, selectedProvider, setSelectedProvider } = useProviderPicker();
  /** Model on the selected provider; '' = its default (W1). */
  const [model, setModel] = useState('');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('off');
  const [loopCount, setLoopCount] = useState(1);
  const [fps, setFps] = useState(30);
  const [brands, setBrands] = useState<StudioBrand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState(5);
  const [autoDuration, setAutoDuration] = useState(true);
  const [budget, setBudget] = useState<BuildBudget>(DEFAULT_BUDGET);
  const [seamlessLoop, setSeamlessLoop] = useState(false);
  const [optimize, setOptimize] = useState(true);
  const [referenceImages, setReferenceImages] = useState<LlmImageIpc[]>([]);

  // Brands are optional styling — load once; an empty list just hides nothing
  // (the dropdown shows None plus a hint on where to create them).
  useEffect(() => {
    let disposed = false;
    window.api.libraryBrandsGet()
      .then((res) => {
        if (!disposed && res.success && res.brands) setBrands(res.brands);
      })
      .catch(() => {});
    return () => { disposed = true; };
  }, []);

  const buildBuildJob = useCallback((): TsxJobStartRequest | null => {
    const brand = brands.find((b) => b.id === selectedBrandId);
    return buildJobRequest({
      prompt,
      providerId: selectedProvider,
      model,
      aspectRatio,
      fps,
      duration,
      autoDuration,
      loop: seamlessLoop,
      budget,
      ...(brand ? { brand: buildBrandInstructions(brand) } : {}),
      referenceImages,
    });
  }, [prompt, selectedProvider, model, aspectRatio, fps, duration, autoDuration, seamlessLoop, budget, brands, selectedBrandId, referenceImages]);

  const buildEditJob = useCallback((currentCode: string, folderPath: string): TsxJobStartRequest | null => {
    if (!editPrompt.trim() || !selectedProvider || !currentCode) return null;

    return {
      kind: 'edit',
      prompt: editPrompt.trim(),
      providerId: selectedProvider,
      options: {
        ...(model ? { model } : {}),
        thinkingLevel,
        maxTurns: loopCount,
        ...(referenceImages.length > 0 ? { images: referenceImages } : {}),
      },
      target: { folderPath, currentCode },
    };
  }, [editPrompt, selectedProvider, model, thinkingLevel, loopCount, referenceImages]);

  const buildFixJob = useCallback((
    currentCode: string,
    folderPath: string,
    errorMessage: string,
    errorLocation?: { line: number; column: number; file: string },
  ): TsxJobStartRequest | null => {
    if (!selectedProvider || !currentCode || !errorMessage) return null;

    const locationInfo = errorLocation
      ? ` at line ${errorLocation.line}, column ${errorLocation.column}`
      : '';
    const fixInstruction =
      `The current TSX composition fails with the following error${locationInfo}:\n\n` +
      `${errorMessage}\n\n` +
      `Fix the error. Make the minimal changes needed to resolve the issue ` +
      `while preserving the intended visual design and behavior.`;

    return {
      kind: 'fix',
      prompt: fixInstruction,
      providerId: selectedProvider,
      options: { ...(model ? { model } : {}), thinkingLevel, maxTurns: loopCount },
      target: { folderPath, currentCode },
    };
  }, [selectedProvider, model, thinkingLevel, loopCount]);

  return {
    prompt,
    setPrompt,
    editPrompt,
    setEditPrompt,
    providers,
    selectedProvider,
    setSelectedProvider,
    model,
    setModel,
    thinkingLevel,
    setThinkingLevel,
    loopCount,
    setLoopCount,
    fps,
    setFps,
    brands,
    selectedBrandId,
    setSelectedBrandId,
    aspectRatio,
    setAspectRatio,
    duration,
    setDuration,
    autoDuration,
    setAutoDuration,
    budget,
    setBudget,
    seamlessLoop,
    setSeamlessLoop,
    optimize,
    setOptimize,
    referenceImages,
    setReferenceImages,
    buildBuildJob,
    buildEditJob,
    buildFixJob,
  };
}
