import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToolContext } from './test-context';

const getModels = vi.fn();
const submitVideoAsset = vi.fn();

vi.mock('../../../../video-engine', () => ({ videoEngine: { getModels: () => getModels() } }));
vi.mock('../../library/generate-video-asset', () => ({
  submitVideoAsset: (req: unknown) => submitVideoAsset(req),
}));

const { generateVideoTool } = await import('./generate-video');

const RECORD = {
  jobId: 'job-77',
  providerId: 'fal',
  providerJobId: 'p-1',
  featureSource: 'agent',
  status: 'pending',
  submittedAt: 0,
  updatedAt: 0,
  request: {
    model: 'seedance-2.5',
    prompt: 'a calm lake at dawn',
    durationSeconds: 4,
    aspectRatio: '16:9',
    resolution: '480p',
    generateAudio: false,
    hasFirstFrame: false,
    hasLastFrame: false,
  },
};

beforeEach(() => {
  getModels.mockReset();
  submitVideoAsset.mockReset();
  getModels.mockReturnValue([{ id: 'seedance-2.5' }, { id: 'kling-2.5-turbo-pro' }]);
  submitVideoAsset.mockResolvedValue(RECORD);
});

describe('generate_video tool', () => {
  it('declares the video-provider capability gate', () => {
    expect(generateVideoTool.id).toBe('generate_video');
    expect(generateVideoTool.needs).toBe('video-provider');
  });

  it('refuses with no provider configured, without submitting', async () => {
    getModels.mockReturnValue([]);
    const res = await generateVideoTool.handler({ prompt: 'a lake' }, makeToolContext());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('AI → Providers');
    expect(submitVideoAsset).not.toHaveBeenCalled();
  });

  it('lists the catalog when the model id is unknown', async () => {
    const res = await generateVideoTool.handler(
      { prompt: 'a lake', model: 'nope' },
      makeToolContext(),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('seedance-2.5');
    expect(submitVideoAsset).not.toHaveBeenCalled();
  });

  it('SUBMITS and returns a job artifact — it never waits for the clip', async () => {
    const res = await generateVideoTool.handler(
      { prompt: 'a calm lake at dawn', resolution: '480p', durationSeconds: 4 },
      makeToolContext({ brandId: 'brand-1', libraryFolder: 'agents/test/session' }),
    );
    expect(res.isError).toBeUndefined();
    expect(submitVideoAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'a calm lake at dawn',
        resolution: '480p',
        durationSeconds: 4,
        featureSource: 'agent',
      }),
    );
    // The job shape carries only what exists at submit time (plan §1.4): no
    // relPath, no duration of a file that does not exist yet.
    expect(res.artifact).toEqual({
      kind: 'job',
      title: 'a calm lake at dawn',
      payload: { jobId: 'job-77', job: 'video', status: 'pending' },
    });
    expect(res.content[0].text).toContain('End your turn now');
  });

  it('passes ctx.signal through, so cancelling a run stops paying for the clip', async () => {
    const controller = new AbortController();
    await generateVideoTool.handler(
      { prompt: 'a lake' },
      makeToolContext({ signal: controller.signal }),
    );
    expect(submitVideoAsset).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('does not choose the library folder itself — filing happens on completion', async () => {
    await generateVideoTool.handler(
      { prompt: 'a lake' },
      makeToolContext({ libraryFolder: 'agents/test/session' }),
    );
    const req = submitVideoAsset.mock.calls[0][0] as Record<string, unknown>;
    expect(req).not.toHaveProperty('folder');
    expect(req).not.toHaveProperty('brandId');
  });

  it('passes a Content Safety refusal through as the tool error', async () => {
    submitVideoAsset.mockRejectedValue(new Error('Blocked by Content Safety — nudity.'));
    const res = await generateVideoTool.handler({ prompt: 'x' }, makeToolContext());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Blocked by Content Safety');
    expect(res.artifact).toBeUndefined();
  });
});
