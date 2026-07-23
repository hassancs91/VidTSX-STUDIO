import { useState, useEffect, useCallback } from 'react';
import type { LlmProviderConfig, LlmImageIpc, TsxJobStartRequest } from '../../../shared/ipc/types';
import type { ThinkingLevel } from '@shared/tsx-engine';
import type { ColorPalette, AspectRatio } from '../types';
import { COLOR_PALETTES, ASPECT_RATIO_OPTIONS } from '../types';

export type { ThinkingLevel } from '@shared/tsx-engine';

/**
 * Generation options state for the Creator screen. Since generations run as
 * jobs in the main process (TsxJobEngine), this hook no longer executes
 * anything — it holds the input state and builds TsxJobStartRequest payloads.
 */
export function useMotionGenerator() {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('off');
  const [loopCount, setLoopCount] = useState(1);
  const [fps, setFps] = useState(30);
  const [colorPalette, setColorPalette] = useState<ColorPalette>('custom');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState(5);
  const [autoDuration, setAutoDuration] = useState(true);
  const [optimize, setOptimize] = useState(true);
  const [referenceImages, setReferenceImages] = useState<LlmImageIpc[]>([]);

  const loadProviders = useCallback(async () => {
    try {
      const result = await window.api.llmProvidersGet();
      const enabled = result.providers.filter((p) => p.enabled);
      setProviders(enabled);
      // Preserve user's current selection if still enabled; otherwise fall back
      // to the backend-active provider, then the first enabled one.
      setSelectedProvider((current) => {
        if (current && enabled.some((p) => p.id === current)) return current;
        return result.activeProvider || (enabled.length > 0 ? enabled[0].id : '');
      });
    } catch {
      // Silently fail
    }
  }, []);

  // Load enabled providers on mount
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // Refresh when provider config changes elsewhere (e.g. Settings screen).
  useEffect(() => {
    const handler = () => {
      loadProviders();
    };
    window.addEventListener('vidtsx:llm-providers-changed', handler);
    return () => window.removeEventListener('vidtsx:llm-providers-changed', handler);
  }, [loadProviders]);

  const buildGenerateJob = useCallback((): TsxJobStartRequest | null => {
    if (!prompt.trim() || !selectedProvider) return null;

    const paletteEntry = COLOR_PALETTES.find((p) => p.value === colorPalette);
    const extraInstructions = paletteEntry && paletteEntry.colors.length > 0
      ? `Use this color palette: ${paletteEntry.colors.join(', ')}. Base the visual design around these colors.`
      : undefined;

    const ratioOption = ASPECT_RATIO_OPTIONS.find((o) => o.value === aspectRatio);

    return {
      kind: 'generate',
      prompt: prompt.trim(),
      providerId: selectedProvider,
      options: {
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
  }, [prompt, selectedProvider, thinkingLevel, loopCount, optimize, fps, colorPalette, aspectRatio, duration, autoDuration, referenceImages]);

  const buildEditJob = useCallback((currentCode: string, folderPath: string): TsxJobStartRequest | null => {
    if (!editPrompt.trim() || !selectedProvider || !currentCode) return null;

    return {
      kind: 'edit',
      prompt: editPrompt.trim(),
      providerId: selectedProvider,
      options: {
        thinkingLevel,
        maxTurns: loopCount,
        ...(referenceImages.length > 0 ? { images: referenceImages } : {}),
      },
      target: { folderPath, currentCode },
    };
  }, [editPrompt, selectedProvider, thinkingLevel, loopCount, referenceImages]);

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
      options: { thinkingLevel, maxTurns: loopCount },
      target: { folderPath, currentCode },
    };
  }, [selectedProvider, thinkingLevel, loopCount]);

  return {
    prompt,
    setPrompt,
    editPrompt,
    setEditPrompt,
    providers,
    selectedProvider,
    setSelectedProvider,
    thinkingLevel,
    setThinkingLevel,
    loopCount,
    setLoopCount,
    fps,
    setFps,
    colorPalette,
    setColorPalette,
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
