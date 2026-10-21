import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioProxyEncoderInstallResponse,
  StudioProxyEncoderRebuildRequest,
  StudioProxyEncoderRebuildResponse,
  StudioProxyEncoderSetEnabledRequest,
  StudioProxyEncoderSetEnabledResponse,
  StudioProxyEncoderStatusResponse,
} from '../../shared/ipc/types';
import { getProxyGpuEncoderSetting, setProxyGpuEncoderEnabled } from '../services/settings';
import {
  FFMPEG_FULL_CATALOGUE,
  clearProxyGpuFallback,
  getFfmpegFullBinary,
  getProxyGpuFallback,
  installFfmpegFull,
  isFfmpegFullDownloading,
  probeProxyEncoders,
} from '../services/studio/ffmpeg-full';
import { detectNvidiaAdapter } from '../services/studio/gpu-adapters';
import { rebuildProxiesOnGpu } from '../services/studio/proxy-gpu-rebuild';
import { getProjectDir } from '../services/studio/studio-paths';
import {
  PROXY_GPU_ENCODER_LABELS,
  chooseProxyEncoder,
  effectiveProxyGpuEnabled,
  isProxyGpuAutoViable,
} from '../services/studio/proxy-encoders';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const EMPTY: Omit<StudioProxyEncoderStatusResponse, 'success' | 'error'> = {
  enabled: false,
  installed: false,
  downloading: false,
  downloadable: process.platform === FFMPEG_FULL_CATALOGUE.platform,
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
    const setting = await getProxyGpuEncoderSetting();
    const ffmpeg = await getFfmpegFullBinary();
    const probe = ffmpeg ? await probeProxyEncoders(ffmpeg) : null;
    const detected = probe ? chooseProxyEncoder(probe.working) : null;
    return {
      success: true,
      ...EMPTY,
      enabled: effectiveProxyGpuEnabled(setting, isProxyGpuAutoViable(probe?.working ?? [])),
      choice: setting ?? null,
      installed: ffmpeg !== null,
      downloading: isFfmpegFullDownloading(),
      nvidiaAdapter: await detectNvidiaAdapter(),
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

export async function handleStudioProxyEncoderRebuild(
  _event: IpcMainInvokeEvent,
  data: StudioProxyEncoderRebuildRequest,
): Promise<StudioProxyEncoderRebuildResponse> {
  try {
    await getProjectDir(data.projectId); // Validates the id before any job is queued.
    const assets = (Array.isArray(data.assets) ? data.assets : []).filter(
      (a) => typeof a?.assetId === 'string' && typeof a.path === 'string' && a.path.length > 0,
    );
    return { success: true, ...(await rebuildProxiesOnGpu(data.projectId, assets)) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to rebuild proxies'), restarted: [], rebuilt: [] };
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
