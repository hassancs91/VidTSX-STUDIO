// `propose_flow` (flows plan §1.6, W8 Stage 4) against the REAL registry: a
// whole doc is laid out, defaulted and validated through both gates; a patch
// edits the stored flow; the card is queued once per session and emitted on
// the run stream; nothing is ever written.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRunEvent } from '../../../../shared/types/agents';
import type { FlowDoc } from '../../../../shared/types/flows';
import { makeToolContext } from './test-context';

const stored = vi.hoisted(() => ({ doc: null as FlowDoc | null }));

vi.mock('../../flows/flow-service', () => ({
  resolveFlowRef: (ref: string) => (ref === 'Captions' || ref === 'test/captions' ? { id: 'test/captions', name: 'Captions' } : { error: `No flow "${ref}".` }),
  loadFlowDoc: () => ({ doc: stored.doc, version: '1' }),
  listFlowDocs: () => (stored.doc ? [{ doc: stored.doc, updatedAt: 1 }] : []),
  flowService: {},
}));

await import('./registry');
const { buildProposedDoc, proposeFlowTool, validateProposal, NEW_FLOW_PROPOSAL_ID } = await import('./propose-flow');
const { clearFlowProposalsForTests, getFlowProposal } = await import('../../flows/flow-proposals');

const captionDoc = {
  name: 'Caption a video',
  description: 'Video → transcript → burnt-in captions.',
  nodes: [
    { id: 'n-video', toolId: 'input_video_file' },
    { id: 'n-stt', toolId: 'transcribe' },
    { id: 'n-cap', toolId: 'caption_video', config: { style: 'karaoke' } },
  ],
  edges: ['n-video.video -> n-stt.video', 'n-video.video -> n-cap.video', 'n-stt.transcript -> n-cap.transcript'],
  params: [{ id: 'video', label: 'Video', kind: 'video', required: true, bind: [{ nodeId: 'n-video', key: 'filePath' }] }],
};

beforeEach(() => {
  clearFlowProposalsForTests();
  stored.doc = null;
});

describe('buildProposedDoc', () => {
  it('lays a new flow out by depth, merges registry defaults, parses edges and derives the outputs', () => {
    const doc = buildProposedDoc(null, { doc: captionDoc });
    expect(typeof doc).not.toBe('string');
    if (typeof doc === 'string') return;
    expect(doc.id).toBe(NEW_FLOW_PROPOSAL_ID);
    expect(doc.name).toBe('Caption a video');
    expect(doc.graph.nodes.map((n) => [n.id, n.position.x])).toEqual([['n-video', 80], ['n-stt', 480], ['n-cap', 880]]);
    expect(doc.graph.nodes[2].config).toMatchObject({ style: 'karaoke' });
    expect(Object.keys(doc.graph.nodes[0].config)).toContain('filePath');
    expect(doc.graph.edges).toEqual([
      { id: 'e1', source: 'n-video', sourceHandle: 'video', target: 'n-stt', targetHandle: 'video' },
      { id: 'e2', source: 'n-video', sourceHandle: 'video', target: 'n-cap', targetHandle: 'video' },
      { id: 'e3', source: 'n-stt', sourceHandle: 'transcript', target: 'n-cap', targetHandle: 'transcript' },
    ]);
    expect(doc.outputs).toEqual([{ nodeId: 'n-cap', handle: 'video', label: 'Video' }]);
    expect(validateProposal(doc)).toBeNull();
  });

  it('refuses a malformed edge, both forms at once, and a patch without a base', () => {
    expect(buildProposedDoc(null, { doc: { ...captionDoc, edges: ['n-video -> n-stt'] } })).toContain('is not "node.port -> node.port"');
    expect(buildProposedDoc(null, { doc: captionDoc, patch: [] })).toBe('Pass either doc or patch, not both.');
    expect(buildProposedDoc(null, { patch: [{ op: 'rename', name: 'x' }] })).toContain('A patch needs flowId');
  });
});

describe('validateProposal', () => {
  it('rejects an edge between incompatible types and an unfed required input', () => {
    const wrongType = buildProposedDoc(null, { doc: { ...captionDoc, edges: ['n-video.video -> n-stt.video', 'n-stt.text -> n-cap.video'] } });
    expect(typeof wrongType === 'string' ? wrongType : validateProposal(wrongType)).toContain('connects text to video');
    const unfed = buildProposedDoc(null, { doc: { ...captionDoc, edges: ['n-video.video -> n-stt.video'] } });
    expect(typeof unfed === 'string' ? unfed : validateProposal(unfed)).toContain('missing its required input');
    const unknown = buildProposedDoc(null, { doc: { nodes: [{ id: 'n-x', toolId: 'launch_missiles' }] } });
    expect(typeof unknown === 'string' ? unknown : validateProposal(unknown)).toContain('Unknown node "launch_missiles"');
  });
});

describe('propose_flow', () => {
  it('queues one card, emits it on the run stream, and refuses a second until it is answered', async () => {
    const events: AgentRunEvent[] = [];
    const ctx = makeToolContext({ sessionId: 's-9', agentId: 'vidtsx/flow-builder', emit: (e) => events.push(e) });
    const result = await proposeFlowTool.handler({ summary: 'Captions from a transcript.', doc: captionDoc }, ctx);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Proposal shown on the canvas (+3 nodes, -0 nodes, 0 changed, 3 edge changes, 1 param changes; 3 nodes, 3 edges, 1 params)');
    expect(result.content[0].text).toContain('End your turn now');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ sessionId: 's-9', kind: 'flow-proposal', proposal: { agentId: 'vidtsx/flow-builder', flowId: null, summary: 'Captions from a transcript.' } });
    expect(getFlowProposal('s-9')?.doc.graph.nodes).toHaveLength(3);

    const again = await proposeFlowTool.handler({ summary: 'again', doc: captionDoc }, ctx);
    expect(again.isError).toBe(true);
    expect(again.content[0].text).toContain('already waiting');
  });

  it('a patch edits the stored flow and the card names that flow', async () => {
    const base = buildProposedDoc(null, { doc: { ...captionDoc, nodes: captionDoc.nodes.slice(0, 2), edges: captionDoc.edges.slice(0, 1) } });
    if (typeof base === 'string') throw new Error(base);
    stored.doc = { ...base, id: 'test/captions', name: 'Captions' };
    const events: AgentRunEvent[] = [];
    const ctx = makeToolContext({ sessionId: 's-2', emit: (e) => events.push(e) });
    const result = await proposeFlowTool.handler(
      {
        summary: 'Add the burn-in step.',
        flowId: 'Captions',
        patch: [
          { op: 'add-node', id: 'n-cap', toolId: 'caption_video', config: { style: 'minimal' } },
          { op: 'add-edge', source: 'n-video', sourceHandle: 'video', target: 'n-cap', targetHandle: 'video' },
          { op: 'add-edge', source: 'n-stt', sourceHandle: 'transcript', target: 'n-cap', targetHandle: 'transcript' },
          { op: 'set-outputs', outputs: [{ nodeId: 'n-cap', handle: 'video', label: 'Captioned' }] },
        ],
      },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const proposal = getFlowProposal('s-2');
    expect(proposal?.flowId).toBe('test/captions');
    expect(proposal?.doc.graph.nodes.map((n) => n.id)).toEqual(['n-video', 'n-stt', 'n-cap']);
    expect(proposal?.doc.outputs).toEqual([{ nodeId: 'n-cap', handle: 'video', label: 'Captioned' }]);
  });

  it('an invalid proposal is refused with the gate\'s message, and nothing is queued', async () => {
    const ctx = makeToolContext({ sessionId: 's-3' });
    const result = await proposeFlowTool.handler({ summary: 'bad', doc: { nodes: [{ id: 'n-cap', toolId: 'caption_video' }] } }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('The proposal is not valid:');
    expect(getFlowProposal('s-3')).toBeNull();
    expect((await proposeFlowTool.handler({ summary: 'x', flowId: 'nope', patch: [] }, ctx)).content[0].text).toBe('No flow "nope".');
  });
});
