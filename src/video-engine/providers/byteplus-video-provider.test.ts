import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BytePlusVideoProvider } from './byteplus-video-provider';
import { BYTEPLUS_VIDEO_MODELS } from '../../shared/presets/video-models';
import type { VideoProviderRequest } from '../types';

const MODEL_ID = 'dreamina-seedance-2-5-260628';

function request(overrides: Partial<VideoProviderRequest> = {}): VideoProviderRequest {
  return {
    model: MODEL_ID,
    prompt: 'a calm lake at dawn',
    durationSeconds: 5,
    aspectRatio: '16:9',
    generateAudio: true,
    ...overrides,
  };
}

/** Captures each request and answers with the queued response. */
function stubFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const queue = [...responses];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BytePlusVideoProvider', () => {
  let provider: BytePlusVideoProvider;

  beforeEach(() => {
    provider = new BytePlusVideoProvider('byteplus', 'ark-key', MODEL_ID, [
      ...BYTEPLUS_VIDEO_MODELS,
    ]);
  });

  it('creates a task against the ap-southeast endpoint with a bearer key', async () => {
    const calls = stubFetch([{ body: { id: 'task-1' } }]);
    const { providerJobId } = await provider.submit(request());

    expect(providerJobId).toBe('task-1');
    expect(calls[0].url).toBe(
      'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks',
    );
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer ark-key');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe(MODEL_ID);
    expect(body.content).toEqual([{ type: 'text', text: 'a calm lake at dawn' }]);
    expect(body.duration).toBe(5);
    expect(body.watermark).toBe(false);
  });

  it('maps every task status, and carries the token usage on success', async () => {
    stubFetch([{ body: { id: 't', status: 'queued' } }]);
    expect(await provider.poll('t')).toEqual({ status: 'pending' });

    stubFetch([{ body: { id: 't', status: 'running' } }]);
    expect(await provider.poll('t')).toEqual({ status: 'running' });

    stubFetch([
      {
        body: {
          id: 't',
          status: 'succeeded',
          content: { video_url: 'https://ark/out.mp4' },
          usage: { completion_tokens: 9000 },
        },
      },
    ]);
    expect(await provider.poll('t')).toEqual({
      status: 'completed',
      url: 'https://ark/out.mp4',
      contentType: 'video/mp4',
      usage: { completionTokens: 9000 },
    });

    stubFetch([{ body: { id: 't', status: 'failed', error: { message: 'no good' } } }]);
    expect(await provider.poll('t')).toEqual({ status: 'failed', error: 'no good' });

    stubFetch([{ body: { id: 't', status: 'expired' } }]);
    expect((await provider.poll('t')).status).toBe('failed');
  });

  it('reports zero reference videos without an upload host, and refuses one', async () => {
    const models = provider.getSupportedModels();
    expect(models[0].supports.references).toEqual({ images: 30, videos: 0, audios: 10 });
    await expect(
      provider.uploadMedia({ kind: 'base64', value: 'AAAA' }, 'video'),
    ).rejects.toThrow(/public URL for reference videos/);
  });

  it('uploads a reference video through the host when one is configured', async () => {
    const upload = vi.fn(async () => 'https://cdn.fal/ref.mp4');
    const hosted = new BytePlusVideoProvider(
      'byteplus',
      'ark-key',
      MODEL_ID,
      [...BYTEPLUS_VIDEO_MODELS],
      { mediaUploader: { upload } },
    );

    expect(hosted.getSupportedModels()[0].supports.references).toEqual({
      images: 30,
      videos: 10,
      audios: 10,
    });
    const result = await hosted.uploadMedia(
      { kind: 'base64', value: 'data:video/mp4;base64,AAAA' },
      'video',
    );
    expect(result).toEqual({ kind: 'url', value: 'https://cdn.fal/ref.mp4', contentType: 'video/mp4' });
    expect(upload).toHaveBeenCalledWith(expect.any(Buffer), 'video/mp4', undefined, undefined);
  });

  it('keeps reference audio inline — ModelArk takes base64 for audio', async () => {
    const input = { kind: 'base64' as const, value: 'data:audio/mp3;base64,AAAA' };
    expect(await provider.uploadMedia(input, 'audio')).toBe(input);
  });
});
