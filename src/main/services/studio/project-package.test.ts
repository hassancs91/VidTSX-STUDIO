import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

let tmpDir = '';
const projectsRoot = (): string => path.join(tmpDir, 'studio');
const libraryRoot = (): string => path.join(tmpDir, 'library');

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => path.join(tmpDir, name),
    getVersion: () => '1.0.1',
    isPackaged: false,
  },
}));
vi.mock('../settings', () => ({ getStudioProjectsRoot: async () => projectsRoot() }));
vi.mock('../library/library-paths', () => ({
  getLibraryRoot: () => libraryRoot(),
  getInstalledPacksDir: () => path.join(libraryRoot(), 'packs'),
}));
vi.mock('../library/brand-store', () => ({
  readBrand: async (_root: string, id: string) =>
    id === 'acme'
      ? {
          id: 'acme',
          name: 'Acme',
          palette: {
            primary: '#111',
            secondary: '#222',
            background: '#333',
            text: '#fff',
            accent: '#f0f',
          },
          fonts: { display: 'Inter' },
          logoRefs: ['logos/acme.png'],
          styleNotes: '- bold',
        }
      : null,
}));
vi.mock('../library/preset-store', () => ({
  readPreset: async (_root: string, id: string) =>
    id === 'shorts'
      ? {
          id: 'shorts',
          name: 'My shorts',
          videoKind: 'short',
          orientation: '9:16',
          defaultBrandId: 'acme',
          workflow: [{ id: 'transcribe' }, { id: 'auto_cut', aggressiveness: 'aggressive' }],
          style: { pacing: 'tight' },
          learned: [{ projectId: 'old', at: '2026-09-01T00:00:00.000Z', summary: 'x' }],
          body: '# Shorts\n\nHook first.',
          createdAt: '2026-09-09T00:00:00.000Z',
          updatedAt: '2026-09-09T00:00:00.000Z',
        }
      : null,
}));
// Heavy engine modules the plan only needs two constants from.
vi.mock('./asset-transcriber', () => ({ TRANSCRIPT_DIR: 'transcripts' }));
vi.mock('./proxy-generator', () => ({
  PROXY_DIR: 'proxies',
  proxyRelPath: (assetId: string) => `proxies/${assetId}.mp4`,
}));
vi.mock('../kit-bundler', () => ({ readKitPackVersion: async () => '1.2.3' }));

import type { StudioProject } from '../../../shared/types/studio';
import { parsePackageManifest } from '../../../shared/studio/project-package-manifest';
import { writePackage } from './project-package';
import { planPackage } from './project-package-plan';

const PROJECT_ID = 'demo';
let mediaPath = '';

async function write(filePath: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

function makeProject(): StudioProject {
  return {
    schemaVersion: 1,
    id: PROJECT_ID,
    name: 'Demo Project',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-26T00:00:00.000Z',
    settings: { width: 1920, height: 1080, fps: 30, agent: {}, brandId: 'acme', presetId: 'shorts' },
    assets: [
      {
        id: 'a1',
        kind: 'video',
        path: mediaPath,
        probe: { duration: 12, width: 3840, height: 2160, fps: 30, hasAudio: true },
        hash: 'deadbeef',
        thumbnail: { path: 'thumbs/a1.jpg', status: 'ready' },
        proxy: { path: 'proxies/a1.mp4', status: 'ready' },
        waveform: { path: 'waveforms/a1.json', status: 'ready' },
        transcript: {
          path: 'transcripts/a1.json',
          status: 'ready',
          engine: 'assemblyai',
          hasWords: true,
        },
      },
      {
        id: 'a2',
        kind: 'image',
        path: path.join(tmpDir, 'gone', 'missing.png'),
        probe: { duration: 0, hasAudio: false },
      },
    ],
    timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [] }] },
    proposals: [],
    shots: [
      {
        id: 'intro',
        name: 'Intro',
        kind: 'cutaway',
        createdAt: '2026-08-01T00:00:00.000Z',
        activeVersion: 1,
        status: 'ready',
      },
    ],
  };
}

/** Read a written package back the way the import side will: entries + bytes. */
async function readPackage(filePath: string): Promise<Map<string, Buffer>> {
  const unzipper = await import('unzipper');
  const directory = await unzipper.Open.file(filePath);
  const out = new Map<string, Buffer>();
  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    out.set(entry.path, await entry.buffer());
  }
  return out;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-package-test-'));
  const projectDir = path.join(projectsRoot(), 'projects', PROJECT_ID);
  mediaPath = path.join(tmpDir, 'footage', 'A Roll (final).MP4');

  await write(mediaPath, Buffer.alloc(4096, 7));
  await write(path.join(projectDir, 'shots', 'intro', 'v1.tsx'), 'export default () => null;');
  await write(path.join(projectDir, 'shots', 'intro', 'original.tsx'), '// original');
  await write(path.join(projectDir, 'shots', 'intro', 'chat.json'), '{"messages":[]}');
  await write(path.join(projectDir, 'agent-chat.json'), '{"version":1,"messages":[]}');
  await write(path.join(projectDir, 'kit', '1.2.3', 'index.tsx'), '// kit');
  await write(path.join(projectDir, 'kit', '1.2.3', 'pack.json'), '{"version":"1.2.3"}');
  await write(path.join(projectDir, 'cache', 'transcripts', 'a1.json'), '{"words":[]}');
  await write(path.join(projectDir, 'cache', 'thumbs', 'a1.jpg'), Buffer.alloc(64, 3));
  await write(path.join(projectDir, 'cache', 'cut-plans', 'a1-balanced.json'), '{"cuts":[]}');
  await write(path.join(projectDir, 'cache', 'proxies', 'a1.mp4'), Buffer.alloc(512, 9));
  await write(path.join(projectDir, 'cache', 'waveforms', 'a1.json'), '{"peaks":[]}');
  await write(path.join(projectDir, 'renders', 'out.mp4'), Buffer.alloc(2048, 1));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('planPackage (Q7b contents policy)', () => {
  it('never plans proxies, waveforms or renders', async () => {
    const plan = await planPackage(makeProject(), { strategy: 'full' });
    const paths = plan.files.map((f) => f.path);
    expect(paths.some((p) => p.includes('waveform'))).toBe(false);
    expect(paths.some((p) => p.startsWith('renders/'))).toBe(false);
    expect(paths.some((p) => p.includes('proxies/'))).toBe(false);
  });

  it('always plans transcripts, cut-plans, thumbs, shots and the kit pin', async () => {
    const plan = await planPackage(makeProject(), { strategy: 'full' });
    const paths = plan.files.map((f) => f.path);
    expect(paths).toContain('transcripts/a1.json');
    expect(paths).toContain('cut-plans/a1-balanced.json');
    expect(paths).toContain('thumbs/a1.jpg');
    expect(paths).toContain('shots/intro/v1.tsx');
    expect(paths).toContain('shots/intro/original.tsx');
    expect(paths).toContain('kit/1.2.3/index.tsx');
    expect(plan.kitVersion).toBe('1.2.3');
    expect(plan.counts.transcripts).toBe(1);
  });

  it('keeps both conversations out by default and takes both on opt-in', async () => {
    const off = await planPackage(makeProject(), { strategy: 'full' });
    expect(off.files.map((f) => f.path)).not.toContain('shots/intro/chat.json');
    expect(off.files.some((f) => f.group === 'chat')).toBe(false);

    const on = await planPackage(makeProject(), { strategy: 'full', includeChat: true });
    expect(on.files.map((f) => f.path)).toContain('shots/intro/chat.json');
    expect(on.files.some((f) => f.group === 'chat')).toBe(true);
  });

  it('reports a missing asset instead of failing the plan', async () => {
    const plan = await planPackage(makeProject(), { strategy: 'full' });
    const missing = plan.assets.find((a) => a.assetId === 'a2');
    expect(missing?.skip).toBe('missing');
    expect(missing?.packagePath).toBeUndefined();
    expect(plan.warnings.some((w) => w.includes('missing on this machine'))).toBe(true);
  });

  it('proxies-only swaps video for its proxy and keeps the size honest', async () => {
    const plan = await planPackage(makeProject(), { strategy: 'proxies-only' });
    const a1 = plan.assets.find((a) => a.assetId === 'a1');
    expect(a1?.proxyOnly).toBe(true);
    expect(a1?.bytes).toBe(512);
    expect(a1?.originalBytes).toBe(4096);
    expect(plan.mediaBytes).toBe(512);
  });

  it('the no-media strategy plans zero media bytes but keeps the hashes', async () => {
    const plan = await planPackage(makeProject(), { strategy: 'none' });
    expect(plan.mediaBytes).toBe(0);
    expect(plan.counts.media).toBe(0);
    expect(plan.assets.find((a) => a.assetId === 'a1')?.hash).toBe('deadbeef');
    expect(plan.assets.find((a) => a.assetId === 'a1')?.skip).toBe('by-strategy');
  });
});

describe('writePackage (Q7a layout)', () => {
  it('writes a package whose manifest validates and whose hashes match the bytes', async () => {
    const dest = path.join(tmpDir, 'full.vidtsx');
    const result = await writePackage({ project: makeProject(), destPath: dest, strategy: 'full' });
    const entries = await readPackage(dest);

    const parsed = parsePackageManifest(JSON.parse(entries.get('manifest.json')!.toString('utf-8')));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.manifest.kind).toBe('project');
    expect(parsed.manifest.formatVersion).toBe(1);
    expect(parsed.manifest.schemaVersion).toBe(1);
    expect(parsed.manifest.app.version).toBe('1.0.1');
    expect(parsed.manifest.mediaStrategy).toBe('full');
    expect(parsed.manifest.kitVersion).toBe('1.2.3');
    expect(parsed.manifest.brand).toBe(true);
    expect(parsed.manifest.preset).toBe(true);
    expect(parsed.manifest.agentChat).toBeUndefined();
    expect(result.bytes).toBe(parsed.manifest.totalBytes);

    // Every declared file exists in the zip with the declared size and hash.
    for (const file of parsed.manifest.files) {
      const bytes = entries.get(file.path);
      expect(bytes, file.path).toBeDefined();
      expect(bytes!.length, file.path).toBe(file.size);
      expect(crypto.createHash('sha256').update(bytes!).digest('hex'), file.path).toBe(file.sha256);
    }
    // manifest.json itself is never in its own files list.
    expect(parsed.manifest.files.some((f) => f.path === 'manifest.json')).toBe(false);
  });

  it('rewrites project.json: package-relative media, no proxy/waveform pointers', async () => {
    const dest = path.join(tmpDir, 'rewritten.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'full' });
    const entries = await readPackage(dest);
    const doc = JSON.parse(entries.get('project.json')!.toString('utf-8')) as StudioProject;

    const a1 = doc.assets.find((a) => a.id === 'a1')!;
    expect(a1.path).toBe('media/a1.mp4');
    expect(path.isAbsolute(a1.path)).toBe(false);
    expect(a1.proxy).toBeUndefined();
    expect(a1.waveform).toBeUndefined();
    // Cache-relative transcript/thumb refs already match the package layout.
    expect(a1.transcript?.path).toBe('transcripts/a1.json');
    expect(a1.thumbnail?.path).toBe('thumbs/a1.jpg');
    // A missing asset travels with an empty ref, never the exporter's path.
    expect(doc.assets.find((a) => a.id === 'a2')!.path).toBe('');
    expect(entries.has('media/a1.mp4')).toBe(true);
    expect(entries.has('thumbnail.jpg')).toBe(true);
  });

  it('the brand snapshot carries tokens only — never library-relative logo refs', async () => {
    const dest = path.join(tmpDir, 'brand.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'full' });
    const entries = await readPackage(dest);
    const brand = JSON.parse(entries.get('brand.json')!.toString('utf-8')) as Record<string, unknown>;
    expect(brand.name).toBe('Acme');
    expect(brand.fonts).toEqual({ display: 'Inter' });
    expect(brand.styleNotes).toBe('- bold');
    expect('logoRefs' in brand).toBe(false);
  });

  it('the preset snapshot carries knobs, workflow and the body — never the id, the default brand or the learned log (W5)', async () => {
    const dest = path.join(tmpDir, 'preset.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });
    const entries = await readPackage(dest);
    const preset = JSON.parse(entries.get('preset.json')!.toString('utf-8')) as Record<string, unknown>;
    expect(preset.name).toBe('My shorts');
    expect(preset.videoKind).toBe('short');
    expect(preset.orientation).toBe('9:16');
    expect(preset.workflow).toEqual([{ id: 'transcribe' }, { id: 'auto_cut', aggressiveness: 'aggressive' }]);
    expect(preset.style).toEqual({ pacing: 'tight' });
    expect(preset.body).toBe('# Shorts\n\nHook first.');
    expect('id' in preset).toBe(false);
    expect('defaultBrandId' in preset).toBe(false);
    expect('learned' in preset).toBe(false);
  });

  it('the chat opt-in is what puts a conversation in the package', async () => {
    const off = path.join(tmpDir, 'nochat.vidtsx');
    await writePackage({ project: makeProject(), destPath: off, strategy: 'none' });
    const offEntries = await readPackage(off);
    expect(offEntries.has('agent-chat.json')).toBe(false);
    expect(offEntries.has('shots/intro/chat.json')).toBe(false);

    const on = path.join(tmpDir, 'chat.vidtsx');
    const result = await writePackage({
      project: makeProject(),
      destPath: on,
      strategy: 'none',
      includeChat: true,
    });
    const onEntries = await readPackage(on);
    expect(onEntries.has('agent-chat.json')).toBe(true);
    expect(onEntries.has('shots/intro/chat.json')).toBe(true);
    expect(result.manifest.agentChat).toBe(true);
  });

  it('the no-media package carries no media entries but keeps relink data', async () => {
    const dest = path.join(tmpDir, 'relink.vidtsx');
    const result = await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });
    const entries = await readPackage(dest);
    expect([...entries.keys()].some((p) => p.startsWith('media/'))).toBe(false);
    const a1 = result.manifest.assets.find((a) => a.assetId === 'a1')!;
    expect(a1.file).toBeUndefined();
    expect(a1.hash).toBe('deadbeef');
    expect(a1.originalName).toBe('A Roll (final).MP4');
    expect(a1.originalBytes).toBe(4096);
  });

  it('proxies-only marks the travelling file as a stand-in', async () => {
    const dest = path.join(tmpDir, 'proxy.vidtsx');
    const result = await writePackage({
      project: makeProject(),
      destPath: dest,
      strategy: 'proxies-only',
    });
    const entries = await readPackage(dest);
    expect(entries.get('media/a1.mp4')!.length).toBe(512);
    expect(result.manifest.assets.find((a) => a.assetId === 'a1')?.proxyOnly).toBe(true);
  });

  it('reports progress that ends at the seal step', async () => {
    const dest = path.join(tmpDir, 'progress.vidtsx');
    const seen: number[] = [];
    await writePackage({
      project: makeProject(),
      destPath: dest,
      strategy: 'full',
      onProgress: (p) => seen.push(p.percent),
    });
    expect(seen.length).toBeGreaterThan(1);
    expect(Math.max(...seen)).toBe(99);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
  });

  it('leaves no partial file behind when the write fails', async () => {
    const dest = path.join(tmpDir, 'broken.vidtsx');
    const project = makeProject();
    // A shot folder that vanishes mid-write is the realistic version of this.
    project.assets[0].path = path.join(tmpDir, 'footage', 'not-there.mp4');
    const plan = await planPackage(project, { strategy: 'full' });
    expect(plan.assets[0].skip).toBe('missing');

    await expect(
      writePackage({
        project,
        destPath: path.join(tmpDir, 'no-such-dir', 'x.vidtsx'),
        strategy: 'full',
      }),
    ).rejects.toBeTruthy();
    await expect(fs.access(dest)).rejects.toBeTruthy();
  });
});
