// `save_flow` (flows plan §1.5 step 4, W8 Stage 5): the agent may name a
// frozen draft, relabel its params, promote config keys and set pauses —
// and nothing else. The graph it queues is the graph it was given.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRunEvent } from '../../../../shared/types/agents';
import type { FlowDoc } from '../../../../shared/types/flows';
import { makeToolContext } from './test-context';

vi.mock('../../flows/flow-service', () => ({
  resolveFlowRef: () => ({ error: 'none' }),
  loadFlowDoc: () => ({ doc: null, version: '1' }),
  listFlowDocs: () => [],
  flowService: {},
}));

await import('./registry');
const { applySaveFlowEdits, saveFlowStrictSchema, saveFlowTool } = await import('./save-flow');
const { clearFrozenDraftsForTests, getFrozenDraft, setFrozenDraft } = await import('../../flows/freeze-drafts');
const { clearFlowProposalsForTests, getFlowProposal } = await import('../../flows/flow-proposals');

const draft: FlowDoc = {
  formatVersion: 2,
  id: 'proposal/new',
  name: 'Focus tips reel',
  description: 'Frozen.',
  params: [{ id: 'which-style', label: 'Which style?', kind: 'select', default: 'Bold', options: ['Bold', 'Clean'], bind: [{ nodeId: 'n-compose', key: 'styleNotes' }] }],
  graph: {
    nodes: [
      { id: 'n-compose', toolId: 'generate_composition', position: { x: 80, y: 80 }, config: { title: 'Reel', brief: 'Three beats', width: 1080, height: 1920, fps: 30, durationSeconds: 6, styleNotes: 'Bold', providerId: '', model: '', modelMode: 'default' }, pause: true },
      { id: 'n-render', toolId: 'render_composition', position: { x: 480, y: 80 }, config: { name: '' }, pause: false },
    ],
    edges: [{ id: 'e1', source: 'n-compose', sourceHandle: 'composition', target: 'n-render', targetHandle: 'composition' }],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
  outputs: [{ nodeId: 'n-render', handle: 'video', label: 'Video' }],
  origin: { agentId: 'vidtsx/motion-post', sessionId: 's-1', artifactId: 'video-1' },
};

beforeEach(() => {
  clearFrozenDraftsForTests();
  clearFlowProposalsForTests();
});

describe('the save_flow schema', () => {
  it('has no field that could add, remove or rewire a node', () => {
    for (const bad of [{ nodes: [] }, { edges: [] }, { graph: {} }, { outputs: [] }, { addNode: 'x' }, { params: [{ id: 'which-style', bind: [] }] }, { expose: [{ nodeId: 'n', key: 'k', value: 1 }] }]) {
      expect(saveFlowStrictSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(saveFlowStrictSchema.safeParse({ name: 'Reel from a brief', description: 'x', params: [{ id: 'which-style', label: 'Style' }], expose: [{ nodeId: 'n-compose', key: 'brief', label: 'Brief', id: 'brief' }], pause: [{ nodeId: 'n-compose', pause: false }] }).success).toBe(true);
  });
});

describe('applySaveFlowEdits', () => {
  it('renames, relabels, promotes a port key as a prompt param, clears a pause — and keeps the graph', () => {
    const doc = applySaveFlowEdits(draft, {
      name: ' Reel from a brief ',
      description: 'A brief in, a vertical reel out.',
      params: [{ id: 'which-style', label: 'Style', newId: 'style' }],
      expose: [{ nodeId: 'n-compose', key: 'brief', label: 'Brief', id: 'brief' }, { nodeId: 'n-compose', key: 'durationSeconds' }],
      pause: [{ nodeId: 'n-compose', pause: false }],
    });
    expect(typeof doc).not.toBe('string');
    if (typeof doc === 'string') return;
    expect(doc.name).toBe('Reel from a brief');
    expect(doc.params.map((p) => [p.id, p.label, p.kind, p.default])).toEqual([
      ['style', 'Style', 'select', 'Bold'],
      ['brief', 'Brief', 'prompt', 'Three beats'],
      ['durationseconds', 'Seconds', 'number', 6],
    ]);
    expect(doc.graph.nodes.map((n) => [n.id, n.pause])).toEqual([['n-compose', false], ['n-render', false]]);
    expect(doc.graph.edges).toEqual(draft.graph.edges);
    expect(doc.outputs).toEqual(draft.outputs);
  });

  it('refuses an unknown param, step or key, and a taken id', () => {
    expect(applySaveFlowEdits(draft, { params: [{ id: 'nope' }] })).toContain('No param "nope"');
    expect(applySaveFlowEdits(draft, { expose: [{ nodeId: 'n-x', key: 'brief' }] })).toContain('No step "n-x"');
    expect(applySaveFlowEdits(draft, { expose: [{ nodeId: 'n-compose', key: 'magic' }] })).toContain('no config key "magic"');
    expect(applySaveFlowEdits(draft, { expose: [{ nodeId: 'n-compose', key: 'brief', id: 'which-style' }] })).toContain('already taken');
    expect(applySaveFlowEdits(draft, { pause: [{ nodeId: 'n-x', pause: true }] })).toContain('No step "n-x"');
  });
});

describe('the tool', () => {
  it('queues the edited draft as a frozen proposal with the SAME graph, emits it, and drops the draft', async () => {
    setFrozenDraft({ agentId: 'vidtsx/motion-post', sessionId: 's-1', artifactId: 'video-1', doc: draft });
    const events: AgentRunEvent[] = [];
    const ctx = makeToolContext({ sessionId: 's-1', agentId: 'vidtsx/motion-post', emit: (e) => events.push(e) });
    const result = await saveFlowTool.handler({ name: 'Reel from a brief', expose: [{ nodeId: 'n-compose', key: 'brief', label: 'Brief' }] }, ctx);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('shown on the Flows canvas with 2 param(s)');
    const proposal = getFlowProposal('s-1');
    expect(proposal?.source).toBe('frozen');
    expect(proposal?.flowId).toBeNull();
    expect(proposal?.doc.graph).toEqual({ ...draft.graph, nodes: draft.graph.nodes });
    expect(proposal?.doc.name).toBe('Reel from a brief');
    expect(events.map((e) => e.kind)).toContain('flow-proposal');
    expect(getFrozenDraft('s-1')).toBeNull();
  });

  it('refuses without a draft, and keeps the draft when the edit is refused', async () => {
    const none = await saveFlowTool.handler({ name: 'x' }, makeToolContext({ sessionId: 's-1' }));
    expect(none.isError).toBe(true);
    expect(none.content[0].text).toContain('no frozen draft');
    setFrozenDraft({ agentId: 'a', sessionId: 's-1', artifactId: 'video-1', doc: draft });
    const bad = await saveFlowTool.handler({ expose: [{ nodeId: 'n-compose', key: 'magic' }] }, makeToolContext({ sessionId: 's-1' }));
    expect(bad.isError).toBe(true);
    expect(getFrozenDraft('s-1')).not.toBeNull();
    expect(getFlowProposal('s-1')).toBeNull();
  });
});
