import { app } from 'electron';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('StudioGpuAdapters');

/** PCI vendor id of NVIDIA (proxy-hwaccel.ts lists the others: 8086 Intel, 1002 AMD). */
export const NVIDIA_VENDOR_ID = 0x10de;

function vendorIdOf(device: unknown): number | null {
  if (typeof device !== 'object' || device === null) return null;
  const raw = (device as { vendorId?: unknown }).vendorId;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw.replace(/^0x/i, ''), 16);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Narrow Electron's `app.getGPUInfo('basic')` result (Chromium's GPU info,
 * `gpuDevice: [{ vendorId, deviceId, active }]` — a hybrid laptop lists the
 * iGPU AND the NVIDIA card). true/false when it lists devices, null when the
 * shape is unreadable (callers treat unknown as "maybe").
 */
export function hasNvidiaAdapter(info: unknown): boolean | null {
  if (typeof info !== 'object' || info === null) return null;
  const devices = (info as { gpuDevice?: unknown }).gpuDevice;
  if (!Array.isArray(devices) || devices.length === 0) return null;
  return devices.some((d) => vendorIdOf(d) === NVIDIA_VENDOR_ID);
}

let cached: Promise<boolean | null> | null = null;

/**
 * Whether this machine has an NVIDIA adapter — asked BEFORE the full ffmpeg
 * exists (the NVENC probe needs it), so the first-4K-import card (A4) only
 * pitches the NVIDIA numbers where they can come true. Once per session.
 */
export function detectNvidiaAdapter(): Promise<boolean | null> {
  cached ??= (async () => {
    try {
      const present = hasNvidiaAdapter(await app.getGPUInfo('basic'));
      log.info('GPU adapters read', { nvidia: present });
      return present;
    } catch (err) {
      log.warn('Could not read GPU info', { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  })();
  return cached;
}
