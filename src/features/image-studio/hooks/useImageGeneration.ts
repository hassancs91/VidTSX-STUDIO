import { useState, useCallback } from 'react';
import type { ImageStudioEntry, ImageOperationType } from '../../../shared/ipc/types';
import type { GenerationSettings, PendingGeneration } from '../types';
import { ASPECT_RATIOS } from '../services/aspect-ratios';

interface UseImageGenerationOptions {
  onImageSaved: (entry: ImageStudioEntry) => void;
  activeFolderId?: string | null;
}

const MODE_TO_OPERATION: Record<string, ImageOperationType> = {
  generate: 'text-to-image',
  edit: 'image-to-image',
  reference: 'multi-reference',
};

export function useImageGeneration({ onImageSaved, activeFolderId }: UseImageGenerationOptions) {
  const [pending, setPending] = useState<PendingGeneration[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (settings: GenerationSettings) => {
    const { width, height } = ASPECT_RATIOS[settings.aspectRatio];
    const operation = MODE_TO_OPERATION[settings.mode];

    // Validate inputs for edit/reference modes
    if (settings.mode === 'edit' && !settings.sourceImage) {
      setError('Please add a source image for editing');
      return;
    }
    if (settings.mode === 'reference' && (!settings.referenceImages || settings.referenceImages.length === 0)) {
      setError('Please add at least one reference image');
      return;
    }

    // Create pending placeholders
    const pendingItems: PendingGeneration[] = Array.from(
      { length: settings.numImages },
      (_, i) => ({
        tempId: `pending-${Date.now()}-${i}`,
        width,
        height,
      })
    );

    setPending(pendingItems);
    setIsGenerating(true);
    setError(null);

    try {
      const result = await window.api.imageGenerate({
        operation,
        prompt: settings.prompt,
        model: settings.model,
        width,
        height,
        numImages: settings.numImages,
        sourceImage: settings.mode === 'edit' ? settings.sourceImage : undefined,
        referenceImages: settings.mode === 'reference' ? settings.referenceImages : undefined,
        params: settings.params,
      });

      if (!result.success || !result.images) {
        throw new Error(result.error || 'Generation failed');
      }

      // Save each image and notify gallery
      for (let i = 0; i < result.images.length; i++) {
        const img = result.images[i];
        const saveResult = await window.api.imageStudioSave({
          base64: img.base64,
          prompt: settings.prompt,
          model: result.model || settings.model,
          width: img.width,
          height: img.height,
          contentType: img.contentType,
          durationMs: result.durationMs || 0,
          folderId: activeFolderId ?? null,
        });

        if (saveResult.success && saveResult.entry) {
          onImageSaved(saveResult.entry);
        } else {
          setError(saveResult.error || 'Failed to save generated image');
        }

        // Remove corresponding pending item
        setPending((prev) => prev.slice(1));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
    } finally {
      setPending([]);
      setIsGenerating(false);
    }
  }, [onImageSaved, activeFolderId]);

  return {
    pending,
    isGenerating,
    error,
    generate,
    clearError: () => setError(null),
  };
}
