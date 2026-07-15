/**
 * Model file importer — brings a user-supplied file into the models folder.
 *
 * Move (default) is a rename (instant even for 13 GB on the same volume), with
 * a copy+unlink fallback for cross-volume moves (EXDEV). Collisions are a typed
 * error, never a silent overwrite. No `electron` import.
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ModelLibraryError,
  type ImportMode,
} from '@shared/model-library/types';

/**
 * Import `sourcePath` into `destDir` under its original basename.
 * Returns the absolute destination path. Throws `ModelLibraryError`:
 * - `'file-exists'` when the destination already exists (no overwrite).
 * - `'missing-file'` when the source does not exist.
 */
export async function importModelFile(
  sourcePath: string,
  destDir: string,
  mode: ImportMode,
): Promise<string> {
  const destPath = path.join(destDir, path.basename(sourcePath));

  try {
    await fs.access(sourcePath);
  } catch {
    throw new ModelLibraryError('missing-file', `Source file not found: ${sourcePath}`);
  }

  await fs.mkdir(destDir, { recursive: true });

  if (await pathExists(destPath)) {
    throw new ModelLibraryError(
      'file-exists',
      `A file named "${path.basename(sourcePath)}" already exists in the models folder.`,
    );
  }

  if (mode === 'copy') {
    await fs.copyFile(sourcePath, destPath);
    return destPath;
  }

  // mode === 'move'
  try {
    await fs.rename(sourcePath, destPath);
  } catch (err) {
    if (errnoCode(err) === 'EXDEV') {
      // Cross-volume: rename can't span devices, so copy then remove the source.
      await fs.copyFile(sourcePath, destPath);
      await fs.unlink(sourcePath);
    } else {
      throw new ModelLibraryError(
        'import-failed',
        `Failed to move file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return destPath;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function errnoCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const { code } = err as { code?: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
