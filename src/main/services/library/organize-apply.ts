import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibraryOrganizeMove } from '../../../shared/ipc/types/library';
import { resolveLibraryPath } from './library-paths';
import { scanLibrary } from './library-store';
import { EMPTY_IN_USE, type InUseSet } from './organize-plan';

const log = logEngine.createLogger('LibraryOrganizeApply');

/**
 * Applying an accepted organize plan (ASSET_LIBRARY_DESIGN.md L7) — real
 * disk moves, then one re-scan.
 *
 * The index is deliberately NOT patched by hand: `scanLibrary` re-keys a
 * moved file by content hash and carries its description across
 * (`library-reconcile.ts` pass 2), so the re-scan IS the index update. Any
 * hand-written re-key here would be a second, divergent implementation of
 * the rule that already heals Explorer-side moves.
 */

export interface ApplyMovesResult {
  moved: number;
  /** Per-move failures — applying is per-item, never batch-fatal. */
  failures: Array<{ relPath: string; error: string }>;
  /** Refused because the asset is in use by the open project. */
  refused: string[];
  entries: LibraryIndexEntry[];
}

/**
 * `inUse` is re-checked HERE, not only at suggest time: the user can open a
 * project between reviewing a plan and accepting it, and the renderer is
 * not the authority on a safety rule (L7 Rev 2). A refused move is
 * reported, not thrown — the rest of the batch still lands.
 */
export async function applyMoves(
  root: string,
  moves: ReadonlyArray<LibraryOrganizeMove>,
  inUse: InUseSet = EMPTY_IN_USE,
): Promise<ApplyMovesResult> {
  const failures: Array<{ relPath: string; error: string }> = [];
  const refused: string[] = [];
  let moved = 0;

  for (const move of moves) {
    if (inUse.relPaths.has(move.relPath)) {
      refused.push(move.relPath);
      continue;
    }
    try {
      const from = resolveLibraryPath(root, move.relPath); // traversal guard
      const to = resolveLibraryPath(root, move.toRelPath);
      // Never overwrite: the destination must be free at the moment of the
      // move, not merely when the plan was built.
      if (await exists(to)) throw new Error('Destination already exists');
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      moved += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn('Organize move failed', { relPath: move.relPath, error: message.slice(0, 300) });
      failures.push({ relPath: move.relPath, error: message.slice(0, 300) });
    }
  }

  const entries = await scanLibrary(root);
  log.info('Organize applied', { moved, failed: failures.length, refused: refused.length });
  return { moved, failures, refused, entries };
}

async function exists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}
