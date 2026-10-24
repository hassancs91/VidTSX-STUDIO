import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generate = vi.fn();
const getActiveProvider = vi.fn();
const upsertEntry = vi.fn();
const readBrand = vi.fn();
const normalizeAudioFile = vi.fn();
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
vi.mock('./audio-normalize', () => ({
  normalizeAudioFile: (...args: unknown[]) => normalizeAudioFile(...args),
}));

const { generateAudioAsset, describeAudioRequest, NO_AUDIO_PROVIDER_MESSAGE } = await import('./generate-audio-asset');

/** The `audio` meta E2 writes for the default mocks (no category). */
const NORMALIZED_AUDIO_META = {
  loudnessLufs: -20.01,
  peakDbfs: -8.2,
  peakKind: 'true',
  source: 'elevenlabs',
  model: 'eleven_text_to_sound_v2',
  gainDb: -8,
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'w2b-audio-'));
  generate.mockReset();
  getActiveProvider.mockReset();
  upsertEntry.mockReset();
  readBrand.mockReset();
  normalizeAudioFile.mockReset();
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
  normalizeAudioFile.mockResolvedValue({
    normalized: true,
    loudnessLufs: -20.01,
    peakDbfs: -8.2,
    gainDb: -8,
    clamped: false,
    gated: false,
    skipped: false,
  });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('generateAudioAsset', () => {
  it('throws the shared needs-a-provider message when no provider is registered', async () => {
    getActiveProvider.mockReturnValue(null);
    await expect(generateAudioAsset({ kind: 'sfx', prompt: 'x' })).rejects.toThrow(NO_AUDIO_PROVIDER_MESSAGE);
    expect(generate).not.toHaveBeenCalled();
    expect(normalizeAudioFile).not.toHaveBeenCalled();
  });

  it('writes the bytes under generated/, normalizes, registers the entry brand-tagged with the audio meta, and returns the descriptor', async () => {
    const signal = new AbortController().signal;
    const asset = await generateAudioAsset({
      kind: 'sfx',
      prompt: 'A fast Whoosh!',
      durationSec: 3,
      brandId: 'acme-test',
      featureSource: 'agent',
      agentId: 'vidtsx/x',
      signal,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'sfx', prompt: 'A fast Whoosh!', durationSec: 3, featureSource: 'agent', agentId: 'vidtsx/x' }),
    );
    expect(asset.relPath).toBe('generated/sfx-a-fast-whoosh.mp3');
    expect(await fs.readFile(path.join(root, asset.relPath), 'utf-8')).toBe('mp3-bytes');
    // The normalize step runs on the written file, with the caller's signal, BEFORE the index sees it.
    expect(normalizeAudioFile).toHaveBeenCalledWith(path.join(root, 'generated', 'sfx-a-fast-whoosh.mp3'), { signal });
    expect(normalizeAudioFile.mock.invocationCallOrder[0]).toBeLessThan(upsertEntry.mock.invocationCallOrder[0]);
    expect(upsertEntry).toHaveBeenCalledWith(root, 'generated/sfx-a-fast-whoosh.mp3', {
      origin: 'generated',
      description: 'A fast Whoosh!',
      brandId: 'acme-test',
      audio: NORMALIZED_AUDIO_META,
    });
    expect(asset).toMatchObject({
      kind: 'sfx',
      durationSeconds: 3,
      description: 'A fast Whoosh!',
      providerId: 'elevenlabs',
      model: 'eleven_text_to_sound_v2',
      brandId: 'acme-test',
      costUsd: 0.006,
      normalized: true,
      loudnessLufs: -20.01,
      peakDbfs: -8.2,
    });
    expect(asset.normalizeError).toBeUndefined();
    expect(asset.tags).toBeUndefined();
    expect(asset.category).toBeUndefined();
  });

  it('a stale brand degrades to untagged and a second file does not collide', async () => {
    readBrand.mockResolvedValue(null);
    const first = await generateAudioAsset({ kind: 'sfx', prompt: 'click', brandId: 'gone' });
    const second = await generateAudioAsset({ kind: 'sfx', prompt: 'click', brandId: 'gone' });
    expect(first.relPath).toBe('generated/sfx-click.mp3');
    expect(second.relPath).toBe('generated/sfx-click-2.mp3');
    expect(first.brandId).toBeUndefined();
    expect(upsertEntry.mock.calls[0][2]).toEqual({ origin: 'generated', description: 'click', audio: NORMALIZED_AUDIO_META });
  });

  it('defaults the usage attribution to the Studio shot asset', async () => {
    await generateAudioAsset({ kind: 'sfx', prompt: 'click' });
    expect(generate.mock.calls[0][0]).toMatchObject({ featureSource: 'studio-shot-asset' });
  });

  it('records category (lower-cased) and tags (trimmed, lower-cased, deduplicated, capped at 20) on the entry and the descriptor', async () => {
    const many = Array.from({ length: 25 }, (_, i) => `t${i}`);
    const asset = await generateAudioAsset({
      kind: 'sfx',
      prompt: 'whoosh',
      category: ' Motion ',
      tags: [' Whoosh', 'air', 'whoosh ', '', '  ', ...many],
    });
    const meta = upsertEntry.mock.calls[0][2] as { tags?: string[]; audio?: { category?: string } };
    expect(meta.audio?.category).toBe('motion');
    expect(meta.tags).toEqual(['whoosh', 'air', ...many.slice(0, 18)]);
    expect(meta.tags).toHaveLength(20);
    expect(asset.category).toBe('motion');
    expect(asset.tags).toEqual(meta.tags);
  });

  it('a failed normalize keeps the raw file, records the reason on the entry and says so in the descriptor', async () => {
    normalizeAudioFile.mockResolvedValue({
      normalized: false,
      loudnessLufs: -12.3,
      peakDbfs: -0.4,
      gainDb: 0,
      clamped: false,
      gated: false,
      skipped: false,
      error: 'apply failed: x',
    });
    const asset = await generateAudioAsset({ kind: 'sfx', prompt: 'click' });
    expect(await fs.readFile(path.join(root, asset.relPath), 'utf-8')).toBe('mp3-bytes');
    expect(upsertEntry.mock.calls[0][2]).toEqual({
      origin: 'generated',
      description: 'click',
      audio: {
        loudnessLufs: -12.3,
        peakDbfs: -0.4,
        peakKind: 'true',
        source: 'elevenlabs',
        model: 'eleven_text_to_sound_v2',
        gainDb: 0,
        normalizeError: 'apply failed: x',
      },
    });
    expect(asset).toMatchObject({ normalized: false, normalizeError: 'apply failed: x', loudnessLufs: -12.3, peakDbfs: -0.4 });
  });

  it('durationSeconds is the index probe’s duration when the upsert returns one, else the engine’s figure', async () => {
    upsertEntry.mockResolvedValue({ probe: { duration: 2.973 } });
    const probed = await generateAudioAsset({ kind: 'sfx', prompt: 'click' });
    expect(probed.durationSeconds).toBe(2.973);

    upsertEntry.mockResolvedValue({ probe: { codec: 'mp3' } });
    const unprobed = await generateAudioAsset({ kind: 'sfx', prompt: 'click' });
    expect(unprobed.durationSeconds).toBe(3);
  });

  it('the music path carries the engine’s model and provider into audio.source / audio.model', async () => {
    generate.mockResolvedValue({
      providerId: 'standin',
      model: 'standin',
      kind: 'music',
      bytes: Buffer.from('mp3-bytes'),
      contentType: 'audio/mpeg',
      ext: '.mp3',
      durationSec: 30,
      elapsedMs: 10,
      costUsd: 0,
    });
    const asset = await generateAudioAsset({ kind: 'music', prompt: 'warm bed', category: 'bed' });
    expect(asset.relPath).toBe('generated/music-warm-bed.mp3');
    expect(upsertEntry.mock.calls[0][2]).toMatchObject({ audio: { source: 'standin', model: 'standin', category: 'bed' } });
    expect(asset.costUsd).toBe(0);
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
