import type { VideoModelCatalogEntry } from '../../shared/presets/video-models';
import type { VideoGenerateRequest } from '../../shared/ipc/types/video';

export interface BuiltVideoPayload {
  endpoint: string;
  body: Record<string, unknown>;
}

function detectImageContentType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

/** fal accepts data URIs anywhere an image_url is expected. */
function toImageUrl(value: string): string {
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `data:${detectImageContentType(value)};base64,${value}`;
}

/**
 * Build the per-model fal request body. Each fal video model speaks its own
 * parameter dialect (duration as "5" vs "8s", resolution fields, frame-image
 * key names) — this is the only file that knows those differences.
 */
export function buildVideoPayload(
  model: VideoModelCatalogEntry,
  req: VideoGenerateRequest,
): BuiltVideoPayload {
  const hasFirstFrame = !!req.firstFrame;
  const endpoint =
    hasFirstFrame && model.imageToVideoEndpoint
      ? model.imageToVideoEndpoint
      : model.textToVideoEndpoint;

  const body: Record<string, unknown> = { prompt: req.prompt };

  switch (model.id) {
    case 'kling-2.5-turbo-pro': {
      body.duration = String(req.durationSeconds);
      body.aspect_ratio = req.aspectRatio;
      if (hasFirstFrame) {
        body.image_url = toImageUrl(req.firstFrame!);
        if (req.lastFrame) body.tail_image_url = toImageUrl(req.lastFrame);
      }
      break;
    }
    case 'veo-3-fast': {
      body.duration = `${req.durationSeconds}s`;
      body.aspect_ratio = req.aspectRatio;
      body.generate_audio = req.generateAudio ?? false;
      if (req.seed !== undefined) body.seed = req.seed;
      if (hasFirstFrame) body.image_url = toImageUrl(req.firstFrame!);
      break;
    }
    case 'wan-2.5': {
      body.duration = String(req.durationSeconds);
      body.aspect_ratio = req.aspectRatio;
      body.resolution = '720p';
      if (req.generateAudio === false) body.enable_audio = false;
      if (req.seed !== undefined) body.seed = req.seed;
      if (hasFirstFrame) body.image_url = toImageUrl(req.firstFrame!);
      break;
    }
    case 'hailuo-02': {
      body.duration = String(req.durationSeconds);
      if (hasFirstFrame) body.image_url = toImageUrl(req.firstFrame!);
      break;
    }
    case 'seedance-1-lite': {
      body.duration = String(req.durationSeconds);
      body.aspect_ratio = req.aspectRatio;
      body.resolution = '720p';
      if (req.seed !== undefined) body.seed = req.seed;
      if (hasFirstFrame) {
        body.image_url = toImageUrl(req.firstFrame!);
        if (req.lastFrame) body.end_image_url = toImageUrl(req.lastFrame);
      }
      break;
    }
    default: {
      // Unknown catalog entry — send the common denominator.
      body.duration = String(req.durationSeconds);
      body.aspect_ratio = req.aspectRatio;
      if (hasFirstFrame) body.image_url = toImageUrl(req.firstFrame!);
      break;
    }
  }

  return { endpoint, body };
}
