// The Studio generate_sfx / generate_music tools (W2b): the provider gate
// returns the shared "needs a provider" message, a success files + imports
// and names the asset id for insert_asset, and the arguments reach the
// library step as the engine expects them.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioToolContext } from './types';

const hasAudioProvider = vi.fn();
const generateAudioAsset = vi.fn();
const importLibraryFile = vi.fn();

vi.mock('../../library/generate-audio-asset', () => ({
  NO_AUDIO_PROVIDER_MESSAGE:
    'No audio provider is configured. Ask the user to add an ElevenLabs key in AI → Providers.',
  hasAudioProvider: () => hasAudioProvider(),
  generateAudioAsset: (req: unknown) => generateAudioAsset(req),
}));
vi.mock('./library-import', () => ({
  importLibraryFile: (ctx: unknown, relPath: string) => importLibraryFile(ctx, relPath),
}));
vi.mock('../project-store', () => ({
  loadProject: async () => ({ settings: { brandId: 'acme-test' } }),
}));

const { buildAudioTools } = await import('./audio-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

function makeCtx(): { ctx: StudioToolContext; events: unknown[] } {
  const events: unknown[] = [];
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: (e: unknown) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return { ctx, events };
}

function toolsByName(ctx: StudioToolContext): Record<string, ToolLike> {
  const out: Record<string, ToolLike> = {};
  for (const t of buildAudioTools(ctx) as unknown as ToolLike[]) out[t.name] = t;
  return out;
}

beforeEach(() => {
  hasAudioProvider.mockReset();
  generateAudioAsset.mockReset();
  importLibraryFile.mockReset();
  hasAudioProvider.mockResolvedValue(true);
  generateAudioAsset.mockResolvedValue({
    relPath: 'generated/sfx-a-whoosh.mp3',
    kind: 'sfx',
    durationSeconds: 3,
    description: 'a whoosh',
    providerId: 'elevenlabs',
    model: 'eleven_text_to_sound_v2',
    brandId: 'acme-test',
    costUsd: 0.006,
  });
  importLibraryFile.mockResolvedValue({ id: 'asset-9', kind: 'audio', path: 'C:/lib/generated/sfx-a-whoosh.mp3' });
});

describe('Studio audio tools', () => {
  it('registers generate_sfx and generate_music', () => {
    const { ctx } = makeCtx();
    expect(Object.keys(toolsByName(ctx))).toEqual(['generate_sfx', 'generate_music']);
  });

  it('returns the same needs-a-provider message the video tool pattern uses', async () => {
    hasAudioProvider.mockResolvedValue(false);
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt: 'a whoosh' }, {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe(
      'No audio provider is configured. Ask the user to add an ElevenLabs key in AI → Providers.',
    );
    expect(generateAudioAsset).not.toHaveBeenCalled();
  });

  it('generate_sfx files (brand-tagged, Studio attribution), imports, and names the asset id', async () => {
    const { ctx, events } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler(
      { prompt: 'a whoosh', durationSeconds: 3, promptInfluence: 0.5 },
      {},
    );
    expect(res.isError).toBeUndefined();
    expect(generateAudioAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'sfx',
        prompt: 'a whoosh',
        durationSec: 3,
        promptInfluence: 0.5,
        brandId: 'acme-test',
        featureSource: 'studio-shot-asset',
      }),
    );
    expect(importLibraryFile).toHaveBeenCalledWith(ctx, 'generated/sfx-a-whoosh.mp3');
    expect(res.content[0].text).toContain('project asset id "asset-9"');
    expect(res.content[0].text).toContain('library:generated/sfx-a-whoosh.mp3');
    expect(res.content[0].text).toContain('insert_asset');
    expect(events.some((e) => (e as { kind: string }).kind === 'tool')).toBe(true);
  });

  it('generate_music is instrumental by default, takes a prompt + length, and refuses with neither', async () => {
    const { ctx } = makeCtx();
    const tools = toolsByName(ctx);
    const none = await tools.generate_music.handler({}, {});
    expect(none.isError).toBe(true);
    expect(generateAudioAsset).not.toHaveBeenCalled();

    await tools.generate_music.handler({ prompt: 'warm lo-fi bed', durationSeconds: 30 }, {});
    expect(generateAudioAsset).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'music', prompt: 'warm lo-fi bed', durationSec: 30, instrumental: true }),
    );
  });

  it('relays a failure as an error result', async () => {
    generateAudioAsset.mockRejectedValue(new Error('ElevenLabs returned 422: music_length_ms must be at least 3000'));
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_music.handler({ prompt: 'x', durationSeconds: 3 }, {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('music_length_ms');
  });
});
