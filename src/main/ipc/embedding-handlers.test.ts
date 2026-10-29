import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';

// LS-r3 (orchestrator ruling, 2026-10-29): `embedding:model:delete` runs the before-delete hooks (library search unloads
// its engine child — on Windows an open handle could make the delete fail) and waits for them BEFORE the model's files
// are deleted; the `deleted` change event follows a successful delete only.
const order: string[] = [];
const deleteEmbeddingModel = vi.fn(async (id: string) => {
  order.push(`delete ${id}`);
});
vi.mock('../services/embedding-models', () => ({
  getEmbeddingModelsDir: () => 'M',
  getEmbeddingModelDir: (id: string) => `M/${id}`,
  isEmbeddingModelDownloaded: () => true,
  deleteEmbeddingModel,
}));
vi.mock('../services/download-manager', () => ({ enqueueDownload: vi.fn() }));
vi.mock('../../embedding-engine', () => ({ embeddingEngine: {} }));
vi.mock('../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const { handleEmbeddingModelDelete } = await import('./embedding-handlers');
const events = await import('../services/embedding-model-events');
const EVENT = {} as IpcMainInvokeEvent;
const offs: Array<() => void> = [];

beforeEach(() => {
  order.length = 0;
  deleteEmbeddingModel.mockClear();
  offs.push(events.onEmbeddingModelChanged((c) => { order.push(`${c.change} ${c.modelId}`); }));
});
afterEach(() => {
  while (offs.length > 0) offs.pop()?.();
});

describe('embedding:model:delete — the before-delete hooks (LS-r3)', () => {
  it('waits for every hook before the files are deleted; then the deleted event', async () => {
    offs.push(events.onBeforeEmbeddingModelDelete(async (id) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push(`unload ${id}`);
    }));
    const res = await handleEmbeddingModelDelete(EVENT, { modelId: 'multilingual-e5-small' });
    expect(res).toEqual({ success: true });
    expect(order).toEqual(['unload multilingual-e5-small', 'delete multilingual-e5-small', 'deleted multilingual-e5-small']);
  });

  it('a hook that fails never blocks the delete', async () => {
    offs.push(events.onBeforeEmbeddingModelDelete(async () => { throw new Error('unload failed'); }));
    const res = await handleEmbeddingModelDelete(EVENT, { modelId: 'multilingual-e5-small' });
    expect(res).toEqual({ success: true });
    expect(deleteEmbeddingModel).toHaveBeenCalledTimes(1);
  });

  it('a failed delete answers the typed error and sends no deleted event', async () => {
    deleteEmbeddingModel.mockImplementationOnce(async () => { throw new Error('EBUSY: resource busy or locked'); });
    const res = await handleEmbeddingModelDelete(EVENT, { modelId: 'multilingual-e5-small' });
    expect(res).toEqual({ success: false, error: 'EBUSY: resource busy or locked' });
    expect(order).toEqual([]);
  });
});
