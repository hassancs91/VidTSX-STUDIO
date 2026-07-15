/**
 * Category-agnostic model scanner.
 *
 * Recursively walks the models folder collecting candidate model files
 * (single-file categories) and matches directory-based install units
 * (directory categories, e.g. sherpa audio). No `electron` import, no
 * settings access — the root dir and options are passed in, which keeps this
 * unit-testable against real temp dirs.
 */
import { promises as fs, type Dirent } from 'fs';
import * as path from 'path';
import type {
  ModelProfileEnvelope,
  ScannedFile,
} from '@shared/model-library/types';

export interface ScanOptions {
  /** Lower-cased or mixed-case extensions with leading dot, e.g. ['.safetensors', '.gguf']. */
  extensions: string[];
  /** Max recursion depth below the root. Default 3 — enough for old `image/<dir>/<file>` layouts. */
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 3;

/**
 * Recursively find files under `rootDir` whose extension is in `extensions`.
 * Tolerant: a missing root returns `[]`; unreadable entries/dirs are skipped
 * rather than throwing. Dot-directories (`.git`, `.cache`, …) are skipped.
 */
export async function scanModelFiles(
  rootDir: string,
  options: ScanOptions,
): Promise<ScannedFile[]> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const wantedExts = new Set(options.extensions.map((e) => e.toLowerCase()));
  const results: ScannedFile[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    const entries = await safeReadDir(dir);
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue; // skip dot-dirs
        if (depth >= maxDepth) continue;
        await walk(entryPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!wantedExts.has(ext)) continue;

      try {
        const stat = await fs.stat(entryPath);
        results.push({
          absolutePath: entryPath,
          fileName: entry.name,
          sizeBytes: stat.size,
          relDepth: depth,
        });
      } catch {
        // Unreadable file — skip it, keep scanning.
      }
    }
  }

  await walk(rootDir, 0);
  return results;
}

export interface DirectoryUnitMatch {
  profileId: string;
  /** Absolute path to the matched directory. */
  dirPath: string;
  sizeBytes: number;
}

/**
 * Match `directory` install-kind profiles against `rootDir`. A profile matches
 * when `<rootDir>/<directoryUnit.dirName>` exists and every required file is
 * present inside it (generalizes audio's `isModelDownloaded`). Profiles without
 * a `directoryUnit` are ignored.
 */
export async function matchDirectoryUnits<TMeta>(
  rootDir: string,
  profiles: ModelProfileEnvelope<TMeta>[],
): Promise<DirectoryUnitMatch[]> {
  const matches: DirectoryUnitMatch[] = [];

  for (const profile of profiles) {
    const unit = profile.directoryUnit;
    if (!unit) continue;

    const dirPath = path.join(rootDir, unit.dirName);
    const allPresent = await allFilesExist(dirPath, unit.files);
    if (!allPresent) continue;

    const sizeBytes = await dirSize(dirPath);
    matches.push({ profileId: profile.id, dirPath, sizeBytes });
  }

  return matches;
}

async function allFilesExist(dirPath: string, files: string[]): Promise<boolean> {
  for (const file of files) {
    try {
      await fs.access(path.join(dirPath, file));
    } catch {
      return false;
    }
  }
  return true;
}

/** `fs.readdir` with dirents, returning `[]` on any error (missing/unreadable dir). */
async function safeReadDir(dir: string): Promise<Dirent<string>[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Best-effort recursive size of a directory; unreadable entries count as 0. */
async function dirSize(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await safeReadDir(dirPath);

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(entryPath);
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(entryPath);
        total += stat.size;
      } catch {
        // ignore unreadable file
      }
    }
  }
  return total;
}
