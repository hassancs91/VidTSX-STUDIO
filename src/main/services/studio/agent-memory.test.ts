import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { MAX_ACTIVE_RULES } from '../../../shared/types/studio-memory';

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import { deleteMemory, listMemories, setMemoryActive, upsertMemory } from './agent-memory';
import { composeMemoryBlock } from './agent-memory-prompt';

const memoryFilePath = () => path.join(tmpDir, 'studio', 'memory.json');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-agent-memory-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await fs.rm(path.join(tmpDir, 'studio'), { recursive: true, force: true });
});

describe('agent-memory store', () => {
  it('starts empty when no file exists', async () => {
    expect(await listMemories()).toEqual([]);
  });

  it('creates a record with id, timestamps, active default, and round-trips through disk', async () => {
    const created = await upsertMemory({ kind: 'rule', text: '  Cut filler tight.  ', source: { by: 'user' } });
    expect(created.id).toBeTruthy();
    expect(created.text).toBe('Cut filler tight.'); // trimmed
    expect(created.active).toBe(true);
    expect(created.createdAt).toBe(created.updatedAt);

    const listed = await listMemories();
    expect(listed).toEqual([created]);
    // Written atomically to the real path — no stray tmp file.
    await expect(fs.access(memoryFilePath())).resolves.toBeUndefined();
    await expect(fs.access(`${memoryFilePath()}.tmp`)).rejects.toThrow();
  });

  it('rejects empty text and unknown update ids', async () => {
    await expect(upsertMemory({ kind: 'rule', text: '   ', source: { by: 'user' } })).rejects.toThrow(
      'needs text',
    );
    await expect(
      upsertMemory({ id: 'nope', kind: 'rule', text: 'x', source: { by: 'user' } }),
    ).rejects.toThrow('Unknown memory id');
  });

  it('update by id replaces text but preserves id, createdAt, source, and active state', async () => {
    const created = await upsertMemory({
      kind: 'rule',
      text: 'Original.',
      source: { by: 'agent', projectId: 'proj-1', acceptedAt: '2026-08-16T00:00:00.000Z' },
    });
    await setMemoryActive(created.id, false);
    const updated = await upsertMemory({
      id: created.id,
      kind: 'rule',
      text: 'Edited.',
      source: { by: 'user' }, // Ignored on update — provenance is immutable.
    });
    expect(updated.id).toBe(created.id);
    expect(updated.text).toBe('Edited.');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.source).toEqual(created.source);
    expect(updated.active).toBe(false);
  });

  it('profile is a singleton: a second profile save edits the existing record', async () => {
    const first = await upsertMemory({ kind: 'profile', text: 'Old profile.', source: { by: 'user' } });
    const second = await upsertMemory({ kind: 'profile', text: 'New profile.', source: { by: 'user' } });
    expect(second.id).toBe(first.id);
    const listed = await listMemories();
    expect(listed.filter((m) => m.kind === 'profile')).toHaveLength(1);
    expect(listed[0].text).toBe('New profile.');
  });

  it('setMemoryActive(false) keeps the record on disk but out of the composed block', async () => {
    const created = await upsertMemory({ kind: 'rule', text: 'Toggle me.', source: { by: 'user' } });
    await setMemoryActive(created.id, false);
    const listed = await listMemories();
    expect(listed).toHaveLength(1);
    expect(listed[0].active).toBe(false);
    expect(composeMemoryBlock(listed).block).toBe('');
    await expect(setMemoryActive('nope', true)).rejects.toThrow('Unknown memory id');
  });

  it('delete removes the record and is idempotent', async () => {
    const created = await upsertMemory({ kind: 'vocabulary', text: 'Name', source: { by: 'user' } });
    await deleteMemory(created.id);
    expect(await listMemories()).toEqual([]);
    await expect(deleteMemory(created.id)).resolves.toBeUndefined();
  });

  it('enforces MAX_ACTIVE_RULES on create and on re-activation; deactivating frees a slot', async () => {
    for (let i = 0; i < MAX_ACTIVE_RULES; i += 1) {
      await upsertMemory({ kind: 'rule', text: `Rule ${i}.`, source: { by: 'user' } });
    }
    await expect(
      upsertMemory({ kind: 'rule', text: 'One too many.', source: { by: 'user' } }),
    ).rejects.toThrow('active rules');

    // Other kinds are not capped.
    await expect(
      upsertMemory({ kind: 'vocabulary', text: 'Name', source: { by: 'user' } }),
    ).resolves.toBeTruthy();

    const victim = (await listMemories()).find((m) => m.kind === 'rule')!;
    await setMemoryActive(victim.id, false);
    const added = await upsertMemory({ kind: 'rule', text: 'Now it fits.', source: { by: 'user' } });
    expect(added.active).toBe(true);
    // The freed slot is taken again — re-activating the victim must fail.
    await expect(setMemoryActive(victim.id, true)).rejects.toThrow('active rules');
  });

  it('corrupt file: set aside as .corrupt, store starts empty, next save works', async () => {
    await fs.mkdir(path.dirname(memoryFilePath()), { recursive: true });
    await fs.writeFile(memoryFilePath(), 'not json {', 'utf-8');
    expect(await listMemories()).toEqual([]);
    await expect(fs.access(`${memoryFilePath()}.corrupt`)).resolves.toBeUndefined();

    const created = await upsertMemory({ kind: 'rule', text: 'Fresh start.', source: { by: 'user' } });
    expect(await listMemories()).toEqual([created]);
  });

  it('invalid records in a valid file are dropped, valid ones kept', async () => {
    const good = await upsertMemory({ kind: 'rule', text: 'Keep me.', source: { by: 'user' } });
    const raw = JSON.parse(await fs.readFile(memoryFilePath(), 'utf-8'));
    raw.memories.push({ id: '', kind: 'rule', text: 'no id' }, { id: 'x', kind: 'bogus', text: 'bad kind' });
    await fs.writeFile(memoryFilePath(), JSON.stringify(raw), 'utf-8');
    expect(await listMemories()).toEqual([good]);
  });
});
