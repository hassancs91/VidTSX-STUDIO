import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// The scan's collaborators are heavyweight (LLM pipeline, electron paths) —
// mock them at the module seams; the scan/adopt/suppress logic is the target.
const gateResults = new Map<string, { success: boolean; error?: string }>();

vi.mock('./studio-paths', () => ({
  getProjectDir: (projectId: string) => Promise.resolve(path.join(tmpRoot, projectId)),
}));
vi.mock('./shot-generator', () => ({
  validateShotCode: (code: string) =>
    Promise.resolve(gateResults.get(code) ?? { success: true }),
}));
vi.mock('./shot-import', () => ({
  buildImportedShot: (shotId: string, name: string, _code: string, version: number) => ({
    id: shotId,
    name,
    kind: 'cutaway',
    createdAt: 'test',
    activeVersion: version,
    status: 'ready',
    origin: { by: 'user' },
  }),
}));

import { reconcileShots } from './shot-reconcile';
import { shotJobEvents } from './shot-job-events';

let tmpRoot: string;
let projectId = 'proj';

async function makeShotFolder(id: string, files: Record<string, string>): Promise<void> {
  const dir = path.join(tmpRoot, projectId, 'shots', id);
  await fs.mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content, 'utf-8');
  }
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-reconcile-'));
  gateResults.clear();
  // Fresh project id per test — the failure memo is module-level state.
  projectId = `proj-${Math.random().toString(36).slice(2, 8)}`;
});

describe('reconcileShots', () => {
  it('adopts an orphan folder at its newest version and publishes the event', async () => {
    await makeShotFolder('intro-title', { 'v1.tsx': 'old', 'v2.tsx': 'new' });
    const events: unknown[] = [];
    const off = shotJobEvents.onEvent((e) => events.push(e));
    const result = await reconcileShots(projectId, []);
    off();

    expect(result.failures).toEqual([]);
    expect(result.adopted).toHaveLength(1);
    expect(result.adopted[0]).toMatchObject({
      id: 'intro-title',
      name: 'Intro Title',
      activeVersion: 2,
      status: 'ready',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ projectId, shotId: 'intro-title', op: 'import', status: 'ready' });
  });

  it('skips registered ids, empty folders, and invalid folder names', async () => {
    await makeShotFolder('known-shot', { 'v1.tsx': 'code' });
    await makeShotFolder('reserved-empty', { 'chat.json': '{}' }); // in-flight window
    await makeShotFolder('Bad_Name!', { 'v1.tsx': 'code' });
    const result = await reconcileShots(projectId, ['known-shot']);
    expect(result.adopted).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it('reports a gate failure once, with conformability, and suppresses repeats', async () => {
    gateResults.set('import chroma from "chroma-js"; export default () => null; export const compositionConfig = { id: "x", durationInFrames: 30, fps: 30, width: 1920, height: 1080 };', {
      success: false,
      error: 'Import "chroma-js" is not allowed',
    });
    await makeShotFolder('fancy-shot', {
      'v1.tsx':
        'import chroma from "chroma-js"; export default () => null; export const compositionConfig = { id: "x", durationInFrames: 30, fps: 30, width: 1920, height: 1080 };',
    });

    const first = await reconcileShots(projectId, []);
    expect(first.adopted).toEqual([]);
    expect(first.failures).toHaveLength(1);
    expect(first.failures[0]).toMatchObject({ shotId: 'fancy-shot', conformable: true });
    expect(first.failures[0]!.sourcePath.endsWith('v1.tsx')).toBe(true);

    const second = await reconcileShots(projectId, []);
    expect(second.failures).toEqual([]); // memo-suppressed this session
  });

  it('returns empty results for a project with no shots folder', async () => {
    await fs.mkdir(path.join(tmpRoot, projectId), { recursive: true });
    const result = await reconcileShots(projectId, []);
    expect(result).toEqual({ adopted: [], failures: [] });
  });
});
