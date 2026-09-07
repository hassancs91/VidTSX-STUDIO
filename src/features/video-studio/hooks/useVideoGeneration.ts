import { useState, useCallback } from 'react';
import { contentSafetyBlockMessage } from '@shared/content-safety';
import type { VideoGenerateRequest, VideoMediaInputIpc } from '@shared/ipc/types';
import type { VideoGenerationSettings, VideoJobSeed } from '../types';

interface UseVideoGenerationOptions {
  activeFolderId?: string | null;
  /** Register the returned job so a card appears for it. */
  onJobSubmitted: (jobId: string, seed: VideoJobSeed) => void;
}

function pathInputs(paths: string[] | undefined): VideoMediaInputIpc[] | undefined {
  if (!paths?.length) return undefined;
  return paths.map((value) => ({ kind: 'path', value }));
}

function base64Inputs(images: string[] | undefined): VideoMediaInputIpc[] | undefined {
  if (!images?.length) return undefined;
  return images.map((value) => ({ kind: 'base64', value }));
}

/**
 * Submits a job and hands the id to the job list. Everything after the submit
 * (progress, the finished clip, Content Safety on the output) arrives on the
 * `video:job-progress` push, so this hook is done once the id is back.
 */
export function useVideoGeneration({ activeFolderId, onJobSubmitted }: UseVideoGenerationOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (settings: VideoGenerationSettings) => {
      const usingReferences = settings.mode === 'reference';
      const request: VideoGenerateRequest = {
        prompt: settings.prompt,
        model: settings.model,
        providerId: settings.providerId,
        durationSeconds: settings.durationSeconds,
        aspectRatio: settings.aspectRatio,
        generateAudio: settings.generateAudio,
        folderId: activeFolderId ?? null,
        featureSource: 'video-studio',
        ...(settings.resolution ? { resolution: settings.resolution } : {}),
        // Frames and references are mutually exclusive on both providers, so
        // only the active mode's media is sent — the engine would drop the
        // other set anyway, and sending it would misreport what was used.
        ...(settings.mode === 'frames' && settings.firstFrame
          ? { firstFrame: settings.firstFrame }
          : {}),
        ...(settings.mode === 'frames' && settings.lastFrame
          ? { lastFrame: settings.lastFrame }
          : {}),
        ...(usingReferences
          ? {
              references: {
                ...(base64Inputs(settings.referenceImages)
                  ? { images: base64Inputs(settings.referenceImages) }
                  : {}),
                ...(pathInputs(settings.referenceVideoPaths)
                  ? { videos: pathInputs(settings.referenceVideoPaths) }
                  : {}),
                ...(pathInputs(settings.referenceAudioPaths)
                  ? { audios: pathInputs(settings.referenceAudioPaths) }
                  : {}),
              },
            }
          : {}),
      };

      setIsSubmitting(true);
      setError(null);
      try {
        const result = await window.api.videoGenerate(request);
        if (!result.success) {
          // The block copy is the authority on what to tell the user; the raw
          // error is a fallback for everything else (auth, quota, network).
          setError(result.blocked ? contentSafetyBlockMessage(result.blocked) : result.error);
          return null;
        }
        onJobSubmitted(result.data.jobId, {
          prompt: settings.prompt,
          model: settings.model,
          providerId: settings.providerId,
          durationSeconds: settings.durationSeconds,
        });
        return result.data.jobId;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Video generation failed');
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeFolderId, onJobSubmitted],
  );

  return { generate, isSubmitting, error, clearError: useCallback(() => setError(null), []) };
}
