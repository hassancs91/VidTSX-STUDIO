import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SEARCH_MODEL_ID, getLibrarySearchSettings, setLibrarySearchSettings } from './search-settings';

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../settings-db', () => ({
  getValue: (key: string) => store.get(key),
  setValue: (key: string, value: unknown) => {
    if (value === undefined) store.delete(key);
    else store.set(key, value);
  },
}));

describe('library-search settings (the settings KV store, §4)', () => {
  beforeEach(() => store.clear());

  it('defaults to auto with multilingual-e5-small', () => {
    expect(DEFAULT_SEARCH_MODEL_ID).toBe('multilingual-e5-small');
    expect(getLibrarySearchSettings()).toEqual({ choice: 'auto', modelId: 'multilingual-e5-small' });
  });

  it('stores an explicit choice under librarySearchMode and auto as unset', () => {
    setLibrarySearchSettings({ mode: 'basic' });
    expect(store.get('librarySearchMode')).toBe('basic');
    expect(getLibrarySearchSettings().choice).toBe('basic');
    setLibrarySearchSettings({ mode: 'auto' });
    expect(store.has('librarySearchMode')).toBe(false);
    expect(getLibrarySearchSettings().choice).toBe('auto');
  });

  it('stores the model id under librarySearchModelId and leaves the other key alone', () => {
    setLibrarySearchSettings({ mode: 'smart' });
    setLibrarySearchSettings({ modelId: 'multilingual-e5-base' });
    expect(getLibrarySearchSettings()).toEqual({ choice: 'smart', modelId: 'multilingual-e5-base' });
  });

  it('reads an unknown stored value as the default (never trusted)', () => {
    store.set('librarySearchMode', 'turbo');
    store.set('librarySearchModelId', 42);
    expect(getLibrarySearchSettings()).toEqual({ choice: 'auto', modelId: 'multilingual-e5-small' });
  });

  it('rejects an unknown mode or an empty model id', () => {
    expect(() => setLibrarySearchSettings({ mode: 'turbo' as never })).toThrow(/mode/);
    expect(() => setLibrarySearchSettings({ modelId: ' ' })).toThrow(/model/);
  });
});
