// The export-pinning half of SHOT_QUALITY_DESIGN Q4: a project that uses the
// kit carries its own snapshot at <project>/kit/<version>/, copied from the
// installed pack the first time a kit-importing shot version is saved.
// Write-once — the FIRST snapshot is the project's pin, so app upgrades (and
// their kit updates) never restyle an existing project's exports, and the
// snapshot travels with a handed-off project folder. The pin is folder-as-
// truth: no project.json field, so main never races the renderer's autosave.
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { collectImportSpecifiers } from '../../../shared/studio/shot-lint';
import { getShotKitDir } from '../../utils/paths';
import { readKitPackVersion } from '../kit-bundler';
import { getProjectDir } from './studio-paths';

const log = logEngine.createLogger('ShotKitPin');

export const KIT_SPECIFIER = '@vidtsx/kit';
const VERSION_DIR_PATTERN = /^\d+\.\d+\.\d+$/;

export function shotUsesKit(source: string): boolean {
  return collectImportSpecifiers(source).includes(KIT_SPECIFIER);
}

export interface KitPin {
  version: string;
  /** Directory holding the pinned kit sources (index.tsx + friends). */
  dir: string;
}

function installedKitDir(): string {
  return path.join(getShotKitDir(), 'core');
}

/** The project's pinned kit snapshot, if one exists. Multiple version folders
 *  should never happen (snapshotting is write-once); if they do, the lowest
 *  version wins — it is the one the project's oldest shots were built against. */
export async function getProjectKitPin(projectId: string): Promise<KitPin | null> {
  const kitRoot = path.join(await getProjectDir(projectId), 'kit');
  let entries;
  try {
    entries = await fs.readdir(kitRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  const versions = entries
    .filter((e) => e.isDirectory() && VERSION_DIR_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
    });
  if (versions.length === 0) return null;
  if (versions.length > 1) {
    log.warn('Project has multiple kit snapshots — pinning the oldest', { projectId, versions });
  }
  return { version: versions[0], dir: path.join(kitRoot, versions[0]) };
}

async function copyKitFiles(fromDir: string, toDir: string): Promise<void> {
  await fs.mkdir(toDir, { recursive: true });
  for (const name of await fs.readdir(fromDir)) {
    if (!name.endsWith('.tsx') && name !== 'pack.json' && name !== 'MANIFEST.md') continue;
    await fs.copyFile(path.join(fromDir, name), path.join(toDir, name));
  }
}

/**
 * Return the project's kit pin, snapshotting the installed pack on first use.
 * Best-effort: returns null when no snapshot exists AND none can be created
 * (missing pack) — callers decide whether that blocks (export) or not
 * (generation must never fail because a snapshot copy did).
 */
export async function ensureProjectKitSnapshot(projectId: string): Promise<KitPin | null> {
  const existing = await getProjectKitPin(projectId);
  if (existing) return existing;
  try {
    const source = installedKitDir();
    await fs.access(path.join(source, 'index.tsx'));
    const version = await readKitPackVersion(source);
    const dest = path.join(await getProjectDir(projectId), 'kit', version);
    await copyKitFiles(source, dest);
    log.info('Pinned kit snapshot into project', { projectId, version });
    return { version, dir: dest };
  } catch (err) {
    log.warn('Could not snapshot the kit into the project', {
      projectId,
      error: String(err),
    });
    return null;
  }
}

/**
 * The pin an export renders against: the project snapshot (creating it for
 * adopted/imported kit shots that never went through generation), falling back
 * to the installed pack in place. Throws a pointed error when a shot imports
 * the kit but no kit exists anywhere — the export must block, not fail deep
 * inside webpack.
 */
export async function resolveKitPinForExport(projectId: string): Promise<KitPin> {
  const pin = await ensureProjectKitSnapshot(projectId);
  if (pin) return pin;
  const source = installedKitDir();
  try {
    await fs.access(path.join(source, 'index.tsx'));
    return { version: await readKitPackVersion(source), dir: source };
  } catch {
    throw new Error(
      'A shot imports @vidtsx/kit but no kit is available (project snapshot and installed pack both missing) — reinstall the app or remove the kit-using shots.',
    );
  }
}

/** Copy a pinned kit into the export entry dir (beside the shot copies). */
export async function copyKitPinTo(pin: KitPin, destDir: string): Promise<void> {
  await copyKitFiles(pin.dir, destDir);
}
