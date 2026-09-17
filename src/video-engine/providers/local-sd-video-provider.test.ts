import { describe, expect, it, vi } from 'vitest';
import type { InstalledModel } from '../../shared/model-library/types';
import type {
  VideoGenerationProgress,
  VideoGenerationRequest as LocalVideoRequest,
  VideoGenerationResult as LocalVideoResult,
  VideoModelMeta,
} from '../../local-video-engine/types';
import type { VideoProviderRequest } from '../types';
import { LocalSdVideoProvider, toLocalVideoModelInfo, type LocalVideoEngineLike } from './local-sd-video-provider';

function installed(
  id: string,
  meta: Partial<VideoModelMeta> = {},
  issues: InstalledModel<VideoModelMeta>['issues'] = [],
): InstalledModel<VideoModelMeta> {
  return {
    id,
    category: 'video',
    name: `Model ${id}`,
    filePath: `D:/models/video/${id}.gguf`,
    origin: 'profile',
    sizeBytes: 1_000,
    issues,
    meta: {
      family: 'wan21',
      defaults: { width: 832, height: 480, frames: 33, fps: 16, steps: 20, cfgScale: 6, sampler: 'euler' },
      capabilities: { t2v: true, i2v: false },
      ...meta,
    },
  };
}

/** A scriptable stand-in for the sd-cli engine: records enqueues, exposes the callback slots. */
function fakeEngine(models: InstalledModel<VideoModelMeta>[], sdCli = true) {
  const enqueued: LocalVideoRequest[] = [];
  let counter = 0;
  const engine: LocalVideoEngineLike & { enqueued: LocalVideoRequest[]; cancelled: string[] } = {
    enqueued,
    cancelled: [],
    isSdCliAvailable: () => sdCli,
    getAvailableModels: () => models,
    enqueue: (request) => {
      enqueued.push(request);
      counter += 1;
      return `req-${counter}`;
    },
    cancel: (requestId) => {
      engine.cancelled.push(requestId);
      return true;
    },
    onProgress: null,
    onComplete: null,
    onError: null,
  };
  return engine;
}

function request(overrides: Partial<VideoProviderRequest> = {}): VideoProviderRequest {
  return {
    model: 'wan',
    prompt: 'a red fox running through snow',
    durationSeconds: 3,
    aspectRatio: '9:16',
    generateAudio: false,
    ...overrides,
  };
}

describe('LocalSdVideoProvider.getSupportedModels', () => {
  it('lists only ready models, and none without sd-cli', () => {
    const models = [installed('wan'), installed('broken', {}, [{ code: 'missing-companion', kind: 'vae', expectedNames: ['x'], searchedDirs: [] }])];
    expect(new LocalSdVideoProvider('local', fakeEngine(models)).getSupportedModels().map((m) => m.id)).toEqual(['wan']);
    expect(new LocalSdVideoProvider('local', fakeEngine(models, false)).getSupportedModels()).toEqual([]);
  });

  it('kicks the lazy library scan on a listing', async () => {
    const ensure = vi.fn(async () => undefined);
    new LocalSdVideoProvider('local', fakeEngine([installed('wan')]), { ensure }).getSupportedModels();
    await Promise.resolve();
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it('publishes the local capabilities: free, 2–5 s, three aspects, first frame where the model does i2v', () => {
    const info = toLocalVideoModelInfo(installed('ltx', { family: 'ltx', capabilities: { t2v: true, i2v: true } }));
    expect(info.dialect).toBe('local-sd');
    expect(info.durations).toEqual({ kind: 'discrete', values: [2, 3, 4, 5] });
    expect(info.aspectRatios).toEqual(['16:9', '9:16', '1:1']);
    expect(info.supports).toEqual({ audio: true, firstFrame: true, lastFrame: false, seed: true });
    expect(info.pricePerSecondUsd).toBe(0);
    expect(info.tagline).toContain('text or image → video');
  });
});

describe('LocalSdVideoProvider.submit', () => {
  it('maps duration and aspect onto frames and size, applies the preflight, and enqueues once', async () => {
    const engine = fakeEngine([installed('wan')]);
    const prepare = vi.fn(async (r: LocalVideoRequest) => ({ ...r, offloadToCpu: true }));
    const ensure = vi.fn(async () => undefined);
    const provider = new LocalSdVideoProvider('local', engine, { prepare, ensure });

    const { providerJobId } = await provider.submit(request({ seed: 7 }));

    expect(providerJobId).toBe('req-1');
    expect(ensure).toHaveBeenCalled();
    expect(engine.enqueued).toEqual([
      {
        modelId: 'wan',
        prompt: 'a red fox running through snow',
        width: 480,
        height: 832,
        frames: 49,
        fps: 16,
        seed: 7,
        offloadToCpu: true,
      },
    ]);
  });

  it('refuses an unknown model and an image-to-video model without a first frame', async () => {
    const engine = fakeEngine([installed('i2v', { capabilities: { t2v: false, i2v: true } })]);
    const provider = new LocalSdVideoProvider('local', engine);
    await expect(provider.submit(request({ model: 'nope' }))).rejects.toThrow('not an installed, ready local video model');
    await expect(provider.submit(request({ model: 'i2v' }))).rejects.toThrow('image-to-video only');
    expect(engine.enqueued).toEqual([]);
  });

  it('surfaces a preflight refusal as a provider error', async () => {
    const engine = fakeEngine([installed('wan')]);
    const provider = new LocalSdVideoProvider('local', engine, {
      prepare: async () => {
        throw new Error('Needs ~9 GB but you have 6 GB VRAM / 8 GB RAM — too large to run.');
      },
    });
    await expect(provider.submit(request())).rejects.toThrow('too large to run');
    expect(engine.enqueued).toEqual([]);
  });
});

describe('LocalSdVideoProvider.poll', () => {
  it('follows the engine callbacks: pending → running with step progress → completed as a file URL', async () => {
    const engine = fakeEngine([installed('wan')]);
    const provider = new LocalSdVideoProvider('local', engine);
    const { providerJobId } = await provider.submit(request());

    expect(await provider.poll(providerJobId)).toEqual({ status: 'pending' });

    const progress: VideoGenerationProgress = { requestId: providerJobId, step: 5, totalSteps: 20, percent: 25 };
    engine.onProgress?.(progress);
    expect(await provider.poll(providerJobId)).toEqual({
      status: 'running',
      progress: { step: 5, totalSteps: 20, percent: 25 },
    });

    const result: LocalVideoResult = {
      outputPath: 'C:\\Temp\\vidtsx-sdvideo\\req-1.webm',
      width: 480,
      height: 832,
      frames: 49,
      fps: 16,
      seed: 42,
      durationMs: 1000,
    };
    engine.onComplete?.(providerJobId, result);
    const done = await provider.poll(providerJobId);
    expect(done.status).toBe('completed');
    if (done.status === 'completed') {
      expect(done.url.startsWith('file:///')).toBe(true);
      expect(done.url.endsWith('/req-1.webm')).toBe(true);
      expect(done.contentType).toBe('video/webm');
    }
    // Consumed: a second poll no longer knows the job.
    expect((await provider.poll(providerJobId)).status).toBe('failed');
  });

  it('reports an engine failure once, with its message', async () => {
    const engine = fakeEngine([installed('wan')]);
    const provider = new LocalSdVideoProvider('local', engine);
    const { providerJobId } = await provider.submit(request());
    engine.onError?.(providerJobId, 'sd-cli ran out of GPU memory', 'out-of-memory');
    expect(await provider.poll(providerJobId)).toEqual({ status: 'failed', error: 'sd-cli ran out of GPU memory' });
  });

  it('cancel forwards to the engine and forgets the job', async () => {
    const engine = fakeEngine([installed('wan')]);
    const provider = new LocalSdVideoProvider('local', engine);
    const { providerJobId } = await provider.submit(request());
    await provider.cancel(providerJobId);
    expect(engine.cancelled).toEqual([providerJobId]);
    expect((await provider.poll(providerJobId)).status).toBe('failed');
  });
});
