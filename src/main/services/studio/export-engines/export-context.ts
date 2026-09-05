/**
 * What an export engine needs beyond the Remotion entry: the (range-trimmed)
 * document the entry was generated from. `studioExportPrepare` runs in one
 * IPC call and the render starts in another — possibly after an app restart
 * with the job still queued — so the context is written beside the entry
 * (`<entry>.json`, same `studio-entry-` prefix, same 24 h sweep) and read
 * back by entry path when the export starts.
 */
import fs from 'fs/promises';
import type { StudioProject } from '../../../../shared/types/studio';
import type { StudioExportEntry } from '../export-entry';

export interface StudioExportContext {
  project: StudioProject;
  entry: StudioExportEntry;
}

export function exportContextPath(entryPath: string): string {
  return `${entryPath}.json`;
}

export async function writeExportContext(context: StudioExportContext): Promise<void> {
  await fs.writeFile(exportContextPath(context.entry.entryPath), JSON.stringify(context), 'utf-8');
}

/** Null when the entry has no sidecar (an entry from before the seam, or swept). */
export async function readExportContext(entryPath: string): Promise<StudioExportContext | null> {
  try {
    const raw = await fs.readFile(exportContextPath(entryPath), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StudioExportContext>;
    if (!parsed.project || !parsed.entry || parsed.entry.entryPath !== entryPath) return null;
    return { project: parsed.project, entry: parsed.entry };
  } catch {
    return null;
  }
}
