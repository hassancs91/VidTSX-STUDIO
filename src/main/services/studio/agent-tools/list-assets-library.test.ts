// list_assets(scope: "library", query) on the shared library search (LIBRARY_SEARCH_DESIGN.md §8.2, LS-r6): the REAL
// `searchLibrary` runs over a mocked index behind a mocked `search-app` runtime. With a query: a header naming what ran,
// E2's rows in the search's order (≤ 20) — Basic lists only keyword hits, Smart every candidate; without one: today's
// listing, unchanged. Project scope: unchanged.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LibraryIndexEntry } from '../../../../shared/types/asset-library';
import type { LibrarySearchRequest, LibrarySearchResult } from '../../../../shared/types/library-search';
import { searchLibrary } from '../../library-search/library-search';
import type { LibrarySearchDeps } from '../../library-search/types';
import { formatLibraryListing, formatLibraryRow } from './library-listing';
import type { StudioToolContext } from './types';

const loadIndex = vi.fn();
const search = vi.fn();
const getRuntime = vi.fn();

vi.mock('../project-store', () => ({ loadProject: async () => ({ settings: {} }) }));
vi.mock('../project-brand', () => ({ resolveProjectBrand: async () => null }));
vi.mock('../../library/library-store', () => ({ loadIndex: (root: string) => loadIndex(root) }));
vi.mock('../../library/library-paths', () => ({ getLibraryRoot: () => 'C:/lib' }));
vi.mock('../../library-search/search-app', () => ({ getLibrarySearchRuntime: () => getRuntime() }));

const { buildProjectTools } = await import('./project-tools');

interface ToolLike {
  name: string;
  inputSchema: Record<string, { description?: string }>;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

function listAssets(assets: unknown[] = []): ToolLike {
  const ctx = {
    req: { projectId: 'p1', assets, reviewOpen: false },
    signal: new AbortController().signal,
    emit: () => undefined,
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  const found = (buildProjectTools(ctx) as unknown as ToolLike[]).find((t) => t.name === 'list_assets');
  if (!found) throw new Error('list_assets not built');
  return found;
}

const AT = '2026-10-29T12:00:00.000Z';
const LIB: LibraryIndexEntry[] = [
  {
    relPath: 'sfx/whoosh-soft.mp3', kind: 'audio', origin: 'imported', addedAt: AT, description: 'A short, soft air whoosh.',
    probe: { duration: 0.6802, hasAudio: true }, tags: ['whoosh', 'air'], audio: { category: 'motion', loudnessLufs: -20 },
  },
  {
    relPath: 'sfx/whoosh-wind.mp3', kind: 'audio', origin: 'imported', addedAt: AT, description: 'A drawn-out wind whoosh.',
    probe: { duration: 2.2, hasAudio: true }, tags: ['whoosh', 'wind'],
  },
  {
    relPath: 'sfx/clock-tick-soft.mp3', kind: 'audio', origin: 'imported', addedAt: AT, description: 'A soft chess clock ticking.',
    probe: { duration: 3, hasAudio: true }, tags: ['clock', 'tick'],
  },
  {
    relPath: 'music/lofi-warm.mp3', kind: 'audio', origin: 'imported', addedAt: AT, description: 'A warm, cozy lo-fi bed.',
    probe: { duration: 57.05, hasAudio: true }, tags: ['lofi', 'bed'],
  },
  { relPath: 'img/swoosh-logo.png', kind: 'image', origin: 'generated', addedAt: AT, description: 'A blue swoosh logo, soft edges.' },
  { relPath: 'presets/soft-whoosh/preset.json', kind: 'data', origin: 'imported', addedAt: AT, description: 'soft whoosh preset' },
] as LibraryIndexEntry[];

const basicDeps = (): LibrarySearchDeps => ({
  loadEntries: async () => (await loadIndex('C:/lib')).entries,
  settings: () => ({ choice: 'basic', modelId: 'multilingual-e5-small', modelDownloaded: true }),
});
const smartDeps = (): LibrarySearchDeps => ({
  ...basicDeps(),
  settings: () => ({ choice: 'smart', modelId: 'multilingual-e5-small', modelDownloaded: true }),
  semantic: {
    rank: async (_q, items) => ({
      ranked: [...items].reverse().map((it, i) => ({ relPath: it.relPath, cosine: 0.9 - i / 100 })),
      vectors: { ready: items.length, total: items.length },
    }),
  },
});

const RANKED = (how: 'words only' | 'words + meaning'): string =>
  `Ranked by search (${how}) — check the descriptions; the order is not a ranking of fit`;

/** The rows the answer must show: E2's row per candidate, in the search's order. */
function rowsOf(result: LibrarySearchResult, entries: LibraryIndexEntry[] = LIB): string[] {
  return result.candidates.map((c) => {
    const entry = entries.find((e) => e.relPath === c.relPath);
    if (!entry || !entry.kind || entry.kind === 'data') throw new Error(`not a media candidate: ${c.relPath}`);
    return formatLibraryRow(entry, entry.kind as 'audio' | 'video' | 'image', 'library:');
  });
}

const useLibrary = (entries: LibraryIndexEntry[]): void => {
  loadIndex.mockResolvedValue({ version: 1, rev: 2, entries, tombstones: [] });
};

beforeEach(() => {
  for (const f of [loadIndex, search, getRuntime]) f.mockReset();
  useLibrary(LIB);
  search.mockImplementation((req: LibrarySearchRequest) => searchLibrary(req, basicDeps()));
  getRuntime.mockReturnValue({ search: (req: LibrarySearchRequest) => search(req) });
});

describe('list_assets(scope: "library", query) — ranked by the library search (§8.2)', () => {
  it('Basic: "(words only)", E2 rows in the search\'s order; an item sharing no query word is not listed', async () => {
    const res = await listAssets().handler({ scope: 'library', query: 'soft whoosh' }, {});
    expect(res.isError).toBeUndefined();
    expect(search).toHaveBeenCalledWith({ query: 'soft whoosh', limit: 20 });
    const result = (await search.mock.results[0].value) as LibrarySearchResult;
    expect(result.ran).toBe('basic');
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(RANKED('words only'));
    expect(lines.slice(1)).toEqual(rowsOf(result));
    expect(lines.slice(1).length).toBeGreaterThan(0);
    expect(res.content[0].text).not.toContain('lofi-warm');
    expect(res.content[0].text).not.toContain('presets/');
    // ranked by the keyword list, not today's every-word filter: a "soft"-only clip is listed too
    expect(res.content[0].text).toContain('library:sfx/clock-tick-soft.mp3');
  });

  it('Smart: "(words + meaning)", every candidate in the search\'s order — incl. one sharing no word; never a data file', async () => {
    search.mockImplementation((req: LibrarySearchRequest) => searchLibrary(req, smartDeps()));
    const res = await listAssets().handler({ scope: 'library', query: 'soft whoosh' }, {});
    const result = (await search.mock.results[0].value) as LibrarySearchResult;
    expect(result.ran).toBe('smart');
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(RANKED('words + meaning'));
    expect(lines.slice(1)).toEqual(rowsOf(result));
    expect(res.content[0].text).toContain('library:music/lofi-warm.mp3');
    expect(res.content[0].text).not.toContain('presets/');
  });

  it('kind → kinds; the query is passed raw (trimmed, not lower-cased)', async () => {
    await listAssets().handler({ scope: 'library', kind: 'image', query: '  Soft Swoosh ' }, {});
    expect(search).toHaveBeenCalledWith({ query: 'Soft Swoosh', kinds: ['image'], limit: 20 });
    expect(loadIndex).toHaveBeenCalledWith('C:/lib');
  });

  it('at most 20 rows', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      relPath: `sfx/whoosh-${String(i).padStart(2, '0')}.mp3`, kind: 'audio', origin: 'imported', addedAt: AT,
      probe: { duration: 1, hasAudio: true }, tags: ['whoosh'],
    })) as LibraryIndexEntry[];
    useLibrary(many);
    const lines = (await listAssets().handler({ scope: 'library', kind: 'audio', query: 'whoosh' }, {})).content[0].text.split('\n');
    expect(lines).toHaveLength(21);
    expect(lines.slice(1)).toEqual(rowsOf((await search.mock.results[0].value) as LibrarySearchResult, many));
  });

  it('a degraded search: "(words only)" plus "Searched by words only: <reason>"', async () => {
    search.mockImplementation(async (req: LibrarySearchRequest): Promise<LibrarySearchResult> => ({ ...(await searchLibrary(req, basicDeps())), degraded: 'model loading' }));
    const lines = (await listAssets().handler({ scope: 'library', query: 'soft whoosh' }, {})).content[0].text.split('\n');
    expect(lines[0]).toBe(RANKED('words only'));
    expect(lines[1]).toBe('Searched by words only: model loading');
    expect(lines[2]).toMatch(/^- library:sfx\/whoosh-/);
  });

  it('the runtime failing → Basic over the index the tool read, said in the degraded line', async () => {
    getRuntime.mockImplementation(() => { throw new Error('settings store not ready'); });
    const lines = (await listAssets().handler({ scope: 'library', query: 'soft whoosh' }, {})).content[0].text.split('\n');
    expect(lines[0]).toBe(RANKED('words only'));
    expect(lines[1]).toBe('Searched by words only: search engine unavailable');
    expect(lines.join('\n')).toContain('library:sfx/whoosh-soft.mp3');
  });

  it('nothing found → a plain no-result line (no "matching")', async () => {
    const text = (await listAssets().handler({ scope: 'library', kind: 'audio', query: 'zzz qqq' }, {})).content[0].text;
    expect(text).toBe('The library search found nothing for "zzz qqq" (kind: audio).');
    expect(text).not.toMatch(/matching/i);
  });

  it('no query (or a blank one) → today\'s listing, unchanged; the search is never called', async () => {
    const tool = listAssets();
    expect((await tool.handler({ scope: 'library' }, {})).content[0].text).toBe(formatLibraryListing(LIB, {}, 'library:'));
    expect((await tool.handler({ scope: 'library', kind: 'audio', query: '   ' }, {})).content[0].text)
      .toBe(formatLibraryListing(LIB, { kind: 'audio' }, 'library:'));
    expect(search).not.toHaveBeenCalled();
  });

  it('project scope is unchanged: a substring filter over the inventory, never the search', async () => {
    const assets = [
      { id: 'a1', name: 'Soft Whoosh.mp3', kind: 'audio', durationSeconds: 1.5 },
      { id: 'a2', name: 'intro.mp4', kind: 'video', durationSeconds: 12 },
    ];
    const text = (await listAssets(assets).handler({ query: 'whoosh' }, {})).content[0].text;
    expect(text).toBe('- a1 — "Soft Whoosh.mp3" (audio, 1.5 s; no transcript)');
    expect(search).not.toHaveBeenCalled();
    expect(loadIndex).not.toHaveBeenCalled();
  });

  it('the query description says the library scope is ranked by search, not an every-word filter', () => {
    const description = listAssets().inputSchema.query.description ?? '';
    expect(description).toContain('Library scope: ranked by the library search');
    expect(description).not.toContain('EVERY word');
  });
});
