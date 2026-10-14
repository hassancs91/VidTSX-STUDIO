import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// The service end to end with a scripted session: runLlmGenerate is replaced by
// a fake that calls the builder's real tool handlers and reports turns the way
// ClaudeSession does, and that returns at once when its signal aborts (the
// real session rejects on abort while a tool may still be running).

let tmpDir = '';
vi.mock('electron', () => ({ app: { getPath: () => tmpDir, isPackaged: false } }));
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, _description: string, _schema: unknown, handler: unknown) => ({ name, handler }),
  createSdkMcpServer: (options: unknown) => options,
}));
const checkBuild = vi.fn();
const renderBuildStills = vi.fn();
vi.mock('./build-check', () => ({ checkBuild: (...args: unknown[]) => checkBuild(...args) }));
vi.mock('./build-stills', () => ({ renderBuildStills: (...args: unknown[]) => renderBuildStills(...args) }));
const measureLoopSeam = vi.fn();
const measureFramePurity = vi.fn();
vi.mock('./build-looks', () => ({
  PHONE_FEED_WIDTH: 390,
  renderPhoneView: async (_code: string, _config: unknown, dir: string, frame: number) => ({
    path: path.join(dir, `phone-f${frame}.jpg`),
    data: 'PHONE',
    mimeType: 'image/jpeg',
    frame,
    width: 390,
    height: 390,
    ms: { bundle: 1, render: 1 },
    bundleCached: true,
  }),
  renderContactSheet: vi.fn(),
  measureLoopSeam: (...args: unknown[]) => measureLoopSeam(...args),
  measureFramePurity: (...args: unknown[]) => measureFramePurity(...args),
}));

const releaseBundlesUnder = vi.fn(async (_dir: string) => 0);
vi.mock('../remotion-bundler', () => ({ releaseBundlesUnder: (dir: string) => releaseBundlesUnder(dir) }));

type ToolCall = (name: string, args?: Record<string, unknown>) => Promise<{ content: Array<{ text?: string }> }>;
interface Session {
  call: ToolCall;
  turn: (outputTokens: number) => void;
  signal: AbortSignal;
}
let script: (session: Session) => Promise<void>;
/** What each session was started with: the usage attribution. */
const llmCalls: Array<{ featureSource?: string; agentId?: string }> = [];
vi.mock('../../ipc/llm-handlers', () => ({
  runLlmGenerate: async (
    data: { featureSource?: string },
    signal: AbortSignal,
    _onTextDelta: unknown,
    extras: {
      mcpServers: Record<string, { tools: Array<{ name: string; handler: (a: unknown) => Promise<never> }> }>;
      onTurn: (u: unknown) => void;
      agentId?: string;
    },
  ) => {
    llmCalls.push({ featureSource: data.featureSource, ...(extras.agentId ? { agentId: extras.agentId } : {}) });
    const tools = extras.mcpServers.builder.tools;
    let n = 0;
    const session: Session = {
      call: (name, args = {}) => tools.find((t) => t.name === name)!.handler(args),
      turn: (outputTokens) => {
        n += 1;
        extras.onTurn({ turn: n, inputTokens: 1, outputTokens, cacheReadInputTokens: 5000, cacheCreationInputTokens: 200 });
      },
      signal,
    };
    const aborted = new Promise<'aborted'>((resolve) => {
      if (signal.aborted) resolve('aborted');
      signal.addEventListener('abort', () => resolve('aborted'), { once: true });
    });
    const outcome = await Promise.race([script(session).then(() => 'done' as const), aborted]);
    if (outcome === 'aborted') return { success: false, error: 'Request cancelled' };
    return { success: true, text: 'Done.', model: 'claude-sonnet-5-5', usage: { inputTokens: 9, outputTokens: 1234 } };
  },
}));

import { buildComposition } from './tsx-builder';
import type { BuildProgressEvent, BuildRequest } from './types';

const config = { id: 'BounceBall', width: 1080, height: 1080, fps: 30, durationInFrames: 60 };
const passed = (code: string) => ({ ok: true, errors: [], code, config, inlinedFiles: [], inlinedPackages: [], assets: [], ms: 5 });

function request(overrides: Partial<BuildRequest> = {}): { req: BuildRequest; events: BuildProgressEvent[] } {
  const events: BuildProgressEvent[] = [];
  return {
    events,
    req: {
      intent: 'A ball bounces once.',
      format: { width: 1080, height: 1080, fps: 30, durationInFrames: 60 },
      budget: 'quick',
      runsDir: path.join(tmpDir, 'runs'),
      projectsDir: path.join(tmpDir, 'projects'),
      onProgress: (e) => events.push(e),
      ...overrides,
    },
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-builder-'));
  releaseBundlesUnder.mockClear();
  llmCalls.length = 0;
  let checks = 0;
  checkBuild.mockReset().mockImplementation(async () => passed(`// check ${++checks}`));
  renderBuildStills.mockReset().mockImplementation(async (_code, _config, dir: string, frames: number[], opts: { label: string }) => ({
    stills: frames.map((frame) => ({ frame, path: path.join(dir, `${opts.label}-f${frame}.jpg`), data: 'AAAA', mimeType: 'image/jpeg' })),
    ms: { bundle: 1, render: 1 },
    bundleCached: false,
  }));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('buildComposition — caps and cancel', () => {
  it('stops at the output-token cap and keeps the last good check', async () => {
    script = async (s) => {
      s.turn(3000);
      await s.call('check');
      s.turn(4000);
      await s.call('check');
      s.turn(5000); // 12k > the 10k cap
      await s.call('check'); // never reached: the session ended at the cap
    };
    const { req, events } = request({ maxOutputTokens: 10_000 });
    const result = await buildComposition(req);
    expect(result).toMatchObject({ ok: true, finished: false, stopReason: 'cap-tokens', checks: 2, turns: 3 });
    expect(result.error).toBe('Stopped at the 10k output-token cap.');
    expect(result.tokens).toEqual({ input: 3, output: 12_000, cacheRead: 15_000, cacheCreation: 600 });
    expect(result.code).toBe('// check 2');
    expect(releaseBundlesUnder).toHaveBeenCalledTimes(1);
    expect(path.dirname(releaseBundlesUnder.mock.calls[0][0])).toBe(path.join(tmpDir, 'runs'));
    expect(await fs.readFile(result.version!.tsxPath, 'utf-8')).toBe('// check 2');
    const debug = JSON.parse(await fs.readFile(result.version!.debugPath, 'utf-8'));
    expect(debug).toMatchObject({ stopReason: 'cap-tokens', apiTurns: 3, keptCheck: 2, caps: { outputTokens: 10_000 } });
    expect(events.filter((e) => e.type === 'stopping')).toEqual([expect.objectContaining({ reason: 'cap-tokens' })]);
    expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'cap-tokens', ok: true, version: 1 });
  });

  it('cancel stops a render in flight, waits for it, and saves nothing', async () => {
    const caller = new AbortController();
    let renderStarted!: () => void;
    const started = new Promise<void>((resolve) => (renderStarted = resolve));
    let renderSettled = false;
    renderBuildStills.mockImplementationOnce(
      (_code, _config, _dir, _frames, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () =>
            setTimeout(() => {
              renderSettled = true;
              reject(new Error('renderStill() got cancelled'));
            }, 30),
          );
          renderStarted();
        }),
    );
    script = async (s) => {
      s.turn(500);
      await s.call('check');
      s.turn(500);
      const look = s.call('render_stills', { frames: [0, 30] });
      await started;
      caller.abort();
      await look;
    };
    const { req, events } = request({ signal: caller.signal });
    const result = await buildComposition(req);
    expect(renderSettled).toBe(true);
    expect(result).toMatchObject({ ok: false, finished: false, stopReason: 'cancelled', rounds: 0, error: 'Cancelled.' });
    expect(result.version).toBeUndefined();
    // The run's look bundles go once the render in flight has settled; the folder stays.
    expect(releaseBundlesUnder.mock.calls).toEqual([[result.runDir]]);
    expect(await fs.stat(result.runDir!).then((s) => s.isDirectory())).toBe(true);
    await expect(fs.readdir(path.join(tmpDir, 'projects'))).rejects.toThrow();
    const types = events.map((e) => e.type);
    expect(types.indexOf('stopping')).toBeGreaterThan(types.lastIndexOf('turn'));
    expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'cancelled', ok: false });
  });

  it('a cancel before the run starts never reaches the model', async () => {
    const caller = new AbortController();
    caller.abort();
    const scripted = vi.fn(async () => {});
    script = scripted;
    const { req } = request({ signal: caller.signal });
    const result = await buildComposition(req);
    expect(result.stopReason).toBe('cancelled');
    expect(checkBuild).not.toHaveBeenCalled();
  });

  it('a finished run reports rounds, turns, tokens and the phases it went through', async () => {
    // One build throughout (no edit between the look and finish).
    checkBuild.mockImplementation(async () => passed('// ball'));
    script = async (s) => {
      s.turn(800);
      await s.call('check');
      s.turn(600);
      await s.call('render_stills', { frames: [0, 59] });
      s.turn(200);
      await s.call('phone_view', { frame: 30 });
      s.turn(100);
      await s.call('finish', { summary: 'A ball, one bounce.' });
      s.turn(20);
    };
    const { req, events } = request();
    const result = await buildComposition(req);
    expect(result).toMatchObject({ ok: true, finished: true, stopReason: 'finished', rounds: 1, turns: 5, summary: 'A ball, one bounce.' });
    // Not a loop: no seam verdict at all.
    expect(result).not.toHaveProperty('seamOk');
    expect(result.tokens.output).toBe(1720);
    expect(result.usage).toMatchObject({ outputTokens: 1234 });
    expect(result.error).toBeUndefined();
    const phases = events.filter((e) => e.type === 'phase').map((e) => e.status.phase);
    expect(phases).toEqual([
      'working',
      'checking',
      'working',
      'rendering',
      'working',
      'rendering',
      'working',
      'checking',
      'working',
      'saving',
      'done',
    ]);
    const stills = events.find((e) => e.type === 'stills');
    expect(stills).toMatchObject({ frames: [0, 59], status: { round: 1, roundsMax: 1 } });
    expect(events[0]).toMatchObject({ type: 'start', budget: 'quick', roundsMin: 1, edit: false });
  });
});

describe('buildComposition — the loop seam on the result', () => {
  const seam = (jump: boolean) => ({
    wrap: jump ? 1.1 : 0.05,
    before: 0.1,
    after: 0.1,
    neighbours: 0.1,
    ratio: jump ? 11 : 0.5,
    jump,
    region: null,
    last: 59,
    ms: { bundle: 1, render: 1 },
    bundleCached: true,
  });
  const loop = { format: { width: 1080, height: 1080, fps: 30, durationInFrames: 60, loop: true } };

  it('a loop finished on a seam measured OK is saved with seamOk true', async () => {
    checkBuild.mockImplementation(async () => passed('// loop'));
    measureLoopSeam.mockResolvedValue(seam(false));
    script = async (s) => {
      s.turn(500);
      await s.call('render_stills', { frames: [0, 59] });
      await s.call('phone_view', { frame: 30 });
      await s.call('loop_seam');
      await s.call('finish', { summary: 'A seamless bounce.' });
    };
    const result = await buildComposition(request(loop).req);
    expect(result).toMatchObject({ ok: true, finished: true, seamOk: true });
    const debug = JSON.parse(await fs.readFile(result.version!.debugPath, 'utf-8'));
    expect(debug.seamOk).toBe(true);
  });

  it('a stubborn seam finishes through the escape hatch, recorded as seamOk false', async () => {
    let n = 0;
    checkBuild.mockImplementation(async () => passed(`// try ${Math.min(++n, 6)}`));
    measureLoopSeam.mockResolvedValue(seam(true));
    script = async (s) => {
      s.turn(500);
      await s.call('render_stills', { frames: [0, 59] }); // check 1
      await s.call('phone_view', { frame: 30 }); // check 2
      for (let i = 0; i < 3; i++) await s.call('loop_seam'); // checks 3-5: three builds, three JUMPs
      await s.call('render_stills', { frames: [59] }); // check 6: a look at the final build, past the budget (P3 D1)
      await s.call('finish', { summary: 'Gave up on the seam.' }); // check 7
    };
    const result = await buildComposition(request(loop).req);
    expect(result).toMatchObject({ ok: true, finished: true, seamOk: false, summary: 'Gave up on the seam.' });
    const debug = JSON.parse(await fs.readFile(result.version!.debugPath, 'utf-8'));
    expect(debug.seamOk).toBe(false);
  });
});

describe('buildComposition — frame purity on a physics result', () => {
  const physics = (code: string) => ({ ...passed(code), inlinedPackages: ['@vidtsx/sim', 'cannon-es'] });
  const purity = (pure: boolean) => ({
    pure,
    frames: [{ frame: 59, mean: pure ? 0 : 4.2, region: null, differs: !pure }],
    scale: 0.5,
    inOrderFrames: 60,
    paths: [],
    ms: { bundle: 1, inOrder: 1, alone: 1 },
    bundleCached: true,
    gl: 'angle',
  });

  it('a physics piece finished on a PURE check is saved with pureOk true; a 2D piece has no verdict', async () => {
    checkBuild.mockImplementation(async () => physics('// drop'));
    measureFramePurity.mockResolvedValue(purity(true));
    script = async (s) => {
      s.turn(500);
      await s.call('render_stills', { frames: [0, 59] });
      await s.call('phone_view', { frame: 30 });
      await s.call('purity_check');
      await s.call('finish', { summary: 'Balls drop and settle.' });
    };
    const result = await buildComposition(request().req);
    expect(result).toMatchObject({ ok: true, finished: true, pureOk: true });
    const debug = JSON.parse(await fs.readFile(result.version!.debugPath, 'utf-8'));
    expect(debug.pureOk).toBe(true);
    expect(result).not.toHaveProperty('seamOk');
  });

  it('a capped physics run keeps its last build, marked pureOk false when never measured', async () => {
    checkBuild.mockImplementation(async () => physics('// drop'));
    script = async (s) => {
      await s.call('check');
      s.turn(50_000);
      await new Promise(() => {}); // the token cap stops the run
    };
    const result = await buildComposition(request({ maxOutputTokens: 1000 }).req);
    expect(result).toMatchObject({ ok: true, finished: false, stopReason: 'cap-tokens', pureOk: false });
  });
});

describe("buildComposition — a caller's folder and usage (P3 part 1)", () => {
  const finishOne = async (s: Session) => {
    s.turn(100);
    await s.call('render_stills', { frames: [0, 59] });
    await s.call('phone_view', { frame: 30 });
    await s.call('finish', { summary: 'One bounce.' });
  };

  it('saves a new build as v1 into the folder the caller made, under its usage tag', async () => {
    checkBuild.mockImplementation(async () => passed('// ball'));
    script = finishOne;
    const into = path.join(tmpDir, 'session', 'work', 'compositions', 'bounce');
    await fs.mkdir(into, { recursive: true });
    const result = await buildComposition(request({ into, usage: { featureSource: 'agent', agentId: 'lwh.infographic-loop' } }).req);
    expect(result).toMatchObject({ ok: true, finished: true, version: { number: 1, folderPath: into } });
    expect(await fs.readFile(path.join(into, 'v1.tsx'), 'utf-8')).toBe('// ball');
    // Nothing went to the Creator library.
    expect(await fs.readdir(path.join(tmpDir, 'projects')).catch(() => [])).toEqual([]);
    expect(llmCalls).toEqual([{ featureSource: 'agent', agentId: 'lwh.infographic-loop' }]);
    const debug = JSON.parse(await fs.readFile(result.version!.debugPath, 'utf-8'));
    expect(debug.request).toMatchObject({ into, usage: { featureSource: 'agent', agentId: 'lwh.infographic-loop' } });
  });

  it('defaults to the Creator: a project in the library, usage tsx-generation', async () => {
    checkBuild.mockImplementation(async () => passed('// ball'));
    script = finishOne;
    const result = await buildComposition(request().req);
    expect(result.version?.folderPath).toBe(path.join(tmpDir, 'projects', 'bounce-ball'));
    expect(llmCalls).toEqual([{ featureSource: 'tsx-generation' }]);
  });

  it('refuses, before the model, a folder that is missing, already holds a version, or comes with editOf', async () => {
    const missing = path.join(tmpDir, 'nowhere');
    const used = path.join(tmpDir, 'used');
    await fs.mkdir(used, { recursive: true });
    await fs.writeFile(path.join(used, 'v1.tsx'), '// v1');
    const cases: Array<[Partial<BuildRequest>, RegExp]> = [
      [{ into: missing }, /does not exist/],
      [{ into: used }, /already holds v1: continue it with editOf/],
      [{ into: used, editOf: { folderPath: used } }, /not both/],
    ];
    for (const [overrides, error] of cases) {
      const result = await buildComposition(request(overrides).req);
      expect(result).toMatchObject({ ok: false, stopReason: 'error' });
      expect(result.error).toMatch(error);
    }
    expect(llmCalls).toEqual([]);
  });
});
