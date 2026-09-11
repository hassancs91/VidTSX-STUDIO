import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The renderer-facing contract of the GPU proxy encoder row: the setting
 * round-trips through set → status, and the status reflects the binary, the
 * probe and the session fallback. Settings and the binary are faked at the
 * service seam; nothing spawns.
 */
const store = new Map<string, unknown>();
vi.mock('../services/settings', () => ({
  getProxyGpuEncoderEnabled: async () => store.get('proxyGpuEncoderEnabled') === true,
  setProxyGpuEncoderEnabled: async (enabled: boolean) => {
    store.set('proxyGpuEncoderEnabled', enabled === true);
  },
}));

const full = {
  binary: null as string | null,
  working: [] as ('nvenc' | 'qsv' | 'amf')[],
  listed: [] as ('nvenc' | 'qsv' | 'amf')[],
  downloading: false,
  fallback: null as { encoder: 'nvenc' | 'qsv' | 'amf'; reason: string; at: string } | null,
  installs: 0,
};
vi.mock('../services/studio/ffmpeg-full', () => ({
  FFMPEG_FULL_CATALOGUE: { bytes: 80069496, version: 'n8.1.2-test', licence: 'GPL v3' },
  getFfmpegFullBinary: async () => full.binary,
  probeProxyEncoders: async () => ({ listed: full.listed, working: full.working, probedAt: 'now' }),
  isFfmpegFullDownloading: () => full.downloading,
  getProxyGpuFallback: () => full.fallback,
  clearProxyGpuFallback: () => {
    full.fallback = null;
  },
  installFfmpegFull: async () => {
    full.installs++;
    full.binary = 'C:/userData/ffmpeg-full/bin/ffmpeg.exe';
  },
}));

import {
  handleStudioProxyEncoderInstall,
  handleStudioProxyEncoderSetEnabled,
  handleStudioProxyEncoderStatus,
} from './studio-proxy-encoder-handlers';

const event = {} as never;

describe('studio proxy encoder handlers', () => {
  beforeEach(() => {
    store.clear();
    full.binary = null;
    full.working = [];
    full.listed = [];
    full.downloading = false;
    full.fallback = null;
    full.installs = 0;
  });

  it('is off, not installed and undetected by default', async () => {
    const status = await handleStudioProxyEncoderStatus();
    expect(status).toMatchObject({
      success: true,
      enabled: false,
      installed: false,
      downloading: false,
      detected: null,
      detectedLabel: null,
      listed: [],
      fallback: null,
      downloadBytes: 80069496,
      licence: 'GPL v3',
    });
  });

  it('the enabled setting round-trips', async () => {
    expect(await handleStudioProxyEncoderSetEnabled(event, { enabled: true })).toEqual({ success: true });
    expect((await handleStudioProxyEncoderStatus()).enabled).toBe(true);
    expect(await handleStudioProxyEncoderSetEnabled(event, { enabled: false })).toEqual({ success: true });
    expect((await handleStudioProxyEncoderStatus()).enabled).toBe(false);
  });

  it('after install, the status names the working encoder in preference order', async () => {
    expect(await handleStudioProxyEncoderInstall()).toEqual({ success: true });
    expect(full.installs).toBe(1);
    full.listed = ['nvenc', 'qsv', 'amf'];
    full.working = ['qsv', 'amf'];
    const status = await handleStudioProxyEncoderStatus();
    expect(status.installed).toBe(true);
    expect(status.detected).toBe('qsv');
    expect(status.detectedLabel).toBe('Intel Quick Sync');
    expect(status.listed).toEqual(['nvenc', 'qsv', 'amf']);
  });

  it('an AMD-only machine: detected amf, labelled AMD AMF (Item 3, 2026-09-11)', async () => {
    full.binary = 'C:/x/ffmpeg.exe';
    full.listed = ['nvenc', 'qsv', 'amf'];
    full.working = ['amf'];
    const status = await handleStudioProxyEncoderStatus();
    expect(status.detected).toBe('amf');
    expect(status.detectedLabel).toBe('AMD AMF');
  });

  it('installed with no working encoder reports detected: null (the row disables the checkbox)', async () => {
    full.binary = 'C:/x/ffmpeg.exe';
    full.listed = ['nvenc'];
    full.working = [];
    const status = await handleStudioProxyEncoderStatus();
    expect(status.installed).toBe(true);
    expect(status.detected).toBeNull();
  });

  it('surfaces the session fallback, and toggling the setting clears it (a retry)', async () => {
    full.fallback = { encoder: 'nvenc', reason: 'boom', at: 'then' };
    expect((await handleStudioProxyEncoderStatus()).fallback).toEqual({ encoder: 'nvenc', reason: 'boom', at: 'then' });
    await handleStudioProxyEncoderSetEnabled(event, { enabled: true });
    expect((await handleStudioProxyEncoderStatus()).fallback).toBeNull();
  });

  it('reports an in-flight download', async () => {
    full.downloading = true;
    expect((await handleStudioProxyEncoderStatus()).downloading).toBe(true);
  });
});
