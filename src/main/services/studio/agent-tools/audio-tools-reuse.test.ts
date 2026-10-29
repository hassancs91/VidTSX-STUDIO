// Reuse before generate in the Studio generate_sfx / generate_music tools, on the shared library search
// (LIBRARY_SEARCH_DESIGN.md §6 / §8.1; E3's tests rewritten to the new answer): the REAL `searchLibrary` runs over
// a mocked index behind a mocked `search-app` runtime; the answer comes BEFORE the provider check (no provider
// call, no engine, no import), claims nothing (a neutral header, E2's rows in the search's order, the place / force
// lines), and `force` generates without looking.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LibraryIndexEntry } from '../../../../shared/types/asset-library';
import type { LibrarySearchRequest, LibrarySearchResult } from '../../../../shared/types/library-search';
import { searchLibrary } from '../../library-search/library-search';
import type { LibrarySearchDeps } from '../../library-search/types';
import type { StudioToolContext } from './types';

const hasAudioProvider = vi.fn();
const generateAudioAsset = vi.fn();
const importLibraryFile = vi.fn();
const loadIndex = vi.fn();
const search = vi.fn();
const getRuntime = vi.fn();

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
vi.mock('../../library-search/search-app', () => ({ getLibrarySearchRuntime: () => getRuntime() }));

const { buildAudioTools } = await import('./audio-tools');

interface ToolLike {
  name: string;
  description: string;
  inputSchema: Record<string, { description?: string }>;
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
const LIB: LibraryIndexEntry[] = [
  {
    relPath: 'sfx/whoosh-soft.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A short, soft air whoosh for a scene transition. Quick and clean, no metallic ring, no music.',
    probe: { duration: 0.6802, hasAudio: true },
    tags: ['whoosh', 'transition', 'cutaway', 'air', 'swipe', 'motion'],
    audio: { category: 'motion', loudnessLufs: -20, peakDbfs: -1.6, peakKind: 'sample' },
    usedIn: ['video-1', 'proj-e3'],
  },
  {
    relPath: 'sfx/whoosh-wind.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A soft, drawn-out wind whoosh for a gliding transition.',
    probe: { duration: 2.2, hasAudio: true }, tags: ['whoosh', 'wind', 'glide'], audio: { category: 'motion', loudnessLufs: -21.4 },
  },
  {
    relPath: 'sfx/clock-tick-soft.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A soft mechanical chess clock ticking gently, no bell, no music.',
    probe: { duration: 3, hasAudio: true }, tags: ['clock', 'tick', 'tock', 'timer'], audio: { category: 'texture' },
  },
  {
    relPath: 'music/lofi-warm.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A warm, cozy lo-fi downtempo bed.', probe: { duration: 57.05, hasAudio: true },
    tags: ['lofi', 'warm', 'bed'], audio: { category: 'lofi' },
  },
] as LibraryIndexEntry[];

const basicDeps = (): LibrarySearchDeps => ({
  loadEntries: async () => (await loadIndex('C:/lib')).entries,
  settings: () => ({ choice: 'basic', modelId: 'multilingual-e5-small', modelDownloaded: true }),
});

const HEADER = (prompt: string): string =>
  `Library sounds that may fit "${prompt}" — found by search (words + meaning), NOT checked; nothing was generated (no cost). Read each description and pick by plain meaning: a clip fits only if it IS the sound asked for — a loosely related or merely similar clip is not a fit.`;
const PLACE = (tool: string): string =>
  `If one fits, place it with insert_asset(assetId: "library:<path>", lane: "audio", at: …). If none fits, call ${tool} again with force: true.`;

beforeEach(() => {
  for (const f of [hasAudioProvider, generateAudioAsset, importLibraryFile, loadIndex, search, getRuntime]) f.mockReset();
  hasAudioProvider.mockResolvedValue(true);
  generateAudioAsset.mockImplementation(async (req: { kind: string }) => ({
    relPath: `generated/${req.kind}-x.mp3`, kind: req.kind, durationSeconds: 2.973, description: 'x',
    providerId: 'elevenlabs', model: 'm', normalized: true, loudnessLufs: -20.01, peakDbfs: -8.2,
  }));
  importLibraryFile.mockResolvedValue({ id: 'asset-9', kind: 'audio', path: 'C:/lib/generated/x.mp3' });
  loadIndex.mockResolvedValue({ version: 1, rev: 2, entries: LIB, tombstones: [] });
  search.mockImplementation((req: LibrarySearchRequest) => searchLibrary(req, basicDeps()));
  getRuntime.mockReturnValue({ search: (req: LibrarySearchRequest) => search(req) });
});

describe('Studio audio tools — reuse before generate, on the library search (§8.1)', () => {
  it('generate_sfx answers the search BEFORE the provider check — the neutral header, E2 rows in order, the place / force line', async () => {
    hasAudioProvider.mockResolvedValue(false);
    const res = await toolsByName().generate_sfx.handler({ prompt: 'a soft airy whoosh for a transition' }, {});
    expect(res.isError).toBeUndefined();
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(HEADER('a soft airy whoosh for a transition'));
    expect(lines[1]).toBe(
      '- library:sfx/whoosh-soft.mp3 (audio, 0.68 s, imported) — "A short, soft air whoosh for a scene transition. Quick and clean, no metallic ring, no music." · category: motion · tags: whoosh, transition, cutaway, air, swipe, motion · −20.0 LUFS · used in: video-1, proj-e3',
    );
    expect(lines[2]).toMatch(/^- library:sfx\/whoosh-wind\.mp3 \(audio, 2\.20 s, imported\) — "/);
    expect(lines[3]).toMatch(/^- library:sfx\/clock-tick-soft\.mp3 \(audio, 3\.00 s, imported\) — "/);
    expect(lines[4]).toBe(PLACE('generate_sfx'));
    expect(lines).toHaveLength(5);
    expect(search).toHaveBeenCalledWith({ query: 'a soft airy whoosh for a transition', kinds: ['audio'], soundClass: 'sfx', limit: 20 });
    expect(loadIndex).toHaveBeenCalledWith('C:/lib');
    expect(hasAudioProvider).not.toHaveBeenCalled();
    expect(generateAudioAsset).not.toHaveBeenCalled();
    expect(importLibraryFile).not.toHaveBeenCalled();
  });

  it('a degraded search adds one line under the header: "Searched by words only: <reason>"', async () => {
    search.mockImplementation(async (req: LibrarySearchRequest): Promise<LibrarySearchResult> => ({ ...(await searchLibrary(req, basicDeps())), degraded: 'model loading' }));
    const lines = (await toolsByName().generate_sfx.handler({ prompt: 'soft whoosh' }, {})).content[0].text.split('\n');
    expect(lines[0]).toBe(HEADER('soft whoosh'));
    expect(lines[1]).toBe('Searched by words only: model loading');
    expect(lines[2]).toMatch(/^- library:sfx\/whoosh-/);
  });

  it('the runtime failing → Basic over the index the tool read, said in the degraded line (never a generation)', async () => {
    getRuntime.mockImplementation(() => { throw new Error('settings store not ready'); });
    const text = (await toolsByName().generate_sfx.handler({ prompt: 'soft whoosh' }, {})).content[0].text;
    expect(text.split('\n')[1]).toBe('Searched by words only: search engine unavailable');
    expect(text).toContain('library:sfx/whoosh-soft.mp3');
    expect(generateAudioAsset).not.toHaveBeenCalled();
  });

  it('generate_sfx force: true generates and never searches', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'soft whoosh', force: true }, {});
    expect(search).not.toHaveBeenCalled();
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sfx', prompt: 'soft whoosh' }));
    expect(res.content[0].text).toContain('project asset id "asset-9"');
  });

  it('generate_music: a bed is offered (music class, the length rule); force generates; a plan never searches', async () => {
    const tools = toolsByName();
    const reuse = (await tools.generate_music.handler({ prompt: 'warm lo-fi bed' }, {})).content[0].text;
    expect(reuse.split('\n')[0]).toBe(HEADER('warm lo-fi bed'));
    expect(reuse).toContain('- library:music/lofi-warm.mp3 (audio, 57.05 s, imported)');
    expect(reuse.endsWith(PLACE('generate_music'))).toBe(true);
    expect(reuse).not.toContain('whoosh');
    expect(search).toHaveBeenLastCalledWith({ query: 'warm lo-fi bed', kinds: ['audio'], soundClass: 'music', limit: 20 });
    expect(generateAudioAsset).not.toHaveBeenCalled();

    await tools.generate_music.handler({ prompt: 'warm lo-fi bed', durationSeconds: 90 }, {});
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ minDurationSec: 90 }));
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);

    search.mockClear();
    await tools.generate_music.handler({ prompt: 'warm lo-fi bed', force: true }, {});
    await tools.generate_music.handler({ compositionPlan: { sections: [{ name: 'a', durationSec: 10 }] } }, {});
    expect(search).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(3);
  });

  it('a Basic TRUE miss (no word of the prompt in any clip) generates — or, with no provider, says so', async () => {
    const tools = toolsByName();
    await tools.generate_sfx.handler({ prompt: 'a dog bark' }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
    hasAudioProvider.mockResolvedValue(false);
    const none = await tools.generate_sfx.handler({ prompt: 'a dog bark' }, {});
    expect(none.isError).toBe(true);
    expect(none.content[0].text).toContain('No audio provider is configured');
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
  });

  it('an unreadable library index never blocks a generation', async () => {
    loadIndex.mockRejectedValue(new Error('EACCES'));
    await toolsByName().generate_sfx.handler({ prompt: 'soft whoosh' }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
  });

  it('REUSE_NOTE / FORCE_HINT (both tools) say the same as the answer — and claim nothing', () => {
    for (const t of Object.values(toolsByName())) {
      expect(t.description).toContain(
        'It FIRST searches the asset library (words + meaning; no cost, no provider needed): whenever the library has sounds of that kind it returns up to 20 library:<path> refs that may fit (duration, category, tags, loudness, where used, description) INSTEAD of generating — found by search, NOT checked, in search order (the order is not a ranking of fit). Read each description and pick by plain meaning: a clip fits only if it IS the sound asked for. Place one with insert_asset, or call again with force: true if none fits. It generates without force only when the library has no sound of that kind (or, searching by words only, no clip shares a word with the prompt).',
      );
      const force = t.inputSchema.force.description ?? '';
      expect(force).toBe(
        'Generate a new one instead of the library sounds this tool answered — only after it returned library sounds that may fit and none of them IS the sound asked for. Without force the tool answers library sounds whenever the library has sounds of that kind.',
      );
      for (const claim of ['already has', 'matching', 'may have', 'weak match', '[matched]', '[closest]', 'up to three']) {
        expect(t.description).not.toContain(claim);
        expect(force).not.toContain(claim);
      }
    }
  });
});
