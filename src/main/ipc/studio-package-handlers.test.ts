// IPC contract for the package export surface: a made-up media strategy can
// never reach the planner, a cancelled save dialog is not an error, and the
// .vidtsx extension is enforced on whatever path the dialog returns.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioProject } from '../../shared/types/studio';

const service = vi.hoisted(() => ({
  planPackage: vi.fn(),
  writePackage: vi.fn(),
  defaultPackageDir: () => 'C:/docs',
}));
const importer = vi.hoisted(() => ({ inspectPackage: vi.fn(), importPackage: vi.fn() }));
const conformer = vi.hoisted(() => ({ conformShot: vi.fn() }));
const electron = vi.hoisted(() => ({ showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }));

vi.mock('../services/studio/project-package', () => service);
vi.mock('../services/studio/project-package-import', () => importer);
vi.mock('../services/studio/shot-conform', () => conformer);
vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: electron.showSaveDialog,
    showOpenDialog: electron.showOpenDialog,
  },
}));

import {
  handleStudioPackageExport,
  handleStudioPackageImport,
  handleStudioPackageInspect,
  handleStudioPackagePlan,
  handleStudioShotConform,
} from './studio-package-handlers';

type ExportEvent = Parameters<typeof handleStudioPackageExport>[0];

const sent: Array<{ channel: string; payload: unknown }> = [];
const event = {
  sender: {
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
  },
} as unknown as ExportEvent;

const project = { id: 'demo', name: 'Demo Project' } as StudioProject;

const emptyPlan = {
  strategy: 'full',
  assets: [],
  files: [],
  mediaBytes: 0,
  extrasBytes: 0,
  totalBytes: 0,
  counts: { assets: 0, media: 0, shots: 0, transcripts: 0 },
  captionPacks: [],
  warnings: [],
};

beforeEach(() => {
  sent.length = 0;
  service.planPackage.mockReset().mockResolvedValue(emptyPlan);
  service.writePackage
    .mockReset()
    .mockResolvedValue({ manifest: { kind: 'project', assets: [] }, bytes: 42, warnings: [] });
  electron.showSaveDialog.mockReset();
  electron.showOpenDialog.mockReset();
  importer.inspectPackage.mockReset();
  importer.importPackage.mockReset();
  conformer.conformShot.mockReset();
});

describe('handleStudioPackagePlan', () => {
  it('refuses a request with no project instead of planning nothing', async () => {
    const res = await handleStudioPackagePlan(event, { project: undefined as never, strategy: 'full' });
    expect(res.success).toBe(false);
    expect(service.planPackage).not.toHaveBeenCalled();
  });

  it('falls back to the full-media strategy when the renderer sends an unknown one', async () => {
    await handleStudioPackagePlan(event, { project, strategy: 'teleport' as never });
    expect(service.planPackage.mock.calls[0][1]).toEqual({ strategy: 'full' });
  });

  it('passes the chat opt-in through only when it is set', async () => {
    await handleStudioPackagePlan(event, { project, strategy: 'none' });
    expect(service.planPackage.mock.calls[0][1]).toEqual({ strategy: 'none' });
    await handleStudioPackagePlan(event, { project, strategy: 'none', includeChat: true });
    expect(service.planPackage.mock.calls[1][1]).toEqual({ strategy: 'none', includeChat: true });
  });

  it('returns a typed error rather than throwing when the planner fails', async () => {
    service.planPackage.mockRejectedValue(new Error('disk gone'));
    const res = await handleStudioPackagePlan(event, { project, strategy: 'full' });
    expect(res).toEqual({ success: false, error: 'disk gone' });
  });
});

describe('handleStudioPackageExport', () => {
  it('reports a cancelled save dialog as canceled, not as a failure', async () => {
    electron.showSaveDialog.mockResolvedValue({ canceled: true });
    const res = await handleStudioPackageExport(event, { project, strategy: 'full' });
    expect(res).toEqual({ success: false, canceled: true });
    expect(service.writePackage).not.toHaveBeenCalled();
  });

  it('appends the extension when the dialog returns a bare name', async () => {
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: 'C:/out/demo' });
    const res = await handleStudioPackageExport(event, { project, strategy: 'full' });
    expect(res.filePath).toBe('C:/out/demo.vidtsx');
    expect(service.writePackage.mock.calls[0][0].destPath).toBe('C:/out/demo.vidtsx');
  });

  it('keeps an extension the user already typed, whatever its case', async () => {
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: 'C:/out/demo.VIDTSX' });
    const res = await handleStudioPackageExport(event, { project, strategy: 'full' });
    expect(res.filePath).toBe('C:/out/demo.VIDTSX');
  });

  it('skips the dialog when a destination is supplied and streams progress back', async () => {
    service.writePackage.mockImplementation(
      async (options: { onProgress?: (p: { percent: number; message: string }) => void }) => {
        options.onProgress?.({ percent: 50, message: 'Copying media…' });
        return { manifest: { kind: 'project', assets: [] }, bytes: 7, warnings: ['heads up'] };
      },
    );
    const res = await handleStudioPackageExport(event, {
      project,
      strategy: 'proxies-only',
      destPath: 'C:/out/demo.vidtsx',
    });
    expect(electron.showSaveDialog).not.toHaveBeenCalled();
    expect(res).toMatchObject({ success: true, bytes: 7, kind: 'project', warnings: ['heads up'] });
    expect(sent.map((s) => s.payload)).toEqual([
      { op: 'export', percent: 50, message: 'Copying media…' },
      { op: 'export', percent: 100, message: 'Package written' },
    ]);
  });

  it('returns a typed error when the write fails', async () => {
    service.writePackage.mockRejectedValue(new Error('disk full'));
    const res = await handleStudioPackageExport(event, {
      project,
      strategy: 'full',
      destPath: 'C:/out/demo.vidtsx',
    });
    expect(res).toEqual({ success: false, error: 'disk full' });
  });
});

const manifest = {
  formatVersion: 1,
  kind: 'project' as const,
  app: { name: 'VidTSX Studio', version: '1.0.1' },
  schemaVersion: 1,
  createdAt: '2026-08-26T00:00:00.000Z',
  project: { name: 'Demo', width: 1920, height: 1080, fps: 30 },
  mediaStrategy: 'full' as const,
  counts: { assets: 1, media: 1, shots: 1, transcripts: 0 },
  totalBytes: 10,
  assets: [],
  files: [],
};

describe('handleStudioPackageInspect', () => {
  it('reports a dismissed picker as canceled', async () => {
    electron.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const res = await handleStudioPackageInspect(event, {});
    expect(res).toEqual({ success: false, canceled: true });
    expect(importer.inspectPackage).not.toHaveBeenCalled();
  });

  it('flattens the manifest into what the dialog shows, incompatibility included', async () => {
    importer.inspectPackage.mockResolvedValue({
      manifest: { ...manifest, kitVersion: '1.2.3', agentChat: true },
      incompatible: 'Update VidTSX Studio.',
    });
    const res = await handleStudioPackageInspect(event, { filePath: 'C:/in/demo.vidtsx' });
    expect(res.info).toMatchObject({
      filePath: 'C:/in/demo.vidtsx',
      kind: 'project',
      kitVersion: '1.2.3',
      hasAgentChat: true,
      incompatible: 'Update VidTSX Studio.',
    });
  });

  it('only surfaces a brand snapshot that is actually shaped like brand tokens', async () => {
    importer.inspectPackage.mockResolvedValue({
      manifest,
      brandSnapshot: { name: 'nonsense', palette: 'not an object' },
    });
    const bad = await handleStudioPackageInspect(event, { filePath: 'C:/in/demo.vidtsx' });
    expect(bad.info?.brandSnapshot).toBeUndefined();

    importer.inspectPackage.mockResolvedValue({
      manifest,
      brandSnapshot: {
        name: 'Acme',
        palette: { primary: '#1', secondary: '#2', background: '#3', text: '#4', accent: '#5' },
        fonts: { display: 'Inter' },
      },
    });
    const good = await handleStudioPackageInspect(event, { filePath: 'C:/in/demo.vidtsx' });
    expect(good.info?.brandSnapshot?.name).toBe('Acme');
  });

  it('turns a read failure into a typed error, never a throw', async () => {
    importer.inspectPackage.mockRejectedValue(new Error('not a readable .vidtsx package.'));
    const res = await handleStudioPackageInspect(event, { filePath: 'C:/in/x.vidtsx' });
    expect(res).toEqual({ success: false, error: 'not a readable .vidtsx package.' });
  });
});

describe('handleStudioPackageImport', () => {
  it('streams progress and returns the report', async () => {
    importer.importPackage.mockImplementation(
      async (req: { onProgress?: (p: { percent: number; message: string }) => void }) => {
        req.onProgress?.({ percent: 40, message: 'Unpacking…' });
        return { projectId: 'demo-project', name: 'Demo', shots: [], relink: [], warnings: [] };
      },
    );
    const res = await handleStudioPackageImport(event, { filePath: 'C:/in/demo.vidtsx' });
    expect(res.report?.projectId).toBe('demo-project');
    expect(sent.map((s) => s.payload)).toEqual([
      { op: 'import', percent: 40, message: 'Unpacking…' },
      { op: 'import', percent: 100, message: 'Project imported' },
    ]);
  });

  it('passes the brand choice through only when the dialog made one', async () => {
    importer.importPackage.mockResolvedValue({ projectId: 'p', name: 'p', shots: [], relink: [] });
    await handleStudioPackageImport(event, { filePath: 'C:/in/demo.vidtsx' });
    expect(importer.importPackage.mock.calls[0][0].brand).toBeUndefined();
    await handleStudioPackageImport(event, {
      filePath: 'C:/in/demo.vidtsx',
      brand: { mode: 'match', brandId: 'acme' },
    });
    expect(importer.importPackage.mock.calls[1][0].brand).toEqual({ mode: 'match', brandId: 'acme' });
  });

  it('surfaces a refusal as a typed error', async () => {
    importer.importPackage.mockRejectedValue(new Error('Unsafe path in the manifest: ../evil'));
    const res = await handleStudioPackageImport(event, { filePath: 'C:/in/evil.vidtsx' });
    expect(res).toEqual({ success: false, error: 'Unsafe path in the manifest: ../evil' });
  });
});

describe('handleStudioShotConform', () => {
  it('requires a project and a shot', async () => {
    const res = await handleStudioShotConform(event, { projectId: '', shotId: '' });
    expect(res.success).toBe(false);
    expect(conformer.conformShot).not.toHaveBeenCalled();
  });

  it('reports the version the shot now points at', async () => {
    conformer.conformShot.mockResolvedValue({ shotId: 'intro', version: 2 });
    const res = await handleStudioShotConform(event, { projectId: 'p', shotId: 'intro' });
    expect(res).toEqual({ success: true, shotId: 'intro', version: 2 });
  });

  it('a conversion that fails is an error response, not a throw', async () => {
    conformer.conformShot.mockResolvedValue({ shotId: 'intro', error: 'still fails the gate' });
    const res = await handleStudioShotConform(event, { projectId: 'p', shotId: 'intro' });
    expect(res).toEqual({ success: false, shotId: 'intro', error: 'still fails the gate' });
  });
});
