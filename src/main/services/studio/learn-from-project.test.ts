import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { StudioProject } from '../../../shared/types/studio';
import { STUDIO_SCHEMA_VERSION } from '../../../shared/types/studio';
import type { StudioPresetEntry } from '../../../shared/types/studio-preset';

const presets = vi.hoisted(() => new Map<string, StudioPresetEntry>());
const disk = vi.hoisted(() => ({ project: null as StudioProject | null }));
const llm = vi.hoisted(() => ({ calls: [] as string[], reply: 'LLM summary.' as string | null }));

vi.mock('electron', () => ({ app: { getPath: () => 'x', isPackaged: false } }));
vi.mock('../library/library-paths', () => ({ getLibraryRoot: () => 'root' }));
vi.mock('../library/preset-store', () => ({
  readPreset: async (_root: string, id: string) => presets.get(id) ?? null,
}));
vi.mock('./project-store', () => ({
  loadProject: async () => {
    if (!disk.project) throw new Error('no project on disk');
    return disk.project;
  },
}));
vi.mock('../../ipc/llm-handlers', () => ({
  runLlmGenerate: async (data: { prompt: string }) => {
    llm.calls.push(data.prompt);
    return llm.reply ? { success: true, text: `  ${llm.reply}\n` } : { success: false, error: 'no provider' };
  },
}));

import { learnFromProject } from './learn-from-project';
import { clearAllPresetProposals, getPendingPresetProposals } from './agent-preset-proposals';

function project(): StudioProject {
  const clips = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, kind: 'video' as const, assetId: 'f', timelineStart: i * 2, duration: 2, sourceIn: i * 4 }));
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: 'demo',
    name: 'Demo',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
    settings: { width: 1920, height: 1080, fps: 30, agent: {}, presetId: 'long' },
    assets: [{ id: 'f', kind: 'video', path: 'C:/f.mp4', probe: { duration: 60, hasAudio: true } as never }],
    timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }] },
    proposals: [],
    shots: [],
  };
}

beforeAll(() => {
  presets.set('long', {
    id: 'long',
    name: 'YouTube long-form',
    videoKind: 'long',
    workflow: [{ id: 'transcribe' }],
    style: { pacing: 'normal', shotsPerMinute: 1.5, introSeconds: 8 },
    body: '# Long',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
});

afterEach(() => {
  clearAllPresetProposals();
  llm.calls.length = 0;
  llm.reply = 'LLM summary.';
  disk.project = null;
});

describe('learnFromProject', () => {
  it('measures the live document, makes ONE summary call and queues the card with the knob diff', async () => {
    const result = await learnFromProject({ projectId: 'demo', project: project(), now: () => new Date('2026-09-09T12:00:00Z') });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { proposal } = result;
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]).toContain('Project "Demo" was edited on the preset "YouTube long-form" (long).');
    expect(llm.calls[0]).toContain('- Length 0:24 · 12 clips on the master lane · 27.5 cuts/min');
    expect(llm.calls[0]).toContain('Preset knobs before: pacing normal · about 1.5 shots per minute · intro 8 s.');
    expect(proposal.presetId).toBe('long');
    expect(proposal.presetName).toBe('YouTube long-form');
    expect(proposal.summary).toBe('LLM summary.');
    expect(proposal.summaryFallback).toBeUndefined();
    const keys = proposal.knobChanges.map((c) => c.key);
    expect(keys).toContain('pacing');
    expect(keys).toContain('introSeconds');
    expect(proposal.knobChanges.find((c) => c.key === 'pacing')).toMatchObject({ from: 'normal', to: 'tight' });
    expect(proposal.proposedStyle.pacing).toBe('tight');
    expect(proposal.proposedStyle.introSeconds).toBe(0);
    expect(proposal.learnedSection.startsWith('## Learned from Demo on 2026-09-09\n\nLLM summary.\n\n- Length 0:24')).toBe(true);
    expect(getPendingPresetProposals('demo')).toEqual([proposal]);
  });

  it('uses the agent-supplied summary without calling the LLM', async () => {
    const result = await learnFromProject({ projectId: 'demo', project: project(), summary: 'The user kept every cut and added none.' });
    expect(result.ok).toBe(true);
    expect(llm.calls).toHaveLength(0);
    if (result.ok) expect(result.proposal.summary).toBe('The user kept every cut and added none.');
  });

  it('falls back to the numbers when the summary call fails, and says so', async () => {
    llm.reply = null;
    const result = await learnFromProject({ projectId: 'demo', project: project() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.summaryFallback).toBe(true);
      expect(result.proposal.summary).toBe(result.proposal.statsSummary);
    }
  });

  it('reads the project from disk when no document is handed in (the chat path)', async () => {
    disk.project = project();
    const result = await learnFromProject({ projectId: 'demo' });
    expect(result.ok).toBe(true);
    expect(await learnFromProject({ projectId: 'other' })).toMatchObject({ ok: false, error: expect.stringMatching(/does not belong/) });
  });

  it('refuses without a preset, with a missing preset, with an empty timeline, and with a card already pending', async () => {
    const none = project();
    delete none.settings.presetId;
    expect(await learnFromProject({ projectId: 'demo', project: none })).toMatchObject({ ok: false, error: expect.stringMatching(/no editing preset/) });
    const missing = project();
    missing.settings.presetId = 'ghost';
    expect(await learnFromProject({ projectId: 'demo', project: missing })).toMatchObject({ ok: false, error: expect.stringMatching(/no longer exists/) });
    const empty = project();
    empty.timeline = { tracks: [] };
    expect(await learnFromProject({ projectId: 'demo', project: empty })).toMatchObject({ ok: false, error: expect.stringMatching(/timeline is empty/) });
    expect((await learnFromProject({ projectId: 'demo', project: project() })).ok).toBe(true);
    expect(await learnFromProject({ projectId: 'demo', project: project() })).toMatchObject({ ok: false, error: expect.stringMatching(/already waiting/) });
  });
});
