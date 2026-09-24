// The round trip: a package written by NF16's writer, imported by NF17's
// reader, plus the refusals that make an untrusted package safe to open.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';
const projectsRoot = (): string => path.join(tmpDir, 'studio');
const projectsDir = (): string => path.join(projectsRoot(), 'projects');
const libraryRoot = (): string => path.join(tmpDir, 'library');

const gate = vi.hoisted(() => ({
  validateShotCode: vi.fn(
    async (_source: string) => ({ success: true }) as { success: boolean; error?: string },
  ),
  buildShotEngineDeps: vi.fn(),
}));
const brands = vi.hoisted(() => ({ created: [] as string[] }));
const presets = vi.hoisted(() => ({ created: [] as Record<string, unknown>[] }));

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
          logoRefs: [],
          styleNotes: '- bold',
        }
      : null,
  createBrand: async (_root: string, input: { name: string }) => {
    const id = `brand-${brands.created.length + 1}`;
    brands.created.push(input.name);
    return { id, name: input.name };
  },
}));
vi.mock('../library/preset-store', () => ({
  readPreset: async (_root: string, id: string) =>
    id === 'shorts'
      ? {
          id: 'shorts',
          name: 'My shorts',
          videoKind: 'short',
          orientation: '9:16',
          workflow: [{ id: 'transcribe' }, { id: 'captions', template: 'core/word-pop' }],
          style: { pacing: 'tight', captions: 'karaoke' },
          body: '# Shorts',
          createdAt: '2026-09-09T00:00:00.000Z',
          updatedAt: '2026-09-09T00:00:00.000Z',
        }
      : null,
  createPreset: async (_root: string, input: Record<string, unknown>) => {
    const id = `preset-${presets.created.length + 1}`;
    presets.created.push(input);
    return { id, name: input.name };
  },
}));
vi.mock('./asset-transcriber', () => ({ TRANSCRIPT_DIR: 'transcripts' }));
vi.mock('./proxy-generator', () => ({
  PROXY_DIR: 'proxies',
  proxyRelPath: (assetId: string) => `proxies/${assetId}.mp4`,
}));
vi.mock('../kit-bundler', () => ({ readKitPackVersion: async () => '1.2.3' }));
// The D14 gate itself is proven by shot-import's own tests — here it is a dial,
// so the import's per-shot verdicts can be exercised in both directions.
vi.mock('./shot-generator', () => gate);

import type { StudioProject } from '../../../shared/types/studio';
import { writePackage } from './project-package';
import { importPackage, rehomeAssets } from './project-package-import';
import { PackageReadError } from './project-package-unzip';
import { PackageZipWriter } from './project-package-zip';
import { safeMediaFileName } from './project-package-install';

const SOURCE_ID = 'demo';
let mediaPath = '';

async function write(filePath: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function makeProject(): StudioProject {
  return {
    schemaVersion: 1,
    id: SOURCE_ID,
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
    ],
    timeline: {
      tracks: [
        {
          id: 'v1',
          kind: 'video',
          name: 'V1',
          clips: [
            {
              id: 'c1',
              kind: 'tsx',
              timelineStart: 0,
              duration: 2,
              tsx: { shotId: 'intro', mode: 'cutaway' },
            },
          ],
        },
      ],
    },
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

async function loadImported(projectId: string): Promise<StudioProject> {
  const raw = await fs.readFile(path.join(projectsDir(), projectId, 'project.json'), 'utf-8');
  return JSON.parse(raw) as StudioProject;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-import-test-'));
  const projectDir = path.join(projectsDir(), SOURCE_ID);
  mediaPath = path.join(tmpDir, 'footage', 'A Roll (final).MP4');

  await write(mediaPath, Buffer.alloc(4096, 7));
  await write(path.join(projectDir, 'shots', 'intro', 'v1.tsx'), 'export default () => null;');
  await write(path.join(projectDir, 'kit', '1.2.3', 'index.tsx'), '// kit');
  await write(path.join(projectDir, 'cache', 'transcripts', 'a1.json'), '{"words":[]}');
  await write(path.join(projectDir, 'cache', 'thumbs', 'a1.jpg'), Buffer.alloc(64, 3));
  await write(path.join(projectDir, 'cache', 'proxies', 'a1.mp4'), Buffer.alloc(512, 9));
  await write(path.join(projectDir, 'cache', 'waveforms', 'a1.json'), '{"peaks":[]}');
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  gate.validateShotCode.mockReset().mockResolvedValue({ success: true });
  brands.created.length = 0;
  presets.created.length = 0;
});

describe('importPackage — the round trip', () => {
  it('lands a full-media package as a NEW project with project-local media', async () => {
    const dest = path.join(tmpDir, 'roundtrip.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'full' });

    const report = await importPackage({ filePath: dest, brand: { mode: 'create' } });
    expect(report.projectId).not.toBe(SOURCE_ID);
    expect(report.name).toBe('Demo Project');
    expect(report.kind).toBe('project');

    const imported = await loadImported(report.projectId);
    const asset = imported.assets[0];
    expect(path.isAbsolute(asset.path)).toBe(true);
    expect(asset.path.startsWith(path.join(projectsDir(), report.projectId, 'media'))).toBe(true);
    expect(await exists(asset.path)).toBe(true);
    expect((await fs.stat(asset.path)).size).toBe(4096);
    // The document keeps the timeline that references the shot.
    expect(imported.timeline.tracks[0].clips[0].tsx?.shotId).toBe('intro');
  });

  it('re-derives cache refs and drops the ones that never travel', async () => {
    const dest = path.join(tmpDir, 'cache.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'full' });
    const report = await importPackage({ filePath: dest });
    const imported = await loadImported(report.projectId);
    const asset = imported.assets[0];
    const projectDir = path.join(projectsDir(), report.projectId);

    expect(asset.transcript?.path).toBe('transcripts/a1.json');
    expect(await exists(path.join(projectDir, 'cache', 'transcripts', 'a1.json'))).toBe(true);
    expect(asset.thumbnail?.path).toBe('thumbs/a1.jpg');
    expect(await exists(path.join(projectDir, 'cache', 'thumbs', 'a1.jpg'))).toBe(true);
    // Proxies and waveforms rebuild on open — a pointer to a file that is not
    // there would make the editor look broken.
    expect(asset.proxy).toBeUndefined();
    expect(asset.waveform).toBeUndefined();
    expect(await exists(path.join(projectDir, 'cache', 'proxies'))).toBe(false);
  });

  it('installs the kit pin where shot-kit-pin.ts reads it', async () => {
    const dest = path.join(tmpDir, 'kit.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });
    const report = await importPackage({ filePath: dest });
    expect(report.kit).toEqual({ version: '1.2.3', installed: true });
    expect(
      await exists(path.join(projectsDir(), report.projectId, 'kit', '1.2.3', 'index.tsx')),
    ).toBe(true);
  });

  it('never collides: importing the same package twice makes two projects', async () => {
    const dest = path.join(tmpDir, 'twice.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });
    const first = await importPackage({ filePath: dest });
    const second = await importPackage({ filePath: dest });
    expect(second.projectId).not.toBe(first.projectId);
    expect(await exists(path.join(projectsDir(), first.projectId))).toBe(true);
    expect(await exists(path.join(projectsDir(), second.projectId))).toBe(true);
  });

  it('the no-media package asks for a relink and never leaves a blank row', async () => {
    const dest = path.join(tmpDir, 'nomedia.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });
    const report = await importPackage({ filePath: dest });
    expect(report.relink).toEqual([
      { assetId: 'a1', name: 'A Roll (final).MP4', reason: 'no-media' },
    ]);

    const imported = await loadImported(report.projectId);
    // A placeholder INSIDE the project: it does not exist (so the existing
    // prepare/heal/relink path flags it) but it still reads as a file name.
    expect(imported.assets[0].path).toContain('A Roll (final).MP4');
    expect(await exists(imported.assets[0].path)).toBe(false);
  });

  it('the proxies-only package flags a full-res relink and ships the stand-in', async () => {
    const dest = path.join(tmpDir, 'proxyonly.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'proxies-only' });
    const report = await importPackage({ filePath: dest });
    expect(report.relink[0]).toMatchObject({ assetId: 'a1', reason: 'proxy-only' });
    const imported = await loadImported(report.projectId);
    expect((await fs.stat(imported.assets[0].path)).size).toBe(512);
    // The original's hash rides along, so a Locate… pick verifies cleanly.
    expect(imported.assets[0].hash).toBe('deadbeef');
  });

  it('applies the brand offer: create makes a library brand, snapshot stays local', async () => {
    const dest = path.join(tmpDir, 'brand.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });

    const created = await importPackage({ filePath: dest, brand: { mode: 'create' } });
    expect(created.brand.applied).toBe('create');
    expect(brands.created).toEqual(['Acme']);
    expect((await loadImported(created.projectId)).settings.brandId).toBe('brand-1');

    const local = await importPackage({ filePath: dest, brand: { mode: 'snapshot' } });
    expect(local.brand.applied).toBe('snapshot');
    expect(await exists(path.join(projectsDir(), local.projectId, 'brand.json'))).toBe(true);
    // A machine-local brand id from the exporter is meaningless here.
    expect((await loadImported(local.projectId)).settings.brandId).toBeUndefined();

    const matched = await importPackage({ filePath: dest, brand: { mode: 'match', brandId: 'acme' } });
    expect((await loadImported(matched.projectId)).settings.brandId).toBe('acme');
  });

  it('applies the preset offer (W5): create makes a library preset from the snapshot, match points at mine, none drops the exporter id', async () => {
    const dest = path.join(tmpDir, 'preset.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });

    const created = await importPackage({ filePath: dest, preset: { mode: 'create' } });
    expect(created.preset).toEqual({ applied: 'create', presetId: 'preset-1' });
    expect(presets.created).toHaveLength(1);
    expect(presets.created[0]).toMatchObject({
      name: 'My shorts',
      videoKind: 'short',
      orientation: '9:16',
      workflow: [{ id: 'transcribe' }, { id: 'captions', template: 'core/word-pop' }],
      style: { pacing: 'tight', captions: 'karaoke' },
      body: '# Shorts',
    });
    expect((await loadImported(created.projectId)).settings.presetId).toBe('preset-1');

    const matched = await importPackage({ filePath: dest, preset: { mode: 'match', presetId: 'shorts' } });
    expect(matched.preset).toEqual({ applied: 'match', presetId: 'shorts' });
    expect((await loadImported(matched.projectId)).settings.presetId).toBe('shorts');

    const none = await importPackage({ filePath: dest });
    expect(none.preset.applied).toBe('none');
    expect((await loadImported(none.projectId)).settings.presetId).toBeUndefined();
  });

  it('drops the exporter brand id when no offer is made', async () => {
    const dest = path.join(tmpDir, 'nobrand.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });
    const report = await importPackage({ filePath: dest });
    expect(report.brand.applied).toBe('none');
    expect((await loadImported(report.projectId)).settings.brandId).toBeUndefined();
  });
});

describe('importPackage — the mandatory shot gate (Q7d/Q7e)', () => {
  it('re-runs the gate on every shot, however the package labelled it', async () => {
    const dest = path.join(tmpDir, 'gate.vidtsx');
    await writePackage({ project: makeProject(), destPath: dest, strategy: 'none' });
    await importPackage({ filePath: dest });
    expect(gate.validateShotCode).toHaveBeenCalledTimes(1);
    expect(gate.validateShotCode.mock.calls[0][0]).toContain('export default');
  });

  it('offers Convert when the only problem is the allowlist gap', async () => {
    const project = makeProject();
    const projectDir = path.join(projectsDir(), SOURCE_ID);
    await write(
      path.join(projectDir, 'shots', 'intro', 'v1.tsx'),
      "import chroma from 'chroma-js';\nexport const compositionConfig = { durationInFrames: 30, fps: 30, width: 1920, height: 1080 };\nexport default () => null;",
    );
    const dest = path.join(tmpDir, 'convert.vidtsx');
    await writePackage({ project, destPath: dest, strategy: 'none' });

    gate.validateShotCode.mockResolvedValue({ success: false, error: 'Import "chroma-js" is not allowed' });
    const report = await importPackage({ filePath: dest });
    expect(report.shots[0]).toMatchObject({ shotId: 'intro', verdict: 'convert' });
    expect(report.shots[0].error).toContain('chroma-js');

    // The project still opens: the shot is an error card, not a broken preview.
    const imported = await loadImported(report.projectId);
    expect(imported.shots[0].status).toBe('error');
    expect(imported.shots[0].error).toBeTruthy();

    await write(path.join(projectDir, 'shots', 'intro', 'v1.tsx'), 'export default () => null;');
  });

  it('marks a shot with no source file as an error rather than failing the import', async () => {
    const dest = path.join(tmpDir, 'noshotfile.vidtsx');
    const project = makeProject();
    project.shots[0].activeVersion = 9; // No v9.tsx travels.
    await writePackage({ project, destPath: dest, strategy: 'none' });
    const report = await importPackage({ filePath: dest });
    expect(report.shots[0]).toMatchObject({ verdict: 'error' });
    expect(report.shots[0].error).toContain('no source file');
  });
});

describe('importPackage — refusals (Q7e)', () => {
  /** Build a package by hand so the manifest can lie about its contents. */
  async function craft(
    destPath: string,
    build: (writer: PackageZipWriter) => Promise<Record<string, unknown>>,
  ): Promise<string> {
    const writer = new PackageZipWriter(destPath);
    const manifest = await build(writer);
    await writer.addJson('manifest.json', manifest);
    await writer.finish();
    return destPath;
  }

  function baseManifest(files: unknown[], overrides: Record<string, unknown> = {}) {
    return {
      formatVersion: 1,
      kind: 'project',
      app: { name: 'VidTSX Studio', version: '1.0.1' },
      schemaVersion: 1,
      createdAt: '2026-08-26T00:00:00.000Z',
      project: { name: 'Hostile', width: 1920, height: 1080, fps: 30 },
      mediaStrategy: 'none',
      counts: { assets: 0, media: 0, shots: 0, transcripts: 0 },
      totalBytes: 0,
      assets: [],
      files,
      ...overrides,
    };
  }

  const minimalProject = {
    schemaVersion: 1,
    name: 'Hostile',
    settings: { width: 1920, height: 1080, fps: 30 },
    assets: [],
    timeline: { tracks: [] },
    proposals: [],
    shots: [],
  };

  it('refuses a package whose manifest lists a traversal path', async () => {
    const dest = await craft(path.join(tmpDir, 'slip.vidtsx'), async (writer) => {
      const project = await writer.addJson('project.json', minimalProject);
      const evil = await writer.addBuffer('evil.txt', Buffer.from('pwned'));
      return baseManifest([project, { ...evil, path: '../evil.txt' }]);
    });
    await expect(importPackage({ filePath: dest })).rejects.toThrow(/Unsafe path/);
    expect(await exists(path.join(path.dirname(tmpDir), 'evil.txt'))).toBe(false);
  });

  it('refuses a package whose bytes do not match the manifest hash', async () => {
    const dest = await craft(path.join(tmpDir, 'tampered.vidtsx'), async (writer) => {
      const project = await writer.addJson('project.json', minimalProject);
      return baseManifest([{ ...project, sha256: 'f'.repeat(64) }]);
    });
    await expect(importPackage({ filePath: dest })).rejects.toThrow(/hash/);
  });

  it('refuses a manifest that under-declares an entry size (the zip-bomb shape)', async () => {
    const dest = await craft(path.join(tmpDir, 'bomb.vidtsx'), async (writer) => {
      const project = await writer.addJson('project.json', minimalProject);
      return baseManifest([{ ...project, size: 4 }]);
    });
    await expect(importPackage({ filePath: dest })).rejects.toThrow(/manifest declares/);
  });

  it('ignores an entry the manifest does not list', async () => {
    const dest = await craft(path.join(tmpDir, 'stowaway.vidtsx'), async (writer) => {
      const project = await writer.addJson('project.json', minimalProject);
      await writer.addBuffer('stowaway.tsx', Buffer.from('// never asked for'));
      return baseManifest([project]);
    });
    const report = await importPackage({ filePath: dest });
    expect(await exists(path.join(projectsDir(), report.projectId, 'stowaway.tsx'))).toBe(false);
  });

  it('refuses a package built by a newer app, and names the version', async () => {
    const dest = await craft(path.join(tmpDir, 'newer.vidtsx'), async (writer) => {
      const project = await writer.addJson('project.json', minimalProject);
      return baseManifest([project], {
        schemaVersion: 99,
        app: { name: 'VidTSX Studio', version: '9.9.9' },
      });
    });
    await expect(importPackage({ filePath: dest })).rejects.toThrow(/9\.9\.9/);
    await expect(importPackage({ filePath: dest })).rejects.toBeInstanceOf(PackageReadError);
  });

  it('refuses a file that is not a package at all', async () => {
    const dest = path.join(tmpDir, 'notazip.vidtsx');
    await write(dest, 'this is not a zip');
    await expect(importPackage({ filePath: dest })).rejects.toThrow(/not a readable/);
  });

  it('leaves no half-built project behind when the import fails', async () => {
    const before = await fs.readdir(projectsDir());
    const dest = await craft(path.join(tmpDir, 'badproject.vidtsx'), async (writer) => {
      const project = await writer.addBuffer('project.json', Buffer.from('{ not json'));
      return baseManifest([project]);
    });
    await expect(importPackage({ filePath: dest })).rejects.toThrow(/project\.json/);
    expect(await fs.readdir(projectsDir())).toEqual(before);
  });
});

describe('rehomeAssets (Q7e path rewriting)', () => {
  it('never passes a package path through to the document', () => {
    const { assets, relink } = rehomeAssets(
      [
        {
          id: 'a1',
          kind: 'video',
          path: 'media/a1.mp4',
          probe: { duration: 1, hasAudio: false },
          thumbnail: { path: '../../../evil.jpg', status: 'ready' },
          transcript: {
            path: '../../../evil.json',
            status: 'ready',
            engine: 'whisper',
            hasWords: true,
          },
        },
      ],
      new Map([['a1', { path: 'C:/projects/p/media/a1.mp4' }]]),
      { transcripts: new Set(['a1']), thumbs: new Set(['a1']) },
    );
    expect(assets[0].path).toBe('C:/projects/p/media/a1.mp4');
    // Cache refs are RE-DERIVED from the asset id, not taken from the package.
    expect(assets[0].thumbnail?.path).toBe('thumbs/a1.jpg');
    expect(assets[0].transcript?.path).toBe('transcripts/a1.json');
    expect(relink).toEqual([]);
  });

  it('drops cache refs whose files did not travel', () => {
    const { assets } = rehomeAssets(
      [
        {
          id: 'a1',
          kind: 'video',
          path: 'media/a1.mp4',
          probe: { duration: 1, hasAudio: false },
          thumbnail: { path: 'thumbs/a1.jpg', status: 'ready' },
          transcript: { path: 'transcripts/a1.json', status: 'ready', engine: 'whisper', hasWords: true },
        },
      ],
      new Map([['a1', { path: 'C:/p/media/a1.mp4' }]]),
      { transcripts: new Set(), thumbs: new Set() },
    );
    expect(assets[0].thumbnail).toBeUndefined();
    expect(assets[0].transcript).toBeUndefined();
  });
});

describe('safeMediaFileName', () => {
  it('keeps a readable name and refuses to build a path out of it', () => {
    expect(safeMediaFileName('A Roll (final).MP4', 'a1')).toBe('A Roll (final).MP4');
    expect(safeMediaFileName('../../etc/passwd', 'a1')).toBe('passwd');
    expect(safeMediaFileName('C:\\evil\\x.mp4', 'a1')).toBe('x.mp4');
    expect(safeMediaFileName('bad<name>.mp4', 'a1')).toBe('bad_name_.mp4');
    expect(safeMediaFileName('...', 'a1')).toBe('a1');
    expect(safeMediaFileName('', 'a1')).toBe('a1');
  });
});
