import { spawn } from 'child_process';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('StudioProxyHwaccel');

/**
 * Which GPU decodes proxy sources. Measured 2026-09-02 (T4,
 * docs/PREVIEW_TESTS_PLAN.md) on a hybrid laptop: `-hwaccel d3d11va` on the
 * DEFAULT adapter — the Intel iGPU — halved CPU seconds but did not shorten
 * the wait at all (1.10x → 1.07x realtime); the same flag on the discrete
 * NVIDIA adapter halved CPU and ran 1.6x faster. DXGI enumerates the iGPU
 * first on such machines, so the adapter has to be chosen, not defaulted.
 */
export interface DecodeAdapter {
  index: number;
  /** PCI vendor id, lower-case hex: 8086 Intel, 10de NVIDIA, 1002 AMD, 1414 Microsoft (software). */
  vendorId: string;
  name: string;
}

const MAX_ADAPTERS = 4;
const SOFTWARE_VENDORS = new Set(['1414']);
const INTEGRATED_VENDORS = new Set(['8086']);

/** Parse ffmpeg's verbose device-init log for one adapter index. */
export function parseDecodeAdapter(index: number, stderr: string): DecodeAdapter | null {
  if (/Failed to create Direct3D device/i.test(stderr)) return null;
  // Greedy to the line's last ")" — names contain their own, e.g. "Intel(R) UHD Graphics".
  const m = /Using device ([0-9a-f]{4}):([0-9a-f]{4}) \((.*)\)\.?\s*$/im.exec(stderr);
  if (!m) return null;
  const vendorId = m[1].toLowerCase();
  if (SOFTWARE_VENDORS.has(vendorId)) return null;
  return { index, vendorId, name: m[3].trim() };
}

/** Prefer a discrete GPU; fall back to whatever decodes at all. */
export function chooseDecodeAdapter(adapters: DecodeAdapter[]): DecodeAdapter | null {
  if (adapters.length === 0) return null;
  return adapters.find((a) => !INTEGRATED_VENDORS.has(a.vendorId)) ?? adapters[0];
}

async function probeAdapter(ffmpeg: string, index: number): Promise<string> {
  return new Promise((resolve) => {
    // No input, no output: ffmpeg initialises the device while parsing options
    // and prints "Using device …" before complaining there is nothing to do.
    const proc = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'verbose', '-init_hw_device', `d3d11va=dx:${index}`], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on('error', () => resolve(''));
    proc.on('close', () => resolve(stderr));
  });
}

let cached: Promise<string[]> | null = null;

/**
 * Input-side ffmpeg args for hardware decode, or `[]` when there is nothing
 * usable. Probed once per session (a few hundred ms, no media touched).
 * Windows only: d3d11va is the one hwaccel the bundled ffmpeg has.
 */
export function detectDecodeArgs(ffmpeg: string): Promise<string[]> {
  if (process.platform !== 'win32') return Promise.resolve([]);
  if (!cached) {
    cached = (async () => {
      const adapters: DecodeAdapter[] = [];
      for (let i = 0; i < MAX_ADAPTERS; i++) {
        const adapter = parseDecodeAdapter(i, await probeAdapter(ffmpeg, i));
        if (!adapter) break;
        adapters.push(adapter);
      }
      const chosen = chooseDecodeAdapter(adapters);
      log.info('Proxy decode adapter', {
        adapters: adapters.map((a) => `${a.index}:${a.name}`),
        chosen: chosen ? `${chosen.index}:${chosen.name}` : 'none (software decode)',
      });
      return chosen ? ['-hwaccel', 'd3d11va', '-hwaccel_device', String(chosen.index)] : [];
    })();
  }
  return cached;
}
