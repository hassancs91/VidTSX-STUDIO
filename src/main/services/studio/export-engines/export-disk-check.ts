/**
 * The export disk preflight, against the real disks (docs/studio/END_TO_END_PLAN.md §2 T7,
 * part A2): stat the files the export reads, estimate (`disk-estimate.ts`), probe the free
 * space of the output drive and the `%TEMP%` drive, and judge (`disk-preflight.ts`).
 *
 * Runs before an export creates anything: a refusal leaves the output path untouched.
 * A drive whose free space cannot be read (a network share without statfs) is not judged.
 */
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../../logging/log-engine';
import { getTempDir } from '../../../utils/paths';
import type { ExportEngineId } from '../../../../shared/studio/export-engines';
import type { StudioProject } from '../../../../shared/types/studio';
import type { StudioExportEntry } from '../export-entry';
import { devFreeBytesFor } from './disk-dev-overrides';
import { estimateExportDisk, type ExportDiskEstimate } from './disk-estimate';
import { diskPreflightVerdict, formatBytes, type DiskPreflightVerdict, type DiskVolume } from './disk-preflight';
import { exportDiskSources } from './disk-sources';
import { exportOutputSize } from './output-size';
import type { ExportRenderSettings } from './types';

const log = logEngine.createLogger('StudioExportDisk');

export interface ExportDiskCheckInput {
  jobId: string;
  engineId: ExportEngineId;
  project: StudioProject;
  entry: StudioExportEntry;
  render: ExportRenderSettings;
  outputPath: string;
}

export interface ExportDiskCheck {
  estimate: ExportDiskEstimate;
  /** Null when a drive's free space could not be read. */
  verdict: DiskPreflightVerdict | null;
}

/** Estimate and judge; never throws (a probe that fails just skips the verdict). */
export async function checkExportDisk(input: ExportDiskCheckInput): Promise<ExportDiskCheck> {
  const { files, longestShotRunSeconds } = exportDiskSources(input.project, input.entry);
  const sources = await Promise.all(
    files.map(async (file) => ({
      bytes: (await fs.stat(file.path).catch(() => null))?.size ?? 0,
      durationSeconds: file.durationSeconds,
      videoSeconds: file.videoSeconds,
    })),
  );
  const size = exportOutputSize(input.entry, input.render);
  const estimate = estimateExportDisk({
    engineId: input.engineId,
    width: size.width,
    height: size.height,
    fps: input.entry.fps,
    durationInFrames: input.entry.durationInFrames,
    crf: input.render.crf,
    sources,
    longestShotRunSeconds,
  });
  const [output, temp] = await Promise.all([volumeOf(path.dirname(input.outputPath)), volumeOf(getTempDir())]);
  const verdict = output && temp ? diskPreflightVerdict(estimate, { output, temp }) : null;
  log.info('Export disk estimate', {
    jobId: input.jobId,
    engine: input.engineId,
    sources: files.length,
    output: formatBytes(estimate.outputBytes),
    temp: formatBytes(estimate.tempBytes),
    parts: estimate.temp,
    drives: verdict?.drives.map((d) => `${d.label} needs ${formatBytes(d.needBytes)}, has ${formatBytes(d.freeBytes)}`) ?? 'not read',
  });
  return { estimate, verdict };
}

/** The volume a folder lives on — the nearest existing parent's, since the folder may not exist yet. */
async function volumeOf(dir: string): Promise<DiskVolume | null> {
  try {
    const existing = await nearestExisting(path.resolve(dir));
    const [stat, space] = await Promise.all([fs.stat(existing), fs.statfs(existing)]);
    const label = labelOf(existing);
    const freeBytes = devFreeBytesFor(label) ?? space.bavail * space.bsize;
    return { key: String(stat.dev), label, freeBytes };
  } catch (err) {
    log.warn('Could not read free disk space', { dir, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function nearestExisting(dir: string): Promise<string> {
  let current = dir;
  for (;;) {
    if (await fs.stat(current).then(() => true, () => false)) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`No existing folder above ${dir}`);
    current = parent;
  }
}

/** "C:" for a drive letter; the share root otherwise. */
function labelOf(dir: string): string {
  const root = path.parse(dir).root;
  return root.replace(/[\\/]+$/, '') || root;
}
