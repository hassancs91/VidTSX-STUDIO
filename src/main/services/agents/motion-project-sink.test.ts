// W7: the Motion project sink — the first composition creates the project,
// the next lands beside it, and nothing else is touched.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifactDraft, AgentSession } from '../../../shared/types/agents';

vi.mock('../../utils/paths', () => ({ getProjectsDir: () => '/unused' }));

const { resolveMotionProjectFolder, sinkCompositionIntoMotionProject } = await import(
  './motion-project-sink'
);

const CODE_1 = "export const compositionConfig = { id: 'One' };";
const CODE_2 = "export const compositionConfig = { id: 'Two' };";

let dir: string;
let workspace: string;
let projects: string;

function session(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 's-1',
    agentId: 'vidtsx/tsx-composer',
    agentVersion: '1.0.0',
    title: 'A session',
    createdAt: '2026-09-10T00:00:00.000Z',
    lastOpenedAt: '2026-09-10T00:00:00.000Z',
    motionSink: true,
    ...overrides,
  };
}

async function draft(relPath: string, code: string, title = 'Acme logo sting'): Promise<AgentArtifactDraft> {
  await fs.mkdir(path.join(workspace, path.dirname(relPath)), { recursive: true });
  await fs.writeFile(path.join(workspace, relPath), code, 'utf-8');
  return {
    kind: 'composition',
    title,
    payload: {
      relPath,
      config: { id: 'One', durationInFrames: 300, fps: 30, width: 1920, height: 1080 },
    },
  };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'motion-sink-'));
  workspace = path.join(dir, 'work');
  projects = path.join(dir, 'projects');
  await fs.mkdir(workspace, { recursive: true });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('sinkCompositionIntoMotionProject', () => {
  it('creates the project from the first composition and writes v1', async () => {
    const result = await sinkCompositionIntoMotionProject(
      session(),
      await draft('compositions/1-acme-logo-sting.tsx', CODE_1),
      workspace,
      projects,
    );
    expect(result.motionProjectId).toBe('acme-logo-sting');
    if (result.draft.kind !== 'composition') throw new Error('kind');
    const motion = result.draft.payload.motion;
    expect(motion?.folderPath).toBe(path.join(projects, 'acme-logo-sting'));
    expect(motion?.versionPath).toBe(path.join(projects, 'acme-logo-sting', 'v1.tsx'));
    expect(await fs.readFile(motion!.versionPath, 'utf-8')).toBe(CODE_1);
    // The workspace copy is untouched — the sink mirrors, it does not move.
    expect(result.draft.payload.relPath).toBe('compositions/1-acme-logo-sting.tsx');
  });

  it('writes the next version into the remembered project', async () => {
    const first = await sinkCompositionIntoMotionProject(
      session(),
      await draft('compositions/1-a.tsx', CODE_1),
      workspace,
      projects,
    );
    const second = await sinkCompositionIntoMotionProject(
      session({ motionProjectId: first.motionProjectId }),
      await draft('compositions/2-a.tsx', CODE_2),
      workspace,
      projects,
    );
    expect(second.motionProjectId).toBeUndefined();
    if (second.draft.kind !== 'composition') throw new Error('kind');
    expect(second.draft.payload.motion?.versionPath).toBe(
      path.join(projects, 'acme-logo-sting', 'v2.tsx'),
    );
    expect(await fs.readdir(path.join(projects, 'acme-logo-sting'))).toEqual(['v1.tsx', 'v2.tsx']);
    expect(await fs.readFile(second.draft.payload.motion!.versionPath, 'utf-8')).toBe(CODE_2);
  });

  it('recreates a project the user deleted rather than failing', async () => {
    const result = await sinkCompositionIntoMotionProject(
      session({ motionProjectId: 'gone' }),
      await draft('compositions/1-a.tsx', CODE_1),
      workspace,
      projects,
    );
    if (result.draft.kind !== 'composition') throw new Error('kind');
    expect(result.draft.payload.motion?.versionPath).toBe(path.join(projects, 'gone', 'v1.tsx'));
  });

  it('passes through sessions without the sink and non-composition drafts', async () => {
    const plain = await draft('compositions/1-a.tsx', CODE_1);
    const off = await sinkCompositionIntoMotionProject(session({ motionSink: undefined }), plain, workspace, projects);
    expect(off).toEqual({ draft: plain });
    const doc: AgentArtifactDraft = { kind: 'document', title: 'Notes', payload: { relPath: 'notes.md' } };
    expect(await sinkCompositionIntoMotionProject(session(), doc, workspace, projects)).toEqual({ draft: doc });
    await expect(fs.readdir(projects)).rejects.toBeTruthy();
  });
});

describe('resolveMotionProjectFolder', () => {
  it('joins a plain relative id under the projects dir', () => {
    expect(resolveMotionProjectFolder('/p', 'acme-logo-sting')).toBe(path.join('/p', 'acme-logo-sting'));
    expect(resolveMotionProjectFolder('/p', 'clients/acme')).toBe(path.join('/p', 'clients', 'acme'));
  });

  it('refuses absolute paths, drive letters and dot segments', () => {
    for (const bad of ['', ' x', '/abs', 'C:\\x', '..', 'a/../b', 'a//b', './a']) {
      expect(() => resolveMotionProjectFolder('/p', bad)).toThrow();
    }
  });
});
