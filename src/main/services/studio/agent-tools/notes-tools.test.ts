// list_notes / read_note (video-10 gap 7): the list names every note with
// its size, an empty folder says so without erroring, read_note windows a
// long note like get_script, and a bad name surfaces as a tool error.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioToolContext } from './types';

const listNotes = vi.fn();
const readNote = vi.fn();
vi.mock('../project-notes', () => ({
  listNotes: (projectId: string) => listNotes(projectId),
  readNote: (projectId: string, name: string) => readNote(projectId, name),
}));

const { buildNotesTools } = await import('./notes-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

function makeCtx(): { ctx: StudioToolContext; events: unknown[] } {
  const events: unknown[] = [];
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: (e: unknown) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return { ctx, events };
}

function toolsByName(ctx: StudioToolContext): Record<string, ToolLike> {
  const out: Record<string, ToolLike> = {};
  for (const t of buildNotesTools(ctx) as unknown as ToolLike[]) out[t.name] = t;
  return out;
}

beforeEach(() => {
  listNotes.mockReset();
  readNote.mockReset();
});

describe('list_notes', () => {
  it('names every note with its size and emits a tool chip', async () => {
    listNotes.mockResolvedValue([
      { name: 'IMPORT-REPORT.md', size: 1234, updatedAt: Date.UTC(2026, 8, 11, 10, 0) },
      { name: 'plan.md', size: 20, updatedAt: Date.UTC(2026, 9, 1, 9, 30) },
    ]);
    const { ctx, events } = makeCtx();
    const res = await toolsByName(ctx).list_notes.handler({}, {});
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('2 note(s)');
    expect(res.content[0].text).toContain('- IMPORT-REPORT.md (1,234 bytes, updated 2026-09-11 10:00)');
    expect(res.content[0].text).toContain('- plan.md');
    expect(listNotes).toHaveBeenCalledWith('p1');
    expect(events).toEqual([expect.objectContaining({ kind: 'tool', tool: 'list_notes' })]);
  });

  it('says so when there are none', async () => {
    listNotes.mockResolvedValue([]);
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).list_notes.handler({}, {});
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toMatch(/no notes yet/i);
  });
});

describe('read_note', () => {
  it('returns a window and points at the rest', async () => {
    readNote.mockResolvedValue('x'.repeat(7000));
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).read_note.handler({ name: 'plan.md' }, {});
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toMatch(/^plan\.md, chars 0–6000 of 7000: Call again with startChar 6000/);
    expect(readNote).toHaveBeenCalledWith('p1', 'plan.md');
  });

  it('flags a note it cannot read as a tool error', async () => {
    readNote.mockRejectedValue(new Error('Invalid note name: ../x'));
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).read_note.handler({ name: '../x' }, {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Invalid note name');
  });
});
