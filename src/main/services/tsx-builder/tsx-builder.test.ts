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

type ToolCall = (name: string, args?: Record<string, unknown>) => Promise<{ content: Array<{ text?: string }> }>;
interface Session {
  call: ToolCall;
  turn: (outputTokens: number) => void;
  signal: AbortSignal;
}
let script: (session: Session) => Promise<void>;
vi.mock('../../ipc/llm-handlers', () => ({
  runLlmGenerate: async (
    _data: unknown,
    signal: AbortSignal,
    _onTextDelta: unknown,
    extras: {
      mcpServers: Record<string, { tools: Array<{ name: string; handler: (a: unknown) => Promise<never> }> }>;
      onTurn: (u: unknown) => void;
    },
  ) => {
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
const passed = (code: string) => ({ ok: true, errors: [], code, config, inlinedFiles: [], inlinedPackages: [], ms: 5 });

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
    script = async (s) => {
      s.turn(800);
      await s.call('check');
      s.turn(600);
      await s.call('render_stills', { frames: [0, 59] });
      s.turn(300);
      await s.call('finish', { summary: 'A ball, one bounce.' });
      s.turn(20);
    };
    const { req, events } = request();
    const result = await buildComposition(req);
    expect(result).toMatchObject({ ok: true, finished: true, stopReason: 'finished', rounds: 1, turns: 4, summary: 'A ball, one bounce.' });
    expect(result.tokens.output).toBe(1720);
    expect(result.usage).toMatchObject({ outputTokens: 1234 });
    expect(result.error).toBeUndefined();
    const phases = events.filter((e) => e.type === 'phase').map((e) => e.status.phase);
    expect(phases).toEqual(['working', 'checking', 'working', 'rendering', 'working', 'checking', 'working', 'saving', 'done']);
    const stills = events.find((e) => e.type === 'stills');
    expect(stills).toMatchObject({ frames: [0, 59], status: { round: 1, roundsMax: 1 } });
    expect(events[0]).toMatchObject({ type: 'start', budget: 'quick', roundsMin: 1, edit: false });
  });
});
