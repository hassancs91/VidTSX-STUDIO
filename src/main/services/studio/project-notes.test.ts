import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let root = '';
vi.mock('./studio-paths', () => ({
  getProjectDir: async (projectId: string) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(projectId)) throw new Error(`Invalid project id: ${projectId}`);
    return path.join(root, projectId);
  },
}));

const { deleteNote, listNotes, normalizeNoteName, readNote, writeNote } = await import('./project-notes');

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-notes-'));
  await fs.mkdir(path.join(root, 'proj'), { recursive: true });
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('normalizeNoteName', () => {
  it('adds .md once and keeps spaces, dashes and inner dots', () => {
    expect(normalizeNoteName('Plan')).toBe('Plan.md');
    expect(normalizeNoteName('plan.md')).toBe('plan.md');
    expect(normalizeNoteName('  QA pass 2.1 ')).toBe('QA pass 2.1.md');
  });

  it('refuses separators, traversal, dot-only and empty names', () => {
    for (const bad of ['../x', 'a/b', 'a\\b', '..', '.', '', '.hidden', 'x'.repeat(81)]) {
      expect(() => normalizeNoteName(bad), bad).toThrow(/Invalid note name/);
    }
  });
});

describe('notes on disk', () => {
  it('lists nothing for a project with no notes folder', async () => {
    expect(await listNotes('proj')).toEqual([]);
  });

  it('writes, lists, reads and deletes a note; the folder appears on first write', async () => {
    const info = await writeNote('proj', 'Import report', '# Report\n\n62/62 shots.');
    expect(info.name).toBe('Import report.md');
    expect(await readNote('proj', 'Import report')).toBe('# Report\n\n62/62 shots.');
    await writeNote('proj', 'todo', '- fix fonts');
    const names = (await listNotes('proj')).map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(['Import report.md', 'todo.md']));
    expect(names).toHaveLength(2);
    await deleteNote('proj', 'todo.md');
    expect((await listNotes('proj')).map((n) => n.name)).toEqual(['Import report.md']);
    await expect(readNote('proj', 'todo')).rejects.toThrow();
  });

  it('ignores non-markdown files and refuses to read outside the folder', async () => {
    await fs.writeFile(path.join(root, 'proj', 'notes', 'frame.png'), 'not a note');
    expect((await listNotes('proj')).map((n) => n.name)).toEqual(['Import report.md']);
    await expect(readNote('proj', '../project.json')).rejects.toThrow(/Invalid note name/);
  });

  it('caps a note at the size limit', async () => {
    await expect(writeNote('proj', 'huge', 'x'.repeat(200_001))).rejects.toThrow(/longer than/);
  });
});
