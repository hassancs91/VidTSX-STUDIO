import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact } from '../../../../shared/types/agents';
import { makeToolContext } from './test-context';

const resolveWebPageRefs = vi.fn();
vi.mock('../web-page-refs', () => ({
  resolveWebPageRefs: (...args: unknown[]) => resolveWebPageRefs(...args),
}));
vi.mock('../../../ipc/llm-handlers', () => ({ runLlmGenerate: vi.fn() }));

const { writePageTool } = await import('./write-page');
const { stripCodeFence } = await import('./edit-page');

const page = (body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>T</title></head><body>${body}</body></html>`;

const video: AgentArtifact = {
  id: 'video-1',
  kind: 'video',
  title: 'Hero',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'generate_video', callId: 'c' },
  version: 1,
  payload: { relPath: 'agents/web/hero.mp4', durationSeconds: 5 },
};

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-page-'));
  resolveWebPageRefs.mockReset();
  resolveWebPageRefs.mockImplementation(async (_a: string, _s: string, _arts: AgentArtifact[], refs: Array<{ artifactId: string; item: number }>) => ({
    resolved: refs.map((r) => ({ ...r, absPath: '/lib/hero.mp4', assetName: 'video-1.mp4', mime: 'video/mp4', bytes: 1000 })),
    problems: [],
  }));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('write_page', () => {
  it('stores a self-contained page as a web-page draft with its references', async () => {
    const ctx = makeToolContext({ workspaceDir: dir, artifacts: [video] });
    const res = await writePageTool.handler(
      { title: 'VidTSX landing', html: page('<video src="artifact:video-1"></video>') },
      ctx,
    );
    expect(res.isError).toBeUndefined();
    expect(res.artifact).toEqual({
      kind: 'web-page',
      title: 'VidTSX landing',
      payload: {
        relPath: 'pages/vidtsx-landing.html',
        refs: [{ artifactId: 'video-1', item: 0 }],
        inlineBytes: expect.any(Number),
      },
    });
    const written = await fs.readFile(path.join(dir, 'pages', 'vidtsx-landing.html'), 'utf-8');
    expect(written).toContain('artifact:video-1');
    expect(res.content[0].text).toContain('1 media reference(s)');
  });

  it('rejects an external image and a fetch with the reasons, storing nothing', async () => {
    const ctx = makeToolContext({ workspaceDir: dir });
    const res = await writePageTool.handler(
      {
        title: 'Probe',
        html: page(`<img src="https://example.com/x.png"><script>fetch('https://example.com')</script>`),
      },
      ctx,
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('reaches the network');
    expect(res.content[0].text).toContain('network API');
    expect(res.artifact).toBeUndefined();
    await expect(fs.readdir(path.join(dir, 'pages'))).rejects.toThrow();
  });

  it('rejects a reference the session cannot resolve', async () => {
    resolveWebPageRefs.mockResolvedValue({ resolved: [], problems: ['artifact:video-9 does not exist in this session — call list_artifacts for the ids.'] });
    const res = await writePageTool.handler({ title: 'P', html: page('<video src="artifact:video-9"></video>') }, makeToolContext({ workspaceDir: dir }));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('artifact:video-9 does not exist');
  });

  it('enforces the 16 MB inlined cap with a clear error', async () => {
    resolveWebPageRefs.mockResolvedValue({
      resolved: [{ artifactId: 'video-1', item: 0, absPath: '/lib/hero.mp4', assetName: 'video-1.mp4', mime: 'video/mp4', bytes: 14 * 1024 * 1024 }],
      problems: [],
    });
    const res = await writePageTool.handler({ title: 'Heavy', html: page('<video src="artifact:video-1"></video>') }, makeToolContext({ workspaceDir: dir, artifacts: [video] }));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/weighs 18\.\d MB, over the 16\.0 MB cap/);
    expect(res.content[0].text).toContain('artifact:video-1 14.0 MB');
  });

  it('numbers a second page with the same title', async () => {
    const ctx = makeToolContext({ workspaceDir: dir });
    await writePageTool.handler({ title: 'Same', html: page('<p>1</p>') }, ctx);
    const res = await writePageTool.handler({ title: 'Same', html: page('<p>2</p>') }, ctx);
    expect(res.artifact?.kind === 'web-page' && res.artifact.payload.relPath).toBe('pages/same-2.html');
  });
});

describe('edit_page fence stripping', () => {
  it('unwraps a fenced answer and leaves a bare one alone', () => {
    expect(stripCodeFence('```html\n<!doctype html><html></html>\n```')).toBe('<!doctype html><html></html>');
    expect(stripCodeFence('  <!doctype html><html></html>  ')).toBe('<!doctype html><html></html>');
  });
});
