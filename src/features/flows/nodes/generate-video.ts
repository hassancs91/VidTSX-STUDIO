import {
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
} from '@shared/presets/video-models';
import type { VideoMediaInputIpc } from '@shared/ipc/types';
import type { NodeTypeDefinition } from './types';

interface Config extends Record<string, unknown> {
  providerId: string;
  model: string;
  aspectRatio: string;
  durationSeconds: string;
  resolution: string;
  generateAudio: 'on' | 'off';
  seed: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 10 * 60 * 1000;

// The model list is no longer a static union: the picker reads it from the
// engine, so a catalog edit or a second provider shows up without a rebuild.
// These two lists stay as the raw choices; the engine clamps each to what the
// selected model accepts (nearest duration, allowed aspect).
const ASPECT_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map((a) => ({
  value: a,
  label: a,
}));

const DURATION_OPTIONS = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30].map((d) => ({
  value: String(d),
  label: `${d}s`,
}));

const RESOLUTION_OPTIONS = [
  { value: '', label: 'Model default' },
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
];

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Reference lists arrive as a comma/newline separated list of paths or URLs. */
function asMediaList(v: unknown): VideoMediaInputIpc[] | undefined {
  const items = Array.isArray(v)
    ? v.filter((item): item is string => typeof item === 'string')
    : typeof v === 'string'
      ? v.split(/[\n,]/)
      : [];
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) return undefined;
  return cleaned.map((value) =>
    /^https?:\/\//i.test(value)
      ? { kind: 'url' as const, value }
      : /^[a-zA-Z]:[\\/]|^[\\/]/.test(value)
        ? { kind: 'path' as const, value }
        : { kind: 'base64' as const, value },
  );
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('Aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export const generateVideoNode: NodeTypeDefinition<Config> = {
  typeId: 'generate-video',
  label: 'Generate Video',
  description:
    'Generate a video from a prompt with a cloud video model (fal or BytePlus ModelArk — Seedance, Kling, Veo). Requires that provider key in AI → Providers.',
  category: 'generate',
  inputs: [
    { id: 'prompt', label: 'Prompt', dataType: 'text', required: true },
    { id: 'firstFrame', label: 'First frame', dataType: 'image' },
    { id: 'lastFrame', label: 'Last frame', dataType: 'image' },
    { id: 'referenceImages', label: 'Reference images', dataType: 'images' },
    { id: 'referenceVideo', label: 'Reference video', dataType: 'video' },
    { id: 'referenceAudio', label: 'Reference audio', dataType: 'text' },
  ],
  outputs: [{ id: 'video', label: 'Video', dataType: 'video' }],
  defaultConfig: {
    providerId: '',
    model: DEFAULT_VIDEO_MODEL,
    aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
    durationSeconds: String(DEFAULT_VIDEO_DURATION),
    resolution: '',
    generateAudio: 'off',
    seed: '',
  },
  configSchema: [
    { kind: 'video-model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
    { kind: 'select', key: 'aspectRatio', label: 'Aspect ratio', options: ASPECT_OPTIONS },
    { kind: 'select', key: 'durationSeconds', label: 'Duration (s)', options: DURATION_OPTIONS },
    { kind: 'select', key: 'resolution', label: 'Resolution', options: RESOLUTION_OPTIONS },
    {
      kind: 'select',
      key: 'generateAudio',
      label: 'Generate audio',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On (Seedance / Veo / WAN)' },
      ],
    },
    { kind: 'text', key: 'seed', label: 'Seed (optional)', placeholder: 'leave blank for random' },
  ],
  async execute(inputs, config, ctx) {
    const prompt = asString(inputs.prompt);
    if (!prompt) {
      throw new Error('No prompt provided. Connect a Prompt node to the prompt input.');
    }

    const firstFrame = asString(inputs.firstFrame);
    const lastFrame = asString(inputs.lastFrame);
    if (lastFrame && !firstFrame) {
      throw new Error('A last frame requires a first frame as well.');
    }

    const referenceImages = asMediaList(inputs.referenceImages);
    const referenceVideos = asMediaList(inputs.referenceVideo);
    const referenceAudios = asMediaList(inputs.referenceAudio);
    const references =
      referenceImages || referenceVideos || referenceAudios
        ? {
            ...(referenceImages ? { images: referenceImages } : {}),
            ...(referenceVideos ? { videos: referenceVideos } : {}),
            ...(referenceAudios ? { audios: referenceAudios } : {}),
          }
        : undefined;

    const seedRaw = asString(config.seed);
    const seed = seedRaw !== undefined && Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : undefined;

    // The engine clamps duration / aspect / resolution / audio to what the
    // chosen model accepts, so the node passes the raw choice through.
    const submit = await window.api.videoGenerate({
      prompt,
      model: config.model,
      aspectRatio: config.aspectRatio,
      durationSeconds: Number(config.durationSeconds) || DEFAULT_VIDEO_DURATION,
      generateAudio: config.generateAudio === 'on',
      seed,
      firstFrame,
      lastFrame,
      folderId: ctx.flowFolderId,
      ...(config.providerId ? { providerId: config.providerId } : {}),
      ...(config.resolution ? { resolution: config.resolution } : {}),
      ...(references ? { references } : {}),
    });

    if (!submit.success) {
      throw new Error(submit.error);
    }

    const { jobId } = submit.data;
    const start = Date.now();

    // Async polling loop — cloud video jobs take 30s–5min. AbortSignal stops
    // the loop on cancel; the server-side job keeps running but we abandon it.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (ctx.signal.aborted) {
        throw new Error('Aborted');
      }
      if (Date.now() - start > MAX_WAIT_MS) {
        throw new Error('Video generation timed out after 10 minutes.');
      }

      await wait(POLL_INTERVAL_MS, ctx.signal);

      const poll = await window.api.videoGetJob(jobId);
      if (!poll.success) {
        throw new Error(poll.error);
      }

      const job = poll.data;
      if (job.status === 'completed') {
        if (!job.videoUrl) {
          throw new Error('Video job completed but no URL was returned.');
        }
        // The engine already downloaded, gated and filed the clip in Video
        // Studio, so the URL here is the local one and the entry exists.
        if (job.entry) {
          window.dispatchEvent(new CustomEvent('vidtsx:video-studio:refresh'));
        }
        return {
          video: job.videoUrl,
          videoRef: job.entry?.id,
          durationSeconds: job.durationSeconds,
        };
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        throw new Error(job.error || 'Video generation failed.');
      }
    }
  },
};
