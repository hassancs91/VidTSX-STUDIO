// `save_to_library` (W8 Stage 3): media re-described in place or copied into
// a folder, work files copied into the library, the same-kind artifact back.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact } from '../../../../shared/types/agents';
import { makeToolContext } from './test-context';

let root = '';
let workspace = '';
const upserts: Array<{ relPath: string; description?: string; brandId?: string }> = [];

vi.mock('../../../utils/paths', () => ({ getRemotionBinariesDir: () => null, getAssetsDir: () => root }));
vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => root,
  getLibraryRoot: () => root,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('../../library/library-store', () => ({
  upsertEntry: async (_r: string, relPath: string, meta: { description?: string; brandId?: string }) => {
    upserts.push({ relPath, description: meta.description, brandId: meta.brandId });
    return { relPath };
  },
}));
vi.mock('../../library/brand-store', () => ({
  readBrand: async (_r: string, id: string) => (id === 'acme' ? { id: 'acme', name: 'Acme' } : null),
}));

const { saveToLibraryTool } = await import('./save-to-library');

const video: AgentArtifact = {
  id: 'video-1',
  kind: 'video',
  title: 'Render',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'render_composition', callId: 'c0' },
  payload: { relPath: 'flows/x/render.mp4', durationSeconds: 3 },
};
const composition: AgentArtifact = {
  id: 'composition-1',
  kind: 'composition',
  title: 'Explainer',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'generate_composition', callId: 'c0' },
  payload: { relPath: 'compositions/explainer.tsx', config: { id: 'main', durationInFrames: 90, fps: 30, width: 1920, height: 1080 } },
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-save-'));
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-save-ws-'));
  upserts.length = 0;
  await fs.mkdir(path.join(root, 'flows', 'x'), { recursive: true });
  await fs.writeFile(path.join(root, 'flows', 'x', 'render.mp4'), 'mp4');
  await fs.mkdir(path.join(workspace, 'compositions'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'compositions', 'explainer.tsx'), 'tsx');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  await fs.rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const ctx = (artifacts: AgentArtifact[]) =>
  makeToolContext({ artifacts, workspaceDir: workspace, libraryFolder: 'flows/x', featureSource: 'flows', brandId: 'acme' });

describe('save_to_library', () => {
  it('re-describes and brand-tags a media artifact where it is when no folder is given', async () => {
    const res = await saveToLibraryTool.handler({ video: 'video-1', description: 'The explainer' }, ctx([video]));
    expect(res.isError).toBeUndefined();
    expect(upserts).toEqual([{ relPath: 'flows/x/render.mp4', description: 'The explainer', brandId: 'acme' }]);
    expect(res.artifact).toEqual({ kind: 'video', title: 'Render', payload: video.payload });
  });

  it('copies a media artifact into the given folder and returns the artifact at its new path', async () => {
    const res = await saveToLibraryTool.handler({ video: 'video-1', folder: 'generated/ads' }, ctx([video]));
    expect(res.isError).toBeUndefined();
    expect(await fs.readFile(path.join(root, 'generated', 'ads', 'render.mp4'), 'utf-8')).toBe('mp4');
    expect(upserts[0]).toMatchObject({ relPath: 'generated/ads/render.mp4', description: 'Render' });
    expect(res.artifact).toMatchObject({ kind: 'video', payload: { relPath: 'generated/ads/render.mp4' } });
  });

  it('copies a work file (composition) into the library and keeps the workspace path on the artifact', async () => {
    const res = await saveToLibraryTool.handler({ composition: 'composition-1' }, ctx([composition]));
    expect(res.isError).toBeUndefined();
    expect(await fs.readFile(path.join(root, 'flows', 'x', 'explainer.tsx'), 'utf-8')).toBe('tsx');
    expect(res.fields).toEqual({ relPath: 'flows/x/explainer.tsx' });
    expect(res.artifact).toMatchObject({ kind: 'composition', payload: { relPath: 'compositions/explainer.tsx' } });
  });

  it('refuses nothing to save, an unknown id and a job', async () => {
    expect((await saveToLibraryTool.handler({}, ctx([]))).isError).toBe(true);
    expect((await saveToLibraryTool.handler({ video: 'video-9' }, ctx([]))).isError).toBe(true);
    const job: AgentArtifact = { ...video, id: 'job-1', kind: 'job', payload: { jobId: 'j', job: 'render', status: 'pending' } };
    expect((await saveToLibraryTool.handler({ video: 'job-1' }, ctx([job]))).content[0].text).toContain('cannot be saved');
  });
});
