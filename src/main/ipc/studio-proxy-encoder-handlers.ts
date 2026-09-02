import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioProxyEncoderInstallResponse,
  StudioProxyEncoderSetEnabledRequest,
  StudioProxyEncoderSetEnabledResponse,
  StudioProxyEncoderStatusResponse,
} from '../../shared/ipc/types';
import { getProxyGpuEncoderEnabled, setProxyGpuEncoderEnabled } from '../services/settings';
import {
  FFMPEG_FULL_CATALOGUE,
  clearProxyGpuFallback,
  getFfmpegFullBinary,
  getProxyGpuFallback,
  installFfmpegFull,
  isFfmpegFullDownloading,
  probeProxyEncoders,
} from '../services/studio/ffmpeg-full';
import { PROXY_GPU_ENCODER_LABELS, chooseProxyEncoder } from '../services/studio/proxy-encoders';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const EMPTY: Omit<StudioProxyEncoderStatusResponse, 'success' | 'error'> = {
  enabled: false,
  installed: false,
  downloading: false,
  downloadBytes: FFMPEG_FULL_CATALOGUE.bytes,
  version: FFMPEG_FULL_CATALOGUE.version,
  licence: FFMPEG_FULL_CATALOGUE.licence,
  detected: null,
  detectedLabel: null,
  listed: [],
  fallback: null,
};

export async function handleStudioProxyEncoderStatus(): Promise<StudioProxyEncoderStatusResponse> {
  try {
    const enabled = await getProxyGpuEncoderEnabled();
    const ffmpeg = await getFfmpegFullBinary();
    const probe = ffmpeg ? await probeProxyEncoders(ffmpeg) : null;
    const detected = probe ? chooseProxyEncoder(probe.working) : null;
    return {
      success: true,
      ...EMPTY,
      enabled,
      installed: ffmpeg !== null,
      downloading: isFfmpegFullDownloading(),
      detected,
      detectedLabel: detected ? PROXY_GPU_ENCODER_LABELS[detected] : null,
      listed: probe?.listed ?? [],
      fallback: getProxyGpuFallback(),
    };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to read GPU encoder status'), ...EMPTY };
  }
}

export async function handleStudioProxyEncoderInstall(): Promise<StudioProxyEncoderInstallResponse> {
  try {
    await installFfmpegFull();
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'ffmpeg download failed') };
  }
}

export async function handleStudioProxyEncoderSetEnabled(
  _event: IpcMainInvokeEvent,
  data: StudioProxyEncoderSetEnabledRequest,
): Promise<StudioProxyEncoderSetEnabledResponse> {
  try {
    await setProxyGpuEncoderEnabled(data.enabled === true);
    // Toggling is the user's way to retry after a latched fallback.
    clearProxyGpuFallback();
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save setting') };
  }
}
