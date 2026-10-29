// THE NO-CLAIM AND NOTHING-FITS BAR (LIBRARY_SEARCH_DESIGN.md §9.1) through the REAL generate_sfx / generate_music
// handlers: every scored row of S1's labelled set (1,515) in Basic and in Smart (the committed fixture vectors), over
// the 51-clip catalog. Every line of every answer except the rows' quoted clip descriptions carries none of the claim
// strings; every answer has the neutral header and the `force: true` line; Smart generates exactly on the rows whose
// pool is empty, Basic exactly on its true misses — the mocked provider's call counter proves each.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { LibrarySearchRequest, LibrarySearchResult } from '../../../../shared/types/library-search';
import { CORPUS_LIBRARY } from '../../library/sound-match-corpus.fixture';
import { searchLibrary } from '../../library-search/library-search';
import { searchPool } from '../../library-search/search-pool';
import { benchDeps, isScored, type BenchRow } from '../../library-search/benchmark/benchmark-measure';
import { fixtureRanker, loadFixtureVectors, loadLabelledSet } from '../../library-search/benchmark/benchmark-fixture';
import type { StudioToolContext } from './types';

const generateAudioAsset = vi.fn();
const search = vi.fn();

vi.mock('../../library/generate-audio-asset', () => ({
  NO_AUDIO_PROVIDER_MESSAGE: 'No audio provider is configured.',
  hasAudioProvider: async () => true,
  generateAudioAsset: (req: unknown) => generateAudioAsset(req),
}));
vi.mock('./library-import', () => ({ importLibraryFile: async () => ({ id: 'asset-9', kind: 'audio', path: 'C:/lib/g.mp3' }) }));
vi.mock('../project-store', () => ({ loadProject: async () => ({ settings: {} }) }));
vi.mock('../../library/library-store', () => ({
  loadIndex: async () => ({ version: 1, rev: 1, entries: CORPUS_LIBRARY, tombstones: [] }),
}));
vi.mock('../../library/library-paths', () => ({ getLibraryRoot: () => 'C:/lib' }));
vi.mock('../../library-search/search-app', () => ({
  getLibrarySearchRuntime: () => ({ search: (req: LibrarySearchRequest) => search(req) }),
}));

const { buildAudioTools } = await import('./audio-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

const CLAIMS = ['already has', 'matching', '[matched]', '[weak match]', '[closest]', 'may have'] as const;

/** The claim strings in an answer, ignoring each row's quoted clip description (`— "…"`). */
function claimsIn(text: string): string[] {
  const lines = text.split('\n').map((l) => (l.startsWith('- ') ? l.replace(/ — ".*"/, ' — ""') : l).toLowerCase());
  return CLAIMS.filter((c) => lines.some((l) => l.includes(c)));
}

interface Outcome {
  row: BenchRow;
  text: string;
  generated: boolean;
  result: LibrarySearchResult;
}

const rows = loadLabelledSet().filter(isScored);
const fx = loadFixtureVectors();
const outcomes: Record<'basic' | 'smart', Outcome[]> = { basic: [], smart: [] };

async function runAll(mode: 'basic' | 'smart'): Promise<Outcome[]> {
  const deps = benchDeps(CORPUS_LIBRARY, mode, mode === 'smart' ? fixtureRanker(fx) : undefined);
  let last: LibrarySearchResult | null = null;
  search.mockImplementation(async (req: LibrarySearchRequest) => {
    last = await searchLibrary(req, deps);
    return last;
  });
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: () => undefined,
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  const tools: Record<string, ToolLike> = {};
  for (const t of buildAudioTools(ctx) as unknown as ToolLike[]) tools[t.name] = t;
  const out: Outcome[] = [];
  for (const row of rows) {
    last = null;
    const before = generateAudioAsset.mock.calls.length;
    const res = row.cls === 'sfx'
      ? await tools.generate_sfx.handler({ prompt: row.prompt }, {})
      : await tools.generate_music.handler({ prompt: row.prompt, ...(row.min !== undefined ? { durationSeconds: row.min } : {}) }, {});
    if (!last) throw new Error(`row #${row.id} never searched: ${res.content[0].text.slice(0, 80)}`);
    out.push({ row, text: res.content[0].text, generated: generateAudioAsset.mock.calls.length > before, result: last });
  }
  return out;
}

beforeAll(async () => {
  generateAudioAsset.mockResolvedValue({
    relPath: 'generated/x.mp3', kind: 'sfx', durationSeconds: 1, description: 'x', providerId: 'elevenlabs', model: 'm', normalized: true,
  });
  outcomes.basic = await runAll('basic');
  outcomes.smart = await runAll('smart');
}, 300_000);

const header = (prompt: string): string =>
  `Library sounds that may fit "${prompt}" — found by search (words + meaning), NOT checked; nothing was generated (no cost). Read each description and pick by plain meaning: a clip fits only if it IS the sound asked for — a loosely related or merely similar clip is not a fit.`;
const forceLine = (row: BenchRow): string =>
  `If one fits, place it with insert_asset(assetId: "library:<path>", lane: "audio", at: …). If none fits, call ${row.cls === 'sfx' ? 'generate_sfx' : 'generate_music'} again with force: true.`;

describe.each(['basic', 'smart'] as const)('§9.1 no claim + nothing fits — %s, every scored row', (mode) => {
  it('runs all 1,515 scored rows', () => {
    expect(outcomes[mode]).toHaveLength(1515);
    if (mode === 'smart') expect(outcomes.smart.every((o) => o.result.ran === 'smart' && !o.result.degraded)).toBe(true);
    if (mode === 'basic') expect(outcomes.basic.every((o) => o.result.ran === 'basic')).toBe(true);
  });

  it('no answer carries a claim string; every answer has the neutral header, the force: true line and its rows in the search\'s order', () => {
    const bad: string[] = [];
    for (const o of outcomes[mode].filter((x) => !x.generated)) {
      const lines = o.text.split('\n');
      const rowsShown = lines.filter((l) => l.startsWith('- library:'));
      const order = o.result.candidates.map((c) => `- library:${c.relPath} `);
      const ok = claimsIn(o.text).length === 0 && lines[0] === header(o.row.prompt) && lines[lines.length - 1] === forceLine(o.row)
        && rowsShown.length === o.result.candidates.length && rowsShown.every((l, i) => l.startsWith(order[i]));
      if (!ok) bad.push(`#${o.row.id} ${o.row.prompt}: ${claimsIn(o.text).join(', ')}`);
    }
    expect(bad).toEqual([]);
  });

  it(mode === 'smart'
    ? 'Smart generates without force exactly when the pool is empty (poolSize 0) — never on a non-empty pool'
    : 'Basic generates without force exactly on a true miss (no candidate scores)', () => {
    const wrong = outcomes[mode].filter((o) => {
      const pool = searchPool(CORPUS_LIBRARY, { query: o.row.prompt, kinds: ['audio'], soundClass: o.row.cls, ...(o.row.min !== undefined ? { minDurationSec: o.row.min } : {}) });
      const shouldGenerate = mode === 'smart' ? pool.length === 0 : o.result.candidates.length === 0;
      return o.generated !== shouldGenerate || (mode === 'smart' && pool.length > 0 && o.result.candidates.length !== Math.min(20, pool.length));
    });
    expect(wrong.map((o) => `#${o.row.id} ${o.row.prompt}`)).toEqual([]);
  });
});
