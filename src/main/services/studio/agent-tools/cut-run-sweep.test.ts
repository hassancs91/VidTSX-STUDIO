// B7 step 9 (a) through the REAL `run_auto_cut` and `propose_cuts` handlers:
// each result ends with the clips on the timeline still without a card of this
// run, in timeline order, read from the project on disk + the call's own card.
// The case is pass 2 of the live exit run (nine M2 clips; editorial cards on all
// but 0374; turn 11 = Auto Cut on 0370, the model then skipped 0371). The real
// runner, planner and snapper run on a synthetic envelope; only I/O is mocked.
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioClip, StudioProject, StudioProposal, StudioTimeline } from '../../../../shared/types/studio';
import { WAVEFORM_VERSION } from '../../../../shared/types/studio-waveform';
import { cutStyleKey } from '../../../../shared/studio/cut-style-resolve';
import { TEST_TIGHT_STYLE } from '../../../../shared/studio/cut-style-test-fixtures';
import type { StudioToolContext } from './types';

const env = vi.hoisted(() => ({ cacheDir: '', project: null as StudioProject | null }));

vi.mock('electron', () => ({ app: { getPath: () => 'x', isPackaged: false } }));
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
    engine: 'assemblyai',
  }),
  readTranscriptMeta: async () => null,
  deleteTranscript: async () => undefined,
}));
vi.mock('../cut-style-store', () => ({
  resolveProjectCutStyle: async () => ({
    styleName: 'tight',
    style: TEST_TIGHT_STYLE,
    source: 'default',
    overrides: [],
    displayName: 'tight · default',
    key: cutStyleKey(TEST_TIGHT_STYLE),
  }),
}));
vi.mock('../../../../transcription-engine', () => ({ transcriptionEngine: {} }));
vi.mock('../media-jobs', () => ({ studioMediaJobs: {} }));

const { buildWorkflowTools } = await import('./workflow-tools');
const { buildCutTools } = await import('./cut-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

const BPS = 50;
const M2 = ['0366', '0369', '0370', '0371', '0372', '0373', '0374', '0375', '0376'];
const name = (clip: string) => `DJI_${clip}_D.MP4`;

/** The nine clips back to back on V1, each split once by an applied cut. */
function m2Timeline(): StudioTimeline {
  const clips = M2.flatMap((c, i) =>
    [0, 5].map((dt) => ({ id: `c${c}-${dt}`, kind: 'video', assetId: c, timelineStart: i * 10 + dt, duration: 4, sourceIn: dt }) as unknown as StudioClip),
  );
  return { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }] } as unknown as StudioTimeline;
}

let seq = 0;
function card(kind: 'auto-cut' | 'editorial', assetId: string): StudioProposal {
  seq += 1;
  return {
    id: `disk${seq}`,
    kind: 'cut-plan',
    status: 'applied',
    createdAt: new Date(Date.UTC(2026, 9, 23, 15, 57, seq)).toISOString(),
    agentNote: kind === 'auto-cut' ? 'Auto Cut (tight · default) · −3.1 s of 20.0 s' : 'Editorial cut · assemblyai · −2.0 s of 30.0 s',
    items: [{ id: `i${seq}`, status: 'accepted', assetId, sourceStart: 1, sourceEnd: 2 } as StudioProposal['items'][number]],
  };
}

const editorialRun = () => M2.filter((c) => c !== '0374').map((c) => card('editorial', c));

function onDisk(proposals: StudioProposal[]): void {
  env.project = {
    settings: { width: 3840, height: 2160, fps: 60, agent: {} },
    timeline: m2Timeline(),
    proposals,
  } as unknown as StudioProject;
}

function tools(): ToolLike[] {
  const ctx = {
    req: {
      projectId: 'p1',
      assets: M2.map((c) => ({ id: c, name: name(c), kind: 'video', path: `${c}.mp4` })),
      reviewOpen: false,
    },
    signal: new AbortController().signal,
    emit: () => undefined,
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return [...buildWorkflowTools(ctx), ...buildCutTools(ctx)] as unknown as ToolLike[];
}

async function call(tool: string, args: Record<string, unknown>): Promise<string> {
  const t = tools().find((x) => x.name === tool);
  if (!t) throw new Error(`${tool} missing`);
  const res = await t.handler(args, {});
  expect(res.isError).toBeUndefined();
  return res.content[0].text;
}

beforeEach(async () => {
  env.cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cut-run-sweep-'));
  const rmsDb = Array.from({ length: 5 * BPS }, (_, i) => {
    const t = i / BPS;
    return (t >= 0.2 && t < 0.9) || (t >= 3.0 && t < 3.8) ? -20 : -55;
  });
  await fs.mkdir(path.join(env.cacheDir, 'waveforms'), { recursive: true });
  for (const c of M2) {
    await fs.writeFile(
      path.join(env.cacheDir, 'waveforms', `${c}.json`),
      JSON.stringify({ version: WAVEFORM_VERSION, peaksPerSecond: BPS, rmsDb }),
      'utf-8',
    );
  }
});

afterEach(async () => {
  env.project = null;
  await fs.rm(env.cacheDir, { recursive: true, force: true });
});

describe('run_auto_cut (real handler) — B7 step 9 (a), the clips still without an Auto Cut card', () => {
  it('pass 2 turn 11: Auto Cut on 0370 after 0366 and 0369 → the other six in timeline order, 0371 first', async () => {
    onDisk([...editorialRun(), card('auto-cut', '0366'), card('auto-cut', '0369')]);
    const text = await call('run_auto_cut', { assetId: '0370' });
    expect(text).toContain(
      `Clips on the timeline still without an Auto Cut card in this run (timeline order): ${['0371', '0372', '0373', '0374', '0375', '0376'].map(name).join(', ')}. `,
    );
  });

  it('pass 2 turn 12 (the skip: 0372 after 0370): 0371 is listed first', async () => {
    onDisk([...editorialRun(), ...['0366', '0369', '0370'].map((c) => card('auto-cut', c))]);
    const text = await call('run_auto_cut', { assetId: '0372' });
    expect(text).toContain(`(timeline order): ${['0371', '0373', '0374', '0375', '0376'].map(name).join(', ')}. `);
  });

  it('the last clip → "Every clip on the timeline has an Auto Cut card in this run."', async () => {
    onDisk([...editorialRun(), ...M2.slice(0, 8).map((c) => card('auto-cut', c))]);
    expect(await call('run_auto_cut', { assetId: '0376' })).toContain('Every clip on the timeline has an Auto Cut card in this run.');
  });

  it('no project on disk → no line (the result is as before)', async () => {
    const text = await call('run_auto_cut', { assetId: '0370' });
    expect(text).not.toContain('in this run');
  });
});

describe('propose_cuts (real handler) — B7 step 9 (a), the clips still without an editorial card', () => {
  it('pass 2 turn 7 (0375, 0374 read and left uncut): 0374 and 0376 are listed', async () => {
    onDisk(['0366', '0369', '0370', '0371', '0372', '0373'].map((c) => card('editorial', c)));
    const text = await call('propose_cuts', {
      assetId: '0375',
      cuts: [{ start: 0.2, end: 0.9, category: 'retake', note: 'superseded by "Next part."' }],
      summary: 'One retake.',
    });
    expect(text).toContain(
      `Clips on the timeline still without an editorial card in this run (timeline order): ${name('0374')}, ${name('0376')}. `,
    );
  });
});
