// "Nothing fits" (LIBRARY_SEARCH_DESIGN.md §6 / §9.1; E3's miss-rule tests rewritten to the library-search answer):
// Basic — a near miss (some word scores) answers the library sounds and generates NOTHING; only a TRUE miss (no
// word of the prompt in any clip) generates. Smart — a non-empty pool always answers; only an empty pool (no audio
// of that class, or none long enough) generates. `force: true` generates in both modes. The mocked
// `generateAudioAsset` is the provider's call counter. The REAL `searchLibrary` behind a mocked `search-app`.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LibraryIndexEntry } from '../../../../shared/types/asset-library';
import type { LibrarySearchRequest } from '../../../../shared/types/library-search';
import { searchLibrary } from '../../library-search/library-search';
import type { SemanticRanker } from '../../library-search/types';
import type { StudioToolContext } from './types';

const hasAudioProvider = vi.fn();
const generateAudioAsset = vi.fn();
const importLibraryFile = vi.fn();
const loadIndex = vi.fn();
const search = vi.fn();

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
vi.mock('../../library/library-store', () => ({ loadIndex: (root: string) => loadIndex(root) }));
vi.mock('../../library/library-paths', () => ({ getLibraryRoot: () => 'C:/lib' }));
vi.mock('../../library-search/search-app', () => ({
  getLibrarySearchRuntime: () => ({ search: (req: LibrarySearchRequest) => search(req) }),
}));

const { buildAudioTools } = await import('./audio-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

function toolsByName(): Record<string, ToolLike> {
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: () => undefined,
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  const out: Record<string, ToolLike> = {};
  for (const t of buildAudioTools(ctx) as unknown as ToolLike[]) out[t.name] = t;
  return out;
}

const AT = '2026-10-28T12:00:00.000Z';
const entry = (relPath: string, duration: number, description: string, tags: string[], category: string): LibraryIndexEntry => ({
  relPath, kind: 'audio', origin: 'imported', addedAt: AT, description, probe: { duration, hasAudio: true }, tags, audio: { category },
});
const SFX = [
  entry('sfx/whoosh-soft.mp3', 0.68, 'A short, soft air whoosh for a scene transition.', ['whoosh', 'air'], 'motion'),
  entry('sfx/clock-tick-soft.mp3', 3, 'A soft mechanical chess clock ticking gently, no bell, no music.', ['clock', 'tick'], 'texture'),
];
const MUSIC = [entry('music/lofi-warm.mp3', 57.05, 'A warm, cozy lo-fi downtempo bed.', ['lofi', 'warm', 'bed'], 'lofi')];

/** Any cosine order — Smart has no similarity floor, so the order does not matter here. */
const anyRanker: SemanticRanker = {
  rank: async (_query, items) => ({ ranked: items.map((it, i) => ({ relPath: it.relPath, cosine: 0.9 - i / 100 })), vectors: { ready: items.length, total: items.length } }),
};

function useLibrary(entries: LibraryIndexEntry[], mode: 'basic' | 'smart'): void {
  loadIndex.mockResolvedValue({ version: 1, rev: 2, entries, tombstones: [] });
  search.mockImplementation((req: LibrarySearchRequest) => searchLibrary(req, {
    loadEntries: async () => entries,
    settings: () => ({ choice: mode, modelId: 'multilingual-e5-small', modelDownloaded: true }),
    ...(mode === 'smart' ? { semantic: anyRanker } : {}),
  }));
}

beforeEach(() => {
  for (const f of [hasAudioProvider, generateAudioAsset, importLibraryFile, loadIndex, search]) f.mockReset();
  hasAudioProvider.mockResolvedValue(true);
  generateAudioAsset.mockImplementation(async (req: { kind: string }) => ({
    relPath: `generated/${req.kind}-x.mp3`, kind: req.kind, durationSeconds: 2.973, description: 'x',
    providerId: 'elevenlabs', model: 'm', normalized: true, loudnessLufs: -20.01, peakDbfs: -8.2,
  }));
  importLibraryFile.mockResolvedValue({ id: 'asset-9', kind: 'audio', path: 'C:/lib/generated/x.mp3' });
  useLibrary([...SFX, ...MUSIC], 'basic');
});

describe('Studio audio tools — nothing fits (§6)', () => {
  it('Basic near miss ("a cuckoo clock chime": only "clock" scores) answers the one clip that scored — nothing generated', async () => {
    const text = (await toolsByName().generate_sfx.handler({ prompt: 'a cuckoo clock chime' }, {})).content[0].text;
    const rows = text.split('\n').filter((l) => l.startsWith('- '));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/^- library:sfx\/clock-tick-soft\.mp3 \(audio, 3\.00 s, imported\)/);
    expect(generateAudioAsset).not.toHaveBeenCalled();
    expect(hasAudioProvider).not.toHaveBeenCalled();
  });

  it('Basic TRUE miss generates once; force: true on a near miss generates once more without searching', async () => {
    const tools = toolsByName();
    await tools.generate_sfx.handler({ prompt: 'a dog bark' }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
    search.mockClear();
    await tools.generate_sfx.handler({ prompt: 'a cuckoo clock chime', force: true }, {});
    expect(search).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(2);
  });

  it('Smart with a non-empty pool never generates without force — even for a prompt no clip shares a word with', async () => {
    useLibrary([...SFX, ...MUSIC], 'smart');
    const text = (await toolsByName().generate_sfx.handler({ prompt: 'a dog bark' }, {})).content[0].text;
    expect(text.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(2);
    expect(text.endsWith('If none fits, call generate_sfx again with force: true.')).toBe(true);
    expect(generateAudioAsset).not.toHaveBeenCalled();
  });

  it('Smart: force: true generates once', async () => {
    useLibrary([...SFX, ...MUSIC], 'smart');
    await toolsByName().generate_sfx.handler({ prompt: 'a soft whoosh', force: true }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
  });

  it('Smart poolSize 0 generates without force: no sfx in the library; no bed long enough', async () => {
    useLibrary(MUSIC, 'smart');
    const tools = toolsByName();
    await tools.generate_sfx.handler({ prompt: 'a soft whoosh' }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
    expect(await search.mock.results[0].value).toMatchObject({ ran: 'smart', poolSize: 0, candidates: [] });

    const bed = (await tools.generate_music.handler({ prompt: 'a warm lo-fi bed', durationSeconds: 30 }, {})).content[0].text;
    expect(bed).toContain('library:music/lofi-warm.mp3');
    await tools.generate_music.handler({ prompt: 'a warm lo-fi bed', durationSeconds: 90 }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(2);
  });
});
