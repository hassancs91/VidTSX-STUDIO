// run_auto_cut through the REAL tool handler (B2 fix round 1): the agent's
// Auto Cut must snap with the project's resolved cut style — the shipped
// cut-style.json, the shipped Course lesson preset read by the real
// preset-store, a fixture project on its preset — and only an explicit
// `style` (the user asked) or the project override changes that. The real
// runner and planner run on a synthetic envelope; only I/O edges are mocked.
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioProject, StudioProposal } from '../../../../shared/types/studio';
import type { StudioCutPlan } from '../../../../shared/types/studio-cut-plan';
import { WAVEFORM_VERSION } from '../../../../shared/types/studio-waveform';
import { cutStyleKey } from '../../../../shared/studio/cut-style-resolve';
import type { StudioToolContext } from './types';

const env = vi.hoisted(() => ({
  cacheDir: '',
  libraryRoot: '',
  project: null as StudioProject | null,
}));

vi.mock('electron', () => ({ app: { getPath: () => 'x', isPackaged: false } }));
vi.mock('../../../utils/paths', () => ({
  getSkillsDir: () => path.resolve(process.cwd(), 'resources/skills'),
}));
vi.mock('../../library/library-paths', () => ({
  getLibraryRoot: () => env.libraryRoot,
  resolveLibraryPath: (root: string, rel: string) => path.join(root, rel),
}));
vi.mock('../../agents/agent-skills', () => ({ loadAgentSkills: async () => [] }));
vi.mock('../../tsx-jobs/project-store', () => ({ reserveProjectFolder: async () => '' }));
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
vi.mock('../asset-transcriber', () => ({
  readTranscriptFile: async () => ({
    words: [
      { text: 'Hello', start: 0.2, end: 0.6 },
      { text: 'there.', start: 0.65, end: 0.9 },
      { text: 'Next', start: 3.0, end: 3.4 },
      { text: 'part.', start: 3.45, end: 3.8 },
    ],
    sttModelId: 'assemblyai/universal',
    engine: 'assemblyai',
  }),
  readTranscriptMeta: async () => null,
  deleteTranscript: async () => undefined,
}));
vi.mock('../../../../transcription-engine', () => ({ transcriptionEngine: {} }));
vi.mock('../media-jobs', () => ({ studioMediaJobs: {} }));

const { buildWorkflowTools } = await import('./workflow-tools');
const { CUT_PLAN_DIR } = await import('../cut-plan-runner');
const { loadCutStyleFile, resetCutStyleCache } = await import('../cut-style-store');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

const SHIPPED_PRESETS = path.resolve(process.cwd(), 'resources/presets');
const BPS = 50;

function project(settings: Partial<StudioProject['settings']>): StudioProject {
  return { settings: { width: 1920, height: 1080, fps: 30, agent: {}, ...settings } } as StudioProject;
}

function runAutoCut(): { tool: ToolLike; events: unknown[] } {
  const events: unknown[] = [];
  const ctx = {
    req: { projectId: 'p1', assets: [{ id: 'a1', name: 'clip.mp4', kind: 'video', path: 'src.mp4' }], reviewOpen: false },
    signal: new AbortController().signal,
    emit: (e: unknown) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  const tool = (buildWorkflowTools(ctx) as unknown as ToolLike[]).find((t) => t.name === 'run_auto_cut');
  if (!tool) throw new Error('run_auto_cut missing');
  return { tool, events };
}

async function onlyPlan(): Promise<{ name: string; plan: StudioCutPlan }> {
  const dir = path.join(env.cacheDir, CUT_PLAN_DIR);
  const names = await fs.readdir(dir);
  expect(names).toHaveLength(1);
  return { name: names[0], plan: JSON.parse(await fs.readFile(path.join(dir, names[0]), 'utf-8')) as StudioCutPlan };
}

beforeEach(async () => {
  resetCutStyleCache();
  env.cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-auto-cut-cache-'));
  env.libraryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'run-auto-cut-lib-'));
  // The shipped Course lesson preset (pacing relaxed, `auto_cut` light), as the
  // library seeds it: <root>/presets/<id>/preset.json + PRESET.md.
  await fs.cp(path.join(SHIPPED_PRESETS, 'course-lesson'), path.join(env.libraryRoot, 'presets', 'course-lesson'), {
    recursive: true,
  });
  env.project = project({ presetId: 'course-lesson' });
  const rmsDb = Array.from({ length: 5 * BPS }, (_, i) => {
    const t = i / BPS;
    return (t >= 0.2 && t < 0.9) || (t >= 3.0 && t < 3.8) ? -20 : -55;
  });
  await fs.mkdir(path.join(env.cacheDir, 'waveforms'), { recursive: true });
  await fs.writeFile(
    path.join(env.cacheDir, 'waveforms', 'a1.json'),
    JSON.stringify({ version: WAVEFORM_VERSION, peaksPerSecond: BPS, rmsDb }),
    'utf-8',
  );
});

afterEach(async () => {
  await fs.rm(env.cacheDir, { recursive: true, force: true });
  await fs.rm(env.libraryRoot, { recursive: true, force: true });
});

describe('run_auto_cut (real handler) snaps with the project’s resolved cut style', () => {
  it('no style in a Course lesson project → relaxed from the preset, not natural', async () => {
    const shipped = await loadCutStyleFile();
    const { tool, events } = runAutoCut();
    const res = await tool.handler({ assetId: 'a1' }, {});
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('style relaxed · preset “Course lesson”');
    const { name, plan } = await onlyPlan();
    expect(plan).toMatchObject({ styleName: 'relaxed', styleDisplayName: 'relaxed · preset “Course lesson”' });
    expect(plan.styleKey).toBe(cutStyleKey(shipped.styles.relaxed));
    expect(name).toBe(`a1-relaxed-${cutStyleKey(shipped.styles.relaxed)}.json`);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'proposal' }));
    // B3: the plan's QA rides on the plan file, the proposal and the reply.
    expect(plan.qa).toMatchObject({ hardEntries: 0, joinsChecked: 2, atomsChecked: 2 });
    const proposal = (events.find((e) => (e as { kind?: string }).kind === 'proposal') as { proposal: StudioProposal })
      .proposal;
    expect(proposal.qa).toEqual(plan.qa);
    expect(res.content[0].text).toContain('QA clean.');
  });

  it('the project override beats the preset', async () => {
    env.project = project({ presetId: 'course-lesson', cutStyle: { base: 'natural', head: 0.25 } });
    const res = await runAutoCut().tool.handler({ assetId: 'a1' }, {});
    expect(res.content[0].text).toContain('style natural + 1 override · project override');
    // The key is over the RESOLVED knobs (plan.style carries the planner's
    // timing compensation on top, so compare keys, not plan.style).
    const shipped = await loadCutStyleFile();
    expect((await onlyPlan()).plan.styleKey).toBe(cutStyleKey({ ...shipped.styles.natural, head: 0.25 }));
  });

  it('an explicit style (the user asked) still wins', async () => {
    const res = await runAutoCut().tool.handler({ assetId: 'a1', style: 'tight' }, {});
    expect(res.content[0].text).toContain('style tight · requested');
    expect((await onlyPlan()).plan.styleName).toBe('tight');
  });
});
