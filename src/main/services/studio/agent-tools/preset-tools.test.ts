// propose_preset_update through the REAL tool handler (B4, decision 4: no
// model call): a fixture project whose master lane holds 13 joins the user
// trimmed, the real cut-style.json, real preset store (temp library), real
// learn path — then the real accept handler writes `style.cut`.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import type { StudioClip, StudioProject } from '../../../../shared/types/studio';
import { STUDIO_SCHEMA_VERSION } from '../../../../shared/types/studio';
import type { CutPlanStyle, CutStyleSpec } from '../../../../shared/types/studio-cut-plan';
import type { StudioPresetStyle, StudioPresetUpdateProposal } from '../../../../shared/types/studio-preset';
import { WAVEFORM_VERSION } from '../../../../shared/types/studio-waveform';
import { FITTED_TIGHT, OLD_TIGHT, RATES, recording, type Recording } from '../../../../shared/studio/cut-learn-test-fixtures';
import { tailFor } from '../../../../shared/studio/cut-planner';
import { styleLeadIn } from '../../../../shared/studio/cut-learn-measure';
import type { StudioToolContext } from './types';

const env = vi.hoisted(() => ({ tmp: '', root: '', cacheDir: '', project: null as StudioProject | null, words: [] as unknown[] }));

vi.mock('electron', () => ({ app: { getPath: () => env.tmp, isPackaged: false } }));
vi.mock('../../library/library-paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../library/library-paths')>()),
  getLibraryRoot: () => env.root,
}));
vi.mock('../../../utils/paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/paths')>()),
  getSkillsDir: () => path.resolve('resources', 'skills'),
}));
vi.mock('../project-store', () => ({
  loadProject: async () => {
    if (!env.project) throw new Error('no project on disk');
    return env.project;
  },
}));
vi.mock('../studio-paths', () => ({ getProjectCacheDir: async () => env.cacheDir }));
vi.mock('../waveform-generator', () => ({
  generateWaveform: async () => undefined,
  waveformRelPath: (assetId: string) => path.join('waveforms', `${assetId}.json`),
}));
vi.mock('../asset-transcriber', () => ({ readTranscriptFile: async () => ({ words: env.words }) }));
vi.mock('../../../ipc/llm-handlers', () => ({ runLlmGenerate: async () => ({ success: false, error: 'no provider' }) }));
vi.mock('../studio-agent', () => ({ studioAgent: { push: () => undefined } }));

const { buildPresetTools } = await import('./preset-tools');
const { createPreset, readPreset } = await import('../../library/preset-store');
const { clearAllPresetProposals } = await import('../agent-preset-proposals');
const { handleStudioPresetProposalResolve } = await import('../../../ipc/preset-learn-handlers');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

const REC: Recording = recording(RATES);
let presetId = '';

/** The master lane: one clip per sentence, each join's edges where `style` puts them; `touched` joins tagged 'trim'. */
function lane(style: CutPlanStyle, touched: number): StudioClip[] {
  const { words, envelope } = REC.asset;
  const tailEdge = (k: number) => words[k].end + tailFor(envelope, words[k].end, words[k + 1].start - words[k].end, style).tail;
  const headEdge = (k: number) => words[k].start - styleLeadIn(envelope, words[k].start, style);
  let at = 0;
  return words.map((w, k) => {
    const start = k === 0 ? w.start - 0.5 : headEdge(k);
    const end = k === words.length - 1 ? w.end + 0.5 : tailEdge(k);
    const edges: { start?: 'trim'; end?: 'trim' } = {};
    if (k > 0 && k - 1 < touched) edges.start = 'trim';
    if (k < words.length - 1 && k < touched) edges.end = 'trim';
    const clip: StudioClip = {
      id: `c${k}`,
      kind: 'video',
      assetId: 'A',
      timelineStart: at,
      duration: end - start,
      sourceIn: start,
      origin: { by: 'agent', ...(Object.keys(edges).length > 0 ? { op: 'trim' as const, edges } : {}) },
    };
    at += end - start;
    return clip;
  });
}

function project(clips: StudioClip[], cutStyle?: CutStyleSpec): StudioProject {
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: 'p1',
    name: 'Act 1',
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    settings: { width: 1920, height: 1080, fps: 30, agent: {}, presetId, ...(cutStyle ? { cutStyle } : {}) },
    assets: [{ id: 'A', kind: 'video', path: 'C:/act1.mp4', probe: { duration: 40, hasAudio: true } as never }],
    timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }] },
    proposals: [],
    shots: [],
  };
}

async function learn(p: StudioProject): Promise<{ result: { text: string; isError?: boolean }; proposal: StudioPresetUpdateProposal }> {
  env.project = p;
  const events: unknown[] = [];
  const ctx = {
    req: { projectId: 'p1' },
    signal: new AbortController().signal,
    emit: (e: unknown) => events.push(e),
    state: { presetProposalCreated: false },
  } as unknown as StudioToolContext;
  const tool = (buildPresetTools(ctx) as unknown as ToolLike[]).find((t) => t.name === 'propose_preset_update');
  if (!tool) throw new Error('propose_preset_update missing');
  const res = await tool.handler({}, {});
  const event = events.find((e) => (e as { kind?: string }).kind === 'preset-update-proposal') as { proposal: StudioPresetUpdateProposal } | undefined;
  if (!event) throw new Error(`no card: ${res.content[0]?.text}`);
  return { result: { text: res.content[0]?.text ?? '', isError: res.isError }, proposal: event.proposal };
}

const cutChanges = (p: StudioPresetUpdateProposal) => new Map(p.knobChanges.filter((c) => c.key.startsWith('cut.')).map((c) => [c.key, c]));

async function presetWith(style: StudioPresetStyle): Promise<void> {
  const created = await createPreset(env.root, { name: `B4 ${Date.now()}-${Math.random()}`, videoKind: 'long', workflow: [{ id: 'auto_cut' }], style, body: '# B4' });
  presetId = created.id;
}

beforeAll(async () => {
  env.tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-preset-tools-'));
  env.root = path.join(env.tmp, 'assets');
  env.cacheDir = path.join(env.tmp, 'cache');
  await fs.mkdir(path.join(env.cacheDir, 'waveforms'), { recursive: true });
  await fs.writeFile(
    path.join(env.cacheDir, 'waveforms', 'A.json'),
    JSON.stringify({ version: WAVEFORM_VERSION, peaksPerSecond: 50, rmsDb: REC.levels, zcr: REC.zcr }),
    'utf-8',
  );
  env.words = REC.words;
});

beforeEach(async () => {
  // The old pre-October tight on the preset, over base tight (softGap 99: every join punchy).
  await presetWith({ pacing: 'tight', cut: { base: 'tight', head: 0.11, minTail: 0.14, maxTail: 0.4, margin: 5 } });
});

afterEach(() => {
  clearAllPresetProposals();
  env.project = null;
});

afterAll(async () => {
  await fs.rm(env.tmp, { recursive: true, force: true });
});

describe('propose_preset_update (real handler) learns the cut knobs from trimmed joins', () => {
  it('recovers the fitted tight from 13 joins and accept writes style.cut over the base', async () => {
    const { result, proposal } = await learn(project(lane(FITTED_TIGHT, 13)));
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain('Cut knobs: learned from 13 trimmed joins (13 lead-ins, 13 tails), 4 cut knob changes.');
    const cut = cutChanges(proposal);
    expect(cut.get('cut.head')).toMatchObject({ from: 0.11, to: 0.15 });
    expect(cut.get('cut.minTail')).toMatchObject({ from: 0.14, to: 0.08 });
    expect(cut.get('cut.margin')?.from).toBe(5);
    expect(Math.abs((cut.get('cut.margin')?.to as number) - 12)).toBeLessThanOrEqual(1);
    expect(cut.get('cut.maxTail')).toMatchObject({ from: 0.4, to: 0.5 });
    expect(cut.get('cut.maxTail')?.reason).toContain('at least 0.5 s');
    expect(cut.get('cut.head')?.reason).toBe('median lead-in 0.15 s at 13 joins (the style kept 0.11 s)');
    expect(proposal.cutLearn?.joins).toBe(13);
    expect(proposal.cutLines?.[0]).toBe(
      'Cut: learned from 13 joins you trimmed (13 lead-ins, 13 tails) — learned from your trims; Transcript deletes count once you trim them.',
    );
    expect(proposal.cutLines?.[1]).toBe('Lead-in: you kept a median 0.15 s before the first word (the style keeps 0.11 s); head 0.15 s reproduces your edges.');
    expect(proposal.cutLines?.[2]).toMatch(/^Tail: you kept a median .* s after the last word, cut .* dB over the floor \(the style: .*\); minTail 0\.08 s and margin .* dB reproduce your edges; maxTail at least 0\.5 s\.$/);
    expect(proposal.learnedSection).toContain('- Cut: learned from 13 joins you trimmed');
    // The card's style: base kept; knobs equal to base tight's drop back to it.
    expect(proposal.proposedStyle.cut).toMatchObject({ base: 'tight', maxTail: 0.5 });
    expect(proposal.proposedStyle.cut?.head).toBeUndefined();
    expect(proposal.proposedStyle.cut?.minTail).toBeUndefined();

    const accepted = await handleStudioPresetProposalResolve({} as IpcMainInvokeEvent, { projectId: 'p1', proposalId: proposal.id, action: 'accept' });
    expect(accepted).toMatchObject({ success: true });
    const saved = await readPreset(env.root, presetId);
    expect(saved?.style.cut).toMatchObject({ base: 'tight', maxTail: 0.5 });
    expect(saved?.style.cut?.head).toBeUndefined();
    expect(saved?.style.pacing).toBe(proposal.proposedStyle.pacing);
    expect(saved?.body).toContain('- Cut: learned from 13 joins you trimmed');
  });

  it("proposes no cut change when the joins sit at the current style's own edges", async () => {
    const { proposal } = await learn(project(lane(OLD_TIGHT, 13)));
    expect(cutChanges(proposal).size).toBe(0);
    expect(proposal.cutLearn?.joins).toBe(13);
    expect(proposal.cutLearn?.changes).toEqual([]);
  });

  it('proposes nothing under 10 touched joins and the card says how many it saw', async () => {
    const { result, proposal } = await learn(project(lane(FITTED_TIGHT, 9)));
    expect(cutChanges(proposal).size).toBe(0);
    expect(proposal.cutLines).toContain('Learned from 9 joins — at least 10 touched joins are needed before the cut knobs change.');
    expect(result.text).toContain('Cut knobs: learned from 9 trimmed joins (9 lead-ins, 9 tails), 0 cut knob changes.');
  });

  it("measures against a project override and says the override stays", async () => {
    await presetWith({ pacing: 'tight', cut: { base: 'tight' } });
    const override: CutStyleSpec = { base: 'tight', head: 0.11, minTail: 0.14, maxTail: 0.4, margin: 5 };
    const { proposal } = await learn(project(lane(FITTED_TIGHT, 13), override));
    expect(cutChanges(proposal).get('cut.head')).toMatchObject({ from: 0.11, to: 0.15 });
    expect(proposal.cutLines?.at(-1)).toContain("This project's own cut style (Project settings) overrides the preset");
  });

  it('a timeline with no trimmed join adds no cut half to the card (old projects)', async () => {
    const { proposal } = await learn(project(lane(FITTED_TIGHT, 0)));
    expect(proposal.cutLearn).toBeUndefined();
    expect(proposal.cutLines).toBeUndefined();
    expect(cutChanges(proposal).size).toBe(0);
  });
});
