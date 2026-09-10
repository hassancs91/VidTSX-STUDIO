// Freeze (flows plan §1.5, W8 Stage 5) against the REAL registry, on a
// fixture session shaped like a Motion Post run: a dead end, a rejected
// pick, a failed retry, an intake answer that reached an argument, a pick
// and an approve card, and a render settled through its job.
import { describe, it, expect } from 'vitest';
import type { AgentArtifact } from '../../../shared/types/agents';
import type { StarterTree } from '../../../shared/agents/starter';
import type { InteractionReplyRecord, ToolCallRecord } from '../agents/tool-call-log';

vi.mock('./flow-service', () => ({
  resolveFlowRef: () => ({ error: 'none' }),
  loadFlowDoc: () => ({ doc: null, version: '1' }),
  listFlowDocs: () => [],
  flowService: {},
}));
import { vi } from 'vitest';

await import('../agents/tools/registry');
const { getNode } = await import('../agents/tools/registry-core');
const { freezeSessionToFlow } = await import('./freeze-session');
const { walkLineage } = await import('./freeze-lineage');

function art(id: string, kind: AgentArtifact['kind'], tool: string, callId: string, payload: Record<string, unknown>): AgentArtifact {
  return { id, kind, title: id, createdAt: 'now', producer: { tool, callId }, payload } as unknown as AgentArtifact;
}
function call(callId: string, tool: string, at: number, args: Record<string, unknown>, artifactIds: string[] = [], extra: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return { callId, tool, at: new Date(1_700_000_000_000 + at * 1000).toISOString(), args, artifactIds, ...extra };
}

const starterTree: StarterTree = {
  entry: 'platform',
  opening: '',
  nodes: {
    platform: { question: 'Where will it be posted?', select: 'one', options: [{ id: '9:16', label: 'Reels', next: 'style' }, { id: '16:9', label: 'YouTube', next: 'style' }] },
    style: { question: 'Which style?', select: 'one', options: [{ id: 'bold', label: 'Bold', next: 'brief' }, { id: 'clean', label: 'Clean', next: 'brief' }] },
    brief: { question: 'What is it about?', text: true, multiline: true, next: '$end' },
  },
};

const session = {
  id: 's-1', agentId: 'vidtsx/motion-post', title: 'Focus tips reel', brandId: 'acme-test',
  starter: { platform: { ids: ['9:16'] }, style: { ids: ['bold'] }, brief: { text: 'Three tips on focus' } },
};

const artifacts: AgentArtifact[] = [
  art('document-1', 'document', 'write_document', 'c1', { relPath: 'documents/variants.md' }),
  art('image-set-1', 'image-set', 'generate_image', 'c2', { items: [{ relPath: 'a/1.png', width: 1, height: 1 }] }),
  art('image-set-2', 'image-set', 'generate_image', 'c3', { items: [{ relPath: 'a/2.png', width: 1, height: 1 }] }),
  art('composition-1', 'composition', 'generate_composition', 'c7', { relPath: 'compositions/c.tsx', config: { id: 'C', durationInFrames: 1, fps: 30, width: 1, height: 1 } }),
  art('job-1', 'job', 'render_composition', 'c9', { jobId: 'job-uuid', job: 'render', status: 'completed', resultArtifactId: 'video-1' }),
  art('video-1', 'video', 'render_composition', 'c9', { relPath: 'agents/x/final.mp4', durationSeconds: 6 }),
];

const calls: ToolCallRecord[] = [
  call('c1', 'write_document', 1, { title: 'Variants', markdown: '# A\n# B' }, ['document-1']),
  call('c2', 'generate_image', 2, { prompt: 'a fox' }, ['image-set-1']),
  call('c3', 'generate_image', 3, { prompt: 'a wolf' }, ['image-set-2']),
  call('c4', 'ask_user', 4, { question: 'Which image?', kind: 'pick', options: [{ id: 'fox', label: 'Fox', artifactId: 'image-set-1' }, { id: 'wolf', label: 'Wolf', artifactId: 'image-set-2' }] }, [], { requestIds: ['q-1'] }),
  // A failed attempt — a retry the path must skip.
  call('c6', 'generate_composition', 6, { title: 'Reel', brief: 'first try', width: 1080, height: 1920 }, [], { isError: true }),
  call('c7', 'generate_composition', 7, { title: 'Reel', brief: 'Three beats on focus, bold type', width: 1080, height: 1920, fps: 30, durationSeconds: 6, styleNotes: 'Bold', referenceImage: 'image-set-2' }, ['composition-1']),
  call('c8', 'ask_user', 8, { question: 'Approve?', kind: 'approve', options: [{ id: 'comp', label: 'Reel', artifactId: 'composition-1' }] }, [], { requestIds: ['q-2'] }),
  call('c9', 'render_composition', 9, { artifactId: 'composition-1' }, ['job-1']),
];
const replies: InteractionReplyRecord[] = [
  { requestId: 'q-1', at: 'now', status: 'answered', values: { wolf: ['Wolf'] } },
  { requestId: 'q-2', at: 'now', status: 'answered', values: { comp: ['approved (Reel)'] } },
];

const base = {
  session, agentName: 'Motion Post', starterTree, artifacts, calls, replies,
  registry: { getNode },
  externalPath: (a: AgentArtifact) => (a.kind === 'video' ? 'C:/lib/in.mp4' : a.kind === 'image-set' ? 'C:/lib/in.png' : null),
};

describe('walkLineage', () => {
  it('keeps only the winning path: no dead end, no rejected pick, no failed retry, no ask_user', () => {
    const walk = walkLineage({ artifactId: 'video-1', artifacts, calls });
    expect(walk.ok).toBe(true);
    if (!walk.ok) return;
    expect(walk.lineage.calls.map((c) => c.callId)).toEqual(['c3', 'c7', 'c9']);
    expect(walk.lineage.external).toEqual([]);
    expect(walk.lineage.producerOf.get('video-1')?.callId).toBe('c9');
  });

  it('bridges a video filed under the JOB id (generate_video) to the submitting call', () => {
    const clip = art('video-9', 'video', 'generate_video', 'job-uuid', { relPath: 'x.mp4', durationSeconds: 5 });
    const job = art('job-9', 'job', 'generate_video', 'cv', { jobId: 'job-uuid', job: 'video', status: 'completed', resultArtifactId: 'video-9' });
    const walk = walkLineage({ artifactId: 'video-9', artifacts: [clip, job], calls: [call('cv', 'generate_video', 1, { prompt: 'p' }, ['job-9'])] });
    expect(walk.ok && walk.lineage.calls.map((c) => c.callId)).toEqual(['cv']);
  });

  it('names the typed reasons: no calls, unknown artifact, a job', () => {
    expect(walkLineage({ artifactId: 'video-1', artifacts, calls: [] })).toMatchObject({ ok: false, error: expect.stringContaining('no recorded tool calls') });
    expect(walkLineage({ artifactId: 'nope', artifacts, calls })).toMatchObject({ ok: false, error: expect.stringContaining('No artifact') });
    expect(walkLineage({ artifactId: 'job-1', artifacts, calls })).toMatchObject({ ok: false, error: expect.stringContaining('job cannot be frozen') });
  });
});

describe('freezeSessionToFlow', () => {
  it('builds the three-step draft with edges, pauses, the intake param, the entry prompt, the output and the origin', () => {
    const result = freezeSessionToFlow({ ...base, artifactId: 'video-1' });
    expect(result.ok ? null : result.error).toBeNull();
    if (!result.ok) return;
    const { doc } = result;
    expect(doc.graph.nodes.map((n) => [n.id, n.toolId, n.pause])).toEqual([
      ['n-generate-image', 'generate_image', true],
      ['n-generate-composition', 'generate_composition', true],
      ['n-render-composition', 'render_composition', false],
    ]);
    expect(doc.graph.edges).toEqual([
      { id: 'e1', source: 'n-generate-image', sourceHandle: 'image', target: 'n-generate-composition', targetHandle: 'image' },
      { id: 'e2', source: 'n-generate-composition', sourceHandle: 'composition', target: 'n-render-composition', targetHandle: 'composition' },
    ]);
    const compose = doc.graph.nodes[1];
    expect(compose.config).toMatchObject({ brief: 'Three beats on focus, bold type', width: 1080, height: 1920, styleNotes: 'Bold', title: 'Reel' });
    expect(compose.config).not.toHaveProperty('referenceImage');
    expect(doc.graph.nodes.map((n) => n.position.x)).toEqual([80, 480, 880]);
    // The intake's style answer reached `styleNotes` by value → a select param
    // in the label form; the entry step's prompt is exposed by the stage rule.
    expect(doc.params).toEqual([
      expect.objectContaining({ id: 'which-style', label: 'Which style?', kind: 'select', default: 'Bold', options: [{ value: 'Bold', label: 'Bold' }, { value: 'Clean', label: 'Clean' }], bind: [{ nodeId: 'n-generate-composition', key: 'styleNotes' }] }),
      expect.objectContaining({ id: 'prompt', label: 'Prompt', kind: 'prompt', required: true, default: 'a wolf', bind: [{ nodeId: 'n-generate-image', key: 'prompt' }] }),
    ]);
    expect(doc.outputs).toEqual([{ nodeId: 'n-render-composition', handle: 'video', label: 'Video' }]);
    expect(doc.origin).toEqual({ agentId: 'vidtsx/motion-post', sessionId: 's-1', artifactId: 'video-1', brandId: 'acme-test' });
    expect(doc.name).toBe('Focus tips reel');
    expect(doc.description).toContain('Generate Image → Generate Composition → Render Composition');
    expect(result.notes).toEqual([]);
  });

  it('a write_document on the path becomes an input_text feeding the text port', () => {
    const arts = [
      art('document-1', 'document', 'write_document', 'c1', { relPath: 'documents/brief.md' }),
      art('composition-1', 'composition', 'generate_composition', 'c2', { relPath: 'c.tsx', config: {} }),
    ];
    const log = [
      call('c1', 'write_document', 1, { title: 'Brief', markdown: 'Open on the logo, then three beats.' }, ['document-1']),
      call('c2', 'generate_composition', 2, { title: 'Reel', brief: 'document-1', width: 1080, height: 1920 }, ['composition-1']),
    ];
    const result = freezeSessionToFlow({ ...base, artifacts: arts, calls: log, replies: [], artifactId: 'composition-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.graph.nodes.map((n) => n.toolId)).toEqual(['input_text', 'generate_composition']);
    expect(result.doc.graph.nodes[0].config.prompt).toBe('Open on the logo, then three beats.');
    expect(result.doc.graph.edges).toEqual([{ id: 'e1', source: 'n-input-text', sourceHandle: 'text', target: 'n-generate-composition', targetHandle: 'brief' }]);
    // The brief is fed by an edge, so no entry prompt param is minted; the
    // intake brief did not reach an argument by value either.
    expect(result.doc.params).toEqual([]);
  });

  it('media that entered from outside becomes the matching input node', () => {
    const arts = [
      art('video-1', 'video', 'import', 'upload-1', { relPath: 'imports/in.mp4', durationSeconds: 3 }),
      art('composition-1', 'composition', 'generate_composition', 'c2', { relPath: 'c.tsx', config: {} }),
    ];
    const log = [call('c2', 'generate_composition', 2, { title: 'Reel', brief: 'Cut to the clip', referenceVideo: 'video-1' }, ['composition-1'])];
    const result = freezeSessionToFlow({ ...base, artifacts: arts, calls: log, replies: [], artifactId: 'composition-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.graph.nodes.map((n) => [n.toolId, n.config.filePath])).toEqual([['input_video_file', 'C:/lib/in.mp4'], ['generate_composition', undefined]]);
    expect(result.doc.graph.edges).toEqual([{ id: 'e1', source: 'n-input-video-file', sourceHandle: 'video', target: 'n-generate-composition', targetHandle: 'video' }]);
    expect(result.doc.params).toEqual([expect.objectContaining({ id: 'brief', kind: 'prompt', default: 'Cut to the clip' })]);
  });

  it('a pick reply value that reached an argument becomes a select param', () => {
    const arts = [art('composition-1', 'composition', 'generate_composition', 'c2', { relPath: 'c.tsx', config: {} })];
    const log = [
      call('c1', 'ask_user', 1, { question: 'Which mood?', kind: 'pick', options: [{ id: 'calm', label: 'Calm' }, { id: 'loud', label: 'Loud'}] }, [], { requestIds: ['q-1'] }),
      call('c2', 'generate_composition', 2, { title: 'Reel', brief: 'Beats', styleNotes: 'loud' }, ['composition-1']),
    ];
    const result = freezeSessionToFlow({ ...base, session: { ...session, starter: undefined }, artifacts: arts, calls: log, replies: [{ requestId: 'q-1', at: 'now', status: 'answered', values: { loud: ['Loud'] } }], artifactId: 'composition-1' });
    expect(result.ok && result.doc.params[0]).toMatchObject({ label: 'Which mood?', kind: 'select', default: 'loud', options: [{ value: 'calm', label: 'Calm' }, { value: 'loud', label: 'Loud' }] });
  });

  it('refuses a session whose path holds no flow step, and one made by a non-node tool', () => {
    const doc = art('document-1', 'document', 'write_document', 'c1', { relPath: 'd.md' });
    const only = freezeSessionToFlow({ ...base, artifacts: [doc], calls: [call('c1', 'write_document', 1, { title: 'x', markdown: 'y' }, ['document-1'])], replies: [], artifactId: 'document-1' });
    expect(only).toMatchObject({ ok: false, error: expect.stringContaining('Nothing on this path is a flow step') });
    const page = art('web-page-1', 'web-page', 'write_page', 'c1', { relPath: 'p.html', refs: [], inlineBytes: 1 });
    const web = freezeSessionToFlow({ ...base, artifacts: [page], calls: [call('c1', 'write_page', 1, { title: 'x', html: '<p/>' }, ['web-page-1'])], replies: [], artifactId: 'web-page-1' });
    expect(web).toMatchObject({ ok: false, error: expect.stringContaining('write_page') });
  });
});
