// insert_asset's number and { word, take } paths, pinned through the real
// tool handler BEFORE the cut anchor (ASSISTANT_TIMELINE_DESIGN §8.1 5): the
// emitted proposal item, the answer text and the chip. Written green on the
// unchanged insert-tools.ts; the { cut } path is insert-tools-cut.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioAgentAssetInfo } from '../../../../shared/ipc/types/studio';
import type { StudioProposal } from '../../../../shared/types/studio';
import type { StudioToolContext } from './types';

const readTranscriptFile = vi.fn();
const loadProject = vi.fn();

vi.mock('../asset-transcriber', () => ({
  readTranscriptFile: (projectId: string, assetId: string) => readTranscriptFile(projectId, assetId),
}));
vi.mock('../agent-actions', () => ({ agentActions: { request: vi.fn() } }));
vi.mock('../project-store', () => ({ loadProject: (projectId: string) => loadProject(projectId) }));
// Project asset ids only here — a library ref would import (library-import.test.ts covers that).
vi.mock('./library-import', () => ({
  resolveAssetRef: async (ctx: StudioToolContext, ref: string) => {
    if (ctx.req.assets.some((a) => a.id === ref)) return ref;
    throw new Error(`'${ref}' is neither a project asset id nor a 'library:<path>' ref.`);
  },
}));

const { buildInsertTools } = await import('./insert-tools');

interface ToolLike {
  name: string;
  description: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

const E3V_ID = 'ed2cde25-2bfe-4005-a544-adced7e5299c';
const WHOOSH_ID = 'whoosh-soft';
const TAIL = 'It is in the review panel — the user applies it there, or says so and you call accept_proposal.';

const ASSETS: StudioAgentAssetInfo[] = [
  {
    id: E3V_ID,
    name: 'e3v-clip.mp4',
    kind: 'video',
    path: 'C:/media/e3v-clip.mp4',
    durationSeconds: 8,
    transcript: { engine: 'whisper.cpp', wordCount: 4 },
  },
  { id: WHOOSH_ID, name: 'whoosh-soft.mp3', kind: 'audio', path: 'C:/lib/whoosh-soft.mp3', durationSeconds: 0.7 },
];

const WORDS = [
  { text: 'Hello', start: 0.5, end: 0.9 },
  { text: 'world.', start: 1.0, end: 1.4 },
  { text: 'hello', start: 4.2, end: 4.6 },
  { text: 'again', start: 4.7, end: 5.0 },
];

function makeCtx(assets: StudioAgentAssetInfo[] = ASSETS): { ctx: StudioToolContext; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const ctx = {
    req: { projectId: 'e3v-whoosh', assets, reviewOpen: false },
    signal: new AbortController().signal,
    emit: (e: Record<string, unknown>) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return { ctx, events };
}

function insertTool(ctx: StudioToolContext): ToolLike {
  const found = (buildInsertTools(ctx) as unknown as ToolLike[]).find((t) => t.name === 'insert_asset');
  if (!found) throw new Error('insert_asset not built');
  return found;
}

function emittedProposal(events: Array<Record<string, unknown>>): StudioProposal {
  const event = events.find((e) => e.kind === 'proposal');
  if (!event) throw new Error('no proposal emitted');
  return event.proposal as StudioProposal;
}

beforeEach(() => {
  readTranscriptFile.mockReset();
  loadProject.mockReset();
  readTranscriptFile.mockResolvedValue({ words: WORDS });
});

describe('insert_asset — the number path (characterization)', () => {
  it('places at timeline seconds: the item, the headline, the answer and the chip', async () => {
    const { ctx, events } = makeCtx();
    const res = await insertTool(ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: 3 }, {});
    const proposal = emittedProposal(events);
    expect(res.isError).toBeUndefined();
    expect(events[0]).toEqual({ projectId: 'e3v-whoosh', kind: 'tool', tool: 'insert_asset', detail: 'audio at 3s' });
    expect(events[1]).toEqual({ projectId: 'e3v-whoosh', kind: 'proposal', proposal });
    expect(proposal.kind).toBe('insert-plan');
    expect(proposal.status).toBe('proposed');
    expect(proposal.agentNote).toBe('Insert "whoosh-soft.mp3" as audio at 0:03.0 · 0.7 s');
    expect(proposal.items).toEqual([
      {
        id: expect.stringMatching(/^ins_/),
        status: 'accepted',
        timelineStart: 3,
        duration: 0.7,
        insert: { assetId: WHOOSH_ID, kind: 'audio', lane: 'audio' },
      },
    ]);
    expect(res.content[0].text).toBe(`Insert proposed (id "${proposal.id}"): ${proposal.agentNote}. ${TAIL}`);
    expect((ctx.state as { proposalId: string | null }).proposalId).toBe(proposal.id);
    expect(readTranscriptFile).not.toHaveBeenCalled();
    expect(loadProject).not.toHaveBeenCalled();
  });

  it('carries gain, note and an asked duration (clipped to the media length)', async () => {
    const { ctx, events } = makeCtx();
    const res = await insertTool(ctx).handler(
      { assetId: WHOOSH_ID, lane: 'audio', at: 62.5, duration: 2, gain: 0.5, note: 'on the swing' },
      {},
    );
    const proposal = emittedProposal(events);
    expect(proposal.agentNote).toBe('Insert "whoosh-soft.mp3" as audio at 1:02.5 · 0.7 s');
    expect(proposal.items).toEqual([
      {
        id: expect.stringMatching(/^ins_/),
        status: 'accepted',
        timelineStart: 62.5,
        duration: 0.7,
        note: 'on the swing',
        insert: { assetId: WHOOSH_ID, kind: 'audio', lane: 'audio', gain: 0.5 },
      },
    ]);
    expect(res.content[0].text).toBe(`Insert proposed (id "${proposal.id}"): ${proposal.agentNote}. ${TAIL}`);
  });

  it('a negative time lands at 0 and keeps its asked label', async () => {
    const { ctx, events } = makeCtx();
    await insertTool(ctx).handler({ assetId: E3V_ID, lane: 'broll', at: -1, duration: 2 }, {});
    const proposal = emittedProposal(events);
    expect(events[0]).toEqual({ projectId: 'e3v-whoosh', kind: 'tool', tool: 'insert_asset', detail: 'broll at -1s' });
    expect(proposal.items[0].timelineStart).toBe(0);
    expect(proposal.agentNote).toBe('Insert "e3v-clip.mp4" as b-roll at -1:59.0 · 2.0 s');
  });
});

describe('insert_asset — the { word, take } path (characterization)', () => {
  it('anchors to the footage at the take-th occurrence: the item, the headline, the answer and the chip', async () => {
    const { ctx, events } = makeCtx();
    const res = await insertTool(ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { word: 'hello', take: 2 } }, {});
    const proposal = emittedProposal(events);
    expect(res.isError).toBeUndefined();
    expect(readTranscriptFile).toHaveBeenCalledWith('e3v-whoosh', E3V_ID);
    expect(events[0]).toEqual({ projectId: 'e3v-whoosh', kind: 'tool', tool: 'insert_asset', detail: 'audio at "hello"' });
    expect(proposal.agentNote).toBe('Insert "whoosh-soft.mp3" as audio where the footage reaches 0:04.2 (source) · 0.7 s');
    expect(proposal.items).toEqual([
      {
        id: expect.stringMatching(/^ins_/),
        status: 'accepted',
        assetId: E3V_ID,
        sourceStart: 4.2,
        sourceEnd: 4.2 + 0.7,
        duration: 0.7,
        insert: { assetId: WHOOSH_ID, kind: 'audio', lane: 'audio' },
      },
    ]);
    expect(res.content[0].text).toBe(`Insert proposed (id "${proposal.id}"): ${proposal.agentNote}. ${TAIL}`);
    expect(loadProject).not.toHaveBeenCalled();
  });

  it('take defaults to 1 and an explicit footage assetId is used', async () => {
    const { ctx, events } = makeCtx();
    await insertTool(ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { word: 'Hello world', assetId: E3V_ID } }, {});
    const proposal = emittedProposal(events);
    expect(proposal.items[0].sourceStart).toBe(0.5);
    expect(proposal.agentNote).toBe('Insert "whoosh-soft.mp3" as audio where the footage reaches 0:00.5 (source) · 0.7 s');
  });

  it('each word error is a tool error with its exact text and emits no proposal', async () => {
    const never = makeCtx();
    const a = await insertTool(never.ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { word: 'goodbye' } }, {});
    expect(a).toMatchObject({ isError: true });
    expect(a.content[0].text).toBe('The speaker never says "goodbye" in "e3v-clip.mp4" — check get_transcript for the exact wording.');
    expect(never.events.some((e) => e.kind === 'proposal')).toBe(false);

    const range = makeCtx();
    const b = await insertTool(range.ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { word: 'hello', take: 3 } }, {});
    expect(b.isError).toBe(true);
    expect(b.content[0].text).toBe('"hello" occurs 2 times in "e3v-clip.mp4" — take 3 is out of range.');

    const untranscribed = makeCtx(ASSETS.map((a) => ({ ...a, transcript: undefined })));
    const c = await insertTool(untranscribed.ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { word: 'hello' } }, {});
    expect(c.isError).toBe(true);
    expect(c.content[0].text).toBe(
      'No transcribed footage to anchor to — transcribe the footage first, or pass `at` as timeline seconds.',
    );

    readTranscriptFile.mockResolvedValue({ words: [] });
    const empty = makeCtx();
    const d = await insertTool(empty.ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { word: 'hello' } }, {});
    expect(d.isError).toBe(true);
    expect(d.content[0].text).toBe('"e3v-clip.mp4" has no word-level transcript to search.');
  });
});

describe('insert_asset — the guards before `at` (characterization)', () => {
  it('a review already open, an audio asset on a picture lane, a picture on the audio lane', async () => {
    const open = makeCtx();
    (open.ctx.req as { reviewOpen: boolean }).reviewOpen = true;
    const a = await insertTool(open.ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: 3 }, {});
    expect(a.isError).toBe(true);
    expect(a.content[0].text).toBe(
      'A proposal is already open in the review panel. Ask the user to apply or reject it first (or call accept_proposal if they already said to apply it).',
    );

    const b = await insertTool(makeCtx().ctx).handler({ assetId: WHOOSH_ID, lane: 'broll', at: 3 }, {});
    expect(b.content[0].text).toBe('"whoosh-soft.mp3" is audio — use lane "audio".');
    const c = await insertTool(makeCtx().ctx).handler({ assetId: E3V_ID, lane: 'audio', at: 3 }, {});
    expect(c.content[0].text).toBe(
      '"e3v-clip.mp4" is video; the audio lane takes audio assets. Use lane "broll" or "overlay" for pictures.',
    );
  });
});
