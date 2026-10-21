import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// number_check and its finish gate (P4-12), and text_overlaps on the same
// sweep (P5-4). The renders are stubbed at the
// service boundary (build-looks.ts, number-sweep.ts); the comparison is the
// real one (number-check.ts).
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, description: string, _schema: unknown, handler: unknown) => ({ name, description, handler }),
  createSdkMcpServer: (options: unknown) => options,
}));
const checkBuild = vi.fn();
const renderContactSheet = vi.fn();
const sweepFrameText = vi.fn();
vi.mock('./build-check', () => ({ checkBuild: (...args: unknown[]) => checkBuild(...args) }));
vi.mock('./build-stills', () => ({ renderBuildStills: vi.fn() }));
vi.mock('./build-looks', () => ({
  PHONE_FEED_WIDTH: 390,
  renderContactSheet: (...args: unknown[]) => renderContactSheet(...args),
  renderPhoneView: vi.fn(),
  measureLoopSeam: vi.fn(),
  measureFramePurity: vi.fn(),
}));
vi.mock('./number-sweep', () => ({ sweepFrameText: (...args: unknown[]) => sweepFrameText(...args) }));

import { buildBuilderToolServer, BUILDER_TOOL_IDS, NUMBER_SPLIT_ALLOWANCE, type BuilderState } from './builder-tools';
import { numbersOkFor } from './builder-tool-common';
import type { FrameTextItem } from './frame-text';

type Result = { content: Array<{ type: string; text?: string }>; isError?: boolean };
type Tool = { name: string; description: string; handler: (args: Record<string, unknown>) => Promise<Result> };

const config = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
const passed = { ok: true, errors: [], code: '// bundle', config, inlinedFiles: [], inlinedPackages: [], assets: [], ms: 5 };
const still = { width: 1080, height: 1350, fps: 30, durationInFrames: 240 };

const node = (t: string, x: number, y: number, h = 40): FrameTextItem => ({ t, x, y, w: t.length * h * 0.55, h, o: 1 });
/** A year label and a total; `oneClock` false = the total from the continuous t (E3's slip). */
function sweep(oneClock: boolean) {
  const frames = Array.from({ length: 240 }, (_, frame) => {
    const t = Math.min(30, Math.max(0, (frame - 100) / 4));
    const year = Math.floor(t);
    const total = Math.round(10000 * 1.08 ** (oneClock ? year : t));
    return { frame, items: [node('YEAR', 60, 120), node(String(year), 200, 120), node(`$${total.toLocaleString('en-US')}`, 600, 900)] };
  });
  return { frames, step: 1, tiles: 'mounted', unread: 0, ms: 12 };
}
const lines = (...text: string[]) => ({ lines: text.map((t) => ({ text: t, faint: false })), more: 0 });

async function setup(overrides: Partial<BuilderState> = {}) {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-builder-numbers-'));
  const state: BuilderState = {
    dirs: { runId: 'b1-abcdef', runDir, workDir: path.join(runDir, 'work'), stillsDir: path.join(runDir, 'stills') },
    expect: still,
    roundsMax: 3,
    roundsMin: 2,
    roundsUsed: 2,
    lastLook: { code: '// bundle' },
    verifyLooks: 0,
    checks: 0,
    phoneViews: 1,
    seamChecks: 0,
    lastSeam: null,
    seamJumps: new Set(),
    purityChecks: 0,
    lastPurity: null,
    impureBuilds: new Set(),
    numbersMove: false,
    numberChecks: 0,
    lastNumbers: null,
    numberSplitBuilds: new Set(),
    overlapChecks: 0,
    lastSweep: null,
    lastGood: null,
    finished: null,
    stills: [],
    imagesMax: 0,
    imagesGenerated: 0,
    imageCostUsd: 0,
    inFlight: new Set(),
    ...overrides,
  };
  const server = buildBuilderToolServer(state) as unknown as { tools: Tool[] };
  const call = (name: string, args: Record<string, unknown> = {}) => server.tools.find((t) => t.name === name)!.handler(args);
  return { state, call };
}

const events = async (state: BuilderState) => fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8').catch(() => '');

beforeEach(() => {
  checkBuild.mockReset().mockResolvedValue(passed);
  sweepFrameText.mockReset().mockResolvedValue(sweep(true));
  renderContactSheet.mockReset().mockImplementation(async (_code, _config, dir: string, frames: number[], opts: { label: string }) => ({
    path: path.join(dir, `${opts.label}.jpg`),
    data: 'SHEET',
    mimeType: 'image/jpeg',
    frames,
    layout: { cols: 2, rows: 1 },
    tiles: 'mounted',
    text: frames.map((f) => ({ frame: f, text: lines('YEAR', String(f), '$10,000') })),
    ms: { bundle: 1, render: 1 },
    bundleCached: true,
  }));
});

describe('number_check', () => {
  it('is one of the builder tools', () => {
    expect(BUILDER_TOOL_IDS).toContain('number_check');
  });

  it('sweeps the build and answers OK or SPLIT, logged with the build', async () => {
    const { state, call } = await setup();
    const ok = await call('number_check');
    expect(ok.content[0].text).toContain('Verdict: OK');
    expect(sweepFrameText).toHaveBeenCalledWith('// bundle', config, state.dirs.stillsDir, expect.objectContaining({ label: 'numbers1', webgl: false }));
    // A changed build is swept afresh (the kept sweep is per exact build).
    checkBuild.mockResolvedValue({ ...passed, code: '// bundle v2' });
    sweepFrameText.mockResolvedValue(sweep(false));
    const split = await call('number_check');
    expect(split.content[0].text).toContain('Verdict: SPLIT');
    expect(split.content[0].text).toMatch(/while "YEAR \d+" held/);
    expect(state.numberSplitBuilds.size).toBe(1);
    expect(numbersOkFor(state, '// bundle v2')).toBe(false);
    expect(await events(state)).toContain('"tool":"number_check","n":2');
  });

  it('a failed sweep is reported, not thrown', async () => {
    sweepFrameText.mockRejectedValue(new Error('page crashed'));
    const { call } = await setup();
    const r = await call('number_check');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('page crashed');
  });
});

describe('finish and moving numbers', () => {
  it('does not ask for number_check when no look showed numbers that move', async () => {
    const { state, call } = await setup();
    renderContactSheet.mockImplementation(async (_c, _cf, dir: string, frames: number[]) => ({
      path: path.join(dir, 's.jpg'),
      data: 'S',
      mimeType: 'image/jpeg',
      frames,
      layout: { cols: 2, rows: 1 },
      text: frames.map((f) => ({ frame: f, text: lines('YEAR 30', '$100,627') })),
      ms: { bundle: 1, render: 1 },
      bundleCached: true,
    }));
    await call('contact_sheet', { frames: [0, 120] });
    expect(state.numbersMove).toBe(false);
    expect((await call('finish', { summary: 's' })).isError).toBeUndefined();
    expect(await events(state)).not.toContain('numbersOk');
  });

  it('once a look shows numbers that move, needs an OK number_check of this exact build', async () => {
    const { state, call } = await setup();
    await call('contact_sheet', { frames: [100, 130] });
    expect(state.numbersMove).toBe(true);
    expect((await call('finish', { summary: 's' })).content[0].text).toContain('number_check has not run yet');

    sweepFrameText.mockResolvedValue(sweep(false));
    await call('number_check');
    expect((await call('finish', { summary: 's' })).content[0].text).toContain('number_check says SPLIT or RACE on this build');

    checkBuild.mockResolvedValue({ ...passed, code: '// one clock' });
    expect((await call('finish', { summary: 's' })).content[0].text).toContain('number_check last swept an earlier build');
    sweepFrameText.mockResolvedValue(sweep(true));
    await call('number_check');
    await call('contact_sheet', { frames: [100, 130] }); // finish wants the changed build looked at (P3 D1)
    expect((await call('finish', { summary: 'fixed' })).isError).toBeUndefined();
    expect(await events(state)).toContain('"numbersOk":true,"numberChecks":2,"splitBuilds":1');
  });

  it(`lets a stubborn split through after ${NUMBER_SPLIT_ALLOWANCE} SPLIT builds, marked numbersOk false`, async () => {
    sweepFrameText.mockResolvedValue(sweep(false));
    const { state, call } = await setup({ numbersMove: true });
    for (let attempt = 1; attempt <= NUMBER_SPLIT_ALLOWANCE; attempt++) {
      checkBuild.mockResolvedValue({ ...passed, code: `// try ${attempt}` });
      await call('number_check');
      await call('number_check'); // the same build again is not another try
      expect(state.numberSplitBuilds.size).toBe(attempt);
    }
    await call('contact_sheet', { frames: [100, 130] });
    const result = await call('finish', { summary: 'stubborn' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('the numbers NOT verified');
    expect(result.content[0].text).toContain('numbersOk: false');
    expect(await events(state)).toContain(`"numbersOk":false,"numberChecks":${2 * NUMBER_SPLIT_ALLOWANCE},"splitBuilds":${NUMBER_SPLIT_ALLOWANCE}`);
  });
});

describe('text_overlaps (P5-4)', () => {
  /** The year sweep, plus a bar that slides through "$…" on frames 120-139. */
  function crossed() {
    const base = sweep(true);
    return {
      ...base,
      frames: base.frames.map((f) => ({
        ...f,
        shapes: [{ k: 'rect', x: f.frame >= 120 && f.frame < 140 ? 650 : 1200, y: 880, w: 30, h: 80, o: 1 }],
        moreShapes: 0,
      })),
    };
  }

  it('is one of the builder tools, and never a finish gate', async () => {
    expect(BUILDER_TOOL_IDS).toContain('text_overlaps');
    sweepFrameText.mockResolvedValue(crossed());
    const { state, call } = await setup();
    expect((await call('text_overlaps')).content[0].text).toContain('OVERLAPS');
    expect((await call('finish', { summary: 's' })).isError).toBeUndefined();
    expect(await events(state)).not.toContain('"missing"');
  });

  it('lists the run with its frames, and logs it', async () => {
    sweepFrameText.mockResolvedValue(crossed());
    const { state, call } = await setup();
    const r = await call('text_overlaps');
    expect(r.content[0].text).toContain('crossed by a rect: f120-139 (20 swept frames)');
    expect(sweepFrameText).toHaveBeenCalledWith('// bundle', config, state.dirs.stillsDir, expect.objectContaining({ label: 'overlaps1' }));
    expect(await events(state)).toContain('"tool":"text_overlaps","n":1');
  });

  it('shares one sweep per exact build with number_check', async () => {
    sweepFrameText.mockResolvedValue(crossed());
    const { state, call } = await setup();
    await call('number_check');
    await call('text_overlaps');
    expect(sweepFrameText).toHaveBeenCalledTimes(1);
    expect(await events(state)).toContain('"cached":true');
    checkBuild.mockResolvedValue({ ...passed, code: '// moved the bar' });
    await call('text_overlaps');
    expect(sweepFrameText).toHaveBeenCalledTimes(2);
    expect(state.lastSweep?.code).toBe('// moved the bar');
  });
});
