import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { pathToFileURL } from 'url';
import type { InstalledModel } from '../../shared/model-library/types';
import type {
  VideoGenerationProgress,
  VideoGenerationRequest as LocalVideoRequest,
  VideoGenerationResult as LocalVideoResult,
  VideoModelMeta,
} from '../../local-video-engine/types';
import type {
  ProviderMediaInput,
  VideoJobProgress,
  VideoModelInfo,
  VideoPollResult,
  VideoProvider,
  VideoProviderRequest,
} from '../types';
import { VideoEngineError } from '../types';
import { framesForDuration, LOCAL_VIDEO_ASPECTS, LOCAL_VIDEO_DURATIONS, sizeForAspect } from './local-video-request';

/** The slice of the local sd-cli video engine this provider drives (injected, so tests need no Electron). */
export interface LocalVideoEngineLike {
  isSdCliAvailable(): boolean;
  getAvailableModels(): InstalledModel<VideoModelMeta>[];
  enqueue(request: LocalVideoRequest): string;
  cancel(requestId: string): boolean;
  onProgress: ((progress: VideoGenerationProgress) => void) | null;
  onComplete: ((requestId: string, result: LocalVideoResult) => void) | null;
  onError: ((requestId: string, error: string, code?: string, details?: string) => void) | null;
}

/** Main-process hook applied before enqueue — the VRAM preflight (block "won't fit", auto-offload). */
export type LocalVideoPreparer = (request: LocalVideoRequest) => Promise<LocalVideoRequest>;

export interface LocalSdVideoProviderOptions {
  prepare?: LocalVideoPreparer;
  /** Lazy engine init (the models-folder scan + resolver): kicked on the first listing, awaited before a submit. */
  ensure?: () => Promise<void>;
}

interface LocalJob {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: VideoJobProgress;
  result?: LocalVideoResult;
  error?: string;
  /** Staged first frame, removed once the run is over. */
  initImagePath?: string;
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function rawBase64(value: string): string {
  const comma = value.indexOf(',');
  return value.startsWith('data:') && comma !== -1 ? value.slice(comma + 1) : value;
}

function sniffExtension(base64: string): string {
  if (base64.startsWith('/9j/')) return '.jpg';
  if (base64.startsWith('UklGR')) return '.webp';
  return '.png';
}

/** Capability view of an installed, ready local model — what the pickers and the normalizer read. */
export function toLocalVideoModelInfo(model: InstalledModel<VideoModelMeta>): VideoModelInfo {
  const { defaults, capabilities, family } = model.meta;
  const route =
    capabilities.t2v && capabilities.i2v
      ? 'text or image → video'
      : capabilities.i2v
        ? 'image → video only'
        : 'text → video';
  return {
    id: model.id,
    name: model.name,
    tagline: `${defaults.width}×${defaults.height} · ${defaults.fps} fps · ${route} · local, free`,
    dialect: 'local-sd',
    durations: { kind: 'discrete', values: [...LOCAL_VIDEO_DURATIONS] },
    aspectRatios: [...LOCAL_VIDEO_ASPECTS],
    supports: { audio: family === 'ltx', firstFrame: capabilities.i2v, lastFrame: false, seed: true },
    pricePerSecondUsd: 0,
  };
}

/**
 * Bridges the local sd-cli video engine (Wan / LTX / LingBot) into the cloud
 * VideoEngine provider interface, so the Videos screen, the Studio agent, the
 * Agents tool and the Flows node reach on-device models exactly like fal or
 * BytePlus (docs/ai-models-redesign.md §3.5, D3). Mirrors LocalSdImageProvider:
 * an instance, never in provider settings, zero models until sd-cli and one
 * ready model exist. Submit enqueues on the engine's serial queue and poll
 * reads the job map the engine callbacks fill — the sd-cli step progress rides
 * along so the job card fills like a cloud job. Content Safety needs nothing
 * here: Gate A and the input gate run in the engine before submit, Gate B on
 * the output runs in the clip store that files the `file://` result.
 */
export class LocalSdVideoProvider implements VideoProvider {
  readonly id: string;

  private readonly engine: LocalVideoEngineLike;
  private readonly prepare?: LocalVideoPreparer;
  private readonly ensure?: () => Promise<void>;
  private ensured: Promise<void> | null = null;
  private hooked = false;
  private readonly jobs = new Map<string, LocalJob>();

  constructor(id: string, engine: LocalVideoEngineLike, options: LocalSdVideoProviderOptions = {}) {
    this.id = id;
    this.engine = engine;
    this.prepare = options.prepare;
    this.ensure = options.ensure;
  }

  getSupportedModels(): VideoModelInfo[] {
    // The library scan is lazy: kick it so the next listing is complete.
    void this.ensureReady().catch(() => {});
    if (!this.engine.isSdCliAvailable()) return [];
    return this.engine
      .getAvailableModels()
      .filter((m) => m.issues.length === 0)
      .map(toLocalVideoModelInfo);
  }

  async submit(request: VideoProviderRequest): Promise<{ providerJobId: string }> {
    await this.ensureReady();
    this.hookEngine();

    const model = this.engine.getAvailableModels().find((m) => m.id === request.model && m.issues.length === 0);
    if (!model) {
      throw new VideoEngineError(
        `"${request.model}" is not an installed, ready local video model. Download it in AI Models → Video.`,
        this.id,
      );
    }
    const { defaults, capabilities, family } = model.meta;
    if (!capabilities.t2v && !request.firstFrame) {
      throw new VideoEngineError(`${model.name} is image-to-video only — add a first frame.`, this.id);
    }

    const initImagePath = request.firstFrame ? await this.stageFirstFrame(request.firstFrame) : undefined;
    const { width, height } = sizeForAspect(defaults, request.aspectRatio);
    let local: LocalVideoRequest = {
      modelId: model.id,
      prompt: request.prompt,
      width,
      height,
      frames: framesForDuration(family, request.durationSeconds, defaults.fps),
      fps: defaults.fps,
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
      ...(initImagePath ? { initImagePath } : {}),
    };

    try {
      if (this.prepare) local = await this.prepare(local);
    } catch (err) {
      if (initImagePath) fs.unlink(initImagePath).catch(() => {});
      throw err instanceof Error ? new VideoEngineError(err.message, this.id, undefined, err) : err;
    }

    const requestId = this.engine.enqueue(local);
    this.jobs.set(requestId, { status: 'pending', ...(initImagePath ? { initImagePath } : {}) });
    return { providerJobId: requestId };
  }

  async poll(providerJobId: string): Promise<VideoPollResult> {
    const job = this.jobs.get(providerJobId);
    if (!job) {
      return { status: 'failed', error: 'Unknown local video job (the app may have restarted).' };
    }
    switch (job.status) {
      case 'pending':
        return { status: 'pending' };
      case 'running':
        return { status: 'running', ...(job.progress ? { progress: job.progress } : {}) };
      case 'completed': {
        this.jobs.delete(providerJobId);
        const outputPath = job.result?.outputPath ?? '';
        return { status: 'completed', url: pathToFileURL(outputPath).href, contentType: 'video/webm' };
      }
      default:
        this.jobs.delete(providerJobId);
        return { status: 'failed', error: job.error ?? 'Local video generation failed.' };
    }
  }

  async cancel(providerJobId: string): Promise<void> {
    const job = this.jobs.get(providerJobId);
    this.jobs.delete(providerJobId);
    this.engine.cancel(providerJobId);
    if (job) this.releaseInput(job);
  }

  private ensureReady(): Promise<void> {
    if (!this.ensure) return Promise.resolve();
    this.ensured ??= this.ensure().catch((err: unknown) => {
      this.ensured = null; // retry on the next call rather than caching failure
      throw err;
    });
    return this.ensured;
  }

  /** The engine has single callback slots; this provider is their one owner. */
  private hookEngine(): void {
    if (this.hooked) return;
    this.hooked = true;
    this.engine.onProgress = (p) => {
      const job = this.jobs.get(p.requestId);
      if (!job) return;
      job.status = 'running';
      job.progress = { step: p.step, totalSteps: p.totalSteps, percent: p.percent };
    };
    this.engine.onComplete = (requestId, result) => {
      const job = this.jobs.get(requestId);
      if (!job) return;
      job.status = 'completed';
      job.result = result;
      this.releaseInput(job);
    };
    this.engine.onError = (requestId, error) => {
      const job = this.jobs.get(requestId);
      if (!job) return;
      job.status = 'failed';
      job.error = error;
      this.releaseInput(job);
    };
  }

  /** sd-cli takes the first frame as a file; the engine hands it over as bytes. */
  private async stageFirstFrame(input: ProviderMediaInput): Promise<string> {
    if (input.kind === 'url') {
      throw new VideoEngineError('Local models take the first frame as a file or bytes, not a URL.', this.id);
    }
    const raw = rawBase64(input.value);
    const ext = (input.contentType && EXT_BY_CONTENT_TYPE[input.contentType]) ?? sniffExtension(raw);
    const dir = path.join(os.tmpdir(), 'vidtsx-sdvideo');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `first-${randomUUID()}${ext}`);
    await fs.writeFile(filePath, Buffer.from(raw, 'base64'));
    return filePath;
  }

  private releaseInput(job: LocalJob): void {
    if (!job.initImagePath) return;
    fs.unlink(job.initImagePath).catch(() => {});
    job.initImagePath = undefined;
  }
}
