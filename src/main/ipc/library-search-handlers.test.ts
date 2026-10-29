import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import type { LibrarySearchResult, LibrarySearchStatus } from '../../shared/types/library-search';

// The library-search IPC handlers (LIBRARY_SEARCH_DESIGN.md §10): every body in try/catch with a typed error —
// a throwing runtime never rejects the invoke.
const STATUS: LibrarySearchStatus = {
  mode: 'smart', choice: 'auto', modelId: 'multilingual-e5-small', modelDownloaded: true, modelBytes: 118_000_000,
  vectors: { ready: 51, total: 51, building: false },
};
const RESULT: LibrarySearchResult = { ran: 'smart', requested: 'smart', modelId: 'multilingual-e5-small', candidates: [], poolSize: 0 };

const runtime = {
  search: vi.fn(async () => RESULT),
  status: vi.fn(() => STATUS),
  setSettings: vi.fn(() => STATUS),
};
vi.mock('../services/library-search/search-app', () => ({ getLibrarySearchRuntime: () => runtime }));

const { handleLibrarySearch, handleLibrarySearchStatus, handleLibrarySearchSettingsSet } = await import('./library-search-handlers');
const EVENT = {} as IpcMainInvokeEvent;

beforeEach(() => {
  runtime.search.mockReset().mockImplementation(async () => RESULT);
  runtime.status.mockReset().mockImplementation(() => STATUS);
  runtime.setSettings.mockReset().mockImplementation(() => STATUS);
});

describe('library:search', () => {
  it('answers ok with the service result', async () => {
    const req = { query: 'things falling over', kinds: ['audio' as const], soundClass: 'sfx' as const };
    await expect(handleLibrarySearch(EVENT, req)).resolves.toEqual({ ok: true, result: RESULT });
    expect(runtime.search).toHaveBeenCalledWith(req);
  });

  it('a request without a string query is refused without a search', async () => {
    await expect(handleLibrarySearch(EVENT, { query: 3 } as unknown as { query: string })).resolves.toEqual({ ok: false, error: 'A library search needs a query' });
    expect(runtime.search).not.toHaveBeenCalled();
  });

  it('a throwing service → ok: false with its message', async () => {
    runtime.search.mockImplementation(async () => { throw new Error('index unreadable'); });
    await expect(handleLibrarySearch(EVENT, { query: 'x' })).resolves.toEqual({ ok: false, error: 'index unreadable' });
  });
});

describe('library:search:status', () => {
  it('answers the status', async () => {
    await expect(handleLibrarySearchStatus()).resolves.toEqual(STATUS);
  });

  it('a throwing status → a Basic status carrying the error', async () => {
    runtime.status.mockImplementation(() => { throw new Error('settings db closed'); });
    await expect(handleLibrarySearchStatus()).resolves.toMatchObject({ mode: 'basic', modelDownloaded: false, error: 'settings db closed' });
  });
});

describe('library:search:settings:set', () => {
  it('passes the patch and answers the new status', async () => {
    await expect(handleLibrarySearchSettingsSet(EVENT, { mode: 'basic' })).resolves.toEqual(STATUS);
    expect(runtime.setSettings).toHaveBeenCalledWith({ mode: 'basic' });
  });

  it('a refused patch → the unchanged status carrying the error', async () => {
    runtime.setSettings.mockImplementation(() => { throw new Error('Unknown embedding model: x'); });
    await expect(handleLibrarySearchSettingsSet(EVENT, { modelId: 'x' })).resolves.toEqual({ ...STATUS, error: 'Unknown embedding model: x' });
  });
});
