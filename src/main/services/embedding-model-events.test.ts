import { afterEach, describe, expect, it } from 'vitest';
import { notifyEmbeddingModelChanged, onEmbeddingModelChanged, type EmbeddingModelChange } from './embedding-model-events';

// The embedding download / delete handlers tell main-side users (library search's build after a download,
// LIBRARY_SEARCH_DESIGN.md §5 (3)) that a model arrived or left; a throwing listener never breaks the handler.
const offs: Array<() => void> = [];
afterEach(() => {
  while (offs.length > 0) offs.pop()?.();
});

describe('embedding model change events', () => {
  it('every listener hears each change; unsubscribing stops it; a throwing listener is contained', () => {
    const seen: EmbeddingModelChange[] = [];
    offs.push(onEmbeddingModelChanged(() => { throw new Error('listener broke'); }));
    const off = onEmbeddingModelChanged((e) => { seen.push(e); });
    expect(() => notifyEmbeddingModelChanged({ modelId: 'multilingual-e5-small', change: 'downloaded' })).not.toThrow();
    expect(seen).toEqual([{ modelId: 'multilingual-e5-small', change: 'downloaded' }]);
    off();
    notifyEmbeddingModelChanged({ modelId: 'multilingual-e5-small', change: 'deleted' });
    expect(seen).toHaveLength(1);
  });
});
