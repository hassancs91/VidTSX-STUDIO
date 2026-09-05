/**
 * What the System tab shows and what Stage 3's model service asks before spawning
 * Python: is the pinned runtime installed here, which variant, and if not, can it be?
 */
import fs from 'fs/promises';
import { statfs } from 'fs/promises';
import path from 'path';
import type {
  AiRuntimeInstalledInfo,
  AiRuntimeState,
  AiRuntimeStatus,
  AiRuntimeVariant,
  AiRuntimeVariantInfo,
} from '@shared/ipc/types/ai-runtime';
import { getAiRuntimeDir, getAiRuntimeRoot } from '../../utils/paths';
import { AI_RUNTIME_CATALOGUE, AI_RUNTIME_VARIANTS, AI_RUNTIME_VERSION, formatRuntimeBytes, parseAiRuntimeDirName } from './catalogue';
import { aiRuntimePythonPath, readAiRuntimeManifest } from './manifest';
import { checkDisk, checkPathBudget, checkPlatform, chooseVariant, readLongPathsEnabled, rootBudgetChars } from './preflight';
import { getGpuFacts } from './gpu';
import { getAiRuntimeInstallProgress, getAiRuntimeLastError, isAiRuntimeInstalling } from './install';

export type InstalledScan =
  | { kind: 'none' }
  | { kind: 'broken'; dir: string; reason: string }
  | { kind: 'installed'; info: AiRuntimeInstalledInfo };

/**
 * Pure: derive the row state from what is on disk and what is happening.
 * Exported for tests; `getAiRuntimeStatus` feeds it.
 */
export function computeAiRuntimeState(scan: InstalledScan, targetVersion: string, installing: boolean): AiRuntimeState {
  if (installing) return 'installing';
  if (scan.kind === 'none') return 'missing';
  if (scan.kind === 'broken') return 'broken';
  return scan.info.version === targetVersion ? 'installed' : 'update-available';
}

/**
 * Look for `<version>-<variant>` folders under the runtime root. Prefers the pinned
 * version, then the newest. A folder without a readable manifest or python.exe is
 * reported as broken (Repair fixes it).
 */
export async function scanInstalledRuntime(): Promise<InstalledScan> {
  const root = getAiRuntimeRoot();
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, parsed: parseAiRuntimeDirName(e.name) }))
    .filter((c): c is { name: string; parsed: { version: string; variant: AiRuntimeVariant } } => c.parsed !== null)
    .sort((a, b) => {
      if (a.parsed.version === AI_RUNTIME_VERSION) return -1;
      if (b.parsed.version === AI_RUNTIME_VERSION) return 1;
      return b.parsed.version.localeCompare(a.parsed.version);
    });
  if (candidates.length === 0) return { kind: 'none' };

  const { name, parsed } = candidates[0];
  const dir = path.join(root, name);
  try {
    const manifest = await readAiRuntimeManifest(dir);
    const python = aiRuntimePythonPath(dir, manifest);
    await fs.stat(python);
    return {
      kind: 'installed',
      info: { version: parsed.version, variant: parsed.variant, dir, python, torch: manifest.torch, bytesOnDisk: manifest.bytesOnDisk },
    };
  } catch (err) {
    return { kind: 'broken', dir, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** True when the pinned version is installed and intact (the runtime registry's isAvailable). */
export async function isAiRuntimeAvailable(): Promise<boolean> {
  const scan = await scanInstalledRuntime();
  return scan.kind === 'installed' && scan.info.version === AI_RUNTIME_VERSION;
}

/** python.exe of the installed, pinned runtime — Stage 3's worker client uses this. */
export async function getInstalledAiRuntime(): Promise<AiRuntimeInstalledInfo | null> {
  const scan = await scanInstalledRuntime();
  return scan.kind === 'installed' && scan.info.version === AI_RUNTIME_VERSION ? scan.info : null;
}

/**
 * Free bytes on the drive holding `dir`. The runtime root does not exist before the
 * first install, so walk up to the nearest existing ancestor (userData, then the drive)
 * instead of reporting 0 and blocking the Install button with a bogus disk issue.
 */
async function freeBytesAt(dir: string): Promise<number> {
  let probe = dir;
  for (let i = 0; i < 6; i++) {
    try {
      const s = await statfs(probe);
      return Number(s.bfree) * Number(s.bsize);
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
  }
  return 0;
}

export async function getAiRuntimeStatus(): Promise<AiRuntimeStatus> {
  const root = getAiRuntimeRoot();
  const [gpu, longPaths, scan] = await Promise.all([getGpuFacts(), readLongPathsEnabled(), scanInstalledRuntime()]);
  const diskFreeBytes = await freeBytesAt(root).catch(() => 0);
  const recommendation = chooseVariant(gpu, AI_RUNTIME_CATALOGUE.cu126.minDriver);
  const platformIssue = checkPlatform();

  const variants = {} as Record<AiRuntimeVariant, AiRuntimeVariantInfo>;
  for (const variant of AI_RUNTIME_VARIANTS) {
    const entry = AI_RUNTIME_CATALOGUE[variant];
    const installDir = getAiRuntimeDir(entry.version, variant);
    const issue =
      platformIssue ??
      (variant === 'cu126' && recommendation.variant !== 'cu126'
        ? { code: 'gpu-unsupported' as const, message: recommendation.reason }
        : null) ??
      checkPathBudget(installDir, entry.maxRelativePathLength, longPaths) ??
      checkDisk(diskFreeBytes, entry);
    variants[variant] = {
      variant,
      version: entry.version,
      bytes: entry.bytes,
      bytesOnDisk: entry.bytesOnDisk,
      sizeLabel: formatRuntimeBytes(entry.bytes),
      torch: entry.torch,
      cuda: entry.cuda,
      minDriver: entry.minDriver,
      issue,
    };
  }

  const installing = isAiRuntimeInstalling();
  const state = computeAiRuntimeState(scan, AI_RUNTIME_VERSION, installing);
  const lastError = getAiRuntimeLastError() ?? (scan.kind === 'broken' ? scan.reason : null);

  return {
    state,
    targetVersion: AI_RUNTIME_VERSION,
    recommendedVariant: recommendation.variant,
    recommendationReason: recommendation.reason,
    variants,
    installed: scan.kind === 'installed' ? scan.info : null,
    install: getAiRuntimeInstallProgress(),
    lastError,
    gpu: { name: gpu?.name ?? null, driverVersion: gpu?.driverVersion ?? null, vramTotalMB: gpu?.vramTotalMB ?? null },
    rootPath: root,
    rootBudgetChars: rootBudgetChars(AI_RUNTIME_CATALOGUE.cu126.maxRelativePathLength),
    longPathsEnabled: longPaths,
    diskFreeBytes,
  };
}
