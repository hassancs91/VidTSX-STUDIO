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
const electron = vi.hoisted(() => ({ showSaveDialog: vi.fn() }));

vi.mock('../services/studio/project-package', () => service);
vi.mock('electron', () => ({ dialog: { showSaveDialog: electron.showSaveDialog } }));

import { handleStudioPackageExport, handleStudioPackagePlan } from './studio-package-handlers';

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
