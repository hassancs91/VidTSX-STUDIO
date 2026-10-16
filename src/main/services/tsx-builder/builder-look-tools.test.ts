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
const measureFramePurity = vi.fn();
vi.mock('./build-check', () => ({ checkBuild: (...args: unknown[]) => checkBuild(...args) }));
vi.mock('./build-stills', () => ({ renderBuildStills: vi.fn() }));
vi.mock('./build-looks', () => ({
  PHONE_FEED_WIDTH: 390,
  renderContactSheet: (...args: unknown[]) => renderContactSheet(...args),
  renderPhoneView: (...args: unknown[]) => renderPhoneView(...args),
  measureLoopSeam: (...args: unknown[]) => measureLoopSeam(...args),
  measureFramePurity: (...args: unknown[]) => measureFramePurity(...args),
}));

import { buildBuilderToolServer, PURITY_IMPURE_ALLOWANCE, SEAM_JUMP_ALLOWANCE, type BuilderState } from './builder-tools';
import { pureOkFor, seamOkFor } from './builder-tool-common';
import { EDIT_MIN_ROUNDS } from './builder-prompt';

type Result = { content: Array<{ type: string; text?: string; data?: string }>; isError?: boolean };
type Tool = { name: string; description: string; handler: (args: Record<string, unknown>) => Promise<Result> };

const config = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
const passed = { ok: true, errors: [], code: '// bundle', config, inlinedFiles: [], inlinedPackages: [], assets: [], ms: 5 };
const seam = { wrap: 1.12, before: 0.1, after: 0.1, neighbours: 0.1, ratio: 11.2, jump: true, region: null, last: 239 };
const okSeam = { ...seam, wrap: 0.09, ratio: 0.9, jump: false, ms: { bundle: 1, render: 1 }, bundleCached: true };
const purityRun = { scale: 0.4, inOrderFrames: 240, paths: [], ms: { bundle: 1, inOrder: 1, alone: 1 }, bundleCached: true, gl: 'angle' };
const pure = { ...purityRun, pure: true, frames: [80, 159, 239].map((frame) => ({ frame, mean: 0, region: null, differs: false })) };
const impure = {
  ...purityRun,
  pure: false,
  frames: [
    { frame: 80, mean: 0, region: null, differs: false },
    { frame: 239, mean: 3.77, region: { x: 95, y: 3, width: 350, height: 221, share: 0.03 }, differs: true },
  ],
};
/** A physics piece: check inlined an engine (the helper alone is not one). */
const physicsBuild = { ...passed, inlinedPackages: ['@vidtsx/sim', 'matter-js'] };

async function setup(overrides: Partial<BuilderState> = {}) {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-builder-looks-'));
  const state: BuilderState = {
    dirs: { runId: 'b1-abcdef', runDir, workDir: path.join(runDir, 'work'), stillsDir: path.join(runDir, 'stills') },
    expect: { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true },
    roundsMax: 3,
    roundsMin: 2,
    roundsUsed: 0,
    // The build the stubs check ('// bundle') has been looked at.
    lastLook: { code: '// bundle' },
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
  measureFramePurity.mockReset().mockResolvedValue(pure);
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

  it('renders a WebGL piece tile by tile, and a 2D piece mounted in one page', async () => {
    const { call } = await setup();
    await call('contact_sheet', { frames: [0, 120] });
    expect(renderContactSheet.mock.calls[0][4]).toMatchObject({ separateTiles: false });
    checkBuild.mockResolvedValue({ ...passed, code: '// 3d', inlinedPackages: ['@react-three/fiber', '@react-three/postprocessing', 'three'] });
    await call('contact_sheet', { frames: [0, 120] });
    expect(renderContactSheet.mock.calls[1][4]).toMatchObject({ separateTiles: true });
  });

  it('past the budget, sheets a changed build under its own label', async () => {
    const { state, call } = await setup({ roundsUsed: 3 });
    checkBuild.mockResolvedValue({ ...passed, code: '// changed' });
    const result = await call('contact_sheet', { frames: [0, 120] });
    expect(result.isError).toBeUndefined();
    expect(state).toMatchObject({ roundsUsed: 3, verifyLooks: 1, lastLook: { code: '// changed' } });
    expect(path.basename(state.stills[0].path)).toBe('r03v1-sheet.jpg');
  });

  it('counts toward the finish floor', async () => {
    const { state, call } = await setup({ phoneViews: 1, lastSeam: { code: '// bundle', jump: false } });
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

describe('purity_check', () => {
  it('is free, answers PURE or IMPURE in numbers, and records the verdict for this build', async () => {
    const onEvent = vi.fn();
    const { state, call } = await setup({ onEvent });
    const result = await call('purity_check');
    expect(state.roundsUsed).toBe(0);
    expect(state.purityChecks).toBe(1);
    expect(result.content[0].text).toContain('PURE: frames 80, 159, 239 render the same');
    expect(pureOkFor(state, '// bundle')).toBe(true);
    expect(onEvent.mock.calls.at(-1)![0]).toEqual({ type: 'purity', pure: true, frames: [80, 159, 239], worst: 0 });
    expect(measureFramePurity.mock.calls[0][3]).toMatchObject({ label: 'purity1' });
    measureFramePurity.mockResolvedValueOnce(impure);
    const bad = await call('purity_check', { frames: [80, 239] });
    expect(measureFramePurity.mock.calls[1][3]).toMatchObject({ label: 'purity2', frames: [80, 239] });
    expect(bad.content[0].text).toContain('IMPURE');
    // The box comes back in build pixels (the check renders at scale 0.4).
    expect(bad.content[0].text).toContain('Frame 239: mean difference 3.770 (0-255); differs in the box x 238-1110, y 8-558');
    expect(state.impureBuilds.size).toBe(1);
    expect(onEvent.mock.calls.at(-1)![0]).toMatchObject({ type: 'purity', pure: false, worst: 3.77 });
    const events = await fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8');
    expect(events).toContain('"tool":"purity_check"');
  });

  it('reports a failing check instead of measuring', async () => {
    const { call } = await setup();
    checkBuild.mockResolvedValueOnce({ ...passed, ok: false, errors: ['Unexpected token'] });
    expect((await call('purity_check')).content[0].text).toContain('check FAILED');
    expect(measureFramePurity).not.toHaveBeenCalled();
  });
});

describe('finish gate', () => {
  const events = async (state: BuilderState) => fs.readFile(path.join(state.dirs.runDir, 'events.jsonl'), 'utf-8');
  /** The builder edited its files: the next check bundles different code. */
  const editTo = (code: string) => checkBuild.mockResolvedValue({ ...passed, code });

  it('on a build that is not a loop, needs only one phone view', async () => {
    const { state, call } = await setup({ roundsUsed: 2, expect: { width: 1080, height: 1350, fps: 30, durationInFrames: 240 } });
    const refused = await call('finish', { summary: 's' });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('this free check first');
    expect(refused.content[0].text).toContain('phone_view has not run yet');
    expect(refused.content[0].text).not.toContain('loop_seam');
    expect(state.finished).toBeNull();
    await call('phone_view', { frame: 120 });
    expect((await call('finish', { summary: 's' })).isError).toBeUndefined();
    expect(state.finished?.summary).toBe('s');
    expect(measureLoopSeam).not.toHaveBeenCalled();
  });

  it('on a loop, names every missing check in one refusal', async () => {
    const { state, call } = await setup({ roundsUsed: 2 });
    const refused = await call('finish', { summary: 's' });
    expect(refused.content[0].text).toContain('these free checks first');
    expect(refused.content[0].text).toContain('phone_view has not run yet');
    expect(refused.content[0].text).toContain('loop_seam has not run yet');
    expect(await events(state)).toContain('"missing":["phone_view","loop_seam"]');
    // A phone view whose render failed does not count.
    renderPhoneView.mockRejectedValueOnce(new Error('ReferenceError: y'));
    await call('phone_view', { frame: 0 });
    expect((await call('finish', { summary: 's' })).content[0].text).toContain('phone_view has not run yet');
  });

  it('refuses a seam measured on an earlier build, and accepts once this build measures OK', async () => {
    measureLoopSeam.mockResolvedValue(okSeam);
    const { state, call } = await setup({ roundsUsed: 2 });
    await call('phone_view', { frame: 120 });
    await call('loop_seam');
    editTo('// bundle v2');
    const stale = await call('finish', { summary: 's' });
    expect(stale.isError).toBe(true);
    expect(stale.content[0].text).toContain('loop_seam last measured an earlier build');
    expect(stale.content[0].text).not.toContain('phone_view');
    await call('loop_seam');
    await call('contact_sheet', { frames: [0, 120] }); // finish wants the changed build looked at (P3 D1)
    expect((await call('finish', { summary: 's' })).isError).toBeUndefined();
    expect(state.finished?.code).toBe('// bundle v2');
    expect(seamOkFor(state, '// bundle v2')).toBe(true);
    expect(await events(state)).toContain('"seamOk":true');
  });

  it('refuses a JUMP on the build being finished, until a fix measures OK', async () => {
    const { state, call } = await setup({ roundsUsed: 2 });
    await call('phone_view', { frame: 120 });
    await call('loop_seam');
    const jumped = await call('finish', { summary: 's' });
    expect(jumped.content[0].text).toContain('loop_seam says JUMP on this build');
    expect(state.finished).toBeNull();
    editTo('// bundle fixed');
    measureLoopSeam.mockResolvedValue(okSeam);
    await call('loop_seam');
    await call('contact_sheet', { frames: [0, 120] }); // finish wants the changed build looked at (P3 D1)
    expect((await call('finish', { summary: 'fixed' })).isError).toBeUndefined();
    expect(state.finished?.summary).toBe('fixed');
  });

  it(`lets a stubborn seam through after ${SEAM_JUMP_ALLOWANCE} JUMPs on different builds, marked seamOk false`, async () => {
    const { state, call } = await setup({ roundsUsed: 2 });
    await call('phone_view', { frame: 120 });
    for (let attempt = 1; attempt <= SEAM_JUMP_ALLOWANCE; attempt++) {
      editTo(`// try ${attempt}`);
      await call('loop_seam');
      // The same build measured again is not another try.
      await call('loop_seam');
      expect(state.seamJumps.size).toBe(attempt);
      if (attempt < SEAM_JUMP_ALLOWANCE) {
        expect((await call('finish', { summary: 's' })).content[0].text).toContain('says JUMP');
      }
    }
    await call('contact_sheet', { frames: [0, 120] }); // finish wants the changed build looked at (P3 D1)
    const result = await call('finish', { summary: 'stubborn' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('loop seam NOT verified');
    expect(result.content[0].text).toContain('seamOk: false');
    expect(state.finished?.summary).toBe('stubborn');
    expect(await events(state)).toContain(`"seamOk":false,"seamJumps":${SEAM_JUMP_ALLOWANCE}`);
  });

  describe('on a piece that uses a physics engine', () => {
    const still = { width: 1080, height: 1350, fps: 30, durationInFrames: 240 };

    it('needs a PURE purity_check of this exact build; the helper alone does not count as physics', async () => {
      checkBuild.mockResolvedValue({ ...passed, inlinedPackages: ['@vidtsx/sim'] });
      const helperOnly = await setup({ roundsUsed: 2, expect: still, phoneViews: 1 });
      expect((await helperOnly.call('finish', { summary: 's' })).isError).toBeUndefined();

      checkBuild.mockResolvedValue(physicsBuild);
      const { state, call } = await setup({ roundsUsed: 2, expect: still, phoneViews: 1 });
      const refused = await call('finish', { summary: 's' });
      expect(refused.content[0].text).toContain('purity_check has not run yet: this piece simulates physics');
      await call('purity_check');
      checkBuild.mockResolvedValue({ ...physicsBuild, code: '// bundle v2' });
      expect((await call('finish', { summary: 's' })).content[0].text).toContain('purity_check last measured an earlier build');
      await call('purity_check');
      await call('contact_sheet', { frames: [0, 120] }); // finish wants the changed build looked at (P3 D1)
      expect((await call('finish', { summary: 's' })).isError).toBeUndefined();
      expect(state.finished).toMatchObject({ code: '// bundle v2', physics: true });
      expect(await events(state)).toContain('"pureOk":true');
    });

    it('refuses IMPURE on this build until a fix measures PURE', async () => {
      checkBuild.mockResolvedValue(physicsBuild);
      measureFramePurity.mockResolvedValue(impure);
      const { state, call } = await setup({ roundsUsed: 2, expect: still, phoneViews: 1 });
      await call('purity_check');
      const refused = await call('finish', { summary: 's' });
      expect(refused.content[0].text).toContain('purity_check says IMPURE on this build: step the simulation through useSimulation');
      expect(state.finished).toBeNull();
      checkBuild.mockResolvedValue({ ...physicsBuild, code: '// fixed' });
      measureFramePurity.mockResolvedValue(pure);
      await call('purity_check');
      await call('contact_sheet', { frames: [0, 120] }); // finish wants the changed build looked at (P3 D1)
      expect((await call('finish', { summary: 'fixed' })).isError).toBeUndefined();
    });

    it(`lets a stubborn piece through after ${PURITY_IMPURE_ALLOWANCE} IMPURE builds, marked pureOk false`, async () => {
      measureFramePurity.mockResolvedValue(impure);
      const { state, call } = await setup({ roundsUsed: 2, expect: still, phoneViews: 1 });
      for (let attempt = 1; attempt <= PURITY_IMPURE_ALLOWANCE; attempt++) {
        checkBuild.mockResolvedValue({ ...physicsBuild, code: `// try ${attempt}` });
        await call('purity_check');
        await call('purity_check'); // the same build again is not another try
        expect(state.impureBuilds.size).toBe(attempt);
      }
      await call('contact_sheet', { frames: [0, 120] }); // finish wants the changed build looked at (P3 D1)
      const result = await call('finish', { summary: 'stubborn' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('frame purity NOT verified');
      expect(result.content[0].text).toContain('pureOk: false');
      expect(await events(state)).toContain(`"pureOk":false,"purityChecks":${2 * PURITY_IMPURE_ALLOWANCE},"impureBuilds":${PURITY_IMPURE_ALLOWANCE}`);
    });

    it('on a loop, names the seam and the purity check in one refusal', async () => {
      checkBuild.mockResolvedValue(physicsBuild);
      const { state, call } = await setup({ roundsUsed: 2 });
      await call('finish', { summary: 's' });
      expect(await events(state)).toContain('"missing":["phone_view","loop_seam","purity_check"]');
    });
  });

  it("holds an edit to it too, after the edit's one-look floor", async () => {
    measureLoopSeam.mockResolvedValue(okSeam);
    const { state, call } = await setup({ roundsMin: EDIT_MIN_ROUNDS, roundsUsed: 1 });
    expect((await call('finish', { summary: 'edit' })).content[0].text).toContain('phone_view has not run yet');
    await call('phone_view', { frame: 0 });
    await call('loop_seam');
    expect((await call('finish', { summary: 'edit' })).isError).toBeUndefined();
    expect(state.finished?.summary).toBe('edit');
  });
});

// P3 part 5 (Hasan's 1(b)): a transparent Studio shot is LOOKED AT over its footage.
describe('a transparent Studio shot', () => {
  const piece = "export const compositionConfig = { id: 'shot', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };\nexport default function Shot() { return null; }";
  const backdrop = { file: path.join(os.tmpdir(), 'talk-proxy.mp4'), startSeconds: 2, label: 'talk.mp4 from 2.0 s' };

  it('sheets and phone-views the look wrapper with the footage, and measures seam and purity on the piece alone', async () => {
    checkBuild.mockResolvedValue({ ...passed, code: piece });
    const { state, call } = await setup({ lastLook: { code: piece }, studioShot: { transparent: true, backdrop } });
    await call('contact_sheet', { frames: [0, 120] });
    const [sheetCode, , , , sheetOpts] = renderContactSheet.mock.calls[0];
    expect(sheetCode).toContain('function VidtsxBackdropLook(');
    expect(sheetCode).toContain('"trimBefore":60');
    expect(sheetOpts).toMatchObject({ entryName: 'look.tsx', backdropFile: backdrop.file });
    // What the run records is the piece itself: finish compares against it.
    expect(state.lastLook).toEqual({ code: piece });

    await call('phone_view', { frame: 30 });
    expect(renderPhoneView.mock.calls[0][0]).toContain('function VidtsxBackdropLook(');
    expect(renderPhoneView.mock.calls[0][4]).toMatchObject({ entryName: 'look.tsx', backdropFile: backdrop.file });

    await call('loop_seam');
    expect(measureLoopSeam.mock.calls[0][0]).toBe(piece);
    expect(measureLoopSeam.mock.calls[0][3]).not.toHaveProperty('backdropFile');
    await call('purity_check', {});
    expect(measureFramePurity.mock.calls[0][0]).toBe(piece);
    // A Studio shot checks like any build: every file kind plays from its shot folder (P3 part 6).
    expect(checkBuild.mock.calls[0]).toEqual([state.dirs.workDir, state.expect]);
  });

  it('draws a checkerboard when no footage is under it, and leaves a cutaway alone', async () => {
    checkBuild.mockResolvedValue({ ...passed, code: piece });
    const { call } = await setup({ lastLook: { code: piece }, studioShot: { transparent: true } });
    await call('phone_view', { frame: 30 });
    expect(renderPhoneView.mock.calls[0][0]).toContain('"trimBefore":null');
    expect(renderPhoneView.mock.calls[0][4]).not.toHaveProperty('backdropFile');

    renderPhoneView.mockClear();
    const cutaway = await setup({ lastLook: { code: piece }, studioShot: { transparent: false } });
    await cutaway.call('phone_view', { frame: 30 });
    expect(renderPhoneView.mock.calls[0][0]).toBe(piece);
    expect(renderPhoneView.mock.calls[0][4]).not.toHaveProperty('entryName');
  });

  it('hands every file in assets/ to a look by its key, so props.assets.<key> shows its media', async () => {
    const { state, call } = await setup();
    await fs.mkdir(path.join(state.dirs.workDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(state.dirs.workDir, 'assets', 'logo.png'), 'png');
    await fs.writeFile(path.join(state.dirs.workDir, 'assets', 'notes.md'), 'not served');
    await call('phone_view', { frame: 0 });
    expect(renderPhoneView.mock.calls[0][4].assets).toEqual({ dir: path.join(state.dirs.workDir, 'assets'), keys: { logo: 'logo.png' } });
  });
});
