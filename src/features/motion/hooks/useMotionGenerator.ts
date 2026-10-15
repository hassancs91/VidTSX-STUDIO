import { useState, useEffect, useCallback } from 'react';
import type { BuildBudget, LlmImageIpc, TsxJobStartRequest } from '../../../shared/ipc/types';
import type { StudioBrand } from '@shared/types/asset-library';
import { useProviderPicker } from '@renderer/hooks/useProviderPicker';
// The brand contract is shared with the agents' `generate_composition`
// (W7, decision 7): one block, both callers.
import { buildBrandInstructions } from '@shared/studio/brand-instructions';
import type { AspectRatio } from '../types';
import { buildJobRequest, DEFAULT_BUDGET } from '../services/build-job-request';
import { DEFAULT_EDIT_BUDGET, editJobRequest, fixJobRequest, type EditTarget, type FixInput } from '../services/edit-job-request';

/**
 * Generation options state for the Creator screen. Since generations run as
 * jobs in the main process (TsxJobEngine), this hook no longer executes
 * anything — it holds the input state and builds TsxJobStartRequest payloads.
 * The first message is a `build` job (P3 part 2); the Edit box and "Fix with
 * AI" are builder edits of the open version (part 3).
 */
export function useMotionGenerator() {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const { providers, selectedProvider, setSelectedProvider } = useProviderPicker();
  /** Model on the selected provider; '' = its default (W1). */
  const [model, setModel] = useState('');
  const [fps, setFps] = useState(30);
  const [brands, setBrands] = useState<StudioBrand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState(5);
  const [autoDuration, setAutoDuration] = useState(true);
  const [budget, setBudget] = useState<BuildBudget>(DEFAULT_BUDGET);
  const [editBudget, setEditBudget] = useState<BuildBudget>(DEFAULT_EDIT_BUDGET);
  const [seamlessLoop, setSeamlessLoop] = useState(false);
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

  /** The Edit box: a builder edit of the open version at the Edit row's budget. */
  const buildEditJob = useCallback((target: EditTarget): TsxJobStartRequest | null => editJobRequest({
    prompt: editPrompt,
    providerId: selectedProvider,
    model,
    budget: editBudget,
    target,
    referenceImages,
  }), [editPrompt, selectedProvider, model, editBudget, referenceImages]);

  /** "Fix with AI": a Quick builder edit that names the preview's error. */
  const buildFixJob = useCallback((input: Omit<FixInput, 'providerId' | 'model'>): TsxJobStartRequest | null =>
    fixJobRequest({ ...input, providerId: selectedProvider, model }), [selectedProvider, model]);

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
    editBudget,
    setEditBudget,
    seamlessLoop,
    setSeamlessLoop,
    referenceImages,
    setReferenceImages,
    buildBuildJob,
    buildEditJob,
    buildFixJob,
  };
}
