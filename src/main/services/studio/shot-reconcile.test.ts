import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// The scan's collaborators are heavyweight (LLM pipeline, electron paths) —
// mock them at the module seams; the scan/adopt/suppress logic is the target.
const gateResults = new Map<string, { success: boolean; error?: string }>();
let gateCalls = 0;

vi.mock('./studio-paths', () => ({
  getProjectDir: (projectId: string) => Promise.resolve(path.join(tmpRoot, projectId)),
}));
vi.mock('./shot-generator', () => ({
  validateShotCode: (code: string) => {
    gateCalls += 1;
    return Promise.resolve(gateResults.get(code) ?? { success: true });
  },
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

import { reconcileFingerprint, reconcileShots } from './shot-reconcile';
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
  gateCalls = 0;
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

  it('an unchanged fingerprint skips the gate entirely on the next scan (window focus)', async () => {
    const bad = 'import x from "left-pad"; export default () => null;';
    gateResults.set(bad, { success: false, error: 'Import "left-pad" is not allowed' });
    await makeShotFolder('known-a', { 'v1.tsx': 'code' });
    await makeShotFolder('known-b', { 'v3.tsx': 'code' });
    await makeShotFolder('broken-drop-in', { 'v1.tsx': bad });

    await reconcileShots(projectId, ['known-a', 'known-b']);
    expect(gateCalls).toBe(1); // only the unknown folder, never the registered ones
    for (let i = 0; i < 5; i++) {
      expect(await reconcileShots(projectId, ['known-b', 'known-a'])).toEqual({ adopted: [], failures: [] });
    }
    expect(gateCalls).toBe(1);
  });

  it("rescans when an unknown folder's newest file changes, a version is added, or the known ids change", async () => {
    const bad = 'import x from "left-pad"; export default () => null;';
    gateResults.set(bad, { success: false, error: 'Import "left-pad" is not allowed' });
    await makeShotFolder('drop-in', { 'v1.tsx': bad });
    await reconcileShots(projectId, []);
    expect(gateCalls).toBe(1);

    const file = path.join(tmpRoot, projectId, 'shots', 'drop-in', 'v1.tsx');
    const later = new Date(Date.now() + 5000);
    await fs.utimes(file, later, later);
    await reconcileShots(projectId, []);
    expect(gateCalls).toBe(2);

    await makeShotFolder('drop-in', { 'v2.tsx': 'fixed' });
    const adopted = await reconcileShots(projectId, []);
    expect(gateCalls).toBe(3);
    expect(adopted.adopted.map((s) => s.id)).toEqual(['drop-in']);

    // The renderer folds the adoption: its known ids change, so the next scan
    // runs (and finds nothing left to check).
    await reconcileShots(projectId, ['drop-in']);
    expect(gateCalls).toBe(3);
    await makeShotFolder('another', { 'v1.tsx': 'code' });
    expect((await reconcileShots(projectId, ['drop-in'])).adopted.map((s) => s.id)).toEqual(['another']);
    expect(gateCalls).toBe(4);
  });

  it('fingerprints ignore listing order and see size, mtime, version and known-id changes', () => {
    const a = { shotId: 'a', version: 1, size: 10, mtimeMs: 1 };
    const b = { shotId: 'b', version: 2, size: 20, mtimeMs: 2 };
    const base = reconcileFingerprint(['x', 'y'], [a, b]);
    expect(reconcileFingerprint(['y', 'x'], [b, a])).toBe(base);
    expect(reconcileFingerprint(['x', 'y'], [{ ...a, size: 11 }, b])).not.toBe(base);
    expect(reconcileFingerprint(['x', 'y'], [{ ...a, mtimeMs: 9 }, b])).not.toBe(base);
    expect(reconcileFingerprint(['x', 'y'], [{ ...a, version: 2 }, b])).not.toBe(base);
    expect(reconcileFingerprint(['x'], [a, b])).not.toBe(base);
    expect(reconcileFingerprint(['x', 'y'], [a])).not.toBe(base);
  });

  it('returns empty results for a project with no shots folder', async () => {
    await fs.mkdir(path.join(tmpRoot, projectId), { recursive: true });
    const result = await reconcileShots(projectId, []);
    expect(result).toEqual({ adopted: [], failures: [] });
  });
});
