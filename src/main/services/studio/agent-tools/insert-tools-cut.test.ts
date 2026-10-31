// insert_asset's { cut, offset? } path (ASSISTANT_TIMELINE_DESIGN §5, §8.1 5)
// through the real tool handler, the project load mocked to the 2-clip
// project: the emitted item, the headline / answer naming the cut, the chip,
// every error path's exact text, and the description's `{ cut` clause.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioAgentAssetInfo } from '../../../../shared/ipc/types/studio';
import type { StudioClip, StudioProject, StudioProposal } from '../../../../shared/types/studio';
import type { StudioToolContext } from './types';

const loadProject = vi.fn();
const readTranscriptFile = vi.fn();

vi.mock('../project-store', () => ({ loadProject: (projectId: string) => loadProject(projectId) }));
vi.mock('../asset-transcriber', () => ({
  readTranscriptFile: (projectId: string, assetId: string) => readTranscriptFile(projectId, assetId),
}));
vi.mock('../agent-actions', () => ({ agentActions: { request: vi.fn() } }));
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
  { id: E3V_ID, name: 'e3v-clip.mp4', kind: 'video', path: 'C:/media/e3v-clip.mp4', durationSeconds: 8 },
  { id: WHOOSH_ID, name: 'whoosh-soft.mp3', kind: 'audio', path: 'C:/lib/whoosh-soft.mp3', durationSeconds: 0.7 },
];

function project(master: StudioClip[]): StudioProject {
  return {
    schemaVersion: 1,
    id: 'e3v-whoosh',
    name: 'e3v-whoosh',
    settings: { width: 1280, height: 720, fps: 30, agent: {} },
    assets: [],
    timeline: {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: master },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
      ],
    },
    proposals: [],
    shots: [],
  } as unknown as StudioProject;
}

const twoClipProject = (): StudioProject =>
  project([
    { id: 'e3v-c1', kind: 'video', assetId: E3V_ID, timelineStart: 0, duration: 3, sourceIn: 0 },
    { id: 'e3v-c2', kind: 'video', assetId: E3V_ID, timelineStart: 3, duration: 3, sourceIn: 4 },
  ]);

function makeCtx(): { ctx: StudioToolContext; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const ctx = {
    req: { projectId: 'e3v-whoosh', assets: ASSETS, reviewOpen: false },
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
  loadProject.mockReset();
  readTranscriptFile.mockReset();
  loadProject.mockResolvedValue(twoClipProject());
});

describe('insert_asset — the { cut } path', () => {
  it('{ cut: 1 } anchors to the clip after the cut: the item, the answer naming the cut, the chip', async () => {
    const { ctx, events } = makeCtx();
    const res = await insertTool(ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { cut: 1 } }, {});
    const proposal = emittedProposal(events);
    expect(res.isError).toBeUndefined();
    expect(loadProject).toHaveBeenCalledWith('e3v-whoosh');
    expect(events[0]).toEqual({ projectId: 'e3v-whoosh', kind: 'tool', tool: 'insert_asset', detail: 'audio at cut 1' });
    expect(proposal.items).toEqual([
      {
        id: expect.stringMatching(/^ins_/),
        status: 'accepted',
        assetId: E3V_ID,
        sourceStart: 4,
        sourceEnd: 4 + 0.7,
        duration: 0.7,
        insert: { assetId: WHOOSH_ID, kind: 'audio', lane: 'audio' },
      },
    ]);
    expect(proposal.agentNote).toBe('Insert "whoosh-soft.mp3" as audio at cut 1 (0:03.00 on the timeline) · 0.7 s');
    expect(res.content[0].text).toBe(`Insert proposed (id "${proposal.id}"): ${proposal.agentNote}. ${TAIL}`);
    expect(res.content[0].text).toContain('at cut 1 (0:03.00 on the timeline)');
    expect(readTranscriptFile).not.toHaveBeenCalled();
  });

  it('offset −0.25 → the clip before the cut; the design\'s headline; the chip with the offset', async () => {
    const { ctx, events } = makeCtx();
    await insertTool(ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { cut: 1, offset: -0.25 } }, {});
    const proposal = emittedProposal(events);
    expect(events[0]).toMatchObject({ detail: 'audio at cut 1 -0.25s' });
    expect(proposal.items[0]).toMatchObject({ assetId: E3V_ID, sourceStart: 2.75, sourceEnd: 2.75 + 0.7, duration: 0.7 });
    expect(proposal.agentNote).toBe('Insert "whoosh-soft.mp3" as audio 0.25 s before cut 1 (0:02.75 on the timeline) · 0.7 s');
  });

  it('a side the mapping cannot hold (a TSX clip after the cut) → a fixed timelineStart', async () => {
    loadProject.mockResolvedValue(
      project([
        { id: 'e3v-c1', kind: 'video', assetId: E3V_ID, timelineStart: 0, duration: 3, sourceIn: 0 },
        { id: 's1', kind: 'tsx', timelineStart: 3, duration: 3, tsx: { shotId: 'shot-1', mode: 'cutaway' } },
      ]),
    );
    const { ctx, events } = makeCtx();
    await insertTool(ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', at: { cut: 1, offset: 0.5 } }, {});
    const proposal = emittedProposal(events);
    expect(events[0]).toMatchObject({ detail: 'audio at cut 1 +0.5s' });
    expect(proposal.items[0]).toMatchObject({ timelineStart: 3.5, duration: 0.7 });
    expect(proposal.items[0].assetId).toBeUndefined();
    expect(proposal.agentNote).toBe('Insert "whoosh-soft.mp3" as audio 0.50 s after cut 1 (0:03.50 on the timeline) · 0.7 s');
  });
});

describe('insert_asset — the { cut } errors (exact, no proposal)', () => {
  async function expectError(args: Record<string, unknown>, message: string): Promise<void> {
    const { ctx, events } = makeCtx();
    const res = await insertTool(ctx).handler({ assetId: WHOOSH_ID, lane: 'audio', ...args }, {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe(message);
    expect(events.some((e) => e.kind === 'proposal')).toBe(false);
    expect((ctx.state as { proposalId: string | null }).proposalId).toBeNull();
  }

  it('cut 2 on the 2-clip project', async () => {
    await expectError(
      { at: { cut: 2 } },
      'The master track "V1" has 1 cut — cut 2 does not exist (cuts count from 1 in timeline order; get_timeline lists them).',
    );
  });

  it('a 1-clip timeline, and an empty one', async () => {
    loadProject.mockResolvedValue(project([{ id: 'only', kind: 'video', assetId: E3V_ID, timelineStart: 0, duration: 6, sourceIn: 0 }]));
    await expectError(
      { at: { cut: 1 } },
      'There is no cut on the master track "V1" (0 cuts) — pass `at` as timeline seconds or { word, take }.',
    );
    loadProject.mockResolvedValue(project([]));
    await expectError({ at: { cut: 1 } }, 'There is no cut on the master track (0 cuts) — pass `at` as timeline seconds or { word, take }.');
  });

  it('an offset past its clip', async () => {
    await expectError(
      { at: { cut: 1, offset: 3 } },
      '3.00 s after cut 1 is outside the clip after it (3.00 s long) — pass `at` as timeline seconds instead.',
    );
  });

  it('a load failure', async () => {
    loadProject.mockRejectedValue(new Error('ENOENT: no such file'));
    await expectError({ at: { cut: 1 } }, 'Could not read the timeline to find cut 1: ENOENT: no such file');
  });
});

describe('insert_asset — the description and schema', () => {
  it('the description gains the { cut, offset? } clause; the number and word sentences stay', () => {
    const { description } = insertTool(makeCtx().ctx);
    expect(description).toContain(
      'or { cut, offset? } to land at the n-th cut on the master track (1 = the first; offset seconds, negative = before it; resolved to the footage where it can be, so it follows later trims)',
    );
    expect(description).toContain('{ word, take } to land where the speaker says a word (anchored to the footage, so it survives cuts)');
  });

  it('the `at` union has the cut form with the design\'s field descriptions', () => {
    const t = insertTool(makeCtx().ctx) as unknown as { inputSchema: { at: { options: Array<{ shape?: Record<string, { description?: string }> }> } } };
    const cutForm = t.inputSchema.at.options.find((o) => o.shape?.cut);
    expect(cutForm?.shape?.cut.description).toBe('The n-th cut on the master track, 1 = the first — get_timeline numbers them');
    expect(cutForm?.shape?.offset.description).toBe('Seconds from the cut; negative = before it (default 0)');
  });
});
