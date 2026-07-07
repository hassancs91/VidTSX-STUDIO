import { useState, useEffect, useCallback, useRef } from 'react';
import type { LlmProviderConfig, LlmImageIpc } from '../../../shared/ipc/types';
import { generateTsxPipeline, editTsxPipeline } from '@shared/tsx-engine';
import type { ThinkingLevel, TsxPipelineResult, PipelineProgress } from '@shared/tsx-engine';
import type { ColorPalette, AspectRatio } from '../types';
import { COLOR_PALETTES, ASPECT_RATIO_OPTIONS } from '../types';

export type { ThinkingLevel } from '@shared/tsx-engine';

export function useMotionGenerator() {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [output, setOutput] = useState<TsxPipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const cancelledRef = useRef(false);

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

  const generate = useCallback(async (): Promise<TsxPipelineResult | null> => {
    if (!prompt.trim() || !selectedProvider) return null;

    setLoading(true);
    setError(null);
    setOutput(null);
    setProgress(null);
    cancelledRef.current = false;

    try {
      const paletteEntry = COLOR_PALETTES.find((p) => p.value === colorPalette);
      const extraInstructions = paletteEntry && paletteEntry.colors.length > 0
        ? `Use this color palette: ${paletteEntry.colors.join(', ')}. Base the visual design around these colors.`
        : undefined;

      const ratioOption = ASPECT_RATIO_OPTIONS.find((o) => o.value === aspectRatio);

      const result = await generateTsxPipeline({
        prompt: prompt.trim(),
        providerId: selectedProvider,
        thinkingLevel,
        maxTurns: loopCount,
        optimize,
        onProgress: setProgress,
        promptContext: {
          fps,
          videoWidth: ratioOption?.width ?? 1920,
          videoHeight: ratioOption?.height ?? 1080,
          ...(autoDuration ? {} : { durationSeconds: duration }),
          ...(extraInstructions ? { extraInstructions } : {}),
        },
        ...(referenceImages.length > 0 ? { images: referenceImages } : {}),
      });
      setOutput(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMsg);
      setOutput({
        text: '',
        model: 'unknown',
        durationMs: 0,
        debugLog: [`Error: ${errorMsg}`],
        steps: [],
        mode: '2d',
        verified: false,
        transpileValid: false,
        fixAttempts: 0,
      });
      return null;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [prompt, selectedProvider, thinkingLevel, loopCount, optimize, fps, colorPalette, aspectRatio, duration, autoDuration, referenceImages]);

  const regenerate = useCallback(async (currentCode: string): Promise<TsxPipelineResult | null> => {
    if (!editPrompt.trim() || !selectedProvider || !currentCode) return null;

    setLoading(true);
    setError(null);
    setOutput(null);
    setProgress(null);
    cancelledRef.current = false;

    try {
      const result = await editTsxPipeline({
        currentCode,
        editInstruction: editPrompt.trim(),
        providerId: selectedProvider,
        thinkingLevel,
        maxTurns: loopCount,
        onProgress: setProgress,
        ...(referenceImages.length > 0 ? { images: referenceImages } : {}),
      });
      setOutput(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Regeneration failed';
      setError(errorMsg);
      setOutput({
        text: '',
        model: 'unknown',
        durationMs: 0,
        debugLog: [`Error: ${errorMsg}`],
        steps: [],
        mode: '2d',
        verified: false,
        transpileValid: false,
        fixAttempts: 0,
      });
      return null;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [editPrompt, selectedProvider, thinkingLevel, loopCount, referenceImages]);

  const fix = useCallback(async (
    currentCode: string,
    errorMessage: string,
    errorLocation?: { line: number; column: number; file: string },
  ): Promise<TsxPipelineResult | null> => {
    if (!selectedProvider || !currentCode || !errorMessage) return null;

    setLoading(true);
    setError(null);
    setOutput(null);
    setProgress(null);
    cancelledRef.current = false;

    const locationInfo = errorLocation
      ? ` at line ${errorLocation.line}, column ${errorLocation.column}`
      : '';
    const fixInstruction =
      `The current TSX composition fails with the following error${locationInfo}:\n\n` +
      `${errorMessage}\n\n` +
      `Fix the error. Make the minimal changes needed to resolve the issue ` +
      `while preserving the intended visual design and behavior.`;

    try {
      const result = await editTsxPipeline({
        currentCode,
        editInstruction: fixInstruction,
        providerId: selectedProvider,
        thinkingLevel,
        maxTurns: loopCount,
        onProgress: setProgress,
      });
      setOutput(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fix failed';
      setError(errorMsg);
      setOutput({
        text: '',
        model: 'unknown',
        durationMs: 0,
        debugLog: [`Error: ${errorMsg}`],
        steps: [],
        mode: '2d',
        verified: false,
        transpileValid: false,
        fixAttempts: 0,
      });
      return null;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [selectedProvider, thinkingLevel, loopCount]);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    try {
      await window.api.llmCancel();
    } catch {
      // Ignore cancel errors
    }
    setLoading(false);
    setProgress(null);
    setError('Generation cancelled');
  }, []);

  return {
    prompt,
    setPrompt,
    editPrompt,
    setEditPrompt,
    output,
    setOutput,
    loading,
    error,
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
    progress,
    generate,
    regenerate,
    fix,
    cancel,
  };
}
