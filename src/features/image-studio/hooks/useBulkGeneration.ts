import { useState, useCallback, useRef } from 'react';
import type { ImageStudioEntry } from '../../../shared/ipc/types';
import type { AspectRatioPreset } from '../types';
import { ASPECT_RATIOS } from '../services/aspect-ratios';
import { STYLE_PRESETS, CONTENT_PRESETS } from '../services/style-presets';

export type BulkJobStatus = 'pending' | 'generating' | 'done' | 'error';

export interface BulkJob {
  id: string;
  prompt: string;
  status: BulkJobStatus;
  images: ImageStudioEntry[];
  error?: string;
}

export interface BulkSettings {
  model: string;
  stylePreset?: string;
  contentPreset?: string;
  numImages: number;
  aspectRatio: AspectRatioPreset;
  referenceImages?: string[];
}

interface UseBulkGenerationOptions {
  onImageSaved: (entry: ImageStudioEntry) => void;
  settings: BulkSettings;
  prompts: string[];
  concurrency: number;
  activeFolderId?: string | null;
}

function buildBulkPrompt(prompt: string, stylePresetId?: string, contentPresetId?: string): string {
  const parts: string[] = [prompt];
  if (contentPresetId) {
    const preset = CONTENT_PRESETS.find((p) => p.id === contentPresetId);
    if (preset) parts.push(preset.promptSuffix);
  }
  if (stylePresetId) {
    const preset = STYLE_PRESETS.find((p) => p.id === stylePresetId);
    if (preset) parts.push(preset.promptSuffix);
  }
  return parts.join(', ');
}

export function useBulkGeneration({ onImageSaved, settings, prompts, concurrency, activeFolderId }: UseBulkGenerationOptions) {
  const [jobs, setJobs] = useState<BulkJob[]>(() =>
    prompts.map((prompt, i) => ({
      id: `bulk-${Date.now()}-${i}`,
      prompt,
      status: 'pending' as BulkJobStatus,
      images: [],
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);
  const runningCountRef = useRef(0);
  const pendingQueueRef = useRef<number[]>([]);

  const start = useCallback(async () => {
    if (prompts.length === 0) return;

    abortRef.current = false;
    runningCountRef.current = 0;
    pendingQueueRef.current = prompts.map((_, i) => i);

    // Reset all jobs to pending
    setJobs(prompts.map((prompt, i) => ({
      id: `bulk-${Date.now()}-${i}`,
      prompt,
      status: 'pending' as BulkJobStatus,
      images: [],
    })));
    setIsRunning(true);

    const { width, height } = ASPECT_RATIOS[settings.aspectRatio];
    const hasReferences = settings.referenceImages && settings.referenceImages.length > 0;
    const operation = hasReferences ? 'multi-reference' : 'text-to-image';

    const runJob = async (index: number) => {
      if (abortRef.current) return;

      runningCountRef.current++;
      const prompt = prompts[index];

      setJobs((prev) =>
        prev.map((j, i) => (i === index ? { ...j, status: 'generating' as BulkJobStatus } : j))
      );

      try {
        const result = await window.api.imageGenerate({
          operation,
          prompt: buildBulkPrompt(prompt, settings.stylePreset, settings.contentPreset),
          model: settings.model,
          width,
          height,
          numImages: settings.numImages,
          referenceImages: hasReferences ? settings.referenceImages : undefined,
        });

        if (abortRef.current) return;

        if (!result.success || !result.images) {
          setJobs((prev) =>
            prev.map((j, i) =>
              i === index ? { ...j, status: 'error' as BulkJobStatus, error: result.error || 'Generation failed' } : j
            )
          );
          return;
        }

        const savedImages: ImageStudioEntry[] = [];
        for (const img of result.images) {
          const saveResult = await window.api.imageStudioSave({
            base64: img.base64,
            prompt,
            model: result.model || settings.model,
            width: img.width,
            height: img.height,
            contentType: img.contentType,
            durationMs: result.durationMs || 0,
            folderId: activeFolderId ?? null,
          });
          if (saveResult.success && saveResult.entry) {
            savedImages.push(saveResult.entry);
            onImageSaved(saveResult.entry);
          }
        }

        setJobs((prev) =>
          prev.map((j, i) =>
            i === index ? { ...j, status: 'done' as BulkJobStatus, images: savedImages } : j
          )
        );
      } catch (err) {
        if (abortRef.current) return;
        const error = err instanceof Error ? err.message : 'Generation failed';
        setJobs((prev) =>
          prev.map((j, i) =>
            i === index ? { ...j, status: 'error' as BulkJobStatus, error } : j
          )
        );
      } finally {
        runningCountRef.current--;
        processNext();
      }
    };

    const processNext = () => {
      if (abortRef.current) {
        if (runningCountRef.current === 0) setIsRunning(false);
        return;
      }

      while (pendingQueueRef.current.length > 0 && runningCountRef.current < concurrency) {
        const nextIndex = pendingQueueRef.current.shift()!;
        runJob(nextIndex);
      }

      if (runningCountRef.current === 0 && pendingQueueRef.current.length === 0) {
        setIsRunning(false);
      }
    };

    // Kick off initial batch
    processNext();
  }, [prompts, settings, concurrency, onImageSaved, activeFolderId]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  const resetJobs = useCallback(() => {
    setJobs(prompts.map((prompt, i) => ({
      id: `bulk-${Date.now()}-${i}`,
      prompt,
      status: 'pending' as BulkJobStatus,
      images: [],
    })));
  }, [prompts]);

  const totalImages = jobs.reduce((acc, j) => acc + j.images.length, 0);
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const errorCount = jobs.filter((j) => j.status === 'error').length;
  const completedCount = doneCount + errorCount;
  const totalProgress = {
    prompts: completedCount,
    done: doneCount,
    errors: errorCount,
    images: totalImages,
    percent: jobs.length > 0 ? Math.round((completedCount / jobs.length) * 100) : 0,
  };

  return {
    jobs,
    isRunning,
    totalProgress,
    start,
    cancel,
    resetJobs,
  };
}
