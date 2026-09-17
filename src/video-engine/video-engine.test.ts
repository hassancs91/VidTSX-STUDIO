import { describe, it, expect, vi } from 'vitest';
import { createVideoEngine } from './video-engine';
import type {
  VideoClipStore,
  VideoJobRecord,
  VideoModelInfo,
  VideoPollResult,
  VideoProvider,
  VideoSafetyGuard,
} from './types';
import { ModerationBlockedError } from '../shared/content-safety';
import type { VideoStudioEntry } from '../shared/ipc/types/video-studio';

const MODEL: VideoModelInfo = {
  id: 'm1',
  name: 'Model One',
  dialect: 'fal-generic',
  durations: { kind: 'discrete', values: [5, 10] },
  aspectRatios: ['16:9', '9:16'],
  supports: { audio: false, firstFrame: true, lastFrame: true, seed: true },
  pricePerSecondUsd: 0.1,
};

/** A model whose provider publishes a rate per resolution (Seedance 2.5). */
const PRICED_MODEL: VideoModelInfo = {
  id: 'm2',
  name: 'Model Two',
  dialect: 'fal-seedance-2',
  durations: { kind: 'discrete', values: [4, 8] },
  aspectRatios: ['16:9'],
  resolutions: ['720p', '480p'],
  supports: { audio: false, firstFrame: false, lastFrame: false, seed: true },
  pricePerSecondUsd: 0.47,
  pricePerSecondByResolutionUsd: { '480p': 0.22, '720p': 0.47 },
};

const ENTRY: VideoStudioEntry = {
  id: 'entry-1',
  fileName: 'vid-1.mp4',
  thumbnailFileName: null,
  prompt: 'p',
  model: 'm1',
  aspectRatio: '16:9',
  durationSeconds: 5,
  hasAudio: false,
  sizeBytes: 10,
  contentType: 'video/mp4',
  creditsConsumed: null,
  sourceUrl: 'https://cdn/clip.mp4',
  createdAt: 1,
  folderId: null,
};

const PNG = 'iVBORw0KGgo=';

interface Harness {
  provider: VideoProvider;
  submit: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  polls: VideoPollResult[];
  order: string[];
}

/** A provider that answers polls from a script (the last answer repeats). */
function stubProvider(polls: VideoPollResult[], order: string[] = []): Harness {
  const remaining = [...polls];
  const submit = vi.fn(async () => {
    order.push('provider.submit');
    return { providerJobId: 'fal-req-1' };
  });
  const cancel = vi.fn(async () => undefined);
  const provider: VideoProvider = {
    id: 'stub',
    submit,
    cancel,
    poll: async () => (remaining.length > 1 ? remaining.shift()! : remaining[0]),
    getSupportedModels: () => [MODEL, PRICED_MODEL],
  };
  return { provider, submit, cancel, polls, order };
}

function passingGuard(order: string[] = []): VideoSafetyGuard & { checkImage: ReturnType<typeof vi.fn> } {
  return {
    checkImage: vi.fn(async () => {
      order.push('gateB');
    }),
    onPromptBlocked: () => {
      order.push('gateA-blocked');
    },
  };
}

function passingStore(): VideoClipStore & { store: ReturnType<typeof vi.fn> } {
  return { store: vi.fn(async () => ({ entry: ENTRY, filePath: 'C:\\videos\\vid-1.mp4' })) };
}

function engineWith(harness: Harness, guard = passingGuard(harness.order), store = passingStore()) {
  const engine = createVideoEngine({ pollIntervalMs: 1, maxWaitMs: 5000, retainMs: 60000 });
  engine.setSafetyGuard(guard);
  engine.setClipStore(store);
  engine.registerInstance(harness.provider);
  return { engine, guard, store };
}

async function untilTerminal(get: () => VideoJobRecord | undefined): Promise<VideoJobRecord> {
  for (let i = 0; i < 500; i++) {
    const record = get();
    if (record && ['completed', 'failed', 'cancelled'].includes(record.status)) return record;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error('job never reached a terminal state');
}

describe('videoEngine Content Safety chokepoint', () => {
  it('runs Gate A, then Gate B on both frames, then the provider — in that order', async () => {
    const harness = stubProvider([{ status: 'completed', url: 'https://cdn/clip.mp4' }]);
    const { engine, guard } = engineWith(harness);
    await engine.submit({
      model: 'm1',
      prompt: 'a sunny mountain landscape',
      firstFrame: { kind: 'base64', value: PNG },
      lastFrame: { kind: 'base64', value: PNG },
    });
    expect(harness.order).toEqual(['gateB', 'gateB', 'provider.submit']);
    expect(guard.checkImage).toHaveBeenCalledTimes(2);
    expect(guard.checkImage.mock.calls[0][1]).toBe('input');
  });

  it('Gate A blocks a flagged prompt before Gate B or the provider run', async () => {
    const harness = stubProvider([{ status: 'pending' }]);
    const { engine, guard } = engineWith(harness);
    await expect(
      engine.submit({ model: 'm1', prompt: 'nude portrait', firstFrame: { kind: 'base64', value: PNG } }),
    ).rejects.toBeInstanceOf(ModerationBlockedError);
    expect(harness.order).toEqual(['gateA-blocked']);
    expect(guard.checkImage).not.toHaveBeenCalled();
    expect(harness.submit).not.toHaveBeenCalled();
  });

  it('Gate A runs before the provider lookup — a flagged prompt is refused with no provider at all', async () => {
    const engine = createVideoEngine({ pollIntervalMs: 1, maxWaitMs: 100, retainMs: 100 });
    await expect(engine.submit({ model: 'm1', prompt: 'nude portrait' })).rejects.toBeInstanceOf(ModerationBlockedError);
    await expect(engine.submit({ model: 'm1', prompt: 'a sunny mountain landscape' })).rejects.toThrow(/No video provider configured/);
  });

  it('a Gate B block on an input frame never reaches the provider', async () => {
    const harness = stubProvider([{ status: 'pending' }]);
    const guard = passingGuard(harness.order);
    guard.checkImage.mockImplementationOnce(async () => {
      throw new ModerationBlockedError('image', 'explicit');
    });
    const { engine } = engineWith(harness, guard);
    const err = await engine
      .submit({ model: 'm1', prompt: 'a sunny mountain landscape', firstFrame: { kind: 'base64', value: PNG } })
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(ModerationBlockedError);
    expect((err as ModerationBlockedError).gate).toBe('image');
    expect(harness.submit).not.toHaveBeenCalled();
  });

  it('refuses to submit without the input guard or the finishing store (fail-closed)', async () => {
    const noGuard = stubProvider([{ status: 'pending' }]);
    const engineNoGuard = createVideoEngine({ pollIntervalMs: 1, maxWaitMs: 100, retainMs: 100 });
    engineNoGuard.setClipStore(passingStore());
    engineNoGuard.registerInstance(noGuard.provider);
    await expect(engineNoGuard.submit({ model: 'm1', prompt: 'a sunny mountain landscape' })).rejects.toThrow(/fail-closed/);
    expect(noGuard.submit).not.toHaveBeenCalled();

    const noStore = stubProvider([{ status: 'pending' }]);
    const engineNoStore = createVideoEngine({ pollIntervalMs: 1, maxWaitMs: 100, retainMs: 100 });
    engineNoStore.setSafetyGuard(passingGuard());
    engineNoStore.registerInstance(noStore.provider);
    await expect(engineNoStore.submit({ model: 'm1', prompt: 'a sunny mountain landscape' })).rejects.toThrow(/fail-closed/);
    expect(noStore.submit).not.toHaveBeenCalled();
  });

  it('normalizes the request against the model before the provider sees it', async () => {
    const harness = stubProvider([{ status: 'completed', url: 'https://cdn/clip.mp4' }]);
    const { engine } = engineWith(harness);
    await engine.submit({
      model: 'm1',
      prompt: 'a sunny mountain landscape',
      durationSeconds: 15,
      aspectRatio: '4:3',
      generateAudio: true,
      lastFrame: { kind: 'base64', value: PNG },
    });
    expect(harness.submit).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'm1', durationSeconds: 10, aspectRatio: '16:9', generateAudio: false }),
    );
    // A last frame without a first frame is dropped.
    expect(harness.submit.mock.calls[0][0]).not.toHaveProperty('lastFrame');
  });
});

describe('videoEngine job tracker', () => {
  it('submit → poll → complete: downloads through the store and records the local entry', async () => {
    const harness = stubProvider([
      { status: 'pending' },
      { status: 'running' },
      { status: 'completed', url: 'https://cdn/clip.mp4', contentType: 'video/mp4' },
    ]);
    const { engine, store } = engineWith(harness);
    const usage = vi.fn();
    engine.setUsageLogger(usage);
    const seen: string[] = [];
    engine.subscribe((r) => seen.push(r.status));

    const submitted = await engine.submit({ model: 'm1', prompt: 'a sunny mountain landscape', folderId: 'f1', featureSource: 'flows' });
    expect(submitted.status).toBe('pending');
    expect(submitted.request).toMatchObject({ model: 'm1', durationSeconds: 5, hasFirstFrame: false, folderId: 'f1' });

    const done = await untilTerminal(() => engine.getJob(submitted.jobId));
    expect(done.status).toBe('completed');
    expect(done.result?.entry.id).toBe('entry-1');
    expect(store.store).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://cdn/clip.mp4', contentType: 'video/mp4', folderId: 'f1', durationSeconds: 5 }),
    );
    expect(seen).toEqual(['pending', 'running', 'completed']);
    expect(usage).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'stub', model: 'm1', featureSource: 'flows', costUsd: 0.5 }),
    );
  });

  it('bills at the rate published for the requested resolution', async () => {
    const harness = stubProvider([{ status: 'completed', url: 'https://cdn/clip.mp4' }]);
    const { engine } = engineWith(harness);
    const usage = vi.fn();
    engine.setUsageLogger(usage);

    const submitted = await engine.submit({
      model: 'm2',
      prompt: 'a sunny mountain landscape',
      durationSeconds: 4,
      resolution: '480p',
    });
    await untilTerminal(() => engine.getJob(submitted.jobId));

    // 0.22 x 4s, not the 0.47 headline rate that over-stated a 480p clip.
    expect(usage).toHaveBeenCalledWith(expect.objectContaining({ model: 'm2', costUsd: 0.88 }));
  });

  it('falls back to the headline rate when the resolution has none', async () => {
    const harness = stubProvider([{ status: 'completed', url: 'https://cdn/clip.mp4' }]);
    const { engine } = engineWith(harness);
    const usage = vi.fn();
    engine.setUsageLogger(usage);

    const submitted = await engine.submit({
      model: 'm1',
      prompt: 'a sunny mountain landscape',
      durationSeconds: 5,
    });
    await untilTerminal(() => engine.getJob(submitted.jobId));

    expect(usage).toHaveBeenCalledWith(expect.objectContaining({ model: 'm1', costUsd: 0.5 }));
  });

  it('a provider failure ends the job as failed with the message', async () => {
    const harness = stubProvider([{ status: 'running' }, { status: 'failed', error: 'model exploded' }]);
    const { engine, store } = engineWith(harness);
    const submitted = await engine.submit({ model: 'm1', prompt: 'a sunny mountain landscape' });
    const done = await untilTerminal(() => engine.getJob(submitted.jobId));
    expect(done).toMatchObject({ status: 'failed', error: 'model exploded' });
    expect(store.store).not.toHaveBeenCalled();
  });

  it('an output-frame Gate B block fails the job with block info and no entry', async () => {
    const harness = stubProvider([{ status: 'completed', url: 'https://cdn/clip.mp4' }]);
    const store = passingStore();
    store.store.mockImplementation(async () => {
      throw new ModerationBlockedError('image', 'explicit');
    });
    const { engine } = engineWith(harness, passingGuard(), store);
    const submitted = await engine.submit({ model: 'm1', prompt: 'a sunny mountain landscape' });
    const done = await untilTerminal(() => engine.getJob(submitted.jobId));
    expect(done.status).toBe('failed');
    expect(done.blocked).toEqual({ gate: 'image', category: 'explicit' });
    expect(done.result).toBeUndefined();
  });

  it('cancel stops polling, marks the job cancelled, and tells the provider', async () => {
    const harness = stubProvider([{ status: 'pending' }]);
    const { engine, store } = engineWith(harness);
    const submitted = await engine.submit({ model: 'm1', prompt: 'a sunny mountain landscape' });
    await engine.cancel(submitted.jobId);
    expect(engine.getJob(submitted.jobId)?.status).toBe('cancelled');
    expect(harness.cancel).toHaveBeenCalledWith('fal-req-1');
    await new Promise((r) => setTimeout(r, 10));
    expect(engine.getJob(submitted.jobId)?.status).toBe('cancelled');
    expect(store.store).not.toHaveBeenCalled();
    // Cancelling a finished job is a no-op; an unknown job is an error.
    await engine.cancel(submitted.jobId);
    await expect(engine.cancel('nope')).rejects.toThrow(/Unknown video job/);
  });

  it('generateAndWait resolves with the gated entry and rejects on failure', async () => {
    const ok = stubProvider([{ status: 'running' }, { status: 'completed', url: 'https://cdn/clip.mp4' }]);
    const { engine } = engineWith(ok);
    const progress: string[] = [];
    const result = await engine.generateAndWait(
      { model: 'm1', prompt: 'a sunny mountain landscape' },
      { onProgress: (r) => progress.push(r.status) },
    );
    expect(result.entry.id).toBe('entry-1');
    expect(result).toMatchObject({ provider: 'stub', model: 'm1', durationSeconds: 5, aspectRatio: '16:9', hasAudio: false });
    expect(progress[progress.length - 1]).toBe('completed');

    const bad = stubProvider([{ status: 'failed', error: 'nope' }]);
    const { engine: engine2 } = engineWith(bad);
    await expect(engine2.generateAndWait({ model: 'm1', prompt: 'a sunny mountain landscape' })).rejects.toThrow('nope');
  });

  it('generateAndWait cancels the job when its signal aborts', async () => {
    const harness = stubProvider([{ status: 'pending' }]);
    const { engine } = engineWith(harness);
    const controller = new AbortController();
    const pending = engine.generateAndWait({ model: 'm1', prompt: 'a sunny mountain landscape' }, { signal: controller.signal });
    await new Promise((r) => setTimeout(r, 5));
    controller.abort();
    await expect(pending).rejects.toThrow('Cancelled');
    expect(harness.cancel).toHaveBeenCalled();
  });
});

describe('reference media', () => {
  const REFERENCE_MODEL: VideoModelInfo = {
    ...MODEL,
    supports: {
      audio: false,
      firstFrame: true,
      lastFrame: true,
      seed: true,
      references: { images: 2, videos: 1, audios: 1 },
    },
  };

  function referenceHarness() {
    const order: string[] = [];
    const harness = stubProvider([{ status: 'completed', url: 'https://cdn/clip.mp4' }], order);
    const uploaded: Array<{ kind: string; value: string }> = [];
    harness.provider.getSupportedModels = () => [REFERENCE_MODEL];
    harness.provider.uploadMedia = vi.fn(async (input, kind) => {
      order.push(`upload:${kind}`);
      uploaded.push({ kind, value: input.value });
      return { kind: 'url' as const, value: `https://cdn/${kind}.bin` };
    });
    return { harness, order, uploaded };
  }

  it('gates a reference video before it is uploaded, and uploads before submit', async () => {
    const { harness, order } = referenceHarness();
    const guard = passingGuard(order);
    guard.checkVideo = vi.fn(async () => {
      order.push('gateB-video');
    });
    const { engine } = engineWith(harness, guard);

    await engine.submit({
      model: 'm1',
      prompt: 'ok',
      references: {
        images: [{ kind: 'base64', value: PNG }],
        videos: [{ kind: 'base64', value: 'AAAA' }],
        audios: [{ kind: 'base64', value: 'BBBB' }],
      },
    });

    expect(order).toEqual(['gateB', 'gateB-video', 'upload:video', 'upload:audio', 'provider.submit']);
    const sent = harness.submit.mock.calls[0][0];
    expect(sent.referenceVideos).toEqual([{ kind: 'url', value: 'https://cdn/video.bin' }]);
    expect(sent.referenceAudios).toEqual([{ kind: 'url', value: 'https://cdn/audio.bin' }]);
    expect(sent.firstFrame).toBeUndefined();
  });

  it('refuses a reference video when no sampler is installed (fail-closed)', async () => {
    const { harness } = referenceHarness();
    const { engine } = engineWith(harness, passingGuard());
    await expect(
      engine.submit({
        model: 'm1',
        prompt: 'ok',
        references: { videos: [{ kind: 'base64', value: 'AAAA' }] },
      }),
    ).rejects.toThrow(/blocked \(fail-closed\)/);
    expect(harness.submit).not.toHaveBeenCalled();
  });

  it('drops references past the model limits and records the counts', async () => {
    const { harness, order } = referenceHarness();
    const guard = passingGuard(order);
    guard.checkVideo = vi.fn(async () => undefined);
    const { engine } = engineWith(harness, guard);

    const record = await engine.submit({
      model: 'm1',
      prompt: 'ok',
      references: {
        images: [
          { kind: 'base64', value: PNG },
          { kind: 'base64', value: PNG },
          { kind: 'base64', value: PNG },
        ],
      },
    });

    expect(harness.submit.mock.calls[0][0].referenceImages).toHaveLength(2);
    expect(record.request.referenceCounts).toEqual({ images: 2, videos: 0, audios: 0 });
  });

  it('logs the provider token count on the usage entry when one is reported', async () => {
    const order: string[] = [];
    const harness = stubProvider(
      [{ status: 'completed', url: 'https://cdn/clip.mp4', usage: { completionTokens: 12345 } }],
      order,
    );
    const { engine } = engineWith(harness);
    const usage = vi.fn();
    engine.setUsageLogger(usage);

    await engine.generateAndWait({ model: 'm1', prompt: 'ok' });

    expect(usage).toHaveBeenCalledWith(expect.objectContaining({ outputTokens: 12345 }));
  });
});

describe('videoEngine job timeout', () => {
  it('cancels the provider job when the engine gives up', async () => {
    const harness = stubProvider([{ status: 'running' }]);
    const engine = createVideoEngine({ pollIntervalMs: 1, maxWaitMs: 30, retainMs: 60000 });
    engine.setSafetyGuard(passingGuard());
    engine.setClipStore(passingStore());
    engine.registerInstance(harness.provider);
    const submitted = await engine.submit({ model: 'm1', prompt: 'a slow clip' });
    const record = await untilTerminal(() => engine.getJob(submitted.jobId));
    expect(record.status).toBe('failed');
    expect(record.error).toBe('Video generation timed out.');
    expect(harness.cancel).toHaveBeenCalledWith('fal-req-1');
  });

  it("honours a provider's own jobTimeoutMs over the engine default", async () => {
    const polls: VideoPollResult[] = [...Array.from({ length: 60 }, () => ({ status: 'running' as const })), { status: 'completed', url: 'https://cdn/clip.mp4' }];
    const harness = stubProvider(polls);
    (harness.provider as { jobTimeoutMs?: number }).jobTimeoutMs = 10_000;
    const engine = createVideoEngine({ pollIntervalMs: 1, maxWaitMs: 30, retainMs: 60000 });
    engine.setSafetyGuard(passingGuard());
    engine.setClipStore(passingStore());
    engine.registerInstance(harness.provider);
    const submitted = await engine.submit({ model: 'm1', prompt: 'a patient clip' });
    const record = await untilTerminal(() => engine.getJob(submitted.jobId));
    expect(record.status).toBe('completed');
    expect(harness.cancel).not.toHaveBeenCalled();
  });
});
