import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact, ArtifactOfKind } from '../../../shared/types/agents';
import { WEB_PAGE_EXPORT_CSP } from '../../../shared/agents/web-page';
import unzipper from 'unzipper';

let dir: string;
let libraryRoot: string;
let heroPath: string;

vi.mock('../library/library-paths', () => ({
  ensureLibraryRoot: async () => libraryRoot,
  resolveLibraryPath: (root: string, rel: string) => path.resolve(root, rel),
}));
vi.mock('./agent-sessions', () => ({
  agentWorkspaceDir: (_a: string, _s: string) => path.join(dir, 'work'),
}));
vi.mock('./web-page-refs', () => ({
  loadWebPage: async () => ({
    html: '<!doctype html><html><head><title>T</title></head><body><video src="artifact:video-1"></video></body></html>',
    resolved: [{ artifactId: 'video-1', item: 0, absPath: heroPath, assetName: 'video-1.mp4', mime: 'video/mp4', bytes: 5 }],
    problems: [],
  }),
  rewriteRefsForExport: (html: string) => html.replace('artifact:video-1', 'assets/video-1.mp4'),
}));

const { exportWebSite, writeWebSitePreview, buildSiteIndex } = await import('./web-page-export');

const page: ArtifactOfKind<'web-page'> = {
  id: 'web-page-1',
  kind: 'web-page',
  title: 'VidTSX landing',
  createdAt: '2026-09-10T00:00:00.000Z',
  producer: { tool: 'write_page', callId: 'c' },
  version: 2,
  payload: { relPath: 'pages/vidtsx-landing.html', refs: [{ artifactId: 'video-1', item: 0 }], inlineBytes: 10 },
};
const artifacts: AgentArtifact[] = [page];

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-export-'));
  libraryRoot = path.join(dir, 'library');
  heroPath = path.join(dir, 'hero.mp4');
  await fs.writeFile(heroPath, 'hero!');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('web site export', () => {
  it('writes index.html + assets/ under the session folder, plus the zip, and numbers repeats', async () => {
    const first = await exportWebSite({ agentId: 'vidtsx/web-designer', sessionId: 's1', artifacts, artifact: page, libraryFolder: 'agents/web-designer/s1' });
    expect(first.dir).toBe(path.join(libraryRoot, 'agents', 'web-designer', 's1', 'site-vidtsx-landing'));
    expect(first.files).toEqual(['index.html', 'assets/video-1.mp4']);
    const index = await fs.readFile(first.indexPath, 'utf-8');
    expect(index).toContain('src="assets/video-1.mp4"');
    expect(index).toContain(`content="${WEB_PAGE_EXPORT_CSP}"`);
    expect(index).not.toContain('artifact:');
    expect(await fs.readFile(path.join(first.dir, 'assets', 'video-1.mp4'), 'utf-8')).toBe('hero!');

    expect(first.zipPath).toBe(`${first.dir}.zip`);
    const zip = await unzipper.Open.file(first.zipPath as string);
    expect(zip.files.map((e) => e.path).sort()).toEqual(['assets/video-1.mp4', 'index.html']);

    const second = await exportWebSite({ agentId: 'vidtsx/web-designer', sessionId: 's1', artifacts, artifact: page, libraryFolder: 'agents/web-designer/s1' });
    expect(path.basename(second.dir)).toBe('site-vidtsx-landing-2');
  }, 20_000);

  it('writes the browser preview inside the workspace and overwrites it', async () => {
    const a = await writeWebSitePreview({ agentId: 'vidtsx/web-designer', sessionId: 's1', artifacts, artifact: page });
    expect(a.dir).toBe(path.join(dir, 'work', 'preview', 'web-page-1-v2'));
    expect(a.zipPath).toBeUndefined();
    await fs.writeFile(path.join(a.dir, 'stale.txt'), 'x');
    const b = await writeWebSitePreview({ agentId: 'vidtsx/web-designer', sessionId: 's1', artifacts, artifact: page });
    expect(b.dir).toBe(a.dir);
    await expect(fs.access(path.join(a.dir, 'stale.txt'))).rejects.toThrow();
  });

  it('puts the export CSP first in the head', () => {
    const out = buildSiteIndex('<!doctype html><html><head><title>x</title></head><body></body></html>', []);
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<title>'));
  });
});
