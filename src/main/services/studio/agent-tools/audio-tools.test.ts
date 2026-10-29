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
// E3: the reuse lookup reads an EMPTY library here (no match → generates as before); reuse is audio-tools-reuse.test.ts.
const loadIndex = vi.fn();
vi.mock('../../library/library-store', () => ({ loadIndex: (root: string) => loadIndex(root) }));
vi.mock('../../library/library-paths', () => ({ getLibraryRoot: () => 'C:/lib' }));
// Library search (§8.1): the app's runtime is never built here — a Basic search over the (empty) mocked index.
vi.mock('../../library-search/search-app', async () => {
  const { searchLibrary } = await import('../../library-search/library-search');
  const settings = () => ({ choice: 'basic' as const, modelId: 'multilingual-e5-small', modelDownloaded: false });
  return {
    getLibrarySearchRuntime: () => ({
      search: (req: { query: string }) => searchLibrary(req, { loadEntries: async () => (await loadIndex('C:/lib')).entries, settings }),
    }),
  };
});

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
    durationSeconds: 2.973,
    description: 'a whoosh',
    providerId: 'elevenlabs',
    model: 'eleven_text_to_sound_v2',
    brandId: 'acme-test',
    costUsd: 0.006,
    normalized: true,
    loudnessLufs: -20.01,
    peakDbfs: -8.2,
    category: 'motion',
    tags: ['whoosh', 'air'],
  });
  importLibraryFile.mockResolvedValue({ id: 'asset-9', kind: 'audio', path: 'C:/lib/generated/sfx-a-whoosh.mp3' });
  loadIndex.mockReset();
  loadIndex.mockResolvedValue({ version: 1, rev: 2, entries: [], tombstones: [] });
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

  it('generate_sfx files (brand-tagged, Studio attribution, category + tags), imports, and names the asset id with the loudness and the probed length', async () => {
    const { ctx, events } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler(
      { prompt: 'a whoosh', durationSeconds: 3, promptInfluence: 0.5, category: 'motion', tags: ['Whoosh', 'air'] },
      {},
    );
    expect(res.isError).toBeUndefined();
    expect(generateAudioAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'sfx',
        prompt: 'a whoosh',
        durationSec: 3,
        promptInfluence: 0.5,
        category: 'motion',
        tags: ['Whoosh', 'air'],
        brandId: 'acme-test',
        featureSource: 'studio-shot-asset',
      }),
    );
    expect(importLibraryFile).toHaveBeenCalledWith(ctx, 'generated/sfx-a-whoosh.mp3');
    const answer = res.content[0].text;
    expect(answer).toContain('project asset id "asset-9"');
    expect(answer).toContain('library:generated/sfx-a-whoosh.mp3');
    expect(answer).toContain('2.97 s');
    expect(answer).toContain('−20.0 LUFS');
    expect(answer).toContain('peak −8.2 dBTP');
    expect(answer).toContain('category: motion');
    expect(answer).toContain('tags: whoosh, air');
    expect(answer).not.toContain('NOT loudness-normalized');
    expect(answer).toContain('insert_asset');
    expect(events.some((e) => (e as { kind: string }).kind === 'tool')).toBe(true);
  });

  it('a generation the normalize step could not level says so honestly and keeps the asset', async () => {
    generateAudioAsset.mockResolvedValue({
      relPath: 'generated/sfx-a-whoosh.mp3',
      kind: 'sfx',
      durationSeconds: 2.973,
      description: 'a whoosh',
      providerId: 'elevenlabs',
      model: 'eleven_text_to_sound_v2',
      normalized: false,
      normalizeError: 'apply failed: x',
      loudnessLufs: -12.3,
      peakDbfs: -0.4,
    });
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt: 'a whoosh' }, {});
    expect(res.isError).toBeUndefined();
    const answer = res.content[0].text;
    expect(answer).toContain('project asset id "asset-9"');
    expect(answer).toContain('NOT loudness-normalized (apply failed: x) — the raw file is kept');
    expect(answer).not.toContain('LUFS');
  });

  it('a gated clip (too short / too quiet for a loudness reading) says it was peak-normalized and gives the peak (N5)', async () => {
    generateAudioAsset.mockResolvedValue({
      relPath: 'generated/sfx-a-tick.mp3',
      kind: 'sfx',
      durationSeconds: 0.25,
      description: 'a tick',
      providerId: 'elevenlabs',
      model: 'eleven_text_to_sound_v2',
      normalized: true,
      loudnessGated: true,
      peakDbfs: -1.62,
    });
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt: 'a tick' }, {});
    const answer = res.content[0].text;
    expect(answer).toContain(
      '(library:generated/sfx-a-tick.mp3, 0.25 s). Peak-normalized to −1.6 dBTP — too short or too quiet for a loudness (LUFS) reading.',
    );
    expect(answer).not.toContain('Loudness peak');
  });

  it('generate_music is instrumental by default, takes a prompt + length + category + tags, and refuses with neither prompt nor plan', async () => {
    const { ctx } = makeCtx();
    const tools = toolsByName(ctx);
    const none = await tools.generate_music.handler({}, {});
    expect(none.isError).toBe(true);
    expect(generateAudioAsset).not.toHaveBeenCalled();

    const res = await tools.generate_music.handler(
      { prompt: 'warm lo-fi bed', durationSeconds: 30, category: 'bed', tags: ['Lo-Fi', 'warm'] },
      {},
    );
    expect(generateAudioAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'music',
        prompt: 'warm lo-fi bed',
        durationSec: 30,
        instrumental: true,
        category: 'bed',
        tags: ['Lo-Fi', 'warm'],
      }),
    );
    expect(res.content[0].text).toContain('−20.0 LUFS');
  });

  it('relays a failure as an error result', async () => {
    generateAudioAsset.mockRejectedValue(new Error('ElevenLabs returned 422: music_length_ms must be at least 3000'));
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_music.handler({ prompt: 'x', durationSeconds: 3 }, {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('music_length_ms');
  });
});
