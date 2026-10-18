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
vi.mock('./build-looks', () => ({ PHONE_FEED_WIDTH: 390 }));

import { buildBuilderToolServer, VERIFY_LOOK_ALLOWANCE, type BuilderState } from './builder-tools';

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }>;

const config = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
const passed = { ok: true, errors: [], code: '// bundle', config, inlinedFiles: [], inlinedPackages: [], assets: [], ms: 5 };
/** The finish gate met for the stubbed bundle (its own tests are in builder-look-tools.test.ts). */
const gateMet = { phoneViews: 1, lastSeam: { code: '// bundle', jump: false }, lastLook: { code: '// bundle' } };

async function setup(overrides: Partial<BuilderState> = {}) {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-builder-tools-'));
  const state: BuilderState = {
    dirs: { runId: 'b1-abcdef', runDir, workDir: path.join(runDir, 'work'), stillsDir: path.join(runDir, 'stills') },
    expect: { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true },
    roundsMax: 3,
    roundsMin: 2,
    roundsUsed: 0,
    // The build the stubs check ('// bundle'): nothing looked at yet.
    lastLook: null,
    verifyLooks: 0,
    checks: 0,
    phoneViews: 0,
    seamChecks: 0,
    lastSeam: null,
    seamJumps: new Set(),
    purityChecks: 0,
    lastPurity: null,
    impureBuilds: new Set(),
    lastGood: null,
    finished: null,
    stills: [],
    imagesMax: 0,
    imagesGenerated: 0,
    imageCostUsd: 0,
    inFlight: new Set(),
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
  it('counts a look round and records every frame shown, by round', async () => {
    const { state, call } = await setup();
    await call('render_stills', { frames: [0, 120] });
    await call('render_stills', { frames: [239] });
    expect(state.roundsUsed).toBe(2);
    expect(state.stills.map(({ round, frame, size }) => ({ round, frame, size }))).toEqual([
      { round: 1, frame: 0, size: 'model' },
      { round: 1, frame: 120, size: 'model' },
      { round: 2, frame: 239, size: 'model' },
    ]);
    expect(path.basename(state.stills[2].path)).toBe('r02-f239.jpg');
    expect(renderBuildStills.mock.calls[1][4]).toMatchObject({ maxSide: 1024, label: 'r02' });
  });

  it("puts each frame's on-screen text under its label, before its image", async () => {
    const { call } = await setup();
    const line = { lines: [{ text: 'YEAR 12', faint: false }, { text: '+$24,000 interest', faint: true }], more: 0 };
    renderBuildStills.mockImplementationOnce(async (_code, _config, dir: string, frames: number[]) => ({
      stills: frames.map((frame, i) => ({ frame, path: path.join(dir, `f${frame}.jpg`), data: 'AAAA', mimeType: 'image/jpeg', text: i ? null : line })),
      ms: { bundle: 1, render: 1 },
      bundleCached: true,
    }));
    const result = await call('render_stills', { frames: [0, 120] });
    expect(result.content[0].text).toContain('read every number against your model at that frame');
    expect(result.content.map((c) => c.type)).toEqual(['text', 'text', 'image', 'text', 'image']);
    expect(result.content[1].text).toBe('Frame 0:\nText: "YEAR 12" · "+$24,000 interest" (faint)');
    expect(result.content[3].text).toBe('Frame 120:\nText: not read');
  });

  it('gives the round back when the render fails', async () => {
    const { state, call } = await setup();
    renderBuildStills.mockRejectedValueOnce(new Error('ReferenceError: x is not defined'));
    const result = await call('render_stills', { frames: [0] });
    expect(result.isError).toBe(true);
    expect(state.roundsUsed).toBe(0);
    expect(state.stills).toEqual([]);
  });

  it('refuses once the look budget is spent and this build has been looked at', async () => {
    const { call } = await setup({ roundsUsed: 3, lastLook: { code: '// bundle' } });
    const result = await call('render_stills', { frames: [0] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('look budget is spent (3/3) and you have looked at this exact build');
    expect(renderBuildStills).not.toHaveBeenCalled();
  });

  it(`past the budget, looks at a changed build (${VERIFY_LOOK_ALLOWANCE} times at most), under its own label`, async () => {
    const { state, call } = await setup({ roundsUsed: 3, lastLook: { code: '// bundle' } });
    for (let n = 1; n <= VERIFY_LOOK_ALLOWANCE; n++) {
      checkBuild.mockResolvedValue({ ...passed, code: `// fix ${n}` });
      const result = await call('render_stills', { frames: [0, 239] });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain(`Look rounds used: 3/3, plus ${n}/${VERIFY_LOOK_ALLOWANCE} extra looks at a changed build.`);
      expect(renderBuildStills.mock.calls.at(-1)![4]).toMatchObject({ label: `r03v${n}` });
      expect(state).toMatchObject({ roundsUsed: 3, verifyLooks: n, lastLook: { code: `// fix ${n}` } });
    }
    expect(state.stills.map((s) => path.basename(s.path))).toEqual(['r03v1-f0.jpg', 'r03v1-f239.jpg', 'r03v2-f0.jpg', 'r03v2-f239.jpg']);
    // The same build again, then a third change: both refused.
    expect((await call('render_stills', { frames: [0] })).content[0].text).toContain('looked at this exact build');
    checkBuild.mockResolvedValue({ ...passed, code: '// fix 3' });
    expect((await call('render_stills', { frames: [0] })).content[0].text).toContain('extra looks at a changed build are used too');
    expect(renderBuildStills).toHaveBeenCalledTimes(VERIFY_LOOK_ALLOWANCE);
  });

  it('gives an extra look back when its render fails', async () => {
    const { state, call } = await setup({ roundsUsed: 3 });
    renderBuildStills.mockRejectedValueOnce(new Error('ReferenceError: x is not defined'));
    await call('render_stills', { frames: [0] });
    expect(state).toMatchObject({ roundsUsed: 3, verifyLooks: 0, lastLook: null });
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
    const { state, call } = await setup(gateMet);
    await call('render_stills', { frames: [0] });
    expect((await call('finish', { summary: 'early' })).content[0].text).toContain('Push the DESIGN');
    await call('render_stills', { frames: [0] });
    const result = await call('finish', { summary: 'two rounds' });
    expect(result.isError).toBeUndefined();
    expect(state.finished).toMatchObject({ summary: 'two rounds', code: '// bundle' });
  });

  it('wants the final build looked at: a change after the last look is refused until a look of it', async () => {
    const { state, call } = await setup({ ...gateMet, roundsUsed: 3, roundsMin: 2 });
    checkBuild.mockResolvedValue({ ...passed, code: '// changed after the last round' });
    const refused = await call('finish', { summary: 's' });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('the code changed after your last look');
    // The seam was measured on the earlier build too: both in one refusal.
    expect(refused.content[0].text).toContain('\nAnd finish needs this free check first');
    const events = await fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8');
    expect(events).toContain('"missing":["look","loop_seam"]');
    await call('render_stills', { frames: [0, 120, 239] });
    state.lastSeam = { code: '// changed after the last round', jump: false };
    expect((await call('finish', { summary: 'seen' })).isError).toBeUndefined();
    expect(await fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8')).toContain('"looked":true,"verifyLooks":1');
  });

  it(`lets an unseen build through once the ${VERIFY_LOOK_ALLOWANCE} extra looks are used, and says so`, async () => {
    const { state, call } = await setup({ ...gateMet, roundsUsed: 3, verifyLooks: VERIFY_LOOK_ALLOWANCE });
    checkBuild.mockResolvedValue({ ...passed, code: '// one more change' });
    state.lastSeam = { code: '// one more change', jump: false };
    const result = await call('finish', { summary: 'unseen' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('the final build NOT looked at');
    expect(await fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8')).toContain('"looked":false');
  });

  it('keeps the first finish', async () => {
    const { state, call } = await setup({ roundsUsed: 2, ...gateMet });
    await call('finish', { summary: 'first' });
    await call('finish', { summary: 'second' });
    expect(state.finished?.summary).toBe('first');
  });

  it('checks the round floor before the phone/seam gate, in its own words', async () => {
    const { state, call } = await setup({ roundsUsed: 1 });
    const result = await call('finish', { summary: 'early' });
    expect(result.content[0].text).toContain('Push the DESIGN');
    expect(result.content[0].text).not.toContain('phone_view');
    expect(checkBuild).not.toHaveBeenCalled();
    expect(state.finished).toBeNull();
  });

  it('cannot finish on a failing check', async () => {
    const { state, call } = await setup({ roundsUsed: 2 });
    checkBuild.mockResolvedValueOnce({ ...passed, ok: false, errors: ['compositionConfig is 1080x1080'] });
    const result = await call('finish', { summary: 'x' });
    expect(result.content[0].text).toContain('Cannot finish');
    expect(state.finished).toBeNull();
  });
});

describe('stopping (cancel or a cap)', () => {
  it('passes the run signal to the renderer and gives the round back when a render is cancelled', async () => {
    const stop = new AbortController();
    const { state, call } = await setup({ signal: stop.signal });
    renderBuildStills.mockImplementationOnce(async (_c, _cfg, _dir, _frames, opts: { signal: AbortSignal }) => {
      expect(opts.signal).toBe(stop.signal);
      stop.abort();
      throw new Error('renderStill() got cancelled');
    });
    const result = await call('render_stills', { frames: [0] });
    expect(result.content[0].text).toContain('The run is stopping');
    expect(state.roundsUsed).toBe(0);
    expect(state.stills).toEqual([]);
    const events = await fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8');
    expect(events).toContain('"cancelled":true');
  });

  it('does not start a render when the stop lands during its check', async () => {
    const stop = new AbortController();
    const { state, call } = await setup({ signal: stop.signal });
    checkBuild.mockImplementationOnce(async () => {
      stop.abort();
      return passed;
    });
    const result = await call('render_stills', { frames: [0] });
    expect(result.content[0].text).toContain('The run is stopping');
    expect(renderBuildStills).not.toHaveBeenCalled();
    expect(state.roundsUsed).toBe(0);
  });

  it('refuses every tool once stopped', async () => {
    const stop = new AbortController();
    stop.abort();
    const { state, call } = await setup({ signal: stop.signal, roundsUsed: 2 });
    const args: Record<string, Record<string, unknown>> = {
      render_stills: { frames: [0] },
      contact_sheet: { frames: [0, 120] },
      phone_view: { frame: 0 },
      finish: { summary: 's' },
    };
    for (const name of ['check', 'render_stills', 'contact_sheet', 'phone_view', 'loop_seam', 'finish']) {
      const result = await call(name, args[name] ?? {});
      expect(result.isError).toBe(true);
    }
    expect(checkBuild).not.toHaveBeenCalled();
    expect(state.finished).toBeNull();
  });

  it('a finish whose final check outlives a cancel is not committed', async () => {
    const stop = new AbortController();
    const { state, call } = await setup({ signal: stop.signal, roundsUsed: 2 });
    checkBuild.mockImplementationOnce(async () => {
      stop.abort();
      return passed;
    });
    const result = await call('finish', { summary: 'raced' });
    expect(result.content[0].text).toContain('The run is stopping');
    expect(state.finished).toBeNull();
    // The check itself passed: it still counts as the last good build.
    expect(state.lastGood?.check).toBe(1);
  });

  it('tracks calls in flight and reports phases, checks and stills', async () => {
    const onEvent = vi.fn();
    const phases: string[] = [];
    const { state, call } = await setup({ onEvent, onPhase: (p) => phases.push(p) });
    let release!: () => void;
    checkBuild.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(passed))));
    const pending = call('check');
    await vi.waitFor(() => expect(state.inFlight.size).toBe(1));
    release();
    await pending;
    expect(state.inFlight.size).toBe(0);
    await call('render_stills', { frames: [0, 120] });
    expect(phases).toEqual(['checking', 'working', 'rendering', 'working']);
    expect(onEvent.mock.calls.map(([e]) => e.type)).toEqual(['check', 'check', 'stills']);
    expect(onEvent.mock.calls[2][0]).toMatchObject({ type: 'stills', size: 'model', frames: [0, 120] });
  });
});
