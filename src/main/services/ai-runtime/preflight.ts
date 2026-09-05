/**
 * Preflight rules for installing the AI runtime (plan §3 step 4) — pure functions so
 * they are unit-tested without Electron, plus one registry read for LongPathsEnabled.
 *
 * Stage 0 evidence behind each rule:
 * - variant: cu126 needs an NVIDIA card, driver >= 525.60 (CUDA 12 minor-version
 *   compatibility) and >= 4 GB VRAM (TripoSR at mc 256 peaks at ~2.1 GB); everything
 *   else runs the cpu build ("about a minute per model").
 * - path budget: the deepest file in the runtime is `maxRelativePathLength` chars; on a
 *   default Windows (LongPathsEnabled off) len(root) + that + 1 must stay <= 259 or
 *   python.exe dies with 0xC0000106 / `import torch` fails on a 350-char file.
 * - disk: zip + extracted tree must both fit while the archive is still on disk.
 */
import { execFile } from 'child_process';
import type { AiRuntimeVariant, AiRuntimePreflightIssue } from '@shared/ipc/types/ai-runtime';
import type { AiRuntimeCatalogueEntry } from './catalogue';

export const MAX_PATH_CHARS = 259;
export const CU126_MIN_VRAM_MB = 4096;

export interface GpuFacts {
  name: string | null;
  driverVersion: string | null;
  vramTotalMB: number | null;
}

/** Compare dotted numeric versions ("592.82" vs "525.60"): negative, zero, positive. */
export function compareDotted(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface VariantChoice {
  variant: AiRuntimeVariant;
  reason: string;
}

/**
 * Pick the runtime variant for this machine. NVIDIA + driver floor + VRAM floor → cu126;
 * anything else → cpu, with a one-line reason for the row.
 */
export function chooseVariant(gpu: GpuFacts | null, minDriver: string | null): VariantChoice {
  if (!gpu || !gpu.name) {
    return { variant: 'cpu', reason: 'No NVIDIA GPU detected — the CPU runtime runs everywhere (about a minute per 3D model).' };
  }
  if (gpu.vramTotalMB !== null && gpu.vramTotalMB > 0 && gpu.vramTotalMB < CU126_MIN_VRAM_MB) {
    return { variant: 'cpu', reason: `${gpu.name} has ${Math.round(gpu.vramTotalMB / 1024 * 10) / 10} GB of VRAM; the GPU runtime needs 4 GB.` };
  }
  if (minDriver && gpu.driverVersion && compareDotted(gpu.driverVersion, minDriver) < 0) {
    return { variant: 'cpu', reason: `NVIDIA driver ${gpu.driverVersion} is older than ${minDriver}; update the driver to use the GPU runtime.` };
  }
  return { variant: 'cu126', reason: `${gpu.name}${gpu.driverVersion ? ` (driver ${gpu.driverVersion})` : ''} supports the CUDA runtime.` };
}

/** Longest install root (chars) that keeps every file under the Windows MAX_PATH limit. */
export function rootBudgetChars(maxRelativePathLength: number): number {
  return MAX_PATH_CHARS - maxRelativePathLength - 1;
}

/**
 * Refuse when the runtime folder would push its deepest file past MAX_PATH on a
 * Windows without the long-path policy. `installDir` is the final runtime folder.
 */
export function checkPathBudget(
  installDir: string,
  maxRelativePathLength: number,
  longPathsEnabled: boolean,
): AiRuntimePreflightIssue | null {
  if (longPathsEnabled) return null;
  const budget = rootBudgetChars(maxRelativePathLength);
  if (installDir.length <= budget) return null;
  return {
    code: 'path-too-long',
    message:
      `The install folder path is ${installDir.length} characters; the runtime's deepest file needs it to be ` +
      `${budget} or fewer on this Windows. Enable long paths (registry LongPathsEnabled = 1 under ` +
      `HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem, then sign out and in) or use a shorter Windows user name.`,
  };
}

/** Zip + extracted tree (+ 5 % slack) must fit on the drive. */
export function checkDisk(freeBytes: number, entry: Pick<AiRuntimeCatalogueEntry, 'bytes' | 'bytesOnDisk'>): AiRuntimePreflightIssue | null {
  const needed = Math.ceil((entry.bytes + entry.bytesOnDisk) * 1.05);
  if (freeBytes >= needed) return null;
  const gb = (n: number) => (n / 1_000_000_000).toFixed(1);
  return {
    code: 'disk',
    message: `Not enough disk space: ${gb(needed)} GB needed (download + extracted files), ${gb(freeBytes)} GB free.`,
  };
}

export function checkPlatform(platform: NodeJS.Platform = process.platform): AiRuntimePreflightIssue | null {
  if (platform === 'win32') return null;
  return { code: 'unsupported-platform', message: 'The AI runtime is Windows-only in this release.' };
}

/**
 * Windows long-path policy: HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled.
 * Absent or 0 → false. Non-Windows → true (no MAX_PATH there). Read once per process.
 */
let longPathsPromise: Promise<boolean> | null = null;
export function readLongPathsEnabled(): Promise<boolean> {
  longPathsPromise ??= new Promise<boolean>((resolve) => {
    if (process.platform !== 'win32') { resolve(true); return; }
    execFile(
      'reg.exe',
      ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem', '/v', 'LongPathsEnabled'],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve(false); return; }
        const m = /LongPathsEnabled\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(stdout);
        resolve(m ? Number.parseInt(m[1], 16) === 1 : false);
      },
    );
  });
  return longPathsPromise;
}

/** Test-only. */
export function __resetLongPathsCache(): void {
  longPathsPromise = null;
}
