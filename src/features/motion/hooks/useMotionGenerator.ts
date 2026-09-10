import { useState, useEffect, useCallback } from 'react';
import type { LlmImageIpc, TsxJobStartRequest } from '../../../shared/ipc/types';
import type { StudioBrand } from '@shared/types/asset-library';
import type { ThinkingLevel } from '@shared/tsx-engine';
import { useProviderPicker } from '@renderer/hooks/useProviderPicker';
// The brand contract is shared with the agent mode's `generate_composition`
// (W7, decision 7): one block, both modes.
import { buildBrandInstructions } from '@shared/studio/brand-instructions';
import type { AspectRatio } from '../types';
import { ASPECT_RATIO_OPTIONS } from '../types';

export type { ThinkingLevel } from '@shared/tsx-engine';

/**
 * Generation options state for the Creator screen. Since generations run as
 * jobs in the main process (TsxJobEngine), this hook no longer executes
 * anything — it holds the input state and builds TsxJobStartRequest payloads.
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

  const buildGenerateJob = useCallback((): TsxJobStartRequest | null => {
    if (!prompt.trim() || !selectedProvider) return null;

    const brand = brands.find((b) => b.id === selectedBrandId);
    const extraInstructions = brand ? buildBrandInstructions(brand) : undefined;

    const ratioOption = ASPECT_RATIO_OPTIONS.find((o) => o.value === aspectRatio);

    return {
      kind: 'generate',
      prompt: prompt.trim(),
      providerId: selectedProvider,
      options: {
        ...(model ? { model } : {}),
        thinkingLevel,
        maxTurns: loopCount,
        optimize,
        promptContext: {
          fps,
          videoWidth: ratioOption?.width ?? 1920,
          videoHeight: ratioOption?.height ?? 1080,
          ...(autoDuration ? {} : { durationSeconds: duration }),
          ...(extraInstructions ? { extraInstructions } : {}),
        },
        ...(referenceImages.length > 0 ? { images: referenceImages } : {}),
      },
    };
  }, [prompt, selectedProvider, model, thinkingLevel, loopCount, optimize, fps, brands, selectedBrandId, aspectRatio, duration, autoDuration, referenceImages]);

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
    optimize,
    setOptimize,
    referenceImages,
    setReferenceImages,
    buildGenerateJob,
    buildEditJob,
    buildFixJob,
  };
}
