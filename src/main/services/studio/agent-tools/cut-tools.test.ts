// propose_cuts through the REAL tool handler (B3, decision 4: no model call):
// a fixture "agent" submits one retake span inside continuous speech, the real
// snapper plans the edit, and the proposal it emits carries analyze_cut's two
// checks on that plan — the cut-in lands in hot speech (a hard entry) and the
// word before the cut releases into speech (a tail on a release). Only the I/O
// edges (cache dir, waveform file, transcript, cut style) are mocked.
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioProposal } from '../../../../shared/types/studio';
import { WAVEFORM_VERSION } from '../../../../shared/types/studio-waveform';
import { cutStyleKey } from '../../../../shared/studio/cut-style-resolve';
import { TEST_TIGHT_STYLE } from '../../../../shared/studio/cut-style-test-fixtures';
import { QA_HARD_ENTRY_DB } from '../../../../shared/studio/cut-qa';
import type { StudioToolContext } from './types';

const env = vi.hoisted(() => ({ cacheDir: '' }));

/** "one … eight", 0.4 s words 0.1 s apart from 0.5 s to 4.4 s. */
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'].map((text, i) => ({
  text,
  start: 0.5 + i * 0.5,
  end: 0.9 + i * 0.5,
}));

vi.mock('electron', () => ({ app: { getPath: () => 'x', isPackaged: false } }));
vi.mock('../studio-paths', () => ({ getProjectCacheDir: async () => env.cacheDir }));
vi.mock('../waveform-generator', () => ({
  generateWaveform: async () => undefined,
  waveformRelPath: (assetId: string) => path.join('waveforms', `${assetId}.json`),
}));
vi.mock('../asset-transcriber', () => ({
  readTranscriptFile: async () => ({
    words: WORDS,
    engine: 'assemblyai',
    features: {
      wordTimestamps: true,
      approximateWordTimestamps: false,
      speakerLabels: true,
      highlights: false,
      sentiment: false,
      audioEvents: false,
      verbatimDisfluencies: true,
    },
  }),
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

const { buildCutTools } = await import('./cut-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

const BPS = 50;

function proposeCuts(): { tool: ToolLike; events: unknown[] } {
  const events: unknown[] = [];
  const ctx = {
    req: { projectId: 'p1', assets: [{ id: 'a1', name: 'clip.mp4', kind: 'video', path: 'src.mp4' }], reviewOpen: false },
    signal: new AbortController().signal,
    emit: (e: unknown) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  const tool = (buildCutTools(ctx) as unknown as ToolLike[]).find((t) => t.name === 'propose_cuts');
  if (!tool) throw new Error('propose_cuts missing');
  return { tool, events };
}

function emittedProposal(events: unknown[]): StudioProposal {
  const event = events.find((e) => (e as { kind?: string }).kind === 'proposal') as { proposal: StudioProposal } | undefined;
  if (!event) throw new Error('no proposal emitted');
  return event.proposal;
}

beforeEach(async () => {
  env.cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cut-tools-cache-'));
  // 8 s: room tone at -60 dB, continuous speech at -20 dB from 0.5 s to 4.4 s.
  const rmsDb = Array.from({ length: 8 * BPS }, (_, i) => {
    const t = i / BPS;
    return t >= 0.5 && t < 4.4 ? -20 : -60;
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
});

describe('propose_cuts (real handler) carries the cut QA on the editorial card', () => {
  it('a retake cut inside continuous speech: a hard entry at the cut-in, a tail on a release before it', async () => {
    const { tool, events } = proposeCuts();
    const res = await tool.handler(
      {
        assetId: 'a1',
        cuts: [{ start: 1.0, end: 2.4, category: 'retake', note: 'second take of "two three four" wins' }],
        summary: 'One retake.',
      },
      {},
    );
    expect(res.isError).toBeUndefined();
    const proposal = emittedProposal(events);
    expect(proposal.items).toHaveLength(1);
    const cut = proposal.items[0];
    const qa = proposal.qa;
    expect(qa).toMatchObject({ hardEntries: 1, clippedTails: 1, joinsChecked: 2, atomsChecked: 2 });
    const [entry, tail] = qa?.items ?? [];
    // The hard entry is the cut's own far edge (where the kept speech resumes),
    // read in the 50 ms just before it: +40 dB over the room tone.
    expect(entry).toMatchObject({ kind: 'hard-entry', sourceTime: cut.sourceEnd, assetId: 'a1' });
    expect(entry.overDb).toBeGreaterThan(QA_HARD_ENTRY_DB);
    // "one" ends at 0.9 s; its tail lands in "two", still speech.
    expect(tail).toMatchObject({ kind: 'clipped-tail', wordEnd: 0.9, assetId: 'a1' });
    expect(res.content[0].text).toContain('Hard entries 1 of 2 joins · tails on a release 1 of 2 landings.');
  });

  it('a cut to the end: no join to enter, one landing — checked as analyze_cut does (unclamped)', async () => {
    // Cutting "seven eight" to the end leaves one keep: the only real join is
    // the first segment (cut-in from room tone → no hard entry). Its one atom
    // ends at "six" (3.4 s); analyze_cut's tail check does not know about the
    // cut, so the landing it reads rides "seven" — a tail on a release, even
    // though the planner clamps the real segment end at the cut.
    const { tool, events } = proposeCuts();
    await tool.handler(
      { assetId: 'a1', cuts: [{ start: 3.45, end: 8, category: 'fluff', note: 'trailing aside' }], summary: 'Trim the end.' },
      {},
    );
    const proposal = emittedProposal(events);
    expect(proposal.qa).toMatchObject({ hardEntries: 0, joinsChecked: 1, clippedTails: 1, atomsChecked: 1 });
    expect(proposal.qa?.items[0]).toMatchObject({ kind: 'clipped-tail', wordEnd: 3.4 });
    expect(proposal.qa?.items[0].sourceTime).toBeGreaterThan(proposal.items[0].sourceStart ?? 0);
  });
});
