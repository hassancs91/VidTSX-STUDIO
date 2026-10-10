import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// The SDK's tool()/createSdkMcpServer are plain factories: stub them so the
// handlers can be called directly.
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, _description: string, _schema: unknown, handler: unknown) => ({ name, handler }),
  createSdkMcpServer: (options: unknown) => options,
}));
const checkBuild = vi.fn();
const renderBuildStills = vi.fn();
vi.mock('./build-check', () => ({ checkBuild: (...args: unknown[]) => checkBuild(...args) }));
vi.mock('./build-stills', () => ({ renderBuildStills: (...args: unknown[]) => renderBuildStills(...args) }));

import { buildBuilderToolServer, type BuilderState } from './builder-tools';

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }>;

const config = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
const passed = { ok: true, errors: [], code: '// bundle', config, inlinedFiles: [], inlinedPackages: [], ms: 5 };

async function setup(overrides: Partial<BuilderState> = {}) {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-builder-tools-'));
  const state: BuilderState = {
    dirs: { runId: 'b1-abcdef', runDir, workDir: path.join(runDir, 'work'), stillsDir: path.join(runDir, 'stills') },
    expect: { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true },
    roundsMax: 3,
    roundsMin: 2,
    roundsUsed: 0,
    checks: 0,
    lastGood: null,
    finished: null,
    stills: [],
    ...overrides,
  };
  const server = buildBuilderToolServer(state) as unknown as { tools: Array<{ name: string; handler: Handler }> };
  const call = (name: string, args: Record<string, unknown> = {}) => server.tools.find((t) => t.name === name)!.handler(args);
  return { state, call };
}

beforeEach(() => {
  checkBuild.mockReset().mockResolvedValue(passed);
  renderBuildStills.mockReset().mockImplementation(async (_code, _config, dir: string, frames: number[], opts: { label: string }) => ({
    stills: frames.map((frame) => ({ frame, path: path.join(dir, `${opts.label}-f${frame}.jpg`), data: 'AAAA', mimeType: 'image/jpeg' })),
    ms: { bundle: 1, render: 1 },
    bundleCached: false,
  }));
});

describe('check', () => {
  it('holds the build to the requested format and keeps the last good bundle', async () => {
    const { state, call } = await setup();
    const result = await call('check');
    expect(checkBuild).toHaveBeenCalledWith(state.dirs.workDir, state.expect);
    expect(result.isError).toBeUndefined();
    expect(state.lastGood).toMatchObject({ code: '// bundle', check: 1 });
  });
});

describe('render_stills', () => {
  it('counts a look round and records every frame shown, by round and size', async () => {
    const { state, call } = await setup();
    await call('render_stills', { frames: [0, 120] });
    await call('render_stills', { frames: [239], size: 'phone' });
    expect(state.roundsUsed).toBe(2);
    expect(state.stills.map(({ round, frame, size }) => ({ round, frame, size }))).toEqual([
      { round: 1, frame: 0, size: 'model' },
      { round: 1, frame: 120, size: 'model' },
      { round: 2, frame: 239, size: 'phone' },
    ]);
    expect(path.basename(state.stills[2].path)).toBe('r02-phone-f239.jpg');
  });

  it('gives the round back when the render fails', async () => {
    const { state, call } = await setup();
    renderBuildStills.mockRejectedValueOnce(new Error('ReferenceError: x is not defined'));
    const result = await call('render_stills', { frames: [0] });
    expect(result.isError).toBe(true);
    expect(state.roundsUsed).toBe(0);
    expect(state.stills).toEqual([]);
  });

  it('refuses once the look budget is spent', async () => {
    const { call } = await setup({ roundsUsed: 3 });
    const result = await call('render_stills', { frames: [0] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('look budget is spent');
    expect(renderBuildStills).not.toHaveBeenCalled();
  });
});

describe('finish', () => {
  it('asks for a look before anything else', async () => {
    const { state, call } = await setup({ roundsMin: 1 });
    const result = await call('finish', { summary: 'done' });
    expect(result.content[0].text).toContain('look at the build first');
    expect(state.finished).toBeNull();
  });

  it('is refused before the floor while rounds remain, then accepted', async () => {
    const { state, call } = await setup();
    await call('render_stills', { frames: [0] });
    expect((await call('finish', { summary: 'early' })).content[0].text).toContain('Push the DESIGN');
    await call('render_stills', { frames: [0] });
    const result = await call('finish', { summary: 'two rounds' });
    expect(result.isError).toBeUndefined();
    expect(state.finished).toMatchObject({ summary: 'two rounds', code: '// bundle' });
  });

  it('keeps the first finish', async () => {
    const { state, call } = await setup({ roundsUsed: 2 });
    await call('finish', { summary: 'first' });
    await call('finish', { summary: 'second' });
    expect(state.finished?.summary).toBe('first');
  });

  it('cannot finish on a failing check', async () => {
    const { state, call } = await setup({ roundsUsed: 2 });
    checkBuild.mockResolvedValueOnce({ ...passed, ok: false, errors: ['compositionConfig is 1080x1080'] });
    const result = await call('finish', { summary: 'x' });
    expect(result.content[0].text).toContain('Cannot finish');
    expect(state.finished).toBeNull();
  });
});
