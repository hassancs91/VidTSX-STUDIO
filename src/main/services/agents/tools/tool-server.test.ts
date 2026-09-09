// A turn's worth of tool calls, driven the way the SDK drives them: the
// wrapped handler, a real artifact store, a real interaction broker. This is
// Stage 1's "done when" for `write_document` + `ask_user` — everything between
// a tool returning a draft and the model being told the artifact's id.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentJobRequest, AgentRunEvent } from '../../../../shared/types/agents';
import { AgentArtifactStore } from '../artifact-store';
import { InteractionBroker } from '../interaction-broker';
import { selectTools } from './registry';
import { buildAgentToolServer } from './tool-server';

const CAPS = { imageProvider: false, videoProvider: false, audioProvider: false };

let dir: string;
let store: AgentArtifactStore;
let broker: InteractionBroker;
let events: AgentRunEvent[];
let jobs: AgentJobRequest[];

/** The SDK erases the shape when the definitions come from the registry, so
 *  a test drives them through this deliberately loose signature. */
type ToolHandler = (
  args: Record<string, unknown>,
  extra: unknown,
) => Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }>;

async function build(toolIds: string[]) {
  const { tools, allowedTools } = buildAgentToolServer(selectTools(toolIds, CAPS).tools, {
    sessionId: 'session-1',
    agentId: 'vidtsx/test',
    workspaceDir: dir,
    signal: new AbortController().signal,
    libraryFolder: 'agents/test/session',
    emit: (e) => events.push(e),
    readArtifacts: () => store.list(),
    ask: (payload, callId) => broker.post(payload, callId),
    fileArtifact: (draft, producer, options) => store.add(draft, producer, options),
    requestJob: (request) => jobs.push(request),
  });
  const byId = new Map<string, ToolHandler>(
    tools.map((t) => [t.name, t.handler as unknown as ToolHandler]),
  );
  return { byId, allowedTools };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-toolserver-'));
  store = await AgentArtifactStore.open(dir);
  events = [];
  jobs = [];
  broker = new InteractionBroker({
    sessionId: 'session-1',
    emit: (request) => events.push({ sessionId: 'session-1', kind: 'interaction', request }),
    persist: async () => {},
  });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('agent tool server', () => {
  it('sends only the allowlisted tools, named for the SDK', async () => {
    const { byId, allowedTools } = await build(['write_document', 'ask_user']);
    expect([...byId.keys()].sort()).toEqual(['ask_user', 'write_document']);
    expect(allowedTools).toEqual(['mcp__vidtsx__write_document', 'mcp__vidtsx__ask_user']);
  });

  it('runs write_document: file on disk, artifact filed, id given to the model', async () => {
    const { byId } = await build(['write_document', 'list_artifacts']);
    const result = await byId.get('write_document')!(
      { title: 'Hook variants', markdown: '# Two hooks\n\n1. ...' },
      {},
    );
    const text = result.content.map((c) => c.text ?? '').join('\n');
    expect(text).toContain('documents/hook-variants.md');
    expect(text).toContain('Artifact id: document-1');

    const written = await fs.readFile(path.join(dir, 'documents', 'hook-variants.md'), 'utf-8');
    expect(written).toContain('Two hooks');

    const [artifact] = store.list();
    expect(artifact).toMatchObject({
      id: 'document-1',
      kind: 'document',
      title: 'Hook variants',
      producer: { tool: 'write_document' },
      version: 1,
    });
    expect(events.filter((e) => e.kind === 'tool')).toHaveLength(1);

    // …and the model can find it again once the result scrolls away.
    const listed = await byId.get('list_artifacts')!({}, {});
    expect(listed.content.map((c) => c.text ?? '').join('')).toContain('document-1');
  });

  it('runs ask_user: the question is pending, and no turn is held open', async () => {
    const { byId } = await build(['ask_user']);
    const result = await byId.get('ask_user')!(
      {
        question: 'Which hook?',
        options: [
          { id: 'a', label: 'Hook A' },
          { id: 'b', label: 'Hook B' },
        ],
      },
      {},
    );
    expect(result.isError).toBeUndefined();
    expect(broker.current?.payload).toMatchObject({ kind: 'pick', title: 'Which hook?' });
    expect(events.some((e) => e.kind === 'interaction')).toBe(true);
  });

  it('render_composition mints a job artifact and asks the renderer to enqueue', async () => {
    const config = { id: 'main', durationInFrames: 90, fps: 30, width: 1080, height: 1920 };
    const composition = await store.add(
      {
        kind: 'composition',
        title: 'Promo',
        payload: { relPath: 'compositions/promo.tsx', moduleUrl: 'http://localhost/1.js', config },
      },
      { tool: 'generate_composition', callId: 'c0' },
    );
    const { byId } = await build(['render_composition']);
    const result = await byId.get('render_composition')!(
      { artifactId: composition.id },
      {},
    );
    expect(result.isError).toBeUndefined();

    const job = store.list().find((a) => a.kind === 'job');
    expect(job?.payload).toMatchObject({ job: 'render', status: 'pending' });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      artifactId: job?.id,
      job: 'render',
      compositionArtifactId: composition.id,
      outputFolder: 'agents/test/session',
      outputName: 'promo',
      config,
    });
  });

  it('reports an unknown artifact id back to the model instead of throwing', async () => {
    const { byId } = await build(['render_composition']);
    const result = await byId.get('render_composition')!({ artifactId: 'nope-9' }, {});
    expect(result.isError).toBe(true);
    expect(store.list()).toHaveLength(0);
    expect(jobs).toHaveLength(0);
  });
});
