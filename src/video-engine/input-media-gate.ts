import { normalizeVideoRequest } from './normalize';
import { resolveMediaInput } from './media-input';
import type {
  ProviderMediaInput,
  VideoGenerationRequest,
  VideoModelInfo,
  VideoProvider,
  VideoProviderRequest,
  VideoSafetyGuard,
} from './types';

interface PrepareInput {
  model: VideoModelInfo;
  request: VideoGenerationRequest;
  guard: VideoSafetyGuard;
  provider: VideoProvider;
}

/**
 * Everything that happens to a caller's media between the engine chokepoint
 * and the provider call, in the one order that keeps the gates meaningful:
 *
 * 1. resolve paths to bytes and clamp the request to the model,
 * 2. Gate B every input image, and sample every reference clip — nothing
 *    ungated ever reaches a provider, and no sampler means no reference
 *    videos at all (fail-closed),
 * 3. only then host what cannot travel inline (reference video everywhere,
 *    audio on fal), so a blocked clip is never uploaded anywhere.
 */
export async function prepareInputMedia({
  model,
  request,
  guard,
  provider,
}: PrepareInput): Promise<VideoProviderRequest> {
  const normalized = normalizeVideoRequest(model, request, {
    ...(request.firstFrame ? { firstFrame: await resolveMediaInput(request.firstFrame) } : {}),
    ...(request.lastFrame ? { lastFrame: await resolveMediaInput(request.lastFrame) } : {}),
    referenceImages: await Promise.all((request.references?.images ?? []).map(resolveMediaInput)),
    referenceVideos: await Promise.all((request.references?.videos ?? []).map(resolveMediaInput)),
    referenceAudios: await Promise.all((request.references?.audios ?? []).map(resolveMediaInput)),
  });

  // Gate B on inputs — also keeps NSFW source images off cloud APIs.
  for (const image of [
    normalized.firstFrame,
    normalized.lastFrame,
    ...(normalized.referenceImages ?? []),
  ]) {
    if (image) await guard.checkImage(image, 'input');
  }

  // Reference clips go through the same frame classifier the output does.
  for (const video of normalized.referenceVideos ?? []) {
    if (!guard.checkVideo) {
      throw new Error(
        'Content Safety cannot check reference videos, so they are blocked (fail-closed).',
      );
    }
    await guard.checkVideo(video, 'input');
  }

  await hostReferenceMedia(provider, normalized);
  return normalized;
}

/**
 * Reference videos (and audio on fal) are too large to inline, so the provider
 * hosts them and the request carries URLs from here on. A provider with no
 * uploader keeps what it was given — it declared it can take it.
 */
async function hostReferenceMedia(
  provider: VideoProvider,
  normalized: VideoProviderRequest,
): Promise<void> {
  const host = async (
    items: ProviderMediaInput[] | undefined,
    kind: 'video' | 'audio',
  ): Promise<ProviderMediaInput[] | undefined> => {
    if (!items?.length || !provider.uploadMedia) return items;
    return Promise.all(items.map((item) => provider.uploadMedia!(item, kind, normalized.signal)));
  };
  const videos = await host(normalized.referenceVideos, 'video');
  if (videos) normalized.referenceVideos = videos;
  const audios = await host(normalized.referenceAudios, 'audio');
  if (audios) normalized.referenceAudios = audios;
}
