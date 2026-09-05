/**
 * GPU facts for the runtime preflight: name, driver version, total VRAM — from
 * nvidia-smi, memoized for the process (static hardware). Non-NVIDIA / no nvidia-smi
 * → null, which the variant chooser reads as "use the cpu build".
 */
import { execFile } from 'child_process';
import type { GpuFacts } from './preflight';
import { getAiRuntimeDevOverrides } from './dev-overrides';

let cache: Promise<GpuFacts | null> | null = null;

function query(): Promise<GpuFacts | null> {
  return new Promise((resolve) => {
    const bin = process.platform === 'win32' ? 'nvidia-smi.exe' : 'nvidia-smi';
    execFile(
      bin,
      ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve(null); return; }
        const line = stdout.trim().split('\n')[0];
        if (!line) { resolve(null); return; }
        const parts = line.split(',').map((s) => s.trim());
        if (parts.length < 2 || !parts[0]) { resolve(null); return; }
        const vram = Number.parseInt(parts[1], 10);
        resolve({
          name: parts[0],
          vramTotalMB: Number.isFinite(vram) && vram > 0 ? vram : null,
          driverVersion: parts[2] && /^\d/.test(parts[2]) ? parts[2] : null,
        });
      },
    );
  });
}

/** Dev-only stand-ins (VIDTSX_AI_RUNTIME_OVERRIDES) so the driver / VRAM guards can be driven in a test. */
function applyOverrides(facts: GpuFacts | null): GpuFacts | null {
  const o = getAiRuntimeDevOverrides();
  if (!o) return facts;
  if (o.gpuName === null) return null;
  const base: GpuFacts = facts ?? { name: null, driverVersion: null, vramTotalMB: null };
  return {
    name: o.gpuName ?? base.name,
    driverVersion: o.driverVersion !== undefined ? o.driverVersion : base.driverVersion,
    vramTotalMB: o.vramTotalMB !== undefined ? o.vramTotalMB : base.vramTotalMB,
  };
}

export function getGpuFacts(): Promise<GpuFacts | null> {
  cache ??= query().then(applyOverrides);
  return cache;
}

/** Test-only. */
export function __resetGpuFactsCache(): void {
  cache = null;
}
