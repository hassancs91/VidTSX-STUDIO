// P4 part 3 (P4-6 (a)): craft packs through the agent tools, end to end. The
// REAL job engine and the REAL builder run each call; only the model (a
// scripted session), the bundle check and the renders are faked, and the real
// resources/packs supply the texts. What is asserted is what the builder was
// actually given: its system prompt, its first message, its vN.debug.json.
//   - generate_composition's `packs` reach the system prompt, expanded.
//   - edit_composition names none, and the edit still gets the version's
//     packs and style words (part 1's main-side keep, seen through the tool).
//   - an agent's `builder: true` skills ride along on both, after the packs.
//   - `from` builds the first request again: same intent, packs and style.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact } from '../../../../shared/types/agents';

let tmpDir = '';
const REPO_ROOT = path.join(__dirname, '../../../../..');
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, getAppPath: () => REPO_ROOT, isPackaged: false },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
}));
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, _description: string, _schema: unknown, handler: unknown) => ({ name, handler }),
  createSdkMcpServer: (options: unknown) => options,
}));

const CONFIG = { id: 'Piles', width: 1080, height: 1080, fps: 30, durationInFrames: 60 };
vi.mock('../../tsx-builder/build-check', () => ({
  checkBuild: async () => ({ ok: true, errors: [], code: '// piles', config: CONFIG, inlinedFiles: [], inlinedPackages: [], assets: [], ms: 5 }),
}));
vi.mock('../../tsx-builder/build-stills', () => ({
  renderBuildStills: async (_code: string, _config: unknown, dir: string, frames: number[], opts: { label: string }) => ({
    stills: frames.map((frame) => ({ frame, path: path.join(dir, `${opts.label}-f${frame}.jpg`), data: 'AAAA', mimeType: 'image/jpeg' })),
    ms: { bundle: 1, render: 1 },
    bundleCached: false,
  }),
}));
vi.mock('../../tsx-builder/build-looks', () => ({
  PHONE_FEED_WIDTH: 390,
  renderPhoneView: async (_code: string, _config: unknown, dir: string, frame: number) => ({
    path: path.join(dir, `phone-f${frame}.jpg`), data: 'PHONE', mimeType: 'image/jpeg', frame, width: 390, height: 390,
    ms: { bundle: 1, render: 1 }, bundleCached: true,
  }),
  renderContactSheet: vi.fn(),
  measureLoopSeam: vi.fn(),
  measureFramePurity: vi.fn(),
}));
vi.mock('../../remotion-bundler', () => ({ releaseBundlesUnder: async () => 0 }));
vi.mock('../tool-support', () => ({
  resolveToolSupport: async () => true,
  resolveProviderInfo: async () => ({ id: 'claude-subscription', type: 'agent-sdk' }),
}));
vi.mock('../../tsx-builder/openrouter-model-check', () => ({ checkBuilderModel: async () => ({ ok: true }) }));
vi.mock('../../module-server', () => ({
  ensureModuleServer: async () => 4001,
  getModuleServerBaseUrl: () => 'http://localhost:4001',
  storeTranspileResult: () => 'http://localhost:4001/modules/m.js',
}));
vi.mock('../../tsx-transpiler', () => ({
  transpileTsxSource: async () => ({ success: true, code: 'js', hash: 'h', config: CONFIG, componentName: 'Piles' }),
}));

/** Each build's system prompt and first message, in order. */
const systems: string[] = [];
const prompts: string[] = [];
vi.mock('../../../ipc/llm-handlers', () => ({
  runLlmGenerate: async (
    data: { prompt?: string; systemPrompt?: string },
    _signal: AbortSignal,
    _onTextDelta: unknown,
    extras: { mcpServers: Record<string, { tools: Array<{ name: string; handler: (a: unknown) => Promise<unknown> }> }>; onTurn: (u: unknown) => void },
  ) => {
    systems.push(data.systemPrompt ?? '');
    prompts.push(data.prompt ?? '');
    const tools = extras.mcpServers.builder.tools;
    const call = (name: string, args: Record<string, unknown> = {}) => tools.find((t) => t.name === name)!.handler(args);
    extras.onTurn({ turn: 1, inputTokens: 1, outputTokens: 100, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });
    await call('render_stills', { frames: [0, 59] });
    await call('phone_view', { frame: 30 });
    await call('finish', { summary: 'Piles.' });
    return { success: true, text: 'Done.', model: 'claude-sonnet-5-5', usage: { inputTokens: 1, outputTokens: 100 } };
  },
}));

const { generateCompositionTool } = await import('./generate-composition');
const { editCompositionTool } = await import('./edit-composition');
const { tsxJobEngine } = await import('../../tsx-jobs/tsx-job-engine');
const { makeToolContext } = await import('./test-context');

const HOUSE = { name: 'House rules', body: '# House rules\nEvery line is a 2 px ink line.' };
const PACK_TAGS = ['<pack name="Infographic loop">', '<pack name="Concept to picture">', '<pack name="Your own style">'];

let workspace = '';
const artifacts: AgentArtifact[] = [];

function file(id: string, res: Awaited<ReturnType<typeof generateCompositionTool.handler>>, version: number): void {
  if (res.isError || res.artifact?.kind !== 'composition') throw new Error(`no composition: ${res.content[0]?.text}`);
  artifacts.push({ ...res.artifact, id, createdAt: new Date().toISOString(), producer: { tool: 'generate_composition', callId: 'c' }, version });
}

const ctx = () => makeToolContext({ workspaceDir: workspace, readArtifacts: () => [...artifacts], builderPacks: [HOUSE], agentId: 'lwh/test' });

function inOrder(text: string, tags: string[]): boolean {
  const at = tags.map((t) => text.indexOf(t));
  return at.every((i) => i > 0) && at.every((i, n) => n === 0 || i > at[n - 1]);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'packs-through-tools-'));
  workspace = path.join(tmpDir, 'work');
  await fs.mkdir(workspace, { recursive: true });
  systems.length = 0;
  prompts.length = 0;
  artifacts.length = 0;
  tsxJobEngine.clearCompleted();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('craft packs through the agent tools (real engine + builder)', () => {
  it('generate sends them, edit keeps them, builder skills ride along, from builds the same request again', async () => {
    const brief = 'Compound interest: two piles of coins, the second grows from its own earnings.';
    const made = await generateCompositionTool.handler(
      {
        title: 'Two piles', brief, width: 1080, height: 1080, fps: 30, durationSeconds: 2, budget: 'quick',
        packs: ['core/infographic-loop', 'core/style-custom'], styleNotes: 'Chalkboard, wobbly lines',
      },
      ctx(),
    );
    file('composition-1', made, 1);
    expect(inOrder(systems[0], [...PACK_TAGS, '<pack name="House rules">'])).toBe(true);
    // Your own style: the words are the builder's STYLE block, not a style note in the brief.
    expect(prompts[0]).toContain("STYLE (the user's own words; keep every one):\nChalkboard, wobbly lines");
    expect(prompts[0]).not.toContain('Style notes:');
    const folder = path.join(workspace, 'compositions', 'two-piles');
    const v1 = JSON.parse(await fs.readFile(path.join(folder, 'v1.debug.json'), 'utf-8'));
    expect(v1.request).toMatchObject({
      craftPacks: ['core/infographic-loop', 'core/concept-to-picture', 'core/style-custom'],
      style: 'Chalkboard, wobbly lines',
      packs: ['Infographic loop', 'Concept to picture', 'Your own style', 'House rules'],
    });

    // edit_composition names no packs: the edit still gets v1's, and the house rules again.
    await fs.mkdir(path.join(folder, 'v1.src'), { recursive: true });
    await fs.writeFile(path.join(folder, 'v1.src', 'index.tsx'), '// piles');
    const edited = await editCompositionTool.handler({ artifactId: 'composition-1', instruction: 'Bigger year label.', budget: 'quick' }, ctx());
    file('composition-2', edited, 2);
    expect(inOrder(systems[1], [...PACK_TAGS, '<pack name="House rules">'])).toBe(true);
    expect(prompts[1]).toContain('Chalkboard, wobbly lines');
    const v2 = JSON.parse(await fs.readFile(path.join(folder, 'v2.debug.json'), 'utf-8'));
    expect(v2.request.craftPacks).toEqual(v1.request.craftPacks);
    expect(v2.prompt).toBe('Bigger year label.');

    // from the EDIT: back to v1's request, in a new folder, said so.
    const again = await generateCompositionTool.handler({ title: 'Two piles again', from: 'composition-2', budget: 'quick' }, ctx());
    expect(again.isError).toBeUndefined();
    expect(again.content[0].text).toContain(
      "Rebuilt from composition-2's request, unchanged (its brief, packs, style, format and loop), at the Quick budget. That is v1's request: the edits up to v2 are not in this build.",
    );
    expect(inOrder(systems[2], [...PACK_TAGS, '<pack name="House rules">'])).toBe(true);
    expect(prompts[2]).toContain(brief);
    expect(prompts[2]).toContain('Chalkboard, wobbly lines');
    const rebuilt = JSON.parse(await fs.readFile(path.join(workspace, 'compositions', 'two-piles-again', 'v1.debug.json'), 'utf-8'));
    expect(rebuilt.prompt).toBe(v1.prompt);
    expect(rebuilt.request).toMatchObject({ format: v1.request.format, craftPacks: v1.request.craftPacks, style: v1.request.style });
    expect(rebuilt.request).not.toHaveProperty('editOf');
  });

  it('a build with no packs and no builder skills composes none', async () => {
    const res = await generateCompositionTool.handler(
      { title: 'Plain', brief: 'A ball bounces once.', width: 1080, height: 1080, fps: 30, durationSeconds: 2, budget: 'quick' },
      makeToolContext({ workspaceDir: workspace }),
    );
    expect(res.isError).toBeUndefined();
    expect(systems[0]).not.toContain('# Craft packs');
  });
});
