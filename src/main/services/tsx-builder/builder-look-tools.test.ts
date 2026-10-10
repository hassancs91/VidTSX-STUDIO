import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// The SDK's tool()/createSdkMcpServer are plain factories: stub them so the
// handlers can be called directly. The renders are stubbed at the service
// boundary (build-looks.ts); the seam verdict text is the real one.
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, description: string, _schema: unknown, handler: unknown) => ({ name, description, handler }),
  createSdkMcpServer: (options: unknown) => options,
}));
const checkBuild = vi.fn();
const renderContactSheet = vi.fn();
const renderPhoneView = vi.fn();
const measureLoopSeam = vi.fn();
vi.mock('./build-check', () => ({ checkBuild: (...args: unknown[]) => checkBuild(...args) }));
vi.mock('./build-stills', () => ({ renderBuildStills: vi.fn() }));
vi.mock('./build-looks', () => ({
  PHONE_FEED_WIDTH: 390,
  renderContactSheet: (...args: unknown[]) => renderContactSheet(...args),
  renderPhoneView: (...args: unknown[]) => renderPhoneView(...args),
  measureLoopSeam: (...args: unknown[]) => measureLoopSeam(...args),
}));

import { buildBuilderToolServer, type BuilderState } from './builder-tools';

type Result = { content: Array<{ type: string; text?: string; data?: string }>; isError?: boolean };
type Tool = { name: string; description: string; handler: (args: Record<string, unknown>) => Promise<Result> };

const config = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
const passed = { ok: true, errors: [], code: '// bundle', config, inlinedFiles: [], inlinedPackages: [], ms: 5 };
const seam = { wrap: 1.12, before: 0.1, after: 0.1, neighbours: 0.1, ratio: 11.2, jump: true, region: null, last: 239 };

async function setup(overrides: Partial<BuilderState> = {}) {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-builder-looks-'));
  const state: BuilderState = {
    dirs: { runId: 'b1-abcdef', runDir, workDir: path.join(runDir, 'work'), stillsDir: path.join(runDir, 'stills') },
    expect: { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true },
    roundsMax: 3,
    roundsMin: 2,
    roundsUsed: 0,
    checks: 0,
    phoneViews: 0,
    seamChecks: 0,
    lastGood: null,
    finished: null,
    stills: [],
    inFlight: new Set(),
    ...overrides,
  };
  const server = buildBuilderToolServer(state) as unknown as { tools: Tool[] };
  const find = (name: string) => server.tools.find((t) => t.name === name)!;
  const call = (name: string, args: Record<string, unknown> = {}) => find(name).handler(args);
  return { state, call, find };
}

beforeEach(() => {
  checkBuild.mockReset().mockResolvedValue(passed);
  renderContactSheet.mockReset().mockImplementation(async (_code, _config, dir: string, frames: number[], opts: { label: string }) => ({
    path: path.join(dir, `${opts.label}.jpg`),
    data: 'SHEET',
    mimeType: 'image/jpeg',
    frames: [...frames].sort((a, b) => a - b),
    layout: { cols: 3, rows: 1 },
    ms: { bundle: 1, render: 1 },
    bundleCached: false,
  }));
  renderPhoneView.mockReset().mockImplementation(async (_code, _config, dir: string, frame: number, opts: { label: string }) => ({
    path: path.join(dir, `${opts.label}-f${frame}.jpg`),
    data: 'PHONE',
    mimeType: 'image/jpeg',
    frame,
    width: 390,
    height: 488,
    ms: { bundle: 1, render: 1 },
    bundleCached: true,
  }));
  measureLoopSeam.mockReset().mockResolvedValue({ ...seam, ms: { bundle: 1, render: 1 }, bundleCached: true });
});

describe('contact_sheet', () => {
  it('is one look round with one image, recorded as a sheet of its frames', async () => {
    const onEvent = vi.fn();
    const { state, call } = await setup({ onEvent });
    const result = await call('contact_sheet', { frames: [120, 0, 60] });
    expect(state.roundsUsed).toBe(1);
    expect(result.content.filter((c) => c.type === 'image')).toHaveLength(1);
    expect(result.content[0].text).toContain('frames 0, 60, 120 in a 3×1 grid');
    expect(state.stills).toEqual([
      { round: 1, frame: 0, frames: [0, 60, 120], size: 'sheet', path: path.join(state.dirs.stillsDir, 'r01-sheet.jpg') },
    ]);
    expect(onEvent.mock.calls.at(-1)![0]).toMatchObject({ type: 'stills', size: 'sheet', frames: [0, 60, 120] });
  });

  it('counts toward the finish floor', async () => {
    const { state, call } = await setup();
    await call('contact_sheet', { frames: [0, 120] });
    await call('contact_sheet', { frames: [30, 90] });
    expect((await call('finish', { summary: 'two sheets' })).isError).toBeUndefined();
    expect(state.finished?.summary).toBe('two sheets');
  });

  it('gives the round back when the render fails, and is refused once the budget is spent', async () => {
    const { state, call } = await setup({ roundsUsed: 2 });
    renderContactSheet.mockRejectedValueOnce(new Error('TypeError: boom'));
    const failed = await call('contact_sheet', { frames: [0, 1] });
    expect(failed.content[0].text).toContain('runtime error in your code');
    expect(state.roundsUsed).toBe(2);
    await call('contact_sheet', { frames: [0, 1] });
    const spent = await call('contact_sheet', { frames: [0, 1] });
    expect(spent.content[0].text).toContain('look budget is spent');
    expect(renderContactSheet).toHaveBeenCalledTimes(2);
  });
});

describe('phone_view', () => {
  it('is free, shows one image and states the feed rule for this width', async () => {
    const { state, call, find } = await setup();
    const result = await call('phone_view', { frame: 120 });
    expect(state.roundsUsed).toBe(0);
    expect(state.phoneViews).toBe(1);
    expect(result.content[1]).toMatchObject({ type: 'image', data: 'PHONE' });
    expect(state.stills).toEqual([{ round: 0, frame: 120, size: 'phone', path: path.join(state.dirs.stillsDir, 'phone1-f120.jpg') }]);
    // 390 / 1080 = 36%: 11 pt needs ~31 px.
    expect(find('phone_view').description).toContain('shown at 36%: text under ~31 px');
  });

  it(`is capped at two per build, and a failed render does not count`, async () => {
    const { state, call } = await setup();
    renderPhoneView.mockRejectedValueOnce(new Error('ReferenceError: y'));
    await call('phone_view', { frame: 0 });
    expect(state.phoneViews).toBe(0);
    await call('phone_view', { frame: 0 });
    await call('phone_view', { frame: 60 });
    const third = await call('phone_view', { frame: 120 });
    expect(third.isError).toBe(true);
    expect(third.content[0].text).toContain('used up (2/2');
    expect(renderPhoneView).toHaveBeenCalledTimes(3);
  });
});

describe('loop_seam', () => {
  it('measures a loop for free and answers in numbers with a verdict', async () => {
    const onEvent = vi.fn();
    const { state, call } = await setup({ onEvent });
    const result = await call('loop_seam');
    expect(state.roundsUsed).toBe(0);
    expect(state.seamChecks).toBe(1);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('wrap 239 → 0 = 1.12');
    expect(result.content[0].text).toContain('JUMP');
    expect(onEvent.mock.calls.at(-1)![0]).toEqual({ type: 'seam', jump: true, wrap: 1.12, neighbours: 0.1 });
    const events = await fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8');
    expect(events).toContain('"tool":"loop_seam"');
  });

  it('does not apply to a build that is not a loop', async () => {
    const { call } = await setup({ expect: { width: 1080, height: 1350, fps: 30, durationInFrames: 240 } });
    const result = await call('loop_seam');
    expect(result.content[0].text).toContain('not a loop');
    expect(checkBuild).not.toHaveBeenCalled();
    expect(measureLoopSeam).not.toHaveBeenCalled();
  });

  it('reports a failing check instead of measuring', async () => {
    const { call } = await setup();
    checkBuild.mockResolvedValueOnce({ ...passed, ok: false, errors: ['Unexpected token'] });
    const result = await call('loop_seam');
    expect(result.content[0].text).toContain('check FAILED');
    expect(measureLoopSeam).not.toHaveBeenCalled();
  });
});
