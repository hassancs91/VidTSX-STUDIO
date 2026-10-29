import { describe, expect, it } from 'vitest';
import type { LibrarySearchResult, LibrarySearchStatus } from './types/library-search';
import {
  effectiveModeLabel,
  modelSizeLabel,
  searchMarkerTitle,
  vectorStateLabel,
} from './library-search-text';

const status = (over: Partial<LibrarySearchStatus> = {}): LibrarySearchStatus => ({
  mode: 'basic',
  choice: 'auto',
  modelId: 'multilingual-e5-small',
  modelDownloaded: false,
  modelBytes: 135_392_016,
  vectors: { ready: 0, total: 0, building: false },
  ...over,
});

const result = (over: Partial<LibrarySearchResult> = {}): LibrarySearchResult => ({
  ran: 'smart',
  requested: 'smart',
  candidates: [],
  poolSize: 51,
  ...over,
});

describe('library search text (design §4 / §8.3)', () => {
  it('names the model size the way the catalog does (decimal MB)', () => {
    expect(modelSizeLabel(135_392_016)).toBe('135 MB');
    expect(modelSizeLabel(0)).toBe('0 MB');
  });

  it('states the vectors: ready, building, or none yet', () => {
    expect(vectorStateLabel({ ready: 51, total: 51, building: false })).toBe('51 / 51 ready');
    expect(vectorStateLabel({ ready: 12, total: 51, building: true })).toBe('building 12 / 51');
    expect(vectorStateLabel({ ready: 0, total: 0, building: false })).toBe('no vectors yet');
  });

  it('names the effective mode and whether it came from Auto', () => {
    expect(effectiveModeLabel(status())).toBe('Basic (auto — model not downloaded)');
    expect(effectiveModeLabel(status({ mode: 'smart', modelDownloaded: true }))).toBe('Smart (auto)');
    expect(effectiveModeLabel(status({ choice: 'basic', modelDownloaded: true }))).toBe('Basic');
    expect(effectiveModeLabel(status({ mode: 'smart', choice: 'smart', modelDownloaded: true }))).toBe('Smart');
    // An explicit Smart without the model runs Basic (resolveSearchMode) — said, not hidden.
    expect(effectiveModeLabel(status({ choice: 'smart' }))).toBe('Basic (Smart needs the model — not downloaded)');
  });

  it('the marker tooltip names the mode and the vector state', () => {
    const s = status({ mode: 'smart', modelDownloaded: true, vectors: { ready: 51, total: 51, building: false } });
    expect(searchMarkerTitle(s, null)).toBe('Library search: Smart (auto) — words + meaning · vectors 51 / 51 ready');
    const building = { ...s, vectors: { ready: 12, total: 51, building: true } };
    expect(searchMarkerTitle(building, result())).toBe(
      'Library search: Smart (auto) — words + meaning · vectors building 12 / 51'
    );
  });

  it('the marker tooltip says when this search fell back to words only', () => {
    const s = status({ mode: 'smart', modelDownloaded: true, vectors: { ready: 51, total: 51, building: false } });
    expect(searchMarkerTitle(s, result({ ran: 'basic', degraded: 'model loading' }))).toBe(
      'Library search: Smart (auto) — words + meaning · vectors 51 / 51 ready · this search ran words only: model loading'
    );
  });
});
