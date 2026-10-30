import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToolContext } from './test-context';

const getModels = vi.fn();
const submitVideoAsset = vi.fn();

vi.mock('../../../../video-engine', () => ({ videoEngine: { getModels: () => getModels() } }));
// The readiness helper would pull the local sd-cli engine (Electron) and scan a models folder.
vi.mock('../../video-init', () => ({ ensureVideoProvidersReady: async () => undefined }));
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

  it('names the fix when a shipped model is missing from a saved catalog', async () => {
    // A catalog saved before Kling 3 shipped lists only what it had then.
    const res = await generateVideoTool.handler(
      { prompt: 'a lake', model: 'kling-3-pro', providerId: 'fal' },
      makeToolContext(),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Kling 3 Pro ("kling-3-pro") ships with VidTSX but is not in the saved fal video catalog');
    expect(res.content[0].text).toContain('"Reset defaults"');
    expect(res.content[0].text).toContain('seedance-2.5');
    expect(submitVideoAsset).not.toHaveBeenCalled();
  });

  it('missingFromSavedCatalog: only for ids this version ships, on that provider', async () => {
    const { missingFromSavedCatalog } = await import('./generate-video');
    expect(missingFromSavedCatalog('kling-4')).toContain('saved fal video catalog');
    expect(missingFromSavedCatalog('dreamina-seedance-2-0-260128')).toContain('saved byteplus video catalog');
    expect(missingFromSavedCatalog('kling-4', 'byteplus')).toBeUndefined();
    // A legacy id (out of the shipped defaults) or a typo gets the plain message.
    expect(missingFromSavedCatalog('hailuo-02')).toBeUndefined();
    expect(missingFromSavedCatalog('nope')).toBeUndefined();
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
