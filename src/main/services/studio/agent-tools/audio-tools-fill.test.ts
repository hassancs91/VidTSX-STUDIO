// The answer over the committed 51-clip catalog fixture (E3's fill tests rewritten to the library-search answer,
// LIBRARY_SEARCH_DESIGN.md §8.1 / §9.1): the REAL generate_sfx / generate_music handlers, the REAL `searchLibrary`
// behind a mocked `search-app` runtime — Basic = the keyword list (its first three = E3's `selectSoundAnswer`
// three, the rest by coverage), Smart = keywords + the fixture's multilingual-e5-small vectors fused (RRF). Rows are
// E2's, unlabelled, in the search's order; nothing generated, no provider check. The engine and the normalizer
// live behind the mocked `generateAudioAsset`.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LibrarySearchRequest } from '../../../../shared/types/library-search';
import { CORPUS_LIBRARY } from '../../library/sound-match-corpus.fixture';
import { rankLibrarySounds } from '../../library/sound-match';
import { selectSoundAnswer } from '../../library/sound-answer';
import { searchLibrary } from '../../library-search/library-search';
import { searchPool } from '../../library-search/search-pool';
import { benchDeps } from '../../library-search/benchmark/benchmark-measure';
import { fixtureRanker, loadFixtureVectors } from '../../library-search/benchmark/benchmark-fixture';
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

const fx = loadFixtureVectors();
const useMode = (mode: 'basic' | 'smart'): void => {
  const deps = benchDeps(CORPUS_LIBRARY, mode, mode === 'smart' ? fixtureRanker(fx) : undefined);
  search.mockImplementation((req: LibrarySearchRequest) => searchLibrary(req, deps));
};

beforeEach(() => {
  for (const f of [hasAudioProvider, generateAudioAsset, importLibraryFile, loadIndex, search]) f.mockReset();
  hasAudioProvider.mockResolvedValue(false);
  generateAudioAsset.mockResolvedValue({
    relPath: 'generated/sfx-x.mp3', kind: 'sfx', durationSeconds: 2.973, description: 'x',
    providerId: 'elevenlabs', model: 'm', normalized: true, loudnessLufs: -20.01, peakDbfs: -8.2,
  });
  importLibraryFile.mockResolvedValue({ id: 'asset-9', kind: 'audio', path: 'C:/lib/generated/x.mp3' });
  loadIndex.mockResolvedValue({ version: 1, rev: 2, entries: CORPUS_LIBRARY, tombstones: [] });
  useMode('basic');
});

/** The clip ids of the answer's rows, in order (a row is E2's `- library:<path> (audio, …` line, never labelled). */
function rowIds(text: string): string[] {
  return text.split('\n').filter((l) => l.startsWith('- ')).map((l) => {
    const m = /^- library:(?:sfx|music)\/([a-z0-9-]+)\.mp3 \(audio, /.exec(l);
    return m ? m[1] : `BAD ROW ${l.slice(0, 40)}`;
  });
}
const idOf = (relPath: string): string => (relPath.split('/').pop() ?? '').replace(/\.mp3$/, '');

function expectNothingGenerated(): void {
  expect(hasAudioProvider).not.toHaveBeenCalled();
  expect(generateAudioAsset).not.toHaveBeenCalled();
  expect(importLibraryFile).not.toHaveBeenCalled();
}

describe('Studio audio tools — the search answer over the 51-clip catalog (§8.1)', () => {
  it.each(['a cracked screen', 'a scribbled note', 'a breaking screen', 'running water', 'a whooshing screen'])(
    'Basic "%s": the first three rows are E3\'s selectSoundAnswer three, in order; no labels; nothing generated',
    async (prompt) => {
      const text = (await toolsByName().generate_sfx.handler({ prompt }, {})).content[0].text;
      const e3 = selectSoundAnswer(rankLibrarySounds(CORPUS_LIBRARY, prompt, { soundClass: 'sfx', limit: CORPUS_LIBRARY.length }), prompt);
      expect(rowIds(text).slice(0, 3)).toEqual((e3?.rows ?? []).map((r) => idOf(r.match.entry.relPath)));
      expect(text).not.toMatch(/\[(matched|weak match|closest)\]/);
      expect(text.startsWith(`Library sounds that may fit "${prompt}" — found by search (words + meaning), NOT checked;`)).toBe(true);
      expectNothingGenerated();
    },
  );

  it('Smart "things falling over": crash-tumble among the first 8 rows; min(20, pool) rows; nothing generated', async () => {
    useMode('smart');
    const text = (await toolsByName().generate_sfx.handler({ prompt: 'things falling over' }, {})).content[0].text;
    const ids = rowIds(text);
    expect(ids.slice(0, 8)).toContain('crash-tumble');
    const pool = searchPool(CORPUS_LIBRARY, { query: '', kinds: ['audio'], soundClass: 'sfx' }).length;
    expect(ids).toHaveLength(Math.min(20, pool));
    expect(text.endsWith('If none fits, call generate_sfx again with force: true.')).toBe(true);
    expectNothingGenerated();
  });

  it('Smart answers where Basic has nothing to show: a prompt no clip shares a word with still lists sounds that may fit', async () => {
    useMode('smart');
    const text = (await toolsByName().generate_sfx.handler({ prompt: 'objects toppling over and clattering' }, {})).content[0].text;
    expect(rowIds(text).length).toBeGreaterThan(0);
    expect(rowIds(text).slice(0, 8)).toContain('crash-tumble');
    expectNothingGenerated();
  });

  it('generate_music in Smart: only beds long enough are offered; a plan never searches', async () => {
    useMode('smart');
    const tools = toolsByName();
    const text = (await tools.generate_music.handler({ prompt: 'a warm bed for a cooking show', durationSeconds: 60 }, {})).content[0].text;
    const long = searchPool(CORPUS_LIBRARY, { query: '', kinds: ['audio'], soundClass: 'music', minDurationSec: 60 }).map((e) => idOf(e.relPath));
    expect(rowIds(text).length).toBe(Math.min(20, long.length));
    for (const id of rowIds(text)) expect(long).toContain(id);
    expectNothingGenerated();
    search.mockClear();
    await tools.generate_music.handler({ compositionPlan: { sections: [{ name: 'a', durationSec: 10 }] } }, {});
    expect(search).not.toHaveBeenCalled();
  });
});
