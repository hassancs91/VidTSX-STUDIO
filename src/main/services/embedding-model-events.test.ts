import { afterEach, describe, expect, it } from 'vitest';
import {
  notifyEmbeddingModelChanged,
  onBeforeEmbeddingModelDelete,
  onEmbeddingModelChanged,
  runBeforeEmbeddingModelDelete,
  type EmbeddingModelChange,
} from './embedding-model-events';

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

// LS-r3: work that must finish before a model's files are deleted (library search stops its engine child first).
describe('before-delete hooks', () => {
  it('runBeforeEmbeddingModelDelete waits for every hook; a throwing or rejecting hook is contained', async () => {
    const order: string[] = [];
    offs.push(onBeforeEmbeddingModelDelete(async (id) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push(`slow ${id}`);
    }));
    offs.push(onBeforeEmbeddingModelDelete(() => { throw new Error('hook broke'); }));
    offs.push(onBeforeEmbeddingModelDelete(async () => { throw new Error('hook rejected'); }));
    await expect(runBeforeEmbeddingModelDelete('multilingual-e5-small')).resolves.toBeUndefined();
    order.push('delete');
    expect(order).toEqual(['slow multilingual-e5-small', 'delete']);
  });

  it('an unregistered hook is not run', async () => {
    const seen: string[] = [];
    const off = onBeforeEmbeddingModelDelete((id) => { seen.push(id); });
    off();
    await runBeforeEmbeddingModelDelete('multilingual-e5-small');
    expect(seen).toEqual([]);
  });
});
