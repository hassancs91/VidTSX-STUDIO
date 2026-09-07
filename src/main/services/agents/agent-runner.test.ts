// The runner against a stub LLM: what it hands `runLlmGenerate` is the whole
// of its contract with the engine, so that is what these assert.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type {
  AgentManifest,
  AgentRunEvent,
  AgentSession,
} from '../../../shared/types/agents';
import type { AgentArtifactStore as ArtifactStore } from './artifact-store';

const runLlmGenerate = vi.fn();
const resolveToolSupport = vi.fn();

vi.mock('../../ipc/llm-handlers', () => ({
  runLlmGenerate: (...args: unknown[]) => runLlmGenerate(...args),
}));
vi.mock('../../../engine', () => ({
  llmEngine: { getProviders: () => ['claude-subscription'] },
}));
vi.mock('./tool-support', () => ({
  resolveToolSupport: (id?: string) => resolveToolSupport(id),
  resolveToolCapabilities: () => ({ imageProvider: false, videoProvider: false }),
}));

const { AgentArtifactStore } = await import('./artifact-store');
const { AgentRunner } = await import('./agent-runner');

const manifest = (overrides: Partial<AgentManifest> = {}): AgentManifest => ({
  formatVersion: 1,
  id: 'vidtsx/test',
  name: 'Test',
  version: '1.0.0',
  description: 'test agent',
  author: { name: 'VidTSX' },
  minAppVersion: '1.0.0',
  prompt: 'AGENT.md',
  tools: ['write_document', 'ask_user'],
  files: [{ path: 'AGENT.md', size: 1, sha256: 'a'.repeat(64) }],
  ...overrides,
});

const session = (overrides: Partial<AgentSession> = {}): AgentSession => ({
  id: 'session-1',
  agentId: 'vidtsx/test',
  agentVersion: '1.0.0',
  title: 'A session',
  createdAt: new Date().toISOString(),
  lastOpenedAt: new Date().toISOString(),
  providerId: 'claude-subscription',
  ...overrides,
});

let dir: string;
let events: AgentRunEvent[];
let pending: unknown[];

async function makeRunner() {
  const store = await AgentArtifactStore.open(dir);
  events = [];
  pending = [];
  const runner = new AgentRunner({
    emit: (e) => events.push(e),
    persistPendingInteraction: async (r) => {
      pending.push(r);
    },
  });
  return { runner, store };
}

function ctx(store: ArtifactStore, m = manifest(), s = session()) {
  return {
    session: s,
    manifest: m,
    promptBody: 'You are a test agent.',
    skills: [],
    workspaceDir: dir,
    store,
  };
}

/** The single request object the runner handed the engine. */
function request(): Record<string, unknown> {
  return runLlmGenerate.mock.calls[0][0] as Record<string, unknown>;
}
function extras(): Record<string, unknown> {
  return (runLlmGenerate.mock.calls[0][3] ?? {}) as Record<string, unknown>;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-runner-'));
  runLlmGenerate.mockReset();
  resolveToolSupport.mockReset();
  resolveToolSupport.mockResolvedValue(true);
  runLlmGenerate.mockResolvedValue({ success: true, text: 'done' });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('AgentRunner.send', () => {
  it('builds the tool server from the manifest allowlist and nothing else', async () => {
    const { runner, store } = await makeRunner();
    const result = await runner.send(ctx(store), { prompt: 'hello', history: [] });

    expect(result).toMatchObject({ success: true, text: 'done', toolsAvailable: true });
    expect(request().allowedTools).toEqual([
      'mcp__vidtsx__write_document',
      'mcp__vidtsx__ask_user',
    ]);
    expect(Object.keys(extras().mcpServers as object)).toEqual(['vidtsx']);
    expect(request().featureSource).toBe('agent');
  });

  it('takes maxTurns and effort from the manifest defaults', async () => {
    const { runner, store } = await makeRunner();
    await runner.send(
      ctx(store, manifest({ defaults: { maxTurns: 40, effort: 'high' } })),
      { prompt: 'hello', history: [] },
    );
    expect(request()).toMatchObject({ maxTurns: 40, effort: 'high' });
  });

  it('sends the replay window as messages, oldest first, with the new turn last', async () => {
    const { runner, store } = await makeRunner();
    await runner.send(ctx(store), {
      prompt: 'and now?',
      history: [
        { id: '1', role: 'user', text: 'first' },
        { id: '2', role: 'assistant', text: 'second' },
      ],
    });
    expect(request().messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'and now?' },
    ]);
  });

  it('degrades to chat on a provider that cannot run tools', async () => {
    resolveToolSupport.mockResolvedValue(false);
    const { runner, store } = await makeRunner();
    const result = await runner.send(ctx(store), { prompt: 'hello', history: [] });

    expect(result.toolsAvailable).toBe(false);
    expect(extras().mcpServers).toBeUndefined();
    expect(request().allowedTools).toBeUndefined();
    expect(request().systemPrompt).toContain('cannot run tools');
  });

  it('names capability-gated tools as unavailable rather than hiding them', async () => {
    const { runner, store } = await makeRunner();
    await runner.send(
      ctx(store, manifest({ tools: ['write_document', 'generate_image'] })),
      { prompt: 'hello', history: [] },
    );
    // Still offered to the model (§1.8) …
    expect(request().allowedTools).toContain('mcp__vidtsx__generate_image');
    // … but the prompt says it will not work.
    expect(request().systemPrompt).toContain('generate_image');
    expect(request().systemPrompt).toContain('NOT usable');
  });

  it('passes cwd and the path guard ONLY when the manifest asks for file tools', async () => {
    const { runner, store } = await makeRunner();
    await runner.send(ctx(store), { prompt: 'hello', history: [] });
    expect(extras().cwd).toBeUndefined();
    expect(extras().canUseTool).toBeUndefined();

    runLlmGenerate.mockClear();
    await runner.send(
      ctx(
        store,
        manifest({ workspace: { sdkFileTools: true }, sdkTools: ['Read', 'WebSearch'] }),
      ),
      { prompt: 'hello', history: [] },
    );
    expect(extras().cwd).toBe(dir);
    expect(typeof extras().canUseTool).toBe('function');
    expect(request().agentTools).toEqual(['Read', 'WebSearch']);
    expect(request().allowedTools).toContain('Read');
  });

  it('composes the starter answers into the (static) system prompt', async () => {
    const { runner, store } = await makeRunner();
    await runner.send(
      ctx(store, manifest(), session({ starter: { brief: { text: 'a newsletter launch' } } })),
      { prompt: 'hello', history: [] },
    );
    expect(request().systemPrompt).toContain('a newsletter launch');
  });

  it('falls back to the app default when the session provider is gone', async () => {
    const { runner, store } = await makeRunner();
    await runner.send(ctx(store, manifest(), session({ providerId: 'deleted-provider' })), {
      prompt: 'hello',
      history: [],
    });
    expect(request().providerId).toBeUndefined();
  });

  it('allows one run per session and reports the second', async () => {
    const { runner, store } = await makeRunner();
    let release: () => void = () => {};
    runLlmGenerate.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve({ success: true, text: 'done' });
      }),
    );
    const first = runner.send(ctx(store), { prompt: 'a', history: [] });
    const second = await runner.send(ctx(store), { prompt: 'b', history: [] });
    expect(second).toMatchObject({ success: false });
    expect(second.error).toContain('already running');
    release();
    await first;
    expect(runner.isRunning('session-1')).toBe(false);
  });

  it('cancel aborts the run and drops any pending question', async () => {
    const { runner, store } = await makeRunner();
    let seenSignal: AbortSignal | undefined;
    runLlmGenerate.mockImplementation(
      (_req: unknown, signal: AbortSignal) =>
        new Promise((resolve) => {
          seenSignal = signal;
          signal.addEventListener('abort', () => resolve({ success: false, error: 'Cancelled' }));
        }),
    );
    const run = runner.send(ctx(store), { prompt: 'a', history: [] });
    const broker = runner.broker(session());
    await broker.post({ kind: 'form', title: 'Q?', fields: [] }, 'call-1');

    expect(await runner.cancel('session-1')).toBe(true);
    expect(seenSignal?.aborted).toBe(true);
    expect(broker.current).toBeNull();
    await run;
    expect(events.some((e) => e.kind === 'done')).toBe(true);
  });

  it('emits deltas and a done event', async () => {
    const { runner, store } = await makeRunner();
    runLlmGenerate.mockImplementation(
      async (_req: unknown, _signal: unknown, onDelta: (t: string) => void) => {
        onDelta('hel');
        onDelta('lo');
        return { success: true, text: 'hello' };
      },
    );
    await runner.send(ctx(store), { prompt: 'hi', history: [] });
    expect(events.filter((e) => e.kind === 'delta').map((e) => ('text' in e ? e.text : ''))).toEqual(
      ['hel', 'lo'],
    );
    expect(events.at(-1)).toMatchObject({ kind: 'done', text: 'hello' });
  });
});
