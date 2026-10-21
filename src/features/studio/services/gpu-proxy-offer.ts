// The first-4K-import download card (A4, plan §2 T7): when a 4K video lands
// in a project and the GPU proxy encoder is not on this machine yet, offer
// the full ffmpeg download with the measured numbers. Pure — the hook
// (useGpuProxyOffer) supplies the encoder status and the session storage.

import type { StudioProxyEncoderStatusResponse } from '@shared/ipc/types';
import type { StudioMediaAsset } from '../types';
import { readStoredChoice, writeStoredChoice, type ChoiceStorage } from './stored-choice';

/**
 * T4b, 2026-09-02, GTX 1650 Ti (src/main/services/studio/proxy-encoders.ts
 * head): 60 s of 4K60 HEVC → the 540p proxy in 12 s on NVENC against 91 s on
 * the shipping x264 path.
 */
export const GPU_PROXY_MEASURED = { gpuSecondsPerMinute: 12, cpuSecondsPerMinute: 91 } as const;

/**
 * The line under "ready" when the encoder only applies after a restart; null
 * when the next import uses it straight away. Decided by A4 step 4's live
 * run (docs/studio/end-to-end/A4/HANDOFF.md).
 */
export const GPU_PROXY_RESTART_NOTE: string | null = null;

/** sessionStorage key: "Not now" holds until the app restarts. */
export const GPU_PROXY_OFFER_DISMISS_KEY = 'vidtsx:gpu-proxy-offer';
const DISMISSED = 'dismissed';

export type OfferMedia = Pick<StudioMediaAsset, 'kind'> & {
  probe: { width?: number; height?: number };
};

export type OfferStatus = Pick<
  StudioProxyEncoderStatusResponse,
  'success' | 'installed' | 'downloading' | 'choice' | 'downloadable' | 'nvidiaAdapter'
>;

/** 4K-class video: either side at UHD (3840 wide, or 2160 on the short side). */
export function isFourKVideo(asset: OfferMedia): boolean {
  if (asset.kind !== 'video') return false;
  const { width, height } = asset.probe;
  if (!width || !height) return false;
  return Math.max(width, height) >= 3840 || Math.min(width, height) >= 2160;
}

/**
 * Show the card for this import? Only for a 4K video, on a platform the
 * download exists for, on a machine that is not known to lack an NVIDIA
 * card, when the encoder is neither here nor on its way, the user never
 * switched GPU proxies off, and "Not now" was not clicked this session.
 */
export function shouldOfferGpuProxyDownload(
  imported: readonly OfferMedia[],
  status: OfferStatus | null,
  dismissed: boolean,
): boolean {
  if (dismissed || !status?.success) return false;
  if (status.downloadable !== true) return false;
  if (status.nvidiaAdapter === false) return false;
  if (status.installed || status.downloading) return false;
  if (status.choice === false) return false;
  return imported.some(isFourKVideo);
}

export function gpuProxyOfferBody(downloadBytes: number, licence: string): string {
  const mb = Math.round(downloadBytes / 1048576);
  const { gpuSecondsPerMinute: gpu, cpuSecondsPerMinute: cpu } = GPU_PROXY_MEASURED;
  return (
    `4K preview proxies take about ${cpu} s per minute of footage on the CPU, about ${gpu} s on an ` +
    `NVIDIA graphics card. The GPU encoder is a one-time ${mb} MB download (full ffmpeg, ${licence}).`
  );
}

/** What the card says once the download is done, from the refreshed status. */
export function gpuProxyOfferOutcome(
  status: Pick<StudioProxyEncoderStatusResponse, 'installed' | 'enabled' | 'detected' | 'detectedLabel'>,
): { ok: boolean; text: string } {
  if (!status.installed) return { ok: false, text: 'The download did not finish — try again from Settings › Rendering.' };
  if (!status.detected) {
    return { ok: false, text: 'Downloaded, but no supported GPU encoder works on this machine — proxies stay on the CPU.' };
  }
  const label = status.detectedLabel ?? status.detected;
  if (!status.enabled) return { ok: false, text: `Downloaded (${label}). Turn it on in Settings › Rendering.` };
  const base = `GPU encoder ready (${label}): proxies for footage you import from now on build on the graphics card.`;
  return { ok: true, text: GPU_PROXY_RESTART_NOTE ? `${base} ${GPU_PROXY_RESTART_NOTE}` : base };
}

export function readOfferDismissed(storage: ChoiceStorage | undefined): boolean {
  return readStoredChoice(storage, GPU_PROXY_OFFER_DISMISS_KEY, [DISMISSED, ''] as const, '') === DISMISSED;
}

export function writeOfferDismissed(storage: ChoiceStorage | undefined): void {
  writeStoredChoice(storage, GPU_PROXY_OFFER_DISMISS_KEY, DISMISSED);
}
