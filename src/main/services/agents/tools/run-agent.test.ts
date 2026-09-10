// `run_agent` (flows plan §1.6, W8 Stage 4) with a fake agent runner: the
// input ports are seeded into the session as context (media records copied,
// work files copied into the session workspace), one send runs with the
// allowlist and the turn cap, the last artifact of the requested kind is the
// output (a work file copied back into the run's workspace), and a session
// that stopped on a question fails the node — nobody can answer it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact, AgentSession } from '../../../../shared/types/agents';
import { makeToolContext } from './test-context';
import { runAgentTool, setRunAgentDepsForTests, type RunAgentDeps } from './run-agent';

const session: AgentSession = {
  id: 's-1',
  agentId: 'vidtsx/motion-post',
  agentVersion: '1.1.0',
  title: 'Flow: x',
  createdAt: 'now',
  lastOpenedAt: 'now',
};

const runVideo: AgentArtifact = {
  id: 'video-1', kind: 'video', title: 'source', createdAt: 'now', producer: { tool: 'input_video_file', callId: 'c' },
  payload: { relPath: 'flows/x/in.mp4', durationSeconds: 3 },
};
const runDoc: AgentArtifact = {
  id: 'document-2', kind: 'document', title: 'brief', createdAt: 'now', producer: { tool: 'write_document', callId: 'c' },
  payload: { relPath: 'docs/brief.md' },
};

let tmp: string;
let runWorkspace: string;
let sessionWorkspace: string;
let calls: { seed: unknown[]; send: unknown[]; created: unknown[] };
let after: { session: AgentSession | null; artifacts: AgentArtifact[] };

function deps(): RunAgentDeps {
  return {
    findAgent: async (agentId) => (agentId === 'vidtsx/motion-post' ? { manifest: { name: 'Motion Post', tools: ['write_document', 'generate_composition', 'render_composition', 'ask_user'] } } : null),
    createSession: async (input) => {
      calls.created.push(input);
      return session;
    },
    seed: async (_agentId, _sessionId, drafts) => {
      calls.seed.push(drafts);
    },
    send: async (input) => {
      calls.send.push(input);
      return { success: true };
    },
    cancel: async () => true,
    readSession: async () => ({ ...after, workspaceDir: sessionWorkspace }),
  };
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'run-agent-'));
  runWorkspace = path.join(tmp, 'run-files');
  sessionWorkspace = path.join(tmp, 'session-work');
  await fs.mkdir(path.join(runWorkspace, 'docs'), { recursive: true });
  await fs.mkdir(path.join(sessionWorkspace, 'work'), { recursive: true });
  await fs.writeFile(path.join(runWorkspace, 'docs', 'brief.md'), '# brief', 'utf-8');
  await fs.writeFile(path.join(sessionWorkspace, 'work', 'post.tsx'), 'export default () => null;', 'utf-8');
  calls = { seed: [], send: [], created: [] };
  after = {
    session,
    artifacts: [
      { id: 'video-1', kind: 'video', title: 'Context — video', createdAt: 'now', producer: { tool: 'run_agent', callId: 'context' }, payload: { relPath: 'flows/x/in.mp4', durationSeconds: 3 } },
      { id: 'composition-2', kind: 'composition', title: 'Post', createdAt: 'now', producer: { tool: 'generate_composition', callId: 'c2' }, payload: { relPath: 'work/post.tsx', config: { id: 'Post', durationInFrames: 90, fps: 30, width: 1080, height: 1080 } } },
      { id: 'video-3', kind: 'video', title: 'Rendered post', createdAt: 'now', producer: { tool: 'render_composition', callId: 'c3' }, payload: { relPath: 'agents/motion-post/post.mp4', durationSeconds: 3 } },
    ],
  };
  setRunAgentDepsForTests(deps());
});
afterEach(async () => {
  setRunAgentDepsForTests(null);
  await fs.rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('run_agent', () => {
  it('is the non-deterministic node and needs a tool-capable provider', () => {
    expect(runAgentTool.needs).toBe('agent-provider');
    expect(runAgentTool.ports?.nondeterministic).toBe(true);
    expect(runAgentTool.ports?.category).toBe('agent');
  });

  it('refuses an unknown agent and a tool the agent does not have', async () => {
    const ctx = makeToolContext();
    expect((await runAgentTool.handler({ goal: 'x', agentId: 'vidtsx/nope', outputKind: 'video' }, ctx)).isError).toBe(true);
    const bad = await runAgentTool.handler({ goal: 'x', agentId: 'vidtsx/motion-post', outputKind: 'video', tools: 'write_document, generate_video' }, ctx);
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toContain('has no tool generate_video');
    expect(calls.created).toEqual([]);
  });

  it('seeds the input ports as context, sends once with the allowlist and cap, and returns the last artifact of the kind', async () => {
    const progress: string[] = [];
    const ctx = makeToolContext({ workspaceDir: runWorkspace, brandId: 'acme-test', artifacts: [runVideo, runDoc], emitProgress: (d) => progress.push(d) });
    const result = await runAgentTool.handler(
      { goal: 'A 6 s hook for the launch', agentId: 'vidtsx/motion-post', outputKind: 'video', video: 'video-1', context: 'Brand voice: warm.', tools: ['write_document', 'generate_composition', 'render_composition'], maxTurns: 8 },
      ctx,
    );
    expect(calls.created[0]).toMatchObject({ agentId: 'vidtsx/motion-post', title: 'Flow: A 6 s hook for the launch', brandId: 'acme-test' });
    expect(calls.seed).toEqual([[{ kind: 'video', title: 'Context — video', payload: { relPath: 'flows/x/in.mp4', durationSeconds: 3 } }]]);
    const sent = calls.send[0] as { prompt: string; tools: string[]; maxTurns: number };
    expect(sent.tools).toEqual(['write_document', 'generate_composition', 'render_composition']);
    expect(sent.maxTurns).toBe(8);
    expect(sent.prompt).toContain('A 6 s hook for the launch');
    expect(sent.prompt).toContain('Context:\nBrand voice: warm.');
    expect(sent.prompt).toContain('do not call ask_user');
    expect(result.isError).toBeUndefined();
    expect(result.artifact).toEqual({ kind: 'video', title: 'Rendered post', payload: { relPath: 'agents/motion-post/post.mp4', durationSeconds: 3 } });
    expect(progress[0]).toBe('Motion Post: session s-1');
  });

  it('a composition output is a work file: copied into the run workspace', async () => {
    const ctx = makeToolContext({ workspaceDir: runWorkspace, artifacts: [runDoc] });
    const result = await runAgentTool.handler({ goal: 'x', agentId: 'vidtsx/motion-post', outputKind: 'composition', composition: undefined }, ctx);
    expect(result.artifact).toMatchObject({ kind: 'composition', payload: { relPath: 'agents/s-1/post.tsx', config: { id: 'Post' } } });
    expect(await fs.readFile(path.join(runWorkspace, 'agents', 's-1', 'post.tsx'), 'utf-8')).toBe('export default () => null;');
  });

  it('fails when the agent stopped on a question, or made nothing of the kind', async () => {
    after = { ...after, session: { ...session, pendingInteraction: { id: 'q1', sessionId: 's-1', callId: 'c', createdAt: 'now', payload: { kind: 'form', title: 'Which variant?', fields: [] } } } };
    const asked = await runAgentTool.handler({ goal: 'x', agentId: 'vidtsx/motion-post', outputKind: 'video' }, makeToolContext({ workspaceDir: runWorkspace }));
    expect(asked.isError).toBe(true);
    expect(asked.content[0].text).toContain('stopped to ask a question ("Which variant?")');

    after = { session, artifacts: [] };
    const none = await runAgentTool.handler({ goal: 'x', agentId: 'vidtsx/motion-post', outputKind: 'audio' }, makeToolContext({ workspaceDir: runWorkspace }));
    expect(none.isError).toBe(true);
    expect(none.content[0].text).toContain('finished without making a audio');
  });
});
