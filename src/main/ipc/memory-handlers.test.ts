// G5 contract for the memory IPC surface: every save over this channel is
// manual entry, so the handler stamps { by: 'user' } provenance itself — the
// renderer has no field to forge agent provenance with — and store failures
// (the rule cap, empty text) come back as typed errors, never throws.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioMemory } from '../../shared/types/studio-memory';

const store = vi.hoisted(() => ({
  listMemories: vi.fn(),
  upsertMemory: vi.fn(),
  setMemoryActive: vi.fn(),
  deleteMemory: vi.fn(),
}));

vi.mock('../services/studio/agent-memory', () => store);

import {
  handleMemoryDelete,
  handleMemoryList,
  handleMemorySave,
  handleMemorySetActive,
} from './memory-handlers';

const event = {} as Parameters<typeof handleMemorySave>[0];

const record: StudioMemory = {
  id: 'm1',
  kind: 'rule',
  text: 'Cut filler tight',
  active: true,
  source: { by: 'user' },
  createdAt: '2026-08-17T00:00:00.000Z',
  updatedAt: '2026-08-17T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleMemorySave', () => {
  it('stamps user provenance — the renderer cannot supply a source', async () => {
    store.upsertMemory.mockResolvedValue(record);
    const res = await handleMemorySave(event, { kind: 'rule', text: 'Cut filler tight' });
    expect(res).toEqual({ success: true, memory: record });
    expect(store.upsertMemory).toHaveBeenCalledWith({
      kind: 'rule',
      text: 'Cut filler tight',
      source: { by: 'user' },
    });
  });

  it('passes id and aliases through on edit', async () => {
    store.upsertMemory.mockResolvedValue(record);
    await handleMemorySave(event, {
      id: 'm1',
      kind: 'vocabulary',
      text: 'LearnWithHasan',
      aliases: ['learn with Hassan'],
    });
    expect(store.upsertMemory).toHaveBeenCalledWith({
      id: 'm1',
      kind: 'vocabulary',
      text: 'LearnWithHasan',
      aliases: ['learn with Hassan'],
      source: { by: 'user' },
    });
  });

  it('returns store failures (e.g. the rule cap) as typed errors', async () => {
    store.upsertMemory.mockRejectedValue(new Error('You already have 50 active rules'));
    const res = await handleMemorySave(event, { kind: 'rule', text: 'One more' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('50 active rules');
  });
});

describe('handleMemoryList', () => {
  it('returns the stored records', async () => {
    store.listMemories.mockResolvedValue([record]);
    expect(await handleMemoryList()).toEqual({ success: true, memories: [record] });
  });

  it('maps a read failure to a typed error', async () => {
    store.listMemories.mockRejectedValue(new Error('disk gone'));
    expect(await handleMemoryList()).toEqual({ success: false, error: 'disk gone' });
  });
});

describe('handleMemorySetActive / handleMemoryDelete', () => {
  it('toggles and returns the updated record', async () => {
    const off = { ...record, active: false };
    store.setMemoryActive.mockResolvedValue(off);
    const res = await handleMemorySetActive(event, { id: 'm1', active: false });
    expect(store.setMemoryActive).toHaveBeenCalledWith('m1', false);
    expect(res).toEqual({ success: true, memory: off });
  });

  it('surfaces the cap error on re-activation', async () => {
    store.setMemoryActive.mockRejectedValue(new Error('Deactivate one to make room.'));
    const res = await handleMemorySetActive(event, { id: 'm1', active: true });
    expect(res.success).toBe(false);
    expect(res.error).toContain('make room');
  });

  it('deletes by id', async () => {
    store.deleteMemory.mockResolvedValue(undefined);
    expect(await handleMemoryDelete(event, { id: 'm1' })).toEqual({ success: true });
    expect(store.deleteMemory).toHaveBeenCalledWith('m1');
  });
});
