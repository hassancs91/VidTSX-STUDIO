import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generate = vi.fn();
const getActiveProvider = vi.fn();
const upsertEntry = vi.fn();
const readBrand = vi.fn();
let root = '';

vi.mock('../../../audio-engine/generation', () => ({
  audioGenerationEngine: {
    getActiveProvider: () => getActiveProvider(),
    generate: (req: unknown) => generate(req),
  },
}));
vi.mock('../audio-generation-init', () => ({ ensureAudioGenerationEngine: async () => {} }));
vi.mock('./library-paths', () => ({
  ensureLibraryRoot: async () => root,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('./library-store', () => ({ upsertEntry: (...args: unknown[]) => upsertEntry(...args) }));
vi.mock('./brand-store', () => ({ readBrand: (...args: unknown[]) => readBrand(...args) }));

const { generateAudioAsset, describeAudioRequest, NO_AUDIO_PROVIDER_MESSAGE } = await import('./generate-audio-asset');

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'w2b-audio-'));
  generate.mockReset();
  getActiveProvider.mockReset();
  upsertEntry.mockReset();
  readBrand.mockReset();
  getActiveProvider.mockReturnValue('elevenlabs');
  generate.mockResolvedValue({
    providerId: 'elevenlabs',
    model: 'eleven_text_to_sound_v2',
    kind: 'sfx',
    bytes: Buffer.from('mp3-bytes'),
    contentType: 'audio/mpeg',
    ext: '.mp3',
    durationSec: 3,
    elapsedMs: 900,
    costUsd: 0.006,
  });
  upsertEntry.mockResolvedValue({});
  readBrand.mockResolvedValue({ id: 'acme-test' });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('generateAudioAsset', () => {
  it('throws the shared needs-a-provider message when no provider is registered', async () => {
    getActiveProvider.mockReturnValue(null);
    await expect(generateAudioAsset({ kind: 'sfx', prompt: 'x' })).rejects.toThrow(NO_AUDIO_PROVIDER_MESSAGE);
    expect(generate).not.toHaveBeenCalled();
  });

  it('writes the bytes under generated/, registers the entry brand-tagged, and returns the descriptor', async () => {
    const asset = await generateAudioAsset({
      kind: 'sfx',
      prompt: 'A fast Whoosh!',
      durationSec: 3,
      brandId: 'acme-test',
      featureSource: 'agent',
      agentId: 'vidtsx/x',
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'sfx', prompt: 'A fast Whoosh!', durationSec: 3, featureSource: 'agent', agentId: 'vidtsx/x' }),
    );
    expect(asset.relPath).toBe('generated/sfx-a-fast-whoosh.mp3');
    expect(await fs.readFile(path.join(root, asset.relPath), 'utf-8')).toBe('mp3-bytes');
    expect(upsertEntry).toHaveBeenCalledWith(root, 'generated/sfx-a-fast-whoosh.mp3', {
      origin: 'generated',
      description: 'A fast Whoosh!',
      brandId: 'acme-test',
    });
    expect(asset).toMatchObject({
      kind: 'sfx',
      durationSeconds: 3,
      description: 'A fast Whoosh!',
      providerId: 'elevenlabs',
      model: 'eleven_text_to_sound_v2',
      brandId: 'acme-test',
      costUsd: 0.006,
    });
  });

  it('a stale brand degrades to untagged and a second file does not collide', async () => {
    readBrand.mockResolvedValue(null);
    const first = await generateAudioAsset({ kind: 'sfx', prompt: 'click', brandId: 'gone' });
    const second = await generateAudioAsset({ kind: 'sfx', prompt: 'click', brandId: 'gone' });
    expect(first.relPath).toBe('generated/sfx-click.mp3');
    expect(second.relPath).toBe('generated/sfx-click-2.mp3');
    expect(first.brandId).toBeUndefined();
    expect(upsertEntry.mock.calls[0][2]).toEqual({ origin: 'generated', description: 'click' });
  });

  it('defaults the usage attribution to the Studio shot asset', async () => {
    await generateAudioAsset({ kind: 'sfx', prompt: 'click' });
    expect(generate.mock.calls[0][0]).toMatchObject({ featureSource: 'studio-shot-asset' });
  });
});

describe('describeAudioRequest', () => {
  it('uses the prompt, else the plan styles and section names', () => {
    expect(describeAudioRequest({ kind: 'music', prompt: '  a bed  ' })).toBe('a bed');
    expect(
      describeAudioRequest({
        kind: 'music',
        compositionPlan: {
          positiveGlobalStyles: ['lo-fi', 'warm'],
          sections: [{ name: 'intro', durationSec: 5 }, { name: 'loop', durationSec: 20 }],
        },
      }),
    ).toBe('lo-fi, warm — intro → loop');
    expect(describeAudioRequest({ kind: 'sfx' })).toBe('Sound effect');
  });
});
