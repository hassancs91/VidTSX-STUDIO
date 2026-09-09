import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import type { StudioAgentEvent } from '../../shared/ipc/types';

let tmpDir = '';
let root = '';
const pushed = vi.hoisted(() => [] as StudioAgentEvent[]);

vi.mock('electron', () => ({ app: { getPath: () => tmpDir, isPackaged: false } }));
// The store's resolveLibraryPath must stay real — only the root is swapped.
vi.mock('../services/library/library-paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/library/library-paths')>()),
  getLibraryRoot: () => root,
}));
vi.mock('../services/studio/studio-agent', () => ({
  studioAgent: { push: (event: StudioAgentEvent) => pushed.push(event) },
}));
vi.mock('../ipc/llm-handlers', () => ({ runLlmGenerate: async () => ({ success: true, text: 'Tighter than the preset.' }) }));
vi.mock('./llm-handlers', () => ({ runLlmGenerate: async () => ({ success: true, text: 'Tighter than the preset.' }) }));

import { createPreset, readPreset } from '../services/library/preset-store';
import { clearAllPresetProposals } from '../services/studio/agent-preset-proposals';
import {
  handleStudioPresetLearn,
  handleStudioPresetProposalResolve,
  handleStudioPresetProposalsGet,
} from './preset-learn-handlers';
import type { StudioProject } from '../../shared/types/studio';
import { STUDIO_SCHEMA_VERSION } from '../../shared/types/studio';

const event = {} as IpcMainInvokeEvent;

function project(presetId: string): StudioProject {
  const clips = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, kind: 'video' as const, assetId: 'f', timelineStart: i * 3, duration: 3, sourceIn: i * 6 }));
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: 'demo',
    name: 'Demo',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
    settings: { width: 1920, height: 1080, fps: 30, agent: { providerId: 'claude-subscription', model: 'claude-opus-5' }, presetId },
    assets: [{ id: 'f', kind: 'video', path: 'C:/f.mp4', probe: { duration: 60, hasAudio: true } as never }],
    timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }] },
    proposals: [],
    shots: [],
  };
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-preset-learn-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(root, { recursive: true });
  await createPreset(root, {
    name: 'Lessons',
    videoKind: 'course',
    workflow: [{ id: 'transcribe' }],
    style: { pacing: 'relaxed', introSeconds: 10 },
    body: '# Lessons\n\nKeep every explanation.',
  });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  clearAllPresetProposals();
  pushed.length = 0;
});

describe('preset-learn handlers', () => {
  it('learn queues the card, pushes it on the agent stream and GET restores it', async () => {
    const res = await handleStudioPresetLearn(event, { projectId: 'demo', project: project('lessons') });
    expect(res.success).toBe(true);
    expect(res.proposal?.presetName).toBe('Lessons');
    expect(res.proposal?.summary).toBe('Tighter than the preset.');
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({ projectId: 'demo', kind: 'preset-update-proposal' });
    const got = await handleStudioPresetProposalsGet(event, { projectId: 'demo' });
    expect(got.proposals).toHaveLength(1);
    // A second learn while the card is pending is refused, not queued twice.
    const again = await handleStudioPresetLearn(event, { projectId: 'demo', project: project('lessons') });
    expect(again).toMatchObject({ success: false, error: expect.stringMatching(/already waiting/) });
  });

  it('learn reports a missing preset in words, with nothing queued', async () => {
    const res = await handleStudioPresetLearn(event, { projectId: 'demo', project: project('ghost') });
    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/no longer exists/) });
    expect(pushed).toHaveLength(0);
  });

  it('accept writes the knobs, appends the section and logs the entry; reject leaves the preset alone', async () => {
    const before = await readPreset(root, 'lessons');
    const learned = await handleStudioPresetLearn(event, { projectId: 'demo', project: project('lessons') });
    const proposal = learned.proposal!;
    expect(proposal.knobChanges.map((c) => c.key)).toContain('pacing');

    const rejected = await handleStudioPresetProposalResolve(event, { projectId: 'demo', proposalId: proposal.id, action: 'reject' });
    expect(rejected.success).toBe(true);
    expect(await readPreset(root, 'lessons')).toEqual(before);
    expect((await handleStudioPresetProposalsGet(event, { projectId: 'demo' })).proposals).toEqual([]);

    const second = (await handleStudioPresetLearn(event, { projectId: 'demo', project: project('lessons') })).proposal!;
    const accepted = await handleStudioPresetProposalResolve(event, { projectId: 'demo', proposalId: second.id, action: 'accept' });
    expect(accepted).toMatchObject({ success: true, presetName: 'Lessons', knobsChanged: second.knobChanges.length });
    const after = await readPreset(root, 'lessons');
    expect(after?.style.pacing).toBe('tight');
    expect(after?.style.introSeconds).toBe(0);
    expect(after?.body.startsWith('# Lessons\n\nKeep every explanation.\n\n## Learned from Demo on ')).toBe(true);
    expect(after?.body).toContain('Tighter than the preset.');
    expect(after?.learned).toHaveLength(1);
    expect(after?.learned?.[0]).toMatchObject({ projectId: 'demo', summary: 'Tighter than the preset.' });
    expect(after?.workflow).toEqual([{ id: 'transcribe' }]);

    const stale = await handleStudioPresetProposalResolve(event, { projectId: 'demo', proposalId: second.id, action: 'accept' });
    expect(stale).toMatchObject({ success: false, error: expect.stringMatching(/no longer pending/) });
  });
});
