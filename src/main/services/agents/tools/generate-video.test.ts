import { describe, it, expect, vi, beforeEach } from 'vitest';

const getModels = vi.fn();
const generateVideoAsset = vi.fn();

vi.mock('../../../../video-engine', () => ({ videoEngine: { getModels: () => getModels() } }));
vi.mock('../../library/generate-video-asset', () => ({
  generateVideoAsset: (req: unknown) => generateVideoAsset(req),
}));

const { generateVideoTool } = await import('./generate-video');

const ctx = { signal: new AbortController().signal };

const ASSET = {
  relPath: 'generated/a-calm-lake.mp4',
  entryId: 'vid-1',
  durationSeconds: 4.04,
  aspectRatio: '16:9',
  hasAudio: true,
  description: 'a calm lake at dawn',
};

beforeEach(() => {
  getModels.mockReset();
  generateVideoAsset.mockReset();
  getModels.mockReturnValue([{ id: 'seedance-2.5' }, { id: 'kling-2.5-turbo-pro' }]);
  generateVideoAsset.mockResolvedValue(ASSET);
});

describe('generate_video tool', () => {
  it('declares the video-provider capability gate', () => {
    expect(generateVideoTool.id).toBe('generate_video');
    expect(generateVideoTool.needs).toBe('video-provider');
  });

  it('refuses with no provider configured, without calling the library', async () => {
    getModels.mockReturnValue([]);
    const res = await generateVideoTool.handler({ prompt: 'a lake' }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('AI → Providers');
    expect(generateVideoAsset).not.toHaveBeenCalled();
  });

  it('lists the catalog when the model id is unknown', async () => {
    const res = await generateVideoTool.handler({ prompt: 'a lake', model: 'nope' }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('seedance-2.5');
    expect(generateVideoAsset).not.toHaveBeenCalled();
  });

  it('files under the agent feature source and returns a video artifact', async () => {
    const res = await generateVideoTool.handler(
      { prompt: 'a calm lake at dawn', resolution: '480p', durationSeconds: 4 },
      { ...ctx, brandId: 'brand-1', libraryFolder: 'agent-run' },
    );
    expect(res.isError).toBeUndefined();
    expect(generateVideoAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'a calm lake at dawn',
        resolution: '480p',
        durationSeconds: 4,
        folder: 'agent-run',
        brandId: 'brand-1',
        featureSource: 'agent',
      }),
    );
    expect(res.artifact).toEqual({
      kind: 'video',
      title: 'a calm lake at dawn',
      payload: {
        entryId: 'vid-1',
        relPath: 'generated/a-calm-lake.mp4',
        durationSeconds: 4.04,
        aspectRatio: '16:9',
        hasAudio: true,
      },
    });
  });

  it('passes a Content Safety refusal through as the tool error', async () => {
    generateVideoAsset.mockRejectedValue(new Error('Blocked by Content Safety — nudity.'));
    const res = await generateVideoTool.handler({ prompt: 'x' }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Blocked by Content Safety');
    expect(res.artifact).toBeUndefined();
  });
});
