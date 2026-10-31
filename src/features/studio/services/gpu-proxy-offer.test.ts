import { describe, expect, it } from 'vitest';
import {
  GPU_PROXY_OFFER_DISMISS_KEY,
  gpuProxyOfferBody,
  gpuProxyOfferOutcome,
  gpuProxyRebuildTargets,
  isFourKVideo,
  withRebuildNote,
  readOfferDismissed,
  shouldOfferGpuProxyDownload,
  writeOfferDismissed,
  type OfferMedia,
  type OfferStatus,
} from './gpu-proxy-offer';

const dji: OfferMedia = { kind: 'video', probe: { width: 3840, height: 2160 } };
const hd: OfferMedia = { kind: 'video', probe: { width: 1920, height: 1080 } };
const fresh: OfferStatus = {
  success: true,
  installed: false,
  downloading: false,
  choice: null,
  downloadable: true,
  nvidiaAdapter: true,
};

describe('isFourKVideo', () => {
  it('counts UHD, DCI and vertical 4K; not HD, images or unprobed files', () => {
    expect(isFourKVideo(dji)).toBe(true);
    expect(isFourKVideo({ kind: 'video', probe: { width: 4096, height: 2160 } })).toBe(true);
    expect(isFourKVideo({ kind: 'video', probe: { width: 2160, height: 3840 } })).toBe(true);
    expect(isFourKVideo(hd)).toBe(false);
    expect(isFourKVideo({ kind: 'video', probe: { width: 2560, height: 1440 } })).toBe(false);
    expect(isFourKVideo({ kind: 'image', probe: { width: 6000, height: 4000 } })).toBe(false);
    expect(isFourKVideo({ kind: 'video', probe: {} })).toBe(false);
  });
});

describe('shouldOfferGpuProxyDownload', () => {
  it('offers on a 4K import when nothing was downloaded or chosen', () => {
    expect(shouldOfferGpuProxyDownload([hd, dji], fresh, false)).toBe(true);
    // unknown adapter list → still offered (only a definite "no NVIDIA" hides it)
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, nvidiaAdapter: null }, false)).toBe(true);
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, choice: undefined }, false)).toBe(true);
  });

  it('stays quiet for HD-only imports', () => {
    expect(shouldOfferGpuProxyDownload([hd], fresh, false)).toBe(false);
    expect(shouldOfferGpuProxyDownload([], fresh, false)).toBe(false);
  });

  it('stays quiet once installed, while downloading, after Not now, or after an explicit off', () => {
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, installed: true }, false)).toBe(false);
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, downloading: true }, false)).toBe(false);
    expect(shouldOfferGpuProxyDownload([dji], fresh, true)).toBe(false);
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, choice: false }, false)).toBe(false);
  });

  it('stays quiet off Windows, without NVIDIA, or when the status failed / is from an older main', () => {
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, downloadable: false }, false)).toBe(false);
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, downloadable: undefined }, false)).toBe(false);
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, nvidiaAdapter: false }, false)).toBe(false);
    expect(shouldOfferGpuProxyDownload([dji], { ...fresh, success: false }, false)).toBe(false);
    expect(shouldOfferGpuProxyDownload([dji], null, false)).toBe(false);
  });
});

describe('card copy', () => {
  it('quotes the measured numbers and the download size', () => {
    const body = gpuProxyOfferBody(80069496, 'GPL v3');
    expect(body).toContain('about 91 s per minute of footage on the CPU');
    expect(body).toContain('about 12 s on an NVIDIA graphics card');
    expect(body).toContain('76 MB download (full ffmpeg, GPL v3)');
  });

  it('reports the outcome from the refreshed status', () => {
    const base = { installed: true, enabled: true, detected: 'nvenc' as const, detectedLabel: 'NVIDIA NVENC' };
    expect(gpuProxyOfferOutcome(base)).toEqual({
      ok: true,
      text: 'GPU encoder ready (NVIDIA NVENC): proxies for footage you import from now on build on the graphics card.',
    });
    expect(gpuProxyOfferOutcome({ ...base, detected: null, detectedLabel: null }).ok).toBe(false);
    expect(gpuProxyOfferOutcome({ ...base, enabled: false }).text).toContain('Settings › Rendering');
    expect(gpuProxyOfferOutcome({ ...base, installed: false }).ok).toBe(false);
  });
});

describe('Not now (session storage)', () => {
  it('round-trips and survives a throwing storage', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(readOfferDismissed(storage)).toBe(false);
    writeOfferDismissed(storage);
    expect(map.get(GPU_PROXY_OFFER_DISMISS_KEY)).toBe('dismissed');
    expect(readOfferDismissed(storage)).toBe(true);
    const broken = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readOfferDismissed(broken)).toBe(false);
    expect(() => writeOfferDismissed(broken)).not.toThrow();
    expect(readOfferDismissed(undefined)).toBe(false);
  });
});

describe('after the download: re-queue the 4K proxies still on x264', () => {
  it('targets the 4K videos only, with their source paths', () => {
    const assets = [
      { id: 'dji', kind: 'video' as const, path: 'D:/raw/dji.mp4', probe: { width: 3840, height: 2160 } },
      { id: 'hd', kind: 'video' as const, path: 'D:/raw/hd.mp4', probe: { width: 1920, height: 1080 } },
      { id: 'still', kind: 'image' as const, path: 'D:/raw/4k.png', probe: { width: 3840, height: 2160 } },
      { id: 'portrait', kind: 'video' as const, path: 'D:/raw/p.mp4', probe: { width: 2160, height: 3840 } },
    ];
    expect(gpuProxyRebuildTargets(assets)).toEqual([
      { assetId: 'dji', path: 'D:/raw/dji.mp4' },
      { assetId: 'portrait', path: 'D:/raw/p.mp4' },
    ]);
    expect(gpuProxyRebuildTargets([])).toEqual([]);
  });

  it('says the clips already imported are rebuilding on the graphics card', () => {
    const ok = { ok: true, text: 'GPU encoder ready (NVIDIA NVENC): proxies for footage you import from now on build on the graphics card.' };
    expect(withRebuildNote(ok, 0)).toEqual(ok);
    expect(withRebuildNote(ok, 1).text).toBe(`${ok.text} The 4K clip already in this project is rebuilding on it now.`);
    expect(withRebuildNote(ok, 3).text).toBe(`${ok.text} The 3 4K clips already in this project are rebuilding on it now.`);
    const warn = { ok: false, text: 'Downloaded (Intel Quick Sync). Turn it on in Settings › Rendering.' };
    expect(withRebuildNote(warn, 2)).toEqual(warn);
  });
});
