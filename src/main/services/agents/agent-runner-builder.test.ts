// P4 part 3 in the runner: an agent's `builder: true` skills reach the tool
// server (and from there every composition tool's context) as packs, and leave
// the agent's own prompt; `skipPending` answers the session's waiting question
// as skipped (P4-7). The tool server is captured, not built.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentManifest, AgentSession } from '../../../shared/types/agents';
import type { ToolServerDeps } from './tools/tool-server';

const runLlmGenerate = vi.fn(async (..._args: unknown[]) => ({ success: true, text: 'done' }));
vi.mock('../../ipc/llm-handlers', () => ({ runLlmGenerate: (...args: unknown[]) => runLlmGenerate(...args) }));
vi.mock('../../../engine', () => ({ llmEngine: { getProviders: () => ['claude-subscription'] } }));
vi.mock('./tool-support', () => ({
  resolveToolSupport: async () => true,
  resolveToolCapabilities: async () => ({ imageProvider: false, videoProvider: false, audioProvider: false }),
}));
let deps: ToolServerDeps | null = null;
vi.mock('./tools/tool-server', () => ({
  AGENT_MCP_SERVER_NAME: 'vidtsx',
  buildAgentToolServer: (_tools: unknown, d: ToolServerDeps) => {
    deps = d;
    return { server: {}, allowedTools: [] };
  },
}));

const { AgentArtifactStore } = await import('./artifact-store');
const { AgentRunner } = await import('./agent-runner');

const manifest: AgentManifest = {
  formatVersion: 1,
  id: 'lwh/test',
  name: 'Test',
  version: '0.2.0',
  description: 'test agent',
  author: { name: 'Test' },
  minAppVersion: '1.0.0',
  prompt: 'AGENT.md',
  tools: ['generate_composition', 'ask_user'],
  files: [{ path: 'AGENT.md', size: 1, sha256: 'a'.repeat(64) }],
};
const session: AgentSession = {
  id: 'session-1',
  agentId: 'lwh/test',
  agentVersion: '0.2.0',
  title: 'A session',
  createdAt: new Date().toISOString(),
  lastOpenedAt: new Date().toISOString(),
};

let dir: string;
let persisted: unknown[];

async function setup() {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-runner-builder-'));
  const store = await AgentArtifactStore.open(dir);
  persisted = [];
  const runner = new AgentRunner({ emit: () => {}, persistPendingInteraction: async (_id, r) => void persisted.push(r) });
  return { runner, store };
}

beforeEach(() => {
  deps = null;
  runLlmGenerate.mockClear();
});

describe('AgentRunner: builder skills and a skipped question (P4 part 3)', () => {
  it("hands the builder skills to the tool server as packs, and only names them in the agent's prompt", async () => {
    const { runner, store } = await setup();
    const skills = [
      { id: 'ideas', name: 'Picture ideas', description: 'Three metaphors.', body: 'IDEAS BODY' },
      { id: 'house', name: 'House look', description: 'Ink lines.', body: 'HOUSE BODY', builder: true as const },
    ];
    await runner.send({ session, manifest, promptBody: 'BODY', skills, workspaceDir: dir, store }, { prompt: 'hi', history: [] });
    expect(deps?.builderPacks).toEqual([{ name: 'House look', body: 'HOUSE BODY' }]);
    const system = (runLlmGenerate.mock.calls[0][0] as { systemPrompt: string }).systemPrompt;
    expect(system).toContain('IDEAS BODY');
    expect(system).not.toContain('HOUSE BODY');
    expect(system).toContain('- House look: Ink lines.');
  });

  it('an agent with no builder skills sends none', async () => {
    const { runner, store } = await setup();
    await runner.send({ session, manifest, promptBody: 'BODY', skills: [], workspaceDir: dir, store }, { prompt: 'hi', history: [] });
    expect(deps).not.toBeNull();
    expect(deps).not.toHaveProperty('builderPacks');
  });

  it("skipPending answers the session's waiting question as skipped and frees the broker", async () => {
    const { runner } = await setup();
    const broker = runner.broker(session);
    await broker.post({ kind: 'form', title: 'Q?', fields: [] }, 'call-1');
    const id = broker.current!.id;
    expect(await runner.skipPending(session, 'Go with a')).toEqual({
      requestId: id,
      message: `[Answer to question ${id}] The user skipped the card and wrote: Go with a`,
    });
    expect(broker.current).toBeNull();
    expect(persisted.at(-1)).toBeNull();
    expect(await runner.skipPending(session, 'again')).toBeNull();
  });
});
