import {
  VIDEO_MODEL_CATALOG,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  coerceVideoModel,
  coerceVideoDuration,
  coerceVideoAspect,
} from '@shared/presets/video-models';
import type { NodeTypeDefinition } from './types';

interface Config extends Record<string, unknown> {
  model: string;
  aspectRatio: string;
  durationSeconds: string;
  generateAudio: 'on' | 'off';
  seed: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 10 * 60 * 1000;

// Picker options derived from the catalog (single source of truth). The lists
// offer the union across models; coerceVideoDuration/coerceVideoAspect narrow
// to what the selected model accepts at submit time.
const MODEL_OPTIONS = VIDEO_MODEL_CATALOG.map((m) => ({
  value: m.id,
  label: `${m.name} (${m.tagline})`,
}));

const ALL_ASPECTS = [...new Set(VIDEO_MODEL_CATALOG.flatMap((m) => m.allowedAspectRatios))];
const ASPECT_OPTIONS = ALL_ASPECTS.map((a) => ({ value: a, label: a }));

const ALL_DURATIONS = [...new Set(VIDEO_MODEL_CATALOG.flatMap((m) => m.allowedDurations))].sort(
  (a, b) => a - b,
);
const DURATION_OPTIONS = ALL_DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }));

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
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
    'Generate a video from a prompt using fal.ai video models (Kling, Veo, WAN, Hailuo, Seedance). Requires a Fal API key in Settings.',
  category: 'generate',
  inputs: [
    { id: 'prompt', label: 'Prompt', dataType: 'text', required: true },
    { id: 'firstFrame', label: 'First frame', dataType: 'image' },
    { id: 'lastFrame', label: 'Last frame', dataType: 'image' },
  ],
  outputs: [{ id: 'video', label: 'Video', dataType: 'video' }],
  defaultConfig: {
    model: DEFAULT_VIDEO_MODEL,
    aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
    durationSeconds: String(DEFAULT_VIDEO_DURATION),
    generateAudio: 'off',
    seed: '',
  },
  configSchema: [
    {
      kind: 'select',
      key: 'model',
      label: 'Model',
      options: MODEL_OPTIONS,
    },
    {
      kind: 'select',
      key: 'aspectRatio',
      label: 'Aspect ratio',
      options: ASPECT_OPTIONS,
    },
    {
      kind: 'select',
      key: 'durationSeconds',
      label: 'Duration (s)',
      options: DURATION_OPTIONS,
    },
    {
      kind: 'select',
      key: 'generateAudio',
      label: 'Generate audio',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On (Veo / WAN only)' },
      ],
    },
    { kind: 'text', key: 'seed', label: 'Seed (optional)', placeholder: 'leave blank for random' },
  ],
  async execute(inputs, config, ctx) {
    const prompt = asString(inputs.prompt);
    if (!prompt) {
      throw new Error('No prompt provided. Connect a Prompt node to the prompt input.');
    }

    // Legacy saved flows may carry removed model ids (vidtsx-video-*) —
    // coerce onto the catalog so old graphs still run.
    const model = coerceVideoModel(config.model);
    const durationSeconds = coerceVideoDuration(model.id, Number(config.durationSeconds));
    const aspectRatio = coerceVideoAspect(model.id, config.aspectRatio);

    const firstFrame = asString(inputs.firstFrame);
    const lastFrame = asString(inputs.lastFrame);
    if (lastFrame && !model.supportsLastFrame) {
      throw new Error(`${model.name} does not support a last frame. Disconnect it or pick another model.`);
    }
    if (lastFrame && !firstFrame) {
      throw new Error('A last frame requires a first frame as well.');
    }

    const seedRaw = asString(config.seed);
    const seed = seedRaw !== undefined && Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : undefined;

    const submit = await window.api.videoGenerate({
      prompt,
      model: model.id,
      aspectRatio,
      durationSeconds,
      generateAudio: config.generateAudio === 'on',
      seed,
      firstFrame,
      lastFrame,
    });

    if (!submit.success) {
      throw new Error(submit.error);
    }

    const { jobId } = submit.data;
    const start = Date.now();

    // Async polling loop — fal video jobs take 30s–5min. AbortSignal stops
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

        // Persist to Video Studio: main process downloads the video to
        // userData/video-studio/videos/ and indexes it in SQLite. Save errors
        // are non-fatal — the remote URL still works for this render.
        let videoRef: string | undefined;
        try {
          const save = await window.api.videoStudioSave({
            url: job.videoUrl,
            prompt,
            model: job.modelUsed ?? model.id,
            aspectRatio: job.aspectRatio ?? aspectRatio,
            durationSeconds: job.durationSeconds,
            hasAudio: job.hasAudio,
            folderId: ctx.flowFolderId,
          });
          if (save.success && save.entry) {
            videoRef = save.entry.id;
            window.dispatchEvent(new CustomEvent('vidtsx:video-studio:refresh'));
          }
        } catch {
          // Best-effort — fall through with remote URL only.
        }

        return {
          video: job.videoUrl,
          videoRef,
          durationSeconds: job.durationSeconds,
        };
      }
      if (job.status === 'failed') {
        throw new Error(job.error || 'Video generation failed.');
      }
    }
  },
};
